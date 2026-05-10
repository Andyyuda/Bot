/**
 * .antiviewonce — Buka pesan sekali lihat
 * Deteksi otomatis, quote pesan asli + kirim debug info di chat.
 * Kalau download berhasil → kirim medianya sekalian.
 *
 * Perintah:
 *   .antiviewonce on   — Aktifkan (owner)
 *   .antiviewonce off  — Matikan (owner)
 *   .antiviewonce      — Lihat status
 */

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs   = require('fs');
const path = require('path');
const { isOwner } = require('../lib/helper');
const setting = require('../setting');

const DB_PATH = path.join(__dirname, '../database/antiviewonce.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function saveDB(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Rekursif cari view once di dalam objek message.
 * Return { found: true, path: string, innerMsg, mediaType } atau { found: false }
 */
function findViewOnce(obj, currentPath = 'message') {
  if (!obj || typeof obj !== 'object') return { found: false };

  const MEDIA_TYPES = ['imageMessage', 'videoMessage'];

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    // Kalau key mengandung "viewonce" (case-insensitive)
    if (key.toLowerCase().includes('viewonce')) {
      // Cari imageMessage / videoMessage di dalamnya
      const inner = val?.message || val;
      if (inner && typeof inner === 'object') {
        for (const mtype of MEDIA_TYPES) {
          if (inner[mtype]) {
            return {
              found    : true,
              path     : `${currentPath}.${key}`,
              innerMsg : inner[mtype],
              mediaType: mtype === 'imageMessage' ? 'image' : 'video',
              mtype
            };
          }
        }
      }
    }

    // imageMessage / videoMessage dengan flag viewOnce: true langsung
    if (MEDIA_TYPES.includes(key) && val?.viewOnce === true) {
      return {
        found    : true,
        path     : `${currentPath}.${key} (viewOnce flag)`,
        innerMsg : val,
        mediaType: key === 'imageMessage' ? 'image' : 'video',
        mtype    : key
      };
    }

    // Rekursif masuk ke dalam object (maks 3 level)
    if (val && typeof val === 'object' && currentPath.split('.').length < 4) {
      const result = findViewOnce(val, `${currentPath}.${key}`);
      if (result.found) return result;
    }
  }

  return { found: false };
}

module.exports = {
  name   : '.antiviewonce',
  command: ['.antiviewonce', '.avo', '.antivo'],

  // ── Handler otomatis untuk semua pesan masuk ──────────────────────────────
  async handleMessage(conn, msg) {
    const db  = loadDB();
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;
    if (!db[jid]) return;

    const rawMsg = msg.message;
    if (!rawMsg) return;

    // Cari view once di seluruh struktur pesan (rekursif)
    const result = findViewOnce(rawMsg);
    if (!result.found) return;

    const { path: msgPath, innerMsg, mediaType, mtype } = result;

    console.log(`[antiviewonce] 👁️ VIEW ONCE ditemukan! Path: ${msgPath}`);

    // ── Step 1: Langsung quote + kirim info debug ke chat ────────────────────
    const debugInfo =
      `👁️ *View Once Terdeteksi!*\n\n` +
      `📍 Path  : \`${msgPath}\`\n` +
      `📦 Type  : \`${mtype}\`\n` +
      `📐 Size  : ${innerMsg.fileLength || '?'} bytes\n` +
      `💬 Caption: ${innerMsg.caption || '(kosong)'}\n\n` +
      `⬇️ _Mencoba download..._`;

    let debugMsg;
    try {
      debugMsg = await conn.sendMessage(jid, { text: debugInfo }, { quoted: msg });
    } catch (e) {
      console.error('[antiviewonce] gagal kirim debug msg:', e.message);
    }

    // ── Step 2: Download dan kirim ulang media ────────────────────────────────
    let statusTeks;
    try {
      const stream = await downloadContentFromMessage(innerMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (buffer.length === 0) throw new Error('Buffer kosong');

      console.log(`[antiviewonce] ✅ ${mediaType} ${(buffer.length / 1024).toFixed(1)} KB`);

      const caption =
        (innerMsg.caption ? innerMsg.caption + '\n\n' : '') +
        `*[👁️ Anti View Once]*\n_Aslinya pesan ini hanya bisa dilihat sekali._`;

      if (mediaType === 'image') {
        await conn.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
      } else {
        await conn.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
      }

      statusTeks = `✅ *Berhasil!* Media ${mediaType} sudah dikirim ulang.`;
    } catch (err) {
      console.error('[antiviewonce] ❌ Download error:', err.message);
      statusTeks = `❌ *Gagal download!*\nError: \`${err.message}\`\n\nℹ️ Info ini membantu pengembang untuk debug.`;
    }

    // ── Step 3: Update debug message dengan status akhir ─────────────────────
    try {
      await conn.sendMessage(jid, {
        text: `${debugInfo.replace('⬇️ _Mencoba download..._', statusTeks)}`
      }, { quoted: msg });
    } catch {}
  },

  // ── Command handler ────────────────────────────────────────────────────────
  async execute(conn, sender, args, msg) {
    const senderJid  = msg.key.participant || msg.key.remoteJid;
    const ownerCheck = isOwner(senderJid, setting.owner);

    if (!ownerCheck) {
      return conn.sendMessage(sender, {
        text: '⛔ Hanya owner yang bisa mengatur fitur ini.'
      }, { quoted: msg });
    }

    const db  = loadDB();
    const sub = (args[0] || '').toLowerCase().trim();

    if (!sub) {
      const status = db[sender] ? '✅ Aktif' : '❌ Nonaktif';
      return conn.sendMessage(sender, {
        text: `👁️ *ANTI VIEW ONCE*\n\nStatus: ${status}\n\n` +
              `• _.antiviewonce on_ — Aktifkan\n` +
              `• _.antiviewonce off_ — Matikan\n\n` +
              `_Jika aktif, setiap pesan view once yang masuk akan di-quote + dibuka otomatis._`
      }, { quoted: msg });
    }

    if (sub === 'on') {
      db[sender] = true;
      saveDB(db);
      return conn.sendMessage(sender, {
        text: `✅ *Anti View Once diaktifkan!*\n\n` +
              `Setiap pesan sekali lihat yang masuk akan:\n` +
              `1️⃣ Di-quote dengan info deteksi\n` +
              `2️⃣ Dicoba download dan dikirim ulang\n` +
              `3️⃣ Dilaporkan hasilnya (berhasil/gagal)`
      }, { quoted: msg });
    }

    if (sub === 'off') {
      delete db[sender];
      saveDB(db);
      return conn.sendMessage(sender, { text: `🔕 *Anti View Once dimatikan.*` }, { quoted: msg });
    }

    await conn.sendMessage(sender, {
      text: `⚠️ Gunakan: _.antiviewonce on_ atau _.antiviewonce off_`
    }, { quoted: msg });
  }
};
