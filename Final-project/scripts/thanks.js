const params = new URLSearchParams(window.location.search);
const labels = { name: "Name", email: "Email", system: "Topic area", level: "Experience level", message: "Request" };
const list = document.querySelector("#submitted-data");

Object.entries(labels).forEach(([key, label]) => {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = params.get(key) || "Not provided";
  list.append(term, detail);
});