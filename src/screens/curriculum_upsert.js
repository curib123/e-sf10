import 'bootstrap/dist/css/bootstrap.min.css';

// src/pages/UpsertCurriculum.jsx — ONLY create curriculum and assign subjects (no grade-level mapping)
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
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Safe URL joiner */
const joinUrl = (base, path) => `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Busy overlay (glass) */
const BusyOverlay = ({ show, label, onCancel }) => {
  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ backdropFilter: 'blur(2px)', background: 'rgba(0,0,0,.1)', zIndex: 2000 }}
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-white rounded-4 shadow p-3 d-flex align-items-center gap-3 border">
        <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <div className="fw-semibold small me-2">{label || 'Working…'}</div>
        {onCancel && (
          <button className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  );
};

/** Step header (2-step) */
const StepHeader = ({ step }) => {
  const steps = [
    { id: 1, title: 'Create Curriculum' },
    { id: 2, title: 'Assign Subjects' },
  ];
  const pct = Math.round((step / steps.length) * 100);

  return (
    <div className="px-3 px-lg-4 pt-3 pb-2 border-bottom bg-light-subtle">
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
                <div className={`fw-semibold small ${active ? 'text-dark' : 'text-muted'}`}>{s.title}</div>
                {i < steps.length - 1 && <div className="text-muted">›</div>}
              </div>
            );
          })}
        </div>
        <span className="badge text-bg-secondary-subtle border small">Nothing is saved until you finish Step 2</span>
      </div>
      <div className="progress mt-3" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${pct}%` }}>{pct}%</div>
      </div>
    </div>
  );
};

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // ——— Auth / headers ———
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );
  const [statusModal, setStatusModal] = useState({ show: false, title: '', message: '', variant: 'info' });
  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: 'Unauthorized', message: 'Please log in.', variant: 'danger' });
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
  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]); // [{subject_id, subject_code, subject_name}]

  // ——— Local-only wizard state (saved at final step) ———
  // Step 1
  const [curriculumName, setCurriculumName] = useState('');
  const [effectiveYearId, setEffectiveYearId] = useState(''); // API uses school_year_id
  // Step 2
  const [query, setQuery] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);

  // Abort controller for attaching
  const attachAbortRef = useRef(null);
  const cancelAttach = () => {
    try {
      attachAbortRef.current?.abort();
    } catch {}
    attachAbortRef.current = null;
    setLoading(false);
    setBusyLabel('');
    setStatusModal({ show: true, title: 'Cancelled', message: 'Attaching subjects was cancelled.', variant: 'warning' });
  };

  // ——— Derived ———
  const filteredSubjects = useMemo(() => {
    const t = (query || '').trim().toLowerCase();
    const base = t
      ? allSubjects.filter(
          (s) => (s.subject_code || '').toLowerCase().includes(t) || (s.subject_name || '').toLowerCase().includes(t)
        )
      : allSubjects;
    return base;
  }, [allSubjects, query]);

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageSlice = filteredSubjects.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const selectedCount = selectedSubjectIds.size;
  const selectedList = useMemo(() => Array.from(selectedSubjectIds).map(Number), [selectedSubjectIds]);

  // ——— Effects: fetch reference data ———
  // GET /esf10/school-year/all-school-years
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'school-year/all-school-years'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const j = await res.json();
        if (j?.success) setSchoolYears(j.schoolYears || j.data || []);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default Effective Year = ACTIVE (is_active === 1) unless already used by another curriculum
  useEffect(() => {
    if (!effectiveYearId && schoolYears?.length) {
      const active = schoolYears.find((sy) => Number(sy?.is_active) === 1);
      if (active) {
        const isUsed =
          usedSchoolYears.includes(active.school_year_id) &&
          (!isEdit || Number(effectiveYearId) !== Number(active.school_year_id));
        if (!isUsed) setEffectiveYearId(active.school_year_id);
      }
    }
  }, [schoolYears, effectiveYearId, usedSchoolYears, isEdit]);

  // List curriculums to mark used school years
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'curriculum/view-all-curriculums'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const j = await res.json();
        if (j?.success && Array.isArray(j.data)) {
          const used = j.data
            .filter((c) => !isEdit || c.curriculum_id !== Number(id))
            .map((c) => c.school_year_id);
          setUsedSchoolYears(used);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Subjects
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'subjects/view-all-subjects'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const j = await res.json();
        const subjects = j?.success ? j.data || [] : [];
        setAllSubjects(
          subjects.map((s) => ({
            subject_id: Number(s.subject_id),
            subject_code: s.subject_code,
            subject_name: s.subject_name,
          }))
        );
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill for edit (local only; save at final)
  useEffect(() => {
    if (!isEdit || !checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, `curriculum/view-curriculum/${id}`), { headers });
        if (res.status === 401) return handleUnauthorized();
        const j = await res.json();
        if (j?.success && j?.data) {
          setCurriculumName(j.data.curriculum_name || '');
          setEffectiveYearId(j.data.school_year_id || '');
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // ——— Step guards ———
  const canGoNextFrom1 = curriculumName.trim() && effectiveYearId;
  const canFinalize = canGoNextFrom1 && selectedCount > 0;

  // ——— Handlers ———
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

  // ——— Helpers: robust fetch with timeout that tolerates non-JSON responses ———
  const fetchWithTimeoutJson = async (url, options = {}, timeoutMs = 25000) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new DOMException('timeout', 'AbortError')), timeoutMs);
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
      clearTimeout(t);
    }
  };

  // ——— Attach subjects with batching to avoid timeouts on large sets ———
  const attachSubjectsBatched = async (curriculumId, ids) => {
    const BATCH_SIZE = 100; // tune if needed
    let total = 0;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const addUrl = joinUrl(BASE_URL, `curriculum/add-subjects/${curriculumId}`);

      setBusyLabel(`Attaching subjects… (${Math.min(i + BATCH_SIZE, ids.length)}/${ids.length})`);

      // per-batch abort controller to allow cancel
      const controller = new AbortController();
      attachAbortRef.current = controller;
      const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'AbortError')), 60000); // 60s per batch

      try {
        const res2 = await fetch(addUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ subject_ids: batch }),
          signal: controller.signal,
        });
        if (res2.status === 401) return handleUnauthorized();
        const raw = await res2.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        if (!data?.success) throw new Error(data?.message || 'Failed to attach subjects.');
        const sum = data?.data?.summary || {};
        total += Number(sum.total ?? batch.length);
        success += Number(sum.successful ?? batch.length);
        failed += Number(sum.failed ?? 0);
      } finally {
        clearTimeout(timer);
        attachAbortRef.current = null;
      }
    }

    return { total, success, failed };
  };

  // ——— Finalize (server save happens only here) ———
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
    const subject_ids = selectedList;

    try {
      // 1) Create or update curriculum
      setLoading(true);
      setBusyLabel(isEdit ? 'Updating curriculum…' : 'Creating curriculum…');

      const endpoint = isEdit
        ? joinUrl(BASE_URL, `curriculum/update-curriculum/${id}`)
        : joinUrl(BASE_URL, 'curriculum/create-curriculum');

      const payload = {
        curriculum_name: curriculumName.trim(),
        school_year_id: Number(effectiveYearId),
      };

      const { res, json: result } = await fetchWithTimeoutJson(
        endpoint,
        { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(payload) },
        25000
      );
      if (res.status === 401) return handleUnauthorized();
      if (!result?.success) throw new Error(result?.message || 'Failed to save curriculum.');

      const curriculumId = isEdit
        ? Number(id)
        : Number(result?.curriculumId ?? result?.data?.curriculum_id ?? result?.data?.id);
      if (!curriculumId) throw new Error('Missing curriculumId after save.');

      // 2) Attach subjects (batched) — OPTION 1 ONLY
      const { total, success, failed } = await attachSubjectsBatched(curriculumId, subject_ids);

      setStatusModal({
        show: true,
        title: 'Saved ✔',
        message: `Curriculum #${curriculumId} saved.\nProcessed ${total} subject(s): ${success} successful, ${failed} failed.`,
        variant: 'success',
      });

      setTimeout(() => navigate(-1), 900);
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setStatusModal({
        show: true,
        title: aborted ? 'Timed out' : 'Error',
        message: aborted ? 'Attaching subjects took too long and was aborted.' : err?.message || 'Final save failed.',
        variant: aborted ? 'warning' : 'danger',
      });
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  // ——— Render helpers ———
  const Step1 = () => {
    const active = schoolYears.find((sy) => Number(sy?.is_active) === 1);
    const canSuggest = !effectiveYearId && active;
    return (
      <div className="p-3 p-lg-4">
        <div className="row g-3">
          <div className="col-12 col-md-7">
            <label className="form-label small fw-semibold">Curriculum Name</label>
            <input
              className="form-control form-control-sm"
              value={curriculumName}
              onChange={(e) => setCurriculumName(e.target.value)}
              placeholder="e.g., K–12 Core 2026"
              maxLength={128}
              autoFocus
            />
            <div className="form-text">Give this curriculum a clear, unique name.</div>
          </div>
          <div className="col-12 col-md-5">
            <label className="form-label small fw-semibold">Effective Year</label>
            <select
              className="form-select form-select-sm"
              value={effectiveYearId}
              onChange={(e) => setEffectiveYearId(e.target.value)}
            >
              <option value="" disabled>Select…</option>
              {schoolYears.map((sy) => {
                const used =
                  usedSchoolYears.includes(sy.school_year_id) &&
                  (!isEdit || Number(effectiveYearId) !== Number(sy.school_year_id));
                const label =
                  sy.start_year && sy.end_year
                    ? `${sy.start_year} – ${sy.end_year}${used ? ' (Used)' : ''}`
                    : `SY #${sy.school_year_id}`;
                return (
                  <option key={sy.school_year_id} value={sy.school_year_id} disabled={used}>
                    {label}
                  </option>
                );
              })}
            </select>
            {canSuggest && <div className="form-text small">Active effective year detected. It’s selected unless unavailable.</div>}
            {!active && <div className="form-text small">No active effective year found — please choose one.</div>}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-4">
          <button className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Back
          </button>
          <button
            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
            onClick={() => setStep(2)}
            disabled={!canGoNextFrom1}
            title={!canGoNextFrom1 ? 'Fill in curriculum name and effective year' : 'Next'}
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>
    );
  };

  const Step2 = () => {
    const isPageAllSelected = pageSlice.length > 0 && pageSlice.every((r) => selectedSubjectIds.has(Number(r.subject_id)));
    return (
      <div className="p-3 p-lg-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div className="flex-grow-1">
            <label className="form-label small fw-semibold mb-1">Search Subjects</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text">Search</span>
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
            <div className="small text-muted mt-2 d-flex align-items-center gap-2">
              <span className="badge text-bg-light border">Total: {filteredSubjects.length}</span>
              <span className="badge text-bg-primary-subtle border">Selected: {selectedCount}</span>
            </div>
          </div>

          <div className="btn-group btn-group-sm ms-auto">
            <button
              className="btn btn-outline-secondary"
              onClick={() => toggleAllOnPage(!isPageAllSelected)}
              disabled={pageSlice.length === 0}
              title={isPageAllSelected ? 'Unselect all on this page' : 'Select all on this page'}
            >
              {isPageAllSelected ? 'Unselect Page' : 'Select Page'}
            </button>
          </div>
        </div>

        <div className="table-responsive border rounded-3">
          {filteredSubjects.length === 0 ? (
            <div className="text-center text-muted py-5">No subjects available.</div>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{ width: 44 }} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={pageSlice.length > 0 && pageSlice.every((r) => selectedSubjectIds.has(Number(r.subject_id)))}
                      onChange={(e) => toggleAllOnPage(e.target.checked)}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th style={{ width: 200 }}>Code</th>
                  <th>Name</th>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="d-flex align-items-center justify-content-between mt-2">
          <div className="small text-muted">Page {safePage} of {totalPages}</div>
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
              <FaChevronLeft /> Prev
            </button>
            <button className="btn btn-outline-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
              Next <FaChevronRight />
            </button>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-4">
          <button className="btn btn-light btn-sm border d-inline-flex align-items-center gap-2" onClick={() => setStep(1)}>
            <FaChevronLeft /> Back
          </button>
          <button
            className="btn btn-dark btn-sm d-inline-flex align-items-center gap-2"
            onClick={finalizeAndSave}
            disabled={!canFinalize || loading}
            title={!canFinalize ? 'Complete Steps 1 and 2 first' : 'Save to server'}
          >
            <FaCheck /> Finalize & Save
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="container-xxl my-3">
      <BusyOverlay
        show={loading && !!busyLabel}
        label={busyLabel}
        onCancel={busyLabel?.toLowerCase().includes('attaching') ? cancelAttach : undefined}
      />
      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div
          className="p-3 px-lg-4 border-bottom"
          style={{ background: 'linear-gradient(135deg, rgba(13,110,253,.08), rgba(25,135,84,.06))' }}
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
              <div className="fw-semibold">{isEdit ? 'Edit Curriculum' : 'Create Curriculum'}</div>
              <div className="text-muted">Save on Step 2</div>
            </div>
          </div>
        </div>

        <StepHeader step={step} />

        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
      </div>
    </div>
  );
};

export default UpsertCurriculum;
