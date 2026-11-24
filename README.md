# 🖨️ DIGITAL MEDIA — Digital Printing & Advertising Solution
### Sistem Pemesanan & Transaksi Multi-Role (Toko Offline & Toko Online)

Website aplikasi digital printing modern dengan **3 Sudut Pandang (POV / Role)** yang terisolasi secara ketat (*Role-Based Access Control*), mendukung transaksi **Toko Offline (Kasir POS)** dan **Toko Online (Pemesanan Web)**, pemisahan berkas modular (*Zero Bundling*), serta perlindungan keamanan berlapis anti-jebol.

---

## 🎯 3 Sudut Pandang (POV) & Hak Akses Role

| Role / Peran | Kredensial Default | Hak Akses & Fitur Utama |
| :--- | :--- | :--- |
| **1. Pelanggan (Customer)** | `pelanggan` / `user123` | **Toko Online & Lacak Pesanan**:<br>• Eksplorasi katalog cetak (Banner, Stiker A3+, Brosur, Kaos, Mug).<br>• **Live Kalkulator Meteran Banner** ($Panjang \times Lebar = \text{m}^2$ otomatis).<br>• Upload file desain siap cetak (PDF, TIFF, JPG, PNG).<br>• Pilihan ambil langsung di outlet (*Self-Pickup*) atau kirim kurir.<br>• Checkout pembayaran QRIS, Transfer BCA/BNI, E-Wallet, dan COD.<br>• **Lacak Status Pesanan**: Verifikasi Desain ➔ Antrian Mesin ➔ Cetak ➔ Finishing ➔ Siap Ambil. |
| **2. Operator & Kasir (Cashier)** | `kasir` / `kasir123` | **POS Toko Offline & Antrian Mesin Produksi**:<br>• POS Kasir Penjualan Cepat untuk pelanggan *walk-in* datang langsung ke toko fisik.<br>• Perhitungan uang tunai diterima & kembalian otomatis.<br>• Pembayaran Tunai & QRIS Kasir Toko.<br>• **Cetak Struk Nota Belanja (Thermal Receipt 80mm)** siap print langsung.<br>• Rekap kas harian (total penjualan offline & uang tunai di laci).<br>• **Antrian Mesin Cetak Produksi** (online & offline terpadu) dengan tombol 1-klik ubah status produksi. |
| **3. Master Admin** | `admin` / `admin123` | **Laporan Keuangan & Kontrol Bahan Percetakan**:<br>• Analitik komparatif: **Omset Toko Offline (Kasir) vs Omset Toko Online (Web)**.<br>• Realisasi saluran pembayaran (QRIS vs Tunai Kasir vs Transfer Bank).<br>• **Inventori Stok Bahan Mentah Percetakan** (Roll Flexi 280g/440g, Stiker Vinyl/Chromo A3+, Tinta Eco-Solvent, Blank Mug, Kaos) + tombol Restock.<br>• Manajemen Pengguna & Hak Akses (RBAC Role Policy).<br>• **Security Audit Trail Log** (pencatatan insiden keamanan & aksi sensitif). |

---

## 📁 Struktur Pemisahan Berkas (Clean Separation of Concerns)

Semua JavaScript, CSS, Data Harga, dan Data Gambar dipisahkan secara mandiri:

```text
[webpemasaran]/
├── index.html                 # Portal Utama Digital Media (3 POV terintegrasi)
├── README.md                  # Dokumentasi panduan arsitektur sistem
├── admin/
│   └── index.html             # Gateway langsung menuju dashboard Admin
├── css/
│   ├── variables.css          # Palet warna Cyan CMYK, design tokens, Dark/Light Mode
│   ├── base.css               # Reset layout, tipografi, dan utility class
│   ├── navbar.css             # Navigation bar, quick POV switcher, role badges
│   ├── customer.css           # Styling katalog online, kalkulator m², dan order tracker
│   ├── cashier.css            # Styling POS Kasir Toko Offline & struk nota belanja
│   ├── admin.css              # Styling analitik keuangan, inventori bahan, dan audit log
│   ├── checkout.css           # Alur stepper checkout formulir pemesanan
│   ├── modal.css              # Styling pop-up modal, QRIS view, dan toast
│   ├── animations.css         # Keyframe animasi transisi halus
│   └── responsive.css         # Breakpoint responsive smartphone & tablet
└── js/
    ├── security.js            # Engine RBAC Role Guard, Anti-XSS, CSRF, Anti-Tamper
    ├── prices-data.js         # KHUSUS INPUT HARGA CETAK & FINISHING
    ├── images-data.js         # KHUSUS INPUT GAMBAR & FOTO PRODUK
    ├── products-data.js       # Katalog spesifikasi layanan percetakan Digital Media
    ├── auth.js                # Otentikasi login pengguna & isolasi sudut pandang (POV)
    ├── customer.js            # Modul logika pelanggan (Katalog, Kalkulator m², Tracker)
    ├── cashier.js             # Modul logika kasir toko offline (POS, Kembalian, Struk)
    ├── admin.js               # Modul logika master admin (Omset offline vs online, Stok)
    ├── checkout.js            # Pemrosesan transaksi online, QRIS canvas, & bank transfer
    └── ui.js                  # Global UI controller (Tema, Drawer keranjang, Toasts)
```

