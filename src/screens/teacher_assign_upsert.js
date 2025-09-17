// src/screens/teacher_assign_upsert.js
import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaCalendarCheck,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaInfoCircle,
  FaLock,
  FaSave,
  FaSearch,
  FaSyncAlt,
  FaTimesCircle,
  FaUndo,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

// ────────────────────────────────────────────────────────────────────────────────
// Config
const BASE_URL = process.env.REACT_APP_API_BASE_URL; // must already include /esf10
const CREATE_ENDPOINT = `/teacher-assignments/create`;
const UPDATE_ENDPOINT = (id) => `/teacher-assignments/update/${id}`;
const SHOW_ENDPOINT = (id) => `/teacher-assignments/${id}`;
const TEACHER_ACTIVE_YEAR = (teacherId) =>
  `/teacher-assignments/teacher/${teacherId}/active-year`;

const STORAGE_KEY = 'teacherAssignment.selectedTeacherId';
const HARD_REFRESH_ON_SAVE = true;
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={18} />,
  danger: <FaTimesCircle size={18} />,
  warning: <FaExclamationTriangle size={18} />,
  info: <FaInfoCircle size={18} />,
};

// ────────────────────────────────────────────────────────────────────────────────
// Helpers (School Year)
const isTruthyActive = (v) => {
  if (v === true || v === 1 || v === '1') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
};
const hasActiveFlag = (sy) => {
  const v = sy?.is_active ?? sy?.active ?? sy?.isActive ?? sy?.status;
  return isTruthyActive(v);
};
const toYear = (v) => {
  if (v == null) return NaN;
  const m = String(v).match(/\d{4}/);
  return m ? Number(m[0]) : Number.isFinite(Number(v)) ? Number(v) : NaN;
};
const getStartYear = (sy) =>
  toYear(sy?.start_year ?? (sy?.school_year?.split?.('-')?.[0]));
const getEndYear = (sy) =>
  toYear(sy?.end_year ?? (sy?.school_year?.split?.('-')?.[1]));
const pickActiveSchoolYear = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const byFlag = list.find(hasActiveFlag);
  if (byFlag) return byFlag;
  const sorted = [...list].sort((a, b) => {
    const ae = getEndYear(a), be = getEndYear(b);
    if (Number.isFinite(ae) && Number.isFinite(be) && be !== ae) return be - ae;
    const as = getStartYear(a), bs = getStartYear(b);
    if (Number.isFinite(as) && Number.isFinite(bs) && bs !== as) return bs - as;
    return 0;
  });
  return sorted[0] || null;
};

// Name/code normalizer used for grade matching
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/^grade/, 'g');

// Small helpers
const countBy = (arr, keyFn) => {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};
const sortEntriesByCountDesc = (mapObj) =>
  [...mapObj.entries()].sort((a, b) => b[1] - a[1]);

