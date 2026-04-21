import type { TFunction } from 'i18next';
import { Button } from '../../ui/button';
import { SummaryInfoCard } from '../workflow/SummaryInfoCard';

interface MiniPreviewNode {
  id: string;
  x: number;
  y: number;
}

interface MiniPreviewEdge {
  key: string;
  sourceNode: MiniPreviewNode;
  targetNode: MiniPreviewNode;
}

interface MiniPreview {
  width: number;
  height: number;
  nodes: MiniPreviewNode[];
  edges: MiniPreviewEdge[];
  remaining: number;
}

interface Step5SelectionSummaryPanelProps {
  t: TFunction;
  isZh: boolean;
  hasSelectedStructure: boolean;
  currentPatternLabel: string;
  selectedPresetSummary: string | null;
  selectedPresetTags: string[];
  agentIdsLength: number;
  edgeCount: number;
  density: number;
  miniPreview: MiniPreview;
  openDetailSurface: (target: 'overview' | 'memberConnections') => void;
  openGraphDrawer: () => void;
}

export function Step5SelectionSummaryPanel({
  t,
  isZh,
  hasSelectedStructure,
  currentPatternLabel,
  selectedPresetSummary,
  selectedPresetTags,
  agentIdsLength,
  edgeCount,
  density,
  miniPreview,
  openDetailSurface,
  openGraphDrawer,
}: Step5SelectionSummaryPanelProps) {
  return (
    <section
      className="ss-workflow-panel ss-guide-focus-target ss-structure-workflow__summary-panel"
      id="ss-step5-selection-summary"
    >
      {hasSelectedStructure ? (
        <>
          <div className="ss-workflow-panel__head">
            <div>
              <div className="ss-workflow-kicker">{t('experimentBuilder.step5.summaryPattern')}</div>
              <h2 className="ss-workflow-panel__title">{currentPatternLabel}</h2>
              <p className="ss-workflow-panel__copy">
                {selectedPresetSummary ||
                  (isZh
                    ? '当前结构已经配置完成，可以先查看摘要，再决定是否展开更细设置。'
                    : 'The structure is configured. Review the summary first and open the details only when you need them.')}
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
            <SummaryInfoCard label={isZh ? '当前模型' : 'Current model'} value={currentPatternLabel} />
            <SummaryInfoCard label={isZh ? '智能体数' : 'Agents'} value={agentIdsLength} />
            <SummaryInfoCard label={isZh ? '连线数' : 'Links'} value={edgeCount} />
            <SummaryInfoCard label={t('components.networkEditorModal.density')} value={`${(density * 100).toFixed(0)}%`} />
          </div>

          <div className="ss-structure-workflow__preview-card">
            <div className="ss-structure-workflow__preview-copy">
              <strong>{isZh ? '网络概览缩略图' : 'Network overview preview'}</strong>
              <span>
                {isZh
                  ? '首屏先看结构差异；完整图谱放到二级抽屉中查看。'
                  : 'Use the summary first; the full graph lives in a secondary drawer.'}
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
              onClick={() => openDetailSurface('overview')}
            >
              {isZh ? '查看网络概览' : 'View overview'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={openGraphDrawer}>
              {isZh ? '打开完整图谱' : 'Open full graph'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openDetailSurface('memberConnections')}
            >
              {isZh ? '查看智能体连接详情' : 'View agent connections'}
            </Button>
          </div>
        </>
      ) : (
        <div className="ss-structure-workflow__summary-empty">
          <div className="ss-workflow-kicker">{isZh ? '当前选择摘要' : 'Current selection'}</div>
          <h2 className="ss-workflow-panel__title">
            {isZh ? '先选一个结构模板' : 'Pick a structure template first'}
          </h2>
          <p className="ss-workflow-panel__copy">
            {isZh
              ? '模板区只保留常见结构。先做结构决策，再按需查看概览和完整图谱。'
              : 'Pick a familiar topology first, then open the overview and full graph only when needed.'}
          </p>
          <div className="ss-workflow-summary-grid">
            <SummaryInfoCard label={isZh ? '智能体数' : 'Agents'} value={agentIdsLength} />
            <SummaryInfoCard label={isZh ? '连线数' : 'Links'} value={edgeCount} />
            <SummaryInfoCard
              label={t('components.networkEditorModal.density')}
              value={`${(density * 100).toFixed(0)}%`}
            />
          </div>
        </div>
      )}
    </section>
  );
}
