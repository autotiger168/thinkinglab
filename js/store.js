// ThinkingLab — 資料層：解密後的資料只放在記憶體；本機與雲端都只存密文
import * as db from './db.js';
import { encryptJSON, decryptJSON, makeMeta, unlockMeta } from './crypto.js';
import { GitHub } from './github.js';

const listeners = new Set();
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type, data) { listeners.forEach((f) => { try { f(type, data); } catch (e) { console.error(e); } }); }

let key = null;
let meta = null;
const items = new Map();
let ghCfg = null; // { owner, repo, tokenEnc, tokenExp }
let gh = null;

export const syncState = { status: 'off', lastSync: null, error: null };
function setStatus(status, error = null) {
  syncState.status = status;
  syncState.error = error;
  emit('sync', syncState);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 初始化與解鎖 ---------- */
export async function init() {
  await db.open();
  meta = (await db.kvGet('meta')) || null;
  ghCfg = (await db.kvGet('github')) || null;
  syncState.lastSync = (await db.kvGet('lastSync')) || null;
}
export const hasVault = () => !!meta;
export const isUnlocked = () => !!key;
export const githubConfig = () => (ghCfg ? { owner: ghCfg.owner, repo: ghCfg.repo, tokenExp: ghCfg.tokenExp } : null);

export async function createVault(password) {
  const r = await makeMeta(password);
  meta = r.meta;
  key = r.key;
  await db.kvSet('meta', meta);
  items.clear();
  await afterUnlock();
}

export async function unlock(password) {
  const k = await unlockMeta(password, meta);
  if (!k) return false;
  key = k;
  await loadAll();
  await afterUnlock();
  return true;
}

async function loadAll() {
  items.clear();
  for (const rec of await db.allRecords()) {
    if (rec.deleted || !rec.ct) continue;
    try { items.set(rec.id, await decryptJSON(key, rec)); }
    catch (e) { console.warn('無法解密', rec.id); }
  }
}

async function afterUnlock() {
  gh = null;
  if (ghCfg) {
    try {
      const t = await decryptJSON(key, ghCfg.tokenEnc);
      gh = new GitHub({ owner: ghCfg.owner, repo: ghCfg.repo, token: t.t });
      setStatus('pending');
    } catch (e) { setStatus('error', '無法讀取 GitHub Token'); }
  } else setStatus('off');
  await purgeTrash();
}

export function lock() {
  key = null;
  items.clear();
  gh = null;
  clearTimeout(syncTimer);
}

/* ---------- 分析資料 CRUD ---------- */
export function all() { return [...items.values()]; }
export function get(id) { const a = items.get(id); return a ? structuredClone(a) : null; }

export async function save(a, { keepTime = false } = {}) {
  if (!key) throw new Error('已上鎖');
  if (!keepTime) a.updatedAt = Date.now();
  const copy = structuredClone(a);
  items.set(a.id, copy);
  const encd = await encryptJSON(key, copy);
  const old = await db.getRecord(a.id);
  await db.putRecord({ id: a.id, iv: encd.iv, ct: encd.ct, remoteSha: old ? old.remoteSha || null : null, dirty: true });
  emit('local-change', a.id);
  scheduleSync();
}

export async function destroy(id) {
  items.delete(id);
  const rec = await db.getRecord(id);
  if (rec && rec.remoteSha) await db.putRecord({ id, deleted: true, dirty: true, remoteSha: rec.remoteSha });
  else await db.delRecord(id);
  emit('local-change', id);
  scheduleSync();
}

async function purgeTrash() {
  const limit = Date.now() - 30 * 24 * 3600 * 1000;
  for (const a of all()) if (a.deletedAt && a.deletedAt < limit) await destroy(a.id);
}

/* ---------- 變更密碼 ---------- */
export async function changePassword(oldPw, newPw) {
  const check = await unlockMeta(oldPw, meta);
  if (!check) throw new Error('目前的密碼不正確');
  const r = await makeMeta(newPw);
  const recs = await db.allRecords();
  const newRecs = [];
  for (const rec of recs) {
    if (rec.deleted) { newRecs.push(rec); continue; }
    const a = items.get(rec.id);
    if (!a) continue;
    const e = await encryptJSON(r.key, a);
    newRecs.push({ id: rec.id, iv: e.iv, ct: e.ct, remoteSha: rec.remoteSha || null, dirty: true });
  }
  let newGh = ghCfg;
  if (gh) {
    const remote = await gh.getFile('meta.json');
    if (remote && JSON.parse(remote.text).salt !== meta.salt) throw new Error('雲端資料的密碼已在其他裝置變更，請先同步');
    await gh.put('meta.json', JSON.stringify(r.meta), remote ? remote.sha : null, 'ThinkingLab: 變更主密碼');
    newGh = { ...ghCfg, tokenEnc: await encryptJSON(r.key, { t: gh.token }) };
  }
  for (const rec of newRecs) await db.putRecord(rec);
  meta = r.meta;
  key = r.key;
  await db.kvSet('meta', meta);
  if (newGh) { ghCfg = newGh; await db.kvSet('github', ghCfg); }
  scheduleSync(10);
}

/* 其他裝置已變更密碼：用新密碼接手雲端的 meta */
export async function adoptRemoteMeta(password) {
  const remote = await gh.getFile('meta.json');
  const rmeta = JSON.parse(remote.text);
  const newKey = await unlockMeta(password, rmeta);
  if (!newKey) return false;
  ghCfg = { ...ghCfg, tokenEnc: await encryptJSON(newKey, { t: gh.token }) };
  await db.kvSet('github', ghCfg);
  for (const rec of await db.allRecords()) {
    if (rec.dirty && !rec.deleted && items.has(rec.id)) {
      const e = await encryptJSON(newKey, items.get(rec.id));
      await db.putRecord({ id: rec.id, iv: e.iv, ct: e.ct, remoteSha: null, dirty: true });
    } else if (!rec.deleted) {
      await db.delRecord(rec.id);
    }
  }
  meta = rmeta;
  key = newKey;
  await db.kvSet('meta', meta);
  await loadAll();
  await runSync();
  return true;
}

/* ---------- GitHub 連線 ---------- */
export async function testGitHub({ owner, repo, token }) {
  const g = new GitHub({ owner, repo, token });
  const info = await g.repoInfo();
  if (!info) throw new Error('找不到這個 repo，請確認帳號名稱、repo 名稱，以及 Token 是否開放此 repo');
  const m = await g.getFile('meta.json');
  return { g, info, remoteMeta: m ? JSON.parse(m.text) : null };
}

export async function connectGitHub({ owner, repo, token }) {
  const { g, info, remoteMeta } = await testGitHub({ owner, repo, token });
  if (remoteMeta && remoteMeta.salt !== meta.salt) {
    const e = new Error('這個 repo 已經存有另一份 ThinkingLab 資料。若要使用它，請在登入畫面選擇「連線雲端既有資料」，或改用另一個空的 repo。');
    e.code = 'OTHER_VAULT';
    throw e;
  }
  ghCfg = { owner: g.owner, repo: g.repo, tokenEnc: await encryptJSON(key, { t: g.token }), tokenExp: g.tokenExp };
  await db.kvSet('github', ghCfg);
  gh = g;
  await runSync();
  return info;
}

export async function updateToken(token) {
  if (!ghCfg) throw new Error('尚未連線 GitHub');
  const g = new GitHub({ owner: ghCfg.owner, repo: ghCfg.repo, token });
  const info = await g.repoInfo();
  if (!info) throw new Error('新的 Token 無法存取這個 repo');
  ghCfg = { ...ghCfg, tokenEnc: await encryptJSON(key, { t: g.token }), tokenExp: g.tokenExp };
  await db.kvSet('github', ghCfg);
  gh = g;
  await runSync();
}

export async function disconnectGitHub() {
  ghCfg = null;
  gh = null;
  await db.kvDel('github');
  for (const rec of await db.allRecords()) {
    if (rec.deleted) await db.delRecord(rec.id);
    else await db.putRecord({ ...rec, remoteSha: null, dirty: true });
  }
  setStatus('off');
}

// 新裝置：連線既有的雲端資料
export async function connectExisting({ owner, repo, token, password }) {
  const { g, remoteMeta } = await testGitHub({ owner, repo, token });
  if (!remoteMeta) throw new Error('這個 repo 裡還沒有 ThinkingLab 資料。請先在第一台裝置建立資料庫並連線 GitHub。');
  const k = await unlockMeta(password, remoteMeta);
  if (!k) throw new Error('主密碼不正確');
  await db.clearAll();
  meta = remoteMeta;
  key = k;
  await db.kvSet('meta', meta);
  ghCfg = { owner: g.owner, repo: g.repo, tokenEnc: await encryptJSON(k, { t: g.token }), tokenExp: g.tokenExp };
  await db.kvSet('github', ghCfg);
  gh = g;
  items.clear();
  await runSync();
}

/* ---------- 同步 ---------- */
let syncTimer = null;
let syncing = false;
let again = false;

export function scheduleSync(ms = 2500) {
  if (!gh) return;
  if (syncState.status !== 'syncing') setStatus('pending');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => runSync(), ms);
}

