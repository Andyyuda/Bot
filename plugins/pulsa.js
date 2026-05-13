/**
 * Plugin Jualan Pulsa & Paket — isipulsa.web.id
 *
 * ── OWNER COMMANDS ────────────────────────────────────────────────
 *   .saldo                          — cek saldo akun isipulsa
 *   .trx [n]                        — n transaksi terakhir (default 5)
 *   .addpaket <kode> <voucher_id> <harga_jual> <nama>
 *                                   — tambah paket ke katalog
 *                                     contoh: .addpaket xl14gb 8021 75000 XL Flex M+ 14GB 28hr
 *   .delpaket <kode>                — hapus paket dari katalog
 *   .editpaket <kode> harga <baru>  — ubah harga paket
 *
 * ── CUSTOMER COMMANDS ─────────────────────────────────────────────
 *   .listpaket [operator]           — lihat daftar paket (semua / filter operator)
 *   .cekop <nomor>                  — deteksi operator dari nomor HP
 *   .beli <nomor> <kode_paket>      — beli paket (owner confirm dulu)
 *
 * ── KATALOG ───────────────────────────────────────────────────────
 *   disimpan di botwa/database/pulsa_catalog.json
 *   format: { "<kode>": { voucherId, harga, nama, operator, createdAt } }
 *
 * Konfigurasi: setting.js → isipulsa.username / token / appVersionCode
 */

const https   = require('https');
const zlib    = require('zlib');
const qs      = require('querystring');
const fs      = require('fs');
const path    = require('path');
const setting = require('../setting.js');

// ── Config
const BASE     = 'isipulsa.web.id';
const cfg      = setting.isipulsa || {};
const USERNAME = cfg.username       || '';
const TOKEN    = cfg.token          || '';
const VER      = cfg.appVersionCode || '250608';

// ── Catalog path
const CATALOG_PATH = path.join(__dirname, '../database/pulsa_catalog.json');

// ── In-memory state
const confirmPending = new Map(); // sender → { nomor, kode, expiry }
const validatorCache = { data: null, time: 0 };
const VALIDATOR_TTL  = 3_600_000; // 1 jam
const CONFIRM_TTL    = 60_000;    // 60 detik

// ──────────────────────────── CATALOG IO ────────────────────────────
function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_PATH)) return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {}
  return {};
}

function saveCatalog(data) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(data, null, 2));
}

