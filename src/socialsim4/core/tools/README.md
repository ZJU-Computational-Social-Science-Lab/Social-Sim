Tools

web/
- search.py   Deterministic stub for web search (prototype)
- view.py     Deterministic stub for page view/capture
- http.py     Minimal HTTP plumbing used by actions; network is scene/policy‑controlled

Notes
- Tools are minimal and scene‑agnostic; actions call them with strict inputs.
- Errors propagate to the caller; no retries or fallbacks.

