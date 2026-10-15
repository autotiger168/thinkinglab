// ThinkingLab — 互動編輯元件
import { esc, $, $$, autoGrow, bindAutoGrow, modal } from './ui.js';
import { nid, RISK_STRATEGIES, RISK_STATUS, riskLevel, decisionTotals, TOOLS, newRow, paretoData, dtreeEV, krProgress, objProgress, findLoops } from './tools.js';

const ta = (val, attrs = '', ph = '', rows = 1) =>
  `<textarea class="grow" rows="${rows}" ${attrs} placeholder="${esc(ph)}">${esc(val)}</textarea>`;

export function mountEditor(tool, content, root, onChange, ctx) {
  root.innerHTML = '';
  root.className = `editor editor-${tool.template}`;
  const fn = { grid9, tree, matrix, qa, chain, risk, decision, fishbone, canvas, groups, table, rows, dtree, causal, okr }[tool.template];
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
      <div class="mx-qh">${tool.editableAxes ? `<input class="mx-title" data-title="${i}" value="${esc(c.titles[i])}" placeholder="情境名稱">` : `<b>${esc(q.title)}</b>`}<small>${esc(q.hint)}</small></div>
      <ul class="mx-items">${c.quadrants[i].map((it, j) => `
        <li draggable="true" data-q="${i}" data-j="${j}">
          <span class="grip" title="拖曳到其他象限">⠿</span>
          ${ta(it, `data-q="${i}" data-j="${j}"`)}
          <button class="x" data-del data-q="${i}" data-j="${j}" title="刪除">×</button>
        </li>`).join('')}</ul>
      <input class="mx-add" data-q="${i}" placeholder="新增一項，按 Enter">
    </div>`;
  const axisCell = (ax, k) => tool.editableAxes
    ? `<input class="mx-axis" data-axis="${ax}" data-k="${k}" value="${esc(c.axes[ax][k])}" placeholder="軸的描述">`
    : `<span>${esc(tool[ax][k])}</span>`;
  const render = (focusQ) => {
    root.innerHTML = `${refHtml}
      <div class="mx-wrap ${tool.editableAxes ? 'mx-axes-edit' : ''}">
        <div class="mx-colh"><span></span>${[0, 1].map((k) => axisCell('cols', k)).join('')}</div>
        <div class="mx-row"><div class="mx-rowh">${axisCell('rows', 0)}</div>${qHtml(tool.quadrants[0], 0)}${qHtml(tool.quadrants[1], 1)}</div>
        <div class="mx-row"><div class="mx-rowh">${axisCell('rows', 1)}</div>${qHtml(tool.quadrants[2], 2)}${qHtml(tool.quadrants[3], 3)}</div>
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
    else if (t.dataset.title != null) { c.titles[+t.dataset.title] = t.value; onChange(); }
    else if (t.dataset.axis) { c.axes[t.dataset.axis][+t.dataset.k] = t.value; onChange(); }
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

/* ---------- 共用：項目清單（魚骨、畫布） ---------- */
function itemList(items, path, color) {
  return `<ul class="li-items">${items.map((it, j) => `
      <li>${ta(it, `data-path="${path}" data-j="${j}"`)}<button class="x" data-delitem data-path="${path}" data-j="${j}" title="刪除">×</button></li>`).join('')}</ul>
    <input class="li-add" data-path="${path}" placeholder="新增一項，按 Enter" style="--qc:${color}">`;
}
function bindItemList(root, getList, render, onChange) {
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.tagName === 'TEXTAREA' && t.dataset.path != null && t.dataset.j != null) { getList(t.dataset.path)[+t.dataset.j] = t.value; onChange(); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('.li-add') && e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      const path = e.target.dataset.path;
      getList(path).push(v);
      render();
      onChange();
      const n = $(`.li-add[data-path="${path}"]`, root);
      if (n) n.focus();
    }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-delitem]');
    if (!b) return;
    getList(b.dataset.path).splice(+b.dataset.j, 1);
    render();
    onChange();
  });
}

