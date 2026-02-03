import {
  genUID,
  getTasks,
  setTasks,
  getVacations,
  setVacations,
  migrateLegacyDoneToUIDOnce,
} from '../storage.js';

const {
  qs,
  pad2,
  normalizeDate,
  escapeHTML,
  formatKoreanDate,
  ensureHolidays,
  renderEventsStrip,
  loadStudents,
  loadStudentsCached,
  sortStudents,
  getStatusFor,
  setDone,
  setExempt,
  setPostponed,
} = window;

let selectedDate = null;
let selectedUid = null;
let calendarRefs = {};
let draggingTask = null;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let editingVacIndex = null;
let editingTaskId = null;

const getStudentsSorted = () => sortStudents(loadStudents());
const labelOf = (stu) => `${stu.id} ${stu.name}`;

const dispatchTasksUpdated = () => {
  window.dispatchEvent(new Event('tasks:updated'));
};

const clearCalendarDragState = () => {
  draggingTask = null;
  document.querySelectorAll('#calendar-body td.drag-origin').forEach(td => td.classList.remove('drag-origin'));
  document.querySelectorAll('#calendar-body td.drag-target').forEach(td => td.classList.remove('drag-target'));
};

const handleTaskDragStart = (ev) => {
  const target = ev.currentTarget;
  const uid = target?.dataset.uid;
  const date = target?.dataset.date;
  if (!uid || !date) return;
  draggingTask = { uid, from: date };
  ev.dataTransfer?.setData('text/plain', uid);
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  const cell = target.closest('td[data-date]');
  if (cell) cell.classList.add('drag-origin');
};

const handleTaskDragEnd = () => {
  clearCalendarDragState();
};

const handleCalendarDragOver = (ev) => {
  const target = ev.currentTarget;
  if (!draggingTask || !target?.dataset.date) return;
  ev.preventDefault();
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('#calendar-body td.drag-target').forEach(td => {
    if (td !== target) td.classList.remove('drag-target');
  });
  target.classList.add('drag-target');
};

const handleCalendarDragLeave = (ev) => {
  ev.currentTarget?.classList.remove('drag-target');
};

const handleCalendarDrop = (ev) => {
  const target = ev.currentTarget;
  if (!draggingTask || !target?.dataset.date) {
    clearCalendarDragState();
    return;
  }
  ev.preventDefault();
  const { uid, from } = draggingTask;
  const targetDate = target.dataset.date;
  target.classList.remove('drag-target');
  if (!uid || !targetDate || from === targetDate) {
    clearCalendarDragState();
    return;
  }

  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === uid);
  if (idx < 0) {
    clearCalendarDragState();
    return;
  }
  const task = tasks[idx];
  const repeat = task?.repeat || 'none';
  if (repeat !== 'none') {
    clearCalendarDragState();
    alert('반복 과제/일정은 드래그로 날짜를 옮길 수 없습니다.');
    return;
  }
  if (task.type === 'challenge') {
    clearCalendarDragState();
    alert('도전 과제는 날짜가 없어 이동할 수 없습니다.');
    return;
  }

  tasks[idx] = { ...task, date: targetDate };
  setTasks(tasks);
  dispatchTasksUpdated();
  clearCalendarDragState();

  const refreshCalendar = renderCalendar();
  const finalize = () => {
    renderStudentStatus();
    renderEventsStrip?.('events-strip-teacher');
    selectTask(targetDate, uid);
  };
  Promise.resolve(refreshCalendar).then(finalize).catch(finalize);
};

const setupCalendarDnD = (tbody) => {
  tbody.querySelectorAll('[data-uid]').forEach(el => {
    el.addEventListener('dragstart', handleTaskDragStart);
    el.addEventListener('dragend', handleTaskDragEnd);
  });
  tbody.querySelectorAll('td[data-date]').forEach(td => {
    td.addEventListener('dragover', handleCalendarDragOver);
    td.addEventListener('dragleave', handleCalendarDragLeave);
    td.addEventListener('drop', handleCalendarDrop);
  });
};

const setCalLabel = () => {
  const label = document.getElementById('cal-label');
  if (!label) return;
  label.textContent = `${viewYear}년 ${viewMonth + 1}월`;
};

const changeMonth = (delta) => {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
  hideActionUI();
};

const goToday = () => {
  const today = new Date();
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  renderCalendar();
  hideActionUI();
};

const renderStudentSelector = () => {
  const grid = document.getElementById('student-selector');
  if (!grid) return;
  grid.innerHTML = '';
  const students = getStudentsSorted();
  students.forEach(stu => {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.dataset.name = stu.name;
    card.textContent = `${stu.id} ${stu.name}`;
    grid.appendChild(card);
  });
};

const addTaskInput = () => {
  const div = document.createElement('div');
  div.className = 'task-input';
  div.innerHTML = '<input type="text" placeholder="할 일 입력" />' +
    '<button type="button" class="task-remove-btn" aria-label="할 일 삭제">⊖</button>';
  document.getElementById('task-list')?.appendChild(div);
};

