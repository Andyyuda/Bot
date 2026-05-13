/**
 * .dompul <nomor> — Cek paket & kuota nomor XL/Dompul
 * Contoh: .dompul 087812345678
 */

const API_URL  = 'https://apigw.kmsp-store.com/sidompul/v4/cek_kuota';
const HEADERS  = {
  'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw',
  'X-API-Key'    : '60ef29aa-a648-4668-90ae-20951ef90c55',
  'X-App-Version': '4.0.0'
};

module.exports = {
  name: '.dompul',
  command: ['.dompul', '.sidompul', '.cekpaket'],

  async execute(conn, sender, args, msg) {
    const reply = (text) => conn.sendMessage(sender, { text }, { quoted: msg });

    if (!args[0]) {
      return reply(
        '📲 *CEK PAKET DOMPUL (XL)*\n\n' +
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
      const res  = await fetch(`${API_URL}?msisdn=${nomor}&isJSON=true`, { headers: HEADERS });
      const data = await res.json();

      if (!data?.status) {
        return reply(`❌ ${data?.message || 'Gagal mengecek paket, coba lagi nanti.'}`);
      }

      const d = data.data?.data_sp;

      let teks = `✅ *Cek Paket Dompul Berhasil!*\n\n`;
      teks += `📞 *Nomor:* ${nomor}\n`;
      teks += `📡 *Provider:* ${d.prefix?.value || '-'}\n`;
      teks += `🏛️ *Status Dukcapil:* ${d.dukcapil?.value || '-'}\n`;
      teks += `🗓️ *Umur Kartu:* ${d.active_card?.value || '-'}\n`;
      teks += `📆 *Masa Aktif:* ${d.active_period?.value || '-'}\n`;
      teks += `⌛ *Akhir Tenggang:* ${d.grace_period?.value || '-'}\n`;
      teks += `📶 *Status 4G:* ${d.status_4g?.value || '-'}\n`;

      const volte = d.status_volte?.value;
      if (volte) {
        teks += `📳 *VoLTE:* Device ${volte.device ? '✅' : '❌'} | Area ${volte.area ? '✅' : '❌'} | SIM ${volte.simcard ? '✅' : '❌'}\n`;
      }

      teks += `\n📦 *Detail Kuota:*\n\n`;

      const quotas = d.quotas?.value || [];
      if (quotas.length === 0) {
        teks += `- Tidak ada kuota terdaftar.\n`;
      } else {
        for (const paket of quotas) {
          teks += `📌 *${paket.name}*\n`;
          if (paket.date_end) teks += `   ├ 📆 *Aktif Sampai:* ${paket.date_end}\n`;
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