/* ---------- 魚骨圖 ---------- */
function fishbone(tool, c, root, onChange) {
  const render = () => {
    root.innerHTML = `
      <div class="fb-head"><label><b>問題（魚頭）</b><small>要分析的結果或現象</small></label>${ta(c.problem, 'data-f="problem"', '例：晶圓測試良率下降 3%', 2)}</div>
      <div class="fb-cats">${c.cats.map((cat, i) => `
        <div class="fb-cat">
          <div class="fb-cat-h"><input data-cat="${i}" value="${esc(cat.name)}" placeholder="分類名稱"><button class="x" data-delcat="${i}" title="刪除分類">×</button></div>
          ${itemList(cat.causes, i, '#c0563b')}
        </div>`).join('')}</div>
      <button class="btn btn-ghost" data-addcat>＋ 新增分類（大骨）</button>`;
    $$('textarea', root).forEach(autoGrow);
  };
  bindItemList(root, (i) => c.cats[+i].causes, render, onChange);
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) { c.problem = t.value; onChange(); }
    else if (t.dataset.cat != null) { c.cats[+t.dataset.cat].name = t.value; onChange(); }
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-addcat]')) { c.cats.push({ id: nid(), name: '新分類', causes: [] }); render(); onChange(); }
    const d = e.target.closest('[data-delcat]');
    if (d && c.cats.length > 1) { c.cats.splice(+d.dataset.delcat, 1); render(); onChange(); }
  });
  render();
}

/* ---------- 畫布（商業模式畫布、PESTEL、KPT…） ---------- */
function canvas(tool, c, root, onChange) {
  const { cols, rows } = tool.grid;
  const render = () => {
    root.innerHTML = `<div class="cv" style="--cols:${cols};--rows:${rows}">${tool.blocks.map((b) => {
      const [x, y, w, h] = b.area;
      return `<div class="cv-b" style="--qc:${b.color};grid-column:${x + 1} / span ${w};grid-row:${y + 1} / span ${h}">
        <div class="cv-h"><b>${esc(b.title)}</b><small>${esc(b.hint)}</small></div>
        ${itemList(c.blocks[b.key] || (c.blocks[b.key] = []), b.key, b.color)}
      </div>`;
    }).join('')}</div>`;
    $$('textarea', root).forEach(autoGrow);
  };
  bindItemList(root, (k) => c.blocks[k], render, onChange);
  render();
}

