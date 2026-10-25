import unittest

from backend.models import Direction, RiskRequest, TradeCreate
from backend.risk_manager import calculate_risk, calculate_trade_pnl, validate_trade_prices


class RiskManagerTests(unittest.TestCase):
    def test_risk_budget_and_reward_ratio(self):
        result = calculate_risk(
            RiskRequest(
                pair="EUR/USD",
                equity=10000,
                risk_percent=0.5,
                entry=1.08,
                stop_loss=1.07,
                take_profit=1.10,
            )
        )
        self.assertEqual(result.risk_amount, 50)
        self.assertEqual(result.reward_to_risk, 2)
        self.assertIsNone(result.estimated_position_units)

    def test_stop_loss_cannot_equal_entry(self):
        with self.assertRaises(ValueError):
            calculate_risk(
                RiskRequest(
                    pair="EUR/USD",
                    equity=10000,
                    risk_percent=0.5,
                    entry=1.08,
                    stop_loss=1.08,
                    take_profit=1.10,
                )
            )

    def test_valid_buy_requires_stop_and_minimum_reward_ratio(self):
        trade = TradeCreate(
            pair="EUR/USD",
            direction=Direction.BUY,
            entry=1.08,
            stop_loss=1.07,
            take_profit=1.10,
            position_units=5000,
            simulated_equity=100000,
        )
        self.assertEqual(validate_trade_prices(trade), 2)

    def test_invalid_buy_stop_placement_is_rejected(self):
        trade = TradeCreate(
            pair="EUR/USD",
            direction=Direction.BUY,
            entry=1.08,
            stop_loss=1.09,
            take_profit=1.10,
            position_units=100,
            simulated_equity=10000,
        )
        with self.assertRaisesRegex(ValueError, "BUY"):
            validate_trade_prices(trade)

    def test_trade_risk_limit_is_enforced(self):
        trade = TradeCreate(
            pair="EUR/USD",
            direction=Direction.BUY,
            entry=1.08,
            stop_loss=1.07,
            take_profit=1.10,
            position_units=10000,
            simulated_equity=10000,
        )
        with self.assertRaisesRegex(ValueError, "0.5%"):
            validate_trade_prices(trade)

    def test_paper_pnl_supports_both_directions(self):
        self.assertAlmostEqual(calculate_trade_pnl(Direction.BUY, 1.1, 1.2, 100), 10)
        self.assertAlmostEqual(calculate_trade_pnl(Direction.SELL, 1.1, 1.0, 100), 10)


if __name__ == "__main__":
    unittest.main()
