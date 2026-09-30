// Settings drawer: excluded users, price table, semester end. GET on open, PUT on save.
import React, { useEffect, useRef, useState } from 'react';
import { FaTimes, FaPlus, FaTrash, FaSpinner } from 'react-icons/fa';
import { fetchSettings, saveSettings } from './perfApi';
import { fmtInt, fmtDateTime, DASH } from './format';

const MAX_PATTERNS = 200;
const MAX_PATTERN_LEN = 100;

function toNumber(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : Number.NaN;
}

/** Turns the form state into the PUT body, or returns {error}. Exported for tests. */
export function buildSettingsBody({ excludedText, priceRows, semesterEnd }) {
  const excluded = excludedText.split('\n').map((s) => s.trim()).filter(Boolean);
  if (excluded.length > MAX_PATTERNS) return { error: `Tối đa ${MAX_PATTERNS} mẫu loại trừ.` };
  const tooLong = excluded.find((p) => p.length > MAX_PATTERN_LEN);
  if (tooLong) return { error: `Mẫu "${tooLong.slice(0, 30)}…" dài quá ${MAX_PATTERN_LEN} ký tự.` };

  const prices = {};
  for (const row of priceRows) {
    const model = row.model.trim();
    const input = toNumber(row.input);
    const output = toNumber(row.output);
    if (!model && input === null && output === null) continue;
    if (!model) return { error: 'Có dòng giá chưa nhập tên model.' };
    if (input === null && output === null) continue; // highlighted placeholder left empty
    if (input === null || output === null) return { error: `Model ${model}: cần nhập cả giá input và output.` };
    if (Number.isNaN(input) || Number.isNaN(output) || input < 0 || output < 0) {
      return { error: `Model ${model}: giá phải là số ≥ 0.` };
    }
    if (prices[model]) return { error: `Model ${model} bị nhập trùng.` };
    prices[model] = { input, output };
  }

  return {
    body: {
      excluded_users: excluded,
      prices,
      semester_end: semesterEnd ? semesterEnd : null,
    },
  };
}

let rowSeq = 0;
const newRow = (model = '', input = '', output = '', placeholder = false) => ({
  id: `r${++rowSeq}`, model, input: String(input), output: String(output), placeholder,
});

