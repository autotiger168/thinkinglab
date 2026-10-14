// ThinkingLab — 7 種互動編輯元件
import { esc, $, $$, autoGrow, bindAutoGrow } from './ui.js';
import { nid, RISK_STRATEGIES, RISK_STATUS, riskLevel, decisionTotals, TOOLS } from './tools.js';

const ta = (val, attrs = '', ph = '', rows = 1) =>
  `<textarea class="grow" rows="${rows}" ${attrs} placeholder="${esc(ph)}">${esc(val)}</textarea>`;

export function mountEditor(tool, content, root, onChange, ctx) {
  root.innerHTML = '';
  root.className = `editor editor-${tool.template}`;
  const fn = { grid9, tree, matrix, qa, chain, risk, decision }[tool.template];
  fn(tool, content, root, onChange, ctx);
  bindAutoGrow(root);
}

/* ---------- 九宮格 ---------- */
function grid9(tool, c, root, onChange) {
  const pos = ['左上', '上', '右上', '左', '中心', '右', '左下', '下', '右下'];
  root.innerHTML = `<div class="g9">${c.cells.map((v, i) => `
    <div class="g9-cell ${i === 4 ? 'g9-center' : ''}">
      <label>${i === 4 ? '中心主題' : pos[i]}</label>
      ${ta(v, `data-i="${i}"`, i === 4 ? '寫下主題或目標' : '一個面向', 3)}
    </div>`).join('')}</div>`;
  root.addEventListener('input', (e) => {
    const i = e.target.dataset.i;
    if (i == null) return;
    c.cells[+i] = e.target.value;
    onChange();
  });
}

/* ---------- 樹狀（心智圖 / 邏輯樹） ---------- */
function tree(tool, c, root, onChange) {
  const find = (node, id, parent = null, index = -1) => {
    if (node.id === id) return { node, parent, index };
    for (let i = 0; i < node.children.length; i++) {
      const r = find(node.children[i], id, node, i);
      if (r) return r;
    }
    return null;
  };
  const flat = () => {
    const out = [];
    (function walk(n, d) { out.push([n, d]); n.children.forEach((ch) => walk(ch, d + 1)); })(c.root, 0);
    return out;
  };
  const checks = tool.checks ? `<div class="checks"><b>MECE 檢查</b>${tool.checks.map((t) => `<label><input type="checkbox"> ${esc(t)}</label>`).join('')}</div>` : '';
  root.innerHTML = `<div class="ol-help">Enter 新增同層 · Tab 變成子項 · Shift+Tab 往上一層 · 空白時按 Backspace 刪除</div><div class="ol"></div>${checks}`;
  const ol = $('.ol', root);

  const render = (focusId, caretEnd = true) => {
    ol.innerHTML = flat().map(([n, d]) => `
      <div class="ol-row ${d === 0 ? 'ol-root' : ''}" style="--d:${d}" data-id="${n.id}">
        <span class="ol-dot"></span>
        <textarea class="grow" rows="1" data-id="${n.id}" placeholder="${d === 0 ? '主題' : '輸入內容'}">${esc(n.text)}</textarea>
        <span class="ol-acts">
          <button data-act="child" title="新增子項">＋</button>
          ${d ? `<button data-act="up" title="上移">↑</button><button data-act="down" title="下移">↓</button>
          <button data-act="out" title="往上一層">⇤</button><button data-act="in" title="變成子項">⇥</button>
          <button data-act="del" title="刪除" class="danger">×</button>` : ''}
        </span>
      </div>`).join('');
    $$('textarea', ol).forEach(autoGrow);
    if (focusId) {
      const t = $(`textarea[data-id="${focusId}"]`, ol);
      if (t) { t.focus(); const p = caretEnd ? t.value.length : 0; t.setSelectionRange(p, p); }
    }
  };

  const op = (act, id) => {
    const f = find(c.root, id);
    if (!f) return;
    const { node, parent, index } = f;
    let focus = id;
    if (act === 'child') {
      const n = { id: nid(), text: '', children: [] };
      node.children.push(n);
      focus = n.id;
    } else if (act === 'sibling') {
      const n = { id: nid(), text: '', children: [] };
      if (!parent) node.children.unshift(n);
      else parent.children.splice(index + 1, 0, n);
      focus = n.id;
    } else if (!parent) return;
    else if (act === 'up' && index > 0) {
      [parent.children[index - 1], parent.children[index]] = [parent.children[index], parent.children[index - 1]];
    } else if (act === 'down' && index < parent.children.length - 1) {
      [parent.children[index + 1], parent.children[index]] = [parent.children[index], parent.children[index + 1]];
    } else if (act === 'in' && index > 0) {
      parent.children.splice(index, 1);
      parent.children[index - 1].children.push(node);
    } else if (act === 'out') {
      const g = find(c.root, parent.id);
      if (!g.parent) return;
      parent.children.splice(index, 1);
      g.parent.children.splice(g.index + 1, 0, node);
    } else if (act === 'del') {
      const list = flat().map(([n]) => n.id);
      focus = list[list.indexOf(id) - 1];
      parent.children.splice(index, 1);
    } else return;
    render(focus);
    onChange();
  };

  ol.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) op(b.dataset.act, b.closest('.ol-row').dataset.id);
  });
  ol.addEventListener('input', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    find(c.root, id).node.text = e.target.value;
    onChange();
  });
  ol.addEventListener('keydown', (e) => {
    const id = e.target.dataset.id;
    if (!id || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); op('sibling', id); }
    else if (e.key === 'Tab') { e.preventDefault(); op(e.shiftKey ? 'out' : 'in', id); }
    else if (e.key === 'Backspace' && e.target.value === '' && id !== c.root.id) {
      const f = find(c.root, id);
      if (f.node.children.length === 0) { e.preventDefault(); op('del', id); }
    }
  });
  render();
}

