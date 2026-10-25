import unittest

from backend.indicators import ema, rsi


class IndicatorTests(unittest.TestCase):
    def test_ema_uses_first_period_simple_average_as_seed(self):
        self.assertEqual(ema([1, 2, 3, 4, 5], 3), [None, None, 2.0, 3.0, 4.0])

    def test_ema_handles_insufficient_history(self):
        self.assertEqual(ema([1, 2], 3), [None, None])

    def test_ema_rejects_invalid_period(self):
        with self.assertRaises(ValueError):
            ema([1, 2], 0)

    def test_rsi_handles_insufficient_history(self):
        self.assertEqual(rsi([1, 2, 3], 3), [None, None, None])

    def test_rsi_returns_100_for_continuous_gains(self):
        self.assertEqual(rsi([1, 2, 3, 4], 3)[-1], 100)

    def test_rsi_is_neutral_for_unchanged_prices(self):
        self.assertEqual(rsi([5, 5, 5, 5], 3)[-1], 50)


if __name__ == "__main__":
    unittest.main()
