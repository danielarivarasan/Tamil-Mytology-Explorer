/**
 * Kavi Kalanjiyam — கவி களஞ்சியம்
 * Frontend Application Logic
 */

const API_BASE = "";
let currentMode = "tamil";
let autocompleteTimer = null;
let selectedAutoIndex = -1;

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  loadDBCount();
  loadBrowseGrid();
  setupListeners();
});

async function loadDBCount() {
  try {
    const res = await fetch(`${API_BASE}/api/words`);
    const data = await res.json();
    document.getElementById("db-count").textContent = `${data.total} words`;
    document.getElementById("browse-count").textContent = data.total;
  } catch (e) { console.warn("Could not load DB count:", e); }
}

// ── Mode ──
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === mode)
  );
  const input = document.getElementById("search-input");
  const tamilChips = document.querySelectorAll(".tamil-chip");
  const enChips    = document.querySelectorAll(".en-chip");
  if (mode === "english") {
    input.placeholder = "Type English keyword… (e.g. love, rain, dream)";
    tamilChips.forEach(el => el.classList.add("hidden"));
    enChips.forEach(el => el.classList.remove("hidden"));
  } else {
    input.placeholder = "தமிழ் சொல் தட்டச்சு செய்க…";
    tamilChips.forEach(el => el.classList.remove("hidden"));
    enChips.forEach(el => el.classList.add("hidden"));
  }
  clearSearch();
  input.focus();
}

// ── Listeners ──
function setupListeners() {
  const input = document.getElementById("search-input");

  input.addEventListener("input", () => {
    const val = input.value.trim();
    toggleClear(val.length > 0);
    if (currentMode === "tamil" && val.length >= 1) {
      clearTimeout(autocompleteTimer);
      autocompleteTimer = setTimeout(() => fetchAC(val), 150);
    } else {
      closeAC();
    }
  });

  input.addEventListener("keydown", handleKeydown);

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) closeAC();
  });
}

function handleKeydown(e) {
  const list  = document.getElementById("autocomplete-list");
  const items = list.querySelectorAll("li");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedAutoIndex = Math.min(selectedAutoIndex + 1, items.length - 1);
    highlightAC(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedAutoIndex = Math.max(selectedAutoIndex - 1, -1);
    highlightAC(items);
  } else if (e.key === "Enter") {
    if (selectedAutoIndex >= 0 && items[selectedAutoIndex]) {
      fillSearch(items[selectedAutoIndex].dataset.word);
    }
    performSearch();
  } else if (e.key === "Escape") {
    closeAC();
  }
}

function highlightAC(items) {
  items.forEach((item, i) => {
    item.classList.toggle("highlighted", i === selectedAutoIndex);
  });
}

