/**
 * src/lib/api.js
 * Central API client — all network calls live here.
 * Base URL from VITE_API_URL env var (never hard-coded).
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Generic GET helper */
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/** Generic POST helper (JSON body) */
async function post(path, body, signal) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = `POST ${path} failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/** GET /api/health → { qdrant, postgres, llm_provider, gemini_configured, groq_configured } */
export const fetchHealth = () => get('/api/health');

/** POST /api/query → QueryResponse */
export const queryFull = (query, top_k = 5, signal) =>
  post('/api/query', { query, top_k }, signal);

/** POST /api/index_repo → { message } */
export const indexRepo = (repo_url, signal) =>
  post('/api/index_repo', { repo_url }, signal);

/** POST /api/ingest (multipart) → { filename, chunk_count, … } */
export async function ingestFile(file, signal) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/api/ingest`, {
    method: 'POST',
    body: fd,
    signal,
  });
  if (!res.ok) {
    let detail = `Ingest failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

/** GET /api/search?query=…&top_k=… → { query, top_k, collection, results } */
export const searchDebug = (query, top_k = 5) =>
  get(`/api/search?query=${encodeURIComponent(query)}&top_k=${top_k}`);

/**
 * POST /api/query/stream — SSE streaming.
 * Returns a raw Response so the caller can read the body as a stream.
 * The signal is passed through for AbortController support.
 */
export async function streamQuery(query, top_k = 5, signal) {
  const res = await fetch(`${BASE}/api/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k }),
    signal,
  });
  if (!res.ok) {
    let detail = `Stream failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res; // caller reads res.body
}
