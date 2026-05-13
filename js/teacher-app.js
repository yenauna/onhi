window.teacherAppReady = true;

import { initAssignments, showStatus, showAssignments, hideActionUI } from './modules/assignments.js';
import { initObservations, showObservations } from './modules/observation.js';import { initStudents, showStudents } from './modules/students.js';
import { initChallenges, showChallenges } from './modules/challenges.js';
import { initToolsLink } from './modules/tools-link.js';
import { initCounseling } from './modules/counseling.js';

const setActiveTab = (key) => {
  const map = {
    status: document.getElementById('tab-status'),
    task: document.getElementById('tab-task'),
    assignment: document.getElementById('tab-assignment-shortcut'),
    challenges: document.getElementById('tab-challenges'),
    observation: document.getElementById('tab-observation'),
    student: document.getElementById('tab-student'),
  };
  Object.values(map).forEach(btn => btn && btn.classList.remove('active'));
  if (map[key]) map[key].classList.add('active');
};

const renderPageTabs = (key) => {
  const container = document.getElementById('page-tabs');
  if (!container) return;
  const pageName = {
    status: '학생 현황',
    task: '일정 / 과제',
    challenges: '도전',
    observation: '관찰기록',
    student: '학생 관리',
  }[key] || '페이지';
  container.innerHTML = `
    <span class="tab-chip is-main">${pageName}</span>
    <span class="tab-chip">페이지별 상단탭(추후 반영)</span>
  `;
};

const showSection = (id, show) => {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
};

const showTab = (key) => {
  const mainBox = document.getElementById('main-box');
  const challengesBox = document.getElementById('challenges-box');

  if (key === 'challenges') {
    setActiveTab('challenges');
    renderPageTabs('challenges');
    if (mainBox) mainBox.style.display = 'none';
    if (challengesBox) challengesBox.style.display = 'block';
    showSection('student-status-page', false);
    showSection('task-management', false);
    showSection('student-management', false);
    showSection('observation-management', false);
    showChallenges();
    return;
  }

  if (mainBox) mainBox.style.display = 'block';
  if (challengesBox) challengesBox.style.display = 'none';

  if (key === 'status') {
    setActiveTab('status');
    renderPageTabs('status');
    showSection('student-status-page', true);
    showSection('task-management', false);
    showSection('student-management', false);
    showSection('observation-management', false);
    hideActionUI();
    showStatus();
    return;
  }

  if (key === 'task') {
    setActiveTab('task');
    renderPageTabs('task');
    showSection('student-status-page', false);
    showSection('task-management', true);
    showSection('student-management', false);
    showSection('observation-management', false);
    showAssignments();
    return;
  }

  if (key === 'observation') {
    setActiveTab('observation');
    renderPageTabs('observation');
    showSection('student-status-page', false);
    showSection('task-management', false);
    showSection('student-management', false);
    showSection('observation-management', true);
    hideActionUI();
    showObservations();
    return;
  }

  if (key === 'student') {
    setActiveTab('student');
    renderPageTabs('student');
    showSection('student-status-page', false);
    showSection('task-management', false);
    showSection('student-management', true);
    showSection('observation-management', false);
    hideActionUI();
    showStudents();
    return;
  }
};

const openTabFromHash = () => {
  const hash = (location.hash || '').replace('#', '').toLowerCase();
  switch (hash) {
    case 'task':
      showTab('task');
      break;
    case 'challenges':
      showTab('challenges');
      break;
    case 'observation':
      showTab('observation');
      break;
    case 'student':
      showTab('student');
      break;
    case 'status':
    default:
      showTab('status');
      break;
  }
};

const navigateToTab = (key) => {
  const targetHash = `#${key}`;
  if (location.hash === targetHash) {
    openTabFromHash();
  } else {
    location.hash = key;
  }
};

const initTabs = () => {
  document.getElementById('tab-status')?.addEventListener('click', () => navigateToTab('status'));
  document.getElementById('tab-task')?.addEventListener('click', () => navigateToTab('task'));
  document.getElementById('tab-assignment-shortcut')?.addEventListener('click', () => navigateToTab('task'));
  document.getElementById('tab-challenges')?.addEventListener('click', () => navigateToTab('challenges'));
  document.getElementById('tab-observation')?.addEventListener('click', () => navigateToTab('observation'));
  document.getElementById('tab-student')?.addEventListener('click', () => navigateToTab('student'));
  document.getElementById('tab-settings')?.addEventListener('click', () => alert('설정 탭은 추후 반영 예정입니다.'));

  const sidebar = document.getElementById('left-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('is-collapsed');
    const isCollapsed = sidebar?.classList.contains('is-collapsed');
    toggleBtn.textContent = isCollapsed ? '☰ 메뉴 펼치기' : '☰ 메뉴 접기';
  });
};

const initTeacherApp = () => {
  // [잠금 기능 추가] teacher_auth 인증 완료 전에는 교사용 앱 초기화 지연
  if (sessionStorage.getItem('teacher_auth') !== 'ok') return;
  
  window.teacherAppReady = true;

  if (typeof window.migrateToUIDOnce === 'function') window.migrateToUIDOnce();

  initAssignments();
  initObservations();
  initStudents();
  initChallenges();
  initToolsLink();
  initCounseling();

  initTabs();
  openTabFromHash();
  window.addEventListener('hashchange', openTabFromHash);
};

document.addEventListener('DOMContentLoaded', initTeacherApp);
window.addEventListener('onhi:teacher-unlocked', initTeacherApp, { once: true });
