// ========================================
// discover.js — render 8 place cards + visit message
// ========================================
import { places } from "../data/discover.mjs";

// ---------- DOM refs ----------
const grid = document.querySelector("#discover-grid");
const visitMessage = document.querySelector("#visit-message");

// ========================================
// Render the 8 cards
// ========================================
function renderCards() {
  if (!grid) return;

  grid.innerHTML = "";

  places.forEach((place) => {
    const card = document.createElement("section");
    card.classList.add("card");

    card.innerHTML = `
      <h2>${place.name}</h2>
      <figure>
        <img
          src="images/${place.image}"
          alt="${place.name}"
          width="300"
          height="200"
          loading="lazy"
        >
      </figure>
      <address>${place.address}</address>
      <p>${place.description}</p>
      <button type="button" class="learn-more">Learn More</button>
    `;

    grid.appendChild(card);
  });
}

// ========================================
// Visit tracking with localStorage
// ========================================
function showVisitMessage() {
  if (!visitMessage) return;

  const KEY = "kampalaChamberLastVisit";
  const now = Date.now();
  const lastVisit = localStorage.getItem(KEY);

  let message = "";

  if (!lastVisit) {
    message = "Welcome! Let us know if you have any questions.";
  } else {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSince = Math.floor((now - Number(lastVisit)) / msPerDay);

    if (daysSince < 1) {
      message = "Back so soon! Awesome!";
    } else if (daysSince === 1) {
      message = "You last visited 1 day ago.";
    } else {
      message = `You last visited ${daysSince} days ago.`;
    }
  }

  visitMessage.textContent = message;
  localStorage.setItem(KEY, now);
}

// ========================================
// Init
// ========================================
renderCards();
showVisitMessage();