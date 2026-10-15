# ThinkingLab 思考實驗室

個人思考工具資料庫。直接在網頁上用各種思考框架做分析，資料以主密碼加密，可透過 GitHub 私人 repo 在電腦與手機之間同步，並可匯出 PNG / JPG / SVG / PDF / Markdown。

## 功能（v3.0）

- **59 個思考工具**，分 10 大類：
  - 發散發想：九宮格、心智圖、六頂思考帽、SCAMPER、腦力激盪、形態分析法、逆向腦力激盪
  - 歸納收斂：MECE 邏輯樹、So What / Why So、金字塔原理、KJ 法、假說思考、第一性原理
  - 問題分析：5 Why、5W2H、魚骨圖、8D 報告、A3 報告、柏拉圖分析、IS / IS NOT
  - 策略分析：SWOT、TOWS、商業模式畫布、PESTEL、波特五力、3C、BCG、安索夫、藍海 ERRC、價值鏈、價值主張畫布
  - 決策評估：加權決策矩陣、事前驗屍、力場分析、決策樹與期望值、10/10/10 法則
  - 優先順序：重要-緊急、影響力-投入、MoSCoW、RICE 評分、Kano 模型
  - 風險：風險管理矩陣、不確定性-影響矩陣、FMEA、情境規劃
  - 系統思考：PDCA、OODA、冰山模型、利害關係人地圖、因果迴路圖
  - 以人為本：同理心地圖、設計思考、顧客旅程地圖、JTBD
  - 目標與反思：SMART、GROW、KPT、OKR、AAR
- **自動計算**：決策矩陣總分、風險分數、FMEA 的 RPN、RICE 分數、柏拉圖累積百分比、決策樹期望值、OKR 進度、因果迴路自動偵測（增強 R／調節 B）
- **關聯分析**：分析之間可以互相連結，或從一份分析「延伸」出下一個工具（例如 SWOT → TOWS），會顯示反向連結
- **統計頁**：分析數、用過的工具、近 12 週活動、各類別分布、標籤雲、還沒試過的工具
- **主密碼加密**：PBKDF2-SHA256（60 萬次）＋ AES-256-GCM，密碼本身不儲存
- **自動上鎖**、輸錯密碼延遲重試、變更主密碼
- **雲端同步**：GitHub 私人 repo，上傳前即已加密；支援離線編輯、衝突自動保留副本
- **備份**：加密 `.json` 備份與還原（合併或覆蓋）、7 天未備份提醒
- **匯出**：單份分析 PNG / JPG / SVG / PDF（A4 直式、橫式）/ Markdown；全部或選取的分析合併成一本 PDF（含封面、目錄）
- 搜尋、標籤、封存、垃圾桶（30 天）、深色模式、手機版、可加入主畫面

## 一、部署到 GitHub Pages

1. 在 GitHub 建立 repo `thinkinglab`（GitHub Education 帳號附帶 GitHub Pro，可以設為 Private）。
2. 把這個資料夾的所有檔案上傳到 repo 根目錄（包含 `.nojekyll`）。
3. repo → **Settings → Pages** → Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)` → Save。
4. 約 1 分鐘後，網址為 `https://<你的帳號>.github.io/thinkinglab/`。

> 即使 repo 是私人的，Pages 網址本身仍是公開的；沒有主密碼的人只會看到登入畫面，看不到任何資料。

## 二、建立資料 repo 與 Token（多裝置同步）

1. 建立一個 **Private** repo：`thinkinglab-data`（空的即可）。
2. GitHub → 右上頭像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Expiration：建議 1 年（到期前網站會提醒）
   - Repository access：**Only select repositories** → 只選 `thinkinglab-data`
   - Permissions → Repository permissions → **Contents：Read and write**（Metadata 會自動設為 Read-only）
3. 複製產生的 Token（`github_pat_` 開頭）。

## 三、第一次使用

**第一台裝置**
1. 開啟網站 → 「建立新的思考資料庫」→ 設定主密碼。
2. 「設定」→ 雲端同步 → 輸入 GitHub 帳號、`thinkinglab-data`、Token → 測試並連線。

**其他電腦、手機**
1. 開啟網站 → 「連線雲端既有資料」→ 輸入同一組 repo、Token、主密碼。
2. 手機可用瀏覽器的「加入主畫面」，像 App 一樣開啟。

## 四、安全說明

- 主密碼**忘記就無法救回**，請存放在密碼管理器，並定期下載加密備份。
- Token 以主密碼加密後存放在各裝置；資料 repo 中只有加密檔：
  ```
  thinkinglab-data/
  ├─ meta.json            salt 與密碼驗證資料（不含密碼）
  └─ analyses/<id>.json   每份分析一個加密檔
  ```
- 每次儲存都是一次 git commit，可在 GitHub 查看歷史版本。
- 網頁有 Content-Security-Policy，只允許連線到 `api.github.com`。

## 五、本機測試

瀏覽器加密功能需要 HTTPS 或 localhost：

```bash
cd thinkinglab
python -m http.server 8000
# 開啟 http://localhost:8000
```

## 六、檔案結構

```
thinkinglab/
├─ index.html
├─ css/style.css
├─ js/
│  ├─ app.js       頁面、路由、登入流程
│  ├─ store.js     資料層、同步、備份
│  ├─ crypto.js    加密
│  ├─ db.js        IndexedDB
│  ├─ github.js    GitHub API
│  ├─ tools.js     工具定義與說明（新增工具從這裡開始）
│  ├─ tools-phase2.js  Phase 2 的 23 個工具
│  ├─ tools-phase3.js  Phase 3 的 23 個工具
│  ├─ editors.js   15 種編輯元件
│  ├─ figure.js    思考圖 SVG 產生
│  ├─ export.js    圖片、PDF、Markdown 匯出
│  └─ ui.js        共用介面
├─ sw.js           離線快取
├─ manifest.webmanifest
└─ icon.svg
```

## 更新程式後

修改程式並推送後，若手機仍顯示舊版，重新整理一次即可（離線快取採網路優先）。