/* ---------- 2×2 矩陣 ---------- */
function matrix(tool, c, root, onChange, ctx) {
  let refHtml = '';
  if (tool.ref) {
    const refs = ctx.listByTool(tool.ref);
    refHtml = `<div class="ref-panel">
      <label>參考 ${esc(TOOLS[tool.ref].name)}：
        <select class="ref-select"><option value="">（不參考）</option>
        ${refs.map((a) => `<option value="${a.id}" ${a.id === c.refId ? 'selected' : ''}>${esc(a.title || '未命名')}</option>`).join('')}
        </select></label>
      <div class="ref-body"></div></div>`;
  }
  const qHtml = (q, i) => `
    <div class="mx-q" style="--qc:${q.color}" data-q="${i}">
      <div class="mx-qh"><b>${esc(q.title)}</b><small>${esc(q.hint)}</small></div>
      <ul class="mx-items">${c.quadrants[i].map((it, j) => `
        <li draggable="true" data-q="${i}" data-j="${j}">
          <span class="grip" title="拖曳到其他象限">⠿</span>
          ${ta(it, `data-q="${i}" data-j="${j}"`)}
          <button class="x" data-del data-q="${i}" data-j="${j}" title="刪除">×</button>
        </li>`).join('')}</ul>
      <input class="mx-add" data-q="${i}" placeholder="新增一項，按 Enter">
    </div>`;
  const render = (focusQ) => {
    root.innerHTML = `${refHtml}
      <div class="mx-wrap">
        <div class="mx-colh"><span>${esc(tool.cols[0])}</span><span>${esc(tool.cols[1])}</span></div>
        <div class="mx-row"><div class="mx-rowh">${esc(tool.rows[0])}</div>${qHtml(tool.quadrants[0], 0)}${qHtml(tool.quadrants[1], 1)}</div>
        <div class="mx-row"><div class="mx-rowh">${esc(tool.rows[1])}</div>${qHtml(tool.quadrants[2], 2)}${qHtml(tool.quadrants[3], 3)}</div>
      </div>`;
    $$('textarea', root).forEach(autoGrow);
    showRef();
    if (focusQ != null) $(`.mx-add[data-q="${focusQ}"]`, root).focus();
  };
  const showRef = () => {
    const body = $('.ref-body', root);
    if (!body) return;
    const a = c.refId ? ctx.get(c.refId) : null;
    if (!a) { body.innerHTML = ''; return; }
    const t = TOOLS[a.toolId];
    body.innerHTML = `<div class="ref-grid">${t.quadrants.map((q, i) => `
      <div style="--qc:${q.color}"><b>${esc(q.title)}</b><ul>${(a.content.quadrants[i] || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">（空）</li>'}</ul></div>`).join('')}</div>`;
  };
  root.addEventListener('change', (e) => {
    if (e.target.matches('.ref-select')) { c.refId = e.target.value || null; showRef(); onChange(); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.tagName === 'TEXTAREA' && t.dataset.q != null) { c.quadrants[+t.dataset.q][+t.dataset.j] = t.value; onChange(); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('.mx-add') && e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      c.quadrants[+e.target.dataset.q].push(v);
      render(+e.target.dataset.q);
      onChange();
    }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    c.quadrants[+b.dataset.q].splice(+b.dataset.j, 1);
    render();
    onChange();
  });
  // 拖曳移動（電腦版）
  let drag = null;
  root.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li[data-q]');
    if (!li) return;
    drag = { q: +li.dataset.q, j: +li.dataset.j };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'x');
  });
  root.addEventListener('dragover', (e) => {
    const q = e.target.closest('.mx-q');
    if (q && drag) { e.preventDefault(); q.classList.add('drop'); }
  });
  root.addEventListener('dragleave', (e) => { const q = e.target.closest('.mx-q'); if (q) q.classList.remove('drop'); });
  root.addEventListener('drop', (e) => {
    const q = e.target.closest('.mx-q');
    if (!q || !drag) return;
    e.preventDefault();
    const to = +q.dataset.q;
    const [it] = c.quadrants[drag.q].splice(drag.j, 1);
    c.quadrants[to].push(it);
    drag = null;
    render();
    onChange();
  });
  render();
}

