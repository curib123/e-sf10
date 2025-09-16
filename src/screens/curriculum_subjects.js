// src/pages/CurriculumSubjects.jsx
import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaSync,
  FaTimes,
  FaTrashAlt,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Safe URL joiner (avoids double/missing slashes) */
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Minimal JSON request helper (supports method/body) */
const request = async (url, token, init = {}) => {
  const res = await fetch(url, {
    method: init.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = { success: false, message: 'Invalid server response' }; }
  return json;
};

/** Tiny skeleton */
const Skeleton = () => (
  <div className="card border-0 shadow-sm rounded-4 mb-3">
    <div className="card-body">
      <div className="placeholder-glow">
        <span className="placeholder col-4 d-block mb-2"></span>
        <span className="placeholder col-8 d-block"></span>
      </div>
    </div>
  </div>
);

/** Sort helpers */
const SortIcon = ({ field, sort }) => {
  const [col, dir] = sort.split(':');
  if (col !== field) return <FaSort className="opacity-50" />;
  return dir === 'asc' ? <FaSortUp /> : <FaSortDown />;
};
const buildSorter = (spec) => {
  const [col, dir] = spec.split(':');
  const mul = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    const va = a?.[col];
    const vb = b?.[col];
    const da = Date.parse(va);
    const db = Date.parse(vb);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return (da - db) * mul;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    const sa = (va ?? '').toString().toLowerCase();
    const sb = (vb ?? '').toString().toLowerCase();
    if (sa < sb) return -1 * mul;
    if (sa > sb) return 1 * mul;
    return 0;
  };
};

const PAGE_SIZES = [5, 10, 20, 50];

/** ---- FIXED: Delete confirmation modal rendered via portal ---- */
const ConfirmDeleteModal = ({ show, row, busy, onCancel, onConfirm }) => {
  // Lock body scroll and close on ESC while open
  useEffect(() => {
    if (!show) return;
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [show, onCancel]);

  if (!show) return null;

  return createPortal(
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmDeleteTitle"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content rounded-4 shadow">
            <div className="modal-header">
              <h5 className="modal-title" id="confirmDeleteTitle">Remove Subject</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} disabled={busy} />
            </div>
            <div className="modal-body">
              <p className="mb-0">
                Are you sure you want to remove{' '}
                <strong>{row?.subject_name}</strong>
                {row?.subject_code ? <> (<code>{row.subject_code}</code>)</> : null}
                {' '}from this curriculum?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-danger d-inline-flex align-items-center gap-2" onClick={onConfirm} disabled={busy}>
                {busy ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaTrashAlt />}
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop fade show"></div>
    </>,
    document.body
  );
};

