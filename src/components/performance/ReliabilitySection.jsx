import React from 'react';
import {
  fmtInt, fmtPercent, fmtSeconds, fmtDateTime, DASH,
} from './format';
import {
  Section, Block, EmptyNote, Stat, TraceLink, UserId, list,
} from './common';

export default function ReliabilitySection({ reliability, traceUrlBase, hideIds }) {
  const errorRows = list(reliability?.error_rows);
  const slowest = list(reliability?.slowest);

  return (
    <Section id="perf-reliability" title="Độ tin cậy và lỗi" subtitle="Lỗi = observation có level ERROR trên Langfuse.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Request lỗi" value={fmtInt(reliability?.errors)} />
        <Stat label="Tỉ lệ lỗi" value={fmtPercent(reliability?.error_rate, 2)} />
      </div>

      <Block title="Request lỗi" className="mt-4">
        {errorRows.length === 0 ? <EmptyNote>Không có request lỗi trong kỳ.</EmptyNote> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Tên</th>
                  <th>Model</th>
                  <th>User</th>
                  <th>Môn</th>
                  <th>Thông báo</th>
                  <th>Langfuse</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((r, i) => (
                  <tr key={r.trace_id || i}>
                    <td className="whitespace-nowrap">{fmtDateTime(r.time)}</td>
                    <td className="font-mono text-xs">{r.name || DASH}</td>
                    <td className="font-mono text-xs">{r.model || DASH}</td>
                    <td><UserId row={r} hideIds={hideIds} /></td>
                    <td className="font-mono text-xs">{r.course || DASH}</td>
                    <td className="text-red-700 max-w-[22rem] break-words">{r.status_message || DASH}</td>
                    <td><TraceLink base={traceUrlBase} traceId={r.trace_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="10 request chậm nhất">
        {slowest.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Model</th>
                  <th>Tên</th>
                  <th className="num">Latency</th>
                  <th className="num">TTFT</th>
                  <th className="num">Output tokens</th>
                  <th>User</th>
                  <th>Môn</th>
                  <th>Langfuse</th>
                </tr>
              </thead>
              <tbody>
                {slowest.map((r, i) => (
                  <tr key={r.trace_id || i}>
                    <td className="whitespace-nowrap">{fmtDateTime(r.time)}</td>
                    <td className="font-mono text-xs">{r.model || DASH}</td>
                    <td className="font-mono text-xs">{r.name || DASH}</td>
                    <td className="num font-semibold">{fmtSeconds(r.latency)}</td>
                    <td className="num">{fmtSeconds(r.ttft)}</td>
                    <td className="num">{fmtInt(r.output_tokens)}</td>
                    <td><UserId row={r} hideIds={hideIds} /></td>
                    <td className="font-mono text-xs">{r.course || DASH}</td>
                    <td><TraceLink base={traceUrlBase} traceId={r.trace_id} /></td>
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
