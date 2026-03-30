import { useState, useEffect } from 'react';

export interface Demographic {
  id: string;
  name: string;
  categories: string[];
}

export interface Archetype {
  id: string;
  attributes: Record<string, string>;
  label: string;
  probability: number;
}

export interface TraitConfig {
  id: string;
  name: string;
  mean: number;
  std: number;
}

export const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const generateArchetypes = (demographics: Demographic[]): Archetype[] => {
  if (demographics.length === 0) return [];

  let combinations: Record<string, string>[] = demographics[0].categories.map(cat => ({
    [demographics[0].name]: cat
  }));

  for (let i = 1; i < demographics.length; i++) {
    const demo = demographics[i];
    const newCombos: Record<string, string>[] = [];
    for (const combo of combinations) {
      for (const cat of demo.categories) {
        newCombos.push({ ...combo, [demo.name]: cat });
      }
    }
    combinations = newCombos;
  }

  const equalProb = 1 / combinations.length;
  return combinations.map((attrs, idx) => ({
    id: `arch_${idx}`,
    attributes: attrs,
    label: Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' | '),
    probability: equalProb
  }));
};

interface UseDemographicsBuilderProps {
  t: (key: string, params?: any) => string;
  i18n: any;
  isOpen: boolean;
  selectedTemplateId: string;
}