// ──────────────────────────── API HELPER ────────────────────────────
function apiCall(apiPath, params) {
  return new Promise((resolve, reject) => {
    const body = qs.stringify({ app_version_code: VER, auth_username: USERNAME, auth_token: TOKEN, ...params });
    const req  = https.request({
      hostname: BASE, path: apiPath, method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'okhttp/4.12.0', 'accept-encoding': 'gzip', 'content-length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw  = Buffer.concat(chunks);
        const parse = buf => { try { resolve(JSON.parse(buf.toString())); } catch (e) { reject(e); } };
        (res.headers['content-encoding'] || '').includes('gzip')
          ? zlib.gunzip(raw, (e, b) => e ? reject(e) : parse(b))
          : parse(raw);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const apiGet   = p => apiCall('/api/v2/get', { vss: 1, ...p });
const apiOrder = p => apiCall('/api/v2/order', p);

// ──────────────────────────── OPERATOR DETECT ───────────────────────
async function getValidators() {
  if (validatorCache.data && Date.now() - validatorCache.time < VALIDATOR_TTL) return validatorCache.data;
  const res = await apiGet({ 'requests[2]': 'validators' });
  if (res.validators?.success) { validatorCache.data = res.validators.results; validatorCache.time = Date.now(); }
  return validatorCache.data || [];
}

function detectOperator(nomor, validators) {
  let n = String(nomor).replace(/\D/g, '');
  if (n.startsWith('62')) n = '0' + n.slice(2);
  for (const v of validators) {
    if (v.regex && new RegExp(v.regex).test(n)) return v.name;
  }
  return null;
}

// ──────────────────────────── UTILS ─────────────────────────────────
const rp      = n => `Rp ${Number(n).toLocaleString('id-ID')}`;
const isOwner = sender => {
  const num = sender.split('@')[0].split(':')[0];
  return setting.owner.some(o => num.includes(o) || o.includes(num));
};

// ──────────────────────────── MODULE ─────────────────────────────────
module.exports = {
  name: 'pulsa',
  command: ['.saldo', '.trx', '.addpaket', '.delpaket', '.editpaket', '.listpaket', '.cekop', '.beli'],

  // ── handleMessage: proses konfirmasi beli
  async handleMessage(conn, sender, text, msg) {
    const conf = confirmPending.get(sender);
    if (!conf) return false;
    if (Date.now() > conf.expiry) { confirmPending.delete(sender); return false; }

    const t = text.trim().toLowerCase();
    if (!['ya','iya','y','tidak','batal','cancel','no','n'].includes(t)) return false;

    confirmPending.delete(sender);
    const reply = txt => conn.sendMessage(sender, { text: txt }, { quoted: msg });

    if (['tidak','batal','cancel','no','n'].includes(t)) return reply('❎ Transaksi dibatalkan.'), true;

    // Lanjut beli
    await reply('⏳ Memproses transaksi...');
    try {
      const res = await apiOrder({ voucher_id: conf.voucherId, phone: conf.nomor, payment: 'balance' });
      if (res.status) {
        const catalog = loadCatalog();
        const paket   = catalog[conf.kode] || {};
        await reply(
          `✅ *Transaksi Berhasil!*\n\n` +
          `📞 Nomor: *${conf.nomor}*\n` +
          `📦 Paket: *${paket.nama || conf.kode}*\n` +
          `💵 Harga: *${rp(paket.harga || '-')}*\n` +
          `🆔 ID Transaksi: ${res.id || '-'}\n\n` +
          `Terima kasih sudah berbelanja! 🙏`
        );
      } else {
        await reply(`❌ *Transaksi Gagal*\n\n${res.message || 'Coba lagi nanti.'}`);
      }
    } catch (e) { await reply(`❌ Error: ${e.message}`); }
    return true;
  },

  async execute(conn, sender, args, msg) {
    const reply = txt => conn.sendMessage(sender, { text: txt }, { quoted: msg });
    const cmd   = (msg.body || '').trim().split(/\s+/)[0].toLowerCase();
    const owner = isOwner(sender);

    if (!USERNAME || !TOKEN) return reply('⚠️ Kredensial isipulsa belum diisi di setting.js');

    // ────────────────── .saldo ──────────────────
    if (cmd === '.saldo') {
      if (!owner) return reply('⛔ Perintah ini khusus owner.');
      try {
        const res = await apiGet({ 'requests[0]': 'balance' });
        const b   = res.balance?.results;
        return reply(`💰 *Saldo isipulsa*\n\n👤 ${USERNAME}\n💵 *${b?.balance_str || rp(b?.balance || 0)}*`);
      } catch (e) { return reply(`❌ ${e.message}`); }
    }

    // ────────────────── .trx [n] ──────────────────
    if (cmd === '.trx') {
      if (!owner) return reply('⛔ Perintah ini khusus owner.');
      const limit = Math.min(parseInt(args[0]) || 5, 20);
      try {
        const res = await apiGet({ 'requests[1]': 'transactions' });
        const { total, results } = res.transactions?.results || {};
        if (!results?.length) return reply('📭 Belum ada transaksi.');
        let teks = `🧾 *${Math.min(limit, results.length)} Transaksi Terakhir (Total: ${total})*\n\n`;
        for (const t of results.slice(0, limit)) {
          const icon = t.is_success ? '✅' : t.is_in_process ? '⏳' : t.is_refund ? '↩️' : '❌';
          teks += `${icon} *${t.voucher?.name || '-'}*\n`;
          teks += `   📞 ${t.phone}  💵 ${t.price_str}\n`;
          teks += `   📅 ${t.date}\n\n`;
        }
        return reply(teks.trim());
      } catch (e) { return reply(`❌ ${e.message}`); }
    }

    // ────────────────── .addpaket <kode> <voucher_id> <harga> <nama...> ──────────────────
    if (cmd === '.addpaket') {
      if (!owner) return reply('⛔ Perintah ini khusus owner.');
      // .addpaket xl14gb 8021 75000 XL Flex M+ 14GB 28hr
      if (args.length < 4) {
        return reply(
          '📋 *Cara Tambah Paket:*\n\n' +
          '*.addpaket <kode> <voucher_id> <harga_jual> <nama paket>*\n\n' +
          'Contoh:\n' +
          '*.addpaket xl14gb 8021 75000 XL Flex M+ 14GB 28hr*\n' +
          '*.addpaket isat1gb 4210 8000 Indosat 1GB 14 Hari*\n\n' +
          '_Voucher ID cari di app isipulsa_ 📱'
        );
      }
      const kode      = args[0].toLowerCase();
      const voucherId = args[1];
      const harga     = parseInt(args[2]);
      const nama      = args.slice(3).join(' ');
      if (isNaN(harga)) return reply('❌ Harga harus berupa angka');

      // Coba detect operator dari nama
      let operator = 'Umum';
      const namaLow = nama.toLowerCase();
      if (namaLow.includes('telkomsel') || namaLow.includes('simpati') || namaLow.includes('kartu as') || namaLow.includes('loop')) operator = 'Telkomsel';
      else if (namaLow.includes('xl') || namaLow.includes('xtra')) operator = 'XL';
      else if (namaLow.includes('axis')) operator = 'Axis';
      else if (namaLow.includes('indosat') || namaLow.includes('im3') || namaLow.includes('ooredoo')) operator = 'Indosat';
      else if (namaLow.includes('three') || namaLow.includes('tri') || namaLow.includes('3')) operator = 'Three';
      else if (namaLow.includes('smartfren')) operator = 'Smartfren';
      else if (namaLow.includes('pln') || namaLow.includes('token')) operator = 'PLN';

      const catalog = loadCatalog();
      if (catalog[kode]) return reply(`⚠️ Kode *${kode}* sudah ada. Hapus dulu dengan .delpaket ${kode}`);
      catalog[kode] = { voucherId, harga, nama, operator, createdAt: new Date().toISOString() };
      saveCatalog(catalog);
      return reply(`✅ Paket berhasil ditambahkan!\n\n🔑 Kode: *${kode}*\n📦 Nama: ${nama}\n📡 Operator: ${operator}\n💵 Harga: *${rp(harga)}*\n🎫 Voucher ID: ${voucherId}`);
    }

    // ────────────────── .delpaket <kode> ──────────────────
    if (cmd === '.delpaket') {
      if (!owner) return reply('⛔ Perintah ini khusus owner.');
      if (!args[0]) return reply('Usage: *.delpaket <kode>*');
      const kode    = args[0].toLowerCase();
      const catalog = loadCatalog();
      if (!catalog[kode]) return reply(`❌ Paket dengan kode *${kode}* tidak ditemukan.`);
      const nama = catalog[kode].nama;
      delete catalog[kode];
      saveCatalog(catalog);
      return reply(`🗑️ Paket *${kode}* (${nama}) berhasil dihapus.`);
    }

    // ────────────────── .editpaket <kode> harga <baru> ──────────────────
    if (cmd === '.editpaket') {
      if (!owner) return reply('⛔ Perintah ini khusus owner.');
      if (args.length < 3) return reply('Usage: *.editpaket <kode> harga <angka_baru>*');
      const kode    = args[0].toLowerCase();
      const field   = args[1].toLowerCase();
      const catalog = loadCatalog();
      if (!catalog[kode]) return reply(`❌ Paket *${kode}* tidak ditemukan.`);
      if (field === 'harga') {
        const baru = parseInt(args[2]);
        if (isNaN(baru)) return reply('❌ Harga harus angka');
        const lama = catalog[kode].harga;
        catalog[kode].harga = baru;
        saveCatalog(catalog);
        return reply(`✅ Harga *${kode}* diubah: ${rp(lama)} → *${rp(baru)}*`);
      }
      return reply('Field yang bisa diedit: *harga*');
    }

    // ────────────────── .listpaket [operator] ──────────────────
    if (cmd === '.listpaket') {
      const catalog = loadCatalog();
      const entries = Object.entries(catalog);
      if (!entries.length) {
        return reply('📭 Katalog kosong.\nOwner bisa tambah paket dengan *.addpaket*');
      }

      const filter  = args[0]?.toLowerCase() || '';
      const filtered = filter
        ? entries.filter(([, v]) => v.operator.toLowerCase().includes(filter) || v.nama.toLowerCase().includes(filter))
        : entries;

      if (!filtered.length) return reply(`❌ Tidak ada paket untuk operator *${args[0]}*`);

      // Kelompokkan per operator
      const groups = {};
      for (const [kode, v] of filtered) {
        if (!groups[v.operator]) groups[v.operator] = [];
        groups[v.operator].push({ kode, ...v });
      }

      let teks = `🛒 *Daftar Paket Tersedia*\n`;
      if (filter) teks += `_(filter: ${args[0]})_\n`;
      teks += '\n';
      for (const [op, items] of Object.entries(groups)) {
        teks += `📡 *${op}*\n`;
        for (const item of items) {
          teks += `   ┌ 🔑 Kode: \`${item.kode}\`\n`;
          teks += `   ├ 📦 ${item.nama}\n`;
          teks += `   └ 💵 *${rp(item.harga)}*\n\n`;
        }
      }
      teks += `_Order: .beli <nomor> <kode_paket>_`;
      return reply(teks);
    }

    // ────────────────── .cekop <nomor> ──────────────────
    if (cmd === '.cekop') {
      if (!args[0]) return reply('Usage: *.cekop <nomor>*\nContoh: .cekop 085212345678');
      try {
        const validators = await getValidators();
        const op = detectOperator(args[0], validators);
        return reply(op
          ? `📡 Nomor *${args[0]}* → Operator: *${op}*`
          : `❓ Operator tidak dikenali untuk nomor *${args[0]}*`
        );
      } catch (e) { return reply(`❌ ${e.message}`); }
    }

    // ────────────────── .beli <nomor> <kode_paket> ──────────────────
    if (cmd === '.beli') {
      if (!args[0] || !args[1]) {
        const catalog = loadCatalog();
        const contoh  = Object.keys(catalog)[0] || 'xl14gb';
        return reply(
          `📲 *Cara Beli Paket*\n\n` +
          `*.beli <nomor> <kode_paket>*\n\n` +
          `Contoh:\n*.beli 085212345678 ${contoh}*\n\n` +
          `_Lihat daftar paket: .listpaket_`
        );
      }

      let nomor  = args[0].replace(/[\s\-]/g, '');
      if (nomor.startsWith('62')) nomor = '0' + nomor.slice(2);
      const kode = args[1].toLowerCase();

      const catalog = loadCatalog();
      const paket   = catalog[kode];
      if (!paket) return reply(`❌ Paket *${kode}* tidak ditemukan.\nLihat daftar: *.listpaket*`);

      // Deteksi operator
      let opInfo = '';
      try {
        const validators = await getValidators();
        const op = detectOperator(nomor, validators);
        if (op) opInfo = `📡 Operator: *${op}*\n`;
      } catch {}

      // Simpan konfirmasi pending
      confirmPending.set(sender, { nomor, kode, voucherId: paket.voucherId, expiry: Date.now() + CONFIRM_TTL });

      return reply(
        `⚠️ *Konfirmasi Pembelian*\n\n` +
        `📞 Nomor: *${nomor}*\n` +
        opInfo +
        `📦 Paket: *${paket.nama}*\n` +
        `💵 Harga: *${rp(paket.harga)}*\n` +
        `💳 Bayar via: Saldo Akun\n\n` +
        `Ketik *ya* untuk konfirmasi\nKetik *batal* untuk membatalkan\n` +
        `_(Otomatis batal dalam 60 detik)_`
      );
    }
  },
};
