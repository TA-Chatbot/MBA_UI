// Overview: requests and unique users per day, as two single-axis charts side by
// side (their scales differ, so they never share an axis). A day that is still
// running is drawn in a lighter step.
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts';
import { FaChartBar } from 'react-icons/fa';
import { fmtInt, fmtDayLabel, isNum } from './format';
import {
  Section, Block, ChartBox, EmptyNote, SERIES, SERIES_MUTED, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, BAR_RADIUS, list,
} from './common';

const MUTED_BLUE = '#93c5fd';
const LABEL_STYLE = { fontSize: 11, fill: '#374151' };

function DayChart({ data, dataKey, name, color, mutedColor }) {
  const showLabels = data.length <= 14;
  return (
    <ChartBox height={220} label={`${name} theo ngày`}>
      <BarChart data={data} margin={{ top: showLabels ? 20 : 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => [fmtInt(v), name]}
          labelFormatter={(l, payload) => (payload?.[0]?.payload?.partial ? `${l} (chưa hết ngày)` : l)}
        />
        <Bar isAnimationActive={false} dataKey={dataKey} name={name} radius={BAR_RADIUS} maxBarSize={48}>
          {data.map((d) => <Cell key={d.date} fill={d.partial ? mutedColor : color} />)}
          {showLabels && <LabelList dataKey={dataKey} position="top" formatter={(v) => fmtInt(v)} style={LABEL_STYLE} />}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}

export default function DailyTraffic({ usage }) {
  const data = list(usage?.days).map((d) => ({
    date: d.date,
    label: fmtDayLabel(d.date),
    partial: Boolean(d.partial),
    requests: isNum(d.requests) ? d.requests : 0,
    users: isNum(d.users) ? d.users : 0,
  }));
  const anyPartial = data.some((d) => d.partial);
  return (
    <Section
      id="perf-traffic"
      title="Lưu lượng theo ngày"
      icon={FaChartBar}
      subtitle={anyPartial ? 'Cột nhạt: ngày chưa kết thúc, số liệu còn tăng.' : undefined}
    >
      {data.length === 0 ? <EmptyNote /> : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Block flush title="Requests mỗi ngày">
            <DayChart data={data} dataKey="requests" name="Requests" color={SERIES[0]} mutedColor={SERIES_MUTED} />
          </Block>
          <Block flush title="User duy nhất mỗi ngày">
            <DayChart data={data} dataKey="users" name="Users" color={SERIES[1]} mutedColor={MUTED_BLUE} />
          </Block>
        </div>
      )}
    </Section>
  );
}
