import { initAssignments, showStatus, showAssignments, hideActionUI } from './modules/assignments.js';
import { initObservations, showObservations } from './modules/observations.js';
import { initStudents, showStudents } from './modules/students.js';
import { initChallenges, showChallenges } from './modules/challenges.js';
import { initToolsLink } from './modules/tools-link.js';
import { initCounseling } from './modules/counseling.js';

const setActiveTab = (key) => {
  const map = {
    status: document.getElementById('tab-status'),
    task: document.getElementById('tab-task'),
    challenges: document.getElementById('tab-challenges'),
    observation: document.getElementById('tab-observation'),
    student: document.getElementById('tab-student'),
  };
  Object.values(map).forEach(btn => btn && btn.classList.remove('active'));
  if (map[key]) map[key].classList.add('active');
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
    showSection('student-status-page', false);
    showSection('task-management', true);
    showSection('student-management', false);
    showSection('observation-management', false);
    showAssignments();
    return;
  }

  if (key === 'observation') {
    setActiveTab('observation');
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
  document.getElementById('tab-challenges')?.addEventListener('click', () => navigateToTab('challenges'));
  document.getElementById('tab-observation')?.addEventListener('click', () => navigateToTab('observation'));
  document.getElementById('tab-student')?.addEventListener('click', () => navigateToTab('student'));
};

const initTeacherApp = () => {
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
