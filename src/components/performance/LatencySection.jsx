import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, ReferenceLine, LineChart, Line,
} from 'recharts';
import {
  fmtInt, fmtNum, fmtPercent, fmtSeconds, fmtDayLabel, isNum, DASH,
} from './format';
import {
  Section, Block, ChartBox, EmptyNote, SERIES, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, LEGEND_PROPS, list,
} from './common';

function histogramData(histogram) {
  const lat = list(histogram?.latency);
  const ttft = list(histogram?.ttft);
  const n = Math.max(lat.length, ttft.length);
  const w = isNum(histogram?.bin_width) ? histogram.bin_width : null;
  const lastOpen = Boolean(histogram?.last_bin_open);
  return Array.from({ length: n }, (_, i) => {
    const isLast = lastOpen && i === n - 1;
    const start = w === null ? null : i * w;
    return {
      label: w === null ? String(i) : `${isLast ? '≥' : ''}${fmtNum(start, 1)}`,
      range: w === null ? `Bin ${i + 1}` : (isLast ? `≥ ${fmtNum(start, 1)} s` : `${fmtNum(start, 1)}–${fmtNum(start + w, 1)} s`),
      latency: isNum(lat[i]) ? lat[i] : 0,
      ttft: isNum(ttft[i]) ? ttft[i] : 0,
    };
  });
}

function PointDiff({ rate, previous }) {
  if (!isNum(rate) || !isNum(previous)) return <span className="text-gray-400">{DASH}</span>;
  const diff = Math.round((rate - previous) * 10) / 10;
  if (diff === 0) return <span className="text-gray-500">0 điểm %</span>;
  const up = diff > 0;
  return (
    <span className={up ? 'text-green-700' : 'text-red-600'}>
      {up ? '▲ +' : '▼ −'}{fmtNum(Math.abs(diff), 1)} điểm %
    </span>
  );
}

export default function LatencySection({ latency, stats }) {
  const hist = useMemo(() => histogramData(latency?.histogram), [latency]);
  const scatter = useMemo(
    () => list(latency?.scatter)
      .filter((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]))
      .map(([t, l]) => ({ ttft: t, latency: l })),
    [latency],
  );
  const scatterMax = scatter.reduce((m, p) => Math.max(m, p.ttft, p.latency), 0);
  const axisMax = scatterMax > 0 ? Math.ceil(scatterMax) : 1;
  const daily = list(latency?.daily).map((d) => ({ ...d, label: fmtDayLabel(d.date) }));
  const slots = list(latency?.slots);
  const thresholds = list(latency?.thresholds);
  const statBy = new Map(list(stats).map((s) => [s.metric, s]));

  return (
    <Section id="perf-latency" title="Phân phối độ trễ" subtitle="Latency = tổng thời gian trả lời; TTFT = thời gian tới token đầu tiên (giây).">
      <div className="grid gap-6 xl:grid-cols-2">
        <Block flush title="Histogram latency và TTFT" note={isNum(latency?.histogram?.bin_width) ? `Độ rộng bin ${fmtNum(latency.histogram.bin_width, 2)} giây; hai phân phối chồng lên nhau.` : undefined}>
          {hist.length === 0 ? <EmptyNote /> : (
            <ChartBox height={260} label="Histogram latency và TTFT">
              <BarChart data={hist} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="6%">
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis xAxisId="lat" dataKey="label" tick={AXIS_TICK} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <XAxis xAxisId="ttft" dataKey="label" hide />
                <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.range ?? ''}
                  formatter={(v, name) => [fmtInt(v), name]}
                />
                <Legend {...LEGEND_PROPS} />
                <Bar isAnimationActive={false} xAxisId="ttft" dataKey="ttft" name="TTFT" fill={SERIES[1]} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                <Bar isAnimationActive={false} xAxisId="lat" dataKey="latency" name="Latency" fill={SERIES[0]} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartBox>
          )}
        </Block>

        <Block flush title="TTFT so với latency" note="Mỗi điểm là một request (tối đa 1.500 điểm, lấy mẫu đều). Đường nét đứt: y = x.">
          {scatter.length === 0 ? <EmptyNote /> : (
            <ChartBox height={260} label="Biểu đồ phân tán TTFT và latency">
              <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis type="number" dataKey="ttft" name="TTFT" unit=" s" domain={[0, axisMax]} tick={AXIS_TICK} tickLine={false} />
                <YAxis type="number" dataKey="latency" name="Latency" unit=" s" domain={[0, axisMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <ZAxis range={[16, 16]} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3' }} formatter={(v, name) => [fmtSeconds(v), name]} />
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: axisMax, y: axisMax }]}
                  stroke="#78716c"
                  strokeDasharray="6 4"
                  ifOverflow="hidden"
                />
                <Scatter data={scatter} fill={SERIES[0]} fillOpacity={0.45} isAnimationActive={false} />
              </ScatterChart>
            </ChartBox>
          )}
        </Block>
      </div>

      <Block title="Latency theo ngày" note="Median và p95 của latency, median của TTFT.">
        {daily.length === 0 ? <EmptyNote /> : (
          <ChartBox height={260} label="Latency theo ngày">
            <LineChart data={daily} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} unit=" s" />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtSeconds(v), name]} />
              <Legend {...LEGEND_PROPS} />
              <Line isAnimationActive={false} type="monotone" dataKey="median" name="Latency median" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="p95" name="Latency p95" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="ttft_median" name="TTFT median" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ChartBox>
        )}
      </Block>

      <Block title="Hiệu năng theo khung giờ">
        {slots.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Khung giờ</th>
                  <th className="num">Requests</th>
                  <th className="num">Latency TB</th>
                  <th className="num">Latency p50</th>
                  <th className="num">Latency p95</th>
                  <th className="num">TTFT TB</th>
                  <th className="num">TTFT p95</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={s.slot || i}>
                    <td className="whitespace-nowrap">{s.slot || DASH}</td>
                    <td className="num">{fmtInt(s.requests)}</td>
                    <td className="num">{fmtSeconds(s.latency_mean)}</td>
                    <td className="num">{fmtSeconds(s.latency_p50)}</td>
                    <td className="num font-semibold">{fmtSeconds(s.latency_p95)}</td>
                    <td className="num">{fmtSeconds(s.ttft_mean)}</td>
                    <td className="num">{fmtSeconds(s.ttft_p95)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Tỉ lệ request theo ngưỡng latency">
        {thresholds.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Ngưỡng</th>
                  <th className="num">Số request</th>
                  <th className="num">Tỉ lệ</th>
                  <th className="num">Kỳ trước</th>
                  <th className="num">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, i) => (
                  <tr key={t.seconds ?? i}>
                    <td>≤ {fmtNum(t.seconds, 1)} giây</td>
                    <td className="num">{fmtInt(t.count)} / {fmtInt(t.total)}</td>
                    <td className="num font-semibold">{fmtPercent(t.rate)}</td>
                    <td className="num text-gray-500">{fmtPercent(t.previous_rate)}</td>
                    <td className="num"><PointDiff rate={t.rate} previous={t.previous_rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">TTFT median</dt>
            <dd className="font-semibold tabular-nums">{fmtSeconds(statBy.get('ttft')?.median)}</dd>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Latency median</dt>
            <dd className="font-semibold tabular-nums">{fmtSeconds(statBy.get('latency')?.median)}</dd>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">TTFT / latency (median theo request)</dt>
            <dd className="font-semibold tabular-nums">{fmtPercent(latency?.ttft_share_median)}</dd>
          </div>
        </dl>
      </Block>
    </Section>
  );
}
