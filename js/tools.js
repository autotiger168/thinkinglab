// ThinkingLab — 思考工具定義（說明 + 範本設定）
// 新增工具：在 TOOLS 加一筆，template 指定使用哪一種元件即可
import { PHASE2 } from './tools-phase2.js';
import { PHASE3 } from './tools-phase3.js';
export const CATEGORIES = [
  { id: 'diverge', name: '發散發想', desc: '產生大量點子', color: '#d9822b' },
  { id: 'converge', name: '歸納收斂', desc: '把想法整理成結構', color: '#3a7ca5' },
  { id: 'problem', name: '問題分析與根因', desc: '找到真正的原因', color: '#c0563b' },
  { id: 'strategy', name: '策略與環境分析', desc: '看清局勢與方向', color: '#2f7d5b' },
  { id: 'decision', name: '決策評估', desc: '在選項之間做選擇', color: '#7a5bb0' },
  { id: 'priority', name: '優先順序', desc: '決定先做什麼', color: '#b5892b' },
  { id: 'risk', name: '風險與不確定性', desc: '預先準備未來的變化', color: '#b8475f' },
  { id: 'system', name: '系統思考', desc: '看見因果與結構', color: '#4f6d8f' },
  { id: 'human', name: '以人為本', desc: '從使用者出發', color: '#2e8a8a' },
  { id: 'plan', name: '目標規劃與反思', desc: '設定目標、檢討改進', color: '#6b7a3a' },
];

