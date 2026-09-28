# Codebase Intelligence Engine: Interview Preparation Guide

## 1. One-minute project summary

The Codebase Intelligence Engine is a web application that lets a developer upload a source file or index a Git repository, then ask natural-language questions about the code. It is designed for questions that ordinary keyword search or a basic vector RAG system handles poorly, such as:

- What does this module or function do?
- Where is a function used?
- What is the execution flow between functions?
- Which data models or columns depend on a field?
- Where does a column come from?

The backend is a Python FastAPI service. It stores embedded text chunks in Qdrant, stores call-graph and dbt lineage relationships in PostgreSQL, and uses external or local language models to classify queries and generate answers. The retrieval path combines semantic vector search, BM25 lexical scoring, reciprocal rank fusion, optional cross-encoder reranking, and heuristic filtering. Graph and lineage questions can bypass normal semantic retrieval and use deterministic graph traversal.

The frontend is a React/Vite application. It supports repository indexing, file ingestion, normal queries, streaming queries over Server-Sent Events, source-chunk display, health status, copy-to-clipboard, and browser-local query history.

### The honest qualification

The repository contains both the intended architecture and incomplete integration paths. In particular, `app/services/ingest.py` currently has stubbed structural extraction functions, while a separate `ast_chunking.py` contains a working Tree-sitter extractor. Therefore, do not claim that the HTTP ingestion route currently performs AST-aware chunking end-to-end without qualification. The repository and README describe a production-style design, but several operational guarantees are not implemented in the code: there is no user authentication, no tenant isolation, no background job queue, and indexing is synchronous.

## 2. Problem statement

### User problem

Large repositories are difficult to understand from plain text search. A developer needs both semantic explanations and exact structural answers. Code also has relationships that are not expressed reliably by text similarity:

- A function has a boundary and metadata.
- A caller-callee relationship is directional.
- A dbt column has upstream sources and downstream consumers.
- Identifiers such as `authenticate_user`, file names, and API paths need exact matching.

### Why basic RAG is insufficient

Naive character chunks can split functions or mix unrelated code. Pure semantic search can miss exact identifiers. An LLM can produce a plausible but incorrect flow if the flow is inferred only from retrieved prose. The project addresses these failure modes by combining retrieval with deterministic program and data-flow structures.

### Product goal

Turn a repository into queryable intelligence while returning answer context and, for graph-oriented requests, explicit relationship information that can be inspected rather than trusting an LLM alone.

## 3. Architecture at a glance

```text
Browser / React + Vite
        |
        | JSON, multipart upload, SSE over HTTP
        v
FastAPI app
  |-- /api/ingest and /api/index_repo
  |       |-- extract text / chunks
  |       |-- Gemini embeddings
  |       |-- Qdrant vectors
  |       `-- PostgreSQL call graph when available
  |
  |-- /api/search
  |       `-- embedding -> Qdrant similarity search
  |
  `-- /api/query or /api/query/stream
          |-- intent classification: Groq LLM, then rule-based fallback
          |-- graph path: PostgreSQL -> NetworkX
          |-- lineage path: PostgreSQL -> NetworkX
          `-- RAG path:
                  Qdrant semantic candidates
                    -> BM25
                    -> reciprocal rank fusion
                    -> optional cross-encoder
                    -> heuristic file/type filtering
                    -> graph expansion when appropriate
                    -> bounded context
                    -> Gemini / OpenAI / Groq / Ollama / local heuristic
```

## 4. Repository map