---

## 🛡️ Proteksi Keamanan Berlapis (Anti-Jebol)

1. **Role-Based Access Control (RBAC Guard)**:
   - Panel pelanggan, kasir, dan admin diproteksi secara terpisah.
   - Jika pengguna role *Pelanggan* mencoba memanggil modul *Kasir* atau *Admin*, sistem melempar peringatan *Access Denied* dan mencatatnya ke dalam Security Audit Log.
2. **Zero-Inline JavaScript & Strict CSP**:
   - Seluruh interaksi menggunakan *Event Delegation* terpusat tanpa ada atribut `onclick=""` dalam HTML, patuh terhadap aturan CSP `script-src 'self'`.
3. **Pembersihan XSS Input & Render**:
   - Menangkal skrip jahat pada input nama pemesan, nomor kontak, catatan cetak, dan nama file.
4. **Dynamic Cryptographic CSRF Token**:
   - Setiap transaksi divalidasi dengan token kriptografi acak `crypto.getRandomValues`.
5. **Client-Side Rate Limiter**:
   - Menahan serangan *brute force* login kasir/admin serta membatasi spam formulir pesanan.
6. **Anti-Clickjacking / Frame Busting**:
   - Mencegah web disematkan dalam iframe jebakan phising.
7. **Password Hashing SHA-256**:
   - Seluruh kata sandi akun diverifikasi menggunakan hash kriptografi SHA-256 tanpa teks terbuka.

---

## ⚙️ Cara Mengubah Tarif Harga & Gambar

- **Mengubah Tarif Cetak / Finishing**: Buka [`js/prices-data.js`](file:///c:/[webpemasaran]/js/prices-data.js).
- **Mengubah Gambar Produk**: Buka [`js/images-data.js`](file:///c:/[webpemasaran]/js/images-data.js).
- **Menambah / Mengubah Layanan Percetakan**: Buka [`js/products-data.js`](file:///c:/[webpemasaran]/js/products-data.js).

---

## 🚀 Cara Menjalankan Server & Menguji (Fitur Portabel)

Aplikasi ini bersifat **100% Portabel & Mandiri (Zero Dependencies)**. Anda dapat memindahkan seluruh folder proyek ini ke komputer mana pun (PC kantor, laptop pribadi, flashdisk, desktop, atau drive C:/D:/E:) tanpa perlu setting ulang atau menginstal `node_modules`.

### 1. Menjalankan Server
- **Menggunakan Script (Rekomendasi Windows)**: Cukup klik ganda [`start.bat`](file:///d:/TUGAS%20KAMPUS/Skripsi/antigravity/[webpemasaran]/start.bat) atau jalankan [`start.ps1`](file:///d:/TUGAS%20KAMPUS/Skripsi/antigravity/[webpemasaran]/start.ps1).
  - Otomatis mendeteksi folder lokasi file berada (`%~dp0`), bebas diletakkan di mana saja.
  - Otomatis mendeteksi runtime Node.js (meskipun belum terdaftar di system PATH).
  - Dilengkapi fitur **Auto Port Fallback**: jika port `8080` sedang dipakai aplikasi lain di komputer tersebut, server otomatis berpindah ke `8081`, `8082`, dst. tanpa pernah gagal *crash*.
  - Otomatis membuka peramban web (browser) ke port yang berhasil aktif.
  - Menampilkan alamat **IP Lokal Wi-Fi / LAN** untuk kemudahan testing langsung dari HP/smartphone dalam jaringan yang sama.
- **Menggunakan Terminal / Command Prompt**:
  ```bash
  node server.js
  # atau menentukan port custom manual:
  node server.js 8080
  ```
- **URL Akses**:
  - Toko Online Pelanggan : `http://localhost:8080/` (atau port aktif)
  - Portal Kasir POS      : `http://localhost:8080/kasir/`
  - Master Admin Panel    : `http://localhost:8080/admin/`
  - Akses dari HP/Device lain: `http://<IP-WIFI-ANDA>:8080/`

### 2. Menguji 3 POV (Point of View)
1. Buka browser ke alamat `http://localhost:8080/`.
2. Di bagian atas navbar, terdapat menu **"POV:"**:
   - Pilih **👤 Pelanggan**: Tampilan khusus pelanggan (katalog online, kalkulator banner, lacak pesanan).
   - Pilih **💳 Operator & Kasir**: Tampilan khusus POS Kasir Toko Offline dan antrian mesin cetak.
   - Pilih **🛡️ Master Admin**: Tampilan khusus analitik finansial offline vs online, stok bahan, dan audit keamanan.
3. Anda juga dapat login menggunakan akun yang terdaftar pada tabel di atas.
