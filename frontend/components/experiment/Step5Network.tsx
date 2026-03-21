import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import * as d3Force from "d3-force";
import {
  ChevronRight,
  Grid3X3,
  Layers,
  Maximize,
  RefreshCw,
  Settings2,
  Share2,
  Shuffle,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { Button } from "../ui/button";
import { buildNetworkOverview } from "../../utils/networkMetrics";
import { buildAgentCollections } from "../../utils/agentCollections";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";

type PresetType =
  | "full"
  | "random"
  | "ring"
  | "star"
  | "newman-watts"
  | "core-periphery"
  | "holme-kim"
  | "waxman"
  | "sbm";

interface PresetParams {
  random: { connectionChance: number };
  ring: Record<string, never>;
  star: Record<string, never>;
  "newman-watts": { neighborsEachSide: number; shortcutChance: number };
  "core-periphery": {
    influencerPercent: number;
    influencerConnectivity: number;
    influencerReach: number;
    regularConnectivity: number;
  };
  "holme-kim": { newConnections: number; clusteringChance: number };
  waxman: { maxDistance: number; distanceEffect: number };
  sbm: { groupSize: number; withinGroupConnectivity: number; bridgeConnections: number };
}

const presetIcons: Record<PresetType, { icon: React.ElementType; translationKey: string }> = {
  full: { icon: Share2, translationKey: "fully_connected" },
  random: { icon: Shuffle, translationKey: "random" },
  ring: { icon: RefreshCw, translationKey: "ring" },
  star: { icon: Users, translationKey: "star" },
  "newman-watts": { icon: Grid3X3, translationKey: "small_world" },
  "core-periphery": { icon: Layers, translationKey: "core_periphery" },
  "holme-kim": { icon: Share2, translationKey: "scale_free" },
  waxman: { icon: Grid3X3, translationKey: "spatial" },
  sbm: { icon: Users, translationKey: "communities" },
};

const defaultParams: PresetParams = {
  random: { connectionChance: 0.3 },
  ring: {},
  star: {},
  "newman-watts": { neighborsEachSide: 2, shortcutChance: 0.1 },
  "core-periphery": {
    influencerPercent: 0.2,
    influencerConnectivity: 0.8,
    influencerReach: 0.4,
    regularConnectivity: 0.1,
  },
  "holme-kim": { newConnections: 3, clusteringChance: 0.5 },
  waxman: { maxDistance: 0.5, distanceEffect: 0.5 },
  sbm: { groupSize: 5, withinGroupConnectivity: 0.6, bridgeConnections: 1 },
};

const ensureNoIsolatedNodes = (
  network: Record<string, string[]>,
  ids: string[]
): Record<string, string[]> => {
  if (ids.length <= 1) return network;

  const next = JSON.parse(JSON.stringify(network)) as Record<string, string[]>;

  ids.forEach((agentId) => {
    if ((next[agentId] || []).length > 0) return;
    const neighbor = ids.find((id) => id !== agentId);
    if (!neighbor) return;
    next[agentId] = [neighbor];
    next[neighbor] = [...(next[neighbor] || []), agentId];
  });

  return next;
};

const ParamSlider = ({
  label,
  value,
  min,
  max,
  step,
  isInteger,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isInteger?: boolean;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
      <span>{label}</span>
      <span className="font-mono text-slate-500">
        {isInteger ? value : value.toFixed(2)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) =>
        onChange(isInteger ? parseInt(event.target.value, 10) : parseFloat(event.target.value))
      }
      className="h-1.5 w-full accent-slate-900"
    />
  </div>
);

export const Step5Network: React.FC = () => {
  const { t } = useTranslation();
  const { socialNetwork, setSocialNetwork, agentTypes } = useExperimentBuilder();
  const [linkFrom, setLinkFrom] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);
  const [params, setParams] = useState<PresetParams>(JSON.parse(JSON.stringify(defaultParams)));
  const [hoverInfo, setHoverInfo] = useState<{ name: string; profile?: string; x: number; y: number } | null>(null);
  const [stageView, setStageView] = useState<"overview" | "graph">("overview");
  const [showAdvancedMembers, setShowAdvancedMembers] = useState(false);
  const [showAdvancedLinks, setShowAdvancedLinks] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const d3SvgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const { agentIds, profileMap } = useMemo(() => {
    const ids: string[] = [];
    const profiles: Record<string, string> = {};
    agentTypes.forEach((type) => {
      const count = type.count || 1;
      for (let index = 0; index < count; index += 1) {
        const suffix = count > 1 ? ` ${index + 1}` : "";
        const name = `${type.label}${suffix}`;
        ids.push(name);
        profiles[name] = type.userProfile || type.rolePrompt || "";
      }
    });
    return { agentIds: ids, profileMap: profiles };
  }, [agentTypes]);
  const agentCollections = useMemo(
    () => buildAgentCollections(agentTypes, () => ""),
    [agentTypes]
  );
  const agentCollectionLookup = useMemo(() => {
    const lookup = new globalThis.Map<string, (typeof agentCollections)[number]>();
    agentCollections.forEach((collection) => {
      collection.members.forEach((member) => {
        lookup.set(member.label, collection);
      });
    });
    return lookup;
  }, [agentCollections]);

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

    Object.entries(socialNetwork).forEach(([source, targets]) => {
      targets.forEach((target) => {
        if (!agentIds.includes(source) || !agentIds.includes(target)) return;
        const key = source < target ? `${source}|${target}` : `${target}|${source}`;
        if (dedup.has(key)) return;
        dedup.add(key);
        list.push({ key, source, target });
      });
    });

    return list;
  }, [agentIds, socialNetwork]);

  const networkOverview = useMemo(
    () => buildNetworkOverview(agentIds, socialNetwork),
    [agentIds, socialNetwork]
  );
  const groupedEdges = useMemo(() => {
    const grouped = new globalThis.Map<
      string,
      {
        key: string;
        sourceTitle: string;
        targetTitle: string;
        count: number;
        sample: string[];
      }
    >();

    edges.forEach((edge) => {
      const sourceCollection = agentCollectionLookup.get(edge.source);
      const targetCollection = agentCollectionLookup.get(edge.target);
      const sourceTitle = sourceCollection?.title || edge.source;
      const targetTitle = targetCollection?.title || edge.target;
      const ordered =
        sourceTitle.localeCompare(targetTitle, undefined, { sensitivity: "base" }) <= 0
          ? [sourceTitle, targetTitle]
          : [targetTitle, sourceTitle];
      const key = `${ordered[0]}|${ordered[1]}`;
      const current = grouped.get(key);

      if (current) {
        current.count += 1;
        if (current.sample.length < 3) {
          current.sample.push(`${edge.source} ↔ ${edge.target}`);
        }
        return;
      }

      grouped.set(key, {
        key,
        sourceTitle: ordered[0],
        targetTitle: ordered[1],
        count: 1,
        sample: [`${edge.source} ↔ ${edge.target}`],
      });
    });

    return Array.from(grouped.values()).sort(
      (left, right) =>
        right.count - left.count ||
        left.sourceTitle.localeCompare(right.sourceTitle, undefined, { sensitivity: "base" })
    );
  }, [agentCollectionLookup, edges]);
  const groupedIsolatedAgents = useMemo(() => {
    const grouped = new globalThis.Map<string, { title: string; count: number; members: string[] }>();

    networkOverview.isolatedAgents.forEach((agentId) => {
      const collection = agentCollectionLookup.get(agentId);
      const title = collection?.title || agentId;
      const current = grouped.get(title);

      if (current) {
        current.count += 1;
        current.members.push(agentId);
        return;
      }

      grouped.set(title, {
        title,
        count: 1,
        members: [agentId],
      });
    });

    return Array.from(grouped.values()).sort(
      (left, right) =>
        right.count - left.count ||
        left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    );
  }, [agentCollectionLookup, networkOverview.isolatedAgents]);

  const resetParams = useCallback((presetKey: keyof PresetParams) => {
    setParams((prev) => ({ ...prev, [presetKey]: { ...defaultParams[presetKey] } }));
  }, []);

  const updateParam = useCallback(
    <K extends keyof PresetParams, P extends keyof PresetParams[K]>(
      preset: K,
      param: P,
      value: PresetParams[K][P]
    ) => {
      setParams((prev) => ({
        ...prev,
        [preset]: { ...prev[preset], [param]: value },
      }));
    },
    []
  );

  const applyPreset = useCallback(
    (type: PresetType) => {
      const n = agentIds.length;
      const next: Record<string, string[]> = {};

      agentIds.forEach((id) => {
        next[id] = [];
      });

      if (type === "full") {
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            next[agentIds[i]].push(agentIds[j]);
            next[agentIds[j]].push(agentIds[i]);
          }
        }
      }

      if (type === "ring") {
        for (let i = 0; i < n; i += 1) {
          const neighbor = (i + 1) % n;
          next[agentIds[i]].push(agentIds[neighbor]);
          next[agentIds[neighbor]].push(agentIds[i]);
        }
      }

      if (type === "star" && n > 1) {
        for (let i = 1; i < n; i += 1) {
          next[agentIds[0]].push(agentIds[i]);
          next[agentIds[i]].push(agentIds[0]);
        }
      }

      if (type === "random") {
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            if (Math.random() < params.random.connectionChance) {
              next[agentIds[i]].push(agentIds[j]);
              next[agentIds[j]].push(agentIds[i]);
            }
          }
        }
      }

      if (type === "newman-watts") {
        const { neighborsEachSide, shortcutChance } = params["newman-watts"];
        const range = Math.min(neighborsEachSide, Math.floor((n - 1) / 2));

        for (let i = 0; i < n; i += 1) {
          for (let offset = 1; offset <= range; offset += 1) {
            const forward = (i + offset) % n;
            next[agentIds[i]].push(agentIds[forward]);
            next[agentIds[forward]].push(agentIds[i]);
          }
        }

        for (let i = 0; i < n; i += 1) {
          for (let j = i + range + 1; j < n; j += 1) {
            if (Math.random() < shortcutChance && !next[agentIds[i]].includes(agentIds[j])) {
              next[agentIds[i]].push(agentIds[j]);
              next[agentIds[j]].push(agentIds[i]);
            }
          }
        }
      }

      setSocialNetwork(ensureNoIsolatedNodes(next, agentIds));
    },
    [agentIds, params, setSocialNetwork]
  );

  useEffect(() => {
    if (agentIds.length > 0 && Object.keys(socialNetwork).length === 0) {
      setSelectedPreset("full");
      applyPreset("full");
    }
  }, [agentIds.length, applyPreset, socialNetwork]);

  useEffect(() => {
    if (stageView !== "graph") return;
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    d3SvgRef.current = svg;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on("zoom", (event) => {
        svg.select("g.main").attr("transform", event.transform);
      });

    zoomBehaviorRef.current = zoom;

    svg.call(zoom);
    svg.append("g").attr("class", "main");

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
  }, [stageView]);

  useEffect(() => {
    if (stageView !== "graph") return;
    if (!d3SvgRef.current || !containerRef.current || agentIds.length === 0) return;

    const svg = d3SvgRef.current;
    const main = svg.select("g.main");
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const tooltipCoords = (event: MouseEvent | PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const x = Math.max(16, Math.min(width - 220, event.clientX - (rect?.left || 0) + 12));
      const y = Math.max(16, Math.min(height - 180, event.clientY - (rect?.top || 0) + 12));
      return { x, y };
    };

    main.selectAll("*").remove();

    const nodes = agentIds.map((id) => ({ id, name: id, profile: profileMap[id] }));
    const links = edges.map((edge) => ({ source: edge.source, target: edge.target }));

    const simulation = d3Force
      .forceSimulation(nodes as never[])
      .force("link", d3Force.forceLink(links).id((item: any) => item.id).distance(125))
      .force("charge", d3Force.forceManyBody().strength(-340))
      .force("center", d3Force.forceCenter(0, 0))
      .force("collide", d3Force.forceCollide(38));

    const link = main
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.4)
      .attr("stroke-opacity", 0.55);

    const node = main
      .append("g")
      .attr("class", "nodes")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node cursor-pointer")
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (event, current) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            current.fx = current.x;
            current.fy = current.y;
          })
          .on("drag", (event, current) => {
            current.fx = event.x;
            current.fy = event.y;
          })
          .on("end", (event, current) => {
            if (!event.active) simulation.alphaTarget(0);
            current.fx = null;
            current.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", 19)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .on("mouseenter", function (event, current: any) {
        d3.select(this).attr("fill", "#e2e8f0");
        setHoverInfo({ name: current.name, profile: current.profile, ...tooltipCoords(event) });
      })
      .on("mousemove", (event) => {
        setHoverInfo((prev) => (prev ? { ...prev, ...tooltipCoords(event) } : null));
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", "#f8fafc");
        setHoverInfo(null);
      });

    node
      .append("text")
      .attr("dy", 35)
      .attr("text-anchor", "middle")
      .text((current) => current.name)
      .attr("class", "pointer-events-none select-none fill-slate-700 text-[10px] font-medium");

    simulation.on("tick", () => {
      link
        .attr("x1", (item: any) => item.source.x)
        .attr("y1", (item: any) => item.source.y)
        .attr("x2", (item: any) => item.target.x)
        .attr("y2", (item: any) => item.target.y);

      node.attr("transform", (current: any) => `translate(${current.x},${current.y})`);
    });

    return () => simulation.stop();
  }, [agentIds, edges, profileMap, stageView]);

  const addLink = () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;

    const next: Record<string, string[]> = {};
    agentIds.forEach((id) => {
      next[id] = [...(socialNetwork[id] || [])];
    });
    next[linkFrom] = [...(next[linkFrom] || []), linkTo];
    next[linkTo] = [...(next[linkTo] || []), linkFrom];
    setSocialNetwork(next);
  };

  const removeLink = (key: string) => {
    const [left, right] = key.split("|");
    const next: Record<string, string[]> = {};
    agentIds.forEach((id) => {
      next[id] = (socialNetwork[id] || []).filter(
        (target) => ![left, right].includes(target) || ![left, right].includes(id)
      );
    });
    next[left] = (next[left] || []).filter((target) => target !== right);
    next[right] = (next[right] || []).filter((target) => target !== left);
    setSocialNetwork(next);
  };

  const handleZoomIn = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current) {
      d3SvgRef.current.transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.85);
    }
  };

  const handleResetZoom = () => {
    if (d3SvgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      d3SvgRef.current
        .transition()
        .duration(400)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(width / 2, height / 2));
    }
  };

  if (agentIds.length === 0) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="section-title">{t("experimentBuilder.step5.noAgentsConfigured")}</div>
        <p className="lab-meta mt-3">{t("experimentBuilder.step5.goBackToStep4")}</p>
      </div>
    );
  }

  return (
    <div className="ss-network-workflow">
      <ResearchInputPanel
        eyebrow={t("common.agents")}
        title={t("experimentBuilder.step5.networkPresets")}
        description={t("components.networkEditorModal.workspaceSubtitle")}
      >
        <div className="ss-workflow-summary-grid">
          <SummaryInfoCard
            label={t("experimentBuilder.step5.summaryAgents")}
            value={agentIds.length}
          />
          <SummaryInfoCard
            label={t("experimentBuilder.step5.summaryEdges")}
            value={networkOverview.edgeCount}
          />
          <SummaryInfoCard
            label={t("components.networkEditorModal.density")}
            value={`${(networkOverview.density * 100).toFixed(0)}%`}
          />
          <SummaryInfoCard
            label={t("experimentBuilder.step5.summaryPattern")}
            value={
              selectedPreset
                ? t(`experimentBuilder.step5.presets.${presetIcons[selectedPreset].translationKey}.name`)
                : t("experimentBuilder.step5.noPattern")
            }
          />
        </div>
      </ResearchInputPanel>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="lab-surface lab-scroll max-h-[720px] overflow-y-auto p-5">
          <div className="space-y-4">
            <div>
              <div className="kicker">{t("experimentBuilder.step5.networkPresets")}</div>
              <p className="lab-meta mt-2">{t("experimentBuilder.step5.chooseTopology")}</p>
            </div>

            <div className="space-y-2">
              {Object.entries(presetIcons).map(([key, { icon: Icon, translationKey }]) => {
                const isSelected = selectedPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(isSelected ? null : (key as PresetType));
                      if (!isSelected) applyPreset(key as PresetType);
                    }}
                    className={`flex w-full items-center gap-3 rounded-[22px] border p-3 text-left transition-all ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`rounded-full p-2 ${
                        isSelected ? "bg-white/12 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {t(`experimentBuilder.step5.presets.${translationKey}.name`)}
                      </span>
                      <span className={`mt-1 block text-xs ${isSelected ? "text-white/72" : "text-slate-500"}`}>
                        {t(`experimentBuilder.step5.presets.${translationKey}.description`)}
                      </span>
                    </span>
                    <ChevronRight size={15} className={isSelected ? "text-white/80" : "text-slate-400"} />
                  </button>
                );
              })}
            </div>

            {selectedPreset &&
            selectedPreset !== "full" &&
            selectedPreset !== "ring" &&
            selectedPreset !== "star" ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="kicker">{t("components.networkEditorModal.selectedPreset")}</div>
                  <button
                    type="button"
                    onClick={() => resetParams(selectedPreset as keyof PresetParams)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    {t("components.networkEditorModal.resetDefaults")}
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {selectedPreset === "random" ? (
                    <ParamSlider
                      label={t("components.networkEditorModal.probabilityAnyTwoConnect")}
                      value={params.random.connectionChance}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(value) => updateParam("random", "connectionChance", value)}
                    />
                  ) : null}

                  {selectedPreset === "newman-watts" ? (
                    <>
                      <ParamSlider
                        label={t("components.networkEditorModal.neighborsEachSide")}
                        value={params["newman-watts"].neighborsEachSide}
                        min={1}
                        max={5}
                        step={1}
                        isInteger
                        onChange={(value) => updateParam("newman-watts", "neighborsEachSide", value)}
                      />
                      <ParamSlider
                        label={t("components.networkEditorModal.probabilityLongRangeShortcut")}
                        value={params["newman-watts"].shortcutChance}
                        min={0}
                        max={0.5}
                        step={0.01}
                        onChange={(value) => updateParam("newman-watts", "shortcutChance", value)}
                      />
                    </>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => selectedPreset && applyPreset(selectedPreset)}
                >
                  {t("experimentBuilder.step5.applyChanges")}
                </Button>
              </div>
            ) : null}

            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users size={14} />
                {t("experimentBuilder.step5.agentCollections", { defaultValue: "Agent collections" })}
              </div>
              <p className="lab-meta mt-2">
                {t("experimentBuilder.step5.agentCollectionsHint", {
                  defaultValue: "Show one representative per repeated category first, then open the full member list only when needed.",
                })}
              </p>
              <div className="mt-4 space-y-2">
                {agentCollections.map((collection) => (
                  <div
                    key={collection.key}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {collection.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {collection.representative.userProfile ||
                            collection.representative.rolePrompt ||
                            t("experimentBuilder.step4.noProperties")}
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {collection.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedMembers((current) => !current)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Settings2 size={14} />
                {showAdvancedMembers
                  ? t("experimentBuilder.step5.hideMemberRoster", { defaultValue: "Hide member roster" })
                  : t("experimentBuilder.step5.showMemberRoster", { defaultValue: "Show full member roster" })}
              </button>

              {showAdvancedMembers ? (
                <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {agentIds.map((id) => (
                    <div key={id} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {id}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="lab-surface relative min-h-[720px] overflow-hidden p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="kicker">{t("experimentBuilder.step5.briefingTitle")}</div>
              <div className="mt-3 section-title">{t("experimentBuilder.step5.briefingTitle")}</div>
              <p className="lab-meta mt-2 max-w-2xl">
                {t("components.networkEditorModal.manualComposer", {
                  defaultValue: "Start from the structure summary, then open the graph only when local manual edits are necessary.",
                })}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setStageView("overview")}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  stageView === "overview" ? "bg-slate-900 text-white" : "text-slate-500"
                }`}
              >
                {t("components.networkEditorModal.overviewTab", { defaultValue: "Overview" })}
              </button>
              <button
                type="button"
                onClick={() => setStageView("graph")}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  stageView === "graph" ? "bg-slate-900 text-white" : "text-slate-500"
                }`}
              >
                {t("components.networkEditorModal.graphTab", { defaultValue: "Graph canvas" })}
              </button>
            </div>
          </div>

          {stageView === "overview" ? (
            <div className="grid gap-4 pt-5 lg:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="kicker">{t("components.networkEditorModal.networkPresets")}</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("experimentBuilder.step5.summaryAgents")}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{agentIds.length}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("experimentBuilder.step5.summaryEdges")}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{networkOverview.edgeCount}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("components.networkEditorModal.density")}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {(networkOverview.density * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("components.networkEditorModal.communities", { defaultValue: "Communities" })}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {networkOverview.componentCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="kicker">
                  {t("components.networkEditorModal.topologySummary", { defaultValue: "Topology summary" })}
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {t("components.networkEditorModal.averageDegree", { defaultValue: "Average degree" })}
                    </span>
                    <strong className="text-slate-900">{networkOverview.averageDegree.toFixed(1)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {t("components.networkEditorModal.largestComponent", { defaultValue: "Largest component" })}
                    </span>
                    <strong className="text-slate-900">{networkOverview.largestComponent}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("experimentBuilder.step5.summaryIsolated")}</span>
                    <strong className="text-slate-900">{networkOverview.isolatedAgents.length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("experimentBuilder.step5.summaryPattern")}</span>
                    <strong className="text-right text-slate-900">
                      {selectedPreset
                        ? t(`experimentBuilder.step5.presets.${presetIcons[selectedPreset].translationKey}.name`)
                        : t("experimentBuilder.step5.noPattern")}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="kicker">
                  {t("experimentBuilder.step5.agentCollections", { defaultValue: "Agent collections" })}
                </div>
                <div className="mt-4 space-y-2">
                  {agentCollections.map((collection) => (
                    <div
                      key={collection.key}
                      className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{collection.title}</div>
                        <div className="text-xs text-slate-500">
                          {t("experimentBuilder.step5.collectionRepresentative", {
                            defaultValue: "Representative",
                          })}
                          : {collection.representative.label}
                        </div>
                      </div>
                      <span className="text-slate-500">
                        {collection.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="kicker">
                  {t("components.networkEditorModal.hubAgents", { defaultValue: "Key connectors" })}
                </div>
                <div className="mt-4 space-y-2">
                  {networkOverview.hubAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <span className="font-medium text-slate-900">{agent.id}</span>
                      <span className="text-slate-500">
                        {t("components.networkEditorModal.degree", { defaultValue: "Degree" })}: {agent.degree}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="kicker">{t("components.networkEditorModal.isolatedAgents")}</div>
                {groupedIsolatedAgents.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {groupedIsolatedAgents.map((group) => (
                      <span key={group.title} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                        {group.title} × {group.count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="lab-meta mt-4">
                    {t("components.networkEditorModal.noIsolatedAgents", { defaultValue: "All agents are connected to at least one peer." })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative mt-5 h-full min-h-[640px] bg-[radial-gradient(circle_at_top,_rgba(63,98,124,0.08),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.45),_rgba(248,250,252,0.85))]"
            >
              <svg ref={svgRef} className="block h-full w-full" />

              {edges.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                  <div className="max-w-md rounded-[28px] border border-slate-200 bg-white/92 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                    <div className="section-title">{t("experimentBuilder.step5.emptyCanvasTitle")}</div>
                    <p className="lab-meta mt-3">{t("experimentBuilder.step5.emptyCanvasBody")}</p>
                  </div>
                </div>
              ) : null}

              {hoverInfo ? (
                <div
                  className="absolute z-20 max-w-xs rounded-[20px] border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-lg"
                  style={{ left: hoverInfo.x, top: hoverInfo.y }}
                >
                  <div className="font-semibold">{hoverInfo.name}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-slate-500">
                    {hoverInfo.profile || t("components.agentPanel.noProfile")}
                  </div>
                </div>
              ) : null}

              <div className="absolute right-4 top-4 flex flex-col gap-1 rounded-[18px] border border-slate-200 bg-white/90 p-1">
                <button onClick={handleZoomIn} className="rounded-[14px] p-2 text-slate-600 hover:bg-slate-100">
                  <ZoomIn size={16} />
                </button>
                <button onClick={handleZoomOut} className="rounded-[14px] p-2 text-slate-600 hover:bg-slate-100">
                  <ZoomOut size={16} />
                </button>
                <button onClick={handleResetZoom} className="rounded-[14px] p-2 text-slate-600 hover:bg-slate-100">
                  <Maximize size={16} />
                </button>
              </div>

              <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-xs text-slate-600">
                <span>{t("experimentBuilder.step5.summaryAgents")}: {agentIds.length}</span>
                <span>{t("experimentBuilder.step5.summaryEdges")}: {networkOverview.edgeCount}</span>
                <span>{t("components.networkEditorModal.density")}: {(networkOverview.density * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="lab-surface p-5">
            <div className="kicker">{t("experimentBuilder.step5.briefingTitle")}</div>
            <div className="mt-3 section-title">{t("experimentBuilder.step5.briefingTitle")}</div>
            <p className="lab-meta mt-2">{t("experimentBuilder.step5.briefingDescription")}</p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("experimentBuilder.step5.summaryAgents")}</span>
                <span className="font-semibold text-slate-900">{agentIds.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("experimentBuilder.step5.summaryEdges")}</span>
                <span className="font-semibold text-slate-900">{networkOverview.edgeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("experimentBuilder.step5.summaryIsolated")}</span>
                <span className="font-semibold text-slate-900">{networkOverview.isolatedAgents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t("experimentBuilder.step5.summaryPattern")}</span>
                <span className="text-right font-semibold text-slate-900">
                  {selectedPreset
                    ? t(`experimentBuilder.step5.presets.${presetIcons[selectedPreset].translationKey}.name`)
                    : t("experimentBuilder.step5.noPattern")}
                </span>
              </div>
            </div>
          </div>

          <div className="lab-surface p-5">
            <div className="kicker">
              {t("experimentBuilder.step5.groupedConnections", { defaultValue: "Grouped connections" })}
            </div>
            <div className="mt-4 space-y-2">
              {groupedEdges.length > 0 ? (
                groupedEdges.map((group) => (
                  <div key={group.key} className="lab-inset p-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium text-slate-900">
                        {group.sourceTitle} ↔ {group.targetTitle}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        × {group.count}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {group.sample.join(" · ")}
                    </div>
                  </div>
                ))
              ) : (
                <p className="lab-meta">{t("experimentBuilder.step5.noLinks")}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedLinks((current) => !current)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <Settings2 size={14} />
              {showAdvancedLinks
                ? t("experimentBuilder.step5.hideAdvancedLinks", { defaultValue: "Hide advanced member links" })
                : t("experimentBuilder.step5.showAdvancedLinks", { defaultValue: "Show advanced member links" })}
            </button>

            {showAdvancedLinks ? (
              <div className="mt-4 space-y-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <select value={linkFrom} onChange={(event) => setLinkFrom(event.target.value)}>
                    {agentIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                  <select value={linkTo} onChange={(event) => setLinkTo(event.target.value)}>
                    {agentIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!linkFrom || !linkTo || linkFrom === linkTo}
                    onClick={addLink}
                  >
                    {t("experimentBuilder.step5.addLink")}
                  </Button>
                </div>

                <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                  {edges.map((edge) => (
                    <div key={edge.key} className="lab-inset flex items-center justify-between gap-3 p-3 text-sm text-slate-700">
                      <span className="truncate">
                        {edge.source} ↔ {edge.target}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLink(edge.key)}
                        className="text-xs text-rose-600 hover:text-rose-800"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {groupedIsolatedAgents.length > 0 ? (
              <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-medium">{t("components.networkEditorModal.isolatedAgents")}</div>
                <div className="mt-2 space-y-1 text-xs leading-6">
                  {groupedIsolatedAgents.map((group) => (
                    <div key={group.title}>
                      {group.title} × {group.count}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Step5Network;
