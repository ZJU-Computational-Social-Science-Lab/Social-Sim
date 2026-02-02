
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SimNode } from '../types';
import { useSimulationStore } from '../store';
import { HelpCircle, Move, ZoomIn, ZoomOut, Maximize, MousePointer2, Trash2 } from 'lucide-react';
import { EnvironmentSuggestionDialogWrapper, EnvironmentToggleButton } from './EnvironmentSuggestion';

export const SimTree: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useSimulationStore(state => state.nodes);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore(state => state.compareTargetNodeId);
  const selectNode = useSimulationStore(state => state.selectNode);
  const setCompareTarget = useSimulationStore(state => state.setCompareTarget);
  const toggleHelpModal = useSimulationStore(state => state.toggleHelpModal);
  const isCompareMode = useSimulationStore(state => state.isCompareMode);
  const deleteNode = useSimulationStore(state => state.deleteNode);

  // Keep track of zoom behavior to call it programmatically
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();

    // Setup Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    zoomRef.current = zoom;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'cursor-grab active:cursor-grabbing')
      .call(zoom)
      .on("dblclick.zoom", null);
    
    svgRef.current = svg;

    const g = svg.append('g');

// Hierarchy
// Filter out nodes with parentIds that don't exist (orphaned/pending experiment nodes)
const nodeIds = new Set(nodes.map(n => n.id));
const validNodes = nodes.filter(n => {
  // Root node (no parent) is always valid
  if (!n.parentId) return true;
  // Node with existing parent is valid
  if (nodeIds.has(n.parentId)) return true;
  // Skip orphaned nodes (likely pending experiment placeholders)
  console.warn(`Filtering orphaned node: ${n.id} (parent ${n.parentId} not found)`);
  return false;
});

// Handle edge case where no valid nodes exist
if (validNodes.length === 0) {
  return;
}

const root = d3.stratify<SimNode>()
  .id(d => d.id)
  .parentId(d => d.parentId)
  (validNodes);

    // Use nodeSize for dynamic sizing instead of fixed box
    // [vertical_spacing, horizontal_spacing]
    const treeLayout = d3.tree<SimNode>()
      .nodeSize([60, 120]);

    treeLayout(root);

    // Links
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('d', d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x)
      );

    // Nodes
    const nodeGroup = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (isCompareMode) {
          // If we are already in comparison mode, clicking sets the TARGET, unless we click the primary selected
          if (d.data.id !== selectedNodeId) {
             setCompareTarget(d.data.id);
          }
        } else {
          selectNode(d.data.id);
        }
      });

    // Node Circle
    nodeGroup.append('circle')
      .attr('r', 16)
      .attr('fill', d => {
        if (d.data.status === 'failed') return '#fee2e2'; // Failed Red
        if (d.data.id === selectedNodeId) return '#0ea5e9'; // Selected (Primary)
        if (d.data.id === compareTargetNodeId && isCompareMode) return '#f59e0b'; // Compare Target
        if (d.data.isLeaf) return '#e0f2fe'; // Leaf
        return '#fff';
      })
      .attr('stroke', d => {
        if (d.data.status === 'failed') return '#ef4444'; // Failed Red
        if (d.data.id === selectedNodeId) return '#0369a1';
        if (d.data.id === compareTargetNodeId && isCompareMode) return '#b45309';
        if (d.data.isLeaf) return '#0ea5e9'; // Frontier color
        return '#94a3b8';
      })
      .attr('stroke-width', d => {
         if (d.data.id === selectedNodeId) return 3;
         if (d.data.id === compareTargetNodeId && isCompareMode) return 3;
         return d.data.isLeaf ? 2 : 2;
      })
      .attr('stroke-dasharray', d => {
         // Dashed line for comparison target if comparison mode is active
         if (d.data.id === compareTargetNodeId && isCompareMode) return '3 2'; 
         return 'none';
      })
      .style('cursor', isCompareMode ? 'crosshair' : 'pointer');

    // Labels
    nodeGroup.append('text')
      .attr('dy', 4)
      .attr('x', d => d.children ? -24 : 24)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.display_id || d.data.id)
      .attr('class', d => `text-xs font-medium pointer-events-none select-none drop-shadow-sm bg-white ${d.data.status === 'failed' ? 'fill-red-600' : 'fill-slate-600'}`);

    // Initial positioning
    const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(1);
    svg.call(zoom.transform, initialTransform);

  }, [nodes, selectedNodeId, compareTargetNodeId, selectNode, setCompareTarget, isCompareMode]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 0.8);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current && containerRef.current) {
      const height = containerRef.current.clientHeight;
      const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(1);
      svgRef.current.transition().duration(500).call(zoomRef.current.transform, initialTransform);
    }
  };

  return (
    <>
      <EnvironmentSuggestionDialogWrapper />
      <div className={`flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden relative transition-colors ${isCompareMode ? 'ring-2 ring-amber-400 border-amber-300' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 z-10 relative">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            {isCompareMode ? <MousePointer2 size={16} className="text-amber-500" /> : <Move size={16} className="text-slate-400" />}
            {isCompareMode ? "请选择对比节点..." : "仿真树 (SimTree)"}
        </h3>
        <div className="flex items-center gap-2">
          <EnvironmentToggleButton />
          <button
            onClick={() => toggleHelpModal(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <HelpCircle size={14} />
            <span>图例说明</span>
          </button>
        </div>
      </div>
      
      {/* Zoom Controls */}
      <div className="absolute top-14 right-4 z-10 flex flex-col gap-1 bg-white border rounded shadow-sm p-1">
        <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="放大">
          <ZoomIn size={16} />
        </button>
        <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="缩小">
          <ZoomOut size={16} />
        </button>
        <div className="h-px bg-slate-200 my-0.5"></div>
        <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="重置视角">
          <Maximize size={16} />
        </button>
        <div className="h-px bg-slate-200 my-0.5"></div>
        <button 
          onClick={() => {
            if (selectedNodeId && window.confirm('确定要删除选中的节点及其所有子节点吗？')) {
              deleteNode();
            }
          }}
          disabled={!selectedNodeId}
          className="p-1.5 hover:bg-red-50 rounded text-slate-600 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" 
          title="删除选中节点"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden relative bg-slate-50/30" />
      
      {/* Legend */}
      <div className="px-4 py-2 border-t bg-slate-50 text-xs flex gap-4 text-slate-500 z-10 relative">
        {isCompareMode ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>基准 (A)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 border-dashed border-2 border-white"></div>
              <span>对比 (B)</span>
            </div>
            <div className="ml-auto text-amber-600 font-medium">
               点击节点设为对比对象
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-brand-500 bg-brand-100"></div>
              <span>前沿</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-500"></div>
              <span>选中</span>
            </div>
             <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-500"></div>
              <span>异常</span>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
};
