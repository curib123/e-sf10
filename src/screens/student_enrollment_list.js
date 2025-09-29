import 'bootstrap/dist/css/bootstrap.min.css';

// EnrollmentList.jsx — robust filtration + caching + stable handlers
import React, {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaBookOpen,
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaInfoCircle,
  FaPlus,
  FaRedoAlt,
  FaSearch,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaTag,
  FaTimesCircle,
  FaTrash,
  FaUserGraduate,
} from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

// ───────────────────────────────────────────────────────────────────────────────
// Config / constants
const BASE_URL = process.env.REACT_APP_API_BASE_URL; // includes /esf10
const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_SORT = 'date:desc';
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// ───────────────────────────────────────────────────────────────────────────────
// Tiny utils
const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' })
    : '—';
const readQP = (s, k, f) => new URLSearchParams(s).get(k) ?? f;
const writeQP = (navigate, location, next) => {
  const p = new URLSearchParams(location.search);
  Object.entries(next).forEach(([k, v]) =>
    v === undefined || v === null || v === '' || v === 'all' ? p.delete(k) : p.set(k, String(v)),
  );
  navigate({ search: p.toString() }, { replace: true });
};
const useDebounced = (val, d = 350) => {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), d);
    return () => clearTimeout(t);
  }, [val, d]);
  return v;
};
const authHeaders = (t) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  ...(t ? { Authorization: `Bearer ${t}` } : {}),
});

async function safeJSON(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
const isAborted = (err) => err?.name === 'AbortError' || String(err || '').toLowerCase().includes('abort');

const qs = (obj = {}) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

// sessionStorage cache helpers
const cacheGet = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (!t || Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch {
    return null;
  }
};
const cacheSet = (key, v) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* ignore quota */
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// API
const api = {
  async get(path, token, signal) {
    return fetch(`${BASE_URL}${path}`, { headers: authHeaders(token), signal, keepalive: true });
  },
  async getJSON(path, token, signal) {
    const res = await api.get(path, token, signal);
    const js = await safeJSON(res);
    return { ok: res.ok, status: res.status, js };
  },
  async del(path, token, signal) {
    return fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: authHeaders(token),
      signal,
      keepalive: true,
    });
  },

  async getSchoolYears(token, signal) {
    const normalize = (js) =>
      Array.isArray(js?.schoolYears)
        ? js.schoolYears.map((sy) => ({
            school_year_id: sy.school_year_id,
            school_year: `${sy.start_year}-${sy.end_year}`,
            is_active: sy.is_active === 1 || sy.is_active === true || String(sy.is_active) === '1',
          }))
        : [];
    const { ok, js, status } = await api.getJSON('/school-year/all-school-years', token, signal);
    if (!ok) {
      if (status === 401) throw new Error('unauthorized');
      return [];
    }
    return normalize(js);
  },

  async getCurriculums(token, signal) {
    const paths = [
      '/curriculum/view-all-curriculums?limit=10',
      '/curriculum/view-all-curriculums',
      '/curriculum/view-all',
      '/curriculums',
      '/curriculum',
    ];
    const normalize = (js) =>
      Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : [];
    const tasks = paths.map(async (p) => {
      const { ok, js } = await api.getJSON(p, token, signal);
      if (!ok) throw new Error('not ok');
      return normalize(js);
    });
    try {
      return await Promise.any(tasks);
    } catch {
      return [];
    }
  },

  async getActiveCurriculumId(token, signal) {
    try {
      const { ok, js } = await api.getJSON('/curriculum/active-curriculums', token, signal);
      if (ok && js?.data?.curriculum_id) return String(js.data.curriculum_id);
    } catch {
      /* ignore */
    }
    return null;
  },

  async getSections(schoolYearId, token, signal) {
    const qsPart =
      schoolYearId && schoolYearId !== 'all'
        ? [
            `/sections?school_year_id=${encodeURIComponent(schoolYearId)}&limit=500`,
            `/sections?school_year_id=${encodeURIComponent(schoolYearId)}`,
          ]
        : [];
    const paths = [...qsPart, '/sections?limit=500', '/sections'];
    const normalize = (js) =>
      Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : [];
    const tasks = paths.map(async (p) => {
      const { ok, js } = await api.getJSON(p, token, signal);
      if (!ok) throw new Error('not ok');
      return normalize(js);
    });
    try {
      return await Promise.any(tasks);
    } catch {
      return [];
    }
  },
};

