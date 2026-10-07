import { getTopics } from "./data.js";
import { renderCards, setupModal, handleCardClick } from "./ui.js";

const container = document.querySelector("#featured-topics");
setupModal();

const topics = await getTopics();
const featured = topics.filter((topic) => topic.level === "Beginner").slice(0, 3);
renderCards(container, featured, "Topics could not be loaded. Please try again later.");
container.addEventListener("click", (event) => handleCardClick(event, topics));