async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.detail === "string"
      ? payload.detail
      : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

export const api = {
  health: () => request("/api/health"),
  market: () => request("/api/market"),
  candles: (pair, timeframe = "1h") =>
    request(`/api/candles/${encodeURIComponent(pair.replace("/", "-"))}?timeframe=${timeframe}`),
  watchlist: () => request("/api/watchlist"),
  addFavorite: (pair) =>
    request("/api/watchlist", { method: "POST", body: JSON.stringify({ pair }) }),
  removeFavorite: (pair) =>
    request(`/api/watchlist/${encodeURIComponent(pair.replace("/", "-"))}`, { method: "DELETE" }),
  calculateRisk: (values) =>
    request("/api/risk/calculate", { method: "POST", body: JSON.stringify(values) }),
  trades: () => request("/api/trades"),
  statistics: () => request("/api/trades/statistics"),
  createTrade: (values) =>
    request("/api/trades", { method: "POST", body: JSON.stringify(values) }),
  closeTrade: (id, exitPrice) =>
    request(`/api/trades/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ exit_price: exitPrice }),
    }),
};
