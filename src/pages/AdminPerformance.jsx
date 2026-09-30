// Admin-only "Hiệu năng API" dashboard: the weekly Langfuse report, live, for any
// date range, compared with the previous period of the same length. One topic per
// tab, laid out inside the site's own container so it lines up with the navbar.
// Report JSON contract: MBA_BE docs/superpowers/specs/2026-09-30-performance-dashboard-design.md §4.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'react-toastify';
import {
  FaTachometerAlt, FaSyncAlt, FaEye, FaEyeSlash, FaPrint, FaCog, FaExclamationTriangle, FaInbox,
  FaSpinner, FaThLarge, FaCalendarAlt, FaBook, FaCoins, FaUsers, FaDatabase,
} from 'react-icons/fa';
import Navbar from './Navbar';
import Footer from './Footer';
import DateRangeBar from '../components/performance/DateRangeBar';
import KpiCards from '../components/performance/KpiCards';
import Highlights from '../components/performance/Highlights';
import DailyTraffic from '../components/performance/DailyTraffic';
import UsageSection from '../components/performance/UsageSection';
import CourseSection from '../components/performance/CourseSection';
import ModelSection from '../components/performance/ModelSection';
import LatencySection from '../components/performance/LatencySection';
import CostSection, { UnpricedWarning } from '../components/performance/CostSection';
import UsersSection from '../components/performance/UsersSection';
import ReliabilitySection from '../components/performance/ReliabilitySection';
import DataQualitySection from '../components/performance/DataQualitySection';
import SettingsDrawer from '../components/performance/SettingsDrawer';
import { PrintContext } from '../components/performance/common';
import { fetchReport } from '../components/performance/perfApi';
import {
  PRESETS, presetRange, validateRange, isYmd, todayInTz, fmtClock, fmtDateTime, fmtRange, fmtInt,
  loadHideIds, saveHideIds, rangeDays, MAX_RANGE_DAYS,
} from '../components/performance/format';
import '../components/performance/performance.css';

export const TABS = [
  { id: 'tong-quan', label: 'Tổng quan', icon: FaThLarge, sections: ['Chỉ số chính', 'Nhận xét chính', 'Lưu lượng theo ngày'] },
  { id: 'su-dung', label: 'Sử dụng', icon: FaCalendarAlt, sections: ['Phân bố sử dụng'] },
  { id: 'mon-hoc', label: 'Môn học', icon: FaBook, sections: ['Môn học và khóa'] },
  {
    id: 'hieu-nang', label: 'Hiệu năng', icon: FaTachometerAlt,
    sections: ['Model và hiệu năng', 'Phân phối độ trễ', 'Độ tin cậy và lỗi'],
  },
  { id: 'chi-phi', label: 'Chi phí', icon: FaCoins, sections: ['Token và chi phí'] },
  { id: 'nguoi-dung', label: 'Người dùng', icon: FaUsers, sections: ['Hành vi người dùng'] },
  { id: 'du-lieu', label: 'Dữ liệu', icon: FaDatabase, sections: ['Chất lượng dữ liệu'] },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));
const DEFAULT_TAB = TABS[0].id;
const DEFAULT_NAV_HEIGHT = 72;

// ------------------------------------------------------------------ URL state
// The tab and range live in the query string so a link reopens the same view.
// Plain history API: the route stays mounted, so there is nothing to re-render.

function readUrlState(today) {
  const params = new URLSearchParams(window.location.search || '');
  const tab = TAB_IDS.has(params.get('tab')) ? params.get('tab') : DEFAULT_TAB;
  const from = params.get('from');
  const to = params.get('to');
  let range = { ...presetRange('last7', today), preset: 'last7' };
  if (isYmd(from) && isYmd(to) && !validateRange(from, to, today, MAX_RANGE_DAYS)) {
    const preset = PRESETS.find((p) => {
      const r = presetRange(p.key, today);
      return r && r.from === from && r.to === to;
    });
    range = { from, to, preset: preset ? preset.key : 'custom' };
  }
  return { tab, range };
}