export const useDemographicsBuilder = ({ t, i18n, isOpen, selectedTemplateId }: UseDemographicsBuilderProps) => {
  const [useDemographics, setUseDemographics] = useState(true);
  const [demographics, setDemographics] = useState<Demographic[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [traits, setTraits] = useState<TraitConfig[]>([
    { id: generateId(), name: t('wizard.defaults.traits.trust'), mean: 50, std: 15 },
    { id: generateId(), name: t('wizard.defaults.traits.empathy'), mean: 50, std: 15 },
    { id: generateId(), name: t('wizard.defaults.traits.assertiveness'), mean: 50, std: 15 }
  ]);
  const [genCount, setGenCount] = useState(5);
  const [genDesc, setGenDesc] = useState('');

  // Load providers and initialize on open
  useEffect(() => {
    if (isOpen) {
      if (selectedTemplateId === 'policy_diffusion') {
        setDemographics([{ id: generateId(), name: '政治职位层级', categories: ['top', 'mid', 'low'] }]);
      } else if (demographics.length === 0) {
        setDemographics([
          {
            id: generateId(), name: t('wizard.tabs.age'), categories: [
              t('wizard.defaults.ageRanges.young'),
              t('wizard.defaults.ageRanges.middle'),
              t('wizard.defaults.ageRanges.senior')
            ]
          },
          {
            id: generateId(), name: t('wizard.tabs.location'), categories: [
              t('wizard.defaults.categories.urban'),
              t('wizard.defaults.categories.suburban'),
              t('wizard.defaults.categories.rural')
            ]
          }
        ]);
      }
      if (!genDesc) {
        setGenDesc(t('wizard.templateDefaults.village'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTemplateId]);

  // Update demographics when language changes
  useEffect(() => {
    if (selectedTemplateId === 'policy_diffusion') {
      const existingId = demographics[0]?.id || generateId();
      setDemographics([{ id: existingId, name: '政治职位层级', categories: ['top', 'mid', 'low'] }]);
    } else if (demographics.length >= 2) {
      setDemographics([
        {
          id: demographics[0].id, name: t('wizard.tabs.age'), categories: [
            t('wizard.defaults.ageRanges.young'),
            t('wizard.defaults.ageRanges.middle'),
            t('wizard.defaults.ageRanges.senior')
          ]
        },
        {
          id: demographics[1].id, name: t('wizard.tabs.location'), categories: [
            t('wizard.defaults.categories.urban'),
            t('wizard.defaults.categories.suburban'),
            t('wizard.defaults.categories.rural')
          ]
        }
      ]);
    }
    setTraits([
      { id: traits[0]?.id || generateId(), name: t('wizard.defaults.traits.trust'), mean: 50, std: 15 },
      { id: traits[1]?.id || generateId(), name: t('wizard.defaults.traits.empathy'), mean: 50, std: 15 },
      { id: traits[2]?.id || generateId(), name: t('wizard.defaults.traits.assertiveness'), mean: 50, std: 15 }
    ]);
  }, [i18n.language, selectedTemplateId]);

  // Auto-adjust generation description and count based on template
  useEffect(() => {
    const defaults: Record<string, string> = {
      village: t('wizard.templateDefaults.village'),
      council: t('wizard.templateDefaults.council'),
      werewolf: t('wizard.templateDefaults.werewolf'),
      policy_diffusion: t('wizard.templateDefaults.policyDiffusion', { defaultValue: '三层级政策扩散场景' })
    };
    setGenDesc(defaults[selectedTemplateId] || defaults['village']);
    const counts: Record<string, number> = {
      village: 5,
      council: 5,
      werewolf: 9,
      policy_diffusion: 20
    };
    setGenCount(counts[selectedTemplateId] ?? 5);
  }, [selectedTemplateId, t]);

  useEffect(() => {
    if (selectedTemplateId === 'policy_diffusion') {
      setDemographics([{ id: generateId(), name: '政治职位层级', categories: ['top', 'mid', 'low'] }]);
    }
  }, [selectedTemplateId]);

  // Update archetypes when demographics change (AgentTorch)
  useEffect(() => {
    if (useDemographics) {
      setArchetypes(generateArchetypes(demographics));
    }
  }, [demographics, useDemographics]);

  const handleAddDemographic = () => {
    setDemographics([...demographics, { id: generateId(), name: t('wizard.defaults.newCategory'), categories: [] }]);
  };

  const handleRemoveDemographic = (id: string) => {
    if (demographics.length > 1) {
      setDemographics(demographics.filter(d => d.id !== id));
    }
  };

  const handleUpdateDemographicName = (id: string, name: string) => {
    setDemographics(demographics.map(d => d.id === id ? { ...d, name } : d));
  };

  const handleUpdateDemographicCategories = (id: string, categories: string) => {
    const cats = categories.split(',').map(c => c.trim()).filter(c => c);
    setDemographics(demographics.map(d => d.id === id ? { ...d, categories: cats } : d));
  };

  const handleUpdateCategoryName = (demoId: string, catIndex: number, value: string) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId) {
        const newCats = [...d.categories];
        newCats[catIndex] = value;
        return { ...d, categories: newCats };
      }
      return d;
    }));
  };

  const handleAddCategory = (demoId: string) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId) {
        return { ...d, categories: [...d.categories, t('wizard.defaults.newCategory')] };
      }
      return d;
    }));
  };

  const handleRemoveCategory = (demoId: string, catIndex: number) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId && d.categories.length > 1) {
        return { ...d, categories: d.categories.filter((_, i) => i !== catIndex) };
      }
      return d;
    }));
  };

  const handleAddTrait = () => {
    setTraits([...traits, { id: generateId(), name: `${t('wizard.defaults.traits.trust')} ${traits.length + 1}`, mean: 50, std: 15 }]);
  };

  const handleRemoveTrait = (id: string) => {
    if (traits.length > 1) {
      setTraits(traits.filter(t => t.id !== id));
    }
  };

  const handleUpdateTrait = (id: string, field: keyof TraitConfig, value: string | number) => {
    setTraits(traits.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleUpdateArchetypeProbability = (archId: string, newProb: number) => {
    const oldProb = archetypes.find(a => a.id === archId)?.probability || 0;
    const currentTotal = archetypes.reduce((sum, a) => sum + a.probability, 0);
    const remainingTotal = currentTotal - oldProb;

    setArchetypes(archetypes.map(a => {
      if (a.id === archId) {
        return { ...a, probability: Math.max(0, Math.min(1, newProb)) };
      } else if (remainingTotal > 0) {
        const scale = (1 - newProb) / remainingTotal;
        return { ...a, probability: Math.max(0, a.probability * scale) };
      }
      return a;
    }));
  };

  const handleNormalizeProbabilities = () => {
    const total = archetypes.reduce((sum, a) => sum + a.probability, 0) || 1;
    setArchetypes(archetypes.map(a => ({ ...a, probability: a.probability / total })));
  };

  return {
    useDemographics, setUseDemographics,
    demographics, setDemographics,
    archetypes, setArchetypes,
    traits, setTraits,
    genCount, setGenCount,
    genDesc, setGenDesc,
    handlers: {
      handleAddDemographic, handleRemoveDemographic, handleUpdateDemographicName,
      handleUpdateDemographicCategories, handleUpdateCategoryName, handleAddCategory,
      handleRemoveCategory, handleAddTrait, handleRemoveTrait, handleUpdateTrait,
      handleUpdateArchetypeProbability, handleNormalizeProbabilities
    }
  };
};
