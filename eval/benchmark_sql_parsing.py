import os
import sys
import glob

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.sql_parsing import build_jinja_env, parse_sql_model

def run_benchmark(repo_path: str):
    if not os.path.exists(repo_path):
        print(f"Error: {repo_path} does not exist. Please clone jaffle_shop first.")
        return

    models_dir = os.path.join(repo_path, 'models')
    sql_files = glob.glob(os.path.join(models_dir, '**', '*.sql'), recursive=True)
    
    if not sql_files:
        print(f"No .sql files found in {models_dir}")
        return

    print(f"Found {len(sql_files)} SQL models.")
    
    env, macro_content = build_jinja_env(repo_path)
    print(f"Loaded macro environment.")

    total_models = len(sql_files)
    success_count = 0
    total_parse_time = 0.0

    print("-" * 50)
    for filepath in sql_files:
        result = parse_sql_model(repo_path, filepath, macro_content, env)
        if not result:
            continue
            
        model_name = result['model_name']
        if result['parse_success']:
            success_count += 1
            status = "SUCCESS"
        else:
            status = "FAILED"

        total_parse_time += result['parse_time']
        
        refs = len(result['refs'])
        sources = len(result['sources'])
        print(f"{model_name:<30} | {status} | {result['parse_time'] * 1000:5.1f}ms | refs: {refs}, sources: {sources}")

    print("-" * 50)
    success_rate = (success_count / total_models) * 100
    mean_parse_time = (total_parse_time / total_models) * 1000

    print(f"\nBenchmark Results:")
    print(f"Total Models: {total_models}")
    print(f"Parse Success Rate: {success_rate:.1f}%")
    print(f"Mean Parse Time: {mean_parse_time:.1f} ms/model")

if __name__ == "__main__":
    jaffle_shop_path = os.path.join(os.path.dirname(__file__), "..", "jaffle_shop")
    run_benchmark(jaffle_shop_path)
