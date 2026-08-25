import logging
import os
import time
from pathlib import Path
import subprocess
import tempfile
from typing import AsyncGenerator

import psutil

from fastapi import APIRouter
from fastapi import File
from fastapi import HTTPException
from fastapi import Query
from fastapi import UploadFile
from fastapi.responses import StreamingResponse

from app.services.chunking import chunk_text
from app.services.embeddings import DEFAULT_EMBEDDING_MODEL
from app.services.embeddings import embedding_dimension
from app.services.embeddings import generate_embeddings
from app.services.ingest import extract_code_chunks
from app.services.ingest import extract_text
from app.services.ingest import extract_python_chunks_and_graph
from app.services.call_graph_store import upsert_call_graph
from app.models.schemas import QueryRequest
from app.models.schemas import QueryResponse
from app.services.rag import detect_query_target_file
from app.services.rag import run_rag_pipeline
from app.services.context_state import get_uploaded_file_name
from app.services.context_state import is_repo_indexed
from app.services.context_state import set_repo_indexed
from app.services.context_state import set_uploaded_file
from app.services.vector_store import COLLECTION_NAME
from app.services.vector_store import search_similar_chunks
from app.services.vector_store import store_chunk_embeddings

router = APIRouter(prefix="/api")
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SUPPORTED_REPO_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".sql", ".yml", ".yaml"}
SKIPPED_REPO_DIRECTORIES = {".git", "node_modules", "pycache", "__pycache__", "dist", "build", ".next", ".venv", "target", "dbt_packages"}
MAX_FILES = 100
MAX_FILE_CHARACTERS = 200000

logger = logging.getLogger(__name__)
_last_indexed_repo_url: str | None = None
_repo_partially_indexed: bool = False


def log_memory(stage: str):
	process = psutil.Process(os.getpid())
	mem = process.memory_info().rss / (1024 * 1024)
	print(f"[MEMORY] {stage}: {mem:.2f} MB")


def _find_target_file(repo_dir: Path, target_file: str) -> Path | None:
	normalized_target = str(target_file or "").strip().lower()
	if not normalized_target:
		return None

	for path in repo_dir.rglob("*"):
		if any(part in SKIPPED_REPO_DIRECTORIES for part in path.parts):
			continue
		if not path.is_file():
			continue
		if path.suffix.lower() not in SUPPORTED_REPO_EXTENSIONS:
			continue

		relative_name = str(path.relative_to(repo_dir)).lower()
		base_name = path.name.lower()
		if normalized_target == relative_name or normalized_target == base_name or relative_name.endswith("/" + normalized_target):
			return path

	return None


def _index_repo_file(repo_dir: Path, file_path: Path) -> bool:
	try:
		relative_name = str(file_path.relative_to(repo_dir))
		file_bytes = file_path.read_bytes()
		try:
			text = file_bytes.decode("utf-8")
		except UnicodeDecodeError:
			text = file_bytes.decode("latin-1")

		if len(text) > MAX_FILE_CHARACTERS:
			logger.info("Skipping large file: %s", relative_name)
			return False

		chunk_metadata: list[dict[str, object]] = []
		call_graph: dict[str, list[str]] = {}
		lowered = file_path.suffix.lower()

		if lowered == ".py":
			try:
				chunks, chunk_metadata, call_graph = extract_python_chunks_and_graph(
					code=text,
					file_name=relative_name,
				)
			except Exception:
				chunks = chunk_text(text=text, chunk_size=500, overlap=50)
				chunk_metadata = []
				call_graph = {}
		else:
			chunks, chunk_metadata = extract_code_chunks(
				code=text,
				file_name=relative_name,
			)
			if not chunks:
				chunks = chunk_text(text=text, chunk_size=500, overlap=50)

		if not chunks:
			return False

		embeddings = generate_embeddings(chunks=chunks)
		if not embeddings:
			return False

		if call_graph:
			upsert_call_graph(file_name=relative_name, call_graph=call_graph)

		store_chunk_embeddings(
			file_name=relative_name,
			chunks=chunks,
			embeddings=embeddings,
			chunk_metadata=chunk_metadata if chunk_metadata else None,
		)
		return True
	except Exception:
		return False


