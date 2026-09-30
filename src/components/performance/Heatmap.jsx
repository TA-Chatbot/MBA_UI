// CSS-grid heatmap: colour intensity by value (one-hue blue ramp), value in the cell.
import React, { useContext } from 'react';
import { fmtInt, isNum } from './format';
import { PrintContext } from './common';

// Sequential blue, light -> dark (dataviz reference ramp, steps 100..700).
const RAMP = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];
const EMPTY_BG = '#f5f5f4';
const EMPTY_FG = '#b8b6b0';

export function heatColor(value, max) {
  if (!isNum(value) || value <= 0 || !isNum(max) || max <= 0) {
    return { background: EMPTY_BG, color: EMPTY_FG };
  }
  const t = Math.min(1, value / max);
  const idx = Math.max(0, Math.ceil(t * RAMP.length) - 1);
  return { background: RAMP[idx], color: idx >= 6 ? '#ffffff' : '#0d2745' };
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
        <div role="columnheader" />
        {Array.from({ length: nCols }, (_, j) => (
          <div key={`c${j}`} role="columnheader" className="text-center text-gray-500 font-medium pb-1">
            {colLabels[j] ?? j}
          </div>
        ))}
        {showTotals && <div role="columnheader" className="text-right text-gray-500 font-medium pb-1 pl-2">Tổng</div>}

        {safeRows.map((row, i) => {
          const total = row.filter(isNum).reduce((s, v) => s + v, 0);
          return (
            <React.Fragment key={`r${i}`}>
              <div role="rowheader" className="pr-2 text-gray-700 font-medium flex items-center truncate" title={rowLabels[i]}>
                {rowLabels[i] ?? i}
              </div>
              {Array.from({ length: nCols }, (_, j) => {
                const v = row[j];
                const style = heatColor(v, max);
                return (
                  <div
                    key={`c${j}`}
                    role="cell"
                    className="perf-heat-cell h-7 rounded-[3px] flex items-center justify-center tabular-nums"
                    style={style}
                    title={cellTitle ? cellTitle(i, j, v) : undefined}
                  >
                    {isNum(v) ? fmtInt(v) : ''}
                  </div>
                );
              })}
              {showTotals && (
                <div role="cell" className="pl-2 text-right text-gray-900 font-semibold tabular-nums flex items-center justify-end">
                  {fmtInt(total)}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500" aria-hidden="true">
        <span>Ít</span>
        <div className="flex">
          {RAMP.filter((_, k) => k % 2 === 0).map((c) => (
            <span key={c} className="perf-heat-swatch inline-block w-4 h-2.5" style={{ background: c }} />
          ))}
        </div>
        <span>Nhiều (tối đa {fmtInt(max)})</span>
      </div>
    </div>
  );
}
