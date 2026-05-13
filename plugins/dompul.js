/**
 * .dompul <nomor> — Cek paket & kuota nomor XL/AXIS
 * Contoh: .dompul 087812345678
 * Source: xl-ku.my.id/end.php
 */

const API_URL = 'https://xl-ku.my.id/end.php';

const CACHE_TTL = 30 * 60 * 1000; // cache 30 menit
const cache     = new Map(); // nomor → { teks, time }

function fmtSisa(ms) {
  const jam = Math.floor(ms / 3600000);
  const mnt = Math.floor((ms % 3600000) / 60000);
  return jam > 0 ? `${jam} jam ${mnt} menit` : `${mnt} menit`;
}

function buildTeks(nomor, data) {
  const s = data.subs_info;
  const p = data.package_info;

  let teks = `✅ *Cek Paket ${s.operator || 'XL'} Berhasil!*\n\n`;
  teks += `📞 *Nomor:* ${s.msisdn || nomor}\n`;
  teks += `📡 *Operator:* ${s.operator || '-'}\n`;
  teks += `🏛️ *Status Dukcapil:* ${s.id_verified || '-'}\n`;
  teks += `🗓️ *Umur Kartu:* ${s.tenure || '-'}\n`;
  teks += `📆 *Masa Aktif:* ${s.exp_date || '-'}\n`;
  teks += `⌛ *Akhir Tenggang:* ${s.grace_until || '-'}\n`;
  teks += `📶 *Status:* ${s.net_type || '-'}\n`;

  if (s.volte) {
    const v = s.volte;
    teks += `📳 *VoLTE:* Device ${v.device ? '✅' : '❌'} | Area ${v.area ? '✅' : '❌'} | SIM ${v.simcard ? '✅' : '❌'}\n`;
  }

  teks += `\n📦 *Detail Kuota:*\n\n`;

  if (p?.error_message) {
    teks += `⚠️ ${p.error_message}\n`;
  } else {
    const pkgs = p?.packages || [];
    if (pkgs.length === 0) {
      teks += `- Tidak ada kuota terdaftar.\n`;
    } else {
      for (const paket of pkgs) {
        teks += `📌 *${paket.name}*\n`;
        if (paket.expiry) teks += `   ├ 📆 *Aktif Sampai:* ${paket.expiry}\n`;
        const quotas = paket.quotas || [];
        quotas.forEach((q, i) => {
          const isLast = i === quotas.length - 1;
          const bar    = q.percent != null ? ` (${Math.round(q.percent)}%)` : '';
          const sisa   = q.remaining !== q.total
            ? `${q.remaining} / ${q.total}`
            : q.total;
          teks += `   ${isLast ? '└' : '├'} ${q.name}: *${sisa}*${bar}\n`;
        });
        teks += '\n';
      }
    }
  }

  return teks;
}

module.exports = {
  name: '.dompul',
  command: ['.dompul', '.sidompul', '.cekpaket'],

  async execute(conn, sender, args, msg) {
    const reply = (text) => conn.sendMessage(sender, { text }, { quoted: msg });

    if (!args[0]) {
      return reply(
        '📲 *CEK PAKET XL / AXIS*\n\n' +
        'Masukkan nomor setelah perintah.\n' +
        'Contoh:\n' +
        '*.dompul 087812345678*\n' +
        '*.dompul 62878xxxx*'
      );
    }

    let nomor = args[0].replace(/[\s\-]/g, '');
    if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1);

    // Cek cache dulu
    const cached = cache.get(nomor);
    if (cached) {
      const sisaTTL = CACHE_TTL - (Date.now() - cached.time);
      if (sisaTTL > 0) {
        return reply(
          cached.teks +
          `_📦 Data cache · diperbarui ${fmtSisa(Date.now() - cached.time)} lalu_\n` +
          `_🔄 Refresh dalam ${fmtSisa(sisaTTL)}_`
        );
      }
      cache.delete(nomor);
    }

    await reply(`🔍 Mengecek nomor *${nomor}*...\nHarap tunggu sebentar.`);

    try {
      const url = `${API_URL}?check=package&number=${nomor}&version=2`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();

      if (!data?.success) {
        return reply(`❌ ${data?.message || 'Gagal mengecek paket, coba lagi nanti.'}`);
      }

      const teks = buildTeks(nomor, data.data);

      cache.set(nomor, { teks, time: Date.now() });
      await reply(teks);
    } catch (e) {
      await reply(`❌ Terjadi kesalahan:\n${e.message}`);
    }
  }
};
