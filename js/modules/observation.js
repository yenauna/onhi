import { ObservationStorage } from '../storage.js';

const { pad2, escapeHTML, formatKoreanDate, sortStudents, loadStudents } = window;

const OBS_TEMPLATES = {
  '책임': {
    '칭찬': [
      '기한 내에 과제 제출.',
      '맡은 일을 제대로 함.',
    ],
    '조언': [
      '과제 미제출.',
      '준비물을 챙기지 않음.',
      '수업 시간에 떠들음.',
      '복도에서 뜀.',
    ],
  },
  '노력': {
    '칭찬': [
      '꾸준히 연습함.',
      '주변에 도움을 요청하여 익히고 배움.',
      '틀린 문제를 다시 풀어봄.',
      '부정적인 감정을 스스로 조절함.',
    ],
    '조언': [
      '시작을 미룸.',
      '어려움을 느끼자마자 포기함.',
      '집중하려는 시도 없이 계속 산만한 모습을 보임.',
    ],
  },
  '성취': {
    '칭찬': [
      '시험 점수 상승함.',
      '조건에 맞게 과제를 완성함.',
      '문제 푸는 속도가 빨라짐.',
      '과제 완성도가 높음.',
    ],
    '조언': [
      '과제 조건에 맞추지 못함.',
      '같은 유형으로 실수를 반복함.',
    ],
  },
  '관계': {
    '칭찬': [
      '친구를 도와줌.',
      '친절하게 말함.',
      '대화로 갈등을 해결함.',
      '모둠 활동에서 협력함.',
      '친구에게 먼저 다가감.',
    ],
    '조언': [
      '놀림.',
      '험한 말을 함.',
      '다른 사람의 물건을 허락 없이 만짐.',
      '다른 친구의 참여를 막음.',
    ],
  },
};

let selectedStudentIds = new Set();
let editingObservationId = '';

const getStudentsSorted = async () => sortStudents(await loadStudents());

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const initializeObservationDate = () => {
  const dateInput = document.getElementById('obs-date');
  if (!dateInput) return;
  const today = getTodayString();
  if (!dateInput.value) dateInput.value = today;
  if (endInput && !endInput.value) endInput.value = today;
};

