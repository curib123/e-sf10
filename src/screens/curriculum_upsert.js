import 'bootstrap/dist/css/bootstrap.min.css';

// src/pages/UpsertCurriculum.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaPlusSquare,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Safe URL joiner */
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Small stat pill */
const StatPill = ({ children, variant = 'light', title }) => (
  <span className={`badge rounded-pill text-bg-${variant}`} title={title || undefined}>
    {children}
  </span>
);

/** Busy overlay */
const BusyOverlay = ({ show, label }) => {
  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,.15)', zIndex: 2000 }}
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-white rounded-4 shadow p-3 d-flex align-items-center gap-3">
        <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <div className="fw-semibold small">{label || 'Working…'}</div>
      </div>
    </div>
  );
};

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // ——— State ——————————————————————————————————————————————————————————
  const [formData, setFormData] = useState({ curriculum_name: '', school_year_id: '' });
  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [savedCurriculumId, setSavedCurriculumId] = useState(isEdit ? Number(id) : null);

  // Subjects (create mode)
  const [allSubjects, setAllSubjects] = useState([]); // [{subject_id, subject_code, subject_name}]
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // selection (create mode)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // UI/Modal
  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [statusModal, setStatusModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  // ——— Auth helpers ———————————————————————————————————————————————————
  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: 'Unauthorized', message: 'Please log in.', variant: 'danger' });
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 900);
  };
  const checkToken = () => {
    if (!token) { handleUnauthorized(); return false; }
    return true;
  };

  // ——— Data fetches ————————————————————————————————————————————————————
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'school-year/all-school-years'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success) setSchoolYears(data.schoolYears || []);
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load school years.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'curriculum/view-all-curriculums'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success && Array.isArray(data.data)) {
          const used = data.data
            .filter((c) => !isEdit || c.curriculum_id !== Number(id))
            .map((c) => c.school_year_id);
          setUsedSchoolYears(used);
        }
      } catch { /* no-op */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Default Effective Year = active school year (create mode only)
  useEffect(() => {
    if (isEdit) return;
    if (formData.school_year_id) return; // don't override user choice
    if (!schoolYears.length) return;

    // prefer the active one
    const active = schoolYears.find(
      (sy) => Number(sy?.is_active) === 1 || sy?.is_active === true
    );

    if (active) {
      // Optional: avoid setting if that year already has a curriculum (enforces one per year)
      const isUsed = usedSchoolYears.includes(active.school_year_id);
      if (!isUsed) {
        setFormData((p) => ({ ...p, school_year_id: active.school_year_id }));
      }
    }
  }, [isEdit, schoolYears, usedSchoolYears, formData.school_year_id]);

  useEffect(() => {
    if (!isEdit || !checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, `curriculum/view-curriculum/${id}`), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (!data?.success || !data?.data) throw new Error('Failed to fetch curriculum.');
        setFormData({
          curriculum_name: data.data.curriculum_name || '',
          school_year_id: data.data.school_year_id || '',
        });
        setSavedCurriculumId(Number(id));
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load curriculum.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  useEffect(() => {
    if (isEdit || !checkToken()) return;
    (async () => {
      try {
        // Pull all subjects so we can pick IDs to attach to the new curriculum
        const res = await fetch(joinUrl(BASE_URL, 'subjects/view-all-subjects'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const j = await res.json();
        const subjects = j?.success ? (j.data || []) : [];
        setAllSubjects(
          subjects.map(s => ({
            subject_id: Number(s.subject_id),
            subject_code: s.subject_code,
            subject_name: s.subject_name,
          }))
        );
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load subjects.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // ——— Helpers ————————————————————————————————————————————————————————
  const findCurriculumIdFallback = async (payload) => {
    try {
      const res = await fetch(joinUrl(BASE_URL, 'curriculum/view-all-curriculums'), { headers });
      if (res.status === 401) return handleUnauthorized();
      const j = await res.json();
      if (!j?.success || !Array.isArray(j.data)) return null;
      const matches = j.data.filter(
        (c) =>
          Number(c.school_year_id) === Number(payload.school_year_id) &&
          String(c.curriculum_name).trim().toLowerCase() === String(payload.curriculum_name).trim().toLowerCase()
      );
      if (matches.length === 0) return null;
      const best = matches.reduce((a, b) => ((a?.curriculum_id || 0) > (b?.curriculum_id || 0) ? a : b));
      return Number(best.curriculum_id) || null;
    } catch {
      return null;
    }
  };

  const resolveCurriculumIdFromResult = async (result, payload) => {
    const direct = result?.curriculumId ?? result?.data?.curriculum_id ?? result?.data?.id ?? null;
    let cid = direct != null ? Number(direct) : null;
    if (!cid || Number.isNaN(cid)) cid = await findCurriculumIdFallback(payload);
    return cid && !Number.isNaN(cid) ? cid : null;
  };

  const saveCurriculum = useCallback(async () => {
    if (!checkToken()) throw new Error('Unauthorized.');
    if (!formData.curriculum_name.trim() || !formData.school_year_id) {
      throw new Error('Curriculum name and school year are required.');
    }
    const endpoint = isEdit
      ? joinUrl(BASE_URL, `curriculum/update-curriculum/${id}`)
      : joinUrl(BASE_URL, 'curriculum/create-curriculum');

    const payload = {
      curriculum_name: formData.curriculum_name.trim(),
      school_year_id: Number(formData.school_year_id),
    };

    setLoading(true);
    setBusyLabel(isEdit ? 'Updating curriculum…' : 'Creating curriculum…');
    try {
      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return handleUnauthorized();
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || 'Failed to save curriculum.');

      let cid = isEdit ? Number(id) : null;
      if (!cid || Number.isNaN(cid)) cid = await resolveCurriculumIdFromResult(result, payload);
      if (!cid || Number.isNaN(cid)) throw new Error('Missing curriculumId after save.');

      setSavedCurriculumId(cid);
      return cid;
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isEdit, id, headers]);

  const postAddSubjects = async (curriculumId, subjectIds) => {
    if (!checkToken()) throw new Error('Unauthorized.');
    setLoading(true);
    setBusyLabel('Adding subjects to curriculum…');
    try {
      const url = joinUrl(BASE_URL, `curriculum/add-subjects/${curriculumId}`);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject_ids: subjectIds }),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'Failed to add subjects.');

      const sum = data?.data?.summary || {};
      const failed = data?.data?.failed || [];
      const okCount = Number(sum.successful ?? 0);
      const failCount = Number(sum.failed ?? failed.length ?? 0);

      const failedLines = failed.map(
        f => `• Subject ID ${f.subject_id}: ${f.error || 'Failed'}`
      );

      return {
        ok: true,
        message:
          `Processed ${Number(sum.total ?? (okCount + failCount))} subject(s).\n` +
          `Successful: ${okCount}\nFailed: ${failCount}` +
          (failedLines.length ? `\n\nDetails:\n${failedLines.join('\n')}` : ''),
      };
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
  };

  // ——— Subjects list (filter/paginate) ————————————————————————————————
  const filtered = useMemo(() => {
    const t = (query || '').trim().toLowerCase();
    return t
      ? allSubjects.filter(
          (s) =>
            (s.subject_code || '').toLowerCase().includes(t) ||
            (s.subject_name || '').toLowerCase().includes(t)
        )
      : allSubjects;
  }, [allSubjects, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageSlice = filtered.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const isSelected = (sid) => selectedIds.has(Number(sid));
  const toggleOne = (sid, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(Number(sid));
      else next.delete(Number(sid));
      return next;
    });
  };
  const toggleSelectAllOnPage = (checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        for (const r of pageSlice) next.add(r.subject_id);
      } else {
        for (const r of pageSlice) next.delete(r.subject_id);
      }
      return next;
    });
  };

  // ——— Save & add subjects (single action) ————————————————————————————
  const saveAndAddSubjects = async () => {
    try {
      const subjectIds = Array.from(selectedIds).map(Number);

      if (subjectIds.length === 0) {
        // still allow saving the curriculum even if no subjects chosen
        const cidNoSubjects = await saveCurriculum();
        setStatusModal({
          show: true,
          title: 'Saved',
          message: `Curriculum saved (ID ${cidNoSubjects}). No subjects selected.`,
          variant: 'success',
        });
        return;
      }

      const cid = await saveCurriculum();
      const result = await postAddSubjects(cid, subjectIds);

      // Clear selection after success
      setSelectedIds(new Set());

      setStatusModal({
        show: true,
        title: 'Subjects Added',
        message: `Curriculum ID ${cid}:\n${result.message}`,
        variant: 'success',
      });
    } catch (err) {
      setStatusModal({
        show: true,
        title: 'Error',
        message: err?.message || 'Failed to save & add subjects.',
        variant: 'danger',
      });
    }
  };

  // ——— Derived UI —————————————————————————————————————————————————————
  const selectedSY = useMemo(
    () => schoolYears.find((s) => s.school_year_id === Number(formData.school_year_id)),
    [schoolYears, formData.school_year_id]
  );
  const selectedSYLabel = selectedSY
    ? (selectedSY.start_year && selectedSY.end_year ? `${selectedSY.start_year} - ${selectedSY.end_year}` : `SY #${selectedSY.school_year_id}`)
    : '';

  // ——— Render ————————————————————————————————————————————————————————————
  return (
    <div className="container-xxl my-3">
      <BusyOverlay show={loading && !!busyLabel} label={busyLabel} />
      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 border-bottom bg-light">
          <div className="d-flex flex-column">
            <h5 className="fw-bold mb-0">
              {isEdit ? 'Update Curriculum' : 'Create Curriculum & Add Subjects'}
            </h5>
            <small className="text-muted">
              One compact screen: name + school year, then pick subjects to attach to the curriculum.
            </small>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {!isEdit && <StatPill title="Selected subjects">Selected: {selectedIds.size}</StatPill>}
            <button
              type="button"
              className="btn btn-light btn-sm border d-flex align-items-center gap-2 px-3"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft /> Back
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 p-lg-4">
          {/* STEP 1: Curriculum (compact) */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-6">
              <label htmlFor="curriculum_name" className="form-label fw-semibold small mb-1">Curriculum Name</label>
              <input
                id="curriculum_name"
                name="curriculum_name"
                className="form-control form-control-sm"
                placeholder="e.g., K–12 Core 2026"
                value={formData.curriculum_name}
                onChange={(e) => setFormData((p) => ({ ...p, curriculum_name: e.target.value }))}
                autoComplete="off"
                required
                maxLength={128}
              />
            </div>
            <div className="col-12 col-md-4">
              <label htmlFor="school_year_id" className="form-label fw-semibold small mb-1">Effective Year</label>
              <select
                id="school_year_id"
                name="school_year_id"
                className="form-select form-select-sm"
                value={formData.school_year_id}
                onChange={(e) => setFormData((p) => ({ ...p, school_year_id: e.target.value }))}
                required
              >
                <option value="" disabled>Select…</option>
                {schoolYears.map((sy) => {
                  const used = usedSchoolYears.includes(sy.school_year_id) && (!isEdit || sy.school_year_id !== Number(formData.school_year_id));
                  const label = sy.start_year && sy.end_year ? `${sy.start_year} - ${sy.end_year}${used ? ' (Used)' : ''}` : 'Unknown Year';
                  return (
                    <option key={sy.school_year_id} value={sy.school_year_id} disabled={used}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div className="form-text small">One curriculum per school year.</div>
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-dark btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={async () => {
                    try {
                      await saveCurriculum();
                      navigate(-1);
                    } catch (err) {
                      setStatusModal({ show: true, title: 'Error', message: err.message || 'Failed to update curriculum.', variant: 'danger' });
                    }
                  }}
                  disabled={loading}
                >
                  <FaCheck /> Update
                </button>
              )}
            </div>
            <div className="col-12">
              <div className="alert alert-info py-2 small mb-0">
                <strong>Preview:</strong> {formData.curriculum_name || '—'} • {selectedSYLabel || '—'} {savedCurriculumId ? `• ID ${savedCurriculumId}` : ''}
              </div>
            </div>
          </div>

          {/* STEP 2: Subjects (create only) */}
          {!isEdit && (
            <>
              {/* Toolbar */}
              <div className="border rounded-3 mb-3 position-sticky top-0 bg-white p-2" style={{ zIndex: 1 }}>
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-lg-8">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Search</span>
                      <input
                        className="form-control"
                        placeholder="Find by subject code or name"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                        aria-label="Search subjects"
                      />
                      {query && (
                        <button className="btn btn-outline-secondary" onClick={() => { setQuery(''); setPage(1); }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-lg-4 d-flex gap-2 justify-content-lg-end">
                    <StatPill variant="secondary">Selected: {selectedIds.size}</StatPill>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
                      disabled={filtered.length === 0}
                      onClick={() => {
                        // Select all filtered (not just current page)
                        setSelectedIds(new Set(filtered.map(s => s.subject_id)));
                      }}
                      title="Select all filtered subjects"
                    >
                      <FaPlusSquare /> Select All
                    </button>
                  </div>
                </div>

                <div className="mt-2 small text-muted">
                  {savedCurriculumId ? <span>Curriculum ID: {savedCurriculumId}</span> : <span>Not saved yet</span>}
                  {' '}·{' '}
                  <span>{filtered.length} subject(s) found</span>
                </div>
              </div>

              {/* Subjects table */}
              <div className="table-responsive border rounded-3">
                {filtered.length === 0 ? (
                  <div className="text-center text-muted py-5">No subjects available.</div>
                ) : (
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                      <tr>
                        <th style={{ width: 44 }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={pageSlice.length > 0 && pageSlice.every((r) => selectedIds.has(Number(r.subject_id)))}
                            onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th style={{ width: 160 }}>Code</th>
                        <th>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice.map((s) => {
                        const selected = selectedIds.has(Number(s.subject_id));
                        return (
                          <tr
                            key={s.subject_id}
                            className={selected ? 'table-primary' : ''}
                            style={selected ? { borderLeft: '4px solid var(--bs-primary)' } : undefined}
                          >
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selected}
                                onChange={(e) => toggleOne(s.subject_id, e.target.checked)}
                                aria-label={`Select ${s.subject_code}`}
                              />
                            </td>
                            <td className="fw-medium">{s.subject_code}</td>
                            <td>{s.subject_name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="small text-muted">Page {safePage} of {totalPages}</div>
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

              {/* Primary action (create) */}
              <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-dark btn-sm d-flex align-items-center gap-2"
                  onClick={saveAndAddSubjects}
                  disabled={loading}
                  title="Save the curriculum then add all selected subjects"
                >
                  <FaCheck /> Save & Add Subjects
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpsertCurriculum;
