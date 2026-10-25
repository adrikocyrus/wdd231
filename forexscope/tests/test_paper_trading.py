import tempfile
import unittest
from pathlib import Path

from backend.data_provider import SampleDataProvider
from backend.database import Database
from backend.models import Direction, TradeCreate
from backend.paper_trading import close_trade, list_trades, open_trade, trade_statistics


class PaperTradingTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Database(Path(self.temp_dir.name) / "test.sqlite3")
        self.provider = SampleDataProvider()
        self.buy_signal = next(
            row for row in self.provider.instruments()
            if row["symbol"] == "EUR/USD"
        )
        from backend.scanner import scan_market

        self.direction = Direction(
            next(
                row["signal"] for row in scan_market(self.provider)
                if row["symbol"] == self.buy_signal["symbol"]
            )
        )
        self.pair = self.buy_signal["symbol"]

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_trade(self, direction=None, pair=None):
        chosen_direction = direction or self.direction
        if chosen_direction == Direction.BUY:
            entry, stop, target = 1.08, 1.07, 1.10
        else:
            entry, stop, target = 1.08, 1.09, 1.06
        return TradeCreate(
            pair=pair or self.pair,
            direction=chosen_direction,
            entry=entry,
            stop_loss=stop,
            take_profit=target,
            position_units=500,
            simulated_equity=10000,
        )

    def test_trade_saves_and_closes_with_simulated_profit(self):
        trade = open_trade(self.database, self.provider, self.make_trade())
        closed = close_trade(self.database, trade.id, trade.entry + 0.01)
        self.assertEqual(closed.status, "CLOSED")
        expected_sign = 1 if trade.direction == Direction.BUY else -1
        self.assertAlmostEqual(closed.simulated_pnl, 5 * expected_sign)
        self.assertEqual(len(list_trades(self.database)), 1)
        self.assertEqual(trade_statistics(self.database)["closed_trades"], 1)

    def test_duplicate_open_trade_is_rejected(self):
        request = self.make_trade()
        open_trade(self.database, self.provider, request)
        with self.assertRaisesRegex(ValueError, "already exists"):
            open_trade(self.database, self.provider, request)

    def test_non_usd_quote_pair_is_rejected_without_conversion_data(self):
        row = next(item for item in self.provider.instruments() if item["symbol"] == "USD/JPY")
        request = self.make_trade(
            direction=Direction.BUY if row["symbol"] == "USD/JPY" else self.direction,
            pair="USD/JPY",
        )
        with self.assertRaisesRegex(ValueError, "conversion"):
            open_trade(self.database, self.provider, request)

    def test_daily_equity_cannot_be_changed_to_bypass_limits(self):
        request = self.make_trade()
        open_trade(self.database, self.provider, request)
        changed_equity = request.model_copy(update={"simulated_equity": 20000})
        with self.assertRaisesRegex(ValueError, "fixed at"):
            open_trade(self.database, self.provider, changed_equity)

    def test_daily_loss_limit_counts_open_trade_stop_risk(self):
        request = self.make_trade().model_copy(update={"position_units": 5000})
        for _ in range(4):
            trade = open_trade(self.database, self.provider, request)
            close_trade(self.database, trade.id, trade.stop_loss)
        with self.assertRaisesRegex(ValueError, "2% simulated daily-loss limit"):
            open_trade(self.database, self.provider, request)

    def test_maximum_open_trade_count_is_enforced(self):
        requests = [
            self.make_trade(Direction.BUY, "EUR/USD"),
            self.make_trade(Direction.SELL, "GBP/USD"),
            self.make_trade(Direction.BUY, "AUD/USD"),
        ]
        for request in requests:
            open_trade(self.database, self.provider, request)
        with self.assertRaisesRegex(ValueError, "At most 3"):
            open_trade(self.database, self.provider, requests[0])


if __name__ == "__main__":
    unittest.main()
