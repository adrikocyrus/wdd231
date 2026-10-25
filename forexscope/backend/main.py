from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend import paper_trading
from backend.config import BASE_DIR, DATA_MODE, DATABASE_PATH
from backend.data_provider import DataProviderError, SampleDataProvider
from backend.database import Database
from backend.models import (
    RiskRequest,
    RiskResult,
    Trade,
    TradeClose,
    TradeCreate,
    WatchlistItem,
)
from backend.risk_manager import calculate_risk
from backend.scanner import scan_market

FRONTEND_DIR = BASE_DIR / "frontend"
app = FastAPI(
    title="ForexScope",
    description=(
        "Educational market scanner and paper-trading demo. "
        "It does not execute real-money trades."
    ),
    version="0.1.0",
)
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")

if DATA_MODE == "sample":
    provider = SampleDataProvider()
else:
    provider = None
database = Database(DATABASE_PATH)


def get_provider():
    if provider is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Real market data is not configured. This milestone supports "
                "sample mode only; no provider credentials or live endpoints are used."
            ),
        )
    return provider


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "data_mode": DATA_MODE,
        "data_source": "Generated sample data (not live market data)"
        if provider
        else "Unavailable",
        "real_trading": False,
    }


@app.get("/api/instruments")
def instruments():
    return {
        "data_source": "Sample data",
        "instruments": get_provider().instruments(),
        "available_timeframes": get_provider().available_timeframes,
    }


@app.get("/api/market")
def market():
    return {
        "data_mode": "sample",
        "data_source": get_provider().name,
        "available_timeframes": get_provider().available_timeframes,
        "instruments": scan_market(get_provider()),
    }


@app.get("/api/candles/{symbol:path}")
def candles(symbol: str, timeframe: str = Query(default="1h")):
    pair = symbol.replace("-", "/").upper()
    try:
        items = get_provider().candles(pair, timeframe)
    except DataProviderError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {
        "symbol": pair,
        "timeframe": timeframe,
        "data_source": "Sample data",
        "candles": items,
    }


@app.get("/api/signals")
def signals():
    return {
        "data_source": "Sample data",
        "signals": scan_market(get_provider()),
        "strategy_notice": (
            "Educational example rules only; they are not a proven profitable strategy."
        ),
    }


@app.get("/api/signals/{symbol:path}")
def signal_detail(symbol: str):
    pair = symbol.replace("-", "/").upper()
    result = next(
        (item for item in scan_market(get_provider()) if item["symbol"] == pair), None
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Currency pair not found.")
    return result


@app.post("/api/risk/calculate", response_model=RiskResult)
def risk_calculation(request: RiskRequest):
    try:
        pair = request.pair.strip().upper()
        if not any(item["symbol"] == pair for item in get_provider().instruments()):
            raise ValueError(
                "Currency pair is not available from the configured provider."
            )
        return calculate_risk(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/watchlist")
def get_watchlist():
    with database.connect() as connection:
        rows = connection.execute("SELECT pair FROM watchlist ORDER BY pair").fetchall()
    return {"pairs": [row["pair"] for row in rows]}


@app.post("/api/watchlist")
def add_watchlist_item(item: WatchlistItem):
    pair = item.pair.strip().upper()
    if not any(row["symbol"] == pair for row in get_provider().instruments()):
        raise HTTPException(status_code=404, detail="Currency pair not found.")
    with database.connect() as connection:
        connection.execute("INSERT OR IGNORE INTO watchlist (pair) VALUES (?)", (pair,))
    return {"pair": pair, "saved": True}


@app.delete("/api/watchlist/{symbol:path}")
def remove_watchlist_item(symbol: str):
    pair = symbol.replace("-", "/").upper()
    with database.connect() as connection:
        connection.execute("DELETE FROM watchlist WHERE pair = ?", (pair,))
    return {"pair": pair, "saved": False}


@app.get("/api/trades", response_model=list[Trade])
def get_trades(status: str | None = Query(default=None, pattern="^(OPEN|CLOSED)$")):
    return paper_trading.list_trades(database, status)


@app.post("/api/trades", response_model=Trade, status_code=201)
def create_trade(request: TradeCreate):
    try:
        return paper_trading.open_trade(database, get_provider(), request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/trades/{trade_id}/close", response_model=Trade)
def close_trade(trade_id: int, request: TradeClose):
    try:
        return paper_trading.close_trade(database, trade_id, request.exit_price)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.get("/api/trades/statistics")
def statistics():
    return paper_trading.trade_statistics(database)
