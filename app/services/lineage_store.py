import logging
import os
import psycopg2

logger = logging.getLogger(__name__)

_table_initialized = False


def _postgres_dsn() -> str:
    dsn = os.getenv("POSTGRES_DSN")
    return dsn or ""


def _ensure_table(conn) -> None:
    global _table_initialized

    if _table_initialized:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS lineage_edges (
                id BIGSERIAL PRIMARY KEY,
                source_model TEXT NOT NULL,
                source_column TEXT NOT NULL,
                target_model TEXT NOT NULL,
                target_column TEXT NOT NULL,
                transformation_type TEXT NOT NULL,
                UNIQUE (source_model, source_column, target_model, target_column)
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_lineage_source
            ON lineage_edges (source_model, source_column)
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_lineage_target
            ON lineage_edges (target_model, target_column)
            """
        )

    conn.commit()
    _table_initialized = True


def upsert_lineage_edges(edges: list[dict]) -> int:
    """
    Edges should be a list of dictionaries with keys:
    source_model, source_column, target_model, target_column, transformation_type
    """
    if not edges:
        return 0

    dsn = _postgres_dsn()
    if not dsn:
        logger.info("Postgres not configured, skipping lineage storage")
        return 0

    rows = 0
    try:
        with psycopg2.connect(dsn) as conn:
            _ensure_table(conn)

            with conn.cursor() as cur:
                for edge in edges:
                    cur.execute(
                        """
                        INSERT INTO lineage_edges 
                        (source_model, source_column, target_model, target_column, transformation_type)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (source_model, source_column, target_model, target_column)
                        DO UPDATE SET transformation_type = EXCLUDED.transformation_type
                        """,
                        (
                            edge["source_model"],
                            edge["source_column"],
                            edge["target_model"],
                            edge["target_column"],
                            edge["transformation_type"]
                        ),
                    )
                    rows += 1

            conn.commit()
            logger.debug(f"Upserted {rows} lineage edges")
    except Exception as e:
        logger.exception("Failed to upsert lineage edges")
        raise

    return rows

def get_all_lineage_edges() -> list[dict]:
    dsn = _postgres_dsn()
    if not dsn:
        return []
        
    edges = []
    try:
        with psycopg2.connect(dsn) as conn:
            _ensure_table(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT source_model, source_column, target_model, target_column, transformation_type 
                    FROM lineage_edges
                    """
                )
                for row in cur.fetchall():
                    edges.append({
                        "source_model": row[0],
                        "source_column": row[1],
                        "target_model": row[2],
                        "target_column": row[3],
                        "transformation_type": row[4]
                    })
    except Exception:
        logger.exception("Failed to get lineage edges")
        
    return edges
