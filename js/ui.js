// ThinkingLab — 共用介面工具
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); return fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function fmtDate(ts, time = true) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  const s = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  return time ? `${s} ${p(d.getHours())}:${p(d.getMinutes())}` : s;
}

export function relTime(ts) {
  if (!ts) return '從未';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '剛剛';
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
  return fmtDate(ts, false);
}

export function toast(msg, type = 'info', ms = 2800) {
  let root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

// actions: [{label, value, primary, danger, handler(root) -> value | false}]
export function modal({ title, body, actions = [{ label: '確定', value: true, primary: true }], dismissible = true, wide = false, onOpen }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      ${title ? `<h3 class="modal-title">${esc(title)}</h3>` : ''}
      <div class="modal-body">${body || ''}</div>
      <div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(wrap);
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) close(undefined);
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const p = actions.findIndex((a) => a.primary);
        if (p >= 0) { e.preventDefault(); wrap.querySelector(`[data-i="${p}"]`).click(); }
      }
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', async (e) => {
      if (e.target === wrap && dismissible) return close(undefined);
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const a = actions[+b.dataset.i];
      if (a.handler) {
        b.disabled = true;
        try {
          const v = await a.handler(wrap);
          if (v !== false) close(v);
        } finally { b.disabled = false; }
      } else close(a.value);
    });
    if (onOpen) onOpen(wrap, close);
    const f = wrap.querySelector('input, textarea, select');
    if (f) setTimeout(() => f.focus(), 30);
  });
}

export function confirmDialog(msg, { okLabel = '確定', danger = false, title = '請確認' } = {}) {
  return modal({
    title,
    body: `<p>${msg}</p>`,
    actions: [{ label: '取消', value: false }, { label: okLabel, value: true, primary: !danger, danger }],
  });
}

export function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 2 + 'px';
}

export function bindAutoGrow(root) {
  $$('textarea.grow', root).forEach(autoGrow);
  root.addEventListener('input', (e) => { if (e.target.matches('textarea.grow')) autoGrow(e.target); });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeName(s) {
  return (String(s || '未命名').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)) || '未命名';
}

export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
