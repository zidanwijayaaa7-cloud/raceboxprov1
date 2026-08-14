require('dotenv').config(); // 1. Tambahkan ini di BARIS PERTAMA agar .env kebaca!

// --- TAMBAHKAN 2 BARIS INI KALO PAKAI MONGODB ATLAS DI INDONESIA ---
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Paksa Node.js pakai DNS Google
// -------------------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Tambahkan middleware ini agar Frontend bisa komunikasi dengan Backend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, userid');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// ==========================================
// 1. STRUKTUR DATABASE (SCHEMA)
// ==========================================
const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  packageName: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null }, // NULL artinya PERMANEN
  status: { type: String, default: 'active' }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

const path = require('path');

// Menyediakan file statis (seperti HTML) ke browser
app.use(express.static(__dirname));

// Menampilkan index.html saat user membuka halaman utama '/'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route untuk Dashboard Admin (indexx)
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/indexx.html'); // Sesuaikan dengan lokasi file indexx Anda[cite: 1]
});


// ==========================================
// 2. LOGIKA PILIH PAKET (USER)
// ==========================================
app.post('/api/subscription/buy', async (req, res) => {
  try {
    const { userId, packageChoice } = req.body;
    const startDate = new Date();
    let endDate = new Date(startDate);

    if (packageChoice === '1_month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (packageChoice === '3_months') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (packageChoice === '1_year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (packageChoice === 'permanent') {
      endDate = null;
    } else {
      return res.status(400).json({ message: 'Pilihan paket tidak valid' });
    }

    const sub = await Subscription.findOneAndUpdate(
      { userId },
      { packageName: packageChoice, startDate, endDate, status: 'active' },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ message: 'Paket berhasil diaktifkan!', data: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 3. MIDDLEWARE SATPAM (PENGECEKAN AKSES)
// ==========================================
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.headers['userid']; 
    
    if (!userId) {
      return res.status(401).json({ message: 'Header userid wajib diisi' });
    }

    const sub = await Subscription.findOne({ userId, status: 'active' });

    if (!sub) {
      return res.status(403).json({ message: 'Akses ditolak. Tidak punya paket aktif.' });
    }

    if (sub.endDate === null) {
      return next();
    }

    if (new Date() > new Date(sub.endDate)) {
      sub.status = 'expired';
      await sub.save();
      return res.status(403).json({ message: 'Akses ditolak. Paket sudah kadaluarsa.' });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.get('/api/fitur-premium', checkSubscription, (req, res) => {
  res.json({ message: 'Selamat! Kamu berhasil mengakses Fitur Premium.' });
});


// ==========================================
// 4. LOGIKA SETTING MANUAL (ADMIN)
// ==========================================
app.post('/api/admin/update-subscription', async (req, res) => {
  try {
    const { targetUserId, actionType, customEndDate, daysToAdd } = req.body;
    let sub = await Subscription.findOne({ userId: targetUserId });

    if (!sub) {
      sub = new Subscription({ userId: targetUserId, packageName: 'custom' });
    }

    if (actionType === 'SET_PERMANENT') {
      sub.endDate = null;
      sub.packageName = 'permanent';
    } else if (actionType === 'ADD_DAYS') {
      const baseDate = sub.endDate && sub.endDate > new Date() ? new Date(sub.endDate) : new Date();
      baseDate.setDate(baseDate.getDate() + (daysToAdd || 30));
      sub.endDate = baseDate;
    } else if (actionType === 'SET_CUSTOM_DATE') {
      sub.endDate = new Date(customEndDate);
    }

    sub.status = 'active';
    await sub.save();

    res.json({ message: 'Masa aktif pengguna berhasil diubah manual oleh Admin', data: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// KONEKSI DATABASE & JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// 2. Sekarang mongoose memanggil variabel MONGO_URI dari .env!
mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
  })
  .catch(err => console.error('Gagal konek DB:', err));
