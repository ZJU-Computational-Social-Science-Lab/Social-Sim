import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import * as d3Force from "d3-force";
import {
  Grid3X3,
  Layers,
  Maximize,
  RefreshCw,
  Search,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { buildAgentCollections } from "../../utils/agentCollections";
import { buildNetworkOverview } from "../../utils/networkMetrics";
import { Button } from "../ui/button";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";

type NetworkPresetType =
  | "full"
  | "random"
  | "ring"
  | "star"
  | "newman-watts"
  | "core-periphery"
  | "holme-kim"
  | "waxman"
  | "sbm";

type PresetType = NetworkPresetType | "custom";
type StepFiveDetailSurface = "overview" | "memberConnections" | null;

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

const presetIcons: Record<
  PresetType,
  { icon: React.ElementType; translationKey: string; defaultLabel: string }
> = {
  full: { icon: Share2, translationKey: "fully_connected", defaultLabel: "Fully connected" },
  random: { icon: Shuffle, translationKey: "random", defaultLabel: "Random" },
  ring: { icon: RefreshCw, translationKey: "ring", defaultLabel: "Ring" },
  star: { icon: Users, translationKey: "star", defaultLabel: "Star" },
  "newman-watts": { icon: Grid3X3, translationKey: "small_world", defaultLabel: "Small world" },
  "core-periphery": {
    icon: Layers,
    translationKey: "core_periphery",
    defaultLabel: "Core-periphery",
  },
  "holme-kim": { icon: Share2, translationKey: "scale_free", defaultLabel: "Scale free" },
  waxman: { icon: Grid3X3, translationKey: "spatial", defaultLabel: "Spatial" },
  sbm: { icon: Users, translationKey: "communities", defaultLabel: "Communities" },
  custom: { icon: SlidersHorizontal, translationKey: "custom_structure", defaultLabel: "Custom" },
};

const visiblePresets: PresetType[] = [
  "full",
  "random",
  "ring",
  "star",
  "newman-watts",
  "core-periphery",
  "sbm",
  "custom",
];

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

const emitStepFiveGuide = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent("ss-step5-guide-state", { detail }));
};

const focusStepFiveElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.classList.remove("is-guided");
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  window.requestAnimationFrame(() => {
    element.classList.add("is-guided");
    window.setTimeout(() => element.classList.remove("is-guided"), 1800);
  });
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
  <div className="ss-structure-workflow__slider">
    <div className="ss-structure-workflow__slider-head">
      <span>{label}</span>
      <strong>{isInteger ? value : value.toFixed(2)}</strong>
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
      className="ss-structure-workflow__slider-input"
    />
  </div>
);

