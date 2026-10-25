from datetime import datetime, timezone
import math

from backend.data_provider import ForexDataProvider
from backend.indicators import ema, rsi


def analyze_instrument(instrument: dict, candles: list[dict]) -> dict:
    invalid_candle = any(
        not all(
            math.isfinite(float(candle[key])) and float(candle[key]) > 0
            for key in ("open", "high", "low", "close")
        )
        or float(candle["high"]) < max(float(candle["open"]), float(candle["close"]))
        or float(candle["low"]) > min(float(candle["open"]), float(candle["close"]))
        for candle in candles
    )
    if invalid_candle:
        return {
            **instrument,
            "price": None,
            "change_percent": None,
            "ema20": None,
            "ema50": None,
            "rsi14": None,
            "signal": "NO SIGNAL",
            "signal_reason": "Market data contains invalid candle values.",
            "last_candle_time": None,
            "stale": True,
            "data_source": "Sample data",
            "timeframe": "1h",
        }

    closes = [float(candle["close"]) for candle in candles]
    ema20_values = ema(closes, 20)
    ema50_values = ema(closes, 50)
    rsi_values = rsi(closes, 14)
    last_index = len(candles) - 1
    ema20 = ema20_values[last_index] if last_index >= 0 else None
    ema50 = ema50_values[last_index] if last_index >= 0 else None
    latest_rsi = rsi_values[last_index] if last_index >= 0 else None
    last_candle_time = candles[-1]["time"] if candles else None

    stale = True
    if last_candle_time:
        timestamp = datetime.fromisoformat(last_candle_time)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        stale = (datetime.now(timezone.utc) - timestamp).total_seconds() > 24 * 3600

    if len(candles) < 50 or ema20 is None or ema50 is None or latest_rsi is None:
        signal = "NO SIGNAL"
        reason = "There is not enough completed candle history to calculate the indicators."
    elif stale:
        signal = "NO SIGNAL"
        reason = "The latest completed candle is stale, so no paper-trade signal is available."
    elif ema20 > ema50 and 50 < latest_rsi < 70:
        signal = "BUY"
        reason = "EMA 20 is above EMA 50 and RSI is between 50 and 70."
    elif ema20 < ema50 and 30 < latest_rsi < 50:
        signal = "SELL"
        reason = "EMA 20 is below EMA 50 and RSI is between 30 and 50."
    else:
        signal = "NO SIGNAL"
        reason = "The example EMA and RSI rules are not all satisfied."

    close = closes[-1] if closes else None
    previous_close = closes[-2] if len(closes) > 1 else None
    change_percent = (
        ((close - previous_close) / previous_close) * 100
        if close is not None and previous_close
        else None
    )
    if any(
        value is not None and not math.isfinite(value)
        for value in (ema20, ema50, latest_rsi, close, change_percent)
    ):
        signal = "NO SIGNAL"
        reason = "Market data produced invalid indicator values."
        ema20 = ema50 = latest_rsi = close = change_percent = None

    return {
        **instrument,
        "price": close,
        "change_percent": change_percent,
        "ema20": ema20,
        "ema50": ema50,
        "rsi14": latest_rsi,
        "signal": signal,
        "signal_reason": reason,
        "last_candle_time": last_candle_time,
        "stale": stale,
        "data_source": "Sample data",
        "timeframe": "1h",
    }


def scan_market(provider: ForexDataProvider) -> list[dict]:
    results = []
    for instrument in provider.instruments():
        try:
            candles = provider.candles(instrument["symbol"])
            results.append(analyze_instrument(instrument, candles))
        except (KeyError, TypeError, ValueError):
            results.append(
                {
                    **instrument,
                    "price": None,
                    "change_percent": None,
                    "ema20": None,
                    "ema50": None,
                    "rsi14": None,
                    "signal": "NO SIGNAL",
                    "signal_reason": "Market data is invalid or unavailable.",
                    "last_candle_time": None,
                    "stale": True,
                    "data_source": "Sample data",
                    "timeframe": "1h",
                }
            )
    return results
