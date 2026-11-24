/**
 * ============================================
 *  PRICES DATA — Digital Media (Digital Printing)
 *  Terpisah dari produk, gambar, dan logika aplikasi.
 *  Edit file ini untuk mengatur tarif cetak dan finishing.
 * ============================================
 */
'use strict';

const PrintingPrices = Object.freeze({
    // === BANNER & SPANDUK (Harga per Meter Persegi m²) ===
    'banner-flexi-standar': {
        unit: 'm2',
        pricePerUnit: 20000,
        originalPrice: 25000,
        minOrder: 1,
        finishingPrices: {
            'polos': 0,
            'mata-ayam': 2500,     // Lubang ring per sudut
            'selongsong': 3000,    // Untuk tiang/bambu
            'lipat-lem': 2000      // Lem keliling rapi
        }
    },
    'banner-flexi-korin': {
        unit: 'm2',
        pricePerUnit: 35000,
        originalPrice: 42000,
        minOrder: 1,
        finishingPrices: {
            'polos': 0,
            'mata-ayam': 2500,
            'selongsong': 3000,
            'lipat-lem': 2000
        }
    },
    'roll-up-banner': {
        unit: 'set',
        pricePerUnit: 185000,
        originalPrice: 220000,
        minOrder: 1,
        finishingPrices: {
            'standar': 0,
            'laminasi-doff': 15000,
            'laminasi-glossy': 15000
        }
    },
    'x-banner': {
        unit: 'set',
        pricePerUnit: 85000,
        originalPrice: 110000,
        minOrder: 1,
        finishingPrices: {
            'standar': 0,
            'laminasi-doff': 10000,
            'laminasi-glossy': 10000
        }
    },

    // === STIKER & LABEL (Harga per Lembar A3+ 32x48cm) ===
    'stiker-chromo-a3': {
        unit: 'lembar',
        pricePerUnit: 7000,
        originalPrice: 10000,
        minOrder: 5,
        finishingPrices: {
            'tanpa-cutting': 0,
            'kiss-cut': 4000,      // Potong setengah tembus
            'die-cut': 6000        // Potong putus bentuk
        }
    },
    'stiker-vinyl-waterproof-a3': {
        unit: 'lembar',
        pricePerUnit: 12000,
        originalPrice: 15000,
        minOrder: 3,
        finishingPrices: {
            'tanpa-cutting': 0,
            'kiss-cut': 4000,
            'die-cut': 6000,
            'laminasi-doff-kisscut': 7000,
            'laminasi-glossy-kisscut': 7000
        }
    },
    'stiker-transparan-a3': {
        unit: 'lembar',
        pricePerUnit: 14000,
        originalPrice: 18000,
        minOrder: 3,
        finishingPrices: {
            'tanpa-cutting': 0,
            'kiss-cut': 4000,
            'die-cut': 6000
        }
    },

    // === DOKUMEN & PROMOSI ===
    'kartu-nama-box': {
        unit: 'box (100 pcs)',
        pricePerUnit: 35000,
        originalPrice: 45000,
        minOrder: 1,
        finishingPrices: {
            '1-sisi': 0,
            '2-sisi': 15000,
            '2-sisi-laminasi-doff': 25000,
            '2-sisi-laminasi-glossy': 25000
        }
    },
    'brosur-flyer-a4': {
        unit: 'rim (500 lbr)',
        pricePerUnit: 280000,
        originalPrice: 350000,
        minOrder: 1,
        finishingPrices: {
            '1-sisi': 0,
            '2-sisi': 80000,
            'lipat-2': 25000,
            'lipat-3': 35000
        }
    },
    'poster-art-carton-a3': {
        unit: 'lembar',
        pricePerUnit: 6500,
        originalPrice: 9000,
        minOrder: 5,
        finishingPrices: {
            'standar': 0,
            'laminasi-doff': 3000,
            'laminasi-glossy': 3000
        }
    },

    // === MERCHANDISE & CUSTOM ===
    'mug-custom-sublim': {
        unit: 'pcs',
        pricePerUnit: 25000,
        originalPrice: 35000,
        minOrder: 1,
        finishingPrices: {
            'box-standar': 0,
            'box-pita-gift': 5000
        }
    },
    'id-card-pvc': {
        unit: 'pcs',
        pricePerUnit: 8000,
        originalPrice: 12000,
        minOrder: 5,
        finishingPrices: {
            'kartu-saja': 0,
            'tali-lanyard-custom': 12000,
            'holder-plastik': 3000
        }
    },
    'kaos-custom-dtf': {
        unit: 'pcs',
        pricePerUnit: 65000,
        originalPrice: 85000,
        minOrder: 1,
        finishingPrices: {
            'sablon-a4-depan': 0,
            'sablon-a3-depan': 15000,
            'sablon-depan-belakang': 25000
        }
    }
});

/**
 * Format angka ke format mata uang Rupiah
 */
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(number) || 0);
}
