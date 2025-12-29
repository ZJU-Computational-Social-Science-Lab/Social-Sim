
import React, { useEffect } from 'react';
import { useSimulationStore } from '../store';
import { ArrowRight, Sparkles, Loader2, GitCommit, User } from 'lucide-react';
import * as d3 from 'd3';

export const ComparisonView: React.FC = () => {
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore(state => state.compareTargetNodeId);
  const nodes = useSimulationStore(state => state.nodes);
  const agents = useSimulationStore(state => state.agents);
  const comparisonSummary = useSimulationStore(state => state.comparisonSummary);
  const isGenerating = useSimulationStore(state => state.isGenerating);
  const generateComparisonAnalysis = useSimulationStore(state => state.generateComparisonAnalysis);

  const nodeA = nodes.find(n => n.id === selectedNodeId);
  const nodeB = nodes.find(n => n.id === compareTargetNodeId);

  // Auto-generate analysis when nodes are selected
  useEffect(() => {
    if (selectedNodeId && compareTargetNodeId && !comparisonSummary && !isGenerating) {
      // Small debounce to prevent double call on render
      const timer = setTimeout(() => {
        generateComparisonAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeId, compareTargetNodeId, comparisonSummary]);

  if (!nodeA) return <div className="p-8 text-slate-400">请选择基准节点。</div>;
  if (!nodeB) return <div className="p-8 text-slate-400 text-center flex flex-col items-center justify-center h-full">
     <GitCommit size={48} className="mb-4 text-slate-200" />
     <p>请在仿真树中选择第二个节点进行对比。</p>
     <p className="text-xs mt-2">点击树状图中的节点即可设定为对比对象 (B)。</p>
  </div>;

  // Mock calculation of property differences (Since we don't really have snapshot history per node in this frontend demo, we simulate the diff based on current state + randomness for demo purposes)
  const getSimulatedDiff = (agentId: string, property: string) => {
    // In a real app, this would be: agentSnapshotA[prop] - agentSnapshotB[prop]
    // Here we just return a random small integer to demonstrate the UI
    const diff = Math.floor(Math.random() * 20) - 10;
    return diff;
  };

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
              {isGenerating ? (
                <div className="flex items-center gap-2 text-slate-500">
                   <Loader2 size={16} className="animate-spin" />
                   正在分析两条时间线的差异...
                </div>
              ) : comparisonSummary ? (
                <p>{comparisonSummary}</p>
              ) : (
                <button onClick={() => generateComparisonAnalysis()} className="text-blue-600 hover:underline text-xs">
                   生成分析报告
                </button>
              )}
           </div>
           {/* Decor */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -z-0 opacity-50 pointer-events-none"></div>
        </div>

        {/* State Difference Table */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
           <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700">智能体状态差异 (Diff)</h3>
           </div>
           <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                 <tr>
                    <th className="px-5 py-3 font-medium">智能体 / 属性</th>
                    <th className="px-5 py-3 font-medium text-right text-blue-600">基准 (A)</th>
                    <th className="px-5 py-3 font-medium text-right text-amber-600">对比 (B)</th>
                    <th className="px-5 py-3 font-medium text-right">差异 (Δ)</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {agents.map(agent => {
                    const firstPropKey = Object.keys(agent.properties)[0];
                    if (!firstPropKey) return null;
                    const valA = agent.properties[firstPropKey];
                    // Mock value B based on diff
                    const diff = getSimulatedDiff(agent.id, firstPropKey);
                    const valB = typeof valA === 'number' ? valA + diff : valA;

                    return (
                      <tr key={agent.id} className="hover:bg-slate-50">
                         <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                               <User size={14} className="text-slate-400" />
                               <span className="font-medium text-slate-700">{agent.name}</span>
                               <span className="text-xs text-slate-400 px-1.5 bg-slate-100 rounded">{firstPropKey}</span>
                            </div>
                         </td>
                         <td className="px-5 py-3 text-right font-mono text-slate-600">{valA}</td>
                         <td className="px-5 py-3 text-right font-mono text-slate-600">{valB}</td>
                         <td className="px-5 py-3 text-right font-mono">
                            {typeof valA === 'number' ? (
                               <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-300'}>
                                  {diff > 0 ? '+' : ''}{diff}
                               </span>
                            ) : '-'}
                         </td>
                      </tr>
                    );
                 })}
              </tbody>
           </table>
           <div className="px-5 py-2 bg-slate-50 text-[10px] text-slate-400 text-center">
              * 数值仅为基于当前Mock逻辑的演示数据
           </div>
        </div>

      </div>
    </div>
  );
};
