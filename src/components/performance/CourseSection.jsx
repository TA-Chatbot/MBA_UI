import React, { useState } from 'react';
import {
  fmtInt, fmtPercent, fmtSeconds, fmtUsd, fmtChange, TONE_CLASS, WEEKDAYS, WEEKDAY_NAMES, DASH,
} from './format';
import { Section, Block, EmptyNote, ShareBar, list } from './common';
import Heatmap from './Heatmap';

// Long tails (60+ courses, 30+ cohorts) bury the rows the meeting cares about:
// show the top rows plus one "others" total, with a toggle for the full list.
const COURSE_LIMIT = 15;
const COHORT_LIMIT = 12;

const sum = (rows, key) => rows.reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0);

function ShowAllToggle({ total, limit, expanded, onToggle, noun }) {
  if (total <= limit) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="perf-no-print mt-2 text-sm font-medium text-red-700 hover:underline"
    >
      {expanded ? 'Thu gọn' : `Xem tất cả ${fmtInt(total)} ${noun}`}
    </button>
  );
}

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
  const [allCourses, setAllCourses] = useState(false);
  const [allCohorts, setAllCohorts] = useState(false);
  const rows = list(courses?.rows);
  const shownRows = allCourses ? rows : rows.slice(0, COURSE_LIMIT);
  const restRows = allCourses ? [] : rows.slice(COURSE_LIMIT);
  const matrix = courses?.weekday_matrix || null;
  const matrixRows = list(matrix?.rows);
  const sources = list(matrix?.sources);
  const names = list(matrix?.names);
  const cohorts = list(courses?.cohorts);
  const shownCohorts = allCohorts ? cohorts : cohorts.slice(0, COHORT_LIMIT);
  const restCohorts = allCohorts ? [] : cohorts.slice(COHORT_LIMIT);

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
                {shownRows.map((c, i) => {
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
                {restRows.length > 0 && (
                  <tr className="text-gray-600" data-testid="course-others">
                    <td>{fmtInt(restRows.length)} môn khác</td>
                    <td className="num font-semibold">{fmtInt(sum(restRows, 'requests'))}</td>
                    <td className="num">{fmtPercent(sum(restRows, 'share'))}</td>
                    <td className="num">{DASH}</td>
                    <td className="num text-gray-500">{fmtInt(sum(restRows, 'previous_requests'))}</td>
                    <td className="num">{DASH}</td>
                    <td className="num">{DASH}</td>
                    <td className="num">{DASH}</td>
                    <td className="num">{DASH}</td>
                    <td className="num">{fmtUsd(sum(restRows, 'cost'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <ShowAllToggle
          total={rows.length}
          limit={COURSE_LIMIT}
          expanded={allCourses}
          onToggle={() => setAllCourses((v) => !v)}
          noun="môn"
        />
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
                {shownCohorts.map((c, i) => (
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
                {restCohorts.length > 0 && (
                  <tr className="text-gray-600" data-testid="cohort-others">
                    <td>{fmtInt(restCohorts.length)} khóa khác</td>
                    <td className="num">{DASH}</td>
                    <td>{DASH}</td>
                    <td className="num">{fmtInt(sum(restCohorts, 'users'))}</td>
                    <td className="num font-semibold">{fmtInt(sum(restCohorts, 'requests'))}</td>
                    <td className="num">{fmtPercent(sum(restCohorts, 'share'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <ShowAllToggle
          total={cohorts.length}
          limit={COHORT_LIMIT}
          expanded={allCohorts}
          onToggle={() => setAllCohorts((v) => !v)}
          noun="khóa"
        />
      </Block>
    </Section>
  );
}
