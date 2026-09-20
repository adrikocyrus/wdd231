export function setTitle(course) {
  document.querySelector("#courseName").textContent = course.name;
}

export function renderSections(sections) {
  const container = document.querySelector("#sections");
  container.innerHTML = "";

  sections.forEach((section) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>Section ${section.sectionNum}</strong></p>
      <p>Room: ${section.roomNum}</p>
      <p>Enrolled: ${section.enrolled}</p>
      <p>Days: ${section.days}</p>
      <p>Instructor: ${section.instructor}</p>
      <hr>
    `;
    container.appendChild(div);
  });
}