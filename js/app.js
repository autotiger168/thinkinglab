// ThinkingLab — 主程式：登入、頁面、路由
import * as store from './store.js';
import { TOOLS, CATEGORIES, COMING, categoryOf, defaultContent, contentText } from './tools.js';
import { mountEditor } from './editors.js';
import { renderFigure } from './figure.js';
import { exportImage, printPDF, exportMarkdown } from './export.js';
import { passwordStrength } from './crypto.js';
import { $, $$, esc, debounce, fmtDate, relTime, toast, modal, confirmDialog, download, stamp } from './ui.js';

const gate = $('#gate');
const shell = $('#shell');
const view = $('#view');
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('tl_' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set: (k, v) => { try { localStorage.setItem('tl_' + k, JSON.stringify(v)); } catch (_) {} },
};

/* ================= 主題 ================= */
function applyTheme() {
  const t = LS.get('theme', 'system');
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ================= 啟動 ================= */
async function boot() {
  applyTheme();
  if (!window.isSecureContext || !crypto.subtle) {
    gate.innerHTML = `<div class="gate-card"><h2>無法啟動</h2><p>ThinkingLab 需要在 HTTPS（例如 GitHub Pages）或 localhost 執行，才能使用瀏覽器加密功能。</p></div>`;
    return;
  }
  try { await store.init(); } catch (e) {
    gate.innerHTML = `<div class="gate-card"><h2>無法開啟本機資料庫</h2><p>${esc(e.message)}</p><p>若使用私密瀏覽模式，請改用一般模式。</p></div>`;
    return;
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  store.on(onStoreEvent);
  if (store.hasVault()) showLogin(); else showWelcome();
}

/* ================= 登入前畫面 ================= */
const LOGO = `<div class="brand"><span class="brand-mark">◇</span><span>Thinking<b>Lab</b></span></div>`;

function showGate(html) {
  shell.hidden = true;
  gate.hidden = false;
  gate.innerHTML = `<div class="gate-card">${LOGO}${html}</div>`;
  const f = $('input', gate);
  if (f) setTimeout(() => f.focus(), 30);
}

function showWelcome() {
  showGate(`
    <p class="gate-tag">你的個人思考實驗室 —— 加密儲存，多裝置同步</p>
    <div class="choice-list">
      <button class="choice" data-go="create"><b>建立新的思考資料庫</b><span>第一次使用，設定主密碼</span></button>
      <button class="choice" data-go="connect"><b>連線雲端既有資料</b><span>其他裝置已建立，並已連線 GitHub</span></button>
      <button class="choice" data-go="restore"><b>從備份檔還原</b><span>使用先前匯出的加密備份 .json</span></button>
    </div>`);
  gate.onclick = (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    ({ create: showCreate, connect: showConnect, restore: showRestore, back: showWelcome })[b.dataset.go]();
  };
}

const backBtn = `<button class="btn btn-ghost" data-go="back">← 返回</button>`;

function showCreate() {
  showGate(`
    <h2>建立思考資料庫</h2>
    <form class="form" id="f-create">
      <label>主密碼<input type="password" id="pw1" autocomplete="new-password" minlength="8" required></label>
      <div class="strength"><i></i><span></span></div>
      <label>再輸入一次<input type="password" id="pw2" autocomplete="new-password" required></label>
      <div class="warn-box">⚠️ 主密碼就是解密鑰匙，<b>忘記密碼資料就無法救回</b>，沒有任何人能幫你重設。建議存放在密碼管理器。</div>
      <label class="check"><input type="checkbox" id="ack" required> 我了解，忘記主密碼將無法救回資料</label>
      <div class="row-end">${backBtn}<button class="btn btn-primary" type="submit">建立</button></div>
    </form>`);
  const pw1 = $('#pw1'), meter = $('.strength');
  pw1.addEventListener('input', () => {
    const s = passwordStrength(pw1.value);
    meter.style.setProperty('--s', s.score);
    $('span', meter).textContent = pw1.value ? `強度：${s.label}` : '';
  });
  $('#f-create').onsubmit = async (e) => {
    e.preventDefault();
    if (pw1.value.length < 8) return toast('主密碼至少 8 個字元', 'error');
    if (pw1.value !== $('#pw2').value) return toast('兩次輸入的密碼不一致', 'error');
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = '建立中…';
    await store.createVault(pw1.value);
    enterApp();
    toast('已建立！建議到「設定」連線 GitHub 私人 repo，開啟多裝置同步', 'ok', 5000);
  };
}

function showConnect() {
  showGate(`
    <h2>連線雲端既有資料</h2>
    <p class="muted">輸入存放資料的 GitHub 私人 repo 與 Token，再用同一組主密碼解鎖。</p>
    <form class="form" id="f-conn">
      <label>GitHub 帳號<input id="owner" autocomplete="username" required placeholder="例：jarcle"></label>
      <label>資料 repo 名稱<input id="repo" value="thinkinglab-data" required></label>
      <label>Token<input type="password" id="token" required placeholder="github_pat_…"></label>
      <label>主密碼<input type="password" id="pw" autocomplete="current-password" required></label>
      <div class="row-end">${backBtn}<button class="btn btn-primary" type="submit">連線並解鎖</button></div>
    </form>`);
  $('#f-conn').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = '連線中…';
    try {
      await store.connectExisting({ owner: $('#owner').value, repo: $('#repo').value, token: $('#token').value, password: $('#pw').value });
      enterApp();
      toast('已連線，資料同步完成', 'ok');
    } catch (err) {
      toast(err.message, 'error', 5000);
      btn.disabled = false; btn.textContent = '連線並解鎖';
    }
  };
}

function showRestore() {
  showGate(`
    <h2>從備份檔還原</h2>
    <form class="form" id="f-rest">
      <label>加密備份檔（.json）<input type="file" id="file" accept=".json,application/json" required></label>
      <label>備份時的主密碼<input type="password" id="pw" required></label>
      <div class="row-end">${backBtn}<button class="btn btn-primary" type="submit">還原</button></div>
    </form>`);
  $('#f-rest').onsubmit = async (e) => {
    e.preventDefault();
    let obj;
    try { obj = JSON.parse(await $('#file').files[0].text()); } catch (_) { return toast('檔案格式不正確', 'error'); }
    if (!store.isBackup(obj)) return toast('這不是 ThinkingLab 的備份檔', 'error');
    const ok = await store.restoreAsNewVault(obj, $('#pw').value);
    if (!ok) return toast('密碼不正確', 'error');
    enterApp();
    toast(`已還原 ${obj.records.length} 份分析`, 'ok');
  };
}

function showLogin() {
  showGate(`
    <p class="gate-tag">輸入主密碼解鎖</p>
    <form class="form" id="f-login">
      <label>主密碼<input type="password" id="pw" autocomplete="current-password" required></label>
      <div class="fail-msg muted"></div>
      <button class="btn btn-primary btn-block" type="submit">解鎖</button>
    </form>
    <button class="link-btn" id="forgot">忘記密碼？</button>`);
  const msg = $('.fail-msg');
  $('#f-login').onsubmit = async (e) => {
    e.preventDefault();
    const fail = LS.get('fail', { n: 0, until: 0 });
    if (Date.now() < fail.until) {
      msg.textContent = `嘗試次數過多，請 ${Math.ceil((fail.until - Date.now()) / 1000)} 秒後再試`;
      return;
    }
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = '解鎖中…';
    const ok = await store.unlock($('#pw').value);
    if (ok) { LS.set('fail', { n: 0, until: 0 }); enterApp(); return; }
    const n = fail.n + 1;
    const wait = n >= 3 ? Math.min(300, 5 * 2 ** (n - 3)) : 0;
    LS.set('fail', { n, until: Date.now() + wait * 1000 });
    msg.textContent = wait ? `密碼錯誤（第 ${n} 次），請 ${wait} 秒後再試` : `密碼錯誤（第 ${n} 次）`;
    btn.disabled = false; btn.textContent = '解鎖';
    $('#pw').select();
  };
  $('#forgot').onclick = async () => {
    const r = await modal({
      title: '忘記主密碼',
      body: `<p>ThinkingLab 不儲存你的密碼，所以<b>無法重設或找回</b>。</p>
        <p>你可以試著回想，或是清除此裝置的資料重新開始。若你有其他記得密碼的裝置或備份檔，資料仍可從那裡取回。</p>`,
      actions: [{ label: '再想想', value: false, primary: true }, { label: '清除此裝置資料', value: true, danger: true }],
    });
    if (!r) return;
    const sure = await confirmDialog('確定要清除此裝置上的所有 ThinkingLab 資料嗎？雲端 repo 的資料不會被刪除。', { okLabel: '清除', danger: true });
    if (!sure) return;
    await store.wipeDevice();
    showWelcome();
  };
}

/* ================= 進入主程式 ================= */
function enterApp() {
  gate.hidden = true;
  gate.innerHTML = '';
  gate.onclick = null;
  shell.hidden = false;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  startAutoLock();
  renderSyncIndicator();
  route();
  store.runSync();
}

async function doLock() {
  if (currentCleanup) await currentCleanup();
  currentCleanup = null;
  stopAutoLock();
  store.lock();
  view.innerHTML = '';
  $('#print-root').innerHTML = '';
  $$('.modal-wrap').forEach((m) => m.remove());
  showLogin();
}

/* ---------- 自動上鎖 ---------- */
let lastActive = Date.now();
let lockTimer = null;
const touch = () => { lastActive = Date.now(); };
function startAutoLock() {
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
  lastActive = Date.now();
  clearInterval(lockTimer);
  lockTimer = setInterval(() => {
    const m = LS.get('lock', 15);
    if (m > 0 && Date.now() - lastActive > m * 60000) { doLock(); toast('閒置過久，已自動上鎖'); }
  }, 15000);
}
function stopAutoLock() { clearInterval(lockTimer); }

/* ---------- 同步狀態 ---------- */
const SYNC_TEXT = { off: '未連線雲端', pending: '待同步', syncing: '同步中…', ok: '已同步', error: '同步錯誤', offline: '離線' };
function renderSyncIndicator() {
  const s = store.syncState;
  const el = $('#sync-ind');
  el.dataset.s = s.status;
  el.title = s.error || (s.lastSync ? `上次同步：${fmtDate(s.lastSync)}` : '');
  $('span', el).textContent = SYNC_TEXT[s.status] || '';
}

let editing = null; // { id, ... }
async function onStoreEvent(type) {
  if (type === 'sync') { renderSyncIndicator(); const ss = $('#set-sync'); if (ss) ss.textContent = SYNC_TEXT[store.syncState.status]; }
  if (type === 'remote-change') {
    const r = parseRoute();
    if (r.name === 'editor') toast('其他裝置有資料更新');
    else route();
  }
  if (type === 'meta-mismatch') {
    const r = await modal({
      title: '主密碼已在其他裝置變更',
      body: `<p>雲端資料已改用新的主密碼加密。請輸入<b>新的主密碼</b>以繼續同步。</p><label class="form">新的主密碼<input type="password" id="mm-pw"></label>`,
      dismissible: false,
      actions: [
        { label: '先上鎖', value: 'lock' },
        { label: '確定', primary: true, handler: async (root) => {
          const ok = await store.adoptRemoteMeta($('#mm-pw', root).value);
          if (!ok) { toast('密碼不正確', 'error'); return false; }
          return 'ok';
        } },
      ],
    });
    if (r === 'lock') doLock(); else { toast('已更新為新密碼', 'ok'); route(); }
  }
}

/* ================= 路由 ================= */
let currentCleanup = null;
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  if (!name) return { name: 'home' };
  if (name === 'a') return { name: 'editor', id };
  if (name === 'tool') return { name: 'tool', id };
  return { name };
}

