/**
 * Multi-select checkboxes field.
 *
 * Exports: MultiSelectField (default)
 */

import React from 'react';

type MultiSelectOption = string | { value: string; label: string };

interface MultiSelectFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  disabled?: boolean;
}

export default function MultiSelectField({
  value,
  onChange,
  options,
  disabled = false
}: MultiSelectFieldProps) {
  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const normalizedOption =
          typeof option === 'string' ? { value: option, label: option } : option;

        return (
          <label key={normalizedOption.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(normalizedOption.value)}
              onChange={() => toggleOption(normalizedOption.value)}
              disabled={disabled}
              className="w-4 h-4 rounded"
            />
            <span>{normalizedOption.label}</span>
          </label>
        );
      })}
    </div>
  );
}
