import React from 'react';
import { Upload } from 'lucide-react';
import { Agent } from '../../types';
import { Step2AgentsPreview } from './Step2DemographicsWizard';

export interface Step2FileImportProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  customAgents: Agent[];
  importError: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAgents: () => void;
  t: (key: string) => string;
}

export const Step2FileImport: React.FC<Step2FileImportProps> = ({
  fileInputRef,
  customAgents,
  importError,
  onFileUpload,
  onClearAgents,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="shrink-0" onClick={() => fileInputRef.current?.click()}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept=".json,.csv"
          className="hidden"
        />
        <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50 rounded-lg p-6 text-center cursor-pointer transition-colors group">
          <Upload className="mx-auto text-slate-400 group-hover:text-brand-500 mb-2" size={32} />
          <p className="text-sm font-bold text-slate-700 group-hover:text-brand-600">
            {t('wizard.step2.uploadCsvJson')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t('wizard.step2.requiredFields')}
          </p>
        </div>
      </div>
      {importError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {importError}
        </div>
      )}
      {customAgents.length > 0 && (
        <Step2AgentsPreview
          agents={customAgents}
          onClear={onClearAgents}
          t={t}
        />
      )}
    </div>
  );
};
