/* ====== 공통 헬퍼들을 전역(window)에 노출 ====== */
(function (w) {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const escapeHTML = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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

  // === 공휴일 로딩 & 캐시 ===
  async function ensureHolidays(year, country = 'KR') {
    const cacheKey = `holidays:${country}:${year}`;
    const cached = getJSON(cacheKey, null);
    if (cached) return cached; // { "YYYY-MM-DD": "설날" ... }
    
    // CORS 허용되는 퍼블릭 API 예시 (Nager.Date)
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`;
    const res = await fetch(url);
    if (!res.ok) return {}; // 실패 시 빈 객체
    const list = await res.json();
    // YYYY-MM-DD => 이름 맵으로 변환
    const map = {};
    list.forEach(h => {
      // h.date 형식: "2025-09-15"
      map[h.date] = h.localName || h.name;
    });
    setJSON(cacheKey, map);
    return map;
  }


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

async function ensureHolidays(year, country='KR'){
  const key = `holidays-${country}-${year}`;
  let map = getJSON(key, null);
  if (map) return map;

  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('holiday fetch failed');
    const arr = await res.json(); // [{ date: '2025-01-01', localName: '신정', ... }, ...]
    map = {};
    (arr || []).forEach(h => {
      // 날짜 형식은 YYYY-MM-DD 로 그대로 들어옵니다.
      map[h.date] = h.localName || h.name;
    });
    setJSON(key, map);
  }catch(e){
    console.warn('ensureHolidays error:', e);
    map = {}; // 실패해도 빈 맵 반환
  }
  return map;
}
