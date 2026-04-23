import type { SocialNetwork } from '../../../types';
import type { ManualAgentType } from '../../../store/experiment-builder';
import type { Archetype, Demographic } from '../../wizard/Step2DemographicsEditor';

export type TierValue = string;

export interface EditablePropertyDraft {
  id: string;
  originalKey: string;
  key: string;
  value: string;
}

export const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const XIHU_YILIANBAO_SCENARIO_ID = 'xihu_yilianbao';

export const buildXihuYilianbaoDefaultAgents = (): ManualAgentType[] => [
  {
    id: 'xihu-grid-worker',
    label: '社区网格员 林岚',
    count: 1,
    rolePrompt:
      '你是杭州社区的网格员，熟悉医保和社区宣传工作。你通常信任政府主导的公共政策，也愿意向居民解释西湖益联保的投保规则、报销案例和支付方式。',
    userProfile: '政府背书敏感，愿意主动传播政策信息。',
    properties: {},
    providerId: null,
  },
  {
    id: 'xihu-sandwich-worker',
    label: '夹心层白领 周晨',
    count: 1,
    rolePrompt:
      '你是34岁的杭州白领，上有年迈父母，下有一个上小学的孩子。你会把家庭预算、父母慢病风险和孩子保障放在一起考虑，容易被家庭减负或家庭损失的信息触动。',
    userProfile: '家庭责任重，既关心自己也关心父母和孩子。',
    properties: {},
    providerId: null,
  },
  {
    id: 'xihu-new-resident',
    label: '新杭州人宝妈 陈雪',
    count: 1,
    rolePrompt:
      '你是持有杭州居住证的新杭州人宝妈，平时对商业保险会仔细比较，既担心理赔陷阱，也会认真看是否能给孩子和家里带来稳定保障。',
    userProfile: '价格敏感、风险意识强，对信息可信度格外敏感。',
    properties: {},
    providerId: null,
  },
  {
    id: 'xihu-retired-father',
    label: '退休父亲 王建国',
    count: 1,
    rolePrompt:
      '你是63岁的退休父亲，近几年自己或老伴有慢病复诊经历。你会特别关注住院报销、自付压力和是否值得给老伴或子女一起投保。',
    userProfile: '医疗支出体验强，容易受到损失框架影响。',
    properties: {},
    providerId: null,
  },
  {
    id: 'xihu-shop-owner',
    label: '个体经营者 李涛',
    count: 1,
    rolePrompt:
      '你是42岁的个体经营者，收入波动较大，过去接触过一些商业保险营销，所以天然会保留怀疑。只有当信息足够清楚、可信且符合家庭利益时，你才会改变主意。',
    userProfile: '先验怀疑较强，容易受复杂条款和竞品负面新闻影响。',
    properties: {},
    providerId: null,
  },
  {
    id: 'xihu-young-engineer',
    label: '年轻程序员 许宁',
    count: 1,
    rolePrompt:
      '你是29岁的年轻程序员，信息处理能力强，愿意读复杂材料，也会和朋友讨论西湖益联保到底值不值得买。你既在乎性价比，也在乎政策是否正规、透明。',
    userProfile: '认知能力较强，常作为朋友圈里的信息二次解释者。',
    properties: {},
    providerId: null,
  },
];

export const buildXihuYilianbaoDefaultNetwork = (): SocialNetwork => ({
  '社区网格员 林岚': ['夹心层白领 周晨', '新杭州人宝妈 陈雪', '退休父亲 王建国', '个体经营者 李涛', '年轻程序员 许宁'],
  '夹心层白领 周晨': ['社区网格员 林岚', '退休父亲 王建国', '个体经营者 李涛', '年轻程序员 许宁'],
  '新杭州人宝妈 陈雪': ['社区网格员 林岚', '年轻程序员 许宁'],
  '退休父亲 王建国': ['社区网格员 林岚', '夹心层白领 周晨'],
  '个体经营者 李涛': ['社区网格员 林岚', '夹心层白领 周晨'],
  '年轻程序员 许宁': ['社区网格员 林岚', '夹心层白领 周晨', '新杭州人宝妈 陈雪'],
});

