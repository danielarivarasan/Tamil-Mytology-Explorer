/**
 * Tamil Etymology Explorer — Frontend App
 * =========================================
 * Handles:
 *   - Search (Tamil & English modes)
 *   - Live autocomplete
 *   - Result rendering with morpheme visualization
 *   - Browse-all grid
 *   - Keyboard navigation
 */

// ─────────────────────────────────────────────
// Constants & State
// ─────────────────────────────────────────────
const API_BASE = "";   // Same origin; change to "http://localhost:8000" for dev

let currentMode = "tamil";          // "tamil" | "english"
let autocompleteTimer = null;        // Debounce timer
let selectedAutoIndex = -1;          // Keyboard nav index in autocomplete
let lastQuery = "";                  // Last searched query

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadDBCount();
  loadBrowseGrid();
  setupInputListeners();
});

/** Fetch total word count from API and update header badge */
async function loadDBCount() {
  try {
    const res = await fetch(`${API_BASE}/api/words`);
    const data = await res.json();
    document.getElementById("db-count").textContent = `${data.total} words`;
    document.getElementById("browse-count").textContent = data.total;
  } catch (e) {
    console.warn("Could not load DB count:", e);
  }
}

// ─────────────────────────────────────────────
// Search Mode
// ─────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  const input = document.getElementById("search-input");
  const enSamples = document.querySelectorAll(".en-sample");
  const taSamples = document.querySelectorAll(".sample-chip:not(.en-sample)");

  if (mode === "english") {
    input.placeholder = "Type English keyword… (e.g. love, rain, sky)";
    enSamples.forEach(el => el.classList.remove("hidden"));
    taSamples.forEach(el => el.classList.add("hidden"));
  } else {
    input.placeholder = "தமிழ் சொல் தட்டச்சு செய்க… (e.g. அன்பு)";
    enSamples.forEach(el => el.classList.add("hidden"));
    taSamples.forEach(el => el.classList.remove("hidden"));
  }

  clearSearch();
  input.focus();
}

// ─────────────────────────────────────────────
// Input Event Listeners
// ─────────────────────────────────────────────
function setupInputListeners() {
  const input = document.getElementById("search-input");

  // Debounced autocomplete on input
  input.addEventListener("input", () => {
    const val = input.value.trim();
    toggleClearBtn(val.length > 0);

    if (currentMode === "tamil" && val.length >= 1) {
      clearTimeout(autocompleteTimer);
      autocompleteTimer = setTimeout(() => fetchAutocomplete(val), 160);
    } else {
      closeAutocomplete();
    }
  });

  // Keyboard navigation for autocomplete + Enter to search
  input.addEventListener("keydown", (e) => {
    const list = document.getElementById("autocomplete-list");
    const items = list.querySelectorAll("li");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedAutoIndex = Math.min(selectedAutoIndex + 1, items.length - 1);
      highlightItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedAutoIndex = Math.max(selectedAutoIndex - 1, -1);
      highlightItem(items);
    } else if (e.key === "Enter") {
      if (selectedAutoIndex >= 0 && items[selectedAutoIndex]) {
        fillSearch(items[selectedAutoIndex].dataset.word);
        performSearch();
      } else {
        performSearch();
      }
    } else if (e.key === "Escape") {
      closeAutocomplete();
    }
  });

  // Click outside closes autocomplete
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-input-group") && !e.target.closest(".autocomplete-list")) {
      closeAutocomplete();
    }
  });
}

function highlightItem(items) {
  items.forEach((item, i) => {
    item.style.background = i === selectedAutoIndex ? "var(--parchment)" : "";
  });
}

