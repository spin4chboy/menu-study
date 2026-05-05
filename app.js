const KNOWN_KEY = "menuStudy.knownIds";
const QUIZ_STATS_KEY = "menuStudy.quizStats";

async function loadMenu() {
  const res = await fetch("menu.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load menu.json");
  return res.json();
}

function getCategories(items) {
  return [...new Set(items.map((i) => i.category))];
}

function getKnownIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function setKnownIds(set) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify([...set]));
}

function markKnown(id) {
  const s = getKnownIds();
  s.add(id);
  setKnownIds(s);
}

function markUnknown(id) {
  const s = getKnownIds();
  s.delete(id);
  setKnownIds(s);
}

function getQuizStats() {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '{"correct":0,"total":0}');
  } catch {
    return { correct: 0, total: 0 };
  }
}

function recordQuizAnswer(isCorrect) {
  const s = getQuizStats();
  s.total += 1;
  if (isCorrect) s.correct += 1;
  localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(s));
}

function resetProgress() {
  localStorage.removeItem(KNOWN_KEY);
  localStorage.removeItem(QUIZ_STATS_KEY);
}

const WRONG_MESSAGES = [
  "Dre wants to talk with you.",
  "Sarah is coming for your ass.",
  "Elisha's not mad, she's just disappointed.",
  "Tony thinks you're just plain stupid.",
];

function showWrongFeedback() {
  const msg = WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)];

  const flash = document.createElement("div");
  flash.className = "screen-flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);

  const toast = document.createElement("div");
  toast.className = "wrong-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatPrice(n) {
  if (n == null || n === 0) return "";
  return `$${n.toFixed(2)}`;
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "onClick") e.addEventListener("click", v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

// ---------- Home page ----------
async function initHome() {
  const items = await loadMenu();
  const known = getKnownIds();
  const progress = document.getElementById("progress");
  progress.textContent = `${known.size} of ${items.length} items learned`;

  const stats = getQuizStats();
  const quizStats = document.getElementById("quiz-stats");
  if (stats.total > 0) {
    const pct = Math.round((stats.correct / stats.total) * 100);
    quizStats.textContent = `Quiz: ${stats.correct} / ${stats.total} (${pct}%)`;
  } else {
    quizStats.textContent = "Quiz: no attempts yet";
  }

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Reset all progress?")) {
      resetProgress();
      location.reload();
    }
  });
}

// ---------- Browse page ----------
async function initBrowse() {
  const items = await loadMenu();
  const categories = ["All", ...getCategories(items)];
  const filterBar = document.getElementById("filters");
  const list = document.getElementById("list");

  let activeCategory = "All";

  function render() {
    filterBar.innerHTML = "";
    for (const c of categories) {
      const btn = el(
        "button",
        {
          class: "chip" + (c === activeCategory ? " chip-active" : ""),
          onClick: () => {
            activeCategory = c;
            render();
          },
        },
        c
      );
      filterBar.appendChild(btn);
    }

    list.innerHTML = "";
    const known = getKnownIds();
    const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);
    for (const item of filtered) {
      list.appendChild(renderCard(item, known));
    }
  }

  function renderCard(item, known) {
    const isKnown = known.has(item.id);
    const card = el("div", { class: "card" + (isKnown ? " card-known" : "") });

    const header = el("div", { class: "card-header" }, [
      el("div", { class: "card-title" }, [
        el("span", { class: "card-name" }, item.name),
        el("span", { class: "card-price" }, formatPrice(item.price)),
      ]),
      el("div", { class: "card-category" }, item.category),
    ]);
    card.appendChild(header);

    const details = el("div", { class: "card-details" }, [
      el("p", { class: "card-desc" }, item.description),
      item.ingredients && item.ingredients.length
        ? el("p", {}, [el("strong", {}, "Ingredients: "), item.ingredients.join(", ")])
        : null,
      item.allergens && item.allergens.length
        ? el("p", {}, [el("strong", {}, "Allergens: "), item.allergens.join(", ")])
        : null,
      item.notes ? el("p", { class: "card-notes" }, item.notes) : null,
    ]);
    card.appendChild(details);

    const toggle = el(
      "button",
      {
        class: "btn btn-small",
        onClick: (e) => {
          e.stopPropagation();
          if (isKnown) markUnknown(item.id);
          else markKnown(item.id);
          render();
        },
      },
      isKnown ? "✓ Known" : "Mark known"
    );
    card.appendChild(toggle);

    let expanded = false;
    details.style.display = "none";
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      expanded = !expanded;
      details.style.display = expanded ? "block" : "none";
    });

    return card;
  }

  render();
}