| Area | Important files | What they do |
|---|---|---|
| FastAPI entry point | `app/main.py` | Creates the FastAPI app, loads dotenv, configures permissive CORS, installs latency middleware, and includes routers. |
| API contract and orchestration | `app/api/routes.py` | Defines ingestion, repository indexing, search, health, normal query, and SSE query endpoints. |
| Request/response models | `app/models/schemas.py` | Defines Pydantic models for query requests, retrieved chunks, impact edges, and query responses. |
| RAG orchestration | `app/services/rag.py` | Detects file targets, retrieves context, expands with call graphs, builds context, routes graph queries, and generates answers. |
| Query intent | `app/services/query_classifier.py` | Uses Groq classification when configured and falls back to regular expressions. |
| Retrieval | `app/services/hybrid_search.py` | Implements BM25, candidate normalization, RRF, optional cross-encoder reranking, and bounded retrieval. |
| Vector persistence | `app/services/vector_store.py` | Configures Qdrant, creates the collection, upserts vectors, and searches or scrolls payloads. |
| Embeddings | `app/services/embeddings.py` | Calls Gemini `text-embedding-004` and exposes a dimension probe. |
| Call graph storage | `app/services/call_graph_store.py` | Creates and upserts PostgreSQL `call_graph` rows. |
| Call graph queries | `app/services/call_graph_query.py` | Loads graph data and traverses it with NetworkX. |
| SQL parsing | `app/services/sql_parsing.py` | Renders simple dbt/Jinja constructs and parses SQL with sqlglot. |
| Column lineage | `app/services/lineage_extractor.py`, `lineage_store.py`, `lineage_query.py` | Extracts, stores, loads, and traverses model-column edges. |
| Text fallback | `app/services/chunking.py` | Character-window chunking with configurable size and overlap. |
| Structural parser | `ast_chunking.py` | Tree-sitter extraction for Python, JavaScript, TypeScript, and Go. |
| Lineage indexing script | `scripts/ingest_dbt_lineage.py` | Parses dbt models and writes table/column lineage edges. |
| Local repository indexing | `scripts/ingest_repo_local.py` | Iterates a local repository and reuses the route's file indexing helper. |
| Frontend | `frontend/src/App.jsx`, `frontend/src/components/*` | Implements the browser workflow and renders answers and sources. |
| Evaluation | `eval/*` | Contains golden sets, retrieval, lineage, RAGAS, reranker, parsing, and cache benchmarks. |

## 5. End-to-end flow: repository indexing

### Git repository path

1. The frontend validates that the URL begins with `http://` or `https://` and POSTs `{ "repo_url": "..." }` to `/api/index_repo`.
2. The backend runs `git clone --depth 1` into a temporary directory.
3. It recursively scans files and accepts `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.go`, `.sql`, `.yml`, and `.yaml`.
4. It skips directories such as `.git`, `node_modules`, `__pycache__`, build output, virtual environments, `target`, and `dbt_packages`.
5. It caps indexing at 100 files and skips files over 200,000 characters.
6. Each file is decoded as UTF-8, with Latin-1 fallback.
7. Python files attempt `extract_python_chunks_and_graph`; other supported code files attempt `extract_code_chunks`. Because those functions are currently stubs in `app/services/ingest.py`, the route normally falls back to `chunk_text` when no chunks are returned.
8. Chunks are embedded one at a time through Gemini and stored in Qdrant with file name, chunk index, text, and optional structural metadata.
9. If a call graph was extracted, it is upserted into PostgreSQL. In the current route, the stub means this graph is usually empty unless data was populated another way.
10. A JSON state file records that a repository is indexed. The response is `{"message": "Repository indexed successfully"}` even when individual files failed because `_index_repo_file` catches file-level exceptions and returns `False`.

### Uploaded-file path

`POST /api/ingest` accepts multipart form data. It writes the upload to `data/uploads`, supports text/code formats and PDF extraction, then attempts structural extraction for Python/JavaScript/TypeScript/Go where wired. It falls back to character chunks, generates embeddings, optionally writes a call graph, upserts vectors, records the uploaded file name, and returns chunk metadata, embeddings, IDs, and counts.

The frontend currently allows `.py`, `.go`, `.js`, and `.ts` in its file picker, even though the backend extractor also supports `.txt`, `.pdf`, `.sql`, `.yml`, and `.yaml`. The UI label says SQL/dbt, but `handleFileSelection` rejects SQL and YAML extensions. This is an important implementation detail to mention if asked about product polish or integration gaps.

### Chunk storage

Qdrant collection name is `documents`. Point IDs are deterministic UUIDv5 values derived from collection, file name, and chunk index. That makes re-upserting the same file/chunk address stable, but there is no explicit deletion or version namespace for old repository contents.

