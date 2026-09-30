import React from 'react';
import {
  fmtInt, fmtSeconds, fmtPercent, fmtCompact, fmtUsd, fmtChange,
  LOWER_IS_BETTER, TONE_CLASS, fmtRange,
} from './format';
import { Section } from './common';

export const KPI_DEFS = [
  { key: 'users', label: 'User duy nhất', fmt: fmtInt },
  { key: 'requests', label: 'Generation requests', fmt: fmtInt },
  { key: 'latency_mean', label: 'Latency trung bình', fmt: fmtSeconds },
  { key: 'ttft_mean', label: 'TTFT trung bình', fmt: fmtSeconds },
  { key: 'latency_p95', label: 'Latency p95', fmt: fmtSeconds },
  { key: 'error_rate', label: 'Tỉ lệ lỗi', fmt: (v) => fmtPercent(v, 2) },
  { key: 'sessions', label: 'Phiên hội thoại', fmt: fmtInt },
  { key: 'total_tokens', label: 'Tổng tokens', fmt: fmtCompact, full: fmtInt },
  { key: 'cost', label: 'Chi phí', fmt: fmtUsd },
];

export const INCOMPLETE_COST_TIP = 'Có model chưa có giá — xem Cài đặt';

function IncompleteMarker({ onOpenSettings }) {
  const cls = 'perf-keep-print ml-1.5 align-middle px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold';
  if (!onOpenSettings) {
    return <span className={cls} title={INCOMPLETE_COST_TIP}>chưa đủ*</span>;
  }
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={`${cls} hover:bg-amber-200`}
      title={INCOMPLETE_COST_TIP}
      aria-label={`Chi phí chưa đủ. ${INCOMPLETE_COST_TIP}`}
    >
      chưa đủ*
    </button>
  );
}

function KpiCard({ def, kpi, onOpenSettings }) {
  const value = kpi?.value ?? null;
  const previous = kpi?.previous ?? null;
  const incomplete = def.key === 'cost' && kpi?.incomplete === true;
  const polarity = LOWER_IS_BETTER.has(def.key) ? 'lower-better' : 'higher-better';
  const change = fmtChange(incomplete ? null : (kpi?.change_pct ?? null), polarity);
  return (
    <div className="perf-card perf-kpi rounded-xl border border-gray-200 bg-white p-4" data-testid={`kpi-${def.key}`}>
      <div className="text-xs font-medium text-gray-500">{def.label}</div>
      <div className="mt-1 flex flex-wrap items-center">
        <span
          className="text-2xl font-bold text-gray-900 tabular-nums"
          title={def.full ? def.full(value) : (incomplete ? INCOMPLETE_COST_TIP : undefined)}
        >
          {def.fmt(value)}
        </span>
        {incomplete && <IncompleteMarker onOpenSettings={onOpenSettings} />}
      </div>
      <div className="mt-1 text-xs flex flex-wrap items-baseline gap-x-1.5">
        {incomplete ? (
          <span className="text-gray-500">Kỳ trước: {def.fmt(previous)}</span>
        ) : (
          <>
            <span className={`font-semibold tabular-nums ${TONE_CLASS[change.tone]}`}>{change.text}</span>
            <span className="text-gray-500">so với kỳ trước ({def.fmt(previous)})</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function KpiCards({ kpis, meta, onOpenSettings }) {
  const previous = meta?.previous;
  return (
    <Section
      id="perf-kpis"
      title="Chỉ số chính"
      subtitle={previous ? `So với kỳ trước: ${fmtRange(previous.from, previous.to)}` : undefined}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 perf-kpi-grid">
        {KPI_DEFS.map((def) => (
          <KpiCard key={def.key} def={def} kpi={kpis?.[def.key]} onOpenSettings={onOpenSettings} />
        ))}
      </div>
    </Section>
  );
}
