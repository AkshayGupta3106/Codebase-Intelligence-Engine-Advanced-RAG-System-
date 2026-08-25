# 🚀 Codebase Intelligence Engine

> **Advanced Retrieval-Augmented Generation system for understanding and
> querying real-world codebases.**

The **Codebase Intelligence Engine** is a production-style AI system
that transforms a raw software repository into structured, queryable
intelligence.

Instead of treating source code as ordinary text, the system understands
**functions, classes, dependencies, caller-callee relationships,
semantic meaning, and lexical matches**. It combines structural parsing,
graph reasoning, hybrid retrieval, reranking, and large language model
generation to answer questions about complex codebases.

## 🌐 Live Demo

**Frontend:**\
https://d244q4kb3edykh.cloudfront.net/

**Backend API:**\
https://codebase-intelligence-engine-advanced.onrender.com/

**API Documentation:**\
https://codebase-intelligence-engine-advanced.onrender.com/docs

------------------------------------------------------------------------

# 🧠 Problem

Traditional Retrieval-Augmented Generation systems often treat source
code as plain text.

This causes several problems:

-   Function and class boundaries can be destroyed by naive chunking.
-   Caller-callee relationships are lost.
-   Configuration files can pollute retrieval results.
-   Semantic search alone can miss exact code references.
-   Large codebases become difficult to reason about.
-   Large language models may hallucinate execution flows when the
    underlying relationships are not deterministic.

For example, questions such as:

> "What is the execution flow of this feature?"

> "Which modules depend on this function?"

> "Explain the core backend logic without considering configuration
> files."

require more than simple vector similarity.

------------------------------------------------------------------------

# 💡 Solution

The Codebase Intelligence Engine combines:

1.  **AST-aware code parsing**
2.  **Deterministic call-graph construction**
3.  **Semantic vector search**
4.  **BM25 lexical search**
5.  **Reciprocal Rank Fusion**
6.  **Cross-encoder reranking**
7.  **Heuristic quality filtering**
8.  **Large language model intent classification**
9.  **Graph-based reasoning**
10. **Large language model answer generation**

This creates a hybrid architecture that combines the strengths of both
**retrieval** and **deterministic program analysis**.

------------------------------------------------------------------------

# 🏗️ System Architecture

``` text
                         ┌──────────────────────┐
                         │       User           │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ React + Vite         │
                         │ Frontend             │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │ AWS CloudFront       │
                         │ CDN + HTTPS          │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Amazon S3            │
                         │ Static Frontend      │
                         └──────────────────────┘


                         API Requests
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Render               │
                    │ FastAPI Backend      │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
       │ Neon        │  │ Qdrant      │  │ Groq /      │
       │ PostgreSQL  │  │ Cloud       │  │ Gemini      │
       │ Call Graph  │  │ Vector DB   │  │ LLM         │
       └─────────────┘  └─────────────┘  └─────────────┘
```

------------------------------------------------------------------------

# 🔄 Codebase Indexing Pipeline

When a repository is indexed:

``` text
Raw Codebase
     │
     ▼
AST Parsing
     │
     ├── Functions
     ├── Classes
     ├── Methods
     └── Line Boundaries
     │
     ▼
Structural Chunking
     │
     ▼
Embedding Generation
     │
     ├───────────────┐
     ▼               ▼
Qdrant          PostgreSQL
Vectors         Call Graph
     │               │
     └───────┬───────┘
             ▼
       Queryable Codebase
```

## AST-Aware Parsing

The engine supports structural parsing for:

-   Python
-   JavaScript
-   TypeScript
-   Go

Instead of splitting code into arbitrary character windows, the system
attempts to preserve meaningful program structures such as functions and
classes.

Each structural chunk retains information such as:

-   File path
-   Function or class name
-   Start line
-   End line
-   Source code
-   Documentation
-   Structural metadata

------------------------------------------------------------------------

# 🕸️ Deterministic Call Graph

The system extracts caller-callee relationships and stores them in
PostgreSQL.

Example:

``` text
main()
  │
  ▼
process_request()
  │
  ├── validate_input()
  │
  └── retrieve_context()
          │
          ▼
       generate_answer()
```

This enables deterministic queries such as:

-   Which functions call this function?
-   Which modules depend on this function?
-   What is the execution flow?
-   What functions are downstream from this function?

For these queries, the system does **not rely solely on semantic
similarity**.

Instead, it directly traverses the stored graph.

------------------------------------------------------------------------

# 🔎 Hybrid Retrieval Pipeline

For semantic search and explanation queries, the system uses multiple
retrieval signals.

``` text
User Query
    │
    ▼
Intent Classification
    │
    ├── explain
    ├── search
    ├── flow
    └── find_usage
```

## Search / Explain Path

