/**
 * .menu — Tampilkan menu bot dengan logo AndyStore
 */

const fs      = require('fs');
const path    = require('path');
const setting = require('../setting');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

module.exports = {
  name: '.menu',
  command: ['.menu', '.help', '.start'],

  async execute(conn, sender, args, msg) {
    // Ambil prefix aktif
    let prefix = setting.prefix ?? '.';
    try {
      const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/prefix.json')));
      if (typeof db.prefix === 'string') prefix = db.prefix;
    } catch {}

    const p = prefix; // shorthand

    const now   = new Date();
    const jam   = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const tgl   = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

    const menu = `╔══════════════════════╗
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

    // Kirim logo + menu sebagai caption
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      await conn.sendMessage(sender, {
        image: logoBuffer,
        caption: menu,
        mimetype: 'image/png'
      }, { quoted: msg });
    } else {
      // Fallback teks saja jika logo tidak ada
      await conn.sendMessage(sender, { text: menu }, { quoted: msg });
    }
  }
};