export default function CurriculumSubjects() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);

  // Query state (persisted)
  const [page, setPage] = useState(Number(sessionStorage.getItem('currsubj.page') || 1));
  const [pageSize, setPageSize] = useState(Number(sessionStorage.getItem('currsubj.size') || 10));
  const [q, setQ] = useState(sessionStorage.getItem('currsubj.q') || '');
  const [debouncedQ, setDebouncedQ] = useState((sessionStorage.getItem('currsubj.q') || '').toLowerCase());
  const [sort, setSort] = useState(sessionStorage.getItem('currsubj.sort') || 'subject_name:asc');

  // Data + UI
  const [subjects, setSubjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [confirm, setConfirm] = useState({ show: false, row: null });
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });

  // Persist query bits
  useEffect(() => { sessionStorage.setItem('currsubj.page', String(page)); }, [page]);
  useEffect(() => { sessionStorage.setItem('currsubj.size', String(pageSize)); }, [pageSize]);
  useEffect(() => { sessionStorage.setItem('currsubj.sort', sort); }, [sort]);
  useEffect(() => {
    sessionStorage.setItem('currsubj.q', q);
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch from API (server-side pagination)
  const fetchData = async () => {
    if (!id) {
      setModal({ show: true, title: 'Missing ID', message: 'No curriculum id in the route.', variant: 'danger' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      const url = `${joinUrl(BASE_URL, `curriculum/curriculum-subjects/${id}`)}?${qs.toString()}`;
      const resp = await request(url, token);
      if (resp?.success) {
        setSubjects(resp.data || []);
        const p = resp.pagination || { page: 1, limit: pageSize, total: (resp.data || []).length, totalPages: 1 };
        setPagination({
          page: Number(p.page || 1),
          limit: Number(p.limit || pageSize),
          total: Number(p.total || 0),
          totalPages: Number(p.totalPages || 1),
        });
      } else {
        setSubjects([]);
        setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
        setModal({ show: true, title: 'Notice', message: resp?.message || 'No data returned.', variant: 'info' });
      }
    } catch (e) {
      setModal({ show: true, title: 'Error', message: 'Failed to load curriculum subjects.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, pageSize]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleSort = (field) => {
    setSort((prev) => {
      const [col, dir] = prev.split(':');
      return col === field ? `${field}:${dir === 'asc' ? 'desc' : 'asc'}` : `${field}:asc`;
    });
  };

  // Open confirm modal
  const askRemove = (row) => setConfirm({ show: true, row });
  const closeConfirm = () => setConfirm({ show: false, row: null });

  // Execute DELETE
  const removeSubject = async (row) => {
    if (!row?.subject_id) return;
    setRemovingId(row.subject_id);
    try {
      const url = joinUrl(BASE_URL, `curriculum/remove-subject/${id}/${row.subject_id}`);
      const resp = await request(url, token, { method: 'DELETE' });
      if (resp?.success) {
        setSubjects((prev) => prev.filter((s) => s.subject_id !== row.subject_id));
        setPagination((p) => ({ ...p, total: Math.max(0, (p.total || 0) - 1) }));
        setModal({
          show: true,
          title: 'Removed',
          message: resp.message || 'Subject removed from curriculum successfully.',
          variant: 'success',
        });
      } else {
        setModal({
          show: true,
          title: 'Failed',
          message: resp?.message || 'Could not remove subject.',
          variant: 'danger',
        });
      }
    } catch (e) {
      setModal({
        show: true,
        title: 'Error',
        message: 'Request failed while removing the subject.',
        variant: 'danger',
      });
    } finally {
      setRemovingId(null);
    }
  };

  const confirmRemove = async () => {
    const row = confirm.row;
    closeConfirm();
    await removeSubject(row);
  };

  // Client-side filter & sort (for the current server page)
  const pageFiltered = subjects.filter((s) => {
    if (!debouncedQ) return true;
    const text = `${s.subject_code ?? ''} ${s.subject_name ?? ''} ${s.description ?? ''} ${s.grade_level ?? ''}`.toLowerCase();
    return text.includes(debouncedQ);
  });
  const pageSorted = [...pageFiltered].sort(buildSorter(sort));

  return (
    <div className="container-xxl my-4">
      {/* Title / Meta */}
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3">
        <div>
          <h4 className="fw-bold mb-1">Curriculum Subjects</h4>
          <p className="text-muted mb-0 small">
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} total
          </p>
        </div>
        <div className="d-flex gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
            onClick={() => navigate(-1)}
            title="Back"
          >
            <FaChevronLeft />
            <span className="d-none d-sm-inline">Back</span>
          </button>

          <button
            className="btn btn-light border d-inline-flex align-items-center gap-2"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh"
          >
            {refreshing ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaSync />}
            <span className="d-none d-sm-inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 p-lg-4">
          <div className="row g-2 align-items-stretch">
            <div className="col-12 col-md">
              <div className="input-group">
                <span className="input-group-text bg-transparent"><FaSearch /></span>
                <input
                  className="form-control"
                  placeholder="Search by code, name, description, or grade level…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button className="btn btn-light border" onClick={() => setQ('')} title="Clear">
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-auto">
              <select
                className="form-select"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
            <div className="col-6 col-md-auto">
              <div className="btn-group w-100" role="group" aria-label="Pagination">
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Previous page"
                >
                  <FaChevronLeft />
                </button>
                <span className="btn btn-outline-secondary disabled">
                  {pagination.page} / {pagination.totalPages || 1}
                </span>
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                  onClick={() => setPage((p) => p + 1)}
                  title="Next page"
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : pageSorted.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center p-5">
            <div className="display-6">📄</div>
            <h5 className="mt-2 mb-1">No subjects on this page</h5>
            <p className="text-muted small mb-0">Try a different search, or navigate pages.</p>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive" style={{ maxHeight: '65vh' }}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ width: 140 }} className="text-center">
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('subject_code')}>
                      Code <SortIcon field="subject_code" sort={sort} />
                    </button>
                  </th>
                  <th style={{ minWidth: 240 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('subject_name')}>
                      Name <SortIcon field="subject_name" sort={sort} />
                    </button>
                  </th>
                  <th style={{ width: 160 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('grade_level')}>
                      Grade Level <SortIcon field="grade_level" sort={sort} />
                    </button>
                  </th>
                  <th>Description</th>
                  <th style={{ width: 120 }} className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageSorted.map((s) => (
                  <tr key={s.subject_id}>
                    <td className="text-center">
                      <span className="badge text-bg-secondary">{s.subject_code}</span>
                    </td>
                    <td className="fw-semibold">{s.subject_name}</td>
                    <td>{s.grade_level || <span className="text-muted">—</span>}</td>
                    <td className="text-truncate" style={{ maxWidth: 520 }}>
                      {s.description || <span className="text-muted">—</span>}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                        onClick={() => askRemove(s)}
                        disabled={removingId === s.subject_id}
                        title="Remove subject from curriculum"
                      >
                        {removingId === s.subject_id
                          ? <span className="spinner-border spinner-border-sm" role="status" />
                          : <FaTrashAlt />}
                        <span className="d-none d-md-inline">Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer meta */}
          <div className="card-footer bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="small text-muted">
              Showing <span className="fw-semibold">{pageSorted.length}</span> of{' '}
              <span className="fw-semibold">{pagination.total}</span> results
            </div>
            <div className="btn-group" role="group" aria-label="Pagination footer">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage(1)}
                title="First page"
              >
                1
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous page"
              >
                <FaChevronLeft />
              </button>
              <span className="btn btn-outline-secondary btn-sm disabled">
                {pagination.page} / {pagination.totalPages || 1}
              </span>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                onClick={() => setPage((p) => p + 1)}
                title="Next page"
              >
                <FaChevronRight />
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={pagination.page >= (pagination.totalPages || 1) || loading}
                onClick={() => setPage(pagination.totalPages || 1)}
                title="Last page"
              >
                {pagination.totalPages || 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal (now shows via portal) */}
      <ConfirmDeleteModal
        show={confirm.show}
        row={confirm.row}
        busy={!!removingId}
        onCancel={closeConfirm}
        onConfirm={confirmRemove}
      />

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
}