async function route() {
  if (!store.isUnlocked()) return;
  if (currentCleanup) { const c = currentCleanup; currentCleanup = null; await c(); }
  const r = parseRoute();
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === (r.name === 'editor' ? 'analyses' : r.name === 'tool' ? 'tools' : r.name)));
  view.onclick = null;
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  const fn = { home: viewHome, tools: viewTools, tool: viewTool, analyses: viewAnalyses, trash: viewTrash, editor: viewEditor, settings: viewSettings, stats: viewStats }[r.name] || viewHome;
  fn(r.id);
}
window.addEventListener('hashchange', route);

/* ================= 共用片段 ================= */
const pendingNew = new Map();
function newAnalysis(toolId, extra = {}) {
  const tool = TOOLS[toolId];
  const a = { id: store.uid(), toolId, title: '', tags: [], notes: '', links: [], content: defaultContent(tool), createdAt: Date.now(), updatedAt: Date.now(), archived: false, deletedAt: null };
  if (extra.links) a.links = extra.links;
  if (extra.tags) a.tags = extra.tags;
  if (extra.refId && 'refId' in a.content) a.content.refId = extra.refId;
  pendingNew.set(a.id, a);
  location.hash = `#/a/${a.id}`;
}

const live = () => store.all().filter((a) => !a.deletedAt);

function toolBadge(tool) {
  const c = categoryOf(tool);
  return `<span class="badge" style="--cc:${c.color}">${esc(tool.name)}</span>`;
}

function snippet(a) {
  const t = (a.notes || contentText(a.content)).replace(/\s+/g, ' ').trim();
  return t.length > 80 ? t.slice(0, 80) + '…' : t;
}

