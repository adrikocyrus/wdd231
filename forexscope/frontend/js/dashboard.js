const byId = (id) => document.getElementById(id);

export function renderDashboard(market) {
  const rows = market.instruments;
  byId("pairs-count").textContent = rows.length;
  byId("buy-count").textContent = rows.filter((row) => row.signal === "BUY").length;
  byId("sell-count").textContent = rows.filter((row) => row.signal === "SELL").length;
  byId("neutral-count").textContent = rows.filter((row) => row.signal === "NO SIGNAL").length;
  byId("data-status").textContent = "Sample mode";
  const latest = rows
    .map((row) => row.last_candle_time)
    .filter(Boolean)
    .sort()
    .at(-1);
  byId("last-updated").textContent = latest ? formatDate(latest) : "Unavailable";
}

export function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatPrice(value, pair) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const digits = pair === "USD/JPY" ? 3 : pair === "USD/UGX" ? 1 : 5;
  return Number(value).toFixed(digits);
}

export function formatNumber(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(digits);
}
