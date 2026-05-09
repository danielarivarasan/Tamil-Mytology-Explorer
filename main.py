"""
Tamil Etymology Explorer - FastAPI Backend
==========================================
Provides REST API endpoints for searching Tamil word etymology,
morpheme analysis, and meaning lookup.
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
import os
import unicodedata
from typing import List, Optional
from pydantic import BaseModel

# ─────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────
app = FastAPI(
    title="Kavi Kalanjiyam API · கவி களஞ்சியம்",
    description="Search and explore Tamil word etymologies, morphemes, and meanings.",
    version="2.0.0"
)

# Allow cross-origin requests (needed when frontend runs separately)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Data Loading
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "words.json")

def load_words() -> List[dict]:
    """Load word entries from JSON dataset."""
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)

WORDS_DB: List[dict] = load_words()


# ─────────────────────────────────────────────
# Pydantic Response Models
# ─────────────────────────────────────────────
class WordEntry(BaseModel):
    word: str
    meaning_tamil: str
    meaning_english: str
    root: str
    morphemes: List[str]
    origin: str
    example: str
    example_english: str

class SearchResult(BaseModel):
    query: str
    match_type: str          # "exact", "fuzzy", "english", or "none"
    results: List[WordEntry]

class AutocompleteResult(BaseModel):
    suggestions: List[str]


# ─────────────────────────────────────────────
# Morpheme Splitter (Rule-Based NLP)
# ─────────────────────────────────────────────
"""
MORPHEME SPLITTING LOGIC
------------------------
Tamil is an agglutinative language — words are formed by attaching
suffixes (விகுதிகள்) to roots. This splitter uses a predefined list
of common suffixes and tries to match them at the end of words.

Steps:
  1. Try to match known suffixes at the end of the input word.
  2. If a suffix is found and what remains (the root) is ≥ 2 chars, split.
  3. If no suffix matches, return the whole word as a single morpheme.

