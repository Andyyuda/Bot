/**
 * Helper Telegram untuk interaksi login bot via Telegram
 * Mendukung: kirim pesan teks, kirim foto (QR), tunggu balasan user
 */

const fs = require('fs');
const path = require('path');

let config = null;
try {
  const raw = fs.readFileSync(path.join(__dirname, '../.telegram.json'), 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed.token && parsed.chatId) config = parsed;
} catch (e) {}

const BASE = config ? `https://api.telegram.org/bot${config.token}` : null;
let lastUpdateId = 0;

async function apiPost(method, body) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

/**
 * Kirim pesan teks ke chat owner
 */
async function sendMessage(text) {
  return apiPost('sendMessage', {
    chat_id: config.chatId,
    text,
    parse_mode: 'HTML'
  });
}

/**
 * Kirim gambar (Buffer PNG) ke chat owner
 */
async function sendPhoto(imageBuffer, caption = '') {
  if (!BASE) return null;
  const form = new FormData();
  form.append('chat_id', config.chatId.toString());
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'qr.png');
  const res = await fetch(`${BASE}/sendPhoto`, { method: 'POST', body: form });
  return res.json();
}

/**
 * Tunggu balasan teks dari owner via long polling
 * @param {number} timeoutMs - batas waktu tunggu (ms)
 * @returns {string|null} teks balasan atau null jika timeout
 */
async function waitReply(timeoutMs = 120000) {
  if (!BASE) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sisa = Math.min(30, Math.ceil((deadline - Date.now()) / 1000));
    if (sisa <= 0) break;
    try {
      const res = await fetch(
        `${BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=${sisa}&allowed_updates=message`
      );
      const data = await res.json();
      for (const update of data.result || []) {
        lastUpdateId = update.update_id;
        if (String(update.message?.chat?.id) === String(config.chatId)) {
          return update.message.text?.trim() || null;
        }
      }
    } catch (e) {}
  }
  return null;
}

module.exports = {
  isConfigured: !!BASE,
  sendMessage,
  sendPhoto,
  waitReply
};
