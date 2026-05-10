/**
 * .menu — AndyStore Bot menu
 * Mendukung dua versi:
 *   V1 — Teks biasa, tanpa button (kompatibel semua WA)
 *   V2 — Full proto interactive button (default)
 * Ganti versi dengan: .setmenu v1 / .setmenu v2
 */

const fs   = require('fs');
const path = require('path');
const setting = require('../setting');
const { sendInteractive, sendList, quickReply, singleSelect } = require('../lib/button');

const LOGO_PATH  = path.join(__dirname, '../assets/logo.png');
const VER_DB     = path.join(__dirname, '../database/menuver.json');

function getPrefix() {
  let prefix = setting.prefix ?? '.';
  try {
    const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/prefix.json')));
    if (typeof db.prefix === 'string') prefix = db.prefix;
  } catch {}
  return prefix;
}

function getMenuVer() {
  try { return JSON.parse(fs.readFileSync(VER_DB, 'utf8')).version || 'v2'; } catch { return 'v2'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 — Teks biasa, tanpa button sama sekali
// ─────────────────────────────────────────────────────────────────────────────
async function menuV1(conn, sender, msg, p, jam, tgl) {
  const text = `╔══════════════════════╗
║   🤖  *ANDYSTORE BOT*   ║
╚══════════════════════╝

🕐 *${jam} WIB*  •  📅 *${tgl}*
━━━━━━━━━━━━━━━━━━━━━━━━

👑 *[ OWNER & SETUP ]*
│ ${p}myid         → ID kamu
│ ${p}regowner     → Daftar owner (PIN)
│ ${p}addowner     → Tambah owner
│ ${p}delowner     → Hapus owner
│ ${p}setprefix    → Ganti prefix
│ ${p}setmenu v1/v2→ Ganti tampilan menu

⚙️ *[ MANAJEMEN BOT ]*
│ ${p}restart      → Restart bot
│ ${p}addplugin    → Upload plugin
│ ${p}delplugin    → Hapus plugin
│ ${p}getplugin    → Lihat plugin
│ $ <cmd>          → Jalankan shell

👥 *[ GRUP TOOLS ]*
│ ${p}add   → Tambah member
│ ${p}kick  → Keluarkan member
│ ${p}mute  → Bisukan member
│ ${p}unmute→ Bunyikan member
│ ${p}welcome      → Pesan sambutan
│ ${p}leave        → Bot keluar grup

🔐 *[ AKUN VPN ]*
│ ${p}buatssh  ${p}trialssh
│ ${p}addtr    ${p}trialtr
│ ${p}addvl    ${p}trialvl
│ ${p}addvm    ${p}trialvm

🤖 *[ AI & PINTAR ]*
│ ${p}ai <tanya>   → Chat AI
│ ${p}andy <tanya> → Alias .ai
│ ${p}resetai      → Reset riwayat AI

🎮 *[ PERMAINAN ]*
│ ${p}tebakangka   → Tebak angka 1-100
│ ${p}tebak <N>    → Kirim tebakan
│ ${p}tebakkata    → Hangman kata
│ ${p}tk <huruf>   → Tebak huruf
│ ${p}suit batu/gunting/kertas
│ ${p}dadu [N]     → Lempar dadu
│ ${p}koin         → Lempar koin
│ ${p}quiz         → Kuis trivia
│ ${p}jawab A/B/C/D
│ ${p}quizstop     → Hentikan quiz
│ ${p}truth        → Pertanyaan truth
│ ${p}dare         → Tantangan dare
│ ${p}tod          → Truth atau Dare acak

✨ *[ SERU-SERUAN ]*
│ ${p}ramalan      → Ramalan harian
│ ${p}horoscope <zodiak>
│ ${p}angkahoki    → Angka keberuntungan
│ ${p}kata         → Quote motivasi
│ ${p}katacinta    → Kata romantis
│ ${p}katafunny    → Kata lucu

🎵 *[ MUSIK ]*
│ ${p}play <judul> → Putar audio YT
│ ${p}dompul       → Download MP3

🛡️ *[ SERVER VPS ]*
│ ${p}installsc    → Kirim install.sh
│ ${p}regisip      → Daftar IP
│ ${p}perpanjangip → Perpanjang IP
│ ${p}bersihkanip  → Bersihkan IP

━━━━━━━━━━━━━━━━━━━━━━━━
✨ *AndyStore Bot* v1 Menu
🔧 Ganti tampilan: _.setmenu v2_
📞 Owner: @andyyuda28`;

  if (fs.existsSync(LOGO_PATH)) {
    await conn.sendMessage(sender, {
      image   : fs.readFileSync(LOGO_PATH),
      caption : text,
      mimetype: 'image/png'
    }, { quoted: msg });
  } else {
    await conn.sendMessage(sender, { text }, { quoted: msg });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 — Full proto interactive button
// ─────────────────────────────────────────────────────────────────────────────
async function menuV2(conn, sender, msg, p, jam, tgl) {
  const headerText = `╔══════════════════════╗
║   🤖  *ANDYSTORE BOT*   ║
╚══════════════════════╝

🕐 *${jam} WIB*  •  📅 *${tgl}*
━━━━━━━━━━━━━━━━━━━━━━━━

📌 Gunakan tombol *Pilih Menu* di bawah untuk navigasi cepat, atau ketik perintah langsung.

━━━━━━━━━━━━━━━━━━━━━━━━
✨ *AndyStore Bot* v2 Menu
🔧 Ganti tampilan: _.setmenu v1_`;

  if (fs.existsSync(LOGO_PATH)) {
    await conn.sendMessage(sender, {
      image   : fs.readFileSync(LOGO_PATH),
      caption : headerText,
      mimetype: 'image/png'
    }, { quoted: msg });
  } else {
    await conn.sendMessage(sender, { text: headerText }, { quoted: msg });
  }

  // ── Button 1: Owner & Bot ──────────────────────────────────────────────────
  await sendInteractive(conn, sender, {
    title : '👑 Owner & Manajemen Bot',
    body  : `*Owner & Setup*\n${p}myid • ${p}regowner • ${p}addowner • ${p}setprefix • ${p}setmenu\n\n*Manajemen Bot*\n${p}restart • ${p}addplugin • ${p}delplugin • $ <cmd>`,
    footer: 'AndyStore Bot',
    buttons: [
      singleSelect('👑 Pilih Perintah', [
        {
          title: '👑 Owner',
          rows: [
            { title: `${p}myid`,       description: 'Lihat ID / nomor kamu',             id: `${p}myid` },
            { title: `${p}regowner`,   description: 'Daftar jadi owner via PIN',          id: `${p}regowner` },
            { title: `${p}addowner`,   description: 'Tambah owner baru',                  id: `${p}addowner` },
            { title: `${p}delowner`,   description: 'Hapus owner',                        id: `${p}delowner` },
            { title: `${p}setprefix`,  description: 'Ganti prefix perintah bot',          id: `${p}setprefix` },
            { title: `${p}setmenu`,    description: 'Info ganti versi menu (v1/v2)',       id: `${p}setmenu` },
          ]
        },
        {
          title: '⚙️ Bot',
          rows: [
            { title: `${p}restart`,    description: 'Restart ulang bot',                  id: `${p}restart` },
            { title: `${p}addplugin`,  description: 'Upload plugin baru',                 id: `${p}addplugin` },
            { title: `${p}delplugin`,  description: 'Hapus plugin',                       id: `${p}delplugin` },
            { title: `${p}getplugin`,  description: 'Lihat daftar plugin',                id: `${p}getplugin` },
          ]
        },
      ]),
      quickReply('👤 ID Saya', `${p}myid`),
      quickReply('🔄 Restart',  `${p}restart`),
    ]
  }, msg);

  // ── Button 2: Grup + VPN ───────────────────────────────────────────────────
  await sendInteractive(conn, sender, {
    title : '👥 Grup Tools & 🔐 VPN',
    body  : `*Grup*\n${p}add • ${p}kick • ${p}mute • ${p}unmute • ${p}welcome • ${p}leave\n\n*VPN*\n${p}buatssh • ${p}trialssh • ${p}addtr • ${p}trialtr\n${p}addvl • ${p}trialvl • ${p}addvm • ${p}trialvm`,
    footer: 'AndyStore Bot',
    buttons: [
      singleSelect('📋 Pilih Perintah', [
        {
          title: '👥 Grup',
          rows: [
            { title: `${p}add`,        description: 'Tambah member ke grup',              id: `${p}add` },
            { title: `${p}kick`,       description: 'Keluarkan member dari grup',         id: `${p}kick` },
            { title: `${p}mute`,       description: 'Bisukan member di grup',             id: `${p}mute` },
            { title: `${p}unmute`,     description: 'Bunyikan kembali member',            id: `${p}unmute` },
            { title: `${p}welcome`,    description: 'Set pesan sambutan grup',            id: `${p}welcome` },
            { title: `${p}leave`,      description: 'Bot keluar dari grup',               id: `${p}leave` },
          ]
        },
        {
          title: '🔐 VPN SSH',
          rows: [
            { title: `${p}buatssh`,    description: 'Buat akun SSH baru',                id: `${p}buatssh` },
            { title: `${p}trialssh`,   description: 'Akun SSH trial 60 menit',           id: `${p}trialssh` },
          ]
        },
        {
          title: '🌀 VPN Tunnel',
          rows: [
            { title: `${p}addtr`,      description: 'Buat akun Trojan',                  id: `${p}addtr` },
            { title: `${p}trialtr`,    description: 'Trial Trojan',                      id: `${p}trialtr` },
            { title: `${p}addvl`,      description: 'Buat akun VLESS',                   id: `${p}addvl` },
            { title: `${p}trialvl`,    description: 'Trial VLESS',                       id: `${p}trialvl` },
            { title: `${p}addvm`,      description: 'Buat akun VMess',                   id: `${p}addvm` },
            { title: `${p}trialvm`,    description: 'Trial VMess',                       id: `${p}trialvm` },
          ]
        },
      ]),
      quickReply('👥 Grup',  `${p}add`),
      quickReply('🔐 SSH',   `${p}buatssh`),
    ]
  }, msg);

  // ── Button 3: AI ───────────────────────────────────────────────────────────
  await sendInteractive(conn, sender, {
    title : '🤖 AI & Pintar',
    body  : `Chat dengan AI gratis!\n\n💬 *${p}ai <pertanyaan>*\nContoh:\n• ${p}ai jelaskan cara kerja VPN\n• ${p}ai buatkan puisi\n• ${p}ai terjemahkan "hello world"`,
    footer: 'Powered by Pollinations.ai',
    buttons: [
      quickReply('🧠 Chat AI',    `${p}ai`),
      quickReply('🗑️ Reset AI',  `${p}resetai`),
      quickReply('💡 Contoh',    `${p}ai apa itu VPN?`),
    ]
  }, msg);

  // ── Button 4: Game ─────────────────────────────────────────────────────────
  await sendInteractive(conn, sender, {
    title : '🎮 Permainan',
    body  : `*Daftar game yang tersedia:*\n🔢 Tebak Angka • 📝 Tebak Kata (Hangman)\n✂️ Suit (BKK) • 🎲 Dadu • 🪙 Koin\n🧠 Quiz Trivia • 💭 Truth or Dare`,
    footer: 'AndyStore Bot',
    buttons: [
      singleSelect('🎮 Pilih Game', [
        {
          title: '🎯 Tebak-tebakan',
          rows: [
            { title: '🔢 Tebak Angka',   description: 'Tebak angka 1-100, 7 kesempatan',   id: `${p}tebakangka` },
            { title: '📝 Tebak Kata',    description: 'Hangman kata bahasa Indonesia',      id: `${p}tebakkata` },
          ]
        },
        {
          title: '🎲 Keberuntungan',
          rows: [
            { title: '✂️ Suit (BKK)',     description: 'Batu Gunting Kertas vs Bot',        id: `${p}suit` },
            { title: '🎲 Lempar Dadu',   description: 'Roll dadu 1-6',                     id: `${p}dadu` },
            { title: '🪙 Lempar Koin',   description: 'Heads atau Tails',                  id: `${p}koin` },
          ]
        },
        {
          title: '🧠 Quiz & Sosial',
          rows: [
            { title: '🧠 Quiz Trivia',   description: '20+ soal trivia Indonesia & dunia', id: `${p}quiz` },
            { title: '💭 Truth',         description: 'Dapat pertanyaan truth',             id: `${p}truth` },
            { title: '🔥 Dare',          description: 'Dapat tantangan dare',               id: `${p}dare` },
            { title: '🎲 Truth or Dare', description: 'Acak truth atau dare',               id: `${p}tod` },
          ]
        },
      ]),
      quickReply('🔢 Tebak Angka', `${p}tebakangka`),
      quickReply('🧠 Quiz',        `${p}quiz`),
    ]
  }, msg);

  // ── Button 5: Seru + Musik ─────────────────────────────────────────────────
  await sendInteractive(conn, sender, {
    title : '✨ Seru-Seruan & 🎵 Musik',
    body  : `*Seru-seruan:*\n🔮 Ramalan • ⭐ Horoskop • 🍀 Angka Hoki\n💪 Motivasi • ❤️ Kata Cinta • 😂 Kata Lucu\n\n*Musik:*\n🎵 ${p}play <judul lagu>`,
    footer: 'AndyStore Bot',
    buttons: [
      singleSelect('✨ Pilih Hiburan', [
        {
          title: '🔮 Ramalan & Hoki',
          rows: [
            { title: '🔮 Ramalan Harian', description: 'Ramalan hari ini',                 id: `${p}ramalan` },
            { title: '⭐ Horoskop',       description: 'Horoskop zodiak (.horoscope leo)', id: `${p}horoscope` },
            { title: '🍀 Angka Hoki',     description: 'Angka keberuntungan hari ini',     id: `${p}angkahoki` },
          ]
        },
        {
          title: '💬 Kata-Kata',
          rows: [
            { title: '💪 Motivasi',       description: 'Quote motivasi inspiratif',        id: `${p}kata` },
            { title: '❤️ Kata Cinta',     description: 'Kata-kata romantis',               id: `${p}katacinta` },
            { title: '😂 Kata Lucu',      description: 'Humor & meme',                    id: `${p}katafunny` },
          ]
        },
        {
          title: '🎵 Musik',
          rows: [
            { title: '🎵 Play Musik',     description: `Cth: ${p}play shape of you`,       id: `${p}play` },
            { title: '📥 Dompul',         description: 'Download MP3',                     id: `${p}dompul` },
          ]
        },
      ]),
      quickReply('🎵 Play Musik', `${p}play`),
      quickReply('🔮 Ramalan',    `${p}ramalan`),
    ]
  }, msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  name   : '.menu',
  command: ['.menu', '.help', '.start'],

  async execute(conn, sender, args, msg) {
    const p   = getPrefix();
    const ver = getMenuVer();
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const tgl = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

    if (ver === 'v1') {
      await menuV1(conn, sender, msg, p, jam, tgl);
    } else {
      try {
        await menuV2(conn, sender, msg, p, jam, tgl);
      } catch (e) {
        console.error('[menu-v2] error, fallback ke v1:', e.message);
        await menuV1(conn, sender, msg, p, jam, tgl);
      }
    }
  }
};
