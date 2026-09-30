// CSS-grid heatmap: colour intensity by value (one-hue red ramp, the site's brand
// hue), value in the cell.
import React, { useContext } from 'react';
import { fmtInt, isNum } from './format';
import { PrintContext } from './common';

// Sequential red, light -> dark (Tailwind red-100..red-900, skipping red-500: neither
// white nor dark ink reaches 4.5:1 on it). Dark red ink up to red-400 (≥ 6:1),
// white from red-600 (≥ 4.8:1).
const RAMP = ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];
const LIGHT_INK_FROM = 4;
const DARK_INK = '#450a0a';
const EMPTY_BG = '#f9fafb';
const EMPTY_FG = '#d1d5db';

export function heatColor(value, max) {
  if (!isNum(value) || value <= 0 || !isNum(max) || max <= 0) {
    return { background: EMPTY_BG, color: EMPTY_FG };
  }
  const t = Math.min(1, value / max);
  const idx = Math.max(0, Math.ceil(t * RAMP.length) - 1);
  return { background: RAMP[idx], color: idx >= LIGHT_INK_FROM ? '#ffffff' : DARK_INK };
}

/**
 * @param rows       number[][] (may be ragged / contain nulls)
 * @param rowLabels  string[]
 * @param colLabels  string[]
 * @param cellTitle  (rowIndex, colIndex, value) => string, for the hover title
 * @param showTotals append a "Tổng" column
 */
export default function Heatmap({
  rows,
  rowLabels = [],
  colLabels = [],
  cellTitle,
  showTotals = false,
  minCellWidth = 28,
  label,
}) {
  const printing = useContext(PrintContext);
  const cellWidth = printing ? Math.min(minCellWidth, 20) : minCellWidth;
  const safeRows = Array.isArray(rows) ? rows.map((r) => (Array.isArray(r) ? r : [])) : [];
  if (safeRows.length === 0) return null;
  const nCols = Math.max(colLabels.length, ...safeRows.map((r) => r.length));
  const max = Math.max(0, ...safeRows.flat().filter(isNum));
  const template = `minmax(3.5rem, max-content) repeat(${nCols}, minmax(${cellWidth}px, 1fr))${
    showTotals ? ' minmax(3.5rem, max-content)' : ''
  }`;

  return (
    <div className="perf-heatmap overflow-x-auto" role="table" aria-label={label}>
      <div className="grid gap-[2px] text-[11px]" style={{ gridTemplateColumns: template, minWidth: printing ? 0 : nCols * (cellWidth + 2) + 120 }}>
        <div role="row" className="contents">
        <div role="columnheader" />
        {Array.from({ length: nCols }, (_, j) => (
          <div key={`c${j}`} role="columnheader" className="text-center text-gray-500 font-medium pb-1">
            {colLabels[j] ?? j}
          </div>
        ))}
        {showTotals && <div role="columnheader" className="text-right text-gray-500 font-medium pb-1 pl-2">Tổng</div>}
        </div>

        {safeRows.map((row, i) => {
          const total = row.filter(isNum).reduce((s, v) => s + v, 0);
          return (
            <div key={`r${i}`} role="row" className="contents">
              <div role="rowheader" className="pr-3 text-gray-700 font-medium flex items-center truncate" title={rowLabels[i]}>
                {rowLabels[i] ?? i}
              </div>
              {Array.from({ length: nCols }, (_, j) => {
                const v = row[j];
                const style = heatColor(v, max);
                return (
                  <div
                    key={`c${j}`}
                    role="cell"
                    className="perf-heat-cell h-7 rounded flex items-center justify-center tabular-nums"
                    style={style}
                    title={cellTitle ? cellTitle(i, j, v) : undefined}
                  >
                    {isNum(v) && v > 0 ? fmtInt(v) : <span className="sr-only">{isNum(v) ? '0' : ''}</span>}
                  </div>
                );
              })}
              {showTotals && (
                <div role="cell" className="pl-2 text-right text-gray-900 font-semibold tabular-nums flex items-center justify-end">
                  {fmtInt(total)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500" aria-hidden="true">
        <span>Ít</span>
        <div className="flex">
          {RAMP.map((c) => (
            <span key={c} className="perf-heat-swatch inline-block w-4 h-2.5" style={{ background: c }} />
          ))}
        </div>
        <span>Nhiều (tối đa {fmtInt(max)})</span>
      </div>
    </div>
  );
}
