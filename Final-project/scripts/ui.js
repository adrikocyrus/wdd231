import { isFavorite, toggleFavorite } from "./storage.js";

export function cardTemplate(topic) {
  const saved = isFavorite(topic.id);
  return `
    <article class="topic-card" data-id="${topic.id}">
    <img src="images/${topic.system}.webp" alt="${topic.title}" width="600" height="400" loading="lazy">
      <h3>${topic.title}</h3>
      <p class="meta"><span class="tag">${topic.systemLabel}</span> <span class="tag level-${topic.level.toLowerCase()}">${topic.level}</span></p>
      <p>${topic.summary}</p>
      <div class="card-actions">
        <button type="button" class="btn" data-action="details">View details</button>
        <button type="button" class="btn btn-outline" data-action="favorite" aria-pressed="${saved}">${saved ? "Saved" : "Save topic"}</button>
      </div>
    </article>`;
}

export function renderCards(container, topics, emptyMessage) {
  container.innerHTML = topics.length
    ? topics.map(cardTemplate).join("")
    : `<p class="empty">${emptyMessage}</p>`;
}

export function openModal(topic) {
  const dialog = document.querySelector("#topic-dialog");
  dialog.querySelector(".dialog-body").innerHTML = `
    <h2 id="dialog-title">${topic.title}</h2>
    <p class="meta"><span class="tag">${topic.systemLabel}</span> <span class="tag level-${topic.level.toLowerCase()}">${topic.level}</span></p>
    <p>${topic.details}</p>
    <p><strong>Beginner tip:</strong> ${topic.tip}</p>`;
  dialog.showModal();
}

export function setupModal() {
  const dialog = document.querySelector("#topic-dialog");
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function handleCardClick(event, topics, onFavoriteChange) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.closest(".topic-card").dataset.id);
  const topic = topics.find((t) => t.id === id);
  if (button.dataset.action === "details") {
    openModal(topic);
  } else {
    const nowSaved = toggleFavorite(id);
    button.setAttribute("aria-pressed", nowSaved);
    button.textContent = nowSaved ? "Saved" : "Save topic";
    if (onFavoriteChange) onFavoriteChange();
  }
}