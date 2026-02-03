import React, { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Demographic {
  name: string;
  categories: string[];
}

interface Trait {
  name: string;
  mean: number;
  std: number;
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
}

export const DemographicsBuilder: React.FC<DemographicsBuilderProps> = ({
  totalAgents,
  setTotalAgents,
  demographics,
  setDemographics,
  traits,
  setTraits,
  onGenerate,
  isGenerating
}) => {
  const { t } = useTranslation();
  const [newDemographicName, setNewDemographicName] = useState('');
  const [newDemographicCategories, setNewDemographicCategories] = useState('');
  const [newTraitName, setNewTraitName] = useState('');
  const [newTraitMean, setNewTraitMean] = useState(50);
  const [newTraitStd, setNewTraitStd] = useState(20);

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
            placeholder={t('wizard.demographics.namePlaceholder', { defaultValue: 'Name (e.g., 职业)' })}
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

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || demographics.length === 0}
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
