import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { FaExclamationTriangle, FaCog, FaCoins } from 'react-icons/fa';
import {
  fmtInt, fmtNum, fmtPercent, fmtUsd, fmtCompact, fmtDayLabel, fmtDate, isNum, DASH,
} from './format';
import {
  Section, Block, ChartBox, EmptyNote, Stat, SERIES, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, LEGEND_PROPS, BAR_RADIUS, list,
} from './common';
import { computeForecast, forecastModels, hasPrice } from './forecast';

export function UnpricedWarning({ unpriced, onOpenSettings }) {
  const items = list(unpriced).filter((u) => u && u.model);
  if (items.length === 0) return null;
  return (
    <div className="perf-block flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <FaExclamationTriangle className="flex-none mt-0.5 text-amber-600" aria-hidden="true" />
      <div className="flex-1 min-w-[12rem]">
        <p className="font-semibold">Chưa có giá cho model: {items.map((u) => u.model).join(', ')}</p>
        <p className="text-xs mt-0.5">
          {items.map((u) => `${u.model}: ${fmtInt(u.requests)} requests`).join(' · ')}.
          {' '}Chi phí của các request này chưa được tính vào tổng. Thêm giá trong Cài đặt để ước tính.
        </p>
      </div>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="perf-no-print inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          <FaCog aria-hidden="true" /> Mở Cài đặt
        </button>
      )}
    </div>
  );
}

function parseMultiplier(text) {
  const v = Number(String(text).replace(',', '.'));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}

