import { ObservationStorage } from '../storage.js';

const { pad2, escapeHTML, formatKoreanDate, sortStudents, loadStudents } = window;

const OBS_TEMPLATES = {
  책임: {
    칭찬: [
      '기한 내에 과제 제출.',
      '맡은 일을 제대로 함.',
    ],
    조언: [
      '과제 미제출.',
      '준비물을 챙기지 않음.',
      '수업 시간에 떠들음.',
      '복도에서 뜀.',
    ],
  },
  노력: {
    칭찬: [
      '꾸준히 연습함.',
      '주변에 도움을 요청하여 익히고 배움.',
      '틀린 문제를 다시 풀어봄.',
      '부정적인 감정을 스스로 조절함.',
    ],
    조언: [
      '시작을 미룸.',
      '어려움을 느끼자마자 포기함.',
      '집중하려는 시도 없이 계속 산만한 모습을 보임.',
    ],
  },
  성취: {
    칭찬: [
      '시험 점수 상승함.',
      '조건에 맞게 과제를 완성함.',
      '문제 푸는 속도가 빨라짐.',
      '과제 완성도가 높음.',
    ],
    조언: [
      '과제 조건에 맞추지 못함.',
      '같은 유형으로 실수를 반복함.',
    ],
  },
  관계: {
    칭찬: [
      '친구를 도와줌.',
      '친절하게 말함.',
      '대화로 갈등을 해결함.',
      '모둠 활동에서 협력함.',
      '친구에게 먼저 다가감.',
    ],
    조언: [
      '놀림.',
      '험한 말을 함.',
      '다른 사람의 물건을 허락 없이 만짐.',
      '다른 친구의 참여를 막음.',
    ],
  },
};

let selectedStudentIds = new Set();
let expandedObservationActionId = '';

const getTypeClass = (type) => (type === '칭찬'
  ? 'type-praise'
  : type === '조언'
    ? 'type-advice'
    : 'type-record');

const getTypeClassForSelect = (type) => (type === '칭찬'
  ? 'type-praise'
  : type === '조언'
    ? 'type-advice'
    : 'type-record');

const getAbilityClass = (ability) => (ability === '책임'
  ? 'ability-responsibility'
  : ability === '노력'
    ? 'ability-effort'
    : ability === '성취'
      ? 'ability-achievement'
      : ability === '관계'
        ? 'ability-relationship'
        : 'ability-none');

const getObservationAbilities = (item) => {
  if (Array.isArray(item?.abilities)) {
    return item.abilities.filter((ability) => ['책임', '노력', '성취', '관계'].includes(ability));
  }
  if (item?.ability) return [item.ability];
  return [];
};

const updateTypeSelectColor = () => {
  const typeSelect = document.getElementById('obs-type');
  if (!typeSelect) return;
  typeSelect.classList.remove('type-praise', 'type-advice', 'type-record');
  typeSelect.classList.add(getTypeClassForSelect(typeSelect.value || '기록'));
};

const updateAbilitySelectColor = () => {
  const abilitySelect = document.getElementById('obs-ability');
  if (!abilitySelect) return;
  abilitySelect.classList.remove('ability-responsibility', 'ability-effort', 'ability-achievement', 'ability-relationship', 'ability-none');
  abilitySelect.classList.add(getAbilityClass(abilitySelect.value || ''));
};

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
  };

const applyObservationTypeRules = () => {
  const type = document.getElementById('obs-type')?.value || '';
  const abilitySelect = document.getElementById('obs-ability');
  if (!abilitySelect) return;

  const noneOption = abilitySelect.querySelector("option[value='']");
  
  if (type === '기록') {
    if (noneOption) {
      noneOption.hidden = false;
      noneOption.disabled = false;
    }
    abilitySelect.value = '';
    abilitySelect.required = false;
  } else {
    if (noneOption) {
      noneOption.hidden = true;
      noneOption.disabled = true;
    }
    if (!abilitySelect.value || abilitySelect.value === '') {
      abilitySelect.value = '책임';
    }
    abilitySelect.required = true;
  }

  updateAbilitySelectColor();
};

const renderObservationTemplates = () => {
  const select = document.getElementById('obs-template');
  const trigger = document.getElementById('obs-template-trigger');
  const menu = document.getElementById('obs-template-menu');
  const typeSelect = document.getElementById('obs-type');
  const abilitySelect = document.getElementById('obs-ability');
  if (!select || !typeSelect || !abilitySelect || !trigger || !menu) return;
  
  const type = typeSelect.value || '칭찬';
  const ability = abilitySelect.value || '';
  const templates = type === '기록' || !ability
    ? []
    : (OBS_TEMPLATES[ability]?.[type] || []);
  
  const selectedText = select.value || '';
  trigger.textContent = selectedText || '문장템플릿';
  menu.innerHTML = '';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'obs-template-item';
  clearBtn.dataset.value = '';
  clearBtn.textContent = type === '기록' ? '직접 작성' : '문장 비우기';
  menu.appendChild(clearBtn);
 
  templates.forEach((text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'obs-template-item';
    button.dataset.value = text;
    button.textContent = text;
    menu.appendChild(button);
  });
};