## 6. End-to-end flow: query

1. The frontend first POSTs to `/api/query/stream`. If that request fails or produces no streamed answer, it falls back to `/api/query` using Axios.
2. The backend validates the non-empty query and `top_k >= 1` through both route checks and Pydantic.
3. It detects an explicit source file name in the query. If a repository is marked indexed, retrieval is global; otherwise an uploaded file can force `file_only` mode.
4. `classify_query` tries a Groq LLM with four labels: `explain`, `find_usage`, `impact_analysis`, and `search`. Network, timeout, missing-key, malformed-response, and invalid-label cases fall back to regex classification.
5. `find_usage` reads call-graph data from PostgreSQL and returns callers or callees directly when available.
6. `impact_analysis` refreshes the lineage graph from PostgreSQL and traverses upstream or downstream nodes up to depth three. It returns `impact_edges` for the UI/API response.
7. `flow` reads the call graph, finds matching seed functions, expands up to depth two, and builds a rule-based execution-flow answer.
8. Other queries use retrieval. In global mode, semantic Qdrant candidates are combined with BM25 scores, fused with RRF, optionally reranked by `cross-encoder/ms-marco-MiniLM-L-6-v2`, then heuristically scored.
9. Heuristics boost an explicitly named file, favor Python/Go and JavaScript/TypeScript source, suppress noise such as config/JSON/lock files for vague queries, and cap chunks per file.
10. Call-graph expansion can add neighboring function chunks for flow/call-related queries.
11. `build_context` formats chunks with file and line information and applies an approximate 1,200-token context budget.
12. Answer generation tries Gemini first when a Gemini key is present, then the configured OpenAI route, Groq, Ollama, and finally a local keyword-based answer. The non-streaming path has a real fallback chain; the stream path streams Gemini when possible and otherwise emits the fallback answer as one SSE token.
13. The response includes the answer, retrieved chunks, detected query type, latency in milliseconds, and optional impact edges.

## 7. API interview reference

### `GET /`

Returns a simple service message and links to `/api/health` and `/api/metrics`.

### `GET /health`

Returns `{ "status": "ok" }`. This is a shallow liveness endpoint.

### `GET /api/health`

Checks Qdrant connectivity, attempts a PostgreSQL connection, reports the configured LLM provider, and reports whether Gemini or Groq keys are present. It does not verify that an indexed collection contains usable data or that an LLM request succeeds.

### `POST /api/ingest`

Multipart upload with optional `chunk_size` (default 500) and `overlap` (default 50). Returns upload metadata, chunks, embeddings, vector IDs, and call-graph counts. Returning full embeddings and full text is convenient for debugging but would be expensive and potentially sensitive in a production API.

### `POST /api/index_repo`

JSON body: `{ "repo_url": "https://..." }`. Clones and indexes synchronously. The current endpoint does not authenticate the caller, allowlist hosts, impose a clone timeout, or isolate data by user.

### `GET /api/search`

Query parameters: `query` and `top_k`. Embeds the query and returns raw Qdrant similarity results. This endpoint is a direct vector-search diagnostic path, not the complete hybrid RAG path.

### `POST /api/query`

JSON body:

```json
{ "query": "What calls build_context?", "top_k": 5 }
```

Returns `QueryResponse`: `query`, `answer`, `retrieved_chunks`, `query_type`, `latency_ms`, and optional `impact_edges`.

### `POST /api/query/stream`

Returns `text/event-stream`. Token events look like:

```json
{ "type": "token", "data": "..." }
```

The final event contains `type: "done"`, `query_type`, and `latency_ms`; impact analysis can also attach `impact_edges`. Errors are emitted as SSE events after the stream begins.

## 8. Data stores and schemas

### Qdrant

Qdrant stores dense vectors and payloads in the `documents` collection. The payload can contain:

- `file_name`
- `chunk_index`
- `chunk_text`
- `name`
- `type`
- `start_line`
- `end_line`
- `docstring`
- `imports`

The client supports local persistent mode at `data/qdrant`, in-memory mode, and URL/API-key mode for Docker or cloud configuration. The vector distance is cosine similarity. The embedding dimension is discovered from the Gemini model rather than hard-coded.

