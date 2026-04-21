/**
 * Resource configuration component for Public Goods Game.
 *
 * Allows researchers to customize the resource type (tokens, money, etc.)
 * and action labels. Supports preset options and custom resource names.
 *
 * Exports: ResourceConfig (default)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface ResourceConfigProps {
  values: {
    resource_name: string;
    resource_name_custom: string;
    initial_amount: number;
    multiplier: number;
    action_name: string;
    action_description: string;
  };
  onChange: (key: string, value: string | number) => void;
}

export const ResourceConfig: React.FC<ResourceConfigProps> = ({
  values,
  onChange,
}) => {
  const { t } = useTranslation();

  const resourceOptions = [
    { value: 'Tokens', label: t('experimentBuilder.resourceConfig.resourceOptions.tokens') },
    { value: 'Money', label: t('experimentBuilder.resourceConfig.resourceOptions.money') },
    { value: 'Effort Points', label: t('experimentBuilder.resourceConfig.resourceOptions.effortPoints') },
    { value: 'Time (hours)', label: t('experimentBuilder.resourceConfig.resourceOptions.timeHours') },
    { value: 'Resources', label: t('experimentBuilder.resourceConfig.resourceOptions.resources') },
    { value: 'Custom', label: t('experimentBuilder.resourceConfig.resourceOptions.custom') },
  ];

  const showCustomField = values.resource_name === 'Custom';

  return (
    <div className="space-y-6">
      {/* Resource Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">
          {t('experimentBuilder.resourceConfig.title')}
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.resourceConfig.resourceNameLabel')}
          </label>
          <select
            value={values.resource_name}
            onChange={(e) => onChange('resource_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {resourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {showCustomField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('experimentBuilder.resourceConfig.customResourceLabel')}
            </label>
            <input
              type="text"
              value={values.resource_name_custom}
              onChange={(e) => onChange('resource_name_custom', e.target.value)}
              placeholder={t('experimentBuilder.resourceConfig.customResourcePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.resourceConfig.initialAmountLabel')}: {values.initial_amount}
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={values.initial_amount}
            onChange={(e) => onChange('initial_amount', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.resourceConfig.multiplierLabel')}: {values.multiplier}
          </label>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={values.multiplier}
            onChange={(e) => onChange('multiplier', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Action Labels */}
      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700">
          {t('experimentBuilder.resourceConfig.actionLabelsTitle')}
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.resourceConfig.actionNameLabel')}
          </label>
          <input
            type="text"
            value={values.action_name}
            onChange={(e) => onChange('action_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.resourceConfig.actionDescriptionLabel')}
          </label>
          <input
            type="text"
            value={values.action_description}
            onChange={(e) => onChange('action_description', e.target.value)}
            placeholder={t('experimentBuilder.resourceConfig.actionDescriptionPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('experimentBuilder.resourceConfig.actionDescriptionHint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResourceConfig;