``` text
Query
  │
  ├───────────────┐
  ▼               ▼
Semantic Search   BM25
(Qdrant)          (Lexical)
  │               │
  └───────┬───────┘
          ▼
Reciprocal Rank Fusion
          │
          ▼
Cross-Encoder Reranking
          │
          ▼
Heuristic Filtering
          │
          ▼
Context Builder
          │
          ▼
Large Language Model
          │
          ▼
Final Answer
```

------------------------------------------------------------------------

# 🎯 Intent-Based Routing

The system classifies user questions into four execution paths.

### `explain`

Used for deeper explanations of code.

The system prioritizes meaningful backend and application logic while
suppressing low-value configuration files.

### `search`

Used for fast and exact code lookup.

Lexical matching is especially useful when the query contains:

-   Function names
-   Class names
-   File names
-   API routes
-   Variable names

### `find_usage`

Uses the PostgreSQL call graph directly.

Example:

> "Which functions call `authenticate_user()`?"

This avoids unnecessary vector retrieval.

### `flow`

Uses graph traversal to determine execution sequences.

Example:

> "Show me the execution flow from the API endpoint to the database."

------------------------------------------------------------------------

# 🧮 Retrieval Techniques

## Semantic Search

Code chunks are represented as vectors and stored in Qdrant.

This allows conceptually similar queries to retrieve relevant code even
when the exact words do not match.

## BM25

Lexical retrieval helps with exact identifiers and terminology.

For example:

``` text
authenticate_user
DatabaseConnection
/api/login
```

can be difficult for pure semantic retrieval but are excellent lexical
search candidates.

## Reciprocal Rank Fusion

The semantic and lexical rankings are combined using Reciprocal Rank
Fusion.

This gives the system both:

-   semantic understanding
-   exact keyword matching

## Cross-Encoder Reranking

The initial candidate set is further refined using a cross-encoder
reranker.

This improves the ordering of the most relevant code chunks before they
are passed to the language model.

## Heuristic Filtering

The engine assigns higher priority to application logic and reduces the
influence of low-value configuration files.

Examples of files that can receive lower priority include:

``` text
*.json
tailwind.config.*
package-lock.json
```

while backend logic such as:

``` text
*.py
*.go
*.ts
```

can receive higher priority.

------------------------------------------------------------------------

# 🤖 Large Language Model Layer

The system uses an external large language model provider for:

-   Intent classification
-   Context interpretation
-   Final answer generation

The architecture is designed around API-based inference so that the
backend does not need to host a large language model itself.

Environment configuration determines the active provider.

------------------------------------------------------------------------

# 🛠️ Technology Stack

## Backend

-   Python
-   FastAPI
-   Uvicorn
-   PostgreSQL
-   Qdrant
-   Tree-sitter
-   NetworkX
-   Python dotenv
-   Psycopg2
-   Google GenAI / OpenAI-compatible client

## Frontend

-   React
-   Vite
-   Tailwind CSS

## Retrieval

-   Vector search
-   BM25 lexical retrieval
-   Reciprocal Rank Fusion
-   Cross-encoder reranking
-   Heuristic reranking

## Infrastructure

-   GitHub
-   Render
-   Neon PostgreSQL
-   Qdrant Cloud
-   Amazon S3
-   Amazon CloudFront

------------------------------------------------------------------------

# ☁️ Deployment Architecture

The project was deployed using a low-cost, production-style
architecture.

## Frontend Deployment

The React application is built using Vite:

``` bash
npm run build
```

This generates:

``` text
frontend/dist/
```

The generated static files are uploaded to:

``` text
Amazon S3
```

CloudFront is then configured as the CDN in front of the S3 bucket.

The S3 bucket remains private and CloudFront accesses it using **Origin
Access Control**.

``` text
React
  ↓
Vite build
  ↓
dist/
  ↓
Amazon S3
  ↓
CloudFront
  ↓
HTTPS
```

### CloudFront Configuration

Important configuration used:

``` text
Origin:
Amazon S3

Origin Path:
/dist

Origin Access:
Origin Access Control

Default Root Object:
index.html

WAF:
Disabled
```

The CloudFront distribution provides the public frontend URL.

------------------------------------------------------------------------

# ⚡ Backend Deployment

The FastAPI backend is deployed on Render.

The application is started using:

``` bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Production environment variables are configured directly in Render
rather than committing secrets to GitHub.

The backend exposes the FastAPI API and Swagger documentation.

------------------------------------------------------------------------

# 🐘 PostgreSQL Deployment

During development, PostgreSQL runs locally:

``` text
localhost:5432
```

For production, the project uses:

``` text
Neon PostgreSQL
```

The backend receives the production database connection through:

``` env
POSTGRES_DSN=<neon-connection-string>
```

PostgreSQL is primarily used for the structured call graph and
relational application data.

------------------------------------------------------------------------

# 🔍 Qdrant Deployment

Qdrant is used as the vector database.

The production backend connects using:

``` env
QDRANT_URL=<qdrant-url>
QDRANT_API_KEY=<qdrant-api-key>
```

The vector database stores embeddings generated from code chunks.

------------------------------------------------------------------------

# 🔐 Environment Variables

Create a `.env` file locally.

Example:

``` env
POSTGRES_DSN=postgresql://postgres:password@localhost:5432/ragdb

