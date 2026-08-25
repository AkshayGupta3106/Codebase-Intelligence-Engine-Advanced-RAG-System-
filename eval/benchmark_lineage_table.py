import os
import sys
import glob
import json

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.sql_parsing import build_jinja_env, parse_sql_model

def get_dbt_manifest_edges(manifest_path: str):
    """Extract true table-level edges from dbt's manifest.json."""
    if not os.path.exists(manifest_path):
        print(f"Error: manifest not found at {manifest_path}")
        return set()

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    edges = set()
    for node_name, node_data in manifest.get('nodes', {}).items():
        if node_data.get('resource_type') == 'model':
            model_name = node_data.get('name')
            for dep in node_data.get('depends_on', {}).get('nodes', []):
                # dep is like 'model.jaffle_shop.stg_customers' or 'seed.jaffle_shop.raw_customers'
                dep_parts = dep.split('.')
                dep_name = dep_parts[-1]
                edges.add((dep_name, model_name))
    return edges

def get_predicted_edges(repo_path: str):
    """Extract predicted table-level edges using our sql parser."""
    env, macro_content = build_jinja_env(repo_path)
    
    models_dir = os.path.join(repo_path, 'models')
    sql_files = glob.glob(os.path.join(models_dir, '**', '*.sql'), recursive=True)
    
    edges = set()
    for filepath in sql_files:
        result = parse_sql_model(repo_path, filepath, macro_content, env)
        if not result or not result['parse_success']:
            continue
            
        model_name = result['model_name']
        for ref in result['refs']:
            edges.add((ref, model_name))
        for source_tuple in result['sources']:
            # source_tuple is (source_name, table_name)
            # In dbt manifest, sources often appear as source.package.name
            # We'll just use table_name to keep it simple, or 'source_name_table_name'
            # Jaffle shop uses seeds instead of sources, but we should handle it
            edges.add((source_tuple[1], model_name))
            
    return edges

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    parser.add_argument("--repo", required=True, help="Path to dbt repo")
    args = parser.parse_args()
    
    true_edges = get_dbt_manifest_edges(args.manifest)
    pred_edges = get_predicted_edges(args.repo)
    
    if not true_edges:
        print("No edges found in manifest.")
        return
        
    correct = true_edges.intersection(pred_edges)
    spurious = pred_edges - true_edges
    missed = true_edges - pred_edges
    
    precision = len(correct) / len(pred_edges) if pred_edges else 0
    recall = len(correct) / len(true_edges) if true_edges else 0
    spurious_rate = len(spurious) / len(pred_edges) if pred_edges else 0
    
    print(f"Total True Edges: {len(true_edges)}")
    print(f"Total Predicted Edges: {len(pred_edges)}")
    print(f"Correct Edges: {len(correct)}")
    print(f"Missed Edges: {len(missed)}")
    print(f"Spurious Edges: {len(spurious)}")
    print("-" * 50)
    print(f"Table-level precision: {precision:.3f}")
    print(f"Table-level recall: {recall:.3f}")
    print(f"Spurious edges (FP): {spurious_rate:.1%} of predicted")

if __name__ == "__main__":
    main()