const setAddButtonLabel = () => {
  const addBtn = document.getElementById('obs-add-btn');
  if (!addBtn) return;
  addBtn.textContent = '저장';
};

const renderObservationStudentOptions = async () => {
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
      students.forEach((stu) => {
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
    const previousValue = filterSelect.value;
    filterSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '전체 학생';
    filterSelect.appendChild(allOption);
    
    students.forEach((stu) => {
      const option = document.createElement('option');
      option.value = stu.id;
      option.dataset.name = stu.name;
      option.textContent = `${stu.id} ${stu.name}`;
      filterSelect.appendChild(option);
    });

    const keepValue = students.some(stu => String(stu.id) === String(previousValue));
    filterSelect.value = keepValue ? previousValue : '';
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
  mode: document.getElementById('obs-filter-mode')?.value || 'day',
  day: document.getElementById('obs-filter-day')?.value || '',
  month: document.getElementById('obs-filter-month')?.value || '',
  year: document.getElementById('obs-filter-year')?.value || '',
  rangeStart: document.getElementById('obs-filter-range-start')?.value || '',
  rangeEnd: document.getElementById('obs-filter-range-end')?.value || '',
  studentId: document.getElementById('obs-filter-student')?.value || '',
  type: document.getElementById('obs-filter-type')?.value || '',
  ability: document.getElementById('obs-filter-ability')?.value || '',
  sort: document.getElementById('obs-filter-sort')?.value || 'latest',
  search: document.getElementById('obs-filter-search')?.value.trim().toLowerCase() || '',
});

const getYearRange = (yearValue) => {
  const year = Number(yearValue);
  if (!year || year < 1) return null;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};

const getDateFilterRange = (filters) => {
  if (filters.mode === 'month') return getMonthRange(filters.month);
  if (filters.mode === 'year') return getYearRange(filters.year);  if (filters.mode === 'range') {
    const start = filters.rangeStart || '';
    const end = filters.rangeEnd || start;
    if (!start && !end) return null;
    return {
      start: start || end,
      end: end || start,
    };
  }
  if (!filters.day) return null;
  return { start: filters.day, end: filters.day };
};

const getFilteredObservationList = () => {
  const filters = getObservationFilters();
  const dateRange = getDateFilterRange(filters);
  const rangeStart = dateRange?.start || '';
  const rangeEnd = dateRange?.end || '';
  
  return ObservationStorage.loadObservations()
    .slice()
    .filter((item) => {
      const recordDate = item.date || item.startDate || '';
      if (rangeStart && String(recordDate) < String(rangeStart)) return false;
      if (rangeEnd && String(recordDate) > String(rangeEnd)) return false;
      if (filters.studentId && String(item.studentId) !== String(filters.studentId)) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.ability) {
        const abilities = getObservationAbilities(item);
        if (!abilities.includes(filters.ability)) return false;
      }
      if (filters.search) {
        const haystack = [
          item.studentName,
          item.template,
          item.memo,
          item.type,
          getObservationAbilities(item).join(' '),
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
 };

const renderObservationDateFilterInputs = () => {
  const mode = document.getElementById('obs-filter-mode')?.value || 'day';
  const dayEl = document.getElementById('obs-filter-day');
  const monthEl = document.getElementById('obs-filter-month');
  const yearEl = document.getElementById('obs-filter-year');
  const rangeStartEl = document.getElementById('obs-filter-range-start');
  const rangeEndEl = document.getElementById('obs-filter-range-end');
  const rangeSepEl = document.getElementById('obs-filter-range-sep');
  if (!dayEl || !monthEl || !yearEl || !rangeStartEl || !rangeEndEl || !rangeSepEl) return;

  dayEl.style.display = mode === 'day' ? '' : 'none';
  monthEl.style.display = mode === 'month' ? '' : 'none';
  yearEl.style.display = mode === 'year' ? '' : 'none';
  rangeStartEl.style.display = mode === 'range' ? '' : 'none';
  rangeEndEl.style.display = mode === 'range' ? '' : 'none';
  rangeSepEl.style.display = mode === 'range' ? '' : 'none';
};

const renderObservationList = () => {
  const listEl = document.getElementById('obs-list');
  if (!listEl) return;

  const list = getFilteredObservationList();

  listEl.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'obs-card';
    empty.textContent = '조건에 맞는 관찰 기록이 없습니다.';
    listEl.appendChild(empty);
    return;
  }

  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'obs-item';
    const recordDate = item.date || item.startDate || '';
    const formattedDate = formatKoreanDate?.(recordDate) ?? recordDate;
    const memoText = [item.template || '', item.memo || ''].filter(Boolean).join(' · ');
    const abilities = getObservationAbilities(item);
    const abilityText = abilities.length ? abilities.join(', ') : '-';
    const typeClass = getTypeClass(item.type);
   const abilityClass = getAbilityClass(abilities[0] || '');
    const isEditing = expandedObservationActionId === item.id;
    const actionButtons = isEditing
      ? `<button type="button" data-action="save" data-id="${escapeHTML(item.id)}">적용</button>
         <button type="button" data-action="delete" data-id="${escapeHTML(item.id)}">삭제</button>`
      : `<button type="button" data-action="edit" data-id="${escapeHTML(item.id)}">수정</button>`;
    const editTypeOptions = ['칭찬', '기록', '조언']
      .map(type => `<option value="${type}"${item.type === type ? ' selected' : ''}>${type}</option>`)
      .join('');
    const editAbilityOptions = ['책임', '노력', '성취', '관계']
      .map(ability => `<option value="${ability}"${item.ability === ability ? ' selected' : ''}>${ability}</option>`)
      .join('');
    const editBlock = isEditing
      ? `<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">
           <select data-role="edit-type">${editTypeOptions}</select>
           <select data-role="edit-ability"><option value="">선택 안 함</option>${editAbilityOptions}</select>
           <input type="date" data-role="edit-date" value="${escapeHTML(recordDate)}" />
           <input type="text" data-role="edit-template" value="${escapeHTML(item.template || '')}" placeholder="문장 템플릿(선택)" />
           <input type="text" data-role="edit-memo" value="${escapeHTML(item.memo || '')}" placeholder="메모(선택)" style="grid-column:1 / -1;" />
         </div>`
      : '';
    row.classList.add(typeClass);
    row.innerHTML = `
      <div class="meta"><div>${escapeHTML(formattedDate)}</div><div>${escapeHTML(`${item.studentId || ''} ${item.studentName || ''}`.trim())}</div></div>
      <div class="main">
        <div class="headline">
        <span class="obs-type ${typeClass}">${escapeHTML(item.type || '')}</span>
          <span class="obs-ability ${abilityClass}">${escapeHTML(abilityText)}</span>
        </div>
        <div class="note">${escapeHTML(memoText || '-')}</div>
      </div>
      <div class="obs-actions">${actionButtons}</div>
      ${editBlock}
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
  if (type !== '기록' && !ability) { alert('경험치를 선택하세요.'); return; }
  if (!date) { alert('날짜를 선택하세요.'); return; }
  if (!template && !memo) { alert('기록 내용(템플릿 또는 메모)을 입력하세요.'); return; }

 [...selectedStudentIds].forEach((studentId) => {
    const studentButton = document.querySelector(`.obs-student-card[data-id="${CSS.escape(String(studentId))}"]`);
    const record = {
      id: ObservationStorage.createObservationId(),
      studentId,
      studentName: studentButton?.dataset.name || '',
      type,
      ability: type === '기록' ? '' : ability,
      abilities: type === '기록' ? [] : [ability],
      template,
      memo,
      date,
      startDate: date,
      endDate: date,
      createdAt: new Date().toISOString(),
    };
    ObservationStorage.addObservation(record);
  });
  
  if (memoInput) memoInput.value = '';
  const templateEl = document.getElementById('obs-template');
  if (templateEl) templateEl.value = '';
  selectedStudentIds = new Set();
  expandedObservationActionId = '';
  document.querySelectorAll('.obs-student-card').forEach(el => el.classList.remove('is-selected'));
  setAddButtonLabel();
  renderObservationList();
};

const bindObservationEvents = () => {
  document.getElementById('obs-type')?.addEventListener('change', () => {
    applyObservationTypeRules();
    updateTypeSelectColor();
    renderObservationTemplates();
  });
  document.getElementById('obs-ability')?.addEventListener('change', () => {
    updateAbilitySelectColor();
    renderObservationTemplates();
  });
  document.getElementById('obs-add-btn')?.addEventListener('click', addObservationRecord);
  
  document.getElementById('obs-student')?.addEventListener('click', (event) => {
    const card = event.target.closest('.obs-student-card');
    if (!card) return;
    const id = String(card.dataset.id || '');
    if (!id) return;
        
    if (selectedStudentIds.has(id)) {
      selectedStudentIds.delete(id);
      card.classList.remove('is-selected');
    } else {
      selectedStudentIds.add(id);
      card.classList.add('is-selected');
    }
  });

  document.getElementById('obs-filter-mode')?.addEventListener('change', () => {
    renderObservationDateFilterInputs();
    renderObservationList();
  });
  document.getElementById('obs-filter-day')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-month')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-year')?.addEventListener('input', renderObservationList);
  document.getElementById('obs-filter-range-start')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-range-end')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-student')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-type')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-ability')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-sort')?.addEventListener('change', renderObservationList);
  document.getElementById('obs-filter-search')?.addEventListener('input', renderObservationList);

  document.getElementById('obs-export-btn')?.addEventListener('click', () => {
    const list = getFilteredObservationList();
    if (!list.length) {
      alert('추출할 관찰 기록이 없습니다.');
      return;
    }

    const rows = list.map((item) => [
      item.date || item.startDate || '',
      item.studentName || '',
      item.type || '',
      getObservationAbilities(item).join(', '),
      [item.template || '', item.memo || ''].filter(Boolean).join(' · '),
    ]);

    const header = ['날짜', '이름', '종류', '경험치', '메모'];
    const toCell = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tableRows = [header, ...rows]
      .map((cols) => `<tr>${cols.map((col) => `<td>${toCell(col)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1">${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const today = getTodayString();
    a.download = `관찰기록_${today}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });
  
  document.getElementById('obs-template-trigger')?.addEventListener('click', () => {
    document.getElementById('obs-template-menu')?.classList.toggle('is-open');
  });
  document.getElementById('obs-template-menu')?.addEventListener('click', (event) => {
    const item = event.target.closest('.obs-template-item');
    if (!item) return;
    const value = item.dataset.value || '';
    const templateEl = document.getElementById('obs-template');
    const triggerEl = document.getElementById('obs-template-trigger');
    if (templateEl) templateEl.value = value;
    if (triggerEl) triggerEl.textContent = value || '문장템플릿';
    const memoEl = document.getElementById('obs-memo');
    if (memoEl && value) {
      memoEl.value = value;
      memoEl.focus();
      memoEl.setSelectionRange(memoEl.value.length, memoEl.value.length);
    }
    document.getElementById('obs-template-menu')?.classList.remove('is-open');
  });
  document.addEventListener('click', (event) => {
    const picker = event.target.closest('.obs-template-picker');
    if (!picker) document.getElementById('obs-template-menu')?.classList.remove('is-open');
  });
  
  document.getElementById('obs-list')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-id][data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (!id || !action) return;

    const target = ObservationStorage.loadObservations().find(item => item.id === id);
    if (!target) return;

    if (action === 'delete') {
      ObservationStorage.deleteObservation(id);
      expandedObservationActionId = '';
      setAddButtonLabel();
      renderObservationList();
      return;
    }

    if (action === 'edit') {
      expandedObservationActionId = id;
      renderObservationList();
    } else if (action === 'save') {
      const row = btn.closest('.obs-item');
      const type = row?.querySelector('[data-role="edit-type"]')?.value || '';
      const ability = row?.querySelector('[data-role="edit-ability"]')?.value || '';
      const date = row?.querySelector('[data-role="edit-date"]')?.value || '';
      const template = row?.querySelector('[data-role="edit-template"]')?.value?.trim() || '';
      const memo = row?.querySelector('[data-role="edit-memo"]')?.value?.trim() || '';
      if (!type) { alert('종류를 선택하세요.'); return; }
      if (type !== '기록' && !ability) { alert('경험치를 선택하세요.'); return; }
      if (!date) { alert('날짜를 선택하세요.'); return; }
      if (!template && !memo) { alert('기록 내용(템플릿 또는 메모)을 입력하세요.'); return; }
      ObservationStorage.updateObservation(id, {
        type,
        ability: type === '기록' ? '' : ability,
        abilities: type === '기록' ? [] : [ability],
        date,
        startDate: date,
        endDate: date,
        template,
        memo,
      });
      expandedObservationActionId = '';
      renderObservationList();
    }
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
  applyObservationTypeRules();
  updateTypeSelectColor();
  updateAbilitySelectColor();
  renderObservationTemplates();
  renderObservationDateFilterInputs();
  setAddButtonLabel();
  renderObservationList();
};

window.addEventListener('onhi:cloud-sync-applied', () => {
  if (!document.getElementById('observation-management')) return;
  renderObservationStudentOptions();
  renderObservationList();
});

export { initObservations, showObservations };
