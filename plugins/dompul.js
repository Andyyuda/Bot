/**
 * .dompul <nomor> — Cek paket & kuota nomor XL/Dompul
 * Contoh: .dompul 087812345678
 */

module.exports = {
  name: '.dompul',
  command: ['.dompul', '.sidompul', '.cekpaket'],

  async execute(conn, sender, args, msg) {
    const reply = (text) => conn.sendMessage(sender, { text }, { quoted: msg });

    if (!args[0]) {
      return reply(
        '📲 *CEK PAKET DOMPUL*\n\n' +
        'Masukkan nomor setelah perintah.\n' +
        'Contoh:\n' +
        '*.dompul 087812345678*\n' +
        '*.dompul 62878xxxx*'
      );
    }

    let nomor = args[0].replace(/[\s\-]/g, '');
    if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1);

    await reply(`🔍 Mengecek nomor *${nomor}*...\nHarap tunggu sebentar.`);

    try {
      const res = await fetch('https://end.kaje-store.com/api/sidompul/check_package', {
        method: 'POST',
        headers: {
          'x-token-auth': 'mm8D4vAWXV6Q35WLMeK2fXy',
          'x-ip-visitor': '192.241.152.59',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ number: nomor, device_id: 'fake' })
      });

      const data = await res.json();

      if (!data?.success) {
        return reply(`❌ ${data?.message || 'Gagal mengecek paket, coba lagi nanti.'}`);
      }

      const d = data.data;
      let teks = `✅ *Cek Paket Dompul Berhasil!*\n\n`;
      teks += `📞 *Nomor:* ${nomor}\n`;
      teks += `📡 *Provider:* ${d.prefix?.value || '-'}\n`;
      teks += `🏛️ *Status Dukcapil:* ${d.dukcapil?.value || '-'}\n`;
      teks += `🗓️ *Umur Kartu:* ${d.active_card?.value || '-'}\n`;
      teks += `📆 *Masa Aktif:* ${d.active_period?.value || '-'}\n`;
      teks += `⌛ *Akhir Tenggang:* ${d.grace_period?.value || '-'}\n`;
      teks += `📶 *Status SIM:* ${d.status_4g?.value || '-'}\n\n`;
      teks += `📦 *Detail Kuota:*\n\n`;

      const quotas = d.quotas?.value || [];
      if (quotas.length === 0) {
        teks += `- Tidak ada kuota terdaftar.\n`;
      } else {
        for (const paket of quotas) {
          teks += `📌 *${paket.name}*\n`;
          teks += `   ├ 📆 *Aktif Sampai:* ${paket.date_end}\n`;
          const details = paket.detail_quota || [];
          details.forEach((kuota, i) => {
            const isLast = i === details.length - 1;
            teks += `   ${isLast ? '└' : '├'} ${kuota.name}: *${kuota.remaining_text}* dari ${kuota.total_text}\n`;
          });
          teks += '\n';
        }
      }

      await reply(teks);
    } catch (e) {
      await reply(`❌ Terjadi kesalahan:\n${e.message}`);
    }
  }
};
