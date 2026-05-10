/**
 * lib/button.js
 * Helper untuk membuat dan mengirim pesan interaktif (tombol) via Baileys.
 *
 * Jenis tombol:
 *   quickReply(label, id)        → tombol balas cepat (kirim perintah ke bot)
 *   ctaCopy(label, teks)         → tombol salin teks ke clipboard
 *   ctaUrl(label, url)           → tombol buka URL di browser
 *   ctaCall(label, nomor)        → tombol telepon langsung
 *
 * Cara pakai:
 *   const btn = require('../lib/button');
 *
 *   await btn.sendButtons(sock, sender, {
 *     body   : 'Pilih aksi:',
 *     footer : 'AndyStore Bot',
 *     buttons: [
 *       btn.quickReply('📜 Menu', '.menu'),
 *       btn.ctaCopy('📋 Salin', 'teks'),
 *       btn.ctaUrl('🌐 GitHub', 'https://github.com/Andyyuda/Bot'),
 *     ]
 *   }, quotedMsg);
 */

const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const IM = proto.Message.InteractiveMessage;

// ── Pembuat tombol ────────────────────────────────────────────────────────────

/** Tombol balas cepat — saat diklik mengirim `id` sebagai pesan */
function quickReply(label, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: label, id: id ?? label })
  };
}

/** Tombol salin teks ke clipboard */
function ctaCopy(label, copyText) {
  return {
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      id: label,
      copy_code: String(copyText)
    })
  };
}

/** Tombol buka URL di browser */
function ctaUrl(label, url) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      url,
      merchant_url: url
    })
  };
}

/** Tombol telepon langsung */
function ctaCall(label, phoneNumber) {
  return {
    name: 'cta_call',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      phone_number: String(phoneNumber)
    })
  };
}

// ── Kirim pesan interaktif ───────────────────────────────────────────────────

/**
 * Kirim pesan interaktif dengan tombol.
 * Menggunakan viewOnceMessage wrapper + proto.create() agar kompatibel
 * dengan semua versi WhatsApp.
 *
 * @param {object} sock     - Socket Baileys
 * @param {string} jid      - JID tujuan
 * @param {object} opts     - { body, footer, title, buttons }
 * @param {object} [quoted] - Pesan yang dikutip (opsional)
 */
async function sendButtons(sock, jid, opts, quoted) {
  const { body = '', footer = '', title = '', buttons = [] } = opts;

  // Header — teks judul jika ada, tanpa media
  const header = IM.Header.create({ hasMediaAttachment: false });
  if (title) header.title = title;

  // Bangun interactiveMessage pakai .create() (paling kompatibel)
  const interactiveMessage = IM.create({
    body  : IM.Body.create({ text: body }),
    footer: IM.Footer.create({ text: footer }),
    header,
    nativeFlowMessage: IM.NativeFlowMessage.create({ buttons })
  });

  // Bungkus di viewOnceMessage (format yang dipakai bot lain yang bekerja)
  const generated = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: { interactiveMessage }
      }
    },
    { quoted, userJid: sock.user?.id }
  );

  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

module.exports = { quickReply, ctaCopy, ctaUrl, ctaCall, sendButtons };
