import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import fixture from '../../components/performance/__fixtures__/report.sample.json';
import AdminPerformance, { NAV_ITEMS } from '../../pages/AdminPerformance';
import {
  fmtInt, presetRange, todayInTz, HIDE_IDS_KEY,
} from '../../components/performance/format';

vi.mock('../../pages/Navbar', () => ({ default: () => <header data-testid="navbar" /> }));
vi.mock('../../pages/Footer', () => ({ default: () => <footer /> }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const clone = (v) => JSON.parse(JSON.stringify(v));

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const SECTION_TITLES = NAV_ITEMS.map((n) => n.label);

const isReportCall = (call) => String(call[0]).includes('/admin/performance/report');
const reportCalls = () => global.fetch.mock.calls.filter(isReportCall);

/** Routes fetch by URL: report requests take the queued responses in order. */
function mockApi({ reports = [], settings, onPut } = {}) {
  const queue = [...reports];
  let last = null;
  global.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/admin/performance/report')) {
      const next = queue.length ? queue.shift() : last;
      last = next;
      return typeof next === 'function' ? next(u) : next;
    }
    if (u.includes('/admin/performance/settings')) {
      if ((init.method || 'GET') === 'PUT') return onPut ? onPut(JSON.parse(init.body)) : jsonResponse(200, {});
      return jsonResponse(200, settings);
    }
    return jsonResponse(200, {});
  });
}

