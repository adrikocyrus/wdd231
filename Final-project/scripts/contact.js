import { setupNavigation, setCurrentYear } from "./site.js";
import { getTipPreference, setTipPreference } from "./storage.js";

setupNavigation();
setCurrentYear();

const form = document.querySelector(".request-form");
const updatesCheckbox = document.querySelector("#updates");
if (updatesCheckbox) updatesCheckbox.checked = getTipPreference();

updatesCheckbox?.addEventListener("change", () => {
  setTipPreference(updatesCheckbox.checked);
});

form?.addEventListener("submit", () => {
  if (updatesCheckbox) setTipPreference(updatesCheckbox.checked);
});
