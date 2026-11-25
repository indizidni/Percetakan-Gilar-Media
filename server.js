/**
 * ============================================
 *  BACKEND HTTP SERVER & JSON DATABASE REST API
 *  Percetakan Gilar Media — Digital Printing Solution
 *  Built-in Node.js HTTP & Crypto (Zero Dependencies)
 * ============================================
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

let INITIAL_PORT = parseInt(process.env.PORT || process.argv[2], 10) || 8080;
let currentPort = INITIAL_PORT;
const MAX_PORT_ATTEMPTS = 30;
let attemptCount = 0;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Ensure data directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    // Read-only filesystem in serverless cloud environments (e.g. Vercel)
}

// JSON Database Files
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const CASH_LEDGER_FILE = path.join(DATA_DIR, 'cash_ledger.json');
const FINANCIAL_OVERRIDE_FILE = path.join(DATA_DIR, 'financial_override.json');
const PAYMENT_SETTINGS_FILE = path.join(DATA_DIR, 'payment_settings.json');

// Helper: Safe Read & Write JSON with In-Memory / Cloud Tmp Fallback
const memCache = {};

function readJSON(filePath, fallback = []) {
    if (memCache[filePath]) return memCache[filePath];
    try {
        const tmpPath = path.join(os.tmpdir(), path.basename(filePath));
        if (fs.existsSync(tmpPath)) {
            return JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        }
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
        return fallback;
    }
}

function writeJSON(filePath, data) {
    memCache[filePath] = data;
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        try {
            const tmpPath = path.join(os.tmpdir(), path.basename(filePath));
            fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (e2) {
            return true; // Preserved in in-memory cache
        }
    }
}

// Helper: Parse request JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) { // 5MB limit
                reject(new Error('Payload Too Large'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

// Helper: Send JSON response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(data));
}

// Helper: SHA-256 Hash
function hashPassword(pass) {
    return crypto.createHash('sha256').update(String(pass)).digest('hex');
}

// MIME Types
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const requestHandler = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        });
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // ============================================
    // REST API ENDPOINTS (/api/...)
    // ============================================
    if (pathname.startsWith('/api/')) {
        try {
            // ── 1. POST /api/register (Customer Registration) ──
            if (pathname === '/api/register' && req.method === 'POST') {
                const body = await parseBody(req);
                const { name, phone, email, password, address } = body;

                if (!name || !phone || !password) {
                    return sendJSON(res, 400, { success: false, message: 'Nama, No. WhatsApp, dan Password wajib diisi!' });
                }

                const users = readJSON(USERS_FILE);
                const cleanPhone = String(phone).replace(/[\s-]/g, '');

                // Check existing user
                const exists = users.find(u =>
                    (u.phone && u.phone.replace(/[\s-]/g, '') === cleanPhone) ||
                    (email && u.email && u.email.toLowerCase() === String(email).toLowerCase())
                );

                if (exists) {
                    return sendJSON(res, 409, { success: false, message: 'Nomor WhatsApp atau Email sudah terdaftar! Silakan login.' });
                }

                const newUser = {
                    id: 'USR-' + Date.now().toString(36).toUpperCase(),
                    username: cleanPhone,
                    name: String(name).trim(),
                    phone: cleanPhone,
                    email: email ? String(email).trim().toLowerCase() : '',
                    address: address ? String(address).trim() : '',
                    passwordHash: hashPassword(password),
                    role: 'customer',
                    createdAt: new Date().toISOString()
                };

                users.push(newUser);
                writeJSON(USERS_FILE, users);

                // Return sanitized profile (exclude passwordHash)
                const { passwordHash, ...safeUser } = newUser;
                return sendJSON(res, 201, {
                    success: true,
                    message: 'Pendaftaran akun berhasil! Anda sekarang sudah login.',
                    user: safeUser
                });
            }

            // ── 2. POST /api/login (Customer, Cashier, Admin Login) ──
            if (pathname === '/api/login' && req.method === 'POST') {
                const body = await parseBody(req);
                const { identifier, password } = body; // can be phone, email, or username

                if (!identifier || !password) {
                    return sendJSON(res, 400, { success: false, message: 'Username / Kontak dan Password wajib diisi!' });
                }

                const users = readJSON(USERS_FILE);
                const cleanId = String(identifier).trim().toLowerCase();
                const cleanPhone = cleanId.replace(/[\s-]/g, '');
                const hash = hashPassword(password);

                const user = users.find(u =>
                    (u.username && u.username.toLowerCase() === cleanId) ||
                    (u.phone && u.phone.replace(/[\s-]/g, '') === cleanPhone) ||
                    (u.email && u.email.toLowerCase() === cleanId)
                );

                const isPasswordMatch = user && (user.passwordHash === hash || user.passwordHash === String(password));

                if (!user || !isPasswordMatch) {
                    return sendJSON(res, 401, { success: false, message: 'Nomor WhatsApp, Username, atau Kata Sandi salah!' });
                }

                // If stored password was plain text, upgrade to hash safely
                if (user.passwordHash !== hash) {
                    user.passwordHash = hash;
                    writeJSON(USERS_FILE, users);
                }

                const { passwordHash, ...safeUser } = user;
                return sendJSON(res, 200, {
                    success: true,
                    message: `Selamat datang kembali, ${user.name}!`,
                    user: safeUser
                });
            }

            // ── 3. GET /api/orders (All Orders for Admin & Cashier) ──
            if (pathname === '/api/orders' && req.method === 'GET') {
                const orders = readJSON(ORDERS_FILE);
                return sendJSON(res, 200, { success: true, orders });
            }

            // ── 4. POST /api/orders (Create New Order: Online / Offline POS) ──
            if (pathname === '/api/orders' && req.method === 'POST') {
                const body = await parseBody(req);
                if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
                    return sendJSON(res, 400, { success: false, message: 'Item pesanan tidak boleh kosong!' });
                }

                const orders = readJSON(ORDERS_FILE);
                const orderId = body.id || ('DM-' + (body.channel === 'offline' ? 'POS' : 'ONL') + '-' + Date.now().toString(36).toUpperCase());
                const total = parseInt(body.total, 10) || 0;
                const paymentType = body.paymentType || 'full';
                const isDP = paymentType === 'dp';
                const dpAmount = Math.round(total * 0.5);
                const amountPaid = body.amountPaid !== undefined ? parseInt(body.amountPaid, 10) : (isDP ? dpAmount : total);
                const remainingBalance = body.remainingBalance !== undefined ? parseInt(body.remainingBalance, 10) : (isDP ? (total - amountPaid) : 0);
                const paymentStatus = body.paymentStatus || (body.paymentMethod === 'cod' ? 'belum_bayar' : (isDP ? 'dp_dibayar' : 'lunas'));

                const newOrder = {
                    id: orderId,
                    channel: body.channel || 'online',
                    createdAt: new Date().toISOString(),
                    userId: body.userId || null,
                    cashierName: body.cashierName || null,
                    customer: body.customer || { name: 'Pelanggan Walk-In' },
                    deliveryMethod: body.deliveryMethod || 'Ambil di Toko',
                    paymentMethod: body.paymentMethod || 'qris',
                    paymentType: isDP ? 'dp' : 'full',
                    paymentStatus,
                    amountPaid,
                    remainingBalance,
                    cashReceived: body.cashReceived || body.total,
                    change: body.change || 0,
                    items: body.items,
                    total: total,
                    status: body.status || 'Verifikasi Desain'
                };

                orders.unshift(newOrder);
                writeJSON(ORDERS_FILE, orders);

                return sendJSON(res, 201, {
                    success: true,
                    message: 'Pesanan berhasil dibuat & tersimpan di database!',
                    orderId: newOrder.id,
                    order: newOrder
                });
            }

            // ── 5. POST /api/orders/update-status ──
            if (pathname === '/api/orders/update-status' && req.method === 'POST') {
                const body = await parseBody(req);
                const { orderId, newStatus } = body;

                if (!orderId || !newStatus) {
                    return sendJSON(res, 400, { success: false, message: 'orderId dan newStatus wajib diisi!' });
                }

                const orders = readJSON(ORDERS_FILE);
                const found = orders.find(o => o.id === orderId);

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Order ID tidak ditemukan!' });
                }

                found.status = newStatus;
                writeJSON(ORDERS_FILE, orders);

                return sendJSON(res, 200, {
                    success: true,
                    message: `Status order ${orderId} berhasil diubah ke '${newStatus}'`,
                    order: found
                });
            }

            // ── 5b. POST /api/orders/settle-payment (Pelunasan Sisa DP) ──
            if (pathname === '/api/orders/settle-payment' && req.method === 'POST') {
                const body = await parseBody(req);
                const { orderId, paymentMethod, settledBy } = body;

                if (!orderId) {
                    return sendJSON(res, 400, { success: false, message: 'orderId wajib diisi!' });
                }

                const orders = readJSON(ORDERS_FILE);
                const found = orders.find(o => o.id === orderId);

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Pesanan tidak ditemukan!' });
                }

                const settledAmount = found.remainingBalance || (found.total - (found.amountPaid || 0));
                found.paymentStatus = 'lunas';
                found.amountPaid = found.total;
                found.remainingBalance = 0;
                found.settledAt = new Date().toISOString();
                found.settledBy = settledBy || 'Kasir / Admin';
                if (paymentMethod) {
                    found.settledPaymentMethod = paymentMethod;
                }

                writeJSON(ORDERS_FILE, orders);

                // If paid in cash at store, record in cash drawer ledger
                if ((paymentMethod || '').toLowerCase() === 'tunai' || (paymentMethod || '').toLowerCase() === 'cash') {
                    try {
                        const ledger = readJSON(CASH_LEDGER_FILE, { initialFloat: 200000, logs: [] });
                        const newEntry = {
                            id: 'CASH-' + Date.now().toString(36).toUpperCase(),
                            timestamp: new Date().toISOString(),
                            type: 'in',
                            category: 'Pelunasan Piutang DP',
                            amount: settledAmount,
                            operator: settledBy || 'Kasir',
                            notes: `Pelunasan sisa DP pesanan ${orderId} di kasir fisik`
                        };
                        ledger.logs.unshift(newEntry);
                        ledger.lastUpdated = new Date().toISOString();
                        ledger.updatedBy = settledBy || 'Kasir';
                        writeJSON(CASH_LEDGER_FILE, ledger);
                    } catch (e) {
                        console.error('Error logging to cash ledger:', e);
                    }
                }

                return sendJSON(res, 200, {
                    success: true,
                    message: `Pelunasan pesanan ${orderId} sebesar Rp ${settledAmount.toLocaleString('id-ID')} berhasil dicatat!`,
                    order: found
                });
            }

            // ── 5c. POST /api/orders/upload-payment-proof ──
            if (pathname === '/api/orders/upload-payment-proof' && req.method === 'POST') {
                const body = await parseBody(req);
                const { orderId, proofImage, note } = body;

                if (!orderId) {
                    return sendJSON(res, 400, { success: false, message: 'orderId wajib diisi!' });
                }

                const orders = readJSON(ORDERS_FILE);
                const found = orders.find(o => o.id === orderId);

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Pesanan tidak ditemukan!' });
                }

                found.paymentProof = {
                    image: proofImage || null,
                    uploadedAt: new Date().toISOString(),
                    note: note || ''
                };
                found.paymentStatus = 'menunggu_verifikasi';

                writeJSON(ORDERS_FILE, orders);

                return sendJSON(res, 200, {
                    success: true,
                    message: `Bukti pembayaran untuk pesanan ${orderId} berhasil diunggah! Menunggu konfirmasi toko.`,
                    order: found
                });
            }

            // ── 5d. POST /api/orders/verify-payment ──
            if (pathname === '/api/orders/verify-payment' && req.method === 'POST') {
                const body = await parseBody(req);
                const { orderId, action, rejectReason, verifiedBy } = body;

                if (!orderId || !action) {
                    return sendJSON(res, 400, { success: false, message: 'orderId dan action (approve/reject) wajib diisi!' });
                }

                const orders = readJSON(ORDERS_FILE);
                const found = orders.find(o => o.id === orderId);

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Pesanan tidak ditemukan!' });
                }

                if (action === 'approve') {
                    if (found.paymentType === 'dp') {
                        found.paymentStatus = 'dp_dibayar';
                        found.amountPaid = Math.round(found.total * 0.5);
                        found.remainingBalance = found.total - found.amountPaid;
                    } else {
                        found.paymentStatus = 'lunas';
                        found.amountPaid = found.total;
                        found.remainingBalance = 0;
                    }
                    found.paymentVerifiedAt = new Date().toISOString();
                    found.paymentVerifiedBy = verifiedBy || 'Master Admin';

                    // Advance production status from 'Verifikasi Desain' to 'Antrian Mesin'
                    if (found.status === 'Verifikasi Desain') {
                        found.status = 'Antrian Mesin';
                    }

                    writeJSON(ORDERS_FILE, orders);

                    return sendJSON(res, 200, {
                        success: true,
                        message: `Pembayaran pesanan ${orderId} berhasil diverifikasi & disetujui!`,
                        order: found
                    });
                } else if (action === 'reject') {
                    found.paymentStatus = 'belum_bayar';
                    found.paymentRejectReason = rejectReason || 'Bukti transfer tidak valid atau tidak terbaca.';
                    found.paymentRejectedAt = new Date().toISOString();
                    found.paymentRejectedBy = verifiedBy || 'Master Admin';

                    writeJSON(ORDERS_FILE, orders);

                    return sendJSON(res, 200, {
                        success: true,
                        message: `Bukti pembayaran pesanan ${orderId} ditolak. Pelanggan diminta mengunggah ulang.`,
                        order: found
                    });
                } else {
                    return sendJSON(res, 400, { success: false, message: 'Action tidak valid (pilih approve atau reject).' });
                }
            }

            // ── 6. GET /api/inventory ──
            if (pathname === '/api/inventory' && req.method === 'GET') {
                const inventory = readJSON(INVENTORY_FILE);
                return sendJSON(res, 200, { success: true, inventory });
            }

            // ── 7. POST /api/inventory/restock ──
            if (pathname === '/api/inventory/restock' && req.method === 'POST') {
                const body = await parseBody(req);
                const { matId, qty } = body;
                const parsedQty = parseInt(qty, 10);

                if (isNaN(parsedQty) || parsedQty <= 0) {
                    return sendJSON(res, 400, { success: false, message: 'Jumlah restock harus berupa angka bulat lebih dari 0!' });
                }

                const inventory = readJSON(INVENTORY_FILE);
                const found = inventory.find(i => i.id === matId);

                if (found) {
                    found.stock += parsedQty;
                    writeJSON(INVENTORY_FILE, inventory);
                    return sendJSON(res, 200, { success: true, message: `Stok ${found.name} bertambah +${parsedQty} ${found.unit}`, inventory });
                }

                return sendJSON(res, 404, { success: false, message: 'Material tidak ditemukan!' });
            }

            // ── 7b. GET /api/payment-settings ──
            if (pathname === '/api/payment-settings' && req.method === 'GET') {
                const settings = readJSON(PAYMENT_SETTINGS_FILE, {});
                return sendJSON(res, 200, { success: true, settings });
            }

            // ── 7c. POST /api/payment-settings ──
            if (pathname === '/api/payment-settings' && req.method === 'POST') {
                const body = await parseBody(req);
                const current = readJSON(PAYMENT_SETTINGS_FILE, {});
                const updated = {
                    ...current,
                    ...body,
                    lastUpdated: new Date().toISOString(),
                    updatedBy: body.updatedBy || 'Master Admin'
                };
                writeJSON(PAYMENT_SETTINGS_FILE, updated);
                return sendJSON(res, 200, {
                    success: true,
                    message: 'Pengaturan rekening & QRIS toko berhasil disimpan!',
                    settings: updated
                });
            }

            // ── 8. GET /api/users (Sanitized list for Admin) ──
            if (pathname === '/api/users' && req.method === 'GET') {
                const users = readJSON(USERS_FILE).map(({ passwordHash, ...u }) => u);
                return sendJSON(res, 200, { success: true, users });
            }

            // ── 9. GET /api/products (Store Products & Prices) ──
            if (pathname === '/api/products' && req.method === 'GET') {
                const products = readJSON(PRODUCTS_FILE);
                return sendJSON(res, 200, { success: true, products });
            }

            // ── 10. POST /api/products (Add New Product from Admin) ──
            if (pathname === '/api/products' && req.method === 'POST') {
                const body = await parseBody(req);
                const { name, category, type, pricePerUnit, unit, description, productionTime, badge, imageUrl } = body;

                if (!name || !pricePerUnit) {
                    return sendJSON(res, 400, { success: false, message: 'Nama produk dan harga per unit wajib diisi!' });
                }

                const products = readJSON(PRODUCTS_FILE);
                const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const id = slug || ('prod-' + Date.now().toString(36));

                const newProduct = {
                    id,
                    name: String(name).trim(),
                    category: category || 'banner',
                    badge: badge || 'new',
                    type: type || 'pcs',
                    rating: 5.0,
                    ratingCount: 1,
                    productionTime: productionTime || '1 - 2 Jam',
                    description: description || 'Layanan cetak profesional berkualitas tinggi.',
                    pricePerUnit: parseInt(pricePerUnit, 10) || 10000,
                    originalPrice: Math.round((parseInt(pricePerUnit, 10) || 10000) * 1.25),
                    unit: unit || 'pcs',
                    minOrder: 1,
                    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&h=450&fit=crop',
                    finishingOptions: [
                        { id: 'standar', label: 'Cetak Standar / Potong Rapi' }
                    ],
                    finishingPrices: {
                        'standar': 0
                    }
                };

                products.unshift(newProduct);
                writeJSON(PRODUCTS_FILE, products);

                return sendJSON(res, 201, {
                    success: true,
                    message: `Produk '${newProduct.name}' berhasil ditambahkan ke katalog toko!`,
                    product: newProduct
                });
            }

            // ── 11. POST /api/products/update (Update Price / Category / Details from Admin) ──
            if (pathname === '/api/products/update' && req.method === 'POST') {
                const body = await parseBody(req);
                const { id, name, category, pricePerUnit, originalPrice, unit, description, productionTime, badge } = body;

                if (!id) {
                    return sendJSON(res, 400, { success: false, message: 'ID produk wajib disertakan!' });
                }

                const products = readJSON(PRODUCTS_FILE);
                const found = products.find(p => p.id === id);

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Produk tidak ditemukan!' });
                }

                if (name) found.name = String(name).trim();
                if (category !== undefined) found.category = String(category).trim().toLowerCase() || 'umum';
                if (pricePerUnit !== undefined) found.pricePerUnit = parseInt(pricePerUnit, 10) || found.pricePerUnit;
                if (originalPrice !== undefined) found.originalPrice = parseInt(originalPrice, 10) || found.originalPrice;
                if (unit) found.unit = String(unit).trim();
                if (description) found.description = String(description).trim();
                if (productionTime) found.productionTime = String(productionTime).trim();
                if (badge) found.badge = String(badge).trim();

                writeJSON(PRODUCTS_FILE, products);

                return sendJSON(res, 200, {
                    success: true,
                    message: `Data & kategori '${found.name}' berhasil diperbarui!`,
                    product: found
                });
            }

            // ── 12. POST /api/products/delete (Delete Product from Admin) ──
            if (pathname === '/api/products/delete' && req.method === 'POST') {
                const body = await parseBody(req);
                const { id } = body;

                if (!id) {
                    return sendJSON(res, 400, { success: false, message: 'ID produk wajib diisi!' });
                }

                let products = readJSON(PRODUCTS_FILE);
                const initialLength = products.length;
                products = products.filter(p => p.id !== id);

                if (products.length === initialLength) {
                    return sendJSON(res, 404, { success: false, message: 'Produk tidak ditemukan!' });
                }

                writeJSON(PRODUCTS_FILE, products);

                return sendJSON(res, 200, {
                    success: true,
                    message: 'Produk berhasil dihapus dari katalog toko!'
                });
            }

            // ── 13. GET /api/categories (List all categories) ──
            if (pathname === '/api/categories' && req.method === 'GET') {
                let categories = readJSON(CATEGORIES_FILE);
                if (!Array.isArray(categories) || categories.length === 0) {
                    categories = [
                        { id: 'banner', name: 'Banner & Spanduk', icon: 'fas fa-scroll' },
                        { id: 'stiker', name: 'Stiker & Label A3+', icon: 'fas fa-tags' },
                        { id: 'dokumen', name: 'Brosur & Dokumen', icon: 'fas fa-newspaper' },
                        { id: 'merchandise', name: 'Merchandise & Kaos', icon: 'fas fa-tshirt' },
                        { id: 'custom', name: 'Percetakan Khusus', icon: 'fas fa-cogs' }
                    ];
                    writeJSON(CATEGORIES_FILE, categories);
                }

                const products = readJSON(PRODUCTS_FILE);
                const withCounts = categories.map(cat => ({
                    ...cat,
                    count: products.filter(p => (p.category || '').toLowerCase() === cat.id.toLowerCase()).length
                }));

                return sendJSON(res, 200, { success: true, categories: withCounts });
            }

            // ── 14. POST /api/categories (Add New Category) ──
            if (pathname === '/api/categories' && req.method === 'POST') {
                const body = await parseBody(req);
                const { name, icon } = body;
                let { id } = body;

                if (!name || !name.trim()) {
                    return sendJSON(res, 400, { success: false, message: 'Nama kategori wajib diisi!' });
                }

                id = (id || name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                const categories = readJSON(CATEGORIES_FILE);

                if (categories.some(c => c.id === id)) {
                    return sendJSON(res, 400, { success: false, message: `Kategori dengan ID '${id}' sudah ada!` });
                }

                const newCat = {
                    id,
                    name: name.trim(),
                    icon: icon && icon.trim() ? icon.trim() : 'fas fa-tag'
                };

                categories.push(newCat);
                writeJSON(CATEGORIES_FILE, categories);

                return sendJSON(res, 201, {
                    success: true,
                    message: `Kategori '${newCat.name}' berhasil ditambahkan!`,
                    category: newCat,
                    categories
                });
            }

            // ── 15. POST /api/categories/update (Edit / Rename Category) ──
            if (pathname === '/api/categories/update' && req.method === 'POST') {
                const body = await parseBody(req);
                const { oldId, name, icon, newId } = body;

                if (!oldId) {
                    return sendJSON(res, 400, { success: false, message: 'ID kategori lama wajib disertakan!' });
                }

                const categories = readJSON(CATEGORIES_FILE);
                const found = categories.find(c => c.id.toLowerCase() === oldId.toLowerCase());

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Kategori tidak ditemukan!' });
                }

                if (name && name.trim()) found.name = name.trim();
                if (icon && icon.trim()) found.icon = icon.trim();

                let effectiveId = found.id;
                if (newId && newId.trim() && newId.trim().toLowerCase() !== oldId.toLowerCase()) {
                    const cleanNewId = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                    if (categories.some(c => c.id === cleanNewId && c !== found)) {
                        return sendJSON(res, 400, { success: false, message: `ID kategori '${cleanNewId}' sudah digunakan!` });
                    }
                    found.id = cleanNewId;
                    effectiveId = cleanNewId;

                    // Update all products belonging to the old category ID
                    const products = readJSON(PRODUCTS_FILE);
                    let updatedCount = 0;
                    products.forEach(p => {
                        if ((p.category || '').toLowerCase() === oldId.toLowerCase()) {
                            p.category = cleanNewId;
                            updatedCount++;
                        }
                    });
                    if (updatedCount > 0) {
                        writeJSON(PRODUCTS_FILE, products);
                    }
                }

                writeJSON(CATEGORIES_FILE, categories);

                return sendJSON(res, 200, {
                    success: true,
                    message: `Kategori '${found.name}' berhasil diperbarui!`,
                    category: found,
                    categories
                });
            }

            // ── 16. POST /api/categories/delete (Delete Category) ──
            if (pathname === '/api/categories/delete' && req.method === 'POST') {
                const body = await parseBody(req);
                const { id, reassignTo } = body;

                if (!id) {
                    return sendJSON(res, 400, { success: false, message: 'ID kategori wajib disertakan!' });
                }

                let categories = readJSON(CATEGORIES_FILE);
                const found = categories.find(c => c.id.toLowerCase() === id.toLowerCase());

                if (!found) {
                    return sendJSON(res, 404, { success: false, message: 'Kategori tidak ditemukan!' });
                }

                categories = categories.filter(c => c.id.toLowerCase() !== id.toLowerCase());
                writeJSON(CATEGORIES_FILE, categories);

                // Reassign affected products to 'umum' or requested target
                const targetCat = (reassignTo || 'umum').toLowerCase();
                const products = readJSON(PRODUCTS_FILE);
                let affectedCount = 0;
                products.forEach(p => {
                    if ((p.category || '').toLowerCase() === id.toLowerCase()) {
                        p.category = targetCat;
                        affectedCount++;
                    }
                });

                if (affectedCount > 0) {
                    writeJSON(PRODUCTS_FILE, products);
                }

                return sendJSON(res, 200, {
                    success: true,
                    message: `Kategori '${found.name}' berhasil dihapus! (${affectedCount} produk dialihkan ke kategori '${targetCat}')`,
                    categories
                });
            }

            // ── 17. GET /api/cash-ledger (Modal Awal & Mutasi Kas Laci) ──
            if (pathname === '/api/cash-ledger' && req.method === 'GET') {
                const ledger = readJSON(CASH_LEDGER_FILE, {
                    initialFloat: 200000,
                    lastUpdated: new Date().toISOString(),
                    updatedBy: 'Bapak Hendra (Master Admin)',
                    logs: []
                });
                return sendJSON(res, 200, { success: true, ...ledger });
            }

            // ── 18. POST /api/cash-ledger/set-float (Atur Modal Kas Awal dari Pemilik) ──
            if (pathname === '/api/cash-ledger/set-float' && req.method === 'POST') {
                const body = await parseBody(req);
                const { initialFloat, operator, notes } = body;
                const parsedFloat = parseInt(initialFloat, 10);

                if (isNaN(parsedFloat) || parsedFloat < 0) {
                    return sendJSON(res, 400, { success: false, message: 'Nominal modal kas awal harus berupa angka non-negatif!' });
                }

                const ledger = readJSON(CASH_LEDGER_FILE, {
                    initialFloat: 200000,
                    lastUpdated: new Date().toISOString(),
                    updatedBy: operator || 'Master Admin',
                    logs: []
                });

                ledger.initialFloat = parsedFloat;
                ledger.lastUpdated = new Date().toISOString();
                ledger.updatedBy = operator || 'Master Admin';

                if (!Array.isArray(ledger.logs)) ledger.logs = [];
                ledger.logs.unshift({
                    id: 'CASH-' + Date.now().toString(36).toUpperCase(),
                    timestamp: new Date().toISOString(),
                    type: 'modal_awal',
                    category: 'Modal Kembalian Pemilik',
                    amount: parsedFloat,
                    operator: operator || 'Master Admin',
                    notes: notes || 'Pembaruan modal awal uang kembalian kasir dari pemilik'
                });

                writeJSON(CASH_LEDGER_FILE, ledger);

                return sendJSON(res, 200, {
                    success: true,
                    message: `Modal uang kembalian toko berhasil diatur menjadi Rp ${parsedFloat.toLocaleString('id-ID')}`,
                    ...ledger
                });
            }

            // ── 19. POST /api/cash-ledger/entry (Catat Kas Masuk / Kas Keluar Manual) ──
            if (pathname === '/api/cash-ledger/entry' && req.method === 'POST') {
                const body = await parseBody(req);
                const { type, category, amount, operator, notes } = body;
                const parsedAmount = parseInt(amount, 10);

                if (!type || (type !== 'in' && type !== 'out')) {
                    return sendJSON(res, 400, { success: false, message: "Jenis transaksi harus 'in' (kas masuk) atau 'out' (kas keluar)!" });
                }

                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                    return sendJSON(res, 400, { success: false, message: 'Nominal transaksi harus berupa angka lebih dari 0!' });
                }

                const ledger = readJSON(CASH_LEDGER_FILE, {
                    initialFloat: 200000,
                    lastUpdated: new Date().toISOString(),
                    updatedBy: operator || 'Kasir',
                    logs: []
                });

                if (!Array.isArray(ledger.logs)) ledger.logs = [];
                const newEntry = {
                    id: 'CASH-' + Date.now().toString(36).toUpperCase(),
                    timestamp: new Date().toISOString(),
                    type,
                    category: category || (type === 'in' ? 'Kas Masuk Toko' : 'Operasional Toko'),
                    amount: parsedAmount,
                    operator: operator || 'Kasir',
                    notes: notes || (type === 'in' ? 'Pemasukan kas toko' : 'Pengeluaran operasional toko')
                };

                ledger.logs.unshift(newEntry);
                ledger.lastUpdated = new Date().toISOString();
                ledger.updatedBy = operator || 'Kasir';

                writeJSON(CASH_LEDGER_FILE, ledger);

                return sendJSON(res, 201, {
                    success: true,
                    message: `Transaksi kas ${type === 'in' ? 'masuk' : 'keluar'} sebesar Rp ${parsedAmount.toLocaleString('id-ID')} berhasil dicatat!`,
                    entry: newEntry,
                    ...ledger
                });
            }

            // ----------------------------------------------------
            // FINANCIAL OVERRIDE (Master Admin Custom Nominal)
            // ----------------------------------------------------
            if (pathname === '/api/financial-override' && req.method === 'GET') {
                const override = readJSON(FINANCIAL_OVERRIDE_FILE, { enabled: false });
                return sendJSON(res, 200, {
                    success: true,
                    ...override
                });
            }

            if (pathname === '/api/financial-override' && req.method === 'POST') {
                const body = await parseBody(req);
                const current = readJSON(FINANCIAL_OVERRIDE_FILE, { enabled: false });

                const updated = {
                    ...current,
                    enabled: !!body.enabled,
                    updatedAt: new Date().toISOString(),
                    updatedBy: body.operator || 'Master Admin'
                };

                if (body.totalRevenue !== undefined) updated.totalRevenue = Number(body.totalRevenue) || 0;
                if (body.realCashIn !== undefined) updated.realCashIn = Number(body.realCashIn) || 0;
                if (body.pendingBalance !== undefined) updated.pendingBalance = Number(body.pendingBalance) || 0;
                if (body.totalOrdersCount !== undefined) updated.totalOrdersCount = Number(body.totalOrdersCount) || 0;
                if (body.aov !== undefined) updated.aov = Number(body.aov) || 0;
                if (body.offlineRevenue !== undefined) updated.offlineRevenue = Number(body.offlineRevenue) || 0;
                if (body.onlineRevenue !== undefined) updated.onlineRevenue = Number(body.onlineRevenue) || 0;
                if (body.qrisTotal !== undefined) updated.qrisTotal = Number(body.qrisTotal) || 0;
                if (body.qrisCount !== undefined) updated.qrisCount = Number(body.qrisCount) || 0;
                if (body.cashTotal !== undefined) updated.cashTotal = Number(body.cashTotal) || 0;
                if (body.cashCount !== undefined) updated.cashCount = Number(body.cashCount) || 0;
                if (body.bankTotal !== undefined) updated.bankTotal = Number(body.bankTotal) || 0;
                if (body.bankCount !== undefined) updated.bankCount = Number(body.bankCount) || 0;
                if (body.ewalletTotal !== undefined) updated.ewalletTotal = Number(body.ewalletTotal) || 0;
                if (body.ewalletCount !== undefined) updated.ewalletCount = Number(body.ewalletCount) || 0;

                writeJSON(FINANCIAL_OVERRIDE_FILE, updated);

                return sendJSON(res, 200, {
                    success: true,
                    message: updated.enabled 
                        ? 'Mode penyesuaian nominal finansial berhasil diaktifkan & disimpan!'
                        : 'Mode penyesuaian dinonaktifkan. Data kembali dihitung otomatis dari database transaksi.',
                    ...updated
                });
            }

            return sendJSON(res, 404, { success: false, message: 'API route not found' });
        } catch (apiErr) {
            console.error('API Error:', apiErr);
            return sendJSON(res, 500, { success: false, message: 'Server internal error: ' + apiErr.message });
        }
    }

    // ============================================
    // STATIC FILE SERVING
    // ============================================
    // KEAMANAN KRITIS: Blokir akses langsung ke folder /data/, file konfigurasi, dan file tersembunyi
    if (pathname.startsWith('/data/') || pathname.startsWith('/data') || pathname.includes('/.') || pathname.endsWith('.bat') || pathname.endsWith('.ps1') || pathname.endsWith('.yaml') || pathname.endsWith('.yml')) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: false, message: '403 Forbidden: Akses langsung ke data internal dan konfigurasi sistem diblokir demi keamanan.' }));
        return;
    }

    let relativePath = pathname;
    if (relativePath.endsWith('/')) {
        relativePath += 'index.html';
    }

    let safePath = path.normalize(path.join(ROOT_DIR, relativePath));

    if (!safePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(safePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            safePath = path.join(safePath, 'index.html');
        }

        fs.stat(safePath, (err2, stats2) => {
            if (err2 || !stats2.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
                res.end(`
                    <div style="font-family:sans-serif; text-align:center; padding:3rem;">
                        <h1>404 Halaman Tidak Ditemukan</h1>
                        <p><a href="/">Halaman Pelanggan (/)</a> | <a href="/kasir/">Kasir POS (/kasir/)</a> | <a href="/admin/">Admin (/admin/)</a></p>
                    </div>
                `);
                return;
            }

            const ext = path.extname(safePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });

            const stream = fs.createReadStream(safePath);
            stream.pipe(res);
        });
    });
};

function getLocalIP() {
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    } catch (_) {}
    return '127.0.0.1';
}

const server = http.createServer(requestHandler);

// Hanya jalankan server.listen jika berjalan di server mandiri / komputer lokal (Bukan Vercel Serverless)
if (!process.env.VERCEL && !process.env.NOW_REGION) {
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (attemptCount < MAX_PORT_ATTEMPTS) {
                attemptCount++;
                const nextPort = currentPort + 1;
                console.log(`[PERINGATAN] Port ${currentPort} sedang digunakan oleh aplikasi lain.`);
                console.log(`[INFO] Otomatis mencoba beralih ke port ${nextPort}...`);
                currentPort = nextPort;
                setTimeout(() => {
                    server.listen(currentPort, '0.0.0.0');
                }, 150);
                return;
            }
            console.error(`\n[ERROR] Tidak dapat menemukan port bebas setelah ${MAX_PORT_ATTEMPTS} percobaan!`);
            console.error(`Silakan tentukan port manual: node server.js <nomor_port>\n`);
        } else {
            console.error('\n[ERROR Server]:', err.message);
        }
        process.exit(1);
    });

    server.listen(currentPort, '0.0.0.0', () => {
        const localIP = getLocalIP();
        console.log(`\n========================================================`);
        console.log(`  PERCETAKAN GILAR MEDIA - SERVER AKTIF & DATABASE JSON TERHUBUNG`);
        console.log(`========================================================`);
        console.log(`  * Direktori Proyek   : ${ROOT_DIR}`);
        console.log(`  * Database JSON Path : ${DATA_DIR}`);
        console.log(`  * Port Aktif         : ${currentPort}`);
        console.log(`--------------------------------------------------------`);
        console.log(`  AKSES DI KOMPUTER INI (LOCALHOST):`);
        console.log(`  * Toko Online Pelanggan : http://localhost:${currentPort}/`);
        console.log(`  * Portal Kasir POS      : http://localhost:${currentPort}/kasir/`);
        console.log(`  * Master Admin Panel    : http://localhost:${currentPort}/admin/`);
        if (localIP && localIP !== '127.0.0.1') {
            console.log(`--------------------------------------------------------`);
            console.log(`  AKSES DARI HP / LAPTOP LAIN (JARINGAN WI-FI / LAN SAMA):`);
            console.log(`  * Toko Online Pelanggan : http://${localIP}:${currentPort}/`);
            console.log(`  * Portal Kasir POS      : http://${localIP}:${currentPort}/kasir/`);
            console.log(`  * Master Admin Panel    : http://${localIP}:${currentPort}/admin/`);
        }
        console.log(`========================================================\n`);

        // Otomatis buka browser default jika tidak dinonaktifkan (hanya di komputer lokal)
        const isCloudEnv = Boolean(process.env.RENDER || process.env.RAILWAY_STATIC_URL || process.env.PORT || process.env.NODE_ENV === 'production');
        const noOpen = process.argv.includes('--no-open') || process.env.AUTO_OPEN === 'false' || isCloudEnv;
        if (!noOpen) {
            const targetUrl = `http://localhost:${currentPort}/`;
            const openCmd = process.platform === 'win32' ? `start "" "${targetUrl}"` :
                            process.platform === 'darwin' ? `open "${targetUrl}"` :
                            `xdg-open "${targetUrl}"`;
            exec(openCmd, () => {});
        }
    });
}

module.exports = requestHandler;
module.exports.server = server;


