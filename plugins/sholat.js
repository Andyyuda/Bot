/**
 * .sholat — Notifikasi sholat 5 waktu otomatis + jadwal harian
 * Perintah:
 *   .sholat setup <kota>  — Set kota & aktifkan notif (owner)
 *   .sholat on / off      — Toggle notifikasi (owner)
 *   .sholat info          — Lihat jadwal hari ini
 *   .sholat hapus         — Hapus pengaturan (owner)
 *   .waktu                — Alias info
 */

const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');
const { isOwner } = require('../lib/helper');
const setting = require('../setting');

const DB_PATH = path.join(__dirname, '../database/sholat.json');

const WAKTU  = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const NAMA   = { Fajr: 'Subuh', Dhuhr: 'Dzuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya' };
const EMOJI  = { Fajr: '🌙', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌅', Isha: '✨' };

// Gambar masjid (Wikipedia Commons — stabil)
const IMG_URL  = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Faisal_Mosque_Islamabad.jpg/1280px-Faisal_Mosque_Islamabad.jpg';

// Adzan audio (coba beberapa URL, pakai yang pertama berhasil)
const ADZAN_URLS = [
  'https://www.islamcan.com/audio/adhan/azan1.mp3',
  'https://ia800500.us.archive.org/18/items/MadinaNobisAzaan/Madina%20Nobis%20Azaan.mp3',
];

let schedulerStarted = false;
let connRef           = null;

// ── DB helpers ──────────────────────────────────────────────────────────────
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function saveDB(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Ambil jadwal dari Aladhan API ────────────────────────────────────────────
async function getJadwal(kota, negara = 'Indonesia') {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(kota)}&country=${encodeURIComponent(negara)}&method=11`;
  const res  = await fetch(url, { timeout: 10000 });
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Kota "${kota}" tidak ditemukan`);
  return json.data;
}

// ── Kirim notifikasi waktu sholat ────────────────────────────────────────────
async function kirimNotif(conn, jid, waktu, kota, timings, tanggal) {
  const nama  = NAMA[waktu];
  const emoji = EMOJI[waktu];
  const jam   = timings[waktu]?.substring(0, 5);

  const jadwalStr = WAKTU.map(w => {
    const mark = w === waktu ? '▶️' : '   ';
    return `${mark} ${EMOJI[w]} *${NAMA[w]}*\t: ${timings[w]?.substring(0, 5)}`;
  }).join('\n');

  const teks = `${emoji} *WAKTU ${nama.toUpperCase()} TELAH TIBA* ${emoji}\n\n` +
    `📍 Kota  : *${kota}*\n` +
    `🕐 Pukul : *${jam} WIB*\n` +
    `📅 Tanggal: ${tanggal}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📅 *Jadwal Sholat Hari Ini*\n\n${jadwalStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🤲 _Segera tunaikan sholat, jangan ditunda._\n` +
    `✨ _"Sholat adalah tiang agama."_`;

  // Kirim gambar + caption
  try {
    await conn.sendMessage(jid, { image: { url: IMG_URL }, caption: teks });
  } catch {
    await conn.sendMessage(jid, { text: teks });
  }

  // Kirim audio adzan
  for (const url of ADZAN_URLS) {
    try {
      await conn.sendMessage(jid, {
        audio   : { url },
        mimetype: 'audio/mpeg',
        ptt     : false
      });
      break; // berhasil, stop coba URL berikutnya
    } catch (e) {
      console.error(`[sholat] audio gagal (${url}):`, e.message);
    }
  }
}

// ── Scheduler: cek setiap menit ──────────────────────────────────────────────
function startScheduler(conn) {
  connRef = conn;
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log('[sholat] Scheduler dimulai ✅');

  setInterval(async () => {
    const db  = loadDB();
    const now = new Date();
    const nowStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta', hour12: false
    }); // "05:12"

    for (const [jid, cfg] of Object.entries(db)) {
      if (!cfg.aktif || !cfg.kota) continue;
      try {
        const data     = await getJadwal(cfg.kota, cfg.negara || 'Indonesia');
        const timings  = data.timings;
        const tanggal  = data.date.readable;
        for (const w of WAKTU) {
          const t = timings[w]?.substring(0, 5);
          if (t === nowStr) {
            console.log(`[sholat] 🕌 ${w} (${t}) → ${jid}`);
            await kirimNotif(connRef, jid, w, cfg.kota, timings, tanggal);
          }
        }
      } catch (e) {
        console.error(`[sholat] scheduler error untuk ${jid}:`, e.message);
      }
    }
  }, 60_000); // setiap 1 menit
}

