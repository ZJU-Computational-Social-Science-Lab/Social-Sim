import type { ElementType } from 'react';
import {
  Grid3X3,
  Layers,
  RefreshCw,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

export type NetworkPresetType =
  | 'full'
  | 'random'
  | 'ring'
  | 'star'
  | 'newman-watts'
  | 'core-periphery'
  | 'sbm';

export type PresetType = NetworkPresetType | 'custom';
export type StepFiveDetailSurface = 'overview' | 'memberConnections' | null;

export interface PresetParams {
  random: { connectionChance: number };
  ring: Record<string, never>;
  star: Record<string, never>;
  'newman-watts': { neighborsEachSide: number; shortcutChance: number };
  'core-periphery': {
    influencerPercent: number;
    influencerConnectivity: number;
    influencerReach: number;
    regularConnectivity: number;
  };
  sbm: { groupSize: number; withinGroupConnectivity: number; bridgeConnections: number };
}

export type PresetMetaMap = Record<PresetType, { tags: string[]; summary: string }>;

export const presetIcons: Record<
  PresetType,
  { icon: ElementType; translationKey: string; defaultLabel: string }
> = {
  full: { icon: Share2, translationKey: 'fully_connected', defaultLabel: 'Fully connected' },
  random: { icon: Shuffle, translationKey: 'random', defaultLabel: 'Random' },
  ring: { icon: RefreshCw, translationKey: 'ring', defaultLabel: 'Ring' },
  star: { icon: Users, translationKey: 'star', defaultLabel: 'Star' },
  'newman-watts': { icon: Grid3X3, translationKey: 'small_world', defaultLabel: 'Small world' },
  'core-periphery': {
    icon: Layers,
    translationKey: 'core_periphery',
    defaultLabel: 'Core-periphery',
  },
  sbm: { icon: Users, translationKey: 'communities', defaultLabel: 'Communities' },
  custom: { icon: SlidersHorizontal, translationKey: 'custom_structure', defaultLabel: 'Custom' },
};

export const visiblePresets: PresetType[] = [
  'full',
  'random',
  'ring',
  'star',
  'newman-watts',
  'core-periphery',
  'sbm',
  'custom',
];

export const defaultParams: PresetParams = {
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
  sbm: { groupSize: 5, withinGroupConnectivity: 0.6, bridgeConnections: 1 },
};

export const ensureNoIsolatedNodes = (
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

export const emitStepFiveGuide = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('ss-step5-guide-state', { detail }));
};

export const focusStepFiveElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.classList.remove('is-guided');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.requestAnimationFrame(() => {
    element.classList.add('is-guided');
    window.setTimeout(() => element.classList.remove('is-guided'), 1800);
  });
};
