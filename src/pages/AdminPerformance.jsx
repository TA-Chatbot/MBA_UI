// Admin-only "MBA API Performance" dashboard: the weekly Langfuse report, live,
// for any date range, compared with the previous period of the same length.
// Report JSON contract: MBA_BE docs/superpowers/specs/2026-09-30-performance-dashboard-design.md §4.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'react-toastify';
import {
  FaTachometerAlt, FaSyncAlt, FaEye, FaEyeSlash, FaPrint, FaCog, FaExclamationTriangle, FaInbox, FaSpinner,
} from 'react-icons/fa';
import Navbar from './Navbar';
import Footer from './Footer';
import DateRangeBar from '../components/performance/DateRangeBar';
import KpiCards from '../components/performance/KpiCards';
import Highlights from '../components/performance/Highlights';
import UsageSection from '../components/performance/UsageSection';
import CourseSection from '../components/performance/CourseSection';
import ModelSection from '../components/performance/ModelSection';
import LatencySection from '../components/performance/LatencySection';
import CostSection from '../components/performance/CostSection';
import UsersSection from '../components/performance/UsersSection';
import ReliabilitySection from '../components/performance/ReliabilitySection';
import DataQualitySection from '../components/performance/DataQualitySection';
import SettingsDrawer from '../components/performance/SettingsDrawer';
import { PrintContext } from '../components/performance/common';
import { fetchReport } from '../components/performance/perfApi';
import {
  presetRange, todayInTz, fmtClock, fmtDateTime, fmtRange, fmtInt, loadHideIds, saveHideIds, rangeDays,
} from '../components/performance/format';
import '../components/performance/performance.css';

export const NAV_ITEMS = [
  { id: 'perf-kpis', label: 'Chỉ số chính' },
  { id: 'perf-highlights', label: 'Nhận xét chính' },
  { id: 'perf-usage', label: 'Phân bố sử dụng' },
  { id: 'perf-courses', label: 'Môn học và khóa' },
  { id: 'perf-models', label: 'Model và hiệu năng' },
  { id: 'perf-latency', label: 'Phân phối độ trễ' },
  { id: 'perf-cost', label: 'Token và chi phí' },
  { id: 'perf-users', label: 'Hành vi người dùng' },
  { id: 'perf-reliability', label: 'Độ tin cậy và lỗi' },
  { id: 'perf-data-quality', label: 'Chất lượng dữ liệu' },
];

const DEFAULT_NAV_HEIGHT = 72;

function scrollToSection(e, id) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải báo cáo" data-testid="perf-skeleton">
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="perf-skeleton h-5 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }, (_, i) => <div key={i} className="perf-skeleton h-24" />)}
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="perf-skeleton h-5 w-52 mb-4" />
          <div className="perf-skeleton h-56" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ meta, onOpenSettings }) {
  return (
    <div className="perf-card bg-white rounded-xl border border-gray-200 shadow-sm p-10 mb-6 text-center" data-testid="perf-empty">
      <FaInbox className="mx-auto text-4xl text-gray-300 mb-3" aria-hidden="true" />
      <h2 className="text-lg font-bold text-gray-900">Không có request nào trong khoảng thời gian này</h2>
      <p className="mt-1 text-sm text-gray-600">
        {meta ? `${fmtRange(meta.from, meta.to)} · ` : ''}
        Hãy chọn khoảng thời gian khác, hoặc kiểm tra quy tắc loại trừ user trong Cài đặt.
      </p>
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
      >
        <FaCog aria-hidden="true" /> Mở Cài đặt
      </button>
    </div>
  );
}

