# Dynamic Environment Feature Design

**Date:** 2026-02-01
**Status:** Design Approved
**Branch:** `feature/dynamic-environment`

## Overview

Add a dynamic environment feature where the "environment" proposes potential upcoming environmental events based on recent dialogue, actions, and global status. Presented to users every 5 turns, only when requested.

Event types are dynamically determined by the LLM based on context:
- Weather changes (rain, snow, storms, temperature)
- Small-scale emergencies (fire, power outage, medical emergencies)
- Institutional notifications (government announcements, policy changes)
- Public opinion fluctuations (trending topics, sentiment shifts, rumors)

## Architecture

### Components

1. **Environment Analyzer** (`core/environment_analyzer.py`)
   - Summarizes recent simulation context
   - Passes summary to LLM for event suggestion generation
   - Gathers: dialogue summaries (last 5 turns), key agent actions, global state metrics

2. **Environment Suggestion Service** (`services/environment_suggestion_service.py`)
   - Backend API service for suggestion management
   - Endpoints: check availability, generate suggestions, apply events

3. **Event System Enhancement** (`core/event.py`)
   - New `EnvironmentEvent` class for environmental occurrences

### Flow

1. Every 5 turns, simulator sets `suggestions_available = true` (no LLM call yet)
2. Frontend shows indicator: "Environmental event suggestions available"
3. Only when user clicks "View Suggestions", LLM generates 2-3 contextually appropriate events
4. User can apply one (broadcast to all agents) or skip

This lazy/on-demand approach ensures zero performance cost for users not using the feature.

## Context Summarization & LLM Integration

### Data Collection

- **SimTree logs**: All events from last 5 turns via `simtree.get_recent_events(turn_count=5)`
- **Agent memories**: Sample short-term memories for agent perspectives
- **Scene state**: Current time, weather, location context

### Summarization Pipeline

LLM prompt generates structured JSON summary:
```json
{
  "themes": ["resource conflict", "emergency preparedness"],
  "notable_actions": ["agent_A gathered supplies", "agent_B called meeting"],
  "sentiment": "tense",
  "suggested_event_types": ["small-scale emergency", "institutional notification"]
}
```

Second LLM call generates 2-3 specific event suggestions.

Uses user's configured LLM provider for consistency with existing agent behavior.

## Event Broadcasting & Agent Reaction

### EnvironmentEvent Class

```python
class EnvironmentEvent(Event):
    event_type: str  # "weather", "emergency", "notification", "opinion"
    description: str
    severity: str  # "mild", "moderate", "severe"
```

### Broadcasting

Broadcast through existing simulator event system (similar to `PublicEvent`).
All agents receive event in their next turn processing.

### Agent Reaction

No agent code changes needed. Event automatically added to agent short-term memory as system message. Agents react naturally based on:
- Personality traits
- Current plans/goals
- Relationship to event content

## Frontend Integration & API

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/simulations/{sim_id}/suggestions/status` | Check if suggestions available |
| `POST /api/simulations/{sim_id}/suggestions/generate` | Generate 2-3 event suggestions |
| `POST /api/simulations/{sim_id}/events/environment` | Broadcast accepted event |

### Frontend Components

1. **Suggestion Indicator** - Badge/notification appearing every 5 turns
2. **Suggestions Dialog** - Modal with event suggestions, Apply/Dismiss buttons
3. **Event Display in Timeline** - Distinct visual style for applied events

### State Management

Add to existing Zustand store:
- `suggestionsAvailable`
- `currentSuggestions`
- `lastSuggestionTurn`

Polling or WebSocket updates for turn count changes.

## Configuration & Error Handling

### Configuration Class

```python
class EnvironmentConfig:
    enabled: bool = True
    turn_interval: int = 5
    max_suggestions: int = 3
    require_llm_provider: bool = True
```

Stored per-simulation in scene state.

### Error Handling

- **LLM unavailable**: Indicator doesn't appear
- **LLM failure**: Error message with retry option
- **Broadcast failure**: Rollback and notify user
- **Rate limiting**: Prevent duplicate generation within 5-turn window

### Edge Cases

- Skip turn at 5 turns → preserve available flag
- Create branch → suggestion flag resets in new branch
- Apply event → logged permanently in branch timeline

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/socialsim4/core/environment_analyzer.py` | Create |
| `src/socialsim4/core/event.py` | Add `EnvironmentEvent` |
| `src/socialsim4/core/environment_config.py` | Create |
| `src/socialsim4/backend/routes/environment.py` | Create |
| `src/socialsim4/services/environment_suggestion_service.py` | Create |
| `src/socialsim4/core/simulator.py` | Add turn tracking flag |
| `frontend/src/components/EnvironmentSuggestion.tsx` | Create |
| `frontend/src/stores/simulationStore.ts` | Add environment state |

## Testing Strategy

### Unit Tests (`tests/test_environment_analyzer.py`)

- Mock LLM responses for context summarization
- Test turn interval calculation
- Test feature disabled behavior
- Test event serialization/deserialization

### Integration Tests (`tests/test_environment_integration.py`)

- Run 5 turns, verify suggestion available
- Mock LLM, generate suggestions, verify return
- Apply event, verify broadcast to all agents
- Verify events in SimTree logs

### Frontend Tests

- Indicator appearance at correct turns
- Dialog states (loading, success, error)
- Applied events render in timeline

### Manual Testing Scenarios

1. Run 5 turns, verify indicator appears
2. Generate suggestions, verify contextual relevance
3. Apply weather event, verify agents reference in dialogue
4. Create branch at turn 5, verify independent suggestions
5. Disable feature, verify no indicator
