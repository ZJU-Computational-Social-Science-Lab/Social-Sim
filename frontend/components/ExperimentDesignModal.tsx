
import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store';
import { useTranslation } from 'react-i18next';
import { X, Beaker, Plus, Trash2, Zap, UserCog, Settings, ArrowRight } from 'lucide-react';
import { ExperimentVariant, Intervention } from '../types';
import { connectNodeEvents } from '../services/simulationTree';
import { MultimodalInput } from './MultimodalInput';

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
  if (/越级|投诉|告状/.test(normalized)) return 'escalation';
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

  const baseNode = nodes.find(n => n.id === selectedNodeId);

  const createDefaultVariants = (): ExperimentVariant[] => ([
    { id: 'v1', name: `${t('components.experimentDesignModal.variantPrefix')} A`, description: '', interventions: [] },
    { id: 'v2', name: `${t('components.experimentDesignModal.variantPrefix')} B`, description: '', interventions: [] },
  ]);

  const [experimentName, setExperimentName] = useState('');
  const [variants, setVariants] = useState<ExperimentVariant[]>(createDefaultVariants());

  // live per-node logs: nodeId (string) -> array of log entries
  const [nodeLogs, setNodeLogs] = useState<Record<string, any[]>>({});
  // active sockets to allow cleanup
  const [nodeSockets, setNodeSockets] = useState<Record<string, WebSocket | null>>({});

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

    variants.forEach((variant) => {
      const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === baseNode.id && n.name.includes(variant.name));
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
      addNotification('error', t('components.experimentDesignModal.selectNodeFirst'));
      toggle(false);
    }
  }, [isOpen, baseNode, addNotification, t, toggle]);

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

          const target = agents.find((a) => a.id === iv.targetId);
          const name = target ? target.name : iv.targetId;
          ops.push({ op: 'agent_props_patch', name, updates });
        } else if (iv.type === 'INSTRUCTION') {
          // broadcast instruction as public event
          ops.push({ op: 'public_broadcast', text: iv.description || '' });
        } else if (iv.type === 'ENVIRONMENT') {
          ops.push({ op: 'public_broadcast', text: iv.description || '' });
        } else if (iv.type === 'FOLLOW_UP_CONDITION') {
          const updates = parseConditionUpdates(iv.description || '');
          Object.assign(pendingFollowUpConditions, updates);
        } else if (iv.type === 'FOLLOW_UP_THREAD_SEED' && iv.targetId) {
          const seed = parseThreadSeed(iv.description || '', agents.map((a) => a.name));
          const target = agents.find((a) => a.id === iv.targetId);
          const recipient = seed.recipient || (target ? target.name : iv.targetId);
          pendingThreadSeeds.push({
            recipient,
            sender: seed.sender,
            kind: seed.kind || 'peer_consult',
            message: seed.message || '',
            notice: seed.notice || '',
            metadata: seed.metadata || {},
          });
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
    setVariants(createDefaultVariants());
  };

  const totalInterventions = variants.reduce((sum, variant) => sum + variant.interventions.length, 0);

  const getVariantNode = (variant: ExperimentVariant) => {
    const nodeByMeta = nodes.find(
      (node) =>
        (node as any).meta &&
        (node as any).meta.variant_id &&
        node.parentId === baseNode.id &&
        node.name.includes(variant.name)
    );
    const nodeByName = nodes.find((node) => node.name === `${experimentName}: ${variant.name}`);
    return nodeByMeta || nodeByName || null;
  };

  const getVariantStatusClass = (status?: string) => {
    if (status === 'running') return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
    if (status === 'completed') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    if (status === 'failed') return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
    return 'border-white/10 bg-white/5 text-slate-300';
  };

  const getVariantStatusLabel = (status?: string) => {
    if (status === 'running') return t('components.experimentDesignModal.statusRunning');
    if (status === 'completed') return t('components.experimentDesignModal.statusCompleted');
    if (status === 'failed') return t('components.experimentDesignModal.statusFailed');
    return t('components.experimentDesignModal.statusPending');
  };

  return (
    <div className="ss-intervention-modal">
      <div className="ss-intervention-modal__dialog animate-in fade-in zoom-in-95 duration-200">
        <div className="ss-intervention-modal__header">
          <div className="space-y-3">
            <div className="ss-kicker ss-intervention-kicker">
              {t('components.experimentDesignModal.title')}
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[#8FB8F3]">
                <Beaker size={22} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                  {t('components.experimentDesignModal.title')}
                </h2>
                <p
                  className="max-w-3xl text-sm leading-7 text-slate-300"
                  dangerouslySetInnerHTML={{
                    __html: t('components.experimentDesignModal.subtitle', {
                      displayId: baseNode.display_id,
                      name: baseNode.name,
                    }),
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="ss-pill border-white/10 bg-white/6 text-slate-200">
              {t('components.experimentDesignModal.controlGroup')}: {baseNode.display_id}
            </span>
            <button
              onClick={() => toggle(false)}
              className="ss-icon-button border-white/10 bg-white/6 text-slate-200 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ss-intervention-modal__body">
          <aside className="ss-intervention-modal__rail overflow-y-auto">
            <section className="ss-intervention-card space-y-4 p-5">
              <div className="ss-kicker ss-intervention-kicker">
                {t('components.experimentDesignModal.hintTitle')}
              </div>
              <div className="grid gap-3">
                <div className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {t('components.experimentDesignModal.controlGroup')}
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-100">{baseNode.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    {t('components.experimentDesignModal.controlGroupDescription')}
                  </div>
                </div>
                <div className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {t('components.experimentDesignModal.baselineReference')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-100">
                    {t('components.experimentDesignModal.controlGroupState')}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-slate-400">
                    {t('components.experimentDesignModal.baselineHint')}
                  </div>
                </div>
              </div>
            </section>

            <section className="ss-intervention-card space-y-4 p-5">
              <div className="ss-kicker text-[rgba(191,219,254,0.78)]">
                {t('components.experimentDesignModal.designerGuide')}
              </div>
              <ul className="space-y-3 text-sm leading-6 text-slate-300">
                <li className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  {t('components.experimentDesignModal.hintAddVariant')}
                </li>
                <li className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  {t('components.experimentDesignModal.hintDefineVariables')}
                </li>
                <li className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  {t('components.experimentDesignModal.hintAutoParallel')}
                </li>
              </ul>
            </section>
          </aside>

          <main className="ss-intervention-modal__main">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
              <div>
                <div className="ss-kicker ss-intervention-kicker">
                  {t('components.experimentDesignModal.variantWorkspace')}
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                  {t('components.experimentDesignModal.variantTitle')}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  {t('components.experimentDesignModal.variantCopy')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ss-pill border-white/10 bg-white/6 text-slate-200">
                  {t('components.experimentDesignModal.variantCount')}: {variants.length}
                </span>
                <span className="ss-pill border-white/10 bg-white/6 text-slate-200">
                  {t('components.experimentDesignModal.interventionCount')}: {totalInterventions}
                </span>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                
                {variants.map((variant, index) => {
                  const variantNode = getVariantNode(variant);
                  const status = variantNode?.status || 'pending';
                  const variantLogItems = variantNode ? nodeLogs[String(variantNode.id)] || [] : [];

                  return (
                  <section key={variant.id} className="ss-intervention-card overflow-hidden">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ss-kicker ss-intervention-kicker">
                            {t('components.experimentDesignModal.variantPrefix')} {String.fromCharCode(65 + index)}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${getVariantStatusClass(status)}`}>
                            {getVariantStatusLabel(status)}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                          className="w-full border-0 bg-transparent px-0 text-xl font-semibold tracking-[-0.03em] text-slate-50 focus:outline-none focus:ring-0"
                        />
                        <textarea
                          value={variant.description || ''}
                          onChange={(e) => handleUpdateVariant(variant.id, 'description', e.target.value)}
                          rows={2}
                          placeholder={t('components.experimentDesignModal.variantDescriptionPlaceholder')}
                          className="ss-input min-h-[86px] border-white/10 bg-white/6 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveVariant(variant.id)}
                        className="ss-icon-button border-white/10 bg-white/5 text-slate-300 hover:text-rose-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-4 px-5 py-5">
                      {variantNode ? (
                        <div className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                {t('components.experimentDesignModal.liveVariantChannel')}
                              </div>
                              <div className="mt-2 text-sm font-medium text-slate-100">
                                {variantNode.display_id || variantNode.id}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-2 text-xs text-emerald-200">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                              {t('components.experimentDesignModal.liveLogPreview', {
                                count: Math.min(5, variantLogItems.length),
                              })}
                            </span>
                          </div>
                          <div className="mt-3 max-h-32 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                            {variantLogItems.length > 0 ? (
                              variantLogItems.slice(-4).map((entry: any, entryIndex: number) => (
                                <div key={`${variant.id}-${entryIndex}`} className="border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    {String(entry.type || entry.event_type || 'evt')}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-slate-300">
                                    {String((entry.data && (entry.data.action || entry.data.message || JSON.stringify(entry.data))) || entry.data || '')}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500">{t('components.experimentDesignModal.noLogsYet')}</div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <div className="ss-kicker ss-intervention-kicker">
                          {t('components.experimentDesignModal.interventionWorkbench')}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {t('components.experimentDesignModal.interventionCount')}: {variant.interventions.length}
                        </p>
                      </div>

                      {variant.interventions.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-white/10 bg-white/3 px-5 py-10 text-center text-sm text-slate-400">
                          {t('components.experimentDesignModal.noInterventions')}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {variant.interventions.map((iv) => (
                            <div key={iv.id} className="ss-inset relative space-y-3 border-white/10 bg-white/5 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                                  {iv.type === 'AGENT_PROPERTY' ? <UserCog size={16} className="text-[#8FB8F3]" /> : null}
                                  {iv.type === 'ENVIRONMENT' ? <Settings size={16} className="text-emerald-300" /> : null}
                                  {iv.type === 'FOLLOW_UP_CONDITION' ? <ArrowRight size={16} className="text-amber-200" /> : null}
                                  {iv.type === 'FOLLOW_UP_THREAD_SEED' ? <ArrowRight size={16} className="text-[#D6C9F8]" /> : null}
                                  {iv.type === 'INSTRUCTION' ? <Zap size={16} className="text-amber-200" /> : null}
                                  <span>{t('components.experimentDesignModal.interventionCardTitle')}</span>
                                </div>
                                <button
                                  onClick={() => removeIntervention(variant.id, iv.id)}
                                  className="ss-icon-button border-white/10 bg-white/5 text-slate-300 hover:text-rose-100"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                                <select
                                  value={iv.type}
                                  onChange={(e) => updateIntervention(variant.id, iv.id, 'type', e.target.value)}
                                  className="ss-input border-white/10 bg-white/6 text-slate-100"
                                >
                                  <option value="INSTRUCTION">{t('components.experimentDesignModal.instructionType')}</option>
                                  <option value="AGENT_PROPERTY">{t('components.experimentDesignModal.propertyType')}</option>
                                  <option value="ENVIRONMENT">{t('components.experimentDesignModal.environmentType')}</option>
                                  <option value="FOLLOW_UP_CONDITION">{t('components.experimentDesignModal.followUpConditionType')}</option>
                                  <option value="FOLLOW_UP_THREAD_SEED">{t('components.experimentDesignModal.followUpThreadSeedType')}</option>
                                </select>

                                {(iv.type === 'AGENT_PROPERTY' || iv.type === 'FOLLOW_UP_THREAD_SEED') && (
                                  <select
                                    value={iv.targetId || ''}
                                    onChange={(e) => updateIntervention(variant.id, iv.id, 'targetId', e.target.value)}
                                    className="ss-input border-white/10 bg-white/6 text-slate-100"
                                  >
                                    <option value="">{t('components.experimentDesignModal.selectAgent')}</option>
                                    {agents.map((agent) => (
                                      <option key={agent.id} value={agent.id}>
                                        {agent.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                                <MultimodalInput
                                  label={t('components.experimentDesignModal.imageLabel')}
                                  helperText={t('components.experimentDesignModal.imageHelper')}
                                  onInsert={(url) => handleEmbedInterventionImage(variant.id, iv.id, url)}
                                />
                              </div>

                              <textarea
                                value={iv.description}
                                onChange={(e) => updateIntervention(variant.id, iv.id, 'description', e.target.value)}
                                placeholder={
                                  iv.type === 'AGENT_PROPERTY'
                                    ? t('components.experimentDesignModal.propertyPlaceholder')
                                    : iv.type === 'FOLLOW_UP_CONDITION'
                                      ? t('components.experimentDesignModal.followUpConditionPlaceholder')
                                      : iv.type === 'FOLLOW_UP_THREAD_SEED'
                                        ? t('components.experimentDesignModal.followUpThreadSeedPlaceholder')
                                        : t('components.experimentDesignModal.descriptionPlaceholder')
                                }
                                className="ss-input min-h-[112px] resize-y border-white/10 bg-white/6 text-slate-100 placeholder:text-slate-500"
                              />

                              {extractMarkdownImages(iv.description || '').length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {extractMarkdownImages(iv.description || '').map((url) => (
                                    <div key={url} className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                      <img src={url} alt="preview" className="h-full w-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => addIntervention(variant.id)}
                        className="ss-button-secondary w-full border-dashed border-[#6EA9F6]/30 bg-[#2F80ED]/8 text-[#DCEBFD]"
                      >
                        <Plus size={14} /> {t('components.experimentDesignModal.addIntervention')}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          </main>

          <aside className="ss-intervention-modal__summary overflow-y-auto">
            <section className="ss-intervention-card p-4">
              <div className="ss-intervention-name-row">
                <span className="ss-form-label !mb-0">{t('components.experimentDesignModal.experimentNameLabel')}</span>
                <input
                  type="text"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  placeholder={t('components.experimentDesignModal.experimentNamePlaceholder')}
                  className="ss-input ss-intervention-name-row__input border-white/10 bg-white/6 text-slate-50 placeholder:text-slate-500"
                />
              </div>
            </section>

            <button onClick={handleAddVariant} className="ss-button">
              <Plus size={16} />
              {t('components.experimentDesignModal.addVariant')}
            </button>

            <section className="ss-intervention-card space-y-4 p-5">
              <div className="ss-kicker ss-intervention-kicker">
                {t('components.experimentDesignModal.launchQueue')}
              </div>
              <div className="grid gap-3">
                <div className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {t('components.experimentDesignModal.variantCount')}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                    {variants.length}
                  </div>
                </div>
                <div className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {t('components.experimentDesignModal.interventionCount')}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                    {totalInterventions}
                  </div>
                </div>
              </div>
            </section>

            <section className="ss-intervention-card space-y-4 p-5">
              <div className="ss-kicker ss-intervention-kicker">
                {t('components.experimentDesignModal.summaryTitle')}
              </div>
              <div className="space-y-3">
                {variants.map((variant, index) => (
                  <div key={variant.id} className="ss-inset border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-100">{variant.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {t('components.experimentDesignModal.interventionCount')}: {variant.interventions.length}
                        </div>
                      </div>
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {String.fromCharCode(65 + index)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="ss-intervention-card mt-auto space-y-4 p-5">
              <div className="ss-kicker ss-intervention-kicker">
                {t('components.experimentDesignModal.launchDecision')}
              </div>
              <p className="text-sm leading-7 text-slate-300">
                {t('components.experimentDesignModal.launchCopy')}
              </p>
              <div className="grid gap-3">
                <button onClick={() => toggle(false)} className="ss-button-secondary w-full border-white/10 bg-white/6 text-slate-100">
                  {t('components.experimentDesignModal.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={!experimentName.trim()} className="ss-button w-full">
                  <Zap size={16} />
                  {t('components.experimentDesignModal.startBatch', { count: variants.length })}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