### PostgreSQL call graph

`call_graph` has an ID, `function_name`, `file_name`, `called_functions TEXT[]`, and a unique constraint on `(file_name, function_name)`. Indexes exist on function name and file name. Upserts replace the called-function array for an existing file/function pair.

### PostgreSQL lineage

`lineage_edges` stores `source_model`, `source_column`, `target_model`, `target_column`, and `transformation_type`, with a uniqueness constraint over the four node fields and indexes on source and target. `scripts/ingest_dbt_lineage.py` adds table-level `ref` and `source` edges plus column-level edges extracted through sqlglot lineage.

### Local state

`data/context_state.json` stores only one uploaded file name and one boolean repository-indexed flag. Module globals cache that state in the running process. This is a single-user/process-local context model, not a multi-tenant session system.

## 9. Authentication and security posture

### Verified facts

- No authentication middleware, login route, user model, token validation, or authorization dependency appears in the application routes.
- CORS is configured with `allow_origins=["*"]` and credentials enabled.
- API keys are read from environment variables and are not meant to be committed.
- Repository indexing executes the local `git` binary against a caller-supplied URL.
- Uploaded files are written under `data/uploads` using the supplied filename.

### How to answer the authentication question

"Authentication is not implemented in the current repository. The API is effectively an open prototype/service endpoint, with provider secrets kept in environment variables rather than exposed to the browser. In a production version I would add identity-aware middleware, per-user authorization, tenant-scoped collections and database rows, upload and repository validation, resource quotas, clone timeouts, filename sanitization, secret redaction, and restrictive CORS."

### Main security risks to acknowledge

- Open CORS and unauthenticated indexing/query access.
- SSRF and resource-exhaustion risk from cloning arbitrary URLs.
- No explicit upload size limit in the route; only repository file character limits are visible.
- Potential path traversal or unsafe filename behavior in `data/uploads`.
- Source-code and embedding data are not tenant-isolated.
- LLM prompts include retrieved source and may expose proprietary code to external providers.
- `dangerouslySetInnerHTML` renders generated answer text in the frontend. The current code does not show sanitization, so this should be treated as a security hardening item.

## 10. Technical decisions and trade-offs

### Hybrid retrieval instead of only vector search

Dense embeddings handle meaning and paraphrases, while BM25 handles identifiers and exact code vocabulary. RRF combines rank signals without requiring the scores from the two systems to be calibrated to the same scale. The trade-off is more work and latency than a single Qdrant query, plus an in-process BM25 implementation that is less scalable than a dedicated lexical index.

### Graph traversal instead of asking the LLM to infer flow

Callers, callees, upstream lineage, and downstream impact are represented as explicit edges and traversed with NetworkX. This improves determinism and inspectability. The trade-off is that static extraction is incomplete for dynamic dispatch, reflection, aliases, unresolved imports, and cross-language semantics; graph quality is bounded by extraction quality.

### External model APIs with fallbacks

Gemini supplies embeddings and can generate answers; Groq classifies intent and can generate answers; OpenAI and Ollama are alternative generation routes; a local heuristic keeps a response path available. This reduces local infrastructure requirements and gives resilience, but introduces network latency, vendor dependency, API cost, privacy concerns, and model-version drift.

### Synchronous indexing

The implementation is easy to reason about and simple to deploy, but cloning, parsing, embedding, and writing a large repository inside an HTTP request blocks a worker and makes progress/retry behavior weak. A production design should queue indexing jobs and expose status.

### Qdrant plus PostgreSQL

Qdrant is a natural fit for vector similarity and payload retrieval. PostgreSQL is a natural fit for structured edges, uniqueness, and indexes. The trade-off is cross-store consistency: an indexing attempt can write vectors but fail before graph persistence, or leave stale vectors from previous repository versions.

### Approximate context budget

`build_context` estimates tokens as roughly characters divided by four and caps context near 1,200 estimated tokens. This is simple and provider-independent, but it is not tokenizer-accurate and can truncate important context.

