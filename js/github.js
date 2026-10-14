// ThinkingLab — GitHub 私人 repo 存取（Contents API）
// 只會上傳「已加密」的內容
export class GitHub {
  constructor({ owner, repo, token }) {
    this.owner = owner.trim();
    this.repo = repo.trim();
    this.token = token.trim();
    this.tokenExp = null;
  }

  async req(method, path, body) {
    const url = `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}`;
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(url, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error('無法連線到 GitHub（請檢查網路）');
      err.offline = true;
      throw err;
    }
    const exp = r.headers.get('github-authentication-token-expiration');
    if (exp) this.tokenExp = exp;
    if (r.status === 404) return null;
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).message || ''; } catch (_) {}
      let human = `GitHub 錯誤 ${r.status}：${msg}`;
      if (r.status === 401) human = 'Token 無效或已過期，請到「設定」更新 Token';
      if (r.status === 403) human = `沒有權限（請確認 Token 已開放此 repo 的 Contents 讀寫）：${msg}`;
      const err = new Error(human);
      err.status = r.status;
      throw err;
    }
    if (r.status === 204) return {};
    return r.json();
  }

  repoInfo() { return this.req('GET', ''); }

  async list(dir) {
    const r = await this.req('GET', `/contents/${dir}`);
    return Array.isArray(r) ? r.filter((f) => f.type === 'file') : [];
  }

  async getFile(path) {
    const r = await this.req('GET', `/contents/${path}`);
    if (!r) return null;
    let b64 = r.content;
    if (!b64 && r.sha) {
      // 超過 1MB 的檔案改用 blob API
      const blob = await this.req('GET', `/git/blobs/${r.sha}`);
      b64 = blob && blob.content;
    }
    const text = atob((b64 || '').replace(/\s/g, ''));
    return { text, sha: r.sha };
  }

  async put(path, text, sha, message) {
    const body = { message: message || `ThinkingLab: 更新 ${path}`, content: btoa(text) };
    if (sha) body.sha = sha;
    const r = await this.req('PUT', `/contents/${path}`, body);
    return r && r.content ? r.content.sha : null;
  }

  del(path, sha, message) {
    return this.req('DELETE', `/contents/${path}`, { message: message || `ThinkingLab: 刪除 ${path}`, sha });
  }
}
