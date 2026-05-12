# Local Ollama Real LLM Regression Testing Plan

This suite treats real LLM behavior as product behavior, but for local development it uses only Ollama models running on this machine. It must not silently fall back to fake responses, OpenAI, Gemini, or any external API provider.

## Test Classes

1. Pure unit tests
   - Scenario registry and Custom Scenario v1 metadata.
   - Action registry and unknown-action failure semantics.
   - Graph visibility filtering with undirected edges.
   - Prompt section inclusion and exclusion.
   - SimTree state mechanics that do not need model calls.
   - Frontend rendering and payload mapping logic.

2. Local Ollama real LLM integration tests
   - Mark with `pytest.mark.real_llm`.
   - Require `SOCIALSIM_TEST_REAL_LLM=1`.
   - Default provider is `ollama` when `SOCIALSIM_TEST_LLM_PROVIDER` is omitted.
   - Require `SOCIALSIM_TEST_LLM_MODEL` to name a locally installed Ollama model.
   - Skip clearly when Ollama is not reachable, the model is missing, or preflight fails.
   - Validate actual message payloads where possible.
   - Keep agent counts and rounds small to control latency.

3. Future local Ollama Playwright E2E tests
   - Use a separate `real-llm` Playwright project.
   - Require the same opt-in environment gate.
   - Run small scenarios for one round unless a workflow needs more.
   - Fail on unparsable model output, invalid actions, or missing visible logs/results.

## Phase 1 Scope

- Real LLM Custom Scenario v1 integration: two agents, one round, `speak`/`skip` only, parseable JSON, valid action, emitted logs/history.
- Real LLM context/network visibility: A-B-C chain, A sees B history but not C, asserting the actual prompt payload sent to the local Ollama model.
- Real LLM action validity: small representative scenarios, real model output must select allowed actions.
- Non-LLM unit tests: action registry correctness, graph visibility filtering, prompt inclusion/exclusion, unknown action failure semantics.

## Ollama Setup

Use any locally installed Ollama model that follows JSON instructions reasonably well. Good starting points include:

- `llama3.1`
- `llama3.2`
- `qwen2.5`
- `mistral`
- `gemma2`

The tests do not hard-code a model. They read `SOCIALSIM_TEST_LLM_MODEL`.

```cmd
ollama serve
ollama list
ollama pull <model>
```

## Local App Startup

Backend terminal:

```cmd
cd C:\Users\Justin\Documents\ZJU_Work\Social-Sim
conda activate socialsim
set PYTHONPATH=C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src
uvicorn socialsim4.backend.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend terminal:

```cmd
cd C:\Users\Justin\Documents\ZJU_Work\Social-Sim\frontend
npm run dev
```

The Phase 1 pytest integration tests call Ollama directly through the core LLM client and do not require the backend or frontend servers, but these are the normal local workflow commands for app validation.

## Running Phase 1 Tests

Windows CMD:

```cmd
cd C:\Users\Justin\Documents\ZJU_Work\Social-Sim
conda activate socialsim
set PYTHONPATH=C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src
set SOCIALSIM_TEST_REAL_LLM=1
set SOCIALSIM_TEST_LLM_PROVIDER=ollama
set SOCIALSIM_TEST_LLM_MODEL=<model>
set OLLAMA_BASE_URL=http://localhost:11434
pytest tests/integration/test_real_llm_phase1.py -m real_llm -v
```

PowerShell:

```powershell
cd C:\Users\Justin\Documents\ZJU_Work\Social-Sim
conda activate socialsim
$env:PYTHONPATH="C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src"
$env:SOCIALSIM_TEST_REAL_LLM="1"
$env:SOCIALSIM_TEST_LLM_PROVIDER="ollama"
$env:SOCIALSIM_TEST_LLM_MODEL="<model>"
$env:OLLAMA_BASE_URL="http://localhost:11434"
pytest tests/integration/test_real_llm_phase1.py -m real_llm -v
```

`SOCIALSIM_TEST_LLM_PROVIDER` may be omitted; it defaults to `ollama`.

## Preflight Behavior

Before the real-LLM tests run, the fixture checks:

- `SOCIALSIM_TEST_REAL_LLM=1` is set.
- The provider is omitted or equals `ollama`.
- `SOCIALSIM_TEST_LLM_MODEL` is set.
- Ollama is reachable at `SOCIALSIM_TEST_LLM_BASE_URL`, `OLLAMA_BASE_URL`, or `http://localhost:11434`.
- The requested model exists in `ollama list`.
- The model can produce a basic response.
- The model can produce structured JSON that the production controller can parse for `{"action":"skip","message":null}`.

Expected skip messages include:

- `SOCIALSIM_TEST_REAL_LLM is not set`
- `Ollama is not reachable at http://localhost:11434`
- `Model llama3.1:8b is not installed locally. Run: ollama pull llama3.1:8b`
- `Ollama model <model> failed structured JSON preflight`

If a preflight passes but a scenario response later fails production parsing or action validation, the test fails. That is intentional.

## Product Expectations To Lock

- Network edges are undirected.
- Agents see connected-neighbor history plus explicitly public scenario information.
- Custom Scenario v1 supports only `speak` and `skip`.
- Custom prompts, selected parameters, agent identity, round number, action list, and JSON schema instructions appear in backend prompts.
- Unsupported actions and malformed output are recorded as explicit failures, never successful actions.
- Public Goods neighbor averages should be neighbor-only when networked context is enabled.

## Provider Policy

This Phase 1 suite is Ollama-only. OpenAI and Gemini paths are unsupported for these tests and are not documented as valid providers. If external-provider coverage is reintroduced later, it should be a separate explicitly named suite with separate environment gates.

## Phase 1 Runtime Note

Custom Scenario v1 now uses neighbor-based visibility through scenario metadata. The registry maps `custom` to `grouping_mode="neighbor"`, and `get_information_model("custom")` resolves to `scope_type="neighborhood"` through the normal scenario lookup path. The remaining behavior to lock more broadly is turn-order semantics across `simultaneous`, `sequential`, and `random_sequential` modes.