// ── Plugin export ────────────────────────────────────────────────────────────
module.exports = {
  name   : '.sholat',
  command: ['.sholat', '.jadwalsholat', '.waktu'],

  onReady(conn) {
    startScheduler(conn);
  },

  async execute(conn, sender, args, msg) {
    const senderJid  = msg.key.participant || msg.key.remoteJid;
    const ownerCheck = isOwner(senderJid, setting.owner);
    const db         = loadDB();
    const cfg        = db[sender] || {};
    const sub        = (args[0] || '').toLowerCase().trim();

    // ── Help / info jadwal ───────────────────────────────────────────────────
    if (!sub || sub === 'info' || sub === 'jadwal') {
      const kota = cfg.kota;
      if (!kota) {
        return conn.sendMessage(sender, {
          text: `🕌 *NOTIFIKASI SHOLAT*\n\nBelum ada kota yang di-set!\n\n` +
                `Gunakan: _.sholat setup <kota>_\nContoh: _.sholat setup Jakarta_\n\n` +
                `📖 Perintah:\n` +
                `• _.sholat setup <kota>_ — Setup & aktifkan notif\n` +
                `• _.sholat on/off_ — Toggle notifikasi\n` +
                `• _.sholat info_ — Jadwal hari ini\n` +
                `• _.sholat hapus_ — Hapus pengaturan`
        }, { quoted: msg });
      }

      try {
        const data     = await getJadwal(kota, cfg.negara || 'Indonesia');
        const timings  = data.timings;
        const tanggal  = data.date.readable;
        const status   = cfg.aktif ? '✅ Aktif' : '❌ Nonaktif';

        const jadwalStr = WAKTU.map(w =>
          `${EMOJI[w]} *${NAMA[w]}*\t: ${timings[w]?.substring(0, 5)}`
        ).join('\n');

        const teks = `🕌 *JADWAL SHOLAT HARI INI*\n\n` +
          `📍 Kota    : *${kota}*\n` +
          `📅 Tanggal : ${tanggal}\n` +
          `🔔 Notifikasi: ${status}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n${jadwalStr}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🤲 _Jangan lewatkan waktu sholat!_`;

        try {
          await conn.sendMessage(sender, { image: { url: IMG_URL }, caption: teks }, { quoted: msg });
        } catch {
          await conn.sendMessage(sender, { text: teks }, { quoted: msg });
        }
      } catch (e) {
        await conn.sendMessage(sender, { text: `❌ Gagal ambil jadwal: ${e.message}` }, { quoted: msg });
      }
      return;
    }

    // ── Setup ────────────────────────────────────────────────────────────────
    if (sub === 'setup' || sub === 'set') {
      if (!ownerCheck) {
        return conn.sendMessage(sender, { text: '⛔ Hanya owner yang bisa setup notifikasi sholat.' }, { quoted: msg });
      }
      const kota = args.slice(1).join(' ').trim();
      if (!kota) {
        return conn.sendMessage(sender, {
          text: '⚠️ Masukkan nama kota!\nContoh: _.sholat setup Jakarta_'
        }, { quoted: msg });
      }
      try {
        const data    = await getJadwal(kota);
        const timings = data.timings;
        const tanggal = data.date.readable;

        db[sender] = { kota, negara: 'Indonesia', aktif: true };
        saveDB(db);
        startScheduler(conn);

        const jadwalStr = WAKTU.map(w =>
          `${EMOJI[w]} *${NAMA[w]}*: ${timings[w]?.substring(0, 5)}`
        ).join('\n');

        await conn.sendMessage(sender, {
          text: `✅ *Notifikasi sholat berhasil di-setup!*\n\n` +
                `📍 Kota: *${kota}*\n📅 ${tanggal}\n\n${jadwalStr}\n\n` +
                `🔔 Bot akan otomatis kirim notifikasi + adzan setiap waktu sholat!`
        }, { quoted: msg });
      } catch (e) {
        await conn.sendMessage(sender, {
          text: `❌ Kota tidak ditemukan: _${kota}_\n\nCoba dalam bahasa Inggris:\n• _.sholat setup Surabaya_\n• _.sholat setup Bandung_`
        }, { quoted: msg });
      }
      return;
    }

    // ── On ───────────────────────────────────────────────────────────────────
    if (sub === 'on') {
      if (!ownerCheck) return conn.sendMessage(sender, { text: '⛔ Hanya owner.' }, { quoted: msg });
      if (!cfg.kota) return conn.sendMessage(sender, { text: '❌ Setup dulu: _.sholat setup <kota>_' }, { quoted: msg });
      db[sender] = { ...cfg, aktif: true };
      saveDB(db);
      startScheduler(conn);
      return conn.sendMessage(sender, {
        text: `✅ Notifikasi sholat *diaktifkan!*\n📍 Kota: *${cfg.kota}*`
      }, { quoted: msg });
    }

    // ── Off ──────────────────────────────────────────────────────────────────
    if (sub === 'off') {
      if (!ownerCheck) return conn.sendMessage(sender, { text: '⛔ Hanya owner.' }, { quoted: msg });
      db[sender] = { ...cfg, aktif: false };
      saveDB(db);
      return conn.sendMessage(sender, { text: '🔕 Notifikasi sholat *dimatikan.*' }, { quoted: msg });
    }

    // ── Hapus ────────────────────────────────────────────────────────────────
    if (sub === 'hapus' || sub === 'reset') {
      if (!ownerCheck) return conn.sendMessage(sender, { text: '⛔ Hanya owner.' }, { quoted: msg });
      delete db[sender];
      saveDB(db);
      return conn.sendMessage(sender, { text: '🗑️ Pengaturan sholat dihapus.' }, { quoted: msg });
    }

    // ── Default help ─────────────────────────────────────────────────────────
    await conn.sendMessage(sender, {
      text: `🕌 *NOTIFIKASI SHOLAT 5 WAKTU*\n\n` +
            `📖 Perintah (prefix = owner only):\n` +
            `• _.sholat setup <kota>_ — Setup kota & aktifkan notif\n` +
            `• _.sholat on_ — Aktifkan notifikasi\n` +
            `• _.sholat off_ — Matikan notifikasi\n` +
            `• _.sholat info_ — Lihat jadwal hari ini\n` +
            `• _.sholat hapus_ — Hapus semua pengaturan\n\n` +
            `Contoh: _.sholat setup Jakarta_`
    }, { quoted: msg });
  }
};
