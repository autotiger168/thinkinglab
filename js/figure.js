// ThinkingLab — 把每份分析畫成 SVG 思考圖（預覽、PNG/JPG/SVG、PDF 共用）
import { TOOLS, categoryOf, riskLevel, decisionTotals } from './tools.js';
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
  const fn = { grid9: figGrid9, tree: figTree, matrix: figMatrix, qa: figQA, chain: figChain, risk: figRisk, decision: figDecision }[tool.template];
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
  tool.cols.forEach((t, i) => {
    const cx = gx + i * (qw + gap) + qw / 2;
    body += `<text x="${cx}" y="${top - 12}" font-size="15" font-weight="700" fill="${MUTED}" text-anchor="middle">${x(t)}</text>`;
  });
  [r1, r2].forEach((rh, r) => {
    const cy = top + (r ? r1 + gap : 0) + rh / 2;
    body += `<text transform="translate(${pad + 18} ${cy}) rotate(-90)" font-size="15" font-weight="700" fill="${MUTED}" text-anchor="middle">${x(tool.rows[r])}</text>`;
  });
  qs.forEach((Q, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const qx = gx + col * (qw + gap), qy = top + (row ? r1 + gap : 0), qh = row ? r2 : r1;
    const c = Q.q.color;
    body += `<rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="12" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-opacity="0.55" stroke-width="1.5"/>
      <rect x="${qx}" y="${qy}" width="${qw}" height="46" rx="12" fill="${c}"/><rect x="${qx}" y="${qy + 30}" width="${qw}" height="16" fill="${c}"/>
      <text x="${qx + 20}" y="${qy + 30}" font-size="18" font-weight="700" fill="#fff">${x(Q.q.title)}</text>`;
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
