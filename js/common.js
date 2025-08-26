// 상단 탭 활성화(버튼 id를 직접 활성화)
function makeActiveById(id){
  document.querySelectorAll('.menu-area button').forEach(b=>{
    b.classList.toggle('active', b.id === id);
  });
}

// (옵션) 교사용 조회 모드 버튼 적용: 버튼이 있을 때만 동작 (다른 페이지 영향 없음)
function applyBoardModeToButton(){
  const btn = document.getElementById('modeBtn');
  if (!btn) return;
  const mode = localStorage.getItem('boardMode') === 'edit' ? 'edit' : 'view';
  const isEdit = mode === 'edit';
  btn.textContent = isEdit ? '편집전용' : '보기전용';
  btn.setAttribute('aria-pressed', String(isEdit));
  btn.classList.toggle('is-edit', isEdit);
}
function toggleBoardMode(){
  const cur = localStorage.getItem('boardMode') === 'edit' ? 'edit' : 'view';
  const next = cur === 'edit' ? 'view' : 'edit';
  localStorage.setItem('boardMode', next);
  applyBoardModeToButton();
}
window.addEventListener('load', ()=>{
  if (!localStorage.getItem('boardMode')) localStorage.setItem('boardMode','view');
  applyBoardModeToButton();
  const mb = document.getElementById('modeBtn');
  if (mb) mb.addEventListener('click', toggleBoardMode);
});
