# 🤖 smart-job-cli

Node.js CLI for finding jobs on LinkedIn, filtering them with simple rules, storing them in SQLite, and managing them from the terminal.

## 📌 Summary

| Capability | Description |
| --- | --- |
| Scraping | Finds jobs published in the last 24 hours on LinkedIn Jobs |
| Filtering | Uses `.env` and `JOB_SEARCH_RULES.md` for keywords, modality, locations, and language |
| Persistence | Stores results in SQLite with `link`-based deduplication |
| Prioritization | Computes persistent `score`, detects `seniority`, and penalizes `redFlags` |
| Daily workflow | `list -> open -> review -> apply / ignore` |
| Utilities | `stats`, `export`, `cleanup`, and `config` |

## ✨ Features

- LinkedIn job scraping
- SQLite persistence
- Automatic deduplication
- Persistent scoring system
- Red flag detection
- Language heuristics
- Review workflow
- CSV/JSON exports
- Configurable rules
- CLI-first workflow

## ⚙️ Stack

| Tool | Purpose |
| --- | --- |
| Node.js | Runtime |
| Playwright | LinkedIn scraping |
| SQLite (`sqlite3`) | Local database |
| Commander | CLI framework |
| Chalk | Terminal output |
| open | Open job links in the browser |

## 📁 Structure

```text
job-bot/
├── src/
│   ├── cli/commands.js
│   ├── scraper/linkedin.js
│   ├── services/jobService.js
│   ├── storage/db.js
│   └── utils/
│       ├── envConfig.js
│       ├── jobRules.js
│       ├── jobScore.js
│       ├── modality.js
│       └── normalize.js
├── data/
├── JOB_SEARCH_RULES.md
├── .env.example
├── index.js
└── README.md
```

## 🚀 Installation

```bash
npm install
npx playwright install
```

## 🎯 Customize Search

You do not need to touch `src/` to adapt the repo to a different job profile or search modality. In most cases, these are the only files you need to adjust:

| File | When to edit | What it controls |
| --- | --- | --- |
| `.env` | Whenever you change your local search setup | Default keyword, modality, limit, locations |
| `JOB_SEARCH_RULES.md` | When you change profile, market, or quality criteria | Score, positive/negative filters, red flags, language |
| `.env.example` | Only if you want to change the shared template for future clones | Default starter configuration |

### `.env` Variables

| Variable | Purpose |
| --- | --- |
| `LINKEDIN_KEYWORDS` | Default keyword |
| `LINKEDIN_KEYWORD_VARIANTS` | Search variants separated by `;` |
| `LINKEDIN_MAX_JOBS` | Per-run limit |
| `LINKEDIN_DEFAULT_MODALITY` | `remote`, `hybrid`, or `both` |
| `LINKEDIN_TARGET_LOCATIONS` | Target regions |
| `LINKEDIN_COLOMBIA_CITIES` | Specific cities |
| `LINKEDIN_REQUIRED_SPANISH_LOCATIONS` | Locations where Spanish is required |
| `LINKEDIN_PREFERRED_SPANISH_LOCATIONS` | Locations where Spanish is preferred |
| `LINKEDIN_STRICT_ENGLISH_REJECTION_LOCATIONS` | Locations with stricter English rejection |
| `LINKEDIN_ALLOW_MIXED_LANGUAGE_LOCATIONS` | Locations where mixed-language listings are allowed |

Typical changes:

- Change the profile: update `LINKEDIN_KEYWORDS` and `LINKEDIN_KEYWORD_VARIANTS`
- Change the modality: update `LINKEDIN_DEFAULT_MODALITY` to `remote`, `hybrid`, or `both`
- Change target countries or cities: update `LINKEDIN_TARGET_LOCATIONS` and `LINKEDIN_COLOMBIA_CITIES`
- Change the number of jobs per run: update `LINKEDIN_MAX_JOBS`

### `JOB_SEARCH_RULES.md` Lists

| Key | Purpose |
| --- | --- |
| `search_keyword_variants` | Additional search variants |
| `target_locations` | Base regions |
| `colombia_cities` | Specific cities |
| `positive_keywords` | Terms that increase score |
| `negative_keywords` | Terms that reject or penalize jobs |
| `red_flag_keywords` | Warning phrases that reduce score |
| `required_spanish_locations` | Reject clearly English listings |
| `preferred_spanish_locations` | Prioritize Spanish listings |
| `strict_english_rejection_locations` | Harden English rejection |
| `allow_mixed_language_locations` | Allow mixed-language listings |
| `english_required_phrases` | Detect required English |
| `english_preferred_phrases` | Detect English as a plus |
| `spanish_markers` | Improve Spanish heuristics |
| `english_markers` | Improve English heuristics |

Practical rule:

