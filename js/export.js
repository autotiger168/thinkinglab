// ThinkingLab — 匯出：PNG / JPG / SVG / PDF（列印）/ Markdown
import { renderFigure } from './figure.js';
import { TOOLS, categoryOf, riskLevel, decisionTotals } from './tools.js';
import { esc, download, safeName, fmtDate, stamp } from './ui.js';

export const fileBase = (a) => `${safeName(a.title)}_${TOOLS[a.toolId].name.replace(/\s+/g, '')}`;

export async function exportImage(a, type) {
  const fig = renderFigure(a);
  if (type === 'svg') {
    download(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${fig.svg}`], { type: 'image/svg+xml' }), `${fileBase(a)}.svg`);
    return;
  }
  const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await svgToBlob(fig, mime);
  download(blob, `${fileBase(a)}.${type}`);
}

export async function svgToBlob(fig, mime = 'image/png') {
  const url = URL.createObjectURL(new Blob([fig.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('圖片轉換失敗')); img.src = url; });
    const scale = Math.min(3, 8000 / Math.max(fig.width, fig.height));
    const c = document.createElement('canvas');
    c.width = Math.round(fig.width * scale);
    c.height = Math.round(fig.height * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, mime, 0.93));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- PDF：使用瀏覽器「列印 → 另存為 PDF」，中文清晰、可搜尋 ---------- */
function notesHtml(a) {
  return a.notes && a.notes.trim() ? `<div class="pp-notes"><h4>備註</h4><p>${esc(a.notes).replace(/\n/g, '<br>')}</p></div>` : '';
}
function pageHtml(a) {
  const tool = TOOLS[a.toolId];
  const cat = categoryOf(tool);
  const fig = renderFigure(a);
  return `<section class="pp-page" id="pp-${a.id}">
    <div class="pp-head" style="--cc:${cat.color}"><span>${esc(cat.name)} · ${esc(tool.name)}</span><span>${fmtDate(a.updatedAt)}</span></div>
    <div class="pp-fig">${fig.svg}</div>
    ${notesHtml(a)}
  </section>`;
}

export function printPDF(list, { orientation = 'portrait', cover = false, title = '' } = {}) {
  const root = document.getElementById('print-root');
  const style = document.getElementById('print-page-style');
  style.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`;
  root.dataset.orient = orientation;
  let html = '';
  if (cover) {
    const byTool = {};
    list.forEach((a) => { byTool[a.toolId] = (byTool[a.toolId] || 0) + 1; });
    html += `<section class="pp-page pp-cover">
      <div class="pp-logo">Thinking<b>Lab</b></div>
      <h1>${esc(title || '思考分析彙編')}</h1>
      <p class="pp-sub">共 ${list.length} 份分析 · 匯出於 ${fmtDate(Date.now())}</p>
      <div class="pp-tools">${Object.entries(byTool).map(([t, n]) => `<span>${esc(TOOLS[t].name)} × ${n}</span>`).join('')}</div>
    </section>
    <section class="pp-page pp-toc"><h2>目錄</h2><ol>${list.map((a) => `
      <li><a href="#pp-${a.id}"><span class="t">${esc(a.title || '未命名')}</span><span class="m">${esc(TOOLS[a.toolId].name)} · ${fmtDate(a.updatedAt, false)}</span></a></li>`).join('')}</ol></section>`;
  }
  html += list.map(pageHtml).join('');
  root.innerHTML = html;
  const oldTitle = document.title;
  document.title = list.length === 1 && !cover ? fileBase(list[0]) : `ThinkingLab_${safeName(title || '彙編')}_${stamp()}`;
  const cleanup = () => {
    document.title = oldTitle;
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 80);
}

/* ---------- Markdown ---------- */
export function toMarkdown(a) {
  const tool = TOOLS[a.toolId];
  const c = a.content;
  let md = `# ${a.title || '未命名'}\n\n> ${tool.name}（${tool.en}）· 更新於 ${fmtDate(a.updatedAt)}${a.tags && a.tags.length ? ' · ' + a.tags.map((t) => '#' + t).join(' ') : ''}\n\n`;
  switch (tool.template) {
    case 'grid9':
      md += `**中心主題：${c.cells[4] || '—'}**\n\n`;
      c.cells.forEach((t, i) => { if (i !== 4) md += `- ${t || '—'}\n`; });
      break;
    case 'tree':
      (function walk(n, d) {
        md += d === 0 ? `**${n.text}**\n\n` : `${'  '.repeat(d - 1)}- ${n.text}\n`;
        n.children.forEach((ch) => walk(ch, d + 1));
      })(c.root, 0);
      break;
    case 'matrix':
      tool.quadrants.forEach((q, i) => {
        md += `## ${q.title}\n\n${(c.quadrants[i] || []).map((t) => `- ${t}`).join('\n') || '（無）'}\n\n`;
      });
      break;
    case 'qa':
      tool.sections.forEach((s) => { md += `## ${s.label}\n\n${c.sections[s.key] || '（未填寫）'}\n\n`; });
      break;
    case 'chain':
      md += `## 問題現象\n\n${c.problem || '—'}\n\n`;
      c.whys.forEach((w, i) => { if (w.q || w.a) md += `**Why ${i + 1}：${w.q || ''}**\n\n${w.a || '—'}\n\n`; });
      md += `## 根本原因\n\n${c.root || '—'}\n\n## 對策\n\n${c.action || '—'}\n`;
      break;
    case 'risk':
      md += `| # | 風險 | 類別 | 機率 | 影響 | 分數 | 等級 | 策略 | 對策 | 負責人 | 狀態 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
      c.risks.forEach((r, i) => {
        const s = r.p * r.i;
        const cell = (v) => String(v || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        md += `| R${i + 1} | ${cell(r.desc)} | ${cell(r.cat)} | ${r.p} | ${r.i} | ${s} | ${riskLevel(s).label} | ${r.strategy} | ${cell(r.response)} | ${cell(r.owner)} | ${r.status} |\n`;
      });
      break;
    case 'decision': {
      const t = decisionTotals(c);
      md += `| 準則 | 權重 | ${c.options.map((o) => o.name).join(' | ')} |\n|---|---|${c.options.map(() => '---').join('|')}|\n`;
      c.criteria.forEach((cr) => { md += `| ${cr.name} | ${cr.weight} | ${c.options.map((o) => (c.scores[cr.id] || {})[o.id] ?? '–').join(' | ')} |\n`; });
      md += `| **加權總分** | | ${t.map((x) => `**${x.total}**（${x.pct}%）`).join(' | ')} |\n`;
      break;
    }
  }
  if (a.notes && a.notes.trim()) md += `\n## 備註\n\n${a.notes}\n`;
  return md;
}

export function exportMarkdown(list, name) {
  const md = list.map(toMarkdown).join('\n\n---\n\n');
  const fname = list.length === 1 ? `${fileBase(list[0])}.md` : `ThinkingLab_${name || '全部'}_${stamp()}.md`;
  download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), fname);
}
