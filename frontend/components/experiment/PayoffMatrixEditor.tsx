/**
 * Payoff matrix editor for 2-player game theory scenarios.
 *
 * Renders an N×N table for editing game payoffs.
 * Supports symmetric mode (one value per cell) and asymmetric mode (two values).
 *
 * Exports: PayoffMatrixEditor (default)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface MatrixCell {
  symmetric: boolean;
  rows: string[];
  cols: string[];
  cells: Record<string, string>; // Maps "row:col" to parameter name
}

interface PayoffMatrixEditorProps {
  matrixMeta: MatrixCell;
  parameters: Record<string, number>;
  onChange: (key: string, value: number) => void;
  disabled?: boolean;
}

export default function PayoffMatrixEditor({
  matrixMeta,
  parameters,
  onChange,
  disabled = false
}: PayoffMatrixEditorProps) {
  const { t } = useTranslation();

  const formatActionName = (action: string): string => {
    return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ');
  };

  const getCellKey = (row: string, col: string): string => {
    return `${row}:${col}`;
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        {matrixMeta.symmetric
          ? 'Symmetric payoff matrix: both players receive the same payoff for each outcome.'
          : 'Asymmetric payoff matrix: row player and column player may receive different payoffs.'}
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-100"></th>
              {matrixMeta.cols.map(col => (
                <th key={col} className="border p-2 bg-gray-100 min-w-32">
                  {formatActionName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixMeta.rows.map(row => (
              <tr key={row}>
                <th className="border p-2 bg-gray-100 min-w-32">
                  {formatActionName(row)}
                </th>
                {matrixMeta.cols.map(col => {
                  const cellKey = getCellKey(row, col);
                  const paramKey = matrixMeta.cells[cellKey];
                  const value = parameters[paramKey] ?? 0;

                  return (
                    <td key={col} className="border p-2">
                      {matrixMeta.symmetric ? (
                        <input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            onChange(paramKey, parseFloat(e.target.value) || 0)
                          }
                          disabled={disabled}
                          className="w-20 px-2 py-1 border rounded text-center"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-gray-500">Row:</div>
                          <input
                            type="number"
                            value={parameters[`${paramKey}_row`] ?? value}
                            onChange={(e) =>
                              onChange(`${paramKey}_row`, parseFloat(e.target.value) || 0)
                            }
                            disabled={disabled}
                            className="w-16 px-1 py-1 border rounded text-center text-sm"
                          />
                          <div className="text-xs text-gray-500">Col:</div>
                          <input
                            type="number"
                            value={parameters[`${paramKey}_col`] ?? value}
                            onChange={(e) =>
                              onChange(`${paramKey}_col`, parseFloat(e.target.value) || 0)
                            }
                            disabled={disabled}
                            className="w-16 px-1 py-1 border rounded text-center text-sm"
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        These payoff values are injected into each agent's prompt.
      </div>
    </div>
  );
}