function writeUrlState({ tab, range }) {
  const { pathname = '', search = '', hash = '' } = window.location;
  const params = new URLSearchParams(search);
  params.set('tab', tab);
  params.set('from', range.from);
  params.set('to', range.to);
  const next = `${pathname}?${params.toString()}${hash}`;
  if (next !== `${pathname}${search}${hash}`) {
    window.history.replaceState(window.history.state, '', next);
  }
}

// ------------------------------------------------------------------ pieces

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải báo cáo" data-testid="perf-skeleton" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-7">
          <div className="perf-skeleton h-5 w-40 mb-4" />
          <div className="perf-skeleton h-8 w-72 mb-6" />
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="perf-skeleton h-6 mb-3" />)}
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-5">
          <div className="perf-skeleton h-5 w-36 mb-4" />
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="perf-skeleton h-10 mb-3" />)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="perf-skeleton h-5 w-44 mb-4" />
        <div className="perf-skeleton h-52" />
      </div>
    </div>
  );
}

function EmptyState({ meta, onOpenSettings }) {
  return (
    <div className="perf-card bg-white rounded-lg shadow-lg p-10 text-center" data-testid="perf-empty">
      <FaInbox className="mx-auto text-5xl text-red-200 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-bold text-gray-800">Không có request nào trong khoảng thời gian này</h2>
      <p className="mt-2 text-sm text-gray-600 max-w-xl mx-auto">
        {meta ? `${fmtRange(meta.from, meta.to)}. ` : ''}
        Chọn một khoảng thời gian khác, hoặc kiểm tra danh sách user bị loại trừ trong Cài đặt.
      </p>
      <button type="button" onClick={onOpenSettings} className="perf-btn-secondary mt-5">
        <FaCog aria-hidden="true" /> Mở Cài đặt
      </button>
    </div>
  );
}

function ErrorBanner({ error, report, meta, loading, onRetry }) {
  return (
    <div
      className="perf-no-print flex flex-wrap items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      role="alert"
      data-testid="perf-error"
    >
      <FaExclamationTriangle className="flex-none mt-1 text-red-600" aria-hidden="true" />
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
      <button type="button" onClick={onRetry} disabled={loading} className="perf-btn-primary">
        {loading && <FaSpinner className="animate-spin" aria-hidden="true" />}
        Thử lại
      </button>
    </div>
  );
}

