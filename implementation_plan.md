# Implementation Plan: Codebase Intelligence Engine → SQL Pipeline Intelligence Engine

Eight phases, in dependency order — each one only makes sense once the phase before it works. "Done when" is the checkpoint that tells you it's safe to move on, not a nice-to-have.

## Phase 0 — Fork, don't rebuild from scratch

Fork the existing repo into a new one rather than starting empty. Roughly 40% of it is domain-agnostic and directly reusable: `vector_store.py`, `embeddings.py`, the RRF fusion logic in `hybrid_search.py`, the BFS traversal pattern in `call_graph_query.py`, the FastAPI app skeleton, the eval harness shape (`evaluate_rag.py`, `evaluate_ragas.py`), and the Render/Neon/Qdrant deployment wiring.

Strip out and plan to rewrite: `ast_chunking.py`, `call_graph.py`, `call_graph_store.py`'s schema, and the `tree-sitter-*` dependencies. Add `sqlglot`, `Jinja2`, and `sentence-transformers` to `requirements.txt` now, before writing any code that needs them.

Pick a first test fixture immediately — a public dbt project like `jaffle_shop` — and clone it locally. Every phase below should be validated against it as you go, not just at the end.

## Phase 1 — Parsing + macro expansion (blocking foundation)

Build `app/services/sql_parsing.py` to replace `ast_chunking.py`'s role. Two steps, in order: first, walk the repo's `macros/` directory and collect every `{% macro %}` definition into a Jinja `Environment`. Second, render each `.sql` model through that environment with stub `ref()`/`source()` functions (have them return placeholder table names, and record what they were called with — that's your table-level lineage signal for free) before handing the rendered SQL to `sqlglot.parse_one()`.

This has to happen in that order — sqlglot cannot parse unrendered Jinja, and the `ref()`/`source()` calls only exist as literal function calls while you control the Jinja context, not after.

**Done when:** running this against `jaffle_shop` successfully parses a high percentage of models and you have a parse-success-rate number, even a rough one.

## Phase 2 — Lineage extraction (the actual differentiator)

Table-level lineage comes almost free from Phase 1 — the arguments passed to your stub `ref()`/`source()` functions during rendering are the edges. For non-dbt SQL, fall back to sqlglot AST analysis of `FROM`/`JOIN` clauses.

Column-level lineage is the hard part: run `sqlglot.lineage.lineage()` on each output column of each model's compiled SQL and walk the returned node tree back to source `(model, column)` pairs. Don't hand-roll this — the library does the join/CTE/aggregation tracing for you.

Storage needs a new schema, not a copy of `call_graph_store.py`'s `TEXT[]` design — build a `lineage_edges` table with `(source_model, source_column, target_model, target_column, transformation_type)`, fully qualified on both ends. Reuse `call_graph_store.py`'s connection and upsert pattern, just against this schema.

**Done when:** `lineage_edges` is populated for a full `jaffle_shop` run and a handful of edges check out against manual inspection of the SQL.

## Phase 3 — Query layer + intent routing

Port `call_graph_query.py` into `lineage_query.py`: build a networkx `DiGraph` from `lineage_edges` instead of the call graph table, and rename `get_callers`/`get_callees`/`expand_with_graph_mode` to their column-lineage equivalents — the depth-bounded BFS logic doesn't need to change, just what the nodes represent. This is adaptation, not new design.

In `query_classifier.py`, swap `flow` for `impact_analysis` in `VALID_LABELS`, and rewrite both the regex patterns and the LLM prompt for SQL-domain phrasing — "what depends on this column," "what breaks if X changes" — instead of the current code-domain wording.

**Done when:** you can ask "what depends on orders.amount" and get an answer purely from graph traversal, no vector search involved.

## Phase 4 — Retrieval + real reranking

Port `hybrid_search.py` mostly unchanged — BM25 plus semantic plus RRF fusion doesn't care whether the chunk text is code or SQL. The one thing to actually add here, not defer: a real cross-encoder. Wrap `sentence-transformers`' `CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')` in place of the pass-through slice that currently stands in for reranking. Small enough to run on CPU, and it's shared infrastructure — apply the same fix back to project 1 if you get the chance.

**Done when:** you can show retrieval ranking measurably changes with the reranker on vs. off — that's your reranker-uplift number.

## Phase 5 — Generation + citation grounding

Port `rag.py`'s `generate_answer`/`_generate_with_groq` pattern and rewrite the prompt for the SQL domain. The part that's new, not ported: tag every context chunk with its `(model, column)` identity before it goes into the prompt, and instruct the model to cite the specific model and column behind each claim it makes.

After generation, parse the cited `(model, column)` pairs out of the answer and check each validation against `lineage_edges`. Flag or strip citations that don't exist in the graph. This check is what makes "grounded" a true claim instead of an aspiration.

**Done when:** the citation-grounding-accuracy benchmark runs end to end and returns a real percentage.

## Phase 6 — API & schemas

Add a new Pydantic response shape for `impact_analysis` — an edge list (`model`, `column`, `depth`) alongside the LLM summary, since a flat text answer doesn't represent a blast radius well. Reuse `QueryResponse`/`RetrievedChunk` as-is for `explain`/`search`.

Add either a dedicated `/api/impact_analysis` route or a `query_type` branch in `/api/query` that calls the Phase 3 traversal directly rather than routing through vector search. Port `/api/ingest` and `/api/index_repo`, updating `SUPPORTED_REPO_EXTENSIONS` to include `.sql` (and `.yml` if you want `schema.yml`/`sources.yml` metadata), and raise the file-size cap that's currently tuned for source code, not macro-expanded SQL.

**Done when:** you can hit the deployed API and get answers for all four intents end to end.

## Phase 7 — Eval harness

Port `evaluate_rag.py`'s hit-rate@3 pattern with a model/column-level golden set instead of a file-level one — almost no new code. Port `evaluate_ragas.py` as-is, just point it at the new golden set. Add two new scripts: one diffing your table-level lineage against `dbt`'s own `target/manifest.json` (free ground truth, no hand-labeling), and one computing column-level lineage precision/recall against a hand-verified sample, stratified by join depth.

**Done when:** you have every number from the earlier benchmark list, not just the easy ones.

## Phase 8 — Deploy + benchmark run

Point the backend at a new Neon Postgres database and a new Qdrant collection — same connection pattern already in `vector_store.py`/`call_graph_store.py`, no new infrastructure to learn. Reuse the React/Vite frontend shell with minimal changes; a lineage-graph visualization view is a reasonable stretch goal but not blocking.

Run the full benchmark suite from Phase 7 against `jaffle_shop` or a larger public dbt project, and capture the numbers — this is what turns the project from "built it" into "built it and it works," which is the whole point.

---

## Benchmarks — Target Numbers and Methodology

These are the numbers you need to collect before the project is "done." Each one maps to a phase above. If a number is missing, the project description isn't complete.

### B1 — Parse success rate (Phase 1 output)

**Script:** `eval/benchmark_sql_parsing.py` (new)

Run the parser against every `.sql` file in `jaffle_shop`. Count how many parse without error. Report:

| Metric | Target |
|--------|--------|
| Parse success rate | ≥ 95% of models |
| Macro expansion failures | 0 for jaffle_shop (no external macros) |
| Mean parse time per model | < 50 ms |

**Why it matters:** if the parser silently skips 30% of models, every downstream number is measuring the wrong thing.

---

### B2 — Table-level lineage precision/recall (Phase 2 output)

**Ground truth:** `dbt ls --select state:modified+ --output json` or `target/manifest.json` (dbt's own compiled lineage — free, no hand-labeling).

**Script:** `eval/benchmark_lineage_table.py` (new)

Diff your extracted `lineage_edges` table-level edges against dbt's `manifest.json` node graph.

| Metric | Target |
|--------|--------|
| Table-level precision | ≥ 0.90 |
| Table-level recall | ≥ 0.90 |
| Spurious edges (false positives) | < 5% of total edges |

**Command to get ground truth:**
```bash
cd jaffle_shop
dbt compile
python eval/benchmark_lineage_table.py --manifest target/manifest.json
```

---

### B3 — Column-level lineage precision/recall (Phase 2 output)

**Ground truth:** hand-verified sample — pick 20–30 output columns from 3–5 models that involve joins, CTEs, or aggregations. Trace them manually. That's your labeled set.

**Script:** `eval/benchmark_lineage_column.py` (new)

Stratify by join depth:

| Depth | Description | Target precision |
|-------|-------------|-----------------|
| 1-hop | Direct `SELECT col FROM model` | ≥ 0.95 |
| 2-hop | Through one CTE or join | ≥ 0.85 |
| 3-hop | Through two or more CTEs/joins | ≥ 0.70 |

Overall target: **≥ 0.85 precision, ≥ 0.80 recall** across all depths.

This is the headline number for the project — the equivalent of File Hit Rate @3 from project 1.

---

### B4 — Reranker uplift (Phase 4 output)

**Script:** `eval/benchmark_reranker.py` (new, same shape as `benchmark_cache.py`)

Run the same golden query set twice — once with the cross-encoder off (RRF order only), once with it on. Measure retrieval quality at each stage.

| Metric | Without reranker | With reranker | Target uplift |
|--------|-----------------|---------------|---------------|
| Hit Rate @3 | baseline | measured | ≥ +5 pp |
| MRR | baseline | measured | ≥ +0.05 |
| Mean retrieval latency | baseline | measured | < +150 ms added |

If there's no measurable uplift, the cross-encoder model is wrong for this domain or the corpus is too small — report that honestly rather than skipping the benchmark.

---

### B5 — Citation grounding accuracy (Phase 5 output)

**Script:** `eval/benchmark_grounding.py` (new)

For a set of 30–50 test queries, run the full pipeline and capture every `(model, column)` citation the LLM produces in its answer. Check each citation against `lineage_edges`.

| Metric | Target |
|--------|--------|
| Citation existence rate | ≥ 0.85 (fraction of citations that actually exist in the graph) |
| Hallucinated model names | < 10% of citations |
| Hallucinated column names | < 15% of citations |

**Why 0.85 not 1.0:** the LLM will sometimes cite aggregated or renamed columns that aren't individually tracked in `lineage_edges`. That's expected — flag them, don't treat them as errors.

---

### B6 — End-to-end retrieval metrics (Phase 7 output, equivalent to `evaluate_rag.py`)

Port `evaluate_rag.py`'s hit-rate logic against a SQL-domain golden set. Golden set format: `(query, expected_model, expected_column)` triples — at least 50, ideally 100.

| Metric | Target |
|--------|--------|
| File (model) Hit Rate @3 | ≥ 0.88 |
| Column Hit Rate @3 | ≥ 0.75 |
| Faithfulness (RAGAS) | ≥ 0.88 |
| Answer Relevancy (RAGAS) | ≥ 0.85 |
| Context Precision (RAGAS) | ≥ 0.83 |

---

### B7 — Latency benchmarks (Phase 8 output, equivalent to `benchmark_cache.py`)

Run the same two-pass warm-cache benchmark from project 1 against the SQL query set.

**Baseline path (per query):**
```
User Query
  └── classify_query()               ← Groq/Gemini API
        └── generate_embeddings()    ← Gemini API round-trip
              └── search_similar_chunks()  ← Qdrant network call
                    └── BM25 + RRF + cross-encoder reranking
                          └── generate_answer()  ← Groq/Gemini API
```

**Cached path (warm):**
```
User Query
  └── classify_query()               ← cached
        └── _EMBED_CACHE lookup      ← ~0 ms
              └── _SEARCH_CACHE lookup  ← ~0 ms
                    └── BM25 + RRF + reranking
                          └── generate_answer()
```

| Metric | Baseline target | Cached target | Speedup target |
|--------|----------------|---------------|----------------|
| Mean latency | < 600 ms | < 220 ms | ≥ 2.5× |
| p95 latency | < 900 ms | < 350 ms | ≥ 2.5× |
| p99 latency | < 1300 ms | < 550 ms | ≥ 2.3× |
| Cache hit rate (50-query repeat set) | — | ≥ 45% | — |

---

### Summary table — all benchmarks at a glance

| # | Benchmark | Phase | Script | Headline target |
|---|-----------|-------|--------|----------------|
| B1 | Parse success rate | 1 | `benchmark_sql_parsing.py` | ≥ 95% models parse cleanly |
| B2 | Table lineage P/R | 2 | `benchmark_lineage_table.py` | ≥ 0.90 / 0.90 vs. `manifest.json` |
| B3 | Column lineage P/R | 2 | `benchmark_lineage_column.py` | ≥ 0.85 / 0.80 overall |
| B4 | Reranker uplift | 4 | `benchmark_reranker.py` | ≥ +5 pp Hit Rate @3 |
| B5 | Citation grounding | 5 | `benchmark_grounding.py` | ≥ 0.85 citation existence rate |
| B6 | End-to-end retrieval | 7 | `evaluate_rag.py` (ported) | ≥ 0.88 model Hit Rate @3 |
| B7 | Latency + cache | 8 | `benchmark_cache.py` (ported) | ≥ 2.5× speedup, p95 < 350 ms cached |

Run them in order — B1 failing means everything downstream is unreliable. B7 is last because it only means something if B6 is already at target.
