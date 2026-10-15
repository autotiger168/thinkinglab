// ThinkingLab — 把每份分析畫成 SVG 思考圖（預覽、PNG/JPG/SVG、PDF 共用）
import { TOOLS, categoryOf, riskLevel, decisionTotals, paretoData, dtreeEV, krProgress, objProgress, findLoops } from './tools.js';
import { fmtDate } from './ui.js';

export const FONT = `"PingFang TC","Microsoft JhengHei","Noto Sans TC","Noto Sans CJK TC","Heiti TC",system-ui,-apple-system,"Segoe UI",sans-serif`;
const INK = '#1f2a37';
const MUTED = '#6b7280';
const LINE = '#d6d3cc';

const x = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/* ---------- 文字測量與換行 ---------- */
const mctx = document.createElement('canvas').getContext('2d');
function measure(t, size, weight = 400) {
  mctx.font = `${weight} ${size}px ${FONT}`;
  return mctx.measureText(t).width;
}
const TOKEN = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+|\s+/g;
export function wrap(text, maxW, size, weight = 400) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (let tok of para.match(TOKEN) || ['']) {
      if (measure(line + tok, size, weight) <= maxW) { line += tok; continue; }
      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      tok = tok.replace(/^\s+/, '');
      while (measure(tok, size, weight) > maxW && tok.length > 1) {
        let k = tok.length - 1;
        while (k > 1 && measure(tok.slice(0, k), size, weight) > maxW) k--;
        lines.push(tok.slice(0, k));
        tok = tok.slice(k);
      }
      line = tok;
    }
    lines.push(line.trimEnd());
  }
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
const textW = (lines, size, weight) => Math.max(0, ...lines.map((l) => measure(l, size, weight)));

function tspans(lines, px, py, size, { lh = 1.45, anchor = 'start', weight = 400, fill = INK } = {}) {
  if (!lines.length) return '';
  return `<text x="${px}" y="${py + size}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${lines.map((l, i) => `<tspan x="${px}" ${i ? `dy="${size * lh}"` : ''}>${x(l) || ' '}</tspan>`).join('')}</text>`;
}
const blockH = (n, size, lh = 1.45) => (n ? size + (n - 1) * size * lh + size * 0.35 : 0);

function header(a, tool, W) {
  const cat = categoryOf(tool);
  const titleLines = wrap(a.title || '未命名', W - 80, 26, 700);
  const h = 34 + blockH(titleLines.length, 26) + 30;
  const svg = `
    <rect x="0" y="0" width="${W}" height="6" fill="${cat.color}"/>
    <text x="40" y="34" font-size="13" fill="${cat.color}" font-weight="700" letter-spacing="1">${x(tool.name)} · ${x(tool.en)}</text>
    ${tspans(titleLines, 40, 42, 26, { weight: 700 })}
    <text x="40" y="${h - 8}" font-size="12" fill="${MUTED}">${x(fmtDate(a.updatedAt))}${a.tags && a.tags.length ? '　#' + a.tags.map(x).join('　#') : ''}</text>`;
  return { svg, h: h + 16 };
}

function wrapSvg(W, H, body) {
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family='${FONT}'><rect width="${W}" height="${H}" fill="#ffffff"/>${body}<text x="${W - 20}" y="${H - 14}" font-size="11" fill="#b8b4aa" text-anchor="end">ThinkingLab</text></svg>`, width: W, height: H };
}

export function renderFigure(a) {
  const tool = TOOLS[a.toolId];
  const fn = { grid9: figGrid9, tree: figTree, matrix: figMatrix, qa: tool.cycle ? figCycle : figQA, chain: figChain, risk: figRisk, decision: figDecision, fishbone: figFishbone, canvas: figCanvas, groups: figGroups, table: figTable, rows: tool.pareto ? figPareto : figRows, dtree: figDtree, causal: figCausal, okr: figOkr }[tool.template];
  return fn(a, tool);
}

/* ---------- 2×2 矩陣 ---------- */
function figMatrix(a, tool) {
  const W = 1200, pad = 40, rowHW = 44, colHH = 34, gap = 14;
  const hd = header(a, tool, W);
  const gx = pad + rowHW, gw = W - gx - pad, qw = (gw - gap) / 2;
  const qs = tool.quadrants.map((q, i) => {
    const items = (a.content.quadrants[i] || []).filter((t) => t.trim());
    const wrapped = items.map((t) => wrap(t, qw - 56, 16));
    const h = 64 + wrapped.reduce((s, l) => s + blockH(l.length, 16) + 10, 0) + 16;
    return { q, wrapped, h: Math.max(190, h) };
  });
  const r1 = Math.max(qs[0].h, qs[1].h), r2 = Math.max(qs[2].h, qs[3].h);
  const top = hd.h + colHH;
  let body = hd.svg;
  const AX = a.content.axes || { cols: tool.cols, rows: tool.rows };
  AX.cols.forEach((t, i) => {
    const cx = gx + i * (qw + gap) + qw / 2;
    body += `<text x="${cx}" y="${top - 12}" font-size="15" font-weight="700" fill="${MUTED}" text-anchor="middle">${x(t)}</text>`;
  });
  [r1, r2].forEach((rh, r) => {
    const cy = top + (r ? r1 + gap : 0) + rh / 2;
    body += `<text transform="translate(${pad + 18} ${cy}) rotate(-90)" font-size="15" font-weight="700" fill="${MUTED}" text-anchor="middle">${x(AX.rows[r])}</text>`;
  });
  qs.forEach((Q, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const qx = gx + col * (qw + gap), qy = top + (row ? r1 + gap : 0), qh = row ? r2 : r1;
    const c = Q.q.color;
    body += `<rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="12" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-opacity="0.55" stroke-width="1.5"/>
      <rect x="${qx}" y="${qy}" width="${qw}" height="46" rx="12" fill="${c}"/><rect x="${qx}" y="${qy + 30}" width="${qw}" height="16" fill="${c}"/>
      <text x="${qx + 20}" y="${qy + 30}" font-size="18" font-weight="700" fill="#fff">${x((a.content.titles && a.content.titles[i]) || Q.q.title)}</text>`;
    let iy = qy + 64;
    if (!Q.wrapped.length) body += `<text x="${qx + 20}" y="${iy + 16}" font-size="14" fill="#a8a29e">（尚無內容）</text>`;
    Q.wrapped.forEach((lines) => {
      body += `<circle cx="${qx + 26}" cy="${iy + 11}" r="4" fill="${c}"/>` + tspans(lines, qx + 40, iy, 16);
      iy += blockH(lines.length, 16) + 10;
    });
  });
  return wrapSvg(W, top + r1 + gap + r2 + 50, body);
}

/* ---------- 九宮格 ---------- */
function figGrid9(a, tool) {
  const cells = a.content.cells.map((t, i) => wrap(t || '', 240, i === 4 ? 22 : 18, i === 4 ? 700 : 400));
  const maxH = Math.max(...cells.map((l, i) => blockH(l.length, i === 4 ? 22 : 18)));
  const S = Math.max(280, maxH + 50), gap = 10, pad = 40;
  const W = pad * 2 + S * 3 + gap * 2;
  const hd = header(a, { ...tool }, W);
  let body = hd.svg;
  const cat = categoryOf(tool);
  cells.forEach((lines, i) => {
    const cx = pad + (i % 3) * (S + gap), cy = hd.h + Math.floor(i / 3) * (S + gap);
    const center = i === 4;
    const size = center ? 22 : 18;
    body += `<rect x="${cx}" y="${cy}" width="${S}" height="${S}" rx="14" fill="${center ? cat.color : '#faf8f3'}" stroke="${center ? cat.color : LINE}" stroke-width="1.5"/>`;
    const h = blockH(lines.length, size);
    const ty = cy + (S - h) / 2;
    body += lines.join('').trim()
      ? tspans(lines, cx + S / 2, ty, size, { anchor: 'middle', weight: center ? 700 : 400, fill: center ? '#fff' : INK })
      : `<text x="${cx + S / 2}" y="${cy + S / 2 + 6}" font-size="15" fill="${center ? '#ffffffaa' : '#c9c4ba'}" text-anchor="middle">${center ? '主題' : '·'}</text>`;
  });
  return wrapSvg(W, hd.h + S * 3 + gap * 2 + 50, body);
}

/* ---------- 樹狀圖 ---------- */
const BRANCH = ['#d9822b', '#3a7ca5', '#2f7d5b', '#b8475f', '#7a5bb0', '#2e8a8a', '#b5892b', '#4f6d8f'];
function figTree(a, tool) {
  if (tool.layout === 'pyramid') return figPyramid(a, tool);
  const mind = tool.layout === 'mind';
  const HG = mind ? 56 : 46, VG = 14;
  const prep = (n, d) => {
    const size = d === 0 ? 20 : d === 1 ? 16 : 14;
    const weight = d <= 1 ? 700 : 400;
    const lines = wrap(n.text || '（空白）', d === 0 ? 200 : 180, size, weight);
    const p = { n, d, size, weight, lines, children: n.children.map((c) => prep(c, d + 1)) };
    p.w = Math.ceil(textW(lines, size, weight)) + (d === 0 ? 40 : 28);
    p.h = Math.ceil(blockH(lines.length, size)) + (d === 0 ? 28 : 18);
    return p;
  };
  const sub = (p) => {
    p.sh = p.children.length ? Math.max(p.h, p.children.reduce((s, c) => s + sub(c), 0) + VG * (p.children.length - 1)) : p.h;
    return p.sh;
  };
  const place = (p, xEdge, yTop, dir, color) => {
    p.color = p.d === 1 ? color : p.color || color;
    p.y = yTop + p.sh / 2;
    p.x = dir > 0 ? xEdge : xEdge - p.w;
    let cy = yTop + (p.sh - (p.children.reduce((s, c) => s + c.sh, 0) + VG * (p.children.length - 1))) / 2;
    p.children.forEach((c) => {
      c.color = p.color;
      place(c, dir > 0 ? p.x + p.w + HG : p.x - HG, cy, dir, p.color);
      cy += c.sh + VG;
    });
  };
  const R = prep(a.content.root, 0);
  sub(R);
  const cat = categoryOf(tool);
  R.color = cat.color;
  let right = R.children, left = [];
  if (mind && R.children.length > 1) {
    right = []; left = [];
    let hr = 0, hl = 0;
    R.children.forEach((c) => { if (hr <= hl) { right.push(c); hr += c.sh; } else { left.push(c); hl += c.sh; } });
  }
  const colH = (arr) => arr.reduce((s, c) => s + c.sh, 0) + VG * Math.max(0, arr.length - 1);
  const H0 = Math.max(R.h, colH(right), colH(left));
  R.x = 0; R.y = H0 / 2;
  let yi = (H0 - colH(right)) / 2;
  right.forEach((c, i) => { place(c, R.w + HG, yi, 1, BRANCH[R.children.indexOf(c) % BRANCH.length]); c.dir = 1; yi += c.sh + VG; });
  yi = (H0 - colH(left)) / 2;
  left.forEach((c) => { place(c, -HG, yi, -1, BRANCH[R.children.indexOf(c) % BRANCH.length]); c.dir = -1; yi += c.sh + VG; });

  const all = [];
  (function walk(p) { all.push(p); p.children.forEach(walk); })(R);
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x + p.w));
  const pad = 40;
  const W = Math.max(720, maxX - minX + pad * 2);
  const hd = header(a, tool, W);
  const ox = pad - minX + (W - pad * 2 - (maxX - minX)) / 2, oy = hd.h + 10;
  let edges = '', nodes = '';
  (function draw(p, dir) {
    p.children.forEach((c) => {
      const d = c.dir || dir;
      const x1 = ox + (d > 0 ? p.x + p.w : p.x), y1 = oy + p.y;
      const x2 = ox + (d > 0 ? c.x : c.x + c.w), y2 = oy + c.y;
      if (mind) {
        const mx = (x1 + x2) / 2;
        edges += `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${c.color}" stroke-width="${Math.max(1.5, 4 - c.d)}" stroke-linecap="round"/>`;
      } else {
        const mx = x1 + HG / 2;
        edges += `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`;
      }
      draw(c, d);
    });
    const nx = ox + p.x, ny = oy + p.y - p.h / 2;
    if (p.d === 0) {
      nodes += `<rect x="${nx}" y="${ny}" width="${p.w}" height="${p.h}" rx="${mind ? p.h / 2 : 10}" fill="${cat.color}"/>`;
      nodes += tspans(p.lines, nx + p.w / 2, ny + 13, p.size, { anchor: 'middle', weight: 700, fill: '#fff' });
    } else if (mind && p.d >= 2) {
      nodes += `<rect x="${nx}" y="${ny}" width="${p.w}" height="${p.h}" rx="8" fill="#fff" stroke="${p.color}" stroke-opacity="0.35"/>`;
      nodes += tspans(p.lines, nx + 14, ny + 8, p.size, { weight: p.weight });
    } else {
      const c = mind ? p.color : p.d === 1 ? cat.color : '#fff';
      const fill = mind || p.d === 1 ? c : '#fff';
      nodes += `<rect x="${nx}" y="${ny}" width="${p.w}" height="${p.h}" rx="8" fill="${fill}" fill-opacity="${mind ? 0.14 : p.d === 1 ? 0.12 : 1}" stroke="${mind ? c : p.d === 1 ? cat.color : '#9ca3af'}" stroke-width="1.5"/>`;
      nodes += tspans(p.lines, nx + 14, ny + 8, p.size, { weight: p.weight });
    }
  })(R, 1);
  return wrapSvg(W, oy + H0 + 60, hd.svg + edges + nodes);
}

