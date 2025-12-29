import { httpGet, httpPost, httpDelete } from "./client";

export type GraphNode = { id: number; depth: number };
export type GraphEdge = { from: number; to: number; type: string; ops?: unknown[] };

export type Graph = {
  root: number | null;
  frontier: number[];
  running?: number[];
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SimEvent = { type: string; data?: Record<string, unknown> | null; node?: number };

function toWsUrl(base: string, path: string, token?: string): string {
  const b = base.replace(/\/$/, "");
  const url = new URL(b);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const full = new URL(path.replace(/^\//, "/"), url);
  if (token) full.searchParams.set("token", token);
  return full.toString();
}

export async function getTreeGraph(base: string, id: string, token?: string): Promise<Graph | null> {
  try {
    return await httpGet<Graph>(base, `/simulations/${id}/tree/graph`, token);
  } catch (e) {
    return null;
  }
}

export function connectTreeEvents(base: string, id: string, token: string | undefined, onMessage: (event: SimEvent) => void): WebSocket {
  const ws = new WebSocket(toWsUrl(base, `/simulations/${id}/tree/events`, token));
  ws.onopen = () => ws.send("ready");
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  return ws;
}

export function connectNodeEvents(base: string, id: string, node: number, token: string | undefined, onMessage: (event: SimEvent) => void): WebSocket {
  const ws = new WebSocket(toWsUrl(base, `/simulations/${id}/tree/${node}/events`, token));
  ws.onopen = () => ws.send("ready");
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  return ws;
}

export async function treeAdvanceFrontier(base: string, id: string, turns: number, onlyMaxDepth = false, token?: string): Promise<{ children: number[] }> {
  return await httpPost<{ children: number[] }>(base, `/simulations/${id}/tree/advance_frontier`, { turns, only_max_depth: onlyMaxDepth }, token);
}

export async function treeAdvanceMulti(base: string, id: string, parent: number, turns: number, count: number, token?: string): Promise<{ children: number[] }> {
  return await httpPost<{ children: number[] }>(base, `/simulations/${id}/tree/advance_multi`, { parent, turns, count }, token);
}

export async function treeAdvanceChain(base: string, id: string, parent: number, turns: number, token?: string): Promise<{ child: number }> {
  return await httpPost<{ child: number }>(base, `/simulations/${id}/tree/advance_chain`, { parent, turns }, token);
}

export async function treeBranchPublic(base: string, id: string, parent: number, text: string, token?: string): Promise<{ child: number }> {
  return await httpPost<{ child: number }>(base, `/simulations/${id}/tree/branch`, { parent, ops: [{ op: "public_broadcast", text }] }, token);
}

export async function treeDeleteSubtree(base: string, id: string, node: number, token?: string): Promise<{ ok: boolean }> {
  return await httpDelete<{ ok: boolean }>(base, `/simulations/${id}/tree/node/${node}`, token);
}

export async function getSimEvents(base: string, id: string, node: number, token?: string): Promise<any[]> {
  return await httpGet<any[]>(base, `/simulations/${id}/tree/sim/${node}/events`, token);
}

export async function getSimState(base: string, id: string, node: number, token?: string): Promise<any> {
  return await httpGet<any>(base, `/simulations/${id}/tree/sim/${node}/state`, token);
}
