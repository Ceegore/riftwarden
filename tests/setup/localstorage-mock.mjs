/** localStorage mock for vitest Node environment. */
const store = new Map();
globalThis.localStorage = {
  getItem(key) { return store.get(String(key)) ?? null; },
  setItem(key, value) { store.set(String(key), String(value)); },
  removeItem(key) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index) {
    const keys = [...store.keys()];
    return keys[index] ?? null;
  },
};
