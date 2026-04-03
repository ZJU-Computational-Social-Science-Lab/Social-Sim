/**
 * Step 6: Prompt Preview
 *
 * Displays a preview of exactly what each agent type will see
 * at the start of the simulation. This matches the backend's
 * prompt_builder.py build_prompt() function template.
 *
 * Shows only the first agent type as full preview panel,
 * with remaining types shown as compact list.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { AlertCircle } from 'lucide-react';

interface PromptPreviewPanelProps {
  agentTypeLabel: string;
  agentTypeProfile: string;
  agentTypeRolePrompt: string;
  agentTypeProperties: Record<string, unknown>;
  scenarioId: string;
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;
  availableActions: Array<{ name: string; description: string }>;
  selectedActionIds: string[];
  totalAgents: number;
}

/**
 * Component that renders the prompt preview for a single agent type.
 * Matches the 5-section prompt structure from backend's prompt_builder.py:
 * 1. Agent Description
 * 2. Scenario (with parameters intertwined for PGG)
 * 3. Available Actions (phase-filtered for PGG)
 * 4. Context (first round - no previous context)
 * 5. Output Format (JSON response instruction)
 */
const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  agentTypeLabel,
  agentTypeProfile,
  agentTypeRolePrompt,
  agentTypeProperties,
  scenarioId,
  scenarioDescription,
  scenarioParams,
  availableActions,
  selectedActionIds,
  totalAgents,
}) => {
  // Filter actions to only selected ones
  const selectedActions = availableActions.filter((a) =>
    selectedActionIds.includes(a.name)
  );

  // For PUBLIC_GOODS: filter to only contribute phase actions for first round
  const contributePhaseActions = selectedActions.filter((a) =>
    ['Allocate', 'Keep'].includes(a.name)
  );

  // For PUBLIC_GOODS: use contribute phase actions, otherwise use all selected
  const displayActions = scenarioId === 'public_goods' ? contributePhaseActions : selectedActions;

  // Build actions list string
  const actionsList = displayActions
    .map((a) => `- ${a.name}: ${a.description}`)
    .join('\n  ');

  // Build the actions string for the response format
  const actionsForResponse = displayActions.map((a) => `"${a.name}"`).join(' or ');

  // Format parameter key for display (snake_case to Title Case)
  const formatParamKey = (key: string): string => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Build formatted scenario description for PUBLIC_GOODS
  const getFormattedScenario = () => {
    if (scenarioId === 'public_goods') {
      const tokensPerRound = scenarioParams.tokens_per_round ?? 10;
      const resourceName = scenarioParams.resource_name ?? 'tokens';
      const multiplier = scenarioParams.multiplier ?? 1.3;
      const numMembers = totalAgents || 4;
      const deductionBudget = scenarioParams.deduction_budget_per_phase ?? 0;
      const deductionCostRatio = scenarioParams.deduction_cost_ratio ?? 3;
      const deductionAnonymous = scenarioParams.deduction_anonymous ?? false;

      // Use the base description if provided, otherwise use default
      // Replace "agent" with "person/member" for more realistic LLM framing
      const rawDescription = scenarioDescription ||
        'Each person has resources and decides how much to contribute to a shared pool. The pool is multiplied and distributed equally among all members, regardless of contribution.';
      const baseDescription = rawDescription.replace(/\bagent(s)?\b/gi, (match) =>
        match.toLowerCase() === 'agents' ? 'members' : 'person'
      );

      // Build the scenario with contribution mechanics
      let formattedScenario = `In this experiment, you receive ${tokensPerRound} ${resourceName} each round. ${baseDescription}\n\nThe total group contribution is multiplied by ${multiplier} and distributed equally among all ${numMembers} members. You keep any ${resourceName} you do not allocate.`;

      // Add deduction mechanics if enabled
      if (deductionBudget > 0) {
        const anonymityText = deductionAnonymous
          ? 'Your reductions are anonymous - targets will not know who reduced their resources.'
          : 'Your reductions are visible - targets will see who reduced their resources.';
        formattedScenario += `\n\nAfter the contribution phase, you have the opportunity to reduce other members' ${resourceName}. You have a deduction budget of ${deductionBudget} points. For each 1 point from your budget, the target loses ${deductionCostRatio} ${resourceName}. ${anonymityText}`;
      }

      return formattedScenario;
    }
    return scenarioDescription;
  };

  // Determine which parameters to show (exclude PGG params that are already in scenario)
  const getDisplayParams = () => {
    if (scenarioId === 'public_goods') {
      // Don't show resource_name, tokens_per_round, multiplier, deduction params - they're in the scenario
      const excludedKeys = [
        'resource_name',
        'tokens_per_round',
        'multiplier',
        'initial_amount',
        'deduction_budget_per_phase',
        'deduction_cost_ratio',
        'deduction_anonymous',
      ];
      return Object.entries(scenarioParams).filter(([key]) => !excludedKeys.includes(key));
    }
    return Object.entries(scenarioParams);
  };

  const displayParams = getDisplayParams();
  const formattedScenario = getFormattedScenario();

  return (
    <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-gray-200 px-4 py-2 border-b border-gray-300">
        <span className="text-sm font-semibold text-gray-700">
          Agent Type: "{agentTypeLabel}"
        </span>
      </div>

      {/* Prompt Content */}
      <div className="p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap bg-white">
        {/* Section 1: Agent Description */}
        <div className="mb-4">
          <span className="text-blue-600">You are</span> {agentTypeLabel}.
          {/*
            Display agent description - prefer rolePrompt if available,
            fall back to profile. Don't show both if they contain the same content
            (demographic generator sets both to the same value).
          */}
          {agentTypeRolePrompt ? (
            <>
              {' '}
              {agentTypeRolePrompt}
            </>
          ) : agentTypeProfile ? (
            <>
              {' '}
              {agentTypeProfile}
            </>
          ) : null}
        </div>

        {/* Section 2: Scenario (with intertwined parameters for PGG) */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 mb-1">Scenario:</div>
          {formattedScenario || (
            <span className="text-gray-400 italic">No scenario description provided</span>
          )}
        </div>

        {/* Section 2b: Additional Game Parameters (only non-PGG or non-intertwined params) */}
        {displayParams.length > 0 && (
          <div className="mb-4">
            <div className="font-semibold text-gray-900 mb-1">Additional Parameters:</div>
            <div className="pl-2">
              {displayParams.map(([key, value]) => (
                <div key={key}>- {formatParamKey(key)}: {String(value)}</div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Available Actions (phase-filtered for PGG) */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 mb-1">Available actions:</div>
          {displayActions.length > 0 ? (
            <div className="pl-2">{actionsList}</div>
          ) : (
            <span className="text-gray-400 italic">No actions selected</span>
          )}
        </div>

        {/* Section 4: Context */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 mb-1">Context:</div>
          <div className="pl-2">This is the first round.</div>
        </div>

        {/* Section 5: Output Format */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="font-semibold text-gray-900 mb-1">Your Response:</div>
          {displayActions.length > 0 ? (
            <div className="pl-2">
              Respond with only JSON: {`{{"action": <${actionsForResponse}>}}`}
            </div>
          ) : (
            <div className="pl-2 text-gray-400 italic">
              Add actions in Step 3 to see the response format
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Step6Structure: React.FC = () => {
  const { t } = useTranslation();
  const {
    agentTypes,
    selectedScenarioId,
    scenarioDescription,
    scenarioParams,
    availableActions,
    selectedActionIds,
  } = useExperimentBuilder();

  const totalAgents = agentTypes.reduce((sum, t) => sum + t.count, 0);

  // If no agents defined, show warning
  if (agentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('experimentBuilder.step6.noAgentsDefined')}
          </h3>
          <p className="text-gray-600">
            {t('experimentBuilder.step6.goBackToStep4')}
          </p>
        </div>
      </div>
    );
  }

  const firstAgentType = agentTypes[0];
  const remainingAgentTypes = agentTypes.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900">
          {t('experimentBuilder.promptPreview.title')} (Agent Type: {firstAgentType.label})
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          {t('experimentBuilder.promptPreview.note', { n: agentTypes.length })}
        </p>
      </div>

      {/* Full preview for first agent type */}
      <PromptPreviewPanel
        agentTypeLabel={firstAgentType.label}
        agentTypeProfile={firstAgentType.userProfile || ''}
        agentTypeRolePrompt={firstAgentType.rolePrompt || ''}
        agentTypeProperties={firstAgentType.properties || {}}
        scenarioId={selectedScenarioId || ''}
        scenarioDescription={scenarioDescription}
        scenarioParams={scenarioParams}
        availableActions={availableActions}
        selectedActionIds={selectedActionIds}
        totalAgents={totalAgents}
      />

      {/* Compact list for remaining agent types */}
      {remainingAgentTypes.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3">
            {t('experimentBuilder.promptPreview.otherTypes')}
          </h4>
          <div className="space-y-2">
            {remainingAgentTypes.map(type => (
              <div key={type.id} className="bg-gray-50 rounded p-3">
                <div className="font-medium">{type.label}</div>
                {type.rolePrompt && (
                  <div className="text-sm text-gray-600 mt-1">
                    Role: {type.rolePrompt}
                  </div>
                )}
                {type.userProfile && (
                  <div className="text-sm text-gray-600 mt-1">
                    Profile: {type.userProfile}
                  </div>
                )}
                {Object.entries(type.properties || {}).filter(([key]) => !['avatarUrl', 'llm_config', 'provider_id'].includes(key)).length > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    Properties:{' '}
                    {Object.entries(type.properties || {})
                      .filter(([key]) => !['avatarUrl', 'llm_config', 'provider_id'].includes(key))
                      .map(([key, value]) => `${key}=${String(value)}`)
                      .join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600">
        {t('experimentBuilder.step6.totalAgentsTypes', { agents: totalAgents, types: agentTypes.length })}
      </div>
    </div>
  );
};
