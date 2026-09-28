# 🧠 Codebase Intelligence Engine

### AI Code & SQL Lineage Engine: ask your codebase anything, get grounded answers with sources.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-DC244C)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-S3%20%2B%20CloudFront-FF9900?logo=amazonaws&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7)

An **AST-aware RAG system** that combines hybrid retrieval with **deterministic program analysis**. It answers semantic questions with retrieval and LLMs, and answers structural questions ("who calls this?", "what breaks if I change this table?") by traversing a real call and lineage graph, so there is nothing to hallucinate.

**🔗 Live Demo**

| | Link |
|---|---|
| 🌐 Frontend | https://d244q4kb3edykh.cloudfront.net/ |
| ⚡ Backend API | https://codebase-intelligence-engine-advanced.onrender.com/ |
| 📖 API Docs (Swagger) | https://codebase-intelligence-engine-advanced.onrender.com/docs |

> The backend runs on a free tier, so the first request after idle time may take a few seconds to wake up.

---

## 📑 Table of Contents

- [Why this exists](#-why-this-exists)
- [Key features](#-key-features)
- [How it works](#-how-it-works)
- [Benchmarks](#-benchmarks)
- [Tech stack](#-tech-stack)
- [Quick start](#-quick-start)
- [API reference](#-api-reference)
- [Deployment](#-deployment)
- [Project structure](#-project-structure)
- [Limitations & roadmap](#-limitations--roadmap)
- [Author](#-author)

---

## 💡 Why this exists

Most "chat with your code" tools treat source code as plain text. That breaks in predictable ways:

| Problem with naive RAG | What this project does |
|---|---|
| Fixed-size chunks cut functions in half | **AST-aware chunking** at function, class and method boundaries |
| Vector search misses exact identifiers like `authenticate_user` | **Hybrid retrieval**: vectors plus BM25 lexical search |
| Caller-callee relationships are lost | **Deterministic call graph** stored in PostgreSQL |
| LLMs invent execution flows | **Graph traversal** answers structural questions directly |
| Config files pollute the results | **Heuristic filtering** prioritizes real application logic |
| Data teams can't trace SQL dependencies | **SQL/dbt lineage parser** with impact analysis |

---

## ✨ Key Features

- 🌳 **AST-aware parsing** with Tree-sitter for Python, JavaScript, TypeScript and Go
- 🔎 **Hybrid retrieval**: Qdrant semantic search plus BM25, fused with **Reciprocal Rank Fusion**
- 🎯 **Cross-encoder reranking** and heuristic quality filtering
- 🧭 **Intent-based routing**: `explain`, `search`, `find_usage`, `impact_analysis`, `flow`
- 🕸️ **Deterministic call graph** in PostgreSQL, traversed with NetworkX
- 🗄️ **SQL / dbt lineage**: table-level lineage and impact analysis across models
- 🌊 **Streaming answers** over Server-Sent Events (SSE)
- ⚡ **LRU caching** on embedding and vector-search calls
- 📊 **Built-in evaluation suite** (retrieval metrics, Ragas, latency and lineage benchmarks)
- ☁️ **Production deployment**: private S3 origin behind CloudFront (OAC) plus FastAPI on Render

---

## 🔄 How it works

### Indexing

```
Repository → AST parsing (functions / classes / methods / line ranges)
          → Structural chunking
          → Embeddings → Qdrant (vectors)
          → Caller-callee edges → PostgreSQL (call graph)
```

Each chunk keeps its **file path, symbol name, start and end line, source, docstring and structural metadata**, which is what powers exact citations in answers.

### Querying

Every question is first classified by intent, then routed to the right engine:

| Intent | Example | Engine |
|---|---|---|
| `search` | "Where is `/api/login` handled?" | Hybrid retrieval (lexical-friendly) |
| `explain` | "Explain the core backend logic" | Hybrid retrieval + rerank + LLM |
| `find_usage` | "Which functions call `authenticate_user()`?" | **PostgreSQL call graph** (no vector search) |
| `flow` | "Show the flow from API endpoint to database" | **Graph traversal** |
| `impact_analysis` | "What breaks if I change `stg_orders`?" | **Call graph + dbt lineage traversal** |

### Retrieval pipeline (search / explain)

```
Query → Semantic search (Qdrant) + BM25 → Reciprocal Rank Fusion
      → Cross-encoder reranking → Heuristic filtering
      → Context builder → LLM (SSE stream or JSON) → Answer + sources
```

**Why RRF?** BM25 scores and vector similarities live on different scales. RRF fuses by *rank* (`score = Σ 1 / (k + rank)`), so no score normalization is needed.

**Why heuristic filtering?** Application code (`*.py`, `*.go`, `*.ts`) is boosted and noise like `package-lock.json`, other `*.json` files and `tailwind.config.*` is down-weighted, which keeps config files from crowding out real logic.

---

## 📊 Benchmarks

All benchmark scripts live in [`eval/`](./eval).

### Retrieval and answer quality

| Metric | Score | What it measures |
|---|---|---|
| **File Hit Rate @3** | **92%** | Correct source file appears in the top 3 Qdrant vector results |
| **Faithfulness** (Ragas) | **0.91** | Answer claims are grounded in the retrieved context |
| **Answer Relevancy** (Ragas) | **0.88** | Answer directly addresses the question |
| **Context Precision** (Ragas) | **0.87** | Most relevant chunks are ranked highest |

Scripts: `eval/evaluate_rag.py`, `eval/evaluate_ragas.py`, `eval/benchmark_reranker.py`

### SQL parsing and lineage

| Metric | Result |
|---|---|
| Models parsed | 5 dbt models |
| Parse success rate | **100%** |
| Mean parse time | **2.9 ms / model** |
| Table-level lineage | **Precision 1.00 · Recall 1.00 · 0 spurious edges** |
| Column-level lineage | Precision 1.00 · Recall 0.33 · 0 spurious edges |

Scripts: `eval/benchmark_sql_parsing.py`, `eval/benchmark_lineage_table.py`, `eval/benchmark_lineage_column.py`

### Latency: LRU cache

An in-memory LRU cache sits on the two slowest calls, the **Gemini embedding API** and the **Qdrant vector search**. Benchmarked on a 100-query set (50% cache hit rate, because the set includes repeated queries):

| Metric | No cache | Cached | Speedup |
|---|---|---|---|
| Mean | 516.2 ms | 187.8 ms | **2.75×** |
| p50 | 467.7 ms | 169.5 ms | **2.76×** |
| **p95** | **808.7 ms** | **291.6 ms** | **2.77×** |
| p99 | 1167.9 ms | 457.9 ms | **2.55×** |

Script: `eval/benchmark_cache.py`. The gain comes from skipping two network round-trips on repeated queries, so real-world speedup depends on how often queries repeat.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn, Pydantic, Psycopg2 |
| **Code analysis** | Tree-sitter, NetworkX |
| **Retrieval** | Qdrant, BM25, Reciprocal Rank Fusion, cross-encoder reranking |
| **LLM / embeddings** | Gemini (embeddings), Groq / Gemini (generation) via OpenAI-compatible client |
| **Frontend** | React, Vite, Tailwind CSS |
| **Databases** | PostgreSQL (Neon), Qdrant Cloud |
| **Infra** | AWS S3, CloudFront (Origin Access Control), Render |

---

## 🚀 Quick Start

### Prerequisites

Python 3.10+, Node.js and npm, PostgreSQL, a Qdrant instance (cloud or local), and an LLM API key.

### 1. Clone and configure

```bash
git clone https://github.com/AkshayGupta3106/Codebase-Intelligence-Engine-Advanced-RAG-System-.git
cd Codebase-Intelligence-Engine-Advanced-RAG-System-
```

Create a `.env` file (never commit it):

```env
POSTGRES_DSN=postgresql://postgres:password@localhost:5432/ragdb

QDRANT_URL=https://your-qdrant-instance
QDRANT_API_KEY=your-qdrant-api-key

GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile

GEMINI_API_KEY=your-gemini-api-key
```

### 2. Run the backend

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000` · Swagger: `http://localhost:8000/docs`

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Index a repository

```bash
# Local codebase
python scripts/ingest_repo_local.py <path_to_repo>

# Or any public GitHub repo (try a dbt project for SQL lineage)
curl -X POST http://localhost:8000/api/index_repo \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/dbt-labs/jaffle_shop"}'
```

Then ask questions such as:

- *"Which functions call `authenticate_user()`?"*
- *"What breaks if I modify `stg_orders`?"*
- *"Explain the core backend logic, ignoring config files."*

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/query` | `POST` | Standard RAG query: returns the full answer, sources and call graph |
| `/api/query/stream` | `POST` | **SSE streaming** endpoint (`text/event-stream`) that yields tokens in real time |
| `/api/index_repo` | `POST` | Clones and indexes a public GitHub repository |
| `/api/ingest` | `POST` | Uploads and indexes a local source file (`.py`, `.js`, `.ts`, `.sql`, etc.) |
| `/api/search` | `GET` | Vector search debugger |
| `/api/health` | `GET` | Health check for PostgreSQL, Qdrant and the LLM |

---

## ☁️ Deployment

| Component | Where | Notes |
|---|---|---|
| Frontend | **Amazon S3 + CloudFront** | Vite build (`dist/`), S3 bucket stays **private**, CloudFront reads it via **Origin Access Control** |
| Backend | **Render** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; secrets are Render environment variables |
| Relational DB | **Neon PostgreSQL** | Call graph and relational data |
| Vector DB | **Qdrant Cloud** | Code chunk embeddings |

Secrets are never committed. Add `.env`, `.venv/` and `__pycache__/` to `.gitignore`.

---

## 📁 Project Structure

```
Codebase-Intelligence-Engine/
├── app/                  # FastAPI backend (routing, retrieval, graph, LLM layer)
│   └── main.py
├── frontend/             # React + Vite + Tailwind UI
├── eval/                 # Benchmarks and evaluation scripts
│   ├── evaluate_rag.py
│   ├── evaluate_ragas.py
│   ├── benchmark_reranker.py
│   ├── benchmark_cache.py
│   ├── benchmark_sql_parsing.py
│   └── benchmark_report.md
├── scripts/              # Ingestion helpers (ingest_repo_local.py)
├── data/
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🧭 Limitations & Roadmap

Being upfront about what this does and doesn't do yet:

- **Static analysis limits.** The call graph can't resolve dynamic dispatch, callbacks or reflection.
- **Column-level lineage has low recall (0.33).** It's precise but incomplete. Next up: `SELECT *` expansion and CTE alias tracking.
- **Small benchmark sets.** The SQL benchmarks cover 5 models, so broader dialect coverage is planned.
- **In-memory cache.** It is per-process. Planned: Redis with TTL and index-version keys.

**Roadmap**

- [ ] Ablation study: vector only vs hybrid vs hybrid + rerank
- [ ] Larger golden dataset for retrieval evaluation
- [ ] Column-level lineage improvements
- [ ] Incremental re-indexing on file changes
- [ ] Authentication and rate limiting on public endpoints
- [ ] Code-specific embedding model comparison

---

## 👤 Author

**Akshay Gupta**
[GitHub](https://github.com/AkshayGupta3106)

⭐ If you find this project useful, consider giving it a star.
⭐ If you find this project useful, consider giving it a star.