/* ---------- 引導問答 ---------- */
function figQA(a, tool) {
  const flow = !!tool.flow;
  const W = flow ? 960 : 1200, pad = 40, gap = 16;
  const hd = header(a, tool, W);
  const cols = flow ? 1 : 2;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const cards = tool.sections.map((s) => {
    const lines = wrap(a.content.sections[s.key] || '', cw - 40, 16);
    const empty = !(a.content.sections[s.key] || '').trim();
    return { s, lines, empty, h: 52 + blockH(empty ? 1 : lines.length, 16) + 18 };
  });
  let body = hd.svg, y = hd.h;
  for (let i = 0; i < cards.length; i += cols) {
    const row = cards.slice(i, i + cols);
    const rh = Math.max(...row.map((c) => c.h));
    row.forEach((c, j) => {
      const cx = pad + j * (cw + gap), col = c.s.color;
      body += `<rect x="${cx}" y="${y}" width="${cw}" height="${rh}" rx="12" fill="${col}" fill-opacity="0.06" stroke="${col}" stroke-opacity="0.5" stroke-width="1.5"/>
        <rect x="${cx}" y="${y}" width="6" height="${rh}" rx="3" fill="${col}"/>
        <text x="${cx + 22}" y="${y + 32}" font-size="17" font-weight="700" fill="${col}">${x(c.s.label)}</text>`;
      body += c.empty ? `<text x="${cx + 22}" y="${y + 68}" font-size="14" fill="#a8a29e">（尚未填寫）</text>` : tspans(c.lines, cx + 22, y + 48, 16);
    });
    y += rh;
    if (flow && i + cols < cards.length) {
      body += `<path d="M${W / 2} ${y + 6} V${y + 26}" stroke="#9ca3af" stroke-width="2"/><path d="M${W / 2 - 7} ${y + 20} L${W / 2} ${y + 30} L${W / 2 + 7} ${y + 20}" fill="none" stroke="#9ca3af" stroke-width="2"/>`;
      y += 36;
    } else y += gap;
  }
  return wrapSvg(W, y + 40, body);
}

/* ---------- 5 Why ---------- */
function figChain(a, tool) {
  const W = 960, pad = 40, bw = W - pad * 2;
  const c = a.content;
  const hd = header(a, tool, W);
  const boxes = [{ label: '問題現象', text: c.problem, color: '#c0563b' }];
  c.whys.forEach((w, i) => {
    if (!(w.q || '').trim() && !(w.a || '').trim()) return;
    boxes.push({ label: `Why ${i + 1}${w.q ? '：' + w.q : ''}`, text: w.a, color: '#3a7ca5', shade: 0.05 + i * 0.03 });
  });
  boxes.push({ label: '根本原因', text: c.root, color: '#7a5bb0', strong: true });
  boxes.push({ label: '對策', text: c.action, color: '#2f7d5b' });
  let y = hd.h, body = hd.svg;
  boxes.forEach((b, i) => {
    const ll = wrap(b.label, bw - 40, 16, 700);
    const tl = wrap(b.text || '', bw - 40, 15);
    const empty = !(b.text || '').trim();
    const h = 20 + blockH(ll.length, 16) + 8 + blockH(empty ? 1 : tl.length, 15) + 14;
    body += `<rect x="${pad}" y="${y}" width="${bw}" height="${h}" rx="12" fill="${b.color}" fill-opacity="${b.strong ? 0.14 : b.shade || 0.07}" stroke="${b.color}" stroke-width="${b.strong ? 2.5 : 1.5}"/>`;
    body += tspans(ll, pad + 20, y + 14, 16, { weight: 700, fill: b.color });
    const ty = y + 14 + blockH(ll.length, 16) + 6;
    body += empty ? `<text x="${pad + 20}" y="${ty + 15}" font-size="14" fill="#a8a29e">（尚未填寫）</text>` : tspans(tl, pad + 20, ty, 15);
    y += h;
    if (i < boxes.length - 1) {
      body += `<path d="M${W / 2} ${y + 4} V${y + 22}" stroke="#9ca3af" stroke-width="2"/><path d="M${W / 2 - 7} ${y + 16} L${W / 2} ${y + 26} L${W / 2 + 7} ${y + 16}" fill="none" stroke="#9ca3af" stroke-width="2"/>`;
      y += 32;
    }
  });
  return wrapSvg(W, y + 50, body);
}

