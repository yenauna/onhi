// 읽기: { s:"d"|"p"|"e"|"", du:"YYYY-MM-DD"|null, note:"" }  (없으면 null)
function getStatusFor(name, uid){
  const s = getDoneStore(name);
  const v = s[uid];
  if (v === true) return { s:'d', du:null, note:'' }; // 하위호환(true = done)
  if (!v) return null;                                // pending
  const st = { s:'', du:null, note:'' , ...v };
  return st;
}

// 쓰기(부분 업데이트 허용)
function setStatusFor(name, uid, patch){
  const s = getDoneStore(name);
  const cur = getStatusFor(name, uid) || { s:'', du:null, note:'' };
  s[uid] = { ...cur, ...patch };
  setDoneStore(name, s);
}

// 단축: 상태 설정
function setDone(name, uid, done){
  setStatusFor(name, uid, { s: done ? 'd' : '' , du: done ? null : null });
}
// 단축: 면제
function setExempt(name, uid, note=''){
  setStatusFor(name, uid, { s:'e', du:null, note: String(note||'') });
}
// 단축: 미룸
function setPostponed(name, uid, newDate /*"YYYY-MM-DD"*/){
  setStatusFor(name, uid, { s:'p', du: newDate || null });
}

/* ====== 공통 헬퍼들을 전역(window)에 노출 ====== */
(function (w) {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const toDateStrict = (value) => {
    if (value instanceof Date) {
      const d = new Date(value.getTime());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const da = Number(m[3]);
        return new Date(y, mo, da);
      }
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatKoreanDate = (value) => {
    const d = toDateStrict(value);
    if (!d) return value == null ? '' : String(value);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const day = dayNames[d.getDay()];
    return `${month}월 ${date}일 (${day})`;
  };
  
  const escapeHTML = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const getJSON = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const setJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const CLOUD_SYNC_TABLES = ['onhi_shared_state', 'shared_state', 'app_state', 'onhi_app_state'];
  const CLOUD_SYNC_SHAPES = [
    { idCol: 'id', dataCol: 'payload' },
    { idCol: 'key', dataCol: 'value' },
    { idCol: 'name', dataCol: 'data' },
  ];
  const CLOUD_SYNC_ROW_ID = 'global';
  const CLOUD_SYNC_PREFIXES = ['doneTasks-', 'challengeStatus-', 'challengeProgress-'];
  const CLOUD_SYNC_KEYS = new Set(['tasksV2', 'challenges']);
  const CLOUD_SYNC_EVENT = 'onhi:cloud-sync-applied';
  const shouldCloudSync = (key) => {
    if (!key) return false;
    if (CLOUD_SYNC_KEYS.has(key)) return true;
    return CLOUD_SYNC_PREFIXES.some(prefix => key.startsWith(prefix));
  };

  let _cloudSyncSource = null;
  let _cloudSyncSnapshot = {};
  let _cloudSyncPendingTimer = null;
  let _cloudSyncReady = false;
  let _cloudSyncWriteMuted = false;

  const detectCloudSyncSource = async (client) => {
    if (_cloudSyncSource) return _cloudSyncSource;
    for (const table of CLOUD_SYNC_TABLES) {
      for (const shape of CLOUD_SYNC_SHAPES) {
        const selectCols = `${shape.idCol},${shape.dataCol}`;
        const { error } = await client.from(table).select(selectCols).limit(1);
        if (!error) {
          _cloudSyncSource = { table, ...shape };
          return _cloudSyncSource;
        }
      }
    }
    return null;
  };

  const readCloudSyncSnapshot = async () => {
    const client = await window.ensureSupabaseClient?.();
    if (!client) return null;
    const source = await detectCloudSyncSource(client);
    if (!source) return null;
    const { table, idCol, dataCol } = source;
    const { data, error } = await client
      .from(table)
      .select(`${idCol},${dataCol}`)
      .eq(idCol, CLOUD_SYNC_ROW_ID)
      .maybeSingle();
    if (error) return null;
    const payload = data?.[dataCol];
    return payload && typeof payload === 'object' ? payload : {};
  };

  const collectLocalCloudSyncState = () => {
    const payload = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!shouldCloudSync(key)) continue;
      try {
        payload[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        payload[key] = localStorage.getItem(key);
      }
    }
    return payload;
  };

  const saveCloudSyncSnapshot = async (payload) => {
    const client = await window.ensureSupabaseClient?.();
    if (!client) return false;
    const source = await detectCloudSyncSource(client);
    if (!source) return false;
    const { table, idCol, dataCol } = source;
    const row = { [idCol]: CLOUD_SYNC_ROW_ID, [dataCol]: payload || {} };
    const { error } = await client.from(table).upsert(row, { onConflict: idCol });
    return !error;
  };

  const queueCloudSyncPush = () => {
    if (!_cloudSyncReady || _cloudSyncWriteMuted) return;
    if (_cloudSyncPendingTimer) clearTimeout(_cloudSyncPendingTimer);
    _cloudSyncPendingTimer = setTimeout(async () => {
      _cloudSyncPendingTimer = null;
      const snapshot = collectLocalCloudSyncState();
      const ok = await saveCloudSyncSnapshot(snapshot);
      if (ok) _cloudSyncSnapshot = { ...snapshot };
    }, 250);
  };

  const applyCloudSyncSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    _cloudSyncWriteMuted = true;
    try {
      Object.entries(snapshot).forEach(([key, value]) => {
        if (!shouldCloudSync(key)) return;
        localStorage.setItem(key, JSON.stringify(value));
      });
    } finally {
      _cloudSyncWriteMuted = false;
    }
    window.dispatchEvent(new Event(CLOUD_SYNC_EVENT));
  };

  const initCloudStorageSync = async () => {
    const snapshot = await readCloudSyncSnapshot();
    _cloudSyncReady = true;
    if (snapshot && Object.keys(snapshot).length > 0) {
      _cloudSyncSnapshot = { ...snapshot };
      applyCloudSyncSnapshot(snapshot);
      return;
    }
    const local = collectLocalCloudSyncState();
    if (Object.keys(local).length > 0) {
      const ok = await saveCloudSyncSnapshot(local);
      if (ok) _cloudSyncSnapshot = { ...local };
    }
  };

  if (!window.__onhiCloudSyncPatched) {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      originalSetItem(key, value);
      if (shouldCloudSync(key)) queueCloudSyncPush();
    };
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      if (shouldCloudSync(key)) queueCloudSyncPush();
    };
    window.__onhiCloudSyncPatched = true;
  }

  initCloudStorageSync();
  
  function getDoneStore(name){ return getJSON('doneTasks-'+name, {}) || {}; }
  function setDoneStore(name, obj){ setJSON('doneTasks-'+name, obj || {}); }

  // 날짜 00:00으로 정규화
  const normalizeDate = (d) => { const t = new Date(d); t.setHours(0,0,0,0); return t; };

  // students 캐시
  let _studentsCache = null;
  let _studentSource = null;
  const STUDENT_TABLE_CANDIDATES = ['students', 'student', 'student_directory', 'onhi_students'];

  const isRlsError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('permission denied') || message.includes('row-level security') || message.includes('rls');
  };
  const normalizeStudentsList = (value) => {
    const list = Array.isArray(value) ? value : [];
    return {
      list: list.map((stu) => {
        const id = stu?.student_no ?? stu?.student_id ?? stu?.no ?? stu?.id ?? '';
        const name = stu?.name ?? stu?.student_name ?? '';
        const password = stu?.password ?? stu?.student_password ?? stu?.pw ?? '';
         const joined = stu?.joined_date ?? stu?.joined ?? stu?.created_at ?? null;
        const gender = stu?.gender === '여자' ? '여자' : '남자';
        return { ...stu, id: String(id), name: String(name), password: String(password), joined, gender };
      }),
    };
  };

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  
  const detectStudentSource = async (client) => {
    if (_studentSource) return _studentSource;

    for (const table of STUDENT_TABLE_CANDIDATES) {
      const { data, error } = await client.from(table).select('*').limit(1);
      console.log('[Students][probe] table check:', { table, data, error });
    
    if (error) {
        if (isRlsError(error)) {
          console.error('[Students][probe] RLS 정책 필요 (select)', { table, error });
        }
        continue;
      }

       _studentSource = {
        table,
        columns: Object.keys(data?.[0] || {}),
      };
      console.log('[Students][probe] detected source:', _studentSource);
      return _studentSource;
    }

    console.error('[Students] 학생 테이블 탐지 실패. 후보 테이블을 확인하세요:', STUDENT_TABLE_CANDIDATES);
    return null;
  };

  const loadStudentsCached = async () => {
    console.log('[Students] loadStudents() start');

  if (_studentsCache) {
      console.log('[Students] loadStudents() cache hit', { rows: _studentsCache.length });
      return _studentsCache;
    }

  const client = await window.ensureSupabaseClient?.();
    if (!client) {
      console.error('[Students] Supabase client unavailable. URL/KEY 값을 확인하세요.');
      _studentsCache = [];
      return _studentsCache;
    }

    const source = await detectStudentSource(client);
    if (!source) {
      _studentsCache = [];
      return _studentsCache;
    }

  const { data, error } = await client.from(source.table).select('*');
    console.log('[Students] loadStudents() raw result:', { table: source.table, data, error });

    if (error) {
      if (isRlsError(error)) {
        console.error('[Students] RLS 정책 필요: students select 권한이 없습니다.', error);
      }
      _studentsCache = [];
      return _studentsCache;
    }

    const { list } = normalizeStudentsList(data || []);
    _studentsCache = list;
    console.log('[Students] loadStudents() end', { rows: _studentsCache.length });
    return _studentsCache;
  };

  const invalidateStudentsCache = () => {
    _studentsCache = null;
  };

  const loadStudents = async () => (await loadStudentsCached()).map(stu => ({ ...stu }));

  const sortStudents = (list = []) => {
    const students = Array.isArray(list) ? list.slice() : [];
    return students.sort((a, b) => {
      const aId = String(a?.id ?? '');
      const bId = String(b?.id ?? '');
      const aNum = Number(aId);
      const bNum = Number(bId);
      const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);

      if (bothNumeric && aNum !== bNum) return aNum - bNum;
      if (aId !== bId) return aId.localeCompare(bId, 'ko');

      const aName = String(a?.name ?? '');
      const bName = String(b?.name ?? '');
      return aName.localeCompare(bName, 'ko');
    });
  };
  
  const addStudentToSupabase = async (student) => {
    const client = await window.ensureSupabaseClient?.();
    if (!client) {
      console.error('[Students] addStudent() failed: Supabase client unavailable');
      return { data: null, error: new Error('Supabase client unavailable') };
    }

    const source = await detectStudentSource(client);
    if (!source) {
      return { data: null, error: new Error('Student table not found') };
    }

    const base = {
      id: isUuid(student.id) ? student.id : undefined,
      student_no: student.id,
      name: student.name,
      student_name: student.name,
      password: student.password,
      student_password: student.password,
      gender: student.gender,
      created_at: student.joined,
      joined_date: student.joined,
      joined: student.joined,
    };

    const payload = Object.fromEntries(
      Object.entries(base).filter(([key, value]) => {
        if (value == null || value === '') return false;
        if (source.columns.length === 0) return ['id', 'student_no', 'name', 'password', 'gender'].includes(key);
        return source.columns.includes(key);
      })
    );

    const insertPayload = Object.keys(payload).length ? payload : { name: student.name };
    console.log('[Students] addStudent() insert attempt:', { table: source.table, insertPayload });

    const { data, error } = await client.from(source.table).insert(insertPayload).select('*').maybeSingle();
    if (error) {
      if (isRlsError(error)) {
        console.error('[Students] RLS 정책 필요: students insert 권한이 없습니다.', error);
      }
      console.error('[Students] addStudent() failed:', error);
      return { data: null, error };
    }

    invalidateStudentsCache();
    console.log('[Students] addStudent() success:', data);
    return { data, error: null };
  };
   
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
  
  // 전역으로 노출
  Object.assign(w, {
    qs, qsa, pad2, dayNames, escapeHTML,
    toDateStrict, formatKoreanDate,
    getJSON, setJSON, normalizeDate,
    getDoneStore, setDoneStore,
    loadStudentsCached, invalidateStudentsCache, loadStudents, addStudentToSupabase, sortStudents, loadAllTeacherTasks,
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
  btn.innerHTML = isEdit ? '편집<br>가능' : '읽기<br>전용';
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

const COMPACT_PREF_KEY = 'compactView';

function applyCompactMode(opts = {}){
  let pref = localStorage.getItem(COMPACT_PREF_KEY);
  if (pref !== 'yes' && pref !== 'no') {
    pref = 'no';
    localStorage.setItem(COMPACT_PREF_KEY, pref);
  }
  const enabled = pref === 'yes';
  document.body.classList.toggle('compact-view', enabled);

  const btn = document.getElementById('compactBtn');
  if (btn) {
    btn.innerHTML = enabled ? '기본<br>크기' : '작게<br>보기';
    btn.setAttribute('aria-pressed', String(enabled));
  }

  if (opts.refresh) {
    if (document.getElementById('board') && typeof window.renderBoard === 'function') window.renderBoard();
    if (document.getElementById('student-status-list') && typeof window.renderStudentStatus === 'function') window.renderStudentStatus();
  }
}

function toggleCompactMode(){
  const enabled = localStorage.getItem(COMPACT_PREF_KEY) === 'yes';
  localStorage.setItem(COMPACT_PREF_KEY, enabled ? 'no' : 'yes');
  applyCompactMode({ refresh: true });
}

/* 초기화 */
window.addEventListener('load', ()=>{
  if (!localStorage.getItem('boardMode')) localStorage.setItem('boardMode','view');
  applyBoardModeToButton();
  applyCompactMode();
  const mb = document.getElementById('modeBtn');
  // 교사 페이지에서만 모드 전환 허용
  if (mb && document.body.dataset.role === 'teacher') mb.addEventListener('click', toggleBoardMode);
  const cb = document.getElementById('compactBtn');
  if (cb) cb.addEventListener('click', toggleCompactMode);
});

window.addEventListener('storage', (e) => {
  if (e.key === COMPACT_PREF_KEY) applyCompactMode({ refresh: true });
});
