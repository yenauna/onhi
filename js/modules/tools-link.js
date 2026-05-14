const initToolsLink = () => {
  const btn = document.getElementById('tab-tools');
  if (!btn) return;
  if (btn.dataset.boundToolsLink === 'true') return;
  btn.dataset.boundToolsLink = 'true';
  btn.addEventListener('click', () => {
    window.location.href = 'tool.html';
  });
};

export { initToolsLink };
