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

    // === UID/V2 저장소 유틸 ===
  // 개별 과제에 고유 ID를 부여하고, 모든 과제를 하나의 배열 키로 저장
  function genUID() {
    const ts  = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 10);
    return `t_${ts}_${rnd}`;
  }

  // V2 저장 키: teacherTasksV2
  // 구조: [{ id, date:'YYYY-MM-DD', text, repeat:'none'|'daily'|'mon'..'fri', students:['전체']|['이름',...]}]
  function getTasks(){
    return getJSON('tasksV2', []); // [{ id, date, text, repeat, students, type, desc, repeatStart, repeatEnd }]
  }
  function setTasks(arr){
    setJSON('tasksV2', Array.isArray(arr) ? arr : []);
  }

  // (구버전 → V2) 1회 마이그레이션
  // - 기존 teacherTasks-YYYY-MM-DD 키들에서 과제들을 잘라 UID 부여 후 V2 배열로 옮김
  // - doneTasks-학생명 에 저장된 완료키(date@@text)를 UID로 치환
  // - 끝나면 구버전 키 삭제 + 플래그 기록
  function migrateToUIDOnce() {
    if (localStorage.getItem('teacherTasksMigrated') === 'yes') return;

    const v2 = getTasks();
    const old = [];
    // teacherTasks-YYYY-MM-DD 전부 수집
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('teacherTasks-')) {
        const data = getJSON(k, null);
        if (data && Array.isArray(data.tasks)) {
          old.push({ key: k, date: k.slice('teacherTasks-'.length), data });
        }
      }
    }

    if (old.length === 0) {
      localStorage.setItem('teacherTasksMigrated', 'yes');
      return;
    }

    // 1) V2로 옮기기
    const newTasks = [];
    old.forEach(({ date, data }) => {
      const { tasks = [], repeat = 'none', students = ['전체'] } = data;
      tasks.forEach(text => {
        newTasks.push({ id: genUID(), date, text, repeat, students: students.slice() });
      });
    });
    setTasks(v2.concat(newTasks));

    // 2) 완료 키(date@@text) → UID로 이관
    const indexByDateText = new Map(); // "YYYY-MM-DD@@text" -> id
    newTasks.forEach(t => indexByDateText.set(`${t.date}@@${t.text}`, t.id));

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('doneTasks-')) {
        const store = getJSON(k, {});
        let changed = false;
        Object.keys(store).forEach(oldKey => {
          if (oldKey.includes('@@')) {
            const uid = indexByDateText.get(oldKey);
            if (uid) {
              store[uid] = true;
              delete store[oldKey];
              changed = true;
            }
          }
        });
        if (changed) setJSON(k, store);
      }
    }

    // 3) 구버전 키들 삭제
    old.forEach(({ key }) => localStorage.removeItem(key));

    localStorage.setItem('teacherTasksMigrated', 'yes');
  }

  // 오늘 기준 해당 날짜에 t가 발생하는지
function occursOn(t, dateObj){
  const d0 = new Date(dateObj); d0.setHours(0,0,0,0);
  const y=d0.getFullYear(), m=d0.getMonth()+1, dd=d0.getDate();
  const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

  const s = t.repeatStart || t.date || "";
  const e = t.repeatEnd   || "";

  const inRange = (ds) => {
    if (s && ds < s) return false;
    if (e && ds > e) return false;
    return true;
  };

  const rpt = t.repeat || 'none';
  if (rpt === 'daily') return inRange(dateStr);

  const dayMap = { mon:1, tue:2, wed:3, thu:4, fri:5 };
  if (dayMap[rpt] != null) {
    if (!inRange(dateStr)) return false;
    return d0.getDay() === dayMap[rpt];
  }

  if (!t.date) return false;
  const base = new Date(t.date); base.setHours(0,0,0,0);
  return base.getTime() === d0.getTime();
}

