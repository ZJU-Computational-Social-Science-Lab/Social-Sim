
import React, { useEffect, useState } from 'react';
import { useSimulationStore } from '../store';
import { ArrowRight, Sparkles, Loader2, GitCommit, User } from 'lucide-react';
import * as d3 from 'd3';
import * as experimentsApi from '../services/experiments';

export const ComparisonView: React.FC = () => {
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
                         notify('error', '选中的节点不是后端节点，无法生成后端对比。请切换到 Connected 模式并加载服务器仿真。');
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

   if (!nodeA) return <div className="p-8 text-slate-400">请选择基准节点。</div>;
   if (!nodeB) return <div className="p-8 text-slate-400 text-center flex flex-col items-center justify-center h-full">
       <GitCommit size={48} className="mb-4 text-slate-200" />
       <p>请在仿真树中选择第二个节点进行对比。</p>
       <p className="text-xs mt-2">点击树状图中的节点即可设定为对比对象 (B)。</p>
   </div>;

   const leftEvents = compareData?.only_in_a || [];
   const rightEvents = compareData?.only_in_b || [];
   const agentDiffs = compareData?.agent_diffs || {};

   return (
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
         {/* Header */}
         <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-6 w-full">
                  <div className="flex-1 p-3 bg-blue-50 rounded-lg border border-blue-100 relative">
                      <div className="text-[10px] text-blue-500 uppercase font-bold mb-1">基准 (A)</div>
                      <div className="font-bold text-slate-800">{nodeA.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{nodeA.display_id}</div>
                  </div>
            
                  <div className="text-slate-300">
                      <ArrowRight size={24} />
                  </div>

                  <div className="flex-1 p-3 bg-amber-50 rounded-lg border border-amber-100 relative">
                      <div className="text-[10px] text-amber-500 uppercase font-bold mb-1">对比 (B)</div>
                      <div className="font-bold text-slate-800">{nodeB.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{nodeB.display_id}</div>
                  </div>
             </div>
         </div>

         {/* Content */}
         <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* AI Analysis Card */}
            <div className="bg-white border rounded-xl shadow-sm p-5 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold">
                     <Sparkles size={18} />
                     <h3>智能因果推断 (Smart Summary)</h3>
                </div>
                        <div className="bg-slate-50 rounded-lg p-4 text-sm leading-relaxed text-slate-700 min-h-[80px]">
                               <div className="flex items-center justify-end gap-3 mb-3">
                                    <label className="text-xs text-slate-500 flex items-center gap-2">
                                        <input type="checkbox" checked={comparisonUseLLM} onChange={(e) => setComparisonUseLLM(e.target.checked)} />
                                        使用 LLM 生成摘要
                                    </label>
                               </div>
                     {isGenerating ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 size={16} className="animate-spin" />
                            正在分析两条时间线的差异...
                        </div>
                     ) : compareData ? (
                        <div>
                           <p className="mb-2">{compareData?.summary}</p>
                           <div className="text-xs text-slate-400">差异证据样例：</div>
                           <div className="grid grid-cols-2 gap-2 mt-2 text-[12px]">
                              <div className="bg-slate-50 p-2 rounded">A 示例：{(leftEvents || []).slice(0,3).map((e:any,i:number)=>(<div key={i}>{String(e.type)}: {String(JSON.stringify(e.data)).slice(0,80)}</div>))}</div>
                              <div className="bg-slate-50 p-2 rounded">B 示例：{(rightEvents || []).slice(0,3).map((e:any,i:number)=>(<div key={i}>{String(e.type)}: {String(JSON.stringify(e.data)).slice(0,80)}</div>))}</div>
                           </div>
                        </div>
                     ) : (
                        <button onClick={() => generateComparisonAnalysis()} className="text-blue-600 hover:underline text-xs">
                            生成分析报告
                        </button>
                     )}
                </div>
                {/* Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -z-0 opacity-50 pointer-events-none"></div>
            </div>

            {/* Three-column diff area */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
               <div className="grid grid-cols-3 gap-2 p-4">
                  {/* Left: Node A events */}
                  <div className="col-span-1 border-r pr-2">
                     <h4 className="text-xs text-slate-500 mb-2">节点 A 独有事件 ({leftEvents.length})</h4>
                     <div className="space-y-2 max-h-64 overflow-auto p-1">
                        {leftEvents.map((ev:any, idx:number) => (
                           <div key={idx} className="p-2 bg-slate-50 rounded text-[12px]">
                              <div className="font-mono text-xs text-slate-600">{String(ev.type)}</div>
                              <div className="text-slate-700">{String(JSON.stringify(ev.data)).slice(0,200)}</div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Middle: Agent diffs & AI summary (already above) */}
                  <div className="col-span-1 px-4">
                     <h4 className="text-xs text-slate-500 mb-2">差异摘要与代理属性差异</h4>
                     <div className="space-y-2 max-h-64 overflow-auto text-sm p-1">
                        {Object.keys(agentDiffs).length === 0 && <div className="text-slate-400">未检测到代理属性差异</div>}
                        {Object.entries(agentDiffs).map(([name, diffs]: any) => (
                           <div key={name} className="bg-slate-50 p-2 rounded mb-2">
                              <div className="font-medium text-slate-700">{name}</div>
                              <div className="text-[12px] text-slate-600 mt-1">
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
                     <h4 className="text-xs text-slate-500 mb-2">节点 B 独有事件 ({rightEvents.length})</h4>
                     <div className="space-y-2 max-h-64 overflow-auto p-1">
                        {rightEvents.map((ev:any, idx:number) => (
                           <div key={idx} className="p-2 bg-slate-50 rounded text-[12px]">
                              <div className="font-mono text-xs text-slate-600">{String(ev.type)}</div>
                              <div className="text-slate-700">{String(JSON.stringify(ev.data)).slice(0,200)}</div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

                <div className="px-5 py-2 bg-slate-50 text-[10px] text-slate-400 text-center">
                     * 数据来自后端对比结果；AI 摘要仅基于上方展示的证据
                </div>
            </div>
      </div>
   );
};
