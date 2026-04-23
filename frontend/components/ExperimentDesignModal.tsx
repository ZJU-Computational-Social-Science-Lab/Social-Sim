
import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore } from '../store';
import { useTranslation } from 'react-i18next';
import { X, Beaker, Plus, Trash2, Zap, UserCog, Settings, ArrowRight, Network, Sliders, Users } from 'lucide-react';
import { ExperimentVariant, Intervention, NetworkPreset, NetworkParams, NetworkResult } from '../types';
import { connectNodeEvents } from '../services/simulationTree';
import { MultimodalInput } from './MultimodalInput';
import { generateNetwork, defaultParams } from '../utils/networkTopologies';
import { parseScenarioParams, findUnknownKeys } from '../utils/parseScenarioParams';
import { getScenario, ScenarioData } from '../services/scenarios';
import { ResourceConfig } from './experiment/ResourceConfig';
import ParameterField from './experiment/ParameterField';

const extractMarkdownImages = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));
  return matches.map((m) => m[1]).filter(Boolean);
};

const parseConditionUpdates = (text: string): Record<string, any> => {
  let updates: Record<string, any> = {};

  try {
    const parsed = JSON.parse(text || '{}');
    if (parsed && typeof parsed === 'object' && parsed.updates) {
      updates = parsed.updates;
    } else if (parsed && typeof parsed === 'object') {
      updates = parsed;
    }
  } catch {
    String(text || '')
      .split(',')
      .map((s) => s.trim())
      .forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        if (!k) return;
        const valStr = rest.join('=').trim();
        const num = Number(valStr);
        updates[k.trim()] = Number.isNaN(num) ? valStr : num;
      });
  }

  return updates;
};

const inferThreadKind = (text: string): string => {
  const normalized = String(text || '');
  if (/越级|跳级|投诉|告状/.test(normalized)) return 'skip_level_complaint';
  if (/升级反馈|升级上报|升级反映|继续升级/.test(normalized)) return 'escalation';
  if (/反馈|汇报|上报/.test(normalized)) return 'upward_feedback';
  if (/通知|转办/.test(normalized)) return 'subordinate_notice';
  if (/协商|讨论|商量|私聊|发消息|发送消息/.test(normalized)) return 'peer_consult';
  return 'peer_consult';
};

const parseThreadSeed = (text: string, agentNames: string[]): Record<string, any> => {
  let seed: Record<string, any> = {};

  try {
    const parsed = JSON.parse(text || '{}');
    if (parsed && typeof parsed === 'object') {
      seed = parsed;
    }
  } catch {
    String(text || '')
      .split(',')
      .map((s) => s.trim())
      .forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        if (!k) return;
        seed[k.trim()] = rest.join('=').trim();
      });

    if (!Object.keys(seed).length) {
      const rawText = String(text || '').trim();
      const compact = rawText.replace(/，/g, ',').replace(/：/g, ':');
      const orderedNames = [...agentNames].sort((a, b) => b.length - a.length);
      const matches = orderedNames
        .map((name) => ({ name, idx: compact.indexOf(name) }))
        .filter((item) => item.idx >= 0)
        .sort((a, b) => a.idx - b.idx);

      if (matches[0]) seed.sender = matches[0].name;
      if (matches[1]) seed.recipient = matches[1].name;

      const msgPatterns = [
        /消息内容(?:为|是)?[:：]?\s*(.+)$/,
        /内容(?:为|是)?[:：]?\s*(.+)$/,
        /说[:：]?\s*(.+)$/,
        /发消息[:：]?\s*(.+)$/,
        /发送消息[:：]?\s*(.+)$/,
      ];
      for (const pattern of msgPatterns) {
        const matched = compact.match(pattern);
        if (matched && matched[1]) {
          seed.message = matched[1].trim();
          break;
        }
      }

      if (!seed.message) {
        const generic = compact.match(/(?:给|向).+?(?:发消息|发送消息|私聊|反馈|汇报|上报|通知|转办)[,，:]?\s*(.+)$/);
        if (generic && generic[1]) {
          seed.message = generic[1].trim();
        }
      }

      seed.kind = inferThreadKind(compact);
    }
  }

  return seed;
};

const toParameterFieldType = (type: string | undefined): 'integer' | 'string' | 'boolean' | 'array' => {
  if (type === 'boolean') return 'boolean';
  if (type === 'array') return 'array';
  if (type === 'number' || type === 'integer' || type === 'float') return 'integer';
  return 'string';
};

const hasMeaningfulInterventionText = (text: string): boolean => {
  return String(text || '').trim().length > 0;
};

