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
      const done = status && status.s === 'd';
      const card = document.createElement('div');
      card.className = 'challenge-card' + (done ? ' done' : '');
      card.innerHTML = `<div class="ch-title">${escapeHTML(ch.title || '')}</div>` +
        (ch.desc ? `<div class="ch-desc">${escapeHTML(ch.desc)}</div>` : '') +
        `<div class="ch-state">${done ? '✅ 완료' : '⭕ 미완료'}</div>`;
      card.onclick = () => {
        setChallengeDone(student, ch.id, !done);
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
    const ch = { id: id || genId(), title, desc, active, students: students.length ? students : ['전체'] };
    upsertChallenge(ch);
    cancelChallengeForm();
    renderChallengeList();
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

    const roster = (ch.students && !ch.students.includes('전체')) ? ch.students : loadStudents().map(s=>s.name);
    roster.forEach(name=>{
      const m = getJSON('challengeStatus-'+name, {}) || {};
      const done = m[id]?.s === 'd';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHTML(name)}</td><td class="st">${done?'✅ 완료':'⭕ 미완료'}</td><td><button class="toggle">토글</button></td>`;
      tr.querySelector('.toggle').onclick = ()=>{
        const mm = getJSON('challengeStatus-'+name, {}) || {};
        if(done) delete mm[id]; else mm[id]={s:'d', ts:new Date().toISOString()};
        setJSON('challengeStatus-'+name, mm);
        openChallengeStatus(id);
      };
      tbody.appendChild(tr);
    });
  }

  function bulkMarkStatus(done){
    const id = document.getElementById('challenge-status-view').dataset.id;
    const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
    const roster = (ch.students && !ch.students.includes('전체')) ? ch.students : loadStudents().map(s=>s.name);
    roster.forEach(name=>{
      const m = getJSON('challengeStatus-'+name, {}) || {};
      if(done) m[id]={s:'d', ts:new Date().toISOString()}; else delete m[id];
      setJSON('challengeStatus-'+name, m);
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
