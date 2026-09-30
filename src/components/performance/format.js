// Vietnamese number / date formatting for the performance dashboard, plus the
// date-range presets and the "Ẩn ID" preference. Everything here is pure except
// loadHideIds / saveHideIds (localStorage) so it can be unit-tested directly.

export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const DASH = '—';
export const MAX_RANGE_DAYS = 120;

// weekday 0 = Monday, as in the report contract.
export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const WEEKDAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------- numbers

const formatters = new Map();
function nf(minDigits, maxDigits) {
  const key = `${minDigits}:${maxDigits}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }));
  }
  return formatters.get(key);
}

/** 1206 -> "1.206" */
export function fmtInt(v) {
  return isNum(v) ? nf(0, 0).format(Math.round(v)) : DASH;
}

/** Up to `digits` decimals, trailing zeros dropped: 7.5 -> "7,5", 7.51 -> "7,51". */
export function fmtNum(v, digits = 2) {
  return isNum(v) ? nf(0, digits).format(v) : DASH;
}

/** Exactly `digits` decimals: 7.5 -> "7,50". For table columns that should line up. */
export function fmtFixed(v, digits = 2) {
  return isNum(v) ? nf(digits, digits).format(v) : DASH;
}

/** Seconds: 7.51 -> "7,51 s". `unit: false` drops the suffix (column already says "giây"). */
export function fmtSeconds(v, { digits = 2, unit = true } = {}) {
  if (!isNum(v)) return DASH;
  const text = nf(digits, digits).format(v);
  return unit ? `${text} s` : text;
}

/** Percent given as 0–100: 13.8 -> "13,8%". */
export function fmtPercent(v, digits = 1) {
  return isNum(v) ? `${nf(0, digits).format(v)}%` : DASH;
}

/**
 * USD: 4 decimals below $1 ("$0,4579"), else 2 ("$12,35").
 * `small` gives 6 decimals below $1, for per-request figures like $0,000498.
 */
export function fmtUsd(v, { small = false } = {}) {
  if (!isNum(v)) return DASH;
  const digits = Math.abs(v) < 1 ? (small ? 6 : 4) : 2;
  const sign = v < 0 ? '−' : '';
  return `${sign}$${nf(digits, digits).format(Math.abs(v))}`;
}

/** 2977947 -> "2,98M", 45210 -> "45,2K", 950 -> "950". */
export function fmtCompact(v) {
  if (!isNum(v)) return DASH;
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${nf(0, 2).format(v / 1e6)}M`;
  if (abs >= 1e4) return `${nf(0, 1).format(v / 1e3)}K`;
  return fmtInt(v);
}

// Metrics where a rise is bad. Everything else (users, requests, sessions,
// tokens) is volume: a rise is shown green, a fall neutral grey.
export const LOWER_IS_BETTER = new Set([
  'latency_mean', 'ttft_mean', 'latency_p95', 'error_rate', 'cost',
]);

/**
 * Signed change with an arrow.
 * @param {number|null} changePct  change in percent (0–100 scale), null when unknown
 * @param {'lower-better'|'higher-better'|'neutral'} polarity
 * @returns {{text: string, label: string, direction: 'up'|'down'|'flat'|'none', tone: 'good'|'bad'|'neutral'|'none'}}
 *   `text` carries an arrow glyph for plain-text use; `label` is the signed
 *   percentage alone, for places that draw the arrow as an icon.
 */
export function fmtChange(changePct, polarity = 'higher-better') {
  if (!isNum(changePct)) return { text: DASH, label: DASH, direction: 'none', tone: 'none' };
  const rounded = Math.round(changePct * 10) / 10;
  if (rounded === 0) return { text: '0%', label: '0%', direction: 'flat', tone: 'neutral' };
  const up = rounded > 0;
  const label = `${up ? '+' : '−'}${nf(0, 1).format(Math.abs(rounded))}%`;
  const text = `${up ? '▲' : '▼'} ${label}`;
  let tone;
  if (polarity === 'lower-better') tone = up ? 'bad' : 'good';
  else if (polarity === 'neutral') tone = 'neutral';
  else tone = up ? 'good' : 'neutral';
  return { text, label, direction: up ? 'up' : 'down', tone };
}

export const TONE_CLASS = {
  good: 'text-green-700',
  bad: 'text-red-600',
  neutral: 'text-gray-500',
  none: 'text-gray-400',
};

// ---------------------------------------------------------------- dates

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(s) {
  return typeof s === 'string' && YMD_RE.test(s);
}