export const normalizeTierValue = (value: string): TierValue => {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, '');
  if (normalized.includes('top') || normalized.includes('high') || value.includes('高层')) return 'top';
  if (normalized.includes('mid') || normalized.includes('middle') || value.includes('中层')) return 'mid';
  if (normalized.includes('low') || normalized.includes('base') || value.includes('基层')) return 'low';
  return '';
};

export const inferTierFromAgent = (agent: Partial<ManualAgentType>): TierValue => {
  const explicitTier = normalizeTierValue(String(agent.properties?.tier || ''));
  if (explicitTier) return explicitTier;
  return normalizeTierValue([
    agent.label || '',
    agent.rolePrompt || '',
    agent.userProfile || '',
  ].join(' '));
};

export const parseTierOrder = (rawValue: unknown): string[] => {
  const values = Array.isArray(rawValue)
    ? rawValue.map((item) => String(item).trim())
    : String(rawValue || 'top, mid, low')
      .split(/[\n,，]+/)
      .map((item) => item.trim());

  const cleaned: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(value);
  });
  return cleaned.length > 0 ? cleaned : ['top', 'mid', 'low'];
};

export const inferOrderedTier = (agent: Partial<ManualAgentType>, tierOrder: string[]): string => {
  const explicit = String(agent.properties?.tier || '').trim();
  if (explicit) {
    const matched = tierOrder.find((tier) => tier.toLowerCase() === explicit.toLowerCase());
    if (matched) return matched;
  }

  const profileTier = String(agent.properties?.['政治职位层级'] || '').trim();
  if (profileTier) {
    const matched = tierOrder.find((tier) => tier.toLowerCase() === profileTier.toLowerCase());
    if (matched) return matched;
  }

  const normalizedTier = inferTierFromAgent(agent);
  if (!normalizedTier) return '';
  const matched = tierOrder.find((tier) => normalizeTierValue(tier) === normalizedTier);
  return matched || '';
};

export const defaultTierName = (index: number): string => {
  if (index === 0) return 'top';
  if (index === 1) return 'mid';
  if (index === 2) return 'low';
  return `level_${index + 1}`;
};

export const resizeTierOrder = (current: string[], count: number): string[] => {
  const nextCount = Math.max(2, count || 2);
  const next: string[] = [];
  for (let i = 0; i < nextCount; i += 1) {
    next.push(current[i] || defaultTierName(i));
  }
  return next;
};

export const isPolicyCascadeScenario = (scenarioId: string, scenarioName: string): boolean => {
  return (
    scenarioId === 'policy_diffusion' ||
    scenarioId === 'policyDiffusion' ||
    scenarioName.includes('policy') ||
    scenarioName.includes('政策')
  );
};

export const generateArchetypes = (demographics: Demographic[]): Archetype[] => {
  if (demographics.length === 0) return [];

  let combinations: Record<string, string>[] = demographics[0].categories.map((cat) => ({
    [demographics[0].name]: cat,
  }));

  for (let i = 1; i < demographics.length; i++) {
    const demo = demographics[i];
    const newCombos: Record<string, string>[] = [];
    for (const combo of combinations) {
      for (const cat of demo.categories) {
        newCombos.push({ ...combo, [demo.name]: cat });
      }
    }
    combinations = newCombos;
  }

  const equalProb = 1 / combinations.length;
  return combinations.map((attrs, idx) => ({
    id: `arch_${idx}`,
    attributes: attrs,
    label: Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | '),
    probability: equalProb,
  }));
};

export const focusStepFourElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.classList.remove('is-guided');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.requestAnimationFrame(() => {
    element.classList.add('is-guided');
    window.setTimeout(() => element.classList.remove('is-guided'), 1800);
  });
};
