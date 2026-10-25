import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import main
from backend.data_provider import SampleDataProvider
from backend.database import Database


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_database = main.database
        self.previous_provider = main.provider
        main.database = Database(Path(self.temp_dir.name) / "api.sqlite3")
        main.provider = SampleDataProvider()
        self.client = TestClient(main.app)

    def tearDown(self):
        main.database = self.previous_database
        main.provider = self.previous_provider
        self.temp_dir.cleanup()

    def test_market_and_candles_are_labeled_sample(self):
        response = self.client.get("/api/market")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data_mode"], "sample")
        self.assertIn("not live", response.json()["data_source"])
        candles = self.client.get("/api/candles/EUR-USD")
        self.assertEqual(candles.status_code, 200)
        self.assertEqual(candles.json()["data_source"], "Sample data")

    def test_unavailable_timeframe_returns_error_without_substitution(self):
        response = self.client.get("/api/candles/EUR-USD?timeframe=15m")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Only 1h", response.json()["detail"])

    def test_risk_endpoint_validates_input_and_discloses_missing_size_data(self):
        response = self.client.post(
            "/api/risk/calculate",
            json={
                "pair": "EUR/USD",
                "equity": 10000,
                "risk_percent": 0.5,
                "entry": 1.08,
                "stop_loss": 1.07,
                "take_profit": 1.10,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["estimated_position_units"])
        self.assertIn("unavailable", response.json()["position_size_note"])

    def test_invalid_risk_request_returns_validation_error(self):
        response = self.client.post(
            "/api/risk/calculate",
            json={"pair": "EUR/USD", "equity": -5, "risk_percent": 0.5,
                  "entry": 1.08, "stop_loss": 1.07, "take_profit": 1.10},
        )
        self.assertEqual(response.status_code, 422)

    def test_unconfigured_real_provider_is_not_silently_replaced(self):
        with patch.object(main, "provider", None):
            response = self.client.get("/api/market")
        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.json()["detail"])

    def test_paper_trade_lifecycle_persists_and_reports_simulated_result(self):
        created = self.client.post(
            "/api/trades",
            json={
                "pair": "EUR/USD",
                "direction": "BUY",
                "entry": 1.08,
                "stop_loss": 1.07,
                "take_profit": 1.10,
                "position_units": 500,
                "simulated_equity": 10000,
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        trade_id = created.json()["id"]
        closed = self.client.post(
            f"/api/trades/{trade_id}/close", json={"exit_price": 1.09}
        )
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json()["status"], "CLOSED")
        self.assertAlmostEqual(closed.json()["simulated_pnl"], 5)
        stats = self.client.get("/api/trades/statistics")
        self.assertEqual(stats.json()["closed_trades"], 1)

    def test_trade_without_current_matching_signal_is_rejected(self):
        response = self.client.post(
            "/api/trades",
            json={
                "pair": "EUR/USD",
                "direction": "SELL",
                "entry": 1.08,
                "stop_loss": 1.09,
                "take_profit": 1.06,
                "position_units": 500,
                "simulated_equity": 10000,
            },
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("matching sample signal", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