@router.post("/ingest")
async def ingest_document(
	file: UploadFile = File(...),
	chunk_size: int = Query(default=500, ge=1),
	overlap: int = Query(default=50, ge=0),
) -> dict[str, object]:
	file_bytes = await file.read()

	if not file_bytes:
		raise HTTPException(status_code=400, detail="Empty file uploaded")

	file_name = file.filename or "uploaded_file"
	file_path = UPLOAD_DIR / file_name
	file_path.write_bytes(file_bytes)

	try:
		text = extract_text(file_name=file_name, file_bytes=file_bytes)
		chunk_metadata: list[dict[str, object]] = []
		call_graph: dict[str, list[str]] = {}
		lowered = file_name.lower()

		if lowered.endswith(".py"):
			try:
				chunks, chunk_metadata, call_graph = extract_python_chunks_and_graph(
					code=text,
					file_name=file_name,
				)
			except Exception:
				# Fall back to naive chunking if AST parsing fails.
				chunks = chunk_text(text=text, chunk_size=chunk_size, overlap=overlap)
				chunk_metadata = []
				call_graph = {}
		elif lowered.endswith((".js", ".ts", ".go")):
			chunks, chunk_metadata = extract_code_chunks(
				code=text,
				file_name=file_name,
			)
			if not chunks:
				chunks = chunk_text(text=text, chunk_size=chunk_size, overlap=overlap)
		else:
			chunks = chunk_text(text=text, chunk_size=chunk_size, overlap=overlap)
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=str(exc)) from exc

	try:
		embeddings = generate_embeddings(chunks=chunks)
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Failed to generate embeddings") from exc

	call_graph_rows_upserted = 0
	if call_graph:
		print("CALL GRAPH:", call_graph)
		try:
			print("before upsert_call_graph")
			call_graph_rows_upserted = upsert_call_graph(file_name=file_name, call_graph=call_graph)
			print("after upsert_call_graph")
		except Exception as exc:
			raise HTTPException(status_code=500, detail="Failed to store call graph") from exc

	try:
		point_ids = store_chunk_embeddings(
			file_name=file_name,
			chunks=chunks,
			embeddings=embeddings,
			chunk_metadata=chunk_metadata if chunk_metadata else None,
		)
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Failed to store vectors") from exc

	set_uploaded_file(file_name)
	set_repo_indexed(False)

	return {
		"filename": file_name,
		"characters": len(text),
		"chunk_size": chunk_size,
		"overlap": overlap,
		"chunk_count": len(chunks),
		"chunks": chunks,
		"chunk_metadata": chunk_metadata,
		"call_graph": call_graph,
		"embedding_model": DEFAULT_EMBEDDING_MODEL,
		"embedding_dimension": embedding_dimension(),
		"embedding_count": len(embeddings),
		"embeddings": embeddings,
		"collection": COLLECTION_NAME,
		"stored_count": len(point_ids),
		"point_ids": point_ids,
		"call_graph_rows_upserted": call_graph_rows_upserted,
		"text": text,
	}


@router.post("/index_repo")
def index_repository(payload: dict[str, str]) -> dict[str, str]:
	global _last_indexed_repo_url, _repo_partially_indexed
	repo_url = str(payload.get("repo_url") or "").strip()
	if not repo_url:
		raise HTTPException(status_code=400, detail="repo_url must not be empty")
	if not repo_url.startswith(("http://", "https://")):
		raise HTTPException(status_code=400, detail="Invalid repository URL")

	try:
		log_memory("routes:index_repo:before_repo_indexing")
		with tempfile.TemporaryDirectory(prefix="repo_index_") as tmp_dir:
			repo_dir = Path(tmp_dir) / "repo"
			clone_result = subprocess.run(
				["git", "clone", "--depth", "1", repo_url, str(repo_dir)],
				capture_output=True,
				text=True,
				check=False,
			)

			if clone_result.returncode != 0:
				error_text = (clone_result.stderr or clone_result.stdout or "").strip()
				raise HTTPException(
					status_code=400,
					detail=f"Failed to clone repository: {error_text or 'git clone failed'}",
				)

			source_files: list[Path] = []
			partial_indexing_applied = False

			for path in repo_dir.rglob("*"):
				if any(part in SKIPPED_REPO_DIRECTORIES for part in path.parts):
					continue
				if not path.is_file():
					continue

				if path.suffix.lower() not in SUPPORTED_REPO_EXTENSIONS:
					logger.info("Skipping unsupported file: %s", str(path.relative_to(repo_dir)))
					continue

				source_files.append(path)
				if len(source_files) > MAX_FILES:
					partial_indexing_applied = True
					source_files = source_files[:MAX_FILES]
					break

			if partial_indexing_applied:
				logger.info("Large repo detected, partial indexing applied")

			for file_path in source_files:
				_index_repo_file(repo_dir=repo_dir, file_path=file_path)
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Repository indexing failed") from exc

	log_memory("routes:index_repo:after_repo_indexing")

	_last_indexed_repo_url = repo_url
	_repo_partially_indexed = partial_indexing_applied

	set_repo_indexed(True)
	return {"message": "Repository indexed successfully"}




