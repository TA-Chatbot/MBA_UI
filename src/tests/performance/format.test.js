import { describe, it, expect } from 'vitest';
import {
  fmtInt,
  fmtNum,
  fmtFixed,
  fmtSeconds,
  fmtPercent,
  fmtUsd,
  fmtCompact,
  fmtChange,
  fmtDayLabel,
  fmtDate,
  fmtRange,
  fmtClock,
  fmtDateTime,
  weekdayOf,
  addDays,
  rangeDays,
  todayInTz,
  presetRange,
  validateRange,
  displayUser,
  loadHideIds,
  saveHideIds,
  WEEKDAYS,
  DASH,
} from '../../components/performance/format';

describe('format numbers (vi-VN)', () => {
  it('formats integers with dot grouping', () => {
    expect(fmtInt(1206)).toBe('1.206');
    expect(fmtInt(2540000)).toBe('2.540.000');
    expect(fmtInt(0)).toBe('0');
  });

  it('formats decimals with a comma', () => {
    expect(fmtNum(7.51)).toBe('7,51');
    expect(fmtNum(7.5)).toBe('7,5');
    expect(fmtFixed(7.5, 2)).toBe('7,50');
    expect(fmtSeconds(7.51)).toBe('7,51 s');
    expect(fmtSeconds(12.1449, { unit: false })).toBe('12,14');
  });

  it('formats percentages given on a 0–100 scale', () => {
    expect(fmtPercent(13.8)).toBe('13,8%');
    expect(fmtPercent(0)).toBe('0%');
    expect(fmtPercent(52.73, 2)).toBe('52,73%');
  });

  it('formats USD with 4 decimals below one dollar', () => {
    expect(fmtUsd(0.4579)).toBe('$0,4579');
    expect(fmtUsd(0.00049)).toBe('$0,0005');
    expect(fmtUsd(12.345)).toBe('$12,35');
    expect(fmtUsd(1234.5)).toBe('$1.234,50');
    expect(fmtUsd(0.000498, { small: true })).toBe('$0,000498');
  });

  it('formats large counts compactly', () => {
    expect(fmtCompact(2540000)).toBe('2,54M');
    expect(fmtCompact(45210)).toBe('45,2K');
    expect(fmtCompact(950)).toBe('950');
  });

  it('renders a dash for null / undefined / NaN', () => {
    [fmtInt, fmtNum, fmtSeconds, fmtPercent, fmtUsd, fmtCompact].forEach((fn) => {
      expect(fn(null)).toBe(DASH);
      expect(fn(undefined)).toBe(DASH);
      expect(fn(Number.NaN)).toBe(DASH);
    });
  });
});

describe('format change percent', () => {
  it('marks a rise in a lower-is-better metric as bad (red)', () => {
    expect(fmtChange(12.34, 'lower-better')).toEqual({ text: '▲ +12,3%', label: '+12,3%', direction: 'up', tone: 'bad' });
    expect(fmtChange(-5.9, 'lower-better')).toEqual({ text: '▼ −5,9%', label: '−5,9%', direction: 'down', tone: 'good' });
  });

  it('marks a rise in a volume metric as good (green) and a fall as neutral', () => {
    expect(fmtChange(16.8, 'higher-better').tone).toBe('good');
    expect(fmtChange(-3, 'higher-better')).toEqual({ text: '▼ −3%', label: '−3%', direction: 'down', tone: 'neutral' });
  });

  it('handles zero and null', () => {
    expect(fmtChange(0).text).toBe('0%');
    expect(fmtChange(0.01).direction).toBe('flat');
    expect(fmtChange(null)).toEqual({ text: DASH, label: DASH, direction: 'none', tone: 'none' });
    // volume that drives cost (tokens): shown without a good/bad judgement
    expect(fmtChange(81.3, 'neutral')).toEqual({ text: '▲ +81,3%', label: '+81,3%', direction: 'up', tone: 'neutral' });
  });
});

