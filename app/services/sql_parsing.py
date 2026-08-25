import os
import glob
import time
from typing import List, Dict, Tuple, Any, Optional
import sqlglot
from sqlglot import exp
from jinja2 import Environment, FileSystemLoader, meta, BaseLoader, Template

import logging

logger = logging.getLogger(__name__)

class DbtContext:
    def __init__(self):
        self.refs = []
        self.sources = []
        
    def ref(self, *args):
        # dbt ref can be ref('model') or ref('package', 'model')
        if len(args) == 1:
            model_name = args[0]
            self.refs.append(model_name)
            return model_name
        elif len(args) == 2:
            package_name, model_name = args
            self.refs.append(model_name)
            return f"{package_name}_{model_name}"
        return "unknown_ref"

    def source(self, source_name, table_name):
        self.sources.append((source_name, table_name))
        return f"{source_name}_{table_name}"
        
    def config(self, *args, **kwargs):
        return ""

def build_jinja_env(repo_path: str) -> Environment:
    """Build a Jinja environment that includes all macros from the repo."""
    # We use a BaseLoader but actually load from a dict of macros
    env = Environment(loader=BaseLoader())
    
    macros_dir = os.path.join(repo_path, 'macros')
    macro_content = ""
    
    if os.path.exists(macros_dir):
        for root, _, files in os.walk(macros_dir):
            for file in files:
                if file.endswith('.sql'):
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        macro_content += f.read() + "\n"
                        
    # Load all macros as a base template block we prefix to the queries
    return env, macro_content

def render_dbt_model(sql_content: str, macro_content: str, env: Environment) -> Tuple[str, DbtContext]:
    """Render a dbt model and track its refs/sources."""
    context = DbtContext()
    
    # We combine macro content and the sql content so macros are available
    full_template = macro_content + "\n" + sql_content
    
    try:
        template = env.from_string(full_template)
        # Some common dbt variables and functions
        rendered_sql = template.render(
            ref=context.ref,
            source=context.source,
            config=context.config,
            is_incremental=lambda: False,
            target={"name": "dev", "schema": "dev", "type": "postgres"},
            run_started_at="2024-01-01",
            invocation_id="1234"
        )
        return rendered_sql, context
    except Exception as e:
        logger.warning(f"Jinja rendering failed: {e}")
        # Return unrendered SQL as fallback, stripping basic Jinja
        fallback_sql = sql_content.replace("{{", "").replace("}}", "")
        return fallback_sql, context

def parse_sql_model(repo_path: str, filepath: str, macro_content: str, env: Environment) -> Optional[Dict[str, Any]]:
    """Parse a single SQL file and return structured info."""
    with open(filepath, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    start_time = time.time()
    rendered_sql, context = render_dbt_model(sql_content, macro_content, env)
    render_time = time.time() - start_time

    start_time = time.time()
    try:
        # Use postgres as default dialect for dbt projects unless specified
        ast = sqlglot.parse_one(rendered_sql, dialect="postgres", error_level=sqlglot.ErrorLevel.IGNORE)
        parse_success = True
    except Exception as e:
        ast = None
        parse_success = False
    parse_time = time.time() - start_time

    model_name = os.path.basename(filepath).replace(".sql", "")
    
    return {
        "model_name": model_name,
        "filepath": filepath,
        "raw_sql": sql_content,
        "rendered_sql": rendered_sql,
        "ast": ast,
        "refs": context.refs,
        "sources": context.sources,
        "parse_success": parse_success,
        "render_time": render_time,
        "parse_time": parse_time
    }
