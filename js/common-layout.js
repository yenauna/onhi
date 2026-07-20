(function () {
  const TOPBAR_CONFIGS = {
    home: {
      navClass: 'menu',
      navLabel: '주요 메뉴',
      items: [
        { label: '전체확인', active: true },
        { label: '학생', id: 'btn-student-login' },
        { label: '선생님', href: 'teacher.html' },
      ],
      right: [
        { id: 'eventsBtn', label: '', ariaPressed: 'false' },
        { id: 'compactBtn', label: '', ariaPressed: 'false' },
        { id: 'modeBtn', label: '', ariaPressed: 'false', disabled: true },
      ],
    },
    student: {
      navClass: 'menu-area',
      navLabel: '주요 메뉴',
      items: [
        { label: '오늘 할 일', id: 'tab-todo', active: true, onclick: 'showTodo()' },
        { label: '달력', id: 'tab-calendar', onclick: 'showCalendar()' },
        { label: '내 경험치', id: 'tab-exp', onclick: 'showExp()' },
      ],
    },
    teacher: {
      navClass: 'page-tabs',
      navLabel: '페이지별 상단 탭',
      navId: 'page-tabs',
      right: [
        { id: 'teacher-logout-btn', label: '로그아웃' },
        { id: 'eventsBtn', label: '일정숨김', ariaPressed: 'false' },
        { id: 'compactBtn', label: '', ariaPressed: 'false' },
        { id: 'modeBtn', label: '', ariaPressed: 'false' },
      ],
    },
    tools: {
      navClass: 'page-tabs',
      navLabel: '페이지별 상단 탭',
      navId: 'page-tabs',
      pageName: '도구',
      pageHint: '페이지별 상단탭(추후 반영)',
      right: [
        { id: 'teacher-logout-btn', label: '로그아웃' },
        { id: 'eventsBtn', label: '일정숨김', ariaPressed: 'false' },
        { id: 'compactBtn', label: '', ariaPressed: 'false' },
        { id: 'modeBtn', label: '', ariaPressed: 'false' },
      ],
    },
  };

  const attr = (name, value) => (value === undefined || value === null || value === false ? '' : ` ${name}="${String(value).replaceAll('"', '&quot;')}"`);

  const renderButton = (item) => `
    <button type="button"${attr('id', item.id)}${attr('class', item.active ? 'active' : '')}${attr('onclick', item.onclick)}${attr('aria-pressed', item.ariaPressed)}${item.disabled ? ' disabled' : ''}${attr('data-href', item.href)}>${item.label || ''}</button>
  `;

  const renderTopbar = (selectorOrElement = '[data-common-topbar]') => {
    const topbar = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;
    if (!topbar) return;

    const config = TOPBAR_CONFIGS[topbar.dataset.topbar] || TOPBAR_CONFIGS.home;
    const navItems = config.items || [];
    const rightItems = config.right || [];
    const navContent = config.pageName
      ? `
        <span class="tab-chip is-main">${config.pageName}</span>
        ${config.pageHint ? `<span class="tab-chip">${config.pageHint}</span>` : ''}
      `
      : navItems.map(renderButton).join('');

    topbar.classList.add('topbar');
    topbar.innerHTML = `
      <div class="logo-area">
        <a href="./"><img src="logo.png" alt="오늘 할 일 로고"></a>
      </div>
      <nav${attr('id', config.navId)} class="${config.navClass || 'menu-area'}" aria-label="${config.navLabel || '주요 메뉴'}">${navContent}</nav>
      <div class="right-tools">${rightItems.map((item) => renderButton({ ...item, active: false }).replace('<button type="button"', '<button type="button" class="mode-btn"')).join('')}</div>
    `;

    topbar.querySelectorAll('[data-href]').forEach((button) => {
      button.addEventListener('click', () => {
        location.href = button.dataset.href;
      });
    });
  };

  window.TOPBAR_CONFIGS = TOPBAR_CONFIGS;
  window.renderCommonTopbar = renderTopbar;

  document.addEventListener('DOMContentLoaded', () => renderTopbar());
}());
