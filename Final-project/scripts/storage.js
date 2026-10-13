const FAVOURITES_KEY = "vehicleCareFavourites";
const TIPS_KEY = "vehicleCareTipPreference";

export function getFavourites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error("Could not read favourites from local storage:", error);
    return [];
  }
}

export function isFavourite(id) {
  return getFavourites().includes(id);
}

export function toggleFavourite(id) {
  const favourites = getFavourites();
  const updated = favourites.includes(id)
    ? favourites.filter((itemId) => itemId !== id)
    : [...favourites, id];

  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Could not save favourites:", error);
  }
  return updated;
}

export function getTipPreference() {
  return localStorage.getItem(TIPS_KEY) === "yes";
}

export function setTipPreference(shouldRemember) {
  try {
    if (shouldRemember) localStorage.setItem(TIPS_KEY, "yes");
    else localStorage.removeItem(TIPS_KEY);
  } catch (error) {
    console.error("Could not save preference:", error);
  }
}
