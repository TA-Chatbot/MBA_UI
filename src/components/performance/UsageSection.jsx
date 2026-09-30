import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { FaTimes, FaCalendarAlt } from 'react-icons/fa';
import {
  fmtInt, fmtNum, fmtDayLabel, WEEKDAYS, WEEKDAY_NAMES, isNum,
} from './format';
import {
  Section, Block, ChartBox, EmptyNote, Segmented, SERIES, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, LEGEND_PROPS, BAR_RADIUS, list,
} from './common';
import Heatmap from './Heatmap';

const DEFAULT_SLOTS = ['00:00-08:00', '08:00-13:00', '13:00-18:00', '18:00-24:00'];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));

const at = (arr, i) => (Array.isArray(arr) && isNum(arr[i]) ? arr[i] : null);

function PartialBadge() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold whitespace-nowrap">
      chưa hết ngày
    </span>
  );
}

function HourlyDrilldown({ day, onClose }) {
  const data = HOURS.map((h, i) => ({
    hour: `${h}h`,
    requests: at(day.hour_requests, i) ?? 0,
    users: at(day.hour_users, i) ?? 0,
  }));
  const hasHours = Array.isArray(day.hour_requests) && day.hour_requests.length > 0;
  let peak = null;
  data.forEach((d, i) => { if (!peak || d.requests > peak.requests) peak = { ...d, i }; });

  return (
    <div className="perf-block mt-4 rounded-lg bg-red-50/60 p-4" data-testid="perf-hourly">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Theo giờ — {fmtDayLabel(day.date)}
            {day.partial && <PartialBadge />}
          </h4>
          {hasHours && peak && peak.requests > 0 && (
            <p className="text-xs text-gray-600">
              Giờ cao điểm {HOURS[peak.i]}:00–{HOURS[(peak.i + 1) % 24]}:00 với {fmtInt(peak.requests)} requests
              ({fmtInt(peak.users)} users).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="perf-no-print text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Đóng chi tiết theo giờ"
        >
          <FaTimes />
        </button>
      </div>
      {hasHours ? (
        <ChartBox height={220} label={`Requests và users theo giờ ngày ${day.date}`}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="hour" tick={AXIS_TICK} interval={1} tickLine={false} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtInt(v), name]} />
            <Legend {...LEGEND_PROPS} />
            <Bar isAnimationActive={false} dataKey="requests" name="Requests" fill={SERIES[0]} radius={BAR_RADIUS} />
            <Bar isAnimationActive={false} dataKey="users" name="Users" fill={SERIES[1]} radius={BAR_RADIUS} />
          </BarChart>
        </ChartBox>
      ) : (
        <EmptyNote>Không có dữ liệu theo giờ cho ngày này.</EmptyNote>
      )}
    </div>
  );
}

