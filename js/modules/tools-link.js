const initToolsLink = () => {
  const btn = document.getElementById('tab-tools');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.location.href = 'tool.html';
  });
};

export { initToolsLink };
