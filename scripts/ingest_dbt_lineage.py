import os
import sys
import glob

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.sql_parsing import build_jinja_env, parse_sql_model
from app.services.lineage_extractor import extract_all_column_lineages
from app.services.lineage_store import upsert_lineage_edges
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ingest_repo(repo_path: str):
    if not os.path.exists(repo_path):
        logger.error(f"Error: {repo_path} does not exist.")
        return

    env, macro_content = build_jinja_env(repo_path)
    
    models_dir = os.path.join(repo_path, 'models')
    sql_files = glob.glob(os.path.join(models_dir, '**', '*.sql'), recursive=True)
    
    parsed_models = {}
    
    logger.info(f"Parsing {len(sql_files)} SQL models...")
    for filepath in sql_files:
        result = parse_sql_model(repo_path, filepath, macro_content, env)
        if result and result['parse_success']:
            parsed_models[result['model_name']] = result
            
    # Build sources dictionary for column lineage
    sources_dict = {
        model_name: data['rendered_sql'] for model_name, data in parsed_models.items()
    }
    
    logger.info("Extracting lineage edges...")
    all_edges = []
    
    for model_name, data in parsed_models.items():
        # Add table-level edges from refs
        for ref in data['refs']:
            all_edges.append({
                "source_model": ref,
                "source_column": "*",
                "target_model": model_name,
                "target_column": "*",
                "transformation_type": "ref"
            })
            
        for source in data['sources']:
            all_edges.append({
                "source_model": source[1],
                "source_column": "*",
                "target_model": model_name,
                "target_column": "*",
                "transformation_type": "source"
            })
            
        # Add column-level edges
        col_edges = extract_all_column_lineages(data['rendered_sql'], model_name, sources_dict)
        all_edges.extend(col_edges)
        
    logger.info(f"Extracted {len(all_edges)} total edges.")
    
    # Upsert to postgres
    rows = upsert_lineage_edges(all_edges)
    logger.info(f"Upserted {rows} edges to database.")

if __name__ == "__main__":
    jaffle_shop_path = os.path.join(os.path.dirname(__file__), "..", "jaffle_shop")
    ingest_repo(jaffle_shop_path)