function card(a, selectable = false, selected = false) {
  const tool = TOOLS[a.toolId];
  return `<div class="a-card ${selected ? 'sel' : ''}" data-id="${a.id}" style="--cc:${categoryOf(tool).color}">
    ${selectable ? `<input type="checkbox" class="a-check" data-id="${a.id}" ${selected ? 'checked' : ''}>` : ''}
    <a href="#/a/${a.id}" class="a-link">
      <div class="a-top">${toolBadge(tool)}${a.archived ? '<span class="badge badge-muted">已封存</span>' : ''}<span class="a-date">${relTime(a.updatedAt)}</span></div>
      <h4>${esc(a.title || '未命名')}</h4>
      <p>${esc(snippet(a)) || '<span class="muted">（空白）</span>'}</p>
      ${a.tags && a.tags.length ? `<div class="a-tags">${a.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
    </a>
  </div>`;
}

/* ================= 首頁 ================= */
const greet = () => { const h = new Date().getHours(); return h < 5 ? '夜深了' : h < 11 ? '早安' : h < 14 ? '午安' : h < 18 ? '午後好' : '晚安'; };
function viewHome() {
  const list = live().filter((a) => !a.archived).sort((p, q) => q.updatedAt - p.updatedAt);
  const lastBackup = LS.get('lastBackup', 0);
  const connected = !!store.githubConfig();
  const needBackup = list.length > 0 && Date.now() - lastBackup > 7 * 86400000;
  const counts = {};
  live().forEach((a) => { counts[a.toolId] = (counts[a.toolId] || 0) + 1; });
  const fav = Object.keys(TOOLS).sort((p, q) => (counts[q] || 0) - (counts[p] || 0)).slice(0, 6);
  const exp = store.githubConfig()?.tokenExp;
  const expDays = exp ? Math.floor((new Date(exp) - Date.now()) / 86400000) : null;
  view.innerHTML = `
    <div class="page-head"><h1>${greet()}，思考者</h1><p class="muted">${fmtDate(Date.now(), false)} · ${live().length} 份分析</p></div>
    ${!connected ? `<div class="banner">☁️ 尚未連線雲端。<a href="#/settings">到設定連線 GitHub 私人 repo</a>，就能在電腦和手機之間同步。</div>` : ''}
    ${expDays != null && expDays < 14 ? `<div class="banner banner-warn">🔑 GitHub Token 將在 ${Math.max(0, expDays)} 天後到期，<a href="#/settings">請更新 Token</a>。</div>` : ''}
    ${needBackup ? `<div class="banner banner-warn">💾 已超過 7 天沒有下載備份檔（上次：${lastBackup ? fmtDate(lastBackup, false) : '從未'}）。<button class="link-btn" id="quick-backup">立即備份</button></div>` : ''}
    <section class="sec"><h2>快速開始</h2>
      <div class="quick">${fav.map((id) => { const t = TOOLS[id]; return `<button class="quick-btn" data-new="${id}" style="--cc:${categoryOf(t).color}"><b>${esc(t.name)}</b><small>${esc(categoryOf(t).name)}</small></button>`; }).join('')}
      <a class="quick-btn quick-more" href="#/tools"><b>所有工具 →</b><small>${Object.keys(TOOLS).length} 個可用</small></a></div>
    </section>
    <section class="sec"><div class="sec-head"><h2>最近編輯</h2><a href="#/analyses">全部 →</a></div>
      ${list.length ? `<div class="cards">${list.slice(0, 6).map((a) => card(a)).join('')}</div>` : `<div class="empty">還沒有任何分析。從上面挑一個工具開始吧！</div>`}
    </section>`;
  view.onclick = (e) => {
    const b = e.target.closest('[data-new]');
    if (b) newAnalysis(b.dataset.new);
    if (e.target.id === 'quick-backup') doBackup();
  };
}

/* ================= 工具庫 ================= */
function viewTools() {
  const counts = {};
  live().forEach((a) => { counts[a.toolId] = (counts[a.toolId] || 0) + 1; });
  view.innerHTML = `
    <div class="page-head"><h1>工具庫</h1><p class="muted">${Object.keys(TOOLS).length} 個思考工具，分成 ${CATEGORIES.length} 大類${COMING.length ? `，另有 ${COMING.length} 個即將推出` : ''}</p></div>
    <input class="search" id="tsearch" placeholder="搜尋工具…">
    <div id="tlist"></div>`;
  const draw = (q = '') => {
    q = q.trim().toLowerCase();
    const hit = (s) => !q || s.toLowerCase().includes(q);
    $('#tlist').innerHTML = CATEGORIES.map((c) => {
      const avail = Object.values(TOOLS).filter((t) => t.category === c.id && hit(t.name + t.en + t.summary));
      const soon = COMING.filter(([cat, n, d]) => cat === c.id && hit(n + d));
      if (!avail.length && !soon.length) return '';
      return `<section class="cat" style="--cc:${c.color}"><h2><span class="dot"></span>${esc(c.name)}<small>${esc(c.desc)}</small></h2>
        <div class="tool-grid">${avail.map((t) => `
          <a class="tool-card" href="#/tool/${t.id}"><b>${esc(t.name)}</b><i>${esc(t.en)}</i><p>${esc(t.summary)}</p>${counts[t.id] ? `<span class="cnt">${counts[t.id]} 份分析</span>` : ''}</a>`).join('')}
        ${soon.map(([, n, d]) => `<div class="tool-card soon"><b>${esc(n)}</b><p>${esc(d)}</p><span class="cnt">即將推出</span></div>`).join('')}</div></section>`;
    }).join('') || '<div class="empty">找不到符合的工具</div>';
  };
  $('#tsearch').addEventListener('input', (e) => draw(e.target.value));
  draw();
}

function viewTool(id) {
  const t = TOOLS[id];
  if (!t) { view.innerHTML = '<div class="empty">找不到這個工具</div>'; return; }
  const c = categoryOf(t);
  const mine = live().filter((a) => a.toolId === id).sort((p, q) => q.updatedAt - p.updatedAt);
  view.innerHTML = `
    <a class="back" href="#/tools">← 工具庫</a>
    <div class="tool-hero" style="--cc:${c.color}">
      <span class="badge" style="--cc:${c.color}">${esc(c.name)}</span>
      <h1>${esc(t.name)} <small>${esc(t.en)}</small></h1>
      <p class="lead">${esc(t.summary)}</p>
      <button class="btn btn-primary" data-new="${t.id}">＋ 新增分析</button>
    </div>
    <div class="doc-grid">
      <section class="doc"><h3>適用情境</h3><ul>${t.when.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section class="doc"><h3>操作步驟</h3><ol>${t.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
      <section class="doc"><h3>範例</h3><p>${esc(t.example)}</p></section>
      <section class="doc"><h3>小技巧</h3><p>${esc(t.tips)}</p></section>
    </div>
    ${t.related && t.related.length ? `<div class="related">相關工具：${t.related.map((r) => `<a href="#/tool/${r}">${esc(TOOLS[r].name)}</a>`).join('')}</div>` : ''}
    <section class="sec"><h2>我的 ${esc(t.name)}（${mine.length}）</h2>
      ${mine.length ? `<div class="cards">${mine.map((a) => card(a)).join('')}</div>` : '<div class="empty">還沒有用這個工具做過分析</div>'}</section>`;
  view.onclick = (e) => { const b = e.target.closest('[data-new]'); if (b) newAnalysis(b.dataset.new); };
}

/* ================= 我的分析 ================= */
const filt = { q: '', tool: '', tag: '', sort: 'updated', archived: false, select: false, sel: new Set() };
function viewAnalyses() {
  const allTags = [...new Set(live().flatMap((a) => a.tags || []))].sort();
  view.innerHTML = `
    <div class="page-head row-between"><h1>我的分析</h1>
      <div class="btn-row"><a class="btn btn-ghost" href="#/trash">🗑 垃圾桶</a><button class="btn" id="sel-mode">${filt.select ? '取消選取' : '選取匯出'}</button></div></div>
    <div class="filters">
      <input class="search" id="q" placeholder="搜尋標題、內容、標籤…" value="${esc(filt.q)}">
      <select id="ftool"><option value="">所有工具</option>${Object.values(TOOLS).map((t) => `<option value="${t.id}" ${filt.tool === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <select id="ftag"><option value="">所有標籤</option>${allTags.map((t) => `<option ${filt.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select id="fsort"><option value="updated">最近更新</option><option value="created" ${filt.sort === 'created' ? 'selected' : ''}>建立時間</option><option value="title" ${filt.sort === 'title' ? 'selected' : ''}>標題</option></select>
      <label class="check"><input type="checkbox" id="farch" ${filt.archived ? 'checked' : ''}> 顯示封存</label>
    </div>
    <div id="sel-bar"></div>
    <div id="alist"></div>`;
  const filtered = () => {
    const q = filt.q.trim().toLowerCase();
    let list = live().filter((a) => (filt.archived || !a.archived)
      && (!filt.tool || a.toolId === filt.tool)
      && (!filt.tag || (a.tags || []).includes(filt.tag))
      && (!q || `${a.title} ${(a.tags || []).join(' ')} ${a.notes} ${contentText(a.content)} ${TOOLS[a.toolId].name}`.toLowerCase().includes(q)));
    const s = { updated: (p, q2) => q2.updatedAt - p.updatedAt, created: (p, q2) => q2.createdAt - p.createdAt, title: (p, q2) => (p.title || '').localeCompare(q2.title || '', 'zh-Hant') }[filt.sort];
    return list.sort(s);
  };
  const draw = () => {
    const list = filtered();
    $('#alist').innerHTML = list.length ? `<div class="cards">${list.map((a) => card(a, filt.select, filt.sel.has(a.id))).join('')}</div>`
      : `<div class="empty">${live().length ? '沒有符合條件的分析' : '還沒有任何分析，<a href="#/tools">到工具庫開始</a>'}</div>`;
    const targets = filt.select ? list.filter((a) => filt.sel.has(a.id)) : list;
    $('#sel-bar').innerHTML = `<div class="sel-bar">
      <span>${filt.select ? `已選 ${filt.sel.size} 份` : `共 ${list.length} 份`}</span>
      ${filt.select ? '<button class="link-btn" id="sel-all">全選</button>' : ''}
      <span class="grow-sp"></span>
      <button class="btn btn-sm" data-pdf="portrait" ${targets.length ? '' : 'disabled'}>匯出 PDF（直）</button>
      <button class="btn btn-sm" data-pdf="landscape" ${targets.length ? '' : 'disabled'}>PDF（橫）</button>
      <button class="btn btn-sm" id="md-all" ${targets.length ? '' : 'disabled'}>Markdown</button></div>`;
    $('#sel-bar').dataset.count = targets.length;
    view._targets = targets;
  };
  $('#q').addEventListener('input', debounce((e) => { filt.q = e.target.value; draw(); }, 200));
  $('#ftool').onchange = (e) => { filt.tool = e.target.value; draw(); };
  $('#ftag').onchange = (e) => { filt.tag = e.target.value; draw(); };
  $('#fsort').onchange = (e) => { filt.sort = e.target.value; draw(); };
  $('#farch').onchange = (e) => { filt.archived = e.target.checked; draw(); };
  $('#sel-mode').onclick = () => { filt.select = !filt.select; filt.sel.clear(); viewAnalyses(); };
  view.onclick = (e) => {
    const chk = e.target.closest('.a-check');
    if (chk) { chk.checked ? filt.sel.add(chk.dataset.id) : filt.sel.delete(chk.dataset.id); draw(); return; }
    if (filt.select && e.target.closest('.a-link')) {
      e.preventDefault();
      const id = e.target.closest('.a-card').dataset.id;
      filt.sel.has(id) ? filt.sel.delete(id) : filt.sel.add(id);
      draw();
      return;
    }
    if (e.target.id === 'sel-all') { filtered().forEach((a) => filt.sel.add(a.id)); draw(); }
    const p = e.target.closest('[data-pdf]');
    if (p) printPDF(view._targets, { orientation: p.dataset.pdf, cover: true, title: '思考分析彙編' });
    if (e.target.id === 'md-all') exportMarkdown(view._targets, '彙編');
  };
  draw();
}

function viewTrash() {
  const list = store.all().filter((a) => a.deletedAt).sort((p, q) => q.deletedAt - p.deletedAt);
  view.innerHTML = `
    <a class="back" href="#/analyses">← 我的分析</a>
    <div class="page-head row-between"><h1>垃圾桶</h1>${list.length ? '<button class="btn btn-danger" id="empty">清空垃圾桶</button>' : ''}</div>
    <p class="muted">移到垃圾桶的分析會保留 30 天，之後自動永久刪除。</p>
    ${list.length ? `<div class="trash-list">${list.map((a) => `
      <div class="trash-row"><div>${toolBadge(TOOLS[a.toolId])} <b>${esc(a.title || '未命名')}</b><small class="muted">刪除於 ${fmtDate(a.deletedAt)}</small></div>
      <div class="btn-row"><button class="btn btn-sm" data-restore="${a.id}">還原</button><button class="btn btn-sm btn-danger" data-kill="${a.id}">永久刪除</button></div></div>`).join('')}</div>`
      : '<div class="empty">垃圾桶是空的</div>'}`;
  view.onclick = async (e) => {
    const r = e.target.closest('[data-restore]');
    if (r) { const a = store.get(r.dataset.restore); a.deletedAt = null; await store.save(a); toast('已還原'); viewTrash(); }
    const k = e.target.closest('[data-kill]');
    if (k && await confirmDialog('永久刪除後無法復原，確定嗎？', { okLabel: '永久刪除', danger: true })) { await store.destroy(k.dataset.kill); viewTrash(); }
    if (e.target.id === 'empty' && await confirmDialog(`確定永久刪除 ${list.length} 份分析？`, { okLabel: '清空', danger: true })) {
      for (const a of list) await store.destroy(a.id);
      viewTrash();
    }
  };
}

/* ================= 編輯器 ================= */
function viewEditor(id) {
  let a = store.get(id) || (pendingNew.get(id) ? structuredClone(pendingNew.get(id)) : null);
  if (!a) { view.innerHTML = '<div class="empty">找不到這份分析（可能已被刪除）。<a href="#/analyses">回到我的分析</a></div>'; return; }
  let isNew = !store.get(id);
  const tool = TOOLS[a.toolId];
  const cat = categoryOf(tool);
  const wide = LS.get('edTab', 'edit');
  view.innerHTML = `
    <div class="ed-head" style="--cc:${cat.color}">
      <div class="ed-crumb"><a href="#/analyses">我的分析</a> / <a href="#/tool/${tool.id}">${esc(tool.name)}</a></div>
      <input class="ed-title" id="title" placeholder="未命名${esc(tool.name)}" value="${esc(a.title)}">
      <div class="ed-meta">
        <input class="ed-tags" id="tags" placeholder="標籤，用逗號分隔" value="${esc((a.tags || []).join(', '))}">
        <span class="save-st" id="save-st">${isNew ? '尚未儲存' : '已儲存 ' + fmtDate(a.updatedAt)}</span>
      </div>
      <div class="ed-actions">
        <div class="ed-tabs"><button data-tab="edit">編輯</button><button data-tab="fig">思考圖</button></div>
        <details class="menu"><summary class="btn btn-primary">匯出 ▾</summary><div class="menu-pop">
          <button data-exp="png">圖片 PNG</button><button data-exp="jpg">圖片 JPG</button><button data-exp="svg">向量圖 SVG</button>
          <hr><button data-exp="pdf-p">PDF（A4 直式）</button><button data-exp="pdf-l">PDF（A4 橫式）</button>
          <hr><button data-exp="md">Markdown</button></div></details>
        <details class="menu"><summary class="btn">⋯</summary><div class="menu-pop menu-right">
          <button data-act="extend">延伸分析…</button><button data-act="link">連結其他分析…</button><hr>
          <button data-act="dup">建立副本</button><button data-act="arch">${a.archived ? '取消封存' : '封存'}</button>
          <button data-act="help">工具說明</button><hr><button data-act="del" class="danger">移到垃圾桶</button></div></details>
      </div>
    </div>
    <div class="ed-layout tab-${wide}">
      <section class="ed-pane"><div id="ed-root"></div>
        <label class="notes-l">備註<textarea id="notes" class="grow" rows="3" placeholder="補充說明、結論、待辦…">${esc(a.notes || '')}</textarea></label>
        <div class="links-sec" id="links"></div>
      </section>
      <section class="fig-pane"><div class="fig-box" id="fig"></div></section>
    </div>`;
  const layout = $('.ed-layout');
  const st = $('#save-st');
  const figBox = $('#fig');

  const drawFig = debounce(() => {
    try { figBox.innerHTML = renderFigure(a).svg; } catch (e) { console.error(e); figBox.textContent = '思考圖產生失敗'; }
  }, 250);
  const persist = debounce(async () => {
    st.textContent = '儲存中…';
    try {
      await store.save(a);
      if (isNew) { isNew = false; pendingNew.delete(a.id); }
      st.textContent = '已儲存 ' + fmtDate(a.updatedAt);
    } catch (e) { st.textContent = '儲存失敗'; toast(e.message, 'error'); }
  }, 700);
  const changed = () => { st.textContent = '編輯中…'; persist(); drawFig(); };

  const edRoot = $('#ed-root');
  mountEditor(tool, a.content, edRoot, changed, {
    listByTool: (tid) => live().filter((x) => x.toolId === tid).sort((p, q) => q.updatedAt - p.updatedAt),
    get: (rid) => store.get(rid),
  });
  drawFig.flush();

  $('#title').addEventListener('input', (e) => { a.title = e.target.value; changed(); });
  $('#tags').addEventListener('change', (e) => {
    a.tags = [...new Set(e.target.value.split(/[,，、]/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean))];
    e.target.value = a.tags.join(', ');
    changed();
  });
  const notes = $('#notes');
  notes.addEventListener('input', () => { a.notes = notes.value; notes.style.height = 'auto'; notes.style.height = notes.scrollHeight + 2 + 'px'; changed(); });

  if (!Array.isArray(a.links)) a.links = [];
  const linksBox = $('#links');
  const chip = (o, back) => {
    const t = TOOLS[o.toolId];
    return `<span class="link-chip ${back ? 'back' : ''}" style="--cc:${categoryOf(t).color}" title="${back ? '這份分析連結到目前的分析' : ''}"><a href="#/a/${o.id}">${esc(o.title || '未命名')}</a><small>${esc(t.name)}${back ? ' · 反向' : ''}</small>${back ? '' : `<button class="x" data-unlink="${o.id}" title="移除連結">×</button>`}</span>`;
  };
  const renderLinks = () => {
    const out = a.links.map((lid) => store.get(lid)).filter((o) => o && !o.deletedAt);
    const inc = live().filter((o) => o.id !== a.id && (o.links || []).includes(a.id) && !a.links.includes(o.id));
    linksBox.innerHTML = `<h4>關聯分析 <button class="btn btn-sm btn-ghost" data-act2="link">＋ 連結</button><button class="btn btn-sm btn-ghost" data-act2="extend">＋ 延伸</button></h4>
      ${out.length || inc.length ? `<div class="link-chips">${out.map((o) => chip(o, false)).join('')}${inc.map((o) => chip(o, true)).join('')}</div>` : '<p class="hint">還沒有關聯。可以把相關的分析串起來，例如 SWOT → TOWS → 決策矩陣。</p>'}`;
  };
  renderLinks();
  const pickLink = async () => {
    const cands = live().filter((o) => o.id !== a.id && !a.links.includes(o.id)).sort((p, q) => q.updatedAt - p.updatedAt);
    if (!cands.length) return toast('沒有其他可以連結的分析');
    const id2 = await modal({
      title: '連結其他分析', wide: true,
      body: `<input class="search" id="lk-q" placeholder="搜尋標題或工具…" style="margin:0;max-width:none"><div class="lk-list">${cands.map((o) => `<button class="lk-item" data-lk="${o.id}" data-s="${esc(((o.title || '') + ' ' + TOOLS[o.toolId].name).toLowerCase())}">${toolBadge(TOOLS[o.toolId])}<b>${esc(o.title || '未命名')}</b><small class="muted">${relTime(o.updatedAt)}</small></button>`).join('')}</div>`,
      actions: [{ label: '取消', value: null }],
      onOpen: (w, close) => {
        $('#lk-q', w).addEventListener('input', (ev) => { const q = ev.target.value.trim().toLowerCase(); $$('.lk-item', w).forEach((b) => { b.hidden = q && !b.dataset.s.includes(q); }); });
        w.addEventListener('click', (ev) => { const b = ev.target.closest('[data-lk]'); if (b) close(b.dataset.lk); });
      },
    });
    if (!id2) return;
    a.links.push(id2);
    renderLinks();
    changed();
    toast('已連結');
  };
  const pickExtend = async () => {
    const rel = (tool.related || []).filter((r) => TOOLS[r]);
    const tid = await modal({
      title: `從「${a.title || tool.name}」延伸分析`, wide: true,
      body: `<p class="hint">新的分析會自動連結回這一份。</p>
        ${rel.length ? `<div class="pick"><div class="pick-cat" style="--cc:${cat.color}"><h4>建議的下一步</h4>${rel.map((r) => `<button class="pick-btn" data-ext="${r}"><b>${esc(TOOLS[r].name)}</b><small>${esc(TOOLS[r].summary)}</small></button>`).join('')}</div></div>` : ''}
        <details style="margin-top:12px"><summary class="link-btn">所有工具</summary><div class="pick" style="margin-top:10px">${CATEGORIES.map((cg) => {
          const ts = Object.values(TOOLS).filter((t) => t.category === cg.id);
          return `<div class="pick-cat" style="--cc:${cg.color}"><h4>${esc(cg.name)}</h4>${ts.map((t) => `<button class="pick-btn" data-ext="${t.id}"><b>${esc(t.name)}</b></button>`).join('')}</div>`;
        }).join('')}</div></details>`,
      actions: [{ label: '取消', value: null }],
      onOpen: (w, close) => w.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ext]'); if (b) close(b.dataset.ext); }),
    });
    if (!tid) return;
    await ensureSaved();
    newAnalysis(tid, { links: [a.id], tags: [...(a.tags || [])], refId: TOOLS[tid].ref === a.toolId ? a.id : null });
  };
  linksBox.addEventListener('click', (e) => {
    const u = e.target.closest('[data-unlink]');
    if (u) { a.links = a.links.filter((l) => l !== u.dataset.unlink); renderLinks(); changed(); return; }
    const b = e.target.closest('[data-act2]');
    if (b) (b.dataset.act2 === 'link' ? pickLink : pickExtend)();
  });

  const setTab = (t) => {
    layout.className = `ed-layout tab-${t}`;
    $$('.ed-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    LS.set('edTab', t);
    if (t === 'fig') drawFig.flush();
  };
  setTab(wide);

  const ensureSaved = async () => { if (isNew) await persist.flush(); };
  $('.ed-head').addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) return setTab(tab.dataset.tab);
    const ex = e.target.closest('[data-exp]');
    const act = e.target.closest('[data-act]');
    if (ex || act) $$('details.menu').forEach((d) => d.removeAttribute('open'));
    if (ex) {
      const k = ex.dataset.exp;
      try {
        if (['png', 'jpg', 'svg'].includes(k)) { await exportImage(a, k); toast('已下載圖片'); }
        else if (k === 'md') exportMarkdown([a]);
        else printPDF([a], { orientation: k === 'pdf-l' ? 'landscape' : 'portrait' });
      } catch (err) { toast(err.message, 'error'); }
    }
    if (act) {
      const k = act.dataset.act;
      if (k === 'dup') {
        await ensureSaved();
        const b = structuredClone(a);
        b.id = store.uid(); b.title = (a.title || '未命名') + '（副本）'; b.createdAt = Date.now(); b.links = [a.id];
        await store.save(b);
        location.hash = `#/a/${b.id}`;
        toast('已建立副本');
      }
      if (k === 'arch') { a.archived = !a.archived; await persist.flush(); act.textContent = a.archived ? '取消封存' : '封存'; toast(a.archived ? '已封存' : '已取消封存'); }
      if (k === 'help') showToolHelp(tool);
      if (k === 'link') pickLink();
      if (k === 'extend') pickExtend();
      if (k === 'del') {
        if (isNew) { pendingNew.delete(a.id); persist.cancel(); location.hash = '#/analyses'; return; }
        if (await confirmDialog('移到垃圾桶？30 天內可以還原。', { okLabel: '移到垃圾桶', danger: true })) {
          a.deletedAt = Date.now();
          await persist.flush();
          location.hash = '#/analyses';
        }
      }
    }
  });
  document.addEventListener('click', closeMenus);
  const onHide = () => { if (document.visibilityState === 'hidden' && !isNew) persist.flush(); };
  document.addEventListener('visibilitychange', onHide);

  currentCleanup = async () => {
    document.removeEventListener('click', closeMenus);
    document.removeEventListener('visibilitychange', onHide);
    drawFig.cancel();
    if (isNew) { persist.cancel(); pendingNew.delete(a.id); }
    else await persist.flush();
  };
}

function closeMenus(e) {
  if (!e.target.closest('details.menu')) $$('details.menu[open]').forEach((d) => d.removeAttribute('open'));
}

function showToolHelp(t) {
  modal({
    title: `${t.name} 使用說明`, wide: true,
    body: `<p class="lead">${esc(t.summary)}</p><h4>操作步驟</h4><ol>${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><h4>範例</h4><p>${esc(t.example)}</p><h4>小技巧</h4><p>${esc(t.tips)}</p>`,
    actions: [{ label: '關閉', primary: true }],
  });
}

/* ================= 統計 ================= */
function viewStats() {
  const list = live();
  const now = Date.now();
  const byTool = {}, byCat = {}, tags = {};
  list.forEach((a) => {
    byTool[a.toolId] = (byTool[a.toolId] || 0) + 1;
    const c = TOOLS[a.toolId].category;
    byCat[c] = (byCat[c] || 0) + 1;
    (a.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; });
  });
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const thisMonth = list.filter((a) => a.createdAt >= month.getTime()).length;
  const linkCount = list.reduce((s, a) => s + (a.links || []).length, 0);
  // 近 12 週（以週一為起點）
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 11);
  const weeks = Array.from({ length: 12 }, (_, i) => ({ t: start.getTime() + i * 7 * 86400000, n: 0 }));
  list.forEach((a) => { const i = Math.floor((a.updatedAt - start.getTime()) / (7 * 86400000)); if (i >= 0 && i < 12) weeks[i].n++; });
  const wmax = Math.max(1, ...weeks.map((w) => w.n));
  const catMax = Math.max(1, ...Object.values(byCat));
  const topTools = Object.entries(byTool).sort((p, q) => q[1] - p[1]).slice(0, 10);
  const toolMax = Math.max(1, ...topTools.map((x) => x[1]));
  const unused = Object.values(TOOLS).filter((t) => !byTool[t.id]);
  const tagList = Object.entries(tags).sort((p, q) => q[1] - p[1]);
  const tagMax = Math.max(1, ...tagList.map((x) => x[1]));
  view.innerHTML = `
    <div class="page-head"><h1>統計</h1><p class="muted">你的思考足跡</p></div>
    <div class="kpis">
      <div class="kpi"><b>${list.length}</b><span>份分析</span></div>
      <div class="kpi"><b>${Object.keys(byTool).length}<small style="font-size:16px;color:var(--muted)"> / ${Object.keys(TOOLS).length}</small></b><span>用過的工具</span></div>
      <div class="kpi"><b>${thisMonth}</b><span>本月新增</span></div>
      <div class="kpi"><b>${Object.keys(tags).length}</b><span>個標籤</span></div>
      <div class="kpi"><b>${linkCount}</b><span>條關聯</span></div>
    </div>
    <div class="st-grid">
      <section class="st-card"><h3>近 12 週活動</h3>
        <div class="weeks">${weeks.map((w) => { const d = new Date(w.t); return `<div title="${d.getMonth() + 1}/${d.getDate()} 那週：${w.n} 份"><b>${w.n || ''}</b><i style="height:${(w.n / wmax) * 80}%"></i><span>${d.getMonth() + 1}/${d.getDate()}</span></div>`; }).join('')}</div></section>
      <section class="st-card"><h3>各類別</h3>
        ${CATEGORIES.map((c) => `<div class="hbar" style="--cc:${c.color}"><span>${esc(c.name)}</span><i style="width:${((byCat[c.id] || 0) / catMax) * 100}%"></i><em>${byCat[c.id] || 0}</em></div>`).join('')}</section>
      <section class="st-card"><h3>最常用的工具</h3>
        ${topTools.length ? topTools.map(([id, n]) => `<div class="hbar" style="--cc:${categoryOf(TOOLS[id]).color}"><a href="#/tool/${id}">${esc(TOOLS[id].name)}</a><i style="width:${(n / toolMax) * 100}%"></i><em>${n}</em></div>`).join('') : '<p class="muted">還沒有資料</p>'}</section>
      <section class="st-card"><h3>標籤</h3>
        ${tagList.length ? `<div class="tag-cloud">${tagList.map(([t, n]) => `<a href="#/analyses" data-tag="${esc(t)}" style="font-size:${13 + (n / tagMax) * 9}px">#${esc(t)}<small class="muted"> ${n}</small></a>`).join('')}</div>` : '<p class="muted">還沒有標籤。在分析標題下方可以加標籤。</p>'}</section>
    </div>
    ${unused.length ? `<section class="sec"><h2>還沒試過的工具（${unused.length}）</h2><div class="quick">${unused.slice(0, 12).map((t) => `<a class="quick-btn" href="#/tool/${t.id}" style="--cc:${categoryOf(t).color}"><b>${esc(t.name)}</b><small>${esc(categoryOf(t).name)}</small></a>`).join('')}</div></section>` : ''}`;
  view.onclick = (e) => {
    const t = e.target.closest('[data-tag]');
    if (t) { filt.tag = t.dataset.tag; filt.q = ''; filt.tool = ''; }
  };
}