function TabStrip({ active, onSelect, top }) {
  const refs = useRef({});
  const scrollerRef = useRef(null);
  const [fade, setFade] = useState({ left: false, right: false });

  // On narrow screens some tabs sit off-screen: fade the edge that has more.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => {
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setFade((f) => (f.left === left && f.right === right ? f : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Keep the selected tab visible inside the strip.
  useEffect(() => {
    refs.current[active]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === active);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0];
    else if (e.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div className="perf-tabbar sticky z-30 mt-4" style={{ top }}>
      <div
        ref={scrollerRef}
        className={`perf-tabs-scroll bg-white rounded-lg shadow-lg px-2 py-2 flex gap-1 overflow-x-auto${
          fade.left ? ' perf-fade-left' : ''}${fade.right ? ' perf-fade-right' : ''}`}
        role="tablist"
        aria-label="Nội dung báo cáo"
        onKeyDown={onKeyDown}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`perf-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`perf-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(t.id)}
              className="perf-tab"
            >
              <Icon aria-hidden="true" className={selected ? 'text-red-600' : 'text-gray-400'} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabPanel({ tab, report, hideIds, onOpenSettings }) {
  const { meta } = report;
  switch (tab) {
    case 'tong-quan':
      return (
        <div className="space-y-6">
          {Array.isArray(report.cost?.unpriced) && report.cost.unpriced.length > 0 && (
            <UnpricedWarning unpriced={report.cost.unpriced} onOpenSettings={onOpenSettings} />
          )}
          <div className="perf-grid-2 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <KpiCards kpis={report.kpis} meta={meta} onOpenSettings={onOpenSettings} />
            </div>
            <div className="lg:col-span-5">
              <Highlights highlights={report.highlights} />
            </div>
          </div>
          <DailyTraffic usage={report.usage} />
        </div>
      );
    case 'su-dung':
      return <UsageSection usage={report.usage} />;
    case 'mon-hoc':
      return <CourseSection courses={report.courses} />;
    case 'hieu-nang':
      return (
        <div className="space-y-6">
          <ModelSection models={report.models} />
          <LatencySection latency={report.latency} stats={report.models?.stats} />
          <ReliabilitySection reliability={report.reliability} traceUrlBase={meta?.trace_url_base} hideIds={hideIds} />
        </div>
      );
    case 'chi-phi':
      return <CostSection cost={report.cost} onOpenSettings={onOpenSettings} />;
    case 'nguoi-dung':
      return <UsersSection users={report.users} hideIds={hideIds} />;
    case 'du-lieu':
      return <DataQualitySection dataQuality={report.data_quality} meta={meta} />;
    default:
      return null;
  }
}

// ------------------------------------------------------------------ page

const AdminPerformance = () => {
  const today = useMemo(() => todayInTz(), []);
  const initial = useMemo(() => readUrlState(today), [today]);
  const [range, setRange] = useState(initial.range);
  const [tab, setTab] = useState(initial.tab);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hideIds, setHideIds] = useState(loadHideIds);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [navHeight, setNavHeight] = useState(DEFAULT_NAV_HEIGHT);

  const rootRef = useRef(null);
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

  useEffect(() => {
    writeUrlState({ tab, range });
  }, [tab, range]);

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

  const selectTab = (id) => {
    setTab(id);
    // Keep the tab strip in view when switching from further down the page.
    const strip = rootRef.current?.querySelector('.perf-tabbar');
    if (strip && window.scrollY > 0 && strip.getBoundingClientRect().top < navHeight - 1) {
      window.scrollTo({ top: window.scrollY + strip.getBoundingClientRect().top - navHeight, behavior: 'auto' });
    }
  };

  // Print renders every tab; give charts a moment to lay out at print width.
  const handlePrint = () => {
    flushSync(() => setPrinting(true));
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 300);
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

  // The site navbar is fixed; the page starts below it and the tab strip sticks under it.
  useLayoutEffect(() => {
    const measure = () => {
      const header = rootRef.current?.querySelector('header');
      const h = header?.offsetHeight || DEFAULT_NAV_HEIGHT;
      setNavHeight((cur) => (cur === h ? cur : h));
    };
    measure();
    window.addEventListener('resize', measure);
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      const header = rootRef.current?.querySelector('header');
      if (header) observer.observe(header);
    }
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  const meta = report?.meta || null;

  useEffect(() => {
    const previousTitle = document.title;
    if (meta?.from && meta?.to) {
      document.title = `Hiệu năng API ${meta.from} – ${meta.to}`;
    }
    return () => { document.title = previousTitle; };
  }, [meta?.from, meta?.to]);

  const isEmpty = Boolean(report) && report?.kpis?.requests?.value === 0;
  const hasData = Boolean(report) && !isEmpty;
  const showingOtherRange = Boolean(meta) && (meta.from !== range.from || meta.to !== range.to);
  const panels = printing ? TABS.map((t) => t.id) : [tab];

  return (
    <PrintContext.Provider value={printing}>
      <div
        ref={rootRef}
        className="perf-page bg-gradient-to-br from-red-100 to-pink-100 flex flex-col min-h-screen shrink-0"
        style={{ paddingTop: navHeight, '--perf-scroll-offset': `${navHeight + 76}px` }}
      >
        <Navbar />

        <div className="perf-container container mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1">
          {/* Print-only report header */}
          <div className="perf-print-header">
            <h1 className="text-xl font-bold">Báo cáo hiệu năng API{meta?.project_id ? ` — ${meta.project_id}` : ''}</h1>
            {meta && (
              <p className="text-sm">
                {fmtRange(meta.from, meta.to)} ({fmtInt(meta.days ?? rangeDays(meta.from, meta.to))} ngày, GMT+7)
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

          {/* Header card: what this is, the actions, the range */}
          <div className="perf-controls bg-white rounded-lg shadow-lg p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center flex-none">
                  <FaTachometerAlt className="text-white text-xl" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-gray-800">Hiệu năng API</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Lượng dùng, độ trễ và chi phí của chatbot, tính từ Langfuse
                    {meta?.project_id ? <> (dự án <span className="font-mono text-gray-700">{meta.project_id}</span>)</> : ''}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  className="perf-btn-secondary"
                  title="Tính lại từ Langfuse, bỏ qua bộ nhớ đệm 5 phút"
                >
                  <FaSyncAlt className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Làm mới
                </button>
                <button
                  type="button"
                  onClick={toggleHideIds}
                  aria-pressed={hideIds}
                  className="perf-btn-secondary"
                  title="Hiện mã ẩn danh thay cho mã user khi trình chiếu"
                >
                  {hideIds ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />} Ẩn ID
                </button>
                <button type="button" onClick={openSettings} className="perf-btn-secondary">
                  <FaCog aria-hidden="true" /> Cài đặt
                </button>
                <button type="button" onClick={handlePrint} disabled={!report} className="perf-btn-primary">
                  <FaPrint aria-hidden="true" /> In / PDF
                </button>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <DateRangeBar range={range} today={today} onChange={setRange} disabled={false} />
              <p className="mt-3 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
                {meta?.previous && <span>So với {fmtRange(meta.previous.from, meta.previous.to)}</span>}
                {meta?.generated_at && (
                  <span title={fmtDateTime(meta.generated_at, { withYear: true })}>
                    Dữ liệu lúc {fmtClock(meta.generated_at)}{meta.cached ? ' (từ bộ nhớ đệm)' : ''}
                  </span>
                )}
                {meta?.includes_today && (
                  <span className="badge badge-sm border-0 bg-amber-100 text-amber-800 font-semibold" data-testid="perf-partial-badge">
                    Hôm nay chưa hết ngày, số liệu còn tăng
                  </span>
                )}
                {showingOtherRange && !loading && (
                  <span className="badge badge-sm border-0 bg-gray-100 text-gray-700">
                    Đang hiển thị {fmtRange(meta.from, meta.to)}
                  </span>
                )}
                {loading && (
                  <span className="inline-flex items-center gap-1 text-gray-600">
                    <FaSpinner className="animate-spin" aria-hidden="true" /> Đang tải...
                  </span>
                )}
              </p>
            </div>
          </div>

          {hasData && <TabStrip active={tab} onSelect={selectTab} top={navHeight} />}

          <div className={hasData ? 'mt-6' : 'mt-6'}>
            {error && (
              <div className="mb-6">
                <ErrorBanner error={error} report={report} meta={meta} loading={loading} onRetry={retry} />
              </div>
            )}

            {!report && loading && <LoadingSkeleton />}

            {isEmpty && (
              <div className="space-y-6">
                <EmptyState meta={meta} onOpenSettings={openSettings} />
                <DataQualitySection dataQuality={report.data_quality} meta={meta} />
              </div>
            )}

            {hasData && panels.map((id) => (
              <div
                key={id}
                id={`perf-panel-${id}`}
                role="tabpanel"
                tabIndex={0}
                aria-labelledby={`perf-tab-${id}`}
                className={`perf-panel perf-panel-enter rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-red-100 ${loading ? 'opacity-60 transition-opacity' : ''} ${printing ? 'mb-6' : ''}`}
              >
                <TabPanel tab={id} report={report} hideIds={hideIds} onOpenSettings={openSettings} />
              </div>
            ))}
          </div>
        </div>

        <Footer />

        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={onSettingsSaved} />
      </div>
    </PrintContext.Provider>
  );
};

export default AdminPerformance;
