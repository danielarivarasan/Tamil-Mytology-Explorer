/**
 * Kavi Kalanjiyam — கவி களஞ்சியம்
 * Frontend Application — v3.0
 */

const API_BASE = "";
let currentMode = "tamil";
let autocompleteTimer = null;
let selectedAutoIndex = -1;

// ── Speech ──
let synth = window.speechSynthesis;
let reciteUtterance = null;
let reciteWords = [];
let currentWordIdx = 0;
let isPaused = false;
let voicesLoaded = [];

// ── Era config ──
const ERA_CONFIG = {
  "Proto-Tamil":      { color: "#7c3aed", light: "#c4b5fd", pct: 8  },
  "Tolkappiyam Era":  { color: "#0891b2", light: "#67e8f9", pct: 22 },
  "Sangam Age":       { color: "#d97706", light: "#fcd34d", pct: 48 },
  "Medieval Period":  { color: "#16a34a", light: "#6ee7b7", pct: 72 },
  "Modern Period":    { color: "#dc2626", light: "#fca5a5", pct: 94 },
};

// ── Poem templates ──
const POEM_TEMPLATES = [
  {
    id: "t1", cls: "t1", icon: "♥", label: "Akam — Love",
    text: `நீ இல்லா இரவு நெடிதாகும்
கடல் கரையில் நிலவு தனியே நிற்கும்
உன் நினைவு மட்டும் என் மனதில்
மலராத மலராய் தங்கும்`
  },
  {
    id: "t2", cls: "t2", icon: "⚔", label: "Puram — Valour",
    text: `வீரன் மண்ணில் விழுந்தாலும்
அவன் புகழ் வானில் ஓங்கும்
தாய் நாட்டிற்காய் சிந்திய குருதி
மண்ணின் மணமாய் கமழும்`
  },
  {
    id: "t3", cls: "t3", icon: "🌿", label: "Tinai — Nature",
    text: `மழை பெய்யும் காட்டில்
மரங்கள் ஆடும் காற்றில்
மண்ணின் மணம் எழும் வேளையில்
மனமும் மலரும் தானே`
  },
  {
    id: "t4", cls: "t4", icon: "✦", label: "Thirukkural Style",
    text: `அன்பும் அறனும் உடைத்தாயின் இல்வாழ்க்கை
பண்பும் பயனும் அது`
  },
  {
    id: "t5", cls: "t5", icon: "∿", label: "Haiku — Tamil",
    text: `கடல் அலை வரும்
மணல் மேல் எழுதுவேன்
நீ தான் அழிப்பாய்`
  },
  {
    id: "t6", cls: "t6", icon: "☀", label: "Devotional — Bhakti",
    text: `ஒளியே ஒளியே என் ஒளியே
இருளை அகற்றும் ஞானமே
நெஞ்சில் நிறைந்த தெய்வமே
நினைவே என்றும் நீயே`
  },
];

// ══════════════════════════════════
//  INIT
// ══════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  loadDBCount();
  loadBrowseGrid();
  setupListeners();
  initVoices();
  renderTemplateChips();

  document.getElementById("rate-range").addEventListener("input", e => {
    document.getElementById("rate-val").textContent = parseFloat(e.target.value).toFixed(2) + "×";
  });
  document.getElementById("pitch-range").addEventListener("input", e => {
    document.getElementById("pitch-val").textContent = parseFloat(e.target.value).toFixed(2) + "×";
  });
});

async function loadDBCount() {
  try {
    const res = await fetch(`${API_BASE}/api/words`);
    const data = await res.json();
    document.getElementById("db-count").textContent = `${data.total} words`;
    document.getElementById("browse-count").textContent = data.total;
  } catch(e) {}
}

// ══════════════════════════════════
//  POEM TEMPLATES
// ══════════════════════════════════
function renderTemplateChips() {
  const grid = document.getElementById("templates-grid");
  grid.innerHTML = POEM_TEMPLATES.map(t =>
    `<button class="template-chip ${t.cls}" onclick="loadTemplate('${t.id}')" title="${t.label}">
       <span>${t.icon}</span> ${t.label}
     </button>`
  ).join("");
}

