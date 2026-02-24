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
import { Info } from 'lucide-react';

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

  // Get action description for tooltip
  const getActionDescription = (action: string): string => {
    const descriptions: Record<string, string> = {
      cooperate: "Work together with the other player",
      defect: "Act in your own self-interest",
      hunt_stag: "Hunt the large stag (requires cooperation)",
      hunt_hare: "Hunt the small hare (can do alone)",
      heads: "Choose Heads",
      tails: "Choose Tails",
      soccer: "Go to the soccer game",
      ballet: "Go to the ballet",
    };
    return descriptions[action] || `Choose ${formatActionName(action)}`;
  };

  return (
    <div className="space-y-4">
      {/* Explanation Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>How to read this matrix:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside text-blue-700">
              <li><strong>Rows</strong> = Your choice (Player 1)</li>
              <li><strong>Columns</strong> = Opponent's choice (Player 2)</li>
              <li><strong>Cell values</strong> = Points you receive when both players make those choices</li>
            </ul>
          </div>
        </div>

        {matrixMeta.symmetric ? (
          <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
            <strong>Symmetric game:</strong> Both players get the same payoff shown in each cell.
            Example: If you both choose "Cooperate", you each get that many points.
          </div>
        ) : (
          <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
            <strong>Asymmetric game:</strong> Each cell shows two values:
            <span className="font-medium"> Row</span> = Player 1's payoff,
            <span className="font-medium"> Col</span> = Player 2's payoff.
          </div>
        )}
      </div>

      {/* Action Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">What each action means:</h4>
        <div className="flex flex-wrap gap-3">
          {[...matrixMeta.rows, ...matrixMeta.cols].filter((v, i, a) => a.indexOf(v) === i).map(action => (
            <div key={action} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 bg-white px-2 py-0.5 rounded border">
                {formatActionName(action)}
              </span>
              <span className="text-gray-600">{getActionDescription(action)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* The Matrix */}
      <div className="overflow-x-auto">
        <div className="text-sm text-gray-600 mb-2 italic">
          Read: "If I choose [row] and they choose [column], I get [value] points"
        </div>
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-200 text-gray-900 font-semibold">
                <div className="text-xs text-gray-500">I choose ↓</div>
                <div className="text-xs text-gray-500">They choose →</div>
              </th>
              {matrixMeta.cols.map(col => (
                <th key={col} className="border p-2 bg-gray-200 text-gray-900 font-semibold min-w-32">
                  <div>{formatActionName(col)}</div>
                  <div className="text-xs text-gray-500 font-normal">{getActionDescription(col)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixMeta.rows.map(row => (
              <tr key={row}>
                <th className="border p-2 bg-gray-200 text-gray-900 font-semibold min-w-32">
                  <div>{formatActionName(row)}</div>
                  <div className="text-xs text-gray-500 font-normal">{getActionDescription(row)}</div>
                </th>
                {matrixMeta.cols.map(col => {
                  const cellKey = getCellKey(row, col);
                  const paramKey = matrixMeta.cells[cellKey];
                  const value = parameters[paramKey] ?? 0;

                  return (
                    <td key={col} className="border p-2 bg-white">
                      {matrixMeta.symmetric ? (
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              onChange(paramKey, parseFloat(e.target.value) || 0)
                            }
                            disabled={disabled}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500 mt-1">points each</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-600 font-medium">P1:</span>
                            <input
                              type="number"
                              value={parameters[`${paramKey}_row`] ?? value}
                              onChange={(e) =>
                                onChange(`${paramKey}_row`, parseFloat(e.target.value) || 0)
                              }
                              disabled={disabled}
                              className="w-14 px-1 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-600 font-medium">P2:</span>
                            <input
                              type="number"
                              value={parameters[`${paramKey}_col`] ?? value}
                              onChange={(e) =>
                                onChange(`${paramKey}_col`, parseFloat(e.target.value) || 0)
                              }
                              disabled={disabled}
                              className="w-14 px-1 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
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

      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
        💡 <strong>Tip:</strong> These payoff values are shown to agents in their prompts, helping them understand the game incentives.
      </div>
    </div>
  );
}
