import logging
import os

from dotenv import load_dotenv
from google import genai

# Always reload .env so hot-reload picks up key changes without a full restart
load_dotenv(override=True)

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
FALLBACK_DIMENSION = 3072  # gemini-embedding-001 output dimension

logger = logging.getLogger(__name__)

_client = None
_client_key: str = ""  # track which key the client was built for


def get_client():
	"""Return a Gemini client, rebuilding if the API key has changed since last call."""
	global _client, _client_key
	# Re-read env every time so hot-reload / .env changes are picked up
	from dotenv import load_dotenv
	load_dotenv(override=True)
	
	api_key = os.getenv("GEMINI_API_KEY", "").strip()
	if not api_key:
		raise ValueError("GEMINI_API_KEY not set or empty")
	if _client is None or api_key != _client_key:
		_client = genai.Client(api_key=api_key)
		_client_key = api_key
	return _client


def get_embedding_model(model_name: str = DEFAULT_EMBEDDING_MODEL) -> str:
	return model_name


def generate_embeddings(chunks: list[str], model_name: str = DEFAULT_EMBEDDING_MODEL) -> list[list[float]]:
	"""Generate embeddings for a list of text chunks.

	Falls back to zero vectors on any API failure so the ingestion pipeline
	never crashes due to embedding errors.
	"""
	if not chunks:
		return []

	# Check key availability once upfront — log a warning so it's visible
	try:
		gemini_client = get_client()
	except ValueError as e:
		logger.warning("Embedding client unavailable: %s — using zero-vector fallbacks", e)
		return [[0.0] * FALLBACK_DIMENSION for _ in chunks]

	embeddings: list[list[float]] = []
	for chunk in chunks:
		try:
			response = gemini_client.models.embed_content(
				model=model_name,
				contents=chunk,
			)
			vals = list(response.embeddings[0].values)
			if vals:
				embeddings.append(vals)
			else:
				embeddings.append([0.0] * FALLBACK_DIMENSION)
		except Exception as e:
			logger.warning("Embedding failed for chunk (len=%d): %s", len(chunk), e)
			embeddings.append([0.0] * FALLBACK_DIMENSION)

	return embeddings


def embedding_dimension(model_name: str = DEFAULT_EMBEDDING_MODEL) -> int:
	"""Return the dimensionality of the embedding model.

	Returns FALLBACK_DIMENSION if the API is unreachable.
	"""
	try:
		gemini_client = get_client()
		response = gemini_client.models.embed_content(model=model_name, contents="dimension probe")
		embedding = list(response.embeddings[0].values)
		return len(embedding) if embedding else FALLBACK_DIMENSION
	except Exception as e:
		logger.warning("Could not probe embedding dimension: %s", e)
		return FALLBACK_DIMENSION
