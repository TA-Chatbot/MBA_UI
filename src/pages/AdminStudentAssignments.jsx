import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, TriangleAlert, Trash2, Download, X, Clock3, Link2, Search } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { API_ENDPOINTS } from '../config/api';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail;
    const error = new Error(typeof detail === 'string' ? detail : detail?.message || 'Không thể xử lý file Excel.');
    error.report = typeof detail === 'object' ? detail : null;
    throw error;
  }
  return body;
}

export default function AdminStudentAssignments() {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [uploadId, setUploadId] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveResults, setDriveResults] = useState([]);
  const [driveProgress, setDriveProgress] = useState(0);

  const loadHistory = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_HISTORY, { headers: authHeaders() });
      const data = await parseResponse(response);
      setHistory(data.uploads || []);
      setHistoryError('');
    } catch (err) { setHistoryError(err.message); }
  };

  useEffect(() => { loadHistory(); }, []);

  const submitFile = async (url, action, fileOverride = file, uploadIdOverride = uploadId, subjectOverride = selectedSubject) => {
    if (!fileOverride) return;
    setBusy(action);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', fileOverride);
      if (subjectOverride) form.append('subject_id', subjectOverride);
      if (uploadIdOverride) form.append('upload_id', uploadIdOverride);
      const response = await fetch(url, { method: 'POST', headers: authHeaders(), body: form });
      const data = await parseResponse(response);
      if (action === 'preview') {
        setReport(data);
        setUploadId(data.upload_id || '');
        await loadHistory();
        if (!subjectOverride && data.suggested_subject_id) setSelectedSubject(data.suggested_subject_id);
      }
      else {
        setResult(data);
        setReport(null);
        await loadHistory();
      }
    } catch (err) {
      setError(err.message);
      if (err.report) setReport(err.report);
    } finally {
      setBusy('');
    }
  };

  const selectFile = (nextFile) => {
    setFile(nextFile || null);
    setReport(null);
    setResult(null);
    setSelectedSubject('');
    setUploadId('');
    setError('');
  };

  const fetchDriveFiles = async (event) => {
    event.preventDefault();
    setDriveBusy(true); setDriveFiles([]); setError('');
    try {
      const form = new FormData(); form.append('drive_url', driveUrl.trim());
      const response = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_DRIVE_FILES, { method: 'POST', headers: authHeaders(), body: form });
      const data = await parseResponse(response);
      setDriveFiles(data.files || []);
      if (!data.files?.length) setError('Không tìm thấy file Excel trong thư mục Drive.');
    } catch (err) { setError(err.message); }
    finally { setDriveBusy(false); }
  };

  const previewDriveFile = async (driveFile, existingUploadId = '') => {
    setDriveBusy(true); setError('');
    try {
      const form = new FormData(); form.append('file_id', driveFile.file_id); form.append('filename', driveFile.filename);
      const url = existingUploadId
        ? API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_HISTORY_FILE(existingUploadId)
        : API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_DRIVE_DOWNLOAD;
      const response = await fetch(url, existingUploadId ? { headers: authHeaders() } : { method: 'POST', headers: authHeaders(), body: form });
      if (!response.ok) await parseResponse(response);
      const downloadedFile = new File([await response.blob()], driveFile.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setFile(downloadedFile); setUploadId(existingUploadId); setSelectedSubject(''); setReport(null); setResult(null);
      await submitFile(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_PREVIEW, 'preview', downloadedFile, existingUploadId, '');
    } catch (err) { setError(err.message); }
    finally { setDriveBusy(false); }
  };

  const previewAllDriveFiles = async () => {
    if (!driveFiles.length) return;
    setDriveBusy(true); setDriveResults([]); setDriveProgress(0); setError('');
    setFile(null); setUploadId(''); setSelectedSubject(''); setReport(null); setResult(null);
    const results = [];
    for (const [index, driveFile] of driveFiles.entries()) {
      try {
        const downloadForm = new FormData();
        downloadForm.append('file_id', driveFile.file_id);
        downloadForm.append('filename', driveFile.filename);
        const downloadResponse = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_DRIVE_DOWNLOAD, {
          method: 'POST', headers: authHeaders(), body: downloadForm,
        });
        if (!downloadResponse.ok) await parseResponse(downloadResponse);
        const excelFile = new File([await downloadResponse.blob()], driveFile.filename, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const previewForm = new FormData(); previewForm.append('file', excelFile);
        const previewResponse = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_PREVIEW, {
          method: 'POST', headers: authHeaders(), body: previewForm,
        });
        const preview = await parseResponse(previewResponse);
        results.push({
          file_id: driveFile.file_id, filename: driveFile.filename, upload_id: preview.upload_id,
          student_count: preview.student_count, assignment_count: preview.assignment_count,
          can_import: preview.can_import, subject_mismatch: preview.subject_mismatch,
          needs_subject: preview.needs_subject, invalid_count: preview.invalid_rows?.length || 0,
        });
      } catch (err) {
        results.push({ file_id: driveFile.file_id, filename: driveFile.filename, error: err.message });
      }
      setDriveResults([...results]);
      setDriveProgress(index + 1);
    }
    await loadHistory();
    setDriveBusy(false);
  };

  const removeUpload = async (id) => {
    if (!window.confirm('Gỡ file gốc khỏi lịch sử upload? Nếu file đã nhập, dữ liệu phân môn trong hệ thống vẫn được giữ.')) return;
    setBusy('remove');
    try {
      await parseResponse(await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_HISTORY_ITEM(id), { method: 'DELETE', headers: authHeaders() }));
      if (id === uploadId) selectFile(null);
      await loadHistory();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const reopenUpload = async (item, previewNow = false) => {
    setBusy('open');
    setError('');
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_HISTORY_FILE(item.upload_id), { headers: authHeaders() });
      if (!response.ok) throw new Error('Không tải được file từ lịch sử.');
      const restored = new File([await response.blob()], item.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setFile(restored); setUploadId(item.upload_id); setReport(null); setResult(null); setSelectedSubject('');
      if (previewNow) await submitFile(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_PREVIEW, 'preview', restored, item.upload_id, '');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const downloadUpload = async (item) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_HISTORY_FILE(item.upload_id), { headers: authHeaders() });
      if (!response.ok) throw new Error('Không tải được file từ lịch sử.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = item.filename; anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 88 }}>
      <Navbar />
      <main className="w-full max-w-none mx-auto px-4 sm:px-6 xl:px-8 py-8 flex-1">
        <a href="/mini/admin" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-700 mb-5">
          <ArrowLeft size={17} aria-hidden="true" /> Quay lại quản trị
        </a>
        <header className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Phân môn cho sinh viên</h1>
          <p className="mt-2 text-sm text-gray-600">Đối chiếu danh sách sinh viên và môn học trước khi ghép vào student_chatbots.</p>
        </header>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="self-start overflow-hidden rounded-lg border border-gray-200 bg-white xl:sticky xl:top-24">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4"><Clock3 size={17} className="text-gray-500" /><h2 className="font-semibold text-gray-900">Lịch sử upload</h2><span className="ml-auto text-xs text-gray-500">{history.length}</span></div>
          {historyError && <p role="alert" className="px-4 py-3 text-sm text-red-700">{historyError}</p>}
          <div className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
            {history.map((item) => <div key={item.upload_id} className={`group flex gap-2 px-3 py-3 ${item.upload_id === uploadId ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
              <button type="button" onClick={() => reopenUpload(item)} title="Mở file và tiếp tục đối chiếu" className="min-w-0 flex-1 text-left" disabled={!!busy}>
                <span className="block truncate text-sm font-medium text-gray-900">{item.filename}</span>
                <span className="mt-1 block text-xs text-gray-500">{item.student_count || 0} sinh viên · {item.status === 'imported' ? 'Đã nhập' : 'Chờ xác nhận'}</span>
                {item.subject_mismatch && <span className="mt-1 block text-xs font-medium text-amber-700">Tên file và nội dung lệch môn</span>}
                {item.subjects?.length > 0 && <span className="mt-1 block truncate text-xs text-gray-500">{item.subjects.join(', ')}</span>}
              </button>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" onClick={() => downloadUpload(item)} title="Tải file gốc" aria-label={`Tải ${item.filename}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900"><Download size={16} /></button>
                <button type="button" onClick={() => removeUpload(item.upload_id)} title="Gỡ khỏi lịch sử" aria-label={`Gỡ ${item.filename}`} className="rounded p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-700"><Trash2 size={16} /></button>
              </div>
            </div>)}
            {!history.length && !historyError && <p className="px-4 py-8 text-center text-sm text-gray-500">Chưa có file upload</p>}
          </div>
        </aside>
        <div className="min-w-0">
        <section className="bg-white border border-gray-200 rounded-lg p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-5">
            <div>
              <h2 className="font-semibold text-gray-900">File danh sách</h2>
              <p className="text-sm text-gray-600 mt-1">Excel .xlsx hoặc .xls. Hỗ trợ mã sinh viên, họ tên và mã học phần.</p>
            </div>
          </div>

          <form onSubmit={fetchDriveFiles} className="mt-5 rounded-md border border-gray-200 p-4">
            <label htmlFor="assignment-drive-url" className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-800"><Link2 size={16} aria-hidden="true" /> Lấy file từ Google Drive</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="assignment-drive-url" type="url" value={driveUrl} onChange={(event) => { setDriveUrl(event.target.value); setDriveFiles([]); setDriveResults([]); setDriveProgress(0); }} placeholder="https://drive.google.com/drive/folders/..." required
                className="min-h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100" />
              <button type="submit" disabled={driveBusy || !!busy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
                {driveBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />} Quét thư mục
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Chỉ nhận thư mục được chia sẻ công khai; file chỉ được tải khi bạn chọn đối chiếu.</p>
            {driveFiles.length > 0 && <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">Tìm thấy {driveFiles.length} file Excel</span>
                <button type="button" onClick={previewAllDriveFiles} disabled={driveBusy || !!busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                  {driveBusy && driveProgress > 0 ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
                  {driveBusy && driveProgress > 0 ? `Đang đối chiếu ${driveProgress}/${driveFiles.length}` : `Đối chiếu tất cả (${driveFiles.length})`}
                </button>
              </div>
              <div aria-live="polite" className="divide-y divide-gray-100">
                {driveFiles.map((driveFile) => {
                  const checked = driveResults.find((item) => item.file_id === driveFile.file_id);
                  return <div key={driveFile.file_id} className="min-w-0 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileSpreadsheet size={17} className="shrink-0 text-green-700" aria-hidden="true" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900" title={driveFile.path}>{driveFile.filename}</p>{driveFile.path !== driveFile.filename && <p className="truncate text-xs text-gray-500">{driveFile.path}</p>}</div>
                      <button type="button" onClick={() => previewDriveFile(driveFile)} disabled={driveBusy || !!busy} className="min-h-10 shrink-0 rounded-md border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">Đối chiếu</button>
                    </div>
                    {checked && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-8 text-xs">
                      {checked.error ? <span className="text-red-700">Lỗi: {checked.error}</span> : <span className={checked.can_import ? 'text-green-800' : 'text-amber-800'}>
                        {checked.student_count} sinh viên · {checked.assignment_count} lượt phân môn · {checked.can_import ? 'Sẵn sàng xác nhận' : checked.subject_mismatch ? 'Tên file và nội dung lệch môn' : checked.needs_subject ? 'Cần chọn môn' : `${checked.invalid_count} dòng cần xử lý`}
                      </span>}
                      {checked.upload_id && <button type="button" onClick={() => reopenUpload({ upload_id: checked.upload_id, filename: driveFile.filename }, true)} disabled={driveBusy || !!busy} className="font-semibold text-red-700 hover:underline disabled:opacity-50">Mở đối chiếu</button>}
                    </div>}
                  </div>;
                })}
              </div>
              {driveBusy && driveProgress > 0 && <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600" role="status">Đã xử lý {driveProgress}/{driveFiles.length} file. Chưa có dữ liệu nào được ghi vào môn sinh viên.</p>}
              {!driveBusy && driveResults.length > 0 && <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600" role="status">Đã đối chiếu {driveResults.length}/{driveFiles.length} file. Mỗi file cần được mở và xác nhận riêng trước khi ghi database.</p>}
            </div>}
          </form>

          <label htmlFor="student-assignment-file" className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 text-center hover:border-red-400 hover:bg-red-50/30">
            <FileSpreadsheet size={27} className="text-red-700" aria-hidden="true" />
            <span className="mt-2 font-medium text-gray-800">{file?.name || 'Chọn file Excel để tải lên'}</span>
            <span className="mt-1 text-sm text-gray-500">Chấp nhận .xlsx, .xls</span>
            <input id="student-assignment-file" type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
          </label>
          {file && <div className="mt-2 flex items-center justify-between gap-3 text-sm text-gray-600"><span className="truncate">File đang chọn: {file.name}</span><button type="button" onClick={() => uploadId ? removeUpload(uploadId) : selectFile(null)} title="Gỡ file đang chọn" aria-label="Gỡ file đang chọn" className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-red-700 hover:bg-red-50"><X size={16} /> Gỡ file</button></div>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => submitFile(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_PREVIEW, 'preview')} disabled={!file || !!busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />}
              {report ? 'Cập nhật đối chiếu' : 'Xem đối chiếu'}
            </button>
            {report?.can_import && (
              <button type="button" onClick={() => submitFile(API_ENDPOINTS.ADMIN_STUDENT_ASSIGNMENT_IMPORT, 'import')} disabled={!!busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-700 px-5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">
                {busy ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                Xác nhận ghi vào database
              </button>
            )}
          </div>
          {report?.subject_options?.length > 0 && (
            <div className="mt-5 max-w-xl">
              <label htmlFor="assignment-subject" className="mb-1 block text-sm font-medium text-gray-800">Môn học cần ghép</label>
              <input id="assignment-subject" list="assignment-subject-options" value={selectedSubject} onChange={(event) => {
                setSelectedSubject(event.target.value);
                setReport((current) => current ? { ...current, can_import: false } : current);
              }} placeholder="Nhập mã môn hoặc tên môn" className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100" />
              <datalist id="assignment-subject-options">
                {report.subject_options.map((topic) => <option key={`code-${topic.subject_id}`} value={topic.subject_id} label={topic.subject_name} />)}
                {report.subject_options.map((topic) => <option key={`name-${topic.subject_id}`} value={topic.subject_name} label={topic.subject_id} />)}
              </datalist>
              <p className="mt-1 text-xs text-gray-500">Có thể nhập mã môn hoặc tên môn; chọn đúng gợi ý rồi bấm “Cập nhật đối chiếu”.</p>
              {report.suggested_subject_id && <p className="mt-1 text-sm text-gray-600">Môn nhận diện từ file: <strong>{report.suggested_subject_id}</strong></p>}
              {(report.filename_subjects?.length > 0 || report.content_subjects?.length > 0) && <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700"><p>Mã môn trong tên file: <strong>{report.filename_subjects?.join(', ') || 'Không nhận diện được'}</strong></p><p className="mt-1">Mã môn trong nội dung: <strong>{report.content_subjects?.join(', ') || 'Không nhận diện được'}</strong></p></div>}
              {report.subject_mismatch && <p role="alert" className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><TriangleAlert size={17} className="mt-0.5 shrink-0" />Tên file và nội dung Excel có mã môn khác nhau. Hãy kiểm tra bảng gốc, chọn chính xác môn cần ghép rồi bấm “Cập nhật đối chiếu”.</p>}
              {report.invalid_subject_input && <p role="alert" className="mt-1 text-sm text-red-700">Không tìm thấy môn khớp với nội dung đã nhập. Chọn mã hoặc tên môn từ gợi ý.</p>}
              {report.needs_subject && <p className="mt-1 text-sm text-amber-800">Chưa nhận diện được môn. Chọn môn rồi bấm “Cập nhật đối chiếu”.</p>}
            </div>
          )}
        </section>

        {error && <div role="alert" className="mt-5 flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"><TriangleAlert size={18} className="mt-0.5 shrink-0" />{error}</div>}
        {result && <div role="status" className="mt-5 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">{result.message}</p>
          <p className="mt-1">Đã thêm {result.inserted} sinh viên mới, cập nhật {result.updated}, bỏ qua {result.skipped}; {result.assignment_count} lượt phân môn.</p>
        </div>}

        {report && <section className="mt-5 bg-white border border-gray-200 rounded-lg p-5 sm:p-7" aria-live="polite">
          <h2 className="font-semibold text-gray-900">Kết quả kiểm tra</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Sinh viên", report.student_count], ["Lượt phân môn", report.assignment_count], ["Thêm mới", report.planned_inserts], ["Cập nhật", report.planned_updates]].map(([label, value]) => (
              <div key={label} className="border-l-2 border-red-700 pl-3 py-1"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</div></div>
            ))}
          </div>
          {report.missing_topics?.length > 0 && <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Chưa có chatbot cho môn: {report.missing_topics.join(', ')}. Chưa thể nhập.</p>}
          {report.invalid_rows?.length > 0 && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <p>Có {report.invalid_rows.length} dòng cần xử lý trước khi nhập.</p>
            {report.invalid_rows.slice(0, 5).map((row) => <p key={`${row.row}-${row.student_id}`} className="mt-1">Dòng {row.row}: {row.student_id || 'Thiếu mã sinh viên'} · {row.reason}</p>)}
          </div>}
          {report.duplicates?.length > 0 && <p className="mt-3 text-sm text-gray-600">Đã bỏ qua {report.duplicates.length} dòng trùng sinh viên và học phần trong file.</p>}
          <div className="mt-5 grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-md border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Nội dung file Excel gốc</h3>
                <p className="mt-1 text-xs text-gray-500">Sheet: {report.source_sheet} · Hàng tiêu đề: {report.header_row} · Đang xem {report.source_preview?.length || 0}/{report.source_row_count} hàng đầu</p>
              </div>
              <div className="max-h-[65vh] min-h-[480px] overflow-auto">
                <table className="w-max min-w-full border-collapse text-sm">
                  <tbody>{report.source_preview?.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex + 1 === report.header_row ? 'bg-red-50 font-semibold' : 'odd:bg-white even:bg-gray-50'}>
                    <th className="sticky left-0 border-b border-r border-gray-200 bg-gray-100 px-2 py-2 text-right text-gray-500">{rowIndex + 1}</th>
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[420px] min-w-[100px] border-b border-r border-gray-100 px-3 py-2.5 text-gray-700">{cell}</td>)}
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
            <section className="min-w-0 overflow-hidden rounded-md border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Thông tin sẽ ghép vào hệ thống</h3>
                <p className="mt-1 text-xs text-gray-500">Mã sinh viên, họ tên và môn học sẽ được thêm vào student_chatbots.</p>
              </div>
              <div className="max-h-[65vh] min-h-[480px] overflow-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-gray-200 bg-white text-xs uppercase text-gray-600"><tr><th className="px-3 py-3">Mã sinh viên</th><th className="px-3 py-3">Họ tên</th><th className="px-3 py-3">Môn học</th></tr></thead>
                  <tbody>{report.students?.map((student) => <tr key={student.student_id} className="border-b border-gray-100"><td className="px-3 py-2 font-medium text-gray-900">{student.student_id}</td><td className="px-3 py-2 text-gray-700">{student.full_name || <span className="text-amber-700">Chưa có tên</span>}</td><td className="px-3 py-2 text-gray-700">{student.subject_ids.join(', ') || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>
        </section>}
        </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
