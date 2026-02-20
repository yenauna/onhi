const { loadStudents, sortStudents, invalidateStudentsCache, pad2, addStudentToSupabase } = window;

const getJSON = window.getJSON || ((key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
});
const setJSON = window.setJSON || ((key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
});

const setGenderButtonState = (btn, gender) => {
  if (!btn) return;
  const value = gender === '여자' ? '여자' : '남자';
  btn.dataset.gender = value;
  btn.textContent = value;
  btn.setAttribute('aria-pressed', String(value === '남자'));
  btn.classList.toggle('is-female', value === '여자');
};

const toggleGender = (btn) => {
  if (!btn) return;
  const current = btn.dataset.gender === '여자' ? '여자' : '남자';
  const next = current === '남자' ? '여자' : '남자';
  setGenderButtonState(btn, next);
};

const renderStudentList = async () => {
  console.log('[Students] renderStudentList() start');
  const students = sortStudents(await loadStudents());
  const showAll = document.getElementById('show-all-passwords')?.checked;
  const tbody = document.querySelector('#student-list tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  students.forEach(stu => {
    const gender = stu.gender === '여자' ? '여자' : '남자';
    const tr = document.createElement('tr');
    tr.dataset.originalId = stu.id;
    tr.dataset.originalName = stu.name;
    tr.innerHTML = `
      <td class="col-id">
        <input data-field="id" value="${stu.id}" />
      </td>
      <td>
        <input data-field="name" value="${stu.name}" />
      </td>
      <td style="text-align:center;">
        <button type="button" class="gender-toggle-btn" data-gender="${gender}">${gender}</button>
      </td>
      <td>
        <input data-field="password" ${showAll ? 'type="text"' : 'type="password"'} value="${stu.password}" />
      </td>
      <td style="text-align:center;">
        <input type="checkbox" data-action="toggle-row-pw" ${showAll ? 'checked' : ''}/>
      </td>
      <td class="col-actions">
        <div class="actions">
          <button type="button" data-action="save-row">저장</button>
          <button type="button" data-action="delete-row">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    setGenderButtonState(tr.querySelector('.gender-toggle-btn'), gender);
  });

  console.log('[Students] renderStudentList() end', { rows: students.length });
};

const toggleRowPw = (checkboxEl) => {
  const tr = checkboxEl.closest('tr');
  const pwInput = tr.querySelector('input[data-field="password"]');
  if (!pwInput) return;
  pwInput.type = checkboxEl.checked ? 'text' : 'password';
};

const toggleAllPw = (masterCheckbox) => {
  const show = masterCheckbox.checked;
  document
    .querySelectorAll('#student-list tbody input[data-field="password"]')
    .forEach(inp => (inp.type = show ? 'text' : 'password'));
  document
    .querySelectorAll('#student-list tbody input[data-action="toggle-row-pw"]')
    .forEach(cb => (cb.checked = show));
};

const addStudent = async () => {
  console.log('[Students] addStudent() click event triggered');
  
  const id = document.getElementById('new-student-id').value.trim();
  const name = document.getElementById('new-student-name').value.trim();
  const password = document.getElementById('new-student-password').value.trim();
  const genderBtn = document.getElementById('new-student-gender');
  const gender = genderBtn?.dataset.gender === '여자' ? '여자' : '남자';

  if (!id || !name || !password) {
    alert('번호, 이름, 비밀번호를 모두 입력하세요.');
    return;
  }

  const students = await loadStudents();
  if (students.some(s => String(s.id) === String(id))) {
    alert('이미 존재하는 번호입니다.');
    return;
  }

  const today = new Date();
  const joined = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
 
  const { error } = await addStudentToSupabase({ id, name, password, joined, gender });
  if (error) {
    alert(`학생 추가 실패: ${error.message || '알 수 없는 오류'}`);
    return;
  }

  document.getElementById('new-student-id').value = '';
  document.getElementById('new-student-name').value = '';
  document.getElementById('new-student-password').value = '';
  setGenderButtonState(genderBtn, '남자');

  invalidateStudentsCache?.();
  await renderStudentList();
  window.dispatchEvent(new Event('students:updated'));
  window.renderStudentStatus?.();
};

const saveStudents = (students) => {
  setJSON('students', students);
  invalidateStudentsCache?.();
};

const saveStudentRow = async (tr) => {
  const newId = tr.querySelector('input[data-field="id"]').value.trim();
  const newName = tr.querySelector('input[data-field="name"]').value.trim();
  const newPw = tr.querySelector('input[data-field="password"]').value.trim();
  const genderBtn = tr.querySelector('.gender-toggle-btn');
  const newGender = genderBtn?.dataset.gender === '여자' ? '여자' : '남자';

  if (!newId || !newName || !newPw) {
    alert('번호, 이름, 비밀번호를 모두 입력하세요.');
    return;
  }

  const students = await loadStudents();
  const oldId = tr.dataset.originalId;
  const oldName = tr.dataset.originalName;
  const idx = students.findIndex(s => String(s.id) === String(oldId) && s.name === oldName);
  if (idx < 0) {
    alert('대상 학생을 찾을 수 없습니다.');
    return;
  }

  if (String(newId) !== String(oldId) && students.some(s => String(s.id) === String(newId))) {
    alert('이미 존재하는 번호입니다.');
    return;
  }

  const prev = students[idx];
  const joined = prev.joined;
  students[idx] = { ...prev, id: newId, name: newName, password: newPw, gender: newGender, joined };
  saveStudents(students);

  await renderStudentList();
  window.dispatchEvent(new Event('students:updated'));
  window.renderStudentStatus?.();
};

const deleteStudentByRow = async (tr) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  const id = tr.dataset.originalId;
  const name = tr.dataset.originalName;
  const students = await loadStudents();
  const idx = students.findIndex(s => String(s.id) === String(id) && s.name === name);

  if (idx >= 0) {
    students.splice(idx, 1);
    saveStudents(students);

    await renderStudentList();
    window.dispatchEvent(new Event('students:updated'));
    window.renderStudentStatus?.();
  }
};

const bindStudentEvents = () => {
  const genderBtn = document.getElementById('new-student-gender');
  setGenderButtonState(genderBtn, genderBtn?.dataset.gender || '남자');
  genderBtn?.addEventListener('click', () => toggleGender(genderBtn));

  const addButton = document.getElementById('add-student-btn');
  console.log('[Students] bind add button:', addButton ? 'connected' : 'missing #add-student-btn');
  addButton?.addEventListener('click', addStudent);
  document.getElementById('show-all-passwords')?.addEventListener('change', (event) => {
    toggleAllPw(event.target);
  });

  const table = document.getElementById('student-list');
  table?.addEventListener('click', (event) => {
    const genderToggle = event.target.closest('.gender-toggle-btn');
    if (genderToggle) {
      toggleGender(genderToggle);
      return;
    }

    const actionBtn = event.target.closest('button[data-action]');
    if (!actionBtn) return;
    const tr = actionBtn.closest('tr');
    if (!tr) return;
    if (actionBtn.dataset.action === 'save-row') saveStudentRow(tr);
    if (actionBtn.dataset.action === 'delete-row') deleteStudentByRow(tr);
  });

  table?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-action="toggle-row-pw"]');
    if (!checkbox) return;
    toggleRowPw(checkbox);
  });
};

const initStudents = () => {
  bindStudentEvents();
};

const showStudents = async () => {
  await renderStudentList();
};

export { initStudents, showStudents };
