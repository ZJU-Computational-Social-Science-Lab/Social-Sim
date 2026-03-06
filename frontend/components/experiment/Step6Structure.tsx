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
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;
  availableActions: Array<{ name: string; description: string }>;
  selectedActionIds: string[];
}

/**
 * Component that renders the prompt preview for a single agent type.
 * Matches the 5-section prompt structure from backend's prompt_builder.py:
 * 1. Agent Description
 * 2. Scenario
 * 3. Available Actions
 * 4. Context (first round - no previous context)
 * 5. Output Format (JSON response instruction)
 */
const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  agentTypeLabel,
  agentTypeProfile,
  agentTypeRolePrompt,
  scenarioDescription,
  scenarioParams,
  availableActions,
  selectedActionIds,
}) => {
  // Filter actions to only selected ones
  const selectedActions = availableActions.filter((a) =>
    selectedActionIds.includes(a.name)
  );

  // Build actions list string
  const actionsList = selectedActions
    .map((a) => `- ${a.name}: ${a.description}`)
    .join('\n  ');

  // Build the actions string for the response format
  const actionsForResponse = selectedActions.map((a) => `"${a.name}"`).join(', ');

  // Format parameter key for display (snake_case to Title Case)
  const formatParamKey = (key: string): string => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

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
          {agentTypeRolePrompt && (
            <>
              {' '}
              {agentTypeRolePrompt}
            </>
          )}
          {agentTypeProfile && (
            <>
              {' '}
              {agentTypeProfile}
            </>
          )}
        </div>

        {/* Section 2: Scenario */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 mb-1">Scenario:</div>
          {scenarioDescription || (
            <span className="text-gray-400 italic">No scenario description provided</span>
          )}
        </div>

        {/* Section 2b: Game Parameters */}
        {Object.keys(scenarioParams).length > 0 && (
          <div className="mb-4">
            <div className="font-semibold text-gray-900 mb-1">Game Parameters:</div>
            <div className="pl-2">
              {Object.entries(scenarioParams).map(([key, value]) => (
                <div key={key}>- {formatParamKey(key)}: {String(value)}</div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Available Actions */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 mb-1">Available actions:</div>
          {selectedActions.length > 0 ? (
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
          {selectedActions.length > 0 ? (
            <div className="pl-2">
              Respond with only JSON: {`{{"action": "<${actionsForResponse}>"}}`}
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
            No Agents Defined
          </h3>
          <p className="text-gray-600">
            Go back to Step 4 to add agents to your experiment.
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
        scenarioDescription={scenarioDescription}
        scenarioParams={scenarioParams}
        availableActions={availableActions}
        selectedActionIds={selectedActionIds}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600">
        {totalAgents} total agents across {agentTypes.length} types
      </div>
    </div>
  );
};
