/**
 * src/hooks/useStream.js
 * Custom hook for SSE streaming via fetch + ReadableStream.
 * Exposes: { status, answer, queryType, latencyMs, impactEdges, start, stop }
 * Status: 'idle' | 'connecting' | 'streaming' | 'done' | 'error'
 */

import { useCallback, useRef, useState } from 'react';
import { streamQuery, queryFull } from '../lib/api';

const INITIAL = {
  status: 'idle',     // 'idle' | 'connecting' | 'streaming' | 'done' | 'error'
  answer: '',
  queryType: null,
  latencyMs: null,
  impactEdges: null,
  error: null,
};

export function useStream() {
  const [state, setState] = useState(INITIAL);
  const abortRef = useRef(null);
  const t0Ref    = useRef(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async (query, top_k = 5) => {
    // Cancel any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    t0Ref.current = performance.now();

    setState({ ...INITIAL, status: 'connecting' });

    /* ── Try SSE streaming ─────────────────────────────────────────────── */
    try {
      const res = await streamQuery(query, top_k, controller.signal);

      // Signal: we are now reading the body
      setState(s => ({ ...s, status: 'streaming', answer: '' }));

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   accumulated = '';
      let   finalType   = null;
      let   finalMs     = null;
      let   finalEdges  = null;
      let   gotToken    = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));

            if (evt.type === 'token') {
              accumulated += evt.data;
              gotToken = true;
              setState(s => ({ ...s, answer: accumulated }));

            } else if (evt.type === 'done') {
              finalType  = evt.query_type  ?? null;
              finalMs    = evt.latency_ms  ?? null;
              finalEdges = evt.impact_edges ?? null;

            } else if (evt.type === 'error') {
              throw new Error(evt.data || 'Stream error');
            }
          } catch (parseErr) {
            // Skip malformed frames but re-throw real errors
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }

      if (gotToken) {
        setState({
          status:      'done',
          answer:      accumulated,
          queryType:   finalType,
          latencyMs:   finalMs ?? Math.round(performance.now() - t0Ref.current),
          impactEdges: finalEdges,
          error:       null,
        });
        return;
      }

      // Stream succeeded but no tokens — fall through to REST fallback
    } catch (streamErr) {
      if (streamErr.name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        return;
      }
      console.warn('[useStream] SSE failed, falling back to REST:', streamErr.message);
    }

    /* ── REST fallback ─────────────────────────────────────────────────── */
    try {
      setState(s => ({ ...s, status: 'connecting' }));
      const data = await queryFull(query, top_k, controller.signal);
      setState({
        status:      'done',
        answer:      data.answer ?? '',
        queryType:   data.query_type  ?? null,
        latencyMs:   data.latency_ms  ?? Math.round(performance.now() - t0Ref.current),
        impactEdges: data.impact_edges ?? null,
        error:       null,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        return;
      }
      setState({
        ...INITIAL,
        status: 'error',
        error:  err.message || 'Unknown error',
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { ...state, start, stop, reset };
}
