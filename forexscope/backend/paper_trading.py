from datetime import datetime, timezone
import math

from backend.data_provider import ForexDataProvider
from backend.database import Database
from backend.models import Direction, Trade, TradeCreate
from backend.risk_manager import (
    MAXIMUM_DAILY_LOSS_PERCENT,
    MAXIMUM_OPEN_TRADES,
    calculate_trade_pnl,
    validate_trade_prices,
)
from backend.scanner import scan_market


def _row_to_trade(row) -> Trade:
    return Trade(**dict(row))


def list_trades(database: Database, status: str | None = None) -> list[Trade]:
    query = "SELECT * FROM trades"
    parameters: tuple = ()
    if status:
        query += " WHERE status = ?"
        parameters = (status.upper(),)
    query += " ORDER BY entry_time DESC, id DESC"
    with database.connect() as connection:
        rows = connection.execute(query, parameters).fetchall()
    return [_row_to_trade(row) for row in rows]


def open_trade(
    database: Database, provider: ForexDataProvider, request: TradeCreate
) -> Trade:
    pair = request.pair.strip().upper()
    instrument = next(
        (item for item in provider.instruments() if item["symbol"] == pair), None
    )
    if instrument is None:
        raise ValueError(f"{pair} is not available from the configured data provider.")
    if instrument["quote"] != "USD":
        raise ValueError(
            "Paper trades are limited to USD-quoted pairs until verified account "
            "currency conversions are available."
        )

    scan = next((item for item in scan_market(provider) if item["symbol"] == pair), None)
    if scan is None or scan["stale"] or scan["signal"] != request.direction.value:
        raise ValueError(
            "A fresh matching sample signal is required to open a simulated trade."
        )

    validate_trade_prices(request)
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    equity_setting = f"starting_equity:{now.date().isoformat()}"
    with database.connect() as connection:
        setting = connection.execute(
            "SELECT value FROM settings WHERE key = ?", (equity_setting,)
        ).fetchone()
        daily_equity = (
            float(setting["value"])
            if setting
            else request.simulated_equity
        )
        if not math.isclose(
            request.simulated_equity, daily_equity, rel_tol=1e-9, abs_tol=1e-9
        ):
            raise ValueError(
                f"Simulated equity is fixed at {daily_equity:.2f} USD for the day "
                "to keep risk limits consistent."
            )

        open_count = connection.execute(
            "SELECT COUNT(*) FROM trades WHERE status = 'OPEN'"
        ).fetchone()[0]
        if open_count >= MAXIMUM_OPEN_TRADES:
            raise ValueError(
                f"At most {MAXIMUM_OPEN_TRADES} simulated trades may be open."
            )
        duplicate = connection.execute(
            "SELECT 1 FROM trades WHERE pair = ? AND direction = ? AND status = 'OPEN'",
            (pair, request.direction.value),
        ).fetchone()
        if duplicate:
            raise ValueError("An open simulated trade already exists for this pair and direction.")

        losses = connection.execute(
            """
            SELECT COALESCE(SUM(CASE WHEN simulated_pnl < 0 THEN -simulated_pnl ELSE 0 END), 0)
            FROM trades
            WHERE status = 'CLOSED' AND pnl_currency = 'USD' AND exit_time >= ?
            """,
            (day_start,),
        ).fetchone()[0]
        planned_loss = abs(request.entry - request.stop_loss) * request.position_units
        daily_loss_limit = daily_equity * MAXIMUM_DAILY_LOSS_PERCENT / 100
        if (
            losses + planned_loss > daily_loss_limit
            and not math.isclose(
                losses + planned_loss, daily_loss_limit, rel_tol=1e-9, abs_tol=1e-9
            )
        ):
            raise ValueError(
                "This trade would exceed the 2% simulated daily-loss limit for this equity."
            )

        if setting is None:
            connection.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)",
                (equity_setting, str(daily_equity)),
            )
        cursor = connection.execute(
            """
            INSERT INTO trades (
                pair, direction, entry, stop_loss, take_profit, position_units,
                simulated_equity, status, entry_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
            """,
            (
                pair,
                request.direction.value,
                request.entry,
                request.stop_loss,
                request.take_profit,
                request.position_units,
                request.simulated_equity,
                now.isoformat(),
            ),
        )
        row = connection.execute(
            "SELECT * FROM trades WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return _row_to_trade(row)


def close_trade(database: Database, trade_id: int, exit_price: float) -> Trade:
    now = datetime.now(timezone.utc).isoformat()
    with database.connect() as connection:
        row = connection.execute(
            "SELECT * FROM trades WHERE id = ?", (trade_id,)
        ).fetchone()
        if row is None:
            raise LookupError("Simulated trade not found.")
        if row["status"] != "OPEN":
            raise ValueError("This simulated trade is already closed.")
        pnl = calculate_trade_pnl(
            Direction(row["direction"]),
            row["entry"],
            exit_price,
            row["position_units"],
        )
        connection.execute(
            """
            UPDATE trades
            SET status = 'CLOSED', exit_time = ?, exit_price = ?,
                simulated_pnl = ?, pnl_currency = 'USD'
            WHERE id = ?
            """,
            (now, exit_price, pnl, trade_id),
        )
        updated = connection.execute(
            "SELECT * FROM trades WHERE id = ?", (trade_id,)
        ).fetchone()
    return _row_to_trade(updated)


def trade_statistics(database: Database) -> dict:
    closed = [
        trade
        for trade in list_trades(database, "CLOSED")
        if trade.simulated_pnl is not None
    ]
    chronological = sorted(closed, key=lambda trade: (trade.exit_time or "", trade.id))
    running = 0.0
    peak = 0.0
    max_drawdown = 0.0
    for trade in chronological:
        running += trade.simulated_pnl or 0
        peak = max(peak, running)
        max_drawdown = max(max_drawdown, peak - running)
    wins = sum(1 for trade in closed if (trade.simulated_pnl or 0) > 0)
    return {
        "closed_trades": len(closed),
        "win_rate_percent": wins / len(closed) * 100 if closed else 0,
        "net_simulated_pnl": sum(trade.simulated_pnl or 0 for trade in closed),
        "maximum_drawdown": max_drawdown,
        "pnl_currency": "USD",
        "notice": "Simulated results only; prices and costs are not live or investment advice.",
    }