/* ================= Phase 3 元件 ================= */
const GP = ['#3a7ca5', '#d9822b', '#2f7d5b', '#7a5bb0', '#c0563b', '#2e8a8a', '#b5892b', '#4f6d8f'];
const isEnter = (e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/* ---------- 群組（腦力激盪、KJ 法） ---------- */
function groups(tool, c, root, onChange) {
  let drag = null;
  const render = (focusG) => {
    root.innerHTML = `
      <div class="gp-topic"><label><b>${tool.voting ? '發想主題' : '主題'}</b><small>${tool.voting ? '用「如何…？」的問句效果最好' : '要整理的資料是什麼？'}</small></label>${ta(c.topic, 'data-f="topic"', tool.voting ? '例：如何讓新人更快上手？' : '例：客戶訪談意見整理', 2)}</div>
      <div class="gp-wrap">${c.groups.map((g, i) => `
        <div class="gp" data-g="${i}" style="--qc:${GP[i % GP.length]}">
          <div class="gp-h"><input data-gname="${i}" value="${esc(g.name)}" placeholder="群組名稱"><span class="gp-n">${g.items.length}</span>${c.groups.length > 1 ? `<button class="x" data-delg="${i}" title="刪除群組">×</button>` : ''}</div>
          <ul class="gp-items">${g.items.map((it, j) => `
            <li draggable="true" data-g="${i}" data-j="${j}">
              <span class="grip" title="拖曳到其他群組">⠿</span>${ta(it.t, `data-g="${i}" data-j="${j}"`)}
              ${tool.voting ? `<span class="vote-box">${it.v ? `<button class="vote-dn" data-vote="-1" data-g="${i}" data-j="${j}" title="減一票">−</button>` : ''}<button class="vote" data-vote="1" data-g="${i}" data-j="${j}" title="投一票">▲ ${it.v || 0}</button></span>` : ''}
              ${c.groups.length > 1 ? `<button class="mv" data-move data-g="${i}" data-j="${j}" title="移到其他群組">⇄</button>` : ''}
              <button class="x" data-del data-g="${i}" data-j="${j}" title="刪除">×</button></li>`).join('')}</ul>
          <input class="gp-add" data-g="${i}" placeholder="新增一項，按 Enter">
        </div>`).join('')}</div>
      <button class="btn btn-ghost" data-addg>＋ 新增群組</button>`;
    $$('textarea', root).forEach(autoGrow);
    if (focusG != null) { const f = $(`.gp-add[data-g="${focusG}"]`, root); if (f) f.focus(); }
  };
  const moveItem = (g, j, to) => {
    const [it] = c.groups[g].items.splice(j, 1);
    c.groups[to].items.push(it);
    render();
    onChange();
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) c.topic = t.value;
    else if (t.dataset.gname != null) c.groups[+t.dataset.gname].name = t.value;
    else if (t.tagName === 'TEXTAREA' && t.dataset.g != null) c.groups[+t.dataset.g].items[+t.dataset.j].t = t.value;
    else return;
    onChange();
  });
  root.addEventListener('keydown', (e) => {
    if (!e.target.matches('.gp-add') || !isEnter(e)) return;
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) return;
    const g = +e.target.dataset.g;
    c.groups[g].items.push({ id: nid(), t: v, v: 0 });
    render(g);
    onChange();
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const g = +b.dataset.g, j = +b.dataset.j;
    if (b.dataset.vote) {
      const it = c.groups[g].items[j];
      it.v = Math.max(0, (it.v || 0) + +b.dataset.vote);
      render(); onChange();
    } else if (b.dataset.del != null) {
      c.groups[g].items.splice(j, 1); render(); onChange();
    } else if (b.dataset.move != null) {
      const to = await modal({
        title: '移到哪個群組？',
        body: `<div class="pick-list">${c.groups.map((x, k) => k === g ? '' : `<button class="pick-btn" data-to="${k}"><b>${esc(x.name || '未命名')}</b></button>`).join('')}</div>`,
        actions: [{ label: '取消', value: null }],
        onOpen: (w, close) => w.addEventListener('click', (ev) => { const p = ev.target.closest('[data-to]'); if (p) close(+p.dataset.to); }),
      });
      if (to != null) moveItem(g, j, to);
    } else if (b.dataset.delg != null) {
      const k = +b.dataset.delg;
      const target = k === 0 ? 1 : 0;
      c.groups[target].items.push(...c.groups[k].items);
      c.groups.splice(k, 1);
      render(); onChange();
    } else if (b.dataset.addg != null) {
      c.groups.push({ id: nid(), name: `群組 ${c.groups.length + 1}`, items: [] });
      render(); onChange();
    }
  });
  root.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li[data-g]');
    if (!li) return;
    drag = { g: +li.dataset.g, j: +li.dataset.j };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'x');
  });
  root.addEventListener('dragover', (e) => { const q = e.target.closest('.gp'); if (q && drag) { e.preventDefault(); q.classList.add('drop'); } });
  root.addEventListener('dragleave', (e) => { const q = e.target.closest('.gp'); if (q) q.classList.remove('drop'); });
  root.addEventListener('drop', (e) => {
    const q = e.target.closest('.gp');
    if (!q || !drag) return;
    e.preventDefault();
    const to = +q.dataset.g, d = drag;
    drag = null;
    if (to !== d.g) moveItem(d.g, d.j, to); else render();
  });
  render();
}

