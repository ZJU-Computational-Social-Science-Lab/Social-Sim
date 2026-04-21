/**
 * Log viewer component with timeline, card, and list views.
 *
 * Displays simulation events including agent actions, dialogue, and system events.
 * Supports filtering by type and agent, with search functionality.
 * In timeline view, displays custom action and resource names from scenario params.
 *
 * Exports: LogViewer (default export)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store';
import { useTranslation } from 'react-i18next';
import { LogEntry, ViewMode } from '../types';
import { Activity, BookOpen, Brain, CreditCard, Clock, Filter, GitCommit, Image as ImageIcon, List, Search, UserRound, X, Check } from 'lucide-react';
import { getActionConfig, getResourceName } from '../utils/scenarioHelpers';
import { resolveAgentDisplayName, translateActionName, getAgentDisplayName, getAgentDisplayRole } from '../store/helpers';

type DiffOp<T> = {
  type: 'equal' | 'add' | 'remove';
  value: T;
};

type PolicyDiffRow = {
  kind: 'unchanged' | 'added' | 'removed' | 'modified';
  left: string;
  right: string;
};

type InlineDiffSegment = {
  kind: 'unchanged' | 'added' | 'removed';
  text: string;
};

type SemanticTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'metadata';

const semanticToneColor = (tone: SemanticTone) => {
  if (tone === 'info') return 'var(--ss-info)';
  if (tone === 'success') return 'var(--ss-success)';
  if (tone === 'warning') return 'var(--ss-warning)';
  if (tone === 'danger') return 'var(--ss-danger)';
  if (tone === 'metadata') return 'var(--ss-secondary)';
  return 'var(--ss-workspace-muted)';
};

const buildSemanticTintStyle = (
  tone: SemanticTone,
  {
    backgroundPct = 14,
    borderPct = 26,
    textPct = 76,
    surface = 'var(--ss-workspace-surface-strong)',
    textBase = 'var(--ss-workspace-heading)',
    includeBorder = false,
    includeText = true,
  }: {
    backgroundPct?: number;
    borderPct?: number;
    textPct?: number;
    surface?: string;
    textBase?: string;
    includeBorder?: boolean;
    includeText?: boolean;
  } = {}
): React.CSSProperties => {
  const accent = semanticToneColor(tone);
  return {
    background: `color-mix(in srgb, ${accent} ${backgroundPct}%, ${surface} ${100 - backgroundPct}%)`,
    ...(includeBorder
      ? {
          borderColor: `color-mix(in srgb, ${accent} ${borderPct}%, var(--ss-workspace-border) ${100 - borderPct}%)`,
        }
      : {}),
    ...(includeText
      ? {
          color: `color-mix(in srgb, ${accent} ${textPct}%, ${textBase} ${100 - textPct}%)`,
        }
      : {}),
  };
};

const splitDiffText = (text: string): string[] =>
  String(text || '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0);

const buildDiffOps = <T,>(left: T[], right: T[], isEqual: (a: T, b: T) => boolean): DiffOp<T>[] => {
  const dp: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      if (isEqual(left[i], right[j])) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: DiffOp<T>[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (isEqual(left[i], right[j])) {
      ops.push({ type: 'equal', value: left[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', value: left[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', value: right[j] });
      j += 1;
    }
  }

  while (i < left.length) {
    ops.push({ type: 'remove', value: left[i] });
    i += 1;
  }

  while (j < right.length) {
    ops.push({ type: 'add', value: right[j] });
    j += 1;
  }

  return ops;
};

const buildPolicyDiffRows = (leftText: string, rightText: string): PolicyDiffRow[] => {
  const leftLines = splitDiffText(leftText);
  const rightLines = splitDiffText(rightText);
  const ops = buildDiffOps(leftLines, rightLines, (a, b) => a === b);
  const rows: PolicyDiffRow[] = [];
  let removedGroup: string[] = [];
  let addedGroup: string[] = [];

  const flushGroups = () => {
    const count = Math.max(removedGroup.length, addedGroup.length);
    for (let idx = 0; idx < count; idx += 1) {
      const left = removedGroup[idx] || '';
      const right = addedGroup[idx] || '';
      if (left && right) {
        rows.push({ kind: 'modified', left, right });
      } else if (left) {
        rows.push({ kind: 'removed', left, right: '' });
      } else if (right) {
        rows.push({ kind: 'added', left: '', right });
      }
    }
    removedGroup = [];
    addedGroup = [];
  };

  ops.forEach(op => {
    if (op.type === 'equal') {
      flushGroups();
      rows.push({ kind: 'unchanged', left: String(op.value), right: String(op.value) });
      return;
    }
    if (op.type === 'remove') {
      removedGroup.push(String(op.value));
      return;
    }
    addedGroup.push(String(op.value));
  });

  flushGroups();
  return rows;
};

const buildInlineDiffSegments = (leftText: string, rightText: string, side: 'left' | 'right'): InlineDiffSegment[] => {
  const leftChars = Array.from(leftText || '');
  const rightChars = Array.from(rightText || '');
  const ops = buildDiffOps(leftChars, rightChars, (a, b) => a === b);
  const segments: InlineDiffSegment[] = [];

  const pushSegment = (kind: InlineDiffSegment['kind'], text: string) => {
    if (!text) {
      return;
    }
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
      return;
    }
    segments.push({ kind, text });
  };

  ops.forEach(op => {
    if (op.type === 'equal') {
      pushSegment('unchanged', String(op.value));
      return;
    }
    if (side === 'left' && op.type === 'remove') {
      pushSegment('removed', String(op.value));
      return;
    }
    if (side === 'right' && op.type === 'add') {
      pushSegment('added', String(op.value));
    }
  });

  return segments;
};

const inlineSegmentClassName = (kind: InlineDiffSegment['kind']) => {
  return kind === 'unchanged' ? '' : 'rounded px-0.5';
};

const inlineSegmentStyle = (kind: InlineDiffSegment['kind']) => {
  if (kind === 'added') {
    return buildSemanticTintStyle('success', {
      backgroundPct: 20,
      textPct: 80,
      surface: 'var(--ss-workspace-surface)',
    });
  }
  if (kind === 'removed') {
    return buildSemanticTintStyle('danger', {
      backgroundPct: 18,
      textPct: 80,
      surface: 'var(--ss-workspace-surface)',
    });
  }
  return undefined;
};

const diffCellStyle = (kind: PolicyDiffRow['kind'], side: 'left' | 'right') => {
  if (kind === 'modified') {
    return buildSemanticTintStyle('warning', {
      backgroundPct: 10,
      borderPct: 28,
      includeBorder: true,
      includeText: false,
    });
  }
  if (kind === 'removed' && side === 'left') {
    return buildSemanticTintStyle('danger', {
      backgroundPct: 10,
      borderPct: 24,
      includeBorder: true,
      includeText: false,
    });
  }
  if (kind === 'added' && side === 'right') {
    return buildSemanticTintStyle('success', {
      backgroundPct: 10,
      borderPct: 24,
      includeBorder: true,
      includeText: false,
    });
  }
  return undefined;
};

const PolicyDiffCard: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const data = entry.structuredData;
  const showDraftExpanded = import.meta.env.DEV;
  const rows = useMemo(
    () => buildPolicyDiffRows(data?.leftContent || '', data?.rightContent || ''),
    [data?.leftContent, data?.rightContent]
  );

  if (!data || data.kind !== 'policy_diff') {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {data.agentLabel && (
          <span className="text-sm font-semibold text-[var(--ss-workspace-heading)]">{data.agentLabel}</span>
        )}
        <span className="text-sm font-semibold text-[var(--ss-workspace-heading)]">{data.title}</span>
      </div>

      <div className="text-xs leading-6 text-[var(--ss-workspace-muted)]">
        左侧显示该层收到的上级政策版本，右侧显示最终真正发给下一级的内容；若下方出现附加框，则表示 agent 原始草稿。
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)]">
          <div className="border-b border-[var(--ss-workspace-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ss-workspace-muted)]">
            {data.leftTitle}
          </div>
          <div className="max-h-80 space-y-1 overflow-auto px-3 py-3 text-sm leading-7 text-[var(--ss-workspace-text)]">
            {rows.filter(row => row.left).map((row, idx) => {
              const segments = row.kind === 'modified'
                ? buildInlineDiffSegments(row.left, row.right, 'left')
                : [];
              return (
                <div
                  key={`left-${idx}`}
                  className="rounded border px-2 py-1 whitespace-pre-wrap break-words"
                  style={diffCellStyle(row.kind, 'left')}
                >
                  {row.kind === 'modified' ? (
                    segments.map((segment, segmentIdx) => (
                      <span
                        key={`left-${idx}-${segmentIdx}`}
                        className={inlineSegmentClassName(segment.kind)}
                        style={inlineSegmentStyle(segment.kind)}
                      >
                        {segment.text}
                      </span>
                    ))
                  ) : (
                    row.left
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)]">
          <div className="border-b border-[var(--ss-workspace-border)] bg-[rgba(47,230,166,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ss-workspace-heading)]">
            {data.rightTitle}
          </div>
          <div className="max-h-80 space-y-1 overflow-auto px-3 py-3 text-sm leading-7 text-[var(--ss-workspace-text)]">
            {rows.filter(row => row.right).map((row, idx) => {
              const segments = row.kind === 'modified'
                ? buildInlineDiffSegments(row.left, row.right, 'right')
                : [];
              return (
                <div
                  key={`right-${idx}`}
                  className="rounded border px-2 py-1 whitespace-pre-wrap break-words"
                  style={diffCellStyle(row.kind, 'right')}
                >
                  {row.kind === 'modified' ? (
                    segments.map((segment, segmentIdx) => (
                      <span
                        key={`right-${idx}-${segmentIdx}`}
                        className={inlineSegmentClassName(segment.kind)}
                        style={inlineSegmentStyle(segment.kind)}
                      >
                        {segment.text}
                      </span>
                    ))
                  ) : (
                    row.right
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {data.draftContent && (
        <details
          open={showDraftExpanded}
          className="group overflow-hidden rounded-lg border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between border-b border-[var(--ss-workspace-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ss-workspace-muted)]">
            <span>{data.draftTitle}</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-[var(--ss-workspace-muted)] group-open:hidden">
              调试信息，点击展开
            </span>
            <span className="hidden text-[11px] font-medium normal-case tracking-normal text-[var(--ss-workspace-muted)] group-open:inline">
              调试信息，点击折叠
            </span>
          </summary>
          <div className="max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-3 text-sm leading-7 text-[var(--ss-workspace-text)]">
            {data.draftContent}
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-[var(--ss-workspace-muted)]">
        <span
          className="rounded-full border px-2 py-1"
          style={buildSemanticTintStyle('success', { backgroundPct: 16, borderPct: 24, textPct: 80, includeBorder: true })}
        >
          新增
        </span>
        <span
          className="rounded-full border px-2 py-1"
          style={buildSemanticTintStyle('danger', { backgroundPct: 14, borderPct: 24, textPct: 80, includeBorder: true })}
        >
          删除
        </span>
        <span
          className="rounded-full border px-2 py-1"
          style={buildSemanticTintStyle('warning', { backgroundPct: 16, borderPct: 28, textPct: 82, includeBorder: true })}
        >
          改写
        </span>
      </div>

      <div
        className="rounded-lg border px-3 py-2 text-sm"
        style={buildSemanticTintStyle('warning', { backgroundPct: 10, borderPct: 30, textPct: 84, includeBorder: true })}
      >
        <div className="font-medium">{data.reasonLabel}：</div>
        <div className="mt-1 whitespace-pre-wrap break-words">{data.reason}</div>
      </div>

      <div className="whitespace-pre-wrap break-words text-xs text-[var(--ss-workspace-muted)]">
        <span className="font-medium">{data.metricsLabel}：</span>
        {data.metrics}
      </div>
    </div>
  );
};

// Helper for displaying time niceliy
const formatLogTime = (dateStr: string) => {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  // E.g. "Mar 10, 14:00"
  return date.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// Resolve action name for display using scenario params
const getDisplayActionName = (
  action: string,
  scenarioParams: Record<string, unknown>
): string => {
  // Map original action names to custom names for stag hunt / battle of sexes scenarios
  const originalActions = ['Opera', 'Football', 'Stag', 'Hare'];

  if (originalActions.includes(action)) {
    // Determine action index based on original position
    // Opera/Stag are action 1, Football/Hare are action 2
    const actionIndex = ['Opera', 'Stag'].includes(action) ? 1 : 2;
    const config = getActionConfig(scenarioParams, actionIndex);
    return config.name;
  }

  return translateActionName(action);
};

// Format public goods contribution event with custom resource/action names
const formatPublicGoodsEvent = (
  eventContent: string,
  scenarioParams: Record<string, unknown>,
  t: (key: string, options?: Record<string, unknown>) => string
): string => {
  const resource = getResourceName(scenarioParams);
  const actionName = (scenarioParams.action_name as string) || 'Contribute';

  // Try to parse contribution amount from content
  const contributionMatch = eventContent.match(/(\d+)/);
  if (contributionMatch) {
    const amount = contributionMatch[1];
    // Extract agent name if present
    const agentMatch = eventContent.match(/^([^:]+):/);
    const agentName = agentMatch ? agentMatch[1].trim() : '';

    if (agentName) {
      return t('simulation.log.public_goods_contribution', {
        agent: agentName,
        action: actionName.toLowerCase(),
        amount: amount,
        resource: resource.toLowerCase(),
      });
    }
  }

  return eventContent;
};

const LogItem: React.FC<{
  entry: LogEntry;
  mode: ViewMode;
  nodeWorldTime?: string;
  agents?: any[];
  scenarioParams?: Record<string, unknown>;
}> = ({ entry, mode, nodeWorldTime, agents = [], scenarioParams = {} }) => {
  const { t } = useTranslation();
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const displayAgentName = entry.agentId ? resolveAgentDisplayName(entry.agentId, agents) : '';

  const getBorderColor = () => {
    switch (entry.type) {
      case 'SYSTEM': return 'border-l-slate-400';
      case 'AGENT_SAY': return 'border-l-blue-500';
      case 'AGENT_ACTION': return 'border-l-amber-500';
      case 'AGENT_METADATA': return 'border-l-purple-400';
      case 'ENVIRONMENT': return 'border-l-emerald-500';
      default: return 'border-l-slate-200';
    }
  };

  const getBadgeStyle = (): React.CSSProperties => {
    switch (entry.type) {
      case 'SYSTEM':
        return buildSemanticTintStyle('neutral', { backgroundPct: 14, borderPct: 22, textPct: 70, includeBorder: true });
      case 'AGENT_SAY':
        return buildSemanticTintStyle('info', { backgroundPct: 16, borderPct: 24, textPct: 74, includeBorder: true });
      case 'AGENT_ACTION':
        return buildSemanticTintStyle('warning', { backgroundPct: 18, borderPct: 30, textPct: 84, includeBorder: true });
      case 'AGENT_METADATA':
        return buildSemanticTintStyle('metadata', { backgroundPct: 16, borderPct: 24, textPct: 72, includeBorder: true });
      case 'ENVIRONMENT':
        return buildSemanticTintStyle('success', { backgroundPct: 16, borderPct: 24, textPct: 78, includeBorder: true });
      default:
        return buildSemanticTintStyle('neutral', { backgroundPct: 14, borderPct: 22, textPct: 70, includeBorder: true });
    }
  };

  const translateType = (type: string, agentId?: string) => {
    switch(type) {
      case 'SYSTEM': return t('components.logViewer.typeSystem');
      case 'AGENT_SAY': return t('components.logViewer.typeDialogue');
      case 'AGENT_ACTION': return t('components.logViewer.typeAction');
      case 'AGENT_METADATA':
        // For AGENT_METADATA, show Agent name instead of "system"
        if (agentId && agents.length > 0) {
          const agent = agents.find(a => a.id === agentId);
          return agent ? getAgentDisplayName(agent) : t('components.logViewer.typeAgentMetadata');
        }
        return t('components.logViewer.typeAgentMetadata');
      case 'ENVIRONMENT': return t('components.logViewer.typeEnvironment');
      default: return type;
    }
  };

  // Use entry timestamp if valid, otherwise fallback or node time
  const displayTime = entry.timestamp.includes('-') ? formatLogTime(entry.timestamp) : entry.timestamp;
  const actionBadge = entry.type === 'AGENT_ACTION' && entry.actionLabel ? entry.actionLabel : '';
  const actionBadgeStyle = buildSemanticTintStyle('warning', {
    backgroundPct: 18,
    borderPct: 30,
    textPct: 86,
    includeBorder: true,
  });

  // Process content to replace action names with custom names
  const getProcessedContent = (content: string): string => {
    if (!content || Object.keys(scenarioParams).length === 0) {
      return content;
    }

    let processedContent = content;

    // Handle stag hunt / battle of sexes action names
    // Match patterns like "chose Opera", "chose Stag", "chose Football", "chose Hare"
    const actionChoicePattern = /(chose|选择了)\s+(Opera|Football|Stag|Hare)/gi;
    processedContent = processedContent.replace(actionChoicePattern, (match, verb, action) => {
      const displayName = getDisplayActionName(action, scenarioParams);
      return `${verb} ${displayName}`;
    });

    const rawActionChoicePattern = /(chose|选择了)\s*([a-z_]+)/gi;
    processedContent = processedContent.replace(rawActionChoicePattern, (match, verb, action) => {
      const displayName = getDisplayActionName(action, scenarioParams);
      return verb === '选择了' ? `${verb}${displayName}` : `${verb} ${displayName}`;
    });

    // Handle action names in patterns like "performed Opera action", "Opera action"
    const actionNamePattern = /\b(Opera|Football|Stag|Hare)\b/g;
    processedContent = processedContent.replace(actionNamePattern, (match) => {
      return getDisplayActionName(match, scenarioParams);
    });

    // Handle public goods contribution events
    if (scenarioParams.resource_name || scenarioParams.action_name) {
      // Check if this looks like a contribution message
      if (content.toLowerCase().includes('contribut') ||
          content.toLowerCase().includes('贡献') ||
          /\b\d+\s*(tokens?|tokens)\b/i.test(content)) {
        processedContent = formatPublicGoodsEvent(content, scenarioParams, t);
      }
    }

    return processedContent;
  };

  const displayContent = getProcessedContent(entry.content);
  const hasPolicyDiff = entry.structuredData?.kind === 'policy_diff';

  const ImageComponent = () => (
    entry.imageUrl ? (
      <div className="mt-2">
        <div 
          className="relative group cursor-pointer w-fit"
          onClick={() => setIsImageExpanded(true)}
        >
          <img
            src={entry.imageUrl}
            alt={t('components.logViewer.logAttachment')}
            className="max-h-48 rounded border border-slate-200 object-cover"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
             <ImageIcon className="text-white drop-shadow-md" size={24} />
          </div>
        </div>
        
        {/* Simple Lightbox */}
        {isImageExpanded && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={(e) => {
             e.stopPropagation();
             setIsImageExpanded(false);
          }}>
             <img src={entry.imageUrl} alt={t('components.logViewer.fullSize')} className="max-w-full max-h-full rounded shadow-2xl" />
             <button className="absolute top-4 right-4 text-white hover:text-slate-300">
               <X size={32} />
             </button>
          </div>
        )}
      </div>
    ) : null
  );

  const MediaBadges = () => (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--ss-workspace-muted)]">
      {entry.audioUrl && (
        <a
          href={entry.audioUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-2 py-1 text-[var(--ss-workspace-muted)] transition-colors hover:text-[var(--ss-workspace-heading)]"
          style={buildSemanticTintStyle('neutral', { backgroundPct: 12, borderPct: 18, textPct: 62, includeBorder: true })}
        >
          {t('components.logViewer.audioLink')}
        </a>
      )}
      {entry.videoUrl && (
        <a
          href={entry.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-2 py-1 text-[var(--ss-workspace-muted)] transition-colors hover:text-[var(--ss-workspace-heading)]"
          style={buildSemanticTintStyle('neutral', { backgroundPct: 12, borderPct: 18, textPct: 62, includeBorder: true })}
        >
          {t('components.logViewer.videoLink')}
        </a>
      )}
    </div>
  );

  if (mode === ViewMode.LIST) {
    return (
      <div className={`ss-logviewer__item flex gap-4 border-b px-4 py-3 text-[0.95rem] ${entry.type === 'SYSTEM' ? 'bg-white/[0.02]' : ''}`}>
        <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[11px] text-[var(--ss-workspace-muted)]">{displayTime}</span>
        <span
          className="self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
          style={getBadgeStyle()}
        >
          {translateType(entry.type, entry.agentId)}
        </span>
        <div className="flex-1">
          {/* For AGENT_METADATA, don't repeat agentId since it's already shown in the badge */}
          {entry.agentId && entry.type !== 'AGENT_METADATA' && (
            <span className="mr-2 font-bold text-[var(--ss-workspace-heading)]">{displayAgentName}:</span>
          )}
          {hasPolicyDiff ? (
            <PolicyDiffCard entry={entry} />
          ) : (
            <div className="space-y-2">
              {actionBadge ? (
                <div className="flex justify-end">
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-[0_1px_0_rgba(138,90,0,0.06)]"
                    style={actionBadgeStyle}
                  >
                    {actionBadge}
                  </span>
                </div>
              ) : null}
              <span className="leading-7 text-[var(--ss-workspace-text)]">{displayContent}</span>
            </div>
          )}
          <ImageComponent />
          <MediaBadges />
        </div>
      </div>
    );
  }

  // Card & Timeline Views
  return (
    <div className={`ss-logviewer__item relative mb-3 border-l-4 p-4 ${getBorderColor()}`}>
       {mode === ViewMode.TIMELINE && (
         <div className="absolute -left-[29px] top-4 z-10 h-3 w-3 rounded-full border-2 border-[var(--ss-workspace-surface)] bg-[var(--ss-workspace-node-selected)]"></div>
       )}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
           <span
             className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
             style={getBadgeStyle()}
           >
            {translateType(entry.type, entry.agentId)}
          </span>
          {/* For AGENT_METADATA, don't repeat agentId since it's already shown in the badge */}
          {entry.agentId && entry.type !== 'AGENT_METADATA' && (
            <span className="text-xs font-bold text-[var(--ss-workspace-heading)]">{displayAgentName}</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {actionBadge ? (
            <span
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-[0_1px_0_rgba(138,90,0,0.06)]"
              style={actionBadgeStyle}
            >
              {actionBadge}
            </span>
          ) : null}
          <span className="text-[10px] font-mono text-[var(--ss-workspace-muted)]">{displayTime}</span>
        </div>
      </div>
      {hasPolicyDiff ? (
        <PolicyDiffCard entry={entry} />
      ) : (
        <p className="text-[0.98rem] leading-8 whitespace-pre-line text-[var(--ss-workspace-text)]">{displayContent}</p>
      )}
      <ImageComponent />
      <MediaBadges />
    </div>
  );
};

const MemoLogItem = React.memo(LogItem);

interface LogViewerProps {
  selectedAgentId?: string | null;
  onClearSelectedAgent?: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  selectedAgentId = null,
  onClearSelectedAgent,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const logs = useSimulationStore(state => state.logs);
  const nodes = useSimulationStore(state => state.nodes);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const agents = useSimulationStore(state => state.agents);
  const currentSimulation = useSimulationStore(state => state.currentSimulation);

  // Extract scenario params from current simulation's scene_config
  const scenarioParams = useMemo((): Record<string, unknown> => {
    const sceneConfig = currentSimulation?.scene_config || {};
    // Parameters may be nested under 'parameters' or at the top level
    return (sceneConfig.parameters as Record<string, unknown>) || sceneConfig || {};
  }, [currentSimulation]);

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CARD);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const nodeLookup = useMemo(
    () => new globalThis.Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  // Compute Ancestry Path for current selection
  const currentPath = useMemo(() => {
    const path: typeof nodes = [];
    let current = selectedNodeId ? nodeLookup.get(selectedNodeId) : null;
    while (current) {
      path.unshift(current);
      current = current.parentId ? nodeLookup.get(current.parentId) || null : null;
    }
    return path;
  }, [nodeLookup, selectedNodeId]);

  const ancestorIds = useMemo(() => {
    const ids = new Set<string>();
    let current = selectedNodeId ? nodeLookup.get(selectedNodeId) : null;
    while (current) {
      ids.add(current.id);
      current = current.parentId ? nodeLookup.get(current.parentId) || null : null;
    }
    return ids;
  }, [nodeLookup, selectedNodeId]);

  const isGlobalBranchView = !selectedNodeId || selectedNodeId === '0' || selectedNodeId === 'root';

  // Filter Logic
  const filteredLogs = useMemo(() => {
    const forcedAgentIds = selectedAgent ? new Set([selectedAgent.id, selectedAgent.name]) : null;

    return logs.filter(log => {
      // 0. Ancestry Filter (Strict: only show logs from current path)
      if (!isGlobalBranchView && log.nodeId && !ancestorIds.has(log.nodeId)) {
        return false;
      }

      if (forcedAgentIds) {
        if (!log.agentId || !forcedAgentIds.has(log.agentId)) {
          return false;
        }
      }

      // 1. Search Text
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const contentMatch = log.content.toLowerCase().includes(query);
        const agentMatch = log.agentId?.toLowerCase().includes(query);
        const typeMatch = log.type.toLowerCase().includes(query);
        if (!contentMatch && !agentMatch && !typeMatch) return false;
      }

      // 2. Filter by Type
      if (selectedTypes.length > 0 && !selectedTypes.includes(log.type)) {
        return false;
      }

      // 3. Filter by Agent
      if (!forcedAgentIds && selectedAgents.length > 0) {
        if (!log.agentId || !selectedAgents.includes(log.agentId)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedTypes, selectedAgents, ancestorIds, selectedAgent, isGlobalBranchView]);

  useEffect(() => {
    setSelectedAgents([]);
  }, [selectedAgentId]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      shouldFollowRef.current = distanceFromBottom < 56;
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  // When branch context changes, jump to the latest event once.
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
    shouldFollowRef.current = true;
  }, [selectedNodeId]);

  // Follow new events only when the user is already pinned near the bottom.
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !shouldFollowRef.current) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [filteredLogs.length]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedAgents([]);
  };

  const hasActiveFilters = searchQuery || selectedTypes.length > 0 || selectedAgents.length > 0;
  const latestFocusedLog = selectedAgent ? filteredLogs[filteredLogs.length - 1] || null : null;
  const latestMemory = selectedAgent?.memory[selectedAgent.memory.length - 1] || null;
  const visibleProperties = selectedAgent
    ? Object.entries(selectedAgent.properties || {}).filter(([key]) => !["avatarUrl", "internal", "_internal"].includes(key))
    : [];
  const pathLabel = currentPath.map((node) => node.display_id || node.id).join(" / ");
  const stageTitle = selectedAgent
    ? t("controlRoom.focusedStageTitle", { name: getAgentDisplayName(selectedAgent) })
    : isZh
      ? "生成事件与内容"
      : "Generated events and content";
  const stageSubtitle = selectedAgent
    ? t("controlRoom.focusedStageSubtitle")
    : isZh
      ? "按时间线查看生成事件、分支变化与世界更新。"
      : "Follow generated events, branch changes, and world updates in time order.";
  const contextBadge = selectedAgent ? t("controlRoom.focusContext") : t("controlRoom.globalContext");
  const searchPlaceholder = selectedAgent
    ? t("controlRoom.roleEvents")
    : t("controlRoom.branchEvents");

  return (
    <div className="ss-workspace__panel ss-workspace__panel--stage ss-logviewer h-full relative">
      <div className="ss-logviewer__toolbar z-20 flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ss-kicker">{t('simulationWorkspace.stageTitle')}</div>
            <h2 className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.04em] text-[var(--ss-workspace-heading)]">
              {stageTitle}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[0.86rem] leading-6 text-[var(--ss-workspace-muted)]">
              {stageSubtitle}
            </p>
          </div>
          <div className="ss-pill ss-pill--quiet">
            <GitCommit size={12} />
            {contextBadge}
          </div>
        </div>

        <div className="ss-stage__context">
          <div className="ss-stage__context-card">
            <span className="ss-stage__context-label">{t("controlRoom.currentPath")}</span>
            <strong className="ss-stage__context-value">{pathLabel || "--"}</strong>
          </div>
          {selectedAgent ? (
            <div className="ss-stage__context-card is-focused">
              <span className="ss-stage__context-label">{t("controlRoom.focusedAgent")}</span>
              <strong className="ss-stage__context-value">{getAgentDisplayName(selectedAgent)}</strong>
            </div>
          ) : null}
        </div>

        {selectedAgent ? (
          <div className="ss-stage__focus-strip">
            <div className="ss-stage__focus-card ss-stage__focus-card--identity">
              <div className="flex items-start gap-3">
                <img src={selectedAgent.avatarUrl} alt={getAgentDisplayName(selectedAgent)} className="ss-stage__focus-avatar" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ss-stage__focus-name">{getAgentDisplayName(selectedAgent)}</span>
                    <span className="ss-stage__focus-role">{getAgentDisplayRole(selectedAgent)}</span>
                  </div>
                  <p className="ss-stage__focus-copy">
                    {latestFocusedLog?.content || latestMemory?.content || t("controlRoom.noRoleEvents")}
                  </p>
                </div>
                {onClearSelectedAgent ? (
                  <button onClick={onClearSelectedAgent} className="ss-button-secondary">
                    {t("controlRoom.clearFocus")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="ss-stage__focus-card">
              <div className="ss-stage__focus-metrics">
                <div className="ss-stage__focus-metric">
                  <UserRound size={15} />
                  <div>
                    <span>{t("controlRoom.roleState")}</span>
                    <strong>{visibleProperties.length}</strong>
                  </div>
                </div>
                <div className="ss-stage__focus-metric">
                  <Brain size={15} />
                  <div>
                    <span>{t("controlRoom.memoryCount")}</span>
                    <strong>{selectedAgent.memory.length}</strong>
                  </div>
                </div>
                <div className="ss-stage__focus-metric">
                  <BookOpen size={15} />
                  <div>
                    <span>{t("controlRoom.knowledgeCount")}</span>
                    <strong>{selectedAgent.knowledgeBase.length}</strong>
                  </div>
                </div>
                <div className="ss-stage__focus-metric">
                  <Activity size={15} />
                  <div>
                    <span>{t("controlRoom.lastObserved")}</span>
                    <strong>{latestFocusedLog ? `R${latestFocusedLog.round}` : "--"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-1">
            <button
              onClick={() => setViewMode(ViewMode.LIST)}
              className={`rounded-xl p-2 transition-all ${viewMode === ViewMode.LIST ? 'bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]' : 'text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'}`}
              title={t('components.logViewer.listView')}
            >
              <List size={16} />
            </button>
            <button
               onClick={() => setViewMode(ViewMode.CARD)}
               className={`rounded-xl p-2 transition-all ${viewMode === ViewMode.CARD ? 'bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]' : 'text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'}`}
               title={t('components.logViewer.cardView')}
            >
              <CreditCard size={16} />
            </button>
             <button
               onClick={() => setViewMode(ViewMode.TIMELINE)}
               className={`rounded-xl p-2 transition-all ${viewMode === ViewMode.TIMELINE ? 'bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]' : 'text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'}`}
               title={t('components.logViewer.timelineView')}
            >
              <Clock size={16} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            <div className="relative w-full max-w-[220px]">
              <input
                type="text"
                placeholder={`${t('common.search')} ${searchPlaceholder.toLowerCase()}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ss-input w-full bg-[var(--ss-workspace-surface-strong)] py-2.5 pl-8 pr-3 text-xs"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--ss-workspace-muted)]" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2.5 text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]">
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-medium transition-colors ${isFilterOpen || (hasActiveFilters && !searchQuery) ? 'border-[rgba(47,230,166,0.24)] bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]' : 'border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'}`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">{t('components.logViewer.filter')}</span>
              {(selectedTypes.length > 0 || selectedAgents.length > 0) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ss-primary-500)] text-[9px] text-white">
                  {selectedTypes.length + selectedAgents.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {isFilterOpen && (
          <div className="mt-1 space-y-3 border-t border-[var(--ss-workspace-border)] pb-3 pt-3 animate-in slide-in-from-top-2 duration-200">
             <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ss-workspace-muted)]">{t('components.logViewer.eventTypes')}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'SYSTEM', label: t('components.logViewer.system') },
                  { id: 'AGENT_METADATA', label: t('components.logViewer.agentMetadata') },
                  { id: 'AGENT_SAY', label: t('components.logViewer.dialogue') },
                  { id: 'AGENT_ACTION', label: t('components.logViewer.action') },
                  { id: 'ENVIRONMENT', label: t('components.logViewer.environment') },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`px-2 py-1 rounded text-xs border flex items-center gap-1.5 transition-all ${
                      selectedTypes.includes(type.id)
                        ? 'border-[rgba(47,230,166,0.24)] bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]'
                        : 'border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'
                    }`}
                  >
                    {selectedTypes.includes(type.id) && <Check size={10} />}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agents */}
            {!selectedAgent && agents.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ss-workspace-muted)]">{t('components.logViewer.relatedAgents')}</div>
                <div className="flex flex-wrap gap-2">
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1.5 transition-all pl-1 ${
                        selectedAgents.includes(agent.id)
                          ? 'border-[rgba(47,230,166,0.24)] bg-[rgba(47,230,166,0.14)] text-[var(--ss-workspace-heading)]'
                          : 'border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] text-[var(--ss-workspace-muted)] hover:text-[var(--ss-workspace-heading)]'
                      }`}
                    >
                      <img src={agent.avatarUrl} alt="" className="w-4 h-4 rounded-full bg-slate-100" />
                      {getAgentDisplayName(agent)}
                      {selectedAgents.includes(agent.id) && <Check size={10} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--ss-workspace-muted)] underline decoration-[var(--ss-workspace-border)] underline-offset-2 hover:text-[var(--ss-workspace-heading)]"
              >
                {t('components.logViewer.clearAllFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className={`ss-logviewer__body ${viewMode === ViewMode.TIMELINE ? 'pl-10' : ''}`}>
        {viewMode === ViewMode.TIMELINE && filteredLogs.length > 0 && (
           <div className="absolute bottom-0 left-[36px] top-0 -z-0 w-0.5 bg-[var(--ss-workspace-topology-link)]"></div>
        )}
        
        {filteredLogs.length > 0 ? (
          filteredLogs.map(log => {
             // Find corresponding node worldTime if available (optional enhancement)
             const node = nodeLookup.get(log.nodeId);
             return (
               <MemoLogItem
                 key={log.id}
                 entry={log}
                 mode={viewMode}
                 nodeWorldTime={node?.worldTime}
                 agents={agents}
                 scenarioParams={scenarioParams}
               />
             );
          })
        ) : hasActiveFilters ? (
          <div className="ss-stage__empty is-filtered">
            <Search size={26} className="ss-stage__empty-icon" />
            <div className="ss-stage__empty-title">
              {selectedAgent ? t("controlRoom.noRoleEvents") : t("controlRoom.noBranchEvents")}
            </div>
            <p className="ss-stage__empty-copy">
              {isZh
                ? "当前筛选条件下没有匹配记录，清空筛选后可回到完整事件流。"
                : "No records match the current filters. Clear the filters to return to the full event stream."}
            </p>
            <button onClick={clearFilters} className="ss-button-secondary">
              {t('components.logViewer.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="ss-stage__empty">
            <Activity size={28} className="ss-stage__empty-icon" />
            <div className="ss-stage__empty-title">
              {selectedAgent
                ? (isZh ? "该角色暂时还没有新活动" : "No role activity yet")
                : (isZh ? "当前还没有分支活动" : "No branch activity yet")}
            </div>
            <p className="ss-stage__empty-copy">
              {selectedAgent
                ? (isZh
                    ? "继续模拟后，这里会显示该角色的最新动作、状态变化与记忆片段。"
                    : "Continue the simulation to populate this view with the role's latest actions, state changes, and memory fragments.")
                : (isZh
                    ? "继续模拟后，这里会依时间线展示世界状态更新、分支事件与关键干预记录。创建分支后，也能在这里对比不同路径的变化。"
                    : "Continue the simulation to populate this area with world-state updates, branch events, and intervention records. After branching, this stage also helps compare how paths diverge.")}
            </p>
            {!selectedAgent ? (
              <div className="ss-stage__empty-grid">
                <div className="ss-stage__empty-card">
                  <strong>{isZh ? "时间线" : "Timeline"}</strong>
                  <span>
                    {isZh
                      ? "按时间顺序记录新的世界状态与事件。"
                      : "Follow new world-state updates and events in time order."}
                  </span>
                </div>
                <div className="ss-stage__empty-card">
                  <strong>{isZh ? "分支事件" : "Branch events"}</strong>
                  <span>
                    {isZh
                      ? "创建分支后，在这里查看不同路径如何分化。"
                      : "See how different paths diverge after creating a branch."}
                  </span>
                </div>
                <div className="ss-stage__empty-card">
                  <strong>{isZh ? "干预记录" : "Interventions"}</strong>
                  <span>
                    {isZh
                      ? "主持干预与关键操作会被收束到同一观察区。"
                      : "Interventions and key operator actions appear in the same observation area."}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="ss-logviewer__footer flex justify-between text-[10px]">
        <span>{t('components.logViewer.showingRecords', { count: filteredLogs.length })}</span>
        {hasActiveFilters && <span>{t('components.logViewer.filterActive')}</span>}
      </div>
    </div>
  );
};