/* ---------- 引導問答 ---------- */
function qa(tool, c, root, onChange) {
  root.innerHTML = tool.sections.map((s, i) => `
    ${tool.flow && i ? '<div class="flow-arrow">↓</div>' : ''}
    <div class="qa-sec" style="--qc:${s.color}">
      <label><b>${esc(s.label)}</b><small>${esc(s.hint)}</small></label>
      ${ta(c.sections[s.key] || '', `data-k="${s.key}"`, s.hint, 3)}
    </div>`).join('');
  root.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) { c.sections[k] = e.target.value; onChange(); }
  });
}

/* ---------- 5 Why 連鎖 ---------- */
function chain(tool, c, root, onChange) {
  const render = () => {
    root.innerHTML = `
      <div class="ch-box ch-problem"><label><b>問題現象</b><small>何時、何地、發生了什麼？</small></label>${ta(c.problem, 'data-f="problem"', '清楚描述問題', 2)}</div>
      ${c.whys.map((w, i) => `
        <div class="flow-arrow">↓</div>
        <div class="ch-box ch-why">
          <div class="ch-head"><b>Why ${i + 1}</b>${c.whys.length > 1 ? `<button class="x" data-del="${i}" title="刪除">×</button>` : ''}</div>
          ${ta(w.q, `data-i="${i}" data-k="q"`, i === 0 ? '為什麼會發生這個問題？' : '為什麼會這樣？')}
          ${ta(w.a, `data-i="${i}" data-k="a"`, '答：（寫事實，不是猜測）', 2)}
        </div>`).join('')}
      <div class="ch-add"><button class="btn btn-ghost" data-add>＋ 再問一次為什麼</button></div>
      <div class="flow-arrow">↓</div>
      <div class="ch-box ch-root"><label><b>根本原因</b><small>指向流程或系統，而不是某個人</small></label>${ta(c.root, 'data-f="root"', '真正的根因', 2)}</div>
      <div class="flow-arrow">↓</div>
      <div class="ch-box ch-action"><label><b>對策</b><small>如何消除根因、防止再發？</small></label>${ta(c.action, 'data-f="action"', '具體對策、負責人、期限', 2)}</div>`;
    $$('textarea', root).forEach(autoGrow);
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) c[t.dataset.f] = t.value;
    else if (t.dataset.i != null) c.whys[+t.dataset.i][t.dataset.k] = t.value;
    else return;
    onChange();
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { c.whys.push({ q: '', a: '' }); render(); onChange(); }
    const d = e.target.closest('[data-del]');
    if (d) { c.whys.splice(+d.dataset.del, 1); render(); onChange(); }
  });
  render();
}

