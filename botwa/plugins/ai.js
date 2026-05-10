/**
 * .ai / .chat — Chat dengan AI (Pollinations.ai, gratis tanpa API key)
 */
const fetch = require('node-fetch');

const SYSTEM = `Kamu adalah AndyBot AI, asisten WhatsApp yang ramah, cerdas, dan seru. 
Jawab dalam bahasa Indonesia yang santai. Jawab singkat dan padat (max 3 paragraf).
Kalau ditanya soal kode/teknis, bantu dengan jelas.`;

const history = new Map(); // per JID, simpan riwayat chat

module.exports = {
  name: '.ai',
  command: ['.ai', '.chat', '.tanya', '.andy'],

  async execute(conn, sender, args, msg) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return conn.sendMessage(sender, {
        text: `🤖 *AndyBot AI*\n\nGunakan: _.ai <pertanyaan>_\n\nContoh:\n• .ai siapa presiden Indonesia?\n• .ai buatkan puisi tentang hujan\n• .ai jelaskan cara kerja VPN\n\n📝 Ketik _.resetai_ untuk hapus riwayat chat`
      }, { quoted: msg });
    }

    const jid = msg.key.remoteJid;
    if (!history.has(jid)) history.set(jid, []);
    const hist = history.get(jid);

    hist.push({ role: 'user', content: prompt });
    if (hist.length > 10) hist.splice(0, hist.length - 10); // max 10 pesan

    await conn.sendMessage(sender, { react: { text: '🤔', key: msg.key } });

    try {
      const messages = [
        { role: 'system', content: SYSTEM },
        ...hist
      ];

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: 'openai',
          private: true
        }),
        timeout: 30000
      });

      const text = await res.text();
      if (!text || text.trim().length === 0) throw new Error('Respon kosong');

      hist.push({ role: 'assistant', content: text.trim() });
      history.set(jid, hist);

      await conn.sendMessage(sender, { react: { text: '✅', key: msg.key } });
      await conn.sendMessage(sender, {
        text: `🤖 *AndyBot AI*\n\n${text.trim()}\n\n_Tanya lagi: .ai <pertanyaan>_`
      }, { quoted: msg });

    } catch (e) {
      await conn.sendMessage(sender, { react: { text: '❌', key: msg.key } });
      await conn.sendMessage(sender, {
        text: `❌ AI sedang sibuk, coba lagi sebentar.\n_Error: ${e.message}_`
      }, { quoted: msg });
    }
  }
};
