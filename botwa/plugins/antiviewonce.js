/**
 * .antiviewonce — Buka pesan sekali lihat agar bisa dilihat terus
 * Perintah:
 *   .antiviewonce on   — Aktifkan (owner, per chat/grup)
 *   .antiviewonce off  — Matikan
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
 * Cari view once message dari dalam msg.message,
 * mendukung semua format WA: viewOnceMessage, viewOnceMessageV2,
 * viewOnceMessageV2Extension, dan wrapped di dalam ephemeralMessage.
 * Returns { innerMsg, type } atau null.
 */
function extractViewOnce(rawMsg) {
  // Daftar semua wrapper view once yang mungkin
  const WRAPPERS = [
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
  ];

  // Cari langsung di rawMsg
  for (const wrap of WRAPPERS) {
    const inner = rawMsg?.[wrap]?.message;
    if (inner) {
      const type = Object.keys(inner)[0];
      if (type === 'imageMessage' || type === 'videoMessage') {
        return { innerMsg: inner[type], mediaType: type === 'imageMessage' ? 'image' : 'video' };
      }
    }
  }

  // Cari di dalam ephemeralMessage (pesan sementara)
  const ephemeral = rawMsg?.ephemeralMessage?.message;
  if (ephemeral) {
    for (const wrap of WRAPPERS) {
      const inner = ephemeral?.[wrap]?.message;
      if (inner) {
        const type = Object.keys(inner)[0];
        if (type === 'imageMessage' || type === 'videoMessage') {
          return { innerMsg: inner[type], mediaType: type === 'imageMessage' ? 'image' : 'video' };
        }
      }
    }
  }

  // Cek imageMessage/videoMessage langsung dengan flag viewOnce: true
  for (const t of ['imageMessage', 'videoMessage']) {
    if (rawMsg?.[t]?.viewOnce === true) {
      return { innerMsg: rawMsg[t], mediaType: t === 'imageMessage' ? 'image' : 'video' };
    }
  }

  return null;
}

module.exports = {
  name   : '.antiviewonce',
  command: ['.antiviewonce', '.avo', '.antivo'],

  // ── Handler otomatis untuk semua pesan masuk ────────────────────────────
  async handleMessage(conn, msg) {
    const db  = loadDB();
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;
    if (!db[jid]) return; // fitur tidak aktif di chat ini

    const rawMsg = msg.message;
    if (!rawMsg) return;

    // Debug: log semua key pesan masuk untuk diagnosa
    const keys = Object.keys(rawMsg);
    const hasVO = keys.some(k => k.toLowerCase().includes('viewonce'));
    if (hasVO) {
      console.log('[antiviewonce] 👁️ View once terdeteksi! Keys:', keys.join(', '));
    }

    const found = extractViewOnce(rawMsg);
    if (!found) return;

    const { innerMsg, mediaType } = found;
    console.log(`[antiviewonce] ⬇️ Download ${mediaType} dari ${jid}...`);

    try {
      const stream = await downloadContentFromMessage(innerMsg, mediaType);
      let buffer   = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (buffer.length === 0) throw new Error('Buffer kosong setelah download');

      console.log(`[antiviewonce] ✅ Download selesai (${(buffer.length / 1024).toFixed(1)} KB)`);

      const caption = (innerMsg.caption ? innerMsg.caption + '\n\n' : '') +
                      `*[👁️ Anti View Once]*\n_Pesan ini aslinya hanya bisa dilihat sekali._`;

      if (mediaType === 'image') {
        await conn.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
      } else {
        await conn.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[antiviewonce] ❌ Gagal download:', err.message);
      await conn.sendMessage(jid, {
        text: `👁️ *Anti View Once*\n\nAda pesan sekali lihat masuk, tapi gagal membukanya.\n_Error: ${err.message}_`
      }, { quoted: msg });
    }
  },

  // ── Command handler ──────────────────────────────────────────────────────
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
        text: `👁️ *ANTI VIEW ONCE*\n\nStatus di chat ini: ${status}\n\n` +
              `• _.antiviewonce on_ — Aktifkan\n` +
              `• _.antiviewonce off_ — Matikan\n\n` +
              `_Jika aktif, foto/video sekali lihat akan otomatis dibuka dan dikirim ulang._`
      }, { quoted: msg });
    }

    if (sub === 'on') {
      db[sender] = true;
      saveDB(db);
      return conn.sendMessage(sender, {
        text: `✅ *Anti View Once diaktifkan!*\n\nSetiap pesan sekali lihat (foto/video) yang masuk akan otomatis dibuka dan dikirim ulang.`
      }, { quoted: msg });
    }

    if (sub === 'off') {
      delete db[sender];
      saveDB(db);
      return conn.sendMessage(sender, {
        text: `🔕 *Anti View Once dimatikan.*`
      }, { quoted: msg });
    }

    await conn.sendMessage(sender, {
      text: `⚠️ Gunakan: _.antiviewonce on_ atau _.antiviewonce off_`
    }, { quoted: msg });
  }
};
