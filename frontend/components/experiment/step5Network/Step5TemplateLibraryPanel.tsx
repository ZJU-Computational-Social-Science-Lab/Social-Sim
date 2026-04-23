import { Search } from 'lucide-react';
import type { TFunction } from 'i18next';
import { emitStepFiveGuide, presetIcons, type PresetMetaMap, type PresetType } from './utils';

interface Step5TemplateLibraryPanelProps {
  t: TFunction;
  isZh: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filteredPresets: PresetType[];
  selectedPreset: PresetType | null;
  presetMeta: PresetMetaMap;
  applyPreset: (preset: PresetType) => void;
}

export function Step5TemplateLibraryPanel({
  t,
  isZh,
  searchQuery,
  setSearchQuery,
  filteredPresets,
  selectedPreset,
  presetMeta,
  applyPreset,
}: Step5TemplateLibraryPanelProps) {
  return (
    <section className="ss-workflow-panel ss-guide-focus-target" id="ss-step5-template-library">
      <div className="ss-workflow-panel__head">
        <div>
          <div className="ss-workflow-kicker">{t('experimentBuilder.step5.networkPresets')}</div>
          <h2 className="ss-workflow-panel__title">
            {isZh ? '选择关系结构' : 'Choose a relationship structure'}
          </h2>
          <p className="ss-workflow-panel__copy">
            {isZh
              ? '从一个已有连接方式出发，快速决定智能体如何彼此接触。'
              : 'Start from a familiar topology and decide how agents can reach one another.'}
          </p>
        </div>
      </div>

      <div className="ss-structure-workflow__search">
        <Search size={16} />
        <input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            emitStepFiveGuide({ type: 'interaction' });
          }}
          placeholder={isZh ? '搜索关系结构模板' : 'Search structure templates'}
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
                className={`ss-structure-workflow__template-card${isSelected ? ' is-selected' : ''}`}
              >
                <div className="ss-structure-workflow__template-head">
                  <span className="ss-structure-workflow__template-icon">
                    <Icon size={16} />
                  </span>
                  {isSelected ? (
                    <span className="ss-structure-workflow__template-state">{isZh ? '已选' : 'Selected'}</span>
                  ) : null}
                </div>
                <div className="ss-structure-workflow__template-title">
                  {t(`experimentBuilder.step5.presets.${translationKey}.name`, {
                    defaultValue: isZh && preset === 'custom' ? '自定义结构' : defaultLabel,
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
  );
}
