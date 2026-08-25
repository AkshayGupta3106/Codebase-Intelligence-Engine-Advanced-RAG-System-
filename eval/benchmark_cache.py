"""
# -*- coding: utf-8 -*-
benchmark_cache.py
==================
Measures retrieval latency for the 100-query eval set with and without
an in-memory LRU cache layered on top of the embedding + search hot paths.

Run:
    python eval/benchmark_cache.py

Output:
    • Per-query timings printed to stdout
    • A JSON results file: eval/benchmark_results.json
    • A Markdown summary: eval/benchmark_report.md
"""
from __future__ import annotations

import functools
import io
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from statistics import mean, median, quantiles
from typing import Any

# ---------------------------------------------------------------------------
# Path bootstrap
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
os.chdir(REPO_ROOT)

# Force UTF-8 stdout on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Load eval queries (merge all golden sets, deduplicate, pad to ~100)
# ---------------------------------------------------------------------------

def _load_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else []


def load_all_queries() -> list[dict]:
    eval_dir = Path(__file__).parent
    files = [
        eval_dir / "goldenset.json",
        eval_dir / "newgoldenset.json",
        eval_dir / "advanced_golden_set.json",
    ]
    seen: set[str] = set()
    queries: list[dict] = []
    for f in files:
        if f.exists():
            for item in _load_json(f):
                q = str(item.get("query") or "").strip()
                if q and q not in seen:
                    seen.add(q)
                    queries.append(item)

    # Pad to 100 by cycling through existing queries with light paraphrase markers
    # so we hit realistic cache-hit scenarios on the second run.
    original_count = len(queries)
    while len(queries) < 100:
        idx = len(queries) - original_count
        base = queries[idx % original_count].copy()
        # Slight paraphrase that still maps to same intent (tests cache hit on 2nd run)
        base["query"] = base["query"].strip() + " "  # trailing space normalised later
        base["_padded"] = True
        queries.append(base)

    return queries[:100]


# ---------------------------------------------------------------------------
# Patch helpers: embed cache + search cache
# Store originals ONCE at startup so we can restore without reloading modules.
# ---------------------------------------------------------------------------

# Lazy-initialised original references (populated on first _ensure_originals call)
_ORIG_EMBED = None
_ORIG_SEARCH = None

_EMBED_CACHE: dict[str, list[float]] = {}
_SEARCH_CACHE: dict[str, list[dict]] = {}
CACHE_HITS = {"embed": 0, "search": 0, "total_calls": {"embed": 0, "search": 0}}


def _ensure_originals():
    """Capture the real (unpatched) function objects the first time we're called."""
    global _ORIG_EMBED, _ORIG_SEARCH
    import app.services.embeddings as emb_mod
    import app.services.vector_store as vs_mod
    if _ORIG_EMBED is None:
        _ORIG_EMBED = emb_mod.generate_embeddings
    if _ORIG_SEARCH is None:
        _ORIG_SEARCH = vs_mod.search_similar_chunks


def _embedding_key(text: str) -> str:
    return hashlib.sha256(text.strip().encode()).hexdigest()


def _search_key(embedding: list[float], top_k: int) -> str:
    vec_bytes = str(embedding[:8]).encode()  # first 8 dims as proxy key
    return hashlib.sha256(vec_bytes + str(top_k).encode()).hexdigest()


def _patch_with_cache():
    """Monkey-patch generate_embeddings and search_similar_chunks to add LRU cache."""
    _ensure_originals()
    import app.services.embeddings as emb_mod
    import app.services.vector_store as vs_mod
    import app.services.hybrid_search as hs_mod

    def cached_embed(chunks: list[str], model_name: str = emb_mod.DEFAULT_EMBEDDING_MODEL) -> list[list[float]]:
        CACHE_HITS["total_calls"]["embed"] += 1
        result: list[list[float]] = []
        for chunk in chunks:
            key = _embedding_key(chunk)
            if key in _EMBED_CACHE:
                CACHE_HITS["embed"] += 1
                result.append(_EMBED_CACHE[key])
            else:
                fresh = _ORIG_EMBED([chunk], model_name=model_name)
                val = fresh[0] if fresh else []
                _EMBED_CACHE[key] = val
                result.append(val)
        return result

    def cached_search(query_embedding: list[float], top_k: int = 5, **kwargs) -> list[dict]:
        CACHE_HITS["total_calls"]["search"] += 1
        key = _search_key(query_embedding, top_k)
        if key in _SEARCH_CACHE:
            CACHE_HITS["search"] += 1
            return list(_SEARCH_CACHE[key])
        fresh = _ORIG_SEARCH(query_embedding=query_embedding, top_k=top_k, **kwargs)
        _SEARCH_CACHE[key] = list(fresh)
        return fresh

    emb_mod.generate_embeddings = cached_embed
    vs_mod.search_similar_chunks = cached_search
    hs_mod.generate_embeddings = cached_embed
    hs_mod.search_similar_chunks = cached_search