## 11. Frontend flow and behavior

The frontend uses React 19, Vite, Axios, Framer Motion, and Tailwind CSS. `App.jsx` owns query, response, loading, upload, repository indexing, health, toast, modal, and history state.

- On mount, it calls `/api/health` and reads up to five query-history items from `localStorage`.
- Repository indexing sends a JSON request to `/api/index_repo` and displays status/toasts.
- File ingestion sends `FormData` to `/api/ingest`.
- Query submission attempts the SSE endpoint first, parses `data: ` events, accumulates answer tokens, and updates the UI while streaming.
- If SSE fails, it calls `/api/query` and renders the JSON response.
- `AnswerPanel` shows an intent badge, latency badge, answer text, execution-flow lines, and source cards.
- Query history is browser-local and limited to five entries; it is not stored on the backend.

The UI is intentionally IDE-like: a repository indexer and file-ingestion sidebar, a code-style query input, source references, and flow output. This is a usability choice aimed at developers exploring unfamiliar code.

## 12. Evaluation evidence and how to discuss it

The README reports benchmark results, but distinguish reported artifacts from a fresh run in the current environment.

### Evaluation mechanisms in the repository

- `eval/benchmark_sql_parsing.py` measures SQL parser success and parse time.
- `eval/benchmark_lineage_table.py` compares predicted table edges with dbt manifest edges.
- `eval/benchmark_lineage_column.py` compares extracted column lineage with a hand-authored golden set.
- `eval/evaluate_rag.py` measures whether the expected file appears in the top three retrieved chunks.
- `eval/evaluate_ragas.py` builds a RAGAS dataset and evaluates faithfulness, answer relevancy, and context precision using configured evaluator models.
- `eval/benchmark_reranker.py` evaluates reranking behavior.
- `eval/benchmark_cache.py` benchmarks an in-memory cache through monkey-patched embedding and search functions.

### Reported README numbers

The README reports 92% file hit rate at three, RAGAS faithfulness 0.91, answer relevancy 0.88, context precision 0.87, table-level lineage precision/recall of 1.0/1.0, and column-level lineage precision/recall of 1.0/0.333. It reports cache speedups between roughly 2.75x and 3.38x in different benchmark sections.

### Interview-safe wording

"The repository includes repeatable evaluation scripts and reported benchmark results. I would present those as repository-reported results unless I had rerun them with the same data, model versions, keys, and environment. The most revealing result is the column-lineage recall of 0.333: precision was high, but the extractor missed many expected dependencies. That tells me the next improvement should focus on coverage, especially SQL constructs and multi-hop propagation, not just ranking."

## 13. Strong answer: "Walk me through a project you built end-to-end"

"I built a Codebase Intelligence Engine for developers who need to understand unfamiliar repositories. The core problem was that ordinary RAG treats code as text: it can retrieve something semantically related, but it can split functions, miss exact identifiers, and hallucinate caller-callee flow.

The system has a React/Vite frontend and a FastAPI backend. A user can upload a file or provide a Git repository URL. The backend scans supported files, creates chunks, generates Gemini embeddings, and stores the vectors and metadata in Qdrant. Separately, structured relationships such as function calls and dbt model-column lineage are stored in PostgreSQL and loaded into NetworkX for traversal.

For a question, the backend classifies intent into explanation, search, usage, or impact analysis. Normal search combines Qdrant semantic candidates with BM25 lexical scoring, fuses the rankings with RRF, optionally applies a cross-encoder, filters noisy files, expands relevant call-graph neighbors, and builds a bounded context. The answer is then generated through a provider fallback chain involving Gemini, Groq, OpenAI, Ollama, and a local heuristic. For usage, flow, and lineage questions, the system can use deterministic graph traversal instead of relying only on the LLM. The frontend also supports an SSE endpoint so generated text can appear progressively, with a normal JSON endpoint as fallback.

