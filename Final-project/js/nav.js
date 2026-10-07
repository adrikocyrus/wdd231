const toggle = document.querySelector(".menu-toggle");
const menu = document.querySelector("#main-menu");

toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

document.querySelector("#year").textContent = new Date().getFullYear();