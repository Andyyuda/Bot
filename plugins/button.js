/**
 * .button — Demo & contoh penggunaan tombol interaktif WhatsApp
 *
 * Penggunaan:
 *   .button          → tampilkan semua jenis tombol
 *   .button copy     → contoh tombol salin teks
 *   .button url      → contoh tombol buka link
 *   .button reply    → contoh tombol balas cepat
 *   .button mix      → contoh kombinasi semua tombol
 */

const btn     = require('../lib/button');
const setting = require('../setting');
const { isOwner } = require('../lib/helper');

module.exports = {
  name: '.button',
  command: ['.button', '.btn'],

  async execute(sock, sender, args, msg) {
    const jid   = msg.key.participant || msg.key.remoteJid;
    if (!isOwner(jid, setting.owner)) {
      return sock.sendMessage(sender, {
        text: '❌ Hanya *owner* yang bisa mengakses fitur ini.'
      }, { quoted: msg });
    }

    const sub = (args[0] || '').toLowerCase();

    // ── Copy button ───────────────────────────────────────────────────────────
    if (sub === 'copy') {
      return btn.sendButtons(sock, sender, {
        body   : '📋 *Contoh Tombol Salin*\n\nKlik tombol di bawah untuk menyalin teks ke clipboard.',
        footer : 'AndyStore Bot',
        buttons: [
          btn.ctaCopy('📋 Salin Nomor Owner', '628xxxxxxxxxxxx'),
          btn.ctaCopy('📋 Salin Token Bot',   'ANDYSTORE-TOKEN-2024'),
          btn.ctaCopy('📋 Salin Prefix',      setting.prefix ?? '.'),
        ]
      }, msg);
    }

    // ── URL button ────────────────────────────────────────────────────────────
    if (sub === 'url') {
      return btn.sendButtons(sock, sender, {
        body   : '🔗 *Contoh Tombol Link*\n\nKlik tombol untuk membuka URL di browser.',
        footer : 'AndyStore Bot',
        buttons: [
          btn.ctaUrl('🌐 GitHub Bot',     'https://github.com/Andyyuda/Bot'),
          btn.ctaUrl('💬 Chat Owner',     'https://wa.me/628xxxxxxxxxxxx'),
          btn.ctaUrl('📦 NPM Baileys',    'https://www.npmjs.com/package/@whiskeysockets/baileys'),
        ]
      }, msg);
    }

    // ── Quick reply button ────────────────────────────────────────────────────
    if (sub === 'reply') {
      return btn.sendButtons(sock, sender, {
        body   : '⚡ *Contoh Tombol Balas Cepat*\n\nKlik tombol untuk mengirim perintah ke bot.',
        footer : 'AndyStore Bot',
        buttons: [
          btn.quickReply('📜 Buka Menu',   '.menu'),
          btn.quickReply('🏓 Ping',        '.ping'),
          btn.quickReply('👤 ID Saya',     '.myid'),
        ]
      }, msg);
    }

    // ── Mix button ────────────────────────────────────────────────────────────
    if (sub === 'mix') {
      return btn.sendButtons(sock, sender, {
        body   : '🎛️ *Contoh Kombinasi Tombol*\n\nMaksimum 3 tombol per pesan interaktif.',
        footer : 'AndyStore Bot',
        buttons: [
          btn.quickReply('📜 Menu',                '.menu'),
          btn.ctaCopy('📋 Salin Prefix',           setting.prefix ?? '.'),
          btn.ctaUrl('🌐 GitHub',  'https://github.com/Andyyuda/Bot'),
        ]
      }, msg);
    }

    // ── Default: tampilkan semua contoh ──────────────────────────────────────
    return btn.sendButtons(sock, sender, {
      body:
        '🤖 *Demo Tombol Interaktif AndyStore Bot*\n\n' +
        'Pilih jenis tombol yang ingin dicoba:\n\n' +
        '• `.button copy`  → Tombol salin teks\n' +
        '• `.button url`   → Tombol buka link\n' +
        '• `.button reply` → Tombol balas cepat\n' +
        '• `.button mix`   → Kombinasi semua',
      footer: 'AndyStore Bot • Pilih kategori di bawah',
      buttons: [
        btn.quickReply('📋 Copy Button',  '.button copy'),
        btn.quickReply('🔗 URL Button',   '.button url'),
        btn.quickReply('⚡ Quick Reply',  '.button reply'),
      ]
    }, msg);
  }
};
