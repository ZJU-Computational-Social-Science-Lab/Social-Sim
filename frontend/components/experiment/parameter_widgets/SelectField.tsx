/**
 * Dropdown select field for enum options.
 *
 * Exports: SelectField (default)
 */

import React from 'react';

type SelectOption = string | { value: string; label: string };

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export default function SelectField({
  value,
  onChange,
  options,
  disabled = false
}: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 border rounded-lg"
    >
      {options.map((option) => {
        const normalizedOption =
          typeof option === 'string' ? { value: option, label: option } : option;

        return (
          <option key={normalizedOption.value} value={normalizedOption.value}>
            {normalizedOption.label}
          </option>
        );
      })}
    </select>
  );
}