/* ---------- 風險矩陣 ---------- */
function figRisk(a, tool) {
  const W = 1200, pad = 40;
  const hd = header(a, tool, W);
  const risks = a.content.risks.map((r, i) => ({ ...r, no: i + 1, s: r.p * r.i }));
  let body = hd.svg;
  // 熱區圖
  const cs = 66, hx = pad + 60, hy = hd.h + 20;
  body += `<text x="${hx + cs * 2.5}" y="${hy - 4}" font-size="14" font-weight="700" fill="${INK}" text-anchor="middle">風險熱區圖</text>`;
  for (let p = 5; p >= 1; p--) {
    for (let i = 1; i <= 5; i++) {
      const cx = hx + (i - 1) * cs, cy = hy + 10 + (5 - p) * cs;
      const lv = riskLevel(p * i);
      body += `<rect x="${cx}" y="${cy}" width="${cs - 3}" height="${cs - 3}" rx="6" fill="${lv.color}" fill-opacity="0.22"/>`;
      const here = risks.filter((r) => r.p === p && r.i === i).map((r) => 'R' + r.no);
      if (here.length) body += tspans(wrap(here.join(' '), cs - 10, 12, 700), cx + (cs - 3) / 2, cy + (cs - 3) / 2 - 10, 12, { anchor: 'middle', weight: 700, fill: '#3b1d1d' });
    }
    body += `<text x="${hx - 12}" y="${hy + 10 + (5 - p) * cs + cs / 2 + 4}" font-size="13" fill="${MUTED}" text-anchor="end">${p}</text>`;
  }
  for (let i = 1; i <= 5; i++) body += `<text x="${hx + (i - 1) * cs + cs / 2}" y="${hy + 10 + 5 * cs + 18}" font-size="13" fill="${MUTED}" text-anchor="middle">${i}</text>`;
  body += `<text x="${hx + cs * 2.5}" y="${hy + 10 + 5 * cs + 40}" font-size="13" font-weight="700" fill="${MUTED}" text-anchor="middle">影響程度 →</text>`;
  body += `<text transform="translate(${hx - 40} ${hy + 10 + cs * 2.5}) rotate(-90)" font-size="13" font-weight="700" fill="${MUTED}" text-anchor="middle">發生機率 →</text>`;
  // 統計
  const sx = hx + cs * 5 + 70;
  const counts = { '極高': 0, '高': 0, '中': 0, '低': 0 };
  risks.forEach((r) => counts[riskLevel(r.s).label]++);
  body += `<text x="${sx}" y="${hy + 26}" font-size="14" font-weight="700" fill="${INK}">風險統計（共 ${risks.length} 項）</text>`;
  [['極高', 20], ['高', 12], ['中', 6], ['低', 1]].forEach(([k, s], j) => {
    const lv = riskLevel(s), yy = hy + 52 + j * 40;
    body += `<rect x="${sx}" y="${yy}" width="26" height="26" rx="6" fill="${lv.color}"/><text x="${sx + 40}" y="${yy + 19}" font-size="15" fill="${INK}">${k}　${counts[k]} 項</text>`;
  });
  const open = risks.filter((r) => r.status !== '已關閉').length;
  body += `<text x="${sx}" y="${hy + 52 + 4 * 40 + 18}" font-size="14" fill="${MUTED}">未關閉：${open} 項</text>`;
  // 表格
  const cols = [['#', 44], ['風險描述', 300], ['類別', 100], ['機率', 48], ['影響', 48], ['分數', 56], ['等級', 60], ['策略', 64], ['對策', 280], ['負責/狀態', 120]];
  let ty = hy + 10 + 5 * cs + 70;
  let cx = pad;
  body += `<rect x="${pad}" y="${ty}" width="${W - pad * 2}" height="36" fill="#f1eee7"/>`;
  cols.forEach(([t, w]) => { body += `<text x="${cx + 8}" y="${ty + 23}" font-size="13" font-weight="700" fill="${INK}">${t}</text>`; cx += w; });
  ty += 36;
  const sorted = [...risks].sort((p, q) => q.s - p.s);
  if (!sorted.length) { body += `<text x="${pad + 8}" y="${ty + 26}" font-size="14" fill="#a8a29e">（尚未新增風險）</text>`; ty += 40; }
  sorted.forEach((r) => {
    const lv = riskLevel(r.s);
    const cells = ['R' + r.no, r.desc, r.cat, String(r.p), String(r.i), String(r.s), lv.label, r.strategy, r.response, [r.owner, r.status].filter(Boolean).join(' / ')];
    const wrapped = cells.map((t, k) => wrap(t || '', cols[k][1] - 16, 13, k === 0 || k === 5 ? 700 : 400));
    const rh = Math.max(...wrapped.map((l) => blockH(l.length, 13))) + 18;
    cx = pad;
    body += `<line x1="${pad}" y1="${ty + rh}" x2="${W - pad}" y2="${ty + rh}" stroke="${LINE}"/>`;
    wrapped.forEach((lines, k) => {
      if (k === 6) body += `<rect x="${cx + 6}" y="${ty + 8}" width="${cols[k][1] - 14}" height="22" rx="11" fill="${lv.color}"/>` + tspans(lines, cx + cols[k][1] / 2 - 1, ty + 8, 13, { anchor: 'middle', weight: 700, fill: '#fff' });
      else body += tspans(lines, cx + 8, ty + 8, 13, { weight: k === 0 || k === 5 ? 700 : 400 });
      cx += cols[k][1];
    });
    ty += rh;
  });
  return wrapSvg(W, ty + 50, body);
}

/* ---------- 加權決策矩陣 ---------- */
function figDecision(a, tool) {
  const c = a.content;
  const n = c.options.length;
  const ow = 140, nw = 240, ww = 70, pad = 40;
  const W = Math.max(900, pad * 2 + nw + ww + n * ow);
  const hd = header(a, tool, W);
  const tot = decisionTotals(c);
  const best = Math.max(...tot.map((t) => t.total));
  const cat = categoryOf(tool);
  const tx = pad + (W - pad * 2 - (nw + ww + n * ow)) / 2;
  let y = hd.h, body = hd.svg;
  const headLines = c.options.map((o) => wrap(o.name || '—', ow - 16, 15, 700));
  const hh = Math.max(...headLines.map((l) => blockH(l.length, 15)), 18) + 22;
  body += `<rect x="${tx}" y="${y}" width="${nw + ww + n * ow}" height="${hh}" fill="#f1eee7"/>`;
  body += `<text x="${tx + 12}" y="${y + hh / 2 + 5}" font-size="14" font-weight="700" fill="${INK}">評估準則</text><text x="${tx + nw + ww / 2}" y="${y + hh / 2 + 5}" font-size="14" font-weight="700" fill="${INK}" text-anchor="middle">權重</text>`;
  c.options.forEach((o, j) => {
    const cx = tx + nw + ww + j * ow;
    if (tot[j].total === best && best > 0) body += `<rect x="${cx}" y="${y}" width="${ow}" height="${hh}" fill="${cat.color}" fill-opacity="0.18"/>`;
    body += tspans(headLines[j], cx + ow / 2, y + 11, 15, { anchor: 'middle', weight: 700 });
  });
  y += hh;
  c.criteria.forEach((cr) => {
    const nl = wrap(cr.name || '—', nw - 20, 14);
    const rh = blockH(nl.length, 14) + 20;
    body += tspans(nl, tx + 12, y + 10, 14) + `<text x="${tx + nw + ww / 2}" y="${y + rh / 2 + 5}" font-size="14" fill="${MUTED}" text-anchor="middle">×${cr.weight}</text>`;
    c.options.forEach((o, j) => {
      const cx = tx + nw + ww + j * ow;
      const s = (c.scores[cr.id] || {})[o.id];
      if (tot[j].total === best && best > 0) body += `<rect x="${cx}" y="${y}" width="${ow}" height="${rh}" fill="${cat.color}" fill-opacity="0.07"/>`;
      body += `<text x="${cx + ow / 2}" y="${y + rh / 2 + 5}" font-size="15" fill="${INK}" text-anchor="middle">${s ?? '–'}</text>`;
    });
    y += rh;
    body += `<line x1="${tx}" y1="${y}" x2="${tx + nw + ww + n * ow}" y2="${y}" stroke="${LINE}"/>`;
  });
  body += `<rect x="${tx}" y="${y}" width="${nw + ww + n * ow}" height="44" fill="#f1eee7"/><text x="${tx + 12}" y="${y + 28}" font-size="15" font-weight="700" fill="${INK}">加權總分</text>`;
  tot.forEach((t, j) => {
    const cx = tx + nw + ww + j * ow;
    const win = t.total === best && best > 0;
    body += `<text x="${cx + ow / 2}" y="${y + 28}" font-size="17" font-weight="700" fill="${win ? cat.color : INK}" text-anchor="middle">${t.total}${win ? ' ★' : ''}</text>`;
  });
  y += 70;
  body += `<text x="${pad}" y="${y}" font-size="15" font-weight="700" fill="${INK}">總分比較（占滿分百分比）</text>`;
  y += 16;
  const barX = pad + 170, barW = W - barX - pad - 70;
  [...tot].sort((p, q) => q.total - p.total).forEach((t) => {
    const win = t.total === best && best > 0;
    body += tspans(wrap(t.name || '—', 150, 14).slice(0, 1), pad, y + 4, 14, { weight: win ? 700 : 400 });
    body += `<rect x="${barX}" y="${y + 4}" width="${barW}" height="20" rx="10" fill="#efece5"/><rect x="${barX}" y="${y + 4}" width="${Math.max(4, barW * t.pct / 100)}" height="20" rx="10" fill="${win ? cat.color : '#9ca3af'}"/>`;
    body += `<text x="${barX + barW + 12}" y="${y + 19}" font-size="14" font-weight="700" fill="${INK}">${t.pct}%</text>`;
    y += 34;
  });
  return wrapSvg(W, y + 40, body);
}