The main trade-offs were accuracy versus latency and simplicity versus production isolation. Hybrid retrieval is more expensive than one vector query, but it is better for code identifiers. Synchronous indexing was simpler for the prototype, but I would move it to a job queue for larger repositories. I also learned that the architecture needs to be described honestly: the current HTTP structural extraction adapter is stubbed, so the deployed path can fall back to character chunking unless structured data is populated through another path. The next production steps would be authentication and tenant isolation, asynchronous indexing, versioned indexes, stronger static analysis, safer upload/clone handling, and more complete lineage coverage."

## 14. Follow-up questions with answer outlines

### Product and architecture

**Why is this better than GitHub search?**

It combines semantic explanation with exact lexical matching and explicit graph/lineage relationships. GitHub search is strong for exact text but does not synthesize repository context or traverse the project's stored relationships.

**Why not send the whole repository to the LLM?**

Context limits, cost, latency, and noise. Retrieval narrows the evidence, while graph paths add targeted deterministic context.

**What happens when no relevant chunk is found?**

The RAG path returns a clear no-context message. Graph paths return no-relationship messages. The local answer generator also handles empty chunks.

**How do you handle a vague query?**

The code increases the candidate fetch size, identifies vague/explanatory language, suppresses noise files, boosts source-code extensions, and caps chunks per file.

### Retrieval and RAG

**Explain RRF.**

Each result receives a rank contribution of `1 / (k + rank)`, with `k = 60` in the implementation. Semantic and lexical lists contribute independently, so a result that ranks well in either signal can survive fusion.

**Why rerank after fusion?**

Fusion creates a broad candidate set from complementary signals. A cross-encoder then scores query-document pairs jointly, which is more precise but more expensive, so it is applied only to a bounded candidate set and loaded lazily.

**How do you reduce hallucinations?**

Use explicit source chunks, bounded context, deterministic graph answers for relationship queries, and RAGAS faithfulness evaluation. This reduces risk but does not eliminate hallucinations; the answer prompt and source display should be strengthened further.

**What is the local fallback?**

It selects a query-overlapping sentence from the first few chunks, and has special handling for flow text. It is availability-oriented, not equivalent to LLM-quality generation.

**What is a retrieval weakness?**

BM25 runs on the semantic candidate set rather than a separately indexed full lexical corpus. Also, the approximate token budget and heuristics are hand-tuned. I would measure recall at larger k and replace heuristic noise handling with metadata filters and an evaluated ranking policy.

### Parsing and graphs

**How is the call graph represented?**

PostgreSQL stores one row per file/function with a text array of called functions. Query code builds a NetworkX directed graph, qualifies names as `file::function` where needed, and traverses successors or predecessors.

**What are the limitations of static call graphs?**

Dynamic dispatch, decorators, aliases, reflection, generated code, unresolved imports, and language-specific semantics can produce false negatives or ambiguous matches. The current graph also normalizes many results back to base function names, which can create collisions across files.

**How does lineage work?**

The dbt script renders Jinja constructs such as `ref` and `source`, parses SQL with sqlglot, extracts table-level dependencies, and uses sqlglot lineage to walk leaf source columns. Edges are stored with a transformation type and traversed upstream or downstream.

**Why is column recall lower than precision?**

The extractor can identify confident leaf columns but misses some expected dependencies, especially through complex SQL, CTEs, joins, aggregations, and multi-hop semantics. The benchmark itself exposes this gap.

### Backend and operations

**Why FastAPI?**

It provides typed request validation through Pydantic, straightforward JSON and multipart endpoints, automatic OpenAPI documentation, and a good fit for Python AI/data libraries.

**Why are embeddings generated one at a time?**

The current implementation loops over chunks and calls Gemini for each. It is simple, but a production version should batch requests, add retries/backoff, and control concurrency within provider quotas.

**How is latency measured?**

The query route measures elapsed pipeline time with `time.perf_counter()` and returns milliseconds. A latency middleware also exposes metrics through the imported metrics router. The code logs process RSS at several stages for memory diagnosis.

**What if Qdrant or PostgreSQL is unavailable?**

Vector search catches several failures and returns an empty result. Call-graph and lineage helpers return empty structures when configuration is missing or reads fail. This improves availability but can silently degrade answer quality, so production health and observability should distinguish dependency failure from genuinely empty data.

## 15. Deep technical questions

