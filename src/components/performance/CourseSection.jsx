import React from 'react';
import {
  fmtInt, fmtPercent, fmtSeconds, fmtUsd, fmtChange, TONE_CLASS, WEEKDAYS, WEEKDAY_NAMES, DASH,
} from './format';
import { Section, Block, EmptyNote, ShareBar, list } from './common';
import Heatmap from './Heatmap';

function CourseName({ source, name }) {
  if (!source) return <span>{name || DASH}</span>;
  if (!name || name === source) return <span className="font-medium text-gray-900">{source}</span>;
  return (
    <span>
      <span className="font-medium text-gray-900">{name}</span>
      <span className="block text-[11px] text-gray-500">{source}</span>
    </span>
  );
}

export default function CourseSection({ courses }) {
  const rows = list(courses?.rows);
  const matrix = courses?.weekday_matrix || null;
  const matrixRows = list(matrix?.rows);
  const sources = list(matrix?.sources);
  const names = list(matrix?.names);
  const cohorts = list(courses?.cohorts);

  const matrixLabels = matrixRows.map((_, i) => {
    const src = sources[i];
    const name = names[i];
    if (name && src && name !== src) return `${name} (${src})`;
    return name || src || `#${i + 1}`;
  });

  return (
    <Section
      id="perf-courses"
      title="Môn học và khóa"
      subtitle="Môn học lấy từ metadata.source; khóa (cohort) suy ra từ mã user."
    >
      <Block title="Theo môn học">
        {rows.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th className="num">Requests</th>
                  <th className="num">Tỉ lệ</th>
                  <th className="num">Users</th>
                  <th className="num">Kỳ trước</th>
                  <th className="num">Thay đổi</th>
                  <th className="num">Latency TB</th>
                  <th className="num">Latency p95</th>
                  <th className="num">TTFT TB</th>
                  <th className="num">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const change = fmtChange(c.change_pct, 'higher-better');
                  return (
                    <tr key={c.source || i}>
                      <td><CourseName source={c.source} name={c.name} /></td>
                      <td className="num font-semibold">{fmtInt(c.requests)}</td>
                      <td className="num">
                        <span className="inline-flex items-center gap-2">
                          <ShareBar value={c.share} />
                          {fmtPercent(c.share)}
                        </span>
                      </td>
                      <td className="num">{fmtInt(c.users)}</td>
                      <td className="num text-gray-500">{fmtInt(c.previous_requests)}</td>
                      <td className={`num ${TONE_CLASS[change.tone]}`}>{change.text}</td>
                      <td className="num">{fmtSeconds(c.latency_mean)}</td>
                      <td className="num">{fmtSeconds(c.latency_p95)}</td>
                      <td className="num">{fmtSeconds(c.ttft_mean)}</td>
                      <td className="num">{fmtUsd(c.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Requests theo môn × thứ trong tuần" note="Giúp trả lời: thứ nào cao hơn, do lớp nào.">
        {matrixRows.length === 0 ? <EmptyNote /> : (
          <Heatmap
            rows={matrixRows}
            rowLabels={matrixLabels}
            colLabels={WEEKDAYS}
            minCellWidth={44}
            showTotals
            label="Requests theo môn học và thứ trong tuần"
            cellTitle={(i, j, v) => `${matrixLabels[i]}, ${WEEKDAY_NAMES[j] ?? j}: ${fmtInt(v)} requests`}
          />
        )}
      </Block>

      <Block title="Theo khóa (cohort)" note="Ví dụ B23·MR = khóa 2023, ngành MR; Khác = mã user không theo mẫu.">
        {cohorts.length === 0 ? <EmptyNote /> : (
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Khóa</th>
                  <th className="num">Năm nhập học</th>
                  <th>Ngành</th>
                  <th className="num">Users</th>
                  <th className="num">Requests</th>
                  <th className="num">Tỉ lệ requests</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c, i) => (
                  <tr key={c.key || i}>
                    <td className="font-medium text-gray-900">{c.key || DASH}</td>
                    <td className="num">{c.intake ?? DASH}</td>
                    <td>{c.major || DASH}</td>
                    <td className="num">{fmtInt(c.users)}</td>
                    <td className="num font-semibold">{fmtInt(c.requests)}</td>
                    <td className="num">
                      <span className="inline-flex items-center gap-2">
                        <ShareBar value={c.share} />
                        {fmtPercent(c.share)}
                      </span>
                    </td>
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
