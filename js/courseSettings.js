export const hasExam = false;
export const scormVersion = "2004";

export const modules = {
  1: { title: "Introducción" },
  2: { title: "Juegos" },
  3: { title: "Advanced Topics" },
};
export let pages = [
  { id: "cover", url: "slides/cover.html", sections: false },
  { id: "lesson1", url: "slides/module1.html", sections: true, moduleId: "1", audio: true },
  { id: "lesson2", title: "Sopa de Letras", url: "slides/lesson2.html", sections: false, moduleId: "2" },
  { id: "lesson3", title: "Crucigrama", url: "slides/lesson3.html", sections: false, moduleId: "2" },
  { id: "lesson4", url: "slides/module2.html", sections: true, moduleId: "3", audio: true },
];