async function renderWithReport(report = fixture) {
  mockApi({ reports: [jsonResponse(200, report)] });
  render(<AdminPerformance />);
  await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

beforeEach(() => {
  localStorage.setItem('access_token', 'test-token');
});

describe('AdminPerformance page', () => {
  it('requests the default "7 ngày qua" range with the bearer token', async () => {
    await renderWithReport();
    const [url, init] = reportCalls()[0];
    const { from, to } = presetRange('last7', todayInTz());
    expect(url).toContain(`from=${from}`);
    expect(url).toContain(`to=${to}`);
    expect(url).not.toContain('refresh=1');
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('renders every section heading from the fixture', async () => {
    await renderWithReport();
    SECTION_TITLES.forEach((title) => {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('kpi-requests')).getByText(fmtInt(fixture.kpis.requests.value))).toBeInTheDocument();
    // side nav links to each section
    SECTION_TITLES.forEach((title) => {
      expect(screen.getAllByRole('link', { name: title }).length).toBeGreaterThan(0);
    });
  });

  it('shows the error banner on 502 and keeps the previous report after a failed retry', async () => {
    mockApi({
      reports: [
        jsonResponse(200, fixture),
        jsonResponse(502, { detail: 'Langfuse không phản hồi' }),
        jsonResponse(502, { detail: 'Langfuse vẫn không phản hồi' }),
      ],
    });
    render(<AdminPerformance />);
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });

    fireEvent.click(screen.getByRole('button', { name: /Làm mới/ }));
    const banner = await screen.findByTestId('perf-error');
    expect(banner).toHaveTextContent('Langfuse không phản hồi');
    expect(banner).toHaveTextContent('lỗi 502');
    expect(reportCalls()[1][0]).toContain('refresh=1');
    // previous data still on screen
    expect(screen.getByRole('heading', { level: 2, name: 'Phân bố sử dụng' })).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-requests')).getByText(fmtInt(fixture.kpis.requests.value))).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.getByTestId('perf-error')).toHaveTextContent('Langfuse vẫn không phản hồi'));
    expect(reportCalls()).toHaveLength(3);
    expect(reportCalls()[2][0]).toContain('refresh=1'); // retry repeats the failed request
    expect(screen.getByRole('heading', { level: 2, name: 'Chất lượng dữ liệu' })).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-requests')).getByText(fmtInt(fixture.kpis.requests.value))).toBeInTheDocument();
  });

  it('shows the banner without a report when the first load fails, then recovers on retry', async () => {
    mockApi({
      reports: [
        jsonResponse(503, { detail: 'Chưa cấu hình khóa Langfuse' }),
        jsonResponse(200, fixture),
      ],
    });
    render(<AdminPerformance />);
    const banner = await screen.findByTestId('perf-error');
    expect(banner).toHaveTextContent('Chưa cấu hình khóa Langfuse');
    expect(screen.queryByRole('heading', { level: 2, name: 'Chỉ số chính' })).not.toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: /Thử lại/ }));
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });
    expect(screen.queryByTestId('perf-error')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no requests', async () => {
    const empty = clone(fixture);
    empty.kpis.requests.value = 0;
    mockApi({ reports: [jsonResponse(200, empty)] });
    render(<AdminPerformance />);
    expect(await screen.findByTestId('perf-empty')).toHaveTextContent('Không có request nào trong khoảng thời gian này');
    expect(screen.queryByRole('heading', { level: 2, name: 'Phân bố sử dụng' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Chất lượng dữ liệu' })).toBeInTheDocument();
  });

  it('switches displayed user ids when "Ẩn ID" is toggled and remembers it', async () => {
    const report = clone(fixture);
    const person = { user: 'b99dctest001', user_masked: 'u_deadbeef' };
    report.users.top = [{ ...(fixture.users.top[0] || {}), ...person }];
    report.reliability.slowest = [{ ...(fixture.reliability.slowest[0] || {}), ...person, trace_id: 'trace-1' }];
    report.reliability.error_rows = [];
    await renderWithReport(report);

    expect(screen.getAllByText('b99dctest001')).toHaveLength(2);
    expect(screen.queryByText('u_deadbeef')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /Ẩn ID/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('u_deadbeef')).toHaveLength(2);
    expect(screen.queryByText('b99dctest001')).not.toBeInTheDocument();
    expect(localStorage.getItem(HIDE_IDS_KEY)).toBe('1');

    fireEvent.click(toggle);
    expect(screen.getAllByText('b99dctest001')).toHaveLength(2);
    expect(localStorage.getItem(HIDE_IDS_KEY)).toBe('0');
  });

  it('starts with ids hidden when the choice was saved', async () => {
    localStorage.setItem(HIDE_IDS_KEY, '1');
    const report = clone(fixture);
    report.users.top = [{ ...(fixture.users.top[0] || {}), user: 'b99dctest001', user_masked: 'u_deadbeef' }];
    await renderWithReport(report);
    expect(screen.getByText('u_deadbeef')).toBeInTheDocument();
    expect(screen.queryByText('b99dctest001')).not.toBeInTheDocument();
  });

  it('links slow requests to their Langfuse trace in a new tab', async () => {
    const report = clone(fixture);
    report.meta.trace_url_base = 'https://lang.example/project/p/traces/';
    report.reliability.slowest = [{ ...(fixture.reliability.slowest[0] || {}), trace_id: 'abc123' }];
    report.reliability.error_rows = [];
    await renderWithReport(report);
    const section = screen.getByRole('region', { name: 'Độ tin cậy và lỗi' });
    const link = within(section).getByRole('link', { name: /Trace/ });
    expect(link).toHaveAttribute('href', 'https://lang.example/project/p/traces/abc123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('marks an incomplete cost KPI and hides its change arrow', async () => {
    const report = clone(fixture);
    report.kpis.cost = { value: 0.37, previous: 0.45, change_pct: -17.8, incomplete: true };
    await renderWithReport(report);
    const card = screen.getByTestId('kpi-cost');
    const marker = within(card).getByText('chưa đủ*');
    expect(marker).toHaveAttribute('title', 'Có model chưa có giá — xem Cài đặt');
    expect(card.textContent).not.toMatch(/[▲▼]/);
  });

  it('warns about unpriced models and opens Settings from the warning', async () => {
    const report = clone(fixture);
    report.cost.unpriced = [{ model: 'gpt-test-unpriced', requests: 12 }];
    mockApi({
      reports: [jsonResponse(200, report)],
      settings: { excluded_users: ['ptit:*'], prices: {}, semester_end: null, models_seen: [] },
    });
    render(<AdminPerformance />);
    const warning = await screen.findByText(/Chưa có giá cho model: gpt-test-unpriced/);
    const box = warning.closest('[role="status"]');
    fireEvent.click(within(box).getByRole('button', { name: /Mở Cài đặt/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows "Không có dữ liệu user mới/quay lại" when first-seen data is unavailable', async () => {
    const report = clone(fixture);
    report.users.available = false;
    await renderWithReport(report);
    expect(screen.getByText(/Không có dữ liệu user mới\/quay lại/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Top 10 user' })).toBeInTheDocument();
  });

  it('opens the hourly drill-down when a day is clicked', async () => {
    await renderWithReport();
    const days = fixture.usage.days;
    if (days.length === 0) return;
    const section = screen.getByRole('region', { name: 'Phân bố sử dụng' });
    const dayButton = within(section).getAllByRole('button', { expanded: false })[0];
    fireEvent.click(dayButton);
    expect(await screen.findByTestId('perf-hourly')).toHaveTextContent('Theo giờ');
  });

  it('fetches a new range when a preset is picked', async () => {
    await renderWithReport();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước (T2–CN)' }));
    const { from, to } = presetRange('lastWeek', todayInTz());
    await waitFor(() => expect(reportCalls().some((c) => c[0].includes(`from=${from}&to=${to}`))).toBe(true));
  });

  it('blocks a custom range where the end is before the start', async () => {
    await renderWithReport();
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-09-10' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
  });

  it('renders a sparse report (empty arrays and nulls) without crashing', async () => {
    const sparse = {
      meta: { ...fixture.meta, previous: null, trace_url_base: null },
      kpis: { requests: { value: 3, previous: null, change_pct: null } },
      highlights: [],
      usage: { slots: [], days: [], slot_totals: [], heatmap: [], weekdays: [] },
      courses: { rows: [], weekday_matrix: { sources: [], names: [], rows: [] }, cohorts: [] },
      models: { rows: [], stats: [] },
      latency: {
        histogram: { bin_width: null, latency: [], ttft: [], last_bin_open: false },
        scatter: [], daily: [], slots: [], thresholds: [], ttft_share_median: null,
      },
      cost: {
        input_tokens: null, output_tokens: null, total_tokens: null, cost: null, cost_per_request: null,
        estimated_share: null, unpriced: [], daily: [], forecast: null,
      },
      users: {
        available: false, unique: 0, no_user_id: 0, requests_per_user: null, top10pct_share: null,
        active_2plus_days: 0, distribution: [], sessions: null, groups: [], daily_groups: [], retention: null, top: [],
      },
      reliability: { errors: 0, error_rate: 0, error_rows: [], slowest: [] },
      data_quality: { rows_read: 0, rows_analyzed: 0, excluded: [], missing: [], notes: [] },
    };
    await renderWithReport(sparse);
    SECTION_TITLES.forEach((title) => {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    });
  });

  it('renders when whole sections are null', async () => {
    const nulls = {
      meta: fixture.meta,
      kpis: { requests: { value: 3, previous: null, change_pct: null } },
      highlights: null, usage: null, courses: null, models: null, latency: null,
      cost: null, users: null, reliability: null, data_quality: null,
    };
    await renderWithReport(nulls);
    SECTION_TITLES.forEach((title) => {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    });
  });
});

describe('Settings drawer', () => {
  const settings = {
    excluded_users: ['ptit:*', 'b23dcmr001'],
    prices: { 'gpt-4o-mini': { input: 0.15, output: 0.6 } },
    semester_end: '2026-12-31',
    updated_at: '2026-09-29T09:00:00+07:00',
    updated_by: 'admin',
    models_seen: [
      { model: 'gpt-4o-mini', requests: 80, has_price: true, has_langfuse_cost: false },
      { model: 'gpt-6-luna', requests: 400, has_price: false, has_langfuse_cost: false },
    ],
  };

  it('saves with PUT, closes, and reloads the report with refresh=1', async () => {
    let putBody = null;
    mockApi({
      reports: [jsonResponse(200, fixture)],
      settings,
      onPut: (body) => { putBody = body; return jsonResponse(200, { ...settings, ...body }); },
    });
    render(<AdminPerformance />);
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });

    fireEvent.click(screen.getByRole('button', { name: /^Cài đặt$/ }));
    const dialog = await screen.findByRole('dialog');
    const textarea = await within(dialog).findByLabelText('User bị loại trừ');
    expect(textarea.value).toBe('ptit:*\nb23dcmr001');
    // the unpriced model seen in the last 30 days gets a highlighted row
    expect(within(dialog).getByDisplayValue('gpt-6-luna')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'ptit:*\n\n  test*  ' } });
    fireEvent.change(within(dialog).getByLabelText('Giá input gpt-6-luna'), { target: { value: '0,2' } });
    fireEvent.change(within(dialog).getByLabelText('Giá output gpt-6-luna'), { target: { value: '0.8' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(putBody).toEqual({
      excluded_users: ['ptit:*', 'test*'],
      prices: { 'gpt-4o-mini': { input: 0.15, output: 0.6 }, 'gpt-6-luna': { input: 0.2, output: 0.8 } },
      semester_end: '2026-12-31',
    });
    await waitFor(() => expect(reportCalls().length).toBe(2));
    expect(reportCalls()[1][0]).toContain('refresh=1');
  });

  it('shows validation errors returned by the backend', async () => {
    mockApi({
      reports: [jsonResponse(200, fixture)],
      settings,
      onPut: () => jsonResponse(422, {
        detail: [{ loc: ['body', 'prices', 'gpt-4o-mini', 'input'], msg: 'Input should be greater than or equal to 0' }],
      }),
    });
    render(<AdminPerformance />);
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });
    fireEvent.click(screen.getByRole('button', { name: /^Cài đặt$/ }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('User bị loại trừ');
    fireEvent.click(within(dialog).getByRole('button', { name: /Lưu/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('prices.gpt-4o-mini.input: Input should be greater than or equal to 0');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(1);
  });
});
