const getChallengesApi = () => window.Challenges;

const bindOnce = (id, eventName, handler) => {
  const el = document.getElementById(id);
  if (!el || el.dataset.chBound === '1') return;
  el.dataset.chBound = '1';
  el.addEventListener(eventName, handler);
};

const bindChallengeEvents = () => {
  bindOnce('challenges-new-btn', 'click', () => {
    getChallengesApi()?.openChallengeForm(null);
  });

  bindOnce('chl-search', 'input', () => {
    getChallengesApi()?.renderChallengeList();
  });

  bindOnce('chl-sort', 'change', () => {
    getChallengesApi()?.renderChallengeList();
  });

  bindOnce('challenge-save-btn', 'click', () => {
    getChallengesApi()?.saveChallengeFromForm();
  });

  bindOnce('challenge-cancel-btn', 'click', () => {
    getChallengesApi()?.cancelChallengeForm();
  });

  bindOnce('challenge-back-btn', 'click', () => {
    getChallengesApi()?.backToListFromStatus();
  });

  bindOnce('challenge-bulk-done', 'click', () => {
    getChallengesApi()?.bulkMarkStatus(true);
  });

  bindOnce('challenge-bulk-undone', 'click', () => {
    getChallengesApi()?.bulkMarkStatus(false);
  });
};

const initChallenges = () => {
  bindChallengeEvents();
};

const showChallenges = () => {
  if (getChallengesApi()?.renderChallengeList) {
    getChallengesApi().renderChallengeList();
  }
};

export { initChallenges, showChallenges };
