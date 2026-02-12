/**
 * Validation Alert Component
 *
 * Displays real-time validation errors and warnings
 * for experiment builder configuration.
 */

import React from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { AlertTriangle, Info } from 'lucide-react';

export const ValidationAlert: React.FC = () => {
  const { validationErrors, validationWarnings } = useExperimentBuilder();

  if (validationErrors.length === 0 && validationWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Errors */}
      {validationErrors.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-800 mb-1">
              Configuration Issues
            </h4>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Warnings */}
      {validationWarnings.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-800 mb-1">
              Recommendations
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {validationWarnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationAlert;
