const url = 'data/members.json';
const membersContainer = document.querySelector('#members');
const gridBtn = document.querySelector('#gridView');
const listBtn = document.querySelector('#listView');
const menuBtn = document.querySelector('#menuBtn');
const nav = document.querySelector('#primaryNav');

// Fetch member data
async function getMembers() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    displayMembers(data.members);
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

// Display members as cards
const displayMembers = (members) => {
  members.forEach((member) => {
    const card = document.createElement('section');
    card.classList.add('member-card');

    card.innerHTML = `
      <img src="images/${member.image}" alt="${member.name} logo" loading="lazy" width="120" height="120">
      <h2>${member.name}</h2>
      <p class="tagline">${member.tagline}</p>
      <p>${member.address}</p>
      <p>${member.phone}</p>
      <a href="${member.website}" target="_blank" rel="noopener">Visit Website</a>
      <p class="level">${getLevelLabel(member.membershipLevel)}</p>
    `;

    membersContainer.appendChild(card);
  });
};

// Translate membership number to label
function getLevelLabel(level) {
  if (level === 3) return '★ Gold Member';
  if (level === 2) return '◆ Silver Member';
  return '● Member';
}

// Toggle grid / list view
gridBtn.addEventListener('click', () => {
  membersContainer.classList.add('grid');
  membersContainer.classList.remove('list');
  gridBtn.classList.add('active');
  listBtn.classList.remove('active');
});

listBtn.addEventListener('click', () => {
  membersContainer.classList.add('list');
  membersContainer.classList.remove('grid');
  listBtn.classList.add('active');
  gridBtn.classList.remove('active');
});

// Mobile menu toggle
menuBtn.addEventListener('click', () => {
  nav.classList.toggle('open');
});

// Footer dates
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('#lastModified').textContent = document.lastModified;

// Initialize
getMembers();