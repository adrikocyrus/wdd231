const menuButton = document.querySelector("#menu-button");
const navigation = document.querySelector("#primary-nav");

if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
        const isOpen = navigation.classList.toggle("open");

        menuButton.setAttribute("aria-expanded", isOpen);

        if (isOpen) {
            menuButton.textContent = "✕";
            menuButton.setAttribute("aria-label", "Close navigation menu");
        } else {
            menuButton.textContent = "☰";
            menuButton.setAttribute("aria-label", "Open navigation menu");
        }
    });
}