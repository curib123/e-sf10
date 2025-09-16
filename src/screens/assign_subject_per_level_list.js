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

// Safe URL joiner (avoids double/missing slashes)
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

const ACTIVE_CURRICULUM_ID = 1; // constant “active” per your note

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

  const [gradeLevels, setGradeLevels] = useState([]);
  const [gradeSubjects, setGradeSubjects] = useState([]); // bottom table (already assigned for selected grade)
  const [assignedCodes, setAssignedCodes] = useState([]); // badge only (hidden count)
  const [allSubjects, setAllSubjects] = useState([]); // top picker (from active curriculum, minus already assigned)

  const [formData, setFormData] = useState({ grade_level_id: 0, assignments: [] });

  const [query, setQuery] = useState('');
  const [selectAllPage, setSelectAllPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  // pagination (top picker)
  const itemsPerPage = 10;
  const [page, setPage] = useState(1);

  // fetch grade levels (once)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, '/grade-levels'), { headers });
        const data = await res.json();
        if (data?.success) setGradeLevels(data.data || []);
      } catch {
        setModal({ show: true, title: 'Error', message: 'Failed to load grade levels.', variant: 'danger' });
      }
    })();
  }, [headers]);

  // helper: load assigned for grade and return {assignedList, codes}
  const fetchAssignedForGrade = async (gid) => {
    setLoadingAssigned(true);
    try {
      const r = await fetch(joinUrl(BASE_URL, `/subject-grade-levels/by-grade-level/${gid}`), { headers });
      const d = await r.json();
      const rows = d?.success ? (d.data || []) : [];
      const assignedList = rows
        .map((a) => ({
          sgl_id: a.subject_grade_level_id ?? a.id ?? undefined,
          subject_id: a.subject_id ?? a.subject?.subject_id,
          subject_code: a.subject?.subject_code ?? a.subject_code,
          subject_name: a.subject?.subject_name ?? a.subject_name,
          units: Number(a.units ?? 0),
          is_required: !!a.is_required,
        }))
        .filter((x) => x.subject_code);

      const codes = new Set(assignedList.map((x) => x.subject_code));
      setGradeSubjects(assignedList);
      setAssignedCodes(Array.from(codes));
      return { assignedList, codes };
    } finally {
      setLoadingAssigned(false);
    }
  };

  // when grade changes: fetch assigned first, then fetch ACTIVE CURRICULUM subjects and filter via local set
  useEffect(() => {
    const load = async () => {
      const gid = formData.grade_level_id;

      setAssignedCodes([]);
      setAllSubjects([]);
      setGradeSubjects([]);
      setSelectAllPage(false);
      setPage(1);
      setFormData((prev) => ({ ...prev, assignments: [] }));

      if (!gid) return;

      setLoading(true);
      try {
        // 1) assigned (local codes set)
        const { codes: assignedCodesSet } = await fetchAssignedForGrade(gid);

        // 2) subjects from ACTIVE CURRICULUM
        const curriculumUrl = joinUrl(
          BASE_URL,
          `/curriculum/curriculum-subjects/active/${ACTIVE_CURRICULUM_ID}`
        );
        const r2 = await fetch(curriculumUrl, { headers });
        const d2 = await r2.json();

        const subjects = d2?.success
          ? (d2.data || []).map((s) => ({
              subject_id: s.subject_id,
              subject_code: s.subject_code,
              subject_name: s.subject_name,
              is_required: false,
              units: 0, // default input value
            }))
          : [];

        // 3) filter strictly with the local set (hide already assigned)
        const filtered = subjects.filter((s) => !assignedCodesSet.has(s.subject_code));
        setAllSubjects(filtered);
      } catch {
        setModal({ show: true, title: 'Error', message: 'Failed to load subjects.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.grade_level_id, headers]);

  // filtering + pagination (top picker)
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return allSubjects;
    return allSubjects.filter(
      (s) =>
        (s.subject_code || '').toLowerCase().includes(t) ||
        (s.subject_name || '').toLowerCase().includes(t)
    );
  }, [allSubjects, query]);

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
    setAssignedCodes([]);
    setAllSubjects([]);
    setGradeSubjects([]);
    setQuery('');
    setPage(1);
    setSelectAllPage(false);
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

    try {
      const payload = {
        assignments: formData.assignments.map((a) => {
          const n = Number(a.units);
          const cleanUnits = Number.isFinite(n) && n >= 0 ? n : 0;
          return {
            subject_id: a.subject_id,
            grade_level_id: formData.grade_level_id,
            is_required: !!a.is_required,
            units: cleanUnits,
          };
        }),
      };

      const res = await fetch(joinUrl(BASE_URL, '/subject-grade-levels/bulk-create'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setModal({
        show: true,
        title: data?.success ? 'Success' : 'Error',
        message: data?.message || (data?.success ? 'Saved.' : 'Failed to save.'),
        variant: data?.success ? 'success' : 'danger',
      });

      if (data?.success) {
        // refresh assigned (local codes) and re-filter remaining subjects
        const { codes: assignedCodesSet } = await fetchAssignedForGrade(formData.grade_level_id);
        setAllSubjects((prev) => prev.filter((s) => !assignedCodesSet.has(s.subject_code)));
        setFormData((prev) => ({ ...prev, assignments: [] }));
      }
    } catch {
      setModal({
        show: true,
        title: 'Error',
        message: 'Error occurred while assigning subjects.',
        variant: 'danger',
      });
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
                  setFormData((prev) => ({ ...prev, grade_level_id: Number(e.target.value) }))
                }
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
                  disabled={!formData.grade_level_id || loading}
                />
                {query && (
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setQuery('')}
                    disabled={loading}
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
              {!formData.grade_level_id || loading ? (
                <div className="text-center text-muted py-5">
                  {loading ? 'Loading…' : 'Pick a grade level to start.'}
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
                disabled={!formData.grade_level_id || selectedCount === 0}
              >
                <FaCheck /> Assign Subjects
              </button>
              <button
                type="button"
                className="btn btn-secondary d-flex align-items-center gap-2 px-4"
                onClick={resetAll}
              >
                <FaTimes /> Reset
              </button>
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-4"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </form>

          {/* Info */}
          <div className="mt-3 text-muted small">
            <span className="me-3">Already assigned subjects are hidden for the selected grade.</span>
            {assignedCodes.length > 0 && (
              <span className="badge text-bg-light">Hidden: {assignedCodes.length}</span>
            )}
          </div>

          {/* Bottom table: assigned subjects */}
          {formData.grade_level_id !== 0 && (
            <div className="mt-5">
              <h5 className="fw-bold mb-3">Currently Assigned Subjects for this Grade</h5>
              <div className="table-responsive border rounded-3">
                {loadingAssigned ? (
                  <div className="text-center text-muted py-4">Loading assigned subjects…</div>
                ) : gradeSubjects.length === 0 ? (
                  <div className="text-center text-muted py-4">No subjects assigned to this grade yet.</div>
                ) : (
                  <table className="table table-sm table-striped align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 140 }}>Code</th>
                        <th>Name</th>
                        <th style={{ width: 120 }}>Units</th>
                        <th style={{ width: 120 }}>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeSubjects.map((r) => (
                        <tr key={`${r.subject_id}-${r.sgl_id ?? r.subject_code}`}>
                          <td className="fw-medium">{r.subject_code}</td>
                          <td>{r.subject_name}</td>
                          <td>{r.units}</td>
                          <td>{r.is_required ? 'Yes' : 'No'}</td>
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