// ---------- Flashcards page ----------
async function initFlashcards() {
  const items = await loadMenu();
  const cardEl = document.getElementById("flashcard");
  const frontEl = document.getElementById("card-front");
  const backEl = document.getElementById("card-back");
  const counterEl = document.getElementById("counter");
  const includeKnownEl = document.getElementById("include-known");

  let pool = [];
  let current = null;
  let flipped = false;

  function rebuildPool() {
    const known = getKnownIds();
    pool = includeKnownEl.checked ? items.slice() : items.filter((i) => !known.has(i.id));
    pool = shuffle(pool);
  }

  function next() {
    flipped = false;
    cardEl.classList.remove("flipped");
    if (pool.length === 0) rebuildPool();
    if (pool.length === 0) {
      frontEl.textContent = "All done!";
      backEl.textContent = "You've marked everything as known. Toggle 'include known' to review again.";
      current = null;
      counterEl.textContent = "";
      return;
    }
    current = pool.pop();
    frontEl.innerHTML = `<div class="fc-name">${current.name}</div><div class="fc-hint">tap to reveal</div>`;
    backEl.innerHTML = `
      <div class="fc-price">${[formatPrice(current.price), current.category].filter(Boolean).join(" · ")}</div>
      <p>${current.description}</p>
      ${current.ingredients && current.ingredients.length ? `<p><strong>Ingredients:</strong> ${current.ingredients.join(", ")}</p>` : ""}
      ${current.allergens && current.allergens.length ? `<p><strong>Allergens:</strong> ${current.allergens.join(", ")}</p>` : ""}
      ${current.notes ? `<p class="fc-notes">${current.notes}</p>` : ""}
    `;
    const known = getKnownIds();
    counterEl.textContent = `${known.size} / ${items.length} learned`;
  }

  cardEl.addEventListener("click", () => {
    flipped = !flipped;
    cardEl.classList.toggle("flipped", flipped);
  });

  document.getElementById("got-it").addEventListener("click", () => {
    if (current) markKnown(current.id);
    next();
  });
  document.getElementById("review-again").addEventListener("click", () => {
    if (current) markUnknown(current.id);
    next();
  });
  includeKnownEl.addEventListener("change", () => {
    rebuildPool();
    next();
  });

  rebuildPool();
  next();
}

