import { setupNavigation, setCurrentYear } from "./site.js";

setupNavigation();
setCurrentYear();

const output = document.querySelector("#submission-content");
const params = new URLSearchParams(window.location.search);
const fields = [
  ["Name", "name"],
  ["Email", "email"],
  ["Phone", "phone"],
  ["Vehicle type", "vehicle"],
  ["Model year", "year"],
  ["Main topic", "topic"],
  ["Question", "question"]
];
const hasData = fields.some(([, key]) => params.has(key) && params.get(key).trim() !== "");

if (output && hasData) {
  const heading = document.createElement("h2");
  heading.textContent = "Submitted details";
  const list = document.createElement("div");
  list.className = "submission-list";

  fields.forEach(([label, key]) => {
    const value = params.get(key)?.trim();
    if (!value) return;
    const item = document.createElement("div");
    item.className = "submission-item";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const paragraph = document.createElement("p");
    paragraph.textContent = value;
    item.append(strong, paragraph);
    list.append(item);
  });

  const updates = document.createElement("p");
  updates.textContent = params.get("updates") === "yes"
    ? "Maintenance tips preference: saved on this device."
    : "Maintenance tips preference: not selected.";
  output.replaceChildren(heading, list, updates);
}
