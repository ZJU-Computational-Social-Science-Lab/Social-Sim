/**
 * Step 5: Prompt Preview
 *
 * Displays a preview of exactly what each agent type will see
 * at the start of the simulation. This matches the backend's
 * prompt_builder.py build_prompt() function template.
 */

import React from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { AlertCircle } from 'lucide-react';

interface PromptPreviewPanelProps {
  agentTypeLabel: string;
  agentTypeProfile: string;
  agentTypeRolePrompt: string;
  scenarioDescription: string;
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

export const Step5Structure: React.FC = () => {
  const {
    agentTypes,
    scenarioDescription,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Agent Prompt Preview
        </h2>
        <p className="text-sm text-gray-600">
          This is exactly what each agent type will see at the start of the simulation
        </p>
      </div>

      {/* Preview Panels for each agent type */}
      <div className="space-y-6">
        {agentTypes.map((agentType) => (
          <PromptPreviewPanel
            key={agentType.id}
            agentTypeLabel={agentType.label}
            agentTypeProfile={agentType.userProfile || ''}
            agentTypeRolePrompt={agentType.rolePrompt || ''}
            scenarioDescription={scenarioDescription}
            availableActions={availableActions}
            selectedActionIds={selectedActionIds}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="flex justify-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-lg text-sm">
          <span className="font-medium">
            {totalAgents} total agent{totalAgents !== 1 ? 's' : ''} across {agentTypes.length} type
            {agentTypes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
