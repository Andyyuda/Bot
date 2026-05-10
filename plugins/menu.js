/**
 * .menu — Tampilkan menu bot dengan logo AndyStore + tombol interaktif
 */

const fs   = require('fs');
const path = require('path');
const setting = require('../setting');
const btn  = require('../lib/button');

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
  name: '.menu',
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
│ ${p}delowner   → Hapus owner
│ ${p}owner      → Daftar owner aktif
│ ${p}setprefix  → Ganti prefix bot
└─────────────────────

⚙️ *[ MANAJEMEN BOT ]*
┌─────────────────────
│ ${p}restart    → Restart bot
│ ${p}delsampah  → Bersihkan file sesi
│ ${p}addplugin  → Upload plugin baru
│ ${p}delplugin  → Hapus plugin
│ ${p}getplugin  → Download plugin
│ $ <cmd>     → Jalankan shell (owner)
└─────────────────────

👥 *[ GRUP TOOLS ]*
┌─────────────────────
│ ${p}add        → Tambah member
│ ${p}kick       → Keluarkan member
│ ${p}mute       → Bisukan member
│ ${p}unmute     → Buka bisuan member
│ ${p}welcome    → Pesan sambutan masuk
│ ${p}leave      → Pesan sambutan keluar
└─────────────────────

🛒 *[ TOKO & PRODUK ]*
┌─────────────────────
│ ${p}addproduk  → Tambah produk (sesi)
│ ${p}dompul     → Cek dompet/saldo
│ ${p}enc        → Enkripsi plugin
│ ${p}encall     → Enkripsi semua plugin
└─────────────────────

🖥️ *[ SERVER VPS ]*
┌─────────────────────
│ ${p}installsc  → Kirim script install
│ ${p}regisip    → Registrasi IP VPS
│ ${p}perpanjangip → Perpanjang IP
│ ${p}bersihkanip  → Hapus IP expired
└─────────────────────

🔐 *[ AKUN VPN ]*
┌─────────────────────
│ ${p}buatssh    → Buat akun SSH (sesi)
│ ${p}trialssh   → SSH trial 60 menit
│ ${p}addtr      → Buat akun Trojan
│ ${p}trialtr    → Trojan trial 60 menit
│ ${p}addvl      → Buat akun VLESS
│ ${p}trialvl    → VLESS trial 60 menit
│ ${p}addvm      → Buat akun VMess
│ ${p}trialvm    → VMess trial 60 menit
└─────────────────────

🎵 *[ HIBURAN ]*
┌─────────────────────
│ ${p}play       → Putar lagu YouTube
│ ${p}stop       → Stop download audio
│ ${p}ping       → Tes kecepatan bot
│ ${p}jadibot    → Clone bot WhatsApp
└─────────────────────

━━━━━━━━━━━━━━━━━━━━━━━
✨ *AndyStore Bot* — Powered by Baileys
📞 Owner: @andyyuda28
━━━━━━━━━━━━━━━━━━━━━━━`;

    // ── 1. Kirim logo + full menu sebagai caption ─────────────────────────────
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      await conn.sendMessage(sender, {
        image: logoBuffer,
        caption: menuText,
        mimetype: 'image/png'
      }, { quoted: msg });
    } else {
      await conn.sendMessage(sender, { text: menuText }, { quoted: msg });
    }

    // ── 2. Kirim tombol aksi cepat di bawah menu ─────────────────────────────
    try {
      await btn.sendButtons(conn, sender, {
        body   : `⚡ *Aksi Cepat*\nPrefix aktif: \`${p || 'none'}\``,
        footer : 'AndyStore Bot • @andyyuda28',
        buttons: [
          btn.quickReply('🏓 Ping Bot',    `${p}ping`),
          btn.quickReply('🎵 Putar Musik', `${p}play`),
          btn.ctaCopy('📋 Salin Prefix',   p || 'none'),
          btn.ctaUrl('🌐 Source Code',     'https://github.com/Andyyuda/Bot'),
        ]
      }, msg);   // ← kirim msg agar tombol muncul sebagai reply
    } catch (e) {
      console.error('[menu] Button error:', e.message, e.stack?.split('\n')[1]);
    }
  }
};