function loadTemplate(id) {
  const tpl = POEM_TEMPLATES.find(t => t.id === id);
  if (!tpl) return;
  document.getElementById("poem-input").value = tpl.text;
  // open the panel if closed
  if (!poemOpen) togglePoem();
  document.getElementById("poem-input").focus();
}

// ══════════════════════════════════
//  VOICE INIT
// ══════════════════════════════════
function initVoices() {
  function populate() {
    voicesLoaded = synth.getVoices();
    const sel = document.getElementById("voice-select");
    sel.innerHTML = "";
    const tamil  = voicesLoaded.filter(v => v.lang.startsWith("ta") || v.name.toLowerCase().includes("tamil") || v.name.toLowerCase().includes("lekha"));
    const others = voicesLoaded.filter(v => !tamil.includes(v));

    if (tamil.length) {
      const grp = document.createElement("optgroup");
      grp.label = "Tamil Voices";
      sel.appendChild(grp);
      tamil.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        grp.appendChild(opt);
      });
      sel.value = tamil[0].name;
    }
    if (others.length) {
      const grp = document.createElement("optgroup");
      grp.label = "Other Voices";
      sel.appendChild(grp);
      others.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        grp.appendChild(opt);
      });
    }
    if (!sel.options.length) {
      const opt = document.createElement("option");
      opt.textContent = "Default system voice";
      sel.appendChild(opt);
    }
  }
  if (synth.getVoices().length) populate();
  synth.addEventListener("voiceschanged", populate);
}

// ══════════════════════════════════
//  POEM PANEL
// ══════════════════════════════════
let poemOpen = false;
function togglePoem() {
  poemOpen = !poemOpen;
  document.getElementById("poem-body").classList.toggle("hidden", !poemOpen);
  document.getElementById("poem-toggle-btn").classList.toggle("open", poemOpen);
}

function recitePoem() {
  const text = document.getElementById("poem-input").value.trim();
  if (!text) { document.getElementById("poem-input").focus(); return; }
  stopRecite();
  reciteWords = text.split(/\s+/).filter(Boolean);
  currentWordIdx = 0;
  isPaused = false;
  renderHighlight();
  reciteUtterance = new SpeechSynthesisUtterance(text);
  const selName = document.getElementById("voice-select").value;
  const chosen  = voicesLoaded.find(v => v.name === selName);
  if (chosen) reciteUtterance.voice = chosen;
  reciteUtterance.rate   = parseFloat(document.getElementById("rate-range").value);
  reciteUtterance.pitch  = parseFloat(document.getElementById("pitch-range").value);
  reciteUtterance.volume = 1;
  reciteUtterance.addEventListener("boundary", e => {
    if (e.name !== "word") return;
    const spoken = text.slice(0, e.charIndex + e.charLength);
    currentWordIdx = spoken.trim().split(/\s+/).length - 1;
    renderHighlight();
  });
  reciteUtterance.addEventListener("end",   () => { currentWordIdx = reciteWords.length; renderHighlight(); setTimeout(resetReciteUI, 900); });
  reciteUtterance.addEventListener("error", () => resetReciteUI());
  document.getElementById("recite-btn").disabled = true;
  document.getElementById("pause-btn").classList.remove("hidden");
  document.getElementById("stop-btn").classList.remove("hidden");
  document.getElementById("poem-highlight-box").classList.remove("hidden");
  document.body.classList.add("reciting");
  synth.speak(reciteUtterance);
}

function togglePause() {
  if (!synth.speaking) return;
  const btn = document.getElementById("pause-btn");
  if (isPaused) {
    synth.resume(); isPaused = false;
    btn.innerHTML = "<span>&#10074;&#10074;</span> Pause";
    document.body.classList.add("reciting");
  } else {
    synth.pause(); isPaused = true;
    btn.innerHTML = "<span>&#9654;</span> Resume";
    document.body.classList.remove("reciting");
  }
}

function stopRecite() {
  synth.cancel();
  reciteUtterance = null;
  isPaused = false;
  resetReciteUI();
}

function resetReciteUI() {
  document.getElementById("recite-btn").disabled = false;
  document.getElementById("pause-btn").classList.add("hidden");
  document.getElementById("stop-btn").classList.add("hidden");
  document.body.classList.remove("reciting");
  document.getElementById("pause-btn").innerHTML = "<span>&#10074;&#10074;</span> Pause";
  setTimeout(() => document.getElementById("poem-highlight-box").classList.add("hidden"), 1200);
}

