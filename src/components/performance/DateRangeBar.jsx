// Presets + custom from/to. Ranges are GMT+7 local dates; the page owns the state.
import React, { useEffect, useState } from 'react';
import { PRESETS, presetRange, validateRange, MAX_RANGE_DAYS } from './format';

export default function DateRangeBar({ range, today, onChange, disabled = false }) {
  const [draftFrom, setDraftFrom] = useState(range.from);
  const [draftTo, setDraftTo] = useState(range.to);

  // Keep the inputs in sync when a preset is picked.
  useEffect(() => {
    setDraftFrom(range.from);
    setDraftTo(range.to);
  }, [range.from, range.to]);

  const draftError = validateRange(draftFrom, draftTo, today, MAX_RANGE_DAYS);
  const draftChanged = draftFrom !== range.from || draftTo !== range.to;

  const pickPreset = (key) => {
    const r = presetRange(key, today);
    if (r) onChange({ ...r, preset: key });
  };

  const applyCustom = (e) => {
    e.preventDefault();
    if (draftError || !draftChanged) return;
    onChange({ from: draftFrom, to: draftTo, preset: 'custom' });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Khoảng thời gian có sẵn">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={disabled}
            aria-pressed={range.preset === p.key}
            onClick={() => pickPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 ${
              range.preset === p.key
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={applyCustom} aria-label="Khoảng thời gian tùy chọn">
        <label className="flex items-center gap-1 text-gray-600">
          Từ
          <input
            type="date"
            value={draftFrom}
            max={today}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Từ ngày"
          />
        </label>
        <label className="flex items-center gap-1 text-gray-600">
          đến
          <input
            type="date"
            value={draftTo}
            max={today}
            onChange={(e) => setDraftTo(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Đến ngày"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || Boolean(draftError) || !draftChanged}
          className="px-3 py-1 rounded-md bg-gray-800 text-white font-medium disabled:bg-gray-300 disabled:text-gray-500"
        >
          Áp dụng
        </button>
        {draftError && draftChanged && (
          <span className="text-red-600" role="alert">{draftError}</span>
        )}
      </form>
    </div>
  );
}
