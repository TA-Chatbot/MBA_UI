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
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div
        className="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 self-start"
        role="group"
        aria-label="Khoảng thời gian có sẵn"
      >
        {PRESETS.map((p) => {
          const active = range.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => pickPreset(p.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                active ? 'bg-white text-red-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-red-600'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <form className="flex flex-wrap items-center gap-2" onSubmit={applyCustom} aria-label="Khoảng thời gian tùy chọn">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Từ
          <input
            type="date"
            value={draftFrom}
            max={today}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="perf-input"
            aria-label="Từ ngày"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          đến
          <input
            type="date"
            value={draftTo}
            max={today}
            onChange={(e) => setDraftTo(e.target.value)}
            className="perf-input"
            aria-label="Đến ngày"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || Boolean(draftError) || !draftChanged}
          className="perf-btn-secondary"
        >
          Áp dụng
        </button>
        {draftError && draftChanged && (
          <span className="basis-full text-sm text-red-600" role="alert">{draftError}</span>
        )}
      </form>
    </div>
  );
}