/* ---------- 表格（IS/IS NOT、形態分析、顧客旅程） ---------- */
export const EMO = { 2: '😄 +2', 1: '🙂 +1', 0: '😐 0', '-1': '🙁 −1', '-2': '😣 −2' };
const TOPIC = { isisnot: ['問題描述', '例：A 產品測試良率下降'], morph: ['要設計的對象', '例：新的家庭旅行方案'], journey: ['顧客與情境', '例：第一次導入我們晶片的 IC 設計客戶'] };
function table(tool, c, root, onChange) {
  const T = tool.table;
  const editRows = !T.rows, editCols = !T.cols;
  const [tl, tph] = TOPIC[tool.id] || ['主題', ''];
  const combo = () => c.rows.map((r, i) => (c.sel[i] >= 0 ? `<span><i>${esc(r)}</i>${esc(c.cells[i][c.sel[i]] || c.cols[c.sel[i]])}</span>` : '')).join('');
  const render = () => {
    root.innerHTML = `
      <div class="gp-topic"><label><b>${tl}</b></label>${ta(c.topic, 'data-f="topic"', tph, 2)}</div>
      <div class="tb-scroll"><table class="tb ${T.select ? 'tb-select' : ''}">
        <thead><tr><th class="tb-corner">${esc(T.rowLabel || '')}</th>${c.cols.map((col, j) => `
          <th style="--qc:${(T.colColors && T.colColors[j]) || 'var(--accent)'}">${editCols
            ? `<div class="tb-hd"><input data-col="${j}" value="${esc(col)}" placeholder="${esc(T.colLabel)}">${c.cols.length > 1 ? `<button class="x" data-delcol="${j}" title="刪除">×</button>` : ''}</div>`
            : esc(col)}</th>`).join('')}
          ${editCols ? `<th class="tb-addc"><button class="btn btn-sm" data-addcol title="新增${esc(T.colLabel)}">＋</button></th>` : ''}</tr></thead>
        <tbody>${c.rows.map((row, i) => `<tr>
          <th>${editRows
            ? `<div class="tb-hd"><input data-row="${i}" value="${esc(row)}" placeholder="${esc(T.rowLabel)}">${c.rows.length > 1 ? `<button class="x" data-delrow="${i}" title="刪除">×</button>` : ''}</div>`
            : `${esc(row)}${T.rowHints ? `<small>${esc(T.rowHints[i])}</small>` : ''}`}</th>
          ${c.cols.map((_, j) => `<td class="${T.select && c.sel[i] === j ? 'on' : ''}">${T.select ? `<button class="pick" data-pick="${i}|${j}" title="選這個">${c.sel[i] === j ? '●' : '○'}</button>` : ''}${ta(c.cells[i][j], `data-cell="${i}|${j}"`)}</td>`).join('')}
          ${editCols ? '<td></td>' : ''}</tr>`).join('')}
          ${T.emotion ? `<tr class="tb-emo"><th>情緒<small>−2 到 +2</small></th>${c.cols.map((_, j) => `<td><select data-emo="${j}">${[2, 1, 0, -1, -2].map((v) => `<option value="${v}" ${Number(c.emo[j]) === v ? 'selected' : ''}>${EMO[v]}</option>`).join('')}</select></td>`).join('')}${editCols ? '<td></td>' : ''}</tr>` : ''}
        </tbody></table></div>
      ${editRows ? `<button class="btn btn-ghost" data-addrow>＋ 新增${esc(T.rowLabel)}</button>` : ''}
      ${T.select ? `<div class="tb-combo"><b>目前的組合</b><div>${combo() || '<span class="muted">每一列點選 ○ 選一個選項</span>'}</div></div>` : ''}`;
    $$('textarea', root).forEach(autoGrow);
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) c.topic = t.value;
    else if (t.dataset.col != null) c.cols[+t.dataset.col] = t.value;
    else if (t.dataset.row != null) c.rows[+t.dataset.row] = t.value;
    else if (t.dataset.cell) { const [i, j] = t.dataset.cell.split('|').map(Number); c.cells[i][j] = t.value; }
    else return;
    onChange();
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.emo != null) { c.emo[+e.target.dataset.emo] = +e.target.value; onChange(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pick) {
      const [i, j] = b.dataset.pick.split('|').map(Number);
      c.sel[i] = c.sel[i] === j ? -1 : j;
    } else if (b.dataset.addcol != null) {
      c.cols.push(`${T.colLabel} ${c.cols.length + 1}`);
      c.cells.forEach((r) => r.push(''));
      c.emo.push(0);
    } else if (b.dataset.delcol != null) {
      const j = +b.dataset.delcol;
      c.cols.splice(j, 1); c.cells.forEach((r) => r.splice(j, 1)); c.emo.splice(j, 1);
      c.sel = c.sel.map((s) => (s === j ? -1 : s > j ? s - 1 : s));
    } else if (b.dataset.addrow != null) {
      c.rows.push(`${T.rowLabel} ${c.rows.length + 1}`);
      c.cells.push(c.cols.map(() => ''));
      c.sel.push(-1);
    } else if (b.dataset.delrow != null) {
      const i = +b.dataset.delrow;
      c.rows.splice(i, 1); c.cells.splice(i, 1); c.sel.splice(i, 1);
    } else return;
    render();
    onChange();
  });
  render();
}