export const TOOLS = {
  ninegrid: {
    id: 'ninegrid', name: '九宮格', en: 'Mandala Chart', category: 'diverge', template: 'grid9',
    summary: '把主題放在中心，向外延伸 8 個面向，強迫自己想得更完整。',
    when: ['主題發想、企劃起頭', '年度目標拆解（大谷翔平的曼陀羅計畫）', '寫作、簡報找素材'],
    steps: ['在中間格寫下主題或目標', '在周圍 8 格各寫一個相關面向或子目標', '每一格都要填滿，逼自己多想幾個角度', '選出重要的格子，再各自展開成新的九宮格'],
    example: '中心「成為更好的 PM」，周圍：技術深度、溝通、數據分析、客戶理解、時間管理、團隊合作、健康、學習。',
    tips: '想不出第 8 格時，正是突破既有框架的時候，不要輕易放棄。',
    related: ['mindmap', 'mece'],
    cells: ['', '', '', '', '', '', '', '', ''],
  },
  mindmap: {
    id: 'mindmap', name: '心智圖', en: 'Mind Map', category: 'diverge', template: 'tree', layout: 'mind',
    summary: '從中心主題放射狀展開分支，自由聯想、快速整理想法。',
    when: ['腦力激盪、筆記整理', '讀書、課程重點', '專案範圍盤點'],
    steps: ['中心寫主題', '畫出第一層主要分支（建議 3–7 個）', '每個分支繼續往下延伸關鍵字', '找出分支之間的關聯，標記重點'],
    example: '主題「日本旅行」→ 行程、預算、交通、住宿、美食、日文；交通 → JR Pass、地鐵、機場接駁。',
    tips: '每個節點用短關鍵字，不要寫長句。編輯時 Enter 新增同層、Tab 變成子項、Shift+Tab 往上一層。',
    related: ['ninegrid', 'mece'],
  },
  mece: {
    id: 'mece', name: 'MECE 邏輯樹', en: 'MECE Logic Tree', category: 'converge', template: 'tree', layout: 'logic',
    summary: '彼此獨立、完全窮盡（Mutually Exclusive, Collectively Exhaustive）地拆解問題。',
    when: ['拆解複雜議題', '找出問題的所有可能原因', '規劃報告或簡報的架構'],
    steps: ['寫下要拆解的議題', '選一個切分角度（例如：內部/外部、流程步驟、公式拆解）', '檢查同一層：有沒有重疊？有沒有遺漏？', '逐層往下拆，直到可以採取行動'],
    example: '「營收下滑」→ 客戶數 × 客單價；客戶數 → 新客戶、舊客戶留存；客單價 → 單價、購買數量。',
    tips: '最好用的切法是「公式」：營收 = 數量 × 單價，天然就是 MECE。',
    checks: ['同一層的項目彼此不重疊', '同一層的項目合起來沒有遺漏', '同一層使用同一個切分角度'],
    related: ['mindmap', 'sowhat', 'fivewhy'],
  },
  sowhat: {
    id: 'sowhat', name: 'So What / Why So', en: 'So What / Why So', category: 'converge', template: 'qa', flow: true,
    summary: '從事實問「所以呢？」得出洞察，再反問「為什麼這麼說？」檢查推論是否站得住。',
    when: ['資料分析後寫結論', '簡報、報告的論點檢查', '避免只有資料沒有觀點'],
    steps: ['列出觀察到的事實與數據', '問 So What：這代表什麼？對我們有什麼意義？', '問 Why So：這個結論有哪些事實支持？推論合理嗎？', '寫出最終結論與建議行動'],
    example: '事實：手機訂單比例從 30% 升到 55%。So What：主要客群已轉向手機。Why So：手機流量與轉換率同時上升。結論：優先改善手機版結帳流程。',
    tips: 'So What 往上抽象，Why So 往下驗證；兩個方向都要做。',
    sections: [
      { key: 'facts', label: '事實 / 資料', hint: '觀察到什麼？有哪些數據？', color: '#4f6d8f' },
      { key: 'sowhat', label: 'So What？所以呢', hint: '這代表什麼意義？洞察是什麼？', color: '#d9822b' },
      { key: 'whyso', label: 'Why So？為什麼這麼說', hint: '有哪些事實支持這個洞察？推論合理嗎？', color: '#3a7ca5' },
      { key: 'conclusion', label: '結論與行動', hint: '最終的主張與下一步', color: '#2f7d5b' },
    ],
    related: ['mece', 'fivewhy'],
  },
  fivewhy: {
    id: 'fivewhy', name: '5 Why', en: '5 Whys', category: 'problem', template: 'chain',
    summary: '連續追問「為什麼」，從表面現象一路追到根本原因。',
    when: ['異常、客訴、良率問題', '同樣的問題一再發生', '8D、A3 報告的根因分析'],
    steps: ['清楚描述問題（何時、何地、發生什麼）', '問「為什麼會這樣？」並寫下答案', '針對答案再問一次為什麼，通常 5 次左右', '找到可以採取行動、能防止再發的根本原因', '訂出對策'],
    example: '機台停機 → 保險絲燒斷 → 馬達過載 → 軸承潤滑不足 → 油泵吸入口堵塞 → 沒有濾網（根因）→ 對策：加裝濾網並納入保養。',
    tips: '每一層答案都要是事實，不是猜測；根因應該指向「流程或系統」，而不是「某個人不小心」。',
    related: ['5w2h', 'mece'],
  },
  '5w2h': {
    id: '5w2h', name: '5W2H', en: '5W2H', category: 'problem', template: 'qa',
    summary: '用 7 個問題把事情問清楚：What、Why、Who、When、Where、How、How much。',
    when: ['定義問題', '規劃專案或活動', '寫計畫書、交辦工作'],
    steps: ['逐一回答 7 個問題', '回答不出來的地方，就是需要補資料或再確認的地方', '整理成行動計畫'],
    example: 'What：導入新測試流程；Why：縮短測試時間 20%；Who：PE 團隊；When：Q1；Where：竹科廠；How：分三階段上線；How much：預算 50 萬。',
    tips: '用來交辦工作時特別好用：7 項都講清楚，對方就不會做錯。',
    sections: [
      { key: 'what', label: 'What 做什麼', hint: '目標是什麼？要做什麼事？', color: '#3a7ca5' },
      { key: 'why', label: 'Why 為什麼', hint: '為什麼要做？目的與價值？', color: '#c0563b' },
      { key: 'who', label: 'Who 誰', hint: '誰負責？誰參與？對象是誰？', color: '#2f7d5b' },
      { key: 'when', label: 'When 何時', hint: '什麼時候開始、完成？重要時間點？', color: '#d9822b' },
      { key: 'where', label: 'Where 何地', hint: '在哪裡進行？在哪個環節？', color: '#7a5bb0' },
      { key: 'how', label: 'How 如何做', hint: '方法、步驟、流程？', color: '#2e8a8a' },
      { key: 'howmuch', label: 'How much 多少', hint: '成本、資源、數量、目標值？', color: '#b5892b' },
    ],
    related: ['fivewhy', 'eisenhower'],
  },
  swot: {
    id: 'swot', name: 'SWOT 分析', en: 'SWOT Analysis', category: 'strategy', template: 'matrix',
    summary: '從內部的優勢、劣勢，與外部的機會、威脅，盤點目前的處境。',
    when: ['公司、產品、個人的現況分析', '擬定策略前的盤點', '課堂報告、商業分析'],
    steps: ['定義分析對象與範圍', '內部：列出優勢（S）與劣勢（W）', '外部：列出機會（O）與威脅（T）', '用 TOWS 矩陣把四者交叉，產生策略'],
    example: '台積電：S 製程領先、W 海外成本高、O AI 晶片需求、T 地緣政治風險。',
    tips: 'S/W 是自己能控制的；O/T 是外部環境，不能控制。不要把它們混在一起。',
    cols: ['正面（有助於目標）', '負面（有礙於目標）'],
    rows: ['內部因素', '外部因素'],
    quadrants: [
      { key: 'S', title: '優勢 Strengths', hint: '我們擅長什麼？有什麼獨特資源？', color: '#2f7d5b' },
      { key: 'W', title: '劣勢 Weaknesses', hint: '哪裡不足？比競爭者差在哪？', color: '#c0563b' },
      { key: 'O', title: '機會 Opportunities', hint: '外部有哪些趨勢、需求可以把握？', color: '#3a7ca5' },
      { key: 'T', title: '威脅 Threats', hint: '外部有哪些競爭、法規、風險？', color: '#7a5bb0' },
    ],
    related: ['tows', 'uncertainty'],
  },
  tows: {
    id: 'tows', name: 'TOWS 策略矩陣', en: 'TOWS Matrix', category: 'strategy', template: 'matrix', ref: 'swot',
    summary: '把 SWOT 的四個面向兩兩交叉，產生四種具體策略。',
    when: ['完成 SWOT 之後，把分析轉成行動', '策略規劃、商業報告'],
    steps: ['先完成一份 SWOT（可在上方選擇參考）', 'SO：用優勢抓住機會', 'WO：利用機會改善劣勢', 'ST：用優勢對抗威脅', 'WT：減少劣勢、避開威脅'],
    example: 'SO：以先進製程搶 AI 晶片訂單；WT：分散產能布局，降低單一地區風險。',
    tips: '每一條策略都應該能說出「它用了哪個 S/W，回應了哪個 O/T」。',
    cols: ['優勢 S', '劣勢 W'],
    rows: ['機會 O', '威脅 T'],
    quadrants: [
      { key: 'SO', title: 'SO 增長型策略', hint: '用優勢抓住機會', color: '#2f7d5b' },
      { key: 'WO', title: 'WO 扭轉型策略', hint: '利用機會改善劣勢', color: '#3a7ca5' },
      { key: 'ST', title: 'ST 多元型策略', hint: '用優勢對抗威脅', color: '#d9822b' },
      { key: 'WT', title: 'WT 防禦型策略', hint: '減少劣勢、避開威脅', color: '#c0563b' },
    ],
    related: ['swot'],
  },
  decision: {
    id: 'decision', name: '加權決策矩陣', en: 'Weighted Decision Matrix', category: 'decision', template: 'decision',
    summary: '列出選項與評估準則，給準則權重、給選項打分，用總分做出客觀選擇。',
    when: ['多個選項難以取捨（工作、供應商、方案、買車）', '需要向別人說明決策理由'],
    steps: ['列出所有選項', '列出評估準則，並給每個準則權重（1–10）', '每個選項在每個準則上打分（1–5）', '計算加權總分，比較結果', '檢查結果是否符合直覺；不符合時，想想是不是漏了準則'],
    example: '選供應商：準則有品質（權重 10）、價格（7）、交期（6）、技術支援（5）。',
    tips: '權重要在打分「之前」決定，避免為了想要的結果去調權重。',
    related: ['impact', 'eisenhower'],
  },
  eisenhower: {
    id: 'eisenhower', name: '重要-緊急矩陣', en: 'Eisenhower Matrix', category: 'priority', template: 'matrix',
    summary: '依「重要」與「緊急」把事情分成四類，決定立即做、排程做、交辦或刪除。',
    when: ['待辦事項太多', '每週工作規劃', '覺得一直在救火'],
    steps: ['列出所有待辦事項', '判斷每件事是否重要（對目標有幫助）', '判斷是否緊急（有時間壓力）', '放入四個象限，依象限決定處理方式'],
    example: '重要且緊急：客戶異常處理；重要不緊急：學習新技術、健康；緊急不重要：部分會議；都不是：滑社群。',
    tips: '真正拉開差距的是「重要但不緊急」，要主動排進行事曆。可以拖曳項目到其他象限。',
    cols: ['緊急', '不緊急'],
    rows: ['重要', '不重要'],
    quadrants: [
      { key: 'do', title: '立即做', hint: '重要且緊急：危機、截止日', color: '#c0563b' },
      { key: 'plan', title: '排程做', hint: '重要不緊急：成長、規劃、健康', color: '#2f7d5b' },
      { key: 'delegate', title: '交辦', hint: '緊急不重要：打斷、部分會議', color: '#d9822b' },
      { key: 'drop', title: '刪除', hint: '不緊急也不重要：時間殺手', color: '#7d8590' },
    ],
    related: ['impact', '5w2h'],
  },
  impact: {
    id: 'impact', name: '影響力-投入矩陣', en: 'Impact-Effort Matrix', category: 'priority', template: 'matrix',
    summary: '比較每個方案的效益與投入，先做「速贏」，審慎評估「重大專案」。',
    when: ['改善方案很多，資源有限', '產品功能排序', '專案 backlog 整理'],
    steps: ['列出所有方案或點子', '評估每個方案的影響力（效益）', '評估需要的投入（時間、人力、成本）', '放入四個象限，決定執行順序'],
    example: '速贏：調整報表格式；重大專案：導入新系統；填空：整理文件；吃力不討好：重寫舊工具。',
    tips: '團隊一起評估時，先各自打分再討論，可以避免從眾。',
    cols: ['低投入', '高投入'],
    rows: ['高影響', '低影響'],
    quadrants: [
      { key: 'quick', title: '速贏 Quick Wins', hint: '高影響、低投入：優先做', color: '#2f7d5b' },
      { key: 'major', title: '重大專案', hint: '高影響、高投入：審慎規劃', color: '#3a7ca5' },
      { key: 'fill', title: '填空小事', hint: '低影響、低投入：有空再做', color: '#b5892b' },
      { key: 'thankless', title: '吃力不討好', hint: '低影響、高投入：避免', color: '#c0563b' },
    ],
    related: ['eisenhower', 'decision'],
  },
  risk: {
    id: 'risk', name: '風險管理矩陣', en: 'Risk Matrix', category: 'risk', template: 'risk',
    summary: '列出風險，以「發生機率 × 影響程度」評分，排出優先順序並訂定對策。',
    when: ['專案啟動、新產品導入', '製程或供應鏈變更', '任何需要提前準備的計畫'],
    steps: ['列出可能發生的風險', '評估發生機率（1–5）與影響程度（1–5）', '分數 = 機率 × 影響，決定風險等級', '選擇因應策略：規避、降低、轉移、接受', '訂出具體對策與負責人，定期追蹤'],
    example: '關鍵原料單一供應商（機率 3 × 影響 5 = 15，高）→ 策略：降低 → 對策：開發第二供應商。',
    tips: '分數 1–4 低、5–9 中、10–16 高、17 以上極高。高風險以上一定要有對策和負責人。',
    related: ['uncertainty', 'swot'],
  },
  uncertainty: {
    id: 'uncertainty', name: '不確定性-影響矩陣', en: 'Uncertainty-Impact Matrix', category: 'risk', template: 'matrix',
    summary: '把未來的各種因素依「影響程度」與「不確定性」分類，找出需要情境規劃的關鍵因素。',
    when: ['長期策略規劃', '情境規劃的第一步', '評估外部趨勢'],
    steps: ['列出可能影響未來的外部因素', '評估每個因素的影響程度', '評估它的不確定性（會不會發生、往哪個方向發展）', '高影響、高不確定的因素，就是情境規劃的主軸'],
    example: '高影響低不確定：AI 運算需求持續成長；高影響高不確定：國際關稅政策走向。',
    tips: '挑出 2 個最關鍵的不確定因素當作兩條軸，就能畫出 4 種未來情境。',
    cols: ['低不確定性', '高不確定性'],
    rows: ['高影響', '低影響'],
    quadrants: [
      { key: 'trend', title: '關鍵趨勢', hint: '高影響、可預期：納入計畫', color: '#3a7ca5' },
      { key: 'critical', title: '關鍵不確定性', hint: '高影響、難預測：情境規劃', color: '#c0563b' },
      { key: 'minor', title: '次要因素', hint: '低影響、可預期：留意即可', color: '#7d8590' },
      { key: 'watch', title: '觀察因素', hint: '低影響、難預測：定期檢視', color: '#b5892b' },
    ],
    related: ['risk', 'swot'],
  },
};