export default function UsageSection({ usage }) {
  const slots = list(usage?.slots).length ? usage.slots : DEFAULT_SLOTS;
  const days = list(usage?.days);
  const [metric, setMetric] = useState('requests');
  const [selectedDate, setSelectedDate] = useState(null);
  const selectedDay = days.find((d) => d.date === selectedDate) || null;

  const chartData = useMemo(() => days.map((d) => {
    const row = { label: fmtDayLabel(d.date), date: d.date };
    slots.forEach((s, k) => {
      row[`s${k}`] = at(metric === 'requests' ? d.slot_requests : d.slot_users, k) ?? 0;
    });
    return row;
  }), [days, slots, metric]);

  const toggleDay = (date) => setSelectedDate((cur) => (cur === date ? null : date));

  const onChartClick = (state) => {
    const hit = chartData.find((r) => r.label === state?.activeLabel);
    if (hit) setSelectedDate(hit.date);
  };

  const slotTotals = list(usage?.slot_totals);
  const heatmap = list(usage?.heatmap);
  const weekdays = list(usage?.weekdays);
  const totalRequests = days.reduce((s, d) => s + (isNum(d.requests) ? d.requests : 0), 0);

  return (
    <Section
      id="perf-usage"
      icon={FaCalendarAlt}
      title="Phân bố sử dụng"
      subtitle="Requests và user duy nhất theo ngày × 4 khung giờ (GMT+7). Bấm vào một ngày để xem theo giờ."
    >
      <Block title="Theo ngày × khung giờ">
        {days.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Ngày</th>
                  {slots.map((s) => <th key={s} colSpan={2} className="text-center border-l border-gray-200">{s}</th>)}
                  <th colSpan={2} className="text-center border-l border-gray-200">Cả ngày</th>
                </tr>
                <tr>
                  {[...slots, 'total'].map((s) => (
                    <React.Fragment key={s}>
                      <th className="num border-l border-gray-200">Requests</th>
                      <th className="num">Users</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className={selectedDate === d.date ? 'bg-red-50' : undefined}>
                    <td className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleDay(d.date)}
                        aria-expanded={selectedDate === d.date}
                        className="perf-keep-print font-medium text-red-600 hover:text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                        title="Xem theo giờ"
                      >
                        {fmtDayLabel(d.date)}
                      </button>
                      {d.partial && <PartialBadge />}
                    </td>
                    {slots.map((s, k) => (
                      <React.Fragment key={s}>
                        <td className="num border-l border-gray-100">{fmtInt(at(d.slot_requests, k))}</td>
                        <td className="num text-gray-500">{fmtInt(at(d.slot_users, k))}</td>
                      </React.Fragment>
                    ))}
                    <td className="num border-l border-gray-100 font-semibold">{fmtInt(d.requests)}</td>
                    <td className="num font-semibold">{fmtInt(d.users)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Tổng</td>
                  {slots.map((s, k) => (
                    <React.Fragment key={s}>
                      <td className="num border-l border-gray-100">{fmtInt(at(slotTotals, k))}</td>
                      <td className="num text-gray-500">—</td>
                    </React.Fragment>
                  ))}
                  <td className="num border-l border-gray-100">{fmtInt(totalRequests)}</td>
                  <td className="num text-gray-500">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {selectedDay && <HourlyDrilldown day={selectedDay} onClose={() => setSelectedDate(null)} />}
      </Block>

      <Block
        title="Biểu đồ phân bố"
        note="Mỗi nhóm cột là một ngày, mỗi cột là một khung giờ."
        actions={(
          <Segmented
            label="Chỉ số biểu đồ"
            value={metric}
            onChange={setMetric}
            options={[{ value: 'requests', label: 'Requests' }, { value: 'users', label: 'Users' }]}
          />
        )}
      >
        {days.length === 0 ? <EmptyNote /> : (
          <ChartBox height={280} label="Requests theo ngày và khung giờ">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2} onClick={onChartClick}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtInt(v), name]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend {...LEGEND_PROPS} />
              {slots.map((s, k) => (
                <Bar isAnimationActive={false} key={s} dataKey={`s${k}`} name={s} fill={SERIES[k % SERIES.length]} radius={BAR_RADIUS} cursor="pointer" />
              ))}
            </BarChart>
          </ChartBox>
        )}
      </Block>

      <Block
        title="Phân bố theo giờ — Requests theo giờ × thứ trong tuần"
        note="Tổng requests trong kỳ theo giờ bắt đầu (GMT+7)."
      >
        {heatmap.length === 0 ? <EmptyNote /> : (
          <Heatmap
            rows={heatmap}
            rowLabels={WEEKDAYS}
            colLabels={HOURS}
            label="Requests theo giờ và thứ trong tuần"
            cellTitle={(i, j, v) => `${WEEKDAY_NAMES[i] ?? i}, ${HOURS[j]}:00–${HOURS[(j + 1) % 24]}:00: ${fmtInt(v)} requests`}
            showTotals
          />
        )}
      </Block>

      <Block title="Trung bình theo thứ" note="Số ngày = số lần thứ đó xuất hiện trong kỳ.">
        {weekdays.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Thứ</th>
                  <th className="num">Số ngày</th>
                  <th className="num">Requests</th>
                  <th className="num">TB requests/ngày</th>
                  <th className="num">TB users/ngày</th>
                </tr>
              </thead>
              <tbody>
                {weekdays.map((w) => (
                  <tr key={w.weekday}>
                    <td>{WEEKDAY_NAMES[w.weekday] ?? w.weekday}</td>
                    <td className="num">{fmtInt(w.days)}</td>
                    <td className="num">{fmtInt(w.requests)}</td>
                    <td className="num font-semibold">{fmtNum(w.avg_requests, 1)}</td>
                    <td className="num">{fmtNum(w.avg_users, 1)}</td>
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
