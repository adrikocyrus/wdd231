import { getTopics } from "./data.js";
import { renderCards, setupModal, handleCardClick } from "./ui.js";
import { getFilters, saveFilters } from "./storage.js";

const container = document.querySelector("#topic-list");
const systemSelect = document.querySelector("#system-filter");
const levelSelect = document.querySelector("#level-filter");
const searchInput = document.querySelector("#search");
const count = document.querySelector("#result-count");
const filtersForm = document.querySelector("#topic-filters");

filtersForm.addEventListener("submit", (event) => event.preventDefault());
setupModal();
const topics = await getTopics();

const systems = [...new Map(topics.map((t) => [t.system, t.systemLabel]))];
systemSelect.insertAdjacentHTML(
  "beforeend",
  systems.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")
);

const saved = getFilters();
systemSelect.value = saved.system;
levelSelect.value = saved.level;

function update() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = topics.filter(
    (t) =>
      (systemSelect.value === "all" || t.system === systemSelect.value) &&
      (levelSelect.value === "all" || t.level === levelSelect.value) &&
      (t.title + t.summary).toLowerCase().includes(term)
  );
  renderCards(container, filtered, "No topics match your search. Try a different filter.");
  count.textContent = `Showing ${filtered.length} of ${topics.length} topics`;
}

[systemSelect, levelSelect].forEach((el) =>
  el.addEventListener("change", () => {
    saveFilters({ system: systemSelect.value, level: levelSelect.value });
    update();
  })
);
searchInput.addEventListener("input", update);
container.addEventListener("click", (event) => handleCardClick(event, topics));
update();