/**
 * .menu — Logo AndyStore + menu teks + proto interactive buttons
 */

const fs   = require('fs');
const path = require('path');
const setting = require('../setting');
const { sendInteractive, sendList, quickReply, singleSelect } = require('../lib/button');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

function getPrefix() {
  let prefix = setting.prefix ?? '.';
  try {
    const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/prefix.json')));
    if (typeof db.prefix === 'string') prefix = db.prefix;
  } catch {}
  return prefix;
}

module.exports = {
  name   : '.menu',
  command: ['.menu', '.help', '.start'],

  async execute(conn, sender, args, msg) {
    const p   = getPrefix();
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const tgl = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

    const menuText = `╔══════════════════════╗
║   🤖  *ANDYSTORE BOT*   ║
╚══════════════════════╝

🕐 *${jam} WIB*  •  📅 *${tgl}*
━━━━━━━━━━━━━━━━━━━━━━━

👑 *[ OWNER & SETUP ]*
┌─────────────────────
│ ${p}myid       → Lihat ID kamu
│ ${p}regowner   → Daftar owner (PIN)
│ ${p}addowner   → Tambah owner baru
│ ${p}setprefix  → Ganti prefix bot
└─────────────────────

⚙️ *[ MANAJEMEN BOT ]*
┌─────────────────────
│ ${p}restart    → Restart bot
│ ${p}addplugin  → Upload plugin baru
│ ${p}delplugin  → Hapus plugin
│ $ <cmd>        → Jalankan shell
└─────────────────────

👥 *[ GRUP TOOLS ]*
┌─────────────────────
│ ${p}add   ${p}kick   ${p}mute   ${p}unmute
│ ${p}welcome   ${p}leave
└─────────────────────

🔐 *[ AKUN VPN ]*
┌─────────────────────
│ ${p}buatssh  ${p}trialssh  ${p}addtr  ${p}trialtr
│ ${p}addvl    ${p}trialvl   ${p}addvm  ${p}trialvm
└─────────────────────

🤖 *[ AI & PINTAR ]*
┌─────────────────────
│ ${p}ai <tanya>  → Chat dengan AI
│ ${p}andy        → Alias .ai
│ ${p}resetai     → Reset riwayat AI
└─────────────────────

🎮 *[ PERMAINAN ]*
┌─────────────────────
│ ${p}tebakangka  → Tebak angka 1-100
│ ${p}tebak <N>   → Jawab tebak angka
│ ${p}tebakkata   → Hangman tebak kata
│ ${p}tk <huruf>  → Tebak huruf hangman
│ ${p}suit batu/gunting/kertas
│ ${p}dadu [N]    → Lempar dadu
│ ${p}koin        → Lempar koin
│ ${p}quiz        → Kuis trivia
│ ${p}jawab A/B/C/D
│ ${p}truth       → Truth or Dare
│ ${p}dare        → Dapat tantangan
│ ${p}tod         → Truth atau Dare acak
└─────────────────────

✨ *[ SERU-SERUAN ]*
┌─────────────────────
│ ${p}ramalan     → Ramalan hari ini
│ ${p}horoscope   → Horoskop zodiak
│ ${p}angkahoki   → Angka keberuntungan
│ ${p}kata        → Quote motivasi
│ ${p}katacinta   → Kata-kata romantis
│ ${p}katafunny   → Kata-kata lucu
└─────────────────────

🎵 *[ MUSIK ]*
┌─────────────────────
│ ${p}play <judul> → Putar audio YT
└─────────────────────

━━━━━━━━━━━━━━━━━━━━━━━
✨ *AndyStore Bot* — Powered by andybot-socket
📞 Owner: @andyyuda28`;

    // ── 1. Kirim logo + menu teks ─────────────────────────────────────────────
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      await conn.sendMessage(sender, {
        image  : logoBuffer,
        caption: menuText,
        mimetype: 'image/png'
      }, { quoted: msg });
    } else {
      await conn.sendMessage(sender, { text: menuText }, { quoted: msg });
    }

    // ── 2. Kirim proto interactive button ─────────────────────────────────────
    try {
      await sendInteractive(conn, sender, {
        title : '🤖 AndyStore Bot',
        body  : `⚡ *Aksi Cepat* — prefix: \`${p || 'none'}\`\nPilih kategori:`,
        footer: 'AndyStore Bot • @andyyuda28',
        buttons: [
          singleSelect('📋 Pilih Menu', [
            {
              title: '🤖 AI & Pintar',
              rows : [
                { title: '🧠 Chat AI',       description: 'Tanya apa saja ke AI',         id: `${p}ai` },
                { title: '🗑️ Reset AI',      description: 'Hapus riwayat chat AI',         id: `${p}resetai` },
              ]
            },
            {
              title: '🎮 Permainan',
              rows : [
                { title: '🔢 Tebak Angka',   description: 'Tebak angka 1-100, 7 kesempatan', id: `${p}tebakangka` },
                { title: '📝 Tebak Kata',    description: 'Hangman kata bahasa Indonesia', id: `${p}tebakkata` },
                { title: '✂️ Suit',           description: 'Batu Gunting Kertas vs Bot',   id: `${p}suit` },
                { title: '🎲 Lempar Dadu',   description: 'Roll dadu 1-6',                 id: `${p}dadu` },
                { title: '🪙 Lempar Koin',   description: 'Heads atau Tails',              id: `${p}koin` },
                { title: '🧠 Quiz Trivia',   description: 'Kuis tanya jawab',              id: `${p}quiz` },
                { title: '💭 Truth or Dare', description: 'Truth, Dare, atau acak',        id: `${p}tod` },
              ]
            },
            {
              title: '✨ Seru-Seruan',
              rows : [
                { title: '🔮 Ramalan',       description: 'Ramalan harian',               id: `${p}ramalan` },
                { title: '⭐ Horoskop',      description: 'Horoskop zodiak',              id: `${p}horoscope` },
                { title: '🍀 Angka Hoki',    description: 'Angka keberuntungan hari ini', id: `${p}angkahoki` },
                { title: '💪 Kata Motivasi', description: 'Quote inspiratif',             id: `${p}kata` },
                { title: '❤️ Kata Cinta',    description: 'Kata-kata romantis',           id: `${p}katacinta` },
                { title: '😂 Kata Lucu',     description: 'Quote humor',                  id: `${p}katafunny` },
              ]
            },
            {
              title: '🔥 Populer',
              rows : [
                { title: '🏓 Ping Bot',      description: 'Tes kecepatan bot',            id: `${p}ping` },
                { title: '🎵 Play Musik',    description: 'Putar audio YouTube',          id: `${p}play` },
                { title: '👤 ID Saya',       description: 'Lihat nomor/ID kamu',          id: `${p}myid` },
              ]
            },
            {
              title: '👑 Owner & Bot',
              rows : [
                { title: '⚙️ Ganti Prefix',  description: 'Ubah prefix perintah',         id: `${p}setprefix` },
                { title: '🔑 Daftar Owner',  description: 'Daftar jadi owner via PIN',    id: `${p}regowner` },
                { title: '🔄 Restart Bot',   description: 'Restart ulang bot',            id: `${p}restart` },
              ]
            },
          ]),
          quickReply('🤖 AI', `${p}ai`),
          quickReply('🎮 Game', `${p}tebakangka`),
        ]
      }, msg);
    } catch (e) {
      console.error('[menu] Proto button error:', e.message);
      try {
        await sendList(conn, sender, {
          body    : `⚡ *Aksi Cepat* — prefix: \`${p || 'none'}\``,
          footer  : 'AndyStore Bot',
          btnLabel: '📋 Pilih Perintah',
          sections: [
            { title: '🤖 AI', rows: [
              { title: '🧠 Chat AI', rowId: `${p}ai`, description: 'Tanya apa saja ke AI' },
            ]},
            { title: '🎮 Game', rows: [
              { title: '🔢 Tebak Angka', rowId: `${p}tebakangka` },
              { title: '✂️ Suit',         rowId: `${p}suit` },
              { title: '🧠 Quiz',         rowId: `${p}quiz` },
              { title: '💭 Truth/Dare',   rowId: `${p}tod` },
            ]},
            { title: '✨ Seru', rows: [
              { title: '🔮 Ramalan',     rowId: `${p}ramalan` },
              { title: '💪 Kata Motivasi', rowId: `${p}kata` },
            ]}
          ]
        }, msg);
      } catch {}
    }
  }
};
