const byuiCourse = {
  name: "Web Frontend Development",
  sections: [
    { sectionNum: 1, roomNum: "STC 347", enrolled: 12, days: "TTh", instructor: "Brother Warner" },
    { sectionNum: 2, roomNum: "STC 350", enrolled: 20, days: "MWF", instructor: "Sister Jones" }
  ],

  changeEnrollment(sectionNum, add = true) {
    const section = this.sections.find(s => s.sectionNum === sectionNum);
    if (!section) return;

    if (add) {
      section.enrolled += 1;
    } else {
      if (section.enrolled > 0) section.enrolled -= 1;
    }
    // renderSections(this.sections);  <-- REMOVED (no longer available here)
  }
};

export default byuiCourse;