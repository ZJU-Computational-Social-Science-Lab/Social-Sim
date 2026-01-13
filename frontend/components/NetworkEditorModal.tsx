import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store';
import { X, Network, Save, RefreshCw, Hexagon, Circle, Share2, Shuffle, ZoomIn, ZoomOut, Maximize, Move, Users, Waypoints, Target, GitBranch, MapPin, ChevronDown, ChevronRight, Play, Settings2 } from 'lucide-react';
import * as d3 from 'd3';
import { SocialNetwork } from '../types';

// Type definitions for preset parameters
type PresetType = 'full' | 'core-periphery' | 'holme-kim' | 'waxman' | 'random' | 'sbm' | 'newman-watts' | null;

interface PresetParams {
  'core-periphery': {
    influencerPercent: number;
    influencerConnectivity: number;
    influencerReach: number;
    regularConnectivity: number;
  };
  'holme-kim': {
    newConnections: number;
    clusteringChance: number;
  };
  waxman: {
    maxDistance: number;
    distanceEffect: number;
  };
  random: {
    connectionChance: number;
  };
  sbm: {
    groupSize: number;
    withinGroupConnectivity: number;
    bridgeConnections: number;
  };
  'newman-watts': {
    neighborsEachSide: number;
    shortcutChance: number;
  };
}

// Default parameters for each preset
const defaultParams: PresetParams = {
  'core-periphery': {
    influencerPercent: 0.2,
    influencerConnectivity: 1.0,
    influencerReach: 0.3,
    regularConnectivity: 0.02,
  },
  'holme-kim': {
    newConnections: 3,
    clusteringChance: 0.5,
  },
  waxman: {
    maxDistance: 0.4,
    distanceEffect: 0.3,
  },
  random: {
    connectionChance: 0.3,
  },
  sbm: {
    groupSize: 5,
    withinGroupConnectivity: 1.0,
    bridgeConnections: 1,
  },
  'newman-watts': {
    neighborsEachSide: 2,
    shortcutChance: 0.1,
  },
};

// Preset metadata (icons, names, descriptions)
const presetMeta: Record<string, { icon: React.ElementType; name: string; nameCn: string; description: string }> = {
  full: {
    icon: Share2,
    name: 'Fully Connected',
    nameCn: '全连接',
    description: 'Everyone connected to everyone',
  },
  random: {
    icon: Shuffle,
    name: 'Random',
    nameCn: '随机',
    description: 'Connections chosen randomly',
  },
  'newman-watts': {
    icon: Waypoints,
    name: 'Small World',
    nameCn: '小世界',
    description: 'Neighbors plus random shortcuts',
  },
  sbm: {
    icon: Users,
    name: 'Stochastic Block',
    nameCn: '随机块',
    description: 'Tight groups, few bridges',
  },
  waxman: {
    icon: MapPin,
    name: 'Waxman',
    nameCn: '地理网络',
    description: 'Closer agents connect more',
  },
  'core-periphery': {
    icon: Target,
    name: 'Core-Periphery',
    nameCn: '核心-边缘',
    description: 'Few highly connected influencers',
  },
  'holme-kim': {
    icon: GitBranch,
    name: 'Holme-Kim',
    nameCn: '三角聚类',
    description: 'Popular agents get more connections',
  },
};