/* ---------- 風險登錄表 ---------- */
function risk(tool, c, root, onChange) {
  const opts = (arr, v) => arr.map((x) => `<option ${String(x) === String(v) ? 'selected' : ''}>${x}</option>`).join('');
  const render = () => {
    root.innerHTML = `
      <div class="rk-legend">分數 = 機率 × 影響：<span style="--c:#2f7d5b">1–4 低</span><span style="--c:#d9a12b">5–9 中</span><span style="--c:#c0563b">10–16 高</span><span style="--c:#8e1b2e">17+ 極高</span></div>
      ${c.risks.map((r, i) => {
        const s = r.p * r.i, lv = riskLevel(s);
        return `<div class="rk-card" data-i="${i}">
          <div class="rk-top"><span class="rk-no">R${i + 1}</span>${ta(r.desc, 'data-k="desc"', '風險描述：可能發生什麼事？')}<button class="x" data-del title="刪除">×</button></div>
          <div class="rk-grid">
            <label>類別<input data-k="cat" value="${esc(r.cat)}" placeholder="例：供應鏈"></label>
            <label>機率<select data-k="p">${opts([1, 2, 3, 4, 5], r.p)}</select></label>
            <label>影響<select data-k="i">${opts([1, 2, 3, 4, 5], r.i)}</select></label>
            <div class="rk-score" style="--c:${lv.color}"><b>${s}</b><span>${lv.label}</span></div>
            <label>策略<select data-k="strategy">${opts(RISK_STRATEGIES, r.strategy)}</select></label>
            <label>狀態<select data-k="status">${opts(RISK_STATUS, r.status)}</select></label>
            <label class="span2">負責人<input data-k="owner" value="${esc(r.owner)}" placeholder="誰負責"></label>
          </div>
          <label class="rk-resp">對策${ta(r.response, 'data-k="response"', '具體因應措施')}</label>
        </div>`;
      }).join('')}
      <button class="btn btn-ghost" data-add>＋ 新增風險</button>`;
    $$('textarea', root).forEach(autoGrow);
  };
  const upd = (e) => {
    const card = e.target.closest('.rk-card');
    const k = e.target.dataset.k;
    if (!card || !k) return;
    const r = c.risks[+card.dataset.i];
    r[k] = (k === 'p' || k === 'i') ? +e.target.value : e.target.value;
    if (k === 'p' || k === 'i') {
      const s = r.p * r.i, lv = riskLevel(s);
      const box = $('.rk-score', card);
      box.style.setProperty('--c', lv.color);
      box.innerHTML = `<b>${s}</b><span>${lv.label}</span>`;
    }
    onChange();
  };
  root.addEventListener('input', upd);
  root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') upd(e); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) {
      c.risks.push({ id: nid(), desc: '', cat: '', p: 3, i: 3, strategy: '降低', response: '', owner: '', status: '開放' });
      render();
      onChange();
      const cards = $$('.rk-card textarea[data-k="desc"]', root);
      cards[cards.length - 1].focus();
    }
    if (e.target.closest('[data-del]')) {
      c.risks.splice(+e.target.closest('.rk-card').dataset.i, 1);
      render();
      onChange();
    }
  });
  render();
}