const fetchHolidaysWithTimeout = async (year, country, timeoutMs = 1500) => {
  const timeout = new Promise(resolve => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const result = await Promise.race([ensureHolidays(year, country), timeout]);
    if (result && typeof result === 'object') return result;
  } catch (e) {
    console.warn('[calendar] holiday fetch failed:', e);
  }
  return {};
};

const setupDatePicker = (sel, opts = {}) => {
  if (typeof window.flatpickr !== 'function') {
    const el = document.querySelector(sel);
    if (el) el.type = 'date';
    return null;
  }
  return flatpickr(sel, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'n월 j일 (D)',
    locale: { ...flatpickr.l10ns.ko, firstDayOfWeek: 1 },
    disableMobile: true,
    ...opts,
  });
};

const resetTaskForm = (repeat) => {
  document.querySelectorAll("#task-list input[type='text']").forEach(i => (i.value = ''));
  const ta = document.getElementById('task-desc');
  if (ta) ta.value = '';
  document.querySelectorAll('#student-selector .student-card.is-selected').forEach(el => el.classList.remove('is-selected'));
  if (repeat !== 'none') {
    const s = document.getElementById('task-start');
    const e = document.getElementById('task-end');
    if (s) s.value = '';
    if (e) e.value = '';
  }
};

const saveAssignment = () => {
  const type = document.getElementById('task-type')?.value || 'assignment';
  const repeat = document.getElementById('repeat').value;
  const target = document.getElementById('target').value;
  const desc = (document.getElementById('task-desc')?.value || '').trim();

  const newTasks = Array.from(document.querySelectorAll('#task-list input'))
    .map(i => i.value.trim())
    .filter(Boolean);
  if (newTasks.length === 0) {
    alert('과제를 하나 이상 입력하세요.');
    return;
  }

  let students = [];
  if (type === 'event') {
    students = ['전체'];
  } else if (target === 'selected') {
    students = Array.from(document.querySelectorAll('#student-selector .student-card.is-selected'))
      .map(el => el.dataset.name);
    if (students.length === 0) {
      alert('학생을 하나 이상 선택하세요.');
      return;
    }
  } else {
    students = ['전체'];
  }

  const baseDate = document.getElementById('task-date')?.value || '';
  let saveDate = '';
  let repeatStart = '';
  let repeatEnd = '';

  if (repeat !== 'none') {
    repeatStart = document.getElementById('task-start')?.value || '';
    repeatEnd = document.getElementById('task-end')?.value || '';
    if (!repeatStart) {
      alert('반복 시작일을 선택하세요.');
      return;
    }
    saveDate = repeatStart;
  } else if (type !== 'challenge') {
    if (!baseDate) {
      alert('과제 날짜를 선택하세요.');
      return;
    }
    saveDate = baseDate;
  }

  const all = getTasks();
  const wasEditing = Boolean(editingTaskId);
  if (editingTaskId) {
    const index = all.findIndex(task => task.id === editingTaskId);
    if (index < 0) {
      alert('원본 과제를 찾을 수 없습니다.');
      editingTaskId = null;
      return;
    }
    all[index] = {
      ...all[index],
      type,
      text: newTasks[0],
      date: saveDate,
      desc,
      repeat,
      repeatStart: repeatStart || null,
      repeatEnd: repeatEnd || null,
      students: students.slice(),
    };
  } else {
    newTasks.forEach(text => {
      all.push({
        id: genUID(),
        type,
        date: saveDate,
        text,
        desc,
        repeat,
        repeatStart: repeatStart || null,
        repeatEnd: repeatEnd || null,
        students: students.slice(),
      });
    });
  }
  setTasks(all);
  dispatchTasksUpdated();

  resetTaskForm(repeat);
  alert(wasEditing ? '수정되었습니다!' : '저장되었습니다!');
  editingTaskId = null;
  renderCalendar();
  if (wasEditing) {
    hideActionUI();
    renderEventsStrip?.('events-strip-teacher');
  }
  renderStudentStatus();
};

