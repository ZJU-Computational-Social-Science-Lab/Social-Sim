/**
 * Validation Alert Component
 *
 * Displays real-time validation errors
 * for experiment builder configuration.
 */

import React from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { AlertTriangle } from 'lucide-react';

export const ValidationAlert: React.FC = () => {
  const { validationErrors } = useExperimentBuilder();

  // validationErrors is now Record<string, string>
  const errorKeys = Object.keys(validationErrors);

  if (errorKeys.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Errors */}
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-800 mb-1">
            Configuration Issues
          </h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errorKeys.map((key) => (
              <li key={key}>• {validationErrors[key]}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ValidationAlert;