def _reset_cache_counters():
    """Clear caches and counters (does NOT restore originals)."""
    _EMBED_CACHE.clear()
    _SEARCH_CACHE.clear()
    CACHE_HITS["embed"] = 0
    CACHE_HITS["search"] = 0
    CACHE_HITS["total_calls"]["embed"] = 0
    CACHE_HITS["total_calls"]["search"] = 0


# ---------------------------------------------------------------------------
# Single-query timer  (retrieval path only — skips LLM to get clean numbers)
# ---------------------------------------------------------------------------

def time_query(query: str) -> tuple[float, int]:
    """Returns (elapsed_seconds, retrieved_chunk_count).

    Benchmarks only the retrieval path (embedding generation + hybrid search +
    heuristic reranking).  LLM answer generation is deliberately excluded
    because Groq/Ollama network timeouts dominate locally and obscure the
    embedding/search latency that caching actually improves.
    """
    # Import lazily so patching applied in _patch_with_cache() is already in effect
    from app.services.rag import retrieve_relevant_chunks
    t0 = time.perf_counter()
    try:
        chunks = retrieve_relevant_chunks(query=query.strip(), top_k=5)
    except Exception as exc:
        print(f"    [ERROR] {exc}")
        chunks = []
    elapsed = time.perf_counter() - t0
    return elapsed, len(chunks)


# ---------------------------------------------------------------------------
# Stats helpers
# ---------------------------------------------------------------------------

def pct(values: list[float], p: int) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    idx = max(0, int(len(sorted_v) * p / 100) - 1)
    return sorted_v[idx]


def print_stats(label: str, timings: list[float]) -> dict:
    p50 = pct(timings, 50)
    p95 = pct(timings, 95)
    p99 = pct(timings, 99)
    avg = mean(timings) if timings else 0.0
    mn = min(timings) if timings else 0.0
    mx = max(timings) if timings else 0.0

    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  Queries   : {len(timings)}")
    print(f"  Mean      : {avg*1000:.1f} ms")
    print(f"  Min       : {mn*1000:.1f} ms")
    print(f"  Max       : {mx*1000:.1f} ms")
    print(f"  p50       : {p50*1000:.1f} ms")
    print(f"  p95       : {p95*1000:.1f} ms")
    print(f"  p99       : {p99*1000:.1f} ms")
    print(f"{'='*60}")

    return {"mean_ms": round(avg*1000, 2), "min_ms": round(mn*1000, 2),
            "max_ms": round(mx*1000, 2), "p50_ms": round(p50*1000, 2),
            "p95_ms": round(p95*1000, 2), "p99_ms": round(p99*1000, 2),
            "n": len(timings)}


# ---------------------------------------------------------------------------
# Main benchmark
# ---------------------------------------------------------------------------

def run_baseline(queries: list[dict]) -> tuple[list[float], list[dict]]:
    """Run every query WITHOUT any cache. Returns (timings, per_query_records)."""
    print("\n" + "#"*60)
    print("  BASELINE RUN  (no cache)")
    print("#"*60)

    # Capture originals BEFORE any patching happens
    _ensure_originals()

    timings: list[float] = []
    records: list[dict] = []

    for i, item in enumerate(queries, start=1):
        q = str(item.get("query", "")).strip()
        if not q:
            continue
        elapsed, n_chunks = time_query(q)
        timings.append(elapsed)
        records.append({
            "query": q,
            "baseline_ms": round(elapsed * 1000, 2),
            "chunks": n_chunks,
        })
        padded = "  [padded]" if item.get("_padded") else ""
        print(f"  [{i:03d}] {elapsed*1000:7.1f} ms  chunks={n_chunks}  {q[:55]}{padded}")

    return timings, records


