
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore } from '../store';
import { ArrowRight, Sparkles, Loader2, GitCommit, User } from 'lucide-react';
import * as d3 from 'd3';
import * as experimentsApi from '../services/experiments';

export const ComparisonView: React.FC = () => {
   const { t } = useTranslation();
   const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
   const compareTargetNodeId = useSimulationStore(state => state.compareTargetNodeId);
   const nodes = useSimulationStore(state => state.nodes);
   const agents = useSimulationStore(state => state.agents);
   const comparisonSummary = useSimulationStore(state => state.comparisonSummary);
   const isGenerating = useSimulationStore(state => state.isGenerating);
   const generateComparisonAnalysis = useSimulationStore(state => state.generateComparisonAnalysis);
   const comparisonUseLLM = useSimulationStore(state => state.comparisonUseLLM);
   const setComparisonUseLLM = useSimulationStore(state => state.setComparisonUseLLM);
   const currentSimulation = useSimulationStore(state => state.currentSimulation);

   const nodeA = nodes.find(n => n.id === selectedNodeId);
   const nodeB = nodes.find(n => n.id === compareTargetNodeId);

   const [compareData, setCompareData] = useState<any | null>(null);

   useEffect(() => {
      let mounted = true;
      if (!selectedNodeId || !compareTargetNodeId) {
         setCompareData(null);
         return;
      }

      const timer = setTimeout(async () => {
         try {
            const simId = currentSimulation?.id;
                  if (!simId) return;
                  const useLLM = Boolean(comparisonUseLLM);
                  const a = Number(selectedNodeId);
                  const b = Number(compareTargetNodeId);
                  if (!Number.isFinite(a) || !Number.isFinite(b)) {
                      // Avoid sending invalid payloads (which become null in JSON)
                      console.warn('ComparisonView: selected node ids are not backend node ids', selectedNodeId, compareTargetNodeId);
                      // Show a user-visible notification explaining why compare is skipped
                      const notify = useSimulationStore.getState().addNotification;
                      try {
                         notify('error', t('components.comparisonView.notBackendNodeError'));
                      } catch (e) {
                         // best-effort: ignore
                      }
                      setCompareData(null);
                      return;
                  }
            const res = await experimentsApi.compareNodes(simId, a, b, useLLM);
            if (!mounted) return;
            setCompareData(res || null);
         } catch (e) {
            console.error('compareNodes failed', e);
            if (mounted) setCompareData(null);
         }
      }, 400);

      return () => {
         mounted = false;
         clearTimeout(timer);
      };
   }, [selectedNodeId, compareTargetNodeId, comparisonUseLLM, currentSimulation]);

   if (!nodeA) return <div className="p-8 text-[var(--ss-workspace-muted)]">{t('components.comparisonView.selectBaselineNode')}</div>;
   if (!nodeB) return <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[var(--ss-workspace-muted)]">
       <GitCommit size={48} className="mb-4 text-[var(--ss-workspace-border-strong)]" />
       <p>{t('components.comparisonView.selectCompareNode')}</p>
       <p className="text-xs mt-2">{t('components.comparisonView.selectCompareNodeHint')}</p>
   </div>;

   const leftEvents = compareData?.only_in_a || [];
   const rightEvents = compareData?.only_in_b || [];
   const agentDiffs = compareData?.agent_diffs || {};
   const baselineCardStyle: React.CSSProperties = {
      borderColor: 'color-mix(in srgb, var(--ss-info) 26%, var(--ss-workspace-border) 74%)',
      background: 'color-mix(in srgb, var(--ss-info) 12%, var(--ss-workspace-surface-strong) 88%)',
   };
   const baselineLabelStyle: React.CSSProperties = {
      color: 'color-mix(in srgb, var(--ss-info) 72%, var(--ss-workspace-heading) 28%)',
   };
   const compareCardStyle: React.CSSProperties = {
      borderColor: 'color-mix(in srgb, var(--ss-secondary) 28%, var(--ss-workspace-border) 72%)',
      background: 'color-mix(in srgb, var(--ss-secondary) 12%, var(--ss-workspace-surface-strong) 88%)',
   };
   const compareLabelStyle: React.CSSProperties = {
      color: 'color-mix(in srgb, var(--ss-secondary) 72%, var(--ss-workspace-heading) 28%)',
   };
   const summaryHeadingStyle: React.CSSProperties = {
      color: 'color-mix(in srgb, var(--ss-secondary) 68%, var(--ss-workspace-heading) 32%)',
   };
   const evidenceCardStyle: React.CSSProperties = {
      borderColor: 'var(--ss-workspace-border)',
      background: 'color-mix(in srgb, var(--ss-workspace-surface-alt) 78%, var(--ss-workspace-surface-strong) 22%)',
   };

   return (
      <div className="ss-workspace__panel ss-workspace__panel--stage flex h-full flex-col overflow-hidden">
         {/* Header */}
         <div className="ss-logviewer__toolbar flex items-center justify-between px-6 py-4 shrink-0">
             <div className="flex items-center gap-6 w-full">
                  <div className="relative flex-1 rounded-2xl border p-3" style={baselineCardStyle}>
                      <div className="mb-1 text-[10px] font-bold uppercase" style={baselineLabelStyle}>{t('components.comparisonView.baseline')}</div>
                      <div className="font-bold text-[var(--ss-workspace-heading)]">{nodeA.name}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ss-workspace-muted)]">{nodeA.display_id}</div>
                  </div>

                  <div className="text-[var(--ss-workspace-muted)]">
                      <ArrowRight size={24} />
                  </div>

                  <div className="relative flex-1 rounded-2xl border p-3" style={compareCardStyle}>
                      <div className="mb-1 text-[10px] font-bold uppercase" style={compareLabelStyle}>{t('components.comparisonView.compare')}</div>
                      <div className="font-bold text-[var(--ss-workspace-heading)]">{nodeB.name}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ss-workspace-muted)]">{nodeB.display_id}</div>
                  </div>
             </div>
         </div>

         {/* Content */}
         <div className="ss-logviewer__body space-y-6 p-6">
            {/* AI Analysis Card */}
            <div className="ss-logviewer__item relative overflow-hidden p-5">
                <div className="mb-3 flex items-center gap-2 font-bold" style={summaryHeadingStyle}>
                     <Sparkles size={18} />
                     <h3>{t('components.comparisonView.smartSummary')}</h3>
                </div>
                        <div className="rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-4 text-sm leading-relaxed text-[var(--ss-workspace-text)] min-h-[80px]">
                               <div className="flex items-center justify-end gap-3 mb-3">
                                    <label className="flex items-center gap-2 text-xs text-[var(--ss-workspace-muted)]">
                                        <input type="checkbox" checked={comparisonUseLLM} onChange={(e) => setComparisonUseLLM(e.target.checked)} />
                                        {t('components.comparisonView.useLLMForSummary')}
                                    </label>
                               </div>
                     {isGenerating ? (
                        <div className="flex items-center gap-2 text-[var(--ss-workspace-muted)]">
                            <Loader2 size={16} className="animate-spin" />
                            {t('components.comparisonView.analyzingDifferences')}
                        </div>
                     ) : compareData ? (
                        <div>
                           <p className="mb-2">{compareData?.summary}</p>
                           <div className="text-xs text-[var(--ss-workspace-muted)]">{t('components.comparisonView.diffEvidenceSamples')}:</div>
                           <div className="grid grid-cols-2 gap-2 mt-2 text-[12px]">
                              <div className="rounded border p-2 text-[var(--ss-workspace-text)]" style={evidenceCardStyle}>{t('components.comparisonView.exampleA')}: {(leftEvents || []).slice(0,3).map((e:any,i:number)=>(<div key={i}>{String(e.type)}: {String(JSON.stringify(e.data)).slice(0,80)}</div>))}</div>
                              <div className="rounded border p-2 text-[var(--ss-workspace-text)]" style={evidenceCardStyle}>{t('components.comparisonView.exampleB')}: {(rightEvents || []).slice(0,3).map((e:any,i:number)=>(<div key={i}>{String(e.type)}: {String(JSON.stringify(e.data)).slice(0,80)}</div>))}</div>
                           </div>
                        </div>
                     ) : (
                        <button onClick={() => generateComparisonAnalysis()} className="text-xs text-[var(--ss-workspace-link)] hover:underline">
                            {t('components.comparisonView.generateAnalysisReport')}
                        </button>
                     )}
                </div>
                {/* Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -z-0 opacity-50 pointer-events-none bg-[var(--ss-accent-warm-soft)]"></div>
            </div>

            {/* Three-column diff area */}
            <div className="ss-logviewer__item overflow-hidden">
               <div className="grid grid-cols-3 gap-2 p-4">
                  {/* Left: Node A events */}
                  <div className="col-span-1 border-r pr-2">
                     <h4 className="mb-2 text-xs text-[var(--ss-workspace-muted)]">{t('components.comparisonView.nodeAEvents')} ({leftEvents.length})</h4>
                     <div className="space-y-2 max-h-64 overflow-auto p-1">
                        {leftEvents.map((ev:any, idx:number) => (
                           <div key={idx} className="rounded-xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-2 text-[12px]">
                              <div className="font-mono text-xs text-[var(--ss-workspace-muted)]">{String(ev.type)}</div>
                              <div className="text-[var(--ss-workspace-text)]">{String(JSON.stringify(ev.data)).slice(0,200)}</div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Middle: Agent diffs & AI summary (already above) */}
                  <div className="col-span-1 px-4">
                     <h4 className="mb-2 text-xs text-[var(--ss-workspace-muted)]">{t('components.comparisonView.agentDiffs')}</h4>
                     <div className="space-y-2 max-h-64 overflow-auto text-sm p-1">
                        {Object.keys(agentDiffs).length === 0 && <div className="text-[var(--ss-workspace-muted)]">{t('components.comparisonView.noAgentDiffs')}</div>}
                        {Object.entries(agentDiffs).map(([name, diffs]: any) => (
                           <div key={name} className="mb-2 rounded-xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-2">
                              <div className="font-medium text-[var(--ss-workspace-heading)]">{name}</div>
                              <div className="mt-1 text-[12px] text-[var(--ss-workspace-muted)]">
                                 {Object.entries(diffs as object).map(([k,v]:any) => (
                                    <div key={k}>{k}: A={String((v as any).a)} → B={String((v as any).b)}</div>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Right: Node B events */}
                  <div className="col-span-1 border-l pl-2">
                     <h4 className="mb-2 text-xs text-[var(--ss-workspace-muted)]">{t('components.comparisonView.nodeBEvents')} ({rightEvents.length})</h4>
                     <div className="space-y-2 max-h-64 overflow-auto p-1">
                        {rightEvents.map((ev:any, idx:number) => (
                           <div key={idx} className="rounded-xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-2 text-[12px]">
                              <div className="font-mono text-xs text-[var(--ss-workspace-muted)]">{String(ev.type)}</div>
                              <div className="text-[var(--ss-workspace-text)]">{String(JSON.stringify(ev.data)).slice(0,200)}</div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

                <div className="ss-logviewer__footer px-5 py-2 text-center text-[10px]">
                     * {t('components.comparisonView.dataSourceNote')}
                </div>
            </div>
      </div>
   );
};
