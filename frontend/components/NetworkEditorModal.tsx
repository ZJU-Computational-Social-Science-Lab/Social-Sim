
import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store';
import { X, Network, Save, RefreshCw, Hexagon, Circle, Share2, Shuffle, ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';
import * as d3 from 'd3';
import { SocialNetwork } from '../types';

export const NetworkEditorModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isNetworkEditorOpen);
  const toggle = useSimulationStore(state => state.toggleNetworkEditor);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const agents = useSimulationStore(state => state.agents);
  const updateSocialNetwork = useSimulationStore(state => state.updateSocialNetwork);

  const [network, setNetwork] = useState<SocialNetwork>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Refs for Zoom Control
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const d3SvgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  // Initialize network from store on open
  useEffect(() => {
    if (isOpen && currentSim) {
      setNetwork(currentSim.socialNetwork || {});
    }
  }, [isOpen, currentSim]);

  // Apply Presets
  const applyPreset = (type: 'full' | 'ring' | 'star' | 'random') => {
    const newNetwork: SocialNetwork = {};
    const agentIds = agents.map(a => a.id);

    // Initialize all as empty
    agentIds.forEach(id => newNetwork[id] = []);

    if (type === 'full') {
       agentIds.forEach(id => {
         newNetwork[id] = agentIds.filter(target => target !== id);
       });
    } else if (type === 'ring') {
       agentIds.forEach((id, idx) => {
         const prev = agentIds[(idx - 1 + agentIds.length) % agentIds.length];
         const next = agentIds[(idx + 1) % agentIds.length];
         newNetwork[id] = [prev, next];
       });
    } else if (type === 'star') {
       if (agentIds.length > 0) {
         const center = agentIds[0];
         agentIds.forEach(id => {
            if (id !== center) {
               newNetwork[center].push(id);
               newNetwork[id].push(center);
            }
         });
       }
    } else if (type === 'random') {
       agentIds.forEach(id => {
          agentIds.forEach(target => {
             if (id !== target && Math.random() > 0.7) {
                newNetwork[id].push(target);
             }
          });
       });
    }
    setNetwork(newNetwork);
  };

  const toggleConnection = (source: string, target: string) => {
     if (source === target) return;
     const currentLinks = network[source] || [];
     let newLinks: string[] = [];
     
     if (currentLinks.includes(target)) {
        newLinks = currentLinks.filter(l => l !== target);
     } else {
        newLinks = [...currentLinks, target];
     }
     
     setNetwork(prev => ({
        ...prev,
        [source]: newLinks
     }));
  };

  // D3 Visualization
  useEffect(() => {
    if (!isOpen || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
       .attr('width', width)
       .attr('height', height)
       .attr('class', 'cursor-grab active:cursor-grabbing'); // Visual cue for panning

    d3SvgRef.current = svg;

    // 1. Setup Zoom
    const g = svg.append('g'); // Container for content

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    zoomBehaviorRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    // 2. Prepare Data
    const nodes = agents.map(a => ({ id: a.id, name: a.name, img: a.avatarUrl }));
    const links: {source: string, target: string}[] = [];
    
    Object.keys(network).forEach(source => {
       (network[source] || []).forEach(target => {
          // Only add link if target exists
          if (agents.find(a => a.id === target)) {
             links.push({ source, target });
          }
       });
    });

    // 3. Force Simulation
    const simulation = d3.forceSimulation(nodes as any)
       .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
       .force('charge', d3.forceManyBody().strength(-400)) // Repel force
       .force('center', d3.forceCenter(width / 2, height / 2))
       .force('collide', d3.forceCollide(40)); // Prevent overlap

    // 4. Definitions (Arrowhead)
    svg.append('defs').append('marker')
       .attr('id', 'arrowhead')
       .attr('viewBox', '0 -5 10 10')
       .attr('refX', 28) // Adjusted for node radius
       .attr('refY', 0)
       .attr('orient', 'auto')
       .attr('markerWidth', 6)
       .attr('markerHeight', 6)
       .append('path')
       .attr('d', 'M0,-5L10,0L0,5')
       .attr('fill', '#94a3b8');

    // 5. Draw Links (inside g)
    const link = g.append('g')
       .selectAll('line')
       .data(links)
       .enter().append('line')
       .attr('stroke', '#94a3b8')
       .attr('stroke-width', 1.5)
       .attr('marker-end', 'url(#arrowhead)');

    // 6. Draw Nodes (inside g)
    const node = g.append('g')
       .selectAll('.node')
       .data(nodes)
       .enter().append('g')
       .attr('class', 'cursor-pointer')
       .call(d3.drag<any, any>()
          .on('start', (event, d) => {
             if (!event.active) simulation.alphaTarget(0.3).restart();
             d.fx = d.x;
             d.fy = d.y;
          })
          .on('drag', (event, d) => {
             d.fx = event.x;
             d.fy = event.y;
          })
          .on('end', (event, d) => {
             if (!event.active) simulation.alphaTarget(0);
             d.fx = null;
             d.fy = null;
          }));

    node.append('circle')
       .attr('r', 20)
       .attr('fill', '#fff')
       .attr('stroke', '#0ea5e9')
       .attr('stroke-width', 2);

    node.append('image')
       .attr('xlink:href', d => d.img)
       .attr('x', -16)
       .attr('y', -16)
       .attr('width', 32)
       .attr('height', 32)
       .attr('clip-path', 'circle(16px at 16px 16px)');

    node.append('text')
       .attr('dy', 35)
       .attr('text-anchor', 'middle')
       .text(d => d.name)
       .attr('class', 'text-[10px] font-medium fill-slate-700 pointer-events-none select-none shadow-sm');

    // 7. Interaction Logic
    let selectedSource: string | null = null;

    node.on('click', (event, d) => {
       // Stop propagation so zoom doesn't trigger on click if there's overlap logic
       // event.stopPropagation(); 
       
       if (!selectedSource) {
          selectedSource = d.id;
          d3.selectAll('circle').attr('stroke', '#0ea5e9').attr('stroke-width', 2);
          d3.select(event.currentTarget).select('circle').attr('stroke', '#f59e0b').attr('stroke-width', 4); // Highlight source
       } else {
          toggleConnection(selectedSource, d.id);
          selectedSource = null;
          d3.selectAll('circle').attr('stroke', '#0ea5e9').attr('stroke-width', 2);
       }
    });

    simulation.on('tick', () => {
       link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

       node
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
    
    // Initial center logic is handled by forceCenter, but we can also set initial zoom transform if needed.
    // Default translate(0,0) scale(1) is usually fine as forceCenter centers content.

    return () => { simulation.stop(); };

  }, [isOpen, network, agents]);

  // Zoom Handlers
  const handleZoomIn = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(500).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleSave = () => {
    updateSocialNetwork(network);
    toggle(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[700px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Network className="text-brand-600" size={20} />
              社交网络拓扑 (Social Network Topology)
            </h2>
            <p className="text-xs text-slate-500 mt-1">定义智能体之间的信息传播路径与可见性边界。</p>
          </div>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Sidebar Tools */}
           <div className="w-56 bg-slate-50 border-r p-4 space-y-4 flex flex-col">
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">快速预设 (Presets)</label>
                 <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => applyPreset('full')} className="p-2 bg-white border rounded text-xs hover:bg-slate-100 flex flex-col items-center gap-1">
                       <Share2 size={16} /> 全连接
                    </button>
                    <button onClick={() => applyPreset('ring')} className="p-2 bg-white border rounded text-xs hover:bg-slate-100 flex flex-col items-center gap-1">
                       <RefreshCw size={16} /> 环形
                    </button>
                    <button onClick={() => applyPreset('star')} className="p-2 bg-white border rounded text-xs hover:bg-slate-100 flex flex-col items-center gap-1">
                       <Hexagon size={16} /> 星型
                    </button>
                    <button onClick={() => applyPreset('random')} className="p-2 bg-white border rounded text-xs hover:bg-slate-100 flex flex-col items-center gap-1">
                       <Shuffle size={16} /> 随机
                    </button>
                    <button onClick={() => setNetwork({})} className="p-2 bg-white border rounded text-xs hover:bg-slate-100 col-span-2 flex items-center justify-center gap-2 text-slate-400">
                       <Circle size={12} /> 清空连接
                    </button>
                 </div>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed pt-4 border-t flex-1">
                 <strong>操作指南:</strong>
                 <ul className="list-decimal pl-4 space-y-1 mt-1">
                    <li>点击节点选中（橙色）。</li>
                    <li>点击另一节点建立连接。</li>
                    <li>拖拽节点调整布局。</li>
                    <li>拖动背景平移地图。</li>
                 </ul>
                 <div className="mt-2 flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 p-2 rounded">
                    <Move size={12} />
                    <span>支持滚轮缩放与拖拽平移</span>
                 </div>
              </div>
           </div>
           
           {/* Canvas */}
           <div ref={containerRef} className="flex-1 bg-slate-50 relative overflow-hidden group">
               <svg ref={svgRef} className="block w-full h-full"></svg>
               
               {/* Zoom Controls */}
               <div className="absolute top-4 right-4 flex flex-col gap-1 bg-white border rounded shadow-sm p-1">
                  <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="放大">
                     <ZoomIn size={16} />
                  </button>
                  <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="缩小">
                     <ZoomOut size={16} />
                  </button>
                  <div className="h-px bg-slate-200 my-0.5"></div>
                  <button onClick={handleResetZoom} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="重置视角">
                     <Maximize size={16} />
                  </button>
               </div>
           </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm flex items-center gap-2"
          >
            <Save size={16} />
            保存拓扑设置
          </button>
        </div>
      </div>
    </div>
  );
};
