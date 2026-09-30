// Renders the page from a real backend report (MBA_BE, 23–30/09/2026) with the
// student ids and trace ids replaced by fakes. Guards against contract drift
// between the backend and the page: every section must render from real data.
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import live from '../../components/performance/__fixtures__/report.live-sample.json';
import AdminPerformance, { TABS } from '../../pages/AdminPerformance';
import { fmtInt } from '../../components/performance/format';

vi.mock('../../pages/Navbar', () => ({ default: () => <header data-testid="navbar" /> }));
vi.mock('../../pages/Footer', () => ({ default: () => <footer /> }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const openTab = (label) => fireEvent.click(screen.getByRole('tab', { name: label }));

beforeEach(() => {
  localStorage.setItem('access_token', 'test-token');
  window.location = { href: '', pathname: '/mini/admin/performance', search: '', hash: '', reload: vi.fn() };
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => live }));
});

describe('AdminPerformance with a real backend report', () => {
  it('renders every tab, the KPIs and the highlights', async () => {
    render(<AdminPerformance />);
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });
    expect(within(screen.getByTestId('kpi-requests')).getByText(fmtInt(live.kpis.requests.value))).toBeInTheDocument();
    expect(screen.getByText(live.highlights[0].text)).toBeInTheDocument();
    TABS.forEach((tab) => {
      openTab(tab.label);
      tab.sections.forEach((title) => {
        expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
      });
    });
    openTab('Môn học');
    expect(screen.getAllByText(live.courses.rows[0].name).length).toBeGreaterThan(0);
  });
});

describe('long course and cohort lists', () => {
  it('show the top rows plus an "others" total, and expand on request', async () => {
    render(<AdminPerformance />);
    await screen.findByRole('heading', { level: 2, name: 'Chỉ số chính' });
    openTab('Môn học');
    const others = screen.getByTestId('course-others');
    const rest = live.courses.rows.slice(15);
    expect(within(others).getByText(`${rest.length} môn khác`)).toBeInTheDocument();
    expect(within(others).getByText(fmtInt(rest.reduce((a, c) => a + c.requests, 0)))).toBeInTheDocument();
    expect(screen.getByTestId('cohort-others')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Xem tất cả ${live.courses.rows.length} môn` }));
    expect(screen.queryByTestId('course-others')).not.toBeInTheDocument();
    expect(screen.getAllByText(live.courses.rows[live.courses.rows.length - 1].source).length).toBeGreaterThan(0);
  });
});