Object.assign(TOOLS, PHASE2, PHASE3);

// 即將推出的工具（工具庫中顯示為預告）
// 全部工具都已上線；之後要預告新工具時，在這裡加 [分類, 名稱, 說明]
export const COMING = [];

export function categoryOf(tool) {
  return CATEGORIES.find((c) => c.id === tool.category);
}

let nodeSeq = 0;
export const nid = () => 'n' + Date.now().toString(36) + (nodeSeq++).toString(36);

// 各工具的預設內容
export function defaultContent(tool) {
  switch (tool.template) {
    case 'grid9': return { cells: Array(9).fill('') };
    case 'tree': return { root: { id: nid(), text: { mind: '中心主題', pyramid: '核心結論（一句話）' }[tool.layout] || '要拆解的議題', children: [] } };
    case 'matrix': return tool.editableAxes
      ? { quadrants: [[], [], [], []], refId: null, axes: { cols: [...tool.cols], rows: [...tool.rows] }, titles: tool.quadrants.map((q) => q.title) }
      : { quadrants: [[], [], [], []], refId: null };
    case 'groups': return { topic: '', groups: tool.groups.map((name) => ({ id: nid(), name, items: [] })) };
    case 'table': {
      const t = tool.table;
      const rows = [...(t.rows || t.defRows)], cols = [...(t.cols || t.defCols)];
      return { topic: '', rows, cols, cells: rows.map(() => cols.map(() => '')), sel: rows.map(() => -1), emo: cols.map(() => 0) };
    }
    case 'rows': return { rows: [] };
    case 'dtree': return {
      decision: '', unit: '萬元',
      options: [
        { id: nid(), name: '選項 A', cost: 0, outcomes: [{ id: nid(), name: '好的結果', p: 50, v: 0 }, { id: nid(), name: '不好的結果', p: 50, v: 0 }] },
        { id: nid(), name: '選項 B', cost: 0, outcomes: [{ id: nid(), name: '結果', p: 100, v: 0 }] },
      ],
    };
    case 'causal': return { vars: [], links: [] };
    case 'okr': return { period: '', objectives: [{ id: nid(), o: '', krs: [{ id: nid(), t: '', start: 0, target: 100, current: 0, unit: '' }] }] };
    case 'qa': return { sections: Object.fromEntries(tool.sections.map((s) => [s.key, ''])) };
    case 'chain': return { problem: '', whys: Array.from({ length: 5 }, () => ({ q: '', a: '' })), root: '', action: '' };
    case 'risk': return { risks: [] };
    case 'fishbone': return { problem: '', cats: tool.cats.map((name) => ({ id: nid(), name, causes: [] })) };
    case 'canvas': return { blocks: Object.fromEntries(tool.blocks.map((b) => [b.key, []])) };
    case 'decision': {
      const o1 = nid(), o2 = nid(), c1 = nid(), c2 = nid();
      return {
        options: [{ id: o1, name: '選項 A' }, { id: o2, name: '選項 B' }],
        criteria: [{ id: c1, name: '準則 1', weight: 5 }, { id: c2, name: '準則 2', weight: 5 }],
        scores: {},
      };
    }
    default: return {};
  }
}