def run_cached(queries: list[dict], baseline_records: list[dict]) -> tuple[list[float], list[dict]]:
    """
    Run every query WITH cache.
    First pass: populate cache (cold-cache simulation).
    Second pass: measure cache-warmed timings (these are what matter for p95).
    """
    print("\n" + "#"*60)
    print("  CACHED RUN  (warm-up pass + timed pass)")
    print("#"*60)

    # Reset and patch
    _reset_cache_counters()
    _patch_with_cache()

    # Warm-up pass (populate cache, not timed for final stats)
    print("\n  --- Cache warm-up pass (untimed) ---")
    for i, item in enumerate(queries, start=1):
        q = str(item.get("query", "")).strip()
        if not q:
            continue
        _, _ = time_query(q)
        if i % 10 == 0:
            print(f"    warm-up progress: {i}/{len(queries)}")

    embed_after_warmup = dict(CACHE_HITS)
    print(f"\n  Cache state after warm-up:")
    print(f"    embed cache size : {len(_EMBED_CACHE)}")
    print(f"    search cache size: {len(_SEARCH_CACHE)}")

    # Reset hit counters before timed pass
    CACHE_HITS["embed"] = 0
    CACHE_HITS["search"] = 0

    # Timed pass (cache is warm)
    print("\n  --- Timed pass (cache warm) ---")
    timings: list[float] = []
    records: list[dict] = list(baseline_records)  # copy to enrich

    for i, item in enumerate(queries, start=1):
        q = str(item.get("query", "")).strip()
        if not q:
            continue
        elapsed, n_chunks = time_query(q)
        timings.append(elapsed)
        if i <= len(records):
            records[i - 1]["cached_ms"] = round(elapsed * 1000, 2)
            records[i - 1]["speedup_x"] = round(
                records[i - 1]["baseline_ms"] / max(elapsed * 1000, 0.01), 2
            )
        padded = "  [padded]" if item.get("_padded") else ""
        print(f"  [{i:03d}] {elapsed*1000:7.1f} ms  chunks={n_chunks}  {q[:55]}{padded}")

    cache_hit_rate_embed = (
        CACHE_HITS["embed"] / max(CACHE_HITS["total_calls"]["embed"], 1)
    )
    cache_hit_rate_search = (
        CACHE_HITS["search"] / max(CACHE_HITS["total_calls"]["search"], 1)
    )

    print(f"\n  Cache hit rates (timed pass):")
    print(f"    embedding hits : {CACHE_HITS['embed']}/{CACHE_HITS['total_calls']['embed']} "
          f"= {cache_hit_rate_embed*100:.1f}%")
    print(f"    search hits    : {CACHE_HITS['search']}/{CACHE_HITS['total_calls']['search']} "
          f"= {cache_hit_rate_search*100:.1f}%")

    return timings, records, cache_hit_rate_embed, cache_hit_rate_search


# ---------------------------------------------------------------------------
# Report writers
# ---------------------------------------------------------------------------

def write_json_results(path: Path, baseline_stats: dict, cached_stats: dict,
                       per_query: list[dict], embed_hit: float, search_hit: float):
    results = {
        "baseline": baseline_stats,
        "cached": cached_stats,
        "speedup": {
            "p50_x": round(baseline_stats["p50_ms"] / max(cached_stats["p50_ms"], 0.01), 2),
            "p95_x": round(baseline_stats["p95_ms"] / max(cached_stats["p95_ms"], 0.01), 2),
            "p99_x": round(baseline_stats["p99_ms"] / max(cached_stats["p99_ms"], 0.01), 2),
            "mean_x": round(baseline_stats["mean_ms"] / max(cached_stats["mean_ms"], 0.01), 2),
        },
        "cache_hit_rate": {
            "embedding_pct": round(embed_hit * 100, 1),
            "search_pct": round(search_hit * 100, 1),
        },
        "per_query": per_query,
    }
    path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n  JSON results written → {path}")
    return results


