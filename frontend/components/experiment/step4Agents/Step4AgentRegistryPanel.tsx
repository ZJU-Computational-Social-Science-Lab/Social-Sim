import { Search } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AgentCollection } from '../../../utils/agentCollections';
import type { ManualAgentType, LLMProvider } from '../../../store/experiment-builder';
import { Button } from '../../ui/button';
import { FieldBlock } from '../workflow/FieldBlock';
import { ParticipantCard } from '../workflow/ParticipantCard';
import { ResearchInputPanel } from '../workflow/ResearchInputPanel';
import { SummaryInfoCard } from '../workflow/SummaryInfoCard';
import type { EditablePropertyDraft, TierValue } from './utils';

interface Step4AgentRegistryPanelProps {
  t: TFunction;
  totalAgents: number;
  agentTypes: ManualAgentType[];
  agentCollections: AgentCollection[];
  providerCount: number;
  sharedPropertyCount: number;
  filteredAgentCollections: AgentCollection[];
  selectedCollection: AgentCollection | null;
  selectedEditorAgent: ManualAgentType | null;
  selectedEditorAvatarUrl: string;
  selectedEditorTier: string;
  selectedEditableProperties: EditablePropertyDraft[];
  sharedPropertyOwners: Record<string, string[]>;
  llmProviders: LLMProvider[];
  tierOrder: string[];
  showTierControls: boolean;
  agentDirectoryQuery: string;
  setAgentDirectoryQuery: (value: string) => void;
  setSelectedEditorAgentId: (id: string) => void;
  updateAgentType: (id: string, updates: Partial<ManualAgentType>) => void;
  removeAgentType: (id: string) => void;
  handleUpdateTier: (id: string, tier: TierValue) => void;
  handleAddProperty: (id: string) => void;
  handleDraftPropertyChange: (agentId: string, rowId: string, field: 'key' | 'value', value: string) => void;
  handleCommitPropertyKey: (agentId: string, rowId: string) => void;
  handleCommitPropertyValue: (agentId: string, rowId: string) => void;
  handleRemoveProperty: (agentId: string, key: string) => void;
}

