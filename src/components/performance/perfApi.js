// HTTP calls for the performance dashboard. Same pattern as the other admin
// pages (fetch + Bearer token from localStorage; the academic-term header is
// added by the global fetch middleware). Failures become PerfApiError with the
// backend's `detail` so the page can show it in its banner.
import { API_ENDPOINTS } from '../../config/api';

export class PerfApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'PerfApiError';
    this.status = status;
  }
}

/** FastAPI `detail` is a string, or a list of {loc, msg} for 422 validation errors. */
export function detailToMessage(detail) {
  if (detail === null || detail === undefined || detail === '') return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        const loc = Array.isArray(item?.loc)
          ? item.loc.filter((p) => p !== 'body' && p !== 'query').join('.')
          : '';
        const msg = item?.msg || JSON.stringify(item);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (typeof detail === 'object') return detail.message || JSON.stringify(detail);
  return String(detail);
}

async function request(url, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PerfApiError('Lỗi kết nối tới máy chủ.', 0);
  }

  if (response.ok) {
    try {
      return await response.json();
    } catch {
      throw new PerfApiError('Máy chủ trả về dữ liệu không đọc được.', response.status);
    }
  }

  let detail = '';
  try {
    detail = detailToMessage((await response.json())?.detail);
  } catch {
    // non-JSON error body
  }

  if (response.status === 401) {
    localStorage.removeItem('access_token');
    setTimeout(() => { window.location.href = '/mini/login'; }, 1200);
    throw new PerfApiError('Phiên đăng nhập đã hết hạn. Đang chuyển tới trang đăng nhập...', 401);
  }
  if (response.status === 403) {
    throw new PerfApiError(detail || 'Bạn không có quyền xem trang này (chỉ dành cho admin).', 403);
  }
  throw new PerfApiError(detail || `Máy chủ trả về lỗi ${response.status}.`, response.status);
}

export function reportUrl({ from, to, refresh = false }) {
  const params = new URLSearchParams({ from, to });
  if (refresh) params.set('refresh', '1');
  return `${API_ENDPOINTS.ADMIN_PERFORMANCE_REPORT}?${params.toString()}`;
}

export const fetchReport = (range) => request(reportUrl(range));
export const fetchSettings = () => request(API_ENDPOINTS.ADMIN_PERFORMANCE_SETTINGS);
export const saveSettings = (body) => request(API_ENDPOINTS.ADMIN_PERFORMANCE_SETTINGS, { method: 'PUT', body });
