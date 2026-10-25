import { api } from "./api.js";
import { renderDashboard, formatPrice, formatNumber, formatDate } from "./dashboard.js";
import { renderChart } from "./charts.js";
import { setupScanner, updateScanner } from "./scanner.js";
import { setupRiskCalculator } from "./risk-calculator.js";
import { refreshTrades, setupTrades } from "./trades.js";

let market;
let favoritePairs = [];
let selectedPair = "EUR/USD";

async function selectPair(pair) {
  selectedPair = pair;
  updateScanner(market.instruments, favoritePairs, selectedPair);
  const item = market.instruments.find((row) => row.symbol === pair);
  if (!item) return;
  renderSignal(item);
  try {
    const candleResponse = await api.candles(pair);
    renderChart(pair, candleResponse.candles);
  } catch (error) {
    document.getElementById("chart-status").textContent = error.message;
  }
}

function renderSignal(item) {
  const signalClass = item.signal === "BUY" ? "positive"
    : item.signal === "SELL" ? "negative" : "";
  document.getElementById("signal-detail").innerHTML = `
    <span class="signal-badge ${item.signal === "BUY" ? "signal-buy" : item.signal === "SELL" ? "signal-sell" : "signal-neutral"}">SAMPLE RULE RESULT</span>
    <p class="signal-large ${signalClass}">${item.signal}</p>
    <p class="signal-explanation">${item.signal_reason}</p>
    <div class="indicator-list">
      <div class="indicator-row"><span>EMA 20</span><strong>${formatPrice(item.ema20, item.symbol)}</strong></div>
      <div class="indicator-row"><span>EMA 50</span><strong>${formatPrice(item.ema50, item.symbol)}</strong></div>
      <div class="indicator-row"><span>RSI 14</span><strong>${formatNumber(item.rsi14, 2)}</strong></div>
      <div class="indicator-row"><span>Completed candle</span><strong>${item.last_candle_time ? formatDate(item.last_candle_time) : "Unavailable"}</strong></div>
      <div class="indicator-row"><span>Data freshness</span><strong>${item.stale ? "Stale" : "Sample · completed"}</strong></div>
    </div>
    <p class="muted small-copy">Source: generated sample data · candles: 1 hour · paper simulations only.</p>`;
}

function renderWatchlist() {
  const list = document.getElementById("watchlist-items");
  if (!favoritePairs.length) {
    list.innerHTML = '<li class="muted">No saved pairs yet. Star a row in the scanner.</li>';
    return;
  }
  list.innerHTML = favoritePairs.map((pair) => `
    <li><button type="button" data-select-pair="${pair}">${pair}</button>
      <button type="button" data-remove-pair="${pair}" aria-label="Remove ${pair} from watchlist">Remove</button></li>`).join("");
}

function populatePairOptions(instruments) {
  const options = instruments.map((row) => `<option value="${row.symbol}">${row.symbol}</option>`).join("");
  document.querySelectorAll(".pair-options").forEach((select) => {
    select.innerHTML = options;
  });
}

async function toggleFavorite(pair) {
  if (favoritePairs.includes(pair)) {
    await api.removeFavorite(pair);
    favoritePairs = favoritePairs.filter((item) => item !== pair);
  } else {
    await api.addFavorite(pair);
    favoritePairs = [...favoritePairs, pair].sort();
  }
  updateScanner(market.instruments, favoritePairs, selectedPair);
  renderWatchlist();
}

async function refreshMarket() {
  try {
    market = await api.market();
    renderDashboard(market);
    populatePairOptions(market.instruments);
    const saved = await api.watchlist();
    favoritePairs = saved.pairs;
    updateScanner(market.instruments, favoritePairs, selectedPair);
    renderWatchlist();
    await selectPair(selectedPair);
    await refreshTrades();
  } catch (error) {
    document.getElementById("data-status").textContent = "Data unavailable";
    document.getElementById("scanner-rows").innerHTML =
      `<tr><td colspan="8" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
  }
}

function showError(error) {
  document.getElementById("trade-message").textContent = error.message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

document.getElementById("refresh-button").addEventListener("click", refreshMarket);
document.getElementById("watchlist-items").addEventListener("click", async (event) => {
  const selectButton = event.target.closest("[data-select-pair]");
  const removeButton = event.target.closest("[data-remove-pair]");
  if (selectButton) await selectPair(selectButton.dataset.selectPair);
  if (removeButton) await toggleFavorite(removeButton.dataset.removePair);
});
document.getElementById("trade-form").elements.pair.addEventListener("change", (event) => {
  document.getElementById("risk-form").elements.pair.value = event.target.value;
});

setupRiskCalculator();
setupTrades();
setupScanner(selectPair, (pair) => toggleFavorite(pair).catch(showError));
refreshMarket();