@router.get("/search")
def search_chunks(query: str, top_k: int = Query(default=5, ge=1)) -> dict[str, object]:
	if not query.strip():
		raise HTTPException(status_code=400, detail="query must not be empty")

	try:
		query_embedding = generate_embeddings(chunks=[query])[0]
		results = search_similar_chunks(query_embedding=query_embedding, top_k=top_k)
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=str(exc)) from exc
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Failed to search vectors") from exc

	return {
		"query": query,
		"top_k": top_k,
		"collection": COLLECTION_NAME,
		"results": results,
	}



@router.get("/health")
def api_health_check() -> dict[str, object]:
	"""Return status of Qdrant, Postgres, and the configured LLM provider."""
	from app.services.vector_store import get_qdrant_client

	qdrant_ok = False
	try:
		client = get_qdrant_client()
		qdrant_ok = client.get_collections() is not None
	except Exception:
		qdrant_ok = False

	postgres_ok = False
	try:
		import psycopg2
		conn = psycopg2.connect(os.getenv("POSTGRES_DSN", ""), connect_timeout=3)
		conn.close()
		postgres_ok = True
	except Exception:
		postgres_ok = False

	gemini_configured = bool(os.getenv("GEMINI_API_KEY"))
	groq_configured = bool(os.getenv("GROQ_API_KEY"))
	provider = os.getenv("LLM_PROVIDER", "groq")

	return {
		"qdrant": qdrant_ok,
		"postgres": postgres_ok,
		"llm_provider": provider,
		"gemini_configured": gemini_configured,
		"groq_configured": groq_configured,
	}


@router.post("/query", response_model=QueryResponse)
def query_rag(payload: QueryRequest) -> QueryResponse:
	if not payload.query.strip():
		raise HTTPException(status_code=400, detail="query must not be empty")

	try:
		target_file = detect_query_target_file(payload.query)
		repo_mode = is_repo_indexed()
		effective_file_name = None if repo_mode else get_uploaded_file_name()

		if target_file:
			effective_file_name = target_file
			repo_mode = False

		log_memory("routes:query:before_query_processing")
		t0 = time.perf_counter()

		answer, retrieved_chunks, query_type, impact_edges = run_rag_pipeline(
			query=payload.query,
			top_k=payload.top_k,
			file_name=effective_file_name,
			repo_indexed=repo_mode,
		)

		latency_ms = round((time.perf_counter() - t0) * 1000, 1)

		if target_file and not retrieved_chunks:
			return QueryResponse(
				query=payload.query,
				answer="File not found in repository",
				retrieved_chunks=[],
				query_type=query_type,
				latency_ms=latency_ms,
				impact_edges=impact_edges,
			)
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=str(exc)) from exc
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Failed to run RAG query") from exc

	return QueryResponse(
		query=payload.query,
		answer=answer,
		retrieved_chunks=retrieved_chunks,
		query_type=query_type,
		latency_ms=latency_ms,
		impact_edges=impact_edges,
	)


