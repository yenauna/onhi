window.teacherAppReady = false;

import { initAssignments, showStatus, showAssignments, hideActionUI } from './modules/assignments.js';
import { initObservations, showObservations } from './modules/observation.js';
import { initStudents, showStudents } from './modules/students.js';
import { initChallenges, showChallenges } from './modules/challenges.js';
import { initCounseling } from './modules/counseling.js';

const TEACHER_ROUTES = {
  status: {
    key: 'status',
    label: '학생 현황',
    sectionId: 'student-status-page',
    boxId: 'main-box',
    render: showStatus,
  },
  task: {
    key: 'task',
    label: '달력',
    sectionId: 'task-management',
    boxId: 'main-box',
    render: showAssignments,
    keepActionUI: true,
  },
  challenges: {
    key: 'challenges',
    label: '도전',
    sectionId: 'challenges-box',
    boxId: 'challenges-box',
    render: showChallenges,
    keepActionUI: true,
  },
  observation: {
    key: 'observation',
    label: '관찰기록',
    sectionId: 'observation-management',
    boxId: 'main-box',
    render: showObservations,
  },
  student: {
    key: 'student',
    label: '학생 관리',
    sectionId: 'student-management',
    boxId: 'main-box',
    render: showStudents,
  },
};

const ROUTE_KEYS = Object.keys(TEACHER_ROUTES);
const SECTION_IDS = ROUTE_KEYS.map((key) => TEACHER_ROUTES[key].sectionId);

const getRoute = (key) => TEACHER_ROUTES[key] || TEACHER_ROUTES.status;

const getRouteFromHash = () => {
  const key = (location.hash || '').replace('#', '').toLowerCase();
  return getRoute(key);
};

const setActiveRoute = (key) => {
  const sidebar = document.getElementById('left-sidebar');
  if (sidebar) sidebar.dataset.active = key;

  document.querySelectorAll('#left-sidebar [data-tab-key]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabKey === key);
  });  
};

const renderPageTabs = (route) => {
  const container = document.getElementById('page-tabs');
  if (!container) return;
    container.innerHTML = `
    <span class="tab-chip is-main">${route.label}</span>
    <span class="tab-chip">페이지별 상단탭(추후 반영)</span>
  `;
};

const showElement = (id, show) => {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
};

const showRouteSection = (route) => {
  const isChallengeRoute = route.boxId === 'challenges-box';
  showElement('main-box', !isChallengeRoute);
  showElement('challenges-box', isChallengeRoute);
  
  SECTION_IDS.forEach((id) => {
    if (id === 'challenges-box') return;
    showElement(id, id === route.sectionId);
  });
};

const showRoute = (key) => {
  const route = getRoute(key);
  setActiveRoute(route.key);
  renderPageTabs(route);
  showRouteSection(route);

  if (!route.keepActionUI) {
  }

  route.render?.();
};

const openRouteFromHash = () => {
  showRoute(getRouteFromHash().key);
};

const navigateToRoute = (key) => {
  const route = getRoute(key);
  const targetHash = `#${route.key}`;
  if (location.hash === targetHash) {
    openRouteFromHash();
  } else {
    location.hash = route.key;
  }
};

const initTeacherRouter = () => {
  window.onhiTeacherNavigate = navigateToRoute;
  openRouteFromHash();
  if (window.teacherRouterHashBound === 'true') return;
  window.teacherRouterHashBound = 'true';
  window.addEventListener('hashchange', openRouteFromHash);

};

window.TEACHER_ROUTES = TEACHER_ROUTES;
let teacherAppInitialized = false;

const initTeacherApp = () => {
  // [잠금 기능 추가] teacher_auth 인증 완료 전에는 교사용 앱 초기화 지연
  if (sessionStorage.getItem('teacher_auth') !== 'ok') return;

  if (!teacherAppInitialized) {
    teacherAppInitialized = true;
    window.teacherAppReady = true;

    if (typeof window.migrateToUIDOnce === 'function') window.migrateToUIDOnce();

    initAssignments();
    initObservations();
    initStudents();
    initChallenges();
    initCounseling();
  }

  window.renderTeacherSidebar?.(document.getElementById('left-sidebar'));
  initTeacherRouter();
};

document.addEventListener('DOMContentLoaded', initTeacherApp);
window.addEventListener('onhi:teacher-unlocked', initTeacherApp, { once: true });
