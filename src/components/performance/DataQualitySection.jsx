import React from 'react';
import { FaDatabase } from 'react-icons/fa';
import { fmtInt, fmtDate, MISSING_FIELD_LABELS, DASH } from './format';
import { Section, Block, EmptyNote, Stat, list } from './common';

export default function DataQualitySection({ dataQuality, meta }) {
  const excluded = list(dataQuality?.excluded);
  const missing = list(dataQuality?.missing);
  const notes = list(dataQuality?.notes).filter(Boolean);
  const excludedTotal = excluded.reduce((s, e) => s + (Number.isFinite(e?.count) ? e.count : 0), 0);
  const patterns = list(meta?.excluded_users);

  return (
    <Section id="perf-data-quality" icon={FaDatabase} title="Chất lượng dữ liệu">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Dòng đọc từ Langfuse" value={fmtInt(dataQuality?.rows_read)} />
        <Stat label="Dòng được phân tích" value={fmtInt(dataQuality?.rows_analyzed)} />
        <Stat label="Bị loại theo quy tắc" value={fmtInt(excludedTotal)} />
        <Stat label="Lịch sử từ" value={meta?.history_start ? fmtDate(meta.history_start) : DASH} hint="dùng cho user mới/quay lại" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-4">
        <Block flush title="Loại trừ">
          {excluded.length === 0 ? <EmptyNote>Không có dòng nào bị loại.</EmptyNote> : (
            <div className="perf-table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Quy tắc</th>
                    <th className="num">Số dòng</th>
                  </tr>
                </thead>
                <tbody>
                  {excluded.map((e, i) => (
                    <tr key={e.rule || i}>
                      <td className="font-mono text-xs">{e.rule || DASH}</td>
                      <td className="num">{fmtInt(e.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {patterns.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Quy tắc hiện tại: <span className="font-mono">{patterns.join(', ')}</span>
            </p>
          )}
        </Block>

        <Block flush title="Thiếu trường">
          {missing.length === 0 ? <EmptyNote /> : (
            <div className="perf-table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th className="num">Số dòng</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((m, i) => (
                    <tr key={m.field || i}>
                      <td>{MISSING_FIELD_LABELS[m.field] || m.field || DASH}</td>
                      <td className={`num ${m.count > 0 ? 'font-semibold' : 'text-gray-500'}`}>{fmtInt(m.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>
      </div>

      <Block title="Phương pháp">
        {notes.length === 0 ? <EmptyNote /> : (
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Dự án Langfuse: <span className="font-mono">{meta?.project_id || DASH}</span> · múi giờ {meta?.timezone || 'Asia/Ho_Chi_Minh'}
        </p>
      </Block>
    </Section>
  );
}
