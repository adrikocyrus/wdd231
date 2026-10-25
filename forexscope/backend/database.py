import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class Database:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS watchlist (
                    pair TEXT PRIMARY KEY
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pair TEXT NOT NULL,
                    direction TEXT NOT NULL CHECK(direction IN ('BUY', 'SELL')),
                    entry REAL NOT NULL,
                    stop_loss REAL NOT NULL,
                    take_profit REAL NOT NULL,
                    position_units REAL NOT NULL,
                    simulated_equity REAL NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
                    entry_time TEXT NOT NULL,
                    exit_time TEXT,
                    exit_price REAL,
                    simulated_pnl REAL,
                    pnl_currency TEXT
                );
                INSERT OR IGNORE INTO settings (key, value)
                VALUES ('paper_trading_mode', 'simulated only');
                """
            )