// ── Autocomplete ──
async function fetchAC(q) {
  try {
    const res  = await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(q)}&limit=7`);
    const data = await res.json();
    renderAC(data.suggestions);
  } catch { closeAC(); }
}

function renderAC(suggestions) {
  const list = document.getElementById("autocomplete-list");
  if (!suggestions.length) { closeAC(); return; }
  list.innerHTML = suggestions.map(w =>
    `<li data-word="${w}" onclick="fillSearch('${w}');performSearch()">${w}</li>`
  ).join("");
  list.classList.add("open");
  selectedAutoIndex = -1;
}

function closeAC() {
  const list = document.getElementById("autocomplete-list");
  list.classList.remove("open");
  list.innerHTML = "";
  selectedAutoIndex = -1;
}

// ── Search ──
function fillSearch(word) {
  document.getElementById("search-input").value = word;
  toggleClear(true);
  closeAC();
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  toggleClear(false);
  closeAC();
  showEmpty();
}

function toggleClear(show) {
  document.getElementById("clear-btn").classList.toggle("visible", show);
}

async function performSearch() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;
  closeAC();
  showLoading();
  try {
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&lang=${currentMode}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderResults(await res.json());
  } catch (err) {
    showError("Network error — is the backend running?");
  }
}

// ── Render ──
function renderResults(data) {
  hideAll();
  if (!data.results || !data.results.length) {
    document.getElementById("no-results-query").textContent = `"${data.query}"`;
    document.getElementById("no-results").classList.remove("hidden");
    return;
  }
  const notice = document.getElementById("match-notice");
  if (data.match_type === "fuzzy") {
    notice.textContent = `Exact match not found for "${data.query}" — showing closest results`;
    notice.classList.remove("hidden");
  } else if (data.match_type === "english") {
    notice.textContent = `Showing Tamil words matching "${data.query}"`;
    notice.classList.remove("hidden");
  }
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "";
  data.results.forEach((word, i) => grid.appendChild(buildCard(word, i)));
}

function buildCard(word, i) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = `${i * 0.06}s`;

  const originKey = getOriginKey(word.origin);

  const morphHtml = word.morphemes.map((m, idx) =>
    `${idx > 0 ? '<span class="m-plus">+</span>' : ''}
     <span class="m-chip">
       <span class="m-chip-num">${idx + 1}</span>
       ${m}
     </span>`
  ).join("");

  card.innerHTML = `
    <div class="card-top">
      <div class="card-word-block">
        <div class="card-word">${word.word}</div>
      </div>
      <span class="origin-pill ${originKey}">${word.origin}</span>
    </div>
    <div class="card-body">
      <div class="meanings-row">
        <div class="field-row">
          <div class="field-label">Tamil Meaning</div>
          <div class="field-value">${word.meaning_tamil}</div>
        </div>
        <div class="field-row">
          <div class="field-label">English Meaning</div>
          <div class="field-value en">${word.meaning_english}</div>
        </div>
      </div>
      <div class="card-divider"></div>
      <div class="field-row">
        <div class="field-label">Root Word</div>
        <div class="field-value root-val">${word.root}</div>
      </div>
      <div class="field-row">
        <div class="field-label">Morpheme Breakdown</div>
        <div class="morpheme-row">${morphHtml}</div>
      </div>
      <div class="example-block">
        <div class="field-label" style="margin-bottom:6px">Example</div>
        <div class="example-ta">${word.example}</div>
        <div class="example-en">${word.example_english}</div>
      </div>
    </div>
  `;
  return card;
}

function getOriginKey(origin) {
  const o = (origin || "").toLowerCase();
  if (o.includes("pure tamil")) return "pure";
  if (o.includes("sanskrit"))   return "sanskrit";
  if (o.includes("arabic"))     return "arabic";
  return "unknown";
}

// ── Browse ──
async function loadBrowseGrid() {
  try {
    const res  = await fetch(`${API_BASE}/api/words`);
    const data = await res.json();
    const grid = document.getElementById("browse-grid");
    grid.innerHTML = data.words.map(w =>
      `<button class="browse-chip" onclick="fillSearch('${w.word}');performSearch()">
         <span class="bw">${w.word}</span>
         <small>${w.meaning_english.split(",")[0].trim().slice(0,18)}</small>
       </button>`
    ).join("");
  } catch (e) { console.warn("Could not load browse grid:", e); }
}

let browseOpen = false;
function toggleBrowse() {
  browseOpen = !browseOpen;
  document.getElementById("browse-grid").classList.toggle("hidden", !browseOpen);
  const btn = document.getElementById("browse-toggle");
  btn.textContent = browseOpen ? "▴" : "▾";
  btn.classList.toggle("open", browseOpen);
}

// ── UI States ──
function hideAll() {
  ["empty-state","loading-state","no-results","match-notice"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
  document.getElementById("cards-grid").innerHTML = "";
}
function showEmpty() {
  hideAll();
  document.getElementById("empty-state").classList.remove("hidden");
}
function showLoading() {
  hideAll();
  document.getElementById("loading-state").classList.remove("hidden");
}
function showError(msg) {
  hideAll();
  document.getElementById("no-results-query").textContent = "";
  const nr = document.getElementById("no-results");
  nr.querySelector(".state-text").innerHTML = msg;
  nr.classList.remove("hidden");
}