// Slider component for parameters
const ParamSlider: React.FC<{
  label: string;
  labelCn: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  isInteger?: boolean;
}> = ({ label, labelCn, value, min, max, step, onChange, isInteger }) => {
  const displayValue = isInteger ? Math.round(value) : value.toFixed(2);
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-700">{labelCn}</span>
          <span className="text-[10px] text-slate-400">{label}</span>
        </div>
        <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
      />
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export const NetworkEditorModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isNetworkEditorOpen);
  const toggle = useSimulationStore(state => state.toggleNetworkEditor);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const agents = useSimulationStore(state => state.agents);
  const updateSocialNetwork = useSimulationStore(state => state.updateSocialNetwork);

  const [network, setNetwork] = useState<SocialNetwork>({});
  const [selectedPreset, setSelectedPreset] = useState<PresetType>(null);
  const [params, setParams] = useState<PresetParams>(defaultParams);
  
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

  // Update a specific parameter
  const updateParam = <T extends keyof PresetParams>(
    preset: T,
    key: keyof PresetParams[T],
    value: number
  ) => {
    setParams(prev => ({
      ...prev,
      [preset]: {
        ...prev[preset],
        [key]: value,
      },
    }));
  };

  // Reset parameters to defaults
  const resetParams = (preset: keyof PresetParams) => {
    setParams(prev => ({
      ...prev,
      [preset]: defaultParams[preset],
    }));
  };

  // Apply Presets with current parameters
  const applyPreset = (type: NonNullable<PresetType>) => {
    const newNetwork: SocialNetwork = {};
    const agentIds = agents.map(a => a.id);
    const n = agentIds.length;

    // Initialize all as empty
    agentIds.forEach(id => newNetwork[id] = []);

    if (type === 'full') {
      // Fully connected graph - every agent connected to every other agent
      agentIds.forEach(id => {
        newNetwork[id] = agentIds.filter(target => target !== id);
      });

    } else if (type === 'core-periphery') {
      const { influencerPercent, influencerConnectivity, influencerReach, regularConnectivity } = params['core-periphery'];
      const coreSize = Math.max(2, Math.floor(n * influencerPercent));
      
      const isCore = (idx: number) => idx < coreSize;
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let prob: number;
          
          if (isCore(i) && isCore(j)) {
            prob = influencerConnectivity;
          } else if (isCore(i) || isCore(j)) {
            prob = influencerReach;
          } else {
            prob = regularConnectivity;
          }
          
          if (Math.random() < prob) {
            newNetwork[agentIds[i]].push(agentIds[j]);
            newNetwork[agentIds[j]].push(agentIds[i]);
          }
        }
      }

    } else if (type === 'holme-kim') {
      const { newConnections, clusteringChance } = params['holme-kim'];
      const mClamped = Math.min(newConnections, n - 1);
      
      // Start with seed
      const seedSize = mClamped + 1;
      for (let i = 0; i < seedSize; i++) {
        for (let j = i + 1; j < seedSize; j++) {
          newNetwork[agentIds[i]].push(agentIds[j]);
          newNetwork[agentIds[j]].push(agentIds[i]);
        }
      }
      
      for (let i = seedSize; i < n; i++) {
        const newNode = agentIds[i];
        const connected = new Set<string>();
        
        // First connection: preferential attachment
        let totalDegree = 0;
        for (let j = 0; j < i; j++) totalDegree += newNetwork[agentIds[j]].length;
        
        let r = Math.random() * totalDegree;
        let firstTarget = agentIds[0];
        for (let j = 0; j < i; j++) {
          r -= newNetwork[agentIds[j]].length;
          if (r <= 0) { firstTarget = agentIds[j]; break; }
        }
        
        newNetwork[newNode].push(firstTarget);
        newNetwork[firstTarget].push(newNode);
        connected.add(firstTarget);
        
        // Remaining connections
        while (connected.size < mClamped && connected.size < i) {
          if (Math.random() < clusteringChance) {
            // Triad formation: connect to neighbor of last connected
            const lastConnected = Array.from(connected).pop()!;
            const neighbors = newNetwork[lastConnected].filter(
              nb => !connected.has(nb) && nb !== newNode
            );
            if (neighbors.length > 0) {
              const triadTarget = neighbors[Math.floor(Math.random() * neighbors.length)];
              newNetwork[newNode].push(triadTarget);
              newNetwork[triadTarget].push(newNode);
              connected.add(triadTarget);
              continue;
            }
          }
          
          // Preferential attachment fallback
          r = Math.random() * totalDegree;
          for (let j = 0; j < i; j++) {
            if (connected.has(agentIds[j])) continue;
            r -= newNetwork[agentIds[j]].length;
            if (r <= 0) {
              newNetwork[newNode].push(agentIds[j]);
              newNetwork[agentIds[j]].push(newNode);
              connected.add(agentIds[j]);
              break;
            }
          }
        }
      }

    } else if (type === 'waxman') {
      const { maxDistance, distanceEffect } = params.waxman;
      
      const positions: Record<string, {x: number, y: number}> = {};
      agentIds.forEach(id => {
        positions[id] = { x: Math.random(), y: Math.random() };
      });
      
      const maxDist = Math.sqrt(2); // Diagonal of unit square
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const id1 = agentIds[i];
          const id2 = agentIds[j];
          const dx = positions[id1].x - positions[id2].x;
          const dy = positions[id1].y - positions[id2].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          const prob = distanceEffect * Math.exp(-dist / (maxDistance * maxDist));
          if (Math.random() < prob) {
            newNetwork[id1].push(id2);
            newNetwork[id2].push(id1);
          }
        }
      }

    } else if (type === 'random') {
      const { connectionChance } = params.random;
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.random() < connectionChance) {
            newNetwork[agentIds[i]].push(agentIds[j]);
            newNetwork[agentIds[j]].push(agentIds[i]);
          }
        }
      }

    } else if (type === 'sbm') {
      const { groupSize, withinGroupConnectivity, bridgeConnections } = params.sbm;
      const groupSizeClamped = Math.max(1, Math.round(groupSize));
      
      // Each agent has (n - groupSize) potential between-group partners
      const pBetween = Math.min(1, bridgeConnections / Math.max(1, n - groupSizeClamped));
      
      // Assign each agent to a group
      const agentGroup: Record<string, number> = {};
      agentIds.forEach((id, idx) => {
        agentGroup[id] = Math.floor(idx / groupSizeClamped);
      });
      
      // Within-group connections (all directed pairs)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const sourceId = agentIds[i];
          const targetId = agentIds[j];
          if (agentGroup[sourceId] !== agentGroup[targetId]) continue;
          
          if (Math.random() < withinGroupConnectivity) {
            if (!newNetwork[sourceId].includes(targetId)) {
              newNetwork[sourceId].push(targetId);
            }
          }
        }
      }
      
      // Between-group connections
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const sourceId = agentIds[i];
          const targetId = agentIds[j];
          if (agentGroup[sourceId] === agentGroup[targetId]) continue;
          
          if (Math.random() < pBetween) {
            if (!newNetwork[sourceId].includes(targetId)) {
              newNetwork[sourceId].push(targetId);
            }
            if (!newNetwork[targetId].includes(sourceId)) {
              newNetwork[targetId].push(sourceId);
            }
          }
        }
      }

    } else if (type === 'newman-watts') {
      const { neighborsEachSide, shortcutChance } = params['newman-watts'];
      const kClamped = Math.min(Math.round(neighborsEachSide), Math.floor((n - 1) / 2));
      
      // Step 1: Create ring lattice with k neighbors on each side
      agentIds.forEach((id, idx) => {
        for (let offset = 1; offset <= kClamped; offset++) {
          const prevIdx = (idx - offset + n) % n;
          const nextIdx = (idx + offset) % n;
          
          if (!newNetwork[id].includes(agentIds[prevIdx])) {
            newNetwork[id].push(agentIds[prevIdx]);
          }
          if (!newNetwork[id].includes(agentIds[nextIdx])) {
            newNetwork[id].push(agentIds[nextIdx]);
          }
        }
      });
      
      // Step 2: Add random shortcuts
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const sourceId = agentIds[i];
          const targetId = agentIds[j];
          
          if (newNetwork[sourceId].includes(targetId)) continue;
          
          if (Math.random() < shortcutChance) {
            newNetwork[sourceId].push(targetId);
            newNetwork[targetId].push(sourceId);
          }
        }
      }
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

  // Render parameter controls based on selected preset
  const renderParamControls = () => {
    if (!selectedPreset || selectedPreset === 'full') return null;

    const presetKey = selectedPreset as keyof PresetParams;
    
    return (
      <div className="space-y-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Settings2 size={12} />
            参数设置
          </span>
          <button
            onClick={() => resetParams(presetKey)}
            className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
          >
            <RefreshCw size={10} />
            重置默认
          </button>
        </div>

        {selectedPreset === 'core-periphery' && (
          <div className="space-y-3">
            <ParamSlider
              label="Fraction of agents that are influencers"
              labelCn="影响者比例"
              value={params['core-periphery'].influencerPercent}
              min={0.05}
              max={0.5}
              step={0.05}
              onChange={(v) => updateParam('core-periphery', 'influencerPercent', v)}
            />
            <ParamSlider
              label="Connection probability between influencers"
              labelCn="影响者连接"
              value={params['core-periphery'].influencerConnectivity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('core-periphery', 'influencerConnectivity', v)}
            />
            <ParamSlider
              label="Influencer to regular agent connection probability"
              labelCn="影响者触达"
              value={params['core-periphery'].influencerReach}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('core-periphery', 'influencerReach', v)}
            />
            <ParamSlider
              label="Connection probability between regular agents"
              labelCn="普通连接"
              value={params['core-periphery'].regularConnectivity}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => updateParam('core-periphery', 'regularConnectivity', v)}
            />
          </div>
        )}

        {selectedPreset === 'holme-kim' && (
          <div className="space-y-3">
            <ParamSlider
              label="Connections per new agent"
              labelCn="每个体连接数"
              value={params['holme-kim'].newConnections}
              min={1}
              max={10}
              step={1}
              onChange={(v) => updateParam('holme-kim', 'newConnections', v)}
              isInteger
            />
            <ParamSlider
              label="Probability of forming triangle clusters"
              labelCn="形成三角"
              value={params['holme-kim'].clusteringChance}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('holme-kim', 'clusteringChance', v)}
            />
          </div>
        )}

        {selectedPreset === 'waxman' && (
          <div className="space-y-3">
            <ParamSlider
              label="Maximum distance for connections"
              labelCn="最大距离"
              value={params.waxman.maxDistance}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('waxman', 'maxDistance', v)}
            />
            <ParamSlider
              label="How strongly distance reduces connection probability"
              labelCn="距离惩罚"
              value={params.waxman.distanceEffect}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('waxman', 'distanceEffect', v)}
            />
          </div>
        )}

        {selectedPreset === 'random' && (
          <div className="space-y-3">
            <ParamSlider
              label="Probability any two agents connect"
              labelCn="连接概率"
              value={params.random.connectionChance}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('random', 'connectionChance', v)}
            />
          </div>
        )}

        {selectedPreset === 'sbm' && (
          <div className="space-y-3">
            <ParamSlider
              label="Number of agents per community"
              labelCn="组大小"
              value={params.sbm.groupSize}
              min={2}
              max={20}
              step={1}
              onChange={(v) => updateParam('sbm', 'groupSize', v)}
              isInteger
            />
            <ParamSlider
              label="Connection probability within same group"
              labelCn="组内连接"
              value={params.sbm.withinGroupConnectivity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateParam('sbm', 'withinGroupConnectivity', v)}
            />
            <ParamSlider
              label="Average connections to other groups"
              labelCn="组间连接"
              value={params.sbm.bridgeConnections}
              min={0}
              max={5}
              step={0.5}
              onChange={(v) => updateParam('sbm', 'bridgeConnections', v)}
            />
          </div>
        )}

        {selectedPreset === 'newman-watts' && (
          <div className="space-y-3">
            <ParamSlider
              label="Neighbors on each side of ring"
              labelCn="环邻居数"
              value={params['newman-watts'].neighborsEachSide}
              min={1}
              max={10}
              step={1}
              onChange={(v) => updateParam('newman-watts', 'neighborsEachSide', v)}
              isInteger
            />
            <ParamSlider
              label="Probability of random long-range shortcuts"
              labelCn="捷径概率"
              value={params['newman-watts'].shortcutChance}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => updateParam('newman-watts', 'shortcutChance', v)}
            />
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={() => applyPreset(selectedPreset)}
          className="w-full py-2 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Play size={12} />
          生成网络 (Generate)
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[750px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
          <div className="w-72 bg-slate-50 border-r p-4 space-y-4 flex flex-col overflow-y-auto">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                网络预设 (Presets)
              </label>
              <p className="text-[10px] text-slate-400 mt-0.5 mb-3">
                选择预设类型，调整参数后生成网络
              </p>
              
              {/* Preset Selection Grid */}
              <div className="space-y-1.5">
                {Object.entries(presetMeta).map(([key, meta]) => {
                  const Icon = meta.icon;
                  const isSelected = selectedPreset === key;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedPreset(isSelected ? null : key as PresetType)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-200' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${isSelected ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                              {meta.nameCn}
                            </span>
                            <span className="text-[10px] text-slate-400">{meta.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {meta.description}
                          </p>
                        </div>
                        <div className={`transition-transform ${isSelected ? 'rotate-90' : ''}`}>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => {
                    setSelectedPreset('full');
                    applyPreset('full');
                  }}
                  className="flex-1 py-1.5 px-2 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
                >
                  <Share2 size={10} />
                  全连接
                </button>
                <button 
                  onClick={() => setNetwork({})} 
                  className="flex-1 py-1.5 px-2 bg-white border border-slate-200 rounded text-[10px] text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1"
                >
                  <Circle size={10} />
                  清空
                </button>
              </div>
            </div>

            {/* Parameter Controls */}
            {renderParamControls()}

            {/* Instructions */}
            <div className="text-xs text-slate-400 leading-relaxed pt-3 border-t mt-auto">
              <strong className="text-slate-500">操作指南:</strong>
              <ul className="list-decimal pl-4 space-y-0.5 mt-1 text-[10px]">
                <li>选择预设类型并调整参数</li>
                <li>点击"生成网络"应用设置</li>
                <li>点击节点选中（橙色）</li>
                <li>点击另一节点建立/删除连接</li>
                <li>拖拽节点调整布局</li>
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

            {/* Network Stats */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-[10px] text-slate-600">
              <div className="flex items-center gap-3">
                <span>
                  <strong className="text-slate-700">{agents.length}</strong> 节点
                </span>
                <span>
                  <strong className="text-slate-700">
                    {Object.values(network).reduce((sum, arr) => sum + arr.length, 0)}
                  </strong> 边
                </span>
              </div>
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