// ────────────────────────────────────────────────────────────────────────────────
// Searchable dropdown (top 3 results). Filled when chosen, outlined otherwise.
const TeacherSearchSelect = ({
  items,
  value,
  onChange,
  disabled,
  invalid,
  placeholder = 'Search teacher…',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hoverIdx, setHoverIdx] = useState(-1);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => items.find((t) => String(t.teacher_id) === String(value)),
    [items, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((t) => {
          const name =
            t.full_name ||
            t.teacher_name ||
            `${t.first_name ?? ''} ${t.last_name ?? ''}`;
          return String(name).toLowerCase().includes(q);
        })
      : items;
    return base.slice(0, 3);
  }, [items, query]);

  const pick = (t) => {
    onChange(String(t.teacher_id));
    setQuery('');
    setOpen(false);
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && hoverIdx >= 0 && filtered[hoverIdx]) {
      e.preventDefault();
      pick(filtered[hoverIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const display =
    selected?.full_name ||
    selected?.teacher_name ||
    (selected ? `${selected.first_name ?? ''} ${selected.last_name ?? ''}` : '');

  return (
    <div className="position-relative" ref={wrapRef}>
      <div className={`input-group ${invalid ? 'is-invalid' : ''}`}>
        <span className="input-group-text">
          <FaSearch />
        </span>
        <input
          className={`form-control ${invalid ? 'is-invalid' : ''}`}
          type="text"
          disabled={disabled}
          placeholder={display || placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Teacher search"
        />
      </div>
      <input type="hidden" value={value} readOnly />

      {open && (
        <div
          className="dropdown-menu show w-100 mt-1 shadow"
          style={{ maxHeight: 240, overflowY: 'auto' }}
        >
          {filtered.length === 0 ? (
            <div className="dropdown-item text-muted small">No matches</div>
          ) : (
            filtered.map((t, idx) => {
              const name =
                t.full_name ||
                t.teacher_name ||
                `${t.first_name ?? ''} ${t.last_name ?? ''}`;
              const active = idx === hoverIdx;
              return (
                <button
                  key={t.teacher_id}
                  type="button"
                  className={`dropdown-item d-flex justify-content-between ${active ? 'active' : ''}`}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(-1)}
                  onClick={() => pick(t)}
                >
                  <span>{name}</span>
                  <small className="text-muted">ID: {t.teacher_id}</small>
                </button>
              );
            })
          )}
        </div>
      )}
      {invalid && <div className="invalid-feedback d-block">Teacher is required.</div>}

      {/* Visual pill showing chosen teacher (filled) or placeholder (outline) */}
      <div className="mt-2">
        {selected ? (
          <span className="sel-pill sel-pill--filled">
            {display}
          </span>
        ) : (
          <span className="sel-pill sel-pill--outline">
            Choose a teacher to continue
          </span>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Component
const TeacherAssignmentForm = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const inFlight = useRef(false);

  // UI
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusModal, setStatusModal] = useState({
    show: false, title: '', message: '', variant: 'info', icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // Data
  const [teachers, setTeachers] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [byGrade, setByGrade] = useState([]); // [{ grade_level_id, grade_name, sections[], subjects[] }]

  // Form (school_year_id is hidden; auto-set to ACTIVE)
  const [form, setForm] = useState({
    teacher_id: '',
    school_year_id: '',
  });

  // Single Grade dropdown (drives both sections & subjects)
  const [selectedGradeId, setSelectedGradeId] = useState(''); // '' when none

  // Multi-selects
  const [selectedSectionIds, setSelectedSectionIds] = useState(new Set());
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());

  // Edit state
  const [current, setCurrent] = useState(null);
  const suppressAutoSelectRef = useRef(false); // used only for safe edit prefill

  // Table below
  const [teacherSubs, setTeacherSubs] = useState([]);
  const [teacherSubsLoading, setTeacherSubsLoading] = useState(false);
  const lastTeacherFetched = useRef(null);

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Recommendation state
  const [recExpanded, setRecExpanded] = useState(true);
  const [rec, setRec] = useState({
    gradeId: '',
    sectionIds: new Set(),
    subjectIds: new Set(),
    reasons: [],
  });

  const selectedTeacher = useMemo(
    () => teachers.find((x) => String(x.teacher_id) === String(form.teacher_id)),
    [teachers, form.teacher_id]
  );
  const selectedTeacherName = useMemo(() => {
    const t = selectedTeacher;
    return t?.full_name || t?.teacher_name || (teacherSubs[0]?.teacher_name ?? '');
  }, [selectedTeacher, teacherSubs]);

  const teacherInitials = useMemo(() => {
    const name = selectedTeacherName || '';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('') || 'T'
    );
  }, [selectedTeacherName]);

  const activeSY = useMemo(() => pickActiveSchoolYear(schoolYears), [schoolYears]);
  const activeSYText = useMemo(() => {
    if (!activeSY) return '';
    const a = activeSY;
    const s = a.start_year ?? a.school_year?.split?.('-')?.[0] ?? '';
    const e = a.end_year ?? a.school_year?.split?.('-')?.[1] ?? '';
    return `${s} - ${e}`;
  }, [activeSY]);

  // Persist selected teacher across hard reloads
  const persistSelectedTeacher = (tid) => {
    if (tid) sessionStorage.setItem(STORAGE_KEY, String(tid));
  };
  const restorePersistedTeacher = () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      sessionStorage.removeItem(STORAGE_KEY);
      return saved;
    }
    return null;
  };
  const hardRefreshPreserveTeacher = () => {
    if (form.teacher_id) persistSelectedTeacher(form.teacher_id);
    window.location.reload();
  };

  const handleUnauthorized = () => {
    showStatus('danger', 'Unauthorized', 'Please login to continue.');
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const isAbsolute = /^https?:\/\//i.test(path);
    const fullUrl = isAbsolute ? path : `${BASE_URL}${path}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };

  // Loads
  const loadTeachers = async () => {
    try {
      const res = await apiFetch(`/teachers`, { method: 'GET' });
      const data = await res.json();
      setTeachers(data?.success ? data.data || [] : []);
    } catch {
      showStatus('danger', 'Error', 'Failed to load teachers.');
    }
  };
  const loadSchoolYears = async () => {
    try {
      const res = await apiFetch(`/school-year/all-school-years`, { method: 'GET' });
      const data = await res.json();
      const list = data?.success ? data.schoolYears || [] : [];
      setSchoolYears(list);
      const active = pickActiveSchoolYear(list);
      if (active?.school_year_id) {
        setForm((f) => ({ ...f, school_year_id: String(active.school_year_id) }));
      }
    } catch {
      showStatus('danger', 'Error', 'Failed to load school years.');
    }
  };
  const loadByGrade = async () => {
    try {
      const res = await apiFetch(`/subjects/view-all-sub-grade-levels`, { method: 'GET' });
      const data = await res.json();
      setByGrade(data?.success ? data.data || [] : []);
    } catch {
      showStatus('danger', 'Error', 'Failed to load grade-level sections & subjects.');
    }
  };

  // Helpers to resolve grade from existing assignment
  const findGradeBySectionOrSubject = (sectionId, subjectId) => {
    const sid = sectionId ? String(sectionId) : null;
    const subid = subjectId ? String(subjectId) : null;
    for (const g of byGrade) {
      if (sid && Array.isArray(g.sections) && g.sections.some(s => String(s.section_id) === sid)) {
        return String(g.grade_level_id);
      }
      if (subid && Array.isArray(g.subjects) && g.subjects.some(s => String(s.subject_id) === subid)) {
        return String(g.grade_level_id);
      }
    }
    return null;
  };
  const findGradeIdByName = (name) => {
    if (!name) return null;
    const target = norm(name);
    for (const g of byGrade) {
      const gn = norm(g.grade_name || g.grade_code || '');
      if (gn && gn === target) return String(g.grade_level_id);
    }
    const num = String(name).match(/\d+/)?.[0];
    if (num) {
      for (const g of byGrade) {
        const gn2 = norm(g.grade_name || g.grade_code || '');
        if (gn2 && gn2.endsWith(num)) return String(g.grade_level_id);
      }
    }
    return null;
  };

  const loadAssignment = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(SHOW_ENDPOINT(id), { method: 'GET' });
      const data = await res.json();
      if (!data?.success || !data.data) {
        showStatus('warning', 'Not found', 'Assignment not found.');
        return;
      }
      const a = data.data;
      setCurrent(a);

      // teacher is editable; school_year_id stays auto-active (hidden)
      setForm((f) => ({
        ...f,
        teacher_id: a.teacher_id ?? f.teacher_id,
      }));

      // Determine the grade id from current assignment
      const secId = a.section_id ? String(a.section_id) : '';
      const subId = a.subject_id ? String(a.subject_id) : '';
      let gradeId =
        a.grade_level_id ? String(a.grade_level_id) : null;
      if (!gradeId) {
        gradeId =
          findGradeBySectionOrSubject(secId, subId) ||
          findGradeIdByName(a.grade_name);
      }

      // EDIT PREFILL: set dropdown to current grade and keep current sec/subj as selected
      suppressAutoSelectRef.current = true;
      setSelectedGradeId(gradeId || '');
      setSelectedSectionIds(secId ? new Set([secId]) : new Set());
      setSelectedSubjectIds(subId ? new Set([subId]) : new Set());
      setTimeout(() => { suppressAutoSelectRef.current = false; }, 0);
    } catch {
      showStatus('danger', 'Error', 'Failed to load assignment details.');
    }
  };

  // Boot: load teachers FIRST, then the rest
  useEffect(() => {
    if (!token) return handleUnauthorized();
    (async () => {
      setBusy(true);
      await loadTeachers(); // populate teacher first
      const savedTeacherId = restorePersistedTeacher();
      if (savedTeacherId) {
        setForm((f) => ({ ...f, teacher_id: savedTeacherId }));
      }
      await Promise.all([loadSchoolYears(), loadByGrade()]);
      if (id) await loadAssignment();
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  // Safety net: once byGrade arrives in edit, if grade dropdown is still empty, infer it.
  useEffect(() => {
    if (!isEditMode || !current || byGrade.length === 0) return;
    if (selectedGradeId) return;

    const secId = current.section_id && String(current.section_id);
    const subId = current.subject_id && String(current.subject_id);
    let gradeId =
      (current.grade_level_id && String(current.grade_level_id)) ||
      findGradeBySectionOrSubject(secId, subId) ||
      findGradeIdByName(current.grade_name);

    if (gradeId) {
      suppressAutoSelectRef.current = true;
      setSelectedGradeId(gradeId);
      setTimeout(() => { suppressAutoSelectRef.current = false; }, 0);
    }
  }, [isEditMode, current, byGrade, selectedGradeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh table on teacher change
  useEffect(() => {
    if (form.teacher_id) {
      fetchTeacherSubjects(form.teacher_id);
    } else {
      setTeacherSubs([]);
      lastTeacherFetched.current = null;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.teacher_id]);

  const fetchTeacherSubjects = async (tid) => {
    if (!tid) {
      setTeacherSubs([]);
      lastTeacherFetched.current = null;
      return;
    }
    if (String(lastTeacherFetched.current) === String(tid) && teacherSubs.length) return;
    try {
      setTeacherSubsLoading(true);
      const res = await apiFetch(TEACHER_ACTIVE_YEAR(tid), { method: 'GET' });
      const data = await res.json();
      const list = data?.success ? data.data || [] : [];
      setTeacherSubs(list);
      lastTeacherFetched.current = tid;
    } catch {
      setTeacherSubs([]);
      showStatus('danger', 'Error', "Failed to load teacher's current subjects (active year).");
    } finally {
      setTeacherSubsLoading(false);
    }
  };

  // Form helpers
  const setField = (k) => (vOrEvent) => {
    const v = vOrEvent?.target ? vOrEvent.target.value : vOrEvent;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const toggleSet = (setter) => (id) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  // When grade changes: clear BOTH sections & subjects (no auto-select in Create)
  useEffect(() => {
    if (suppressAutoSelectRef.current) return;
    setSelectedSectionIds(new Set());
    setSelectedSubjectIds(new Set());
  }, [selectedGradeId]);

  const teacherChosen = Boolean(String(form.teacher_id).trim());
  const syReady = Boolean(String(form.school_year_id).trim()); // hidden active SY
  const lockUI = !teacherChosen;

  const validate = () => {
    if (!teacherChosen) return false;
    if (!syReady) return false;
    if (!selectedGradeId && !isEditMode) return false; // create requires explicit grade pick
    const hasAnySection = selectedSectionIds.size > 0 || (isEditMode && current?.section_id);
    const hasAnySubject = selectedSubjectIds.size > 0 || (isEditMode && current?.subject_id);
    return Boolean(hasAnySection && hasAnySubject);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token || inFlight.current) return;
    setSubmitted(true);
    const ok = validate();
    if (!ok) {
      const msg = !syReady
        ? 'Active school year is not ready yet. Please wait a moment.'
        : 'Please complete all required fields.';
      showStatus('warning', 'Missing fields', msg);
      return;
    }

    try {
      setBusy(true);
      inFlight.current = true;

      if (id) {
        // Use selected values, else fall back to existing assignment values
        const pickedSubjectId =
          selectedSubjectIds.size ? Number([...selectedSubjectIds][0]) : Number(current?.subject_id);
        const pickedSectionId =
          selectedSectionIds.size ? Number([...selectedSectionIds][0]) : Number(current?.section_id);

        const payload = {
          teacher_id: Number(form.teacher_id),
          subject_id: Number(pickedSubjectId),
          section_id: Number(pickedSectionId),
          school_year_id: Number(form.school_year_id), // ACTIVE (hidden)
        };
        const res = await apiFetch(UPDATE_ENDPOINT(id), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) throw new Error(data?.message || 'Request failed');

        showStatus('success', 'Updated', 'Teacher assignment updated successfully.');
      } else {
        // batch create from manual picks
        const combos = [];
        selectedSectionIds.forEach((sec) => {
          selectedSubjectIds.forEach((subj) => {
            combos.push({
              teacher_id: Number(form.teacher_id),
              section_id: Number(sec),
              subject_id: Number(subj),
              school_year_id: Number(form.school_year_id), // ACTIVE (hidden)
            });
          });
        });

        let okCount = 0;
        for (const payload of combos) {
          const res = await apiFetch(CREATE_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok && data?.success !== false) okCount++;
        }

        showStatus(
          'success',
          'Created',
          `Created ${okCount}/${combos.length} assignment${combos.length !== 1 ? 's' : ''}.`
        );
      }

      if (HARD_REFRESH_ON_SAVE) {
        persistSelectedTeacher(form.teacher_id);
        window.location.reload();
        return;
      }

      if (form.teacher_id) await fetchTeacherSubjects(form.teacher_id);
    } catch (err) {
      showStatus('danger', 'Error', err.message || 'Something went wrong while saving.');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const onReset = () => {
    setSubmitted(false);
    if (id) {
      loadAssignment();
    } else {
      // keep teacher, keep hidden active SY, clear picks
      setForm((f) => ({
        teacher_id: f.teacher_id,
        school_year_id: activeSY?.school_year_id ? String(activeSY.school_year_id) : '',
      }));
      setSelectedGradeId('');
      setSelectedSectionIds(new Set());
      setSelectedSubjectIds(new Set());
    }
  };

  // Pagination helpers
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(teacherSubs.length / pageSize)),
    [teacherSubs.length, pageSize]
  );
  const paginatedSubs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return teacherSubs.slice(start, start + pageSize);
  }, [teacherSubs, page, pageSize]);
  const rangeStart = useMemo(
    () => (teacherSubs.length ? (page - 1) * pageSize + 1 : 0),
    [teacherSubs.length, page, pageSize]
  );
  const rangeEnd = useMemo(
    () => Math.min(teacherSubs.length, page * pageSize),
    [teacherSubs.length, page, pageSize]
  );
  useEffect(() => setPage(1), [teacherSubs.length, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  // Derived maps/options
  const gradeMap = useMemo(() => {
    const m = new Map();
    byGrade.forEach((g) => m.set(String(g.grade_level_id), g));
    return m;
  }, [byGrade]);

  const gradeOptions = useMemo(() => {
    return byGrade.map(g => ({
      id: String(g.grade_level_id),
      label: g.grade_name || g.grade_code || `Grade ${g.grade_level_id}`,
    }));
  }, [byGrade]);

  const selectedGrade = selectedGradeId ? gradeMap.get(String(selectedGradeId)) : null;

  // Subjects already assigned for chosen grade & sections (active year)
  const assignedSubjectIdsForSelectedSections = useMemo(() => {
    if (!selectedGrade || teacherSubs.length === 0 || selectedSectionIds.size === 0) return new Set();
    const gname = norm(selectedGrade.grade_name || selectedGrade.grade_code || '');
    const set = new Set();
    teacherSubs.forEach((a) => {
      if (!a) return;
      const ag = norm(a.grade_name);
      const secId = String(a.section_id);
      if (ag && ag === gname && selectedSectionIds.has(secId)) {
        set.add(String(a.subject_id));
      }
    });
    return set;
  }, [teacherSubs, selectedGrade, selectedSectionIds]);

  const availableSubjects = useMemo(() => {
    if (!selectedGrade) return [];
    const all = selectedGrade.subjects || [];

    // If no sections chosen yet, show everything (can’t know conflicts per section).
    if (selectedSectionIds.size === 0) return all;

    const blocked = new Set(assignedSubjectIdsForSelectedSections);

    // In EDIT mode, allow keeping the current subject visible/selectable
    if (isEditMode && current?.subject_id != null) {
      blocked.delete(String(current.subject_id));
    }

    return all.filter(s => !blocked.has(String(s.subject_id)));
  }, [
    selectedGrade,
    selectedSectionIds,
    assignedSubjectIdsForSelectedSections,
    isEditMode,
    current,
  ]);

  // ───────────────────────── Recommendation Engine ─────────────────────────
  const buildRecommendations = () => {
    const reasons = [];
    let recGradeId = selectedGradeId;

    // 1) Recommend Grade if not selected yet: pick most-taught grade
    if (!recGradeId && teacherSubs.length > 0) {
      const byGradeCount = countBy(teacherSubs, (a) => norm(a.grade_name));
      const sorted = sortEntriesByCountDesc(byGradeCount);
      if (sorted.length > 0) {
        const topGradeNorm = sorted[0][0];
        const match = byGrade.find(g => norm(g.grade_name || g.grade_code) === topGradeNorm);
        if (match) {
          recGradeId = String(match.grade_level_id);
          reasons.push(`Most-taught grade this year: ${match.grade_name || match.grade_code}`);
        }
      }
    }

    // If still empty and there are grades available, pick the first one as a fallback UI convenience
    if (!recGradeId && byGrade.length > 0) {
      recGradeId = String(byGrade[0].grade_level_id);
      reasons.push('Suggested first available grade.');
    }

    // If we have a grade, compute sections & subjects recommendations
    let sectionIds = new Set();
    let subjectIds = new Set();
    const gradeObj = recGradeId ? gradeMap.get(String(recGradeId)) : null;

    if (gradeObj) {
      // 2) Sections: prefer sections in the grade where the teacher has no assignment yet
      const allSecs = (gradeObj.sections || []).map(s => String(s.section_id));
      const assignedSecsInGrade = new Set(
        teacherSubs
          .filter(a => norm(a.grade_name) === norm(gradeObj.grade_name || gradeObj.grade_code))
          .map(a => String(a.section_id))
      );
      const freeSecs = allSecs.filter(id => !assignedSecsInGrade.has(id));
      if (selectedSectionIds.size > 0) {
        // user already picked some sections → consider those "locked", but still recommend missing ones
        sectionIds = new Set(selectedSectionIds);
        if (freeSecs.length > 0) {
          reasons.push(`Free sections in ${gradeObj.grade_name || gradeObj.grade_code}: ${freeSecs.length}`);
        }
      } else if (freeSecs.length > 0) {
        sectionIds = new Set(freeSecs);
        reasons.push(`No current load in these section(s); assigning here avoids conflicts.`);
      } else {
        // all sections already have some assignment by this teacher → suggest all, let subject filter prevent dupes
        sectionIds = new Set(allSecs);
        reasons.push(`All sections already have assignments; showing all for selection.`);
      }

      // 3) Subjects: prefer subjects the teacher frequently teaches overall,
      // intersected with grade subjects and excluding already-assigned in selected sections.
      const subjFreq = countBy(teacherSubs, (a) => String(a.subject_id));
      const gradeSubjects = (gradeObj.subjects || []).map(s => ({ ...s, _id: String(s.subject_id) }));
      const chosenSections = sectionIds.size > 0 ? sectionIds : selectedSectionIds;

      // compute blocked subject ids for the (prospective) chosenSections
      const blocked = new Set();
      if (chosenSections.size > 0) {
        teacherSubs.forEach((a) => {
          if (norm(a.grade_name) !== norm(gradeObj.grade_name || gradeObj.grade_code)) return;
          if (chosenSections.has(String(a.section_id))) {
            blocked.add(String(a.subject_id));
          }
        });
      }

      // allow current subject in edit
      if (isEditMode && current?.subject_id != null) {
        blocked.delete(String(current.subject_id));
      }

      // rank candidates by frequency (desc) then by code/name
      const candidates = gradeSubjects
        .filter(s => !blocked.has(s._id))
        .map(s => ({ s, score: subjFreq.get(s._id) || 0 }))
        .sort((a, b) => (b.score - a.score) || String(a.s.subject_code || '').localeCompare(String(b.s.subject_code || '')));

      if (candidates.length > 0) {
        // pick top 3 by default
        const top = candidates.slice(0, Math.min(3, candidates.length));
        subjectIds = new Set(top.map(x => x.s._id));
        const topNames = top.map(x => x.s.subject_code || x.s.subject_name).filter(Boolean).join(', ');
        reasons.push(`Often taught by this teacher: ${topNames}`);
      } else {
        // nothing ranked → take any available subjects in the grade
        subjectIds = new Set(gradeSubjects.map(s => s._id));
        reasons.push(`All subjects available for the chosen section(s).`);
      }
    }

    return { gradeId: recGradeId || '', sectionIds, subjectIds, reasons };
  };

  // Recompute recommendations on key changes
  useEffect(() => {
    if (!teacherChosen || byGrade.length === 0) {
      setRec({ gradeId: '', sectionIds: new Set(), subjectIds: new Set(), reasons: [] });
      return;
    }
    const next = buildRecommendations();
    setRec(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teacherChosen,
    byGrade,
    teacherSubs,
    selectedGradeId,
    // Use sizes to avoid recreating refs
    selectedSectionIds.size,
  ]);

  // Apply recommendations (merge or replace)
  const applyRecommendations = (mode = 'merge') => {
    if (!rec.gradeId) return;

    const doApply = () => {
      // sections
      setSelectedSectionIds((prev) => {
        if (mode === 'replace') return new Set(rec.sectionIds);
        const next = new Set(prev);
        rec.sectionIds.forEach((id) => next.add(String(id)));
        return next;
      });
      // subjects
      setSelectedSubjectIds((prev) => {
        if (mode === 'replace') return new Set(rec.subjectIds);
        const next = new Set(prev);
        rec.subjectIds.forEach((id) => next.add(String(id)));
        return next;
      });
    };

    if (String(selectedGradeId) !== String(rec.gradeId)) {
      // Changing grade clears selections by design; defer applying chips
      suppressAutoSelectRef.current = true;
      setSelectedGradeId(String(rec.gradeId));
      // Allow React to process the grade change & chip clearing
      setTimeout(() => {
        suppressAutoSelectRef.current = false;
        doApply();
      }, 0);
    } else {
      doApply();
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid ">
      <style>{`
        .page-header {
          background: linear-gradient(135deg, rgba(13,110,253,.08), rgba(25,135,84,.08));
          border: 1px solid rgba(0,0,0,.04);
        }
        .avatar {
          width: 44px; height: 44px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: #0d6efd10; color: #0d6efd; font-weight: 700;
        }
        .card { border-radius: 1rem; }
        .card-header { border-bottom: 1px solid rgba(0,0,0,.08); }
        .table thead th { position: sticky; top: 0; z-index: 1; background: var(--bs-light,#f8f9fa); }
        .table tbody tr { transition: background-color .15s ease; }
        .table tbody tr:hover { background-color: rgba(13,110,253,.03); }
        .form-select:focus, .form-control:focus { box-shadow: 0 0 0 .2rem rgba(13,110,253,.15); border-color: #86b7fe; }
        .btn-icon { display: inline-flex; align-items: center; gap: .5rem; }
        .badge-soft { background: rgba(13,110,253,.08); color: #0d6efd; }
        .pagination .page-link { cursor: pointer; }

        .chip {
          display:inline-flex; align-items:center; gap:.5rem; padding:.38rem .7rem;
          border:1px solid rgba(0,0,0,.1); border-radius:999px; background:#fff; cursor:pointer;
          transition: all .15s ease-in-out; user-select:none;
        }
        .chip:hover { border-color: #0d6efd80; box-shadow: 0 0 0 .15rem rgba(13,110,253,.12); }
        .chip input { accent-color:#0d6efd; }
        .chip.selected {
          border-color:#0d6efd; background:#0d6efd; color:#fff;
        }
        .group-title { font-weight:600; margin:.25rem 0 .5rem; }
        .grid-2 { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:.5rem .75rem; }
        .small-muted { font-size:.875rem; color:#6c757d; }

        .sel-pill {
          display:inline-flex; align-items:center; padding:.3rem .6rem; border-radius:999px;
          border:1px solid; font-size:.875rem; gap:.5rem;
        }
        .sel-pill--filled { background:#0d6efd; color:#fff; border-color:#0d6efd; }
        .sel-pill--outline { background:#fff; color:#0d6efd; border-color:#0d6efd; }

        .lock-wrap { position: relative; }
        .lock-overlay {
          position:absolute; inset:0; background:rgba(255,255,255,.7); backdrop-filter:saturate(0.8) blur(1px);
          display:flex; align-items:center; justify-content:center; border-radius:1rem; border:1px dashed rgba(0,0,0,.1);
        }
        .lock-badge {
          display:inline-flex; align-items:center; gap:.5rem; padding:.5rem .75rem; border-radius:999px;
          background:#fff; border:1px solid rgba(13,110,253,.35); color:#0d6efd; font-weight:600;
          box-shadow: 0 .25rem .75rem rgba(0,0,0,.05);
        }

        .year-badge {
          display:inline-flex; align-items:center; gap:.4rem; padding:.25rem .6rem;
          border-radius:999px; background:#19875410; color:#198754; border:1px solid #19875430; font-size:.85rem;
        }

        .rec-box {
          border: 1px dashed rgba(13,110,253,.35);
          background: rgba(13,110,253,.04);
          border-radius: .75rem;
          padding: .75rem .9rem;
        }
        .rec-title {
          display:flex; align-items:center; gap:.5rem; font-weight:600;
        }
        .rec-actions {
          display:flex; gap:.5rem; flex-wrap:wrap;
        }
        .btn-soft-primary {
          background: rgba(13,110,253,.12); color: #0d6efd; border: 1px solid rgba(13,110,253,.25);
        }
        .btn-soft-primary:hover { background: rgba(13,110,253,.18); }
      `}</style>

      {/* Header */}
      <div className="page-header rounded-4 p-3 p-md-4 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar">{teacherInitials}</div>
          <div>
            <h3 className="fw-bold mb-1">{isEditMode ? 'Update Assignment' : 'Assign Teacher'}</h3>
            <div className="text-muted small">
              {isEditMode ? 'Modify the assignment (active year).' : 'Select a teacher first, then choose grade, sections, and subjects.'}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {activeSYText && (
            <span className="year-badge" title="Active school year (auto-applied)">
              <FaCalendarCheck /> Active Year: {activeSYText}
            </span>
          )}
          <button type="button" className="btn btn-outline-secondary btn-icon" onClick={() => { try { navigate(-1); } catch { navigate('/teacher-assignments'); }}}>
            <FaChevronLeft /> Back
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-icon"
            onClick={hardRefreshPreserveTeacher}
            aria-label="Refresh page"
            title="Refresh page"
          >
            <FaSyncAlt /> Refresh
          </button>
        </div>
      </div>

      {/* Form card */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white px-4 py-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="fw-semibold">Assignment Details</div>
            {teacherSubs.length > 0 && (
              <span className="badge rounded-pill badge-soft">
                {teacherSubs.length} assignment{teacherSubs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="card-body p-4">
          {isEditMode && (
            <div className="mb-4">
              {!current ? (
                <div className="placeholder-glow">
                  <p className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <p className="placeholder col-10 mb-0" style={{ height: 18 }} />
                </div>
              ) : (
                <div className="alert alert-light border rounded-3">
                  <div className="small text-muted mb-1">Current assignment</div>
                  <div className="d-flex flex-wrap gap-3 small">
                    <div><strong>Teacher:</strong> {current.teacher_name}</div>
                    <div><strong>Subject:</strong> {current.subject_code} — {current.subject_name}</div>
                    <div><strong>Section:</strong> {current.section_name}</div>
                    <div><strong>Grade:</strong> {current.grade_name}</div>
                    <div><strong>School Year:</strong> {current.school_year}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            {/* Teacher first */}
            <div className="row g-4">
              <div className="col-12">
                <label className="form-label fw-semibold">
                  Teacher <span className="text-danger">*</span>
                </label>
                <TeacherSearchSelect
                  items={teachers}
                  value={form.teacher_id}
                  onChange={setField('teacher_id')}
                  disabled={busy}
                  invalid={submitted && !String(form.teacher_id).trim()}
                />
              </div>
            </div>

            {/* Lock the rest until teacher is chosen */}
            <div className={`row g-4 mt-1 ${lockUI ? 'lock-wrap' : ''}`}>
              {lockUI && (
                <div className="lock-overlay">
                  <span className="lock-badge">
                    <FaLock /> Select a teacher to continue
                  </span>
                </div>
              )}
{/* Recommendation — compact (now on top) */}
<div className="col-12">
  <div className="rec-strip rec-strip--compact">
    <div className="rec-left">
  
      <div className="small text-truncate my-2">
        {!rec.gradeId ? (
          <>Recommendations appear after selecting a teacher</>
        ) : (
          <>
            Suggested <span className="fw-semibold my-2">
              {gradeOptions.find(g => String(g.id) === String(rec.gradeId))?.label || '—'}
            </span>
            {/* Tiny pills for counts */}
            {rec.sectionIds.size > 0 && (
              <span className="rec-pill ms-2">{rec.sectionIds.size} sec</span>
            )}
            {rec.subjectIds.size > 0 && (
              <span className="rec-pill ms-1">{rec.subjectIds.size} subj</span>
            )}
            {/* one short reason if available */}
            {rec.reasons?.[0] && (
              <span className="text-muted ms-2 d-none d-sm-inline">
                • {rec.reasons[0]}
              </span>
            )}
          </>
        )}
      </div>
    </div>

    <div className="d-flex gap-2">
      <button
        type="button"
        className="btn btn-soft-primary btn-sm"
        onClick={() => applyRecommendations('merge')}
        disabled={busy || lockUI || !rec.gradeId}
        title="Apply (merge with your current selections)"
      >
        Apply
      </button>
      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        onClick={() => applyRecommendations('replace')}
        disabled={busy || lockUI || !rec.gradeId}
        title="Replace current selections with recommendations"
      >
        Replace
      </button>
    </div>
  </div>
</div>

{/* Grade dropdown — moved below the recommendation */}
<div className="col-12 col-lg-6 mt-2">
  <label className="form-label fw-semibold">
    Grade <span className="text-danger">*</span>
  </label>
  <select
    className="form-select"
    value={selectedGradeId}
    onChange={(e) => setSelectedGradeId(e.target.value)}
    disabled={busy || lockUI}
  >
    <option value="">— Select grade —</option>
    {gradeOptions.map(opt => (
      <option key={opt.id} value={opt.id}>{opt.label}</option>
    ))}
  </select>
  {submitted && !lockUI && !selectedGradeId && !isEditMode && (
    <div className="text-danger small mt-1">Please choose a grade.</div>
  )}
</div>


              {/* Sections (chips) */}
              <div className="col-12 col-lg-6">
                <div className="group-title">Sections</div>
                {!selectedGradeId ? (
                  <div className="small-muted">Select a grade to show sections.</div>
                ) : !selectedGrade || !selectedGrade.sections?.length ? (
                  <div className="small-muted">No sections for this grade.</div>
                ) : (
                  <div className="grid-2">
                    {selectedGrade.sections.map((s) => {
                      const selected = selectedSectionIds.has(String(s.section_id));
                      return (
                        <label
                          key={s.section_id}
                          className={`chip ${selected ? 'selected' : ''}`}
                          aria-pressed={selected}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input me-1"
                            checked={selected}
                            onChange={() => toggleSet(setSelectedSectionIds)(String(s.section_id))}
                            disabled={busy || lockUI}
                          />
                          {s.section_name}
                        </label>
                      );
                    })}
                  </div>
                )}
                {submitted && !lockUI && selectedSectionIds.size === 0 && !isEditMode && (
                  <div className="text-danger small mt-1">Pick at least one section.</div>
                )}
              </div>

              {/* Subjects (chips) */}
              <div className="col-12">
                <div className="group-title">Subjects</div>
                {!selectedGradeId ? (
                  <div className="small-muted">Select a grade to show subjects.</div>
                ) : !selectedGrade || !selectedGrade.subjects?.length ? (
                  <div className="small-muted">No subjects for this grade.</div>
                ) : availableSubjects.length === 0 ? (
                  <div className="small-muted">
                    All subjects are already assigned for the selected section(s) this active year.
                  </div>
                ) : (
                  <div className="grid-2">
                    {availableSubjects.map((s) => {
                      const selected = selectedSubjectIds.has(String(s.subject_id));
                      return (
                        <label
                          key={s.subject_id}
                          className={`chip ${selected ? 'selected' : ''}`}
                          aria-pressed={selected}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input me-1"
                            checked={selected}
                            onChange={() => toggleSet(setSelectedSubjectIds)(String(s.subject_id))}
                            disabled={busy || lockUI}
                          />
                          {s.subject_code} — {s.subject_name}
                        </label>
                      );
                    })}
                  </div>
                )}
                {submitted && !lockUI && selectedSubjectIds.size === 0 && !isEditMode && (
                  <div className="text-danger small mt-1">Pick at least one subject.</div>
                )}
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-outline-secondary btn-icon" onClick={onReset} disabled={busy}>
                <FaUndo /> Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-icon"
                disabled={busy || lockUI || !syReady}
                title={!syReady ? 'Loading active school year…' : (lockUI ? 'Select a teacher first' : 'Save')}
              >
                {busy && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
                <FaSave /> {isEditMode ? 'Update Assignment' : 'Save Assignments'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table — Current subjects for selected teacher (Active Year) */}
      {form.teacher_id && (
        <div className="card shadow-sm">
          <div className="card-header bg-white px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 className="mb-0 fw-semibold">
                {selectedTeacherName
                  ? `${selectedTeacherName} — Current Subjects (Active Year)`
                  : 'Current Subjects (Active Year)'}
              </h6>
              <div className="text-muted small">
                {teacherSubsLoading
                  ? 'Loading assignments…'
                  : teacherSubs.length
                  ? `Showing ${rangeStart}–${rangeEnd} of ${teacherSubs.length} assignment${teacherSubs.length > 1 ? 's' : ''}`
                  : 'No current subjects for this teacher.'}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 ms-auto">
              {teacherSubs.length > 0 && (
                <>
                  <span className="text-muted small">Rows</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 90 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </>
              )}

              {teacherSubs.length > pageSize && (
                <nav aria-label="Teacher subjects pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(1)} aria-label="First">
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous">
                        <FaChevronLeft />
                      </button>
                    </li>
                    {buildPageList(page, totalPages).map((p, idx) =>
                      typeof p === 'string' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={`pg-${p}`} className={`page-item ${p === page ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                        </li>
                      )
                    )}
                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next">
                        <FaChevronRight />
                      </button>
                    </li>
                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(totalPages)} aria-label="Last">
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}

              <button
                className="btn btn-outline-secondary btn-sm btn-icon"
                onClick={() => fetchTeacherSubjects(form.teacher_id)}
                disabled={teacherSubsLoading}
              >
                <FaSyncAlt /> {teacherSubsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {teacherSubsLoading ? (
            <div className="p-3">
              <div className="placeholder-glow">
                {[...Array(4)].map((_, i) => (
                  <p key={i} className="placeholder col-12 mb-2" style={{ height: 18 }} />
                ))}
              </div>
            </div>
          ) : teacherSubs.length === 0 ? (
            <div className="p-4 text-center text-muted small">No records to display.</div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '60vh' }}>
              <table className="table table-sm align-middle mb-0 table-hover table-striped">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 160 }}>Subject</th>
                    <th style={{ minWidth: 140 }}>Section</th>
                    <th style={{ width: 120 }}>Grade</th>
                    <th style={{ width: 140 }}>School Year</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubs.map((a) => (
                    <tr key={`teach-sub-${a.assignment_id}`}>
                      <td className="text-wrap">
                        <div className="fw-medium">{a.subject_code}</div>
                        <div className="small text-muted">{a.subject_name}</div>
                      </td>
                      <td className="text-wrap">{a.section_name}</td>
                      <td>{a.grade_name}</td>
                      <td>{a.school_year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

// Small helper to build a compact page list with ellipses
function buildPageList(page, totalPages) {
  const pages = [];
  const maxToShow = 7;

  if (totalPages <= maxToShow) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  const showAround = 1;
  const start = Math.max(2, page - showAround);
  const end = Math.min(totalPages - 1, page + showAround);

  pages.push(1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);

  return pages;
}

export default TeacherAssignmentForm;
