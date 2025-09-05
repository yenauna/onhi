// /js/challenges.js
document.getElementById('challenge-form').style.display='none';
document.getElementById('challenge-list-view').style.display='block';
}
function openNewChallenge(){ openChallengeForm(null); }


function openChallengeStatus(id){
const listView = document.getElementById('challenge-list-view');
const formView = document.getElementById('challenge-form');
const statusView = document.getElementById('challenge-status-view');
if(listView) listView.style.display='none';
if(formView) formView.style.display='none';
if(statusView) statusView.style.display='block';


const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
statusView.dataset.id = id;
statusView.querySelector('.st-ch-title').textContent = ch.title || '(제목 없음)';
statusView.querySelector('.st-ch-active').textContent = ch.active? '활성(ON)' : '비활성(OFF)';
const tbody = statusView.querySelector('tbody');
tbody.innerHTML='';


const roster = (ch.students && !ch.students.includes('전체')) ? ch.students : getAllStudents();
roster.forEach(name=>{
const m = getJSON('challengeStatus-'+name, {}) || {};
const done = m[id]?.s === 'd';
const tr = document.createElement('tr');
tr.innerHTML = `
<td>${escapeHTML(name)}</td>
<td class="st">${done?'✅ 완료':'⭕ 미완료'}</td>
<td><button class="toggle">토글</button></td>`;
tr.querySelector('.toggle').onclick = ()=>{
const mm = getJSON('challengeStatus-'+name, {}) || {};
if(done) delete mm[id]; else mm[id]={s:'d', ts:new Date().toISOString()};
setJSON('challengeStatus-'+name, mm);
openChallengeStatus(id);
};
tbody.appendChild(tr);
});
}
function bulkMarkStatus(done){
const id = document.getElementById('challenge-status-view').dataset.id;
const ch = getChallenges().find(c=>c.id===id); if(!ch) return;
const roster = (ch.students && !ch.students.includes('전체')) ? ch.students : getAllStudents();
roster.forEach(name=>{
const m = getJSON('challengeStatus-'+name, {}) || {};
if(done) m[id]={s:'d', ts:new Date().toISOString()}; else delete m[id];
setJSON('challengeStatus-'+name, m);
});
openChallengeStatus(id);
}
function backToListFromStatus(){
document.getElementById('challenge-status-view').style.display='none';
document.getElementById('challenge-list-view').style.display='block';
renderChallengeList();
}


// 공개 API
window.Challenges = {
// 저장/조회
getChallenges, setChallenges, upsertChallenge, deleteChallenge,
listAssignedChallenges, getChallengeStatusFor, setChallengeDone,
// 학생
renderChallengesForStudent,
// 교사
renderChallengeList, openChallengeForm, saveChallengeFromForm, cancelChallengeForm,
openChallengeStatus, bulkMarkStatus, backToListFromStatus,
};
})();
