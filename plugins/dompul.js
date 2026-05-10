const fetch = require('node-fetch');

module.exports = {
  name: '.dompul',
  command: ['.dompul'],
  async execute(conn, sender, args, msg) {
    const reply = (text) => conn.sendMessage(sender, { text }, { quoted: msg });

    if (!args[0]) {
      return reply('📲 *CEK DOMPUL*\n\nMasukkan nomor setelah perintah.\nContoh:\n.dompul 087812345678');
    }

    const nomor = args[0].replace(/^0/, '62');

    try {
      const res = await fetch('https://sidompul.bendith.my.id/myxl/check_number', {
        method: 'POST',
        headers: {
          'x-ip-visitor': '192.241.152.59',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ number: nomor })
      });

      const json = await res.json();

      if (!json?.success) {
        return reply(`❌ ${json.message || 'Gagal mengecek data dompul.'}`);
      }

      const d = json.data;
      let teks = `✅ *Cek Dompul Berhasil!*\n\n`;
      teks += `📞 *Nomor:* ${nomor}\n`;
      teks += `📡 *Provider:* ${d.prefix?.value || '-'}\n`;
      teks += `🏛️ *Dukcapil:* ${d.dukcapil?.value || '-'}\n`;
      teks += `🗓️ *Umur Kartu:* ${d.active_card?.value || '-'}\n`;
      teks += `📆 *Masa Aktif:* ${d.active_period?.value || '-'}\n`;
      teks += `⌛ *Akhir Tenggang:* ${d.grace_period?.value || '-'}\n`;
      teks += `📶 *Status 4G:* ${d.status_4g?.value || '-'}\n\n`;

      teks += `📦 *Detail Kuota:*\n\n`;

      const quotas = d.quotas?.value || [];
      if (quotas.length === 0) {
        teks += `- Tidak ada kuota aktif.\n`;
      } else {
        quotas.forEach((paket) => {
          teks += `📌 *${paket.name}*\n`;
          teks += `   ├ 📆 Aktif sampai: ${paket.date_end}\n`;
          paket.detail_quota.forEach((kuota, i) => {
            const isLast = i === paket.detail_quota.length - 1;
            teks += `   ${isLast ? '└' : '├'} ${kuota.name}: *${kuota.remaining_text}* dari ${kuota.total_text}\n`;
          });
          teks += '\n';
        });
      }

      await reply(teks);
    } catch (e) {
      await reply(`❌ Terjadi kesalahan:\n${e.message}`);
    }
  }
};