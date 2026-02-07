import { ObservationStorage } from '../storage.js';

const { pad2, escapeHTML, formatKoreanDate, sortStudents, loadStudents } = window;

const OBS_TEMPLATES = {
  '칭찬': [
    '오늘 활동에 적극적으로 참여했어요.',
    '친구에게 친절하게 도와줬어요.',
    '과제를 끝까지 집중해서 마무리했어요.',
  ],
  '조언': [
    '다음엔 질문 전에 손을 들어볼까요?',
    '활동 순서를 조금 더 천천히 따라가봐요.',
    '집중이 흐트러질 때는 잠깐 심호흡을 해봅시다.',
  ],
  '기록(0점)': [
    '과제 미제출',
    '수업 중 집중 어려움',
    '지각으로 활동 일부 참여',
  ],
};

const getStudentsSorted = () => sortStudents(loadStudents());

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const initializeObservationDate = () => {
  const startInput = document.getElementById('obs-date-start');
  const endInput = document.getElementById('obs-date-end');
  if (!startInput && !endInput) return;
  const today = getTodayString();
  if (startInput && !startInput.value) startInput.value = today;
  if (endInput && !endInput.value) endInput.value = today;
};

const renderObservationTemplates = () => {
  const select = document.getElementById('obs-template');
  const typeSelect = document.getElementById('obs-type');
  if (!select || !typeSelect) return;
  const type = typeSelect.value || '칭찬';
  const templates = OBS_TEMPLATES[type] || [];
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '템플릿 선택';
  select.appendChild(placeholder);
  templates.forEach(text => {
    const option = document.createElement('option');
    option.value = text;
    option.textContent = text;
    select.appendChild(option);
  });
};

const renderObservationStudentOptions = () => {
  const formSelect = document.getElementById('obs-student');
  const filterSelect = document.getElementById('obs-filter-student');
  const students = getStudentsSorted();

  if (formSelect) {
    formSelect.innerHTML = '';
    if (students.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '학생 없음';
      formSelect.appendChild(option);
    } else {
      students.forEach(stu => {
        const option = document.createElement('option');
        option.value = stu.id;
        option.dataset.name = stu.name;
        option.textContent = `${stu.id} ${stu.name}`;
        formSelect.appendChild(option);
      });
    }
  }

  if (filterSelect) {
    filterSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '전체 학생';
    filterSelect.appendChild(allOption);
    students.forEach(stu => {
      const option = document.createElement('option');
      option.value = stu.id;
      option.dataset.name = stu.name;
      option.textContent = `${stu.id} ${stu.name}`;
      filterSelect.appendChild(option);
    });
  }
};

