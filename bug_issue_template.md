# Bug: Documents Endpoint Returns 500 for Newly Created Agents

## Summary
The `/api/simulations/{sim_id}/agents/{agent_id}/documents` endpoint returns a 500 Internal Server Error when fetching documents for newly created agents (especially those generated via the demographic generation feature).

## Steps to Reproduce
1. Open Simulation Wizard
2. Configure demographics (e.g., Age: 18-30, 31-50, 51+; Location: Urban, Rural)
3. Generate agents (e.g., 50 agents)
4. Observe backend logs showing repeated 500 errors for document requests

## Expected Behavior
- The documents endpoint should return an empty list or handle the case where agents don't have documents yet
- Frontend should handle this gracefully without spamming the backend with failed requests

## Actual Behavior
- Backend returns 500 Internal Server Error
- Frontend repeatedly tries to fetch documents for each agent
- Backend logs show many errors like:
  ```
  GET /api/simulations/sim1769751834353/agents/Agent%201/documents?node_id=root HTTP/1.1" 500 Internal Server Error
  ```

## Environment
- Backend running on `http://0.0.0.0:8000`
- Using local Ollama models
- 50 agents generated via demographic generation

## Agent Generation Success
The agents ARE created successfully:
```
INFO: Generated 50 agents using demographic modeling
INFO: POST /api/llm/generate_agents_demographics HTTP/1.1" 201 Created
```

The issue is specifically with the documents endpoint being called after creation.

## Backend Log Snippet
```
INFO:     127.0.0.1:61871 - "POST /api/llm/generate_agents_demographics HTTP/1.1" 201 Created
INFO:     127.0.0.1:53236 - "GET /api/simulations/sim1769751834353/agents/Agent%201/documents?node_id=root HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:54613 - "GET /api/simulations/sim1769751834353/agents/Agent%203/documents?node_id=root HTTP/1.1" 500 Internal Server Error
...
```

## Possible Fix
The documents endpoint should handle the case where:
1. The agent exists but has no documents
2. The agent_id contains URL-encoded characters (like `Agent%201` for "Agent 1")
3. Return an empty list `[]` instead of 500 when no documents exist

## Priority
Medium - Doesn't block agent creation, but creates many error logs and may impact performance
