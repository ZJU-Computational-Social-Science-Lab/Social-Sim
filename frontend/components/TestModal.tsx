/**
 * Test Modal Component
 *
 * Simple test modal to verify state management and rendering.
 */

import React from 'react';
import { useSimulationStore } from '../store';

export const TestModal: React.FC = () => {
  const isWizardOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);

  console.log('[TestModal] Rendered, isWizardOpen:', isWizardOpen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            ExperimentBuilder Modal Test
          </h2>
          <button
            onClick={() => toggleWizard(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div>
            <p className="text-gray-600">
              isWizardOpen: <strong>{String(isWizardOpen)}</strong>
            </p>
            <p className="text-gray-600">
              <button onClick={() => toggleWizard(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Open ExperimentBuilder Modal
              </button>
              <button onClick={() => toggleWizard(false)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                Close Modal
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default TestModal;
