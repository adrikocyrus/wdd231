import { setupNavigation, setCurrentYear } from "./site.js";
import { getFavourites, isFavourite, toggleFavourite } from "./storage.js";
import { setupDetailsModal } from "./modal.js";

setupNavigation();
setCurrentYear();

const grid = document.querySelector("#maintenance-grid");
const searchInput = document.querySelector("#search-items");
const categoryFilter = document.querySelector("#category-filter");
const savedFilter = document.querySelector("#saved-filter");
const status = document.querySelector("#results-status");
const errorBox = document.querySelector("#load-error");
const retryButton = document.querySelector("#retry-load");

let maintenanceItems = [];
let detailsModal = { open: () => {} };

function createCard(item) {
  const saved = isFavourite(item.id);
  const card = document.createElement("article");
  card.className = "maintenance-card";
  card.innerHTML = `
    <img class="card-image" src="./images/${item.id}.webp" alt="${item.name}" loading="lazy">
    <div class="card-topline">
      <span class="category-pill">${item.category}</span>
      <button class="favourite-button" type="button" data-favourite="${item.id}" aria-pressed="${saved}" aria-label="${saved ? "Remove" : "Save"} ${item.name} ${saved ? "from" : "to"} favourites">${saved ? "★" : "☆"}</button>
    </div>
    <h2>${item.name}</h2>
    <p>${item.description}</p>
    <div class="card-meta">
      <div><strong>Suggested interval:</strong> <span>${item.interval}</span></div>
      <div><strong>Difficulty:</strong> <span>${item.difficulty}</span></div>
    </div>
    <button class="button button-outline details-button" type="button" data-details="${item.id}">View details</button>`;
  return card;
}

function renderItems() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const onlySaved = savedFilter.value === "saved";
  const savedIds = getFavourites();

  const filtered = maintenanceItems.filter((item) => {
    const matchesSearch = `${item.name} ${item.category} ${item.description} ${item.interval}`.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSaved = !onlySaved || savedIds.includes(item.id);
    return matchesSearch && matchesCategory && matchesSaved;
  });

  grid.replaceChildren(...filtered.map((item) => createCard(item)));
  grid.setAttribute("aria-busy", "false");
  status.textContent = `${filtered.length} of ${maintenanceItems.length} maintenance items shown. ${savedIds.length} saved favourite${savedIds.length === 1 ? "" : "s"}.`;

  grid.querySelectorAll("[data-details]").forEach((button) => {
    button.addEventListener("click", () => detailsModal.open(button.dataset.details));
  });
  grid.querySelectorAll("[data-favourite]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.dataset.favourite;
      toggleFavourite(itemId);
      renderItems();
    });
  });
}

async function loadMaintenanceItems() {
  grid.setAttribute("aria-busy", "true");
  status.textContent = "Loading maintenance information…";
  errorBox.hidden = true;

  try {
    const response = await fetch("./data/maintenance.json");
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length < 15) {
      throw new Error("The maintenance data must contain at least 15 items.");
    }

    maintenanceItems = data;
    const categories = [...new Set(maintenanceItems.map((item) => item.category))].sort();
    categoryFilter.replaceChildren(new Option("All categories", "all"));
    categories.forEach((category) => categoryFilter.add(new Option(category, category)));

    detailsModal = setupDetailsModal(maintenanceItems, renderItems);
    renderItems();
  } catch (error) {
    console.error("Unable to load maintenance data:", error);
    grid.setAttribute("aria-busy", "false");
    status.textContent = "Maintenance information could not be loaded.";
    errorBox.hidden = false;
  }
}

searchInput.addEventListener("input", renderItems);
categoryFilter.addEventListener("change", renderItems);
savedFilter.addEventListener("change", renderItems);
retryButton.addEventListener("click", loadMaintenanceItems);

loadMaintenanceItems();