# 🔤 Tamil Etymology Explorer
### தமிழ் சொல் வேர் ஆய்வு

A web application to analyze Tamil words — meanings, root words, morphological breakdown, linguistic origins, and example sentences.

---

## 📁 Project Structure

```
tamil-etymology-explorer/
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Single-page frontend
│   └── static/
│       ├── css/style.css    # Stylesheet (parchment/indigo aesthetic)
│       └── js/app.js        # Frontend logic (search, autocomplete, render)
├── data/
│   └── words.json           # 22-word Tamil etymology dataset
└── README.md
```

---

## 🚀 Running the Project

### Prerequisites
- Python 3.9+
- pip

### Step 1 — Install dependencies
```bash
cd tamil-etymology-explorer/backend
pip install -r requirements.txt
```

### Step 2 — Start the server
```bash
# From the backend/ directory:
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# OR run directly:
python main.py
```

### Step 3 — Open the app
Navigate to: **http://localhost:8000**

The frontend is served at `/` and the API is at `/api/...`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=அன்பு` | Search Tamil word (exact + fuzzy) |
| GET | `/api/search?q=love&lang=english` | English → Tamil search |
| GET | `/api/autocomplete?q=அன்` | Live autocomplete suggestions |
| GET | `/api/analyze?q=பாடல்` | Morpheme analysis of any Tamil word |
| GET | `/api/words` | List all words in the dataset |
| GET | `/api/origins?origin=Pure+Tamil` | Filter by linguistic origin |
| GET | `/docs` | Interactive API documentation (Swagger UI) |

---

## 🧠 How Morpheme Splitting Works

Tamil is an **agglutinative language** — words are formed by attaching suffixes (விகுதிகள்) to root stems. The splitter in `main.py` uses a rule-based approach:

### Algorithm
1. A dictionary of ~30 common Tamil suffixes is defined, each mapped to its grammatical role (e.g., `"அம்"` → `noun_marker`, `"அன்"` → `masculine_singular`)
2. Suffixes are sorted by length — **longest first** — to avoid partial matches
3. The input word is checked to see if it ends with any known suffix
4. If a match is found AND the remaining root is ≥ 2 characters long, the word is split: `[root, suffix]`
5. If no suffix matches, the whole word is returned as a single morpheme

### Example
| Word | Split | Explanation |
|------|-------|-------------|
| `பாடல்` | `[பாடு, அல்]` | `அல்` = verbal noun suffix |
| `நண்பன்` | `[நண்பு, அன்]` | `அன்` = masculine singular |
| `புத்தகம்` | `[புத்தக, அம்]` | `அம்` = noun marker |
| `தாய்` | `[தாய்]` | No known suffix — root itself |

### Suffix Categories Covered
- **Noun markers**: அம், கம், தை, பு, அல், வு
- **Gender/number**: அன் (masc), அள் (fem), கள் (plural)
- **Verb tenses**: கிறான், கிறது, இனான், வான்
- **Case markers**: இல் (locative), இன் (genitive), ஐ (accusative)
- **Derivational**: மை, வி (abstract nouns)

---

## ⚠️ Limitations

1. **Small dataset** — only 22 words; many searches will fall back to fuzzy matching
2. **Heuristic morphology** — the rule-based splitter does not handle sandhi (புணர்ச்சி), irregular forms, or complex agglutination chains
3. **No ML** — this is intentionally rule-based; a full morphological analyzer (like UralicNLP or specialized Tamil NLP) would be more accurate
4. **Unicode normalization** — some keyboards produce different Unicode forms for visually identical Tamil characters; this may affect exact matching
5. **Fuzzy search scope** — Levenshtein distance works on Unicode characters; results may not always be linguistically meaningful

---

## 🔮 Future Improvements

- [ ] Expand dataset to 500+ words from a Tamil lexicon
- [ ] Integrate a proper Tamil morphological analyzer (e.g., [TamilNLP](https://github.com/avineshpvs/tamil_nlp))
- [ ] Add Unicode NFC normalization for consistent matching
- [ ] Add word family grouping (show all words sharing a root)
- [ ] Implement phonetic search (Romanized Tamil / Tanglish)
- [ ] Add audio pronunciation using Web Speech API
- [ ] SQLite database backend with full-text search
- [ ] Sanscript.js integration for Grantha script rendering
- [ ] Export results as PDF / share links

---

## 🔧 Development Notes

### Adding New Words
Edit `data/words.json` — the server reads the file on startup (no restart needed in `--reload` mode).

Each entry format:
```json
{
  "word": "Tamil word in Unicode",
  "meaning_tamil": "Tamil meaning",
  "meaning_english": "English meaning",
  "root": "Root form (add Sanskrit/Arabic note if applicable)",
  "morphemes": ["part1", "part2"],
  "origin": "Pure Tamil | Sanskrit-derived | Arabic-derived | Unknown",
  "example": "Example sentence in Tamil",
  "example_english": "English translation of example"
}
```

### Fonts Used
- `Noto Serif Tamil` — main Tamil display font
- `Noto Sans Tamil` — UI elements
- `Crimson Pro` — English text (editorial serif)

All loaded from Google Fonts with `display=swap` for performance.

---

*Built as a linguistic exploration tool for Tamil learners, researchers, and enthusiasts.*
