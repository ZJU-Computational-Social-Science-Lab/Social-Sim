
import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store';
import { X, Beaker, Plus, Trash2, Zap, UserCog, Settings, ArrowRight } from 'lucide-react';
import { ExperimentVariant, Intervention } from '../types';
import { connectNodeEvents } from '../services/simulationTree';
import { MultimodalInput } from './MultimodalInput';

const extractMarkdownImages = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));
  return matches.map((m) => m[1]).filter(Boolean);
};

export const ExperimentDesignModal: React.FC = () => {
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

  const [experimentName, setExperimentName] = useState('');
  const [variants, setVariants] = useState<ExperimentVariant[]>([
    { id: 'v1', name: '实验组 A', description: '', interventions: [] }
  ]);

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
    const endpoint = (window as any).__engine_endpoint__ || '';
    const token = (window as any).__engine_token__ || '';

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

  if (!isOpen || !baseNode) return null;

  const handleAddVariant = () => {
    setVariants([...variants, {
      id: `v${Date.now()}`,
      name: `实验组 ${String.fromCharCode(65 + variants.length)}`,
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
    addNotification('success', '图片已上传并插入');
  };

  const handleSubmit = () => {
    if (!experimentName) {
      alert("请输入实验名称");
      return;
    }
    // Build ops for each variant based on interventions
    const variantsWithOps = variants.map((v) => {
      const ops: any[] = [];
      (v.interventions || []).forEach((iv) => {
        if (iv.type === 'AGENT_PROPERTY' && iv.targetId) {
          // parse description as JSON updates or key=value pairs
          let updates: any = {};
          try {
            const parsed = JSON.parse(iv.description || '{}');
            if (parsed && typeof parsed === 'object' && parsed.updates) {
              updates = parsed.updates;
            } else if (parsed && typeof parsed === 'object') {
              updates = parsed;
            }
          } catch {
            // fallback parse key=value,comma separated
            String(iv.description || '')
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

          const target = agents.find((a) => a.id === iv.targetId);
          const name = target ? target.name : iv.targetId;
          ops.push({ op: 'agent_props_patch', name, updates });
        } else if (iv.type === 'INSTRUCTION') {
          // broadcast instruction as public event
          ops.push({ op: 'public_broadcast', text: iv.description || '' });
        } else if (iv.type === 'ENVIRONMENT') {
          ops.push({ op: 'public_broadcast', text: iv.description || '' });
        }
      });
      return { ...v, ops };
    });

    runExperiment(baseNode.id, experimentName, variantsWithOps);
    toggle(false);
    // Reset state
    setExperimentName('');
    setVariants([{ id: 'v1', name: '实验组 A', description: '', interventions: [] }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <Beaker className="text-indigo-600" size={24} />
              因果干预实验设计 (Experimental Design)
            </h2>
            <p className="text-xs text-indigo-600 mt-1">
              基于节点 <span className="font-mono bg-white px-1 rounded border border-indigo-200">{baseNode.display_id}</span> ({baseNode.name}) 创建平行对照组
            </p>
          </div>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar: Global Settings & Control Group */}
          <div className="w-full md:w-80 bg-slate-50 border-r p-6 overflow-y-auto shrink-0 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">实验名称</label>
              <input 
                type="text" 
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                placeholder="例如：高压力环境测试"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>

            <div className="bg-white border rounded-lg p-4 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
               <h3 className="text-sm font-bold text-slate-800 mb-1">对照组 (Control Group)</h3>
               <p className="text-xs text-slate-500 mb-3">基准对照，不施加额外干预。</p>
               <div className="text-xs bg-slate-100 p-2 rounded text-slate-600">
                  继承当前节点状态与历史记录。
               </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              <p>💡 提示：</p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>点击右侧添加实验组。</li>
                <li>为每个组定义不同的干预变量。</li>
                <li>系统将自动并行运行所有分支。</li>
              </ul>
            </div>
          </div>

          {/* Main Area: Variants */}
          <div className="flex-1 bg-slate-100/50 p-6 overflow-y-auto">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {variants.map((variant, index) => (
                  <div key={variant.id} className="bg-white border rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 border-b bg-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={variant.name}
                          onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                          className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1"
                        />
                        {/* Status badge: try to find corresponding node in tree by name */}
                        {(() => {
                          // Prefer meta-based mapping when available (experiment/variant ids),
                          // otherwise fall back to name-based matching for compatibility.
                          const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === baseNode.id && n.name.includes(variant.name));
                          const nodeByName = nodes.find(n => n.name === `${experimentName}: ${variant.name}`);
                          const node = nodeByMeta || nodeByName;
                          const st = node ? node.status : 'pending';
                          const color = st === 'running' ? 'text-amber-600' : st === 'completed' || st === 'completed' ? 'text-green-600' : 'text-slate-400';
                          return (
                            <span className={`text-xs font-medium ${color} bg-slate-100 px-2 py-0.5 rounded`}>{st}</span>
                          );
                        })()}

                        {(() => {
                          // Show a compact live log preview if we have a mapped node id
                          const nodeByMeta = nodes.find(n => (n as any).meta && (n as any).meta.variant_id && n.parentId === baseNode.id && n.name.includes(variant.name));
                          const nodeByName = nodes.find(n => n.name === `${experimentName}: ${variant.name}`);
                          const node = nodeByMeta || nodeByName;
                          const nid = node ? node.id : null;
                          if (!nid) return null;
                          const logs = nodeLogs[String(nid)] || [];
                          return (
                            <div className="mt-2 text-xs text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                                <span>实时日志预览（最近 {Math.min(5, logs.length)} 条）</span>
                              </div>
                              <div className="mt-2 bg-slate-50 border rounded p-2 text-[11px] h-20 overflow-auto">
                                {logs.slice(-5).map((l: any, i: number) => (
                                  <div key={i} className="py-0.5 border-b border-slate-100">
                                    <div className="font-mono text-[11px] text-slate-600">{String(l.type || l.event_type || 'evt')}</div>
                                    <div className="text-slate-700">{String((l.data && (l.data.action || l.data.message || JSON.stringify(l.data))) || l.data || '')}</div>
                                  </div>
                                ))}
                                {logs.length === 0 && <div className="text-slate-400">暂无日志</div>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <button onClick={() => handleRemoveVariant(variant.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="p-4 space-y-3 min-h-[200px]">
                       {variant.interventions.length === 0 ? (
                         <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-lg">
                           暂无干预措施
                         </div>
                       ) : (
                         variant.interventions.map((iv, i) => (
                           <div key={iv.id} className="bg-slate-50 rounded-lg border p-3 text-sm relative">
                              <div className="flex gap-2 mb-2">
                                <select 
                                  value={iv.type}
                                  onChange={(e) => updateIntervention(variant.id, iv.id, 'type', e.target.value)}
                                  className="text-[10px] font-bold uppercase bg-white border rounded px-1 py-0.5 text-slate-600 outline-none"
                                >
                                  <option value="INSTRUCTION">全局指令</option>
                                  <option value="AGENT_PROPERTY">修改属性</option>
                                  <option value="ENVIRONMENT">环境事件</option>
                                </select>
                                
                                {iv.type === 'AGENT_PROPERTY' && (
                                  <select
                                    value={iv.targetId || ''}
                                    onChange={(e) => updateIntervention(variant.id, iv.id, 'targetId', e.target.value)}
                                    className="text-[10px] bg-white border rounded px-1 py-0.5 text-slate-600 outline-none max-w-[100px]"
                                  >
                                    <option value="">选择智能体...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                                )}
                              </div>
                              
                              <MultimodalInput
                                label="图片 (可选)"
                                helperText="拖拽/点击上传后将图片以 markdown 链接插入"
                                onInsert={(url) => handleEmbedInterventionImage(variant.id, iv.id, url)}
                              />
                              <textarea 
                                value={iv.description}
                                onChange={(e) => updateIntervention(variant.id, iv.id, 'description', e.target.value)}
                                placeholder={iv.type === 'AGENT_PROPERTY' ? '例如：将信任值降低至 10' : '描述具体的干预内容...'}
                                className="w-full text-xs bg-white border rounded p-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-16"
                              />
                              {extractMarkdownImages(iv.description || '').length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {extractMarkdownImages(iv.description || '').map((url) => (
                                    <div key={url} className="w-16 h-16 border rounded overflow-hidden bg-slate-50">
                                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button 
                                onClick={() => removeIntervention(variant.id, iv.id)}
                                className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"
                              >
                                <X size={14} />
                              </button>
                           </div>
                         ))
                       )}
                       
                       <button 
                         onClick={() => addIntervention(variant.id)}
                         className="w-full py-2 border-2 border-dashed border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                       >
                         <Plus size={14} /> 添加干预项
                       </button>
                    </div>
                  </div>
                ))}

                {/* Add Variant Button */}
                <button 
                  onClick={handleAddVariant}
                  className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl min-h-[200px] flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-current flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <span className="font-bold text-sm">添加新的实验组</span>
                </button>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex justify-end gap-3 shrink-0">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2"
          >
            <Zap size={16} />
            启动批量运行 ({variants.length} 个分支)
          </button>
        </div>
      </div>
    </div>
  );
};
