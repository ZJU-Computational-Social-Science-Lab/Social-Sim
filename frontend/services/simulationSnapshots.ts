import type { Agent, SimNode, SocialNetwork } from "../types";

type RawAgentLike = Record<string, any>;
type RawAgentCollection = RawAgentLike[] | Record<string, RawAgentLike> | null | undefined;
type RawSnapshotLike = {
  nodes?: Array<Record<string, any>>;
  agents?: RawAgentCollection;
};

const DEFAULT_LLM_CONFIG = { provider: "mock", model: "default" };

const buildAvatarUrl = (seed: string): string =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const mapMemoryType = (role: unknown): "dialogue" | "observation" =>
  String(role ?? "") === "assistant" || String(role ?? "") === "user"
    ? "dialogue"
    : "observation";

const mapAgent = (
  raw: RawAgentLike,
  idx: number,
  turn: number,
  fallbackName?: string,
  existingAgent?: Agent,
): Agent => {
  const name = raw.name || fallbackName || `Agent ${idx + 1}`;
  const fallbackRole = raw.properties && (raw.properties.role || raw.properties.title || raw.properties.position);
  const fallbackProfile =
    raw.profile ||
    raw.user_profile ||
    raw.userProfile ||
    (raw.properties && (raw.properties.profile || raw.properties.description)) ||
    existingAgent?.profile ||
    "";

  return {
    id: existingAgent?.id || `a-${idx}-${name}`,
    name,
    role: raw.role || fallbackRole || "",
    avatarUrl: existingAgent?.avatarUrl || buildAvatarUrl(String(name)),
    profile: fallbackProfile,
    llmConfig: raw.llmConfig || existingAgent?.llmConfig || DEFAULT_LLM_CONFIG,
    properties: raw.properties || existingAgent?.properties || {},
    history: existingAgent?.history || {},
    memory: (raw.short_memory || raw.memory || []).map((item: RawAgentLike, memoryIdx: number) => ({
      id: `m-${idx}-${memoryIdx}`,
      round: turn,
      content: String(item.content ?? ""),
      type: mapMemoryType(item.role),
      timestamp: new Date().toISOString(),
    })),
    knowledgeBase: raw.knowledgeBase || raw.knowledge_base || existingAgent?.knowledgeBase || [],
  };
};

export const mapBackendAgents = (
  rawAgents: RawAgentCollection,
  turn: number,
  existingAgents?: Agent[],
): Agent[] => {
  if (Array.isArray(rawAgents)) {
    return rawAgents.map((agent, idx) => {
      const existingAgent = existingAgents?.find((entry) => entry.name === agent?.name);
      return mapAgent(agent, idx, turn, undefined, existingAgent);
    });
  }
  if (rawAgents && typeof rawAgents === "object") {
    return Object.entries(rawAgents).map(([name, agent], idx) =>
      mapAgent(
        agent || {},
        idx,
        turn,
        name,
        existingAgents?.find((entry) => entry.name === name),
      ),
    );
  }
  return [];
};

export const mapSerializedNodes = (
  nodesRaw: Array<Record<string, any>>,
  getNodeName: (id: number | string) => string,
): SimNode[] => {
  const maxDepth = nodesRaw.reduce((currentMax, node) => {
    const depth = Number(node?.depth ?? 0) || 0;
    return Math.max(currentMax, depth);
  }, 0);
  const nowIso = new Date().toISOString();
  const localeTime = new Date().toLocaleTimeString();

  return nodesRaw.map((node) => ({
    id: String(node.id),
    display_id: String(node.id),
    parentId: node.parent == null ? null : String(node.parent),
    name: getNodeName(node.id),
    depth: node.depth,
    isLeaf: (Number(node.depth ?? 0) || 0) === maxDepth,
    status: "completed",
    timestamp: localeTime,
    worldTime: nowIso,
    meta: node.meta || {},
  }));
};

export const buildSerializedSnapshot = (
  snapshot: RawSnapshotLike | null | undefined,
  getNodeName: (id: number | string) => string,
): {
  nodes: SimNode[];
  selectedNodeId: string | null;
  agents: Agent[];
  turn: number;
} => {
  const nodesRaw = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  const nodes = mapSerializedNodes(nodesRaw, getNodeName);
  const selectedNodeId = nodes[0]?.id ?? null;
  const selectedNode =
    nodesRaw.find((node) => String(node.id) === selectedNodeId) || nodesRaw[0] || null;
  const simSnapshot = selectedNode?.sim || {};
  const turn = Number(simSnapshot?.turns ?? 0) || 0;
  const rawAgents = simSnapshot?.agents || snapshot?.agents || [];

  return {
    nodes,
    selectedNodeId,
    agents: mapBackendAgents(rawAgents, turn),
    turn,
  };
};

export const withSimulationSocialNetwork = <T extends Record<string, any>>(
  sim: T,
  fallback?: SocialNetwork,
): T & { socialNetwork: SocialNetwork } => {
  const socialNetwork =
    fallback ||
    sim.socialNetwork ||
    sim.scene_config?.social_network ||
    {};
  return {
    ...sim,
    socialNetwork,
  };
};