/* ---------- 評分表（RICE、FMEA、柏拉圖） ---------- */
function rows(tool, c, root, onChange) {
  const optList = (f) => f.options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const scoreHtml = (r) => {
    if (tool.pareto) return '';
    const v = tool.score(r), lv = tool.level ? tool.level(v, r) : null;
    return `<small>${esc(tool.scoreLabel)}</small><b>${fmtNum(v)}</b>${lv ? `<span>${esc(lv.label)}</span>` : ''}`;
  };
  const scoreColor = (r) => (tool.level ? tool.level(tool.score(r), r).color : 'var(--accent)');
  const field = (f, r) => {
    const v = r[f.key] ?? '';
    if (f.type === 'text') return `<label class="${f.wide ? 'wide' : ''}">${esc(f.label)}${ta(v, `data-k="${f.key}"`)}</label>`;
    if (f.type === 'num') return `<label>${esc(f.label)}<input type="number" step="any" data-k="${f.key}" value="${esc(v)}"></label>`;
    return `<label>${esc(f.label)}<select data-k="${f.key}">${optList(f).map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`;
  };
  const summary = () => {
    if (!tool.pareto) return c.rows.length > 1 ? `<button class="btn btn-sm" data-sort>依 ${esc(tool.scoreLabel)} 由高到低排序</button>` : '';
    const d = paretoData(c.rows);
    const total = c.rows.reduce((s, r) => s + (Number(r.n) || 0), 0);
    if (!total) return '';
    let k = 0;
    while (k < d.length && (k === 0 || d[k - 1].cum < 80)) k++;
    return `<div class="pa-sum">合計 <b>${fmtNum(total)}</b>；前 <b>${k}</b> 項（${d.slice(0, k).map((x) => esc(x.name)).join('、')}）占 <b>${Math.round(d[k - 1].cum)}%</b>，建議優先處理。</div>`;
  };
  const render = (focusLast) => {
    root.innerHTML = `
      ${tool.id === 'fmea' ? '<div class="rk-legend">RPN = S × O × D：<span style="--c:#2f7d5b">&lt;50 低</span><span style="--c:#d9a12b">50–99 中</span><span style="--c:#c0563b">100–199 高</span><span style="--c:#8e1b2e">≥200 或 S≥9 優先處理</span></div>' : ''}
      <div class="rw-list ${tool.pareto ? 'rw-compact' : ''}">${c.rows.map((r, i) => `
        <div class="rw-card" data-i="${i}">
          <span class="rw-no">${i + 1}</span>
          <div class="rw-fields">${tool.fields.map((f) => field(f, r)).join('')}</div>
          ${tool.pareto ? '' : `<div class="rw-score" style="--c:${scoreColor(r)}">${scoreHtml(r)}</div>`}
          <button class="x" data-del title="刪除">×</button>
        </div>`).join('')}</div>
      <div class="btn-row"><button class="btn btn-ghost" data-add>＋ 新增一列</button><span class="rw-sum">${summary()}</span></div>`;
    $$('textarea', root).forEach(autoGrow);
    if (focusLast) { const cards = $$('.rw-card', root); const f = cards.length && $('textarea, input', cards[cards.length - 1]); if (f) f.focus(); }
  };
  const upd = (e) => {
    const card = e.target.closest('.rw-card'), k = e.target.dataset.k;
    if (!card || !k) return;
    const r = c.rows[+card.dataset.i];
    const f = tool.fields.find((x) => x.key === k);
    r[k] = f.type === 'num' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    const box = $('.rw-score', card);
    if (box) { box.style.setProperty('--c', scoreColor(r)); box.innerHTML = scoreHtml(r); }
    const sum = $('.rw-sum', root);
    if (sum && tool.pareto) sum.innerHTML = summary();
    onChange();
  };
  root.addEventListener('input', upd);
  root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') upd(e); });
  root.addEventListener('keydown', (e) => {
    if (tool.pareto && isEnter(e) && e.target.dataset.k === 'n') { e.preventDefault(); c.rows.push(newRow(tool)); render(true); onChange(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.add != null) { c.rows.push(newRow(tool)); render(true); onChange(); }
    else if (b.dataset.del != null) { c.rows.splice(+b.closest('.rw-card').dataset.i, 1); render(); onChange(); }
    else if (b.dataset.sort != null) { c.rows.sort((p, q) => tool.score(q) - tool.score(p)); render(); onChange(); }
  });
  render();
}

/* ---------- 決策樹 ---------- */
function dtree(tool, c, root, onChange) {
  const refresh = () => {
    const evs = c.options.map((o) => dtreeEV(o));
    const best = Math.max(...evs.map((x) => x.ev));
    $$('.dt-opt', root).forEach((el, i) => {
      const { ev, psum } = evs[i];
      el.classList.toggle('best', ev === best && c.options.length > 1);
      $('.dt-ev b', el).textContent = `${fmtNum(ev)} ${c.unit || ''}`;
      const w = $('.dt-warn', el);
      w.textContent = Math.abs(psum - 100) > 0.01 ? `⚠ 機率合計 ${fmtNum(psum)}%（應為 100%）` : '';
    });
  };
  const render = () => {
    root.innerHTML = `
      <div class="gp-topic"><label><b>要做的決定</b></label>${ta(c.decision, 'data-f="decision"', '例：是否投資新產線？', 2)}
        <label class="inline dt-unit">價值單位<input data-f="unit" value="${esc(c.unit)}" placeholder="萬元"></label></div>
      ${c.options.map((o, i) => `
        <div class="dt-opt" data-o="${i}">
          <div class="dt-oh">
            <input class="dt-name" data-o="${i}" data-of="name" value="${esc(o.name)}" placeholder="選項名稱">
            <label>成本<input type="number" step="any" data-o="${i}" data-of="cost" value="${esc(o.cost)}"></label>
            <div class="dt-ev">期望值 <b></b></div>
            ${c.options.length > 1 ? `<button class="x" data-delopt="${i}" title="刪除選項">×</button>` : ''}
          </div>
          <div class="dt-outs">
            <div class="dt-row dt-head"><span>可能結果</span><span>機率 %</span><span>價值</span><span></span></div>
            ${o.outcomes.map((x, k) => `
            <div class="dt-row">
              <input data-out="${i}|${k}" data-xf="name" value="${esc(x.name)}" placeholder="結果">
              <input type="number" step="any" data-out="${i}|${k}" data-xf="p" value="${esc(x.p)}">
              <input type="number" step="any" data-out="${i}|${k}" data-xf="v" value="${esc(x.v)}">
              ${o.outcomes.length > 1 ? `<button class="x" data-delout="${i}|${k}">×</button>` : '<span></span>'}
            </div>`).join('')}
          </div>
          <div class="dt-foot"><button class="btn btn-sm btn-ghost" data-addout="${i}">＋ 結果</button><span class="dt-warn"></span></div>
        </div>`).join('')}
      <button class="btn btn-ghost" data-addopt>＋ 新增選項</button>`;
    $$('textarea', root).forEach(autoGrow);
    refresh();
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) c[t.dataset.f] = t.value;
    else if (t.dataset.of) { const o = c.options[+t.dataset.o]; o[t.dataset.of] = t.dataset.of === 'cost' ? Number(t.value) || 0 : t.value; }
    else if (t.dataset.out) { const [i, k] = t.dataset.out.split('|').map(Number); const x = c.options[i].outcomes[k]; x[t.dataset.xf] = t.dataset.xf === 'name' ? t.value : Number(t.value) || 0; }
    else return;
    refresh();
    onChange();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.addopt != null) c.options.push({ id: nid(), name: `選項 ${String.fromCharCode(65 + c.options.length)}`, cost: 0, outcomes: [{ id: nid(), name: '結果', p: 100, v: 0 }] });
    else if (b.dataset.delopt != null) c.options.splice(+b.dataset.delopt, 1);
    else if (b.dataset.addout != null) c.options[+b.dataset.addout].outcomes.push({ id: nid(), name: '', p: 0, v: 0 });
    else if (b.dataset.delout) { const [i, k] = b.dataset.delout.split('|').map(Number); c.options[i].outcomes.splice(k, 1); }
    else return;
    render();
    onChange();
  });
  render();
}

