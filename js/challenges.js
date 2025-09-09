/* /js/challenges.js
Challenge management helpers for teacher and student pages.
Uses localStorage via helper functions from common.js.
*/
(function(){
  const STORAGE_KEY = 'challenges';

  function genId(){
    return 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  
  function getChallenges(){
    return getJSON(STORAGE_KEY, []);
  }
  function setChallenges(list){
    setJSON(STORAGE_KEY, Array.isArray(list) ? list : []);
  }
  function upsertChallenge(ch){
    const list = getChallenges();
    const idx = list.findIndex(c => c.id === ch.id);
    if (idx >= 0) list[idx] = ch; else list.push(ch);
    setChallenges(list);
  }
  function deleteChallenge(id){
    setChallenges(getChallenges().filter(c => c.id !== id));
  }
  
  function listAssignedChallenges(student){
    return getChallenges().filter(c => {
      if (!c.active) return false;
      const roster = c.students || [];
      return roster.includes('전체') || roster.includes(student);
    });
  }

  function getChallengeStatusFor(student, id){
    const map = getJSON('challengeStatus-' + student, {}) || {};
    return map[id] || null; // {s:'d', ts:...}
  }
  function setChallengeDone(student, id, done){
    const map = getJSON('challengeStatus-' + student, {}) || {};
    if (done) map[id] = { s: 'd', ts: new Date().toISOString() }; else delete map[id];
    setJSON('challengeStatus-' + student, map);
  }


  function renderChallengesForStudent(student){
    const cont = document.getElementById('challenges-container');
    if (!cont) return;
    cont.innerHTML = '';
    const list = listAssignedChallenges(student);
    if (list.length === 0){
      const p = document.createElement('p');
      p.style.color = '#667085';
      p.style.textAlign = 'center';
      p.textContent = '도전이 없습니다.';
      cont.appendChild(p);
      return;
    }

    list.forEach(ch => {
      const status = getChallengeStatusFor(student, ch.id);
      const doneSimple = status && status.s === 'd'; // (구형) 단일 완료
      const steps = Array.isArray(ch.steps) ? ch.steps : [];
      const max = steps.length; // 단계 수
      const prog = getChallengeProgressFor(student, ch.id);
      const curr = Math.min(prog.step || 0, max); // 0~max

      const done = max > 0 ? (curr >= max) : doneSimple;

      const card = document.createElement('div');
      card.className = 'challenge-card' + (done ? ' done' : '');

      // 진행률 바용 CSS 변수
      const pct = max > 0 ? Math.round((curr / max) * 100) : (done ? 100 : 0);
      card.style.setProperty('--prog', pct + '%');

      // 본문
      const title = `<div class="ch-title">${escapeHTML(ch.title || '')}</div>`;
      const desc  = ch.desc ? `<div class="ch-desc">${escapeHTML(ch.desc)}</div>` : '';

      let stateHTML = '';
      if (max > 0){
        const nowLabel   = (curr === 0) ? '미시작' : `${curr}단계`;
        const nextTarget = (curr < max) ? escapeHTML(steps[curr] || '') : '모든 단계 완료!';
        stateHTML =
          `<div class="ch-state">
          <div>진행: ${nowLabel} / 총 ${max}단계 (${pct}%)</div>
          <div style="font-size:12px;color:#667085;margin-top:4px;">
          ${curr < max ? '다음 목표: ' + nextTarget : '훌륭해요! 🎉'}
          </div>
          </div>`;
      } else {
        stateHTML = `<div class="ch-state">${done ? '✅ 완료' : '⭕ 미완료'}</div>`;
      }

      card.innerHTML = title + desc + stateHTML;

      // 동작: 단계형이면 클릭=+1, 마지막에서 더 누르면 그대로(최대치 유지)
      card.onclick = () => {
        if (max > 0){
          incChallengeProgress(student, ch.id, max);
        } else {
          setChallengeDone(student, ch.id, !doneSimple);
        }
        renderChallengesForStudent(student);
      };
      cont.appendChild(card);
    });
  }


  function renderChallengeList(){
    const box = document.getElementById('challenge-list');
    if (!box) return;
    const keyword = (document.getElementById('chl-search')?.value || '').trim();
    box.innerHTML = '';
    getChallenges().filter(ch => {
      if (!keyword) return true;
      const txt = (ch.title || '') + ' ' + (ch.desc || '');
      return txt.includes(keyword);
    }).forEach(ch => {
      const item = document.createElement('div');
      item.className = 'chl-item' + (ch.active ? '' : ' inactive');
      const left = document.createElement('div');
      left.style.flex = '1';
      left.innerHTML = `<div class="chl-title">${escapeHTML(ch.title || '(제목 없음)')}</div>` +
        (ch.desc ? `<div class="chl-desc" style="font-size:14px;color:#475467;">${escapeHTML(ch.desc)}</div>` : '');
      const right = document.createElement('div');
      right.style.display = 'flex'
        right.style.gap = '4px';
      const editBtn = document.createElement('button');
      editBtn.textContent = '편집';
      editBtn.onclick = () => openChallengeForm(ch.id);
      const statusBtn = document.createElement('button');
      statusBtn.textContent = '상태';
      statusBtn.onclick = () => openChallengeStatus(ch.id);
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.onclick = () => {
        if (confirm('삭제할까요?')) {
          deleteChallenge(ch.id);
          renderChallengeList();
        }
      };
      right.append(editBtn, statusBtn, delBtn);
      item.append(left, right);
      box.appendChild(item);
    });
  }

  function openChallengeForm(id){
    const listView = document.getElementById('challenge-list-view');
    const formView = document.getElementById('challenge-form');
    const statusView = document.getElementById('challenge-status-view');
    if (listView) listView.style.display = 'none';
    if (statusView) statusView.style.display = 'none';
    if (formView) formView.style.display = 'block';
    
    const titleInput = document.getElementById('chf-title');
    const descInput = document.getElementById('chf-desc');
    const activeInput = document.getElementById('chf-active');
    const select = document.getElementById('chf-students');

    const stepsInput = document.getElementById('chf-steps');
    if (id){
      const ch = getChallenges().find(c => c.id === id) || {};
      // ... (기존 title/desc/active/students 채우는 코드 뒤에)
      const lines = Array.isArray(ch.steps) ? ch.steps : [];
      stepsInput.value = lines.join('\n');  // 한 줄에 하나
    } else {
      stepsInput.value = '';
    }

    // populate student options
    const students = loadStudents();
    select.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '전체';
    optAll.textContent = '전체';
    select.appendChild(optAll);
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      select.appendChild(opt);
    });

    if (id){
      const ch = getChallenges().find(c => c.id === id) || {};
      formView.dataset.id = id;
      titleInput.value = ch.title || '';
      descInput.value = ch.desc || '';
      activeInput.checked = ch.active !== false;
      const roster = ch.students || ['전체'];
      Array.from(select.options).forEach(o => { o.selected = roster.includes(o.value); });
    } else {
      formView.dataset.id = '';
      titleInput.value = '';
      descInput.value = '';
      activeInput.checked = true;
      Array.from(select.options).forEach(o => { o.selected = false; });
    }
  }

  function saveChallengeFromForm(){
    const formView = document.getElementById('challenge-form');
    const id = formView.dataset.id || null;
    const title = document.getElementById('chf-title').value.trim();
    const desc = document.getElementById('chf-desc').value.trim();
    const active = document.getElementById('chf-active').checked;
    const select = document.getElementById('chf-students');
    const students = Array.from(select.selectedOptions).map(o => o.value);
    const ch = { id: id || genId(), title, desc, active, students: students.length ? students : ['전체'] }; steps
    upsertChallenge(ch);
    cancelChallengeForm();
    renderChallengeList();
  }

  // --- [추가] 학생별 도전 진행도 저장소 ---
  // 구조: localStorage['challengeProgress-학생'] = { [challengeId]: { step:number, ts:string } }
  function getChallengeProgressFor(student, id){
    const map = getJSON('challengeProgress-' + student, {}) || {};
    return map[id] || { step: 0, ts: null }; // step: 0은 미시작
  }
  function setChallengeProgress(student, id, step){
    const map = getJSON('challengeProgress-' + student, {}) || {};
    map[id] = { step: Math.max(0, step), ts: new Date().toISOString() };
    setJSON('challengeProgress-' + student, map);
  }
  function incChallengeProgress(student, id, maxSteps){
    const curr = getChallengeProgressFor(student, id).step || 0;
    const next = Math.min(curr + 1, maxSteps); // 최대 m단계
    setChallengeProgress(student, id, next);
  }
  function decChallengeProgress(student, id){
    const curr = getChallengeProgressFor(student, id).step || 0;
    const next = Math.max(curr - 1, 0);
    setChallengeProgress(student, id, next);
  }


  function cancelChallengeForm(){
    const listView = document.getElementById('challenge-list-view');
    const formView = document.getElementById('challenge-form');
    const statusView = document.getElementById('challenge-status-view');
    if (formView) formView.style.display = 'none';
    if (statusView) statusView.style.display = 'none';
    if (listView) listView.style.display = 'block';
    if (formView) formView.dataset.id = '';
  }

  function openChallengeStatus(id){
  const listView = document.getElementById('challenge-list-view');
  const formView = document.getElementById('challenge-form');
  const statusView = document.getElementById('challenge-status-view');
  if(listView) listView.style.display='none';
  if(formView) formView.style.display='none';
  if(statusView) statusView.style.display='block';

  const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
  statusView.dataset.id = id;
  statusView.querySelector('.st-ch-title').textContent = ch.title || '(제목 없음)';
  statusView.querySelector('.st-ch-active').textContent = ch.active? '활성(ON)' : '비활성(OFF)';

  const tbody = statusView.querySelector('tbody');
  tbody.innerHTML='';

  // ★ 단계 정보
  const steps = Array.isArray(ch.steps) ? ch.steps : [];
  const max = steps.length; // 0이면 기존(단일 완료) 방식

  // 대상 학생
  const roster = (ch.students && !ch.students.includes('전체'))
    ? ch.students
    : loadStudents().map(s=>s.name);

  roster.forEach(name=>{
    // 기존(단일 완료) 상태
    const m = getJSON('challengeStatus-'+name, {}) || {};
    const doneSimple = m[id]?.s === 'd';

    // 단계형 진행도
    const prog = (typeof getChallengeProgressFor === 'function')
      ? getChallengeProgressFor(name, id)
      : { step: 0, ts: null };

    const curr = Math.min(Math.max(prog.step || 0, 0), max); // 0~max
    const done = max > 0 ? (curr >= max) : doneSimple;

    const tr = document.createElement('tr');

    // 상태 셀
    let stateCellHTML = '';
    if (max > 0){
      const nowLabel = curr === 0 ? '미시작' : `${curr}단계`;
      stateCellHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${nowLabel} / 총 ${max}단계</span>
          <div style="display:inline-flex;gap:4px;">
            <button class="dec">−</button>
            <button class="inc">＋</button>
            <button class="to-max">모두완료</button>
            <button class="to-zero">초기화</button>
          </div>
        </div>`;
    } else {
      stateCellHTML = done ? '✅ 완료' : '⭕ 미완료';
    }

    tr.innerHTML = `
      <td>${escapeHTML(name)}</td>
      <td class="st">${stateCellHTML}</td>
      <td>
        ${max > 0
          ? `<span class="muted">단계형</span>`
          : `<button class="toggle">토글</button>`}
      </td>`;

    // 🔘 버튼 바인딩
    if (max > 0){
      tr.querySelector('.inc').onclick = ()=>{
        if (typeof incChallengeProgress === 'function') {
          incChallengeProgress(name, id, max);
        } else if (typeof setChallengeProgress === 'function') {
          // fallback
          const next = Math.min(curr+1, max);
          setChallengeProgress(name, id, next);
        }
        openChallengeStatus(id);
      };
      tr.querySelector('.dec').onclick = ()=>{
        if (typeof decChallengeProgress === 'function') {
          decChallengeProgress(name, id);
        } else if (typeof setChallengeProgress === 'function') {
          // fallback
          const next = Math.max(curr-1, 0);
          setChallengeProgress(name, id, next);
        }
        openChallengeStatus(id);
      };
      tr.querySelector('.to-max').onclick = ()=>{
        if (typeof setChallengeProgress === 'function') setChallengeProgress(name, id, max);
        openChallengeStatus(id);
      };
      tr.querySelector('.to-zero').onclick = ()=>{
        if (typeof setChallengeProgress === 'function') setChallengeProgress(name, id, 0);
        openChallengeStatus(id);
      };
    } else {
      tr.querySelector('.toggle').onclick = ()=>{
        const mm = getJSON('challengeStatus-'+name, {}) || {};
        if(done) delete mm[id]; else mm[id]={s:'d', ts:new Date().toISOString()};
        setJSON('challengeStatus-'+name, mm);
        openChallengeStatus(id);
      };
    }

    tbody.appendChild(tr);
  });
}

  function bulkMarkStatus(done){
    const id = document.getElementById('challenge-status-view').dataset.id;
    const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
    const steps = Array.isArray(ch.steps) ? ch.steps : [];
    const max = steps.length;

    const roster = (ch.students && !ch.students.includes('전체'))
      ? ch.students : loadStudents().map(s=>s.name);

    roster.forEach(name=>{
      if (max > 0){
        setChallengeProgress(name, id, done ? max : 0);
      } else {
        const m = getJSON('challengeStatus-'+name, {}) || {};
        if(done) m[id]={s:'d', ts:new Date().toISOString()}; else delete m[id];
        setJSON('challengeStatus-'+name, m);
      }
    });
    openChallengeStatus(id);
  }
  
  function backToListFromStatus(){
    const statusView = document.getElementById('challenge-status-view');
    const listView = document.getElementById('challenge-list-view');
    if(statusView) statusView.style.display='none';
    if(listView) listView.style.display='block';
    renderChallengeList();
  }

  // 공개 API
  window.Challenges = {
    // 저장/조회
    getChallenges, setChallenges, upsertChallenge, deleteChallenge,
    listAssignedChallenges, getChallengeStatusFor, setChallengeDone,
    // 학생
    renderChallengesForStudent,
    // 교사
    renderChallengeList, openChallengeForm, saveChallengeFromForm, cancelChallengeForm,
    openChallengeStatus, bulkMarkStatus, backToListFromStatus,
  };
})();