1. How would you calibrate semantic and BM25 scores instead of combining only ranks?
2. How would you evaluate retrieval separately from answer generation?
3. How would you add incremental indexing based on Git commit or file hash?
4. How would you prevent stale vectors after a repository is reindexed?
5. How would you handle duplicate function names across files without losing identity?
6. How would you model call-graph edges relationally instead of using `TEXT[]`?
7. How would you support imports and cross-file symbol resolution?
8. What tokenizer would you use to make the context budget accurate?
9. How would you batch embeddings while respecting API quotas?
10. How would you protect SSE connections from abandoned clients and provider timeouts?
11. How would you sanitize generated HTML before rendering it?
12. How would you test fallback behavior without making real model calls?
13. What is the effect of `top_k * 3` candidate expansion on latency and memory?
14. How would you make reranker loading and inference safe across multiple workers?
15. How would you preserve evidence citations from retrieved chunks in the generated answer?

## 16. System design questions and strong directions

### Design for 10,000 repositories

Separate control-plane metadata from per-repository data. Store repository, branch, commit, file hash, indexing job, and tenant IDs in PostgreSQL. Put vectors in tenant/repository/commit namespaces or collections. Queue indexing through workers, batch embeddings, persist progress, and atomically publish a completed index version. Query only the latest successful version.

### Design for multi-tenancy

Add authentication and authorization at the API boundary. Every vector payload and graph row needs a tenant and repository identifier. Enforce filters server-side, never trust a client-supplied repository context, encrypt sensitive data, apply quotas, and log access to source code.

### Design for low latency

Cache normalized-query embeddings and retrieval results with a bounded TTL and invalidation by index version. Use a dedicated lexical index, parallelize independent retrieval calls, batch or precompute embeddings, cap reranker candidates, stream generation, and measure p50/p95/p99 separately for indexing, retrieval, graph traversal, and generation.

### Design for reliability

Use idempotent jobs, retries with backoff, dead-letter handling, per-file error records, dependency-specific health checks, timeouts, circuit breakers, and an index manifest. Do not report repository success until the requested index version is complete or explicitly marked partial.

### Design for secure repository ingestion

Allowlist supported hosts or require an uploaded archive, block private-network targets, apply clone and decompression limits, sanitize paths, reject symlinks that escape the workspace, scan file types, and run parsing in an isolated worker. Redact secrets before sending source to external models.

## 17. Behavioral and STAR questions

### Tell me about a difficult technical challenge.

**Situation:** Plain vector retrieval was not reliable for exact code identifiers and execution-flow questions.

**Task:** Improve relevance while keeping explanations useful.

**Action:** Combine semantic candidates with BM25, fuse ranks with RRF, add bounded reranking, and use deterministic call-graph traversal for relationship queries.

**Result:** The repository includes dedicated retrieval and answer-quality evaluation scripts, plus reported file-hit and RAGAS metrics. I would qualify the numbers by saying they need to be reproduced under the same benchmark environment.

### Tell me about a trade-off you made.

**Situation:** The first useful version needed a deployable architecture without hosting a large model.

**Task:** Keep operations manageable.

**Action:** Use managed Qdrant/PostgreSQL and API-based model providers, with Ollama and a local heuristic fallback.

**Result:** The system is easier to deploy and has fallback behavior, but it trades away provider independence, privacy, and predictable latency. Production hardening would add caching, batching, quotas, and model observability.

### Tell me about a time something did not work as expected.

**Situation:** The design called for AST-aware extraction, but the route-level extractor functions in `app/services/ingest.py` are stubs.

**Task:** Understand the actual behavior before claiming structural indexing.

**Action:** Trace the route call sites and fallback branches, then compare them with the standalone Tree-sitter implementation in `ast_chunking.py`.

**Result:** The accurate conclusion is that the HTTP path can fall back to character chunks. The fix would be to integrate the Tree-sitter extractor behind the route's expected metadata and call-graph interfaces, then add an end-to-end test proving metadata and graph persistence.

### How do you prioritize improvements?

