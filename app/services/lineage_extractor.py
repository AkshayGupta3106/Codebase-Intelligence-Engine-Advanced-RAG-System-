import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
import sqlglot
from sqlglot.lineage import lineage
from app.services.sql_parsing import parse_sql_model, build_jinja_env

def extract_all_column_lineages(rendered_sql, model_name, sources_dict, dialect="postgres"):
    """Extract lineage for all output columns of a model."""
    edges = []
    if not rendered_sql:
        return edges

    try:
        model_ast = sqlglot.parse_one(rendered_sql, dialect=dialect)
    except Exception:
        return edges

    from sqlglot.optimizer.qualify import qualify
    try:
        model_ast = qualify(model_ast, dialect=dialect)
    except Exception:
        pass

    # Find the outermost SELECT query
    # In dbt, models are typically a single SELECT statement
    # If the AST is a Select, we can look at its expressions
    if isinstance(model_ast, sqlglot.exp.Query):
        # We need the final select expressions
        select = model_ast.this if isinstance(model_ast, sqlglot.exp.Subquery) else model_ast
        
        # In sqlglot, a Select object has a 'expressions' property
        if isinstance(select, sqlglot.exp.Select):
            for expr in select.expressions:
                # The output column name is its alias if it has one, otherwise the column name itself
                if isinstance(expr, sqlglot.exp.Alias):
                    out_col = expr.alias
                elif isinstance(expr, sqlglot.exp.Column):
                    out_col = expr.name
                else:
                    out_col = expr.name or str(expr)
                
                if out_col and out_col != "*":
                    sources = extract_column_lineage(model_ast, out_col, sources_dict, dialect)
                    for src_table, src_col in sources:
                        edges.append({
                            "source_model": src_table,
                            "source_column": src_col,
                            "target_model": model_name,
                            "target_column": out_col,
                            "transformation_type": "lineage"
                        })
    return edges

def extract_column_lineage(model_ast, output_column_name, sources_dict, dialect="postgres"):
    """
    Given a model AST and one of its output columns, trace back to the source tables/columns.
    sources_dict: dict mapping table names (e.g. from ref()) to their ASTs.
    """
    try:
        node = lineage(
            output_column_name,
            model_ast,
            sources=sources_dict,
            dialect=dialect
        )
        return get_source_columns(node)
    except Exception as e:
        print(f"Error extracting lineage for {output_column_name}: {e}")
        return []

def get_source_columns(node):
    """Recursively walk the lineage node tree to find leaf nodes (source tables/columns)"""
    sources = []
    
    # If the node has no downstream dependencies in the lineage tree, it's a source node
    # However, in sqlglot lineage, a node is a source if it represents a table column
    # The source name is typically node.source.name or node.name
    
    def walk(n):
        if not n.downstream:
            # It's a leaf node. We need to extract the table and column name
            # If it's a Table node, we can get the name
            if isinstance(n.expression, sqlglot.exp.Column):
                col = n.expression
                table = col.table
                col_name = col.name
                if table and col_name:
                    sources.append((table, col_name))
            elif isinstance(n.expression, sqlglot.exp.Table):
                table = n.expression.name
                sources.append((table, "*"))
        else:
            for d in n.downstream:
                walk(d)
                
    walk(node)
    # Deduplicate
    return list(set(sources))

if __name__ == "__main__":
    # Test on jaffle_shop
    repo_path = os.path.join(os.path.dirname(__file__), "..", "..", "jaffle_shop")
    env, macro_content = build_jinja_env(repo_path)
    
    stg_customers_path = os.path.join(repo_path, "models", "staging", "stg_customers.sql")
    stg_customers_res = parse_sql_model(repo_path, stg_customers_path, macro_content, env)
    
    customers_path = os.path.join(repo_path, "models", "customers.sql")
    customers_res = parse_sql_model(repo_path, customers_path, macro_content, env)
    
    sources = {
        "stg_customers": stg_customers_res["ast"]
    }
    
    print("Extracting all column lineages for customers.sql:")
    edges = extract_all_column_lineages(customers_res["rendered_sql"], "customers", sources)
    for edge in edges:
        print(f"{edge['source_model']}.{edge['source_column']} -> {edge['target_model']}.{edge['target_column']}")