function renderHighlight() {
  const box = document.getElementById("poem-highlight-text");
  box.innerHTML = reciteWords.map((w, i) => {
    if (i < currentWordIdx)  return `<span class="word-spoken">${w}</span>`;
    if (i === currentWordIdx) return `<span class="word-current">${w}</span>`;
    return `<span class="word-pending">${w}</span>`;
  }).join(" ");
  const cur = box.querySelector(".word-current");
  if (cur) cur.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ══════════════════════════════════
//  SEARCH
// ══════════════════════════════════
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === mode)
  );
  const input = document.getElementById("search-input");
  if (mode === "english") {
    input.placeholder = "Type English keyword… (e.g. love, rain, dream)";
    document.querySelectorAll(".tamil-chip").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".en-chip").forEach(el => el.classList.remove("hidden"));
  } else {
    input.placeholder = "தமிழ் சொல் தட்டச்சு செய்க…";
    document.querySelectorAll(".tamil-chip").forEach(el => el.classList.remove("hidden"));
    document.querySelectorAll(".en-chip").forEach(el => el.classList.add("hidden"));
  }
  clearSearch();
  input.focus();
}

function setupListeners() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", () => {
    const val = input.value.trim();
    toggleClear(val.length > 0);
    if (currentMode === "tamil" && val.length >= 1) {
      clearTimeout(autocompleteTimer);
      autocompleteTimer = setTimeout(() => fetchAC(val), 150);
    } else { closeAC(); }
  });
  input.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) closeAC(); });
}

function handleKeydown(e) {
  const items = document.getElementById("autocomplete-list").querySelectorAll("li");
  if (e.key === "ArrowDown") { e.preventDefault(); selectedAutoIndex = Math.min(selectedAutoIndex+1, items.length-1); highlightAC(items); }
  else if (e.key === "ArrowUp")  { e.preventDefault(); selectedAutoIndex = Math.max(selectedAutoIndex-1, -1); highlightAC(items); }
  else if (e.key === "Enter") { if (selectedAutoIndex >= 0 && items[selectedAutoIndex]) fillSearch(items[selectedAutoIndex].dataset.word); performSearch(); }
  else if (e.key === "Escape") closeAC();
}
function highlightAC(items) { items.forEach((item, i) => item.classList.toggle("highlighted", i === selectedAutoIndex)); }

async function fetchAC(q) {
  try {
    const data = await (await fetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(q)}&limit=7`)).json();
    if (!data.suggestions.length) { closeAC(); return; }
    const list = document.getElementById("autocomplete-list");
    list.innerHTML = data.suggestions.map(w => `<li data-word="${w}" onclick="fillSearch('${w}');performSearch()">${w}</li>`).join("");
    list.classList.add("open");
    selectedAutoIndex = -1;
  } catch { closeAC(); }
}

function closeAC() {
  const list = document.getElementById("autocomplete-list");
  list.classList.remove("open");
  list.innerHTML = "";
  selectedAutoIndex = -1;
}

function fillSearch(word) { document.getElementById("search-input").value = word; toggleClear(true); closeAC(); }
function clearSearch() { document.getElementById("search-input").value = ""; toggleClear(false); closeAC(); showEmpty(); }
function toggleClear(show) { document.getElementById("clear-btn").classList.toggle("visible", show); }

async function performSearch() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;
  closeAC();
  showLoading();
  try {
    const data = await (await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&lang=${currentMode}`)).json();
    renderResults(data);
  } catch { showError("Network error — is the backend running?"); }
}

// ══════════════════════════════════
//  RENDER CARDS
// ══════════════════════════════════
function renderResults(data) {
  hideAll();
  if (!data.results || !data.results.length) {
    document.getElementById("no-results-query").textContent = `"${data.query}"`;
    document.getElementById("no-results").classList.remove("hidden");
    return;
  }
  const notice = document.getElementById("match-notice");
  if (data.match_type === "fuzzy") { notice.textContent = `Exact match not found for "${data.query}" — showing closest results`; notice.classList.remove("hidden"); }
  else if (data.match_type === "english") { notice.textContent = `Showing Tamil words matching "${data.query}"`; notice.classList.remove("hidden"); }
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "";
  data.results.forEach((word, i) => grid.appendChild(buildCard(word, i)));
}

