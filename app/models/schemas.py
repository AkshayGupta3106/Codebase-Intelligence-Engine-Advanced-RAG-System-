from pydantic import BaseModel
from pydantic import Field


class QueryRequest(BaseModel):
	query: str = Field(min_length=1)
	top_k: int = Field(default=5, ge=1)


class RetrievedChunk(BaseModel):
	id: str
	score: float
	file_name: str | None = None
	chunk_index: int | None = None
	chunk_text: str | None = None
	# Structural metadata (populated for AST-parsed chunks)
	name: str | None = None
	type: str | None = None
	start_line: int | None = None
	end_line: int | None = None
	docstring: str | None = None


class ImpactEdge(BaseModel):
	model: str
	column: str
	depth: int
	relation: str  # "upstream" or "downstream"


class QueryResponse(BaseModel):
	query: str
	answer: str
	retrieved_chunks: list[RetrievedChunk]
	# Intent classification label returned by the query classifier
	query_type: str | None = None
	# End-to-end latency of the RAG pipeline in milliseconds
	latency_ms: float | None = None
	# Impact analysis edges (populated when query_type is impact_analysis)
	impact_edges: list[ImpactEdge] | None = None
