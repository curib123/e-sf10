import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * src/pages/UpsertCurriculum.jsx
 *
 * Supports:
 *  - CREATE flow (no :id param): 2-step draft → POST create + POST add-subjects (chunks of 5)
 *  - EDIT flow (with :id param): single-form → GET view-curriculum/:id to prefill → PUT update-curriculum/:id
 */
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
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

/** Debounce small hook */
const useDebouncedValue = (value, delay = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/** Busy overlay (glass) */
const BusyOverlay = ({ show, label, onCancel }) => {
  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ backdropFilter: 'blur(3px)', background: 'rgba(0,0,0,.12)', zIndex: 2000 }}
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-white rounded-4 shadow p-3 d-flex align-items-center gap-3 border">
        <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <div className="fw-semibold small me-2">{label || 'Working…'}</div>
        {onCancel && (
          <button className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

/** Step header (2-step) for CREATE flow */
const StepHeader = ({ step }) => {
  const steps = [
    { id: 1, title: 'Create Curriculum (Local Draft)' },
    { id: 2, title: 'Assign Subjects (Local Draft)' },
  ];
  const pct = Math.round((step / steps.length) * 100);

  return (
    <div
      className="px-3 px-lg-4 pt-3 pb-2 border-bottom"
      style={{
        background:
          'linear-gradient(120deg, rgba(13,110,253,.085), rgba(25,135,84,.07) 60%, rgba(111,66,193,.06))',
      }}
    >
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {steps.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="d-flex align-items-center gap-2">
                <div
                  className={`rounded-circle d-inline-flex align-items-center justify-content-center fw-bold border ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : done
                      ? 'bg-success text-white border-success'
                      : 'bg-body text-muted'
                  }`}
                  style={{ width: 36, height: 36 }}
                  aria-current={active ? 'step' : undefined}
                  title={s.title}
                >
                  {done ? <FaCheck /> : s.id}
                </div>
                <div className={`fw-semibold small ${active ? 'text-dark' : 'text-muted'}`}>
                  {s.title}
                </div>
                {i < steps.length - 1 && <div className="text-muted">›</div>}
              </div>
            );
          })}
        </div>
        <span className="badge text-primary">
          Nothing hits the server until you click “Finalize & Save”
        </span>
      </div>
      <div
        className="progress mt-3 rounded-pill"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
        style={{ height: 8 }}
      >
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Robust fetch that enforces a timeout and tolerates non-JSON responses */
const fetchWithTimeoutJson = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'AbortError')), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const raw = await res.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    return { res, json, raw };
  } finally {
    clearTimeout(timer);
  }
};

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // <-- Detect :id for EDIT mode
  const isEdit = !!id;

  // ——— Auth / headers ———
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'info',
  });

  const handleUnauthorized = () => {
    setStatusModal({
      show: true,
      title: 'Unauthorized',
      message: 'Your session expired. Please log in.',
      variant: 'danger',
    });
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 900);
  };
  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  // ——— UI state ———
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');

  // ——— Data (fetched) ———
  const [schoolYears, setSchoolYears] = useState([]); // optional; for effective year selection
  const [allSubjects, setAllSubjects] = useState([]); // CREATE flow only

  // ——— Local state for both CREATE and EDIT ———
  const [curriculumName, setCurriculumName] = useState('');
  const [effectiveYearId, setEffectiveYearId] = useState(''); // school_year_id

  // ——— Subject selection (CREATE mode only) ———
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);

  // Abort + cancel controls for subject attach (CREATE mode only)
  const attachAbortRef = useRef(null);
  const cancelledRef = useRef(false);

  const cancelAttach = () => {
    try {
      attachAbortRef.current?.abort();
    } catch {}
    attachAbortRef.current = null;
    cancelledRef.current = true;

    setLoading(false);
    setBusyLabel('');
    setStatusModal({
      show: true,
      title: 'Cancelled',
      message: 'Assigning subjects was cancelled.',
      variant: 'warning',
    });
  };

  // ——— Effects: fetch reference data ———
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const { res, json } = await fetchWithTimeoutJson(
          joinUrl(BASE_URL, 'school-year/all-school-years'),
          { headers },
          20000
        );
        if (res.status === 401) return handleUnauthorized();
        if (json?.success) setSchoolYears(json.schoolYears || json.data || []);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ——— EDIT MODE: fetch current curriculum by id to prefill textfields ———
  const [editLoaded, setEditLoaded] = useState(!isEdit); // true if not editing
  useEffect(() => {
    if (!isEdit || !checkToken()) return;

    (async () => {
      try {
        setBusyLabel('Loading curriculum…');
        setLoading(true);

        const { res, json } = await fetchWithTimeoutJson(
          joinUrl(BASE_URL, `curriculum/view-curriculum/${id}`),
          { headers }, // includes Authorization: Bearer <token>
          20000
        );

        if (res.status === 401) return handleUnauthorized();

        if (!json?.success || !json?.data) {
          throw new Error('Failed to load curriculum.');
        }

        const c = json.data;
        // Populate textfields
        setCurriculumName(c.curriculum_name ?? '');
        setEffectiveYearId(c.school_year_id ?? '');

        setEditLoaded(true);
      } catch (err) {
        setStatusModal({
          show: true,
          title: 'Error',
          message: err?.message || 'Unable to load curriculum.',
          variant: 'danger',
        });
      } finally {
        setLoading(false);
        setBusyLabel('');
      }
    })();
  }, [isEdit, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Fetch ALL pages from /subjects/view-all-subjects (CREATE only)
  useEffect(() => {
    if (!checkToken() || isEdit) return;

    let cancelled = false;

    const fetchAllSubjects = async () => {
      try {
        const PAGE_SIZE = 100;
        let pageNo = 1;
        let totalPages = 1;
        const collected = [];

        do {
          const url = new URL(joinUrl(BASE_URL, 'subjects/view-all-subjects'));
          url.searchParams.set('page', String(pageNo));
          url.searchParams.set('limit', String(PAGE_SIZE));

          const { res, json } = await fetchWithTimeoutJson(url.toString(), { headers }, 25000);
          if (res.status === 401) return handleUnauthorized();

          const items = json?.success ? json.data || [] : [];
          collected.push(...items);

          const p = json?.pagination || {};
          const currentPage = Number(p.page ?? pageNo);
          totalPages = Number(p.totalPages ?? 1);

          if (!p || (Array.isArray(items) && items.length < PAGE_SIZE && !p.totalPages)) {
            totalPages = currentPage;
          }

          pageNo += 1;
        } while (pageNo <= totalPages);

        if (cancelled) return;

        setAllSubjects(
          collected.map((s) => ({
            subject_id: Number(s.subject_id),
            subject_code: s.subject_code,
            subject_name: s.subject_name,
          }))
        );
      } catch {
        /* ignore; UI shows empty state */
      }
    };

    fetchAllSubjects();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // Default effective year to active if present (for both modes, if empty)
  useEffect(() => {
    if (!effectiveYearId && schoolYears?.length) {
      const active = schoolYears.find((sy) => Number(sy?.is_active) === 1);
      if (active) setEffectiveYearId(active.school_year_id);
    }
  }, [schoolYears, effectiveYearId]);

  // ——— Derived (CREATE mode only) ———
  const filteredSubjects = useMemo(() => {
    const t = (debouncedQuery || '').trim().toLowerCase();
    const base = t
      ? allSubjects.filter(
          (s) =>
            (s.subject_code || '').toLowerCase().includes(t) ||
            (s.subject_name || '').toLowerCase().includes(t)
        )
      : allSubjects;
    return base;
  }, [allSubjects, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageSlice = filteredSubjects.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const selectedCount = selectedSubjectIds.size;
  const selectedList = useMemo(() => Array.from(selectedSubjectIds).map(Number), [selectedSubjectIds]);

  // ——— Step guards ———
  const canGoNextFrom1 = curriculumName.trim() && effectiveYearId;
  const canFinalize = canGoNextFrom1 && selectedCount > 0 && !loading;

  // ——— Subject selection handlers (CREATE) ———
  const toggleSubject = (sid, checked) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      const nSid = Number(sid);
      if (checked) next.add(nSid);
      else next.delete(nSid);
      return next;
    });
  };

  const toggleAllOnPage = (checked) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (checked) for (const r of pageSlice) next.add(Number(r.subject_id));
      else for (const r of pageSlice) next.delete(Number(r.subject_id));
      return next;
    });
  };

  const clearAllSelected = () => setSelectedSubjectIds(new Set());

  // Tri-state header checkbox
  const headerCheckboxRef = useRef(null);
  const pageAllSelected =
    pageSlice.length > 0 && pageSlice.every((r) => selectedSubjectIds.has(Number(r.subject_id)));
  const pageSomeSelected =
    pageSlice.some((r) => selectedSubjectIds.has(Number(r.subject_id))) && !pageAllSelected;
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = pageSomeSelected;
    }
  }, [pageSomeSelected]);

  // ——— Server calls (CREATE) ———
  const createCurriculum = async () => {
    const { res, json } = await fetchWithTimeoutJson(
      joinUrl(BASE_URL, 'curriculum/create-curriculum'),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          curriculum_name: curriculumName.trim(),
          school_year_id: Number(effectiveYearId),
        }),
      },
      25000
    );
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!json?.success) {
      throw new Error(json?.message || 'Failed to create curriculum.');
    }
    const curriculumId = Number(
      json?.curriculumId ?? json?.data?.curriculum_id ?? json?.data?.id
    );
    if (!curriculumId) throw new Error('Missing curriculumId after save.');
    return curriculumId;
  };

  const attachSubjectsOnce = async (curriculumId, subject_ids, timeoutMs = 30000) => {
    const controller = new AbortController();
    attachAbortRef.current = controller;

    const { res, json } = await fetchWithTimeoutJson(
      joinUrl(BASE_URL, `curriculum/add-subjects/${curriculumId}`),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject_ids }),
        signal: controller.signal,
      },
      timeoutMs
    );

    attachAbortRef.current = null;

    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!json?.success) {
      const sum = json?.data?.summary;
      if (sum) {
        return {
          total: Number(sum.total ?? subject_ids.length),
          successful: Number(sum.successful ?? 0),
          failed: Number(sum.failed ?? 0),
        };
      }
      const err = new Error(json?.message || `Attach failed (HTTP ${res.status})`);
      err.code = res.status;
      throw err;
    }
    const summary = json?.data?.summary || {};
    return {
      total: Number(summary.total ?? subject_ids.length),
      successful: Number(summary.successful ?? subject_ids.length),
      failed: Number(summary.failed ?? 0),
    };
  };

  const attachSubjectsSmart = async (curriculumId, ids) => {
    const CHUNK = 5;
    let total = 0;
    let successful = 0;
    let failed = 0;

    cancelledRef.current = false;

    for (let i = 0; i < ids.length; i += CHUNK) {
      if (cancelledRef.current) {
        const err = new DOMException('User cancelled', 'AbortError');
        throw err;
      }

      const batch = ids.slice(i, i + CHUNK);

      setBusyLabel(
        `Assigning subjects to curriculum… (${Math.min(i + CHUNK, ids.length)}/${ids.length})`
      );

      // eslint-disable-next-line no-await-in-loop
      const part = await attachSubjectsOnce(curriculumId, batch, 30000);

      total += part.total || batch.length;
      successful += part.successful || 0;
      failed += part.failed || 0;
    }

    return { total, successful, failed };
  };

  // ——— Finalize (CREATE) ———
  const finalizeAndSave = async () => {
    if (!canFinalize) {
      setStatusModal({
        show: true,
        title: 'Incomplete',
        message: 'Please complete Steps 1 and 2 before saving.',
        variant: 'warning',
      });
      return;
    }
    if (!checkToken()) return;

    try {
      cancelledRef.current = false;
      setLoading(true);
      setBusyLabel('Creating curriculum…');

      const curriculumId = await createCurriculum();

      setBusyLabel('Assigning subjects to curriculum…');
      const { total, successful, failed } = await attachSubjectsSmart(curriculumId, selectedList);

      setStatusModal({
        show: true,
        title: failed === 0 ? 'Saved ✔' : successful > 0 ? 'Partially Saved' : 'No Subjects Attached',
        message: `Curriculum #${curriculumId} saved.\nProcessed ${total} subject(s): ${successful} successful, ${failed} failed.`,
        variant: failed === 0 ? 'success' : successful > 0 ? 'warning' : 'danger',
      });

      setTimeout(() => navigate(-1), 900);
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setStatusModal({
        show: true,
        title: aborted ? 'Timed out / Aborted' : 'Error',
        message:
          aborted
            ? 'The request took too long or was cancelled.'
            : err?.message || 'Final save failed.',
        variant: aborted ? 'warning' : 'danger',
      });
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  // ——— EDIT: PUT update by id ———
  const canUpdate = curriculumName.trim() && effectiveYearId && !loading;

  const updateCurriculum = async () => {
    if (!checkToken()) return;
    if (!canUpdate) {
      setStatusModal({
        show: true,
        title: 'Incomplete',
        message: 'Please provide curriculum name and school year.',
        variant: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      setBusyLabel('Updating curriculum…');

      const { res, json } = await fetchWithTimeoutJson(
        joinUrl(BASE_URL, `curriculum/update-curriculum/${id}`),
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            curriculum_name: curriculumName.trim(),
            school_year_id: Number(effectiveYearId),
          }),
        },
        25000
      );

      if (res.status === 401) return handleUnauthorized();

      if (!json?.success) {
        throw new Error(json?.message || `Update failed (HTTP ${res.status})`);
      }

      setStatusModal({
        show: true,
        title: 'Updated ✔',
        message: `Curriculum #${json.curriculumId ?? id} updated successfully.`,
        variant: 'success',
      });

      setTimeout(() => navigate(-1), 900);
    } catch (err) {
      setStatusModal({
        show: true,
        title: 'Error',
        message: err?.message || 'Update failed.',
        variant: 'danger',
      });
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  // ——— Views ———
  const Step1 = () => (
    <div className="p-4">
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Basic Details (Local Draft)</h5>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Curriculum Name</label>
                <input
                  className="form-control form-control-sm"
                  value={curriculumName}
                  onChange={(e) => setCurriculumName(e.target.value)}
                  placeholder="e.g., K–12 Core 2026"
                  maxLength={128}
                  autoFocus
                />
                <div className="form-text">This is stored locally until you finalize.</div>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold">Effective Year</label>
                <select
                  className="form-select form-select-sm"
                  value={effectiveYearId}
                  onChange={(e) => setEffectiveYearId(e.target.value)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {schoolYears.map((sy) => {
                    const label =
                      sy.start_year && sy.end_year
                        ? `${sy.start_year} – ${sy.end_year}`
                        : `SY #${sy.school_year_id}`;
                    return (
                      <option key={sy.school_year_id} value={sy.school_year_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <div className="form-text">
                  Also stored locally. You can change it before saving.
                </div>
              </div>
            </div>

            <div className="card-footer bg-transparent border-0 d-flex justify-content-between">
              <button
                className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </button>
              <button
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setStep(2);
                }}
                disabled={!canGoNextFrom1 || loading}
                title={!canGoNextFrom1 ? 'Fill in curriculum name and effective year' : 'Next'}
              >
                Next <FaChevronRight />
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-2">Draft Mode</h6>
              <ul className="small text-dark mb-0">
                <li>You can freely edit details and subject picks.</li>
                <li>On save, the app first creates the curriculum, then assigns subjects using its ID.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const Step2 = () => (
    <div className="p-4">
      <div className="row g-4">
        {/* LEFT: Subject catalog */}
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <div className="flex-grow-1">
                  <label className="form-label small fw-semibold mb-1">Search Subjects</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">
                      <FaSearch />
                    </span>
                    <input
                      className="form-control"
                      placeholder="Find by subject code or name"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                    {query && (
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setQuery('');
                          setPage(1);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="small text-muted mt-2 d-flex align-items-center flex-wrap gap-2">
                    <span className="badge text-bg-light border">Total: {filteredSubjects.length}</span>
                    <span className="badge text-bg-primary-subtle border">
                      Selected: {selectedCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="table-responsive border rounded-3">
                {filteredSubjects.length === 0 ? (
                  <div className="text-center text-muted py-5">No subjects found.</div>
                ) : (
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                      <tr>
                        <th style={{ width: 44 }} className="text-center">
                          <input
                            ref={headerCheckboxRef}
                            type="checkbox"
                            className="form-check-input"
                            checked={pageAllSelected}
                            onChange={(e) => toggleAllOnPage(e.target.checked)}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th style={{ width: 220 }}>Code</th>
                        <th>Name</th>
                        <th style={{ width: 90 }} className="text-center">
                          Add
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice.map((s) => {
                        const sid = Number(s.subject_id);
                        const selected = selectedSubjectIds.has(sid);
                        return (
                          <tr key={sid} className={selected ? 'table-primary' : ''}>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selected}
                                onChange={(e) => toggleSubject(sid, e.target.checked)}
                                aria-label={`Select ${s.subject_code}`}
                              />
                            </td>
                            <td className="fw-semibold">{s.subject_code}</td>
                            <td className="text-muted">{s.subject_name}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className={`btn btn-xs btn-${selected ? 'secondary' : 'primary'} btn-sm`}
                                onClick={() => toggleSubject(sid, !selected)}
                                title={selected ? 'Remove' : 'Add'}
                              >
                                {selected ? <FaTimes /> : <FaPlus />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="small text-muted">
                  Page {safePage} of {totalPages}
                </div>
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <FaChevronLeft /> Prev
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    Next <FaChevronRight />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Selection summary (sticky on xl) */}
        <div className="col-12 col-xl-4">
          <div className="position-xl-sticky" style={{ top: 16 }}>
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0">Selected Subjects (Local Draft)</h6>
                  <span className="badge text-bg-primary-subtle border">{selectedCount}</span>
                </div>

                {selectedCount === 0 ? (
                  <div className="text-muted small">No subjects selected yet.</div>
                ) : (
                  <div className="d-flex flex-wrap gap-2" style={{ maxHeight: 280, overflow: 'auto' }}>
                    {selectedList
                      .map((sid) => allSubjects.find((s) => Number(s.subject_id) === Number(sid)))
                      .filter(Boolean)
                      .map((s) => (
                        <span
                          key={s.subject_id}
                          className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-2 px-3 py-2"
                          title={s.subject_name}
                        >
                          <span className="fw-semibold">{s.subject_code}</span>
                          <span className="text-muted small">{s.subject_name}</span>
                          <button
                            className="btn btn-sm btn-link p-0 ms-1 text-danger"
                            onClick={() => toggleSubject(s.subject_id, false)}
                            title="Remove"
                            aria-label={`Remove ${s.subject_code}`}
                          >
                            <FaTimes />
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                  <button
                    className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                    onClick={clearAllSelected}
                    disabled={selectedCount === 0 || loading}
                  >
                    <FaTrash /> Clear
                  </button>

                  <button
                    className="btn btn-dark btn-sm d-inline-flex align-items-center gap-2"
                    onClick={finalizeAndSave}
                    disabled={!canFinalize}
                    title={!canFinalize ? 'Complete Steps 1 and 2 first' : 'Save to server'}
                  >
                    <FaCheck /> Finalize & Save
                  </button>
                </div>

                <div className="form-text mt-2">
                  On save, we create the curriculum first, then assign the selected subjects using its ID.
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-center mt-3">
              <button
                className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                <FaChevronLeft /> Back to Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar (mobile-friendly) */}
      <div className="d-xl-none position-sticky bottom-0 mt-4">
        <div className="card border-0 shadow rounded-4">
          <div className="card-body d-flex justify-content-between align-items-center gap-2">
            <div className="small text-muted">
              Selected <span className="fw-bold">{selectedCount}</span>
            </div>
            <button
              className="btn btn-dark btn-sm d-inline-flex align-items-center gap-2"
              onClick={finalizeAndSave}
              disabled={!canFinalize}
            >
              <FaCheck /> Finalize & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ——— EDIT MODE VIEW (no endpoint guide) ———
  const EditView = () => (
    <div className="p-4">
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Edit Curriculum</h5>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Curriculum Name</label>
                <input
                  className="form-control form-control-sm"
                  value={curriculumName}
                  onChange={(e) => setCurriculumName(e.target.value)}
                  placeholder="e.g., Math Curriculum 2025"
                  maxLength={128}
                  autoFocus
                  disabled={!editLoaded}
                />
              </div>

              <div className="mb-2">
                <label className="form-label small fw-semibold">School Year</label>
                <select
                  className="form-select form-select-sm"
                  value={effectiveYearId}
                  onChange={(e) => setEffectiveYearId(e.target.value)}
                  disabled={!editLoaded}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {schoolYears.map((sy) => {
                    const label =
                      sy.start_year && sy.end_year
                        ? `${sy.start_year} – ${sy.end_year}`
                        : `SY #${sy.school_year_id}`;
                    return (
                      <option key={sy.school_year_id} value={sy.school_year_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="card-footer bg-transparent border-0 d-flex justify-content-between">
              <button
                className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Cancel
              </button>
              <button
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
                onClick={updateCurriculum}
                disabled={!editLoaded || !canUpdate}
                title={!canUpdate ? 'Fill in curriculum name and school year' : 'Save changes'}
              >
                <FaCheck /> Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Right column intentionally left minimal (no endpoint guide) */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-2">Note</h6>
              <ul className="small text-dark mb-0">
                <li>This screen updates the curriculum record (name &amp; school year) only.</li>
                <li>Subject assignments are not changed here.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ——— Render ———
  return (
    <div className="container-xxl my-3">
      <BusyOverlay
        show={loading && !!busyLabel}
        label={busyLabel}
        onCancel={/\bassign/i.test(busyLabel) ? cancelAttach : undefined}
      />
      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />

      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden"
        role="region"
        aria-label={isEdit ? 'Curriculum Editor' : 'Curriculum Builder'}
      >
        <div
          className="p-3 px-lg-4 border-bottom"
          style={{
            background: 'linear-gradient(135deg, rgba(13,110,253,.08), rgba(25,135,84,.06))',
          }}
        >
          <div className="d-flex align-items-center justify-content-between gap-2">
            <button
              className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2 px-3"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              <FaArrowLeft /> Back
            </button>
            <div className="text-end small">
              <div className="fw-semibold">
                {isEdit ? `Edit Curriculum #${id}` : 'Curriculum Builder'}
              </div>
              <div className="text-dark">
                {isEdit ? 'Update name & school year' : 'Everything is local until you finalize'}
              </div>
            </div>
          </div>
        </div>

        {isEdit ? (
          <EditView />
        ) : (
          <>
            <StepHeader step={step} />
            {step === 1 ? <Step1 /> : <Step2 />}
          </>
        )}
      </div>
    </div>
  );
};

export default UpsertCurriculum;
