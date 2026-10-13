import { isFavourite, toggleFavourite } from "./storage.js";

let currentItem = null;

export function setupDetailsModal(items, onFavouriteChange) {
  const dialog = document.querySelector("#details-dialog");
  const content = document.querySelector("#dialog-content");
  const title = document.querySelector("#dialog-title");
  const favouriteButton = document.querySelector("#dialog-favourite");
  const closeButton = document.querySelector("#close-dialog");
  const doneButton = document.querySelector("#dialog-done");

  if (!dialog || !content || !title || !favouriteButton) return { open: () => {} };

  function updateFavouriteButton() {
    if (!currentItem) return;
    const saved = isFavourite(currentItem.id);
    favouriteButton.textContent = saved ? "Remove from favourites" : "Save to favourites";
    favouriteButton.setAttribute("aria-pressed", String(saved));
  }

  function open(itemId) {
    currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) return;

    title.textContent = currentItem.name;
    content.innerHTML = `
      <p><span class="category-pill">${currentItem.category}</span></p>
      <p>${currentItem.description}</p>
      <div class="card-meta">
        <div><strong>Suggested interval:</strong> <span>${currentItem.interval}</span></div>
        <div><strong>Why it matters:</strong> <span>${currentItem.benefit}</span></div>
        <div><strong>Difficulty:</strong> <span>${currentItem.difficulty}</span></div>
        <div><strong>When to get help:</strong> <span>${currentItem.warning}</span></div>
      </div>`;
    updateFavouriteButton();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function close() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  favouriteButton.addEventListener("click", () => {
    if (!currentItem) return;
    toggleFavourite(currentItem.id);
    updateFavouriteButton();
    onFavouriteChange();
  });
  closeButton?.addEventListener("click", close);
  doneButton?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  return { open };
}