const PATH = (id) => `analyses/${id}.json`;

export async function runSync() {
  if (!gh || !key) return;
  if (syncing) { again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  syncing = true;
  setStatus('syncing');
  let changedRemote = false;
  try {
    // 1) 確認雲端 meta
    const rm = await gh.getFile('meta.json');
    if (!rm) await gh.put('meta.json', JSON.stringify(meta), null, 'ThinkingLab: 初始化');
    else if (JSON.parse(rm.text).salt !== meta.salt) {
      setStatus('error', '主密碼已在其他裝置變更');
      emit('meta-mismatch');
      return;
    }

    // 2) 列出雲端檔案
    const remote = new Map();
    for (const f of await gh.list('analyses')) {
      if (f.name.endsWith('.json')) remote.set(f.name.slice(0, -5), f.sha);
    }

    // 3) 上傳本機變更
    const recs = await db.allRecords();
    for (const rec of recs) {
      if (!rec.dirty) continue;
      const rsha = remote.get(rec.id);
      if (rec.deleted) {
        if (rsha) await gh.del(PATH(rec.id), rsha);
        remote.delete(rec.id);
        await db.delRecord(rec.id);
        continue;
      }
      if (rsha && rsha !== rec.remoteSha) {
        // 衝突：雲端版本在別處被改過 → 另存一份副本，不覆蓋任何資料
        try {
          const f = await gh.getFile(PATH(rec.id));
          const other = await decryptJSON(key, JSON.parse(f.text));
          other.id = uid();
          other.title = `${other.title || '未命名'}（衝突副本）`;
          await save(other, { keepTime: true });
          changedRemote = true;
        } catch (e) { console.warn('衝突副本建立失敗', e); }
      }
      const body = JSON.stringify({ v: 1, iv: rec.iv, ct: rec.ct });
      const newSha = await gh.put(PATH(rec.id), body, rsha || null);
      remote.set(rec.id, newSha);
      const latest = await db.getRecord(rec.id);
      if (latest && latest.ct === rec.ct) await db.putRecord({ ...latest, remoteSha: newSha, dirty: false });
      else if (latest) await db.putRecord({ ...latest, remoteSha: newSha });
    }

    // 4) 下載雲端變更
    const local = new Map((await db.allRecords()).map((r) => [r.id, r]));
    for (const [id, sha] of remote) {
      const l = local.get(id);
      if (l && (l.dirty || l.remoteSha === sha)) continue;
      const f = await gh.getFile(PATH(id));
      if (!f) continue;
      const enc = JSON.parse(f.text);
      try {
        const a = await decryptJSON(key, enc);
        items.set(id, a);
        await db.putRecord({ id, iv: enc.iv, ct: enc.ct, remoteSha: f.sha, dirty: false });
        changedRemote = true;
      } catch (e) { console.warn('雲端檔案無法解密', id); }
    }

    // 5) 雲端已刪除者
    for (const [id, l] of local) {
      if (!l.dirty && l.remoteSha && !remote.has(id)) {
        await db.delRecord(id);
        items.delete(id);
        changedRemote = true;
      }
    }

    if (gh.tokenExp && ghCfg && ghCfg.tokenExp !== gh.tokenExp) {
      ghCfg.tokenExp = gh.tokenExp;
      await db.kvSet('github', ghCfg);
    }
    syncState.lastSync = Date.now();
    await db.kvSet('lastSync', syncState.lastSync);
    const stillDirty = (await db.allRecords()).some((r) => r.dirty);
    setStatus(stillDirty ? 'pending' : 'ok');
    if (changedRemote) emit('remote-change');
  } catch (e) {
    console.error(e);
    setStatus(e.offline ? 'offline' : 'error', e.message);
  } finally {
    syncing = false;
    if (again) { again = false; scheduleSync(500); }
  }
}

/* ---------- 備份 ---------- */
export async function exportBackup() {
  const recs = (await db.allRecords()).filter((r) => !r.deleted && r.ct).map(({ id, iv, ct }) => ({ id, iv, ct }));
  return { app: 'ThinkingLab', type: 'backup', version: 1, exportedAt: Date.now(), meta, records: recs };
}

export function isBackup(obj) {
  return obj && obj.app === 'ThinkingLab' && obj.type === 'backup' && obj.meta && Array.isArray(obj.records);
}

export function backupNeedsPassword(obj) {
  return !(key && meta && obj.meta.salt === meta.salt);
}

// 解密備份檔中的分析；password 錯誤回傳 null
export async function readBackup(obj, password) {
  const k = !backupNeedsPassword(obj) ? key : await unlockMeta(password, obj.meta);
  if (!k) return null;
  const out = [];
  for (const r of obj.records) {
    try { out.push(await decryptJSON(k, r)); } catch (_) {}
  }
  return out;
}

export async function importAnalyses(list, mode) {
  const incoming = new Set(list.map((a) => a.id));
  if (mode === 'overwrite') {
    for (const id of [...items.keys()]) if (!incoming.has(id)) await destroy(id);
  }
  let n = 0;
  for (const a of list) {
    const ex = items.get(a.id);
    if (!ex || mode === 'overwrite' || (a.updatedAt || 0) > (ex.updatedAt || 0)) {
      await save(a, { keepTime: true });
      n++;
    }
  }
  return n;
}

// 新裝置：直接以備份檔建立資料庫（沿用備份的主密碼）
export async function restoreAsNewVault(obj, password) {
  const k = await unlockMeta(password, obj.meta);
  if (!k) return false;
  await db.clearAll();
  meta = obj.meta;
  key = k;
  await db.kvSet('meta', meta);
  for (const r of obj.records) await db.putRecord({ id: r.id, iv: r.iv, ct: r.ct, remoteSha: null, dirty: true });
  ghCfg = null;
  await loadAll();
  await afterUnlock();
  return true;
}

export async function wipeDevice() {
  lock();
  await db.clearAll();
  meta = null;
  ghCfg = null;
}
