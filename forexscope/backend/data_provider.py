import math
from datetime import datetime, timedelta, timezone
from typing import Protocol


class DataProviderError(RuntimeError):
    pass


class ForexDataProvider(Protocol):
    name: str

    def instruments(self) -> list[dict]:
        ...

    def candles(self, symbol: str, timeframe: str = "1h") -> list[dict]:
        ...


class SampleDataProvider:
    name = "Generated sample data (not live market data)"
    available_timeframes = ["1h"]

    _instruments = [
        {"symbol": "EUR/USD", "category": "Major", "base": "EUR", "quote": "USD"},
        {"symbol": "GBP/USD", "category": "Major", "base": "GBP", "quote": "USD"},
        {"symbol": "USD/JPY", "category": "Major", "base": "USD", "quote": "JPY"},
        {"symbol": "AUD/USD", "category": "Major", "base": "AUD", "quote": "USD"},
        {"symbol": "EUR/GBP", "category": "Minor", "base": "EUR", "quote": "GBP"},
        {"symbol": "USD/UGX", "category": "Exotic", "base": "USD", "quote": "UGX"},
    ]

    def __init__(self) -> None:
        current_hour = datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
        self.last_closed_hour = current_hour - timedelta(hours=1)
        self._cache: dict[str, list[dict]] = {}

    def instruments(self) -> list[dict]:
        return [dict(item) for item in self._instruments]

    def candles(self, symbol: str, timeframe: str = "1h") -> list[dict]:
        if timeframe not in self.available_timeframes:
            raise DataProviderError(
                f"Only {', '.join(self.available_timeframes)} candles are available "
                "in sample mode."
            )

        instrument = next(
            (item for item in self._instruments if item["symbol"] == symbol), None
        )
        if instrument is None:
            raise DataProviderError(f"{symbol} is not available in sample mode.")

        if symbol not in self._cache:
            self._cache[symbol] = self._make_candles(instrument)
        return [dict(candle) for candle in self._cache[symbol]]

    def _make_candles(self, instrument: dict) -> list[dict]:
        symbol = instrument["symbol"]
        start_prices = {
            "EUR/USD": 1.075,
            "GBP/USD": 1.265,
            "USD/JPY": 149.2,
            "AUD/USD": 0.658,
            "EUR/GBP": 0.854,
            "USD/UGX": 3750.0,
        }
        direction = -1 if symbol in {"GBP/USD", "USD/UGX"} else 1
        base_price = start_prices[symbol]
        scale = base_price * (0.00035 if base_price < 10 else 0.00008)
        candles = []
        previous_close = base_price

        for index in range(120):
            wave = math.sin(index * 0.73) * 0.00032
            trend = direction * index * 0.000035
            close = base_price * (1 + wave + trend)
            open_price = previous_close
            high = max(open_price, close) + scale * (0.3 + (index % 4) * 0.08)
            low = min(open_price, close) - scale * (0.3 + (index % 3) * 0.07)
            timestamp = self.last_closed_hour - timedelta(hours=119 - index)
            candles.append(
                {
                    "time": timestamp.isoformat(),
                    "open": round(open_price, 6),
                    "high": round(high, 6),
                    "low": round(low, 6),
                    "close": round(close, 6),
                }
            )
            previous_close = close

        return candles

