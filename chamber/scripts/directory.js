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

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    displayMembers(data.members);
  } catch (error) {
    console.error('Error loading members:', error);

    membersContainer.innerHTML = `
      <p class="error-message">
        Sorry, the member directory could not be loaded. Please try again later.
      </p>
    `;
  }
}

// Display member cards
function displayMembers(members) {
  membersContainer.innerHTML = '';

  members.forEach((member) => {
    const card = document.createElement('section');

    card.classList.add('member-card');

    card.innerHTML = `
      <img
        src="images/${member.image}"
        alt="${member.name} logo"
        loading="lazy"
        width="120"
        height="120"
      >

      <div class="member-info">
        <h2>${member.name}</h2>

        <p class="tagline">${member.tagline}</p>

        <p>${member.address}</p>

        <p>
          <a href="tel:${member.phone.replace(/\s/g, '')}">
            ${member.phone}
          </a>
        </p>

        <p>
          <a
            href="${member.website}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit Website
          </a>
        </p>

        <p class="level">${getLevelLabel(member.membershipLevel)}</p>
      </div>
    `;

    membersContainer.appendChild(card);
  });
}

// Translate membership level number into a readable label
function getLevelLabel(level) {
  if (level === 3) {
    return '★ Gold Member';
  }

  if (level === 2) {
    return '◆ Silver Member';
  }

  return '● Member';
}

// Grid view
gridBtn.addEventListener('click', () => {
  membersContainer.classList.add('grid');
  membersContainer.classList.remove('list');

  gridBtn.classList.add('active');
  listBtn.classList.remove('active');

  gridBtn.setAttribute('aria-pressed', 'true');
  listBtn.setAttribute('aria-pressed', 'false');
});

// List view
listBtn.addEventListener('click', () => {
  membersContainer.classList.add('list');
  membersContainer.classList.remove('grid');

  listBtn.classList.add('active');
  gridBtn.classList.remove('active');

  listBtn.setAttribute('aria-pressed', 'true');
  gridBtn.setAttribute('aria-pressed', 'false');
});

// Mobile navigation
menuBtn.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');

  menuBtn.setAttribute('aria-expanded', isOpen);
});

// Footer dates
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelector('#lastModified').textContent = document.lastModified;

// Initialize directory
getMembers();