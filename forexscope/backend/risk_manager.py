import math

from backend.models import Direction, RiskRequest, RiskResult, TradeCreate

DEFAULT_RISK_PER_TRADE_PERCENT = 0.5
MAXIMUM_DAILY_LOSS_PERCENT = 2.0
MAXIMUM_OPEN_TRADES = 3
MINIMUM_REWARD_TO_RISK = 1.5


def calculate_risk(request: RiskRequest) -> RiskResult:
    pair = request.pair.strip().upper()
    if "/" not in pair:
        raise ValueError("Choose a valid currency pair in BASE/QUOTE format.")
    distance = abs(request.entry - request.stop_loss)
    reward = abs(request.take_profit - request.entry)
    if distance == 0:
        raise ValueError("Stop-loss must be different from the entry price.")

    ratio = reward / distance
    return RiskResult(
        pair=pair,
        risk_amount=request.equity * request.risk_percent / 100,
        stop_distance=distance,
        potential_reward_distance=reward,
        reward_to_risk=ratio,
        position_size_note=(
            "Position size is unavailable: the sample provider does not supply "
            "verified contract sizes, pip values, spreads, or account-currency "
            "conversion rates. Risk amount is a budget only, not a trade loss estimate."
        ),
    )


def validate_trade_prices(trade: TradeCreate) -> float:
    if trade.direction == Direction.BUY:
        if not trade.stop_loss < trade.entry < trade.take_profit:
            raise ValueError(
                "For a BUY simulation, stop-loss must be below entry and "
                "take-profit must be above entry."
            )
    elif not trade.take_profit < trade.entry < trade.stop_loss:
        raise ValueError(
            "For a SELL simulation, take-profit must be below entry and "
            "stop-loss must be above entry."
        )

    risk_distance = abs(trade.entry - trade.stop_loss)
    reward_distance = abs(trade.take_profit - trade.entry)
    ratio = reward_distance / risk_distance
    if ratio < MINIMUM_REWARD_TO_RISK:
        raise ValueError(f"Reward-to-risk must be at least {MINIMUM_REWARD_TO_RISK}:1.")
    monetary_risk = risk_distance * trade.position_units
    risk_limit = trade.simulated_equity * DEFAULT_RISK_PER_TRADE_PERCENT / 100
    if monetary_risk > risk_limit and not math.isclose(
        monetary_risk, risk_limit, rel_tol=1e-9, abs_tol=1e-9
    ):
        raise ValueError(
            "Position size exceeds the 0.5% simulated-equity risk limit for "
            "USD-quoted pairs."
        )
    return ratio


def calculate_trade_pnl(
    direction: Direction, entry: float, exit_price: float, position_units: float
) -> float:
    change = exit_price - entry
    if direction == Direction.SELL:
        change = -change
    return change * position_units