const getMonthRange = (monthValue) => {
  if (!monthValue) return null;
  const [yearText, monthText] = monthValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${yearText}-${pad2(month)}-01`,
    end: `${yearText}-${pad2(month)}-${pad2(lastDay)}`,
  };
};

const getObservationFilters = () => ({
  startDate: document.getElementById('obs-filter-start')?.value || '',
  endDate: document.getElementById('obs-filter-end')?.value || '',
  month: document.getElementById('obs-filter-month')?.value || '',
  studentId: document.getElementById('obs-filter-student')?.value || '',
  type: document.getElementById('obs-filter-type')?.value || '',
  ability: document.getElementById('obs-filter-ability')?.value || '',
  sort: document.getElementById('obs-filter-sort')?.value || 'latest',
  search: document.getElementById('obs-filter-search')?.value.trim().toLowerCase() || '',
});

const renderObservationList = () => {
  const listEl = document.getElementById('obs-list');
  if (!listEl) return;
  const filters = getObservationFilters();
  const monthRange = getMonthRange(filters.month);
  const rangeStart = monthRange?.start || filters.startDate;
  const rangeEnd = monthRange?.end || filters.endDate;
  const list = ObservationStorage.loadObservations()
    .slice()
    .filter(item => {
      const recordStart = item.startDate || item.date || '';
      const recordEnd = item.endDate || item.date || '';
      if (rangeStart && String(recordEnd) < String(rangeStart)) return false;
      if (rangeEnd && String(recordStart) > String(rangeEnd)) return false;
      if (filters.studentId && String(item.studentId) !== String(filters.studentId)) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.ability && item.ability !== filters.ability) return false;
      if (filters.search) {
        const haystack = [
          item.studentName,
          item.template,
          item.memo,
          item.type,
          item.ability,
          item.date,
          item.startDate,
          item.endDate,
        ].join(' ').toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
      })
    .sort((a, b) => {
      if (filters.sort === 'input') {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      }
      const dateA = a.startDate || a.date || '';
      const dateB = b.startDate || b.date || '';
      const dateDiff = String(dateB).localeCompare(String(dateA));
      if (dateDiff !== 0) return dateDiff;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

  listEl.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'obs-card';
    empty.textContent = '조건에 맞는 관찰 기록이 없습니다.';
    listEl.appendChild(empty);
    return;
  }

  list.forEach(item => {
    const row = document.createElement('div');
    row.className = 'obs-item';
    const memo = item.memo ? `<div class="meta">${escapeHTML(item.memo)}</div>` : '';
    const startDate = item.startDate || item.date || '';
    const endDate = item.endDate || item.date || '';
    const formattedStart = formatKoreanDate?.(startDate) ?? startDate;
    const formattedEnd = formatKoreanDate?.(endDate) ?? endDate;
    const dateLabel = startDate && endDate && startDate !== endDate
      ? `${formattedStart} ~ ${formattedEnd}`
      : formattedStart || formattedEnd;
    const typeClass = item.type === '칭찬'
      ? 'type-praise'
      : item.type === '조언'
        ? 'type-advice'
        : 'type-record';
    row.innerHTML = `
      <div class="meta">${escapeHTML(dateLabel)}</div>
      <div class="note">
        <div><strong>${escapeHTML(item.studentName || '')}</strong></div>
        <div>${escapeHTML(item.template || '')}</div>
        ${memo}
      </div>
      <div class="chip type-chip ${typeClass}">${escapeHTML(item.type || '')}</div>
      <div class="chip">${escapeHTML(item.ability || '')}</div>
      <button type="button" data-id="${escapeHTML(item.id)}">삭제</button>
    `;
    listEl.appendChild(row);
  });
};

const addObservationRecord = () => {
  const studentSelect = document.getElementById('obs-student');
  const typeSelect = document.getElementById('obs-type');
  const abilitySelect = document.getElementById('obs-ability');
  const templateSelect = document.getElementById('obs-template');
  const memoInput = document.getElementById('obs-memo');
  const studentOptions = Array.from(studentSelect?.selectedOptions || []);
  const type = typeSelect?.value || '';
  const ability = abilitySelect?.value || '';
  const template = templateSelect?.value || '';
  const memo = memoInput?.value.trim() || '';
  const startDate = document.getElementById('obs-date-start')?.value || '';
  const endDate = document.getElementById('obs-date-end')?.value || '';

  if (studentOptions.length === 0) { alert('학생을 선택하세요.'); return; }
  if (!type) { alert('종류를 선택하세요.'); return; }
  if (!ability) { alert('능력치를 선택하세요.'); return; }
  if (!template) { alert('문장 템플릿을 선택하세요.'); return; }
  if (!startDate || !endDate) { alert('기간을 선택하세요.'); return; }
  if (String(endDate) < String(startDate)) { alert('기간 종료일이 시작일보다 빠릅니다.'); return; }
  
  studentOptions.forEach(option => {
    const studentId = option.value || '';
    const studentName = option.dataset.name || '';
    const record = {
      id: ObservationStorage.createObservationId(),
      studentId,
      studentName,
      type,
      ability,
      template,
      memo,
      startDate,
      endDate,
      date: startDate,
      createdAt: new Date().toISOString(),
    };
    ObservationStorage.addObservation(record);
  });
  if (memoInput) memoInput.value = '';
  renderObservationList();
};

const bindObservationEvents = () => {
  document.getElementById('obs-type')?.addEventListener('change', renderObservationTemplates);
  document.getElementById('obs-add-btn')?.addEventListener('click', addObservationRecord);
  document.getElementById('obs-filter-start')?.addEventListener('change', () => {
    const monthInput = document.getElementById('obs-filter-month');
    if (monthInput) monthInput.value = '';
    renderObservationList();
  });
  document.getElementById('obs-filter-end')?.addEventListener('change', () => {
    const monthInput = document.getElementById('obs-filter-month');
    if (monthInput) monthInput.value = '';
    renderObservationList();
  });
  document.getElementById('obs-filter-month')?.addEventListener('change', () => {
    const monthInput = document.getElementById('obs-filter-month');
    const monthRange = getMonthRange(monthInput?.value || '');
    const startInput = document.getElementById('obs-filter-start');
    const endInput = document.getElementById('obs-filter-end');
    if (monthRange) {
      if (startInput) startInput.value = monthRange.start;
      if (endInput) endInput.value = monthRange.end;
    }
    renderObservationList();
  });
  document.getElementById('obs-filter-month-btn')?.addEventListener('click', () => {
    document.getElementById('obs-filter-month')?.focus();
  });
  document.getElementById('obs-filter-student')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-type')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-ability')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-sort')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-search')?.addEventListener('input', renderObservationList);
  document.getElementById('obs-list')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm('해당 관찰 기록을 삭제할까요?')) return;
    ObservationStorage.deleteObservation(id);
    renderObservationList();
  });

  window.addEventListener('students:updated', () => {
    renderObservationStudentOptions();
    renderObservationList();
  });
};

const initObservations = () => {
  bindObservationEvents();
};

const showObservations = () => {
  renderObservationStudentOptions();
  initializeObservationDate();
  renderObservationTemplates();
  renderObservationList();
};

export { initObservations, showObservations };
