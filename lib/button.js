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

  const LM = proto.Message.ListMessage;

  // Build ListMessage via proto (cara yang benar di Baileys 6.x)
  const listMessage = LM.create({
    title      : title,
    description: body,
    footerText : footer,
    buttonText : btnLabel,
    listType   : LM.ListType.SINGLE_SELECT,
    sections   : sections.map(s => LM.Section.create({
      title: s.title ?? '',
      rows : (s.rows ?? []).map(r => LM.Row.create({
        title      : r.title ?? '',
        description: r.description ?? '',
        rowId      : r.rowId ?? r.title ?? ''
      }))
    }))
  });

  const generated = await generateWAMessageFromContent(
    jid,
    { listMessage },
    { quoted, userJid: sock.user?.id }
  );

  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

// ─────────────────────────────────────────────────────────────────────────────
// METODE 2: POLL MESSAGE (100% bekerja di semua WA personal & business)
// ─────────────────────────────────────────────────────────────────────────────

// Registry global untuk menyimpan poll yang aktif
if (!global.pollRegistry) global.pollRegistry = {};

/**
 * Kirim poll interaktif (PASTI muncul di semua WA).
 * Saat user pilih opsi, bot otomatis jalankan perintah terkait.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts
 *   @param {string}  opts.question   - Pertanyaan / judul poll
 *   @param {Array}   opts.options    - Array: [{ label: 'Teks', command: '.ping' }]
 *   @param {string}  [opts.body]     - Teks sebelum poll (opsional)
 * @param {object} [quoted]
 */
async function sendPoll(sock, jid, opts, quoted) {
  const { question = 'Pilih menu:', options = [], body } = opts;

  if (body) {
    await sock.sendMessage(jid, { text: body }, { quoted });
  }

  const labels = options.map(o => o.label);

  const sentMsg = await sock.sendMessage(jid, {
    poll: { name: question, values: labels, selectableCount: 1 }
  }, { quoted: body ? undefined : quoted });

  // Simpan di registry untuk response handler
  const pollId = sentMsg?.key?.id;
  if (pollId) {
    global.pollRegistry[pollId] = {
      options,    // [{ label, command }]
      jid,
      createdAt: Date.now()
    };
    // Bersihkan poll lama (> 2 jam)
    const now = Date.now();
    for (const [id, d] of Object.entries(global.pollRegistry)) {
      if (now - d.createdAt > 7200000) delete global.pollRegistry[id];
    }
  }

  return sentMsg;
}

// ─────────────────────────────────────────────────────────────────────────────
// METODE 3: LEGACY BUTTONS (buttonsMessage — kompatibel sebagian)
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
  sendPoll,          // ✅ PASTI muncul di semua WA
  sendList,          // ⚠️  butuh format proto benar
  sendLegacyButtons, // ⚠️  butuh WA lama
  sendButtons,       // 🔒 butuh WA Business
  quickReply, ctaCopy, ctaUrl, ctaCall
};