function buildCard(word, i) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.style.animationDelay = `${i * 0.06}s`;

  const originKey = getOriginKey(word.origin);
  const era       = word.era || "Sangam Age";
  const eraConf   = ERA_CONFIG[era] || ERA_CONFIG["Sangam Age"];
  const morphHtml = word.morphemes.map((m, idx) =>
    `${idx > 0 ? '<span class="m-plus">+</span>' : ''}
     <span class="m-chip">
       <span class="m-chip-num" style="background:${eraConf.color}">${idx+1}</span>${m}
     </span>`
  ).join("");

  // Example border colour matches era
  const exBorder  = eraConf.color;
  const eraPct    = eraConf.pct;

  card.innerHTML = `
    <div class="card-accent-bar" style="background:linear-gradient(90deg,${eraConf.color},${eraConf.light})"></div>
    <div class="card-top">
      <div class="card-word" style="color:${eraConf.light}">${word.word}</div>
      <div class="card-badges">
        <span class="origin-pill ${originKey}">${word.origin}</span>
        <span class="era-pill" style="background:${eraConf.color}22;color:${eraConf.light};border:1px solid ${eraConf.color}55">${era}</span>
      </div>
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
        <div class="field-value root-val" style="color:${eraConf.light}">${word.root}</div>
      </div>
      <div class="field-row">
        <div class="field-label">Morpheme Breakdown</div>
        <div class="morpheme-row">${morphHtml}</div>
      </div>
      <div class="example-block" style="border-left-color:${exBorder}">
        <div class="field-label" style="margin-bottom:6px">Example</div>
        <div class="example-ta">${word.example}</div>
        <div class="example-en">${word.example_english}</div>
      </div>
      <div class="timeline-section">
        <div class="timeline-label">Historical Timeline</div>
        <div class="timeline-track">
          <div class="timeline-fill" style="width:${eraPct}%;background:linear-gradient(90deg,${eraConf.color}44,${eraConf.color})"></div>
          <div class="timeline-dot" style="left:${eraPct}%;color:${eraConf.color};background:${eraConf.color}"></div>
        </div>
        <div class="timeline-meta">
          <span class="timeline-era-name" style="color:${eraConf.light}">${era}</span>
          <span class="timeline-year-range">${word.year_range || ""}</span>
        </div>
        ${word.era_desc ? `<div class="timeline-era-desc">${word.era_desc}</div>` : ""}
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

// ══════════════════════════════════
//  BROWSE
// ══════════════════════════════════
async function loadBrowseGrid() {
  try {
    const data = await (await fetch(`${API_BASE}/api/words`)).json();
    const eraKeys = Object.keys(ERA_CONFIG);
    document.getElementById("browse-grid").innerHTML = data.words.map(w => {
      const ec = ERA_CONFIG[w.era] || ERA_CONFIG["Sangam Age"];
      return `<button class="browse-chip" onclick="fillSearch('${w.word}');performSearch()"
        style="border-color:${ec.color}44">
        <span class="bw" style="color:${ec.light}">${w.word}</span>
        <small>${w.meaning_english.split(",")[0].trim().slice(0,18)}</small>
      </button>`;
    }).join("");
  } catch(e) {}
}

let browseOpen = false;
function toggleBrowse() {
  browseOpen = !browseOpen;
  document.getElementById("browse-grid").classList.toggle("hidden", !browseOpen);
  const btn = document.getElementById("browse-toggle");
  btn.textContent = browseOpen ? "▴" : "▾";
  btn.classList.toggle("open", browseOpen);
}

// ══════════════════════════════════
//  UI STATE
// ══════════════════════════════════
function hideAll() {
  ["empty-state","loading-state","no-results","match-notice"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
  document.getElementById("cards-grid").innerHTML = "";
}
function showEmpty()  { hideAll(); document.getElementById("empty-state").classList.remove("hidden"); }
function showLoading(){ hideAll(); document.getElementById("loading-state").classList.remove("hidden"); }
function showError(msg) {
  hideAll();
  document.getElementById("no-results-query").textContent = "";
  const nr = document.getElementById("no-results");
  nr.querySelector(".state-text").innerHTML = msg;
  nr.classList.remove("hidden");
}
