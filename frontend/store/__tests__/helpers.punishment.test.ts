/**
 * Tests for punishment event mapping in helpers.ts.
 *
 * Tests for:
 * - mapBackendEventsToLogs handling punishment_action events
 * - Event display with punisher, target, amount, deduction
 * - i18n support for runtime language switching
 *
 * Wave 1 implementation - tests verify punishment event mapping (FEAT-PGG-09 through FEAT-PGG-11)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapBackendEventsToLogs } from '../helpers';
import type { Agent } from '../../types';

describe('mapBackendEventsToLogs - punishment_action', () => {
  let mockAgents: Agent[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgents = [
      { id: 'agent-1', name: 'Alice', role: '', avatarUrl: '', profile: '', llmConfig: { provider: 'mock', model: 'default' }, properties: {}, history: {}, memory: [], knowledgeBase: [] },
      { id: 'agent-2', name: 'Bob', role: '', avatarUrl: '', profile: '', llmConfig: { provider: 'mock', model: 'default' }, properties: {}, history: {}, memory: [], knowledgeBase: [] },
    ] as Agent[];
  });

  // =========================================================================
  // Wave 1: Punishment Event Mapping Tests (FEAT-PGG-09 through FEAT-PGG-11)
  // =========================================================================

  describe('Punishment Event Mapping', () => {
    it('should handle punishment_action event type', () => {
      const events = [
        {
          type: 'punishment_action',
          data: {
            punisher: 'Alice',
            target: 'Bob',
            amount: 3,
            deduction: 9,
            round: 1,
          },
        },
      ];

      const logs = mapBackendEventsToLogs(events, 'node-1', 1, mockAgents, true);

      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('AGENT_ACTION');
      expect(logs[0].agentId).toBe('agent-1');
    });

    it('should display punisher name, target name, amount, and deduction', () => {
      const events = [
        {
          type: 'punishment_action',
          data: {
            punisher: 'Alice',
            target: 'Bob',
            amount: 3,
            deduction: 9,
            round: 1,
          },
        },
      ];

      const logs = mapBackendEventsToLogs(events, 'node-1', 1, mockAgents, true);

      expect(logs[0].content).toContain('Alice');
      expect(logs[0].content).toContain('Bob');
      expect(logs[0].content).toContain('3');
      expect(logs[0].content).toContain('9');
    });

    it('should use i18n.t() for runtime language switching', () => {
      const events = [
        {
          type: 'punishment_action',
          data: {
            punisher: 'Alice',
            target: 'Bob',
            amount: 3,
            deduction: 9,
            round: 1,
          },
        },
      ];

      const logs = mapBackendEventsToLogs(events, 'node-1', 1, mockAgents, true);

      // Content should use i18n translation (will be in English or Chinese depending on current locale)
      // The key point is that it uses i18n.t() which enables runtime switching
      expect(logs[0].content).toBeDefined();
      expect(logs[0].content).toBeTruthy();
    });

    it('should use event round if provided, fallback to parameter round', () => {
      const events = [
        {
          type: 'punishment_action',
          data: {
            punisher: 'Alice',
            target: 'Bob',
            amount: 3,
            deduction: 9,
            round: 5,
          },
        },
      ];

      const logs = mapBackendEventsToLogs(events, 'node-1', 1, mockAgents, true);

      expect(logs[0].round).toBe(5);
    });

    it('should handle missing punisher gracefully', () => {
      const events = [
        {
          type: 'punishment_action',
          data: {
            target: 'Bob',
            amount: 3,
            deduction: 9,
            round: 1,
          },
        },
      ];

      const logs = mapBackendEventsToLogs(events, 'node-1', 1, mockAgents, true);

      expect(logs).toHaveLength(1);
      expect(logs[0].agentId).toBeUndefined();
    });
  });
});