// 공통 일정 스트립 렌더
// - containerId: 붙일 엘리먼트 id
// - options.editable: teacher(오늘 할 일)에서만 true
// - options.studentName: 학생 화면에서 필터가 필요하면 넘김(없으면 전체)
function renderEventsStrip(containerId, options={}){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';

  const tasks = (typeof getTasks === 'function') ? getTasks() : [];
  const today = new Date(); today.setHours(0,0,0,0);

  // 오늘 발생하는 'event'만
  let events = tasks.filter(t => t.type === 'event' && occursOn(t, today));

  // 학생 화면이라면 대상 필터 (일정이 '전체'만이라면 이 단계는 보통 그대로 통과)
  if (options.studentName){
    events = events.filter(t => (t.students||['전체']).includes('전체') ||
                                (t.students||[]).includes(options.studentName));
  }

  events.forEach(t=>{
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-icon">✨</div>
      <div class="event-body">
        <div class="event-title">${escapeHTML(t.text||'(제목 없음)')}</div>
        <div class="event-desc">${escapeHTML((t.desc||'').trim() || '설명 없음')}</div>
      </div>
    `;
    card.onclick = ()=>{
      if (options.editable){               // teacher: 간단 수정
        const all = getTasks();
        const idx = all.findIndex(x => x.id === t.id);
        if (idx < 0) return;
        const newText = prompt('일정 제목을 수정하세요:', all[idx].text||'');
        if (newText === null) return;
        const newDesc = prompt('일정 설명을 수정하세요:', all[idx].desc||'');
        all[idx] = { ...all[idx], text:newText.trim(), desc:(newDesc||'').trim(), type:'event' };
        setTasks(all);
        renderEventsStrip(containerId, options);
        // 달력/현황 갱신 훅이 있다면 호출
        if (typeof renderCalendar==='function') renderCalendar();
        if (typeof renderStudentStatus==='function') renderStudentStatus();
      } else {                              // index, student: 보기만
        alert(`📣 ${t.text}\n\n${(t.desc||'설명 없음')}`);
      }
    };
    wrap.appendChild(card);
  });

  // 오늘 일정이 없으면 비워둠
  // (필요하면 안내 문구 추가 가능)
}


  // 일정 발생 판단(폴백)
if (typeof occursOn !== 'function') {
  window.occursOn = function(t, dateObj){
    const d0 = new Date(dateObj); d0.setHours(0,0,0,0);
    const y=d0.getFullYear(), m=d0.getMonth()+1, dd=d0.getDate();
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    const s = t.repeatStart || t.date || "";
    const e = t.repeatEnd   || "";
    const inRange = (ds) => {
      if (s && ds < s) return false;
      if (e && ds > e) return false;
      return true;
    };
    const rpt = t.repeat || 'none';
    if (rpt === 'daily') return inRange(dateStr);
    const dayMap = { mon:1, tue:2, wed:3, thu:4, fri:5 };
    if (dayMap[rpt] != null){
      if (!inRange(dateStr)) return false;
      return d0.getDay() === dayMap[rpt];
    }
    if (!t.date) return false;
    const base = new Date(t.date); base.setHours(0,0,0,0);
    return base.getTime() === d0.getTime();
  };
}

// 일정 스트립 렌더(폴백)
if (typeof renderEventsStrip !== 'function') {
  window.renderEventsStrip = function(containerId, opts={}){
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const tasks = (typeof getTasks === 'function') ? getTasks() : [];
    const today = new Date(); today.setHours(0,0,0,0);
    let events = tasks.filter(t => t.type === 'event' && occursOn(t, today));
    if (opts.studentName){
      events = events.filter(t => (t.students||['전체']).includes('전체') ||
                                  (t.students||[]).includes(opts.studentName));
    }
    events.forEach(t=>{
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-icon">✨</div>
        <div class="event-body">
          <div class="event-title">${escapeHTML(t.text || '(제목 없음)')}</div>
          <div class="event-desc">${escapeHTML((t.desc||'').trim() || '설명 없음')}</div>
        </div>`;
      card.onclick = () => alert(`📣 ${t.text}\n\n${(t.desc||'설명 없음')}`);
      el.appendChild(card);
    });
  };
}




  
  // 전역으로 노출
  Object.assign(w, {
    qs, qsa, pad2, dayNames, escapeHTML,
    getJSON, setJSON, normalizeDate,
    loadStudentsCached, invalidateStudentsCache, loadAllTeacherTasks,
    ensureHolidays,
    genUID, getTasks, setTasks, migrateToUIDOnce,
    occursOn, renderEventsStrip,
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
  btn.textContent = isEdit ? '편집가능' : '보기전용';
  btn.setAttribute('aria-pressed', String(isEdit));
  btn.classList.toggle('is-edit', isEdit);
   // index 페이지에서는 버튼을 비활성화해 단순 표시만 한다
  btn.disabled = document.body.dataset.role !== 'teacher';
}
function toggleBoardMode(){
  const cur = localStorage.getItem('boardMode') === 'edit' ? 'edit' : 'view';
  const next = cur === 'edit' ? 'view' : 'edit';
  localStorage.setItem('boardMode', next);
  applyBoardModeToButton();
  if (typeof window.renderBoard === 'function') window.renderBoard();
}

/* 초기화 */
window.addEventListener('load', ()=>{
  if (!localStorage.getItem('boardMode')) localStorage.setItem('boardMode','view');
  applyBoardModeToButton();
  const mb = document.getElementById('modeBtn');
   // 교사 페이지에서만 모드 전환 허용
  if (mb && document.body.dataset.role === 'teacher') mb.addEventListener('click', toggleBoardMode);
});
