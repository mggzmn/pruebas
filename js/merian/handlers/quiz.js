

/* Funciones auxiliares para SCORM */
function getScormValue(key) {
  const scormKey = scormVersion === "2004" ? `cmi.${key}` : `cmi.core.${key}`;
  return ScormAPI.getValue(scormKey);
}

function setScormValue(key, value) {
  const scormKey = scormVersion === "2004" ? `cmi.${key}` : `cmi.core.${key}`;
  return ScormAPI.setValue(scormKey, value);
}

function commitScorm() {
  if (!ScormAPI.commit()) {
    console.error("Failed to commit data to LMS:", ScormAPI.getLastError());
  }
}

function getRawScore() {
  if (!ScormAPI.init()) return null;
  try {
    const rawScore = getScormValue("score.raw");
    return rawScore !== "" ? rawScore : null;
  } catch (e) {
    console.error("Error getting raw score:", e);
    return null;
  }
}

/* Función para mostrar la introducción */
function showIntro() {
  const introText = document.getElementById("intro-text");
  const introDescription = document.getElementById("intro-description");
  const startButton = document.getElementById("start-btn");
  const rawScore = getRawScore();

  if (rawScore) {
    introText.textContent = "Tus datos ya han sido registrados.";
    introDescription.textContent = `Ya has completado este quiz con una puntuación de ${rawScore}. No necesitas volver a tomarlo.`;
    startButton.style.display = "none";
  } else {
    introText.textContent = "Resuelve la siguiente evaluación para determinar si comprendiste todos los temas vistos.";
    introDescription.textContent = `El examen final consta de ${quizConfig.numQuestions} preguntas. La calificación mínima para aprobar el curso es de ${quizConfig.minScore}%.`;
    startButton.style.display = "block";
  }

  if (slides[slideIndex]?.isUnique) {
    allowScroll();
  }
}

/* Función para crear los elementos de opción */
function createOptionElements(options, isMultipleAnswers) {
  const optionsList = document.getElementById("options-list");
  optionsList.innerHTML = "";
  options.forEach((option) => {
    const optionElement = createOptionElement(option, isMultipleAnswers);
    optionsList.appendChild(optionElement);
  });
}

function createOptionElement(option, isMultipleAnswers) {
  const optionElement = document.createElement("li");

  const input = document.createElement("input");
  input.type = isMultipleAnswers ? "checkbox" : "radio";
  input.name = "option";
  input.value = option;

  const label = document.createElement("label");
  label.textContent = option;

  optionElement.appendChild(input);
  optionElement.appendChild(label);

  return optionElement;
}

/* Función para mostrar la pregunta actual */
function showCurrentQuestion() {
  const question = getQuestion();
  const questionTextElement = document.getElementById("question-text");
  const submitButton = document.getElementById("submit-btn");

  questionTextElement.textContent = question.text;
  const options = question.randomizeOptions ? shuffleArray([...question.options]) : [...question.options];
  createOptionElements(options, question.multipleAnswers);

  submitButton.onclick = () => {
    checkAnswer(question);
  };
}
/* Función para verificar la respuesta */
function checkAnswer(question) {
  const userAnswerElements = document.querySelectorAll('input[name="option"]:checked');

  if (userAnswerElements.length === 0) {
    createToast("alert", 5000, "Quiz", "Por favor selecciona una respuesta.");
    return;
  }

  const selectedOptions = Array.from(userAnswerElements).map(input => input.value);
  const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
  const isCorrect = question.multipleAnswers
    ? selectedOptions.length === correctAnswers.length && selectedOptions.every(option => correctAnswers.includes(option))
    : selectedOptions[0] === correctAnswers[0];

  if (isCorrect) {
    score++;
  }

  const feedbackContainer = document.getElementById("feedback-container");
  feedbackContainer.innerHTML = isCorrect
    ? `<p>¡Correcto! ${question.feedback}</p>`
    : `<p>Incorrecto. La respuesta correcta es "${correctAnswers.join(', ')}". ${question.feedback}</p>`;

  document.getElementById("submit-btn").style.display = "none";
  document.getElementById("next-btn").style.display = "block";
}

/* Función para mostrar la siguiente pregunta */
function showNextQuestion(numQuestions) {
  resetQuestionUI();

  if (currentQuestion < numQuestions - 1) {
    currentQuestion++;
    showCurrentQuestion();
  } else {
    showResults(quizConfig.minScore);
  }
}

function resetQuestionUI() {
  document.getElementById("feedback-container").innerHTML = "";
  document.getElementById("options-list").innerHTML = "";
  document.getElementById("question-text").textContent = "";
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("submit-btn").style.display = "block";
}

/* Función para mostrar los resultados */
function showResults(minScore) {
  toggleSectionsVisibility({ intro: false, question: false, results: true });

  const scorePercentage = (score / quizConfig.numQuestions) * 100;
  document.getElementById("score").textContent = scorePercentage.toFixed(2);

  const messageElement = document.getElementById("message");
  const finishButton = document.getElementById("finish-btn");
  const retryButton = document.getElementById("retry-btn");

  if (scorePercentage >= minScore) {
    messageElement.textContent = "¡Felicitaciones! Has aprobado el curso.";
    retryButton.style.display = "none";
    attemptsLeft--;
    if (ScormAPI.init()) {
      savedNewPropertySuspendData("attemptsLeft", attemptsLeft);
      completedQuiz(scorePercentage, quizConfig.minScore);
    }
    finishButton.style.display = "block";
  } else {
    messageElement.textContent = "Lo siento, no has aprobado el curso.";
    attemptsLeft--;
    if (ScormAPI.init()) {
      savedNewPropertySuspendData("attemptsLeft", attemptsLeft);
      savedNewPropertySuspendData("currentQuestionIndex", currentQuestionIndex);
    }
    if (attemptsLeft > 0) {
      retryButton.style.display = "block";
      finishButton.style.display = "none";
    } else {
      messageElement.textContent += " La evaluación ha concluido. Te recomendamos contactar a tu administrador para tomar el curso nuevamente.";
      if (ScormAPI.init()) {
        completedQuiz(scorePercentage, quizConfig.minScore);
      }
      finishButton.style.display = "block";
      retryButton.style.display = "none";
    }
  }

  document.getElementById("attempts-left").textContent = attemptsLeft;
}

