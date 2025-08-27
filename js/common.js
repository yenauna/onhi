/* ====== 공통 헬퍼들을 전역(window)에 노출 ====== */
(function (w) {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const escapeHTML = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // DOM 헬퍼
  const qs = (sel, root=document) => root.querySelector(sel);

  const getJSON = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const setJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // 날짜 00:00으로 정규화
  const normalizeDate = (d) => { const t = new Date(d); t.setHours(0,0,0,0); return t; };

  // students 캐시
  let _studentsCache = null;
  const loadStudentsCached = () => (_studentsCache ?? (_studentsCache = getJSON('students', [])));
  const invalidateStudentsCache = () => { _studentsCache = null; };

  // teacherTasks-* 전부 로드
  const loadAllTeacherTasks = () => {
    const res = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith('teacherTasks-')) continue;
      const data = getJSON(key, null);
      if (!data) continue;
      res.push({ key, dateKey: key.slice('teacherTasks-'.length), data });
    }
    return res;
  };

  // 전역으로 노출
  Object.assign(w, {
    qs, qsa, pad2, dayNames, escapeHTML,
    getJSON, setJSON, normalizeDate,
    loadStudentsCached, invalidateStudentsCache, loadAllTeacherTasks
  });
})(window);

/* ====== 상단 탭 활성화 ====== */
function makeActiveById(id){
  document.querySelectorAll('.menu-area button, .menu button').forEach(b=>{
    b.classList.toggle('active', b.id === id);
  });
}

/* ====== 조회 모드 버튼 (있을 때만 동작) ====== */
function applyBoardModeToButton(){
  const btn = document.getElementById('modeBtn');
  if (!btn) return;
  const mode = localStorage.getItem('boardMode') === 'edit' ? 'edit' : 'view';
  const isEdit = mode === 'edit';
  btn.textContent = isEdit ? '편집전용' : '보기전용';
  btn.setAttribute('aria-pressed', String(isEdit));
  btn.classList.toggle('is-edit', isEdit);
}
function toggleBoardMode(){
  const cur = localStorage.getItem('boardMode') === 'edit' ? 'edit' : 'view';
  const next = cur === 'edit' ? 'view' : 'edit';
  localStorage.setItem('boardMode', next);
  applyBoardModeToButton();
}

/* 초기화 */
window.addEventListener('load', ()=>{
  if (!localStorage.getItem('boardMode')) localStorage.setItem('boardMode','view');
  applyBoardModeToButton();
  const mb = document.getElementById('modeBtn');
  if (mb) mb.addEventListener('click', toggleBoardMode);
});