export default function SettingsDrawer({ open, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [excludedText, setExcludedText] = useState('');
  const [priceRows, setPriceRows] = useState([]);
  const [semesterEnd, setSemesterEnd] = useState('');
  const [info, setInfo] = useState(null);
  const [modelsSeen, setModelsSeen] = useState([]);
  const panelRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    setSaveError('');
    try {
      const s = await fetchSettings();
      const seen = Array.isArray(s?.models_seen) ? s.models_seen : [];
      const prices = s?.prices && typeof s.prices === 'object' ? s.prices : {};
      const rows = Object.entries(prices).map(([m, p]) => newRow(m, p?.input ?? '', p?.output ?? ''));
      seen
        .filter((m) => m?.model && !m.has_price && !m.has_langfuse_cost && !prices[m.model])
        .forEach((m) => rows.push(newRow(m.model, '', '', true)));
      setPriceRows(rows);
      setExcludedText((Array.isArray(s?.excluded_users) ? s.excluded_users : []).join('\n'));
      setSemesterEnd(s?.semester_end || '');
      setInfo({ updated_at: s?.updated_at, updated_by: s?.updated_by });
      setModelsSeen(seen);
    } catch (e) {
      setLoadError(e.message || 'Không tải được cài đặt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    load();
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const updateRow = (id, field, value) => {
    setPriceRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removeRow = (id) => setPriceRows((rows) => rows.filter((r) => r.id !== id));
  const addRow = (model = '') => setPriceRows((rows) => [...rows, newRow(model)]);

  const handleSave = async (e) => {
    e.preventDefault();
    const { body, error } = buildSettingsBody({ excludedText, priceRows, semesterEnd });
    if (error) {
      setSaveError(error);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await saveSettings(body);
      onSaved();
    } catch (err) {
      setSaveError(err.message || 'Lưu cài đặt thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const seenByModel = new Map(modelsSeen.map((m) => [m.model, m]));
  const pricedModels = new Set(priceRows.map((r) => r.model.trim()).filter(Boolean));

  return (
    <div className="perf-drawer fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="perf-settings-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <form
        ref={panelRef}
        tabIndex={-1}
        onSubmit={handleSave}
        className="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 id="perf-settings-title" className="text-lg font-bold text-gray-900">Cài đặt báo cáo hiệu năng</h2>
            {info?.updated_at && (
              <p className="text-xs text-gray-500">
                Cập nhật lần cuối {fmtDateTime(info.updated_at, { withYear: true })}
                {info.updated_by ? ` bởi ${info.updated_by}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900" aria-label="Đóng cài đặt">
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading && (
            <p className="text-sm text-gray-600 flex items-center gap-2"><FaSpinner className="animate-spin" /> Đang tải cài đặt...</p>
          )}
          {loadError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {loadError}{' '}
              <button type="button" onClick={load} className="underline font-semibold">Thử lại</button>
            </div>
          )}

          {!loading && !loadError && (
            <>
              <section>
                <label htmlFor="perf-excluded" className="block text-sm font-semibold text-gray-900">User bị loại trừ</label>
                <p className="text-xs text-gray-500 mt-0.5 mb-2">
                  Mỗi dòng một mẫu: đúng mã user (ví dụ <span className="font-mono">b23dcmr059</span>) hoặc tiền tố kết thúc bằng
                  {' '}<span className="font-mono">*</span> (ví dụ <span className="font-mono">ptit:*</span> loại mọi user bắt đầu bằng “ptit:”).
                  Tối đa {MAX_PATTERNS} mẫu, mỗi mẫu ≤ {MAX_PATTERN_LEN} ký tự.
                </p>
                <textarea
                  id="perf-excluded"
                  value={excludedText}
                  onChange={(e) => setExcludedText(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  spellCheck={false}
                />
              </section>

              <section>
                <div className="flex items-end justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Bảng giá model</h3>
                    <p className="text-xs text-gray-500">USD / 1M tokens. Dùng khi Langfuse không có chi phí cho request.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addRow()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    <FaPlus aria-hidden="true" /> Thêm dòng
                  </button>
                </div>
                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="num">Input</th>
                        <th className="num">Output</th>
                        <th><span className="sr-only">Xóa</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceRows.length === 0 && (
                        <tr><td colSpan={4} className="text-gray-500 italic">Chưa có giá nào.</td></tr>
                      )}
                      {priceRows.map((r) => {
                        const seen = seenByModel.get(r.model.trim());
                        const highlight = r.placeholder && !r.input && !r.output;
                        return (
                          <tr key={r.id} className={highlight ? 'bg-amber-50' : undefined}>
                            <td>
                              <input
                                value={r.model}
                                onChange={(e) => updateRow(r.id, 'model', e.target.value)}
                                placeholder="tên model"
                                aria-label="Tên model"
                                className="w-full min-w-[9rem] border border-gray-300 rounded px-2 py-1 font-mono text-xs"
                              />
                              {highlight && <span className="block mt-0.5 text-[11px] text-amber-800 font-semibold">Chưa có giá{seen ? ` · ${fmtInt(seen.requests)} requests / 30 ngày` : ''}</span>}
                            </td>
                            <td className="num">
                              <input
                                value={r.input}
                                onChange={(e) => updateRow(r.id, 'input', e.target.value)}
                                inputMode="decimal"
                                aria-label={`Giá input ${r.model}`}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-xs"
                              />
                            </td>
                            <td className="num">
                              <input
                                value={r.output}
                                onChange={(e) => updateRow(r.id, 'output', e.target.value)}
                                inputMode="decimal"
                                aria-label={`Giá output ${r.model}`}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-xs"
                              />
                            </td>
                            <td>
                              <button type="button" onClick={() => removeRow(r.id)} className="p-1 text-gray-400 hover:text-red-600" aria-label={`Xóa giá ${r.model}`}>
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {modelsSeen.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">Model đã dùng trong 30 ngày</h4>
                    <ul className="text-xs space-y-1">
                      {modelsSeen.map((m) => {
                        const inTable = pricedModels.has(m.model);
                        const missing = !m.has_price && !m.has_langfuse_cost;
                        return (
                          <li key={m.model} className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 ${missing ? 'bg-amber-50' : ''}`}>
                            <span className="font-mono">{m.model || DASH}</span>
                            <span className="text-gray-500">{fmtInt(m.requests)} requests</span>
                            {m.has_langfuse_cost && <span className="px-1.5 rounded bg-green-100 text-green-800">Langfuse có chi phí</span>}
                            {m.has_price && <span className="px-1.5 rounded bg-blue-100 text-blue-800">Có giá</span>}
                            {missing && <span className="px-1.5 rounded bg-amber-100 text-amber-800 font-semibold">Chưa có giá</span>}
                            {missing && !inTable && (
                              <button type="button" onClick={() => addRow(m.model)} className="text-blue-700 underline">Thêm giá</button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>

              <section>
                <label htmlFor="perf-semester-end" className="block text-sm font-semibold text-gray-900">Ngày kết thúc học kỳ</label>
                <p className="text-xs text-gray-500 mt-0.5 mb-2">Dùng cho dự báo chi phí “đến hết học kỳ”. Để trống nếu chưa biết.</p>
                <div className="flex items-center gap-2">
                  <input
                    id="perf-semester-end"
                    type="date"
                    value={semesterEnd}
                    onChange={(e) => setSemesterEnd(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  />
                  {semesterEnd && (
                    <button type="button" onClick={() => setSemesterEnd('')} className="text-xs text-gray-600 underline">Xóa</button>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3">
          {saveError && (
            <p className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2" role="alert">{saveError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || loading || Boolean(loadError)}
              className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold disabled:bg-red-300 inline-flex items-center gap-2"
            >
              {saving && <FaSpinner className="animate-spin" aria-hidden="true" />}
              Lưu và tải lại báo cáo
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
