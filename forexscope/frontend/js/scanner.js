import { formatNumber, formatPrice } from "./dashboard.js";

const rowsElement = document.getElementById("scanner-rows");
const searchElement = document.getElementById("pair-search");
const filterElement = document.getElementById("pair-filter");
let marketRows = [];
let favorites = new Set();
let selectedPair = null;
let sortKey = "symbol";
let sortDirection = 1;
let selectionHandler = () => {};
let favoriteHandler = () => {};

export function setupScanner(onSelect, onFavorite) {
  selectionHandler = onSelect;
  favoriteHandler = onFavorite;
  searchElement.addEventListener("input", render);
  filterElement.addEventListener("change", render);
  document.querySelectorAll("th[data-sort]").forEach((heading) => {
    heading.addEventListener("click", () => {
      const nextKey = heading.dataset.sort;
      sortDirection = sortKey === nextKey ? -sortDirection : 1;
      sortKey = nextKey;
      render();
    });
  });
  rowsElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-favorite]");
    if (button) {
      event.stopPropagation();
      favoriteHandler(button.dataset.favorite);
      return;
    }
    const row = event.target.closest("tr[data-pair]");
    if (row) selectionHandler(row.dataset.pair);
  });
}

export function updateScanner(rows, favoritePairs, activePair) {
  marketRows = rows;
  favorites = new Set(favoritePairs);
  selectedPair = activePair;
  render();
}

function render() {
  const query = searchElement.value.trim().toUpperCase();
  const filter = filterElement.value;
  const visible = marketRows
    .filter((row) => row.symbol.includes(query))
    .filter((row) => filter === "all"
      || (filter === "favorites" ? favorites.has(row.symbol) : row.category === filter))
    .sort((a, b) => {
      const first = a[sortKey];
      const second = b[sortKey];
      if (typeof first === "number" && typeof second === "number") {
        return (first - second) * sortDirection;
      }
      return String(first ?? "").localeCompare(String(second ?? "")) * sortDirection;
    });

  if (!visible.length) {
    rowsElement.innerHTML = '<tr><td colspan="8" class="empty-cell">No matching pairs found.</td></tr>';
    return;
  }

  rowsElement.innerHTML = visible.map((row) => {
    const favorite = favorites.has(row.symbol);
    const signalClass = row.signal === "BUY" ? "signal-buy"
      : row.signal === "SELL" ? "signal-sell" : "signal-neutral";
    const changeClass = Number(row.change_percent) >= 0 ? "positive" : "negative";
    return `
      <tr data-pair="${row.symbol}" class="${row.symbol === selectedPair ? "selected" : ""}">
        <td><button class="favorite-button ${favorite ? "is-favorite" : ""}"
          type="button" data-favorite="${row.symbol}" aria-label="${favorite ? "Remove" : "Add"} ${row.symbol} ${favorite ? "from" : "to"} watchlist">${favorite ? "★" : "☆"}</button></td>
        <td><span class="pair-name">${row.symbol}</span><span class="pair-sub">${row.category}</span></td>
        <td>${formatPrice(row.price, row.symbol)}</td>
        <td class="${changeClass}">${row.change_percent == null ? "—" : `${formatNumber(row.change_percent, 3)}%`}</td>
        <td>${formatPrice(row.ema20, row.symbol)}</td>
        <td>${formatPrice(row.ema50, row.symbol)}</td>
        <td>${formatNumber(row.rsi14, 1)}</td>
        <td><span class="signal-badge ${signalClass}">${row.signal}</span></td>
      </tr>`;
  }).join("");
}
