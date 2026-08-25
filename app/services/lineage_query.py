import os
from typing import Literal

import networkx as nx
from app.services.lineage_store import get_all_lineage_edges


_lineage_digraph = nx.DiGraph()


def _qualified_name(model_name: str, column_name: str) -> str:
    return f"{model_name}.{column_name}"


def _base_column_name(node_name: str) -> str:
    if "." in node_name:
        return node_name.split(".", 1)[1]
    return node_name


def _matching_nodes(node_query: str) -> list[str]:
    name = str(node_query)
    if _lineage_digraph.has_node(name):
        return [name]

    # Handle queries that are just model names or just column names
    matches = []
    for node in _lineage_digraph.nodes:
        node_str = str(node)
        if node_str == name or node_str.startswith(f"{name}.") or node_str.endswith(f".{name}"):
            matches.append(node_str)
            
    return matches


def build_graph(edges: list[dict]) -> nx.DiGraph:
    graph = nx.DiGraph()

    for edge in edges:
        src = _qualified_name(edge["source_model"], edge["source_column"])
        tgt = _qualified_name(edge["target_model"], edge["target_column"])
        
        graph.add_node(src)
        graph.add_node(tgt)
        graph.add_edge(src, tgt, type=edge["transformation_type"])

    global _lineage_digraph
    _lineage_digraph = graph
    return graph


def get_upstream(node_query: str) -> list[str]:
    """Equivalent to get_callers. Finds where this node gets data from."""
    matched_nodes = _matching_nodes(node_query)
    if not matched_nodes:
        return []

    upstream: list[str] = []
    seen: set[str] = set()
    for node in matched_nodes:
        for parent in _lineage_digraph.predecessors(node):
            parent_str = str(parent)
            if parent_str in seen:
                continue
            seen.add(parent_str)
            upstream.append(parent_str)

    return upstream


def get_downstream(node_query: str) -> list[str]:
    """Equivalent to get_callees. Finds what depends on this node."""
    matched_nodes = _matching_nodes(node_query)
    if not matched_nodes:
        return []

    downstream: list[str] = []
    seen: set[str] = set()
    for node in matched_nodes:
        for child in _lineage_digraph.successors(node):
            child_str = str(child)
            if child_str in seen:
                continue
            seen.add(child_str)
            downstream.append(child_str)

    return downstream


def expand_with_graph(node_queries: list[str], max_depth: int = 1) -> list[str]:
    return expand_with_graph_mode(
        node_queries=node_queries,
        max_depth=max_depth,
        mode="both",
    )


def expand_with_graph_mode(
    node_queries: list[str],
    max_depth: int = 1,
    mode: Literal["upstream", "downstream", "both"] = "both",
) -> list[str]:
    valid_inputs: list[str] = []
    for name in node_queries:
        valid_inputs.extend(_matching_nodes(str(name)))
    valid_inputs = list(dict.fromkeys(valid_inputs))

    if max_depth <= 0:
        return list(dict.fromkeys(valid_inputs))

    seen: set[str] = set()
    expanded_nodes: list[str] = []
    frontier: list[str] = []

    for normalized in valid_inputs:
        if normalized in seen:
            continue
        seen.add(normalized)
        expanded_nodes.append(normalized)
        frontier.append(normalized)

    for _ in range(max_depth):
        next_frontier: list[str] = []

        for fn_name in frontier:
            neighbors: list[str] = []
            if _lineage_digraph.has_node(fn_name):
                if mode in {"downstream", "both"}:
                    neighbors.extend(_lineage_digraph.successors(fn_name))
                if mode in {"upstream", "both"}:
                    neighbors.extend(_lineage_digraph.predecessors(fn_name))

            for neighbor in neighbors:
                normalized_neighbor = str(neighbor)
                if normalized_neighbor in seen:
                    continue
                seen.add(normalized_neighbor)
                expanded_nodes.append(normalized_neighbor)
                next_frontier.append(normalized_neighbor)

        if not next_frontier:
            break
        frontier = next_frontier

    return expanded_nodes


def refresh_graph_from_db():
    edges = get_all_lineage_edges()
    build_graph(edges)
