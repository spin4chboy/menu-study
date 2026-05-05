const KNOWN_KEY = "menuStudy.knownIds";
const QUIZ_STATS_KEY = "menuStudy.quizStats";

// Loading-screen tips
const LOADING_TIPS = [
  "Fun Fact: Dre is the Bozeman little league baseball MVP.",
  "Tip: Never talk to Tony if you're not clocked in.",
  "Tip: Ask Sarah if you should clock out while eating a meal after your shift.",
  "Tip: Hit your vape in the main dining area.",
  "Fun Fact: You're encouraged to be on your phone at the host stand.",
];

function showLoadingScreen(targetUrl) {
  const overlay = document.createElement("div");
  overlay.className = "loading-screen";
  const tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  // Repeat the same tip across the track so the marquee scrolls smoothly
  const tipSpans = Array(6).fill(`<span>${tip}</span>`).join("");
  overlay.innerHTML = `
    <div class="loading-title">LOADING</div>
    <div class="loading-marquee">
      <div class="loading-marquee-track">${tipSpans}</div>
    </div>
    <div class="loading-bar-wrap">
      <div class="loading-bar-track"><div class="loading-bar"></div></div>
      <div class="loading-percent">0%</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const duration = 5000 + Math.random() * 2000; // 5–7s
  const bar = overlay.querySelector(".loading-bar");
  const pct = overlay.querySelector(".loading-percent");
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const ratio = Math.min(1, elapsed / duration);
    const eased = ratio < 0.95
      ? ratio * (0.85 + Math.random() * 0.05)
      : ratio;
    const display = Math.floor(eased * 100);
    bar.style.width = display + "%";
    pct.textContent = display + "%";
    if (ratio < 1) {
      requestAnimationFrame(tick);
    } else {
      bar.style.width = "100%";
      pct.textContent = "100%";
      setTimeout(() => { window.location.href = targetUrl; }, 200);
    }
  }
  requestAnimationFrame(tick);
}

function setupPageTransitions() {
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || link.target === "_blank") return;
      e.preventDefault();
      showLoadingScreen(href);
    });
  });
}
document.addEventListener("DOMContentLoaded", setupPageTransitions);
if (document.readyState !== "loading") setupPageTransitions();

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

    const hasIngredients = item.ingredients && item.ingredients.length;
    const details = el("div", { class: "card-details" }, [
      hasIngredients
        ? el("p", {}, [el("strong", {}, "Ingredients: "), item.ingredients.join(", ")])
        : item.description
          ? el("p", { class: "card-desc" }, item.description)
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
    const fcHasIngredients = current.ingredients && current.ingredients.length;
    backEl.innerHTML = `
      <div class="fc-price">${[formatPrice(current.price), current.category].filter(Boolean).join(" · ")}</div>
      ${fcHasIngredients ? `<p><strong>Ingredients:</strong> ${current.ingredients.join(", ")}</p>` : current.description ? `<p>${current.description}</p>` : ""}
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
  const categoryBar = document.getElementById("quiz-categories");

  let mode = "name";
  let activeCategory = "All";
  let current = null;
  let answered = false;
  let sessionCorrect = 0;
  let sessionTotal = 0;
  let queue = [];
  let cycleTotal = 0;

  function getPool() {
    return activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);
  }

  function rebuildQueue() {
    const pool = getPool();
    let eligible;
    if (mode === "name") {
      eligible = pool.filter(
        (i) => (i.ingredients && i.ingredients.length >= 1) || (i.description && i.description.length > 0)
      );
    } else if (mode === "describe") {
      eligible = pool.filter(
        (i) => (i.ingredients && i.ingredients.length >= 1) || (i.description && i.description.length > 0)
      );
    } else {
      eligible = pool.filter((i) => i.ingredients && i.ingredients.length >= 3);
    }
    queue = shuffle(eligible);
    cycleTotal = queue.length;
  }

  function renderCategories() {
    categoryBar.innerHTML = "";
    const cats = ["All", ...getCategories(items)];
    for (const c of cats) {
      const btn = el(
        "button",
        {
          class: "chip" + (c === activeCategory ? " chip-active" : ""),
          onClick: () => {
            activeCategory = c;
            renderCategories();
            sessionCorrect = 0;
            sessionTotal = 0;
            scoreEl.textContent = "Session: 0 / 0";
            rebuildQueue();
            pickQuestion();
          },
        },
        c
      );
      categoryBar.appendChild(btn);
    }
  }

  function setMode(newMode) {
    mode = newMode;
    for (const b of modeButtons) {
      b.classList.toggle("chip-active", b.dataset.mode === mode);
    }
    sessionCorrect = 0;
    sessionTotal = 0;
    scoreEl.textContent = "Session: 0 / 0";
    rebuildQueue();
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

    if (cycleTotal === 0) {
      promptEl.innerHTML = "";
      optionsEl.className = "quiz-options";
      optionsEl.innerHTML = `<p class="empty-msg">Not enough items in <strong>${activeCategory}</strong> to quiz on. Pick another category.</p>`;
      return;
    }
    if (queue.length === 0) {
      showCompletion();
      return;
    }
    current = queue.pop();
    if (mode === "name") return pickNameQuestion();
    if (mode === "ingredients") return pickIngredientsQuestion();
    if (mode === "describe") return pickDescribeQuestion();
  }

  function showCompletion() {
    const where = activeCategory === "All" ? "the whole menu" : activeCategory;
    promptEl.innerHTML = `
      <div class="quiz-category">Cycle complete</div>
      <p style="font-family: 'Bowlby One', sans-serif; font-size: clamp(1.3rem, 4.5vw, 1.9rem); text-transform: uppercase; line-height: 1.05; margin: 0.5rem 0 0;">You ran all ${cycleTotal} items in ${where}.</p>
    `;
    optionsEl.className = "quiz-options";
    optionsEl.innerHTML = "";
    feedbackEl.textContent = `Final: ${sessionCorrect} / ${sessionTotal}`;
    feedbackEl.className = "feedback correct-text";
    nextBtn.textContent = "Start Over";
    nextBtn.style.visibility = "visible";
    nextBtn.onclick = () => {
      sessionCorrect = 0;
      sessionTotal = 0;
      scoreEl.textContent = "Session: 0 / 0";
      rebuildQueue();
      pickQuestion();
    };
  }

  // --- Mode 1: Name the dish ---
  function pickNameQuestion() {
    const pool = getPool();
    const hasIngredients = current.ingredients && current.ingredients.length;
    const clue = hasIngredients
      ? `<p><strong>Ingredients:</strong> ${current.ingredients.join(", ")}</p>`
      : `<p>${current.description}</p>`;
    promptEl.innerHTML = `
      <div class="quiz-category">${current.category}</div>
      ${clue}
      <p class="quiz-hint" style="margin-top: 0.6rem;">${queue.length + 1} of ${cycleTotal} left</p>
    `;

    const distractorPool = pool.filter((i) => i.id !== current.id);
    const distractors = shuffle(distractorPool).slice(0, Math.min(3, distractorPool.length));
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
    const pool = getPool();
    const correctSet = new Set(current.ingredients.map((s) => s.toLowerCase().trim()));
    const decoyPool = new Set();
    for (const it of pool) {
      if (it.id === current.id || !it.ingredients) continue;
      for (const ing of it.ingredients) {
        const k = ing.toLowerCase().trim();
        if (!correctSet.has(k)) decoyPool.add(ing);
      }
    }
    const decoyCount = Math.min(current.ingredients.length, decoyPool.size);
    const decoys = shuffle([...decoyPool]).slice(0, decoyCount);
    const allChoices = shuffle([
      ...current.ingredients.map((ing) => ({ name: ing, correct: true })),
      ...decoys.map((ing) => ({ name: ing, correct: false })),
    ]);

    promptEl.innerHTML = `
      <div class="quiz-category">${current.category}</div>
      <p style="font-family: 'Bowlby One', sans-serif; font-size: 1.4rem; text-transform: uppercase; line-height: 1.05; margin-top: 0.25rem;">${current.name}</p>
      <p class="quiz-hint">Select all the ingredients in this item. ${queue.length + 1} of ${cycleTotal} left.</p>
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

  // --- Mode 3: Describe It ---
  function pickDescribeQuestion() {
    promptEl.innerHTML = `
      <div class="quiz-category">${current.category}</div>
      <p class="describe-name">${current.name}</p>
      <p class="quiz-hint">Describe this item from memory — ingredients, dietary info, and any subs or add-ins. ${queue.length + 1} of ${cycleTotal} left.</p>
    `;

    optionsEl.className = "quiz-options";
    optionsEl.innerHTML = `
      <textarea id="describe-input" class="describe-input" rows="6" placeholder="Type your description here..."></textarea>
      <div id="describe-feedback" class="describe-feedback"></div>
    `;

    nextBtn.textContent = "Submit";
    nextBtn.style.visibility = "visible";
    nextBtn.disabled = false;
    nextBtn.onclick = handleDescribeSubmit;

    setTimeout(() => {
      const input = document.getElementById("describe-input");
      if (input) input.focus();
    }, 50);
  }

  function matchTokenInText(text, token) {
    const t = token.toLowerCase().trim();
    if (!t) return false;
    if (text.includes(t)) return true;
    const words = t.split(/[\s,\-]+/).filter((w) => w.length >= 4);
    return words.some((w) => text.includes(w));
  }

  function dietaryFacts(item) {
    const notes = (item.notes || "").toLowerCase();
    const allergens = (item.allergens || []).map((a) => a.toLowerCase());
    const facts = [];

    const isVeg = /\(v\)/.test(notes);
    const isVegan = /vegan/.test(notes);
    const isGFNative = /comes\s*\(?gf\)?|comes gluten[- ]free|\(gf\)\s*\(v\)/.test(notes);
    const hasGFSub = /sub gluten[- ]free|if \(gf\)|gluten[- ]free.*\$|\$.*gluten[- ]free/.test(notes);

    if (isVegan) facts.push({ key: "vegan", label: "Vegan", positive: true });
    else if (isVeg) facts.push({ key: "vegetarian", label: "Vegetarian (V)", positive: true });
    else if (allergens.length === 0 && !item.ingredients?.some((i) => /chicken|beef|pork|bacon|ham|salmon|fish|sausage|crab|shrimp/i.test(i))) {
      // unknown — skip
    } else {
      facts.push({ key: "vegetarian", label: "Not vegetarian", positive: false });
    }

    if (isGFNative) facts.push({ key: "glutenFree", label: "Gluten-free as served", positive: true });
    else if (allergens.includes("gluten")) facts.push({ key: "glutenFree", label: "Contains gluten", positive: false });

    if (hasGFSub && !isGFNative) facts.push({ key: "glutenFreeSub", label: "Has a gluten-free sub", positive: true });

    if (allergens.includes("dairy")) facts.push({ key: "dairy", label: "Contains dairy", positive: false });
    if (allergens.includes("nuts") || allergens.includes("peanut")) facts.push({ key: "nuts", label: "Contains nuts", positive: false });

    return facts;
  }

  function userMentionedFact(text, key) {
    const checks = {
      vegan: /\bvegan\b/,
      vegetarian: /vegetarian|\bveg\b|\(v\)/,
      glutenFree: /gluten[- ]free|\bgf\b/,
      glutenFreeSub: /gluten[- ]free|\bgf\b|sub/,
      dairy: /dairy|cheese|milk|cream|butter/,
      nuts: /\bnut|almond|peanut|walnut|pecan/,
    };
    return checks[key] ? checks[key].test(text) : false;
  }

  function extractSubsAndAdds(item) {
    const notes = item.notes || "";
    const sentences = notes.split(/(?<=[.!])\s+/).filter(Boolean);
    const subs = sentences.filter((s) => /sub|if \(gf\)|gluten[- ]free/i.test(s));
    const adds = sentences.filter((s) => /\badd\b|upsell|upcharge|sub.*\$|\+\$/i.test(s) && !subs.includes(s));
    return { subs, adds };
  }

  function handleDescribeSubmit() {
    const input = document.getElementById("describe-input");
    const fbEl = document.getElementById("describe-feedback");
    if (!input || !fbEl) return;
    const raw = input.value.trim();
    if (!raw) {
      fbEl.innerHTML = `<p class="describe-empty">Type somethin first, hon.</p>`;
      return;
    }
    const text = raw.toLowerCase();

    const ingredients = current.ingredients || [];
    const hit = [];
    const missed = [];
    for (const ing of ingredients) {
      if (matchTokenInText(text, ing)) hit.push(ing);
      else missed.push(ing);
    }

    const ingScore = ingredients.length === 0 ? null : hit.length / ingredients.length;
    const facts = dietaryFacts(current);
    const factsResult = facts.map((f) => ({
      ...f,
      mentioned: userMentionedFact(text, f.key),
    }));
    const dietaryHit = factsResult.filter((f) => f.mentioned).length;
    const dietaryTotal = factsResult.length;

    const { subs, adds } = extractSubsAndAdds(current);
    const subHits = subs.map((s) => ({ text: s, mentioned: matchTokenInText(text, s.replace(/[^a-z0-9 ]/gi, " ")) }));
    const addHits = adds.map((a) => ({ text: a, mentioned: matchTokenInText(text, a.replace(/[^a-z0-9 ]/gi, " ")) }));

    // Build feedback HTML
    let html = "";

    if (ingredients.length) {
      html += `<div class="feedback-section">
        <h4>Ingredients (${hit.length} / ${ingredients.length})</h4>
        <ul class="fb-list">
          ${hit.map((i) => `<li class="fb-hit">✓ ${i}</li>`).join("")}
          ${missed.map((i) => `<li class="fb-miss">✗ ${i}</li>`).join("")}
        </ul>
      </div>`;
    }

    if (factsResult.length) {
      html += `<div class="feedback-section dietary">
        <h4>Dietary (${dietaryHit} / ${dietaryTotal} mentioned)</h4>
        <ul class="fb-list">
          ${factsResult.map((f) => `<li class="${f.mentioned ? "fb-hit" : "fb-miss"}">${f.mentioned ? "✓" : "✗"} ${f.label}</li>`).join("")}
        </ul>
      </div>`;
    }

    if (subs.length) {
      html += `<div class="feedback-section">
        <h4>Subs to know</h4>
        <ul class="fb-list">
          ${subHits.map((s) => `<li class="${s.mentioned ? "fb-hit" : "fb-miss"}">${s.mentioned ? "✓" : "✗"} ${s.text}</li>`).join("")}
        </ul>
      </div>`;
    }

    if (adds.length) {
      html += `<div class="feedback-section">
        <h4>Add-ins / upsells</h4>
        <ul class="fb-list">
          ${addHits.map((a) => `<li class="${a.mentioned ? "fb-hit" : "fb-miss"}">${a.mentioned ? "✓" : "✗"} ${a.text}</li>`).join("")}
        </ul>
      </div>`;
    }

    if (current.description) {
      html += `<div class="feedback-section reference">
        <h4>Reference description</h4>
        <p>${current.description}</p>
      </div>`;
    }

    fbEl.innerHTML = html;
    input.disabled = true;

    // Pass threshold: 70% ingredients + at least half dietary if any
    const passIng = ingScore == null ? true : ingScore >= 0.7;
    const passDietary = dietaryTotal === 0 ? true : dietaryHit / dietaryTotal >= 0.5;
    const passed = passIng && passDietary;

    sessionTotal += 1;
    if (passed) {
      sessionCorrect += 1;
      recordQuizAnswer(true);
      feedbackEl.textContent = "Solid description!";
      feedbackEl.className = "feedback correct-text";
    } else {
      recordQuizAnswer(false);
      feedbackEl.textContent = "Keep workin' on it — peep what you missed.";
      feedbackEl.className = "feedback incorrect-text";
      showWrongFeedback();
    }
    scoreEl.textContent = `Session: ${sessionCorrect} / ${sessionTotal}`;

    nextBtn.textContent = "Next →";
    nextBtn.onclick = () => pickQuestion();
  }

  renderCategories();
  scoreEl.textContent = "Session: 0 / 0";
  rebuildQueue();
  pickQuestion();
}
