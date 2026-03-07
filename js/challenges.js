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

  async function loadAllStudentNames(){
    const students = await loadStudents();
    return students.map(s => s.name);
  }

  async function getStudentsSortedAsync(){
    if (typeof getStudentsSorted === 'function') {
      const maybe = getStudentsSorted();
      if (Array.isArray(maybe)) return maybe;
      if (maybe && typeof maybe.then === 'function') {
        const resolved = await maybe;
        return Array.isArray(resolved) ? resolved : [];
      }
    }
    const students = await loadStudents();
    return sortStudents(students);
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
    const sort = document.getElementById('ch-sort')?.value || 'name';
    let list = listAssignedChallenges(student);
    if (list.length === 0){
      const p = document.createElement('p');
      p.style.color = '#667085';
      p.style.textAlign = 'center';
      p.textContent = '도전이 없습니다.';
      cont.appendChild(p);
      return;
    }

    let totalPct = 0;
    list = list.map(ch => {
      const status = getChallengeStatusFor(student, ch.id);
      const doneSimple = status && status.s === 'd';      
      const steps = Array.isArray(ch.steps) ? ch.steps : [];
      const max = steps.length; // 단계 수
      const prog = getChallengeProgressFor(student, ch.id);
      const curr = Math.min(prog.step || 0, max); // 0~max

      const done = max > 0 ? (curr >= max) : doneSimple;
      const pct = max > 0 ? Math.round((curr / max) * 100) : (done ? 100 : 0);
      totalPct += pct;
      return { ...ch, curr, max, done, pct, steps };
    });

    list.sort((a,b)=>{
      if (sort==='low') return a.pct - b.pct;
      if (sort==='high') return b.pct - a.pct;
      return (a.title||'').localeCompare(b.title||'');
    });

    list.forEach(ch => {
      const {curr, max, done, pct, steps} = ch;

      const card = document.createElement('div');
      let statusClass = 'not-started';
      if (done) statusClass = 'done';
      else if (curr > 0) statusClass = 'in-progress';
      card.className = 'challenge-card ' + statusClass;

      // 진행률 바용 CSS 변수
      card.style.setProperty('--prog', pct + '%');

      // 본문
      const progress = `<div class="ch-progress"><div class="ch-progress-fill"></div></div>`;
      const title = `<div class="ch-title">${escapeHTML(ch.title || '')} (${pct}%)</div>`;
      const desc  = ch.desc ? `<div class="ch-desc">${escapeHTML(ch.desc)}</div>` : '';

      let stateHTML = '';
      if (max > 0){
        const nextTarget = (curr < max) ? escapeHTML(steps[curr] || '') : '모든 단계 완료! 🎉';
        stateHTML =
          `<div class="ch-state">
          <div>진행: ${curr} / ${max}</div>
          <div style="font-size:12px;color:#667085;margin-top:4px;">다음 목표: ${nextTarget}</div>
          </div>`;
      } else {
        stateHTML = `<div class="ch-state">${done ? '✅ 완료' : '⭕ 미완료'}</div>`;
      }

      card.innerHTML = progress + title + desc + stateHTML;

      if (max > 0){
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-expanded', 'false');

        const toggleExpanded = (expanded) => {
          const isExpanded = expanded ?? !card.classList.contains('expanded');
          card.classList.toggle('expanded', isExpanded);
          card.setAttribute('aria-expanded', String(isExpanded));
          };
        card.addEventListener('click', (event) => {
          if (event.target.closest('.ch-step')) return;
          toggleExpanded();
        });

        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' '){
            event.preventDefault();
            toggleExpanded();
          }
        });
        
        const stepsBox = document.createElement('div');
        stepsBox.className = 'ch-steps';
        steps.forEach((st, i)=>{
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ch-step' + (i < curr ? ' done' : '');
          btn.textContent = st;
          btn.onclick = ()=>{
            setChallengeProgress(student, ch.id, i + 1);
            renderChallengesForStudent(student);
          };
          stepsBox.appendChild(btn);
        });
        card.appendChild(stepsBox);
      } else {
        card.onclick = async () => {
          setChallengeDone(student, ch.id, !doneSimple);
       renderChallengesForStudent(student);
        };
      }
      cont.appendChild(card);
    });

    const avg = list.length ? Math.round(totalPct / list.length) : 0;
    const avgSpan = document.getElementById('ch-progress-avg');
    if (avgSpan) avgSpan.textContent = `(전체의 ${avg}% 진행 완료)`;
  }


  async function renderChallengeList(){
    const box = document.getElementById('challenge-list');
    if (!box) return;
    const keyword = (document.getElementById('chl-search')?.value || '').trim();
    const sort = document.getElementById('chl-sort')?.value || 'name';
    box.innerHTML = '';
    let list = [];
    for (const ch of getChallenges()) {
      const students = (ch.students && !ch.students.includes('전체')) ? ch.students : await loadAllStudentNames();
      const steps = Array.isArray(ch.steps) ? ch.steps : [];
      const max = steps.length;
      let doneCnt = 0, progCnt = 0, noneCnt = 0, progSum = 0;
      students.forEach(name => {
        const status = getChallengeStatusFor(name, ch.id);
        const doneSimple = status && status.s === 'd';;
        const p = getChallengeProgressFor(name, ch.id);
        const curr = Math.min(p.step || 0, max);
        const done = max > 0 ? curr >= max : doneSimple;
        if (done) { doneCnt++; progSum += 1; }
        else if (curr > 0) { progCnt++; progSum += (max > 0 ? curr / max : 0); }
        else { noneCnt++; }
      });
      const avg = students.length > 0 ? Math.round((progSum / students.length) * 100) : 0;
      list.push({ ...ch, stats: { done: doneCnt, prog: progCnt, none: noneCnt, avg, total: students.length } });
    }

    list = list.filter(ch => {
      if (!keyword) return true;
      const txt = (ch.title || '') + ' ' + (ch.desc || '');
      return txt.includes(keyword);
    });

    list.sort((a,b)=>{
      if (sort==='incomplete') return (b.stats.prog + b.stats.none) - (a.stats.prog + a.stats.none);
      if (sort==='complete') return b.stats.done - a.stats.done;
      if (sort==='progressHigh') return b.stats.avg - a.stats.avg;
      if (sort==='progressLow') return a.stats.avg - b.stats.avg;
      return (a.title||'').localeCompare(b.title||'');
    });

    list.forEach(ch => {      
      const item = document.createElement('div');
      item.className = 'chl-item' + (ch.active ? '' : ' inactive');
      const left = document.createElement('div');
      left.style.flex = '1';
      const summary = `완료 ${ch.stats.done}명, 진행중 ${ch.stats.prog}명, 미시작 ${ch.stats.none}명`;
      left.innerHTML = `<div class="chl-title">${escapeHTML(ch.title || '(제목 없음)')}</div>` +
        (ch.desc ? `<div class="chl-desc" style="font-size:14px;color:#475467;">${escapeHTML(ch.desc)}</div>` : '') +
        `<div class="chl-meta">${summary}</div>`;
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '4px';
      const editBtn = document.createElement('button');
      editBtn.textContent = '편집';
      editBtn.onclick = (event) => {
        event.stopPropagation();
        openChallengeForm(ch.id);
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.onclick = async (event) => {
        event.stopPropagation();
        if (confirm('삭제할까요?')) {
          deleteChallenge(ch.id);
          await renderChallengeList();
        }
      };
      right.append(editBtn, delBtn);
      item.append(left, right);
      item.style.cursor = 'pointer';
      item.onclick = () => openChallengeStatus(ch.id);
      box.appendChild(item);
    });
  }

  function updateStepFields(count, values=[]){
    const box = document.getElementById('chf-steps-box');
    if (!box) return;
    box.innerHTML = '';
    for (let i = 0; i < count; i++){
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = `단계 ${i+1}`;
      inp.value = values[i] || '';
      inp.style.width = '100%';
      box.appendChild(inp);
    }
  }

  async function renderChallengeStudentSelector(selected=[]){
    const grid = document.getElementById('chf-student-selector');
    if (!grid) return;
    grid.innerHTML = '';
    const students = await getStudentsSortedAsync();
    students.forEach(stu => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.dataset.name = stu.name;
      card.textContent = `${stu.id} ${stu.name}`;
      if (selected.includes(stu.name)) card.classList.add('is-selected');
      grid.appendChild(card);
    });
    grid.onclick = (e)=>{
      const card = e.target.closest('.student-card');
      if (!card) return;
      card.classList.toggle('is-selected');
    };
  }

  async function openChallengeForm(id){
    const listView = document.getElementById('challenge-list-view');
    const formView = document.getElementById('challenge-form');
    const statusView = document.getElementById('challenge-status-view');
  
    if (listView) listView.style.display = 'none';
    if (statusView) statusView.style.display = 'none';
    if (formView) formView.style.display = 'block';
    
    const titleInput = document.getElementById('chf-title');
    const descInput = document.getElementById('chf-desc');
    const activeInput = document.getElementById('chf-active');
    const stepCountInput = document.getElementById('chf-step-count');
    let applyStepCount = null;
    const targetSel = document.getElementById('chf-target');

   if (stepCountInput) {
      applyStepCount = (values = []) => {
        const maxAttr = parseInt(stepCountInput.max || stepCountInput.getAttribute('max'), 10);
        let n = parseInt(stepCountInput.value, 10);
        if (Number.isNaN(n) || n < 0) n = 0;
        if (!Number.isNaN(maxAttr)) n = Math.min(n, maxAttr);
        stepCountInput.value = String(n);
        updateStepFields(n, values);
      };
     const handleStepCountChange = () => applyStepCount();
      stepCountInput.oninput = handleStepCountChange;
      stepCountInput.onchange = handleStepCountChange;
    }
    if (targetSel) {
      targetSel.onchange = () => {
        const grid = document.getElementById('chf-student-selector');
        const show = targetSel.value === 'selected';
        if (grid) grid.style.display = show ? 'flex' : 'none';
      };
    }

    if (id){
      const ch = getChallenges().find(c => c.id === id) || {};
      const steps = Array.isArray(ch.steps) ? ch.steps : [];
       if (stepCountInput && applyStepCount) {
        stepCountInput.value = String(steps.length);
        applyStepCount(steps);
      } else {
      }
      updateStepFields(steps.length, steps);
      formView.dataset.id = id;
      titleInput.value = ch.title || '';
      descInput.value = ch.desc || '';
      activeInput.checked = ch.active !== false;
      const roster = ch.students || ['전체'];
      targetSel.value = roster.includes('전체') ? 'all' : 'selected';
      await renderChallengeStudentSelector(roster.includes('전체') ? [] : roster);;
      const grid = document.getElementById('chf-student-selector');
      if (grid) grid.style.display = targetSel.value === 'selected' ? 'flex' : 'none';
    } else {
      formView.dataset.id = '';
      titleInput.value = '';
      descInput.value = '';
      activeInput.checked = true;
      if (stepCountInput && applyStepCount) {
        stepCountInput.value = '0';
        applyStepCount();
      } else {
        updateStepFields(0);
      }
      if (targetSel) targetSel.value = 'all';
      await renderChallengeStudentSelector([]);
      const grid = document.getElementById('chf-student-selector');
      if (grid) grid.style.display = 'none';
    }
  }

  async function saveChallengeFromForm(){
    const formView = document.getElementById('challenge-form');
    const id = formView.dataset.id || null;
    const title = document.getElementById('chf-title').value.trim();
    const desc = document.getElementById('chf-desc').value.trim();
    const active = document.getElementById('chf-active').checked;
    const stepCountEl = document.getElementById('chf-step-count');
    let stepCount = parseInt(stepCountEl ? stepCountEl.value : '0', 10);
    if (Number.isNaN(stepCount) || stepCount < 0) stepCount = 0;
    const maxAttr = stepCountEl ? parseInt(stepCountEl.max || stepCountEl.getAttribute('max'), 10) : NaN;
    if (!Number.isNaN(maxAttr)) stepCount = Math.min(stepCount, maxAttr);
    let steps = [];
    if (stepCount > 0){
      const inputs = Array.from(document.querySelectorAll('#chf-steps-box input'));
      steps = inputs.map(i => i.value.trim());
      if (steps.length !== stepCount || steps.some(s => !s)) {
        alert('모든 단계 내용을 입력하세요.');
        return;
      }
    }
    const target = document.getElementById('chf-target').value;
    let students = ['전체'];
    if (target === 'selected'){
      students = Array.from(document.querySelectorAll('#chf-student-selector .student-card.is-selected')).map(el => el.dataset.name);
      if (!students.length){ alert('학생을 하나 이상 선택하세요.'); return; }
    }
    const ch = { id: id || genId(), title, desc, active, students };
    if (stepCount > 0) ch.steps = steps;
    else ch.steps = [];
    upsertChallenge(ch);
    cancelChallengeForm();
    await renderChallengeList();
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

  async function openChallengeStatus(id){
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

  const studentGrid = statusView.querySelector('.st-student-grid');
  if (studentGrid) studentGrid.innerHTML='';

  const ensureGrid = () => {
    if (!studentGrid) {
      console.warn('[challenge] student grid element missing');
    }
    return studentGrid;
  };
  const gridEl = ensureGrid();
  if (!gridEl) return;

  // ★ 단계 정보
  const steps = Array.isArray(ch.steps) ? ch.steps : [];
  const max = steps.length; // 0이면 기존(단일 완료) 방식

  // 대상 학생
  const roster = (ch.students && !ch.students.includes('전체'))
    ? ch.students
    : await loadAllStudentNames();

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

    const card = document.createElement('div');
    card.className = 'challenge-card';
    if (done) card.classList.add('done');
    else if (curr > 0) card.classList.add('in-progress');
    else card.classList.add('not-started');

    const pct = max > 0 ? Math.round((curr / max) * 100) : (done ? 100 : 0);
    card.style.setProperty('--prog', pct + '%');

    const nextStepText = (curr < max) ? escapeHTML(steps[curr] || '') : '모든 단계 완료!';

    if (max > 0){
      card.innerHTML = `
        <div class="ch-title">${escapeHTML(name)}</div>
        <div class="ch-progress"><div class="ch-progress-fill"></div></div>
        <div class="ch-state">
          <div>진행: ${curr} / ${max}</div>
          <div class="ch-next">${curr < max ? `다음 단계: ${nextStepText}` : '모든 단계 완료! 🎉'}</div>
        </div>
        <div class="ch-controls">
          <button type="button" class="dec">−1</button>
          <button type="button" class="inc">＋1</button>
          <button type="button" class="to-max">모두완료</button>
          <button type="button" class="to-zero">초기화</button>
        </div>`;

      card.querySelector('.inc').onclick = async ()=>{
        if (typeof incChallengeProgress === 'function') {
          incChallengeProgress(name, id, max);
        } else if (typeof setChallengeProgress === 'function') {
          // fallback
          const next = Math.min(curr+1, max);
          setChallengeProgress(name, id, next);
        }
        await openChallengeStatus(id);
      };
      card.querySelector('.dec').onclick = async ()=>{
        if (typeof decChallengeProgress === 'function') {
          decChallengeProgress(name, id);
        } else if (typeof setChallengeProgress === 'function') {
          // fallback
          const next = Math.max(curr-1, 0);
          setChallengeProgress(name, id, next);
        }
        await openChallengeStatus(id);
      };
      card.querySelector('.to-max').onclick = async ()=>{
        if (typeof setChallengeProgress === 'function') setChallengeProgress(name, id, max);
        await openChallengeStatus(id);
      };
      card.querySelector('.to-zero').onclick = async ()=>{
        if (typeof setChallengeProgress === 'function') setChallengeProgress(name, id, 0);
        await openChallengeStatus(id);
      };
    } else {
      card.innerHTML = `
        <div class="ch-title">${escapeHTML(name)}</div>
        <div class="ch-state">${done ? '✅ 완료' : '⭕ 미완료'}</div>`;

      card.style.cursor = 'pointer';
      card.onclick = async () => {
        const mm = getJSON('challengeStatus-'+name, {}) || {};
        if(done) delete mm[id]; else mm[id]={s:'d', ts:new Date().toISOString()};
        setJSON('challengeStatus-'+name, mm);
        openChallengeStatus(id);
      };
    }
    gridEl.appendChild(card);
  });
}

  async function bulkMarkStatus(done){
    if (done && !confirm('모두 완료로 바꾸시겠습니까?')) return;
    const id = document.getElementById('challenge-status-view').dataset.id;
    const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
    const steps = Array.isArray(ch.steps) ? ch.steps : [];
    const max = steps.length;

    const roster = (ch.students && !ch.students.includes('전체'))
      ? ch.students : await loadAllStudentNames();

    roster.forEach(name=>{
      if (max > 0){
        setChallengeProgress(name, id, done ? max : 0);
      } else {
        const m = getJSON('challengeStatus-'+name, {}) || {};
        if(done) m[id]={s:'d', ts:new Date().toISOString()}; else delete m[id];
        setJSON('challengeStatus-'+name, m);
      }
    });
    await openChallengeStatus(id);
  }
  
  async function backToListFromStatus(){
    const statusView = document.getElementById('challenge-status-view');
    const listView = document.getElementById('challenge-list-view');
    if(statusView) statusView.style.display='none';
    if(listView) listView.style.display='block';
    await renderChallengeList();
  }

  window.addEventListener('onhi:cloud-sync-applied', () => {
    const currentStudent = localStorage.getItem('currentStudent');
    if (currentStudent && document.getElementById('challenges-container')) {
      renderChallengesForStudent(currentStudent);
    }
    if (document.getElementById('challenge-list')) {
      renderChallengeList();
    }
    const statusView = document.getElementById('challenge-status-view');
    const challengeId = statusView?.dataset?.id;
    if (challengeId && statusView?.style.display !== 'none') {
      openChallengeStatus(challengeId);
    }
  });

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