function toggleSectionsVisibility({ intro, question, results }) {
  document.querySelector(".intro-section").style.display = intro ? "flex" : "none";
  document.querySelector(".question-section").style.display = question ? "block" : "none";
  document.querySelector(".results-section").style.display = results ? "block" : "none";
}

/* Función para reintentar el quiz */
function retryQuiz() {
  if (attemptsLeft <= 0) {
    displayNoAttemptsLeftMessage();
    return;
  }

  currentQuestion = 0;
  score = 0;
  usedQuestions = [];
  currentQuestionIndex = calculateStartIndex();

  showIntro();
  document.getElementById("attempts-left").textContent = attemptsLeft;
  toggleSectionsVisibility({ intro: true, question: false, results: false });

  if (slides[slideIndex]?.isUnique) {
    preventScroll();
  }
}

function displayNoAttemptsLeftMessage() {
  toggleSectionsVisibility({ intro: false, question: false, results: true });
  document.getElementById("message").textContent += " La evaluación ha concluido. Tus resultados ya han sido registrados.";
  createToast("alert", 5000, "Quiz", "Lo sentimos, ya no hay más intentos disponibles.");
}

/* Función para mostrar la pregunta */
function showQuestion() {
  if (attemptsLeft <= 0) {
    createToast("alert", 5000, "Quiz", "Lo sentimos, ya no hay más intentos disponibles.");
    return;
  }

  loadCurrentQuestionIndex();
  score = 0;
  document.getElementById("attempts-left").textContent = attemptsLeft;
  toggleSectionsVisibility({ intro: false, question: true, results: false });
  showCurrentQuestion();

  if (slides[slideIndex]?.isUnique) {
    preventScroll();
  }
}

function loadCurrentQuestionIndex() {
  const suspendData = getScormValue("suspend_data");
  if (suspendData) {
    try {
      const data = JSON.parse(suspendData);
      currentQuestionIndex = !isNaN(data.currentQuestionIndex) && data.currentQuestionIndex >= 0
        ? data.currentQuestionIndex
        : calculateStartIndex();
    } catch (e) {
      console.error("Failed to parse suspend_data:", e);
      currentQuestionIndex = calculateStartIndex();
    }
  } else {
    currentQuestionIndex = calculateStartIndex();
  }
}

/* Función para barajar un array */
function shuffleArray(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  // Mientras queden elementos a mezclar
  while (0 !== currentIndex) {
    // Seleccionar un elemento sin mezclar
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // E intercambiarlo con el elemento actual
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

/* Función para obtener la pregunta */
function getQuestion() {
  if (quizConfig.randomizeQuestions) {
    let questionIndex;
    do {
      questionIndex = Math.floor(Math.random() * quizConfig.questions.length);
    } while (usedQuestions.includes(questionIndex) && usedQuestions.length < quizConfig.questions.length);

    usedQuestions.push(questionIndex);
    return quizConfig.questions[questionIndex];
  } else {
    if (currentQuestionIndex >= quizConfig.questions.length) {
      currentQuestionIndex = 0;
    }
    return quizConfig.questions[currentQuestionIndex++];
  }
}

/* Función para calcular el índice inicial */
function calculateStartIndex() {
  const totalQuestions = quizConfig.questions.length;
  const questionsPerAttempt = quizConfig.numQuestions;
  const attemptNumber = quizConfig.maxAttempts - attemptsLeft;
  let startIndex = (attemptNumber * questionsPerAttempt) % totalQuestions;

  if (startIndex + questionsPerAttempt > totalQuestions) {
    startIndex = 0;
  }

  return startIndex;
}

/* Función para adjuntar los event listeners */
function attachEventListeners() {
  toggleSectionsVisibility({ intro: true, question: false, results: false });

  document.getElementById("start-btn").addEventListener("click", () => {
    showQuestion();
    document.getElementById("side-bar-section").style.setProperty("display", "none", "important");
  });

  document.getElementById("retry-btn").addEventListener("click", () => {
    retryQuiz();
    document.getElementById("side-bar-section").style.setProperty("display", "flex", "important");
  });

  document.getElementById("next-btn").addEventListener("click", () => {
    showNextQuestion(quizConfig.numQuestions);
  });

  document.getElementById("finish-btn").addEventListener("click", () => {
    document.getElementById("side-bar-section").style.setProperty("display", "flex", "important");
    ScormAPI.finish();

    if (scormVersion === "2004") {
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  });
}

/* Función para inicializar las instrucciones del quiz */
function initQuizInstructions() {
  attachEventListeners();

  if (ScormAPI.init()) {
    const suspendData = getScormValue("suspend_data");
    if (suspendData) {
      try {
        const data = JSON.parse(suspendData);
        attemptsLeft = !isNaN(data.attemptsLeft) && data.attemptsLeft >= 0 ? data.attemptsLeft : quizConfig.maxAttempts;
      } catch (e) {
        console.error("Failed to parse suspend_data:", e);
        attemptsLeft = quizConfig.maxAttempts;
      }
    } else {
      attemptsLeft = quizConfig.maxAttempts;
    }
  } else {
    attemptsLeft = quizConfig.maxAttempts;
  }

  showIntro();
}

initQuizInstructions();
