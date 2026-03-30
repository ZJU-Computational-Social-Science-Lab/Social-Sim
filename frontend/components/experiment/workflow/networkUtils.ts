// Pure utility: count unique undirected edges in a social network adjacency list.
export const getEdgeCount = (network: Record<string, string[]>): number => {
  const dedup = new Set<string>();
  Object.entries(network).forEach(([source, targets]) => {
    targets.forEach((target) => {
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      dedup.add(key);
    });
  });
  return dedup.size;
};
