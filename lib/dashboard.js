/**
 * lib/dashboard.js — BotWA Dashboard Integration
 *
 * Taruh file ini di folder lib/ bot kamu (Andyyuda/Bot/lib/dashboard.js)
 *
 * Env vars yang dibutuhkan di proses BOT:
 *   DASHBOARD_URL    = https://your-dashboard.replit.app  (URL dashboard, tanpa trailing slash)
 *   DASHBOARD_SECRET = (sama dengan DASHBOARD_SECRET di server dashboard)
 *
 * Cara pakai di main.js bot:
 *   const dashboard = require('./lib/dashboard');
 *
 *   // Di awal start(), ambil perintah pending dari dashboard:
 *   const cmd = await dashboard.getPendingCommand();
 *   if (cmd?.method === 'pairing') { modeLogin = 'pairing'; nomorTarget = cmd.phoneNumber; }
 *   else if (cmd?.method === 'qr') { modeLogin = 'qr'; }
 *
 *   // Di connection.update, saat qr event:
 *   if (qr && modeLogin === 'qr')      await dashboard.pushQr(qr);
 *   if (qr && modeLogin === 'pairing') {
 *     const code = await sock.requestPairingCode(nomorTarget);
 *     await dashboard.pushPairingCode(code.match(/.{1,4}/g).join('-'), nomorTarget);
 *   }
 *
 *   // Saat connected:
 *   if (connection === 'open') await dashboard.pushStatus('connected', sock.user?.id);
 *
 *   // Saat disconnected:
 *   if (connection === 'close') await dashboard.pushStatus('disconnected');
 *
 *   // Kirim log ke dashboard:
 *   await dashboard.pushLog('info', 'Pesan berhasil dikirim ke ' + remoteJid);
 */

'use strict';

const DASHBOARD_URL = (process.env.DASHBOARD_URL || '').replace(/\/$/, '');
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || '';

const isConfigured = !!(DASHBOARD_URL && DASHBOARD_SECRET);

if (!isConfigured) {
  console.warn('[dashboard] DASHBOARD_URL atau DASHBOARD_SECRET tidak di-set. Dashboard integration dinonaktifkan.');
}

async function post(path, body) {
  if (!isConfigured) return;
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/bot/internal/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': DASHBOARD_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[dashboard] POST ${path} failed (${res.status}): ${text}`);
    }
  } catch (err) {
    console.warn(`[dashboard] POST ${path} error: ${err.message}`);
  }
}

async function get(path) {
  if (!isConfigured) return null;
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/bot/internal/${path}`, {
      method: 'GET',
      headers: { 'x-bot-secret': DASHBOARD_SECRET },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[dashboard] GET ${path} error: ${err.message}`);
    return null;
  }
}

/**
 * Ambil perintah pending dari dashboard (dipanggil sekali saat start()).
 * Return: { method: 'qr' } | { method: 'pairing', phoneNumber: '628xxx' } | null
 */
async function getPendingCommand() {
  const data = await get('command');
  return data?.command ?? null;
}

/**
 * Push QR string (dari Baileys event qr) ke dashboard.
 * Dashboard akan convert ke PNG dan tampilkan di UI.
 * @param {string} qrString - raw QR string dari Baileys connection.update
 */
async function pushQr(qrString) {
  await post('push-qr', { qr: qrString });
}

/**
 * Push pairing code ke dashboard setelah requestPairingCode() berhasil.
 * @param {string} code - formatted code, contoh "ABCD-EFGH"
 * @param {string} phoneNumber - nomor tanpa +, contoh "6281234567890"
 */
async function pushPairingCode(code, phoneNumber) {
  await post('push-pairing', { code, phoneNumber });
}

/**
 * Push status koneksi ke dashboard.
 * @param {'connected'|'disconnected'|'connecting'|'qr_pending'|'pairing_pending'} state
 * @param {string|null} [phoneNumber] - nomor WhatsApp saat connected
 */
async function pushStatus(state, phoneNumber = null) {
  await post('push-status', { state, phoneNumber });
}

/**
 * Push log ke dashboard log viewer.
 * @param {'info'|'warn'|'error'|'debug'} level
 * @param {string} message
 * @param {string} [meta]
 */
async function pushLog(level, message, meta) {
  await post('push-log', { level, message, meta });
}

module.exports = { isConfigured, getPendingCommand, pushQr, pushPairingCode, pushStatus, pushLog };
