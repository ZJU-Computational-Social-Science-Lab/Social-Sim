/**
 * Agent panel component for the workspace view.
 *
 * Renders a scrollable list of AgentCard components for all agents
 * in the current simulation. Provides the container layout for agent display.
 *
 * Exports: AgentPanel
 */
import React from 'react';
import { useSimulationStore } from '../store';
import { AgentCard } from './AgentCard';

export const AgentPanel: React.FC = () => {
  const agents = useSimulationStore(state => state.agents);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--ss-workspace-surface)' }}>
      <div className="flex-1 overflow-y-auto">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
};