This is a heuristic approach — not 100% accurate for all words,
but works well for common patterns.
"""

# Common Tamil suffixes mapped to their grammatical role
TAMIL_SUFFIXES = {
    # Noun suffixes
    "அம்": "noun_marker",
    "கம்": "noun_marker",
    "தை":  "noun_marker",
    "ல்":  "noun_marker",
    "டல்": "noun_marker",
    "அல்": "verbal_noun",
    "வு":  "verbal_noun",
    "பு":  "noun_marker",

    # Gender/number suffixes
    "அன்": "masculine_singular",
    "அள்": "feminine_singular",
    "கள்": "plural_marker",
    "இர்": "plural_marker",

    # Verb suffixes (tense markers etc.)
    "கிறான்": "3p_masc_present",
    "கிறாள்": "3p_fem_present",
    "கிறது": "3p_neuter_present",
    "கிறேன்": "1p_present",
    "இனான்": "past_masc",
    "த்தான்": "past_masc",
    "வான்":  "future_masc",

    # Case suffixes
    "இல்":  "locative",
    "இன்":  "genitive",
    "ஐ":    "accusative",
    "உக்கு": "dative",

    # Derivational suffixes
    "மை":  "abstract_noun",
    "வி":  "abstract_noun",
    "யா":  "question_marker",
    "து":  "verbal_noun",
}

def split_morphemes(word: str) -> List[str]:
    """
    Rule-based morpheme splitter for Tamil words.

    Algorithm:
      - Sort suffixes by length (longest first) to avoid partial matches.
      - Check if the word ends with each suffix.
      - If root after removing suffix has ≥ 2 characters, split.
      - Otherwise return the full word as one morpheme.
    """
    for suffix in sorted(TAMIL_SUFFIXES.keys(), key=len, reverse=True):
        if word.endswith(suffix):
            root = word[: len(word) - len(suffix)]
            if len(root) >= 2:  # Avoid splitting into trivial single-char roots
                return [root, suffix]
    return [word]   # No suffix matched → word is its own morpheme


# ─────────────────────────────────────────────
# Fuzzy Search (Levenshtein Distance)
# ─────────────────────────────────────────────
def levenshtein(s1: str, s2: str) -> int:
    """
    Compute the Levenshtein edit distance between two strings.
    Works correctly with Unicode (Tamil) characters since Python
    treats each Tamil glyph as a single character.
    """
    m, n = len(s1), len(s2)
    # dp[i][j] = edit distance between s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,        # deletion
                dp[i][j - 1] + 1,        # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )
    return dp[m][n]


def fuzzy_search(query: str, max_distance: int = 3) -> List[dict]:
    """
    Return words whose Levenshtein distance from the query is ≤ max_distance.
    Results are sorted by edit distance (closest first).
    """
    scored = []
    for entry in WORDS_DB:
        dist = levenshtein(query, entry["word"])
        if dist <= max_distance:
            scored.append((dist, entry))
    scored.sort(key=lambda x: x[0])
    return [e for _, e in scored]


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────

@app.get("/api/search", response_model=SearchResult, summary="Search Tamil word")
def search_word(
    q: str = Query(..., description="Tamil word or English keyword to search"),
    lang: str = Query("tamil", description="Search language: 'tamil' or 'english'")
):
    """
    Search for a Tamil word by Tamil input or English meaning.

    - **Exact match**: Returns the word if found directly.
    - **Fuzzy match**: Returns close matches if exact not found (Tamil only).
    - **English search**: Searches meaning_english field (when lang=english).
    """
    q = q.strip()

    if lang == "english":
        # ── English meaning search ──
        q_lower = q.lower()
        matches = [
            w for w in WORDS_DB
            if q_lower in w["meaning_english"].lower()
        ]
        if matches:
            return SearchResult(query=q, match_type="english", results=matches)
        return SearchResult(query=q, match_type="none", results=[])

    # ── Tamil word search ──
    # 1. Exact match
    exact = [w for w in WORDS_DB if w["word"] == q]
    if exact:
        return SearchResult(query=q, match_type="exact", results=exact)

    # 2. Fuzzy match (Levenshtein ≤ 3)
    fuzzy = fuzzy_search(q, max_distance=3)
    if fuzzy:
        return SearchResult(query=q, match_type="fuzzy", results=fuzzy[:5])

    # 3. Also try morpheme-based: strip possible suffix and search root
    derived_morphemes = split_morphemes(q)
    if len(derived_morphemes) > 1:
        root_query = derived_morphemes[0]
        root_matches = [w for w in WORDS_DB if w["root"].startswith(root_query)]
        if root_matches:
            return SearchResult(query=q, match_type="fuzzy", results=root_matches[:5])

    return SearchResult(query=q, match_type="none", results=[])


@app.get("/api/autocomplete", response_model=AutocompleteResult, summary="Autocomplete Tamil words")
def autocomplete(
    q: str = Query(..., description="Partial Tamil word prefix"),
    limit: int = Query(7, description="Maximum number of suggestions")
):
    """
    Return word suggestions that start with the given prefix.
    Used for live autocomplete in the frontend.
    """
    q = q.strip()
    if not q:
        return AutocompleteResult(suggestions=[])

    suggestions = [
        w["word"] for w in WORDS_DB
        if w["word"].startswith(q)
    ][:limit]

    return AutocompleteResult(suggestions=suggestions)


@app.get("/api/analyze", summary="Analyze morphemes of any Tamil word")
def analyze_word(
    q: str = Query(..., description="Tamil word to morphologically analyze")
):
    """
    Perform rule-based morpheme analysis on ANY Tamil word,
    even if it's not in the database.
    """
    q = q.strip()
    morphemes = split_morphemes(q)

    # Annotate each morpheme with its grammatical role if known
    annotated = []
    for m in morphemes:
        role = TAMIL_SUFFIXES.get(m, "root/stem")
        annotated.append({"morpheme": m, "role": role})

    return {
        "word": q,
        "morphemes": morphemes,
        "annotated": annotated,
        "note": "Analysis is rule-based and may not be 100% accurate for complex or rare words."
    }


@app.get("/api/words", summary="List all words in database")
def list_all_words():
    """Return all word entries in the database."""
    return {"total": len(WORDS_DB), "words": WORDS_DB}


@app.get("/api/origins", summary="Get words by origin")
def words_by_origin(origin: str = Query(..., description="Origin type: 'Pure Tamil', 'Sanskrit-derived', etc.")):
    """Filter words by their linguistic origin."""
    matches = [w for w in WORDS_DB if origin.lower() in w["origin"].lower()]
    return {"origin": origin, "count": len(matches), "words": matches}


# ─────────────────────────────────────────────
# Serve Frontend
# ─────────────────────────────────────────────
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─────────────────────────────────────────────
# Entry point for direct execution
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
