// ThinkingLab — IndexedDB 本機儲存（只存加密後的資料）
const DB_NAME = 'thinkinglab';
const DB_VERSION = 1;
let dbp = null;

export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const kvDel = (k) => tx('kv', 'readwrite', (s) => s.delete(k));

export const getRecord = (id) => tx('records', 'readonly', (s) => s.get(id));
export const putRecord = (rec) => tx('records', 'readwrite', (s) => s.put(rec));
export const delRecord = (id) => tx('records', 'readwrite', (s) => s.delete(id));
export const allRecords = () => tx('records', 'readonly', (s) => s.getAll());
export const clearRecords = () => tx('records', 'readwrite', (s) => s.clear());

export async function clearAll() {
  await tx('records', 'readwrite', (s) => s.clear());
  await tx('kv', 'readwrite', (s) => s.clear());
}