export const RISK_STRATEGIES = ['規避', '降低', '轉移', '接受'];
export const RISK_STATUS = ['開放', '處理中', '已關閉'];

export function riskLevel(score) {
  if (score >= 17) return { label: '極高', color: '#8e1b2e' };
  if (score >= 10) return { label: '高', color: '#c0563b' };
  if (score >= 5) return { label: '中', color: '#d9a12b' };
  return { label: '低', color: '#2f7d5b' };
}

export function decisionTotals(c) {
  const maxTotal = c.criteria.reduce((s, cr) => s + (Number(cr.weight) || 0) * 5, 0) || 1;
  return c.options.map((o) => {
    const total = c.criteria.reduce((s, cr) => s + (Number(cr.weight) || 0) * (Number((c.scores[cr.id] || {})[o.id]) || 0), 0);
    return { id: o.id, name: o.name, total, pct: Math.round((total / maxTotal) * 100) };
  });
}

// 搜尋用：把內容中所有文字攤平
export function contentText(c) {
  const out = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'id') walk(x); });
  })(c);
  return out.join(' ');
}

/* ---------- Phase 3 計算工具 ---------- */
export function newRow(tool) {
  const r = { id: nid() };
  tool.fields.forEach((f) => { r[f.key] = f.def ?? ''; });
  return r;
}

