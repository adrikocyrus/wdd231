const FAV_KEY = "amlh-favorites";
const FILTER_KEY = "amlh-filters";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch {
    return [];
  }
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}

export function toggleFavorite(id) {
  const favs = getFavorites();
  const updated = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(updated));
  return updated.includes(id);
}

export function getFilters() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY)) || { system: "all", level: "all" };
  } catch {
    return { system: "all", level: "all" };
  }
}

export function saveFilters(filters) {
  localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
}