export function Step4AgentRegistryPanel({
  t,
  totalAgents,
  agentTypes,
  agentCollections,
  providerCount,
  sharedPropertyCount,
  filteredAgentCollections,
  selectedCollection,
  selectedEditorAgent,
  selectedEditorAvatarUrl,
  selectedEditorTier,
  selectedEditableProperties,
  sharedPropertyOwners,
  llmProviders,
  tierOrder,
  showTierControls,
  agentDirectoryQuery,
  setAgentDirectoryQuery,
  setSelectedEditorAgentId,
  updateAgentType,
  removeAgentType,
  handleUpdateTier,
  handleAddProperty,
  handleDraftPropertyChange,
  handleCommitPropertyKey,
  handleCommitPropertyValue,
  handleRemoveProperty,
}: Step4AgentRegistryPanelProps) {
  return (
    <ResearchInputPanel
      eyebrow={t('experimentBuilder.step4.agentListTitle', { defaultValue: 'Agent registry' })}
      title={t('experimentBuilder.step4.agentListTitle')}
      description={t('experimentBuilder.step4.totalAgents', { count: totalAgents })}
    >
      <div className="ss-workflow-summary-grid">
        <SummaryInfoCard
          label={t('experimentBuilder.step4.agentSummaryLabel', { defaultValue: 'Agents' })}
          value={totalAgents}
        />
        <SummaryInfoCard
          label={t('experimentBuilder.step4.collectionLabel', { defaultValue: 'Collections' })}
          value={agentCollections.length}
        />
        <SummaryInfoCard
          label={t('experimentBuilder.step4.providerSummaryLabel', { defaultValue: 'Providers' })}
          value={providerCount}
        />
        <SummaryInfoCard
          label={t('experimentBuilder.step4.sharedPropertyCountLabel', { defaultValue: 'Shared props' })}
          value={sharedPropertyCount}
        />
      </div>

      {agentTypes.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">{t('experimentBuilder.step4.noTypes')}</p>
      ) : (
        <div id="ss-step4-participant-registry" className="ss-participant-workflow__registry">
          <aside className="ss-participant-workflow__directory">
            <div className="ss-participant-workflow__search">
              <Search size={14} className="text-gray-400" />
              <input
                value={agentDirectoryQuery}
                onChange={(e) => setAgentDirectoryQuery(e.target.value)}
                placeholder={t('experimentBuilder.step4.searchAgents', { defaultValue: 'Search collections or representative profiles' })}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="mt-3 space-y-2 max-h-[720px] overflow-y-auto pr-1">
              {filteredAgentCollections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
                  {t('experimentBuilder.step4.noDirectoryResults', {
                    defaultValue: 'No collections match the current search.',
                  })}
                </div>
              ) : filteredAgentCollections.map((collection) => {
                const providerLabel =
                  llmProviders.find((provider) => provider.id === collection.providerId)?.name ||
                  t('experimentBuilder.step4.defaultProvider');
                const isSelected = selectedCollection?.key === collection.key;
                return (
                  <ParticipantCard
                    key={collection.key}
                    onClick={() => setSelectedEditorAgentId(collection.representative.id)}
                    selected={isSelected}
                    title={collection.title}
                    tag={showTierControls && collection.tier ? collection.tier : providerLabel}
                    description={
                      collection.representative.userProfile ||
                      collection.representative.rolePrompt ||
                      t('experimentBuilder.step4.noProperties')
                    }
                    meta={[
                      t('experimentBuilder.step4.agentsDefined', {
                        count: collection.count,
                        defaultValue: '{{count}} agents',
                      }),
                      `${collection.propertyCount} ${t('experimentBuilder.step4.properties').toLowerCase()}`,
                    ]}
                  />
                );
              })}
            </div>
          </aside>

          {selectedEditorAgent ? (
            <div id="ss-step4-participant-editor" className="ss-participant-workflow__editor">
              {selectedCollection ? (
                <div className="ss-participant-workflow__collection-summary">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="ss-workflow-kicker">
                        {t('experimentBuilder.step4.collectionLabel', { defaultValue: 'Agent collection' })}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {selectedCollection.title}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {t('experimentBuilder.step4.collectionHint', {
                          defaultValue: 'The main editor shows one representative profile for this category. Use the roster below if you need to inspect or tweak individual members.',
                        })}
                      </p>
                    </div>
                    <div className="ss-workflow-summary-grid">
                      <SummaryInfoCard
                        label={t('experimentBuilder.step4.collectionMembers', { defaultValue: 'Members' })}
                        value={selectedCollection.count}
                      />
                      <SummaryInfoCard
                        label={t('experimentBuilder.step4.sharedPropertyBadge', { defaultValue: 'Shared' })}
                        value={selectedCollection.propertyCount}
                      />
                      <SummaryInfoCard
                        label={t('experimentBuilder.step4.representativeLabel', { defaultValue: 'Representative' })}
                        value={selectedCollection.representative.label}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="ss-participant-workflow__editor-head">
                <img
                  src={selectedEditorAvatarUrl}
                  alt={selectedEditorAgent.label}
                  className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50"
                />
                <div className="ss-participant-workflow__fields">
                  <FieldBlock label={t('experimentBuilder.step4.agentName')}>
                    <input
                      id="ss-step4-editor-name"
                      type="text"
                      value={selectedEditorAgent.label}
                      onChange={(e) => updateAgentType(selectedEditorAgent.id, { label: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                    />
                  </FieldBlock>
                  {showTierControls && (
                    <FieldBlock label={t('experimentBuilder.step4.tier')}>
                      <select
                        value={selectedEditorTier}
                        onChange={(e) => handleUpdateTier(selectedEditorAgent.id, e.target.value as TierValue)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                      >
                        <option value="">{t('experimentBuilder.step4.autoDetectTier')}</option>
                        {tierOrder.map((tierOption) => (
                          <option key={tierOption} value={tierOption}>{tierOption}</option>
                        ))}
                      </select>
                    </FieldBlock>
                  )}
                  <FieldBlock
                    label={t('experimentBuilder.step4.userProfile')}
                    className="md:col-span-2"
                  >
                    <input
                      type="text"
                      value={selectedEditorAgent.userProfile || ''}
                      onChange={(e) => updateAgentType(selectedEditorAgent.id, { userProfile: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                    />
                  </FieldBlock>
                  <FieldBlock
                    label={t('experimentBuilder.step4.rolePrompt')}
                    helper={t('experimentBuilder.step4.rolePromptHelper', {
                      defaultValue: '用一句话说明这个智能体类型在实验中的角色、立场或行动倾向。',
                    })}
                    className="md:col-span-2"
                  >
                    <textarea
                      value={selectedEditorAgent.rolePrompt || ''}
                      onChange={(e) => updateAgentType(selectedEditorAgent.id, { rolePrompt: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                    />
                  </FieldBlock>
                  <FieldBlock label={t('experimentBuilder.step4.llmProvider')}>
                    <select
                      value={selectedEditorAgent.providerId ?? ''}
                      onChange={(e) => updateAgentType(selectedEditorAgent.id, { providerId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                    >
                      <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                      {llmProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>{provider.name}{provider.model ? ` (${provider.model})` : ''}</option>
                      ))}
                    </select>
                  </FieldBlock>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAgentType(selectedEditorAgent.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  {t('experimentBuilder.step4.remove')}
                </Button>
              </div>

              {selectedCollection && selectedCollection.members.length > 1 ? (
                <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-700">
                      {t('experimentBuilder.step4.memberRoster', { defaultValue: 'Member roster' })}
                    </div>
                    <span className="text-xs text-gray-500">
                      {t('experimentBuilder.step4.memberRosterHint', {
                        defaultValue: 'Switch members without reopening the whole category.',
                      })}
                    </span>
                  </div>
                  <div className="ss-participant-workflow__member-grid">
                    {selectedCollection.members.map((member) => (
                      <ParticipantCard
                        key={member.id}
                        onClick={() => setSelectedEditorAgentId(member.id)}
                        selected={member.id === selectedEditorAgent.id}
                        title={member.label}
                        description={
                          member.userProfile ||
                          member.rolePrompt ||
                          t('experimentBuilder.step4.noProperties')
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md bg-gray-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-700">{t('experimentBuilder.step4.properties')}</div>
                  <Button size="sm" variant="outline" onClick={() => handleAddProperty(selectedEditorAgent.id)}>
                    {t('experimentBuilder.step4.addProperty')}
                  </Button>
                </div>

                <div className="space-y-2">
                  {selectedEditableProperties.length === 0 && (
                    <div className="text-xs text-gray-500">{t('experimentBuilder.step4.noProperties')}</div>
                  )}
                  {selectedEditableProperties.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => handleDraftPropertyChange(selectedEditorAgent.id, item.id, 'key', e.target.value)}
                          onBlur={() => handleCommitPropertyKey(selectedEditorAgent.id, item.id)}
                          className="w-full px-2 py-1.5 pr-14 text-sm border border-gray-300 rounded bg-white"
                        />
                        {(sharedPropertyOwners[item.originalKey] || []).length > 1 && (
                          <span
                            title={t('experimentBuilder.step4.sharedPropertyTooltip', {
                              key: item.originalKey,
                              agents: sharedPropertyOwners[item.originalKey].join('、'),
                            })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-[rgba(47,230,166,0.14)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ss-brand-primary)] cursor-help"
                          >
                            {t('experimentBuilder.step4.sharedPropertyBadge')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleDraftPropertyChange(selectedEditorAgent.id, item.id, 'value', e.target.value)}
                        onBlur={() => handleCommitPropertyValue(selectedEditorAgent.id, item.id)}
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProperty(selectedEditorAgent.id, item.originalKey)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t('experimentBuilder.step4.remove')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ResearchInputPanel>
  );
}
