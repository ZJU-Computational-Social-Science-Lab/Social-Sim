
import React, { useMemo, useState, useEffect } from 'react';
import { useSimulationStore } from '../store';
import { X, FileText, Sparkles, Loader2, Calendar, Lightbulb, Users, Target, Download } from 'lucide-react';

export const ReportModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isReportModalOpen);
  const toggle = useSimulationStore(state => state.toggleReportModal);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const isGenerating = useSimulationStore(state => state.isGeneratingReport);
  const generateReport = useSimulationStore(state => state.generateReport);
  const exportReport = useSimulationStore(state => state.exportReport);
  const analysisConfig = useSimulationStore(state => state.analysisConfig);
  const updateAnalysisConfig = useSimulationStore(state => state.updateAnalysisConfig);
  const agents = useSimulationStore(state => state.agents);
  const nodes = useSimulationStore(state => state.nodes);

  const [showSettings, setShowSettings] = useState(false);
  const [showAllKeyEvents, setShowAllKeyEvents] = useState(false);
  const agentNames = useMemo(() => agents.map(a => a.name), [agents]);
  const roundBounds = useMemo(() => {
    if (!nodes || nodes.length === 0) return { min: 0, max: 0 };
    const depths = nodes.map((n) => n.depth || 0);
    return { min: Math.min(...depths), max: Math.max(...depths) };
  }, [nodes]);
  useEffect(() => {
    if (agentNames.length > 0 && analysisConfig.focusAgents.length === 0) {
      updateAnalysisConfig({ focusAgents: agentNames });
    }
  }, [agentNames, analysisConfig.focusAgents.length, updateAnalysisConfig]);
  const startVal = analysisConfig.roundStart ?? roundBounds.min;
  const endVal = analysisConfig.roundEnd ?? roundBounds.max;
  const span = Math.max(1, roundBounds.max - roundBounds.min);
  const startPct = ((startVal - roundBounds.min) / span) * 100;
  const endPct = ((endVal - roundBounds.min) / span) * 100;

  if (!isOpen || !currentSim) return null;
  const report = currentSim.report;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} />
              仿真实验分析报告 (Automated Analysis)
            </h2>
            <p className="text-xs text-indigo-600 mt-1">
               {report ? `生成于: ${new Date(report.generatedAt).toLocaleString()}` : '暂无报告'}
            </p>
            {report?.refinedByLLM && (
              <span className="inline-flex items-center px-2 py-0.5 mt-1 text-[11px] font-semibold rounded-full bg-indigo-100 text-indigo-700">
                AI 生成
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="text-xs px-3 py-1 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
            >
              {showSettings ? '隐藏设置' : '分析设置'}
            </button>
            <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 flex gap-6">
           <style>
             {`
             .dual-range input[type="range"] {
               -webkit-appearance: none;
               background: transparent;
             }
             .dual-range input[type="range"]::-webkit-slider-thumb {
               pointer-events: all;
               -webkit-appearance: none;
               height: 14px;
               width: 14px;
               border-radius: 9999px;
               background: #4f46e5;
               border: 2px solid #fff;
               box-shadow: 0 0 0 1px #c7d2fe;
             }
             .dual-range input[type="range"]::-moz-range-thumb {
               pointer-events: all;
               height: 14px;
               width: 14px;
               border-radius: 9999px;
               background: #4f46e5;
               border: 2px solid #fff;
               box-shadow: 0 0 0 1px #c7d2fe;
             }
             .dual-range input[type="range"]::-moz-range-track {
               background: transparent;
             }
             `}
           </style>
           {showSettings && (
             <div className="w-72 shrink-0 bg-white border rounded-lg shadow-sm p-4 h-fit">
               <div className="flex items-center justify-between mb-3">
                 <h4 className="text-sm font-bold text-slate-700">分析设置</h4>
                 <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setShowSettings(false)}>关闭</button>
               </div>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs text-slate-500">采样上限（条）</label>
                   <input
                     type="number"
                     value={analysisConfig.maxEvents}
                     min={50}
                     onChange={(e) => updateAnalysisConfig({ maxEvents: Number(e.target.value) || 0 })}
                     className="w-full mt-1 rounded border px-2 py-1 text-sm"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-slate-500">每轮采样</label>
                   <input
                     type="number"
                     value={analysisConfig.samplePerRound}
                     min={1}
                     onChange={(e) => updateAnalysisConfig({ samplePerRound: Number(e.target.value) || 0 })}
                     className="w-full mt-1 rounded border px-2 py-1 text-sm"
                   />
                 </div>
                 <div>
                   <div className="flex items-center justify-between">
                     <label className="text-xs text-slate-500">轮次范围</label>
                     <button
                       className="text-xs text-indigo-600 hover:underline"
                       onClick={() => updateAnalysisConfig({ roundStart: null, roundEnd: null })}
                     >
                       清除
                     </button>
                   </div>
                   <div className="mt-2 space-y-2 text-xs text-slate-600">
                     <div className="flex justify-between">
                       <span>起始: {startVal}</span>
                       <span>结束: {endVal}</span>
                     </div>
                     <div className="relative h-10 dual-range">
                       <div className="absolute inset-y-4 left-0 right-0 rounded-full bg-slate-200 pointer-events-none" />
                       <div
                         className="absolute inset-y-4 rounded-full bg-indigo-200 pointer-events-none"
                         style={{
                           left: `${startPct}%`,
                           right: `${100 - endPct}%`
                         }}
                       />
                       <input
                         type="range"
                         min={roundBounds.min}
                         max={roundBounds.max}
                         step={1}
                         value={startVal}
                         disabled={roundBounds.max === roundBounds.min}
                         onChange={(e) => {
                           const v = Number(e.target.value);
                           updateAnalysisConfig({ roundStart: Math.min(v, endVal) });
                         }}
                         className="absolute inset-0 w-full cursor-pointer z-30 bg-transparent"
                       />
                       <input
                         type="range"
                         min={roundBounds.min}
                         max={roundBounds.max}
                         step={1}
                         value={endVal}
                         disabled={roundBounds.max === roundBounds.min}
                         onChange={(e) => {
                           const v = Number(e.target.value);
                           updateAnalysisConfig({ roundEnd: Math.max(v, startVal) });
                         }}
                         className="absolute inset-0 w-full cursor-pointer z-40 bg-transparent"
                       />
                     </div>
                     {roundBounds.max === roundBounds.min && (
                       <p className="text-[11px] text-slate-400">当前只有一个节点/轮次，无法调整范围。</p>
                     )}
                   </div>
                </div>
                <div>
                   <label className="text-xs text-slate-500">焦点智能体（可多选）</label>
                   <div className="mt-1 max-h-32 overflow-auto border rounded p-2 space-y-2">
                     {agentNames.length === 0 && <p className="text-xs text-slate-400">暂无智能体</p>}
                     {agentNames.map((name) => {
                       const checked = analysisConfig.focusAgents.includes(name);
                       return (
                         <label key={name} className="flex items-center gap-2 text-sm text-slate-700">
                           <input
                             type="checkbox"
                             checked={checked}
                             onChange={() => {
                               const next = checked
                                 ? analysisConfig.focusAgents.filter((n) => n !== name)
                                 : [...analysisConfig.focusAgents, name];
                               updateAnalysisConfig({ focusAgents: next });
                             }}
                           />
                           {name}
                         </label>
                       );
                     })}
                   </div>
                 </div>
                 <label className="flex items-center gap-2 text-sm text-slate-700">
                   <input
                     type="checkbox"
                     checked={analysisConfig.enableLLM}
                     onChange={(e) => updateAnalysisConfig({ enableLLM: e.target.checked })}
                   />
                   启用 LLM 精炼（需配置 provider）
                 </label>
                 <p className="text-xs text-slate-400">设置将用于下一次“立即生成报告”。</p>
               </div>
             </div>
           )}
           {!report ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                 <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Sparkles size={40} className="text-indigo-300" />
                 </div>
                 <div className="text-center max-w-sm">
                    <h3 className="text-lg font-bold text-slate-700 mb-2">生成智能分析报告</h3>
                    <p className="text-sm">系统将读取当前实验的日志记录与智能体历史状态，使用大模型生成包含摘要、关键转折、行为分析与改进建议的完整报告。</p>
                 </div>
                 <button 
                   onClick={generateReport}
                   disabled={isGenerating}
                   className="px-8 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all font-bold flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                 >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {isGenerating ? '正在分析数据...' : '立即生成报告'}
                 </button>
              </div>
           ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                 {/* Summary Section */}
                 <section className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-2 text-indigo-700 mb-4 pb-2 border-b">
                       <Target size={20} />
                       <h3 className="font-bold text-lg">实验摘要 (Executive Summary)</h3>
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                       {report.summary}
                    </p>
                    {report.roundStats && report.roundStats.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <div className="text-xs text-slate-500">动作 / 错误 / 广播随轮次</div>
                        <div className="space-y-2">
                          {report.roundStats.map((rs, i) => {
                            const maxVal = Math.max(rs.actions, rs.errors, rs.broadcasts, 1);
                            const bar = (val: number, color: string) => (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-10 text-right text-slate-500">{val}</span>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full ${color}`} style={{ width: `${(val / maxVal) * 100}%` }} />
                                </div>
                              </div>
                            );
                            return (
                              <div key={i} className="border rounded p-2 bg-slate-50">
                                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                                  <span>R{rs.round}</span>
                                  <span>max {maxVal}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                    <span className="w-12 text-emerald-600 font-bold">动作</span>
                                    {bar(rs.actions, 'bg-emerald-400')}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                    <span className="w-12 text-rose-600 font-bold">错误</span>
                                    {bar(rs.errors, 'bg-rose-400')}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                    <span className="w-12 text-indigo-600 font-bold">广播</span>
                                    {bar(rs.broadcasts, 'bg-indigo-400')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                 </section>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Key Events */}
                    <section className="bg-white rounded-xl shadow-sm border p-6">
                      <div className="flex items-center gap-2 text-amber-600 mb-4 pb-2 border-b">
                         <Calendar size={20} />
                         <h3 className="font-bold text-lg">关键转折点 (Key Events)</h3>
                      </div>
                      <ul className="space-y-4">
                         {(showAllKeyEvents ? report.keyEvents : report.keyEvents.slice(0, 5)).map((event, i) => (
                            <li key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-12 text-xs font-bold bg-amber-50 text-amber-700 h-6 flex items-center justify-center rounded">
                                   R{event.round}
                                </span>
                                <p className="text-sm text-slate-700">{event.description}</p>
                             </li>
                          ))}
                       </ul>
                       {report.keyEvents.length > 5 && (
                         <button
                           onClick={() => setShowAllKeyEvents((v) => !v)}
                           className="mt-3 text-xs text-amber-700 hover:text-amber-900 underline"
                         >
                           {showAllKeyEvents ? '收起' : `展开更多 (${report.keyEvents.length - 5} 条)`}
                         </button>
                       )}
                    </section>

                    {/* Suggestions */}
                    <section className="bg-white rounded-xl shadow-sm border p-6">
                       <div className="flex items-center gap-2 text-emerald-600 mb-4 pb-2 border-b">
                          <Lightbulb size={20} />
                          <h3 className="font-bold text-lg">后续建议 (Suggestions)</h3>
                       </div>
                       <ul className="space-y-2">
                          {report.suggestions.map((s, i) => (
                             <li key={i} className="text-sm text-slate-700 flex gap-2 items-start">
                                <span className="text-emerald-500 mt-1">•</span>
                                {s}
                             </li>
                          ))}
                       </ul>
                    </section>
                 </div>

                 {/* Agent Analysis */}
                 <section className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-2 text-blue-600 mb-4 pb-2 border-b">
                       <Users size={20} />
                       <h3 className="font-bold text-lg">智能体行为分析 (Agent Analysis)</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                       {report.agentAnalysis.map((item, i) => (
                          <div key={i} className="bg-slate-50 rounded-lg p-4 border">
                             <h4 className="font-bold text-slate-800 mb-2">{item.agentName}</h4>
                             <p className="text-sm text-slate-600">{item.analysis}</p>
                          </div>
                       ))}
                    </div>
                 </section>
              </div>
           )}
        </div>
        
        {report && (
          <div className="px-6 py-4 border-t bg-white flex justify-end gap-3 shrink-0">
             <button
                onClick={() => exportReport('json')}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
             >
                <Download size={16} /> 导出 JSON
             </button>
             <button
                onClick={() => exportReport('md')}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
             >
                <Download size={16} /> 导出 Markdown
             </button>
             <button 
                onClick={generateReport}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
             >
                <Sparkles size={16} /> 重新生成
             </button>
             <button onClick={() => toggle(false)} className="px-6 py-2 text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg shadow-sm">
                关闭
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
