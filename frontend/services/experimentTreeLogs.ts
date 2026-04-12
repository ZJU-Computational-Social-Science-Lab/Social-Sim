import type { LogEntry } from '../types';

export interface VariantChildRef {
  node_id: number | string;
  variant_id?: unknown;
}

interface ExperimentVariantLike {
  name: string;
  ops?: any[];
}

export const getBackendEventKey = (event: any): string => {
  if (typeof event === 'string') {
    return `str:${event}`;
  }
  if (!event || typeof event !== 'object') {
    return `prim:${String(event)}`;
  }

  const eventType = event.type || event.event_type || 'unknown';
  const data = event.data || {};
  const agent = data.agent || '';

  if (eventType === 'system_broadcast') {
    const text = data.text || data.message || '';
    const sender = data.sender || '';
    const broadcastType = data.type || '';
    return `${eventType}:${broadcastType}:${sender}:${text}`;
  }

  if (eventType === 'experiment_action') {
    const round = data.round !== undefined ? String(data.round) : '';
    const action = typeof data.action === 'string' ? data.action : '';
    return `${eventType}:${agent}:${action}:round${round}`;
  }

  const content = typeof data.content === 'string' ? data.content.substring(0, 100) : '';
  const time = data.time || '';
  const action = data.action?.action || data.action?.name || '';
  return `${eventType}:${agent}:${content}:${time}:${action}`;
};

export const filterUniqueBackendEvents = (
  existingEvents: any[],
  incomingEvents: any[],
): any[] => {
  const existingKeys = new Set((existingEvents || []).map(getBackendEventKey));
  const batchKeys = new Set<string>();
  return (incomingEvents || []).filter((event) => {
    const key = getBackendEventKey(event);
    if (existingKeys.has(key) || batchKeys.has(key)) {
      return false;
    }
    batchKeys.add(key);
    return true;
  });
};

export const summarizeExperimentOps = (ops: any[]): string => {
  if (!ops || !ops.length) {
    return '无操作更改';
  }

  const detailed = ops
    .map((operation: any, index: number) => {
      const label = operation?.op || operation?.name || `op${index + 1}`;
      const body = JSON.stringify(operation, null, 2) || '';
      return `[#${index + 1}] ${label}\n${body}`;
    })
    .join('\n');

  return detailed.length > 1200 ? `${detailed.slice(0, 1200)}…` : detailed;
};

export const buildExperimentVariantLogs = (
  experimentName: string,
  parentNodeId: string,
  variants: ExperimentVariantLike[],
): LogEntry[] => {
  const timestamp = new Date().toISOString();
  return variants.map((variant, index) => ({
    id: `exp-log-${Date.now()}-${index}`,
    nodeId: parentNodeId,
    round: 0,
    type: 'SYSTEM',
    content: `${experimentName} / ${variant.name}: ${summarizeExperimentOps(variant.ops || [])}`,
    timestamp,
  }));
};

export const dedupeLogsByNodeAndContent = <T extends { nodeId?: unknown; type?: unknown; content?: unknown }>(
  logs: Array<T | null | undefined>,
): T[] => {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const entry of logs || []) {
    if (!entry) {
      continue;
    }
    const key = `${entry.nodeId || ''}|${entry.type || ''}|${entry.content || ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(entry);
  }

  return output;
};

export const addVariantMetaToNodes = (
  nodes: any[],
  children: VariantChildRef[],
  experimentId: string,
): any[] => {
  const variantIdMap = new Map<string, unknown>();
  children.forEach((child) => {
    variantIdMap.set(String(child.node_id), child.variant_id);
  });

  return (nodes || []).map((node) => {
    if (!variantIdMap.has(String(node.id))) {
      return node;
    }
    return {
      ...node,
      meta: {
        ...(node.meta || {}),
        experiment_id: experimentId,
        variant_id: variantIdMap.get(String(node.id)),
      },
    };
  });
};

export const copyLogsToChildren = (
  existingLogs: LogEntry[],
  parentLogs: LogEntry[],
  variantLogs: LogEntry[],
  children: VariantChildRef[],
): LogEntry[] => {
  const existingLogIds = new Set((existingLogs || []).map((log) => log.id));

  const copyVariantLogs = children.flatMap((child, index) => {
    const baseLog = variantLogs[index];
    if (!baseLog) {
      return [] as LogEntry[];
    }
    const newId = `${baseLog.id}-child-${child.node_id}`;
    if (existingLogIds.has(newId)) {
      return [] as LogEntry[];
    }
    return [{ ...baseLog, id: newId, nodeId: String(child.node_id) }];
  });

  const copyParentLogs = children.flatMap((child) => {
    const childId = String(child.node_id);
    return parentLogs.map((parentLog, index) => {
      const newId = `${parentLog.id}-copy-${childId}-${index}`;
      if (existingLogIds.has(newId)) {
        return null;
      }
      return { ...parentLog, id: newId, nodeId: childId };
    }).filter(Boolean) as LogEntry[];
  });

  return dedupeLogsByNodeAndContent([...(existingLogs || []), ...copyVariantLogs, ...copyParentLogs]);
};
