window.teacherAppReady = true;

import { initAssignments, showStatus, showAssignments, hideActionUI } from './modules/assignments.js';
import { initObservations, showObservations } from './modules/observation.js';
import { initStudents, showStudents } from './modules/students.js';
import { initChallenges, showChallenges } from './modules/challenges.js';
import { initToolsLink } from './modules/tools-link.js';
import { initCounseling } from './modules/counseling.js';

const TAB_BUTTON_IDS = {
  status: 'tab-status',
  task: 'tab-task',
  assignment: 'tab-assignment-shortcut',
  challenges: 'tab-challenges',
  observation: 'tab-observation',
  student: 'tab-student',
};

const TAB_PAGE_NAMES = {
  status: '학생 현황',
  task: '일정 / 과제',
  challenges: '도전',
  observation: '관찰기록',
  student: '학생 관리',
};

const SECTION_IDS = ['student-status-page', 'task-management', 'student-management', 'observation-management'];

const TAB_RENDERERS = {
  status: showStatus,
  task: showAssignments,
  challenges: showChallenges,
  observation: showObservations,
  student: showStudents,
};

const TAB_SECTION_VISIBILITY = {
  status: { 'student-status-page': true },
  task: { 'task-management': true },
  observation: { 'observation-management': true },
  student: { 'student-management': true },
};

const setActiveTab = (key) => {
  Object.values(TAB_BUTTON_IDS).forEach((id) => {
    document.getElementById(id)?.classList.remove('active');
  });

  if (key === 'task') {
    document.getElementById(TAB_BUTTON_IDS.task)?.classList.add('active');
    document.getElementById(TAB_BUTTON_IDS.assignment)?.classList.add('active');
    return;
  }

  document.getElementById(TAB_BUTTON_IDS[key])?.classList.add('active');
};

const renderPageTabs = (key) => {
  const container = document.getElementById('page-tabs');
  if (!container) return;
  const pageName = TAB_PAGE_NAMES[key] || '페이지';
  container.innerHTML = `
    <span class="tab-chip is-main">${pageName}</span>
    <span class="tab-chip">페이지별 상단탭(추후 반영)</span>
  `;
};

const showSection = (id, show) => {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
};

const showOnlySections = (visibleMap = {}) => {
  SECTION_IDS.forEach((id) => {
    showSection(id, Boolean(visibleMap[id]));
  });
};

const showTab = (key) => {
  const mainBox = document.getElementById('main-box');
  const challengesBox = document.getElementById('challenges-box');
  const isChallengesTab = key === 'challenges';

  setActiveTab(key);
  renderPageTabs(key);

  if (mainBox) mainBox.style.display = isChallengesTab ? 'none' : 'block';
  if (challengesBox) challengesBox.style.display = isChallengesTab ? 'block' : 'none';
  
  showOnlySections(TAB_SECTION_VISIBILITY[key]);
  
  if (key !== 'task' && key !== 'challenges') {
    hideActionUI();
  }

  TAB_RENDERERS[key]?.();
};

const openTabFromHash = () => {
  const hash = (location.hash || '').replace('#', '').toLowerCase();
  const validTabs = new Set(['status', 'task', 'challenges', 'observation', 'student']);
  showTab(validTabs.has(hash) ? hash : 'status');
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