const editTask = () => {
  if (!selectedUid) {
    alert('과제를 먼저 선택하세요.');
    return;
  }
  const all = getTasks();
  const task = all.find(x => x.id === selectedUid);
  if (!task) {
    alert('원본 과제를 찾을 수 없습니다.');
    return;
  }

  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'task-input';
  div.innerHTML = `<input type="text" value="${escapeHTML(task.text)}" />` +
    '<button type="button" class="task-remove-btn" aria-label="할 일 삭제">⊖</button>';
  taskList.appendChild(div);

  document.getElementById('task-date').value = task.date || '';
  document.getElementById('repeat').value = task.repeat || 'none';
  const descEl = document.getElementById('task-desc');
  if (descEl) descEl.value = task.desc || '';
  const typeHidden = document.getElementById('task-type');
  if (typeHidden) typeHidden.value = task.type || 'assignment';
  const typeToggle = document.getElementById('task-type-toggle');
  if (typeToggle) {
    typeToggle.querySelectorAll('button[data-type]').forEach(btn => {
      const isActive = btn.dataset.type === (task.type || 'assignment');
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  const rs = document.getElementById('task-start');
  const re = document.getElementById('task-end');
  if (rs) rs.value = task.repeatStart || '';
  if (re) re.value = task.repeatEnd || '';
  const repeatRange = document.getElementById('repeat-range');
  if (repeatRange) repeatRange.style.display = (task.repeat && task.repeat !== 'none') ? 'flex' : 'none';
  applyTypeEffects();

  const tgt = document.getElementById('target');
  const grid = document.getElementById('student-selector');
  if (task.students?.includes('전체')) {
    tgt.value = 'all';
    if (grid) grid.style.display = 'none';
  } else {
    tgt.value = 'selected';
    if (grid) {
      grid.style.display = 'flex';
      const set = new Set(task.students || []);
      grid.querySelectorAll('.student-card').forEach(card => {
        card.classList.toggle('is-selected', set.has(card.dataset.name));
      });
    }
  }

  editingTaskId = selectedUid;

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const deleteTaskClicked = () => {
  if (!selectedUid) {
    alert('과제를 먼저 선택하세요.');
    return;
  }
  const all = getTasks();
  const idx = all.findIndex(t => t.id === selectedUid);
  if (idx < 0) {
    alert('원본 과제를 찾을 수 없습니다.');
    return;
  }

  const targetText = all[idx].text;
  if (!confirm(`"${targetText}" 과제를 삭제할까요?`)) return;

  all.splice(idx, 1);
  setTasks(all);
  dispatchTasksUpdated();

  selectedUid = null;
  document.getElementById('task-action-buttons').style.display = 'none';

  renderCalendar();
  hideActionUI();
  renderStudentStatus();
  renderEventsStrip?.('events-strip-teacher');
};

const closeTaskCompletion = () => {
  hideActionUI();
};

const selectTask = (dateStr, uid) => {
  selectedDate = dateStr;
  selectedUid = null;

  const actionButtons = document.getElementById('task-action-buttons');
  const selectedLabel = document.getElementById('task-action-selected');
  const completionBox = document.getElementById('task-completion');

  if (!uid) {
    if (actionButtons) actionButtons.style.display = 'none';
    if (completionBox) completionBox.style.display = 'none';
    if (selectedLabel) selectedLabel.textContent = '';
    return;
  }

  const all = getTasks();
  const task = all.find(t => t.id === uid);
  if (!task) {
    if (actionButtons) actionButtons.style.display = 'none';
    if (completionBox) completionBox.style.display = 'none';
    if (selectedLabel) selectedLabel.textContent = '';
    return;
  }
  selectedUid = uid;

  if (selectedLabel) selectedLabel.textContent = `선택: ${dateStr}`;

  if (task.type === 'event') {
    if (completionBox) {
      completionBox.style.display = 'block';
      const box = document.getElementById('completion-list');
      if (box) {
        const desc = task.desc?.trim() ? escapeHTML(task.desc.trim()) : '설명 없음';
        box.innerHTML = `
          <h4 style="margin:0 0 8px;">📣 ${escapeHTML(task.text)}</h4>
          <div style="color:#444; line-height:1.6;">${desc.replace(/\n/g, '<br>')}</div>
        `;
      }
    }
    if (actionButtons) actionButtons.style.display = 'flex';
    return;
  }

  renderTaskCompletion(uid);
  if (completionBox) completionBox.style.display = 'block';
  if (actionButtons) {
    actionButtons.style.display = 'flex';
    const parent = completionBox?.parentNode;
    if (parent && completionBox) parent.insertBefore(actionButtons, completionBox.nextSibling);
  }
};

let statusModal = null;
let statusStudent = null;
let statusUID = null;

const refreshStatusUI = (uid) => {
  renderTaskCompletion(uid);
  renderCalendar();
  renderStudentStatus();
};

const closeStatusModal = () => {
  if (statusModal) statusModal.style.display = 'none';
  statusStudent = null;
  statusUID = null;
};

const ensureStatusModal = () => {
  if (statusModal) return statusModal;
  const modal = document.createElement('div');
  modal.id = 'statusModal';
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '2000';
  modal.innerHTML = `
    <div class="modal-backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,.35);"></div>
    <div class="modal-card" style="
      position:absolute; left:50%; top:20%; transform:translateX(-50%);
      width:min(420px, 92vw); background:#fff; border-radius:16px;
      box-shadow:0 20px 50px rgba(0,0,0,.18); padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0; font-size:18px;">상태 변경</h3>
        <button type="button" id="statusModalClose" style="all:unset; cursor:pointer; font-size:20px;">×</button>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button type="button" id="statusDoneBtn" class="btn-primary">완료</button>
        <button type="button" id="statusUndoneBtn">미완료</button>
      </div>
      <div style="margin-bottom:12px;">
        <div style="margin-bottom:4px;">미룸</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="postponeBtn" data-add="1">+1</button>
          <button type="button" class="postponeBtn" data-add="2">+2</button>
          <button type="button" class="postponeBtn" data-add="3">+3</button>
          <button type="button" class="postponeBtn" data-add="custom">직접입력</button>
        </div>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="exemptReason" placeholder="면제 사유(선택)" style="flex:1; height:38px; border:1px solid #dcdfe4; border-radius:10px; padding:0 10px; font:inherit;">
        <button type="button" id="statusExemptBtn">면제</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeStatusModal);
  modal.querySelector('#statusModalClose').addEventListener('click', closeStatusModal);
  modal.querySelector('#statusDoneBtn').addEventListener('click', () => {
    if (!statusStudent) return;
    setDone(statusStudent, statusUID, true);
    refreshStatusUI(statusUID);
    closeStatusModal();
  });
  modal.querySelector('#statusUndoneBtn').addEventListener('click', () => {
    if (!statusStudent) return;
    setDone(statusStudent, statusUID, false);
    refreshStatusUI(statusUID);
    closeStatusModal();
  });
  modal.querySelectorAll('.postponeBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!statusStudent) return;
      let add = btn.dataset.add;
      let days = 0;
      if (add === 'custom') {
        const v = prompt('+며칠 미룰까요?');
        days = parseInt(v, 10);
      } else {
        days = parseInt(add, 10);
      }
      if (!days || days <= 0) return;
      const newDate = await calcBusinessDate(days);
      setPostponed(statusStudent, statusUID, newDate);
      refreshStatusUI(statusUID);
      closeStatusModal();
    });
  });
  modal.querySelector('#statusExemptBtn').addEventListener('click', () => {
    if (!statusStudent) return;
    const reason = modal.querySelector('#exemptReason').value;
    setExempt(statusStudent, statusUID, reason);
    refreshStatusUI(statusUID);
    closeStatusModal();
  });
  statusModal = modal;
  return statusModal;
};

const openStatusModal = (student, uid) => {
  ensureStatusModal();
  statusStudent = student;
  statusUID = uid;
  statusModal.style.display = 'block';
  statusModal.querySelector('#exemptReason').value = '';
};

const calcBusinessDate = async (addDays) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const holidaysCache = {};
  let d = new Date(start);
  let count = 0;
  while (count < addDays) {
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    if (!holidaysCache[year]) holidaysCache[year] = await ensureHolidays(year);
    const dateStr = `${year}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isHoliday = !!holidaysCache[year][dateStr];
    if (isWeekend || isHoliday) continue;
    count++;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const renderTaskCompletion = (uid) => {
  const container = document.getElementById('completion-list');
  container.innerHTML = '';

  const all = getTasks();
  const task = all.find(x => x.id === uid);
  if (!task) {
    container.textContent = '과제를 찾을 수 없습니다.';
    return;
  }

  const h = document.createElement('h4');
  h.textContent = `📌 ${task.text} (${task.date})`;
  container.appendChild(h);

  let students = getStudentsSorted();
  if (!task.students.includes('전체')) {
    const set = new Set(task.students || []);
    students = students.filter(s => set.has(s.name));
  }

  const grid = document.createElement('div');
  grid.className = 'student-chip-grid';
  grid.style.userSelect = 'none';

  students.forEach(stu => {
    const st = getStatusFor?.(stu.name, uid);
    const statusCode = st?.s || '';
    const isExempt = statusCode === 'e';
    const done = statusCode === 'd';
    const chip = document.createElement('div');
    chip.className = `student-chip${isExempt ? ' exempt' : (done ? '' : ' missed')}`;
    chip.dataset.student = stu.name;
    chip.dataset.uid = uid;
    chip.style.cursor = 'pointer';
    chip.textContent = `${stu.id} ${stu.name}${isExempt ? ' 🚫' : ''}`;
    grid.appendChild(chip);
  });

  container.appendChild(grid);

  let tapTimer = null;
  const TAP_DELAY = 250;

  grid.addEventListener('click', (e) => {
    const chip = e.target.closest('.student-chip');
    if (!chip || chip.classList.contains('exempt')) return;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapTimer = null;
      const student = chip.dataset.student;
      const currentUid = chip.dataset.uid;
      const st = getStatusFor?.(student, currentUid);
      const isDoneNow = !!(st && st.s === 'd');
      setDone(student, currentUid, !isDoneNow);
      renderTaskCompletion(currentUid);
      renderCalendar();
      renderStudentStatus();
    }, TAP_DELAY);
  }, false);

  grid.addEventListener('dblclick', (e) => {
    const chip = e.target.closest('.student-chip');
    if (!chip) return;
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
    }
    openStatusModal(chip.dataset.student, chip.dataset.uid);
  }, false);
};

const renderCalendar = async () => {
  const tbody = qs('#calendar-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  calendarRefs = {};

  const year = viewYear;
  const month = viewMonth;

  const holidaysMap = await fetchHolidaysWithTimeout(year, 'KR');
  const vacations = getVacations() || [];
  const isVacation = (dateStr) => {
    const v = vacations.find(v => v.start <= dateStr && dateStr <= v.end);
    return v ? v.name : null;
  };
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const adjustedStartDay = (startDay + 6) % 7;
  const lastDate = new Date(year, month + 1, 0).getDate();

  const tasks = getTasks();
  const joinMap = {};
  loadStudents().forEach(s => {
    joinMap[s.name] = s.joined || '0000-00-00';
  });

  const instancesMap = {};
  const pushInst = (dateStr, task) => {
    const bucket = instancesMap[dateStr] ?? (instancesMap[dateStr] = []);
    bucket.push({
      id: task.id,
      text: task.text,
      originDate: task.date,
      type: task.type || 'assignment',
      order: bucket.length,
    });
  };
  const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };

  tasks.forEach(task => {
    const rpt = task.repeat || 'none';
    const inRange = (dateStr) => {
      const s = task.repeatStart || task.date || '';
      const e = task.repeatEnd || '';
      if (s && dateStr < s) return false;
      if (e && dateStr > e) return false;
      return true;
    };

    if (rpt === 'daily') {
      for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        if (!inRange(dateStr)) continue;
        pushInst(dateStr, task);
      }
    } else if (dayMap[rpt] != null) {
      for (let d = 1; d <= lastDate; d++) {
        const dateObj = new Date(year, month, d);
        if (dateObj.getDay() === dayMap[rpt]) {
          const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
          if (!inRange(dateStr)) continue;
          pushInst(dateStr, task);
        }
      }
    } else if (task.date) {
      const d = new Date(task.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateStr = `${year}-${pad2(month + 1)}-${pad2(d.getDate())}`;
        pushInst(dateStr, task);
      }
    }
  });

  Object.entries(instancesMap).forEach(([dateStr, arr]) => {
    arr.sort((a, b) => {
      const aIsEvent = a.type === 'event';
      const bIsEvent = b.type === 'event';
      if (aIsEvent !== bIsEvent) return aIsEvent ? -1 : 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    calendarRefs[dateStr] = arr.map(x => x.id);
  });

  let html = '<tr>';
  for (let i = 0; i < adjustedStartDay; i++) html += '<td></td>';

  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const wd = new Date(year, month, day).getDay();
    const isSun = wd === 0;
    const isSat = wd === 6;

    const holName = holidaysMap[dateStr] || null;
    const vacName = isVacation(dateStr);
    const badge = holName
      ? `<span class="badge-holiday">${escapeHTML(holName)}</span>`
      : (vacName ? `<span class="badge-vacation">${escapeHTML(vacName)}</span>` : '');

    const cls = [];
    if (isSun) cls.push('sun');
    if (isSat) cls.push('sat');
    if (holName) cls.push('holiday');
    if (vacName) cls.push('vacation');

    const pills = (instancesMap[dateStr] || []).map(inst => {
      const task = tasks.find(x => x.id === inst.id);
      if (!task) return '';

      if (task.type === 'event') {
        const title = escapeHTML(task.text || '(제목 없음)');
        return `<div class="event-pill" data-uid="${inst.id}" data-date="${dateStr}" data-type="event" data-repeat="${task.repeat || 'none'}" draggable="true">${title}</div>`;
      }

      let assignedNames = getStudentsSorted().map(s => s.name);
      if (task && !task.students.includes('전체')) {
        const set = new Set(task.students);
        assignedNames = assignedNames.filter(n => set.has(n));
      }
      assignedNames = assignedNames.filter(n => (joinMap[n] || '0000-00-00') <= dateStr);
      const anyIncomplete = assignedNames.some(name => {
        const st = getStatusFor?.(name, inst.id);
        if (st && st.s === 'e') return false;
        if (st && st.s === 'p') {
          if (st.du && st.du !== dateStr) return false;
        }
        if (st && st.s === 'd') return false;
        return true;
      });

      const pillClass = anyIncomplete ? 'task-pill pending' : 'task-pill done';
      return `<div class="${pillClass}" data-uid="${inst.id}" data-date="${dateStr}" data-type="${task.type || 'assignment'}" data-repeat="${task.repeat || 'none'}" draggable="true">${escapeHTML(task.text)}</div>`;
    }).join('');

    html += `<td class="${cls.join(' ')}" data-date="${dateStr}">
      <strong class="day-num">${day}</strong>
      ${badge}
      ${pills}
    </td>`;

    if ((adjustedStartDay + day) % 7 === 0) html += '</tr><tr>';
  }
  html += '</tr>';
  tbody.innerHTML = html;
  setupCalendarDnD(tbody);
  setCalLabel();
};

const renderStudentStatus = () => {
  const container = qs('#student-status-list');
  if (!container) return;
  container.innerHTML = '';

  const all = getTasks();
  const today = normalizeDate(new Date());
  const students = getStudentsSorted();
  const showPE = localStorage.getItem('showPostponedExempt') !== 'no';

  const instances = [];
  all.forEach(task => {
    if (task.type === 'event') return;
    const base = normalizeDate(task.date);
    const rpt = task.repeat || 'none';

    const s = task.repeatStart || task.date || '';
    const e = task.repeatEnd || '';
    const inRange = (dateStr) => {
      if (s && dateStr < s) return false;
      if (e && dateStr > e) return false;
      return true;
    };

    const pushIfInRange = (d) => {
      const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (!inRange(ds)) return;
      instances.push({
        uid: task.id,
        text: task.text,
        date: ds,
        dateObj: new Date(d),
        students: task.students,
      });
    };

    if (rpt === 'daily') {
      const cur = new Date(base);
      while (cur <= today) {
        pushIfInRange(cur);
        cur.setDate(cur.getDate() + 1);
      }
    } else if ({ mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 }[rpt] != null) {
      const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };
      const cur = new Date(base);
      while (cur.getDay() !== dayMap[rpt]) cur.setDate(cur.getDate() + 1);
      while (cur <= today) {
        pushIfInRange(cur);
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      if (!isNaN(base) && base <= today) pushIfInRange(base);
    }
  });

  instances.sort((a, b) => b.dateObj - a.dateObj);

  const frag = document.createDocumentFragment();

  students.forEach(stu => {
    const card = document.createElement('div');
    card.className = 'status-card';

    const title = document.createElement('div');
    title.className = 'status-card__title';
    title.textContent = ` ${labelOf(stu)}`;

    const listBox = document.createElement('div');
    listBox.className = 'status-card__list';

    card.append(title, listBox);

    instances.forEach(inst => {
      const assigned = inst.students.includes('전체') || inst.students.includes(stu.name);
      if (!assigned) return;
      const joined = stu.joined || '0000-00-00';
      if (inst.date < joined) return;

      const st = getStatusFor?.(stu.name, inst.uid);
      const statusCode = st?.s || '';
      const postponedTo = st?.du || null;
      const isExempt = statusCode === 'e';
      const done = statusCode === 'd';
      const isPostponed = statusCode === 'p';
      const isPast = inst.dateObj < today;

      if (isPast && (isPostponed || isExempt)) return;
      if (!showPE && (isPostponed || isExempt)) return;
      if (!isExempt && done && isPast) return;

      let bg = '#f6c1c1';
      let borderColor = '#e6e8eb';
      let textColor = '#000';
      let dateColor = '#666';

      if (isPostponed) {
        bg = '#fddf7f';
        borderColor = '#f0c24c';
        textColor = '#604400';
      }

      if (isExempt) {
        bg = '#E5E7EB';
        borderColor = '#D1D5DB';
        textColor = '#374151';
        dateColor = '#374151';
      } else if (isPast && !done) {
        bg = '#c0392b';
        borderColor = '#b23326';
        textColor = '#fff';
        dateColor = '#fff';
      } else if (!isPast && done) {
        bg = 'white';
      }

      const chip = document.createElement('div');
      let cls = 'student-chip status-chip';
      if (!done && !isPostponed && !isExempt) cls += ' missed';
      if (isPostponed) cls += ' postponed';
      if (isExempt) cls += ' exempt';
      chip.className = cls;
      chip.dataset.student = stu.name;
      chip.dataset.uid = inst.uid;

      let dateLabel = formatKoreanDate?.(inst.dateObj) ?? inst.date;
      if (isPostponed && postponedTo) {
        const postponedLabel = formatKoreanDate?.(postponedTo) ?? postponedTo;
        dateLabel += ` → ${postponedLabel}`;
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'status-chip__label';
      labelSpan.textContent = inst.text;

      const contentWrap = document.createElement('div');
      contentWrap.className = 'status-chip__content';
      contentWrap.appendChild(labelSpan);

      if (isExempt) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'status-chip__icon';
        iconSpan.textContent = '🚫';
        contentWrap.appendChild(iconSpan);
      }

      const exemptNote = isExempt ? (st?.note || '').trim() : '';
      if (exemptNote) {
        const noteSpan = document.createElement('span');
        noteSpan.className = 'status-chip__note';
        noteSpan.textContent = exemptNote;
        contentWrap.appendChild(noteSpan);
      }

      const dateSpan = document.createElement('span');
      dateSpan.className = 'status-chip__date';
      dateSpan.textContent = dateLabel;
      dateSpan.style.color = dateColor;

      chip.append(contentWrap, dateSpan);

      chip.style.background = bg;
      chip.style.borderColor = borderColor;
      chip.style.color = textColor;

      listBox.appendChild(chip);
    });

    frag.appendChild(card);
  });

  container.appendChild(frag);
};

const hideActionUI = () => {
  const buttons = document.getElementById('task-action-buttons');
  const selected = document.getElementById('task-action-selected');
  const compBox = document.getElementById('task-completion');

  if (buttons) buttons.style.display = 'none';
  if (compBox) compBox.style.display = 'none';
  if (selected) selected.textContent = '';

  selectedDate = null;
  selectedUid = null;
};

const cancelEditVacation = () => {
  editingVacIndex = null;
  qs('#vac-name').value = '';
  qs('#vac-start').value = '';
  qs('#vac-end').value = '';
  const addBtn = qs('#vac-add-btn');
  const cancelBtn = qs('#vac-cancel-btn');
  if (addBtn) addBtn.textContent = '추가';
  if (cancelBtn) cancelBtn.style.display = 'none';
};

const editVacation = (idx) => {
  const list = getVacations();
  const vac = list[idx];
  if (!vac) return;
  editingVacIndex = idx;
  qs('#vac-name').value = vac.name;
  qs('#vac-start').value = vac.start;
  qs('#vac-end').value = vac.end;
  const addBtn = qs('#vac-add-btn');
  const cancelBtn = qs('#vac-cancel-btn');
  if (addBtn) addBtn.textContent = '수정 완료';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
};

const addVacation = () => {
  const name = qs('#vac-name').value.trim();
  const start = qs('#vac-start').value;
  const end = qs('#vac-end').value;
  if (!name || !start || !end) {
    alert('이름/시작/종료 날짜를 모두 입력하세요.');
    return;
  }
  if (start > end) {
    alert('시작이 종료보다 뒤입니다.');
    return;
  }

  const list = getVacations();
  if (editingVacIndex != null) {
    list[editingVacIndex] = { name, start, end };
  } else {
    list.push({ name, start, end });
  }
  setVacations(list);

  cancelEditVacation();
  renderVacationList();
  renderCalendar();
};

const deleteVacation = (idx) => {
  const list = getVacations();
  list.splice(idx, 1);
  setVacations(list);
  if (editingVacIndex === idx) {
    cancelEditVacation();
  } else if (editingVacIndex != null && editingVacIndex > idx) {
    editingVacIndex--;
  }
  renderVacationList();
  renderCalendar();
};

const renderVacationList = () => {
  const list = getVacations();
  const box = qs('#vac-list');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<div style="color:#666;">등록된 방학이 없습니다.</div>';
    return;
  }
  box.innerHTML = list.map((v, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
      <div style="flex:1 1 auto;">🏖 ${escapeHTML(v.name)} — ${v.start} ~ ${v.end}</div>
      <button type="button" data-action="edit" data-index="${i}">수정</button>
      <button type="button" data-action="delete" data-index="${i}">삭제</button>
    </div>
  `).join('');
};

const applyTypeEffects = () => {
  const type = document.getElementById('task-type')?.value || 'assignment';
  const repeatSel = document.getElementById('repeat');
  const rangeBox = document.getElementById('repeat-range');
  const dateBox = document.getElementById('task-date')?.closest('.task-row');
  const tgtSel = document.getElementById('target');
  const stuGrid = document.getElementById('student-selector');

  if (type === 'event') {
    dateBox?.classList.remove('hidden');
    repeatSel.disabled = true;
    repeatSel.value = 'none';
    rangeBox.style.display = 'none';
    tgtSel.value = 'all';
    tgtSel.disabled = true;
    stuGrid.style.display = 'none';
  } else if (type === 'challenge') {
    repeatSel.disabled = true;
    repeatSel.value = 'none';
    rangeBox.style.display = 'none';
    dateBox?.classList.add('hidden');
    tgtSel.disabled = false;
    if (tgtSel.value === 'selected') {
      document.getElementById('student-selector').style.display = 'flex';
    }
  } else {
    dateBox?.classList.remove('hidden');
    repeatSel.disabled = false;
    tgtSel.disabled = false;
  }
};

const applyShowEventsBtn = () => {
  const btn = document.getElementById('eventsBtn');
  if (!btn) return;
  let pref = localStorage.getItem('showEvents');
  if (pref !== 'yes' && pref !== 'no') {
    pref = 'yes';
    localStorage.setItem('showEvents', pref);
  }
  const show = pref !== 'no';
  btn.innerHTML = show ? '일정<br>숨김' : '일정<br>표시';
  btn.setAttribute('aria-pressed', String(show));
  const strip = document.getElementById('events-strip-teacher');
  if (strip) strip.style.display = show ? '' : 'none';
};

const toggleShowEvents = () => {
  const show = localStorage.getItem('showEvents') !== 'no';
  localStorage.setItem('showEvents', show ? 'no' : 'yes');
  renderEventsStrip?.('events-strip-teacher');
  renderStudentStatus();
  applyShowEventsBtn();
};

const applyPeBtn = () => {
  const btn = document.getElementById('peToggleBtn');
  if (!btn) return;
  let pref = localStorage.getItem('showPostponedExempt');
  if (pref !== 'yes' && pref !== 'no') {
    pref = 'yes';
    localStorage.setItem('showPostponedExempt', pref);
  }
  const show = pref !== 'no';
  btn.innerHTML = show ? '면제<br>숨김' : '면제<br>표시';
  btn.setAttribute('aria-pressed', String(show));
};

const toggleShowPe = () => {
  const show = localStorage.getItem('showPostponedExempt') !== 'no';
  localStorage.setItem('showPostponedExempt', show ? 'no' : 'yes');
  renderStudentStatus();
  applyPeBtn();
};

const bindStudentStatusInteractions = () => {
  const container = document.getElementById('student-status-list');
  if (!container) return;

  let raf = null;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      renderStudentStatus();
    });
  };

  window.applyCompactMode?.();
  renderStudentStatus();

  let tapTimer = null;
  const TAP_DELAY = 250;

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.student-chip');
    if (!chip || !container.contains(chip) || chip.classList.contains('exempt')) return;

    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapTimer = null;
      const student = chip.dataset.student;
      const uid = chip.dataset.uid;
      const nowIsDone = !chip.classList.contains('missed');
      setDone(student, uid, !nowIsDone);
      chip.classList.toggle('missed', nowIsDone);
      schedule();
    }, TAP_DELAY);
  }, false);

  container.addEventListener('dblclick', (e) => {
    const chip = e.target.closest('.student-chip');
    if (!chip || !container.contains(chip)) return;
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
    }
    openStatusModal(chip.dataset.student, chip.dataset.uid);
  }, false);

  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (e.key.startsWith('doneTasks-') || e.key === 'tasksV2') schedule();
  });

  window.addEventListener('tasks:updated', schedule);
  window.addEventListener('students:updated', schedule);
};

const bindCalendarInteractions = () => {
  const tbody = document.getElementById('calendar-body');
  if (!tbody) return;
  tbody.addEventListener('click', (event) => {
    const pill = event.target.closest('.task-pill, .event-pill');
    if (!pill) return;
    const date = pill.dataset.date;
    const uid = pill.dataset.uid;
    if (!date || !uid) return;
    selectTask(date, uid);
  });
};

const bindTaskFormInteractions = () => {
  document.getElementById('task-add-btn')?.addEventListener('click', addTaskInput);
  document.getElementById('task-list')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.task-remove-btn');
    if (!btn) return;
    btn.parentElement?.remove();
  });
  document.getElementById('student-selector')?.addEventListener('click', (event) => {
    const card = event.target.closest('.student-card');
    if (!card) return;
    card.classList.toggle('is-selected');
  });
  document.getElementById('task-save-btn')?.addEventListener('click', saveAssignment);
  document.getElementById('task-edit-btn')?.addEventListener('click', editTask);
  document.getElementById('task-delete-btn')?.addEventListener('click', deleteTaskClicked);
  document.getElementById('task-close-btn')?.addEventListener('click', closeTaskCompletion);

  document.getElementById('target')?.addEventListener('change', (event) => {
    const grid = document.getElementById('student-selector');
    const show = event.target.value === 'selected' && !document.getElementById('task-type')?.value.includes('event');
    grid.style.display = show ? 'flex' : 'none';
  });

  document.getElementById('repeat')?.addEventListener('change', (event) => {
    const show = event.target.value !== 'none';
    document.getElementById('repeat-range').style.display = show ? 'flex' : 'none';
    applyTypeEffects();
  });

  const typeToggle = document.getElementById('task-type-toggle');
  const typeHidden = document.getElementById('task-type');
  if (typeToggle) {
    typeToggle.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-type]');
      if (!btn) return;
      typeToggle.querySelectorAll('button').forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      typeHidden.value = btn.dataset.type;
      applyTypeEffects();
    });
  }

  const descToggle = document.getElementById('desc-toggle');
  const descArea = document.getElementById('task-desc');
  if (descToggle && descArea) {
    descToggle.addEventListener('click', () => {
      const on = descArea.style.display !== 'none';
      descArea.style.display = on ? 'none' : 'block';
      descToggle.textContent = on ? '설명 추가' : '설명 닫기';
    });
  }

  document.getElementById('cal-prev')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('cal-next')?.addEventListener('click', () => changeMonth(1));
  document.getElementById('cal-today')?.addEventListener('click', goToday);
};

const bindVacationInteractions = () => {
  document.getElementById('vac-add-btn')?.addEventListener('click', addVacation);
  document.getElementById('vac-cancel-btn')?.addEventListener('click', cancelEditVacation);
  document.getElementById('vac-list')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    if (Number.isNaN(idx)) return;
    if (btn.dataset.action === 'edit') editVacation(idx);
    if (btn.dataset.action === 'delete') deleteVacation(idx);
  });
};

const bindEventToggles = () => {
  applyShowEventsBtn();
  applyPeBtn();
  document.getElementById('eventsBtn')?.addEventListener('click', toggleShowEvents);
  document.getElementById('peToggleBtn')?.addEventListener('click', toggleShowPe);
  window.addEventListener('storage', (e) => {
    if (e.key === 'showEvents') {
      renderEventsStrip?.('events-strip-teacher');
      renderStudentStatus();
      applyShowEventsBtn();
    }
    if (e.key === 'showPostponedExempt') {
      renderStudentStatus();
      applyPeBtn();
    }
  });
};

const initAssignments = () => {
  migrateLegacyDoneToUIDOnce({ loadStudentsCached });
  setupDatePicker('#task-date', { defaultDate: new Date() });
  setupDatePicker('#task-start', { defaultDate: new Date() });
  setupDatePicker('#task-end');
  applyTypeEffects();

  bindTaskFormInteractions();
  bindVacationInteractions();
  bindCalendarInteractions();
  bindStudentStatusInteractions();
  bindEventToggles();

  window.renderStudentStatus = renderStudentStatus;
  window.renderCalendar = renderCalendar;
  window.renderTaskCompletion = renderTaskCompletion;
};

const showStatus = () => {
  renderEventsStrip?.('events-strip-teacher');
  hideActionUI();
  renderStudentStatus();
};

const showAssignments = () => {
  renderCalendar();
  hideActionUI();
  renderStudentSelector();
  renderVacationList();
  cancelEditVacation();
  const calendarSection = document.querySelector('#task-management section.calendar');
  if (calendarSection) calendarSection.style.display = 'block';
};

export {
  initAssignments,
  showStatus,
  showAssignments,
  hideActionUI,
  renderStudentStatus,
  renderCalendar,
  renderVacationList,
};
