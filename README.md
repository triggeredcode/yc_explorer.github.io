# YC W26 Explorer

Interactive exploration tool for the Y Combinator Winter 2026 batch — 1000+ startups visualized on a force-directed graph with AI-powered gap analysis.

**No backend. No build step. Just open `index.html`.**

## Features

- **Force-Directed Graph** — Visual exploration organized by industry, sub-industry, and similarity-based clusters with convex hulls and progressive icon loading
- **Analytics Dashboard** — D3 visualizations: industry heatmap, team size distribution, hiring trends, tag analysis, geographic breakdown, similarity clusters
- **Multiple Views** — Graph, Table (sortable/paginated), Cards (infinite scroll), Analytics
- **Smart Search** — Weighted multi-field search with relevance scoring across name, tags, description
- **Filtering** — Filter by starred, unvisited, hiring, has-notes, industry, sub-industry
- **Insights Tab** — Batch analytics: industry saturation, niche sub-industries, rare tags, hiring hotspots
- **AI Co-Researcher** — BYO API key (OpenAI or Gemini) for gap analysis, thesis building, idea roasting
- **Compare Mode** — Side-by-side comparison of up to 3 companies
- **Find Similar** — Semantic similarity (pre-computed) with Jaccard fallback
- **Export System** — JSON, CSV, Markdown with per-field selection
- **Research Notes** — Personal annotations persisted in localStorage
- **URL State Sharing** — Share filtered views via URL hash parameters
- **Keyboard Shortcuts** — Full keyboard navigation for power users

## Getting Started

```
git clone https://github.com/triggeredcode/yc-explorer.git
cd yc-explorer
open index.html
```

No `npm install`. No build. The app loads `data/companies.js` and `data/similarity_data.js` (pre-computed similarity matrix and clusters) and stores all user state (starred, visited, notes, API keys) in browser localStorage.

## AI Chat Setup

1. Click **AI Chat** in the top bar
2. Enter your API key (OpenAI or Google Gemini)
3. Use pre-built prompts or ask anything:
   - **Find the gap** — What ideas are missing from this batch?
   - **Roast my idea** — Compare your concept against 1000 companies
   - **Build a thesis** — Strongest themes and contrarian bets
   - **Who should I talk to?** — Find relevant companies for your project
   - **What's missing near this?** — Gap analysis around the selected company

Your API key never leaves your browser except to call the provider you chose. No proxy, no middleman.

## Project Structure

```
yc-explorer/
├── index.html              # HTML shell with all UI structure
├── css/
│   └── styles.css          # All styles (graph, sidebar, cards, analytics, chat)
├── js/
│   ├── state.js            # Global state variables and constants
│   ├── data.js             # Data loading and transformation
│   ├── similarity.js       # Pre-computed similarity data access
│   ├── filters.js          # Search scoring, filtering, drill-down
│   ├── graph.js            # D3 force graph with hierarchical clusters
│   ├── sidebar.js          # Tree view, list view, tab switching
│   ├── cards.js            # Mini/expanded cards, navigator bar
│   ├── similar.js          # Similarity engine (semantic + Jaccard fallback)
│   ├── compare.js          # Compare mode and overlay table
│   ├── insights.js         # Batch analytics and niche discovery
│   ├── analytics-engine.js # Query resolver with cached computations
│   ├── analytics-charts.js # D3 chart visualizations for analytics view
│   ├── export.js           # Field picker, JSON/CSV/Markdown export
│   ├── ai-chat.js          # AI chat with OpenAI and Gemini streaming
│   ├── views.js            # Table, Cards, Analytics view controllers
│   ├── sharing.js          # URL hash state encoding/decoding
│   └── app.js              # Event wiring and initialization
├── data/
│   ├── companies.js        # Company data (YC_COMPANIES_DATA array)
│   └── similarity_data.js  # Pre-computed similarity matrix & clusters
├── .gitignore
├── LICENSE
└── README.md
```

## Deploy

### GitHub Pages

1. Push to GitHub
2. Settings → Pages → Source: main branch, root directory
3. Live at `https://triggeredcode.github.io/yc-explorer/`

### Other Hosting

Works on any static host (Netlify, Vercel, Cloudflare Pages, S3). Just serve the files — no server-side processing needed.

## Tech Stack

- **D3.js** — Force-directed graph and analytics charts
- **Tailwind CSS** — Styling (CDN)
- **Font Awesome** — Icons (CDN)
- **Vanilla JS** — No framework, no bundler

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `J` | Next company |
| `←` / `K` | Previous company |
| `S` | Star / unstar |
| `E` | Expand / collapse card |
| `Esc` | Close panels |
| `/` | Focus search |
| `1` | Graph view |
| `2` | Table view |
| `3` | Analytics view |
| `4` | Cards view |

## Privacy

- All data stays in your browser
- API keys stored in localStorage only
- No analytics, no tracking, no server

## Author

Built by [@triggeredcode](https://github.com/triggeredcode)

## License

MIT
