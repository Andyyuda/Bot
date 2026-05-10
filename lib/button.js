/**
 * lib/button.js — Semua jenis tombol & list interaktif untuk WhatsApp bot
 *
 * Tiga metode pengiriman (dari paling ke kurang kompatibel di personal WA):
 *   sendList()            → List/menu dropdown — PALING KOMPATIBEL
 *   sendLegacyButtons()   → Tombol lama (buttonsMessage) — kompatibel sebagian
 *   sendButtons()         → interactiveMessage nativeFlow — butuh WA Business
 *
 * Helper tombol untuk sendButtons():
 *   quickReply(label, id)   ctaCopy(label, teks)
 *   ctaUrl(label, url)      ctaCall(label, nomor)
 */

const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const IM = proto.Message.InteractiveMessage;

// ─────────────────────────────────────────────────────────────────────────────
// METODE 1: LIST MESSAGE (paling kompatibel di personal WA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kirim list/menu dropdown interaktif.
 * Muncul sebagai tombol "Pilih" yang buka popup list saat diklik.
 * PALING kompatibel di semua versi WhatsApp personal.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts
 *   @param {string}   opts.body        - Teks utama
 *   @param {string}   [opts.footer]    - Teks kecil di bawah
 *   @param {string}   [opts.title]     - Judul header
 *   @param {string}   [opts.btnLabel]  - Label tombol "Pilih" (default: 'Pilih')
 *   @param {Array}    opts.sections    - Array section: [{ title, rows: [{title, rowId, description}] }]
 * @param {object} [quoted]
 */
async function sendList(sock, jid, opts, quoted) {
  const { body = '', footer = '', title = '', btnLabel = '📋 Pilih', sections = [] } = opts;
  await sock.sendMessage(jid, {
    text      : body,
    footer,
    title,
    buttonText: btnLabel,
    sections
  }, { quoted });
}

// ─────────────────────────────────────────────────────────────────────────────
// METODE 2: LEGACY BUTTONS (buttonsMessage — kompatibel sebagian)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kirim pesan dengan tombol lama (buttonsMessage).
 * Muncul sebagai tombol di bawah pesan, maks 3 tombol.
 * Bekerja di banyak versi WA tapi mungkin diblokir di beberapa WA terbaru.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts
 *   @param {string}  opts.body     - Teks utama
 *   @param {string}  [opts.footer] - Teks kecil di bawah
 *   @param {Array}   opts.buttons  - Array: [{ id, label }] maks 3
 * @param {object} [quoted]
 */
async function sendLegacyButtons(sock, jid, opts, quoted) {
  const { body = '', footer = '', buttons = [] } = opts;
  const formattedButtons = buttons.slice(0, 3).map((b, i) => ({
    buttonId  : b.id ?? String(i + 1),
    buttonText: { displayText: b.label ?? b.id ?? `Tombol ${i + 1}` },
    type      : 1
  }));
  await sock.sendMessage(jid, {
    text      : body,
    footer,
    buttons   : formattedButtons,
    headerType: 1
  }, { quoted });
}

// ─────────────────────────────────────────────────────────────────────────────
// METODE 3: INTERACTIVE / NATIVE FLOW (butuh WA Business atau penerima lain)
// ─────────────────────────────────────────────────────────────────────────────

/** Tombol balas cepat (quick_reply) */
function quickReply(label, id) {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: label, id: id ?? label })
  };
}

/** Tombol salin teks (cta_copy) */
function ctaCopy(label, copyText) {
  return {
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({ display_text: label, id: label, copy_code: String(copyText) })
  };
}

/** Tombol buka URL (cta_url) */
function ctaUrl(label, url) {
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: label, url, merchant_url: url })
  };
}

/** Tombol telepon (cta_call) */
function ctaCall(label, phoneNumber) {
  return {
    name: 'cta_call',
    buttonParamsJson: JSON.stringify({ display_text: label, phone_number: String(phoneNumber) })
  };
}

/**
 * Kirim interactiveMessage dengan nativeFlowMessage buttons.
 * Paling canggih tapi hanya render di WA Business / penerima tertentu.
 * Gunakan sendList() atau sendLegacyButtons() untuk personal WA.
 */
async function sendButtons(sock, jid, opts, quoted) {
  const { body = '', footer = '', title = '', buttons = [] } = opts;
  const header = IM.Header.create({ hasMediaAttachment: false });
  if (title) header.title = title;

  const interactiveMessage = IM.create({
    body  : IM.Body.create({ text: body }),
    footer: IM.Footer.create({ text: footer }),
    header,
    nativeFlowMessage: IM.NativeFlowMessage.create({ buttons })
  });

  const generated = await generateWAMessageFromContent(
    jid,
    { viewOnceMessage: { message: { interactiveMessage } } },
    { quoted, userJid: sock.user?.id }
  );
  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

module.exports = {
  // List (paling kompatibel)
  sendList,
  // Legacy buttons (sedang)
  sendLegacyButtons,
  // Interactive/nativeFlow (butuh WA Business)
  sendButtons,
  quickReply, ctaCopy, ctaUrl, ctaCall
};
