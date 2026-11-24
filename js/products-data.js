/**
 * ============================================
 *  PRODUCTS DATA — Digital Media (Digital Printing)
 *  Spesifikasi layanan cetak, material, dan opsi finishing.
 * ============================================
 */
'use strict';

const PrintingProducts = Object.freeze([
    // === BANNER & OUTDOOR ===
    {
        id: 'banner-flexi-standar',
        name: 'Spanduk / Banner Flexi 280g Standar',
        category: 'banner',
        badge: 'hot',
        type: 'meteran', // supports meter calculator
        rating: 4.8,
        ratingCount: 1420,
        productionTime: '1 - 2 Jam (Bisa Ditunggu)',
        description: 'Bahan Flexi China 280gsm dengan tinta solvent tahan cuaca outdoor. Cocok untuk spanduk toko, baliho promo, perumahan, dan event.',
        finishingOptions: [
            { id: 'polos', label: 'Polos (Potong Pas Gambar)' },
            { id: 'mata-ayam', label: 'Mata Ayam (Ring 4 Sudut)' },
            { id: 'selongsong', label: 'Selongsong Kiri-Kanan / Atas-Bawah (Untuk Tiang)' },
            { id: 'lipat-lem', label: 'Lipat Lem Keliling (Tanpa Ring)' }
        ]
    },
    {
        id: 'banner-flexi-korin',
        name: 'Spanduk Flexi Korea 440g High-Res',
        category: 'banner',
        badge: 'new',
        type: 'meteran',
        rating: 4.9,
        ratingCount: 880,
        productionTime: '2 - 3 Jam',
        description: 'Flexi Korea tebal 440gsm dengan serat halus, warna lebih pekat, anti-kerut dan tahan hingga 1-2 tahun outdoor.',
        finishingOptions: [
            { id: 'polos', label: 'Polos (Potong Pas)' },
            { id: 'mata-ayam', label: 'Mata Ayam (Ring Keliling)' },
            { id: 'selongsong', label: 'Selongsong Atas & Bawah' },
            { id: 'lipat-lem', label: 'Lipat Lem Rapi' }
        ]
    },
    {
        id: 'roll-up-banner',
        name: 'Roll Up Banner Aluminium 60x160cm',
        category: 'banner',
        badge: 'hot',
        type: 'set',
        rating: 4.9,
        ratingCount: 520,
        productionTime: '3 - 4 Jam',
        description: 'Standing banner gulung otomatis dengan rangka aluminium kokoh + bahan Luster Albatros anti lengkung. Termasuk tas jinjing.',
        finishingOptions: [
            { id: 'standar', label: 'Cetak Standar High-Res' },
            { id: 'laminasi-doff', label: 'Laminasi Doff (Elegan / Matte)' },
            { id: 'laminasi-glossy', label: 'Laminasi Glossy (Mengkilap)' }
        ]
    },
    {
        id: 'x-banner',
        name: 'X-Banner Fiber 60x160cm + Stand',
        category: 'banner',
        badge: 'sale',
        type: 'set',
        rating: 4.7,
        ratingCount: 970,
        productionTime: '1 - 2 Jam',
        description: 'Display promosi praktis rangka silang fiber hitam kuat + bahan banner Albatros halus. Siap pakai untuk seminar & display depan toko.',
        finishingOptions: [
            { id: 'standar', label: 'Cetak Standar' },
            { id: 'laminasi-doff', label: 'Laminasi Doff' },
            { id: 'laminasi-glossy', label: 'Laminasi Glossy' }
        ]
    },

    // === STIKER & LABEL ===
    {
        id: 'stiker-chromo-a3',
        name: 'Stiker Chromo A3+ (Bahan Kertas Mengkilap)',
        category: 'stiker',
        badge: 'hot',
        type: 'lembaran',
        rating: 4.7,
        ratingCount: 2310,
        productionTime: '1 - 3 Jam',
        description: 'Stiker berbahan dasar kertas licin mengkilap. Paling ekonomis untuk label kemasan makanan kering, box hampers, dan seal segel.',
        finishingOptions: [
            { id: 'tanpa-cutting', label: 'Hanya Cetak (Potong Kotak Bersih)' },
            { id: 'kiss-cut', label: 'Kiss Cut (Potong Pola Siap Kupas)' },
            { id: 'die-cut', label: 'Die Cut (Potong Putus per Pcs)' }
        ]
    },
    {
        id: 'stiker-vinyl-waterproof-a3',
        name: 'Stiker Vinyl Putih A3+ Anti-Air & Robek',
        category: 'stiker',
        badge: 'hot',
        type: 'lembaran',
        rating: 4.9,
        ratingCount: 3100,
        productionTime: '2 - 4 Jam',
        description: 'Bahan plastik sintetis elastis tahan air, minyak, dan freezer. Sangat pas untuk frozen food, botol minuman dingin, dan kosmetik.',
        finishingOptions: [
            { id: 'tanpa-cutting', label: 'Hanya Cetak Lembaran' },
            { id: 'kiss-cut', label: 'Kiss Cut Sesuai Pola Desain' },
            { id: 'die-cut', label: 'Die Cut Putus' },
            { id: 'laminasi-doff-kisscut', label: 'Laminasi Doff + Kiss Cut' },
            { id: 'laminasi-glossy-kisscut', label: 'Laminasi Glossy + Kiss Cut' }
        ]
    },
    {
        id: 'stiker-transparan-a3',
        name: 'Stiker Transparan / Bening A3+',
        category: 'stiker',
        badge: 'new',
        type: 'lembaran',
        rating: 4.8,
        ratingCount: 790,
        productionTime: '2 - 4 Jam',
        description: 'Stiker tembus pandang anti air. Memberikan kesan mewah dan modern pada botol kaca, pouch transparan, dan cup gelas plastik.',
        finishingOptions: [
            { id: 'tanpa-cutting', label: 'Hanya Cetak Lembaran' },
            { id: 'kiss-cut', label: 'Kiss Cut Pola Desain' },
            { id: 'die-cut', label: 'Die Cut Putus' }
        ]
    },

    // === DOKUMEN & PROMOSI ===
    {
        id: 'kartu-nama-box',
        name: 'Kartu Nama Premium (Box Isi 100 Pcs)',
        category: 'dokumen',
        badge: 'hot',
        type: 'box',
        rating: 4.9,
        ratingCount: 1840,
        productionTime: '2 - 4 Jam',
        description: 'Cetak tajam di atas Art Carton 260g berkualitas tinggi. Warna jernih, potongan presisi, sudah termasuk wadah box mika tebal.',
        finishingOptions: [
            { id: '1-sisi', label: 'Cetak 1 Sisi' },
            { id: '2-sisi', label: 'Cetak Bolak-Balik (2 Sisi)' },
            { id: '2-sisi-laminasi-doff', label: '2 Sisi + Laminasi Doff Mewah' },
            { id: '2-sisi-laminasi-glossy', label: '2 Sisi + Laminasi Glossy' }
        ]
    },
    {
        id: 'brosur-flyer-a4',
        name: 'Brosur & Flyer A4 Full Color (1 Rim / 500 Lbr)',
        category: 'dokumen',
        badge: 'sale',
        type: 'rim',
        rating: 4.8,
        ratingCount: 650,
        productionTime: '1 Hari Kerja',
        description: 'Bahan Art Paper 150g cetak offset/digital tajam. Cocok untuk promosi produk, menu restoran, selebaran diskon, dan company profile.',
        finishingOptions: [
            { id: '1-sisi', label: 'Cetak 1 Sisi (Tanpa Lipat)' },
            { id: '2-sisi', label: 'Cetak 2 Sisi Bolak-Balik' },
            { id: 'lipat-2', label: '2 Sisi + Lipat 2 (Bifold)' },
            { id: 'lipat-3', label: '2 Sisi + Lipat 3 (Trifold / Brosur Z)' }
        ]
    },
    {
        id: 'poster-art-carton-a3',
        name: 'Poster Art Carton 260g A3+ (32x48cm)',
        category: 'dokumen',
        badge: 'new',
        type: 'lembaran',
        rating: 4.7,
        ratingCount: 890,
        productionTime: '1 - 2 Jam',
        description: 'Kertas tebal kaku berkualitas tinggi. Hasil cetak foto sangat hidup, ideal untuk poster event konser, dekorasi kamar, dan promo cafe.',
        finishingOptions: [
            { id: 'standar', label: 'Cetak Standar' },
            { id: 'laminasi-doff', label: 'Laminasi Doff Anti Pudar' },
            { id: 'laminasi-glossy', label: 'Laminasi Glossy Mengkilat' }
        ]
    },

    // === MERCHANDISE & CUSTOM ===
    {
        id: 'mug-custom-sublim',
        name: 'Mug Keramik Custom Sublimasi',
        category: 'merchandise',
        badge: 'hot',
        type: 'pcs',
        rating: 4.9,
        ratingCount: 1220,
        productionTime: '3 - 5 Jam',
        description: 'Mug keramik putih SNI dilapisi coating khusus. Gambar dicetak full color menggunakan tinta sublim kualitas jepang, aman dicuci.',
        finishingOptions: [
            { id: 'box-standar', label: 'Box Putih Standar' },
            { id: 'box-pita-gift', label: 'Gift Box Souvenir + Pita' }
        ]
    },
    {
        id: 'id-card-pvc',
        name: 'ID Card Pegawai / Member PVC Tebal',
        category: 'merchandise',
        badge: 'new',
        type: 'pcs',
        rating: 4.8,
        ratingCount: 1540,
        productionTime: '2 - 4 Jam',
        description: 'Kartu standar ATM / KTP bahan PVC tebal anti patah. Tidak luntur, cetak 2 sisi high resolution dengan laminasi oven press.',
        finishingOptions: [
            { id: 'kartu-saja', label: 'Hanya Kartu PVC' },
            { id: 'tali-lanyard-custom', label: 'Kartu + Tali Lanyard Custom Nama Toko/PT' },
            { id: 'holder-plastik', label: 'Kartu + Card Holder Mika' }
        ]
    },
    {
        id: 'kaos-custom-dtf',
        name: 'Kaos Cotton Combed 30s Sablon DTF Satuan',
        category: 'merchandise',
        badge: 'hot',
        type: 'pcs',
        rating: 4.8,
        ratingCount: 960,
        productionTime: '4 - 6 Jam',
        description: 'Bahan 100% Cotton Combed 30s adem dan lembut dengan sablon digital DTF (Direct Transfer Film) lentur, tajam, dan tidak retak.',
        finishingOptions: [
            { id: 'sablon-a4-depan', label: 'Sablon Ukuran A4 Sisi Depan' },
            { id: 'sablon-a3-depan', label: 'Sablon Ukuran A3 Sisi Depan' },
            { id: 'sablon-depan-belakang', label: 'Sablon Depan + Belakang' }
        ]
    }
]);

const PrintingCategories = Object.freeze([
    { id: 'all', name: 'Semua Layanan', icon: 'fas fa-print', count: PrintingProducts.length },
    { id: 'banner', name: 'Banner & Spanduk', icon: 'fas fa-scroll', count: PrintingProducts.filter(p => p.category === 'banner').length },
    { id: 'stiker', name: 'Stiker & Label A3+', icon: 'fas fa-tags', count: PrintingProducts.filter(p => p.category === 'stiker').length },
    { id: 'dokumen', name: 'Brosur & Dokumen', icon: 'fas fa-newspaper', count: PrintingProducts.filter(p => p.category === 'dokumen').length },
    { id: 'merchandise', name: 'Merchandise & Kaos', icon: 'fas fa-tshirt', count: PrintingProducts.filter(p => p.category === 'merchandise').length }
]);
