from io import BytesIO
from pypdf import PdfReader


def extract_text_from_txt(file_bytes: bytes) -> str:
	try:
		return file_bytes.decode("utf-8")
	except UnicodeDecodeError:
		return file_bytes.decode("latin-1")


def extract_text_from_pdf(file_bytes: bytes) -> str:
	reader = PdfReader(BytesIO(file_bytes))
	pages: list[str] = []

	for page in reader.pages:
		pages.append(page.extract_text() or "")

	return "\n".join(pages)


def extract_text(file_name: str, file_bytes: bytes) -> str:
	lowered = file_name.lower()

	if lowered.endswith(".txt"):
		return extract_text_from_txt(file_bytes)
	if lowered.endswith((".py", ".js", ".ts", ".go", ".sql", ".yml", ".yaml")):
		return extract_text_from_txt(file_bytes)
	if lowered.endswith(".pdf"):
		return extract_text_from_pdf(file_bytes)

	raise ValueError("Unsupported file type. Use .txt, .pdf, .py, .js, .ts, .go, .sql, or .yml")


def extract_python_chunks_and_graph(code: str, file_name: str) -> tuple[list[str], list[dict[str, object]], dict[str, list[str]]]:
	# Stubbed out for SQL rewrite
	return [], [], {}


def extract_code_chunks(code: str, file_name: str) -> tuple[list[str], list[dict[str, object]]]:
	# Stubbed out for SQL rewrite
	return [], []