// ─────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────
async function fetchAutocomplete(query) {
  try {
    const res = await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(query)}&limit=7`);
    const data = await res.json();
    renderAutocomplete(data.suggestions);
  } catch (e) {
    closeAutocomplete();
  }
}

function renderAutocomplete(suggestions) {
  const list = document.getElementById("autocomplete-list");
  if (!suggestions.length) {
    closeAutocomplete();
    return;
  }

  list.innerHTML = suggestions.map(word => `
    <li data-word="${word}" onclick="fillSearch('${word}'); performSearch();">
      ${word}
    </li>
  `).join("");

  list.classList.add("open");
  selectedAutoIndex = -1;
}

function closeAutocomplete() {
  const list = document.getElementById("autocomplete-list");
  list.classList.remove("open");
  list.innerHTML = "";
  selectedAutoIndex = -1;
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function fillSearch(word) {
  document.getElementById("search-input").value = word;
  toggleClearBtn(true);
  closeAutocomplete();
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  toggleClearBtn(false);
  closeAutocomplete();
  showEmpty();
}

function toggleClearBtn(show) {
  const btn = document.getElementById("clear-btn");
  btn.classList.toggle("visible", show);
}

async function performSearch() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;

  lastQuery = query;
  closeAutocomplete();
  showLoading();

  try {
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&lang=${currentMode}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error("Search error:", err);
    showError("Network error — is the backend running?");
  }
}

// ─────────────────────────────────────────────
// Result Rendering
// ─────────────────────────────────────────────
function renderResults(data) {
  hideAll();

  if (!data.results || data.results.length === 0) {
    document.getElementById("no-results-query").textContent = data.query;
    document.getElementById("no-results").classList.remove("hidden");
    return;
  }

  // Match type notice
  const notice = document.getElementById("match-notice");
  if (data.match_type === "fuzzy") {
    notice.textContent = `⟳  Exact match not found for "${data.query}" — showing closest results`;
    notice.classList.remove("hidden");
  } else if (data.match_type === "english") {
    notice.textContent = `🔍  Showing Tamil words matching English keyword: "${data.query}"`;
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }

  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "";

  data.results.forEach((word, i) => {
    const card = buildCard(word, i);
    grid.appendChild(card);
  });
}

/**
 * Build a word result card DOM element.
 * @param {Object} word - word entry from API
 * @param {number} i    - index (for animation delay)
 */
function buildCard(word, i) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = `${i * 0.07}s`;

  const originClass = getOriginClass(word.origin);
  const morphemeHtml = word.morphemes.map((m, idx) => `
    <span class="morpheme-chip">
      <span class="chip-index">${idx + 1}</span>
      ${m}
    </span>
  `).join("");

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-word">${word.word}</div>
        <div class="card-origin">
          <span class="pill ${originClass}">${word.origin}</span>
        </div>
      </div>
    </div>
    <div class="card-body">

      <div class="field field-meaning">
        <div class="field-label">Meaning (Tamil)</div>
        <div class="field-value">${word.meaning_tamil}</div>
      </div>

      <div class="field field-meaning">
        <div class="field-label">Meaning (English)</div>
        <div class="field-value en">${word.meaning_english}</div>
      </div>

      <div class="field">
        <div class="field-label">Root Word</div>
        <div class="field-value root-value">${word.root}</div>
      </div>

      <div class="field">
        <div class="field-label">Morpheme Breakdown</div>
        <div class="morpheme-chips">${morphemeHtml}</div>
      </div>

      <div class="field example-block">
        <div class="field-label">Example Sentence</div>
        <div class="example-tamil">${word.example}</div>
        <div class="example-english">${word.example_english}</div>
      </div>

    </div>
  `;

  return card;
}

/** Map origin string to CSS class for the pill */
function getOriginClass(origin) {
  const o = (origin || "").toLowerCase();
  if (o.includes("pure tamil"))    return "pure";
  if (o.includes("sanskrit"))      return "sanskrit";
  if (o.includes("arabic"))        return "arabic";
  return "unknown";
}

// ─────────────────────────────────────────────
// Browse All Words Grid
// ─────────────────────────────────────────────
async function loadBrowseGrid() {
  try {
    const res = await fetch(`${API_BASE}/api/words`);
    const data = await res.json();
    const grid = document.getElementById("browse-grid");

    grid.innerHTML = data.words.map(w => `
      <button class="browse-chip" onclick="fillSearch('${w.word}'); performSearch();">
        ${w.word}
        <small>${w.meaning_english.split(",")[0].trim().slice(0, 16)}</small>
      </button>
    `).join("");
  } catch (e) {
    console.warn("Could not load browse grid:", e);
  }
}

let browseOpen = false;
function toggleBrowse() {
  browseOpen = !browseOpen;
  const grid = document.getElementById("browse-grid");
  const toggle = document.getElementById("browse-toggle");
  const header = document.querySelector(".browse-header");

  grid.classList.toggle("hidden", !browseOpen);
  toggle.textContent = browseOpen ? "▴ Hide" : "▾ Show";
  header.style.borderBottomColor = browseOpen ? "var(--border)" : "transparent";
}

// ─────────────────────────────────────────────
// UI State Helpers
// ─────────────────────────────────────────────
function hideAll() {
  document.getElementById("empty-state").classList.add("hidden");
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("no-results").classList.add("hidden");
  document.getElementById("match-notice").classList.add("hidden");
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
  const noResults = document.getElementById("no-results");
  noResults.querySelector("p").textContent = msg;
  document.getElementById("no-results-query").textContent = "";
  noResults.classList.remove("hidden");
}
