import React from 'react';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';
import {
  fmtInt, fmtNum, fmtPercent, fmtSeconds, fmtDayLabel, fmtDateTime, GROUP_LABELS, isNum, DASH,
} from './format';
import {
  Section, Block, ChartBox, EmptyNote, Stat, UserId, SERIES, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, LEGEND_PROPS, list,
} from './common';

const UNAVAILABLE = 'Không có dữ liệu user mới/quay lại';

function SessionsTable({ sessions }) {
  const rows = [
    { label: 'Lượt/phiên', s: sessions?.turns_per_session },
    { label: 'Phiên/user', s: sessions?.sessions_per_user },
  ];
  return (
    <div className="perf-table-wrap">
      <table className="perf-table">
        <thead>
          <tr>
            <th />
            <th className="num">Mean</th>
            <th className="num">Median</th>
            <th className="num">p95</th>
            <th className="num">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="font-medium text-gray-900">{r.label}</td>
              <td className="num">{fmtNum(r.s?.mean, 2)}</td>
              <td className="num">{fmtNum(r.s?.median, 1)}</td>
              <td className="num">{fmtNum(r.s?.p95, 1)}</td>
              <td className="num">{fmtNum(r.s?.max, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewReturning({ users }) {
  const groups = list(users?.groups);
  const daily = list(users?.daily_groups).map((d) => ({ ...d, label: fmtDayLabel(d.date) }));
  const retention = users?.retention;
  const order = ['returning', 'new', 'total'];
  const sortedGroups = [
    ...order.map((g) => groups.find((x) => x.group === g)).filter(Boolean),
    ...groups.filter((x) => !order.includes(x.group)),
  ];

  return (
    <>
      <Block
        title="User mới và user quay lại"
        note="User quay lại = đã dùng bất kỳ lúc nào trước kỳ này; user mới = lần đầu dùng nằm trong kỳ."
      >
        {sortedGroups.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th className="num">Users</th>
                  <th className="num">% users</th>
                  <th className="num">Requests</th>
                  <th className="num">% requests</th>
                  <th className="num">Phiên</th>
                  <th className="num">Req/user</th>
                  <th className="num">Median req/user</th>
                  <th className="num">Hoạt động ≥ 2 ngày</th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((g) => (
                  <tr key={g.group} className={g.group === 'total' ? 'font-semibold bg-gray-50' : undefined}>
                    <td>{GROUP_LABELS[g.group] || g.group}</td>
                    <td className="num">{fmtInt(g.users)}</td>
                    <td className="num">{fmtPercent(g.user_share)}</td>
                    <td className="num">{fmtInt(g.requests)}</td>
                    <td className="num">{fmtPercent(g.request_share)}</td>
                    <td className="num">{fmtInt(g.sessions)}</td>
                    <td className="num">{fmtNum(g.req_per_user, 2)}</td>
                    <td className="num">{fmtNum(g.median_req_per_user, 1)}</td>
                    <td className="num">{fmtInt(g.active_2plus_days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {retention && (
          <p className="mt-2 text-sm text-gray-700">
            Giữ chân: <span className="font-semibold">{fmtInt(retention.returned)}</span> / {fmtInt(retention.previous_users)} user
            {' '}của kỳ trước quay lại kỳ này (<span className="font-semibold">{fmtPercent(retention.rate)}</span>).
          </p>
        )}
      </Block>

      <Block
        title="User mới và user quay lại theo ngày"
        note="Cột chồng: số user mỗi ngày (trục trái). Đường: requests (trục phải). “Quay lại trong kỳ” = user mới của kỳ này dùng lại vào ngày sau."
      >
        {daily.length === 0 ? <EmptyNote /> : (
          <ChartBox height={280} label="User mới và user quay lại theo ngày">
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} />
              <YAxis yAxisId="users" tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis yAxisId="requests" orientation="right" tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtInt(v), name]} />
              <Legend {...LEGEND_PROPS} />
              <Bar isAnimationActive={false} yAxisId="users" dataKey="returning" name="Quay lại (trước kỳ)" stackId="u" fill={SERIES[0]} stroke="#ffffff" strokeWidth={1} />
              <Bar isAnimationActive={false} yAxisId="users" dataKey="returning_in_period" name="Quay lại trong kỳ" stackId="u" fill={SERIES[2]} stroke="#ffffff" strokeWidth={1} />
              <Bar isAnimationActive={false} yAxisId="users" dataKey="new" name="User mới" stackId="u" fill={SERIES[3]} stroke="#ffffff" strokeWidth={1} radius={[3, 3, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="requests" type="monotone" dataKey="requests" name="Requests" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ChartBox>
        )}
      </Block>
    </>
  );
}

export default function UsersSection({ users, hideIds }) {
  const rpu = users?.requests_per_user;
  const distribution = list(users?.distribution).map((d) => ({ bucket: d.bucket, users: isNum(d.users) ? d.users : 0 }));
  const top = list(users?.top);
  const available = users?.available !== false;

  return (
    <Section id="perf-users" title="Hành vi người dùng">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <Stat label="User duy nhất" value={fmtInt(users?.unique)} />
        <Stat label="Requests/user" value={fmtNum(rpu?.mean, 2)} hint={`median ${fmtNum(rpu?.median, 1)} · max ${fmtInt(rpu?.max)}`} />
        <Stat label="Top 10% user chiếm" value={fmtPercent(users?.top10pct_share)} hint="tổng requests" />
        <Stat label="Hoạt động ≥ 2 ngày" value={fmtInt(users?.active_2plus_days)} hint="user" />
        <Stat label="Phiên hội thoại" value={fmtInt(users?.sessions?.count)} />
        <Stat label="Không có user_id" value={fmtInt(users?.no_user_id)} hint="request" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Block flush title="Số request mỗi user" note="Số user theo nhóm số request trong kỳ.">
          {distribution.length === 0 ? <EmptyNote /> : (
            <ChartBox height={240} label="Phân bố số request mỗi user">
              <BarChart data={distribution} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="bucket" tick={AXIS_TICK} tickLine={false} />
                <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} labelFormatter={(l) => `${l} requests`} formatter={(v) => [fmtInt(v), 'Users']} />
                <Bar isAnimationActive={false} dataKey="users" name="Users" fill={SERIES[0]} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="users" position="top" formatter={(v) => fmtInt(v)} style={{ fontSize: 11, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ChartBox>
          )}
        </Block>
        <Block flush title="Phiên hội thoại" note={`${fmtInt(users?.sessions?.count)} phiên (sessionId khác rỗng).`}>
          <SessionsTable sessions={users?.sessions} />
        </Block>
      </div>

      {available ? <NewReturning users={users} /> : (
        <Block title="User mới và user quay lại">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600" role="status">
            {UNAVAILABLE}. Đồng bộ lần đầu dùng (first-seen) thất bại; các phần khác vẫn chính xác.
          </div>
        </Block>
      )}

      <Block title="Top 10 user" note="Theo số request trong kỳ.">
        {top.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th className="num">Requests</th>
                  <th className="num">Số ngày hoạt động</th>
                  <th className="num">Latency TB</th>
                  <th>Lần đầu</th>
                  <th>Lần cuối</th>
                  <th>Khóa</th>
                  <th>Môn nhiều nhất</th>
                </tr>
              </thead>
              <tbody>
                {top.map((u, i) => (
                  <tr key={`${u.user_masked || u.user || 'u'}-${i}`}>
                    <td className="text-gray-500">{i + 1}</td>
                    <td><UserId row={u} hideIds={hideIds} /></td>
                    <td className="num font-semibold">{fmtInt(u.requests)}</td>
                    <td className="num">{fmtInt(u.active_days)}</td>
                    <td className="num">{fmtSeconds(u.latency_mean)}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(u.first)}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(u.last)}</td>
                    <td>{u.cohort || DASH}</td>
                    <td className="font-mono text-xs">{u.top_course || DASH}</td>
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