// ───────────────────────────────────────────────────────────────────────────────
// Client fallback filtering (if server ignores filters)
function applyClientFiltersSortPaginate({
  data = [],
  q,
  studentId,
  sectionId,
  schoolYearId,
  curriculumId,
  status,
  sort,
  page,
  limit,
}) {
  // 1) filter
  const qq = (q || '').trim().toLowerCase();
  let out = data.filter((r) => {
    if (studentId && studentId !== 'all' && String(r.student_id ?? r.studentId) !== String(studentId)) return false;
    if (sectionId && sectionId !== 'all' && String(r.section_id ?? r.sectionId) !== String(sectionId)) return false;
    if (schoolYearId && schoolYearId !== 'all' && String(r.school_year_id ?? r.schoolYearId) !== String(schoolYearId)) return false;
    if (curriculumId && curriculumId !== 'all' && String(r.curriculum_id ?? r.curriculumId) !== String(curriculumId)) return false;
    if (status && status !== 'all' && String(r.status || '').toLowerCase() !== String(status).toLowerCase()) return false;

    if (!qq) return true;
    const hay = [
      r.student_name,
      r.section_name,
      r.school_year,
      r.curriculum_name,
      r.status,
      r.lrn,
      ...(Array.isArray(r.enrolled_subjects) ? r.enrolled_subjects : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(qq);
  });

  // 2) sort
  const [sortKey = 'date', sortDir = 'desc'] = (sort || 'date:desc').split(':');
  const fieldMap = {
    date: 'enrollment_date',
    student: 'student_name',
    section: 'section_name',
    sy: 'school_year',
    curriculum: 'curriculum_name',
    status: 'status',
  };
  const f = fieldMap[sortKey] || 'enrollment_date';
  out.sort((a, b) => {
    const av = (a?.[f] ?? '').toString();
    const bv = (b?.[f] ?? '').toString();
    if (f === 'enrollment_date') {
      const at = a?.[f] ? new Date(a[f]).getTime() : 0;
      const bt = b?.[f] ? new Date(b[f]).getTime() : 0;
      return sortDir === 'asc' ? at - bt : bt - at;
    }
    if (av === bv) return 0;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av > bv ? -1 : 1);
  });

  // 3) paginate
  const total = out.length;
  const perPage = Math.max(1, Number(limit || 10));
  const cur = Math.max(1, Number(page || 1));
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (cur - 1) * perPage;
  const pageRows = out.slice(start, start + perPage);

  return {
    data: pageRows,
    pagination: { total, totalItems: total, page: cur, limit: perPage, totalPages },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Robust enrollments fetch: tries param variants → client fallback if needed
async function getPagedEnrollments(params, token, signal) {
  const {
    q,
    studentId,
    sectionId,
    schoolYearId,
    curriculumId,
    status,
    page,
    limit,
    sort,
  } = params;

  // map UI sort → API field
  const [sortKey, sortDir = 'desc'] = (sort || DEFAULT_SORT).split(':');
  const sortMap = {
    date: 'enrollment_date',
    student: 'student_name',
    section: 'section_name',
    sy: 'school_year',
    curriculum: 'curriculum_name',
    status: 'status',
  };
  const field = sortMap[sortKey] || 'enrollment_date';
  const dir = sortDir === 'asc' ? 'asc' : 'desc';

  const base = '/enrollments';
  const variants = [
    // 1) preferred snake_case (matches your new endpoint docs best)
    {
      q,
      page,
      limit,
      student_id: studentId !== 'all' ? studentId : undefined,
      section_id: sectionId !== 'all' ? sectionId : undefined,
      school_year_id: schoolYearId !== 'all' ? schoolYearId : undefined,
      curriculum_id: curriculumId !== 'all' ? curriculumId : undefined,
      status: status !== 'all' ? status : undefined,
      sort: `${field}:${dir}`,
    },
    // 2) earlier style (short keys)
    {
      search: q,
      page,
      limit,
      student: studentId !== 'all' ? studentId : undefined,
      section: sectionId !== 'all' ? sectionId : undefined,
      sy: schoolYearId !== 'all' ? schoolYearId : undefined,
      curriculum: curriculumId !== 'all' ? curriculumId : undefined,
      status: status !== 'all' ? status : undefined,
      sortBy: field,
      sortOrder: dir,
    },
    // 3) camelCase variant
    {
      q,
      page,
      limit,
      studentId: studentId !== 'all' ? studentId : undefined,
      sectionId: sectionId !== 'all' ? sectionId : undefined,
      schoolYearId: schoolYearId !== 'all' ? schoolYearId : undefined,
      curriculumId: curriculumId !== 'all' ? curriculumId : undefined,
      status: status !== 'all' ? status : undefined,
      orderBy: field,
      order: dir,
    },
  ];

  for (const v of variants) {
    const url = `${base}?${qs(v)}`;
    try {
      const { ok, js, status: httpStatus } = await api.getJSON(url, token, signal);
      if (!ok) {
        if (httpStatus === 401) throw new Error('unauthorized');
        continue;
      }

      const data = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
      const p = js?.pagination || {};
      const total = Number(p.total ?? p.totalItems ?? data.length ?? 0);
      const perPage = Number(p.limit ?? limit ?? DEFAULT_PAGE_SIZE);
      const cur = Number(p.page ?? page ?? 1);
      const totalPages = Number(p.totalPages ?? Math.max(1, Math.ceil(total / perPage)));

      // If any filters were requested, but backend likely ignored them → client fallback
      const requestedAnyFilter =
        (q && q.trim()) ||
        (studentId && studentId !== 'all') ||
        (sectionId && sectionId !== 'all') ||
        (schoolYearId && schoolYearId !== 'all') ||
        (curriculumId && curriculumId !== 'all') ||
        (status && status !== 'all');

      const looksUnfiltered = requestedAnyFilter && data.length >= 0 && total >= data.length; // heuristic

      if (requestedAnyFilter && looksUnfiltered) {
        return applyClientFiltersSortPaginate({
          data,
          q,
          studentId,
          sectionId,
          schoolYearId,
          curriculumId,
          status,
          sort,
          page: cur,
          limit: perPage,
        });
      }

      // normal, trust server
      return {
        data,
        pagination: { total, totalItems: total, page: cur, limit: perPage, totalPages },
      };
    } catch (e) {
      if (isAborted(e)) {
        return { data: [], pagination: { page: 1, limit: limit || DEFAULT_PAGE_SIZE, totalPages: 1, totalItems: 0, total: 0 } };
      }
      // try next variant
    }
  }

  // last resort: fetch bare list then client-filter
  try {
    const { ok, js, status: httpStatus } = await api.getJSON(`${base}?${qs({ page, limit })}`, token, signal);
    if (!ok) {
      if (httpStatus === 401) throw new Error('unauthorized');
      throw new Error(`Fetch failed (${httpStatus || 'unknown'})`);
    }
    const data = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
    return applyClientFiltersSortPaginate({
      data,
      q,
      studentId,
      sectionId,
      schoolYearId,
      curriculumId,
      status,
      sort,
      page,
      limit,
    });
  } catch (e) {
    if (isAborted(e)) {
      return { data: [], pagination: { page: 1, limit: limit || DEFAULT_PAGE_SIZE, totalPages: 1, totalItems: 0, total: 0 } };
    }
    throw e;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Async student search (kept lightweight; cached results)
const StudentFilterSearch = ({ token, value, onPick, className = '' }) => {
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    const q = label.trim();
    if (!touched || q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const run = async () => {
      try {
        const cached = cacheRef.current.get(q);
        if (cached) {
          setItems(cached);
          setOpen(true);
          return;
        }
        setLoading(true);
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const res = await fetch(
          `${BASE_URL}/students/search?query=${encodeURIComponent(q)}&limit=10`,
          { headers: authHeaders(token), signal: abortRef.current.signal },
        );
        if (!res.ok) throw new Error('Search failed');
        const js = await safeJSON(res);
        const list = Array.isArray(js) ? js : Array.isArray(js?.data) ? js.data : [];
        cacheRef.current.set(q, list);
        setItems(list);
        setOpen(true);
      } catch (e) {
        if (!isAborted(e)) console.warn('Student search error:', e?.message || e);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [label, token, touched]);

  const pick = (it) => {
    const text = `${it.last_name}, ${it.first_name}${it.middle_name ? ' ' + it.middle_name : ''}`;
    onPick(String(it.student_id), text);
    setLabel(text);
    setOpen(false);
    setTouched(false);
  };
  const clear = () => {
    setLabel('');
    onPick('all', '');
    setItems([]);
    setOpen(false);
    setTouched(true);
  };

  return (
    <div className={`position-relative w-100 ${className}`}>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          style={{ height: 'calc(2.25rem + 2px)' }}
          placeholder="Search student by LRN or name…"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setTouched(true);
          }}
          onFocus={() => items.length && setOpen(true)}
          autoComplete="off"
        />
        {label && (
          <button className="btn btn-outline-secondary" type="button" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div
          className="dropdown-menu show w-100 mt-1 border shadow-sm"
          style={{ maxHeight: 280, overflowY: 'auto', zIndex: 1050 }}
        >
          {loading ? (
            <div className="dropdown-item text-muted small d-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm" /> Searching…
            </div>
          ) : items.length ? (
            items.map((it) => (
              <button
                key={it.student_id}
                type="button"
                className="dropdown-item d-flex flex-column"
                onClick={() => pick(it)}
              >
                <div className="d-flex w-100 justify-content-between">
                  <strong>{`${it.last_name}, ${it.first_name}${it.middle_name ? ' ' + it.middle_name : ''}`}</strong>
                  {it.lrn ? <span className="text-muted">[{it.lrn}]</span> : null}
                </div>
                <small className="text-muted">
                  {it.gender || '—'} • {it.date_of_birth ? new Date(it.date_of_birth).toLocaleDateString() : '—'}
                </small>
              </button>
            ))
          ) : (
            <div className="dropdown-item text-muted small">No matches</div>
          )}
        </div>
      )}
      <input type="hidden" value={value} readOnly />
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────
// Delete modal
const DeleteConfirmModal = ({ show, item, busy, onCancel, onConfirm }) =>
  !show ? null : (
    <>
      <div className="modal fade show" style={{ display: 'block' }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4">
            <div className="modal-header">
              <h5 className="modal-title">Delete enrollment</h5>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="mb-1">This action cannot be undone.</p>
              <p className="mb-0">
                Delete enrollment <strong>#{item?.enrollment_id}</strong>
                {item?.student_name ? (
                  <>
                    {' '}
                    for <em>{item.student_name}</em>
                  </>
                ) : null}
                ?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-light border" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-danger d-inline-flex align-items-center gap-2" onClick={onConfirm} disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm" role="status" />} <FaTrash /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );

// ───────────────────────────────────────────────────────────────────────────────
// Main component
const EnrollmentList = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initial = useMemo(
    () => ({
      q: readQP(location.search, 'q', ''),
      student: readQP(location.search, 'student', 'all'),
      section: readQP(location.search, 'section', 'all'),
      sy: readQP(location.search, 'sy', 'all'),
      curriculum: readQP(location.search, 'curriculum', 'all'),
      status: readQP(location.search, 'status', 'all'),
      page: Number(readQP(location.search, 'page', 1)) || 1,
      size: Number(readQP(location.search, 'size', DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
      sort: readQP(location.search, 'sort', DEFAULT_SORT),
      group: readQP(location.search, 'group', 'none'),
    }),
    [location.search],
  );

  // State
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const [q, setQ] = useState(initial.q);
  const [studentId, setStudentId] = useState(initial.student);
  const [schoolYearId, setSchoolYearId] = useState(initial.sy);
  const [sectionId, setSectionId] = useState(initial.section);
  const [curriculumId, setCurriculumId] = useState(initial.curriculum);
  const [status, setStatus] = useState(initial.status);

  const [page, setPage] = useState(Math.max(1, initial.page));
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(initial.size) ? initial.size : DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState(initial.sort);
  const [groupByKey, setGroupByKey] = useState(
    ['none', 'sy', 'section', 'curriculum', 'status', 'date'].includes(initial.group) ? initial.group : 'none',
  );

  const searchDebounced = useDebounced(q, 400);
  const deferredQ = useDeferredValue(searchDebounced); // render-friendly

  // Data
  const [rows, setRows] = useState([]);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 1, currentPage: 1 });

  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [activeCurriculumId, setActiveCurriculumId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'info',
    icon: icons.info,
  });
  const [reloadTick, setReloadTick] = useState(0);

  const showStatus = useCallback(
    (variant, title, message) =>
      setStatusModal({ show: true, title, message, variant, icon: icons[variant] }),
    [],
  );

  const handleUnauthorized = useCallback(() => {
    showStatus('danger', 'Unauthorized', 'Please login to continue.');
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 800);
  }, [navigate, showStatus]);

  // Initial bootstrap (parallel + cached)
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);

        // Try cache first
        const syCached = cacheGet('enroll.sy');
        const curCached = cacheGet('enroll.curricula');
        const activeCurCached = cacheGet('enroll.curricula.active');

        const [sy, currs, activeCurId] = await Promise.all([
          syCached ?? api.getSchoolYears(token, ctrl.signal),
          curCached ?? api.getCurriculums(token, ctrl.signal),
          activeCurCached ?? api.getActiveCurriculumId(token, ctrl.signal),
        ]);

        if (!mounted) return;

        if (!syCached) cacheSet('enroll.sy', sy);
        if (!curCached) cacheSet('enroll.curricula', currs);
        if (!activeCurCached) cacheSet('enroll.curricula.active', activeCurId);

        setSchoolYears(sy);
        setCurricula(currs);
        setActiveCurriculumId(activeCurId);

        // default active SY/curriculum if url says 'all'
        if ((initial.sy === 'all' || initial.sy == null) && sy.length) {
          const activeSY = sy.find((s) => s.is_active) || sy[sy.length - 1];
          if (activeSY?.school_year_id) setSchoolYearId(String(activeSY.school_year_id));
        }
        if ((initial.curriculum === 'all' || initial.curriculum == null) && activeCurId) {
          setCurriculumId(String(activeCurId));
        }
      } catch (e) {
        if (isAborted(e)) return;
        const msg = String(e?.message || '');
        msg.toLowerCase().includes('unauthorized') ? handleUnauthorized() : showStatus('danger', 'Load error', msg || 'Something went wrong.');
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reloadTick]);

  // Load sections for selected SY (cached per SY)
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        const key = `enroll.sections.${schoolYearId || 'all'}`;
        const cached = cacheGet(key);
        if (cached) {
          setSections(cached);
          return;
        }
        const list = await api.getSections(schoolYearId, token, ctrl.signal);
        if (!mounted) return;
        cacheSet(key, list);
        setSections(list);
      } catch (e) {
        if (isAborted(e)) return;
        if (String(e?.message || '').toLowerCase().includes('unauthorized')) handleUnauthorized();
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [schoolYearId, token, handleUnauthorized]);

  // Fetch enrollments (server paged + robust filtration)
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        const { data, pagination } = await getPagedEnrollments(
          {
            q: deferredQ,
            studentId,
            sectionId,
            schoolYearId,
            curriculumId,
            status,
            page,
            limit: pageSize,
            sort,
          },
          token,
          ctrl.signal,
        );
        if (!mounted) return;

        startTransition(() => {
          setRows(Array.isArray(data) ? data : []);
          setPageMeta({
            total: Number((pagination.totalItems ?? pagination.total) || 0),
            totalPages: Number(pagination.totalPages || 1),
            currentPage: Number(pagination.page || 1),
          });
        });
      } catch (e) {
        if (isAborted(e)) return;
        const msg = String(e?.message || '');
        msg.toLowerCase().includes('unauthorized')
          ? handleUnauthorized()
          : showStatus('danger', 'Load error', msg || 'Something went wrong.');
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [
    deferredQ,
    studentId,
    sectionId,
    schoolYearId,
    curriculumId,
    status,
    page,
    pageSize,
    sort,
    token,
    handleUnauthorized,
    showStatus,
  ]);

  // URL sync
  useEffect(() => {
    writeQP(navigate, location, {
      q: deferredQ || undefined,
      student: studentId !== 'all' ? studentId : undefined,
      section: sectionId !== 'all' ? sectionId : undefined,
      sy: schoolYearId !== 'all' ? schoolYearId : undefined,
      curriculum: curriculumId !== 'all' ? curriculumId : undefined,
      status: status !== 'all' ? status : undefined,
      page,
      size: pageSize,
      sort,
      group: groupByKey !== 'none' ? groupByKey : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQ, studentId, sectionId, schoolYearId, curriculumId, status, page, pageSize, sort, groupByKey]);

  // Grouping (current page only)
  const grouped = useMemo(() => {
    if (groupByKey === 'none') return null;
    const keyFns = {
      sy: (r) => r.school_year || '—',
      section: (r) => r.section_name || '—',
      curriculum: (r) => r.curriculum_name || '—',
      status: (r) => r.status || '—',
      date: (r) => (r.enrollment_date ? new Date(r.enrollment_date).toLocaleDateString() : '—'),
    };
    const fn = keyFns[groupByKey] || (() => 'All');
    const m = new Map();
    rows.forEach((r) => {
      const k = fn(r);
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    });
    return m;
  }, [rows, groupByKey]);

  // Reset page on filter/sort changes (but not when only page changes)
  useEffect(() => {
    setPage(1);
  }, [deferredQ, studentId, sectionId, schoolYearId, curriculumId, status, pageSize, sort, groupByKey]);

  // UI helpers
  const onClear = () => setQ('');
  const onRefetch = () => setReloadTick((t) => t + 1);

  const SortIcon = ({ col }) => {
    const [k, dir] = (sort || DEFAULT_SORT).split(':');
    if (k !== col) return <FaSort className="opacity-50" />;
    return dir === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };
  const ThSortable = ({ col, children, width }) => (
    <th style={width ? { width } : undefined}>
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
        onClick={() => {
          const [k, dir] = (sort || DEFAULT_SORT).split(':');
          setSort(k === col ? `${col}:${dir === 'asc' ? 'desc' : 'asc'}` : `${col}:asc`);
        }}
        aria-label={`Sort by ${children}`}
      >
        <span className="fw-semibold text-body">{children}</span>
        <SortIcon col={col} />
      </button>
    </th>
  );

  // Stable row action handlers (rows pass only the id up)
  const handleEdit = useCallback((id) => {
    navigate(`/enrollments/edit/${id}`);
  }, [navigate]);

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delItem, setDelItem] = useState(null);

  const handleAskDelete = useCallback((row) => {
    setDelItem(row);
    setDelOpen(true);
  }, []);

  const closeDelete = useCallback(() => {
    setDelOpen(false);
    setDelItem(null);
    setDelBusy(false);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!delItem) return;
    try {
      setDelBusy(true);
      const path = `/enrollments/delete/${delItem.enrollment_id}`;

      // Prefer documented DELETE
      let res = await api.del(path, token);
      let js = await safeJSON(res);
      const deleteOk = res.ok && (res.status === 204 || js?.success !== false);

      // Fallback GET delete if needed
      if (!deleteOk) {
        res = await api.get(path, token);
        js = await safeJSON(res);
      }

      if (!res.ok || js?.success === false) {
        if (res.status === 401) return handleUnauthorized();
        const msg = js?.message || `Delete failed (${res.status})`;
        throw new Error(msg);
      }

      setDelBusy(false);
      setDelOpen(false);
      // Trigger refetch but keep the same filters/page
      setPage((p) => p);
      showStatus('success', 'Deleted', js?.message || 'Enrollment deleted successfully.');
    } catch (e) {
      setDelBusy(false);
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
        handleUnauthorized();
      } else {
        showStatus('danger', 'Delete error', msg || 'Something went wrong.');
      }
    }
  }, [delItem, token, handleUnauthorized, showStatus]);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Enrollments</h3>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={onRefetch}
            title="Reload"
          >
            <FaRedoAlt /> Refresh
          </button>
          <button
            className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={() => navigate('/enrollments/create')}
          >
            <FaPlus /> Add Enrollment
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-grid gap-2 gap-lg-3" style={{ gridTemplateColumns: '1fr' }}>
          <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
            <div className="input-group">
              <span className="input-group-text">
                <FaSearch />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search student, section, school year, curriculum, status…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onClear()}
                autoComplete="off"
              />
              {q && (
                <button className="btn btn-outline-secondary" onClick={onClear}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex-grow-1">
            <label className="form-label small text-muted mb-1">Group by (current page)</label>
            <select className="form-select" value={groupByKey} onChange={(e) => setGroupByKey(e.target.value)}>
              <option value="none">None</option>
              <option value="sy">School Year</option>
              <option value="section">Section</option>
              <option value="curriculum">Curriculum</option>
              <option value="status">Status</option>
              <option value="date">Date</option>
            </select>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="flex-grow-1 d-flex flex-column">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaUserGraduate /> Student
              </label>
              <StudentFilterSearch
                token={token}
                value={studentId}
                onPick={(id) => setStudentId(id || 'all')}
              />
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaCalendarAlt /> School Year
              </label>
              <select
                className="form-select"
                value={schoolYearId}
                onChange={(e) => {
                  setSchoolYearId(e.target.value);
                  setSectionId('all');
                }}
              >
                <option value="all">All years</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>
                    {sy.school_year}
                    {sy.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaBookOpen /> Curriculum
              </label>
              <select
                className="form-select"
                value={curriculumId}
                onChange={(e) => setCurriculumId(e.target.value)}
              >
                <option value="all">All curriculums</option>
                {curricula.map((c) => {
                  const id = String(c.curriculum_id ?? c.id ?? c.value);
                  const name = c.curriculum_name ?? c.name ?? c.label ?? id;
                  return (
                    <option key={id} value={id}>
                      {name}
                      {String(activeCurriculumId) === id ? ' (Active)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                Section
              </label>
              <select
                className="form-select"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="all">All sections</option>
                {sections.map((s) => {
                  const id = String(s.section_id ?? s.id);
                  const name = s.section_name ?? s.name ?? id;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaTag /> Status
              </label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All status</option>
                {['Enrolled', 'Pending', 'Withdrawn', 'Completed'].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading enrollments…</div>
            </div>
          ) : pageMeta.total === 0 ? (
            <div className="p-5 text-center">
              <h5 className="fw-semibold mt-2 mb-1">No enrollments found</h5>
              <p className="text-muted mb-3">Try adjusting filters or create a new enrollment.</p>
              <button
                className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
                onClick={() => navigate('/enrollments/create')}
              >
                <FaPlus /> Create Enrollment
              </button>
            </div>
          ) : (
            <>
              <div
                className="table-responsive"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
              >
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <ThSortable col="date" width={140}>Enrolled</ThSortable>
                      <ThSortable col="student">Student</ThSortable>
                      <ThSortable col="section" width={160}>Section</ThSortable>
                      <ThSortable col="sy" width={160}>School Year</ThSortable>
                      <ThSortable col="curriculum">Curriculum</ThSortable>
                      <ThSortable col="status" width={140}>Status</ThSortable>
                      <th style={{ width: 170 }}>Action</th>
                    </tr>
                  </thead>

                  {grouped ? (
                    [...grouped.keys()].map((label) => (
                      <tbody key={label}>
                        <tr className="table-group-divider table-primary-subtle">
                          <td colSpan={9} className="fw-semibold">
                            {label}
                          </td>
                        </tr>
                        {grouped.get(label).map((r) => (
                          <EnrollmentRow
                            key={r.enrollment_id}
                            id={r.enrollment_id}
                            enrolledAt={r.enrollment_date}
                            studentName={r.student_name}
                            sectionName={r.section_name}
                            schoolYear={r.school_year}
                            curriculumName={r.curriculum_name}
                            status={r.status}
                            onEdit={handleEdit}
                            onAskDelete={handleAskDelete}
                            rowObj={r}
                          />
                        ))}
                      </tbody>
                    ))
                  ) : (
                    <tbody>
                      {rows.map((r) => (
                        <EnrollmentRow
                          key={r.enrollment_id}
                          id={r.enrollment_id}
                          enrolledAt={r.enrollment_date}
                          studentName={r.student_name}
                          sectionName={r.section_name}
                          schoolYear={r.school_year}
                          curriculumName={r.curriculum_name}
                          status={r.status}
                          onEdit={handleEdit}
                          onAskDelete={handleAskDelete}
                          rowObj={r}
                        />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>

              {/* Footer / Pagination */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing{' '}
                  <strong>
                    {(pageMeta.currentPage - 1) * pageSize + 1}–{Math.min(pageMeta.currentPage * pageSize, pageMeta.total)}
                  </strong>{' '}
                  of <strong>{pageMeta.total}</strong> enrollments
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={pageMeta.currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <FaChevronLeft /> Prev
                  </button>
                  <span className="small text-muted">Page</span>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: 80 }}
                    min={1}
                    max={pageMeta.totalPages}
                    value={pageMeta.currentPage}
                    onChange={(e) => {
                      const v = Number(e.target.value || 1);
                      setPage(Math.min(Math.max(1, v), pageMeta.totalPages));
                    }}
                  />
                  <span className="small text-muted">of {pageMeta.totalPages}</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 120 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s} / page
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={pageMeta.currentPage >= pageMeta.totalPages}
                    onClick={() => setPage((p) => Math.min(pageMeta.totalPages, p + 1))}
                  >
                    Next <FaChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        show={delOpen}
        item={delItem}
        busy={delBusy}
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

// Row: pass only primitives + stable callbacks → fewer re-renders
const EnrollmentRow = memo(function EnrollmentRow({
  id,
  enrolledAt,
  studentName,
  sectionName,
  schoolYear,
  curriculumName,
  status,
  onEdit,
  onAskDelete,
  rowObj, // for delete confirm text only
}) {
  return (
    <tr>
      <td className="text-muted">#{id}</td>
      <td>{fmtDate(enrolledAt)}</td>
      <td className="d-flex align-items-center gap-2">
        <FaUserGraduate className="opacity-50" />
        {studentName || '—'}
      </td>
      <td>{sectionName}</td>
      <td>{schoolYear}</td>
      <td>{curriculumName}</td>
      <td>{status || '—'}</td>
      <td className="d-flex gap-1">
        <button
          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
          onClick={() => onEdit(id)}
        >
          <FaEdit /> Update
        </button>
        <button
          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
          onClick={() => onAskDelete(rowObj)}
        >
          <FaTrash /> Delete
        </button>
      </td>
    </tr>
  );
});

export default EnrollmentList;
