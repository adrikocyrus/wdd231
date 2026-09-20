// ========================================
// Shared script for all Kampala Chamber pages
// Handles: mobile nav toggle + footer dates
// ========================================

// Mobile navigation toggle
const menuBtn = document.querySelector('#menuBtn');
const nav = document.querySelector('#primaryNav');

if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen);
    });
}

// Footer: current year
const yearEl = document.querySelector('#year');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

// Footer: last modified date
const modifiedEl = document.querySelector('#lastModified');
if (modifiedEl) {
    modifiedEl.textContent = document.lastModified;
}