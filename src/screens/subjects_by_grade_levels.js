// src/pages/SubjectsByGradeLevels.jsx
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
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Safe URL joiner
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

// Minimal JSON request helper
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

// Tiny skeleton
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

// Sort helpers
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
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    const sa = (va ?? '').toString().toLowerCase();
    const sb = (vb ?? '').toString().toLowerCase();
    if (sa < sb) return -1 * mul;
    if (sa > sb) return 1 * mul;
    return 0;
  };
};

const PAGE_SIZES = [5, 10, 20, 50];

export default function SubjectsByGradeLevels() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);

  // Query state (persisted)
  const [page, setPage] = useState(Number(sessionStorage.getItem('sbg.page') || 1));
  const [pageSize, setPageSize] = useState(Number(sessionStorage.getItem('sbg.size') || 10));
  const [q, setQ] = useState(sessionStorage.getItem('sbg.q') || '');
  const [debouncedQ, setDebouncedQ] = useState((sessionStorage.getItem('sbg.q') || '').toLowerCase());
  const [sort, setSort] = useState(sessionStorage.getItem('sbg.sort') || 'grade_code:asc'); // grade_code | grade_name | n_sections | n_subjects

  // Data + UI
  const [curriculum, setCurriculum] = useState(null);
  const [rows, setRows] = useState([]); // grade-level rows
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });

  // Persist query bits
  useEffect(() => { sessionStorage.setItem('sbg.page', String(page)); }, [page]);
  useEffect(() => { sessionStorage.setItem('sbg.size', String(pageSize)); }, [pageSize]);
  useEffect(() => { sessionStorage.setItem('sbg.sort', sort); }, [sort]);
  useEffect(() => {
    sessionStorage.setItem('sbg.q', q);
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      const url = `${joinUrl(BASE_URL, 'subjects/view-all-sub-grade-levels')}?${qs.toString()}`;
      const resp = await request(url, token);
      if (resp?.success) {
        setCurriculum(resp.curriculum || null);
        const data = Array.isArray(resp.data) ? resp.data : [];
        // Enrich for convenience
        const enriched = data.map((g) => ({
          ...g,
          n_sections: (g.sections || []).length,
          n_subjects: (g.subjects || []).length,
          section_names: (g.sections || []).map(s => s.section_name).join(', '),
          subject_codes: (g.subjects || []).map(s => s.subject_code).join(', '),
          subject_names: (g.subjects || []).map(s => s.subject_name).join(', '),
        }));
        setRows(enriched);
        const p = resp.pagination || { page: 1, limit: pageSize, total: data.length, totalPages: 1 };
        setPagination({
          page: Number(p.page || 1),
          limit: Number(p.limit || pageSize),
          total: Number(p.total || data.length || 0),
          totalPages: Number(p.totalPages || 1),
        });
      } else {
        setCurriculum(null);
        setRows([]);
        setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
        setModal({ show: true, title: 'Notice', message: resp?.message || 'No data returned.', variant: 'info' });
      }
    } catch (e) {
      setModal({ show: true, title: 'Error', message: 'Failed to load subjects by grade level.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

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

  // Client-side filter & sort (for current server page)
  const pageFiltered = rows.filter((g) => {
    if (!debouncedQ) return true;
    const hay = [
      g.grade_code, g.grade_name,
      g.section_names, g.subject_codes, g.subject_names,
    ].join(' ').toLowerCase();
    return hay.includes(debouncedQ);
  });
  const pageSorted = [...pageFiltered].sort(buildSorter(sort));

  return (
    <div className="container-xxl my-4">
      {/* Title / Meta */}
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3">
        <div>
          <h4 className="fw-bold mb-1">Subjects by Grade Level</h4>
          <p className="text-muted mb-0 small">
            {curriculum ? (
              <>
                Active curriculum:&nbsp;
                <span className="fw-semibold">{curriculum.curriculum_name}</span>
                {curriculum.school_year_id ? <> • SY ID: {curriculum.school_year_id}</> : null}
                {' '}• Page {pagination.page} of {pagination.totalPages} • {pagination.total} total
              </>
            ) : (
              <>Page {pagination.page} of {pagination.totalPages} • {pagination.total} total</>
            )}
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
                  placeholder="Search grade, section, or subject…"
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
            <h5 className="mt-2 mb-1">No results</h5>
            <p className="text-muted small mb-0">Try a different search, or navigate pages.</p>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive" style={{ maxHeight: '65vh' }}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ width: 160 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('grade_code')}>
                      Grade Code <SortIcon field="grade_code" sort={sort} />
                    </button>
                  </th>
                  <th style={{ minWidth: 200 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('grade_name')}>
                      Grade Name <SortIcon field="grade_name" sort={sort} />
                    </button>
                  </th>
                  <th style={{ width: 160 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('n_sections')}>
                      Sections <SortIcon field="n_sections" sort={sort} />
                    </button>
                  </th>
                  <th>
                    {/* Full list of section names, truncated in cell */}
                    Section Names
                  </th>
                  <th style={{ width: 160 }}>
                    <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('n_subjects')}>
                      Subjects <SortIcon field="n_subjects" sort={sort} />
                    </button>
                  </th>
                  <th>Subject Codes</th>
                </tr>
              </thead>
              <tbody>
                {pageSorted.map((g) => (
                  <tr key={g.grade_level_id}>
                    <td className="fw-semibold">{g.grade_code}</td>
                    <td className="text-capitalize">{g.grade_name}</td>
                    <td>
                      <span className="badge text-bg-secondary">{g.n_sections}</span>
                    </td>
                    <td className="text-truncate" style={{ maxWidth: 420 }} title={g.section_names}>
                      {g.section_names || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className="badge text-bg-primary">{g.n_subjects}</span>
                    </td>
                    <td className="text-truncate" style={{ maxWidth: 420 }} title={g.subject_codes}>
                      {/* Show codes; hover shows complete list */}
                      {g.subject_codes || <span className="text-muted">—</span>}
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

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
}