/* ================= 設定 ================= */
async function doBackup() {
  const data = await store.exportBackup();
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `ThinkingLab-backup-${stamp()}.json`);
  LS.set('lastBackup', Date.now());
  toast(`已下載加密備份（${data.records.length} 份分析）`, 'ok');
}

function viewSettings() {
  const gc = store.githubConfig();
  const s = store.syncState;
  const lockMin = LS.get('lock', 15);
  const theme = LS.get('theme', 'system');
  view.innerHTML = `
    <div class="page-head"><h1>設定</h1></div>

    <section class="set-sec"><h2>☁️ 雲端同步（GitHub 私人 repo）</h2>
      ${gc ? `
        <div class="kv"><span>Repo</span><b>${esc(gc.owner)}/${esc(gc.repo)}</b></div>
        <div class="kv"><span>狀態</span><b id="set-sync">${esc(SYNC_TEXT[s.status])}</b>${s.error ? `<small class="err">${esc(s.error)}</small>` : ''}</div>
        <div class="kv"><span>上次同步</span><b>${fmtDate(s.lastSync)}</b></div>
        ${gc.tokenExp ? `<div class="kv"><span>Token 到期</span><b>${esc(fmtDate(new Date(gc.tokenExp).getTime(), false))}</b></div>` : ''}
        <div class="btn-row"><button class="btn btn-primary" id="sync-now">立即同步</button><button class="btn" id="tok">更新 Token</button><button class="btn btn-danger" id="disc">中斷連線</button></div>`
      : `
        <p class="muted">資料會先在這台裝置加密，再上傳到你的私人 repo。其他裝置用同一組主密碼即可解密。<a href="#" id="howto">設定教學</a></p>
        <form class="form" id="f-gh">
          <label>GitHub 帳號<input id="owner" required placeholder="例：jarcle"></label>
          <label>資料 repo 名稱<input id="repo" value="thinkinglab-data" required></label>
          <label>Fine-grained Token<input type="password" id="token" required placeholder="github_pat_…"></label>
          <button class="btn btn-primary" type="submit">測試並連線</button>
        </form>`}
    </section>

    <section class="set-sec"><h2>💾 備份與還原</h2>
      <p class="muted">上次下載備份：${fmtDate(LS.get('lastBackup', 0)) || '從未'}</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="bk">下載加密備份 .json</button>
        <label class="btn">匯入備份…<input type="file" id="imp" accept=".json,application/json" hidden></label>
      </div>
      <h3>匯出可閱讀版本（未加密）</h3>
      <div class="btn-row">
        <button class="btn" data-allpdf="portrait">全部匯出 PDF（直）</button>
        <button class="btn" data-allpdf="landscape">PDF（橫）</button>
        <button class="btn" id="allmd">全部匯出 Markdown</button>
      </div>
      <p class="hint">PDF 會開啟列印視窗，請選擇「另存為 PDF」。手機請從分享選單儲存。PDF 與 Markdown 無法還原回系統。</p>
    </section>

    <section class="set-sec"><h2>🔒 安全</h2>
      <label class="inline">閒置自動上鎖
        <select id="lockmin">${[[5, '5 分鐘'], [15, '15 分鐘'], [30, '30 分鐘'], [60, '1 小時'], [0, '不自動上鎖']].map(([v, l]) => `<option value="${v}" ${v === lockMin ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="btn-row"><button class="btn" id="chpw">變更主密碼</button><button class="btn" id="lock-now">立即上鎖</button></div>
    </section>

    <section class="set-sec"><h2>🎨 外觀</h2>
      <div class="seg" id="theme">${[['system', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(([v, l]) => `<button data-v="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    </section>

    <section class="set-sec"><h2>ℹ️ 關於</h2>
      <p class="muted">ThinkingLab v3.0 · ${Object.keys(TOOLS).length} 個思考工具 · 加密：PBKDF2-SHA256（60 萬次）+ AES-256-GCM</p>
      <p class="muted" id="persist-st"></p>
      <button class="btn btn-danger" id="wipe">清除此裝置的資料</button>
    </section>`;

  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { const el = $('#persist-st'); if (el) el.textContent = p ? '✓ 瀏覽器已允許持久保存資料' : '瀏覽器可能在空間不足時清除資料，請定期備份或開啟雲端同步'; });

  const fgh = $('#f-gh');
  if (fgh) fgh.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', fgh);
    btn.disabled = true; btn.textContent = '連線中…';
    try {
      const info = await store.connectGitHub({ owner: $('#owner').value, repo: $('#repo').value, token: $('#token').value });
      toast(info.private ? '已連線並完成同步' : '已連線。注意：這個 repo 是公開的，建議改為私人', info.private ? 'ok' : 'warn', 6000);
      viewSettings();
    } catch (err) {
      toast(err.message, 'error', 6000);
      btn.disabled = false; btn.textContent = '測試並連線';
    }
  };

  view.onclick = async (e) => {
    const id = e.target.id;
    if (id === 'howto') { e.preventDefault(); showGitHubHelp(); }
    if (id === 'sync-now') { await store.runSync(); toast(store.syncState.status === 'ok' ? '同步完成' : (store.syncState.error || '同步未完成'), store.syncState.status === 'ok' ? 'ok' : 'error'); viewSettings(); }
    if (id === 'tok') {
      await modal({
        title: '更新 GitHub Token', body: `<label class="form">新的 Token<input type="password" id="nt" placeholder="github_pat_…"></label>`,
        actions: [{ label: '取消', value: null }, { label: '更新', primary: true, handler: async (root) => {
          try { await store.updateToken($('#nt', root).value); toast('Token 已更新', 'ok'); return true; } catch (err) { toast(err.message, 'error'); return false; }
        } }],
      });
      viewSettings();
    }
    if (id === 'disc' && await confirmDialog('中斷後，這台裝置不再同步。雲端 repo 的資料不會被刪除。', { okLabel: '中斷連線', danger: true })) { await store.disconnectGitHub(); viewSettings(); }
    if (id === 'bk') doBackup();
    if (id === 'allmd') exportMarkdown(live(), '全部');
    const ap = e.target.closest('[data-allpdf]');
    if (ap) { const l = live().sort((p, q) => q.updatedAt - p.updatedAt); if (!l.length) return toast('目前沒有分析'); printPDF(l, { orientation: ap.dataset.allpdf, cover: true, title: '全部思考分析' }); }
    if (id === 'chpw') changePasswordDialog();
    if (id === 'lock-now') doLock();
    const tb = e.target.closest('#theme button');
    if (tb) { LS.set('theme', tb.dataset.v); applyTheme(); $$('#theme button').forEach((b) => b.classList.toggle('on', b === tb)); }
    if (id === 'wipe') {
      const ok = await confirmDialog('會清除這台裝置上的所有資料與設定（雲端 repo 不受影響）。若沒有連線雲端，請先下載備份！', { okLabel: '清除', danger: true });
      if (ok) { await store.wipeDevice(); stopAutoLock(); showWelcome(); }
    }
  };
  $('#lockmin').onchange = (e) => { LS.set('lock', +e.target.value); toast('已更新'); };
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch (_) { return toast('檔案格式不正確', 'error'); }
    if (!store.isBackup(obj)) return toast('這不是 ThinkingLab 的備份檔', 'error');
    const need = store.backupNeedsPassword(obj);
    const res = await modal({
      title: '匯入備份',
      body: `<p>備份檔：${obj.records.length} 份分析（${fmtDate(obj.exportedAt)}）</p>
        ${need ? '<label class="form">此備份使用不同的主密碼，請輸入<input type="password" id="bpw"></label>' : ''}
        <label class="radio"><input type="radio" name="mode" value="merge" checked> 合併：保留兩邊，同一份分析取較新的版本</label>
        <label class="radio"><input type="radio" name="mode" value="overwrite"> 完全覆蓋：以備份檔取代目前所有資料</label>`,
      actions: [{ label: '取消', value: null }, { label: '匯入', primary: true, handler: async (root) => {
        const list = await store.readBackup(obj, need ? $('#bpw', root).value : null);
        if (!list) { toast('密碼不正確', 'error'); return false; }
        const mode = $('input[name=mode]:checked', root).value;
        if (mode === 'overwrite' && !(await confirmDialog('確定以備份檔完全覆蓋目前的資料？', { okLabel: '覆蓋', danger: true }))) return false;
        const n = await store.importAnalyses(list, mode);
        return n;
      } }],
    });
    if (res != null) toast(`已匯入 ${res} 份分析`, 'ok');
  };
}

function showGitHubHelp() {
  modal({
    title: '連線 GitHub 私人 repo', wide: true,
    body: `<ol class="steps">
      <li>在 GitHub 建立一個<b>私人（Private）</b> repo，例如 <code>thinkinglab-data</code>（不用放任何檔案）。</li>
      <li>到 GitHub → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token。</li>
      <li>Repository access 選 <b>Only select repositories</b>，只勾 <code>thinkinglab-data</code>。</li>
      <li>Permissions → Repository permissions → <b>Contents</b> 設為 <b>Read and write</b>，其他保持預設。</li>
      <li>有效期限建議 1 年，產生後複製 Token（<code>github_pat_</code> 開頭），貼到這裡。</li>
      <li>其他裝置：在登入畫面選「連線雲端既有資料」，輸入同一組 repo、Token 與主密碼即可。</li></ol>
      <p class="hint">Token 會用主密碼加密後才存在裝置上；上傳到 repo 的分析資料也都是加密的。</p>`,
    actions: [{ label: '了解', primary: true }],
  });
}

async function changePasswordDialog() {
  await modal({
    title: '變更主密碼',
    body: `<div class="form">
      ${store.githubConfig() ? '<div class="warn-box">變更後，其他裝置下次同步時會要求輸入新密碼。請先確認其他裝置的修改都已同步。</div>' : ''}
      <label>目前的主密碼<input type="password" id="op"></label>
      <label>新的主密碼（至少 8 字元）<input type="password" id="np1"></label>
      <label>再輸入一次<input type="password" id="np2"></label></div>`,
    actions: [{ label: '取消', value: null }, { label: '變更', primary: true, handler: async (root) => {
      const np = $('#np1', root).value;
      if (np.length < 8) { toast('新密碼至少 8 個字元', 'error'); return false; }
      if (np !== $('#np2', root).value) { toast('兩次輸入不一致', 'error'); return false; }
      try { await store.changePassword($('#op', root).value, np); toast('主密碼已變更，記得重新下載備份', 'ok', 5000); return true; }
      catch (err) { toast(err.message, 'error'); return false; }
    } }],
  });
}

/* ================= 頂部列 ================= */
$('#lock-btn').onclick = () => doLock();
$('#sync-ind').onclick = () => { if (store.githubConfig()) store.runSync(); else location.hash = '#/settings'; };
$('#theme-btn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  LS.set('theme', next);
  applyTheme();
};
$('#new-btn').onclick = async () => {
  const id = await modal({
    title: '新增分析', wide: true,
    body: `<div class="pick">${CATEGORIES.map((c) => {
      const ts = Object.values(TOOLS).filter((t) => t.category === c.id);
      return ts.length ? `<div class="pick-cat" style="--cc:${c.color}"><h4>${esc(c.name)}</h4>${ts.map((t) => `<button class="pick-btn" data-pick="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.summary)}</small></button>`).join('')}</div>` : '';
    }).join('')}</div>`,
    actions: [{ label: '取消', value: null }],
    onOpen: (root, close) => root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) { close(null); newAnalysis(b.dataset.pick); }
    }),
  });
};
window.addEventListener('online', () => store.runSync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && store.isUnlocked()) store.runSync(); });
setInterval(() => { if (store.isUnlocked()) store.runSync(); }, 120000);

boot();