describe('format dates', () => {
  it('uses weekday 0 = Monday with Vietnamese labels', () => {
    expect(WEEKDAYS).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    expect(weekdayOf('2026-09-17')).toBe(3); // Thursday
    expect(weekdayOf('2026-09-21')).toBe(0); // Monday
    expect(weekdayOf('2026-09-27')).toBe(6); // Sunday
  });

  it('formats day labels and dates', () => {
    expect(fmtDayLabel('2026-09-17')).toBe('T5 17/09');
    expect(fmtDayLabel('2026-09-27')).toBe('CN 27/09');
    expect(fmtDate('2026-09-17')).toBe('17/09/2026');
    expect(fmtRange('2026-09-17', '2026-09-23')).toBe('17/09 – 23/09/2026');
    expect(fmtRange('2025-12-30', '2026-01-02')).toBe('30/12/2025 – 02/01/2026');
    expect(fmtDayLabel(null)).toBe(DASH);
  });

  it('formats timestamps in GMT+7 regardless of the offset given', () => {
    expect(fmtClock('2026-10-01T02:30:00+07:00')).toBe('02:30');
    expect(fmtClock('2026-09-30T19:30:00Z')).toBe('02:30');
    expect(fmtDateTime('2026-09-17T16:47:05+07:00')).toBe('17/09 16:47');
    expect(fmtDateTime('2026-09-17T16:47:05+07:00', { withYear: true })).toBe('17/09/2026 16:47');
    expect(fmtClock(null)).toBe(DASH);
  });

  it('does date arithmetic on YYYY-MM-DD strings', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(rangeDays('2026-09-17', '2026-09-23')).toBe(7);
    expect(rangeDays('2026-09-17', '2026-09-17')).toBe(1);
  });

  it('computes today in Asia/Ho_Chi_Minh, not the browser zone', () => {
    // 18:00 UTC on 30/09 is already 01:00 on 01/10 in Vietnam.
    expect(todayInTz(new Date('2026-09-30T18:00:00Z'))).toBe('2026-10-01');
    expect(todayInTz(new Date('2026-09-30T16:59:00Z'))).toBe('2026-09-30');
  });
});

describe('date presets', () => {
  const today = '2026-09-30'; // Wednesday

  it('7 ngày qua = today-6 .. today', () => {
    expect(presetRange('last7', today)).toEqual({ from: '2026-09-24', to: '2026-09-30' });
  });

  it('Tuần trước = previous Monday .. Sunday', () => {
    expect(presetRange('lastWeek', today)).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    // On a Monday, last week is the full week before.
    expect(presetRange('lastWeek', '2026-09-28')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    // On a Sunday, "this week" still started last Monday.
    expect(presetRange('lastWeek', '2026-09-27')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('30 ngày qua, tháng này, tháng trước', () => {
    expect(presetRange('last30', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('thisMonth', '2026-10-05')).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(presetRange('lastMonth', '2026-10-05')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('lastMonth', '2026-03-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('validates custom ranges', () => {
    expect(validateRange('2026-09-01', '2026-09-30', today)).toBeNull();
    expect(validateRange('2026-09-30', '2026-09-01', today)).toMatch(/sau hoặc bằng/);
    expect(validateRange('2026-01-01', '2026-09-30', today)).toMatch(/120 ngày/);
    expect(validateRange('2026-10-02', '2026-10-03', today)).toMatch(/tương lai/);
    expect(validateRange('', '2026-09-30', today)).toMatch(/Chọn đủ/);
    // exactly 120 days is allowed
    expect(validateRange('2026-06-03', '2026-09-30', today)).toBeNull();
    expect(validateRange('2026-06-02', '2026-09-30', today)).toMatch(/120 ngày/);
  });
});

describe('ID masking', () => {
  const row = { user: 'b23dcmr059', user_masked: 'u_6d639b84' };

  it('shows the masked id when hidden and never the raw id', () => {
    expect(displayUser(row, false)).toBe('b23dcmr059');
    expect(displayUser(row, true)).toBe('u_6d639b84');
    expect(displayUser({ user: 'x1', user_masked: null }, true)).not.toBe('x1');
    expect(displayUser({ user: null, user_masked: null }, false)).toMatch(/không có user_id/);
  });

  it('remembers the choice in localStorage', () => {
    expect(loadHideIds()).toBe(false);
    saveHideIds(true);
    expect(loadHideIds()).toBe(true);
    saveHideIds(false);
    expect(loadHideIds()).toBe(false);
  });
});