/* ---------- 循環圖（PDCA、OODA） ---------- */
function figCycle(a, tool) {
  const W = 1100, pad = 40, gap = 120, cw = (W - pad * 2 - gap) / 2;
  const hd = header(a, tool, W);
  const secs = tool.sections; // 4 個：左上 → 右上 → 右下 → 左下（順時針）
  const pos = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const cards = secs.map((s) => {
    const txt = a.content.sections[s.key] || '';
    const lines = wrap(txt, cw - 44, 15);
    return { s, lines, empty: !txt.trim(), h: 56 + blockH(txt.trim() ? lines.length : 1, 15) + 20 };
  });
  const rh = [Math.max(cards[0].h, cards[1].h, 170), Math.max(cards[2].h, cards[3].h, 170)];
  const top = hd.h + 10, vgap = 70;
  const cx = W / 2, cy = top + rh[0] + vgap / 2;
  const R = Math.min(gap / 2 + cw * 0.35, rh[0] / 2 + vgap / 2 + 30);
  const cat = categoryOf(tool);
  let body = hd.svg;
  body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${cat.color}" stroke-opacity="0.35" stroke-width="10"/>`;
  [0, 90, 180, 270].forEach((deg) => {
    const t = (deg - 90) * Math.PI / 180, x0 = cx + R * Math.cos(t), y0 = cy + R * Math.sin(t);
    const tx = -Math.sin(t), ty = Math.cos(t);
    const nx = Math.cos(t), ny = Math.sin(t);
    const p1 = [x0 + tx * 22, y0 + ty * 22], p2 = [x0 - tx * 10 + nx * 18, y0 - ty * 10 + ny * 18], p3 = [x0 - tx * 10 - nx * 18, y0 - ty * 10 - ny * 18];
    body += `<polygon points="${p1.join(',')} ${p2.join(',')} ${p3.join(',')}" fill="${cat.color}"/>`;
  });
  cards.forEach((c, i) => {
    const [col, row] = pos[i];
    const x = pad + col * (cw + gap), y = top + (row ? rh[0] + vgap : 0), h = rh[row];
    const color = c.s.color;
    body += `<rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="14" fill="#fff"/>
      <rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="14" fill="${color}" fill-opacity="0.07" stroke="${color}" stroke-width="1.8"/>
      <circle cx="${x + 30}" cy="${y + 30}" r="15" fill="${color}"/><text x="${x + 30}" y="${y + 35.5}" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>
      <text x="${x + 56}" y="${y + 36}" font-size="18" font-weight="700" fill="${color}">${x2(c.s.label)}</text>`;
    body += c.empty ? `<text x="${x + 22}" y="${y + 78}" font-size="14" fill="#a8a29e">（尚未填寫）</text>` : tspans(c.lines, x + 22, y + 56, 15);
  });
  body += `<circle cx="${cx}" cy="${cy}" r="46" fill="${cat.color}"/><text x="${cx}" y="${cy + 6}" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">${x2(tool.name.replace(/\s*循環$/, ''))}</text>`;
  return wrapSvg(W, top + rh[0] + vgap + rh[1] + 50, body);
}
function x2(s) { return x(s); }

/* ---------- 畫布 ---------- */
function figCanvas(a, tool) {
  const { cols, rows } = tool.grid;
  const W = cols >= 6 ? 1500 : cols === 4 ? 1300 : 1200, pad = 40, gap = 10;
  const hd = header(a, tool, W);
  const unit = (W - pad * 2 + gap) / cols;
  const blocks = tool.blocks.map((b) => {
    const [cx, cy, cw, ch] = b.area;
    const w = unit * cw - gap;
    const items = (a.content.blocks[b.key] || []).filter((t) => t.trim()).map((t) => wrap(t, w - 46, 14));
    const need = 52 + items.reduce((s, l) => s + blockH(l.length, 14) + 7, 0) + 14;
    return { b, cx, cy, cw, ch, w, items, need };
  });
  const rowH = Array(rows).fill(cols >= 6 ? 150 : 130);
  // 依各區塊需要的高度，平均分配到它跨越的列
  for (let iter = 0; iter < 3; iter++) {
    blocks.forEach((B) => {
      const have = rowH.slice(B.cy, B.cy + B.ch).reduce((s, v) => s + v, 0) + gap * (B.ch - 1);
      if (B.need > have) for (let r = B.cy; r < B.cy + B.ch; r++) rowH[r] += (B.need - have) / B.ch;
    });
  }
  const rowY = [hd.h];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + rowH[r - 1] + gap;
  let body = hd.svg;
  blocks.forEach((B) => {
    const x0 = pad + B.cx * unit, y0 = rowY[B.cy];
    const h = rowH.slice(B.cy, B.cy + B.ch).reduce((s, v) => s + v, 0) + gap * (B.ch - 1);
    const c = B.b.color;
    body += `<rect x="${x0}" y="${y0}" width="${B.w}" height="${h}" rx="10" fill="${c}" fill-opacity="0.06" stroke="${c}" stroke-opacity="0.5" stroke-width="1.5"/>
      <rect x="${x0}" y="${y0}" width="${B.w}" height="5" rx="2" fill="${c}"/>
      ${tspans(wrap(B.b.title, B.w - 28, 15, 700).slice(0, 1), x0 + 14, y0 + 14, 15, { weight: 700, fill: c })}`;
    let iy = y0 + 48;
    if (!B.items.length) body += `<text x="${x0 + 14}" y="${iy + 14}" font-size="13" fill="#a8a29e">（尚無內容）</text>`;
    B.items.forEach((lines) => {
      body += `<rect x="${x0 + 12}" y="${iy - 2}" width="${B.w - 24}" height="${blockH(lines.length, 14) + 6}" rx="5" fill="#fff" stroke="${c}" stroke-opacity="0.25"/>` + tspans(lines, x0 + 22, iy, 14);
      iy += blockH(lines.length, 14) + 7;
    });
  });
  // 力場分析：畫箭頭
  if (tool.id === 'forcefield') {
    const midY = rowY[0] + rowH[0] / 2;
    const l = pad + unit - gap / 2, r = pad + unit * 2 - gap / 2;
    body += `<path d="M${l - 4} ${midY} l12 -8 v16 z" fill="${tool.blocks[0].color}"/><path d="M${r + 4 - gap} ${midY} l-12 -8 v16 z" fill="${tool.blocks[2].color}"/>`;
  }
  return wrapSvg(W, rowY[rows - 1] + rowH[rows - 1] + 50, body);
}