/* ---------- 因果迴路圖 ---------- */
function causal(tool, c, root, onChange) {
  const varOpts = (sel) => c.vars.map((v) => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.name || '（未命名）')}</option>`).join('');
  const loopsHtml = () => {
    const loops = findLoops(c);
    if (!loops.length) return '<p class="muted">還沒有形成迴路。當連結繞一圈回到起點時，這裡會自動列出。</p>';
    return loops.map((l, i) => `<div class="cl-loop cl-${l.type}"><b>${l.type}${i + 1}</b><span>${l.type === 'R' ? '增強迴路' : '調節迴路'}</span>${l.nodes.map((n) => esc(n.name)).join(' → ')} → ${esc(l.nodes[0].name)}</div>`).join('');
  };
  const render = (focusVar) => {
    root.innerHTML = `
      <div class="cl-sec"><h4>① 變數 <small>可以增加或減少的量，例如「研發投資」</small></h4>
        <div class="cl-vars">${c.vars.map((v, i) => `<span class="cl-var"><input data-var="${i}" value="${esc(v.name)}"><button class="x" data-delvar="${i}" title="刪除">×</button></span>`).join('')}</div>
        <input class="cl-addvar" placeholder="新增變數，按 Enter"></div>
      <div class="cl-sec"><h4>② 因果連結 <small>＋ 同向：A 增加 → B 增加；− 反向：A 增加 → B 減少</small></h4>
        ${c.vars.length < 2 ? '<p class="muted">先新增至少兩個變數。</p>' : `
        <div class="cl-links">${c.links.map((l, i) => `
          <div class="cl-link" data-l="${i}"><select data-lk="from">${varOpts(l.from)}</select>
            <select data-lk="sign" class="cl-sign ${l.sign === '-' ? 'neg' : ''}"><option value="+" ${l.sign === '+' ? 'selected' : ''}>＋ 同向 →</option><option value="-" ${l.sign === '-' ? 'selected' : ''}>− 反向 →</option></select>
            <select data-lk="to">${varOpts(l.to)}</select><button class="x" data-dellink="${i}">×</button></div>`).join('')}</div>
        <button class="btn btn-ghost" data-addlink>＋ 新增連結</button>`}</div>
      <div class="cl-sec"><h4>③ 自動偵測的迴路 <small>負號為偶數 = 增強 R；奇數 = 調節 B</small></h4><div class="cl-loops">${loopsHtml()}</div></div>`;
    if (focusVar) $('.cl-addvar', root).focus();
  };
  const refreshLoops = () => { const el = $('.cl-loops', root); if (el) el.innerHTML = loopsHtml(); };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.var == null) return;
    const v = c.vars[+t.dataset.var];
    v.name = t.value;
    $$(`option[value="${v.id}"]`, root).forEach((o) => { o.textContent = t.value || '（未命名）'; });
    refreshLoops();
    onChange();
  });
  root.addEventListener('change', (e) => {
    const t = e.target, row = t.closest('.cl-link');
    if (!row) return;
    c.links[+row.dataset.l][t.dataset.lk] = t.value;
    if (t.dataset.lk === 'sign') t.classList.toggle('neg', t.value === '-');
    refreshLoops();
    onChange();
  });
  root.addEventListener('keydown', (e) => {
    if (!e.target.matches('.cl-addvar') || !isEnter(e)) return;
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) return;
    c.vars.push({ id: nid(), name: v });
    render(true);
    onChange();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.delvar != null) {
      const id = c.vars[+b.dataset.delvar].id;
      c.vars.splice(+b.dataset.delvar, 1);
      c.links = c.links.filter((l) => l.from !== id && l.to !== id);
    } else if (b.dataset.addlink != null) {
      const last = c.links[c.links.length - 1];
      const from = last ? last.to : c.vars[0].id;
      const to = (c.vars.find((v) => v.id !== from) || c.vars[1]).id;
      c.links.push({ id: nid(), from, to, sign: '+' });
    } else if (b.dataset.dellink != null) c.links.splice(+b.dataset.dellink, 1);
    else return;
    render();
    onChange();
  });
  render();
}

/* ---------- OKR ---------- */
const progColor = (p) => (p >= 0.7 ? '#2f7d5b' : p >= 0.4 ? '#b5892b' : '#c0563b');
function okr(tool, c, root, onChange) {
  const bar = (p) => `<div class="ok-bar" style="--c:${progColor(p)}"><i style="width:${Math.round(p * 100)}%"></i></div><span class="ok-pct">${Math.round(p * 100)}%</span>`;
  const render = () => {
    root.innerHTML = `
      <label class="inline ok-period">期間<input data-f="period" value="${esc(c.period)}" placeholder="例：2026 Q4"></label>
      ${c.objectives.map((o, i) => `
        <div class="ok-o" data-o="${i}">
          <div class="ok-oh"><span class="ok-tag">O${i + 1}</span>${ta(o.o, `data-otext="${i}"`, '目標：方向明確、鼓舞人心', 1)}
            <div class="ok-prog ok-oprog">${bar(objProgress(o))}</div>
            ${c.objectives.length > 1 ? `<button class="x" data-delo="${i}" title="刪除目標">×</button>` : ''}</div>
          ${o.krs.map((k, j) => `
            <div class="ok-kr" data-kr="${i}|${j}">
              <div class="ok-krh"><span class="ok-tag kr">KR${j + 1}</span>${ta(k.t, 'data-kf="t"', '關鍵結果：可衡量的結果', 1)}<button class="x" data-delkr="${i}|${j}">×</button></div>
              <div class="ok-nums">
                <label>起始<input type="number" step="any" data-kf="start" value="${esc(k.start)}"></label>
                <label>目標<input type="number" step="any" data-kf="target" value="${esc(k.target)}"></label>
                <label>目前<input type="number" step="any" data-kf="current" value="${esc(k.current)}"></label>
                <label>單位<input data-kf="unit" value="${esc(k.unit)}" placeholder="%、件、門"></label>
                <div class="ok-prog">${bar(krProgress(k))}</div>
              </div>
            </div>`).join('')}
          <button class="btn btn-sm btn-ghost" data-addkr="${i}">＋ 關鍵結果</button>
        </div>`).join('')}
      <button class="btn btn-ghost" data-addo>＋ 新增目標</button>`;
    $$('textarea', root).forEach(autoGrow);
  };
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f) c.period = t.value;
    else if (t.dataset.otext != null) c.objectives[+t.dataset.otext].o = t.value;
    else if (t.dataset.kf) {
      const box = t.closest('.ok-kr');
      const [i, j] = box.dataset.kr.split('|').map(Number);
      const k = c.objectives[i].krs[j];
      k[t.dataset.kf] = ['t', 'unit'].includes(t.dataset.kf) ? t.value : Number(t.value) || 0;
      $('.ok-prog', box).innerHTML = bar(krProgress(k));
      $(`.ok-o[data-o="${i}"] .ok-oprog`, root).innerHTML = bar(objProgress(c.objectives[i]));
    } else return;
    onChange();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.addo != null) c.objectives.push({ id: nid(), o: '', krs: [{ id: nid(), t: '', start: 0, target: 100, current: 0, unit: '' }] });
    else if (b.dataset.delo != null) c.objectives.splice(+b.dataset.delo, 1);
    else if (b.dataset.addkr != null) c.objectives[+b.dataset.addkr].krs.push({ id: nid(), t: '', start: 0, target: 100, current: 0, unit: '' });
    else if (b.dataset.delkr) { const [i, j] = b.dataset.delkr.split('|').map(Number); c.objectives[i].krs.splice(j, 1); }
    else return;
    render();
    onChange();
  });
  render();
}
