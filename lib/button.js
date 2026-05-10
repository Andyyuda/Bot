/**
 * lib/button.js
 * Helper untuk membuat dan mengirim pesan interaktif (tombol) via Baileys.
 *
 * Jenis tombol yang didukung:
 *   quickReply(label, id?)     → tombol balas cepat (kirim pesan ke bot)
 *   ctaCopy(label, teks)       → tombol salin teks ke clipboard
 *   ctaUrl(label, url, dead?)  → tombol buka URL / link
 *   ctaCall(label, nomor)      → tombol telepon
 *
 * Cara pakai:
 *   const btn = require('../lib/button');
 *
 *   await btn.sendButtons(sock, sender, {
 *     body   : 'Pilih kategori menu:',
 *     footer : 'AndyStore Bot',
 *     image  : fs.readFileSync('./assets/logo.png'),   // opsional
 *     buttons: [
 *       btn.quickReply('📜 Menu Lengkap', '.menu'),
 *       btn.ctaCopy('📋 Salin Prefix', '.'),
 *       btn.ctaUrl('🌐 GitHub', 'https://github.com/Andyyuda/Bot'),
 *     ]
 *   }, quotedMsg);
 */

const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

// ── Pembuat tombol ────────────────────────────────────────────────────────────

/**
 * Tombol balas cepat — saat diklik akan mengirim `id` sebagai pesan teks
 */
function quickReply(label, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: label, id: id ?? label })
  };
}

/**
 * Tombol salin teks ke clipboard
 */
function ctaCopy(label, copyText) {
  return {
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      id: label,
      copy_code: copyText
    })
  };
}

/**
 * Tombol buka URL (link)
 * @param {boolean} deadUrl  true = link mati/non-aktif (hanya tampil), false = bisa diklik
 */
function ctaUrl(label, url, deadUrl = false) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      url,
      merchant_url: url,
      url_type: deadUrl ? 0 : 1
    })
  };
}

/**
 * Tombol telepon
 */
function ctaCall(label, phoneNumber) {
  return {
    name: 'cta_call',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      phone_number: phoneNumber
    })
  };
}

// ── Pembuat pesan interaktif ──────────────────────────────────────────────────

/**
 * Bangun proto InteractiveMessage
 * @param {object} opts
 * @param {string}   opts.body     - Teks utama
 * @param {string}   [opts.footer] - Teks kecil di bawah body
 * @param {Buffer}   [opts.image]  - Gambar header (opsional)
 * @param {string}   [opts.title]  - Judul teks header (jika tidak ada gambar)
 * @param {Array}    opts.buttons  - Array tombol dari helper di atas
 */
function buildInteractive({ body, footer, image, title, buttons }) {
  const IM = proto.Message.InteractiveMessage;

  // Header
  let header;
  if (image) {
    header = IM.Header.create({
      hasMediaAttachment: true,
      imageMessage: proto.Message.ImageMessage.create({
        mimetype: 'image/png',
        jpegThumbnail: image
      })
    });
  } else if (title) {
    header = IM.Header.create({ hasMediaAttachment: false, title });
  } else {
    header = IM.Header.create({ hasMediaAttachment: false });
  }

  return IM.create({
    header,
    body  : IM.Body.create({ text: body }),
    footer: IM.Footer.create({ text: footer ?? '' }),
    nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons })
  });
}

/**
 * Kirim pesan interaktif dengan tombol
 * @param {object} sock       - Socket Baileys
 * @param {string} jid        - JID tujuan (sender / remoteJid)
 * @param {object} opts       - Opsi pesan (body, footer, image, title, buttons)
 * @param {object} [quoted]   - Pesan yang dikutip (opsional)
 */
async function sendButtons(sock, jid, opts, quoted) {
  const interactive = buildInteractive(opts);

  const generated = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: { interactiveMessage: interactive }
      }
    },
    { quoted }
  );

  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

/**
 * Kirim pesan interaktif dengan gambar sebagai header terpisah
 * (cara alternatif yang lebih kompatibel di semua versi WA)
 */
async function sendButtonsWithImage(sock, jid, opts, quoted) {
  const interactive = buildInteractive({ ...opts, image: undefined });

  // Kirim gambar dulu jika ada
  if (opts.image) {
    await sock.sendMessage(jid, {
      image: opts.image,
      caption: opts.body,
      mimetype: 'image/png'
    }, { quoted });
  }

  // Lalu kirim tombol
  const generated = await generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: { interactiveMessage: interactive }
      }
    },
    {}
  );

  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

module.exports = {
  // Pembuat tombol
  quickReply,
  ctaCopy,
  ctaUrl,
  ctaCall,
  // Pengirim
  sendButtons,
  sendButtonsWithImage,
  // Low-level jika perlu custom
  buildInteractive
};
