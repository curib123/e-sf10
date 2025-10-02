import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaCheck,
  FaTimes,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const ACTIVE_CURRICULUM_ID = 1; // constant “active”

// Safe URL joiner (avoids double/missing slashes)
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

const AssignSubjectsForm = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // ---- State
  const [gradeLevels, setGradeLevels] = useState([]);         // [{ grade_level_id, grade_code, grade_name, grade_order }]
  const [activeSubjects, setActiveSubjects] = useState([]);   // subjects in ACTIVE curriculum [{subject_id, code, name}]
  const [gradeMap, setGradeMap] = useState(new Map());        // gid -> { grade, subjects[] } from view-all-sub-grade-levels

  const [gradeSubjects, setGradeSubjects] = useState([]);     // bottom table (assigned list for selected grade)
  const [assignedIds, setAssignedIds] = useState([]);         // subject_ids already assigned to selected grade

  const [formData, setFormData] = useState({ grade_level_id: 0, assignments: [] });

  const [query, setQuery] = useState('');
  const [selectAllPage, setSelectAllPage] = useState(false);

  const [bootLoading, setBootLoading] = useState(true);       // loading initial data
  const [loading, setLoading] = useState(false);              // preparing top picker for a chosen grade
  const [saving, setSaving] = useState(false);                // submitting single-create requests

  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  // pagination (top picker)
  const itemsPerPage = 10;
  const [page, setPage] = useState(1);

  // ---- Helpers
  /** Boot: load grade levels, active-curriculum subjects, and per-grade subjects map */
  useEffect(() => {
    (async () => {
      setBootLoading(true);
      try {
        const gradeLevelsUrl = joinUrl(BASE_URL, '/grade-levels');
        const activeSubjectsUrl = joinUrl(
          BASE_URL,
          `/curriculum/curriculum-subjects/active/${ACTIVE_CURRICULUM_ID}`
        );
        const byGradeUrl = joinUrl(BASE_URL, '/subjects/view-all-sub-grade-levels');

        const [glRes, subjRes, byGradeRes] = await Promise.all([
          fetch(gradeLevelsUrl, { headers }),
          fetch(activeSubjectsUrl, { headers }),
          fetch(byGradeUrl, { headers }),
        ]);

        const [glData, subjData, byGradeData] = await Promise.all([
          glRes.json(),
          subjRes.json(),
          byGradeRes.json(),
        ]);

        if (!glData?.success) throw new Error('Failed to load grade levels.');
        if (!subjData?.success) throw new Error('Failed to load active curriculum subjects.');
        if (!byGradeData?.success) throw new Error('Failed to load subjects by grade level.');

        // Grade levels (sort by grade_order asc)
        const gl = Array.isArray(glData.data) ? glData.data : [];
        gl.sort((a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0));
        setGradeLevels(
          gl.map((r) => ({
            grade_level_id: r.grade_level_id,
            grade_code: r.grade_code,
            grade_name: r.grade_name,
            grade_order: r.grade_order,
          }))
        );

        // Active curriculum subjects
        const subjRows = Array.isArray(subjData.data) ? subjData.data : [];
        setActiveSubjects(
          subjRows.map((s) => ({
            subject_id: s.subject_id,
            subject_code: s.subject_code,
            subject_name: s.subject_name,
          }))
        );

        // Build gradeMap from view-all-sub-grade-levels
        const rows = Array.isArray(byGradeData.data) ? byGradeData.data : [];
        const map = new Map();
        for (const r of rows) {
          map.set(r.grade_level_id, {
            grade: {
              grade_level_id: r.grade_level_id,
              grade_code: r.grade_code,
              grade_name: r.grade_name,
            },
            subjects: (r.subjects || []).map((s) => ({
              subject_id: s.subject_id,
              subject_code: s.subject_code,
              subject_name: s.subject_name,
            })),
          });
        }
        setGradeMap(map);
      } catch (e) {
        setModal({
          show: true,
          title: 'Error',
          message:
            e?.message ||
            'Failed to load initial data (levels, subjects, per-grade assignments).',
          variant: 'danger',
        });
      } finally {
        setBootLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  /** Prepare data for selected grade from gradeMap */
  useEffect(() => {
    (async () => {
      const gid = formData.grade_level_id;

      // reset visuals
      setAssignedIds([]);
      setGradeSubjects([]);
      setSelectAllPage(false);
      setPage(1);
      setFormData((prev) => ({ ...prev, assignments: [] }));

      if (!gid) return;

      setLoading(true);
      try {
        const bucket = gradeMap.get(gid);
        const ids = new Set((bucket?.subjects || []).map((s) => s.subject_id));
        setAssignedIds(Array.from(ids));
        setGradeSubjects(bucket?.subjects || []);
      } catch {
        setModal({
          show: true,
          title: 'Error',
          message: 'Failed to prepare data for the selected grade.',
          variant: 'danger',
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.grade_level_id, gradeMap]);

  // ---- Top picker filtering + pagination
  const filtered = useMemo(() => {
    if (!formData.grade_level_id) return [];
    // hide already assigned to this grade
    const assignedSet = new Set(assignedIds);
    const remaining = activeSubjects.filter((s) => !assignedSet.has(s.subject_id));

    const t = query.trim().toLowerCase();
    if (!t) return remaining;

    return remaining.filter(
      (s) =>
        (s.subject_code || '').toLowerCase().includes(t) ||
        (s.subject_name || '').toLowerCase().includes(t)
    );
  }, [activeSubjects, assignedIds, formData.grade_level_id, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageStart = (page - 1) * itemsPerPage;
  const pageSlice = filtered.slice(pageStart, pageStart + itemsPerPage);

  const isSelected = (id) => formData.assignments.some((a) => a.subject_id === id);
  const selectedCount = formData.assignments.length;

  const toggleRow = (row, checked) => {
    setFormData((prev) => {
      const cur = prev.assignments;
      if (checked) {
        if (cur.some((a) => a.subject_id === row.subject_id)) return prev;
        return { ...prev, assignments: [...cur, { ...row, units: 0, is_required: false }] };
      } else {
        return { ...prev, assignments: cur.filter((a) => a.subject_id !== row.subject_id) };
      }
    });
  };

  const toggleSelectAllOnPage = (checked) => {
    setSelectAllPage(checked);
    setFormData((prev) => {
      if (!checked) {
        const idsOnPage = new Set(pageSlice.map((s) => s.subject_id));
        return { ...prev, assignments: prev.assignments.filter((a) => !idsOnPage.has(a.subject_id)) };
      }
      const curIds = new Set(prev.assignments.map((a) => a.subject_id));
      const toAdd = pageSlice
        .filter((s) => !curIds.has(s.subject_id))
        .map((s) => ({ ...s, units: 0, is_required: false }));
      return { ...prev, assignments: [...prev.assignments, ...toAdd] };
    });
  };

  const updateField = (subject_id, key, value) => {
    setFormData((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) =>
        a.subject_id === subject_id ? { ...a, [key]: value } : a
      ),
    }));
  };

  const resetAll = () => {
    setFormData({ grade_level_id: 0, assignments: [] });
    setAssignedIds([]);
    setGradeSubjects([]);
    setQuery('');
    setPage(1);
    setSelectAllPage(false);
  };

  const refreshPerGradeView = async () => {
    try {
      const byGradeUrl = joinUrl(BASE_URL, '/subjects/view-all-sub-grade-levels');
      const res = await fetch(byGradeUrl, { headers });
      const data = await res.json();
      if (!data?.success) return;

      const rows = Array.isArray(data.data) ? data.data : [];
      const map = new Map();
      for (const r of rows) {
        map.set(r.grade_level_id, {
          grade: {
            grade_level_id: r.grade_level_id,
            grade_code: r.grade_code,
            grade_name: r.grade_name,
          },
          subjects: (r.subjects || []).map((s) => ({
            subject_id: s.subject_id,
            subject_code: s.subject_code,
            subject_name: s.subject_name,
          })),
        });
      }
      setGradeMap(map);
    } catch {
      // silent; will be retried on next interaction
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!formData.grade_level_id || selectedCount === 0) {
      setModal({
        show: true,
        title: 'Check fields',
        message: 'Pick a grade and select at least one subject.',
        variant: 'warning',
      });
      return;
    }
    const invalid = formData.assignments.find((a) => {
      const n = Number(a.units);
      return !Number.isFinite(n) || n < 0;
    });
    if (invalid) {
      setModal({
        show: true,
        title: 'Units required',
        message: 'Enter a non-negative number for all selected subjects’ units.',
        variant: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const successes = [];
      const failures = [];

      // Submit each assignment with single-create endpoint
      for (const a of formData.assignments) {
        const payload = {
          subject_id: a.subject_id,
          grade_level_id: formData.grade_level_id,
          is_required: !!a.is_required,
          units: Number(a.units) || 0,
        };

        try {
          const res = await fetch(joinUrl(BASE_URL, '/subject-grade-levels/create'), {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data?.success) {
            successes.push({ subject_id: a.subject_id });
          } else {
            failures.push({ subject_id: a.subject_id, error: data?.message || 'Failed' });
          }
        } catch (err) {
          failures.push({ subject_id: a.subject_id, error: err?.message || 'Network error' });
        }
      }

      const okCount = successes.length;
      const failCount = failures.length;

      // Refresh per-grade view (bottom table + assigned IDs)
      if (okCount > 0) {
        await refreshPerGradeView();
        // re-derive for the current grade
        const gid = formData.grade_level_id;
        const bucket = gradeMap.get(gid);
        const ids = new Set((bucket?.subjects || []).map((s) => s.subject_id));
        setAssignedIds(Array.from(ids));
        setGradeSubjects(bucket?.subjects || []);
        // Clear selection
        setFormData((prev) => ({ ...prev, assignments: [] }));
      }

      // Feedback
      let msg = `Created: ${okCount}`;
      if (failCount > 0) msg += ` • Failed: ${failCount}`;
      setModal({
        show: true,
        title: failCount === 0 ? 'Success' : okCount > 0 ? 'Partial success' : 'Error',
        message: msg,
        variant: failCount === 0 ? 'success' : okCount > 0 ? 'warning' : 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-xxl py-4">
      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          <h3 className="fw-bold mb-4">Assign Subjects to Grade</h3>

          {/* Toolbar */}
          <div className="row g-2 align-items-center mb-3">
            <div className="col-12 col-lg-4">
              <select
                className="form-select"
                value={formData.grade_level_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, grade_level_id: Number(e.target.value) }))}
                disabled={bootLoading}
              >
                <option value={0}>Select grade level</option>
                {gradeLevels.map((g) => (
                  <option key={g.grade_level_id} value={g.grade_level_id}>
                    {g.grade_name} ({g.grade_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-lg-5">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  className="form-control"
                  placeholder="Code or name"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  disabled={!formData.grade_level_id || bootLoading || loading}
                />
                {query && (
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setQuery('')}
                    disabled={bootLoading || loading}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-lg-3 d-flex justify-content-lg-end">
              <span className="badge text-bg-secondary d-inline-flex align-items-center gap-2 px-3">
                Selected: <span className="fw-semibold">{selectedCount}</span>
              </span>
            </div>
          </div>

          {/* Picker Table */}
          <form onSubmit={submit} noValidate>
            <div className="table-responsive border rounded-3">
              {bootLoading ? (
                <div className="text-center text-muted py-5">Loading data…</div>
              ) : !formData.grade_level_id || loading ? (
                <div className="text-center text-muted py-5">
                  {loading ? 'Preparing subjects…' : 'Pick a grade level to start.'}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-muted py-5">No subjects available to assign.</div>
              ) : (
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 48 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={pageSlice.length > 0 && pageSlice.every((s) => isSelected(s.subject_id))}
                          onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                        />
                      </th>
                      <th style={{ width: 140 }}>Code</th>
                      <th>Name</th>
                      <th style={{ width: 120 }}>Units</th>
                      <th style={{ width: 120 }}>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((s) => {
                      const selected = isSelected(s.subject_id);
                      const found = formData.assignments.find((a) => a.subject_id === s.subject_id);
                      return (
                        <tr key={s.subject_id} className={selected ? 'table-primary' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selected}
                              onChange={(e) => toggleRow(s, e.target.checked)}
                            />
                          </td>
                          <td className="fw-medium">{s.subject_code}</td>
                          <td>{s.subject_name}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              placeholder="0"
                              value={selected ? (found?.units ?? 0) : ''}
                              onChange={(e) => updateField(s.subject_id, 'units', e.target.value)}
                              disabled={!selected}
                            />
                          </td>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selected ? !!found?.is_required : false}
                              onChange={(e) => updateField(s.subject_id, 'is_required', e.target.checked)}
                              disabled={!selected}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {formData.grade_level_id !== 0 && filtered.length > itemsPerPage && (
              <nav className="mt-3 d-flex justify-content-center">
                <ul className="pagination mb-0">
                  <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    >
                      Prev
                    </button>
                  </li>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <li key={i} className={`page-item ${page === i + 1 ? 'active' : ''}`}>
                      <button
                        className="page-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i + 1);
                        }}
                      >
                        {i + 1}
                      </button>
                  </li>
                  ))}
                  <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            )}

            {/* Actions */}
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-success d-flex align-items-center gap-2 px-4"
                disabled={!formData.grade_level_id || selectedCount === 0 || saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    <span>Assigning…</span>
                  </>
                ) : (
                  <>
                    <FaCheck /> Assign Subjects
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary d-flex align-items-center gap-2 px-4"
                onClick={resetAll}
                disabled={saving}
              >
                <FaTimes /> Reset
              </button>
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-4"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </form>

          {/* Info */}
          <div className="mt-3 text-muted small">
            <span className="me-3">Already assigned subjects are hidden for the selected grade (from active curriculum).</span>
            {assignedIds.length > 0 && (
              <span className="badge text-bg-light">Hidden: {assignedIds.length}</span>
            )}
          </div>

          {/* Bottom table: currently assigned subjects for selected grade (from view-all-sub-grade-levels) */}
          {formData.grade_level_id !== 0 && (
            <div className="mt-5">
              <h5 className="fw-bold mb-3">Currently Assigned Subjects for this Grade</h5>
              <div className="table-responsive border rounded-3">
                {gradeSubjects.length === 0 ? (
                  <div className="text-center text-muted py-4">No subjects assigned to this grade yet.</div>
                ) : (
                  <table className="table table-sm table-striped align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 140 }}>Code</th>
                        <th>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeSubjects.map((r) => (
                        <tr key={r.subject_id}>
                          <td className="fw-medium">{r.subject_code}</td>
                          <td>{r.subject_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-2 small text-muted">
                Total: <span className="fw-semibold">{gradeSubjects.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignSubjectsForm;
