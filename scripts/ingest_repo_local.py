import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.routes import _index_repo_file, SUPPORTED_REPO_EXTENSIONS, SKIPPED_REPO_DIRECTORIES
from app.services.context_state import set_repo_indexed

def ingest_local(repo_dir: str):
    base_dir = Path(repo_dir).resolve()
    print(f"Indexing local repo: {base_dir}")
    
    count = 0
    for file_path in base_dir.rglob("*"):
        if any(part in SKIPPED_REPO_DIRECTORIES for part in file_path.parts):
            continue
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in SUPPORTED_REPO_EXTENSIONS:
            continue
            
        print(f"Indexing {file_path.relative_to(base_dir)}")
        success = _index_repo_file(base_dir, file_path)
        if success:
            count += 1
            
    set_repo_indexed(True)
    print(f"Successfully indexed {count} files.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        repo_dir = sys.argv[1]
    else:
        repo_dir = "jaffle_shop"
        
    ingest_local(repo_dir)
