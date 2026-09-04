const courses = [
    {
        subject: "CSE",
        number: 110,
        title: "Introduction to Programming",
        credits: 2,
        completed: true
    },
    {
        subject: "WDD",
        number: 130,
        title: "Web Fundamentals",
        credits: 2,
        completed: true
    },
    {
        subject: "CSE",
        number: 111,
        title: "Programming with Functions",
        credits: 2,
        completed: true
    },
    {
        subject: "CSE",
        number: 210,
        title: "Programming with Classes",
        credits: 2,
        completed: false
    },
    {
        subject: "WDD",
        number: 131,
        title: "Dynamic Web Fundamentals",
        credits: 2,
        completed: true
    },
    {
        subject: "WDD",
        number: 231,
        title: "Web Frontend Development I",
        credits: 2,
        completed: false
    }
];


const courseList = document.querySelector("#course-list");
const totalCredits = document.querySelector("#total-credits");


// Display courses
function displayCourses(filter = "all") {

    courseList.innerHTML = "";

    let filteredCourses = courses;

    if (filter === "wdd") {
        filteredCourses = courses.filter(course => course.subject === "WDD");
    }

    if (filter === "cse") {
        filteredCourses = courses.filter(course => course.subject === "CSE");
    }


    filteredCourses.forEach(course => {

        const courseCard = document.createElement("div");

        courseCard.classList.add("course-card");

        if (course.completed) {
            courseCard.classList.add("completed");
        }

        courseCard.innerHTML = `
            <h3>
                ${course.subject} ${course.number}
            </h3>

            <p>${course.title}</p>

            <p class="course-code">
                ${course.credits} Credits
            </p>
        `;

        courseList.appendChild(courseCard);
    });


    const credits = filteredCourses.reduce(
        (total, course) => total + course.credits,
        0
    );

    totalCredits.textContent = credits;
}


// Buttons
document.querySelector("#all-courses").addEventListener(
    "click",
    () => displayCourses("all")
);

document.querySelector("#wdd-courses").addEventListener(
    "click",
    () => displayCourses("wdd")
);

document.querySelector("#cse-courses").addEventListener(
    "click",
    () => displayCourses("cse")
);


// Initial display
displayCourses("all");