// "Chỉ số chính": the period being reported, then every headline number next to
// the previous period — the comparison the weekly meeting actually reads.
import React from 'react';
import {
  fmtInt, fmtSeconds, fmtPercent, fmtCompact, fmtUsd, fmtChange, fmtRange,
  LOWER_IS_BETTER, rangeDays,
} from './format';
import { FaListAlt } from 'react-icons/fa';
import { Section, ChangePill } from './common';

export const KPI_GROUPS = [
  {
    key: 'usage',
    label: 'Sử dụng',
    items: [
      { key: 'requests', label: 'Generation requests', fmt: fmtInt },
      { key: 'users', label: 'User duy nhất', fmt: fmtInt },
      { key: 'sessions', label: 'Phiên hội thoại', fmt: fmtInt },
    ],
  },
  {
    key: 'performance',
    label: 'Hiệu năng',
    items: [
      { key: 'latency_mean', label: 'Latency trung bình', fmt: fmtSeconds },
      { key: 'latency_p95', label: 'Latency p95', fmt: fmtSeconds },
      { key: 'ttft_mean', label: 'Thời gian tới token đầu (TTFT)', fmt: fmtSeconds },
      { key: 'error_rate', label: 'Tỉ lệ lỗi', fmt: (v) => fmtPercent(v, 2) },
    ],
  },
  {
    key: 'cost',
    label: 'Token và chi phí',
    items: [
      // Tokens drive cost: a rise is not good news, so it is shown neutral.
      { key: 'total_tokens', label: 'Tổng tokens', fmt: fmtCompact, full: fmtInt, neutral: true },
      { key: 'cost', label: 'Chi phí', fmt: fmtUsd },
    ],
  },
];

export const KPI_DEFS = KPI_GROUPS.flatMap((g) => g.items);

export const INCOMPLETE_COST_TIP = 'Có model chưa có giá — xem Cài đặt';

function IncompleteMarker({ onOpenSettings }) {
  const cls = 'perf-keep-print ml-2 align-middle px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold';
  if (!onOpenSettings) {
    return <span className={cls} title={INCOMPLETE_COST_TIP}>chưa đủ*</span>;
  }
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={`${cls} hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
      title={INCOMPLETE_COST_TIP}
      aria-label={`Chi phí chưa đủ. ${INCOMPLETE_COST_TIP}`}
    >
      chưa đủ*
    </button>
  );
}

function KpiRow({ def, kpi, onOpenSettings }) {
  const value = kpi?.value ?? null;
  const previous = kpi?.previous ?? null;
  const incomplete = def.key === 'cost' && kpi?.incomplete === true;
  const polarity = def.neutral ? 'neutral' : (LOWER_IS_BETTER.has(def.key) ? 'lower-better' : 'higher-better');
  const change = fmtChange(incomplete ? null : (kpi?.change_pct ?? null), polarity);
  return (
    <tr className="perf-kpi border-t border-gray-100 first:border-t-0" data-testid={`kpi-${def.key}`}>
      <th scope="row" className="py-2.5 pl-3 pr-2 sm:pr-3 text-left text-sm font-normal text-gray-700">{def.label}</th>
      <td className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">
        <span
          className="text-lg font-semibold text-gray-800 tabular-nums"
          title={def.full ? def.full(value) : (incomplete ? INCOMPLETE_COST_TIP : undefined)}
        >
          {def.fmt(value)}
        </span>
        {incomplete && <IncompleteMarker onOpenSettings={onOpenSettings} />}
        <div className="sm:hidden text-xs text-gray-500 tabular-nums" aria-hidden="true">trước {def.fmt(previous)}</div>
      </td>
      <td className="hidden sm:table-cell py-2.5 px-3 text-right text-sm text-gray-500 tabular-nums whitespace-nowrap">{def.fmt(previous)}</td>
      <td className="py-2.5 pl-2 pr-3 sm:pl-3 text-right whitespace-nowrap">
        {incomplete ? <span className="text-xs text-gray-500">không so sánh</span> : <ChangePill change={change} />}
      </td>
    </tr>
  );
}

export default function KpiCards({ kpis, meta, onOpenSettings }) {
  const previous = meta?.previous;
  const days = meta?.days ?? (meta?.from && meta?.to ? rangeDays(meta.from, meta.to) : null);
  return (
    <Section id="perf-kpis" title="Chỉ số chính" icon={FaListAlt}>
      {meta?.from && meta?.to && (
        <div className="-mt-2 mb-5">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800 tabular-nums" data-testid="perf-period">
            {fmtRange(meta.from, meta.to)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {days ? `${fmtInt(days)} ngày, GMT+7` : 'GMT+7'}
            {previous ? ` · so với ${fmtRange(previous.from, previous.to)}` : ''}
          </p>
        </div>
      )}
      <div className="perf-table-wrap">
        <table className="w-full">
          <thead>
            <tr className="text-[11px] font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
              <th scope="col" className="py-2.5 pl-3 pr-2 sm:pr-3 text-left font-medium rounded-tl-lg">Chỉ số</th>
              <th scope="col" className="py-2.5 px-2 sm:px-3 text-right font-medium">Kỳ này</th>
              <th scope="col" className="hidden sm:table-cell py-2.5 px-3 text-right font-medium">Kỳ trước</th>
              <th scope="col" className="py-2.5 pl-2 pr-3 sm:pl-3 text-right font-medium rounded-tr-lg">Thay đổi</th>
            </tr>
          </thead>
          {KPI_GROUPS.map((group) => (
            <tbody key={group.key}>
              <tr>
                <th scope="rowgroup" colSpan={4} className="pt-5 pb-1 pl-3 text-left text-xs font-semibold text-red-600">
                  {group.label}
                </th>
              </tr>
              {group.items.map((def) => (
                <KpiRow key={def.key} def={def} kpi={kpis?.[def.key]} onOpenSettings={onOpenSettings} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Section>
  );
}