/* ---------- 魚骨圖 ---------- */
function figFishbone(a, tool) {
  const c = a.content;
  const cats = c.cats;
  const n = cats.length;
  const colsN = Math.max(1, Math.ceil(n / 2));
  const colW = 300, headW = 250, pad = 40, dx = 110, textW = 170;
  const W = pad * 2 + colsN * colW + headW + 30;
  const hd = header(a, tool, W);
  const prep = cats.map((cat) => {
    const causes = cat.causes.filter((t) => t.trim()).map((t) => wrap(t, textW, 13));
    return { cat, causes, h: causes.reduce((s, l) => s + blockH(l.length, 13) + 10, 0) };
  });
  const boneH = Math.max(150, ...prep.map((p) => p.h + 50));
  const labelH = 40;
  const topY = hd.h + 10;
  const spineY = topY + labelH + boneH;
  const botY = spineY + boneH + labelH;
  const spineX0 = pad, spineX1 = pad + colsN * colW + 20;
  let body = hd.svg;
  body += `<line x1="${spineX0}" y1="${spineY}" x2="${spineX1}" y2="${spineY}" stroke="#1f2a37" stroke-width="4" stroke-linecap="round"/>`;
  body += `<path d="M${spineX0 - 4} ${spineY} l-26 -22 M${spineX0 - 4} ${spineY} l-26 22" stroke="#1f2a37" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  // 魚頭
  const pl = wrap(c.problem || '（問題）', headW - 40, 17, 700);
  const ph = Math.max(90, blockH(pl.length, 17) + 34);
  const hx = spineX1;
  body += `<path d="M${hx} ${spineY - ph / 2} H${hx + headW - 30} Q${hx + headW + 4} ${spineY} ${hx + headW - 30} ${spineY + ph / 2} H${hx} Z" fill="#c0563b"/>`;
  body += tspans(pl, hx + 20, spineY - blockH(pl.length, 17) / 2 - 2, 17, { weight: 700, fill: '#fff' });
  prep.forEach((P, i) => {
    const up = i % 2 === 0;
    const col = Math.floor(i / 2);
    const x0 = pad + 170 + col * colW; // 大骨起點（遠離脊椎端）
    const yEnd = up ? topY + labelH : botY - labelH;
    const color = BRANCH[i % BRANCH.length];
    body += `<line x1="${x0}" y1="${yEnd}" x2="${x0 + dx}" y2="${spineY}" stroke="${color}" stroke-width="3"/>`;
    const lw = Math.min(colW - 20, measure(P.cat.name, 15, 700) + 28);
    const ly = up ? topY : botY - 32;
    body += `<rect x="${x0 - lw / 2}" y="${ly}" width="${lw}" height="32" rx="16" fill="${color}"/><text x="${x0}" y="${ly + 21}" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${x(P.cat.name)}</text>`;
    let yy = up ? yEnd + 22 : spineY + 26;
    P.causes.forEach((lines) => {
      const h = blockH(lines.length, 13);
      const yc = yy + h / 2;
      const t = up ? (yc - yEnd) / (spineY - yEnd) : (yc - spineY) / (yEnd - spineY);
      const xb = up ? x0 + dx * t : x0 + dx * (1 - t);
      body += `<line x1="${xb - 16}" y1="${yc}" x2="${xb}" y2="${yc}" stroke="${color}" stroke-width="1.5"/>`;
      body += tspans(lines, xb - 20, yy - 1, 13, { anchor: 'end' });
      yy += h + 10;
    });
  });
  return wrapSvg(W, botY + 50, body);
}

/* ================= Phase 3 思考圖 ================= */
const GPC = ['#3a7ca5', '#d9822b', '#2f7d5b', '#7a5bb0', '#c0563b', '#2e8a8a', '#b5892b', '#4f6d8f'];
const nfmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
const arrowDown = (cx, y) => `<path d="M${cx} ${y} V${y + 18}" stroke="#9ca3af" stroke-width="2"/><path d="M${cx - 6} ${y + 12} L${cx} ${y + 20} L${cx + 6} ${y + 12}" fill="none" stroke="#9ca3af" stroke-width="2"/>`;

function topicBox(text, label, x0, y0, w, color) {
  if (!(text || '').trim()) return { svg: '', h: 0 };
  const lines = wrap(text, w - 40, 16, 700);
  const h = 20 + 18 + blockH(lines.length, 16) + 10;
  return {
    svg: `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="12" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-opacity="0.45"/>
      <text x="${x0 + 20}" y="${y0 + 26}" font-size="12" font-weight="700" fill="${color}" letter-spacing="1">${x(label)}</text>${tspans(lines, x0 + 20, y0 + 32, 16, { weight: 700 })}`,
    h: h + 16,
  };
}

/* ---------- 群組 ---------- */
function figGroups(a, tool) {
  const c = a.content;
  const W = 1200, pad = 40, gap = 14;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  const tb = topicBox(c.topic, tool.voting ? '發想主題' : '主題', pad, hd.h, W - pad * 2, cat.color);
  const n = c.groups.length;
  const perRow = Math.min(4, Math.max(1, n));
  const gw = (W - pad * 2 - gap * (perRow - 1)) / perRow;
  const groups = c.groups.map((g, i) => {
    let items = g.items.filter((it) => (it.t || '').trim());
    if (tool.voting) items = [...items].sort((p, q) => (q.v || 0) - (p.v || 0));
    const wrapped = items.map((it) => ({ it, lines: wrap(it.t, gw - (tool.voting ? 84 : 36), 14) }));
    const h = 52 + wrapped.reduce((s, w) => s + blockH(w.lines.length, 14) + 18, 0) + 8;
    return { g, i, wrapped, h: Math.max(110, h) };
  });
  let body = hd.svg + tb.svg;
  let y = hd.h + tb.h;
  for (let r = 0; r < groups.length; r += perRow) {
    const row = groups.slice(r, r + perRow);
    const rh = Math.max(...row.map((g) => g.h));
    row.forEach((G, k) => {
      const gx = pad + k * (gw + gap), col = GPC[G.i % GPC.length];
      body += `<rect x="${gx}" y="${y}" width="${gw}" height="${rh}" rx="12" fill="${col}" fill-opacity="0.05" stroke="${col}" stroke-opacity="0.4"/>
        <rect x="${gx}" y="${y}" width="${gw}" height="40" rx="12" fill="${col}"/><rect x="${gx}" y="${y + 26}" width="${gw}" height="14" fill="${col}"/>
        ${tspans(wrap(G.g.name || '未命名', gw - 70, 16, 700).slice(0, 1), gx + 16, y + 9, 16, { weight: 700, fill: '#fff' })}
        <text x="${gx + gw - 16}" y="${y + 26}" font-size="13" fill="#fff" text-anchor="end" opacity="0.9">${G.wrapped.length} 項</text>`;
      let iy = y + 52;
      if (!G.wrapped.length) body += `<text x="${gx + 16}" y="${iy + 16}" font-size="13" fill="#a8a29e">（尚無內容）</text>`;
      G.wrapped.forEach(({ it, lines }) => {
        const h = blockH(lines.length, 14) + 10;
        const top = tool.voting && it.v && it.v === Math.max(...G.wrapped.map((w) => w.it.v || 0));
        body += `<rect x="${gx + 10}" y="${iy}" width="${gw - 20}" height="${h}" rx="6" fill="${top ? '#fff6dc' : '#fff'}" stroke="${col}" stroke-opacity="${top ? 0.9 : 0.3}" stroke-width="${top ? 1.6 : 1}"/>`;
        body += tspans(lines, gx + 22, iy + 4, 14);
        if (tool.voting) body += `<rect x="${gx + gw - 66}" y="${iy + h / 2 - 11}" width="46" height="22" rx="11" fill="${it.v ? col : '#e5e2da'}"/><text x="${gx + gw - 43}" y="${iy + h / 2 + 4.5}" font-size="12" font-weight="700" fill="${it.v ? '#fff' : '#8a8578'}" text-anchor="middle">▲ ${it.v || 0}</text>`;
        iy += h + 8;
      });
    });
    y += rh + gap;
  }
  return wrapSvg(W, y + 40, body);
}

/* ---------- 表格 ---------- */
function figTable(a, tool) {
  const c = a.content, T = tool.table;
  const nc = c.cols.length;
  const pad = 40, headW = 170;
  const W = Math.max(1100, pad * 2 + headW + nc * 190);
  const cw = (W - pad * 2 - headW) / nc;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  const tb = topicBox(c.topic, (TOPIC_LABEL[tool.id] || '主題'), pad, hd.h, W - pad * 2, cat.color);
  let body = hd.svg + tb.svg;
  let y = hd.h + tb.h;
  const colColor = (j) => (T.colColors && T.colColors[j]) || cat.color;
  // 欄標題
  const heads = c.cols.map((t) => wrap(t || '—', cw - 20, 15, 700));
  const hh = Math.max(...heads.map((l) => blockH(l.length, 15)), 18) + 20;
  heads.forEach((l, j) => {
    const cx = pad + headW + j * cw;
    body += `<rect x="${cx + 2}" y="${y}" width="${cw - 4}" height="${hh}" rx="8" fill="${colColor(j)}"/>` + tspans(l, cx + cw / 2, y + 9, 15, { anchor: 'middle', weight: 700, fill: '#fff' });
  });
  y += hh + 4;
  c.rows.forEach((row, i) => {
    const rl = wrap(row || '—', headW - 24, 14, 700);
    const hint = T.rowHints ? wrap(T.rowHints[i], headW - 24, 11) : [];
    const cells = c.cols.map((_, j) => wrap(c.cells[i][j] || '', cw - 28, 13));
    const rh = Math.max(blockH(rl.length, 14) + blockH(hint.length, 11) + 4, ...cells.map((l) => blockH(l.length, 13))) + 22;
    body += `<rect x="${pad}" y="${y}" width="${headW - 4}" height="${rh}" rx="8" fill="#f1eee7"/>` + tspans(rl, pad + 12, y + 9, 14, { weight: 700 });
    if (hint.length) body += tspans(hint, pad + 12, y + 13 + blockH(rl.length, 14), 11, { fill: MUTED });
    cells.forEach((l, j) => {
      const cx = pad + headW + j * cw;
      const on = T.select && c.sel[i] === j;
      body += `<rect x="${cx + 2}" y="${y}" width="${cw - 4}" height="${rh}" rx="8" fill="${on ? colColor(j) : '#fff'}" fill-opacity="${on ? 0.16 : 1}" stroke="${on ? cat.color : '#e3ddd0'}" stroke-width="${on ? 2.2 : 1}"/>`;
      body += tspans(l, cx + 14, y + 10, 13, { weight: on ? 700 : 400 });
      if (on) body += `<circle cx="${cx + cw - 16}" cy="${y + 14}" r="9" fill="${cat.color}"/><path d="M${cx + cw - 20} ${y + 14} l3 3 l6 -6" stroke="#fff" stroke-width="2" fill="none"/>`;
    });
    y += rh + 4;
  });
  if (T.emotion) {
    const eh = 170, top = y + 10;
    body += `<rect x="${pad}" y="${top}" width="${headW - 4}" height="${eh}" rx="8" fill="#f1eee7"/><text x="${pad + 12}" y="${top + 26}" font-size="14" font-weight="700" fill="${INK}">情緒曲線</text>`;
    const yOf = (v) => top + 20 + (2 - v) * ((eh - 40) / 4);
    [2, 1, 0, -1, -2].forEach((v) => {
      body += `<line x1="${pad + headW}" y1="${yOf(v)}" x2="${W - pad}" y2="${yOf(v)}" stroke="${v === 0 ? '#c9c4ba' : '#ece8df'}" stroke-dasharray="${v === 0 ? '' : '4 4'}"/>`;
      body += `<text x="${pad + headW - 12}" y="${yOf(v) + 4}" font-size="11" fill="${MUTED}" text-anchor="end">${v > 0 ? '+' + v : v}</text>`;
    });
    const pts = c.cols.map((_, j) => [pad + headW + j * cw + cw / 2, yOf(Number(c.emo[j]) || 0)]);
    body += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${cat.color}" stroke-width="3" stroke-linejoin="round"/>`;
    pts.forEach(([px, py], j) => {
      const v = Number(c.emo[j]) || 0;
      const col = v > 0 ? '#2f7d5b' : v < 0 ? '#c0563b' : '#8a8578';
      body += `<circle cx="${px}" cy="${py}" r="9" fill="#fff" stroke="${col}" stroke-width="3"/>`;
      if (v === Math.min(...c.emo.map(Number)) && v < 0) body += `<text x="${px}" y="${py + 28}" font-size="12" font-weight="700" fill="#c0563b" text-anchor="middle">最低點</text>`;
    });
    y = top + eh + 10;
  }
  if (T.select) {
    const picks = c.rows.map((r, i) => (c.sel[i] >= 0 ? `${r}：${c.cells[i][c.sel[i]] || c.cols[c.sel[i]]}` : null)).filter(Boolean);
    if (picks.length) {
      const lines = wrap('選定組合　' + picks.join('　／　'), W - pad * 2 - 40, 15, 700);
      const h = blockH(lines.length, 15) + 24;
      body += `<rect x="${pad}" y="${y + 10}" width="${W - pad * 2}" height="${h}" rx="10" fill="${cat.color}" fill-opacity="0.1" stroke="${cat.color}"/>` + tspans(lines, pad + 20, y + 21, 15, { weight: 700, fill: cat.color });
      y += h + 14;
    }
  }
  return wrapSvg(W, y + 50, body);
}
const TOPIC_LABEL = { isisnot: '問題描述', morph: '設計對象', journey: '顧客與情境' };