// ---------- Quiz page ----------
async function initQuiz() {
  const items = await loadMenu();
  const promptEl = document.getElementById("quiz-prompt");
  const optionsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const nextBtn = document.getElementById("quiz-next");
  const scoreEl = document.getElementById("quiz-score");
  const modeButtons = document.querySelectorAll("[data-mode]");

  let mode = "name";
  let current = null;
  let answered = false;
  let sessionCorrect = 0;
  let sessionTotal = 0;

  function setMode(newMode) {
    mode = newMode;
    for (const b of modeButtons) {
      b.classList.toggle("chip-active", b.dataset.mode === mode);
    }
    sessionCorrect = 0;
    sessionTotal = 0;
    scoreEl.textContent = "Session: 0 / 0";
    pickQuestion();
  }

  for (const b of modeButtons) {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  }

  function pickQuestion() {
    answered = false;
    feedbackEl.textContent = "";
    feedbackEl.className = "";
    nextBtn.style.visibility = "hidden";
    nextBtn.disabled = false;
    nextBtn.textContent = "Next →";
    nextBtn.onclick = () => pickQuestion();

    if (mode === "name") return pickNameQuestion();
    if (mode === "ingredients") return pickIngredientsQuestion();
  }

  // --- Mode 1: Name the dish ---
  function pickNameQuestion() {
    current = items[Math.floor(Math.random() * items.length)];
    promptEl.innerHTML = `
      <div class="quiz-category">${current.category}</div>
      <p>${current.description}</p>
      ${current.ingredients && current.ingredients.length ? `<p class="quiz-hint"><strong>Ingredients:</strong> ${current.ingredients.join(", ")}</p>` : ""}
    `;

    const sameCategory = items.filter((i) => i.category === current.category && i.id !== current.id);
    const otherCategory = items.filter((i) => i.category !== current.category);
    const distractors = shuffle(sameCategory).slice(0, 3);
    while (distractors.length < 3 && otherCategory.length) {
      const pick = otherCategory[Math.floor(Math.random() * otherCategory.length)];
      if (!distractors.includes(pick)) distractors.push(pick);
    }
    const choices = shuffle([current, ...distractors]);

    optionsEl.className = "quiz-options";
    optionsEl.innerHTML = "";
    for (const c of choices) {
      const btn = el(
        "button",
        {
          class: "btn quiz-option",
          onClick: () => handleNameAnswer(btn, c),
        },
        c.name
      );
      optionsEl.appendChild(btn);
    }
  }

  function handleNameAnswer(btn, choice) {
    if (answered) return;
    answered = true;
    const isCorrect = choice.id === current.id;
    sessionTotal += 1;
    if (isCorrect) sessionCorrect += 1;
    recordQuizAnswer(isCorrect);

    for (const b of optionsEl.querySelectorAll("button")) {
      b.disabled = true;
      if (b.textContent === current.name) b.classList.add("correct");
    }
    if (!isCorrect) btn.classList.add("incorrect");

    feedbackEl.textContent = isCorrect ? "Correct!" : `Not quite — answer: ${current.name}.`;
    feedbackEl.className = isCorrect ? "feedback correct-text" : "feedback incorrect-text";
    scoreEl.textContent = `Session: ${sessionCorrect} / ${sessionTotal}`;
    nextBtn.style.visibility = "visible";
    if (!isCorrect) showWrongFeedback();
  }

  // --- Mode 2: Pick the ingredients ---
  function pickIngredientsQuestion() {
    const eligible = items.filter((i) => i.ingredients && i.ingredients.length >= 3);
    current = eligible[Math.floor(Math.random() * eligible.length)];

    const correctSet = new Set(current.ingredients.map((s) => s.toLowerCase().trim()));
    const decoyPool = new Set();
    for (const it of items) {
      if (it.id === current.id || !it.ingredients) continue;
      for (const ing of it.ingredients) {
        const k = ing.toLowerCase().trim();
        if (!correctSet.has(k)) decoyPool.add(ing);
      }
    }
    const decoyCount = current.ingredients.length;
    const decoys = shuffle([...decoyPool]).slice(0, decoyCount);
    const allChoices = shuffle([
      ...current.ingredients.map((ing) => ({ name: ing, correct: true })),
      ...decoys.map((ing) => ({ name: ing, correct: false })),
    ]);

    promptEl.innerHTML = `
      <div class="quiz-category">${current.category}</div>
      <p style="font-family: 'Bowlby One', sans-serif; font-size: 1.4rem; text-transform: uppercase; line-height: 1.05; margin-top: 0.25rem;">${current.name}</p>
      <p class="quiz-hint">Select all the ingredients in this item.</p>
    `;

    optionsEl.className = "quiz-options ingredient-grid";
    optionsEl.innerHTML = "";
    for (const c of allChoices) {
      const label = el("label", { class: "ingredient-choice" });
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.correct = c.correct ? "1" : "0";
      cb.dataset.name = c.name;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + c.name));
      optionsEl.appendChild(label);
    }

    nextBtn.textContent = "Check";
    nextBtn.style.visibility = "visible";
    nextBtn.disabled = false;
    nextBtn.onclick = handleIngredientsCheck;
  }

  function handleIngredientsCheck() {
    const checkboxes = optionsEl.querySelectorAll("input[type=checkbox]");
    let allRight = true;
    let wrongChecked = 0;
    let missed = 0;

    for (const cb of checkboxes) {
      const label = cb.parentElement;
      label.classList.remove("correct", "incorrect", "missed");
      const isCorrect = cb.dataset.correct === "1";
      if (cb.checked && isCorrect) {
        label.classList.add("correct");
        cb.disabled = true;
      } else if (cb.checked && !isCorrect) {
        label.classList.add("incorrect");
        wrongChecked += 1;
        allRight = false;
      } else if (!cb.checked && isCorrect) {
        missed += 1;
        allRight = false;
      }
    }

    if (allRight) {
      sessionTotal += 1;
      sessionCorrect += 1;
      recordQuizAnswer(true);
      scoreEl.textContent = `Session: ${sessionCorrect} / ${sessionTotal}`;
      feedbackEl.textContent = "Locked in! All correct.";
      feedbackEl.className = "feedback correct-text";
      nextBtn.textContent = "Next →";
      nextBtn.onclick = () => pickQuestion();
    } else {
      const parts = [];
      if (wrongChecked) parts.push(`${wrongChecked} wrong`);
      if (missed) parts.push(`${missed} missing`);
      feedbackEl.textContent = `Nah — ${parts.join(", ")}. Fix it and try again.`;
      feedbackEl.className = "feedback incorrect-text";
      showWrongFeedback();
    }
  }

  scoreEl.textContent = "Session: 0 / 0";
  pickQuestion();
}
