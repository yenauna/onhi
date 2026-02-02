+const getChallengesApi = () => window.Challenges;
+
+const bindChallengeEvents = () => {
+  document.getElementById('challenges-new-btn')?.addEventListener('click', () => {
+    getChallengesApi()?.openChallengeForm(null);
+  });
+
+  document.getElementById('chl-search')?.addEventListener('input', () => {
+    getChallengesApi()?.renderChallengeList();
+  });
+
+  document.getElementById('chl-sort')?.addEventListener('change', () => {
+    getChallengesApi()?.renderChallengeList();
+  });
+
+  document.getElementById('challenge-save-btn')?.addEventListener('click', () => {
+    getChallengesApi()?.saveChallengeFromForm();
+  });
+
+  document.getElementById('challenge-cancel-btn')?.addEventListener('click', () => {
+    getChallengesApi()?.cancelChallengeForm();
+  });
+
+  document.getElementById('challenge-back-btn')?.addEventListener('click', () => {
+    getChallengesApi()?.backToListFromStatus();
+  });
+
+  document.getElementById('challenge-bulk-done')?.addEventListener('click', () => {
+    getChallengesApi()?.bulkMarkStatus(true);
+  });
+
+  document.getElementById('challenge-bulk-undone')?.addEventListener('click', () => {
+    getChallengesApi()?.bulkMarkStatus(false);
+  });
+};
+
+const initChallenges = () => {
+  bindChallengeEvents();
+};
+
+const showChallenges = () => {
+  if (getChallengesApi()?.renderChallengeList) {
+    getChallengesApi().renderChallengeList();
+  }
+};
+
+export { initChallenges, showChallenges };
 
EOF
)