const humanizeBackendLabel = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const ExperimentDesignModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useSimulationStore(state => state.isExperimentDesignerOpen);
  const toggle = useSimulationStore(state => state.toggleExperimentDesigner);
  const runExperiment = useSimulationStore(state => state.runExperiment);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const nodes = useSimulationStore(state => state.nodes);
  const agents = useSimulationStore(state => state.agents);
  const engineConfig = useSimulationStore(state => state.engineConfig);
  const currentSimulation = useSimulationStore(state => state.currentSimulation);
  const addNotification = useSimulationStore(state => state.addNotification);
  const currentSceneType = currentSimulation?.scene_type
    || (currentSimulation as any)?.sceneType
    || (currentSimulation as any)?.scene_config?.scene_type
    || (currentSimulation as any)?.scene_config?.sceneType
    || '';
  const isPolicyCascadeTemplate = currentSceneType === 'policy_cascade_scene';

  const baseNode = nodes.find(n => n.id === selectedNodeId);
  const expectedVariantParentId = baseNode ? (baseNode.parentId == null ? baseNode.id : baseNode.parentId) : null;

  const [experimentName, setExperimentName] = useState('');
  const [variants, setVariants] = useState<ExperimentVariant[]>([
    { id: 'v1', name: `${t('components.experimentDesignModal.variantPrefix')} A`, description: '', interventions: [] }
  ]);
  const [showPreview, setShowPreview] = useState(false);

  // live per-node logs: nodeId (string) -> array of log entries
  const [nodeLogs, setNodeLogs] = useState<Record<string, any[]>>({});
  // active sockets to allow cleanup
  const [nodeSockets, setNodeSockets] = useState<Record<string, WebSocket | null>>({});
  // cached scenario data for SCENARIO_PARAMS intervention UI
  const [scenarioDataCache, setScenarioDataCache] = useState<Record<string, ScenarioData>>({});

  const translateVariantStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return t('components.experimentDesignModal.statusPending');
      case 'running':
        return t('components.experimentDesignModal.statusRunning');
      case 'completed':
        return t('components.experimentDesignModal.statusCompleted');
      case 'failed':
        return t('components.experimentDesignModal.statusFailed');
      default:
        return humanizeBackendLabel(status);
    }
  };

  const translateExperimentLogType = (value: string) => {
    switch (value) {
      case 'SYSTEM':
      case 'system_broadcast':
      case 'system_announcement':
        return t('components.logViewer.typeSystem');
      case 'AGENT_METADATA':
        return t('components.logViewer.typeAgentMetadata');
      case 'AGENT_SAY':
        return t('components.logViewer.typeDialogue');
      case 'AGENT_ACTION':
      case 'action_start':
      case 'action_end':
        return t('components.logViewer.typeAction');
      case 'ENVIRONMENT':
      case 'environment':
      case 'environment_event':
        return t('components.logViewer.typeEnvironment');
      default:
        return humanizeBackendLabel(value || 'evt');
    }
  };

  const translateNetworkPreset = (preset: string) => {
    switch (preset) {
      case 'full':
        return t('components.experimentDesignModal.presetFull');
      case 'ring':
        return t('components.experimentDesignModal.presetRing');
      case 'star':
        return t('components.experimentDesignModal.presetStar');
      case 'random':
        return t('components.experimentDesignModal.presetRandom');
      case 'newman-watts':
        return t('components.experimentDesignModal.presetNewmanWatts');
      case 'core-periphery':
        return t('components.experimentDesignModal.presetCorePeriphery');
      case 'holme-kim':
        return t('components.experimentDesignModal.presetHolmeKim');
      case 'waxman':
        return t('components.experimentDesignModal.presetWaxman');
      case 'sbm':
        return t('components.experimentDesignModal.presetSbm');
      case 'custom':
        return t('components.experimentDesignModal.presetCustom');
      default:
        return humanizeBackendLabel(preset);
    }
  };

  const translateInterventionType = (type: string) => {
    switch (type) {
      case 'SCENARIO_PARAMS':
        return t('components.experimentDesignModal.scenarioParamsType');
      case 'SCENARIO_DESCRIPTION':
        return t('experimentBuilder.step2.scenarioDescriptionLabel', { defaultValue: 'Scenario description' });
      case 'NETWORK_TOPOLOGY':
        return t('components.experimentDesignModal.networkTopologyType');
      case 'ROUND_VISIBILITY':
        return t('experimentBuilder.roundSettings.roundVisibility.label', { defaultValue: 'Round visibility' });
      case 'INSTRUCTION':
        return t('components.experimentDesignModal.instructionType');
      case 'AGENT_PROPERTY':
        return t('components.experimentDesignModal.propertyType');
      case 'ENVIRONMENT':
        return t('components.experimentDesignModal.environmentType');
      case 'FOLLOW_UP_CONDITION':
        return t('components.experimentDesignModal.followUpConditionType');
      case 'FOLLOW_UP_THREAD_SEED':
        return t('components.experimentDesignModal.followUpThreadSeedType');
      default:
        return humanizeBackendLabel(type);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // cleanup sockets when modal closed
      Object.values(nodeSockets).forEach((s) => {
        try {
          s?.close();
        } catch (e) {
          // ignore
        }
      });
      setNodeSockets({});
      setNodeLogs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Establish node-level WS subscriptions for mapped variant nodes
  useEffect(() => {
    if (!isOpen) return;
    const endpoint = (window as any).__engine_endpoint__ || '';
    const token = (window as any).__engine_token__ || '';

    variants.forEach((variant) => {
      const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === expectedVariantParentId && n.name.includes(variant.name));
      const nodeByName = nodes.find(n => n.name === `${experimentName}: ${variant.name}`);
      const node = nodeByMeta || nodeByName;
      const nid = node ? node.id : null;
      if (!nid) return;
      if (nodeSockets[String(nid)]) return; // already connected

      try {
        const ws = connectNodeEvents((engineConfig.endpoint || ''), (currentSimulation?.id || ''), Number(nid), (engineConfig as any).token, (ev: any) => {
          setNodeLogs((prev) => {
            const cur = { ...(prev || {}) };
            cur[String(nid)] = [...(cur[String(nid)] || []), ev];
            // keep bounded
            if (cur[String(nid)].length > 500) cur[String(nid)] = cur[String(nid)].slice(-500);
            return cur;
          });
        });
        setNodeSockets((s) => ({ ...(s || {}), [String(nid)]: ws }));
      } catch (e) {
        // ignore connection errors; WS fallback via graph refresh will update logs
      }
    });

    return () => {
      // cleanup on variants/nodes change; keep sockets open while modal open
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nodes, variants, baseNode?.id]);

  // Handle case where modal is open but no valid base node is selected
  useEffect(() => {
    if (isOpen && !baseNode) {
      addNotification('error', t('store.selectNodeFirst') || 'Please select a simulation node first');
      toggle(false);
    }
  }, [isOpen, baseNode, addNotification, t, toggle]);

  useEffect(() => {
    if (isPolicyCascadeTemplate) return;
    setVariants((prev) => prev.map((variant) => ({
      ...variant,
      interventions: (variant.interventions || []).map((iv) => (
        iv.type === 'FOLLOW_UP_CONDITION' || iv.type === 'FOLLOW_UP_THREAD_SEED'
          ? { ...iv, type: 'ENVIRONMENT' }
          : iv
      )),
    })));
  }, [isPolicyCascadeTemplate]);

  // Fetch scenario data for SCENARIO_PARAMS intervention UI
  useEffect(() => {
    const sceneConfig = (currentSimulation as any)?.scene_config;
    const scenarioId = sceneConfig?.scenario_id || sceneConfig?.scenarioId;
    if (!scenarioId) return;

    // Check if already cached using a ref to avoid stale closure
    const cached = scenarioDataCache[scenarioId];
    if (cached) return; // Already cached

    // Fetch scenario data
    getScenario(scenarioId)
      .then((data) => {
        setScenarioDataCache((prev) => ({ ...prev, [scenarioId]: data }));
      })
      .catch((err) => {
        console.error('Failed to fetch scenario data:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSimulation]);

  if (!isOpen || !baseNode) return null;

  const handleAddVariant = () => {
    setVariants([...variants, {
      id: `v${Date.now()}`,
      name: `${t('components.experimentDesignModal.variantPrefix')} ${String.fromCharCode(65 + variants.length)}`,
      description: '',
      interventions: []
    }]);
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const handleUpdateVariant = (id: string, field: keyof ExperimentVariant, value: any) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const addIntervention = (variantId: string) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return {
          ...v,
          interventions: [...v.interventions, {
            id: `iv${Date.now()}`,
            type: 'INSTRUCTION',
            description: ''
          }]
        };
      }
      return v;
    }));
  };

  const updateIntervention = (variantId: string, interventionId: string, field: keyof Intervention, value: any) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return {
          ...v,
          interventions: v.interventions.map(iv => 
            iv.id === interventionId ? { ...iv, [field]: value } : iv
          )
        };
      }
      return v;
    }));
  };

  const removeIntervention = (variantId: string, interventionId: string) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return {
          ...v,
          interventions: v.interventions.filter(iv => iv.id !== interventionId)
        };
      }
      return v;
    }));
  };

  const handleEmbedInterventionImage = (variantId: string, interventionId: string, url: string) => {
    setVariants((prev) => prev.map((v) => {
      if (v.id !== variantId) return v;
      return {
        ...v,
        interventions: v.interventions.map((iv) =>
          iv.id === interventionId
            ? { ...iv, description: `${iv.description || ''}${iv.description ? '\n' : ''}![image](${url})` }
            : iv
        ),
      };
    }));
    addNotification('success', t('components.experimentDesignModal.imageUploaded'));
  };

  // Build preview data for all variants
  const buildPreviewData = () => {
    const baseParams = (currentSimulation as any)?.scene_config?.parameters || {};
    const baseDescription = (currentSimulation as any)?.scene_config?.description || '';
    const baseRoundVisibility = (currentSimulation as any)?.scene_config?.round_visibility || 'simultaneous';
    const agentNames = agents.map(a => a.name);

    return variants.map((v) => {
      const paramChanges: { key: string; was: any; new: any; unknown?: boolean }[] = [];
      const networkChanges: { preset: string; edges: number; seed?: number } | null = null;
      const otherInterventions: { type: string; description: string }[] = [];

      (v.interventions || []).forEach((iv) => {
        if (iv.type === 'SCENARIO_PARAMS') {
          const parsed = iv.parsedParams || parseScenarioParams(iv.rawParamsText || '');
          Object.entries(parsed).forEach(([key, newVal]) => {
            const isUnknown = !(key in baseParams);
            paramChanges.push({
              key,
              was: baseParams[key] ?? undefined,
              new: newVal,
              unknown: isUnknown
            });
          });

          // Add description change to preview
          if (iv.scenarioDescription !== undefined && iv.scenarioDescription !== baseDescription) {
            otherInterventions.push({
              type: 'SCENARIO_DESCRIPTION',
              description: t('components.experimentDesignModal.previewDescriptionChanged', { defaultValue: 'Description changed' })
            });
          }

          // Add round visibility change to preview
          if (iv.roundVisibility !== undefined && iv.roundVisibility !== baseRoundVisibility) {
            otherInterventions.push({
              type: 'ROUND_VISIBILITY',
              description: t('components.experimentDesignModal.previewRoundVisibilityChanged', {
                from: baseRoundVisibility,
                to: iv.roundVisibility,
                defaultValue: `Round visibility: ${baseRoundVisibility} → ${iv.roundVisibility}`
              })
            });
          }
        } else if (iv.type === 'NETWORK_TOPOLOGY') {
          let network: NetworkResult;
          if (iv.networkPreset === 'custom' && iv.customEdges) {
            network = { edges: iv.customEdges, preset: 'custom', seed: 0 };
          } else if (iv.networkPreset) {
            network = generateNetwork(iv.networkPreset as any, agentNames, iv.networkParams as any);
          } else {
            network = generateNetwork('full', agentNames);
          }
          otherInterventions.push({
            type: 'NETWORK_TOPOLOGY',
            description: `${translateNetworkPreset(iv.networkPreset || 'full')}: ${network.edges.length} ${t('components.experimentDesignModal.previewEdges')}, ${t('components.experimentDesignModal.previewSeed')}=${network.seed}`
          });
        } else {
          otherInterventions.push({
            type: iv.type,
            description: iv.description || ''
          });
        }
      });

      return {
        variantId: v.id,
        variantName: v.name,
        paramChanges,
        otherInterventions
      };
    });
  };

  const handleSubmit = () => {
    if (!experimentName) {
      alert(t('components.experimentDesignModal.pleaseEnterName'));
      return;
    }
    // Build ops for each variant based on interventions
    const variantsWithOps = variants.map((v) => {
      const ops: any[] = [];
      const pendingFollowUpConditions: Record<string, any> = {};
      const pendingThreadSeeds: any[] = [];
      (v.interventions || []).forEach((iv) => {
        if (iv.type === 'AGENT_PROPERTY' && iv.targetId) {
          // parse description as JSON updates or key=value pairs
          const updates = parseConditionUpdates(iv.description || '');
          if (!Object.keys(updates).length) return;

          const target = agents.find((a) => a.id === iv.targetId);
          const name = target ? target.name : iv.targetId;
          ops.push({ op: 'agent_props_patch', name, updates });
        } else if (iv.type === 'INSTRUCTION') {
          if (!hasMeaningfulInterventionText(iv.description || '')) return;
          // broadcast instruction as public event
          ops.push({ op: 'public_broadcast', text: iv.description || '' });
        } else if (iv.type === 'ENVIRONMENT') {
          if (!hasMeaningfulInterventionText(iv.description || '')) return;
          if (isPolicyCascadeTemplate) {
            ops.push({ op: 'environment_event', text: iv.description || '', event_type: 'environment' });
          } else {
            ops.push({ op: 'public_broadcast', text: iv.description || '' });
          }
        } else if (iv.type === 'FOLLOW_UP_CONDITION' && isPolicyCascadeTemplate) {
          const updates = parseConditionUpdates(iv.description || '');
          if (!Object.keys(updates).length) return;
          Object.assign(pendingFollowUpConditions, updates);
        } else if (iv.type === 'FOLLOW_UP_THREAD_SEED' && iv.targetId && isPolicyCascadeTemplate) {
          const seed = parseThreadSeed(iv.description || '', agents.map((a) => a.name));
          const target = agents.find((a) => a.id === iv.targetId);
          const recipient = seed.recipient || (target ? target.name : iv.targetId);
          if (!recipient || (!seed.message && !seed.notice)) return;
          pendingThreadSeeds.push({
            recipient,
            sender: seed.sender,
            kind: seed.kind || 'peer_consult',
            message: seed.message || '',
            notice: seed.notice || '',
            metadata: seed.metadata || {},
          });
        } else if (iv.type === 'SCENARIO_PARAMS') {
          // Apply merge-patch for scenario parameters
          // Filter out __DELETE__ markers and only send actual changes
          const userChanges = iv.parsedParams || {};
          const updates: Record<string, any> = {};

          Object.entries(userChanges).forEach(([key, val]) => {
            if (val !== '__DELETE__') {
              updates[key] = val;
            }
          });

          if (Object.keys(updates).length > 0) {
            ops.push({ op: 'config_params_patch', updates });
          }

          // Handle scenario description override
          if (iv.scenarioDescription !== undefined && iv.scenarioDescription !== '') {
            const baseDescription = (currentSimulation as any)?.scene_config?.description || '';
            if (iv.scenarioDescription !== baseDescription) {
              ops.push({ op: 'config_description_patch', description: iv.scenarioDescription });
            }
          }

          // Handle round visibility override
          if (iv.roundVisibility !== undefined) {
            const baseRoundVisibility = (currentSimulation as any)?.scene_config?.round_visibility || 'simultaneous';
            if (iv.roundVisibility !== baseRoundVisibility) {
              ops.push({ op: 'config_settings_patch', settings: { round_visibility: iv.roundVisibility } });
            }
          }
        } else if (iv.type === 'NETWORK_TOPOLOGY') {
          // Generate and freeze network at submit time
          const agentNames = agents.map(a => a.name);
          let network: NetworkResult;
          if (iv.networkPreset === 'custom' && iv.customEdges) {
            network = { edges: iv.customEdges, preset: 'custom', seed: 0 };
          } else if (iv.networkPreset) {
            network = generateNetwork(iv.networkPreset as any, agentNames, iv.networkParams as any);
          } else {
            network = generateNetwork('full', agentNames);
          }
          ops.push({ op: 'network_replace', network });
        }
      });
      if (Object.keys(pendingFollowUpConditions).length > 0) {
        ops.push({
          op: 'scene_state_patch',
          updates: {
            pending_follow_up_conditions: pendingFollowUpConditions,
          },
        });
      }
      if (pendingThreadSeeds.length > 0) {
        ops.push({
          op: 'scene_state_patch',
          updates: {
            follow_up_thread_seeds: pendingThreadSeeds,
          },
        });
      }
      return { ...v, ops };
    });

    runExperiment(baseNode.id, experimentName, variantsWithOps);
    toggle(false);
    // Reset state
    setExperimentName('');
    setVariants([{ id: 'v1', name: `${t('components.experimentDesignModal.variantPrefix')} A`, description: '', interventions: [] }]);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center backdrop-blur-sm" style={{ background: 'var(--ss-overlay)' }}>
      <div className="rounded-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', boxShadow: 'var(--ss-shadow-3)', color: 'var(--ss-text)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid var(--ss-border)', background: 'var(--ss-brand-soft)' }}>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--ss-heading)' }}>
              <Beaker style={{ color: 'var(--ss-brand-primary)' }} size={24} />
              {t('components.experimentDesignModal.title')}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--ss-brand-primary)' }} dangerouslySetInnerHTML={{
              __html: t('components.experimentDesignModal.subtitle', {
                displayId: baseNode.display_id,
                name: baseNode.name
              })
            }} />
          </div>
          <button onClick={() => toggle(false)} style={{ color: 'var(--ss-text-subtle)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar: Global Settings & Control Group */}
          <div className="w-full md:w-80 p-6 overflow-y-auto shrink-0 space-y-6" style={{ background: 'var(--ss-surface-muted)', borderRight: '1px solid var(--ss-border)' }}>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--ss-heading)' }}>{t('components.experimentDesignModal.experimentNameLabel')}</label>
              <input
                type="text"
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                placeholder={t('components.experimentDesignModal.experimentNamePlaceholder')}
                className="w-full px-3 py-2 border rounded-lg outline-none text-sm"
                style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
              />
            </div>

            <div className="border rounded-lg p-4 relative overflow-hidden" style={{ background: 'var(--ss-layer-card)', borderColor: 'var(--ss-border)', boxShadow: 'var(--ss-shadow-1)' }}>
               <div className="absolute top-0 left-0 w-1 h-full" style={{ background: 'var(--ss-border-strong)' }}></div>
               <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ss-heading)' }}>{t('components.experimentDesignModal.controlGroup')}</h3>
               <p className="text-xs mb-3" style={{ color: 'var(--ss-text-muted)' }}>{t('components.experimentDesignModal.controlGroupDescription')}</p>
               <div className="text-xs p-2 rounded" style={{ background: 'var(--ss-surface-inset)', color: 'var(--ss-text)' }}>
                  {t('components.experimentDesignModal.controlGroupState')}
               </div>
            </div>

            <div className="text-xs leading-relaxed" style={{ color: 'var(--ss-text-subtle)' }}>
              <p>{t('components.experimentDesignModal.hintTitle')}</p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>{t('components.experimentDesignModal.hintAddVariant')}</li>
                <li>{t('components.experimentDesignModal.hintDefineVariables')}</li>
                <li>{t('components.experimentDesignModal.hintAutoParallel')}</li>
              </ul>
            </div>
          </div>

          {/* Main Area: Variants */}
          <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'var(--ss-surface-inset)' }}>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {variants.map((variant, index) => (
                  <div key={variant.id} className="border rounded-xl overflow-hidden group transition-shadow" style={{ background: 'var(--ss-layer-card)', borderColor: 'var(--ss-border)', boxShadow: 'var(--ss-shadow-1)' }}>
                    <div className="px-4 py-3 border-b flex justify-between items-center" style={{ background: 'var(--ss-surface)', borderColor: 'var(--ss-border)' }}>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                          className="font-bold bg-transparent border-b border-transparent outline-none px-1"
                          style={{ color: 'var(--ss-heading)' }}
                        />
                        {/* Status badge: try to find corresponding node in tree by name */}
                        {(() => {
                          // Prefer meta-based mapping when available (experiment/variant ids),
                          // otherwise fall back to name-based matching for compatibility.
                          const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === expectedVariantParentId && n.name.includes(variant.name));
                          const nodeByName = nodes.find(n => n.name === `${experimentName}: ${variant.name}`);
                          const node = nodeByMeta || nodeByName;
                          const st = node ? node.status : 'pending';
                          const badgeColor = st === 'running' ? 'var(--ss-warning)' : st === 'completed' ? 'var(--ss-status-positive)' : 'var(--ss-text-subtle)';
                          return (
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: badgeColor, background: 'var(--ss-surface-inset)' }}>
                              {translateVariantStatus(st)}
                            </span>
                          );
                        })()}

                        {(() => {
                          // Show a compact live log preview if we have a mapped node id
                          const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === expectedVariantParentId && n.name.includes(variant.name));
                          const nodeByName = nodes.find(n => n.name === `${experimentName}: ${variant.name}`);
                          const node = nodeByMeta || nodeByName;
                          const nid = node ? node.id : null;
                          if (!nid) return null;
                          const logs = nodeLogs[String(nid)] || [];
                          return (
                            <div className="mt-2 text-xs" style={{ color: 'var(--ss-text-muted)' }}>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--ss-success-400)' }} />
                                <span>{t('components.experimentDesignModal.liveLogPreview', { count: Math.min(5, logs.length) })}</span>
                              </div>
                              <div className="mt-2 border rounded p-2 text-[11px] h-20 overflow-auto" style={{ background: 'var(--ss-surface-inset)', borderColor: 'var(--ss-border)' }}>
                                {logs.slice(-5).map((l: any, i: number) => (
                                  <div key={i} className="py-0.5 border-b" style={{ borderColor: 'var(--ss-border)' }}>
                                    <div className="font-mono text-[11px]" style={{ color: 'var(--ss-text-muted)' }}>
                                      {translateExperimentLogType(String(l.type || l.event_type || 'evt'))}
                                    </div>
                                    <div style={{ color: 'var(--ss-text)' }}>{String((l.data && (l.data.action || l.data.message || JSON.stringify(l.data))) || l.data || '')}</div>
                                  </div>
                                ))}
                                {logs.length === 0 && <div style={{ color: 'var(--ss-text-subtle)' }}>{t('components.experimentDesignModal.noLogsYet')}</div>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <button onClick={() => handleRemoveVariant(variant.id)} className="transition-colors" style={{ color: 'var(--ss-text-subtle)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="p-4 space-y-3 min-h-[200px]">
                       {variant.interventions.length === 0 ? (
                         <div className="text-center py-8 text-sm border-2 border-dashed rounded-lg" style={{ color: 'var(--ss-text-subtle)', borderColor: 'var(--ss-border)' }}>
                           {t('components.experimentDesignModal.noInterventions')}
                         </div>
                       ) : (
                         variant.interventions.map((iv, i) => (
                           <div key={iv.id} className="rounded-lg border p-3 text-sm relative" style={{ background: 'var(--ss-surface-inset)', borderColor: 'var(--ss-border)' }}>
                              <div className="flex gap-2 mb-2">
                                <select
                                  value={iv.type}
                                  onChange={(e) => updateIntervention(variant.id, iv.id, 'type', e.target.value)}
                                  className="text-[10px] font-bold uppercase border rounded px-1 py-0.5 outline-none"
                                  style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                >
                                  <option value="SCENARIO_PARAMS">{t('components.experimentDesignModal.scenarioParamsType', { defaultValue: 'Scenario Parameters' })}</option>
                                  <option value="NETWORK_TOPOLOGY">{t('components.experimentDesignModal.networkTopologyType', { defaultValue: 'Network Topology' })}</option>
                                  <option value="INSTRUCTION">{t('components.experimentDesignModal.instructionType')}</option>
                                  <option value="AGENT_PROPERTY">{t('components.experimentDesignModal.propertyType')}</option>
                                  <option value="ENVIRONMENT">{t('components.experimentDesignModal.environmentType')}</option>
                                  {isPolicyCascadeTemplate && <option value="FOLLOW_UP_CONDITION">{t('components.experimentDesignModal.followUpConditionType', { defaultValue: 'Follow-up condition' })}</option>}
                                  {isPolicyCascadeTemplate && <option value="FOLLOW_UP_THREAD_SEED">{t('components.experimentDesignModal.followUpThreadSeedType', { defaultValue: 'Follow-up thread seed' })}</option>}
                                </select>

                                {(iv.type === 'AGENT_PROPERTY' || iv.type === 'FOLLOW_UP_THREAD_SEED') && (
                                  <select
                                    value={iv.targetId || ''}
                                    onChange={(e) => updateIntervention(variant.id, iv.id, 'targetId', e.target.value)}
                                    className="text-[10px] border rounded px-1 py-0.5 outline-none max-w-[100px]"
                                    style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                  >
                                    <option value="">{t('components.experimentDesignModal.selectAgent')}</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                                )}
                              </div>

                              {/* Image upload - only for intervention types that support rich text */}
                              {iv.type !== 'SCENARIO_PARAMS' && iv.type !== 'NETWORK_TOPOLOGY' && (
                              <MultimodalInput
                                label={t('components.experimentDesignModal.imageLabel')}
                                helperText={t('components.experimentDesignModal.imageHelper')}
                                onInsert={(url) => handleEmbedInterventionImage(variant.id, iv.id, url)}
                              />
                              )}

                              {/* SCENARIO_PARAMS UI - Edit Base Parameters */}
                              {iv.type === 'SCENARIO_PARAMS' && (() => {
                                // Get scenario ID and data
                                const simSceneConfig = (currentSimulation as any)?.scene_config || {};
                                const genericConfig = simSceneConfig.generic_config || simSceneConfig.genericConfig || {};

                                // Try multiple sources for scene config data
                                const sceneConfig = {
                                  ...simSceneConfig,
                                  ...genericConfig,
                                };

                                const scenarioId = sceneConfig.scenario_id || sceneConfig.scenarioId || sceneConfig.id || 'custom';
                                const scenarioData = scenarioId ? scenarioDataCache[scenarioId] : null;

                                // DEBUG: Log what data we have
                                console.log('[SCENARIO_PARAMS DEBUG]', {
                                  currentSimulation,
                                  simSceneConfig,
                                  genericConfig,
                                  mergedSceneConfig: sceneConfig,
                                  scenarioId,
                                  hasScenarioData: !!scenarioData,
                                  sceneConfigKeys: Object.keys(sceneConfig),
                                  baseParams: sceneConfig.parameters,
                                  baseDescription: sceneConfig.description || sceneConfig.initial_event,
                                });

                                // Get base params from current simulation config
                                const baseParams = sceneConfig.parameters || {};
                                // Description may be stored in different fields depending on scenario type
                                const baseDescription = sceneConfig.description || sceneConfig.initial_event || '';
                                const baseRoundVisibility = sceneConfig.round_visibility || sceneConfig.roundVisibility || 'simultaneous';

                                // If scene_config is empty, show a warning to create a new simulation
                                if (Object.keys(sceneConfig).length === 0) {
                                  return (
                                    <div className="space-y-4">
                                      <div className="border p-3 rounded text-sm" style={{ background: 'var(--ss-warning-soft)', borderColor: 'var(--ss-warning)', color: 'var(--ss-warning)' }}>
                                        <strong>Note:</strong> This simulation was created before the scenario parameters feature was added.
                                        <br /><br />
                                        Please create a <strong>new simulation</strong> to use the Scenario Parameters intervention type with full parameter editing.
                                      </div>
                                    </div>
                                  );
                                }

                                // Get user's changes (if any)
                                const userChanges = iv.parsedParams || {};
                                const userDescription = iv.scenarioDescription;
                                const userRoundVisibility = iv.roundVisibility || baseRoundVisibility;

                                // Merge: start with base params, apply user changes on top
                                const displayParams = { ...baseParams, ...userChanges };
                                const displayDescription = userDescription !== undefined ? userDescription : baseDescription;
                                const displayRoundVisibility = userRoundVisibility;

                                // Track which params have been modified from base
                                const isModified = (key: string) => key in userChanges && userChanges[key] !== baseParams[key];

                                const updateParam = (key: string, newVal: string | number | boolean) => {
                                  const newChanges = { ...userChanges, [key]: newVal };
                                  updateIntervention(variant.id, iv.id, 'parsedParams', newChanges);
                                };

                                const updateDescription = (newDesc: string) => {
                                  updateIntervention(variant.id, iv.id, 'scenarioDescription', newDesc);
                                };

                                const updateRoundVisibility = (val: 'simultaneous' | 'sequential') => {
                                  updateIntervention(variant.id, iv.id, 'roundVisibility', val);
                                };

                                // Parameter categories to exclude from generic rendering (handled by specialized UI)
                                const EXCLUDED_CATEGORIES = new Set(['deduction', 'resource']);
                                const DISTORTION_ONLY_KEYS = new Set(['distortion_strength', 'conflict_sensitivity', 'block_probability']);

                                // Filter parameters for display from scenario data
                                const visibleParametersFromScenario = scenarioData?.parameters.filter((param) => {
                                  if (EXCLUDED_CATEGORIES.has(param.category || '')) return false;
                                  if (!DISTORTION_ONLY_KEYS.has(param.key)) return true;
                                  // For distortion-only params, check cascade mode
                                  const cascadeMode = String(displayParams.cascade_mode ?? 'strict_cascade');
                                  return cascadeMode === 'distortion_cascade';
                                }) || [];

                                // If no scenario data, fall back to showing all base params as generic fields
                                // Also use fallback if scenario data exists but params are filtered out
                                const fallbackParams = Object.entries(baseParams).map(([key, value]) => ({
                                  key,
                                  label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                  type: typeof value === 'number' ? 'number' : 'string',
                                  default: value,
                                  ui_hint: typeof value === 'number' ? 'number' : 'text',
                                }));

                                const visibleParameters = visibleParametersFromScenario.length > 0
                                  ? visibleParametersFromScenario
                                  : fallbackParams;

                                // Debug the final parameters
                                console.log('[SCENARIO_PARAMS PARAMS]', {
                                  visibleParametersFromScenario: visibleParametersFromScenario.length,
                                  fallbackParams: fallbackParams.length,
                                  visibleParameters: visibleParameters.length,
                                  baseParamsKeys: Object.keys(baseParams),
                                });

                                return (
                                  <div className="space-y-4">
                                    <div className="p-2 rounded text-xs mb-2" style={{ background: 'var(--ss-info-soft)', color: 'var(--ss-info)' }}>
                                      {t('components.experimentDesignModal.scenarioParamsHint', { defaultValue: 'Edit parameters below to change the scenario configuration for this diverging timeline.' })}
                                    </div>

                                    {/* Scenario Description */}
                                    <div>
                                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ss-text)' }}>
                                        {t('experimentBuilder.step2.scenarioDescriptionLabel', { defaultValue: 'Scenario description (agents will see this)' })}
                                      </label>
                                      <textarea
                                        value={displayDescription}
                                        onChange={(e) => updateDescription(e.target.value)}
                                        rows={3}
                                        className="w-full px-2 py-1 border rounded text-xs focus:outline-none"
                                        style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                      />
                                    </div>

                                    {/* ResourceConfig for public_goods scenario */}
                                    {scenarioId === 'public_goods' && (
                                      <ResourceConfig
                                        values={{
                                          resource_name: (displayParams.resource_name as string) || 'tokens',
                                          tokens_per_round: (displayParams.tokens_per_round as number) ?? 10,
                                          multiplier: (displayParams.multiplier as number) ?? 1.3,
                                          deduction_budget_per_phase: (displayParams.deduction_budget_per_phase as number) ?? 0,
                                          deduction_cost_ratio: (displayParams.deduction_cost_ratio as number) ?? 3,
                                          deduction_anonymous: (displayParams.deduction_anonymous as boolean) ?? false,
                                          show_average_contribution: (displayParams.show_average_contribution as boolean) ?? false,
                                        }}
                                        onChange={updateParam}
                                      />
                                    )}

                                    {/* Generic parameter fields for other scenarios or fallback */}
                                    {scenarioId !== 'public_goods' && visibleParameters.length > 0 && (
                                      <div className="space-y-3">
                                        {visibleParameters.map((param: any) => {
                                          const value = displayParams[param.key] ?? param.default;
                                          const modified = isModified(param.key);
                                          const label = t(`experimentBuilder.paramLabels.${param.key}`, { defaultValue: param.label });
                                          const description = t(`experimentBuilder.paramDescriptions.${param.key}`, { defaultValue: param.description || '' });

                                          return (
                                            <div key={param.key} className={`space-y-1 ${modified ? 'p-2 rounded' : ''}`} style={modified ? { background: 'var(--ss-warning-soft)' } : undefined}>
                                              <label className="block text-sm font-medium" style={{ color: 'var(--ss-text)' }}>
                                                {label}
                                                {modified && (
                                                  <span className="ml-2 text-[10px]" style={{ color: 'var(--ss-warning)' }}>
                                                    ({t('components.experimentDesignModal.previewWas')}: {String(baseParams[param.key])})
                                                  </span>
                                                )}
                                              </label>
                                              {description && (
                                                <p className="text-xs" style={{ color: 'var(--ss-text-muted)' }}>{description}</p>
                                              )}
                                              <ParameterField
                                                param={{
                                                  type: toParameterFieldType(param.type),
                                                  default: param.default,
                                                  ui_hint:
                                                    param.ui_hint ||
                                                    (param.type === 'boolean'
                                                      ? 'toggle'
                                                      : param.type === 'number' || param.type === 'integer' || param.type === 'float'
                                                        ? 'number'
                                                        : 'text'),
                                                  min: param.min,
                                                  max: param.max,
                                                  step: param.step,
                                                  options: param.options,
                                                  placeholder: param.placeholder,
                                                }}
                                                value={value}
                                                onChange={(val) => updateParam(param.key, val)}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Round Settings */}
                                    <div className="pt-3 mt-3" style={{ borderTop: '1px solid var(--ss-border)' }}>
                                      <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--ss-text)' }}>
                                        {t('experimentBuilder.roundSettings.title', { defaultValue: 'Round Settings' })}
                                      </h4>
                                      <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ss-text)' }}>
                                          {t('experimentBuilder.roundSettings.roundVisibility.label', { defaultValue: 'Round Visibility' })}
                                        </label>
                                        <select
                                          value={displayRoundVisibility}
                                          onChange={(e) => updateRoundVisibility(e.target.value as 'simultaneous' | 'sequential')}
                                          className="w-full px-2 py-1 border rounded text-xs"
                                          style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                        >
                                          <option value="simultaneous">
                                            {t('experimentBuilder.roundSettings.roundVisibility.simultaneous', { defaultValue: 'Simultaneous' })}
                                          </option>
                                          <option value="sequential">
                                            {t('experimentBuilder.roundSettings.roundVisibility.sequential', { defaultValue: 'Sequential' })}
                                          </option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* NETWORK_TOPOLOGY UI */}
                              {iv.type === 'NETWORK_TOPOLOGY' && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Network size={14} style={{ color: 'var(--ss-brand-primary)' }} />
                                    <select
                                      value={iv.networkPreset || 'full'}
                                      onChange={(e) => updateIntervention(variant.id, iv.id, 'networkPreset', e.target.value)}
                                      className="text-xs border rounded px-2 py-1 outline-none"
                                      style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                    >
                                      <option value="full">{t('components.experimentDesignModal.presetFull')}</option>
                                      <option value="ring">{t('components.experimentDesignModal.presetRing')}</option>
                                      <option value="star">{t('components.experimentDesignModal.presetStar')}</option>
                                      <option value="random">{t('components.experimentDesignModal.presetRandom')}</option>
                                      <option value="newman-watts">{t('components.experimentDesignModal.presetNewmanWatts')}</option>
                                      <option value="core-periphery">{t('components.experimentDesignModal.presetCorePeriphery')}</option>
                                      <option value="holme-kim">{t('components.experimentDesignModal.presetHolmeKim')}</option>
                                      <option value="waxman">{t('components.experimentDesignModal.presetWaxman')}</option>
                                      <option value="sbm">{t('components.experimentDesignModal.presetSbm')}</option>
                                      <option value="custom">{t('components.experimentDesignModal.presetCustom')}</option>
                                    </select>
                                  </div>

                                  {iv.networkPreset === 'random' && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <label>{t('components.experimentDesignModal.paramConnectionChance')}</label>
                                      <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={iv.networkParams?.random?.connectionChance ?? 0.3}
                                        onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                          ...iv.networkParams,
                                          random: { connectionChance: parseFloat(e.target.value) }
                                        })}
                                        className="w-20"
                                      />
                                      <span className="w-8">{((iv.networkParams?.random?.connectionChance ?? 0.3) * 100).toFixed(0)}%</span>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'newman-watts' && (
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramNeighborsEachSide')}</label>
                                        <input
                                          type="number" min="1" max="5"
                                          value={iv.networkParams?.['newman-watts']?.neighborsEachSide ?? 2}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'newman-watts': {
                                              neighborsEachSide: parseInt(e.target.value),
                                              shortcutChance: iv.networkParams?.['newman-watts']?.shortcutChance ?? 0.1
                                            }
                                          })}
                                          className="w-12 border rounded px-1"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramShortcutChance')}</label>
                                        <input
                                          type="range" min="0" max="1" step="0.05"
                                          value={iv.networkParams?.['newman-watts']?.shortcutChance ?? 0.1}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'newman-watts': {
                                              neighborsEachSide: iv.networkParams?.['newman-watts']?.neighborsEachSide ?? 2,
                                              shortcutChance: parseFloat(e.target.value)
                                            }
                                          })}
                                          className="w-16"
                                        />
                                        <span>{((iv.networkParams?.['newman-watts']?.shortcutChance ?? 0.1) * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'core-periphery' && (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramInfluencerPercent')}</label>
                                        <input
                                          type="range" min="0.1" max="0.5" step="0.05"
                                          value={iv.networkParams?.['core-periphery']?.influencerPercent ?? 0.2}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'core-periphery': {
                                              influencerPercent: parseFloat(e.target.value),
                                              influencerConnectivity: iv.networkParams?.['core-periphery']?.influencerConnectivity ?? 0.8,
                                              influencerReach: iv.networkParams?.['core-periphery']?.influencerReach ?? 0.4,
                                              regularConnectivity: iv.networkParams?.['core-periphery']?.regularConnectivity ?? 0.1
                                            }
                                          })}
                                          className="w-12"
                                        />
                                        <span>{((iv.networkParams?.['core-periphery']?.influencerPercent ?? 0.2) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramInfluencerConnectivity')}</label>
                                        <input
                                          type="range" min="0.5" max="1" step="0.05"
                                          value={iv.networkParams?.['core-periphery']?.influencerConnectivity ?? 0.8}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'core-periphery': {
                                              influencerPercent: iv.networkParams?.['core-periphery']?.influencerPercent ?? 0.2,
                                              influencerConnectivity: parseFloat(e.target.value),
                                              influencerReach: iv.networkParams?.['core-periphery']?.influencerReach ?? 0.4,
                                              regularConnectivity: iv.networkParams?.['core-periphery']?.regularConnectivity ?? 0.1
                                            }
                                          })}
                                          className="w-12"
                                        />
                                        <span>{((iv.networkParams?.['core-periphery']?.influencerConnectivity ?? 0.8) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramInfluencerReach')}</label>
                                        <input
                                          type="range" min="0.1" max="0.8" step="0.05"
                                          value={iv.networkParams?.['core-periphery']?.influencerReach ?? 0.4}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'core-periphery': {
                                              influencerPercent: iv.networkParams?.['core-periphery']?.influencerPercent ?? 0.2,
                                              influencerConnectivity: iv.networkParams?.['core-periphery']?.influencerConnectivity ?? 0.8,
                                              influencerReach: parseFloat(e.target.value),
                                              regularConnectivity: iv.networkParams?.['core-periphery']?.regularConnectivity ?? 0.1
                                            }
                                          })}
                                          className="w-12"
                                        />
                                        <span>{((iv.networkParams?.['core-periphery']?.influencerReach ?? 0.4) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramRegularConnectivity')}</label>
                                        <input
                                          type="range" min="0" max="0.5" step="0.05"
                                          value={iv.networkParams?.['core-periphery']?.regularConnectivity ?? 0.1}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'core-periphery': {
                                              influencerPercent: iv.networkParams?.['core-periphery']?.influencerPercent ?? 0.2,
                                              influencerConnectivity: iv.networkParams?.['core-periphery']?.influencerConnectivity ?? 0.8,
                                              influencerReach: iv.networkParams?.['core-periphery']?.influencerReach ?? 0.4,
                                              regularConnectivity: parseFloat(e.target.value)
                                            }
                                          })}
                                          className="w-12"
                                        />
                                        <span>{((iv.networkParams?.['core-periphery']?.regularConnectivity ?? 0.1) * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'holme-kim' && (
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramNewConnections')}</label>
                                        <input
                                          type="number" min="1" max="5"
                                          value={iv.networkParams?.['holme-kim']?.newConnections ?? 3}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'holme-kim': {
                                              newConnections: parseInt(e.target.value),
                                              clusteringChance: iv.networkParams?.['holme-kim']?.clusteringChance ?? 0.5
                                            }
                                          })}
                                          className="w-12 border rounded px-1"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramClusteringChance')}</label>
                                        <input
                                          type="range" min="0" max="1" step="0.1"
                                          value={iv.networkParams?.['holme-kim']?.clusteringChance ?? 0.5}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            'holme-kim': {
                                              newConnections: iv.networkParams?.['holme-kim']?.newConnections ?? 3,
                                              clusteringChance: parseFloat(e.target.value)
                                            }
                                          })}
                                          className="w-16"
                                        />
                                        <span>{((iv.networkParams?.['holme-kim']?.clusteringChance ?? 0.5) * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'waxman' && (
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramMaxDistance')}</label>
                                        <input
                                          type="range" min="0.1" max="1" step="0.1"
                                          value={iv.networkParams?.waxman?.maxDistance ?? 0.5}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            waxman: {
                                              maxDistance: parseFloat(e.target.value),
                                              distanceEffect: iv.networkParams?.waxman?.distanceEffect ?? 0.5
                                            }
                                          })}
                                          className="w-16"
                                        />
                                        <span>{(iv.networkParams?.waxman?.maxDistance ?? 0.5).toFixed(1)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramDistanceEffect')}</label>
                                        <input
                                          type="range" min="0.1" max="1" step="0.1"
                                          value={iv.networkParams?.waxman?.distanceEffect ?? 0.5}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            waxman: {
                                              maxDistance: iv.networkParams?.waxman?.maxDistance ?? 0.5,
                                              distanceEffect: parseFloat(e.target.value)
                                            }
                                          })}
                                          className="w-16"
                                        />
                                        <span>{(iv.networkParams?.waxman?.distanceEffect ?? 0.5).toFixed(1)}</span>
                                      </div>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'sbm' && (
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramGroupSize')}</label>
                                        <input
                                          type="number" min="2" max="10"
                                          value={iv.networkParams?.sbm?.groupSize ?? 5}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            sbm: {
                                              groupSize: parseInt(e.target.value),
                                              withinGroupConnectivity: iv.networkParams?.sbm?.withinGroupConnectivity ?? 0.6,
                                              bridgeConnections: iv.networkParams?.sbm?.bridgeConnections ?? 1
                                            }
                                          })}
                                          className="w-12 border rounded px-1"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramWithinGroupConnectivity')}</label>
                                        <input
                                          type="range" min="0.2" max="1" step="0.1"
                                          value={iv.networkParams?.sbm?.withinGroupConnectivity ?? 0.6}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            sbm: {
                                              groupSize: iv.networkParams?.sbm?.groupSize ?? 5,
                                              withinGroupConnectivity: parseFloat(e.target.value),
                                              bridgeConnections: iv.networkParams?.sbm?.bridgeConnections ?? 1
                                            }
                                          })}
                                          className="w-12"
                                        />
                                        <span>{((iv.networkParams?.sbm?.withinGroupConnectivity ?? 0.6) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <label>{t('components.experimentDesignModal.paramBridgeConnections')}</label>
                                        <input
                                          type="number" min="0" max="5"
                                          value={iv.networkParams?.sbm?.bridgeConnections ?? 1}
                                          onChange={(e) => updateIntervention(variant.id, iv.id, 'networkParams', {
                                            ...iv.networkParams,
                                            sbm: {
                                              groupSize: iv.networkParams?.sbm?.groupSize ?? 5,
                                              withinGroupConnectivity: iv.networkParams?.sbm?.withinGroupConnectivity ?? 0.6,
                                              bridgeConnections: parseInt(e.target.value)
                                            }
                                          })}
                                          className="w-12 border rounded px-1"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {iv.networkPreset === 'custom' && (
                                    <textarea
                                      value={iv.customEdges?.map((e: [string, string]) => e.join(', ')).join('\n') || ''}
                                      onChange={(e) => {
                                        const edges = e.target.value.split('\n')
                                          .map((line: string) => {
                                            const parts = line.split(',').map((s: string) => s.trim());
                                            return parts.length >= 2 ? [parts[0], parts[1]] as [string, string] : null;
                                          })
                                          .filter((e: [string, string] | null): e is [string, string] => e !== null);
                                        updateIntervention(variant.id, iv.id, 'customEdges', edges);
                                      }}
                                      placeholder={t('components.experimentDesignModal.customEdgesPlaceholder')}
                                      className="w-full text-xs border rounded p-2 font-mono h-16"
                                      style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                                    />
                                  )}

                                  {iv.networkPreset && iv.networkPreset !== 'custom' && agents.length > 0 && (
                                    <div className="text-xs" style={{ color: 'var(--ss-text-muted)' }}>
                                      {t('components.experimentDesignModal.networkEdgeCountHint', {
                                        n: agents.length,
                                        e: generateNetwork(iv.networkPreset as any, agents.map(a => a.name), iv.networkParams as any, 1).edges.length
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              {iv.type !== 'SCENARIO_PARAMS' && iv.type !== 'NETWORK_TOPOLOGY' && (
                              <textarea
                                value={iv.description}
                                onChange={(e) => updateIntervention(variant.id, iv.id, 'description', e.target.value)}
                                placeholder={
                                  iv.type === 'AGENT_PROPERTY'
                                    ? t('components.experimentDesignModal.propertyPlaceholder')
                                    : iv.type === 'FOLLOW_UP_CONDITION'
                                      ? t('components.experimentDesignModal.followUpConditionPlaceholder', { defaultValue: '例如: resource_shortage=0.8, public_opinion_pressure=0.6 或 {"resource_shortage": 0.8}' })
                                      : iv.type === 'FOLLOW_UP_THREAD_SEED'
                                        ? t('components.experimentDesignModal.followUpThreadSeedPlaceholder', { defaultValue: '例如: 智能体3想要给智能体4发消息，消息内容为执行困难，需要回应。也支持 JSON。' })
                                    : t('components.experimentDesignModal.descriptionPlaceholder')
                                }
                                className="w-full text-xs border rounded p-2 focus:outline-none resize-none h-16"
                                style={{ background: 'var(--ss-input-bg)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}
                              />
                              )}
                              {extractMarkdownImages(iv.description || '').length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {extractMarkdownImages(iv.description || '').map((url) => (
                                    <div key={url} className="w-16 h-16 border rounded overflow-hidden" style={{ background: 'var(--ss-surface-inset)', borderColor: 'var(--ss-border)' }}>
                                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => removeIntervention(variant.id, iv.id)}
                                className="absolute top-2 right-2"
                                style={{ color: 'var(--ss-text-subtle)' }}
                              >
                                <X size={14} />
                              </button>
                           </div>
                         ))
                       )}
                       
                       <button
                         onClick={() => addIntervention(variant.id)}
                         className="w-full py-2 border-2 border-dashed rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                         style={{ borderColor: 'var(--ss-brand-soft)', color: 'var(--ss-brand-primary)' }}
                       >
                         <Plus size={14} /> {t('components.experimentDesignModal.addIntervention')}
                       </button>
                    </div>
                  </div>
                ))}

                {/* Add Variant Button */}
                <button
                  onClick={handleAddVariant}
                  className="border-2 border-dashed rounded-xl min-h-[200px] flex flex-col items-center justify-center transition-all gap-2"
                  style={{ background: 'var(--ss-surface-inset)', borderColor: 'var(--ss-border)', color: 'var(--ss-text-subtle)' }}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center" style={{ background: 'var(--ss-layer-card)' }}>
                    <Plus size={24} />
                  </div>
                  <span className="font-bold text-sm">{t('components.experimentDesignModal.addVariant')}</span>
                </button>
             </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="absolute inset-0 backdrop-blur-sm z-10 flex flex-col" style={{ background: 'var(--ss-surface)' }}>
            <div className="px-6 py-4 border-b shrink-0" style={{ background: 'var(--ss-brand-soft)', borderColor: 'var(--ss-border)' }}>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--ss-heading)' }}>
                <Sliders size={20} />
                {t('components.experimentDesignModal.previewTitle')}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {buildPreviewData().map((preview) => (
                  <div key={preview.variantId} className="rounded-lg p-4" style={{ background: 'var(--ss-surface-inset)' }}>
                    <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--ss-heading)' }}>
                      {t('components.experimentDesignModal.previewVariant')}: {preview.variantName}
                    </h4>

                    {/* Scenario Parameter Changes */}
                    {preview.paramChanges.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold mb-2" style={{ color: 'var(--ss-text-muted)' }}>
                          {t('components.experimentDesignModal.previewScenarioParams')}:
                        </h5>
                        <div className="space-y-1">
                          {preview.paramChanges.map((change, idx) => (
                            <div key={idx} className="text-xs flex items-center gap-2">
                              <span className="font-mono" style={{ color: change.unknown ? 'var(--ss-warning)' : 'var(--ss-text)' }}>
                                {change.key}
                                {change.unknown && <span className="ml-1">{t('components.experimentDesignModal.previewUnknownKey')}</span>}
                              </span>
                              <span style={{ color: 'var(--ss-text-subtle)' }}>→</span>
                              <span className="font-mono" style={{ color: 'var(--ss-brand-primary)' }}>{String(change.new)}</span>
                              {change.was !== undefined && (
                                <span className="text-[10px]" style={{ color: 'var(--ss-text-subtle)' }}>
                                  ({t('components.experimentDesignModal.previewWas')}: {String(change.was)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Interventions */}
                    {preview.otherInterventions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-2" style={{ color: 'var(--ss-text-muted)' }}>
                          {t('components.experimentDesignModal.interventionCount')}:
                        </h5>
                        <div className="space-y-1">
                          {preview.otherInterventions.map((iv, idx) => (
                            <div key={idx} className="text-xs rounded px-2 py-1" style={{ background: 'var(--ss-layer-card)' }}>
                              <span className="font-semibold" style={{ color: 'var(--ss-text-muted)' }}>{translateInterventionType(iv.type)}:</span>{' '}
                              <span style={{ color: 'var(--ss-text)' }}>{iv.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {preview.paramChanges.length === 0 && preview.otherInterventions.length === 0 && (
                      <div className="text-xs italic" style={{ color: 'var(--ss-text-subtle)' }}>
                        {t('components.experimentDesignModal.previewNoChanges')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: 'var(--ss-border)' }}>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ color: 'var(--ss-text-muted)' }}
              >
                {t('components.experimentDesignModal.previewBack')}
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleSubmit();
                }}
                className="px-6 py-2 text-sm font-medium rounded-lg flex items-center gap-2"
                style={{ background: 'var(--ss-brand-primary)', color: 'var(--ss-brand-on)' }}
              >
                <Zap size={16} />
                {t('components.experimentDesignModal.previewConfirm')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: 'var(--ss-border)' }}>
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'var(--ss-text-muted)' }}>
            {t('components.experimentDesignModal.cancel')}
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="px-6 py-2 text-sm font-medium rounded-lg flex items-center gap-2"
            style={{ background: 'var(--ss-brand-primary)', color: 'var(--ss-brand-on)' }}
          >
            <Sliders size={16} />
            {t('components.experimentDesignModal.startBatch', { count: variants.length })}
          </button>
        </div>
      </div>
    </div>
  );
};