I prioritize correctness and security before model sophistication: authenticate and isolate data, make indexing versioned and observable, fix structural extraction integration, improve lineage recall, then optimize latency through batching/caching and improve answer quality through citations and evaluation.

## 18. "What would you do differently today?"

"I would keep the core separation between semantic retrieval and deterministic relationship analysis, but I would change the production boundary around it. First, I would integrate and test the Tree-sitter extractor in the actual HTTP indexing path, because structural metadata and call graphs are central to the product. Second, I would add authentication, tenant-scoped storage, restrictive CORS, safe repository and upload handling, and explicit source-code privacy controls. Third, I would move cloning and embedding to an idempotent background job with progress, retries, per-file errors, and versioned indexes so a partial run cannot look like a complete repository.

For retrieval, I would batch embeddings, add an actual lexical index or a well-defined full-corpus BM25 stage, replace fragile filename heuristics with metadata filters, and use tokenizer-based context budgets. For answer quality, I would preserve chunk citations in every response and maintain separate retrieval, graph, lineage, and generation metrics. Finally, I would expand the test suite around ambiguous symbols, stale indexes, provider failures, malformed SQL, duplicate names, and security boundaries. The result would be less of a single-process prototype and more of a reliable, inspectable multi-tenant service."

## 19. Facts versus assumptions checklist

### Facts supported by the repository

- FastAPI routes are defined under `/api` for ingestion, repository indexing, search, health, query, and streaming query.
- Qdrant stores the `documents` vector collection and source payloads.
- PostgreSQL stores call-graph and lineage tables when configured.
- Gemini is the embedding implementation in `embeddings.py`.
- Query classification has a Groq path and a rule-based fallback.
- Generation has Gemini, OpenAI, Groq, Ollama, and local fallback code.
- React calls the streaming endpoint first and then the normal query endpoint.
- There is no application authentication implementation.
- `app/services/ingest.py` structural extraction functions are stubs.
- A separate Tree-sitter extractor exists in `ast_chunking.py`.
- Repository indexing is synchronous and has visible file-count and character limits.

### Claims that require qualification

- The README says AST-aware indexing is supported, but the route wiring does not currently prove that end-to-end.
- The README describes deployed CloudFront, S3, Render, Neon, and Qdrant Cloud infrastructure, but those deployment settings are not represented as infrastructure-as-code in this repository.
- README benchmark values are reported artifacts, not automatically verified by this document.
- "Production-style" describes the intended architecture, not evidence of production-grade authentication, isolation, or reliability.

### Claims to avoid

- Do not say the system supports secure multi-user accounts.
- Do not say every indexed repository has a complete call graph.
- Do not say lineage has perfect recall; the included benchmark reports 0.333 column-level recall.
- Do not say streaming always sends token-by-token output; non-Gemini and graph paths can emit one complete answer event.
- Do not say the frontend accepts every backend-supported file type; its current picker validation is narrower.

## 20. Practical revision sheet

Before an interview, be ready to explain these five sentences without looking at notes:

1. "The product helps developers query unfamiliar repositories using both RAG and deterministic code/data graphs."
2. "Qdrant handles semantic chunks; PostgreSQL handles call-graph and lineage relationships."
3. "Normal retrieval combines semantic search, BM25, RRF, optional reranking, and heuristic filtering."
4. "Usage, flow, and impact questions can use graph traversal instead of asking an LLM to infer relationships."
5. "The current repository is a strong prototype, but I would be explicit that authentication, async indexing, tenant isolation, and the route-level AST integration still need production work."

### High-value code anchors to open during preparation

- `app/api/routes.py`: endpoint contracts and indexing/query orchestration.
- `app/services/rag.py`: intent routing, graph paths, context construction, and provider fallback.
- `app/services/hybrid_search.py`: BM25/RRF/reranking behavior.
- `app/services/vector_store.py`: Qdrant payload and deterministic IDs.
- `app/services/call_graph_query.py`: graph identity and traversal.
- `app/services/lineage_extractor.py`: SQL lineage extraction boundary.
- `ast_chunking.py`: intended Tree-sitter structural extraction.
- `frontend/src/App.jsx`: browser-to-API flow and SSE fallback.
