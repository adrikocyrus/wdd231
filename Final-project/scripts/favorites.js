import { getTopics } from "./data.js";
import { renderCards, setupModal, handleCardClick } from "./ui.js";
import { getFavorites } from "./storage.js";

const container = document.querySelector("#favorite-list");
setupModal();
const topics = await getTopics();

function update() {
  const ids = getFavorites();
  const saved = topics.filter((t) => ids.includes(t.id));
  renderCards(container, saved, "You have not saved any topics yet. Visit the Topics page and select Save topic.");
}

container.addEventListener("click", (event) => handleCardClick(event, topics, update));
update();