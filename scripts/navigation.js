const menuBtn = document.querySelector('#menuBtn');
const nav = document.querySelector('#primaryNav');

menuBtn.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', isOpen);
  menuBtn.textContent = isOpen ? '✕' : '☰';
});