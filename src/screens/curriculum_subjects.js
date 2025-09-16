// src/pages/CurriculumSubjects.jsx
import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaSync,
  FaTimes,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // In many of your screens this already includes "/esf10"

/** Safe URL joiner (avoids double/missing slashes) */
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Minimal JSON request helper */
const request = async (url, token) => {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    // Date-safe, number-safe, string fallback
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
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const PAGE_SIZES = [5, 10, 20, 50];

export default function CurriculumSubjects() {
  const { id } = useParams(); // route param :id => curriculum_id
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);

  // Query state (persisted)
  const [page, setPage] = useState(Number(sessionStorage.getItem('currsubj.page') || 1));
  const [pageSize, setPageSize] = useState(Number(sessionStorage.getItem('currsubj.size') || 10));
  const [q, setQ] = useState(sessionStorage.getItem('currsubj.q') || '');
  const [debouncedQ, setDebouncedQ] = useState((sessionStorage.getItem('currsubj.q') || '').toLowerCase());
  const [sort, setSort] = useState(sessionStorage.getItem('currsubj.sort') || 'subject_name:asc');

  // Data + UI
  const [subjects, setSubjects] = useState([]); // current page data from API
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      // If BASE_URL already includes /esf10, keep only the path below:
      const url = `${joinUrl(BASE_URL, `curriculum/curriculum-subjects/${id}`)}?${qs.toString()}`;
      const resp = await request(url, token);
      if (resp?.success) {
        setSubjects(resp.data || []);
        const p = resp.pagination || { page: 1, limit: pageSize, total: (resp.data || []).length, totalPages: 1 };
        setPagination({ page: Number(p.page || 1), limit: Number(p.limit || pageSize), total: Number(p.total || 0), totalPages: Number(p.totalPages || 1) });
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
            Curriculum ID: <span className="fw-semibold">{id}</span> • Page {pagination.page} of {pagination.totalPages} • {pagination.total} total
          </p>
        </div>
        <div className="d-flex gap-2 mt-2 mt-md-0">
          {/* NEW: Back button */}
          <button
            className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
            onClick={() => navigate(-1)}
            title="Back"
          >
            <FaChevronLeft />
            <span className="d-none d-sm-inline">Back</span>
          </button>

          {/* Refresh */}
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
              <thead
                className="table-light"
                style={{ position: 'sticky', top: 0, zIndex: 1 }}
              >
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
                  <th style={{ width: 140 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('grade_level')}>
                      Grade Level <SortIcon field="grade_level" sort={sort} />
                    </button>
                  </th>
                  <th>Description</th>
                  <th style={{ width: 200 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('created_at')}>
                      Created <SortIcon field="created_at" sort={sort} />
                    </button>
                  </th>
                  <th style={{ width: 200 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('updated_at')}>
                      Updated <SortIcon field="updated_at" sort={sort} />
                    </button>
                  </th>
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
                    <td className="small text-muted">{fmtDate(s.created_at)}</td>
                    <td className="small text-muted">{fmtDate(s.updated_at)}</td>
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

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
}
