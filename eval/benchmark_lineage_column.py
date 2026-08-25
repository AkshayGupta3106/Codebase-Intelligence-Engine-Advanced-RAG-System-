import os
import sys

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.sql_parsing import build_jinja_env, parse_sql_model
from app.services.lineage_extractor import extract_all_column_lineages

# Golden set: (model, column, source_model)
# (In a real scenario, this would have actual source columns, but testing source models is a good proxy)
GOLDEN_SET = [
    # 1-hop
    ("stg_customers", "customer_id", "raw_customers"),
    ("stg_customers", "first_name", "raw_customers"),
    ("stg_customers", "last_name", "raw_customers"),
    
    # 2-hop
    ("customers", "first_name", "raw_customers"),
    ("customers", "last_name", "raw_customers"),
    
    # 3-hop (Aggregations/CTEs)
    ("customers", "first_order", "stg_orders"),
    ("customers", "most_recent_order", "stg_orders"),
    ("customers", "number_of_orders", "stg_orders"),
    ("customers", "customer_lifetime_value", "stg_payments"),
]

def main():
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "jaffle_shop"))
    if not os.path.exists(repo_path):
        print("jaffle_shop not found.")
        return
        
    env, macro_content = build_jinja_env(repo_path)
    
    # Parse models
    models = ["stg_customers.sql", "stg_orders.sql", "stg_payments.sql", "customers.sql"]
    parsed = {}
    for m in models:
        # Search for the model
        for root, _, files in os.walk(os.path.join(repo_path, "models")):
            if m in files:
                filepath = os.path.join(root, m)
                res = parse_sql_model(repo_path, filepath, macro_content, env)
                if res and res['parse_success']:
                    parsed[res['model_name']] = res
                    break
                    
    sources_dict = {name: data['rendered_sql'] for name, data in parsed.items()}
    
    extracted_edges = set()
    for name, data in parsed.items():
        edges = extract_all_column_lineages(data['rendered_sql'], name, sources_dict)
        for edge in edges:
            extracted_edges.add((name, edge['target_column'], edge['source_model']))
            
    # Calculate Precision and Recall against Golden Set
    true_positives = 0
    
    for g_model, g_col, g_src_model in GOLDEN_SET:
        # Look if there's any edge matching
        matched = any(
            e[0] == g_model and e[1] == g_col and e[2] == g_src_model
            for e in extracted_edges
        )
        if matched:
            true_positives += 1
        else:
            print(f"Missed: {g_model}.{g_col} -> {g_src_model}")
            
    total_golden = len(GOLDEN_SET)
    # Only count predicted edges for the models in GOLDEN_SET
    relevant_extracted = [e for e in extracted_edges if any(g[0] == e[0] for g in GOLDEN_SET)]
    total_extracted = len(relevant_extracted)
    
    precision = true_positives / total_extracted if total_extracted > 0 else 0
    recall = true_positives / total_golden if total_golden > 0 else 0
    
    print("-" * 50)
    print(f"Column-level precision: {precision:.3f}")
    print(f"Column-level recall: {recall:.3f}")

if __name__ == "__main__":
    main()