/* ---------- 評分表（RICE、FMEA） ---------- */
function figRows(a, tool) {
  const rowsD = a.content.rows.map((r) => ({ r, v: tool.score(r), lv: tool.level ? tool.level(tool.score(r), r) : null })).sort((p, q) => q.v - p.v);
  const many = tool.fields.length > 6;
  const W = many ? 1600 : 1200, pad = 40;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  const cols = [{ label: '#', w: 0.5 }, ...tool.fields.map((f) => ({ f, label: f.label, w: f.type === 'text' ? (f.wide ? 2.4 : 1.7) : 0.9 })), { label: tool.scoreLabel, w: 1, score: true }];
  const tw = cols.reduce((s, c) => s + c.w, 0);
  const unit = (W - pad * 2) / tw;
  let y = hd.h, body = hd.svg;
  const hdrL = cols.map((c) => wrap(c.label, c.w * unit - 14, 12, 700));
  const hh = Math.max(...hdrL.map((l) => blockH(l.length, 12))) + 18;
  body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${hh}" rx="6" fill="#f1eee7"/>`;
  let cx = pad;
  hdrL.forEach((l, k) => { body += tspans(l, cx + 7, y + 8, 12, { weight: 700 }); cx += cols[k].w * unit; });
  y += hh;
  if (!rowsD.length) { body += `<text x="${pad + 8}" y="${y + 28}" font-size="14" fill="#a8a29e">（尚未新增項目）</text>`; y += 44; }
  const label = (f, v) => { if (f.type !== 'sel') return String(v ?? ''); const o = f.options.find((o) => (Array.isArray(o) ? o[0] : o) === String(v)); return o ? (Array.isArray(o) ? o[1] : o) : String(v ?? ''); };
  rowsD.forEach((d, idx) => {
    const vals = cols.map((c) => (c.score ? nfmt(d.v) : c.f ? label(c.f, d.r[c.f.key]) : String(idx + 1)));
    const wr = vals.map((t, k) => wrap(t, cols[k].w * unit - 14, 13, cols[k].score ? 700 : 400));
    const rh = Math.max(...wr.map((l) => blockH(l.length, 13))) + 16;
    if (idx % 2) body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${rh}" fill="#faf8f3"/>`;
    cx = pad;
    wr.forEach((l, k) => {
      if (cols[k].score) {
        const col = d.lv ? d.lv.color : cat.color;
        body += `<rect x="${cx + 4}" y="${y + 5}" width="${cols[k].w * unit - 10}" height="${rh - 10}" rx="6" fill="${col}"/>` + tspans(l, cx + cols[k].w * unit / 2 - 1, y + rh / 2 - 9, 13, { anchor: 'middle', weight: 700, fill: '#fff' });
      } else body += tspans(l, cx + 7, y + 7, 13);
      cx += cols[k].w * unit;
    });
    y += rh;
    body += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${LINE}"/>`;
  });
  // 分數排名長條
  const top = rowsD.slice(0, 12);
  if (top.length) {
    y += 36;
    body += `<text x="${pad}" y="${y}" font-size="15" font-weight="700" fill="${INK}">${x(tool.scoreLabel)} 排名</text>`;
    y += 14;
    const max = Math.max(...top.map((d) => d.v), 1);
    const lx = pad + 260, bw = W - lx - pad - 80;
    top.forEach((d, k) => {
      const name = d.r[tool.fields[tool.id === 'fmea' ? 1 : 0].key] || '（未命名）';
      body += tspans(wrap(`${k + 1}. ${name}`, 250, 13).slice(0, 1), pad, y + 4, 13, { weight: k < 3 ? 700 : 400 });
      body += `<rect x="${lx}" y="${y + 5}" width="${bw}" height="18" rx="9" fill="#efece5"/><rect x="${lx}" y="${y + 5}" width="${Math.max(4, bw * d.v / max)}" height="18" rx="9" fill="${d.lv ? d.lv.color : cat.color}"/>`;
      body += `<text x="${lx + bw + 10}" y="${y + 19}" font-size="13" font-weight="700" fill="${INK}">${nfmt(d.v)}</text>`;
      y += 28;
    });
  }
  return wrapSvg(W, y + 40, body);
}

/* ---------- 柏拉圖 ---------- */
function figPareto(a, tool) {
  const d = paretoData(a.content.rows);
  const W = 1200, pad = 40;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  let body = hd.svg;
  const cl = pad + 60, cr = W - pad - 60, ct = hd.h + 20, ch = 360, cb = ct + ch;
  if (!d.length || !d.some((x) => x.n > 0)) {
    body += `<text x="${pad}" y="${ct + 30}" font-size="14" fill="#a8a29e">（尚未輸入資料）</text>`;
    return wrapSvg(W, ct + 80, body);
  }
  const max = d[0].n || 1;
  const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const ymax = nice(max);
  for (let k = 0; k <= 5; k++) {
    const yy = cb - (ch * k) / 5;
    body += `<line x1="${cl}" y1="${yy}" x2="${cr}" y2="${yy}" stroke="#ece8df"/>`;
    body += `<text x="${cl - 10}" y="${yy + 4}" font-size="12" fill="${MUTED}" text-anchor="end">${nfmt((ymax * k) / 5)}</text>`;
    body += `<text x="${cr + 10}" y="${yy + 4}" font-size="12" fill="${MUTED}">${k * 20}%</text>`;
  }
  const y80 = cb - ch * 0.8;
  body += `<line x1="${cl}" y1="${y80}" x2="${cr}" y2="${y80}" stroke="#c0563b" stroke-dasharray="6 5" stroke-width="1.5"/><text x="${cr - 4}" y="${y80 - 6}" font-size="12" font-weight="700" fill="#c0563b" text-anchor="end">80%</text>`;
  const bw = (cr - cl) / d.length;
  let vital = 0;
  while (vital < d.length && (vital === 0 || d[vital - 1].cum < 80)) vital++;
  const pts = [];
  d.forEach((it, i) => {
    const bx = cl + i * bw, bh = (ch * it.n) / ymax;
    body += `<rect x="${bx + bw * 0.14}" y="${cb - bh}" width="${bw * 0.72}" height="${bh}" rx="3" fill="${i < vital ? cat.color : '#b9c3cf'}"/>`;
    body += `<text x="${bx + bw / 2}" y="${cb - bh - 6}" font-size="12" font-weight="700" fill="${INK}" text-anchor="middle">${nfmt(it.n)}</text>`;
    body += tspans(wrap(it.name, bw - 6, 12).slice(0, 2), bx + bw / 2, cb + 4, 12, { anchor: 'middle' });
    pts.push([bx + bw / 2, cb - (ch * it.cum) / 100]);
  });
  body += `<line x1="${cl}" y1="${cb}" x2="${cr}" y2="${cb}" stroke="${INK}"/>`;
  body += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#d9822b" stroke-width="2.5"/>`;
  pts.forEach(([px, py], i) => { body += `<circle cx="${px}" cy="${py}" r="4.5" fill="#fff" stroke="#d9822b" stroke-width="2.5"/><text x="${px}" y="${py - 10}" font-size="12" font-weight="700" fill="#b5651d" text-anchor="middle" stroke="#fff" stroke-width="4" paint-order="stroke">${Math.round(d[i].cum)}%</text>`; });
  let y = cb + 52;
  body += `<rect x="${pad}" y="${y}" width="14" height="14" fill="${cat.color}"/><text x="${pad + 20}" y="${y + 12}" font-size="12" fill="${INK}">關鍵少數（優先處理）</text>
    <rect x="${pad + 170}" y="${y}" width="14" height="14" fill="#b9c3cf"/><text x="${pad + 190}" y="${y + 12}" font-size="12" fill="${INK}">其餘項目</text>
    <line x1="${pad + 280}" y1="${y + 7}" x2="${pad + 304}" y2="${y + 7}" stroke="#d9822b" stroke-width="2.5"/><text x="${pad + 310}" y="${y + 12}" font-size="12" fill="${INK}">累積百分比</text>`;
  y += 34;
  const total = d.reduce((s, x2) => s + x2.n, 0);
  const sum = `合計 ${nfmt(total)}；前 ${vital} 項（${d.slice(0, vital).map((v) => v.name).join('、')}）占 ${Math.round(d[vital - 1].cum)}%`;
  body += tspans(wrap(sum, W - pad * 2, 15, 700), pad, y, 15, { weight: 700, fill: cat.color });
  y += 30;
  const cols = [['排名', 70], ['項目', 520], ['數量', 140], ['比例', 140], ['累積', 140]];
  body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="32" fill="#f1eee7"/>`;
  let cx = pad;
  cols.forEach(([t, w]) => { body += `<text x="${cx + 10}" y="${y + 21}" font-size="13" font-weight="700" fill="${INK}">${t}</text>`; cx += w; });
  y += 32;
  d.forEach((it, i) => {
    cx = pad;
    const vals = [String(i + 1), it.name, nfmt(it.n), `${it.pct.toFixed(1)}%`, `${it.cum.toFixed(1)}%`];
    if (i < vital) body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="28" fill="${cat.color}" fill-opacity="0.07"/>`;
    vals.forEach((t, k) => { body += tspans(wrap(t, cols[k][1] - 16, 13).slice(0, 1), cx + 10, y + 5, 13, { weight: i < vital && k < 2 ? 700 : 400 }); cx += cols[k][1]; });
    y += 28;
    body += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${LINE}"/>`;
  });
  return wrapSvg(W, y + 40, body);
}

