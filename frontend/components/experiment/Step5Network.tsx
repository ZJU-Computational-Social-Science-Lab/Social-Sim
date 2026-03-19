/**
 * Step 5: Network Configuration
 *
 * Configure social network connections between agents.
 * Reuses the network visualization from NetworkEditorModal but embedded in the wizard.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { Button } from '../ui/button';
import * as d3 from 'd3';
import * as d3Force from 'd3-force';
import {
  Network,
  Circle,
  RefreshCw,
  Share2,
  Grid3X3,
  Users,
  Shuffle,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// =============================================================================
// Types
// =============================================================================

type PresetType = 'full' | 'random' | 'ring' | 'star' | 'newman-watts' | 'core-periphery' | 'holme-kim' | 'waxman' | 'sbm';

interface PresetParams {
  random: { connectionChance: number };
  ring: {};
  star: {};
  'newman-watts': { neighborsEachSide: number; shortcutChance: number };
  'core-periphery': {
    influencerPercent: number;
    influencerConnectivity: number;
    influencerReach: number;
    regularConnectivity: number;
  };
  'holme-kim': { newConnections: number; clusteringChance: number };
  waxman: { maxDistance: number; distanceEffect: number };
  sbm: { groupSize: number; withinGroupConnectivity: number; bridgeConnections: number };
}

interface PresetMeta {
  name: string;
  description: string;
  icon: React.ElementType;
}

// =============================================================================
// Preset Definitions
// =============================================================================

// Note: Preset names/descriptions are now translated in the component
// This object only maps preset types to their icons and translation keys
const presetIcons: Record<PresetType, { icon: React.ElementType; translationKey: string }> = {
  full: { icon: Share2, translationKey: 'fully_connected' },
  random: { icon: Shuffle, translationKey: 'random' },
  ring: { icon: RefreshCw, translationKey: 'ring' },
  star: { icon: Users, translationKey: 'star' },
  'newman-watts': { icon: Grid3X3, translationKey: 'small_world' },
  'core-periphery': { icon: Layers, translationKey: 'core_periphery' },
  'holme-kim': { icon: Share2, translationKey: 'scale_free' },
  waxman: { icon: Grid3X3, translationKey: 'spatial' },
  sbm: { icon: Users, translationKey: 'communities' },
};

const defaultParams: PresetParams = {
  random: { connectionChance: 0.3 },
  ring: {},
  star: {},
  'newman-watts': { neighborsEachSide: 2, shortcutChance: 0.1 },
  'core-periphery': {
    influencerPercent: 0.2,
    influencerConnectivity: 0.8,
    influencerReach: 0.4,
    regularConnectivity: 0.1,
  },
  'holme-kim': { newConnections: 3, clusteringChance: 0.5 },
  waxman: { maxDistance: 0.5, distanceEffect: 0.5 },
  sbm: { groupSize: 5, withinGroupConnectivity: 0.6, bridgeConnections: 1 },
};

/**
 * Ensures no agent is isolated (has zero connections).
 * For any isolated agent, creates a connection to a random other agent.
 */
const ensureNoIsolatedNodes = (
  network: Record<string, string[]>,
  ids: string[]
): Record<string, string[]> => {
  if (ids.length <= 1) return network; // Single agent can't have connections

  const result = JSON.parse(JSON.stringify(network));

  for (const agentId of ids) {
    const connections = result[agentId] || [];
    if (connections.length === 0) {
      // Connect to a random other agent
      const others = ids.filter(id => id !== agentId);
      const neighbor = others[Math.floor(Math.random() * others.length)];

      result[agentId] = [neighbor];
      // Ensure reciprocal connection
      if (!result[neighbor].includes(agentId)) {
        result[neighbor] = [...(result[neighbor] || []), agentId];
      }
    }
  }

  return result;
};

// =============================================================================
// ParamSlider Component
// =============================================================================

interface ParamSliderProps {
  labelKey: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  isInteger?: boolean;
}

