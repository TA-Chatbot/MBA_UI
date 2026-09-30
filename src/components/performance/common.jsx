// Small building blocks shared by the performance sections: section cards,
// table classes, chart container (fixed width while printing), trace links.
import React, { createContext, useContext } from 'react';
import { ResponsiveContainer } from 'recharts';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { displayUser, NO_USER_LABEL } from './format';

// Categorical slots in fixed order (validated palette; see dataviz reference).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

export const AXIS_TICK = { fill: '#52514e', fontSize: 12 };
export const GRID_STROKE = '#e7e5e4';
export const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 },
  labelStyle: { color: '#111827', fontWeight: 600 },
};
// Legend text stays in ink colour; the swatch next to it carries the series colour.
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
  formatter: (value) => <span style={{ color: '#374151' }}>{value}</span>,
};

/** True while the page is being printed: charts switch to a fixed width. */
export const PrintContext = createContext(false);

export const PRINT_CHART_WIDTH = 680;

export function ChartBox({ height = 260, label, children }) {
  const printing = useContext(PrintContext);
  if (printing) {
    return (
      <div className="perf-chart" style={{ width: PRINT_CHART_WIDTH, height }} role="img" aria-label={label}>
        {React.cloneElement(children, { width: PRINT_CHART_WIDTH, height })}
      </div>
    );
  }
  return (
    <div className="perf-chart" style={{ width: '100%', height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function Section({ id, title, subtitle, actions, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="perf-section perf-card bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Block({ title, note, actions, children, className = '', flush = false }) {
  return (
    <div className={`perf-block ${flush ? '' : 'mt-6 first:mt-0'} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
            {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyNote({ children = 'Không có dữ liệu.' }) {
  return <p className="text-sm text-gray-500 italic py-2">{children}</p>;
}

/** Two-option segmented control ("Requests | Users"). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="perf-no-print inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            value === opt.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled number, used for summary rows inside sections. */
export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

export function traceUrl(base, traceId) {
  if (!base || !traceId) return null;
  return `${base}${base.endsWith('/') ? '' : '/'}${encodeURIComponent(traceId)}`;
}

export function TraceLink({ base, traceId }) {
  const href = traceUrl(base, traceId);
  if (!href) return <span className="text-gray-400">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
      title={`Mở trace ${traceId} trên Langfuse`}
    >
      Trace <FaExternalLinkAlt className="text-[10px]" aria-hidden="true" />
    </a>
  );
}

export function UserId({ row, hideIds }) {
  const text = displayUser(row, hideIds);
  const missing = text === NO_USER_LABEL;
  return (
    <span className={missing ? 'text-gray-400 italic' : 'font-mono text-xs text-gray-800'} data-testid="perf-user-id">
      {text}
    </span>
  );
}

/** Inline proportion bar for share columns. */
export function ShareBar({ value, color = SERIES[0] }) {
  const width = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden inline-block align-middle" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

/** `arr` when it is an array, else []. The contract allows empty arrays and nulls anywhere. */
export const list = (arr) => (Array.isArray(arr) ? arr : []);