/* ---------- 加權決策矩陣 ---------- */
function decision(tool, c, root, onChange) {
  const sc = (cid, oid) => (c.scores[cid] || {})[oid] ?? '';
  const totalsRow = () => {
    const t = decisionTotals(c);
    const best = Math.max(...t.map((x) => x.total));
    return t.map((x) => `<td class="${x.total === best && best > 0 ? 'best' : ''}"><b>${x.total}</b><small>${x.pct}%</small></td>`).join('');
  };
  const render = () => {
    root.innerHTML = `
      <div class="dm-help">權重 1–10（越重要越高），分數 1–5（越好越高）。加權總分 = Σ 權重 × 分數。</div>
      <div class="dm-scroll"><table class="dm">
        <thead><tr><th>評估準則</th><th>權重</th>${c.options.map((o, j) => `
          <th><div class="dm-opt"><input data-opt="${j}" value="${esc(o.name)}" placeholder="選項">${c.options.length > 1 ? `<button class="x" data-delopt="${j}">×</button>` : ''}</div></th>`).join('')}
          <th><button class="btn btn-sm" data-addopt>＋ 選項</button></th></tr></thead>
        <tbody>${c.criteria.map((cr, i) => `<tr>
          <td><input data-cr="${i}" value="${esc(cr.name)}" placeholder="準則"></td>
          <td><input type="number" min="1" max="10" class="dm-w" data-w="${i}" value="${cr.weight}"></td>
          ${c.options.map((o) => `<td><select data-s="${cr.id}|${o.id}"><option value="">–</option>${[1, 2, 3, 4, 5].map((n) => `<option ${String(sc(cr.id, o.id)) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></td>`).join('')}
          <td>${c.criteria.length > 1 ? `<button class="x" data-delcr="${i}" title="刪除準則">×</button>` : ''}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th colspan="2">加權總分</th><td class="dm-totals" style="display:contents"></td><td></td></tr></tfoot>
      </table></div>
      <button class="btn btn-ghost" data-addcr>＋ 新增準則</button>`;
    refreshTotals();
  };
  const refreshTotals = () => {
    const tr = $('tfoot tr', root);
    tr.innerHTML = `<th colspan="2">加權總分</th>${totalsRow()}<td></td>`;
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.opt != null) c.options[+t.dataset.opt].name = t.value;
    else if (t.dataset.cr != null) c.criteria[+t.dataset.cr].name = t.value;
    else if (t.dataset.w != null) { c.criteria[+t.dataset.w].weight = Math.max(0, Math.min(10, +t.value || 0)); refreshTotals(); }
    else return;
    onChange();
  });
  root.addEventListener('change', (e) => {
    const s = e.target.dataset.s;
    if (!s) return;
    const [cid, oid] = s.split('|');
    c.scores[cid] = c.scores[cid] || {};
    if (e.target.value) c.scores[cid][oid] = +e.target.value; else delete c.scores[cid][oid];
    refreshTotals();
    onChange();
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.addopt != null) c.options.push({ id: nid(), name: `選項 ${String.fromCharCode(65 + c.options.length)}` });
    else if (t.dataset.addcr != null) c.criteria.push({ id: nid(), name: '', weight: 5 });
    else if (t.dataset.delopt != null) c.options.splice(+t.dataset.delopt, 1);
    else if (t.dataset.delcr != null) c.criteria.splice(+t.dataset.delcr, 1);
    else return;
    render();
    onChange();
  });
  render();
}
