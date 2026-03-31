/**
 * Demographics builder component for simulation wizard.
 *
 * Allows configuration of agent demographics, traits, and LLM distribution
 * for generating agent populations. Fetches available LLM providers
 * from the backend API.
 *
 * Exports: DemographicsBuilder (default)
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listProviders, type Provider } from '../services/providers';

interface Demographic {
  name: string;
  categories: string[];
}

interface Trait {
  name: string;
  mean: number;
  std: number;
}

export interface LLMAllocation {
  providerId: number;
  providerName: string;
  modelName: string;
  percentage: number;
}

interface DemographicsBuilderProps {
  totalAgents: number;
  setTotalAgents: (n: number) => void;
  demographics: Demographic[];
  setDemographics: (d: Demographic[]) => void;
  traits: Trait[];
  setTraits: (t: Trait[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  llmAllocations: LLMAllocation[];
  setLlmAllocations: (allocations: LLMAllocation[]) => void;
}

export const DemographicsBuilder: React.FC<DemographicsBuilderProps> = ({
  totalAgents,
  setTotalAgents,
  demographics,
  setDemographics,
  traits,
  setTraits,
  onGenerate,
  isGenerating,
  llmAllocations = [],
  setLlmAllocations
}) => {
  const { t } = useTranslation();
  const [newDemographicName, setNewDemographicName] = useState('');
  const [newDemographicCategories, setNewDemographicCategories] = useState('');
  const [newTraitName, setNewTraitName] = useState('');
  const [newTraitMean, setNewTraitMean] = useState(50);
  const [newTraitStd, setNewTraitStd] = useState(20);

  // LLM Distribution state
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState<boolean>(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  // Fetch available LLM providers
  useEffect(() => {
    const fetchProviders = async () => {
      setProvidersLoading(true);
      setProvidersError(null);
      try {
        const providers = await listProviders();
        setAvailableProviders(providers);
      } catch (err) {
        console.error('Failed to fetch LLM providers:', err);
        setProvidersError(t('wizard.llmDistribution.loadProvidersError', { defaultValue: 'Failed to load LLM providers. Please try again.' }));
      } finally {
        setProvidersLoading(false);
      }
    };
    fetchProviders();
  }, [t]);

  // LLM Distribution handlers
  const addLlmAllocation = () => {
    if (availableProviders.length === 0) return;
    const firstProvider = availableProviders[0];
    const newAllocation: LLMAllocation = {
      providerId: firstProvider.id,
      providerName: firstProvider.provider,
      modelName: firstProvider.model,
      percentage: 0
    };
    setLlmAllocations([...llmAllocations, newAllocation]);
  };

  const removeLlmAllocation = (index: number) => {
    setLlmAllocations(llmAllocations.filter((_, i) => i !== index));
  };

  const updateLlmAllocation = (index: number, field: keyof LLMAllocation, value: string | number) => {
    const updated = [...llmAllocations];
    if (field === 'providerId') {
      const provider = availableProviders.find(p => p.id === value);
      if (provider) {
        updated[index] = {
          ...updated[index],
          providerId: provider.id,
          providerName: provider.provider,
          modelName: provider.model
        };
      }
    } else {
      (updated[index] as any)[field] = value;
    }
    setLlmAllocations(updated);
  };

  // Calculate total percentage
  const totalPercentage = llmAllocations.reduce((sum, a) => sum + a.percentage, 0);
  const isLlmDistributionValid = llmAllocations.length === 0 || totalPercentage === 100;

  const addDemographic = () => {
    if (!newDemographicName || !newDemographicCategories) return;
    const categories = newDemographicCategories.split(',').map(c => c.trim()).filter(Boolean);
    if (categories.length === 0) return;
    setDemographics([...demographics, { name: newDemographicName, categories }]);
    setNewDemographicName('');
    setNewDemographicCategories('');
  };

  const removeDemographic = (index: number) => {
    setDemographics(demographics.filter((_, i) => i !== index));
  };

  const addTrait = () => {
    if (!newTraitName) return;
    setTraits([...traits, { name: newTraitName, mean: newTraitMean, std: newTraitStd }]);
    setNewTraitName('');
    setNewTraitMean(50);
    setNewTraitStd(20);
  };

  const removeTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Total Agents */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('wizard.demographics.totalAgents', { defaultValue: 'Total Agents' })}
        </label>
        <input
          type="number"
          min="1"
          max="500"
          value={totalAgents}
          onChange={(e) => setTotalAgents(parseInt(e.target.value) || 1)}
          className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Demographics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {t('wizard.demographics.title', { defaultValue: 'Demographics' })}
        </h3>
        <div className="space-y-2 mb-3">
          {demographics.map((demo, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <span className="font-medium text-slate-700">{demo.name}:</span>
              <span className="text-sm text-slate-600">{demo.categories.join(', ')}</span>
              <button
                onClick={() => removeDemographic(index)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('wizard.demographics.namePlaceholder')}
            value={newDemographicName}
            onChange={(e) => setNewDemographicName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder={t('wizard.demographics.categoriesPlaceholder', { defaultValue: 'Categories (comma-separated)' })}
            value={newDemographicCategories}
            onChange={(e) => setNewDemographicCategories(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={addDemographic}
            className="px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Traits */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {t('wizard.demographics.traitsTitle', { defaultValue: 'Traits (Normal Distribution)' })}
        </h3>
        <div className="space-y-2 mb-3">
          {traits.map((trait, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <span className="font-medium text-slate-700">{trait.name}:</span>
              <span className="text-sm text-slate-600">
                μ={trait.mean}, σ={trait.std}
              </span>
              <button
                onClick={() => removeTrait(index)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input
            type="text"
            placeholder={t('wizard.demographics.traitNamePlaceholder', { defaultValue: 'Trait name' })}
            value={newTraitName}
            onChange={(e) => setNewTraitName(e.target.value)}
            className="col-span-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder={t('wizard.demographics.meanPlaceholder', { defaultValue: 'Mean' })}
            value={newTraitMean}
            onChange={(e) => setNewTraitMean(parseInt(e.target.value) || 50)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder={t('wizard.demographics.stdPlaceholder', { defaultValue: 'Std' })}
            value={newTraitStd}
            onChange={(e) => setNewTraitStd(parseInt(e.target.value) || 20)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={addTrait}
            className="px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* LLM Distribution */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {t('wizard.llmDistribution.title', { defaultValue: 'LLM Distribution' })}
        </h3>

        {providersLoading ? (
          <div className="flex items-center justify-center py-4 text-slate-500">
            <Loader2 size={18} className="animate-spin mr-2" />
            {t('wizard.llmDistribution.loadingProviders', { defaultValue: 'Loading providers...' })}
          </div>
        ) : providersError ? (
          <div className="flex items-center justify-between py-3 px-3 bg-red-50 rounded-lg">
            <span className="text-sm text-red-600">{providersError}</span>
            <button
              onClick={() => {
                setProvidersError(null);
                setProvidersLoading(true);
                listProviders().then(setAvailableProviders).catch(() => {
                  setProvidersError(t('wizard.llmDistribution.loadProvidersError', { defaultValue: 'Failed to load LLM providers. Please try again.' }));
                }).finally(() => setProvidersLoading(false));
              }}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <RefreshCw size={14} />
              {t('wizard.llmDistribution.retry', { defaultValue: 'Retry' })}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              {llmAllocations.map((allocation, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <select
                    value={allocation.providerId}
                    onChange={(e) => updateLlmAllocation(index, 'providerId', Number(e.target.value))}
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    {availableProviders.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.provider} - {p.model}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={allocation.percentage || ''}
                    onChange={(e) => updateLlmAllocation(index, 'percentage', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                    placeholder="%"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <button
                    onClick={() => removeLlmAllocation(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={addLlmAllocation}
                disabled={availableProviders.length === 0}
                className="flex items-center gap-1 px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
              >
                <Plus size={14} />
                {t('wizard.llmDistribution.addLlm', { defaultValue: 'Add LLM' })}
              </button>

              {llmAllocations.length > 0 && (
                <div className={`text-sm ${isLlmDistributionValid ? 'text-green-600' : 'text-red-600'}`}>
                  {isLlmDistributionValid ? (
                    <span>{t('wizard.llmDistribution.totalValid', { defaultValue: 'Total: 100% ✓' })}</span>
                  ) : (
                    <span>{t('wizard.llmDistribution.mustEqual100', { current: totalPercentage, defaultValue: `Total must equal 100% (currently ${totalPercentage}%)` })}</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || demographics.length === 0 || !isLlmDistributionValid}
        className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t('wizard.demographics.generating', { defaultValue: 'Generating...' })}
          </>
        ) : (
          t('wizard.demographics.generateButton', {
            defaultValue: 'Generate Agents',
            count: totalAgents
          })
        )}
      </button>
    </div>
  );
};
