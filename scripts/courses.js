// ========================================
// Course data (replace with your instructor's array; set completed: true for finished courses)
// ========================================
const courses = [
  {
    subject: 'CSE',
    number: 110,
    title: 'Introduction to Programming',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Introduces programming fundamentals: variables, conditionals, loops, and functions, using a beginner-friendly language.',
    technology: ['Python'],
    completed: true
  },
  {
    subject: 'WDD',
    number: 130,
    title: 'Web Fundamentals',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Teaches the basics of building web pages with semantic HTML and CSS, including responsive layout and accessibility.',
    technology: ['HTML', 'CSS'],
    completed: true
  },
  {
    subject: 'CSE',
    number: 111,
    title: 'Programming with Functions',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Builds on programming basics with functions, testing, data structures, and working with files.',
    technology: ['Python'],
    completed: true
  },
  {
    subject: 'WDD',
    number: 131,
    title: 'Dynamic Web Fundamentals',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Adds JavaScript to web pages so they respond to users, manipulate the DOM, and store data in the browser.',
    technology: ['HTML', 'CSS', 'JavaScript'],
    completed: true
  },
  {
    subject: 'CSE',
    number: 210,
    title: 'Programming with Classes',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Introduces object-oriented programming: classes, objects, inheritance, and polymorphism.',
    technology: ['C#'],
    completed: false
  },
  {
    subject: 'WDD',
    number: 231,
    title: 'Web Frontend Development I',
    credits: 2,
    certificate: 'Web and Computer Programming',
    description: 'Focuses on modern front-end practices: fetching JSON data, modules, modal dialogs, forms, and performance.',
    technology: ['HTML', 'CSS', 'JavaScript', 'JSON'],
    completed: false
  }
];

// ========================================
// Element references
// ========================================
const courseList = document.querySelector('#course-list');
const courseDetails = document.querySelector('#course-details');
const totalCredits = document.querySelector('#totalCredits');
const filterButtons = document.querySelectorAll('.filter-btn');

// ========================================
// Display the course list
// ========================================
function displayCourses(list) {
  courseList.innerHTML = '';

  list.forEach((course) => {
    const courseDiv = document.createElement('button');
    courseDiv.type = 'button';
    courseDiv.classList.add('course');

    if (course.completed) {
      courseDiv.classList.add('completed');
    }

    courseDiv.innerHTML = `
      <span>${course.subject} ${course.number}</span>
      <span class="status">${course.completed ? '✓ Completed' : 'In progress'}</span>
    `;

    // Open the modal with this course's details
    courseDiv.addEventListener('click', () => {
      displayCourseDetails(course);
    });

    courseList.appendChild(courseDiv);
  });

  // Total credits for the courses currently shown
  const total = list.reduce((sum, course) => sum + course.credits, 0);
  totalCredits.textContent = total;
}

// ========================================
// Modal: display course details
// ========================================
function displayCourseDetails(course) {
  courseDetails.innerHTML = `
    <button id="closeModal" type="button" aria-label="Close course details">❌</button>
    <h2 id="course-title">${course.subject} ${course.number}</h2>
    <h3>${course.title}</h3>
    <p><strong>Credits</strong>: ${course.credits}</p>
    <p><strong>Certificate</strong>: ${course.certificate}</p>
    <p>${course.description}</p>
    <p><strong>Technologies</strong>: ${course.technology.join(', ')}</p>
  `;

  courseDetails.showModal();

  document.querySelector('#closeModal').addEventListener('click', () => {
    courseDetails.close();
  });
}

// Close the modal when the user clicks outside the modal box
courseDetails.addEventListener('click', (event) => {
  const box = courseDetails.getBoundingClientRect();
  const clickedOutside =
    event.clientX < box.left || event.clientX > box.right ||
    event.clientY < box.top || event.clientY > box.bottom;

  if (clickedOutside) {
    courseDetails.close();
  }
});

// ========================================
// Filter buttons
// ========================================
filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');

    const filtered = filter === 'all'
      ? courses
      : courses.filter((course) => course.subject === filter);

    displayCourses(filtered);
  });
});

// ========================================
// Initialize
// ========================================
displayCourses(courses);