- `.env` controls default CLI behavior.
- `JOB_SEARCH_RULES.md` controls filtering quality and scoring quality.

## 💻 Basic Usage

| Goal | Command |
| --- | --- |
| Fetch with default configuration | `node index.js fetch` |
| Fetch remote jobs only | `node index.js fetch --remote` |
| Fetch with a specific keyword | `node index.js fetch --keyword="backend developer junior nodejs"` |
| Fetch by modality | `node index.js fetch --keyword="backend developer" --modality=hybrid` |
| Fetch by location | `node index.js fetch --keyword="backend developer nodejs" --location="Colombia" --remote` |
| List new jobs | `node index.js list` |
| List reviewing jobs | `node index.js list --status=reviewing` |
| Open a job | `node index.js open 15` |
| Mark for review | `node index.js review 15` |
| Mark as applied | `node index.js apply 15` |
| Mark as ignored | `node index.js ignore 15` |
| Show stats | `node index.js stats` |
| Export to CSV | `node index.js export --format=csv` |
| Export to JSON | `node index.js export --format=json` |
| Clean old jobs | `node index.js cleanup` |
| Show config | `node index.js config` |
| Change default modality | `node index.js config set modality remote` |

## 🧩 Commands

| Command | Description | Notes |
| --- | --- | --- |
| `fetch` | Scrapes LinkedIn and stores jobs | If LinkedIn does not expose visible cards, it exits cleanly |
| `list` | Lists jobs by status and modality | Sorted by `score` |
| `open <id>` | Opens the job link in the browser | Validates that the ID exists |
| `review <id>` | Changes status to `reviewing` | Intermediate step before applying |
| `apply <id>` | Changes status to `applied` | |
| `ignore <id>` | Changes status to `ignored` | |
| `stats` | Shows totals, top companies, top locations, and modalities | |
| `export --format=csv|json` | Exports results from SQLite | Creates `exports/` if needed |
| `cleanup` | Removes old, invalid, and extreme duplicate records | Uses `COALESCE(lastSeenAt, createdAt)` |
| `config` | Shows resolved configuration | |
| `config set <key> <value>` | Updates `.env` | Supports `keyword`, `max-jobs`, `modality`, `db-path` |

## 🗄️ Database

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `title` | Job title |
| `company` | Company |
| `link` | Unique job URL |
| `location` | Detected location |
| `modality` | `remote`, `hybrid`, `onsite`, `unknown` |
| `language` | `spanish`, `english`, `mixed`, `unknown` |
| `languageConfidence` | Confidence for language analysis |
| `englishRequirement` | `required`, `preferred`, `none`, `unknown` |
| `languageEvidence` | Short evidence from language analysis |
| `score` | Persistent priority score |
| `lastSeenAt` | Last time the job reappeared |
| `source` | Origin platform, currently `linkedin` |
| `seniority` | Detected seniority |
| `redFlags` | Detected warning phrases |
| `status` | `new`, `reviewing`, `applied`, `ignored` |
| `createdAt` | Initial insert timestamp |

Notes:

- `link` is unique and prevents duplicates.
- If a job reappears, `lastSeenAt` is updated.
- The schema is already prepared for future platforms without breaking LinkedIn.

## 🔄 Configuration Resolution

| Topic | Priority order |
| --- | --- |
| Keyword in `fetch` | `--keyword` -> `LINKEDIN_KEYWORD_VARIANTS` -> `LINKEDIN_KEYWORDS` -> `nodejs` |
| Locations in `fetch` | `--location` -> `LINKEDIN_TARGET_LOCATIONS` + `LINKEDIN_COLOMBIA_CITIES` -> `target_locations` + `colombia_cities` |
| Required Spanish | `LINKEDIN_REQUIRED_SPANISH_LOCATIONS` -> `required_spanish_locations` |
| Preferred Spanish | `LINKEDIN_PREFERRED_SPANISH_LOCATIONS` -> `preferred_spanish_locations` |
| Strict English rejection | `LINKEDIN_STRICT_ENGLISH_REJECTION_LOCATIONS` -> `strict_english_rejection_locations` |
| Mixed language allowed | `LINKEDIN_ALLOW_MIXED_LANGUAGE_LOCATIONS` -> `allow_mixed_language_locations` |

## ⚠️ Important Notes

- LinkedIn changes its HTML frequently; if scraping breaks, inspect `src/scraper/linkedin.js` first.
- The browser runs in visible mode (`headless: false`) to simplify debugging.
- The tool is designed as a search assistant, not a mass auto-apply bot.
- Language and seniority detection are heuristic, not perfect.
- Well-tuned rules in `JOB_SEARCH_RULES.md` improve result quality significantly.

## 📄 License

MIT License. See `LICENSE`.