QDRANT_URL=https://your-qdrant-instance
QDRANT_API_KEY=your-qdrant-api-key

GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile

GEMINI_API_KEY=your-gemini-api-key
```

### Security

Never commit `.env` to GitHub.

Add:

``` gitignore
.env
.venv/
__pycache__/
```

Production secrets are configured through Render environment variables.

------------------------------------------------------------------------

# 🖥️ Local Development

## Requirements

-   Python 3.10+
-   Node.js
-   npm
-   PostgreSQL
-   Qdrant account or local Qdrant instance
-   Large language model API key

## Backend

Create a virtual environment:

``` bash
python -m venv .venv
```

Activate it on Windows:

``` powershell
.venv\Scripts\activate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Start FastAPI:

``` bash
uvicorn app.main:app --reload --port 8000
```

Backend:

``` text
http://localhost:8000
```

Swagger:

``` text
http://localhost:8000/docs
```

## Frontend

``` bash
cd frontend
npm install
npm run dev
```

The Vite development server will provide the local frontend URL.

------------------------------------------------------------------------

# 📊 Evaluation

The project includes an evaluation harness under:

``` text
eval/
```

The primary retrieval metric is:

### File Hit Rate @3

This measures whether the actual source file containing the answer
appears among the top three retrieved results.

Current evaluation results:

  Metric                           Result
  ------------------- -------------------
  File Hit Rate @3                **92%**
  Faithfulness                   **0.91**
  Answer Relevancy               **0.88**
  Context Precision              **0.87**
  Latency (p95, baseline)   **~808.7 ms**
  Latency (p95, cached)     **~291.6 ms**

The evaluation uses a verified golden dataset and strict retrieval
evaluation.

------------------------------------------------------------------------

# ⚡ Cache Performance Benchmark

An in-memory LRU cache was benchmarked on top of the two hottest
paths — **Gemini embedding API** and **Qdrant vector search** — using
the full 100-query eval set.

**Benchmark method:** `eval/benchmark_cache.py` runs two passes over
100 queries. The baseline pass has no cache. The cached pass first
warms the cache, then re-times every query with the cache active.

``` text
Baseline path (per query):
  User Query
    └── generate_embeddings()   ← Gemini API round-trip
          └── search_similar_chunks()  ← Qdrant network call
                └── BM25 + RRF + heuristic reranking

Cached path (per query, warm cache):
  User Query
    └── _EMBED_CACHE lookup (sha-256 key)  ← ~0 ms
          └── _SEARCH_CACHE lookup         ← ~0 ms
                └── BM25 + RRF + heuristic reranking
```

## Results — 100 Queries

| Metric | Baseline (no cache) | Cached (warm) | Speedup |
|--------|--------------------:|---------------:|--------:|
| Mean   | 516.2 ms | 187.8 ms | **2.75×** |
| p50    | 467.7 ms | 169.5 ms | **2.76×** |
| p95    | 808.7 ms | 291.6 ms | **2.77×** |
| p99    | 1167.9 ms | 457.9 ms | **2.55×** |
| Min    | 337.3 ms | 134.8 ms | — |
| Max    | 1187.7 ms | 504.1 ms | — |

## Cache Hit Rates (Timed Pass)

| Layer | Hit Rate |
|-------|----------|
| Embedding (Gemini API) | 50.0% |
| Vector Search (Qdrant) | 50.0% |

> **50% hit rate** is achieved because the 100-query set is padded
> with repeated queries. In a live system with real repeated user
> queries the hit rate — and thus the speedup — will be higher.

## Key Takeaways

- **p95 latency drops from 808.7 ms → 291.6 ms** — a **2.77×**
  improvement — by eliminating the Gemini API and Qdrant network
  round-trips for repeated queries.
- The cache adds **zero code changes** to the core RAG pipeline;
  it is a pure monkey-patch of `generate_embeddings` and
  `search_similar_chunks`.
- The Gemini embedding call is the dominant bottleneck in the
  baseline (accounts for ~60-70% of retrieval latency). Caching it
  directly unlocks the largest speedup.
- Even at 50% hit rate the speedup is consistent across all
  percentiles, confirming the benefit is not skewed by outliers.

------------------------------------------------------------------------

# 🧪 Evaluation & Benchmarks Overview

