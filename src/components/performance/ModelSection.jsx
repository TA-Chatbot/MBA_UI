import React from 'react';
import {
  fmtInt, fmtFixed, fmtPercent, fmtSeconds, fmtUsd, fmtNum, COST_SOURCE_LABELS, STAT_LABELS, DASH,
} from './format';
import { FaMicrochip } from 'react-icons/fa';
import { Section, Block, EmptyNote, ShareBar, SERIES, list } from './common';

const STAT_ORDER = ['latency', 'ttft', 'tps', 'input_tokens', 'output_tokens'];
const STAT_COLUMNS = ['mean', 'std', 'median', 'p90', 'p95', 'p99', 'min', 'max'];
const STAT_HEADERS = {
  mean: 'Mean', std: 'Std', median: 'Median', p90: 'p90', p95: 'p95', p99: 'p99', min: 'Min', max: 'Max',
};

function statFormatter(metric) {
  if (metric === 'latency' || metric === 'ttft') return (v) => fmtFixed(v, 2);
  if (metric === 'tps') return (v) => fmtFixed(v, 1);
  return (v) => fmtNum(v, 0);
}

function CostSourceBadge({ source }) {
  const tone = {
    langfuse: 'bg-green-50 text-green-800 border-green-200',
    estimated: 'bg-blue-50 text-blue-800 border-blue-200',
    mixed: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    unknown: 'bg-amber-50 text-amber-800 border-amber-200',
  }[source] || 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${tone}`}>
      {COST_SOURCE_LABELS[source] || source || DASH}
    </span>
  );
}

export default function ModelSection({ models }) {
  const rows = list(models?.rows);
  const statsByMetric = new Map(list(models?.stats).map((s) => [s.metric, s]));
  const stats = [
    ...STAT_ORDER.filter((m) => statsByMetric.has(m)).map((m) => statsByMetric.get(m)),
    ...list(models?.stats).filter((s) => !STAT_ORDER.includes(s.metric)),
  ];

  return (
    <Section id="perf-models" icon={FaMicrochip} title="Model và hiệu năng">
      <Block title="Tỉ lệ sử dụng model">
        {rows.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num">Requests</th>
                  <th className="num">Tỉ lệ</th>
                  <th className="num">Users</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.model || i}>
                    <td className="font-mono text-xs text-gray-900 whitespace-nowrap">{m.model || DASH}</td>
                    <td className="num font-semibold">{fmtInt(m.requests)}</td>
                    <td className="num">
                      <span className="inline-flex items-center gap-2">
                        <ShareBar value={m.share} color={SERIES[i % SERIES.length]} />
                        {fmtPercent(m.share)}
                      </span>
                    </td>
                    <td className="num">{fmtInt(m.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Thống kê độ trễ và tokens" note="Percentile nội suy tuyến tính; Std là độ lệch chuẩn mẫu.">
        {stats.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  <th className="num">N</th>
                  {STAT_COLUMNS.map((c) => <th key={c} className="num">{STAT_HEADERS[c]}</th>)}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const fmt = statFormatter(s.metric);
                  return (
                    <tr key={s.metric}>
                      <td className="font-medium text-gray-900 whitespace-nowrap">{STAT_LABELS[s.metric] || s.metric}</td>
                      <td className="num text-gray-500">{fmtInt(s.n)}</td>
                      {STAT_COLUMNS.map((c) => (
                        <td key={c} className={`num ${c === 'median' || c === 'p95' ? 'font-semibold' : ''}`}>{fmt(s[c])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Chi tiết theo model">
        {rows.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num">Latency TB</th>
                  <th className="num">Latency p95</th>
                  <th className="num">TTFT TB</th>
                  <th className="num">Tokens/giây (median)</th>
                  <th className="num">Input tokens</th>
                  <th className="num">Output tokens</th>
                  <th className="num">Chi phí</th>
                  <th>Nguồn chi phí</th>
                  <th className="num">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.model || i}>
                    <td className="font-mono text-xs text-gray-900 whitespace-nowrap">{m.model || DASH}</td>
                    <td className="num">{fmtSeconds(m.latency_mean)}</td>
                    <td className="num">{fmtSeconds(m.latency_p95)}</td>
                    <td className="num">{fmtSeconds(m.ttft_mean)}</td>
                    <td className="num">{fmtFixed(m.tps_median, 1)}</td>
                    <td className="num">{fmtInt(m.input_tokens)}</td>
                    <td className="num">{fmtInt(m.output_tokens)}</td>
                    <td className="num">{fmtUsd(m.cost)}</td>
                    <td><CostSourceBadge source={m.cost_source} /></td>
                    <td className={`num ${m.errors > 0 ? 'text-red-600 font-semibold' : ''}`}>{fmtInt(m.errors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </Section>
  );
}