const renderObservationTemplates = () => {
  const select = document.getElementById('obs-template');
  const typeSelect = document.getElementById('obs-type');
  const abilitySelect = document.getElementById('obs-ability');
  if (!select || !typeSelect || !abilitySelect) return;
  const type = typeSelect.value || '칭찬';
  const ability = abilitySelect.value || '책임';
  const templates = OBS_TEMPLATES[ability]?.[type] || [];
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

const setAddButtonLabel = () => {
  const addBtn = document.getElementById('obs-add-btn');
  if (!addBtn) return;
  addBtn.textContent = editingObservationId ? '수정' : '저장';
};

const formBox = document.getElementById('obs-student');
  const formBox = document.getElementById('obs-student');
  const filterSelect = document.getElementById('obs-filter-student');
  const students = await getStudentsSorted();

  if (formBox) {
    formBox.innerHTML = '';
    if (students.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'obs-card';
      empty.textContent = '학생 없음';
      formBox.appendChild(empty);
    } else {
      selectedStudentIds = new Set(
        [...selectedStudentIds].filter(id => students.some(stu => String(stu.id) === String(id))),
      );
      students.forEach(stu => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'obs-student-card';
        button.dataset.id = stu.id;
        button.dataset.name = stu.name;
        button.textContent = stu.name;
        button.title = `${stu.id} ${stu.name}`;
        if (selectedStudentIds.has(String(stu.id))) button.classList.add('is-selected');
        formBox.appendChild(button);
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
  date: document.getElementById('obs-filter-start')?.value || '',
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
  const rangeStart = monthRange?.start || filters.date;
  const rangeEnd = monthRange?.end || filters.date;
  const list = ObservationStorage.loadObservations()
    .slice()
    .filter(item => {
      const recordDate = item.date || item.startDate || '';
      if (rangeStart && String(recordDate) < String(rangeStart)) return false;
      if (rangeEnd && String(recordDate) > String(rangeEnd)) return false;
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
        ].join(' ').toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === 'input') {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      }
      const dateA = a.date || a.startDate || '';
      const dateB = b.date || b.startDate || '';
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
    const recordDate = item.date || item.startDate || '';
    const formattedDate = formatKoreanDate?.(recordDate) ?? recordDate;
    const memoText = [item.template || '', item.memo || ''].filter(Boolean).join(' · ');
    const typeClass = item.type === '칭찬'
      ? 'type-praise'
      : item.type === '조언'
        ? 'type-advice'
        : 'type-record';
    row.innerHTML = `
      <div class="meta">${escapeHTML(formattedDate)}</div>
      <div><strong>${escapeHTML(item.studentName || '')}</strong></div>
      <div class="obs-ability">${escapeHTML(item.ability || '')}</div>
      <button type="button" data-id="${escapeHTML(item.id)}">수정</button>
      <div class="obs-type ${typeClass}">${escapeHTML(item.type || '')}</div>
      <div class="note">${escapeHTML(memoText)}</div>
    `;
    listEl.appendChild(row);
  });
};

const addObservationRecord = () => {
  const typeSelect = document.getElementById('obs-type');
  const abilitySelect = document.getElementById('obs-ability');
  const templateSelect = document.getElementById('obs-template');
  const memoInput = document.getElementById('obs-memo');
  const type = typeSelect?.value || '';
  const ability = abilitySelect?.value || '';
  const template = templateSelect?.value || '';
  const memo = memoInput?.value.trim() || '';
  const date = document.getElementById('obs-date')?.value || '';

  if (selectedStudentIds.size === 0) { alert('학생을 선택하세요.'); return; }
  if (!type) { alert('종류를 선택하세요.'); return; }
  if (!ability) { alert('경치를 선택하세요.'); return; }
  if (!template) { alert('문장 템플릿을 선택하세요.'); return; }
  if (!date) { alert('날짜를 선택하세요.'); return; }

  if (editingObservationId) {
    const targetStudentId = [...selectedStudentIds][0];
    const studentButton = document.querySelector(`.obs-student-card[data-id="${CSS.escape(String(targetStudentId))}"]`);
    ObservationStorage.updateObservation(editingObservationId, {
      studentId: targetStudentId,
      studentName: studentButton?.dataset.name || '',
      type,
      ability,
      template,
      memo,
      date,
      startDate: date,
      endDate: date,
    });
    editingObservationId = '';
  } else {
    [...selectedStudentIds].forEach(studentId => {
      const studentButton = document.querySelector(`.obs-student-card[data-id="${CSS.escape(String(studentId))}"]`);
      const record = {
        id: ObservationStorage.createObservationId(),
        studentId,
        studentName: studentButton?.dataset.name || '',
        type,
        ability,
        template,
        memo,
        date,
        startDate: date,
        endDate: date,
        createdAt: new Date().toISOString(),
      };
      ObservationStorage.addObservation(record);
    });
  }
  if (memoInput) memoInput.value = '';
  selectedStudentIds = new Set();
  document.querySelectorAll('.obs-student-card').forEach(el => el.classList.remove('is-selected'));
  setAddButtonLabel();
  renderObservationList();
};

const bindObservationEvents = () => {
  document.getElementById('obs-type')?.addEventListener('change', renderObservationTemplates);
  document.getElementById('obs-ability')?.addEventListener('change', renderObservationTemplates);
  document.getElementById('obs-add-btn')?.addEventListener('click', addObservationRecord);
  document.getElementById('obs-student')?.addEventListener('click', (event) => {
    const card = event.target.closest('.obs-student-card');
    if (!card) return;
    const id = String(card.dataset.id || '');
    if (!id) return;
    if (editingObservationId) {
      selectedStudentIds = new Set([id]);
      document.querySelectorAll('.obs-student-card').forEach(el => {
        el.classList.toggle('is-selected', el === card);
      });
      return;
    }
    if (selectedStudentIds.has(id)) {
      selectedStudentIds.delete(id);
      card.classList.remove('is-selected');
    } else {
      selectedStudentIds.add(id);
      card.classList.add('is-selected');
    }
  });
  document.getElementById('obs-filter-start')?.addEventListener('change', () => {
    const monthInput = document.getElementById('obs-filter-month');
    if (monthInput) monthInput.value = '';
    renderObservationList();
  });
  document.getElementById('obs-filter-month')?.addEventListener('change', () => {
    const monthInput = document.getElementById('obs-filter-month');
    const monthRange = getMonthRange(monthInput?.value || '');
    const startInput = document.getElementById('obs-filter-start');
    if (monthRange && startInput) startInput.value = monthRange.start;
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
    const target = ObservationStorage.loadObservations().find(item => item.id === id);
    if (!target) return;

    editingObservationId = id;
    selectedStudentIds = new Set([String(target.studentId)]);
    document.querySelectorAll('.obs-student-card').forEach(el => {
      el.classList.toggle('is-selected', el.dataset.id === String(target.studentId));
    });
    const typeEl = document.getElementById('obs-type');
    const abilityEl = document.getElementById('obs-ability');
    const dateEl = document.getElementById('obs-date');
    const memoEl = document.getElementById('obs-memo');
    if (typeEl) typeEl.value = target.type || '칭찬';
    renderObservationTemplates();
    const templateEl = document.getElementById('obs-template');
    if (templateEl) templateEl.value = target.template || '';
    if (abilityEl) abilityEl.value = target.ability || '';
    if (dateEl) dateEl.value = target.date || target.startDate || '';
    if (memoEl) memoEl.value = target.memo || '';
    setAddButtonLabel();
  });

  window.addEventListener('students:updated', async () => {
    await renderObservationStudentOptions();
    renderObservationList();
  });
};

const initObservations = () => {
  bindObservationEvents();
};

const showObservations = async () => {
  await renderObservationStudentOptions();
  initializeObservationDate();
  renderObservationTemplates();
  setAddButtonLabel();
  renderObservationList();
};

export { initObservations, showObservations };
