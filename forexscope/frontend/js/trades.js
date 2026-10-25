import { api } from "./api.js";
import { formatNumber, formatPrice, formatDate } from "./dashboard.js";

const tradeRows = document.getElementById("trade-rows");
const message = document.getElementById("trade-message");

export function setupTrades() {
  document.getElementById("trade-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    for (const key of ["entry", "stop_loss", "take_profit", "position_units", "simulated_equity"]) {
      values[key] = Number(values[key]);
    }
    message.textContent = "Validating paper trade…";
    try {
      await api.createTrade(values);
      message.textContent = "Simulated trade opened. No real order was sent.";
      await refreshTrades();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  tradeRows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-close-trade]");
    if (!button) return;
    const rawPrice = window.prompt(
      "Enter a sample exit price to close this simulated trade. No live price will be fetched."
    );
    if (rawPrice === null) return;
    const exitPrice = Number(rawPrice);
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      message.textContent = "Enter a valid price greater than zero.";
      return;
    }
    try {
      await api.closeTrade(button.dataset.closeTrade, exitPrice);
      message.textContent = "Simulated trade closed.";
      await refreshTrades();
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

export async function refreshTrades() {
  const [trades, stats] = await Promise.all([api.trades(), api.statistics()]);
  renderStatistics(stats);
  renderTrades(trades);
}

function renderStatistics(stats) {
  document.getElementById("trade-statistics").innerHTML = `
    <div class="stat-box"><span>Closed trades</span><strong>${stats.closed_trades}</strong></div>
    <div class="stat-box"><span>Win rate</span><strong>${formatNumber(stats.win_rate_percent, 1)}%</strong></div>
    <div class="stat-box"><span>Net simulated P/L (USD)</span><strong class="${stats.net_simulated_pnl >= 0 ? "positive" : "negative"}">${formatNumber(stats.net_simulated_pnl, 2)}</strong></div>
    <div class="stat-box"><span>Maximum drawdown (USD)</span><strong>${formatNumber(stats.maximum_drawdown, 2)}</strong></div>`;
}

function renderTrades(trades) {
  if (!trades.length) {
    tradeRows.innerHTML = '<tr><td colspan="7" class="empty-cell">No simulated trades yet.</td></tr>';
    return;
  }
  tradeRows.innerHTML = trades.map((trade) => `
    <tr>
      <td><strong>${trade.pair}</strong><span class="pair-sub">${formatDate(trade.entry_time)}</span></td>
      <td>${trade.direction}</td>
      <td>${formatNumber(trade.position_units, 2)} units</td>
      <td>${formatPrice(trade.entry, trade.pair)} → ${formatPrice(trade.stop_loss, trade.pair)} / ${formatPrice(trade.take_profit, trade.pair)}</td>
      <td><span class="status-badge ${trade.status === "OPEN" ? "status-open" : "status-closed"}">${trade.status}</span></td>
      <td class="${trade.simulated_pnl == null ? "" : trade.simulated_pnl >= 0 ? "positive" : "negative"}">${trade.simulated_pnl == null ? "—" : `${formatNumber(trade.simulated_pnl, 2)} USD`}</td>
      <td>${trade.status === "OPEN" ? `<button class="quiet-button" type="button" data-close-trade="${trade.id}">Close</button>` : "—"}</td>
    </tr>`).join("");
}
