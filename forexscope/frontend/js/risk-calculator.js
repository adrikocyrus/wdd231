import { api } from "./api.js";
import { formatNumber, formatPrice } from "./dashboard.js";

export function setupRiskCalculator() {
  document.getElementById("risk-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    for (const key of ["equity", "risk_percent", "entry", "stop_loss", "take_profit"]) {
      values[key] = Number(values[key]);
    }
    const resultElement = document.getElementById("risk-result");
    resultElement.textContent = "Calculating…";
    try {
      const result = await api.calculateRisk(values);
      resultElement.innerHTML = `
        <strong>Simulated risk budget:</strong> ${formatNumber(result.risk_amount, 2)} account-currency units<br>
        <strong>Stop distance:</strong> ${formatPrice(result.stop_distance, result.pair)}<br>
        <strong>Potential reward distance:</strong> ${formatPrice(result.potential_reward_distance, result.pair)}<br>
        <strong>Reward-to-risk:</strong> ${formatNumber(result.reward_to_risk, 2)}:1<br>
        <span class="result-warning">${result.position_size_note}</span>`;
    } catch (error) {
      resultElement.textContent = error.message;
    }
  });
}