const ParamSlider: React.FC<ParamSliderProps> = ({
  labelKey,
  value,
  min,
  max,
  step,
  onChange,
  isInteger = false,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex-1 text-[11px] font-medium text-[var(--sim-text-muted)]">
        {t(`components.networkEditorModal.${labelKey}`)}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(isInteger ? parseInt(e.target.value) : parseFloat(e.target.value))}
          className="h-1 w-24 accent-[var(--sim-primary)]"
        />
        <span className="w-10 text-right text-[10px] text-[var(--sim-text-soft)]">
          {isInteger ? value : value.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// Step5Network Component
// =============================================================================

export const Step5Network: React.FC = () => {
  const { t } = useTranslation();
  const { socialNetwork, setSocialNetwork, agentTypes } = useExperimentBuilder();
  const [linkFrom, setLinkFrom] = useState('');
  const [linkTo, setLinkTo] = useState('');

  // Local state
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);
  const [params, setParams] = useState<PresetParams>(JSON.parse(JSON.stringify(defaultParams)));
  const [hoverInfo, setHoverInfo] = useState<{ name: string; profile?: string; x: number; y: number } | null>(null);

  // D3 refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const d3SvgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Get agent IDs from agent types
  const { agentIds, profileMap } = useMemo(() => {
    const ids: string[] = [];
    const profiles: Record<string, string> = {};
    for (const type of agentTypes) {
      const count = type.count || 1;
      for (let i = 0; i < count; i++) {
        const suffix = count > 1 ? ` ${i + 1}` : '';
        const name = `${type.label}${suffix}`;
        ids.push(name);
        const summary = type.userProfile || type.rolePrompt || '';
        profiles[name] = summary;
      }
    }
    return { agentIds: ids, profileMap: profiles };
  }, [agentTypes]);

  // Keep manual link selectors in sync with current agents
  useEffect(() => {
    if (agentIds.length === 0) return;
    if (!agentIds.includes(linkFrom)) {
      setLinkFrom(agentIds[0]);
    }
    if (!agentIds.includes(linkTo)) {
      setLinkTo(agentIds[Math.min(1, agentIds.length - 1)]);
    }
  }, [agentIds, linkFrom, linkTo]);

  const edges = useMemo(() => {
    const list: { key: string; source: string; target: string }[] = [];
    const dedup = new Set<string>();
    for (const [source, targets] of Object.entries(socialNetwork)) {
      for (const target of targets) {
        if (!agentIds.includes(source) || !agentIds.includes(target)) continue;
        const key = source < target ? `${source}|${target}` : `${target}|${source}`;
        if (dedup.has(key)) continue;
        dedup.add(key);
        list.push({ key, source, target });
      }
    }
    return list;
  }, [agentIds, socialNetwork]);
  const isolatedCount = useMemo(
    () => agentIds.filter((id) => (socialNetwork[id] || []).length === 0).length,
    [agentIds, socialNetwork],
  );
  const connectionDensity = useMemo(() => {
    const possible = agentIds.length > 1 ? (agentIds.length * (agentIds.length - 1)) / 2 : 1;
    return Math.min(1, edges.length / possible);
  }, [agentIds.length, edges.length]);

  const addLink = () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;
    const key = linkFrom < linkTo ? `${linkFrom}|${linkTo}` : `${linkTo}|${linkFrom}`;
    const alreadyExists = edges.some((edge) => edge.key === key);
    if (alreadyExists) return;

    const next: Record<string, string[]> = {};
    for (const id of agentIds) {
      next[id] = [...(socialNetwork[id] || [])];
    }

    next[linkFrom] = [...(next[linkFrom] || []), linkTo];
    next[linkTo] = [...(next[linkTo] || []), linkFrom];
    setSocialNetwork(next);
  };

  const removeLink = (key: string) => {
    const [a, b] = key.split('|');
    const next: Record<string, string[]> = {};
    for (const id of agentIds) {
      next[id] = (socialNetwork[id] || []).filter((target) => target !== a && target !== b);
    }
    setSocialNetwork(next);
  };

  // Reset params when preset changes
  const resetParams = useCallback((presetKey: keyof PresetParams) => {
    setParams((prev) => ({
      ...prev,
      [presetKey]: { ...defaultParams[presetKey] },
    }));
  }, []);

  // Update param
  const updateParam = useCallback(<K extends keyof PresetParams, P extends keyof PresetParams[K]>(
    preset: K,
    param: P,
    value: PresetParams[K][P]
  ) => {
    setParams((prev) => ({
      ...prev,
      [preset]: { ...prev[preset], [param]: value },
    }));
  }, []);

  // Apply preset
  const applyPreset = useCallback((type: PresetType) => {
    const n = agentIds.length;
    const newNetwork: Record<string, string[]> = {};

    // Initialize empty adjacency list
    agentIds.forEach((id) => {
      newNetwork[id] = [];
    });

    if (type === 'full') {
      // Fully connected
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          newNetwork[agentIds[i]].push(agentIds[j]);
          newNetwork[agentIds[j]].push(agentIds[i]);
        }
      }
    } else if (type === 'ring') {
      // Ring network
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        newNetwork[agentIds[i]].push(agentIds[next]);
        newNetwork[agentIds[next]].push(agentIds[i]);
      }
    } else if (type === 'star') {
      // Star network (first agent is center)
      if (n > 1) {
        for (let i = 1; i < n; i++) {
          newNetwork[agentIds[0]].push(agentIds[i]);
          newNetwork[agentIds[i]].push(agentIds[0]);
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
    } else if (type === 'newman-watts') {
      const { neighborsEachSide, shortcutChance } = params['newman-watts'];
      const k = Math.min(neighborsEachSide, Math.floor((n - 1) / 2));

      // Ring lattice
      for (let i = 0; i < n; i++) {
        for (let offset = 1; offset <= k; offset++) {
          const neighborIdx = (i + offset) % n;
          const neighborIdx2 = (i - offset + n) % n;
          newNetwork[agentIds[i]].push(agentIds[neighborIdx]);
          newNetwork[agentIds[neighborIdx]].push(agentIds[i]);
        }
      }

      // Shortcuts
      for (let i = 0; i < n; i++) {
        for (let offset = k + 1; offset <= Math.floor(n / 2); offset++) {
          if (Math.random() < shortcutChance) {
            const neighborIdx = (i + offset) % n;
            if (!newNetwork[agentIds[i]].includes(agentIds[neighborIdx])) {
              newNetwork[agentIds[i]].push(agentIds[neighborIdx]);
              newNetwork[agentIds[neighborIdx]].push(agentIds[i]);
            }
          }
        }
      }
    }

    // Ensure no isolated nodes
    const connectedNetwork = ensureNoIsolatedNodes(newNetwork, agentIds);
    setSocialNetwork(connectedNetwork);
  }, [agentIds, params, setSocialNetwork]);

  // Auto-initialize network when agents exist but network is empty
  useEffect(() => {
    if (agentIds.length > 0 && Object.keys(socialNetwork).length === 0) {
      applyPreset('full');
      setSelectedPreset('full');
    }
  }, [agentIds.length, socialNetwork, applyPreset]);

  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    d3SvgRef.current = svg;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0, 8])
      .on('zoom', (event) => {
        svg.select('g.main').attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;

    // Create main group
    svg.append('g').attr('class', 'main');

    // Handle zoom
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

  }, []);

  // Update network visualization with D3 force simulation
  useEffect(() => {
    if (!d3SvgRef.current || !containerRef.current || Object.keys(socialNetwork).length === 0) return;

    const svg = d3SvgRef.current;
    const main = svg.select('g.main');
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const tooltipCoords = (evt: MouseEvent | PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || containerRef.current?.clientWidth || 0;
      const h = rect?.height || containerRef.current?.clientHeight || 0;
      const x = Math.max(8, Math.min(w - 220, evt.clientX - (rect?.left || 0) + 12));
      const y = Math.max(8, Math.min(h - 160, evt.clientY - (rect?.top || 0) + 12));
      return { x, y };
    };

    // Clear existing
    main.selectAll('*').remove();

    // Build nodes and links
    const nodeIds = Object.keys(socialNetwork);
    const nodes: { id: string; name: string; x?: number; y?: number; fx?: number | null; fy?: number | null; profile?: string }[] =
      nodeIds.map((id) => ({ id, name: id, profile: profileMap[id] }));
    const links: { source: string; target: string }[] = [];

    // Create links (avoid duplicates)
    const addedLinks = new Set<string>();
    for (const [source, targets] of Object.entries(socialNetwork)) {
      for (const target of targets) {
        if (nodeIds.includes(target)) {
          // Normalize link key to avoid duplicates
          const key = source < target ? `${source}-${target}` : `${target}-${source}`;
          if (!addedLinks.has(key)) {
            links.push({ source, target });
            addedLinks.add(key);
          }
        }
      }
    }

    // Create force simulation
    const simulation = d3Force.forceSimulation(nodes as any)
      .force('link', d3Force.forceLink(links).id((d: any) => d.id).distance(120))
      .force('charge', d3Force.forceManyBody().strength(-300))
      .force('center', d3Force.forceCenter(0, 0))
      .force('collide', d3Force.forceCollide(35));

    // Draw links
    const link = main.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Draw nodes as groups (circle + text label)
    const node = main.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node cursor-pointer')
      .call(
        d3.drag<SVGGElement, any>()
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
          })
      );

    // Node circle
    node.append('circle')
      .attr('r', 16)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Node text label (visible below circle)
    node.append('text')
      .attr('dy', 28)
      .attr('text-anchor', 'middle')
      .text((d) => d.name)
      .attr('class', 'text-[10px] font-medium fill-slate-700 pointer-events-none select-none');

    node.append('title').text((d) => (d.profile ? `${d.name}\n${d.profile}` : t('experimentBuilder.step5.noProfile', '无简介')));

    // Hover tooltip using React state for reliability
    node
      .on('mouseenter', (event, d: any) => {
        const pos = tooltipCoords(event);
        setHoverInfo({ name: d.name, profile: d.profile, ...pos });
      })
      .on('mousemove', (event) => {
        const pos = tooltipCoords(event);
        setHoverInfo((prev) => (prev ? { ...prev, ...pos } : null));
      })
      .on('mouseleave', () => setHoverInfo(null));

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };

  }, [socialNetwork, profileMap, t]);

  // Zoom controls
  const handleZoomIn = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.67);
    }
  };

  const handleResetZoom = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      // Center the viewport on origin where nodes are positioned
      d3SvgRef.current.transition().duration(500).call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(width / 2, height / 2)
      );
    }
  };

  // Render parameter controls
  const renderParamControls = () => {
    if (!selectedPreset || selectedPreset === 'full' || selectedPreset === 'ring' || selectedPreset === 'star') return null;

    const presetKey = selectedPreset as keyof PresetParams;

    return (
      <div className="studio-field-group">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
            <Settings2 size={12} />
            {t('components.networkEditorModal.parameterSettings')}
          </span>
          <button
            onClick={() => resetParams(presetKey)}
            className="text-[11px] font-medium text-[var(--sim-primary)] hover:text-[var(--sim-primary-strong)]"
          >
            <RefreshCw size={10} />
            {t('components.networkEditorModal.resetDefaults')}
          </button>
        </div>

        {selectedPreset === 'random' && (
          <ParamSlider
            labelKey="probabilityAnyTwoConnect"
            value={params.random.connectionChance}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateParam('random', 'connectionChance', v)}
          />
        )}

        {selectedPreset === 'newman-watts' && (
          <div className="space-y-3">
            <ParamSlider
              labelKey="neighborsEachSide"
              value={params['newman-watts'].neighborsEachSide}
              min={1}
              max={5}
              step={1}
              onChange={(v) => updateParam('newman-watts', 'neighborsEachSide', v)}
              isInteger
            />
            <ParamSlider
              labelKey="probabilityLongRangeShortcut"
              value={params['newman-watts'].shortcutChance}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => updateParam('newman-watts', 'shortcutChance', v)}
            />
          </div>
        )}

        {/* Apply Changes Button */}
        <div className="border-t border-[var(--sim-border)] pt-3">
          <button
            onClick={() => {
              if (selectedPreset) {
                applyPreset(selectedPreset);
              }
            }}
            disabled={!selectedPreset}
            className="button button-sm w-full"
          >
            {t('experimentBuilder.step5.applyChanges')}
          </button>
        </div>
      </div>
    );
  };

  // Check if agents are configured
  if (agentTypes.length === 0 || agentIds.length === 0) {
    return (
      <div className="studio-empty-state">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-[rgba(206,152,74,0.18)] bg-[rgba(206,152,74,0.12)]">
          <Users className="h-8 w-8 text-[var(--sim-warning)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--sim-text-strong)]">
          {t('experimentBuilder.step5.noAgentsConfigured')}
        </h3>
        <p className="max-w-md text-sm leading-6 text-[var(--sim-text-muted)]">
          {t('experimentBuilder.step5.goBackToStep4')}
        </p>
      </div>
    );
  }

  const selectedPresetMeta = selectedPreset ? presetIcons[selectedPreset] : null;

  return (
    <div className="space-y-6">
      <section className="studio-field-group">
        <div className="page-hero__eyebrow w-fit">Relationship topology</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step5.networkPresets')}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--sim-text-muted)]">
              Configure how influence, visibility, and contagion move across the cast. Presets reshape the graph instantly, while manual links let you fine tune edge cases.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{agentIds.length} agents</span>
            <span className="status-pill">{edges.length} links</span>
            <span className="status-pill">{Math.round(connectionDensity * 100)}% density</span>
          </div>
        </div>
      </section>

      <div className="studio-network-layout">
        <aside className="studio-network-tools">
          <section className="studio-field-group">
            <div>
              <div className="page-hero__eyebrow w-fit">Presets</div>
              <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                {t('experimentBuilder.step5.chooseTopology')}
              </p>
            </div>

            <div className="space-y-2">
              {Object.entries(presetIcons).map(([key, { icon: Icon, translationKey }]) => {
                const isSelected = selectedPreset === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(isSelected ? null : key as PresetType);
                      if (!isSelected) {
                        applyPreset(key as PresetType);
                      }
                    }}
                    className={`studio-network-preset ${isSelected ? 'active' : ''}`.trim()}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[rgba(51,104,200,0.12)] text-[var(--sim-primary)]">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
                        {t(`experimentBuilder.step5.presets.${translationKey}.name`)}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--sim-text-muted)]">
                        {t(`experimentBuilder.step5.presets.${translationKey}.description`)}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`text-[var(--sim-text-soft)] transition-transform ${isSelected ? 'rotate-90' : ''}`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPreset('full');
                  applyPreset('full');
                }}
                className="button-ghost button-sm"
              >
                <Share2 size={12} />
                {t('experimentBuilder.step5.fullyConnected')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (agentIds.length > 0) {
                    setSelectedPreset('random');
                    applyPreset('random');
                  }
                }}
                className="button-ghost button-sm"
              >
                <RefreshCw size={12} />
                {t('experimentBuilder.step5.reset')}
              </button>
            </div>
          </section>

          <section className="studio-field-group">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
              <Settings2 size={12} />
              {t('experimentBuilder.step5.manualLinks', 'Manual links')}
            </div>
            <div className="grid gap-3">
              <select value={linkFrom} onChange={(e) => setLinkFrom(e.target.value)} className="input">
                {agentIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="input">
                {agentIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" className="w-full" disabled={!linkFrom || !linkTo || linkFrom === linkTo} onClick={addLink}>
              {t('experimentBuilder.step5.addLink', 'Add link')}
            </Button>

            {edges.length > 0 ? (
              <div className="space-y-2 border-t border-[var(--sim-border)] pt-3">
                {edges.slice(0, 8).map(({ key, source, target }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.34)] px-3 py-2 text-xs text-[var(--sim-text-muted)] dark:bg-[rgba(255,255,255,0.02)]"
                  >
                    <span className="truncate">
                      {source} ↔ {target}
                    </span>
                    <button
                      type="button"
                      className="text-[var(--sim-danger)] hover:text-[var(--sim-danger)]"
                      onClick={() => removeLink(key)}
                    >
                      {t('common.remove', 'Remove')}
                    </button>
                  </div>
                ))}
                {edges.length > 8 && (
                  <div className="text-xs text-[var(--sim-text-soft)]">
                    {edges.length - 8} more links hidden for brevity.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[var(--sim-border)] px-4 py-4 text-sm text-[var(--sim-text-soft)]">
                {t('experimentBuilder.step5.noLinks', 'No links yet')}
              </div>
            )}
          </section>

          {renderParamControls()}

          <section className="studio-field-group">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
              {t('experimentBuilder.step5.instructions')}
            </div>
            <ul className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--sim-text-muted)]">
              <li>{t('experimentBuilder.step5.instructionSelect')}</li>
              <li>{t('experimentBuilder.step5.instructionDrag')}</li>
              <li>{t('experimentBuilder.step5.instructionZoom')}</li>
            </ul>
          </section>
        </aside>

        <div ref={containerRef} className="studio-network-canvas group">
          <svg ref={svgRef} className="block h-full w-full"></svg>

          {hoverInfo && (
            <div
              className="studio-network-floating absolute z-20 pointer-events-none max-w-xs px-3 py-2 text-[11px] text-[var(--sim-text)]"
              style={{ left: hoverInfo.x, top: hoverInfo.y }}
            >
              <div className="font-semibold text-[var(--sim-text-strong)]">{hoverInfo.name}</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[var(--sim-text-muted)]">
                {hoverInfo.profile || t('experimentBuilder.step5.noProfile', '无简介')}
              </div>
            </div>
          )}

          <div className="studio-network-floating absolute left-4 top-4 max-w-sm px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
              Active structure
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--sim-text-strong)]">
              {selectedPresetMeta ? React.createElement(selectedPresetMeta.icon, { size: 14 }) : <Network size={14} />}
              {selectedPresetMeta
                ? t(`experimentBuilder.step5.presets.${selectedPresetMeta.translationKey}.name`)
                : 'Custom network'}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
              {selectedPresetMeta
                ? t(`experimentBuilder.step5.presets.${selectedPresetMeta.translationKey}.description`)
                : 'The graph currently mixes preset structure with manual edits.'}
            </p>
          </div>

          <div className="studio-network-floating absolute bottom-4 left-4 px-4 py-3 text-xs text-[var(--sim-text-muted)]">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong className="text-[var(--sim-text-strong)]">{agentIds.length}</strong>{' '}
                {t('experimentBuilder.step5.nodes', { count: agentIds.length })}
              </span>
              <span>
                <strong className="text-[var(--sim-text-strong)]">{edges.length}</strong>{' '}
                {t('experimentBuilder.step5.edges', { count: edges.length })}
              </span>
              <span>
                <strong className="text-[var(--sim-text-strong)]">{isolatedCount}</strong> isolated
              </span>
            </div>
          </div>

          <div className="studio-network-floating absolute right-4 top-4 flex flex-col gap-1 p-1">
            <button
              type="button"
              onClick={handleZoomIn}
              className="rounded-[14px] p-2 text-[var(--sim-text-muted)] hover:bg-[var(--sim-surface-3)]"
              title={t('experimentBuilder.network.zoomIn')}
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="rounded-[14px] p-2 text-[var(--sim-text-muted)] hover:bg-[var(--sim-surface-3)]"
              title={t('experimentBuilder.network.zoomOut')}
            >
              <ZoomOut size={16} />
            </button>
            <div className="my-0.5 h-px bg-[var(--sim-border)]"></div>
            <button
              type="button"
              onClick={handleResetZoom}
              className="rounded-[14px] p-2 text-[var(--sim-text-muted)] hover:bg-[var(--sim-surface-3)]"
              title={t('experimentBuilder.network.resetView')}
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>

        <aside className="studio-network-brief">
          <section className="studio-field-group">
            <div className="page-hero__eyebrow w-fit">Live briefing</div>
            <div className="space-y-3">
              <div className="rounded-[18px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.36)] px-4 py-4 dark:bg-[rgba(255,255,255,0.02)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                  Density
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--sim-text-strong)]">
                  {Math.round(connectionDensity * 100)}%
                </div>
                <div className="mt-2 text-sm text-[var(--sim-text-muted)]">
                  Higher density increases information exposure and accelerates convergence.
                </div>
              </div>
              <div className="rounded-[18px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.36)] px-4 py-4 dark:bg-[rgba(255,255,255,0.02)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                  Isolation check
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--sim-text-strong)]">
                  {isolatedCount === 0 ? 'All agents connected' : `${isolatedCount} agents isolated`}
                </div>
                <div className="mt-2 text-sm text-[var(--sim-text-muted)]">
                  The preset engine already avoids empty islands, but manual edits can still reshape the final flow of influence.
                </div>
              </div>
            </div>
          </section>

          <section className="studio-field-group">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
              Connection sample
            </div>
            <div className="space-y-2">
              {edges.slice(0, 6).map(({ key, source, target }) => (
                <div
                  key={key}
                  className="rounded-[16px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.34)] px-3 py-3 text-sm text-[var(--sim-text-muted)] dark:bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="font-medium text-[var(--sim-text-strong)]">{source}</div>
                  <div className="mt-1 text-[var(--sim-text-soft)]">linked with {target}</div>
                </div>
              ))}
              {edges.length === 0 && (
                <div className="rounded-[16px] border border-dashed border-[var(--sim-border)] px-4 py-4 text-sm text-[var(--sim-text-soft)]">
                  Manual and preset connections will appear here once the graph is populated.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default Step5Network;
