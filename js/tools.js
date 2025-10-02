(function(){
  const STORAGE_KEYS = {
    seatLayout: 'tools:seat-layout',
    seatCols: 'tools:seat-cols',
    seatOrientation: 'tools:seat-orientation',
    pickerHistory: 'tools:picker-history'
  };

  const toolDefinitions = {
    clock: {
      title: '시계 · 타이머',
      icon: '⏰',
      width: 420,
      height: 380,
      minWidth: 320,
      minHeight: 280,
      mount: mountClock
    },
    seating: {
      title: '자리 배치',
      icon: '🪑',
      width: 520,
      height: 540,
      minWidth: 420,
      minHeight: 360,
      mount: mountSeating
    },
    picker: {
      title: '학생 선발 · 사다리',
      icon: '🎯',
      width: 520,
      height: 560,
      minWidth: 360,
      minHeight: 360,
      mount: mountPicker
    },
    whiteboard: {
      title: '판서',
      icon: '📝',
      width: 680,
      height: 520,
      minWidth: 420,
      minHeight: 320,
      mount: mountWhiteboard
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.getElementById('tools-workspace');
    if (!workspace) return;

    const manager = createWindowManager(workspace, toolDefinitions);

    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (!tool) return;
        manager.open(tool);
      });
    });
  });

  function createWindowManager(workspace, definitions){
    const opened = new Map();
    let zIndex = 40;

    function open(id){
      const def = definitions[id];
      if (!def) return null;
      if (opened.has(id)) {
        const entry = opened.get(id);
        bringToFront(entry.el);
        if (entry.el.classList.contains('is-minimized')) {
          restore(entry, def);
        }
        entry.onResize();
        return entry.el;
      }

      const el = document.createElement('section');
      el.className = 'tool-window';
      el.dataset.tool = id;
      if (def.width) el.style.width = `${def.width}px`;
      if (def.height) el.style.height = `${def.height}px`;
      const offset = 36 + opened.size * 26;
      el.style.left = `${offset}px`;
      el.style.top = `${offset}px`;
      el.innerHTML = `
        <header class="window-header">
          <div class="window-title"><span>${def.icon || ''}</span>${def.title}</div>
          <div class="window-actions">
            <button type="button" class="window-btn window-minimize" aria-label="창 최소화">—</button>
            <button type="button" class="window-btn window-close" aria-label="창 닫기">×</button>
          </div>
        </header>
        <div class="window-body"></div>
        <div class="window-resizer" aria-hidden="true"></div>
      `;

      workspace.appendChild(el);
      const body = el.querySelector('.window-body');
      const mountResult = def.mount(body, el) || {};
      const entry = {
        el,
        cleanup: typeof mountResult.cleanup === 'function' ? mountResult.cleanup : () => {},
        onResize: typeof mountResult.onResize === 'function' ? mountResult.onResize : () => {},
        def
      };
      opened.set(id, entry);

      setupDrag(el);
      setupResize(el, def, () => entry.onResize());
      el.querySelector('.window-close').addEventListener('click', () => close(id));
      el.querySelector('.window-minimize').addEventListener('click', () => toggleMinimize(id));
      el.addEventListener('pointerdown', () => bringToFront(el));

      bringToFront(el);
      entry.onResize();
      updateWorkspaceState();
      return el;
    }

    function toggleMinimize(id){
      const entry = opened.get(id);
      if (!entry) return;
      const { el, def } = entry;
      if (!el.classList.contains('is-minimized')) {
        el.dataset.prevHeight = el.style.height || '';
        el.classList.add('is-minimized');
        el.style.height = '';
      } else {
        restore(entry, def);
        entry.onResize();
      }
    }

    function restore(entry, def){
      const { el } = entry;
      el.classList.remove('is-minimized');
      if (el.dataset.prevHeight) {
        el.style.height = el.dataset.prevHeight;
      } else if (def.height) {
        el.style.height = `${def.height}px`;
      }
    }

    function close(id){
      const entry = opened.get(id);
      if (!entry) return;
      entry.cleanup();
      entry.el.remove();
      opened.delete(id);
      updateWorkspaceState();
    }

    function bringToFront(el){
      zIndex += 1;
      el.style.zIndex = zIndex;
    }

    function updateWorkspaceState(){
      if (opened.size > 0) {
        workspace.classList.add('has-window');
      } else {
        workspace.classList.remove('has-window');
      }
    }

    function setupDrag(el){
      const header = el.querySelector('.window-header');
      if (!header) return;
      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      header.addEventListener('pointerdown', (event) => {
        if (event.button && event.button !== 0) return;
        if (event.target.closest('.window-actions')) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        const rect = el.getBoundingClientRect();
        const base = workspace.getBoundingClientRect();
        startLeft = rect.left - base.left;
        startTop = rect.top - base.top;
        bringToFront(el);
        header.setPointerCapture(pointerId);
        header.addEventListener('pointermove', onMove);
        header.addEventListener('pointerup', onUp);
        header.addEventListener('pointercancel', onUp);
      });

      function onMove(event){
        if (pointerId === null) return;
        const base = workspace.getBoundingClientRect();
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        let nextLeft = startLeft + deltaX;
        let nextTop = startTop + deltaY;
        const maxLeft = base.width - el.offsetWidth;
        const maxTop = base.height - el.offsetHeight;
        nextLeft = clamp(nextLeft, -el.offsetWidth * 0.4, Math.max(maxLeft, 0));
        nextTop = clamp(nextTop, -el.offsetHeight * 0.4, Math.max(maxTop, 0));
        el.style.left = `${nextLeft}px`;
        el.style.top = `${nextTop}px`;
      }

      function onUp(){
        if (pointerId === null) return;
        header.releasePointerCapture(pointerId);
        header.removeEventListener('pointermove', onMove);
        header.removeEventListener('pointerup', onUp);
        header.removeEventListener('pointercancel', onUp);
        pointerId = null;
      }
    }

    function setupResize(el, def, onResize){
      const handle = el.querySelector('.window-resizer');
      if (!handle) return;
      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      handle.addEventListener('pointerdown', (event) => {
        if (event.button && event.button !== 0) return;
        if (el.classList.contains('is-minimized')) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = el.offsetWidth;
        startHeight = el.offsetHeight;
        bringToFront(el);
        handle.setPointerCapture(pointerId);
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });

      function onMove(event){
        if (pointerId === null) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const minW = def.minWidth || 260;
        const minH = def.minHeight || 220;
        const nextWidth = Math.max(minW, startWidth + deltaX);
        const nextHeight = Math.max(minH, startHeight + deltaY);
        el.style.width = `${nextWidth}px`;
        el.style.height = `${nextHeight}px`;
        onResize();
      }

      function onUp(){
        if (pointerId === null) return;
        handle.releasePointerCapture(pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        pointerId = null;
      }
    }

    return { open, close, toggleMinimize };
  }

  function mountClock(root){
    root.classList.add('clock-root');
    root.innerHTML = `
      <div class="clock-tabs" role="tablist">
        <button type="button" data-clock-tab="clock" class="active">일반 시계</button>
        <button type="button" data-clock-tab="timer">타이머</button>
        <button type="button" data-clock-tab="stopwatch">스톱워치</button>
      </div>
      <section class="clock-panel active" data-clock-panel="clock">
        <p class="clock-time" data-role="clock-time">--:--:--</p>
        <p class="clock-date" data-role="clock-date">-</p>
      </section>
      <section class="clock-panel" data-clock-panel="timer">
        <div class="timer-inputs">
          <label>분<input type="number" data-role="timer-minutes" min="0" value="5"></label>
          <label>초<input type="number" data-role="timer-seconds" min="0" max="59" value="0"></label>
        </div>
        <div class="timer-buttons">
          <button type="button" class="btn-primary" data-role="timer-start">시작</button>
          <button type="button" data-role="timer-pause">일시정지</button>
          <button type="button" data-role="timer-reset">초기화</button>
        </div>
        <div class="timer-display" data-role="timer-display">00:00</div>
        <div class="timer-status" data-role="timer-status"></div>
      </section>
      <section class="clock-panel" data-clock-panel="stopwatch">
        <div class="stopwatch-buttons">
          <button type="button" class="btn-primary" data-role="stopwatch-start">시작</button>
          <button type="button" data-role="stopwatch-stop">정지</button>
          <button type="button" data-role="stopwatch-reset">초기화</button>
        </div>
        <div class="stopwatch-display" data-role="stopwatch-display">00:00.00</div>
      </section>
    `;

    const tabs = Array.from(root.querySelectorAll('[data-clock-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-clock-panel]'));
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.clockTab;
        tabs.forEach(b => b.classList.toggle('active', b === btn));
        panels.forEach(panel => panel.classList.toggle('active', panel.dataset.clockPanel === key));
      });
    });

    const timeLabel = root.querySelector('[data-role="clock-time"]');
    const dateLabel = root.querySelector('[data-role="clock-date"]');
    let clockTimer = null;
    if (timeLabel) {
      const updateClock = () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        timeLabel.textContent = `${h}:${m}:${s}`;
        dateLabel.textContent = now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });
      };
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
    }

    const minutesInput = root.querySelector('[data-role="timer-minutes"]');
    const secondsInput = root.querySelector('[data-role="timer-seconds"]');
    const startBtn = root.querySelector('[data-role="timer-start"]');
    const pauseBtn = root.querySelector('[data-role="timer-pause"]');
    const resetBtn = root.querySelector('[data-role="timer-reset"]');
    const timerDisplay = root.querySelector('[data-role="timer-display"]');
    const timerStatus = root.querySelector('[data-role="timer-status"]');

    let remainingMs = 0;
    let timerTarget = null;
    let timerInterval = null;
    let timerState = 'idle';

    function formatTimer(ms){
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    function renderTimer(){
      if (timerDisplay) timerDisplay.textContent = formatTimer(remainingMs);
      if (!timerStatus) return;
      if (timerState === 'running') timerStatus.textContent = '진행 중';
      else if (timerState === 'paused') timerStatus.textContent = '일시정지됨';
      else timerStatus.textContent = '';
    }

    function syncInputs(){
      if (!minutesInput || !secondsInput) return 0;
      const minutes = Math.max(0, parseInt(minutesInput.value, 10) || 0);
      const rawSeconds = Math.max(0, parseInt(secondsInput.value, 10) || 0);
      const seconds = Math.min(59, rawSeconds);
      secondsInput.value = String(seconds);
      return (minutes * 60 + seconds) * 1000;
    }

    function tickTimer(){
      if (!timerTarget) return;
      remainingMs = Math.max(0, timerTarget - Date.now());
      renderTimer();
      if (remainingMs <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerTarget = null;
        timerState = 'idle';
        if (timerStatus) timerStatus.textContent = '⏳ 타이머 종료!';
      }
    }

    startBtn?.addEventListener('click', () => {
      if (timerInterval) return;
      if (timerState === 'idle') {
        remainingMs = syncInputs();
      }
      if (remainingMs <= 0) {
        if (timerStatus) timerStatus.textContent = '시간을 설정해 주세요.';
        return;
      }
      timerTarget = Date.now() + remainingMs;
      timerState = 'running';
      renderTimer();
      timerInterval = setInterval(tickTimer, 200);
      tickTimer();
    });

    pauseBtn?.addEventListener('click', () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        remainingMs = Math.max(0, timerTarget - Date.now());
        timerState = 'paused';
        renderTimer();
        return;
      }
      if (timerState === 'paused') {
        timerTarget = Date.now() + remainingMs;
        timerInterval = setInterval(tickTimer, 200);
        timerState = 'running';
        renderTimer();
      }
    });

    resetBtn?.addEventListener('click', () => {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
      timerTarget = null;
      timerState = 'idle';
      remainingMs = syncInputs();
      renderTimer();
      if (timerStatus) timerStatus.textContent = '초기화되었습니다.';
    });

    minutesInput?.addEventListener('change', () => {
      if (timerState === 'idle') {
        remainingMs = syncInputs();
        renderTimer();
      }
    });
    secondsInput?.addEventListener('change', () => {
      if (timerState === 'idle') {
        remainingMs = syncInputs();
        renderTimer();
      }
    });

    remainingMs = syncInputs();
    renderTimer();

    const swStart = root.querySelector('[data-role="stopwatch-start"]');
    const swStop = root.querySelector('[data-role="stopwatch-stop"]');
    const swReset = root.querySelector('[data-role="stopwatch-reset"]');
    const swDisplay = root.querySelector('[data-role="stopwatch-display"]');

    let swRunning = false;
    let swStartTime = 0;
    let swElapsed = 0;
    let swInterval = null;

    function renderStopwatch(){
      const total = swElapsed + (swRunning ? Date.now() - swStartTime : 0);
      const ms = Math.floor(total % 1000 / 10);
      const seconds = Math.floor(total / 1000);
      const mm = Math.floor(seconds / 60);
      const ss = seconds % 60;
      if (swDisplay) swDisplay.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }

    function ensureStopwatchInterval(){
      if (swInterval) return;
      swInterval = setInterval(renderStopwatch, 50);
    }

    swStart?.addEventListener('click', () => {
      if (swRunning) return;
      swRunning = true;
      swStartTime = Date.now();
      ensureStopwatchInterval();
      renderStopwatch();
    });

    swStop?.addEventListener('click', () => {
      if (!swRunning) return;
      swRunning = false;
      swElapsed += Date.now() - swStartTime;
      if (swInterval) {
        clearInterval(swInterval);
        swInterval = null;
      }
      renderStopwatch();
    });

    swReset?.addEventListener('click', () => {
      swRunning = false;
      swElapsed = 0;
      swStartTime = 0;
      if (swInterval) {
        clearInterval(swInterval);
        swInterval = null;
      }
      renderStopwatch();
    });

    renderStopwatch();

    return {
      cleanup(){
        if (clockTimer) clearInterval(clockTimer);
        if (timerInterval) clearInterval(timerInterval);
        if (swInterval) clearInterval(swInterval);
      },
      onResize(){}
    };
  }

  function mountSeating(root){
    root.innerHTML = `
      <div class="seat-toolbar">
        <label>열 수 <input type="number" data-role="seat-cols" min="1" max="8"></label>
        <button type="button" data-role="seat-reset">이름순 정렬</button>
        <button type="button" data-role="seat-shuffle">무작위 섞기</button>
        <button type="button" data-role="seat-orientation">교실 뒤가 위로 보기</button>
      </div>
      <div class="seat-area" data-role="seat-area">
        <div class="seat-orientation-labels">
          <span data-role="seat-front">교실 앞</span>
          <span data-role="seat-back">교실 뒤</span>
        </div>
        <div class="seat-grid" data-role="seat-grid"></div>
      </div>
    `;

    const grid = root.querySelector('[data-role="seat-grid"]');
    const colsInput = root.querySelector('[data-role="seat-cols"]');
    const resetBtn = root.querySelector('[data-role="seat-reset"]');
    const shuffleBtn = root.querySelector('[data-role="seat-shuffle"]');
    const orientationBtn = root.querySelector('[data-role="seat-orientation"]');
    const area = root.querySelector('[data-role="seat-area"]');
    const frontLabel = root.querySelector('[data-role="seat-front"]');
    const backLabel = root.querySelector('[data-role="seat-back"]');
    if (!grid || !colsInput || !area) {
      return { cleanup(){}, onResize(){} };
    }

    const students = sortStudents(loadStudents());
    let layout = loadLayout(students);
    let columns = loadColumns(students.length);
    let orientation = loadOrientation();

    function saveLayout(){
      setJSON(STORAGE_KEYS.seatLayout, layout);
    }
    function saveColumns(){
      setJSON(STORAGE_KEYS.seatCols, columns);
    }
    function saveOrientation(){
      localStorage.setItem(STORAGE_KEYS.seatOrientation, orientation);
    }

    function render(){
      grid.innerHTML = '';
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(120px, 1fr))`;
      layout.forEach(id => {
        const student = students.find(stu => stu.id === id) || null;
        const card = document.createElement('div');
        card.className = 'seat';
        card.dataset.id = id;
        card.draggable = !!student;
        const name = student ? escapeHTML(student.name || '') : '빈 자리';
        let meta = '';
        if (student) {
          const idText = student.id ? escapeHTML(student.id) : '';
          const genderText = student.gender ? escapeHTML(student.gender) : '';
          if (idText && genderText) meta = `${idText} • ${genderText}`;
          else if (idText) meta = idText;
          else if (genderText) meta = genderText;
        }
        card.innerHTML = `<strong>${name}</strong>${meta ? `<span class="seat-meta">${meta}</span>` : ''}`;
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', () => { draggingId = null; card.classList.remove('drag-over'); });
        grid.appendChild(card);
      });
      updateOrientation();
    }

    function updateOrientation(){
      const isBackUp = orientation === 'back-up';
      area.classList.toggle('is-reversed', isBackUp);
      if (frontLabel) frontLabel.textContent = isBackUp ? '교실 뒤' : '교실 앞';
      if (backLabel) backLabel.textContent = isBackUp ? '교실 앞' : '교실 뒤';
      if (orientationBtn) orientationBtn.textContent = isBackUp ? '교실 앞이 위로 보기' : '교실 뒤가 위로 보기';
    }

    let draggingId = null;

    function handleDragStart(event){
      draggingId = event.currentTarget.dataset.id;
      try {
        event.dataTransfer.setData('text/plain', draggingId);
        event.dataTransfer.effectAllowed = 'move';
      } catch (_) {}
    }
    function handleDragOver(event){
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      event.currentTarget.classList.add('drag-over');
    }
    function handleDragLeave(event){
      event.currentTarget.classList.remove('drag-over');
    }
    function handleDrop(event){
      event.preventDefault();
      event.currentTarget.classList.remove('drag-over');
      const targetId = event.currentTarget.dataset.id;
      const sourceId = draggingId || event.dataTransfer.getData('text/plain');
      draggingId = null;
      if (!sourceId || !targetId || sourceId === targetId) return;
      const fromIndex = layout.indexOf(sourceId);
      const toIndex = layout.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      layout.splice(fromIndex, 1);
      layout.splice(toIndex, 0, sourceId);
      saveLayout();
      render();
    }

    function loadLayout(list){
      const saved = getJSON(STORAGE_KEYS.seatLayout, []);
      const ids = list.map(stu => stu.id);
      const filtered = Array.isArray(saved) ? saved.filter(id => ids.includes(id)) : [];
      const missing = ids.filter(id => !filtered.includes(id));
      return filtered.concat(missing);
    }

    function loadColumns(total){
      const saved = getJSON(STORAGE_KEYS.seatCols, null);
      if (typeof saved === 'number' && saved >= 1) return saved;
      if (total <= 0) return 4;
      const approx = Math.ceil(Math.sqrt(total));
      return Math.min(8, Math.max(3, approx));
    }

    function loadOrientation(){
      const saved = localStorage.getItem(STORAGE_KEYS.seatOrientation);
      return saved === 'back-up' ? 'back-up' : 'front-up';
    }

    colsInput.value = columns;
    colsInput.addEventListener('change', () => {
      const value = parseInt(colsInput.value, 10);
      if (!Number.isFinite(value) || value < 1) {
        colsInput.value = columns;
        return;
      }
      columns = Math.min(8, Math.max(1, value));
      saveColumns();
      render();
    });

    resetBtn?.addEventListener('click', () => {
      layout = students.map(stu => stu.id);
      saveLayout();
      render();
    });

    shuffleBtn?.addEventListener('click', () => {
      layout = shuffle(layout);
      saveLayout();
      render();
    });

    orientationBtn?.addEventListener('click', () => {
      orientation = orientation === 'back-up' ? 'front-up' : 'back-up';
      saveOrientation();
      updateOrientation();
    });

    render();

    return {
      cleanup(){},
      onResize(){
        // no-op
      }
    };
  }

  function mountPicker(root){
    root.classList.add('picker-root');
    root.innerHTML = `
      <div class="picker-tabs" role="tablist">
        <button type="button" data-picker-tab="random" class="active">랜덤 뽑기</button>
        <button type="button" data-picker-tab="ladder">사다리타기</button>
      </div>
      <section class="picker-panel active" data-picker-panel="random">
        <div class="picker-controls">
          <label class="sr" for="picker-gender">성별 선택</label>
          <select data-role="picker-gender" id="picker-gender">
            <option value="all">전체 랜덤</option>
            <option value="male">남학생만</option>
            <option value="female">여학생만</option>
          </select>
          <label class="sr" for="picker-count">인원 수</label>
          <select data-role="picker-count" id="picker-count">
            <option value="1">1명</option>
            <option value="2">2명</option>
            <option value="3">3명</option>
            <option value="4">4명</option>
            <option value="5">5명</option>
          </select>
          <button type="button" class="btn-primary" data-role="picker-run">랜덤 뽑기</button>
          <button type="button" data-role="picker-clear">결과 지우기</button>
        </div>
        <div class="picker-result" data-role="picker-result" aria-live="polite"></div>
        <div class="picker-history" data-role="picker-history" aria-live="polite"></div>
      </section>
      <section class="picker-panel" data-picker-panel="ladder">
        <div class="ladder-inputs">
          <label for="ladder-names">참가자 (한 줄에 한 명)</label>
          <textarea data-role="ladder-names" id="ladder-names" placeholder="예)\n김학생\n이학생\n박학생"></textarea>
          <label for="ladder-goals">결과 (한 줄에 하나) — 비워두면 1,2,3... 순서</label>
          <textarea data-role="ladder-goals" id="ladder-goals" placeholder="예)\n청소\n분리수거\n게시판"></textarea>
        </div>
        <div class="ladder-actions">
          <button type="button" data-role="ladder-fill">학생명 자동 채우기</button>
          <button type="button" class="primary" data-role="ladder-generate">사다리 생성</button>
          <button type="button" data-role="ladder-clear">초기화</button>
        </div>
        <div class="ladder-view" data-role="ladder-view"></div>
        <div class="ladder-result-list" data-role="ladder-result"></div>
      </section>
    `;

    const tabs = Array.from(root.querySelectorAll('[data-picker-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-picker-panel]'));
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.pickerTab;
        tabs.forEach(btn => btn.classList.toggle('active', btn === tab));
        panels.forEach(panel => panel.classList.toggle('active', panel.dataset.pickerPanel === key));
      });
    });

    const genderSelect = root.querySelector('[data-role="picker-gender"]');
    const countSelect = root.querySelector('[data-role="picker-count"]');
    const runBtn = root.querySelector('[data-role="picker-run"]');
    const clearBtn = root.querySelector('[data-role="picker-clear"]');
    const resultEl = root.querySelector('[data-role="picker-result"]');
    const historyEl = root.querySelector('[data-role="picker-history"]');

    const students = sortStudents(loadStudents());

    function renderHistory(){
      if (!historyEl) return;
      const history = getJSON(STORAGE_KEYS.pickerHistory, []);
      if (!Array.isArray(history) || history.length === 0) {
        historyEl.innerHTML = '<em>이력이 없습니다.</em>';
        return;
      }
      const html = ['<ul>'];
      history.forEach(item => {
        const date = item.time ? new Date(item.time) : null;
        const timeText = date ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
        const condition = item.gender === 'male' ? '남학생' : item.gender === 'female' ? '여학생' : '전체';
        html.push(`<li>[${timeText}] ${condition} ${item.count}명 → ${escapeHTML((item.picks||[]).join(', '))}</li>`);
      });
      html.push('</ul>');
      historyEl.innerHTML = html.join('');
    }

    renderHistory();

    runBtn?.addEventListener('click', () => {
      const gender = genderSelect?.value || 'all';
      const count = parseInt(countSelect?.value || '1', 10) || 1;
      const pool = students.filter(stu => {
        if (!stu || !stu.name) return false;
        if (gender === 'male') return stu.gender === '남자';
        if (gender === 'female') return stu.gender === '여자';
        return true;
      });
      if (pool.length === 0) {
        if (resultEl) resultEl.textContent = '조건에 맞는 학생이 없습니다.';
        return;
      }
      const picks = pickUnique(pool, count).map(stu => stu.name);
      if (resultEl) resultEl.textContent = picks.join(', ');
      appendHistory({ time: new Date().toISOString(), gender, count, picks });
      renderHistory();
    });

    clearBtn?.addEventListener('click', () => {
      if (resultEl) resultEl.textContent = '';
    });

    const namesArea = root.querySelector('[data-role="ladder-names"]');
    const goalsArea = root.querySelector('[data-role="ladder-goals"]');
    const fillBtn = root.querySelector('[data-role="ladder-fill"]');
    const generateBtn = root.querySelector('[data-role="ladder-generate"]');
    const clearBtn2 = root.querySelector('[data-role="ladder-clear"]');
    const viewEl = root.querySelector('[data-role="ladder-view"]');
    const resultBox = root.querySelector('[data-role="ladder-result"]');

    fillBtn?.addEventListener('click', () => {
      if (!namesArea) return;
      if (!namesArea.value.trim()) {
        namesArea.value = students.slice(0, 8).map(stu => stu.name).join('\n');
      } else {
        namesArea.value = students.map(stu => stu.name).join('\n');
      }
    });

    clearBtn2?.addEventListener('click', () => {
      if (namesArea) namesArea.value = '';
      if (goalsArea) goalsArea.value = '';
      if (viewEl) viewEl.innerHTML = '';
      if (resultBox) resultBox.innerHTML = '';
    });

    generateBtn?.addEventListener('click', () => {
      if (!namesArea || !viewEl || !resultBox) return;
      const names = sanitizeLines(namesArea.value);
      if (names.length < 2) {
        viewEl.innerHTML = '<em>두 명 이상 입력해 주세요.</em>';
        resultBox.innerHTML = '';
        return;
      }
      let goals = sanitizeLines(goalsArea?.value || '');
      if (goals.length === 0) {
        goals = Array.from({ length: names.length }, (_, i) => `${i + 1}`);
      }
      if (goals.length < names.length) {
        for (let i = goals.length; i < names.length; i++) {
          goals.push(`${i + 1}`);
        }
      } else if (goals.length > names.length) {
        goals = goals.slice(0, names.length);
      }

      const ladder = buildLadder(names.length);
      const mapping = simulateLadder(ladder.connectors, names.length);
      const assignments = mapping.map(idx => goals[idx]);

      renderLadder(viewEl, names, goals, ladder);
      renderLadderResult(resultBox, names, assignments);
    });

    return {
      cleanup(){},
      onResize(){}
    };
  }

  function mountWhiteboard(root){
    root.classList.add('whiteboard-root');
    root.innerHTML = `
      <div class="whiteboard-toolbar">
        <label>색상 <input type="color" data-role="wb-color" value="#2e7d57"></label>
        <label>선 굵기 <input type="range" data-role="wb-size" min="1" max="20" value="4"></label>
        <button type="button" data-role="wb-clear">지우기</button>
      </div>
      <div class="whiteboard-area" data-role="wb-area">
        <canvas data-role="wb-canvas" aria-label="판서 공간"></canvas>
      </div>
    `;

    const canvas = root.querySelector('[data-role="wb-canvas"]');
    const area = root.querySelector('[data-role="wb-area"]');
    const colorInput = root.querySelector('[data-role="wb-color"]');
    const sizeInput = root.querySelector('[data-role="wb-size"]');
    const clearBtn = root.querySelector('[data-role="wb-clear"]');
    if (!canvas || !canvas.getContext || !area) {
      return { cleanup(){}, onResize(){} };
    }

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let color = colorInput ? colorInput.value : '#2e7d57';
    let size = sizeInput ? parseInt(sizeInput.value, 10) || 4 : 4;
    let lastX = 0;
    let lastY = 0;

    function resizeCanvas(){
      const rect = area.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = window.devicePixelRatio || 1;
      const prev = canvas.width && canvas.height ? canvas.toDataURL() : null;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      if (prev) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = prev;
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    }

    function getPos(event){
      const rect = canvas.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(event){
      event.preventDefault();
      const pos = getPos(event);
      drawing = true;
      lastX = pos.x;
      lastY = pos.y;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }

    function draw(event){
      if (!drawing) return;
      event.preventDefault();
      const pos = getPos(event);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      lastX = pos.x;
      lastY = pos.y;
    }

    function endDraw(event){
      if (!drawing) return;
      event?.preventDefault();
      drawing = false;
      ctx.closePath();
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
    canvas.addEventListener('touchcancel', endDraw, { passive: false });

    colorInput?.addEventListener('change', () => {
      color = colorInput.value;
      ctx.strokeStyle = color;
    });
    sizeInput?.addEventListener('input', () => {
      const value = parseInt(sizeInput.value, 10);
      if (Number.isFinite(value)) {
        size = value;
        ctx.lineWidth = size;
      }
    });
    clearBtn?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = area.getBoundingClientRect();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    });

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(area);
    resizeCanvas();

    return {
      cleanup(){ observer.disconnect(); },
      onResize(){ resizeCanvas(); }
    };
  }

  function pickUnique(list, count){
    const copy = list.slice();
    const result = [];
    const max = Math.min(count, copy.length);
    for (let i = 0; i < max; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      const [item] = copy.splice(idx, 1);
      result.push(item);
    }
    return result;
  }

  function appendHistory(entry){
    const history = getJSON(STORAGE_KEYS.pickerHistory, []);
    history.unshift(entry);
    setJSON(STORAGE_KEYS.pickerHistory, history.slice(0, 50));
  }

  function sanitizeLines(value){
    return String(value || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  function buildLadder(columns){
    const rows = Math.max(8, columns * 3);
    const connectors = Array.from({ length: rows }, () => Array(columns - 1).fill(false));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns - 1; c++) {
        if (Math.random() < 0.35) {
          if (c > 0 && connectors[r][c - 1]) continue;
          if (r > 0 && connectors[r - 1][c]) continue;
          connectors[r][c] = true;
        }
      }
    }
    return { rows, connectors };
  }

  function simulateLadder(connectors, columns){
    const rows = connectors.length;
    const result = [];
    for (let start = 0; start < columns; start++) {
      let col = start;
      for (let r = 0; r < rows; r++) {
        if (col < columns - 1 && connectors[r][col]) {
          col += 1;
        } else if (col > 0 && connectors[r][col - 1]) {
          col -= 1;
        }
      }
      result.push(col);
    }
    return result;
  }

  function renderLadder(container, names, goals, ladder){
    const columns = names.length;
    container.style.setProperty('--ladder-cols', columns);
    const gap = 120;
    const startX = 40;
    const topMargin = 30;
    const bottomMargin = 30;
    const rowHeight = 40;
    const width = startX * 2 + gap * (columns - 1);
    const height = topMargin + bottomMargin + rowHeight * (ladder.rows - 1);

    const svgParts = [`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="사다리 결과">`];
    for (let c = 0; c < columns; c++) {
      const x = startX + gap * c;
      svgParts.push(`<line x1="${x}" y1="${topMargin}" x2="${x}" y2="${height - bottomMargin}" stroke="#7f8c8d" stroke-width="4" stroke-linecap="round" />`);
    }
    for (let r = 0; r < ladder.rows; r++) {
      for (let c = 0; c < columns - 1; c++) {
        if (!ladder.connectors[r][c]) continue;
        const x = startX + gap * c;
        const y = topMargin + rowHeight * r;
        svgParts.push(`<line x1="${x}" y1="${y}" x2="${x + gap}" y2="${y}" stroke="#2e7d57" stroke-width="4" stroke-linecap="round" />`);
      }
    }
    svgParts.push('</svg>');

    const topRow = document.createElement('div');
    topRow.className = 'ladder-label-row';
    topRow.style.setProperty('--ladder-cols', columns);
    names.forEach(name => {
      const span = document.createElement('span');
      span.textContent = name;
      topRow.appendChild(span);
    });

    const bottomRow = document.createElement('div');
    bottomRow.className = 'ladder-label-row bottom';
    bottomRow.style.setProperty('--ladder-cols', columns);
    goals.forEach(goal => {
      const span = document.createElement('span');
      span.textContent = goal;
      bottomRow.appendChild(span);
    });

    const svgWrap = document.createElement('div');
    svgWrap.className = 'ladder-svg';
    svgWrap.innerHTML = svgParts.join('');

    container.innerHTML = '';
    container.appendChild(topRow);
    container.appendChild(svgWrap);
    container.appendChild(bottomRow);
  }

  function renderLadderResult(container, names, assignments){
    const list = document.createElement('ol');
    names.forEach((name, idx) => {
      const li = document.createElement('li');
      li.textContent = `${name} → ${assignments[idx]}`;
      list.appendChild(li);
    });
    container.innerHTML = '';
    container.appendChild(list);
  }

  function shuffle(arr){
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function clamp(value, min, max){
    return Math.min(Math.max(value, min), max);
  }
})();
