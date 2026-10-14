// ThinkingLab — 加密模組
// 主密碼 + 隨機 salt → PBKDF2-SHA256 → AES-256-GCM 金鑰（只存在記憶體）
const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITERATIONS = 600000;
const VERIFY_TEXT = 'ThinkingLab:verify:v1';

export function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(password, saltB64, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON(key, { iv, ct }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}

// 建立新的保險庫中繼資料（不含密碼，只含 salt 與驗證密文）
export async function makeMeta(password) {
  const salt = b64(randomBytes(16));
  const key = await deriveKey(password, salt, ITERATIONS);
  const verifier = await encryptJSON(key, { check: VERIFY_TEXT });
  return {
    meta: { app: 'ThinkingLab', v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt, verifier, createdAt: Date.now() },
    key,
  };
}

// 用密碼嘗試解鎖：成功回傳金鑰，失敗回傳 null
export async function unlockMeta(password, meta) {
  if (!meta || !meta.salt || !meta.verifier) return null;
  const key = await deriveKey(password, meta.salt, meta.iterations || ITERATIONS);
  try {
    const r = await decryptJSON(key, meta.verifier);
    if (r && r.check === VERIFY_TEXT) return key;
  } catch (_) { /* 密碼錯誤 */ }
  return null;
}

export function passwordStrength(pw) {
  let score = 0;
  if (!pw) return { score: 0, label: '' };
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 16) score++;
  const labels = ['太弱', '太弱', '弱', '普通', '良好', '強', '很強'];
  return { score: Math.min(score, 6), label: labels[Math.min(score, 6)] };
}