export function rowScores(tool, rows) {
  return rows.map((r) => {
    const v = tool.score(r);
    const lv = tool.level ? tool.level(v, r) : null;
    return { r, v, lv };
  });
}

export function paretoData(rows) {
  const items = rows.map((r) => ({ name: r.item || '（未命名）', n: Math.max(0, Number(r.n) || 0) })).sort((a, b) => b.n - a.n);
  const total = items.reduce((s, x) => s + x.n, 0) || 1;
  let cum = 0;
  return items.map((x) => { cum += x.n; return { ...x, pct: (x.n / total) * 100, cum: (cum / total) * 100 }; });
}

export function dtreeEV(o) {
  const ev = o.outcomes.reduce((s, x) => s + (Number(x.p) || 0) / 100 * (Number(x.v) || 0), 0) - (Number(o.cost) || 0);
  const psum = o.outcomes.reduce((s, x) => s + (Number(x.p) || 0), 0);
  return { ev: Math.round(ev * 100) / 100, psum };
}

export function krProgress(kr) {
  const s = Number(kr.start) || 0, t = Number(kr.target) || 0, c = Number(kr.current) || 0;
  if (t === s) return c >= t ? 1 : 0;
  return Math.max(0, Math.min(1, (c - s) / (t - s)));
}
export function objProgress(o) {
  if (!o.krs.length) return 0;
  return o.krs.reduce((s, k) => s + krProgress(k), 0) / o.krs.length;
}

// 因果迴路：找出所有簡單迴路（小型圖），負號偶數 = 增強 R，奇數 = 調節 B
export function findLoops(c, max = 30) {
  const ids = c.vars.map((v) => v.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const adj = ids.map(() => []);
  c.links.forEach((l) => { if (idx.has(l.from) && idx.has(l.to) && l.from !== l.to) adj[idx.get(l.from)].push({ to: idx.get(l.to), sign: l.sign }); });
  const loops = [];
  const seen = new Set();
  for (let s = 0; s < ids.length && loops.length < max; s++) {
    const stack = [[s, [s], []]];
    while (stack.length && loops.length < max) {
      const [v, path, signs] = stack.pop();
      for (const e of adj[v]) {
        if (e.to === s) {
          const key = path.join('>');
          if (!seen.has(key)) {
            seen.add(key);
            const neg = [...signs, e.sign].filter((x) => x === '-').length;
            loops.push({ nodes: path.map((i) => c.vars[i]), type: neg % 2 === 0 ? 'R' : 'B' });
          }
        } else if (e.to > s && !path.includes(e.to) && path.length < 10) {
          stack.push([e.to, [...path, e.to], [...signs, e.sign]]);
        }
      }
    }
  }
  return loops;
}
