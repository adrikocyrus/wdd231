# ForexScope

ForexScope is a beginner-friendly educational forex scanner and paper-trading dashboard. Its first milestone uses generated sample candles; it does **not** display live forex prices, execute real orders, or provide investment advice.

## What is included

- FastAPI backend with automatic interactive API docs at `/docs`.
- Vanilla HTML, CSS, and JavaScript frontend.
- Generated sample candles for six provider-supported example pairs. Only the 1-hour timeframe is offered.
- Backend EMA 20, EMA 50, RSI 14, and example BUY / SELL / NO SIGNAL rules.
- Responsive scanner with search, category filters, favorites, and sorting.
- Candlestick chart using TradingView Lightweight Charts.
- Risk budget and reward-to-risk calculator. Position sizing is explicitly unavailable until verified instrument, pip, and currency-conversion data is configured.
- SQLite watchlist and simulated trade history.
- Paper-only trade validation and statistics. No order-execution integration exists.
- Automated tests using Python's built-in `unittest` runner.

## Start on Windows PowerShell

Open PowerShell in the `forexscope` folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
python -m uvicorn backend.main:app --reload
```

If PowerShell prevents virtual-environment activation, allow it for just the current terminal with:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser. You should see the ForexScope dashboard with a yellow **SAMPLE DATA** label, scanner, chart, risk calculator, watchlist, and paper-trade history. The API reference is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

The chart library is loaded from its public CDN, so the chart needs an internet connection. The API and other dashboard features run locally.

## Run tests

From the `forexscope` folder, with the virtual environment active:

```powershell
python -m unittest discover -s tests -v
```

The tests cover EMA/RSI calculations, signal rules and stale data, risk limits, paper-trade P/L, database persistence, and API validation.

The development requirements also install Ruff for Python linting and formatting. In VS Code, use **Terminal → Run Task → ForexScope: Lint Python** to check the backend and tests.

## Safe demo use

1. Choose a pair and inspect its sample chart and rule explanation.
2. Use the risk calculator to see the risk budget and reward-to-risk distance.
3. A position size is **not** estimated: the sample data has no verified pip value, contract size, spread, or account-currency conversion.
4. Open a paper trade only when a matching fresh example signal exists. Supply a stop-loss, take-profit, and position size. The backend enforces the demo risk limits.
5. Close an open simulation by entering a sample exit price. Simulated P/L is shown in the USD quote currency and does not account for spread, commissions, financing, or slippage.

The example signal rules and safeguards are demonstrations, not proven strategy or a guarantee of safety or profit. The first paper trade each UTC day fixes the simulated starting equity for that day so later requests cannot raise the loss-limit basis. Sample prices and resulting trades are not current market data.

## Data-provider configuration

`DATA_MODE=sample` works without credentials. This milestone intentionally does not include a real-data adapter: switching to another mode returns an explicit “not configured” API error rather than silently substituting sample candles. `.env.example` contains a placeholder for a future provider credential only; no frontend code reads API keys.

Before adding a provider, review its current API documentation, access restrictions, market-data licensing, supported instruments, timeframes, candle-completion semantics, rate limits, pip/contract metadata, and account-currency conversion requirements. Add credentials only to the backend `.env` file and never commit it. Enable a real provider only after its adapter and tests explicitly handle unavailable or stale data; this app must remain paper-trading-only.

## Main files

```text
forexscope/
├── backend/       FastAPI, sample provider, indicators, scanner, risk, SQLite, paper trading
├── frontend/      Responsive UI and vanilla JavaScript modules
├── tests/         unittest suite
├── .env.example   Safe sample configuration
├── requirements.txt
└── README.md
```