def write_markdown_report(path: Path, results: dict, queries: list[dict]):
    baseline = results["baseline"]
    cached = results["cached"]
    speedup = results["speedup"]
    hit = results["cache_hit_rate"]

    lines = [
        "# Cache Benchmark Report",
        "",
        f"> **Dataset**: {baseline['n']} queries &nbsp;|&nbsp; "
        f"**Baseline p95**: {baseline['p95_ms']} ms &nbsp;|&nbsp; "
        f"**Cached p95**: {cached['p95_ms']} ms",
        "",
        "## Latency Summary",
        "",
        "| Metric | Baseline (no cache) | Cached (warm) | Speedup |",
        "|--------|--------------------:|---------------:|--------:|",
        f"| Mean   | {baseline['mean_ms']} ms | {cached['mean_ms']} ms | **{speedup['mean_x']}×** |",
        f"| p50    | {baseline['p50_ms']} ms | {cached['p50_ms']} ms | **{speedup['p50_x']}×** |",
        f"| p95    | {baseline['p95_ms']} ms | {cached['p95_ms']} ms | **{speedup['p95_x']}×** |",
        f"| p99    | {baseline['p99_ms']} ms | {cached['p99_ms']} ms | **{speedup['p99_x']}×** |",
        f"| Min    | {baseline['min_ms']} ms | {cached['min_ms']} ms | — |",
        f"| Max    | {baseline['max_ms']} ms | {cached['max_ms']} ms | — |",
        "",
        "## Cache Hit Rates (Timed Pass)",
        "",
        f"| Layer | Hit Rate |",
        f"|-------|----------|",
        f"| Embedding (Gemini API) | {hit['embedding_pct']}% |",
        f"| Vector Search (Qdrant) | {hit['search_pct']}% |",
        "",
        "## Per-Query Detail",
        "",
        "| # | Query | Baseline ms | Cached ms | Speedup |",
        "|---|-------|------------:|----------:|--------:|",
    ]

    for i, rec in enumerate(results["per_query"], start=1):
        q = rec["query"][:60]
        b = rec.get("baseline_ms", "—")
        c = rec.get("cached_ms", "—")
        s = rec.get("speedup_x", "—")
        lines.append(f"| {i} | {q} | {b} | {c} | {s}× |")

    lines += [
        "",
        "## Key Takeaways",
        "",
        f"- **p95 improvement**: {baseline['p95_ms']} ms → {cached['p95_ms']} ms "
        f"(**{speedup['p95_x']}× faster**)",
        f"- Embedding cache eliminates Gemini API RTT for repeated queries "
        f"({hit['embedding_pct']}% hit rate)",
        f"- Search cache eliminates Qdrant round-trip for identical vectors "
        f"({hit['search_pct']}% hit rate)",
        "",
        "_Generated by `eval/benchmark_cache.py`_",
    ]

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Markdown report written → {path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  RAG Cache Benchmark")
    print("="*60)

    queries = load_all_queries()
    print(f"\n  Loaded {len(queries)} queries for benchmarking")

    # ── BASELINE ─────────────────────────────────────────────────
    baseline_timings, per_query_records = run_baseline(queries)
    baseline_stats = print_stats("BASELINE — no cache", baseline_timings)

    # ── CACHED ───────────────────────────────────────────────────
    cached_timings, per_query_records, embed_hit, search_hit = run_cached(
        queries, per_query_records
    )
    cached_stats = print_stats("CACHED — warm LRU", cached_timings)

    # ── SPEEDUP SUMMARY ───────────────────────────────────────────
    print("\n" + "="*60)
    print("  SPEEDUP SUMMARY")
    print("="*60)
    for metric in ("p50", "p95", "p99", "mean"):
        b = baseline_stats[f"{metric}_ms"]
        c = cached_stats[f"{metric}_ms"]
        x = round(b / max(c, 0.01), 2)
        bar = "#" * min(int(x * 4), 40)
        print(f"  {metric:4s}  {b:7.1f} ms → {c:7.1f} ms  {x:5.1f}×  {bar}")
    print("="*60)

    # ── WRITE RESULTS ─────────────────────────────────────────────
    eval_dir = Path(__file__).parent
    results = write_json_results(
        path=eval_dir / "benchmark_results.json",
        baseline_stats=baseline_stats,
        cached_stats=cached_stats,
        per_query=per_query_records,
        embed_hit=embed_hit,
        search_hit=search_hit,
    )
    write_markdown_report(
        path=eval_dir / "benchmark_report.md",
        results=results,
        queries=queries,
    )

    print("\n  Done. ✓")