@router.post("/query/stream")
async def query_rag_stream(payload: QueryRequest):
	"""
	SSE streaming endpoint — streams the LLM answer token-by-token.
	Each SSE event is a JSON object: {"type": "token", "data": "..."}.
	A final event {"type": "done", "query_type": "...", "latency_ms": ...} signals completion.
	"""
	if not payload.query.strip():
		raise HTTPException(status_code=400, detail="query must not be empty")

	async def event_stream() -> AsyncGenerator[str, None]:
		import json as _json
		from app.services.rag import (
			retrieve_relevant_chunks,
			_expand_chunks_with_call_graph,
			build_context,
		)
		from app.services.query_classifier import classify_query

		t0 = time.perf_counter()
		target_file = detect_query_target_file(payload.query)
		repo_mode = is_repo_indexed()
		effective_file_name = None if repo_mode else get_uploaded_file_name()
		if target_file:
			effective_file_name = target_file
			repo_mode = False

		effective_mode = "file_only" if effective_file_name and not repo_mode else "global"
		query_type = classify_query(payload.query)

		# Short circuit for rule-based graph intents
		if query_type in {"find_usage", "flow", "impact_analysis"}:
			from app.services.rag import run_rag_pipeline
			answer, _, _, impact_edges = run_rag_pipeline(
				query=payload.query,
				top_k=payload.top_k,
				file_name=effective_file_name,
				repo_indexed=repo_mode,
			)
			yield f"data: {_json.dumps({'type': 'token', 'data': answer})}\n\n"
			latency_ms = round((time.perf_counter() - t0) * 1000, 1)
			done_event = {
				'type': 'done', 
				'query_type': query_type, 
				'latency_ms': latency_ms
			}
			if impact_edges:
				done_event['impact_edges'] = impact_edges
			yield f"data: {_json.dumps(done_event)}\n\n"
			return

		try:
			chunks = retrieve_relevant_chunks(
				query=payload.query,
				top_k=payload.top_k,
				mode=effective_mode,
				file_name=effective_file_name,
			)
			chunks = _expand_chunks_with_call_graph(
				query=payload.query,
				retrieved_chunks=chunks,
				max_depth=1,
				mode=effective_mode,
				file_name=effective_file_name,
			)
			context = build_context(chunks)
		except Exception as exc:
			yield f"data: {_json.dumps({'type': 'error', 'data': str(exc)})}\n\n"
			return

		# ── Try Gemini streaming first ─────────────────────────────────────────────
		gemini_key = os.getenv("GEMINI_API_KEY", "")
		if gemini_key:
			try:
				from google import genai as _genai
				_gclient = _genai.Client(api_key=gemini_key)
				model_name = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash")
				user_prompt = (
					"You are a code assistant.\n"
					"Use the provided context to answer the question.\n\n"
					f"Context:\n{context}\n\n"
					f"Question:\n{payload.query}\n\n"
					"Answer clearly and concisely."
				)
				for chunk_resp in _gclient.models.generate_content_stream(
					model=model_name, contents=user_prompt
				):
					token = ""
					if hasattr(chunk_resp, "text") and chunk_resp.text:
						token = chunk_resp.text
					if token:
						yield f"data: {_json.dumps({'type': 'token', 'data': token})}\n\n"
				latency_ms = round((time.perf_counter() - t0) * 1000, 1)
				yield f"data: {_json.dumps({'type': 'done', 'query_type': query_type, 'latency_ms': latency_ms})}\n\n"
				return
			except Exception as exc:
				logger.warning("Gemini streaming failed: %s — falling back to non-streaming", exc)

		# ── Non-streaming fallback (Groq / Ollama / local) ───────────────────────
		try:
			from app.services.rag import generate_answer
			answer = generate_answer(query=payload.query, context=context, chunks=chunks)
		except Exception as exc:
			yield f"data: {_json.dumps({'type': 'error', 'data': str(exc)})}\n\n"
			return

		# Emit the full answer as a single token so the client can render it.
		yield f"data: {_json.dumps({'type': 'token', 'data': answer})}\n\n"
		latency_ms = round((time.perf_counter() - t0) * 1000, 1)
		yield f"data: {_json.dumps({'type': 'done', 'query_type': query_type, 'latency_ms': latency_ms})}\n\n"

	return StreamingResponse(
		event_stream(),
		media_type="text/event-stream",
		headers={
			"Cache-Control": "no-cache",
			"X-Accel-Buffering": "no",
		},
	)