function Forecast({ forecast, onOpenSettings }) {
  const models = forecastModels(forecast);
  const [reqText, setReqText] = useState('1');
  const [inText, setInText] = useState('1');
  const [model, setModel] = useState(forecast?.current_model || models[0] || '');

  const requestMultiplier = parseMultiplier(reqText);
  const inputMultiplier = parseMultiplier(inText);
  const invalid = requestMultiplier === null || inputMultiplier === null;
  const result = useMemo(
    () => (invalid ? null : computeForecast(forecast, { requestMultiplier, inputMultiplier, model })),
    [forecast, requestMultiplier, inputMultiplier, model, invalid],
  );

  if (!forecast) return <EmptyNote>Không có dữ liệu dự báo.</EmptyNote>;

  const reset = () => { setReqText('1'); setInText('1'); setModel(forecast.current_model || models[0] || ''); };
  const priceLabel = (m) => {
    const p = forecast.prices?.[m];
    if (!hasPrice(forecast, m)) return m === forecast.current_model ? `${m} (hiện tại, chưa có giá)` : `${m} (chưa có giá)`;
    return `${m}${m === forecast.current_model ? ' (hiện tại)' : ''} — $${fmtNum(p.input, 3)} / $${fmtNum(p.output, 3)} per 1M`;
  };

  return (
    <div>
      <p className="text-xs text-gray-600 mb-3">
        Giả định từ kỳ đang xem: {fmtNum(forecast.requests_per_day, 1)} requests/ngày,
        {' '}{fmtInt(forecast.avg_input_tokens)} input + {fmtInt(forecast.avg_output_tokens)} output tokens/request,
        {' '}model hiện tại <span className="font-mono">{forecast.current_model || DASH}</span>
        {isNum(forecast.cost_per_request) && <>, chi phí thực tế {fmtUsd(forecast.cost_per_request, { small: true })}/request</>}.
      </p>

      <div className="perf-no-print flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Số request ×
          <input
            type="number" min="0" max="100" step="0.1" inputMode="decimal"
            value={reqText}
            onChange={(e) => setReqText(e.target.value)}
            className="perf-input w-24"
            aria-label="Hệ số số request"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Input tokens ×
          <input
            type="number" min="0" max="100" step="0.1" inputMode="decimal"
            value={inText}
            onChange={(e) => setInText(e.target.value)}
            className="perf-input w-24"
            aria-label="Hệ số input tokens"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="perf-input max-w-[22rem]"
            aria-label="Model để dự báo"
          >
            {models.map((m) => <option key={m} value={m}>{priceLabel(m)}</option>)}
          </select>
        </label>
        <button type="button" onClick={reset} className="perf-btn-secondary">
          Đặt lại
        </button>
      </div>
      <p className="hidden perf-print-only text-xs text-gray-600 mb-2">
        What-if: số request × {reqText}, input tokens × {inText}, model {model || DASH}.
      </p>

      {invalid && <p className="text-sm text-red-600" role="alert">Hệ số phải là số từ 0 đến 100.</p>}
      {!invalid && result === null && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <span>Chưa có giá cho model này{model === forecast.current_model && inputMultiplier !== 1 ? ' (cần giá để tính khi đổi input tokens)' : ''}.</span>
          {onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className="perf-no-print underline font-semibold">Thêm giá trong Cài đặt</button>
          )}
        </div>
      )}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="perf-forecast">
            <Stat label="Chi phí / request" value={fmtUsd(result.costPerRequest, { small: true })} hint={result.source === 'price' ? 'theo bảng giá' : 'theo chi phí thực tế'} />
            <Stat label="Mỗi ngày" value={fmtUsd(result.perDay)} hint={`${fmtNum(result.requestsPerDay, 1)} requests`} />
            <Stat label="Mỗi tuần" value={fmtUsd(result.perWeek)} />
            <Stat label="30 ngày" value={fmtUsd(result.per30Days)} />
            <Stat
              label="Đến hết học kỳ"
              value={fmtUsd(result.restOfSemester)}
              hint={result.daysToSemesterEnd === null
                ? 'Chưa đặt ngày kết thúc học kỳ'
                : `${fmtInt(result.daysToSemesterEnd)} ngày, đến ${fmtDate(forecast.semester_end)}`}
            />
          </div>
          {result.daysToSemesterEnd === null && onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className="perf-no-print mt-3 text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
              Đặt ngày kết thúc học kỳ trong Cài đặt
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function CostSection({ cost, onOpenSettings }) {
  const daily = list(cost?.daily).map((d) => ({ ...d, label: fmtDayLabel(d.date) }));
  return (
    <Section id="perf-cost" title="Token và chi phí" icon={FaCoins} subtitle="Chi phí lấy từ Langfuse; thiếu thì ước tính theo bảng giá (USD / 1M tokens).">
      <UnpricedWarning unpriced={cost?.unpriced} onOpenSettings={onOpenSettings} />

      <Block flush title="Tổng hợp" className="mt-4">
        <div className="perf-table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th className="num">Input tokens</th>
                <th className="num">Output tokens</th>
                <th className="num">Tổng tokens</th>
                <th className="num">Chi phí</th>
                <th className="num">Chi phí / request</th>
                <th className="num">Phần ước tính</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">{fmtInt(cost?.input_tokens)}</td>
                <td className="num">{fmtInt(cost?.output_tokens)}</td>
                <td className="num font-semibold">{fmtInt(cost?.total_tokens)}</td>
                <td className="num font-semibold">{fmtUsd(cost?.cost)}</td>
                <td className="num">{fmtUsd(cost?.cost_per_request, { small: true })}</td>
                <td className="num">{fmtPercent(cost?.estimated_share)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Block>

      <Block title="Theo ngày" note="Tokens và chi phí vẽ riêng hai biểu đồ vì khác đơn vị.">
        {daily.length === 0 ? <EmptyNote /> : (
          <>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Tokens mỗi ngày</h4>
                <ChartBox height={240} label="Input và output tokens theo ngày">
                  <BarChart data={daily} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" />
                    <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtInt(v), name]} />
                    <Legend {...LEGEND_PROPS} />
                    <Bar isAnimationActive={false} dataKey="input_tokens" name="Input tokens" stackId="tokens" fill={SERIES[0]} stroke="#ffffff" strokeWidth={2} maxBarSize={48} />
                    <Bar isAnimationActive={false} dataKey="output_tokens" name="Output tokens" stackId="tokens" fill={SERIES[1]} stroke="#ffffff" strokeWidth={2} radius={BAR_RADIUS} maxBarSize={48} />
                  </BarChart>
                </ChartBox>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Chi phí mỗi ngày (USD)</h4>
                <ChartBox height={240} label="Chi phí theo ngày">
                  <BarChart data={daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" />
                    <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => fmtUsd(v)} width={64} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtUsd(v), 'Chi phí']} />
                    <Bar isAnimationActive={false} dataKey="cost" name="Chi phí" fill={SERIES[2]} radius={BAR_RADIUS} maxBarSize={48} />
                  </BarChart>
                </ChartBox>
              </div>
            </div>
            <div className="perf-table-wrap mt-6">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th className="num">Input tokens</th>
                    <th className="num">Output tokens</th>
                    <th className="num">Chi phí</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.date}>
                      <td className="whitespace-nowrap">{d.label}</td>
                      <td className="num">{fmtInt(d.input_tokens)}</td>
                      <td className="num">{fmtInt(d.output_tokens)}</td>
                      <td className="num">{fmtUsd(d.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Block>

      <Block title="Dự báo chi phí (what-if)" note="Thay đổi số request, kích thước input hoặc model để xem chi phí dự kiến.">
        <Forecast
          key={`${cost?.forecast?.current_model ?? ''}|${Object.keys(cost?.forecast?.prices || {}).join(',')}`}
          forecast={cost?.forecast || null}
          onOpenSettings={onOpenSettings}
        />
      </Block>
    </Section>
  );
}
