import { useState } from 'react';
import Papa from 'papaparse';
import { Agent, LLMConfig } from '../../../types';

export const useAgentImporter = (t: (key: string, params?: any) => string, defaultLlmConfig: LLMConfig) => {
  const [importMode, setImportMode] = useState<'default' | 'custom' | 'generate'>('generate');
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const currentConfig = defaultLlmConfig;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        type RawItem = { row: any; label: string };
        let rawItems: RawItem[] = [];
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.agents;
          if (!Array.isArray(items)) {
            throw new Error(t('wizard.errors.jsonFormatError'));
          }
          rawItems = items.map((row, index) => ({
            row,
            label: t('wizard.errors.itemLabel', { index: index + 1 })
          }));
        } else if (file.name.endsWith('.csv')) {
          const result = Papa.parse(text, {
            header: false,
            skipEmptyLines: true
          });
          if (result.errors.length > 0) {
            throw new Error(
              t('wizard.errors.csvParseError', { message: result.errors[0].message || t('common.loading') })
            );
          }
          const rows = result.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error(t('wizard.errors.csvEmpty'));
          }
          const firstRow = (rows[0] || []).map((v: any) => String(v ?? '').trim());
          const headerLooksLike =
            firstRow.length >= 2 &&
            (firstRow[0] === 'agent_name' ||
              firstRow[1] === 'agent_description' ||
              firstRow[0] === 'name' ||
              firstRow[1] === 'description');
          const header = headerLooksLike ? firstRow : null;
          const dataRows = header ? rows.slice(1) : rows;
          if (dataRows.length === 0) {
            throw new Error(t('wizard.errors.csvEmpty'));
          }
          rawItems = dataRows.map((row: any, index: number) => {
            const values = Array.isArray(row) ? row : Object.values(row);
            if (header) {
              const obj: Record<string, any> = {};
              header.forEach((key, i) => {
                if (key) obj[key] = values[i];
              });
              return { row: obj, label: t('wizard.errors.rowLabel', { index: index + 2 }) };
            }
            const obj: Record<string, any> = {
              agent_name: values[0],
              agent_description: values[1]
            };
            values.slice(2).forEach((val, i) => {
              obj[`attribute${i + 1}`] = val;
            });
            return { row: obj, label: t('wizard.errors.rowLabel', { index: index + 1 }) };
          });
        } else {
          throw new Error(t('wizard.errors.onlySupportCsvJson'));
        }
        const errors: string[] = [];
        const agents: Agent[] = [];
        rawItems.forEach(({ row, label }, index) => {
          if (!row || typeof row !== 'object') {
            errors.push(`${label}：${t('wizard.errors.dataFormatError')}`);
            return;
          }
          const name = row.agent_name ?? row.name;
          const profile = row.agent_description ?? row.profile;
          if (!name || !profile) {
            errors.push(`${label}：${t('wizard.errors.missingRequiredFields')}`);
            return;
          }
          const reservedKeys = new Set([
            'agent_name', 'agent_description', 'name', 'profile', 'id', 'role',
            'avatarUrl', 'properties', 'history', 'memory', 'knowledgeBase', 'llmConfig'
          ]);
          const extraAttributes = Object.fromEntries(
            Object.entries(row).filter(([key]) => !reservedKeys.has(key))
          );
          const properties = {
            ...(row.properties || {}),
            ...extraAttributes
          };
          agents.push({
            id: row.id || `imported_${Date.now()}_${index}`,
            name,
            role: row.role || t('wizard.defaults.citizen'),
            avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            profile,
            properties,
            history: row.history || {},
            memory: row.memory || [],
            knowledgeBase: row.knowledgeBase || [],
            llmConfig: row.llmConfig || currentConfig
          });
        });
        setCustomAgents(agents);
        if (errors.length > 0) {
          const detail = errors.slice(0, 5).join('；');
          const more = errors.length > 5
            ? t('wizard.errors.additionalErrors', { count: errors.length - 5 })
            : '';
          setImportError(
            t('wizard.errors.importedWithErrors', {
              count: agents.length,
              errorCount: errors.length,
              detail,
              more
            })
          );
        } else {
          setImportError(null);
        }
      } catch (err) {
        setImportError((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return {
    importMode, setImportMode, customAgents, setCustomAgents,
    importError, setImportError, handleFileUpload
  };
};
