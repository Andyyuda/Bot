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

module.exports = {
  name   : '.antiviewonce',
  command: ['.antiviewonce', '.avo', '.antivo'],

  // ── Handler otomatis untuk semua pesan masuk ────────────────────────────
  async handleMessage(conn, msg) {
    const db      = loadDB();
    const jid     = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;
    if (!db[jid]) return; // fitur tidak aktif di chat ini

    // Deteksi view once
    const viewOnceMsg =
      msg.message?.viewOnceMessage?.message ||
      msg.message?.viewOnceMessageV2?.message ||
      msg.message?.viewOnceMessageV2Extension?.message;
    if (!viewOnceMsg) return;

    const type = Object.keys(viewOnceMsg)[0]; // 'imageMessage' | 'videoMessage'
    if (type !== 'imageMessage' && type !== 'videoMessage') return;

    const content   = viewOnceMsg[type];
    const mediaType = type === 'imageMessage' ? 'image' : 'video';

    try {
      // Download media
      const stream = await downloadContentFromMessage(content, mediaType);
      let buffer   = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const caption = (content.caption ? content.caption + '\n\n' : '') +
                      `*[👁️ Anti View Once]*\n_Pesan ini aslinya sekali lihat._`;

      if (mediaType === 'image') {
        await conn.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
      } else {
        await conn.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[antiviewonce] gagal download:', err.message);
      await conn.sendMessage(jid, {
        text: `👁️ *Anti View Once*\nGagal membuka pesan: _${err.message}_`
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

    // Status
    if (!sub) {
      const status = db[sender] ? '✅ Aktif' : '❌ Nonaktif';
      return conn.sendMessage(sender, {
        text: `👁️ *ANTI VIEW ONCE*\n\nStatus: ${status}\n\n` +
              `• _.antiviewonce on_ — Aktifkan\n` +
              `• _.antiviewonce off_ — Matikan\n\n` +
              `Jika aktif, setiap pesan sekali lihat (foto/video) yang masuk akan dibuka dan dikirim ulang secara otomatis.`
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