All of the benchmark tests are located inside the `eval/` directory. Here is a breakdown of what each benchmark does and where to find them:

### Data Engineering / SQL Lineage Benchmarks
These tests evaluate how well the intelligence engine can parse raw SQL dialects and map out dependencies compared to dbt's native compiler.

#### 1. SQL Parser Performance (`eval/benchmark_sql_parsing.py`)
| Metric | Result |
|--------|--------|
| Total Models Parsed | 5 |
| Parse Success Rate | **100.0%** |
| Mean Parse Time | **2.9 ms / model** |

#### 2. Lineage Accuracy (`eval/benchmark_lineage_table.py` & `column.py`)
| Metric | Precision | Recall | Spurious (FP) |
|--------|-----------|--------|---------------|
| Table-Level Lineage | **100%** (1.000) | **100%** (1.000) | 0.0% |
| Column-Level Lineage| **100%** (1.000) | 33.3% (0.333) | 0.0% |

### RAG Retrieval & Answer Quality Benchmarks
* **`eval/benchmark_reranker.py`**: Evaluates the effectiveness of the cross-encoder heuristic reranking (making sure the most relevant code chunks appear at the top).
* **`eval/evaluate_rag.py`** & **`eval/evaluate_ragas.py`**: Evaluates the end-to-end quality of the generated AI responses (Contextual Precision, Faithfulness, etc.) against a dataset of "Golden" Q&A pairs (like `eval/goldenset.json`).

### Performance & Latency Benchmarks
* **`eval/benchmark_cache.py`**: Measures the retrieval speedup (latency) using our LRU caching layers vs a cold start.

**Results (100-Query Eval Set):**

| Metric | Baseline (no cache) | Cached (warm) | Speedup |
|--------|--------------------:|---------------:|--------:|
| Mean   | 554.81 ms | **164.18 ms** | **3.38×** |
| p50    | 527.40 ms | **159.38 ms** | **3.31×** |
| p95    | 651.17 ms | **220.03 ms** | **2.96×** |
| p99    | 729.89 ms | **236.93 ms** | **3.08×** |

> *Generated automatically via `eval/benchmark_report.md`*

------------------------------------------------------------------------

# 📁 Project Structure

``` text
Codebase-Intelligence-Engine/
│
├── app/
│   ├── ...
│   └── main.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── eval/
│   ├── evaluate_rag.py
│   ├── benchmark_cache.py
│   ├── benchmark_results.json
│   ├── benchmark_report.md
│   └── ...
│
├── data/
│   └── ...
│
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

# 🚀 Deployment Summary

The complete deployment flow was:

``` text
GitHub
   │
   ├───────────────────────────────┐
   │                               │
   ▼                               ▼
Frontend                         Backend
   │                               │
npm run build                  FastAPI
   │                               │
   ▼                               ▼
Amazon S3                      Render
   │                               │
   ▼                       ┌───────┼────────┐
CloudFront                 │       │        │
   │                       ▼       ▼        ▼
   │                     Neon   Qdrant   LLM API
   │                   PostgreSQL Cloud
   │
   ▼
Live React Application
```

------------------------------------------------------------------------

# 🎯 Key Engineering Highlights

This project demonstrates:

-   **AST-aware code intelligence**
-   **Graph-based deterministic reasoning**
-   **Hybrid semantic + lexical retrieval**
-   **Reciprocal Rank Fusion**
-   **Cross-encoder reranking**
-   **Retrieval quality filtering**
-   **Intent-aware query routing**
-   **Production API development with FastAPI**
-   **Container/cloud deployment concepts**
-   **Managed PostgreSQL**
-   **Vector database integration**
-   **AWS S3 and CloudFront deployment**
-   **Secure private S3 origin using CloudFront Origin Access Control**

------------------------------------------------------------------------

# 📌 Resume Description

> **Codebase Intelligence Engine --- Advanced Retrieval-Augmented
> Generation System**\
> Built a production-grade code intelligence platform using AST-aware
> parsing, deterministic PostgreSQL call graphs, hybrid semantic and
> BM25 retrieval, Reciprocal Rank Fusion, cross-encoder reranking, and
> intent-aware query routing. Implemented an in-memory LRU cache over
> the Gemini embedding and Qdrant search hot paths, reducing retrieval
> p95 latency from 808.7 ms to 291.6 ms (2.77× speedup) across a
> 100-query eval set. Deployed the React frontend using Amazon S3 and
> CloudFront and the FastAPI backend on Render, with Neon PostgreSQL
> and Qdrant Cloud for production data services. Achieved 92% File
> Hit Rate@3 with 0.91 faithfulness.

------------------------------------------------------------------------

# 📜 License

Add your preferred license here, for example:

``` text
MIT License
```

if you intend to release the project under the MIT License.
