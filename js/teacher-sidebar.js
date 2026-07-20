(function () {
  const TEACHER_MENU_ITEMS = [
    { key: 'status', label: '학생 현황', href: 'teacher.html#status' },
    { key: 'task', label: '달력', href: 'teacher.html#task' },
    { key: 'challenges', label: '도전', href: 'teacher.html#challenges' },
    { key: 'observation', label: '관찰기록', href: 'teacher.html#observation' },
    { key: 'tools', label: '도구', href: 'tool.html' },
    { key: 'settings', label: '설정', href: '#settings', disabled: true },
    { key: 'student', label: '학생 관리', href: 'teacher.html#student' },
  ];

  const getActiveKey = (sidebar) => {
    if (sidebar?.dataset.active) return sidebar.dataset.active;
    const path = location.pathname.split('/').pop() || 'teacher.html';
    if (path === 'tool.html') return 'tools';
    return (location.hash || '#status').replace('#', '').toLowerCase();
  };

  const isLockedTeacherPage = () => {
    const path = location.pathname.split('/').pop() || 'teacher.html';
    return path === 'teacher.html' && sessionStorage.getItem('teacher_auth') !== 'ok';
  };

  const renderTeacherSidebar = (selectorOrElement = '[data-teacher-sidebar]') => {
    const sidebar = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;
    if (!sidebar) return;

    if (isLockedTeacherPage()) {
      sidebar.innerHTML = '';
      return;
    }

    const activeKey = getActiveKey(sidebar);
    sidebar.id ||= 'left-sidebar';
    sidebar.classList.add('sidebar');
    sidebar.innerHTML = `
      <button type="button" id="sidebar-toggle" class="sidebar-toggle">☰ 메뉴 접기</button>
      <nav class="sidebar-nav" aria-label="좌측 메뉴">
        ${TEACHER_MENU_ITEMS.map((item) => `
          <button type="button" id="tab-${item.key}" data-tab-key="${item.key}" data-href="${item.href}"${item.disabled ? ' data-disabled="true"' : ''} class="${item.key === activeKey ? 'active' : ''}">
            <span class="menu-label">${item.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    const toggleBtn = sidebar.querySelector('#sidebar-toggle');
    toggleBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('is-collapsed');
      const isCollapsed = sidebar.classList.contains('is-collapsed');
      toggleBtn.textContent = isCollapsed ? '☰ 메뉴 펼치기' : '☰ 메뉴 접기';
    });

    const currentPage = location.pathname.split('/').pop() || 'teacher.html';
    sidebar.querySelectorAll('[data-href]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.disabled === 'true') {
          alert('설정 탭은 추후 반영 예정입니다.');
          return;
        }

        const key = button.dataset.tabKey;
        const href = button.dataset.href;
        const isTeacherRoute = currentPage === 'teacher.html' && href?.startsWith('teacher.html#');
        if (isTeacherRoute && key) {
          if (typeof window.onhiTeacherNavigate === 'function') {
            window.onhiTeacherNavigate(key);
            return;
          }
          location.hash = key;
          return;
        }
        
        if (href) location.href = href;
      });
    });
  };

  window.TEACHER_MENU_ITEMS = TEACHER_MENU_ITEMS;
  window.renderTeacherSidebar = renderTeacherSidebar;

  document.addEventListener('DOMContentLoaded', () => renderTeacherSidebar());
}());