function ymdToUtc(ymd) {
  const [, y, m, d] = YMD_RE.exec(ymd);
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

function utcToYmd(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(ymd, n) {
  return utcToYmd(ymdToUtc(ymd) + n * 86400000);
}

/** Inclusive day count: ("2026-09-17", "2026-09-23") -> 7. */
export function rangeDays(from, to) {
  return Math.round((ymdToUtc(to) - ymdToUtc(from)) / 86400000) + 1;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(ymd) {
  return (new Date(ymdToUtc(ymd)).getUTCDay() + 6) % 7;
}

/** "2026-09-17" -> "T5 17/09" */
export function fmtDayLabel(ymd) {
  if (!isYmd(ymd)) return ymd ? String(ymd) : DASH;
  return `${WEEKDAYS[weekdayOf(ymd)]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** "2026-09-17" -> "17/09/2026" */
export function fmtDate(ymd) {
  if (!isYmd(ymd)) return ymd ? String(ymd) : DASH;
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

/** "17/09 – 23/09/2026" */
export function fmtRange(from, to) {
  if (!isYmd(from) || !isYmd(to)) return DASH;
  if (from === to) return fmtDate(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const left = sameYear ? `${from.slice(8, 10)}/${from.slice(5, 7)}` : fmtDate(from);
  return `${left} – ${fmtDate(to)}`;
}

function tzParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute') };
}

/** Today's date in Asia/Ho_Chi_Minh, whatever the browser's zone is. */
export function todayInTz(now = new Date()) {
  const { y, m, d } = tzParts(now);
  return `${y}-${m}-${d}`;
}

function parseIso(iso) {
  if (!iso) return null;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** ISO timestamp -> "02:30" (GMT+7). */
export function fmtClock(iso) {
  const dt = parseIso(iso);
  if (!dt) return DASH;
  const { hh, mm } = tzParts(dt);
  return `${hh}:${mm}`;
}

/** ISO timestamp -> "17/09 16:47" (GMT+7); `withYear` -> "17/09/2026 16:47". */
export function fmtDateTime(iso, { withYear = false } = {}) {
  const dt = parseIso(iso);
  if (!dt) return iso ? String(iso) : DASH;
  const { y, m, d, hh, mm } = tzParts(dt);
  return `${d}/${m}${withYear ? `/${y}` : ''} ${hh}:${mm}`;
}

export const PRESETS = [
  { key: 'last7', label: '7 ngày qua' },
  { key: 'lastWeek', label: 'Tuần trước (T2–CN)' },
  { key: 'last30', label: '30 ngày qua' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
];

/** Range for a preset, relative to `today` (YYYY-MM-DD in GMT+7). */
export function presetRange(key, today) {
  switch (key) {
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'lastWeek': {
      const thisMonday = addDays(today, -weekdayOf(today));
      return { from: addDays(thisMonday, -7), to: addDays(thisMonday, -1) };
    }
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'lastMonth': {
      const firstOfThis = `${today.slice(0, 7)}-01`;
      const lastOfPrev = addDays(firstOfThis, -1);
      return { from: `${lastOfPrev.slice(0, 7)}-01`, to: lastOfPrev };
    }
    default:
      return null;
  }
}

/** Returns a Vietnamese error message, or null when the range is acceptable. */
export function validateRange(from, to, today, maxDays = MAX_RANGE_DAYS) {
  if (!isYmd(from) || !isYmd(to)) return 'Chọn đủ ngày bắt đầu và ngày kết thúc.';
  if (to < from) return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  if (today && from > today) return 'Ngày bắt đầu không được ở tương lai.';
  if (rangeDays(from, to) > maxDays) return `Khoảng thời gian tối đa ${maxDays} ngày.`;
  return null;
}

// ---------------------------------------------------------------- ID masking

export const HIDE_IDS_KEY = 'perf_hide_ids';

export function loadHideIds() {
  try {
    return window.localStorage.getItem(HIDE_IDS_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHideIds(value) {
  try {
    window.localStorage.setItem(HIDE_IDS_KEY, value ? '1' : '0');
  } catch {
    // Storage blocked (private mode etc.) - the toggle still works for this visit.
  }
}

export const NO_USER_LABEL = '(không có user_id)';

/** The id to show for a row carrying `user` / `user_masked`. Never leaks `user` when hidden. */
export function displayUser(row, hideIds) {
  if (!row || (!row.user && !row.user_masked)) return NO_USER_LABEL;
  if (hideIds) return row.user_masked || '(đã ẩn)';
  return row.user || row.user_masked;
}

// ---------------------------------------------------------------- labels

export const COST_SOURCE_LABELS = {
  langfuse: 'Langfuse',
  estimated: 'Ước tính',
  mixed: 'Langfuse + ước tính',
  unknown: 'Chưa có giá',
};

export const GROUP_LABELS = {
  returning: 'User quay lại',
  new: 'User mới',
  total: 'Tổng',
};

export const STAT_LABELS = {
  latency: 'Latency (giây)',
  ttft: 'Time to first token (giây)',
  tps: 'Tokens/giây',
  input_tokens: 'Input tokens',
  output_tokens: 'Output tokens',
};

export const MISSING_FIELD_LABELS = {
  user_id: 'Thiếu user_id',
  model: 'Thiếu model',
  latency: 'Thiếu latency',
  ttft: 'Thiếu TTFT',
  output_tokens: 'Thiếu output tokens',
  cost: 'Chưa tính được chi phí',
  session_id: 'Thiếu session_id',
};

/** Label for a course source code, "Khác" kept as is. */
export function courseLabel(source, name) {
  if (!source) return name || DASH;
  if (!name || name === source) return source;
  return `${name} (${source})`;
}
