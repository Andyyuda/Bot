module.exports = {
  name: '.menu',
  command: ['.menu'],
  async execute(conn, sender, args, msg) {
    const menu = `
*📜 MENU BOT WHATSAPP*

🔑 *Setup & Owner*
> .myid ← lihat ID kamu (LID/JID)
> .regowner <pin> ← daftar jadi owner pakai PIN
> .addowner <id> ← tambah owner baru
> .delowner <id> ← hapus owner
> .owner ← daftar owner aktif

📂 *Plugin Management*
> .addplugin <nama.js> + kode
> .delplugin <nama.js>
> .getplugin <nama.js>
> .restart ← restart bot
> .delsampah ← hapus file sampah sesi

👥 *Group Tools*
> .add 628xxxxx
> .kick @tag
> .mute @tag ← blokir kiriman dari member
> .unmute @tag ← buka blokir member
> .welcome on/off ← sambutan masuk
> .leave on/off ← sambutan keluar

🧠 *Bot Utility*
> .ping ← tes koneksi & status
> .menu ← tampilkan menu ini
> .jadibot ← bot clone WhatsApp
> .addproduk ← tambah produk via sesi
> $ <cmd> ← perintah shell (khusus owner)

🖥️ *Server Tools*
> .installsc <ip> <password>
> .regisip <ip> <nama> <hari>
> .perpanjangip <ip> <hari>
> .bersihkanip ← hapus IP expired dari GitHub

🔧 *Akun Tools*
> .addtr <username> <exp> ← buat akun Trojan
> .addvl <username> <exp> ← buat akun VLESS
> .addvm <username> <exp> ← buat akun VMess
> .buatssh ← buat akun SSH via sesi
> .trialssh ← akun SSH trial 60 menit
> .trialtr ← akun Trojan trial 60 menit
> .trialvl ← akun VLESS trial 60 menit
> .trialvm ← akun VMess trial 60 menit

🛠️ Hanya *owner* yang dapat mengakses plugin dan fitur sistem.

Bot by @andyyuda28
    `.trim();

    await conn.sendMessage(sender, { text: menu }, { quoted: msg });
  }
};