export const Step5Network: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const { socialNetwork, setSocialNetwork, agentTypes } = useExperimentBuilder();
  const [linkFrom, setLinkFrom] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);
  const [params, setParams] = useState<PresetParams>(JSON.parse(JSON.stringify(defaultParams)));
  const [searchQuery, setSearchQuery] = useState("");
  const [hoverInfo, setHoverInfo] = useState<{ name: string; profile?: string; x: number; y: number } | null>(null);
  const [detailSurface, setDetailSurface] = useState<StepFiveDetailSurface>(null);
  const [showGraphDrawer, setShowGraphDrawer] = useState(false);

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

  const agentCollections = useMemo(() => buildAgentCollections(agentTypes, () => ""), [agentTypes]);
  const agentCollectionLookup = useMemo(() => {
    const lookup = new globalThis.Map<string, (typeof agentCollections)[number]>();
    agentCollections.forEach((collection) => {
      collection.members.forEach((member) => lookup.set(member.label, collection));
    });
    return lookup;
  }, [agentCollections]);

  useEffect(() => {
    if (agentIds.length === 0) return;
    if (!agentIds.includes(linkFrom)) setLinkFrom(agentIds[0]);
    if (!agentIds.includes(linkTo)) setLinkTo(agentIds[Math.min(1, agentIds.length - 1)]);
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
      { key: string; sourceTitle: string; targetTitle: string; count: number; sample: string[] }
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
        if (current.sample.length < 3) current.sample.push(`${edge.source} ↔ ${edge.target}`);
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
    const grouped = new globalThis.Map<string, { title: string; count: number }>();
    networkOverview.isolatedAgents.forEach((agentId) => {
      const collection = agentCollectionLookup.get(agentId);
      const title = collection?.title || agentId;
      const current = grouped.get(title);
      if (current) {
        current.count += 1;
        return;
      }
      grouped.set(title, { title, count: 1 });
    });
    return Array.from(grouped.values()).sort(
      (left, right) =>
        right.count - left.count ||
        left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    );
  }, [agentCollectionLookup, networkOverview.isolatedAgents]);

  const presetMeta = useMemo<Record<PresetType, { tags: string[]; summary: string }>>(
    () => ({
      full: {
        tags: isZh ? ["高密度", "充分接触"] : ["Dense", "High contact"],
        summary: isZh ? "每个参与者都与其他人相连。" : "Each participant connects to every other participant.",
      },
      random: {
        tags: isZh ? ["随机连接", "探索型"] : ["Random links", "Exploratory"],
        summary: isZh ? "连接以随机概率生成，适合先观察整体扩散。" : "Links are generated probabilistically, useful for broad diffusion patterns.",
      },
      ring: {
        tags: isZh ? ["局部接触", "邻里结构"] : ["Local contact", "Neighborhood"],
        summary: isZh ? "每个参与者只与邻近个体相连。" : "Each participant is connected to its local neighbors.",
      },
      star: {
        tags: isZh ? ["中心节点", "单枢纽"] : ["Hub-led", "Central node"],
        summary: isZh ? "互动集中在一个中心节点周围。" : "Interactions are organized around one central hub.",
      },
      "newman-watts": {
        tags: isZh ? ["小世界", "局部 + 捷径"] : ["Small world", "Local + shortcuts"],
        summary: isZh ? "局部连接为主，同时保留少量跨区捷径。" : "Mostly local links, with a small number of long-range shortcuts.",
      },
      "core-periphery": {
        tags: isZh ? ["核心-边缘", "不对称接触"] : ["Core-periphery", "Asymmetric"],
        summary: isZh ? "少量核心成员高频互联，外围成员连接较少。" : "A small core stays highly connected while the periphery remains sparse.",
      },
      "holme-kim": {
        tags: isZh ? ["尺度自由", "高聚类"] : ["Scale free", "Clustered"],
        summary: isZh ? "连接倾向向已有高连接节点聚集。" : "Connections tend to accumulate around already well-connected nodes.",
      },
      waxman: {
        tags: isZh ? ["空间距离", "邻近优先"] : ["Spatial", "Distance-based"],
        summary: isZh ? "距离越近，建立连接的概率越高。" : "Closer nodes are more likely to connect.",
      },
      sbm: {
        tags: isZh ? ["社区结构", "分组接触"] : ["Communities", "Clustered groups"],
        summary: isZh ? "参与者先在群组内连接，再通过少量桥接互动。" : "Participants connect within groups first, with a few bridge ties between them.",
      },
      custom: {
        tags: isZh ? ["自定义", "按需细调"] : ["Custom", "Manual tuning"],
        summary: isZh
          ? "从空白结构开始，自行调整局部连接与成员关系。"
          : "Start from a blank structure and tune the ties manually.",
      },
    }),
    [isZh]
  );

  const filteredPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visiblePresets.filter((preset) => {
      if (!query) return true;
      const name = t(`experimentBuilder.step5.presets.${presetIcons[preset].translationKey}.name`, {
        defaultValue: preset,
      }).toLowerCase();
      const description = t(
        `experimentBuilder.step5.presets.${presetIcons[preset].translationKey}.description`,
        { defaultValue: presetMeta[preset].summary }
      ).toLowerCase();
      const tags = presetMeta[preset].tags.join(" ").toLowerCase();
      return `${name} ${description} ${tags}`.includes(query);
    });
  }, [presetMeta, searchQuery, t]);

  const currentPatternLabel = selectedPreset
    ? t(`experimentBuilder.step5.presets.${presetIcons[selectedPreset].translationKey}.name`, {
        defaultValue: isZh ? "自定义结构" : presetIcons[selectedPreset].defaultLabel,
      })
    : edges.length > 0
      ? isZh
        ? "已配置结构"
        : "Configured structure"
      : t("experimentBuilder.step5.noPattern");

  const selectedPresetSummary = selectedPreset ? presetMeta[selectedPreset].summary : null;
  const selectedPresetTags = selectedPreset ? presetMeta[selectedPreset].tags : [];
  const hasPresetControls =
    selectedPreset === "random" ||
    selectedPreset === "newman-watts" ||
    selectedPreset === "core-periphery" ||
    selectedPreset === "sbm";

  const hasSelectedStructure = selectedPreset !== null || edges.length > 0;
  const miniPreview = useMemo(() => {
    const previewWidth = 232;
    const previewHeight = 158;
    const visibleIds = agentIds.slice(0, Math.min(agentIds.length, 10));
    const radius = Math.min(54, 18 + visibleIds.length * 3.5);
    const nodes = visibleIds.map((id, index) => {
      const angle = (index / Math.max(visibleIds.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        id,
        x: previewWidth / 2 + Math.cos(angle) * radius,
        y: previewHeight / 2 + Math.sin(angle) * radius,
      };
    });
    const visibleEdges = edges
      .filter((edge) => visibleIds.includes(edge.source) && visibleIds.includes(edge.target))
      .slice(0, 24)
      .map((edge) => ({
        ...edge,
        sourceNode: nodes.find((node) => node.id === edge.source)!,
        targetNode: nodes.find((node) => node.id === edge.target)!,
      }));

    return {
      width: previewWidth,
      height: previewHeight,
      nodes,
      edges: visibleEdges,
      remaining: Math.max(0, agentIds.length - visibleIds.length),
    };
  }, [agentIds, edges]);

  const closeDetailSurface = useCallback(() => {
    setDetailSurface(null);
  }, []);

  const openDetailSurface = useCallback((target: Exclude<StepFiveDetailSurface, null>) => {
    setShowGraphDrawer(false);
    setDetailSurface(target);
    emitStepFiveGuide({ type: "advanced-opened", target });
  }, []);

  const openGraphDrawer = useCallback(() => {
    setDetailSurface(null);
    setShowGraphDrawer(true);
    emitStepFiveGuide({ type: "advanced-opened", target: "graph" });
  }, []);

  const closeGraphDrawer = useCallback(() => {
    setShowGraphDrawer(false);
    setHoverInfo(null);
  }, []);

  const resetParams = useCallback((presetKey: keyof PresetParams) => {
    setParams((prev) => ({ ...prev, [presetKey]: { ...defaultParams[presetKey] } }));
  }, []);

  const updateParam = useCallback(
    <K extends keyof PresetParams, P extends keyof PresetParams[K]>(
      preset: K,
      param: P,
      value: PresetParams[K][P]
    ) => {
      setParams((prev) => ({ ...prev, [preset]: { ...prev[preset], [param]: value } }));
      emitStepFiveGuide({ type: "interaction" });
    },
    []
  );

  const applyPreset = useCallback(
    (type: PresetType) => {
      const next: Record<string, string[]> = {};
      const n = agentIds.length;
      agentIds.forEach((id) => {
        next[id] = [];
      });
      if (type === "custom") {
        setSelectedPreset(type);
        setSocialNetwork(next);
        emitStepFiveGuide({ type: "template-selected", preset: type });
        openDetailSurface("memberConnections");
        return;
      }
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
      if (type === "core-periphery") {
        const { influencerPercent, influencerConnectivity, influencerReach, regularConnectivity } =
          params["core-periphery"];
        const coreCount = Math.max(1, Math.round(n * influencerPercent));
        const coreIds = agentIds.slice(0, coreCount);
        const peripheralIds = agentIds.slice(coreCount);
        coreIds.forEach((source, index) => {
          for (let targetIndex = index + 1; targetIndex < coreIds.length; targetIndex += 1) {
            const target = coreIds[targetIndex];
            if (Math.random() <= influencerConnectivity) {
              next[source].push(target);
              next[target].push(source);
            }
          }
        });
        peripheralIds.forEach((source, index) => {
          for (let targetIndex = index + 1; targetIndex < peripheralIds.length; targetIndex += 1) {
            const target = peripheralIds[targetIndex];
            if (Math.random() <= regularConnectivity) {
              next[source].push(target);
              next[target].push(source);
            }
          }
          coreIds.forEach((coreId) => {
            if (Math.random() <= influencerReach) {
              next[source].push(coreId);
              next[coreId].push(source);
            }
          });
        });
      }
      if (type === "sbm") {
        const { groupSize, withinGroupConnectivity, bridgeConnections } = params.sbm;
        const groups: string[][] = [];
        for (let index = 0; index < agentIds.length; index += groupSize) {
          groups.push(agentIds.slice(index, index + groupSize));
        }
        groups.forEach((group) => {
          for (let i = 0; i < group.length; i += 1) {
            for (let j = i + 1; j < group.length; j += 1) {
              if (Math.random() <= withinGroupConnectivity) {
                next[group[i]].push(group[j]);
                next[group[j]].push(group[i]);
              }
            }
          }
        });
        for (let groupIndex = 0; groupIndex < groups.length - 1; groupIndex += 1) {
          const currentGroup = groups[groupIndex];
          const nextGroup = groups[groupIndex + 1];
          for (let linkIndex = 0; linkIndex < bridgeConnections; linkIndex += 1) {
            const source = currentGroup[linkIndex % currentGroup.length];
            const target = nextGroup[linkIndex % nextGroup.length];
            if (!next[source].includes(target)) {
              next[source].push(target);
              next[target].push(source);
            }
          }
        }
      }
      setSelectedPreset(type);
      setSocialNetwork(ensureNoIsolatedNodes(next, agentIds));
      emitStepFiveGuide({ type: "template-selected", preset: type });
    },
    [agentIds, params, setSocialNetwork]
  );

  const fitGraphToViewport = useCallback(
    (duration = 0) => {
      if (!d3SvgRef.current || !zoomBehaviorRef.current || !containerRef.current) {
        return;
      }
      const svg = d3SvgRef.current;
      const mainNode = svg.select("g.main").node() as SVGGElement | null;
      if (!mainNode) {
        return;
      }

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const bbox = mainNode.getBBox();

      if (bbox.width === 0 || bbox.height === 0) {
        const centered = d3.zoomIdentity.translate(width / 2, height / 2).scale(1);
        if (duration > 0) {
          svg.transition().duration(duration).call(zoomBehaviorRef.current.transform, centered);
          return;
        }
        svg.call(zoomBehaviorRef.current.transform, centered);
        return;
      }

      const padding = Math.max(32, Math.min(72, Math.min(width, height) * 0.12));
      const scale = Math.max(
        0.45,
        Math.min(
          1.35,
          Math.min((width - padding * 2) / bbox.width, (height - padding * 2) / bbox.height)
        )
      );
      const transform = d3.zoomIdentity
        .translate(
          width / 2 - scale * (bbox.x + bbox.width / 2),
          height / 2 - scale * (bbox.y + bbox.height / 2)
        )
        .scale(scale);

      if (duration > 0) {
        svg.transition().duration(duration).call(zoomBehaviorRef.current.transform, transform);
        return;
      }
      svg.call(zoomBehaviorRef.current.transform, transform);
    },
    []
  );

  useEffect(() => {
    if (!showGraphDrawer) {
      return;
    }
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    d3SvgRef.current = svg;
    svg.selectAll("*").remove();
    svg.append("g").attr("class", "main");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 4])
      .on("zoom", (event) => {
        svg.select("g.main").attr("transform", event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
  }, [showGraphDrawer]);

  useEffect(() => {
    if (!showGraphDrawer || !d3SvgRef.current || !containerRef.current || agentIds.length === 0) {
      return;
    }

    const svg = d3SvgRef.current;
    const main = svg.select("g.main");
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const tooltipCoords = (event: MouseEvent | PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const x = Math.max(16, Math.min(width - 240, event.clientX - (rect?.left || 0) + 16));
      const y = Math.max(16, Math.min(height - 180, event.clientY - (rect?.top || 0) + 16));
      return { x, y };
    };

    main.selectAll("*").remove();

    const nodes = agentIds.map((id, index) => {
      const angle = (index / Math.max(agentIds.length, 1)) * Math.PI * 2;
      const radius = Math.max(72, Math.min(220, 28 * agentIds.length));
      return {
        id,
        name: id,
        profile: profileMap[id],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });

    const links = edges.map((edge) => ({ source: edge.source, target: edge.target }));

    if (links.length > 0) {
      const simulation = d3Force
        .forceSimulation(nodes as never[])
        .force("link", d3Force.forceLink(links).id((item: any) => item.id).distance(122))
        .force("charge", d3Force.forceManyBody().strength(-300))
        .force("center", d3Force.forceCenter(0, 0))
        .force("collide", d3Force.forceCollide(36))
        .stop();

      for (let step = 0; step < 220; step += 1) {
        simulation.tick();
      }
    }

    main
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(143, 193, 177, 0.46)")
      .attr("stroke-width", 1.35)
      .attr("x1", (item: any) => item.source.x)
      .attr("y1", (item: any) => item.source.y)
      .attr("x2", (item: any) => item.target.x)
      .attr("y2", (item: any) => item.target.y);

    const node = main
      .append("g")
      .attr("class", "nodes")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node cursor-pointer")
      .attr("transform", (current: any) => `translate(${current.x},${current.y})`);

    node
      .append("circle")
      .attr("r", 18)
      .attr("fill", "rgba(17, 55, 47, 0.96)")
      .attr("stroke", "#5df2bf")
      .attr("stroke-width", 1.25)
      .on("mouseenter", function (event, current: any) {
        d3.select(this).attr("fill", "rgba(24, 74, 62, 0.98)");
        setHoverInfo({ name: current.name, profile: current.profile, ...tooltipCoords(event) });
      })
      .on("mousemove", (event) => {
        setHoverInfo((prev) => (prev ? { ...prev, ...tooltipCoords(event) } : null));
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", "rgba(17, 55, 47, 0.96)");
        setHoverInfo(null);
      });

    node
      .append("text")
      .attr("dy", 33)
      .attr("text-anchor", "middle")
      .text((current) => current.name)
      .attr("fill", "#b8d1c7")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("pointer-events", "none");

    fitGraphToViewport();
  }, [agentIds, edges, fitGraphToViewport, profileMap, showGraphDrawer]);

  useEffect(() => {
    if (!showGraphDrawer || !containerRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      fitGraphToViewport();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitGraphToViewport, showGraphDrawer]);

  useEffect(() => {
    const handleGuideFocus = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ target?: string }>;
      const target = event.detail?.target;
      if (target === "templates") focusStepFiveElement("ss-step5-template-library");
      if (target === "summary") focusStepFiveElement("ss-step5-selection-summary");
      if (target === "details") {
        openDetailSurface("overview");
        window.setTimeout(() => focusStepFiveElement("ss-step5-detailed-summary"), 120);
      }
      if (target === "graph") {
        openGraphDrawer();
        window.setTimeout(() => focusStepFiveElement("ss-step5-graph-canvas"), 120);
      }
      if (target === "links") {
        openDetailSurface("memberConnections");
        window.setTimeout(() => focusStepFiveElement("ss-step5-advanced-links"), 120);
      }
      if (target === "roster") {
        openDetailSurface("memberConnections");
        window.setTimeout(() => focusStepFiveElement("ss-step5-member-roster"), 120);
      }
    };
    window.addEventListener("ss-step5-guide", handleGuideFocus as EventListener);
    return () => window.removeEventListener("ss-step5-guide", handleGuideFocus as EventListener);
  }, [openDetailSurface, openGraphDrawer]);

  const addLink = () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;
    const next: Record<string, string[]> = {};
    agentIds.forEach((id) => {
      next[id] = [...(socialNetwork[id] || [])];
    });
    next[linkFrom] = [...(next[linkFrom] || []), linkTo];
    next[linkTo] = [...(next[linkTo] || []), linkFrom];
    setSocialNetwork(next);
    openDetailSurface("memberConnections");
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
    openDetailSurface("memberConnections");
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
    fitGraphToViewport(320);
  };

  if (agentIds.length === 0) {
    return (
      <div className="ss-setup-scenarios__state">
        <div className="section-title">{isZh ? "请先完成参与者设置" : t("experimentBuilder.step5.noAgentsConfigured")}</div>
        <p className="lab-meta mt-3">{t("experimentBuilder.step5.goBackToStep4")}</p>
      </div>
    );
  }

  return (
    <div className="ss-network-workflow ss-structure-workflow">
      <ResearchInputPanel
        eyebrow={t("common.agents")}
        title={t("experimentBuilder.step5.templateFirstTitle", {
          defaultValue: isZh ? "选择一种关系结构" : "Choose a relationship structure",
        })}
        description={t("experimentBuilder.step5.templateFirstDescription", {
          defaultValue: isZh
            ? "先从一个常见结构开始，后面再决定是否展开更细连接设置。"
            : "Start with a familiar structure first, then decide whether you need more detailed connection settings.",
        })}
      >
        <div className="ss-structure-workflow__intro-grid">
          <div className="ss-structure-workflow__intro-copy">
            <div className="ss-workflow-kicker">{isZh ? "当前任务" : "Current task"}</div>
            <p className="lab-meta">
              {isZh
                ? "默认先选一个结构模板，再按需打开 graph、成员与高级连接。"
                : "Choose a template first, then open the graph, roster, and advanced links only when you need them."}
            </p>
          </div>
          <div className="ss-workflow-summary-grid">
            <SummaryInfoCard label={t("experimentBuilder.step5.summaryAgents")} value={agentIds.length} />
            <SummaryInfoCard label={t("experimentBuilder.step5.summaryPattern")} value={currentPatternLabel} />
          </div>
        </div>
      </ResearchInputPanel>

      <div className="ss-structure-workflow__layout">
        <section className="ss-workflow-panel ss-guide-focus-target" id="ss-step5-template-library">
          <div className="ss-workflow-panel__head">
            <div>
              <div className="ss-workflow-kicker">{t("experimentBuilder.step5.networkPresets")}</div>
              <h2 className="ss-workflow-panel__title">
                {isZh ? "选择一个起始情境结构" : "Choose a starting structure"}
              </h2>
              <p className="ss-workflow-panel__copy">
                {isZh
                  ? "从一个已有连接方式出发，快速决定参与者如何彼此接触。"
                  : "Start from a familiar topology and decide how participants can reach one another."}
              </p>
            </div>
          </div>

          <div className="ss-structure-workflow__search">
            <Search size={16} />
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                emitStepFiveGuide({ type: "interaction" });
              }}
              placeholder={isZh ? "搜索关系结构模板" : "Search structure templates"}
            />
          </div>

          <div className="ss-structure-workflow__template-scroll">
            <div className="ss-structure-workflow__template-grid">
              {filteredPresets.map((preset) => {
                const isSelected = selectedPreset === preset;
                const { icon: Icon, translationKey, defaultLabel } = presetIcons[preset];

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`ss-structure-workflow__template-card${isSelected ? " is-selected" : ""}`}
                  >
                    <div className="ss-structure-workflow__template-head">
                      <span className="ss-structure-workflow__template-icon">
                        <Icon size={16} />
                      </span>
                      {isSelected ? (
                        <span className="ss-structure-workflow__template-state">{isZh ? "已选" : "Selected"}</span>
                      ) : null}
                    </div>
                    <div className="ss-structure-workflow__template-title">
                      {t(`experimentBuilder.step5.presets.${translationKey}.name`, {
                        defaultValue: isZh && preset === "custom" ? "自定义结构" : defaultLabel,
                      })}
                    </div>
                    <p className="ss-structure-workflow__template-copy">{presetMeta[preset].summary}</p>
                    <div className="ss-structure-workflow__template-tags">
                      {presetMeta[preset].tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="ss-workflow-panel ss-guide-focus-target ss-structure-workflow__summary-panel"
          id="ss-step5-selection-summary"
        >
          {hasSelectedStructure ? (
            <>
              <div className="ss-workflow-panel__head">
                <div>
                  <div className="ss-workflow-kicker">{t("experimentBuilder.step5.summaryPattern")}</div>
                  <h2 className="ss-workflow-panel__title">{currentPatternLabel}</h2>
                  <p className="ss-workflow-panel__copy">
                    {selectedPresetSummary ||
                      (isZh
                        ? "当前结构已经配置完成，可以先查看摘要，再决定是否展开更细设置。"
                        : "The structure is configured. Review the summary first and open the details only when you need them.")}
                  </p>
                </div>
                {selectedPresetTags.length > 0 ? (
                  <div className="ss-structure-workflow__summary-tags">
                    {selectedPresetTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="ss-workflow-summary-grid">
                <SummaryInfoCard label={isZh ? "当前模型" : "Current model"} value={currentPatternLabel} />
                <SummaryInfoCard label={isZh ? "角色数" : "Participants"} value={agentIds.length} />
                <SummaryInfoCard label={isZh ? "连线数" : "Links"} value={networkOverview.edgeCount} />
                <SummaryInfoCard label={t("components.networkEditorModal.density")} value={`${(networkOverview.density * 100).toFixed(0)}%`} />
              </div>

              <div className="ss-structure-workflow__preview-card">
                <div className="ss-structure-workflow__preview-copy">
                  <strong>{isZh ? "网络概览缩略图" : "Network overview preview"}</strong>
                  <span>
                    {isZh
                      ? "首屏先看结构差异；完整图谱放到二级抽屉中查看。"
                      : "Use the summary first; the full graph lives in a secondary drawer."}
                  </span>
                </div>
                <div className="ss-structure-workflow__preview-graphic" aria-hidden="true">
                  <svg viewBox={`0 0 ${miniPreview.width} ${miniPreview.height}`}>
                    {miniPreview.edges.map((edge) => (
                      <line
                        key={edge.key}
                        x1={edge.sourceNode.x}
                        y1={edge.sourceNode.y}
                        x2={edge.targetNode.x}
                        y2={edge.targetNode.y}
                      />
                    ))}
                    {miniPreview.nodes.map((node) => (
                      <circle key={node.id} cx={node.x} cy={node.y} r={7} />
                    ))}
                  </svg>
                  {miniPreview.remaining > 0 ? (
                    <span className="ss-structure-workflow__preview-badge">+{miniPreview.remaining}</span>
                  ) : null}
                </div>
              </div>

              <div className="ss-structure-workflow__advanced-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openDetailSurface("overview")}
                >
                  {isZh ? "查看网络概览" : "View overview"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={openGraphDrawer}>
                  {isZh ? "打开完整图谱" : "Open full graph"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openDetailSurface("memberConnections")}
                >
                  {isZh ? "查看成员连接详情" : "View member connections"}
                </Button>
              </div>
            </>
          ) : (
            <div className="ss-structure-workflow__summary-empty">
              <div className="ss-workflow-kicker">{isZh ? "当前选择摘要" : "Current selection"}</div>
              <h2 className="ss-workflow-panel__title">
                {isZh ? "先选一个结构模板" : "Pick a structure template first"}
              </h2>
              <p className="ss-workflow-panel__copy">
                {isZh
                  ? "模板区只保留常见结构。先做结构决策，再按需查看概览和完整图谱。"
                  : "Pick a familiar topology first, then open the overview and full graph only when needed."}
              </p>
              <div className="ss-workflow-summary-grid">
                <SummaryInfoCard label={isZh ? "角色数" : "Participants"} value={agentIds.length} />
                <SummaryInfoCard label={isZh ? "连线数" : "Links"} value={networkOverview.edgeCount} />
                <SummaryInfoCard
                  label={t("components.networkEditorModal.density")}
                  value={`${(networkOverview.density * 100).toFixed(0)}%`}
                />
              </div>
            </div>
          )}
        </section>

        {detailSurface ? (
          <div className="ss-structure-workflow__drawer-backdrop" onClick={closeDetailSurface}>
            <aside
              className="ss-structure-workflow__drawer ss-structure-workflow__drawer--detail"
              onClick={(event) => event.stopPropagation()}
              aria-modal="true"
              role="dialog"
              aria-labelledby={detailSurface === "overview" ? "ss-step5-detailed-summary" : "ss-step5-advanced-links"}
            >
              <div className="ss-workflow-panel__head">
                <div>
                  <div className="ss-workflow-kicker">
                    {detailSurface === "overview"
                      ? isZh
                        ? "网络概览"
                        : "Network overview"
                      : isZh
                        ? "成员连接详情"
                        : "Member connections"}
                  </div>
                  <h2
                    className="ss-workflow-panel__title"
                    id={detailSurface === "overview" ? "ss-step5-detailed-summary" : "ss-step5-advanced-links"}
                  >
                    {detailSurface === "overview"
                      ? isZh
                        ? "先确认整体结构，再决定是否细调"
                        : "Confirm the structure before fine-tuning"
                      : isZh
                        ? "查看成员、连接与局部微调"
                        : "Inspect members, links, and local tuning"}
                  </h2>
                  <p className="ss-workflow-panel__copy">
                    {detailSurface === "overview"
                      ? isZh
                        ? "结构指标、预设参数与连接摘要集中放在这里，主页面只保留模板决策。"
                        : "Structure metrics, preset controls, and grouped links live here so the main page can stay focused."
                      : isZh
                        ? "成员清单、边明细与局部微调集中放在这里，关闭后即可返回结构摘要。"
                        : "Members, edge details, and local tuning live here, then you can return to the structure summary."}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={closeDetailSurface}>
                  {isZh ? "返回结构摘要" : "Back to summary"}
                </Button>
              </div>

              <div className="ss-structure-workflow__drawer-body">
                {detailSurface === "overview" ? (
                  <div className="ss-structure-workflow__drawer-stack">
                    <div className="ss-structure-workflow__metric-grid">
                      <SummaryInfoCard label={isZh ? "平均度" : "Average degree"} value={networkOverview.averageDegree.toFixed(1)} />
                      <SummaryInfoCard label={isZh ? "最大连通分量" : "Largest component"} value={networkOverview.largestComponent} />
                      <SummaryInfoCard label={isZh ? "群组数" : "Communities"} value={networkOverview.componentCount} />
                      <SummaryInfoCard label={t("experimentBuilder.step5.summaryIsolated")} value={networkOverview.isolatedAgents.length} />
                    </div>

                    {hasPresetControls && selectedPreset ? (
                      <div className="ss-structure-workflow__advanced-panel">
                        <div className="ss-workflow-kicker">{t("components.networkEditorModal.selectedPreset")}</div>
                        <div className="ss-structure-workflow__slider-list">
                          {selectedPreset === "random" ? <ParamSlider label={t("components.networkEditorModal.probabilityAnyTwoConnect")} value={params.random.connectionChance} min={0} max={1} step={0.05} onChange={(value) => updateParam("random", "connectionChance", value)} /> : null}
                          {selectedPreset === "newman-watts" ? (
                            <>
                              <ParamSlider label={t("components.networkEditorModal.neighborsEachSide")} value={params["newman-watts"].neighborsEachSide} min={1} max={5} step={1} isInteger onChange={(value) => updateParam("newman-watts", "neighborsEachSide", value)} />
                              <ParamSlider label={t("components.networkEditorModal.probabilityLongRangeShortcut")} value={params["newman-watts"].shortcutChance} min={0} max={0.5} step={0.01} onChange={(value) => updateParam("newman-watts", "shortcutChance", value)} />
                            </>
                          ) : null}
                          {selectedPreset === "core-periphery" ? (
                            <>
                              <ParamSlider label={isZh ? "核心成员比例" : "Core share"} value={params["core-periphery"].influencerPercent} min={0.1} max={0.5} step={0.05} onChange={(value) => updateParam("core-periphery", "influencerPercent", value)} />
                              <ParamSlider label={isZh ? "核心成员互联强度" : "Core connectivity"} value={params["core-periphery"].influencerConnectivity} min={0.2} max={1} step={0.05} onChange={(value) => updateParam("core-periphery", "influencerConnectivity", value)} />
                              <ParamSlider label={isZh ? "核心触达边缘概率" : "Core reach"} value={params["core-periphery"].influencerReach} min={0.1} max={1} step={0.05} onChange={(value) => updateParam("core-periphery", "influencerReach", value)} />
                              <ParamSlider label={isZh ? "边缘成员互联强度" : "Peripheral connectivity"} value={params["core-periphery"].regularConnectivity} min={0} max={0.6} step={0.05} onChange={(value) => updateParam("core-periphery", "regularConnectivity", value)} />
                            </>
                          ) : null}
                          {selectedPreset === "sbm" ? (
                            <>
                              <ParamSlider label={isZh ? "群组大小" : "Group size"} value={params.sbm.groupSize} min={2} max={8} step={1} isInteger onChange={(value) => updateParam("sbm", "groupSize", value)} />
                              <ParamSlider label={isZh ? "组内连接概率" : "Within-group density"} value={params.sbm.withinGroupConnectivity} min={0.2} max={1} step={0.05} onChange={(value) => updateParam("sbm", "withinGroupConnectivity", value)} />
                              <ParamSlider label={isZh ? "桥接连接数" : "Bridge links"} value={params.sbm.bridgeConnections} min={1} max={4} step={1} isInteger onChange={(value) => updateParam("sbm", "bridgeConnections", value)} />
                            </>
                          ) : null}
                        </div>
                        <div className="ss-structure-workflow__advanced-footer">
                          <Button type="button" variant="secondary" size="sm" onClick={() => resetParams(selectedPreset as keyof PresetParams)}>
                            {t("components.networkEditorModal.resetDefaults")}
                          </Button>
                          <Button type="button" size="sm" onClick={() => applyPreset(selectedPreset)}>
                            {t("experimentBuilder.step5.applyChanges")}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="ss-structure-workflow__advanced-panel">
                      <div className="ss-workflow-kicker">{isZh ? "连接摘要" : "Grouped connections"}</div>
                      {groupedEdges.length > 0 ? (
                        <div className="ss-structure-workflow__connection-list">
                          {groupedEdges.map((group) => (
                            <div key={group.key} className="ss-structure-workflow__connection-item">
                              <div>
                                <strong>{group.sourceTitle} ↔ {group.targetTitle}</strong>
                                <small>{group.sample.join(" · ")}</small>
                              </div>
                              <span>× {group.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="lab-meta">{isZh ? "当前还没有生成连接。" : "No links have been generated yet."}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ss-structure-workflow__drawer-stack">
                    <div className="ss-structure-workflow__advanced-link-grid">
                      <div className="ss-structure-workflow__advanced-panel">
                        <div className="ss-workflow-kicker">{isZh ? "局部连接微调" : "Local link tuning"}</div>
                        <div className="ss-structure-workflow__field-grid">
                          <label><span>{isZh ? "连接起点" : "From"}</span><select value={linkFrom} onChange={(event) => setLinkFrom(event.target.value)}>{agentIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
                          <label><span>{isZh ? "连接终点" : "To"}</span><select value={linkTo} onChange={(event) => setLinkTo(event.target.value)}>{agentIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
                        </div>
                        <Button size="sm" className="mt-4" disabled={!linkFrom || !linkTo || linkFrom === linkTo} onClick={addLink}>
                          {t("experimentBuilder.step5.addLink")}
                        </Button>
                      </div>
                      <div className="ss-structure-workflow__advanced-panel">
                        <div className="ss-workflow-kicker">{t("experimentBuilder.step5.summaryEdges")}</div>
                        <div className="ss-structure-workflow__edge-list">
                          {edges.map((edge) => (
                            <div key={edge.key} className="ss-structure-workflow__edge-item">
                              <span>{edge.source} ↔ {edge.target}</span>
                              <button type="button" onClick={() => removeLink(edge.key)}>
                                {isZh ? "移除" : "Remove"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ss-structure-workflow__collection-grid">
                      {agentCollections.map((collection) => (
                        <div key={collection.key} className="ss-structure-workflow__collection-card">
                          <div>
                            <strong>{collection.title}</strong>
                            <small>{collection.representative.userProfile || collection.representative.rolePrompt || t("experimentBuilder.step4.noProperties")}</small>
                          </div>
                          <span>{collection.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="ss-workflow-kicker" id="ss-step5-member-roster">
                      {isZh ? "完整成员清单" : "Full member roster"}
                    </div>
                    <div className="ss-structure-workflow__roster-grid">
                      {agentIds.map((id) => <div key={id} className="ss-structure-workflow__roster-card">{id}</div>)}
                    </div>
                    {groupedIsolatedAgents.length > 0 ? (
                      <div className="ss-structure-workflow__isolated">
                        <strong>{t("components.networkEditorModal.isolatedAgents")}</strong>
                        <div className="ss-structure-workflow__isolated-list">
                          {groupedIsolatedAgents.map((group) => <span key={group.title}>{group.title} × {group.count}</span>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : null}

        {showGraphDrawer ? (
          <div className="ss-structure-workflow__drawer-backdrop" onClick={closeGraphDrawer}>
            <aside
              className="ss-structure-workflow__drawer"
              onClick={(event) => event.stopPropagation()}
              aria-modal="true"
              role="dialog"
              aria-labelledby="ss-step5-graph-canvas"
            >
              <div className="ss-workflow-panel__head">
                <div>
                  <div className="ss-workflow-kicker">{isZh ? "完整图谱" : "Full graph"}</div>
                  <h2 className="ss-workflow-panel__title" id="ss-step5-graph-canvas">
                    {isZh ? "完整查看当前网络结构" : "Inspect the full network structure"}
                  </h2>
                  <p className="ss-workflow-panel__copy">
                    {isZh
                      ? "首次打开会自动完整适配视口；之后可继续缩放查看局部关系。"
                      : "The graph fits the full viewport on open and remains zoomable afterwards."}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={closeGraphDrawer}>
                  {isZh ? "关闭图谱" : "Close graph"}
                </Button>
              </div>

              <div className="ss-structure-workflow__drawer-toolbar">
                <div className="ss-structure-workflow__graph-meta">
                  <span>{t("experimentBuilder.step5.summaryAgents")}: {agentIds.length}</span>
                  <span>{t("experimentBuilder.step5.summaryEdges")}: {networkOverview.edgeCount}</span>
                  <span>{t("components.networkEditorModal.density")}: {(networkOverview.density * 100).toFixed(0)}%</span>
                </div>
                <div className="ss-structure-workflow__graph-tools">
                  <button type="button" onClick={handleZoomIn}><ZoomIn size={16} /></button>
                  <button type="button" onClick={handleZoomOut}><ZoomOut size={16} /></button>
                  <button type="button" onClick={handleResetZoom}><Maximize size={16} /></button>
                </div>
              </div>

              <div ref={containerRef} className="ss-structure-workflow__graph-stage">
                <svg ref={svgRef} className="block h-full w-full" />
                {hoverInfo ? (
                  <div className="ss-structure-workflow__graph-tooltip" style={{ left: hoverInfo.x, top: hoverInfo.y }}>
                    <div className="font-semibold">{hoverInfo.name}</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">{hoverInfo.profile || t("components.agentPanel.noProfile")}</div>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Step5Network;
