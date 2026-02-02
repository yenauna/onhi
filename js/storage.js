(function (w) {
  const STORAGE_KEY = 'observationRecords:v1';

  const normalizeList = (value) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === 'object');
  };

  const loadObservations = () => {
    return normalizeList(w.getJSON ? w.getJSON(STORAGE_KEY, []) : []);
  };

  const saveObservations = (list) => {
    if (w.setJSON) {
      w.setJSON(STORAGE_KEY, Array.isArray(list) ? list : []);
    }
  };

  const addObservation = (record) => {
    const list = loadObservations();
    list.unshift(record);
    saveObservations(list);
    return list;
  };

  const deleteObservation = (id) => {
    const list = loadObservations();
    const next = list.filter((item) => item.id !== id);
    saveObservations(next);
    return next;
  };

  const updateObservation = (id, patch) => {
    const list = loadObservations();
    const next = list.map((item) => {
      if (item.id !== id) return item;
      return { ...item, ...patch };
    });
    saveObservations(next);
    return next;
  };

  const createObservationId = () => {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 10);
    return `obs_${ts}_${rnd}`;
  };

  w.ObservationStorage = {
    loadObservations,
    saveObservations,
    addObservation,
    deleteObservation,
    updateObservation,
    createObservationId,
  };
})(window);
