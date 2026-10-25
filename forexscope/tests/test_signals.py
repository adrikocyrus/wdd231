import unittest
from datetime import datetime, timedelta, timezone

from backend.data_provider import SampleDataProvider
from backend.scanner import analyze_instrument, scan_market


class SignalTests(unittest.TestCase):
    def setUp(self):
        self.provider = SampleDataProvider()

    def test_sample_market_has_buy_and_sell_examples(self):
        results = scan_market(self.provider)
        signals = {row["signal"] for row in results}
        self.assertIn("BUY", signals)
        self.assertIn("SELL", signals)
        self.assertTrue(all(row["data_source"] == "Sample data" for row in results))

    def test_signal_is_neutral_when_history_is_insufficient(self):
        instrument = self.provider.instruments()[0]
        result = analyze_instrument(instrument, self.provider.candles(instrument["symbol"])[:10])
        self.assertEqual(result["signal"], "NO SIGNAL")

    def test_stale_data_never_generates_actionable_signal(self):
        instrument = self.provider.instruments()[0]
        candles = self.provider.candles(instrument["symbol"])
        stale = datetime.now(timezone.utc) - timedelta(days=3)
        for index, candle in enumerate(candles):
            candle["time"] = (stale - timedelta(hours=len(candles) - index)).isoformat()
        result = analyze_instrument(instrument, candles)
        self.assertTrue(result["stale"])
        self.assertEqual(result["signal"], "NO SIGNAL")

    def test_invalid_candle_values_are_rejected_by_calculations(self):
        instrument = self.provider.instruments()[0]
        candles = self.provider.candles(instrument["symbol"])
        candles[-1]["close"] = float("nan")
        result = analyze_instrument(instrument, candles)
        self.assertEqual(result["signal"], "NO SIGNAL")
        self.assertTrue(result["stale"])


if __name__ == "__main__":
    unittest.main()
