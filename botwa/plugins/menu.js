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

🎵 *[ HIBURAN ]*
┌─────────────────────
│ ${p}play  ${p}stop  ${p}ping  ${p}jadibot
└─────────────────────

━━━━━━━━━━━━━━━━━━━━━━━
✨ *AndyStore Bot* — Powered by dgxeon-soket v7
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

    // ── 2. Kirim proto interactive button (single_select dropdown) ────────────
    try {
      await sendInteractive(conn, sender, {
        title : '🤖 AndyStore Bot',
        body  : `⚡ *Aksi Cepat* — prefix: \`${p || 'none'}\`\nPilih perintah:`,
        footer: 'AndyStore Bot • @andyyuda28',
        buttons: [
          singleSelect('📋 Pilih Menu', [
            {
              title: '🔥 Populer',
              rows : [
                { title: '🏓 Ping Bot',     description: 'Tes kecepatan bot',          id: `${p}ping` },
                { title: '🎵 Putar Musik',  description: 'YouTube audio',               id: `${p}play` },
                { title: '👤 ID Saya',      description: 'Lihat ID / nomor kamu',       id: `${p}myid` },
                { title: '📜 Menu Lengkap', description: 'Tampilkan menu lagi',          id: `${p}menu` },
              ]
            },
            {
              title: '👑 Owner & Bot',
              rows : [
                { title: '⚙️ Ganti Prefix', description: 'Ubah prefix perintah',       id: `${p}setprefix` },
                { title: '🔑 Daftar Owner', description: 'Daftar jadi owner via PIN',   id: `${p}regowner` },
                { title: '🔄 Restart Bot',  description: 'Restart ulang bot',           id: `${p}restart` },
              ]
            },
            {
              title: '🔐 Akun VPN',
              rows : [
                { title: '🔐 Buat SSH',    description: 'Buat akun SSH baru',          id: `${p}buatssh` },
                { title: '⚡ Trial SSH',   description: 'SSH trial 60 menit',           id: `${p}trialssh` },
                { title: '🌀 Buat Trojan', description: 'Buat akun Trojan',             id: `${p}addtr` },
                { title: '💠 Buat VLESS',  description: 'Buat akun VLESS',             id: `${p}addvl` },
              ]
            },
            {
              title: '👥 Grup',
              rows : [
                { title: '➕ Add Member',  description: 'Tambah member ke grup',       id: `${p}add` },
                { title: '🚫 Kick Member', description: 'Keluarkan member',             id: `${p}kick` },
                { title: '🔇 Mute Member', description: 'Bisukan member di grup',       id: `${p}mute` },
              ]
            }
          ]),
          quickReply('🏓 Ping', `${p}ping`),
          quickReply('🎵 Play', `${p}play`),
        ]
      }, msg);
    } catch (e) {
      console.error('[menu] Proto button error:', e.message);
      // Fallback ke list message
      try {
        await sendList(conn, sender, {
          body    : `⚡ *Aksi Cepat* — prefix: \`${p || 'none'}\``,
          footer  : 'AndyStore Bot',
          btnLabel: '📋 Pilih Perintah',
          sections: [
            { title: '🔥 Populer', rows: [
              { title: '🏓 Ping', rowId: `${p}ping`, description: 'Tes kecepatan' },
              { title: '🎵 Play', rowId: `${p}play`, description: 'Putar musik' },
              { title: '👤 ID',   rowId: `${p}myid`, description: 'Lihat ID kamu' },
            ]},
            { title: '⚙️ Bot', rows: [
              { title: '🔄 Restart',      rowId: `${p}restart` },
              { title: '⚙️ Ganti Prefix', rowId: `${p}setprefix` },
            ]}
          ]
        }, msg);
      } catch (e2) {
        console.error('[menu] List fallback error:', e2.message);
      }
    }
  }
};
