const DEFAULT_TASKS_KEY = 'tasksV2';
const OBSERVATION_KEY = 'observationRecords:v1';

const getJSON = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('[storage] parse failed', key, error);
    return fallback;
  }
};

const setJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const genUID = () => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `t_${ts}_${rnd}`;
};

const getTasks = () => getJSON(DEFAULT_TASKS_KEY, []);
const setTasks = (list) => setJSON(DEFAULT_TASKS_KEY, Array.isArray(list) ? list : []);

const getVacations = () => getJSON('vacations', []);
const setVacations = (list) => setJSON('vacations', Array.isArray(list) ? list : []);

const getDoneTasks = (student) => getJSON(`doneTasks-${student}`, {});
const setDoneTasks = (student, doneTasks) => setJSON(`doneTasks-${student}`, doneTasks || {});

const createObservationId = () => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `obs_${ts}_${rnd}`;
};

const loadObservations = () => {
  const list = getJSON(OBSERVATION_KEY, []);
  return Array.isArray(list) ? list.filter(item => item && typeof item === 'object') : [];
};

const saveObservations = (list) => {
  setJSON(OBSERVATION_KEY, Array.isArray(list) ? list : []);
};

const addObservation = (record) => {
  const list = loadObservations();
  list.unshift(record);
  saveObservations(list);
  return list;
};

const deleteObservation = (id) => {
  const list = loadObservations().filter(item => item.id !== id);
  saveObservations(list);
  return list;
};

const updateObservation = (id, patch) => {
  const list = loadObservations().map(item => {
    if (item.id !== id) return item;
    return { ...item, ...patch };
  });
  saveObservations(list);
  return list;
};

const migrateLegacyDoneToUIDOnce = async ({ loadStudentsCached } = {}) => {
  const FLAG = 'migratedDoneToUID';
  if (localStorage.getItem(FLAG) === 'yes') return;

  const all = getTasks();
  if (!Array.isArray(all) || all.length === 0) {
    localStorage.setItem(FLAG, 'yes');
    return;
  }

  const byDateText = new Map();
  all.forEach(task => byDateText.set(`${task.date}@@${task.text}`, task.id));

  const students = typeof loadStudentsCached === 'function'
  ? (await loadStudentsCached()).map(stu => stu.name)
  : [];

  students.forEach(name => {
    const store = getDoneTasks(name) || {};
    let changed = false;

    Object.entries(store).forEach(([key, value]) => {
      if (value === true && key.includes('@@')) {
        const uid = byDateText.get(key);
        if (uid) {
          store[uid] = true;
          delete store[key];
          changed = true;
        }
      }
    });

    if (changed) setDoneTasks(name, store);
  });

  localStorage.setItem(FLAG, 'yes');
};

const purgeLegacyDoneKeysForAllStudents = async ({ loadStudentsCached } = {}) => {  const students = typeof loadStudentsCached === 'function'
  ? (await loadStudentsCached()).map(stu => stu.name)
  : [];
  const uidRegex = /^t_[0-9a-z]+_[0-9a-z]+$/i;

  students.forEach(name => {
    const store = getDoneTasks(name) || {};
    let changed = false;

    Object.keys(store).forEach(key => {
      const isUid = uidRegex.test(key);
      const isLegacy = key.includes('@@');
      const looksPlain = !isUid && !key.includes('@@');
      if (isLegacy || looksPlain) {
        delete store[key];
        changed = true;
      }
    });

    if (changed) setDoneTasks(name, store);
  });
};

const ObservationStorage = {
  loadObservations,
  saveObservations,
  addObservation,
  deleteObservation,
  updateObservation,
  createObservationId,
};

if (typeof window !== 'undefined') {
  window.ObservationStorage = ObservationStorage;
}

export {
  getJSON,
  setJSON,
  genUID,
  getTasks,
  setTasks,
  getVacations,
  setVacations,
  getDoneTasks,
  setDoneTasks,
  ObservationStorage,
  migrateLegacyDoneToUIDOnce,
  purgeLegacyDoneKeysForAllStudents,
};
