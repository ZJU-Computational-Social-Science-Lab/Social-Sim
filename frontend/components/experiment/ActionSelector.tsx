/**
 * Action Selector Component
 *
 * A reusable dropdown component for selecting actions from the structured list.
 * Displays selected actions as removable chips and provides a dropdown
 * for selecting from available action types.
 */

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { fetchAvailableActionTypes, ActionType } from '../../services/experiment-templates';

interface ActionSelectorProps {
  /** Currently selected action values */
  selectedActions: string[];
  /** Callback when selection changes */
  onSelectionChange: (actions: string[]) => void;
  /** Maximum number of actions that can be selected */
  maxActions?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Label for the selector */
  label?: string;
}

export const ActionSelector: React.FC<ActionSelectorProps> = ({
  selectedActions,
  onSelectionChange,
  maxActions = 10,
  disabled = false,
  label = 'Available Actions',
}) => {
  const [availableActions, setAvailableActions] = useState<ActionType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available actions on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAvailableActionTypes()
      .then(data => {
        setAvailableActions(data.actions);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load action types:', err);
        setError('Failed to load actions');
        setLoading(false);
        // Set fallback actions so the component still works
        setAvailableActions([
          { value: 'cooperate', label: 'Cooperate', description: 'Cooperate with other players' },
          { value: 'defect', label: 'Defect', description: 'Act in self-interest' },
        ]);
      });
  }, []);

  const toggleAction = (actionValue: string) => {
    const isSelected = selectedActions.includes(actionValue);
    let newSelection: string[];

    if (isSelected) {
      newSelection = selectedActions.filter(a => a !== actionValue);
    } else if (selectedActions.length < maxActions) {
      newSelection = [...selectedActions, actionValue];
    } else {
      return; // Max reached
    }

    onSelectionChange(newSelection);
  };

  const removeAction = (actionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = selectedActions.filter(a => a !== actionValue);
    onSelectionChange(newSelection);
  };

  const getActionLabel = (value: string): string => {
    const option = availableActions.find(a => a.value === value);
    return option?.label || value;
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Selected Actions Display */}
      <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-md min-h-[60px] bg-gray-50">
        {selectedActions.length === 0 ? (
          <span className="text-sm text-gray-400">
            {loading ? 'Loading actions...' : 'Select actions below...'}
          </span>
        ) : (
          selectedActions.map(action => (
            <span
              key={action}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {getActionLabel(action)}
              <button
                onClick={(e) => removeAction(action, e)}
                className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                disabled={disabled}
                type="button"
              >
                <X size={14} />
              </button>
            </span>
          ))
        )}
      </div>

      {error && (
        <div className="text-xs text-amber-600">
          {error} - Using fallback options
        </div>
      )}

      {/* Available Actions Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-left disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm text-gray-700">
            {loading ? 'Loading actions...' : isOpen ? 'Select an action...' : `Add action... (${selectedActions.length}/${maxActions})`}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {availableActions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No actions available
              </div>
            ) : (
              availableActions.map(action => {
                const isSelected = selectedActions.includes(action.value);
                const isDisabled = !isSelected && selectedActions.length >= maxActions;

                return (
                  <button
                    key={action.value}
                    onClick={() => !isDisabled && toggleAction(action.value)}
                    disabled={isDisabled}
                    type="button"
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                      isSelected
                        ? 'bg-green-50 text-green-900'
                        : isDisabled
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <span className="flex-1">
                      <div className={`font-medium text-sm ${isSelected ? 'text-green-700' : 'text-gray-900'}`}>
                        {action.label}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                        {action.description}
                      </div>
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Max actions hint */}
      {selectedActions.length >= maxActions && (
        <div className="text-xs text-amber-600">
          Maximum {maxActions} actions selected. Remove an action to add more.
        </div>
      )}
    </div>
  );
};