const AdminPerformance = () => {
  const today = useMemo(() => todayInTz(), []);
  const [range, setRange] = useState(() => ({ ...presetRange('last7', today), preset: 'last7' }));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hideIds, setHideIds] = useState(loadHideIds);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [offsets, setOffsets] = useState({ nav: DEFAULT_NAV_HEIGHT, bar: 0 });
  const [activeSection, setActiveSection] = useState(NAV_ITEMS[0].id);

  const rootRef = useRef(null);
  const topbarRef = useRef(null);
  const requestSeq = useRef(0);
  const lastRequest = useRef(null);

  const load = useCallback(async ({ from, to, refresh = false }) => {
    const seq = ++requestSeq.current;
    lastRequest.current = { from, to, refresh };
    setLoading(true);
    try {
      const data = await fetchReport({ from, to, refresh });
      if (seq !== requestSeq.current) return;
      setReport(data);
      setError(null);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      // Keep whatever report is on screen; the banner says it is stale.
      setError({ message: e?.message || 'Không tải được báo cáo.', status: e?.status || 0 });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ from: range.from, to: range.to });
  }, [range.from, range.to, load]);

  const retry = () => load(lastRequest.current || { from: range.from, to: range.to });
  const refresh = () => load({ from: range.from, to: range.to, refresh: true });

  const toggleHideIds = () => {
    const next = !hideIds;
    setHideIds(next);
    saveHideIds(next);
  };

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const onSettingsSaved = () => {
    setSettingsOpen(false);
    toast.success('Đã lưu cài đặt. Đang tính lại báo cáo...');
    load({ from: range.from, to: range.to, refresh: true });
  };

  // Charts switch to a fixed width for print; give them a moment to re-render
  // before the browser snapshots the page.
  const handlePrint = () => {
    setPrinting(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 250);
    });
  };

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // The site navbar is fixed; the sticky top bar and section anchors sit below it.
  useLayoutEffect(() => {
    const measure = () => {
      const header = rootRef.current?.querySelector('header');
      const nav = header?.offsetHeight || DEFAULT_NAV_HEIGHT;
      const bar = topbarRef.current?.offsetHeight || 0;
      setOffsets((o) => (o.nav === nav && o.bar === bar ? o : { nav, bar }));
    };
    measure();
    window.addEventListener('resize', measure);
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      const header = rootRef.current?.querySelector('header');
      if (header) observer.observe(header);
      if (topbarRef.current) observer.observe(topbarRef.current);
    }
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  const hasData = Boolean(report) && report?.kpis?.requests?.value !== 0;

  // Highlight the side-nav entry for the section in view.
  useEffect(() => {
    if (!hasData) return undefined;
    const onScroll = () => {
      const line = offsets.nav + offsets.bar + 32;
      let current = NAV_ITEMS[0].id;
      NAV_ITEMS.forEach((n) => {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top - line <= 0) current = n.id;
      });
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasData, offsets]);

  const meta = report?.meta || null;

  useEffect(() => {
    const previousTitle = document.title;
    if (meta?.from && meta?.to) {
      document.title = `Hiệu năng API ${meta.project_id || ''} ${meta.from} – ${meta.to}`.replace(/\s+/g, ' ');
    }
    return () => { document.title = previousTitle; };
  }, [meta?.from, meta?.to, meta?.project_id]);

  const isEmpty = Boolean(report) && report?.kpis?.requests?.value === 0;
  const showingOtherRange = Boolean(meta) && (meta.from !== range.from || meta.to !== range.to);
  const stickyTop = offsets.nav;
  const sideTop = offsets.nav + offsets.bar + 16;

  return (
    <PrintContext.Provider value={printing}>
      <div
        ref={rootRef}
        className="perf-page bg-gradient-to-br from-red-100 to-pink-100 flex flex-col min-h-screen shrink-0"
        style={{ paddingTop: offsets.nav, '--perf-scroll-offset': `${offsets.nav + offsets.bar + 12}px` }}
      >
        <Navbar />

        {/* Sticky top bar */}
        <div
          ref={topbarRef}
          className="perf-topbar md:sticky z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm"
          style={{ top: stickyTop }}
        >
          <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FaTachometerAlt className="text-red-600" aria-hidden="true" />
                  Hiệu năng API
                </h1>
                {meta?.project_id && (
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">{meta.project_id}</span>
                )}
                <span className="text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1" aria-live="polite">
                  {meta?.generated_at && (
                    <span title={fmtDateTime(meta.generated_at, { withYear: true })}>
                      Dữ liệu lúc {fmtClock(meta.generated_at)}{meta.cached ? ' (cache)' : ''}
                    </span>
                  )}
                  {meta?.includes_today && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold" data-testid="perf-partial-badge">
                      Hôm nay chưa hết ngày — số liệu chưa đầy đủ
                    </span>
                  )}
                  {showingOtherRange && (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      Đang hiển thị {fmtRange(meta.from, meta.to)}
                    </span>
                  )}
                  {loading && (
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <FaSpinner className="animate-spin" aria-hidden="true" /> Đang tải...
                    </span>
                  )}
                </span>
              </div>
              <DateRangeBar range={range} today={today} onChange={setRange} disabled={false} />
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end flex-none">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold"
                title="Tính lại từ Langfuse, bỏ qua cache 5 phút"
              >
                <FaSyncAlt className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Làm mới
              </button>
              <button
                type="button"
                onClick={toggleHideIds}
                aria-pressed={hideIds}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${
                  hideIds ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Hiện mã ẩn danh thay cho mã user"
              >
                {hideIds ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />} Ẩn ID
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!report}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
              >
                <FaPrint aria-hidden="true" /> In / PDF
              </button>
              <button
                type="button"
                onClick={openSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                <FaCog aria-hidden="true" /> Cài đặt
              </button>
            </div>
          </div>
        </div>

        <div className="perf-layout max-w-screen-2xl w-full mx-auto px-4 py-6 flex-1 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
          {/* Side nav */}
          <nav className="perf-sidenav hidden lg:block" aria-label="Các phần của báo cáo">
            {hasData && (
              <ul className="sticky space-y-0.5 text-sm" style={{ top: sideTop }}>
                {NAV_ITEMS.map((n) => (
                  <li key={n.id}>
                    <a
                      href={`#${n.id}`}
                      onClick={(e) => scrollToSection(e, n.id)}
                      aria-current={activeSection === n.id ? 'true' : undefined}
                      className={`block px-3 py-1.5 rounded-lg border-l-2 transition-colors ${
                        activeSection === n.id
                          ? 'border-red-600 bg-white text-red-700 font-semibold'
                          : 'border-transparent text-gray-700 hover:bg-white/70'
                      }`}
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <main className="min-w-0">
            {/* Print-only header */}
            <div className="perf-print-header">
              <h1 className="text-xl font-bold">Báo cáo hiệu năng API{meta?.project_id ? ` — ${meta.project_id}` : ''}</h1>
              {meta && (
                <p className="text-sm">
                  Khoảng thời gian: {fmtRange(meta.from, meta.to)} ({fmtInt(meta.days ?? rangeDays(meta.from, meta.to))} ngày, GMT+7)
                  {meta.previous ? ` · so với ${fmtRange(meta.previous.from, meta.previous.to)}` : ''}
                </p>
              )}
              {meta?.generated_at && (
                <p className="text-sm">
                  Dữ liệu lúc {fmtDateTime(meta.generated_at, { withYear: true })}
                  {meta.includes_today ? ' · hôm nay chưa hết ngày' : ''}
                </p>
              )}
            </div>

            {hasData && (
              <div className="perf-no-print lg:hidden flex gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1" aria-label="Các phần của báo cáo">
                {NAV_ITEMS.map((n) => (
                  <a
                    key={n.id}
                    href={`#${n.id}`}
                    onClick={(e) => scrollToSection(e, n.id)}
                    className="flex-none px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-700"
                  >
                    {n.label}
                  </a>
                ))}
              </div>
            )}

            {error && (
              <div
                className="perf-no-print flex flex-wrap items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 mb-6 text-red-800"
                role="alert"
                data-testid="perf-error"
              >
                <FaExclamationTriangle className="flex-none mt-1" aria-hidden="true" />
                <div className="flex-1 min-w-[14rem]">
                  <p className="font-semibold">
                    Không tải được báo cáo{error.status ? ` (lỗi ${error.status})` : ''}
                  </p>
                  <p className="text-sm mt-0.5">{error.message}</p>
                  {report && meta && (
                    <p className="text-xs mt-1 text-red-700">
                      Đang hiển thị dữ liệu trước đó: {fmtRange(meta.from, meta.to)}
                      {meta.generated_at ? `, tính lúc ${fmtDateTime(meta.generated_at)}` : ''}.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={retry}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold"
                >
                  {loading && <FaSpinner className="animate-spin" aria-hidden="true" />}
                  Thử lại
                </button>
              </div>
            )}

            {!report && loading && <LoadingSkeleton />}

            {isEmpty && (
              <>
                <EmptyState meta={meta} onOpenSettings={openSettings} />
                <DataQualitySection dataQuality={report.data_quality} meta={meta} />
              </>
            )}

            {hasData && (
              <div className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
                <KpiCards kpis={report.kpis} meta={meta} onOpenSettings={openSettings} />
                <Highlights highlights={report.highlights} />
                <UsageSection usage={report.usage} />
                <CourseSection courses={report.courses} />
                <ModelSection models={report.models} />
                <LatencySection latency={report.latency} stats={report.models?.stats} />
                <CostSection cost={report.cost} onOpenSettings={openSettings} />
                <UsersSection users={report.users} hideIds={hideIds} />
                <ReliabilitySection reliability={report.reliability} traceUrlBase={meta?.trace_url_base} hideIds={hideIds} />
                <DataQualitySection dataQuality={report.data_quality} meta={meta} />
              </div>
            )}
          </main>
        </div>

        <Footer />

        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={onSettingsSaved} />
      </div>
    </PrintContext.Provider>
  );
};

export default AdminPerformance;
