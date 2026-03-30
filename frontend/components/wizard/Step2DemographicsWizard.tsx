import React from 'react';
import { Upload, Sparkles, Loader2, Plus, Minus } from 'lucide-react';
import { Agent } from '../../types';
import { Demographic, Archetype, TraitConfig } from './hooks/useDemographicsBuilder';

export interface Step2AgentsPreviewProps {
  agents: Agent[];
  onClear: () => void;
  t: (key: string, params?: any) => string;
}

export const Step2AgentsPreview: React.FC<Step2AgentsPreviewProps> = ({ agents, onClear, t }) => {
  return (
    <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-white">
      <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
        <span className="text-xs font-bold text-slate-700">
          {t('wizard.step2.generatedAgents', { count: agents.length })}
        </span>
        <button onClick={onClear} className="text-xs text-red-500 hover:underline">
          {t('wizard.step2.clearReset')}
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 sticky top-0 text-slate-500">
            <tr>
              <th className="px-4 py-2">{t('wizard.step2.name')}</th>
              <th className="px-4 py-2">{t('wizard.step2.role')}</th>
              <th className="px-4 py-2">{t('wizard.step2.description')}</th>
              <th className="px-4 py-2">{t('wizard.step2.attributes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {agents.map((a, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold">{a.name}</td>
                <td className="px-4 py-2">{a.role}</td>
                <td className="px-4 py-2 max-w-xs truncate" title={a.profile}>{a.profile}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{JSON.stringify(a.properties)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export interface Step2DemographicsEditorProps {
  demographics: Demographic[];
  archetypes: Archetype[];
  traits: TraitConfig[];
  useDemographics: boolean;
  genCount: number;
  isGenerating: boolean;
  onAddDemographic: () => void;
  onRemoveDemographic: (id: string) => void;
  onUpdateDemographicName: (id: string, name: string) => void;
  onUpdateDemographicCategories: (id: string, categories: string) => void;
  onUpdateCategoryName: (demoId: string, catIndex: number, value: string) => void;
  onAddCategory: (demoId: string) => void;
  onRemoveCategory: (demoId: string, catIndex: number) => void;
  onUpdateArchetypeProbability: (archId: string, newProb: number) => void;
  onNormalizeProbabilities: () => void;
  onAddTrait: () => void;
  onRemoveTrait: (id: string) => void;
  onUpdateTrait: (id: string, field: keyof TraitConfig, value: string | number) => void;
  onSetGenCount: (count: number) => void;
  onGenerateAgents: () => void;
  customAgents: Agent[];
  setCustomAgents: (agents: Agent[]) => void;
  importError: string | null;
  t: (key: string, params?: any) => string;
}

export const Step2DemographicsEditor: React.FC<Step2DemographicsEditorProps> = ({
  demographics, archetypes, traits, genCount, isGenerating,
  onAddDemographic, onRemoveDemographic, onUpdateDemographicName, onUpdateDemographicCategories,
  onUpdateCategoryName, onAddCategory, onRemoveCategory, onUpdateArchetypeProbability,
  onNormalizeProbabilities, onAddTrait, onRemoveTrait, onUpdateTrait, onSetGenCount,
  onGenerateAgents, customAgents, setCustomAgents, importError, t
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.demographics')}</h4>
          <button onClick={onAddDemographic} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1">
            <Plus size={14} /> {t('wizard.step2.addDimension')}
          </button>
        </div>
        <div className="space-y-3">
          {demographics.map((demo) => (
            <div key={demo.id} className="border border-slate-200 rounded p-3 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={demo.name} onChange={(e) => onUpdateDemographicName(demo.id, e.target.value)} placeholder={t('wizard.step2.dimensionNamePlaceholder')} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"/>
                {demographics.length > 1 && <button onClick={() => onRemoveDemographic(demo.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Minus size={16} /></button>}
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">{t('wizard.step2.categoriesLabel')}</div>
                {demo.categories.map((cat, catIdx) => (
                  <div key={catIdx} className="flex items-center gap-2">
                    <input type="text" value={cat} onChange={(e) => onUpdateCategoryName(demo.id, catIdx, e.target.value)} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"/>
                    {demo.categories.length > 1 && <button onClick={() => onRemoveCategory(demo.id, catIdx)} className="p-1 text-red-400 hover:text-red-600"><Minus size={14} /></button>}
                  </div>
                ))}
                <button onClick={() => onAddCategory(demo.id)} className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded flex items-center gap-1">
                  <Plus size={12} /> {t('wizard.step2.addCategory')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {archetypes.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.archetypes', { count: archetypes.length })}</h4>
              <span className="text-xs text-slate-500">{t('wizard.step2.archetypesHint')}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">{t('wizard.step2.totalProbability')}: <span className={Math.abs(archetypes.reduce((sum, a) => sum + a.probability, 0) - 1.0) < 0.01 ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>{archetypes.reduce((sum, a) => sum + a.probability, 0).toFixed(2)}</span> {t('wizard.step2.shouldBeOne')}</div>
              <button onClick={onNormalizeProbabilities} className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded mt-1">{t('wizard.step2.normalizeAll')}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {archetypes.map((arch) => (
              <div key={arch.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="font-medium text-slate-700 truncate mb-1" title={arch.label}>{arch.label}</div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-500">{t('wizard.step2.probability')}:</label>
                  <input type="number" min="0" max="1" step="0.01" value={arch.probability.toFixed(2)} onChange={(e) => onUpdateArchetypeProbability(arch.id, parseFloat(e.target.value) || 0)} className="flex-1 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"/>
                  <span className="text-slate-500">({(arch.probability * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">{t('wizard.step2.modifyProbabilityHint')}</p>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.traits')}</h4>
          <button onClick={onAddTrait} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1">
            <Plus size={14} /> {t('wizard.step2.addTrait')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {traits.map((trait) => (
            <div key={trait.id} className="border border-slate-200 rounded p-2 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={trait.name} onChange={(e) => onUpdateTrait(trait.id, 'name', e.target.value)} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm font-medium"/>
                {traits.length > 1 && <button onClick={() => onRemoveTrait(trait.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Minus size={16} /></button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">{t('wizard.step2.mean')}</label>
                  <input type="number" min="0" max="100" value={trait.mean} onChange={(e) => onUpdateTrait(trait.id, 'mean', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">{t('wizard.step2.std')}</label>
                  <input type="number" min="0" max="50" value={trait.std} onChange={(e) => onUpdateTrait(trait.id, 'std', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm"/>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">{t('wizard.step2.traitsHint')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div>
          <label className="block text-xs font-bold text-blue-800 mb-2">{t('wizard.step2.generateCount')}</label>
          <input type="number" min="1" value={genCount} onChange={(e) => onSetGenCount(Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-3 py-2 border border-blue-200 rounded text-sm focus:ring-blue-500"/>
        </div>
        <div className="flex items-end">
          <button onClick={onGenerateAgents} disabled={isGenerating} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('wizard.step2.startGeneration')}
          </button>
        </div>
      </div>

      {importError && <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">{importError}</div>}
      {customAgents.length > 0 ? (
        <Step2AgentsPreview agents={customAgents} onClear={() => setCustomAgents([])} t={t} />
      ) : (
        <div className="text-xs text-slate-500 text-center py-2">{t('wizard.step2.noAgentsGenerated')}</div>
      )}
    </div>
  );
};