/* ---------- 決策樹 ---------- */
function figDtree(a, tool) {
  const c = a.content;
  const W = 1200, pad = 40, rowH = 58;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  const tb = topicBox(c.decision, '要做的決定', pad, hd.h, W - pad * 2, cat.color);
  const evs = c.options.map((o) => dtreeEV(o));
  const best = Math.max(...evs.map((e) => e.ev));
  const unit = c.unit || '';
  const top = hd.h + tb.h + 20;
  let body = hd.svg + tb.svg;
  let r = 0;
  const X0 = pad + 30, XE = X0 + 70, X1 = pad + 430, X2 = X1 + 270;
  const optY = [];
  c.options.forEach((o) => {
    const ys = o.outcomes.map(() => top + (r++) * rowH + rowH / 2);
    optY.push({ ys, y: (ys[0] + ys[ys.length - 1]) / 2 });
    r += 0.4;
  });
  const yD = (optY[0].y + optY[optY.length - 1].y) / 2;
  body += `<rect x="${X0 - 18}" y="${yD - 18}" width="36" height="36" rx="4" fill="${cat.color}"/><text x="${X0}" y="${yD + 40}" font-size="12" fill="${MUTED}" text-anchor="middle">決策</text>`;
  c.options.forEach((o, i) => {
    const { ys, y } = optY[i];
    const win = evs[i].ev === best && c.options.length > 1;
    const col = win ? cat.color : '#9ca3af';
    body += `<path d="M${X0 + 18} ${yD} H${XE} V${y} H${X1 - 16}" fill="none" stroke="${col}" stroke-width="${win ? 3 : 2}"/>`;
    const onl = wrap(o.name || '選項', X1 - XE - 200, 15, 700).slice(0, 2);
    body += tspans(onl, XE + 16, y - 26 - (onl.length > 1 ? 21 : 0), 15, { weight: 700, fill: win ? cat.color : INK });
    if (Number(o.cost)) body += `<text x="${XE + 16}" y="${y + 20}" font-size="12" fill="${MUTED}">成本 −${nfmt(Number(o.cost))} ${x(unit)}</text>`;
    body += `<circle cx="${X1}" cy="${y}" r="16" fill="${win ? cat.color : '#fff'}" stroke="${col}" stroke-width="2.5"/>`;
    body += `<rect x="${X1 - 160}" y="${y - 36}" width="128" height="24" rx="12" fill="${win ? cat.color : '#efece5'}"/><text x="${X1 - 96}" y="${y - 19.5}" font-size="12.5" font-weight="700" fill="${win ? '#fff' : INK}" text-anchor="middle">EV ${nfmt(evs[i].ev)}${win ? ' ★' : ''}</text>`;
    o.outcomes.forEach((oc, k) => {
      const yy = ys[k];
      body += `<path d="M${X1 + 16} ${y} L${X1 + 60} ${yy} H${X2}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
      body += `<text x="${X1 + 70}" y="${yy - 7}" font-size="12.5" font-weight="700" fill="${col === '#9ca3af' ? MUTED : cat.color}">${nfmt(Number(oc.p) || 0)}%</text>`;
      body += `<path d="M${X2} ${yy} l14 -9 v18 z" fill="${col}"/>`;
      body += tspans(wrap(`${oc.name || '結果'}`, 250, 14).slice(0, 1), X2 + 22, yy - 17, 14);
      body += `<text x="${W - pad}" y="${yy + 5}" font-size="15" font-weight="700" fill="${INK}" text-anchor="end">${nfmt(Number(oc.v) || 0)} ${x(unit)}</text>`;
    });
    if (Math.abs(evs[i].psum - 100) > 0.01) body += `<text x="${X1 + 70}" y="${ys[ys.length - 1] + 24}" font-size="11.5" fill="#c0563b">⚠ 機率合計 ${nfmt(evs[i].psum)}%</text>`;
  });
  let y = top + r * rowH + 20;
  const bi = evs.findIndex((e) => e.ev === best);
  if (c.options.length > 1) {
    const lines = wrap(`期望值最高：${c.options[bi].name}（${nfmt(best)} ${unit}）。期望值 = Σ 機率 × 價值 − 成本`, W - pad * 2 - 40, 15, 700);
    const h = blockH(lines.length, 15) + 22;
    body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${h}" rx="10" fill="${cat.color}" fill-opacity="0.1" stroke="${cat.color}"/>` + tspans(lines, pad + 20, y + 10, 15, { weight: 700, fill: cat.color });
    y += h;
  }
  return wrapSvg(W, y + 50, body);
}

/* ---------- 因果迴路 ---------- */
function figCausal(a, tool) {
  const c = a.content;
  const W = 1200, pad = 40;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  let body = hd.svg;
  const n = c.vars.length;
  if (!n) return wrapSvg(W, hd.h + 80, body + `<text x="${pad}" y="${hd.h + 30}" font-size="14" fill="#a8a29e">（尚未新增變數）</text>`);
  const R = Math.max(150, Math.min(330, n * 46));
  const cx = W / 2, cy = hd.h + 40 + R + 30;
  const nodes = c.vars.map((v, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const lines = wrap(v.name || '（未命名）', 150, 15, 700);
    const w = Math.ceil(textW(lines, 15, 700)) + 30, h = blockH(lines.length, 15) + 20;
    return { id: v.id, lines, w, h, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const edge = (nd, tx, ty) => {
    const dx = tx - nd.x, dy = ty - nd.y;
    const t = Math.min((nd.w / 2 + 4) / Math.abs(dx || 1e-9), (nd.h / 2 + 4) / Math.abs(dy || 1e-9));
    return [nd.x + dx * t, nd.y + dy * t];
  };
  let edges = '', signs = '';
  c.links.forEach((l) => {
    const A = byId.get(l.from), B = byId.get(l.to);
    if (!A || !B || A === B) return;
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    // 往圓心彎曲；同一對雙向連結會分別彎向兩側
    const nx = -dy / len, ny = dx / len;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const k = Math.min(70, len * 0.22);
    const qx = mx + nx * k, qy = my + ny * k;
    const [sx, sy] = edge(A, qx, qy), [ex, ey] = edge(B, qx, qy);
    const neg = l.sign === '-';
    const col = neg ? '#c0563b' : '#2f7d5b';
    edges += `<path d="M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}" fill="none" stroke="${col}" stroke-width="2.2"/>`;
    const ux = ex - qx, uy = ey - qy, ul = Math.hypot(ux, uy) || 1;
    const ax = ux / ul, ay = uy / ul;
    edges += `<path d="M${ex} ${ey} L${ex - ax * 13 - ay * 6} ${ey - ay * 13 + ax * 6} L${ex - ax * 13 + ay * 6} ${ey - ay * 13 - ax * 6} Z" fill="${col}"/>`;
    const px = 0.25 * sx + 0.5 * qx + 0.25 * ex, py = 0.25 * sy + 0.5 * qy + 0.25 * ey;
    signs += `<circle cx="${px}" cy="${py}" r="11" fill="#fff" stroke="${col}" stroke-width="2"/><text x="${px}" y="${py + 5}" font-size="15" font-weight="700" fill="${col}" text-anchor="middle">${neg ? '−' : '+'}</text>`;
  });
  let nds = '';
  nodes.forEach((nd) => {
    nds += `<rect x="${nd.x - nd.w / 2}" y="${nd.y - nd.h / 2}" width="${nd.w}" height="${nd.h}" rx="${nd.h / 2}" fill="#fff" stroke="${cat.color}" stroke-width="2"/>`;
    nds += tspans(nd.lines, nd.x, nd.y - nd.h / 2 + 8, 15, { anchor: 'middle', weight: 700 });
  });
  const loops = findLoops(c);
  body += edges + nds + signs;
  let y = cy + R + 70;
  body += `<text x="${pad}" y="${y}" font-size="15" font-weight="700" fill="${INK}">迴路（${loops.length}）</text>`;
  body += `<text x="${pad + 120}" y="${y}" font-size="12" fill="${MUTED}">＋ 同向　− 反向　R 增強迴路（越來越強）　B 調節迴路（趨向平衡）</text>`;
  y += 14;
  if (!loops.length) { body += `<text x="${pad}" y="${y + 20}" font-size="13" fill="#a8a29e">尚未形成迴路</text>`; y += 30; }
  loops.forEach((l, i) => {
    const col = l.type === 'R' ? '#2f7d5b' : '#3a7ca5';
    const lines = wrap(`${l.nodes.map((nd) => nd.name).join(' → ')} → ${l.nodes[0].name}`, W - pad * 2 - 150, 14);
    const h = blockH(lines.length, 14) + 14;
    body += `<rect x="${pad}" y="${y + 6}" width="${W - pad * 2}" height="${h}" rx="8" fill="${col}" fill-opacity="0.07"/>`;
    body += `<rect x="${pad + 10}" y="${y + 6 + h / 2 - 12}" width="${l.type === 'R' ? 92 : 92}" height="24" rx="12" fill="${col}"/><text x="${pad + 56}" y="${y + 6 + h / 2 + 4.5}" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle">${l.type}${i + 1} ${l.type === 'R' ? '增強' : '調節'}</text>`;
    body += tspans(lines, pad + 120, y + 13, 14);
    y += h + 6;
  });
  return wrapSvg(W, y + 50, body);
}

/* ---------- OKR ---------- */
function figOkr(a, tool) {
  const c = a.content;
  const W = 1100, pad = 40;
  const hd = header(a, tool, W);
  const cat = categoryOf(tool);
  const pc = (p) => (p >= 0.7 ? '#2f7d5b' : p >= 0.4 ? '#b5892b' : '#c0563b');
  let y = hd.h, body = hd.svg;
  if ((c.period || '').trim()) { body += `<text x="${pad}" y="${y + 6}" font-size="15" font-weight="700" fill="${cat.color}">期間：${x(c.period)}</text>`; y += 26; }
  c.objectives.forEach((o, i) => {
    const op = objProgress(o);
    const ol = wrap(o.o || '（目標未填寫）', W - pad * 2 - 260, 18, 700);
    const krs = o.krs.map((k) => ({ k, p: krProgress(k), lines: wrap(k.t || '（未填寫）', 430, 14) }));
    const headH = blockH(ol.length, 18) + 34;
    const h = headH + krs.reduce((s, k) => s + Math.max(44, blockH(k.lines.length, 14) + 22), 0) + 12;
    body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${h}" rx="14" fill="#fff" stroke="${cat.color}" stroke-opacity="0.4" stroke-width="1.5"/>`;
    body += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${headH}" rx="14" fill="${cat.color}" fill-opacity="0.09"/>`;
    body += `<rect x="${pad + 18}" y="${y + 16}" width="44" height="26" rx="13" fill="${cat.color}"/><text x="${pad + 40}" y="${y + 34}" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">O${i + 1}</text>`;
    body += tspans(ol, pad + 76, y + 14, 18, { weight: 700 });
    const bx = W - pad - 200;
    body += `<rect x="${bx}" y="${y + 20}" width="130" height="14" rx="7" fill="#efece5"/><rect x="${bx}" y="${y + 20}" width="${Math.max(3, 130 * op)}" height="14" rx="7" fill="${pc(op)}"/><text x="${bx + 142}" y="${y + 33}" font-size="18" font-weight="700" fill="${pc(op)}">${Math.round(op * 100)}%</text>`;
    let ky = y + headH + 6;
    krs.forEach(({ k, p, lines }, j) => {
      const rh = Math.max(44, blockH(lines.length, 14) + 22);
      body += `<text x="${pad + 24}" y="${ky + 24}" font-size="12.5" font-weight="700" fill="${cat.color}">KR${j + 1}</text>`;
      body += tspans(lines, pad + 70, ky + 7, 14);
      const nx = pad + 520;
      body += `<text x="${nx}" y="${ky + 24}" font-size="12.5" fill="${MUTED}">${nfmt(Number(k.start) || 0)} → ${nfmt(Number(k.target) || 0)} ${x(k.unit || '')}｜目前 <tspan font-weight="700" fill="${INK}">${nfmt(Number(k.current) || 0)}</tspan></text>`;
      const bx2 = W - pad - 290;
      body += `<rect x="${bx2}" y="${ky + 13}" width="200" height="12" rx="6" fill="#efece5"/><rect x="${bx2}" y="${ky + 13}" width="${Math.max(3, 200 * p)}" height="12" rx="6" fill="${pc(p)}"/><text x="${bx2 + 212}" y="${ky + 24}" font-size="13.5" font-weight="700" fill="${pc(p)}">${Math.round(p * 100)}%</text>`;
      ky += rh;
      if (j < krs.length - 1) body += `<line x1="${pad + 20}" y1="${ky - 2}" x2="${W - pad - 20}" y2="${ky - 2}" stroke="#efece5"/>`;
    });
    y += h + 16;
  });
  body += `<text x="${pad}" y="${y + 6}" font-size="12" fill="${MUTED}">進度顏色：綠色 ≥70%　黃色 40–69%　紅色 &lt;40%（OKR 完成 70% 左右就是好的挑戰）</text>`;
  return wrapSvg(W, y + 50, body);
}

/* ---------- 金字塔（由上而下的樹） ---------- */
function figPyramid(a, tool) {
  const cat = categoryOf(tool);
  const HG = 22, VG = 54;
  const prep = (n, d) => {
    const size = d === 0 ? 18 : d === 1 ? 15 : 13;
    const weight = d <= 1 ? 700 : 400;
    const maxW = d === 0 ? 360 : d === 1 ? 210 : 170;
    const lines = wrap(n.text || '（空白）', maxW, size, weight);
    const p = { n, d, size, weight, lines, children: n.children.map((ch) => prep(ch, d + 1)) };
    p.w = Math.max(d === 0 ? 220 : 120, Math.ceil(textW(lines, size, weight)) + 32);
    p.h = Math.ceil(blockH(lines.length, size)) + 22;
    return p;
  };
  const R = prep(a.content.root, 0);
  const sw = (p) => { p.sw = p.children.length ? Math.max(p.w, p.children.reduce((s, ch) => s + sw(ch), 0) + HG * (p.children.length - 1)) : p.w; return p.sw; };
  sw(R);
  const levelH = [];
  (function walk(p) { levelH[p.d] = Math.max(levelH[p.d] || 0, p.h); p.children.forEach(walk); })(R);
  const levelY = [0];
  for (let i = 1; i < levelH.length; i++) levelY[i] = levelY[i - 1] + levelH[i - 1] + VG;
  const place = (p, left) => {
    p.x = left + p.sw / 2;
    let cx = left + (p.sw - (p.children.reduce((s, ch) => s + ch.sw, 0) + HG * Math.max(0, p.children.length - 1))) / 2;
    p.children.forEach((ch) => { place(ch, cx); cx += ch.sw + HG; });
  };
  place(R, 0);
  const pad = 40;
  const W = Math.max(900, R.sw + pad * 2);
  const hd = header(a, tool, W);
  const ox = (W - R.sw) / 2, oy = hd.h + 10;
  let edges = '', nodes = '';
  (function draw(p) {
    const px = ox + p.x, py = oy + levelY[p.d];
    if (p.children.length) {
      const by = py + p.h, my = by + VG / 2;
      edges += `<path d="M${px} ${by} V${my}" stroke="#9ca3af" stroke-width="1.6" fill="none"/>`;
      const xs = p.children.map((ch) => ox + ch.x);
      if (xs.length > 1) edges += `<path d="M${Math.min(...xs)} ${my} H${Math.max(...xs)}" stroke="#9ca3af" stroke-width="1.6" fill="none"/>`;
      p.children.forEach((ch) => { edges += `<path d="M${ox + ch.x} ${my} V${oy + levelY[ch.d]}" stroke="#9ca3af" stroke-width="1.6" fill="none"/>`; draw(ch); });
    }
    const nx = px - p.w / 2;
    if (p.d === 0) nodes += `<rect x="${nx}" y="${py}" width="${p.w}" height="${p.h}" rx="10" fill="${cat.color}"/>` + tspans(p.lines, px, py + 10, p.size, { anchor: 'middle', weight: 700, fill: '#fff' });
    else if (p.d === 1) nodes += `<rect x="${nx}" y="${py}" width="${p.w}" height="${p.h}" rx="8" fill="${cat.color}" fill-opacity="0.12" stroke="${cat.color}" stroke-width="1.6"/>` + tspans(p.lines, px, py + 10, p.size, { anchor: 'middle', weight: 700 });
    else nodes += `<rect x="${nx}" y="${py}" width="${p.w}" height="${p.h}" rx="6" fill="#fff" stroke="#c9c4ba"/>` + tspans(p.lines, px, py + 10, p.size, { anchor: 'middle' });
  })(R);
  const labels = ['結論', '主要論點', '支撐事實'];
  let lab = '';
  levelH.forEach((h, i) => { if (i < 3) lab += `<text x="${pad - 20}" y="${oy + levelY[i] + h / 2 + 4}" font-size="11" fill="${MUTED}">${labels[i]}</text>`; });
  const totalH = levelY[levelY.length - 1] + levelH[levelH.length - 1];
  return wrapSvg(W, oy + totalH + 60, hd.svg + (R.sw + pad * 2 < W - 60 ? lab : '') + edges + nodes);
}
