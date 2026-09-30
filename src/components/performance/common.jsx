// Small building blocks shared by the performance panels. They follow the
// site's own vocabulary (white rounded-lg shadow-lg cards, gray-800 headings,
// red-600 for action and selection, red-50 for hover/selected like the navbar).
import React, { createContext, useContext } from 'react';
import { ResponsiveContainer } from 'recharts';
import { FaExternalLinkAlt, FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';
import { displayUser, NO_USER_LABEL } from './format';

// Categorical slots in fixed order, brand red first. Validated with the dataviz
// validator on white: lightness band, chroma floor, CVD and normal-vision
// separation and 3:1 contrast all pass (worst adjacent CVD ΔE 12.5).
export const SERIES = ['#dc2626', '#2563eb', '#d97706', '#0d9488'];
// Lighter step of slot 1 for a partial (still running) day.
export const SERIES_MUTED = '#fca5a5';

export const AXIS_TICK = { fill: '#6b7280', fontSize: 12 };
export const GRID_STROKE = '#f3f4f6';
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(17, 24, 39, 0.08)',
  },
  labelStyle: { color: '#1f2937', fontWeight: 600 },
  cursor: { fill: 'rgba(220, 38, 38, 0.06)' },
};
// Legend text stays in ink colour; the swatch next to it carries the series colour.
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
  formatter: (value) => <span style={{ color: '#374151' }}>{value}</span>,
};
// Rounded data end, square baseline.
export const BAR_RADIUS = [4, 4, 0, 0];

/** True while the page is being printed: every panel renders, charts at a fixed width. */
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

/** A site card with a heading: one topic block inside a tab. */
export function Section({ id, title, subtitle, actions, icon: Icon, children, className = '' }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`perf-section perf-card bg-white rounded-lg shadow-lg p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {Icon && <Icon className="text-red-600 flex-none" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1 max-w-3xl">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Block({ title, note, actions, children, className = '', flush = false }) {
  return (
    <div className={`perf-block ${flush ? '' : 'mt-8 first:mt-0'} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
            {note && <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">{note}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyNote({ children = 'Không có dữ liệu trong khoảng thời gian này.' }) {
  return <p className="text-sm text-gray-500 py-3">{children}</p>;
}

/** Small segmented switch ("Requests | Users"), selected state like the navbar. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="perf-no-print inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
            value === opt.value ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-red-600'
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
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-800 tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
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
      className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-700 hover:underline whitespace-nowrap"
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
    <div className="h-1.5 w-20 bg-red-50 rounded-full overflow-hidden inline-block align-middle" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

const CHANGE_STYLE = {
  good: 'bg-green-50 text-green-700',
  bad: 'bg-red-50 text-red-700',
  neutral: 'bg-gray-100 text-gray-600',
  none: 'text-gray-400',
};

/** A change vs the previous period (the object fmtChange returns) as an arrow pill. */
export function ChangePill({ change }) {
  if (!change || change.direction === 'none') return <span className="text-gray-400">—</span>;
  const Icon = change.direction === 'up' ? FaArrowUp : change.direction === 'down' ? FaArrowDown : FaMinus;
  const word = change.direction === 'up' ? 'tăng' : change.direction === 'down' ? 'giảm' : 'không đổi';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${CHANGE_STYLE[change.tone]}`}
      title={`${word} ${change.label} so với kỳ trước`}
    >
      <Icon className="text-[10px]" aria-hidden="true" />
      {change.label}
    </span>
  );
}

/** `arr` when it is an array, else []. The contract allows empty arrays and nulls anywhere. */
export const list = (arr) => (Array.isArray(arr) ? arr : []);
