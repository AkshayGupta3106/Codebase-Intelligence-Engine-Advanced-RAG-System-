import os
import sys

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services import hybrid_search

# SQL Domain Golden Set: (query, expected_file_name)
# We only care if the correct model (file_name) is retrieved in top 3
GOLDEN_SET = [
    ("How is the customer lifetime value calculated?", "customers.sql"),
    ("Where does the first name of a customer come from?", "stg_customers.sql"),
    ("Show me how orders are staged.", "stg_orders.sql"),
    ("What model aggregates payments?", "stg_payments.sql"),
    ("Who depends on the raw customers table?", "stg_customers.sql"),
    ("How many orders did a customer make?", "customers.sql"),
    ("What is the most recent order date?", "customers.sql"),
]

def evaluate_retrieval(use_reranker: bool):
    # Hack to disable/enable reranker
    hybrid_search._reranker_available = use_reranker
    if not use_reranker:
        hybrid_search._reranker = None
    else:
        # Force initialization
        hybrid_search._get_reranker()

    hit_count = 0
    mrr_sum = 0.0
    
    import time
    start = time.time()
    
    for query, expected_model in GOLDEN_SET:
        results = hybrid_search.hybrid_search(query, top_k=3)
        
        # Check hit @ 3
        found = False
        rank = 0
        for i, res in enumerate(results):
            if str(res.get("file_name", "")).endswith(expected_model):
                found = True
                rank = i + 1
                break
                
        if found:
            hit_count += 1
            mrr_sum += 1.0 / rank
            
    latency = (time.time() - start) * 1000 / len(GOLDEN_SET)
    hit_rate = hit_count / len(GOLDEN_SET)
    mrr = mrr_sum / len(GOLDEN_SET)
    
    return hit_rate, mrr, latency

def main():
    print("Evaluating WITHOUT Cross-Encoder (RRF only)...")
    hr_base, mrr_base, lat_base = evaluate_retrieval(False)
    
    print("Evaluating WITH Cross-Encoder...")
    hr_rerank, mrr_rerank, lat_rerank = evaluate_retrieval(True)
    
    print("-" * 50)
    print(f"Hit Rate @3:  {hr_base:.2f} -> {hr_rerank:.2f} (Uplift: {hr_rerank - hr_base:+.2f})")
    print(f"MRR:          {mrr_base:.2f} -> {mrr_rerank:.2f} (Uplift: {mrr_rerank - mrr_base:+.2f})")
    print(f"Mean Latency: {lat_base:.1f}ms -> {lat_rerank:.1f}ms (Added: {lat_rerank - lat_base:+.1f}ms)")
    print("-" * 50)

if __name__ == "__main__":
    main()
