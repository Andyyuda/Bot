/**
 * .antiviewonce — Buka pesan sekali lihat
 * Mode DEBUG: dump semua non-teks message ke chat agar tahu struktur aslinya.
 *
 * Perintah:
 *   .antiviewonce on     — Aktifkan
 *   .antiviewonce off    — Matikan
 *   .antiviewonce debug  — Toggle mode dump (default: aktif saat on)
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

/** Cari media di dalam view once (semua format) */
function findViewOnce(rawMsg) {
  const str = JSON.stringify(rawMsg).toLowerCase();
  const hasVO = str.includes('viewonce');

  // Cari mediaType terdekat
  const WRAPPERS = ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension'];
  const MEDIA    = ['imageMessage','videoMessage'];

  function dig(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (key.toLowerCase().includes('viewonce')) {
        const inner = val?.message || val;
        if (inner && typeof inner === 'object') {
          for (const m of MEDIA) {
            if (inner[m]) return { innerMsg: inner[m], mediaType: m === 'imageMessage' ? 'image' : 'video', foundKey: key };
          }
        }
      }
      if (MEDIA.includes(key) && val?.viewOnce === true) {
        return { innerMsg: val, mediaType: key === 'imageMessage' ? 'image' : 'video', foundKey: key + '(viewOnce flag)' };
      }
      const sub = dig(val, depth + 1);
      if (sub) return sub;
    }
    return null;
  }

  return { hasVO, result: dig(rawMsg) };
}

/** Ambil ringkasan struktur pesan (keys + 1 level dalam) untuk debug */
function msgSummary(rawMsg) {
  if (!rawMsg) return '(null)';
  const lines = [];
  for (const [k, v] of Object.entries(rawMsg)) {
    if (v && typeof v === 'object') {
      const subkeys = Object.keys(v).slice(0, 8).join(', ');
      lines.push(`• ${k}:\n   {${subkeys}}`);
    } else {
      lines.push(`• ${k}: ${String(v).substring(0, 40)}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  name   : '.antiviewonce',
  command: ['.antiviewonce', '.avo', '.antivo'],

  // ── Auto-handler ───────────────────────────────────────────────────────────
  async handleMessage(conn, msg) {
    const db  = loadDB();
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;

    const cfg = db[jid];
    if (!cfg) return;                       // tidak aktif di sini

    const rawMsg = msg.message;

    // ── DEBUG DUMP: kirim struktur semua pesan non-teks ke chat ────────────
    if (cfg === true || cfg?.on) {
      // Skip pesan teks biasa (tidak perlu di-dump)
      const isText = !!(rawMsg?.conversation || rawMsg?.extendedTextMessage?.text);
      if (!isText && rawMsg) {
        const summary = msgSummary(rawMsg);
        const { hasVO, result } = findViewOnce(rawMsg);

        console.log(`[antiviewonce] 📦 Pesan masuk keys: ${Object.keys(rawMsg).join(', ')}`);

        // Kirim debug dump ke chat
        const debugText =
          `🔍 *[DEBUG Anti View Once]*\n` +
          `👁️ Ada viewOnce: *${hasVO ? 'YA' : 'TIDAK'}*\n` +
          `📦 Struktur msg:\n${summary}\n` +
          `─────────────────\n` +
          (result
            ? `✅ Terdeteksi!\nKey: \`${result.foundKey}\`\nType: \`${result.mediaType}\`\n⬇️ Mencoba download...`
            : `❌ Tidak terdeteksi sebagai view once`);

        try {
          await conn.sendMessage(jid, { text: debugText }, { quoted: msg });
        } catch (e) {
          console.error('[antiviewonce] gagal kirim debug:', e.message);
        }

        // Jika terdeteksi → coba download
        if (result) {
          try {
            const stream = await downloadContentFromMessage(result.innerMsg, result.mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            if (buffer.length === 0) throw new Error('Buffer kosong');

            const caption =
              (result.innerMsg.caption ? result.innerMsg.caption + '\n\n' : '') +
              `*[👁️ Anti View Once]* — dikirim ulang otomatis`;

            if (result.mediaType === 'image') {
              await conn.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
            } else {
              await conn.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
            }

            await conn.sendMessage(jid, {
              text: `✅ *Download berhasil!* (${(buffer.length / 1024).toFixed(1)} KB)`
            }, { quoted: msg });

          } catch (err) {
            console.error('[antiviewonce] download error:', err.message);
            await conn.sendMessage(jid, {
              text: `❌ *Download gagal!*\nError: \`${err.message}\`\n\nSalin error di atas untuk debug lebih lanjut.`
            }, { quoted: msg });
          }
        }
      }
    }
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
      const aktif = db[sender] ? '✅ Aktif' : '❌ Nonaktif';
      return conn.sendMessage(sender, {
        text: `👁️ *ANTI VIEW ONCE*\n\nStatus: ${aktif}\n\n` +
              `• _.antiviewonce on_ — Aktifkan + debug dump\n` +
              `• _.antiviewonce off_ — Matikan\n\n` +
              `_Mode debug aktif: bot akan dump struktur semua pesan non-teks ke chat saat fitur on._`
      }, { quoted: msg });
    }

    if (sub === 'on') {
      db[sender] = true;
      saveDB(db);
      return conn.sendMessage(sender, {
        text: `✅ *Anti View Once ON*\n\nBot sekarang akan:\n` +
              `1️⃣ Dump struktur semua pesan non-teks ke chat (debug)\n` +
              `2️⃣ Otomatis buka & kirim ulang jika terdeteksi view once\n\n` +
              `_Kirim foto/video sekali lihat untuk tes._`
      }, { quoted: msg });
    }

    if (sub === 'off') {
      delete db[sender];
      saveDB(db);
      return conn.sendMessage(sender, { text: `🔕 *Anti View Once OFF.*` }, { quoted: msg });
    }

    await conn.sendMessage(sender, {
      text: `⚠️ Gunakan: _.antiviewonce on_ atau _.antiviewonce off_`
    }, { quoted: msg });
  }
};
