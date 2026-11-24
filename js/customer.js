/**
 * ============================================
 *  CUSTOMER.JS — POV Pelanggan (Digital Media)
 *  Fitur: Katalog Cetak Digital, Live Kalkulator Meteran Banner,
 *  Upload Desain, Pendaftaran/Login Sebelum Beli, Order Tracking Real-Time
 * ============================================
 */
'use strict';

const CustomerModule = (() => {
    let currentFilter = 'all';
    let searchQuery = '';
    let pendingProductId = null;
    let liveProducts = [];

    let liveCategories = null;

    async function init() {
        setupThemeToggle();
        setupFilterEvents();
        setupSearchEvents();
        setupOrderTracker();
        setupHeroBentoWidgets();
        await fetchLiveProducts();
        await syncCategoriesFromServer();
        render();
    }

    async function syncCategoriesFromServer() {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
                liveCategories = [
                    { id: 'all', name: 'Semua Layanan', icon: 'fas fa-print' },
                    ...data.categories
                ];
            }
        } catch (e) {
            // fallback
        }
    }

    async function fetchLiveProducts() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (data.success && Array.isArray(data.products) && data.products.length > 0) {
                liveProducts = data.products;
                liveProducts.forEach(p => {
                    if (typeof PrintingPrices !== 'undefined') {
                        PrintingPrices[p.id] = {
                            pricePerUnit: p.pricePerUnit || 0,
                            originalPrice: p.originalPrice || 0,
                            unit: p.unit || 'pcs',
                            minOrder: p.minOrder || 1,
                            finishingPrices: p.finishingPrices || {}
                        };
                    }
                });
            } else {
                liveProducts = PrintingProducts;
            }
        } catch (err) {
            console.warn('Using offline static products:', err);
            liveProducts = PrintingProducts;
        }
    }

    function render() {
        renderCategories();
        renderProducts();
        updateCustomerCartBadge();
    }

    // ─── Render Categories ───
    function renderCategories() {
        const grid = document.getElementById('cust-categories-grid');
        if (!grid) return;

        const allProds = liveProducts.length > 0 ? liveProducts : PrintingProducts;
        const categoriesToList = liveCategories || PrintingCategories;

        grid.innerHTML = categoriesToList.map(cat => {
            const count = cat.id === 'all' 
                ? allProds.length 
                : allProds.filter(p => (p.category || '').toLowerCase() === cat.id.toLowerCase()).length;

            return `
                <div class="category-chip ${cat.id === currentFilter ? 'active' : ''}" data-cat-filter="${cat.id}">
                    <i class="${cat.icon}"></i>
                    <span>${cat.name}</span>
                    <span class="cat-count-badge">${count}</span>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.category-chip').forEach(card => {
            card.addEventListener('click', () => {
                currentFilter = card.getAttribute('data-cat-filter');
                grid.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                renderProducts();
            });
        });
    }

    // ─── Render Products / Services ───
    function renderProducts() {
        const grid = document.getElementById('cust-products-grid');
        if (!grid) return;

        let filtered = liveProducts.length > 0 ? [...liveProducts] : [...PrintingProducts];
        if (currentFilter !== 'all') {
            filtered = filtered.filter(p => p.category === currentFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px solid var(--border-color);">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem; opacity: 0.6;"></i>
                    <h3 style="font-size: 1.2rem; font-weight: 700;">Layanan percetakan tidak ditemukan</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">Coba gunakan kata kunci lain seperti spanduk, stiker, brosur, atau kaos.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(product => {
            const priceInfo = (typeof PrintingPrices !== 'undefined' && PrintingPrices[product.id]) 
                ? PrintingPrices[product.id] 
                : { pricePerUnit: product.pricePerUnit || 0, unit: product.unit || 'pcs' };
            const img = product.imageUrl || (typeof PrintingImages !== 'undefined' ? PrintingImages[product.id] || PrintingImages['default'] : 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&h=450&fit=crop');

            return `
                <div class="printing-card" data-product-id="${product.id}">
                    <div class="printing-card-img">
                        <img src="${img}" alt="${Security.sanitizeHTML(product.name)}" loading="lazy">
                        ${product.badge ? `<span class="printing-badge badge-${product.badge}">${product.badge.toUpperCase()}</span>` : ''}
                        <span class="prod-time-badge"><i class="fas fa-stopwatch"></i> ${product.productionTime || '1 - 2 Jam'}</span>
                    </div>
                    <div class="printing-card-body">
                        <div class="card-top-meta">
                            <span class="printing-category-label">${(product.category || 'UMUM').toUpperCase()}</span>
                            <span class="printing-rating-pill"><i class="fas fa-star"></i> ${product.rating || '4.9'}</span>
                        </div>
                        <h3 class="printing-title">${Security.sanitizeHTML(product.name)}</h3>
                        <p class="printing-desc">${Security.sanitizeHTML(product.description || '')}</p>
                        
                        <div class="printing-price-row">
                            <div class="price-stack">
                                <span class="price-from-label">Mulai dari</span>
                                <div class="price-val-wrap">
                                    <span class="printing-unit-price">${formatRupiah(priceInfo.pricePerUnit)}</span>
                                    <small class="printing-unit-label">/${priceInfo.unit || 'pcs'}</small>
                                </div>
                            </div>
                            <button type="button" class="btn btn-primary btn-sm btn-order-service" data-id="${product.id}">
                                <i class="fas fa-sliders-h"></i> Hitung & Pesan
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Order click event -> Must check login first
        grid.querySelectorAll('.btn-order-service').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                handleCustomerOrderClick(id);
            });
        });
    }

    // ─── Check Login Requirement Before Buying / Ordering ───
    function handleCustomerOrderClick(productId) {
        if (!Security.isCustomerLoggedIn()) {
            pendingProductId = productId;
            UI.showToast('Akun Diperlukan 🔒', 'Silakan Masuk atau Buat Akun Baru terlebih dahulu untuk memesan cetak.', 'info');
            UI.openModal('customer-auth-modal');
            return;
        }

        openServiceCalculatorModal(productId);
    }

    // ─── Calculator & Order Modal (With Live Area / Meter Calc) ───
    function openServiceCalculatorModal(productId) {
        const allProds = liveProducts.length > 0 ? liveProducts : PrintingProducts;
        const product = allProds.find(p => p.id === productId);
        if (!product) return;

        const priceInfo = (typeof PrintingPrices !== 'undefined' && PrintingPrices[productId])
            ? PrintingPrices[productId]
            : { 
                pricePerUnit: product.pricePerUnit || 0, 
                unit: product.unit || 'pcs', 
                minOrder: product.minOrder || 1, 
                finishingPrices: product.finishingPrices || {} 
            };

        const modal = document.getElementById('service-calc-modal');
        const container = document.getElementById('service-calc-content');
        if (!modal || !container) return;

        const img = product.imageUrl || (typeof PrintingImages !== 'undefined' ? PrintingImages[productId] || PrintingImages['default'] : 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&h=450&fit=crop');
        const session = Security.getActiveSession() || {};
        const finishingOpts = (product.finishingOptions && product.finishingOptions.length > 0)
            ? product.finishingOptions
            : [{ id: 'standar', label: 'Standar Hasil Cetak' }];

        container.innerHTML = `
            <div class="calc-modal-grid">
                <div class="calc-preview-col">
                    <img src="${img}" alt="${product.name}" class="calc-main-img">
                    <h3 style="margin-top: 1rem; font-size:1.3rem; font-weight:800;">${Security.sanitizeHTML(product.name)}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 0.25rem;">
                        ${Security.sanitizeHTML(product.description || '')}
                    </p>
                    <div class="calc-spec-pill">
                        <i class="fas fa-stopwatch" style="color:var(--accent-start)"></i> Waktu Cetak: <strong>${product.productionTime || '1 - 2 Jam'}</strong>
                    </div>
                    <div style="margin-top:0.75rem; padding:0.75rem; background:rgba(6,182,212,0.1); border-radius:var(--radius-md); font-size:0.82rem; color:var(--text-primary);">
                        <i class="fas fa-user-check" style="color:var(--success)"></i> Pemesan: <strong>${Security.sanitizeHTML(session.name || 'Pelanggan')}</strong> (${session.phone || ''})
                    </div>
                </div>
                <div class="calc-form-col">
                    <form id="printing-custom-form">
                        <!-- Jumlah Qty -->
                        <div class="form-group">
                            <label>Jumlah Pesanan (${priceInfo.unit})</label>
                            <input type="number" id="calc-qty" value="${priceInfo.minOrder || 1}" min="${priceInfo.minOrder || 1}" max="5000">
                        </div>

                        <!-- Opsi Finishing -->
                        <div class="form-group">
                            <label>Pilihan Finishing & Hasil Akhir</label>
                            <select id="calc-finishing">
                                ${finishingOpts.map(f => {
                                    const extra = (priceInfo.finishingPrices && priceInfo.finishingPrices[f.id]) || 0;
                                    return `<option value="${f.id}" data-extra="${extra}">
                                        ${f.label} ${extra > 0 ? `(+${formatRupiah(extra)})` : '(Gratis)'}
                                    </option>`;
                                }).join('')}
                            </select>
                        </div>

                        <!-- Upload File Desain -->
                        <div class="form-group">
                            <label>Upload File Desain Siap Cetak (PDF / TIFF / PNG / JPG / ZIP)</label>
                            <div class="upload-dropzone" id="upload-dropzone">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <span id="upload-label">Klik untuk pilih file desain dari komputer / HP</span>
                                <input type="file" id="calc-file" accept=".pdf,.tiff,.tif,.jpg,.jpeg,.png,.zip" style="display:none;">
                            </div>
                            <small style="color:var(--text-tertiary); font-size:0.75rem;">Maksimal 50MB. Disarankan format PDF atau TIFF (CMYK 300 DPI) untuk warna tajam.</small>
                        </div>

                        <!-- Catatan Khusus Cetak -->
                        <div class="form-group">
                            <label>Catatan Tambahan untuk Operator</label>
                            <input type="text" id="calc-notes" placeholder="Contoh: Tolong warna merah dibuat pekat & ring sudut diperkuat">
                        </div>

                        <!-- Rincian Biaya -->
                        <div class="calc-subtotal-box">
                            <div>
                                <span>Estimasi Total Biaya</span>
                                <h2 id="calc-total-preview">Rp 0</h2>
                            </div>
                            <button type="submit" class="btn btn-primary btn-lg">
                                <i class="fas fa-cart-plus"></i> Masukkan Pesanan
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        function calculateLiveTotal() {
            const qtyInput = document.getElementById('calc-qty');
            const finishingSelect = document.getElementById('calc-finishing');
            const totalPreview = document.getElementById('calc-total-preview');

            const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
            const extraFinishing = parseInt(finishingSelect && finishingSelect.selectedIndex >= 0 ? finishingSelect.options[finishingSelect.selectedIndex].getAttribute('data-extra') || 0 : 0, 10);

            const unitCost = priceInfo.pricePerUnit + extraFinishing;
            const total = unitCost * qty;

            if (totalPreview) totalPreview.textContent = formatRupiah(total);
            return total;
        }

        ['calc-qty', 'calc-finishing'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calculateLiveTotal);
            if (el) el.addEventListener('change', calculateLiveTotal);
        });

        calculateLiveTotal();

        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('calc-file');
        const uploadLabel = document.getElementById('upload-label');
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    uploadLabel.innerHTML = `<strong><i class="fas fa-check-circle" style="color:var(--success)"></i> ${fileInput.files[0].name}</strong> (${(fileInput.files[0].size / 1024 / 1024).toFixed(2)} MB)`;
                }
            });
        }

        const form = document.getElementById('printing-custom-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const total = calculateLiveTotal();
            const qty = parseInt(document.getElementById('calc-qty').value, 10) || 1;
            const notes = document.getElementById('calc-notes').value;
            const finishingSelect = document.getElementById('calc-finishing');
            const finishingLabel = finishingSelect.options[finishingSelect.selectedIndex].text;
            const fileName = (fileInput && fileInput.files.length > 0) ? fileInput.files[0].name : 'Desain_Kustom_Customer.pdf';

            const specs = `${finishingLabel} (×${qty} ${priceInfo.unit || 'pcs'})`;

            addCustomerCartItem({
                productId: product.id,
                name: product.name,
                specs,
                quantity: qty,
                price: total,
                fileName,
                notes: notes || '-'
            });

            UI.closeModal('service-calc-modal');
            UI.showToast('Pesanan Ditambahkan 🛒', `${product.name} masuk ke keranjang belanja`, 'success');
            setTimeout(() => {
                if (typeof UI !== 'undefined' && UI.openCart) {
                    UI.openCart();
                }
            }, 300);
        });

        UI.openModal('service-calc-modal');
    }

    // ─── Customer Cart Management ───
    function getCustomerCart() {
        return Security.safeGetStorage('dm_cust_cart') || [];
    }

    function saveCustomerCart(items) {
        Security.safeSetStorage('dm_cust_cart', items);
        updateCustomerCartBadge();
    }

    function addCustomerCartItem(item) {
        const cart = getCustomerCart();
        cart.push({
            id: 'ITM-' + Date.now().toString(36),
            ...item
        });
        saveCustomerCart(cart);
    }

    function removeCustomerCartItem(itemId) {
        const cart = getCustomerCart().filter(i => i.id !== itemId);
        saveCustomerCart(cart);
        renderCustomerCartDrawer();
    }

    function updateCustomerCartBadge() {
        const count = getCustomerCart().length;
        const badges = document.querySelectorAll('.cust-cart-count');
        badges.forEach(b => b.textContent = count);
    }

    function renderCustomerCartDrawer() {
        const container = document.getElementById('cust-cart-items');
        const totalEl = document.getElementById('cust-cart-total');
        if (!container) return;

        const cart = getCustomerCart();
        if (cart.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 4rem 1.5rem; color: var(--text-tertiary);">
                    <i class="fas fa-shopping-basket" style="font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.4;"></i>
                    <p style="font-weight:700; font-size:1.1rem; color:var(--text-secondary);">Keranjang pesanan masih kosong</p>
                    <span style="font-size:0.85rem;">Pilih layanan cetak pada katalog di atas untuk mulai order.</span>
                </div>
            `;
            if (totalEl) totalEl.textContent = 'Rp 0';
            return;
        }

        let total = 0;
        container.innerHTML = cart.map(item => {
            total += item.price;
            return `
                <div class="cart-item-card">
                    <div class="cart-item-header">
                        <strong>${Security.sanitizeHTML(item.name)}</strong>
                        <button type="button" class="btn-remove-item" data-cart-id="${item.id}" aria-label="Hapus item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <small class="cart-item-specs">${Security.sanitizeHTML(item.specs)}</small>
                    <div class="cart-item-file">
                        <i class="fas fa-file-invoice" style="color:var(--accent-start)"></i> File: <span>${Security.sanitizeHTML(item.fileName)}</span>
                    </div>
                    <div class="cart-item-subtotal">
                        <span>Biaya:</span>
                        <strong>${formatRupiah(item.price)}</strong>
                    </div>
                </div>
            `;
        }).join('');

        if (totalEl) totalEl.textContent = formatRupiah(total);

        container.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-cart-id');
                removeCustomerCartItem(id);
            });
        });
    }

    // ─── Setup Search & Filter ───
    function setupSearchEvents() {
        const input = document.getElementById('cust-search-input');
        if (!input) return;

        input.addEventListener('input', () => {
            searchQuery = Security.sanitizeInput(input.value);
            renderProducts();
        });
    }

    function setupFilterEvents() {
        // Events attached dynamically in renderCategories
    }

    // ─── Setup Hero Bento Widgets ───
    function setupHeroBentoWidgets() {
        const lenInput = document.getElementById('hero-slider-len');
        const widInput = document.getElementById('hero-slider-wid');
        const lenVal = document.getElementById('hero-slider-len-val');
        const widVal = document.getElementById('hero-slider-wid-val');
        const areaEl = document.getElementById('hero-calc-area');
        const priceEl = document.getElementById('hero-calc-price');
        const orderBtn = document.getElementById('btn-hero-calc-order');
        const preflightBox = document.getElementById('hero-preflight-box');

        function updateHeroCalc() {
            if (!lenInput || !widInput) return;
            const len = parseFloat(lenInput.value) || 3;
            const wid = parseFloat(widInput.value) || 1;
            const area = (len * wid);
            if (lenVal) lenVal.textContent = len.toFixed(1) + ' m';
            if (widVal) widVal.textContent = wid.toFixed(1) + ' m';
            if (areaEl) areaEl.textContent = area.toFixed(2);
            const estimatedPrice = Math.round(area * 20000);
            if (priceEl) priceEl.textContent = formatRupiah(estimatedPrice);
        }

        if (lenInput && widInput) {
            lenInput.addEventListener('input', updateHeroCalc);
            widInput.addEventListener('input', updateHeroCalc);
            updateHeroCalc();
        }

        if (orderBtn) {
            orderBtn.addEventListener('click', () => {
                handleCustomerOrderClick('banner-flexi-standar');
            });
        }

        if (preflightBox) {
            preflightBox.addEventListener('click', () => {
                UI.showToast('Layanan Cek File 📂', 'Kirimkan file desain via WhatsApp atau upload saat pemesanan untuk dicek gratis oleh operator percetakan kami.', 'info');
            });
        }
    }

    // ─── Theme Toggle (Midnight Obsidian Dark Luxury <-> Light) ───
    function setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        const html = document.documentElement;

        // Default to 'dark' for Midnight Obsidian & Neon CMYK
        const savedTheme = localStorage.getItem('digital_media_theme') || 'dark';
        html.setAttribute('data-theme', savedTheme);
        updateToggleIcon(savedTheme);

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const current = html.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                html.setAttribute('data-theme', next);
                localStorage.setItem('digital_media_theme', next);
                updateToggleIcon(next);
            });
        }

        function updateToggleIcon(theme) {
            if (!toggleBtn) return;
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (theme === 'dark') {
                    icon.className = 'fas fa-sun';
                    toggleBtn.setAttribute('title', 'Beralih ke Mode Terang');
                } else {
                    icon.className = 'fas fa-moon';
                    toggleBtn.setAttribute('title', 'Beralih ke Mode Gelap Obsidian');
                }
            }
        }
    }

    // ─── Setup Order Tracking via Server API ───
    // ─── Helper Generator Struk m-BCA Demo untuk Tracking & Customer ───
    function generateBankReceiptCanvas(orderId, amount, paymentMethod) {
        const canvas = document.createElement('canvas');
        const width = 380;
        const height = 515;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const headerH = 95;
        const grad = ctx.createLinearGradient(0, 0, width, headerH);
        grad.addColorStop(0, '#005baa');
        grad.addColorStop(1, '#003e7e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, headerH);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.fillText('BCA', 22, 38);

        ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText('mobile', 70, 38);

        ctx.textAlign = 'right';
        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('m-Transfer', width - 22, 38);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(32, 70, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.fillText('✓', 28, 74);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText('TRANSAKSI BERHASIL', 48, 74);

        const rows = [
            { label: 'TANGGAL & WAKTU', val: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) },
            { label: 'NO. REFERENSI', val: 'TRX-' + (Date.now().toString().slice(-8)) + '-' + Math.floor(1000 + Math.random() * 9000) },
            { label: 'BANK TUJUAN', val: 'BCA (014) - KCU JAKARTA' },
            { label: 'REKENING TUJUAN', val: '889-1029-3847' },
            { label: 'NAMA PENERIMA', val: 'PERCETAKAN GILAR MEDIA' },
            { label: 'NOMINAL TRANSFER', val: 'Rp ' + Number(amount || 0).toLocaleString('id-ID'), highlight: true },
            { label: 'BERITA / NO. PESANAN', val: orderId || 'DM-ONL-SAMPLE' },
            { label: 'JENIS TRANSAKSI', val: (paymentMethod || '').toLowerCase() === 'qris' ? 'QRIS Digital Auto Settlement' : 'Transfer Antar Rekening BCA' }
        ];

        let curY = headerH + 34;
        rows.forEach(r => {
            ctx.textAlign = 'left';
            ctx.font = '600 10.5px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText(r.label, 24, curY);

            ctx.textAlign = 'right';
            if (r.highlight) {
                ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
                ctx.fillStyle = '#0f172a';
            } else {
                ctx.font = '700 11.5px "Segoe UI", Arial, sans-serif';
                ctx.fillStyle = '#1e293b';
            }
            ctx.fillText(r.val, width - 24, curY);

            curY += 34;

            ctx.strokeStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.moveTo(24, curY - 14);
            ctx.lineTo(width - 24, curY - 14);
            ctx.stroke();
        });

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(20, curY + 6, width - 40, 68);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(20, curY + 6, width - 40, 68);

        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#047857';
        ctx.fillText('🔒 RESI SAH ELEKTRONIK BANK CENTRAL ASIA', width / 2, curY + 28);

        ctx.font = '10px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Simpan struk ini sebagai bukti pembayaran percetakan Anda.', width / 2, curY + 44);
        ctx.fillText('Percetakan Gilar Media Payment System', width / 2, curY + 58);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // ─── Pelacakan Status Pesanan & Validasi Finansial ───
    function setupOrderTracker() {
        const trackerInput = document.getElementById('tracker-order-id');
        const trackerBtn = document.getElementById('btn-track-order');
        const trackerResult = document.getElementById('tracker-result-box');

        if (!trackerBtn) return;

        trackerBtn.addEventListener('click', async () => {
            const orderId = Security.sanitizeInput(trackerInput.value).trim().toUpperCase();
            if (!orderId) {
                UI.showToast('Input Kosong', 'Masukkan nomor ID pesanan cetak Anda', 'warning');
                return;
            }

            trackerResult.innerHTML = `<div style="text-align:center; padding:1.5rem;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--accent-start)"></i><p style="margin-top:0.5rem;">Mencari data pesanan di database...</p></div>`;

            try {
                const res = await fetch('/api/orders');
                const data = await res.json();
                const orders = data.orders || [];
                const found = orders.find(o => o.id === orderId);

                if (!found) {
                    trackerResult.innerHTML = `
                        <div class="alert alert-error">
                            <i class="fas fa-times-circle"></i>
                            <span>Pesanan dengan ID <strong>${Security.sanitizeHTML(orderId)}</strong> tidak ditemukan di database. Pastikan nomor order sesuai yang tercantum di nota.</span>
                        </div>
                    `;
                    return;
                }

                const stages = [
                    { id: 'Verifikasi Desain', icon: 'fas fa-file-check' },
                    { id: 'Antrian Mesin Cetak', icon: 'fas fa-list-ol' },
                    { id: 'Proses Printing', icon: 'fas fa-print' },
                    { id: 'Finishing & QC', icon: 'fas fa-cut' },
                    { id: 'Siap Diambil / Dikirim', icon: 'fas fa-box-check' }
                ];

                let currentIdx = stages.findIndex(s => s.id === found.status);
                if (currentIdx === -1) currentIdx = 2;

                const pStatus = found.paymentStatus || (found.paymentType === 'dp' ? 'dp_dibayar' : (found.channel === 'offline' ? 'lunas' : 'belum_bayar'));
                const total = found.total || 0;
                const amountPaid = found.amountPaid !== undefined ? found.amountPaid : (pStatus === 'dp_dibayar' ? Math.round(total * 0.5) : (pStatus === 'lunas' ? total : 0));
                const remainingBalance = found.remainingBalance !== undefined ? found.remainingBalance : (total - amountPaid);

                // Badge Pembayaran
                let payBadge = '';
                if (pStatus === 'lunas') {
                    payBadge = '<span class="badge" style="background:rgba(16,185,129,0.18); color:#10b981; border:1px solid #10b981; font-weight:800; font-size:0.8rem;"><i class="fas fa-check-circle"></i> LUNAS (100%)</span>';
                } else if (pStatus === 'dp_dibayar') {
                    payBadge = '<span class="badge" style="background:rgba(245,158,11,0.18); color:#f59e0b; border:1px solid #f59e0b; font-weight:800; font-size:0.8rem;"><i class="fas fa-hourglass-half"></i> DP 50% DITERIMA</span>';
                } else if (pStatus === 'menunggu_verifikasi') {
                    payBadge = '<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid #f59e0b; font-weight:800; font-size:0.8rem;"><i class="fas fa-clock fa-spin"></i> MENUNGGU VERIFIKASI TOKO</span>';
                } else {
                    payBadge = '<span class="badge" style="background:rgba(239,68,68,0.18); color:#ef4444; border:1px solid #ef4444; font-weight:800; font-size:0.8rem;"><i class="fas fa-times-circle"></i> BELUM BAYAR</span>';
                }

                // Kotak Aksi Finansial (Pelunasan atau Unggah Bukti)
                let actionBoxHTML = '';
                if (pStatus === 'dp_dibayar' && remainingBalance > 0) {
                    actionBoxHTML = `
                        <div style="margin-top:1rem; padding:0.85rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                            <div style="font-size:0.82rem; color:var(--text-secondary);">
                                <strong style="color:#f59e0b;"><i class="fas fa-coins"></i> Pelunasan Sisa DP 50%</strong>
                                <div>Sisa tagihan sebesar <strong style="color:#ef4444;">${formatRupiah(remainingBalance)}</strong> dapat dilunasi sekarang atau saat pengambilan di toko.</div>
                            </div>
                            <button type="button" class="btn btn-warning btn-sm" id="btn-tracker-settle" style="font-weight:800; font-size:0.85rem;">
                                <i class="fas fa-credit-card"></i> Lunasi Sisa Tagihan Sekarang
                            </button>
                        </div>
                    `;
                } else if (pStatus === 'menunggu_verifikasi') {
                    actionBoxHTML = `
                        <div style="margin-top:1rem; padding:0.85rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                            <div style="font-size:0.82rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
                                <i class="fas fa-hourglass-half fa-spin" style="color:#f59e0b; font-size:1.3rem;"></i>
                                <div>
                                    <strong style="color:#f59e0b;">Bukti Pembayaran Terkirim</strong>
                                    <div>Struk sedang diverifikasi oleh admin toko sebelum dikirim ke mesin cetak.</div>
                                </div>
                            </div>
                            ${found.paymentProof && found.paymentProof.image ? `
                                <button type="button" class="btn btn-outline btn-sm" id="btn-tracker-view-proof" style="font-size:0.78rem;">
                                    <i class="fas fa-image"></i> Lihat Bukti Terlampir
                                </button>
                            ` : ''}
                        </div>
                    `;
                } else if (pStatus === 'belum_bayar') {
                    actionBoxHTML = `
                        <div style="margin-top:1rem; padding:0.85rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md);">
                            <div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.6rem;">
                                <strong style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Menunggu Konfirmasi Bukti Pembayaran</strong>
                                <div>Silakan lakukan transfer atau scan QRIS, lalu kirim bukti agar pesanan segera dicetak.</div>
                            </div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                <button type="button" class="btn btn-outline btn-sm" id="btn-tracker-sim-proof" style="color:#818cf8; border-color:#6366f1; font-weight:800; font-size:0.8rem;">
                                    <i class="fas fa-bolt"></i> ⚡ Pasang Contoh Struk & Konfirmasi (Demo Sidang)
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    actionBoxHTML = `
                        <div style="margin-top:1rem; padding:0.75rem 1rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:var(--radius-md); display:flex; align-items:center; gap:0.5rem; font-size:0.84rem; color:#10b981;">
                            <i class="fas fa-check-circle" style="font-size:1.1rem;"></i>
                            <span>Pembayaran pesanan ini telah <strong>LUNAS 100%</strong>. Terima kasih telah mencetak di Percetakan Gilar Media!</span>
                        </div>
                    `;
                }

                trackerResult.innerHTML = `
                    <div class="tracker-card">
                        <div class="tracker-card-header">
                            <div>
                                <strong style="font-size:1.15rem; color:var(--accent-start); font-family:var(--font-mono);">${found.id}</strong> — <span class="badge ${found.channel === 'online' ? 'badge-new' : 'badge-hot'}">${(found.channel || 'OFFLINE').toUpperCase()}</span>
                                <p style="font-size:0.8rem; color:var(--text-tertiary); margin-top:2px;">Waktu Pemesanan: ${new Date(found.createdAt).toLocaleString('id-ID')}</p>
                            </div>
                            <span class="badge badge-new" style="font-size:0.92rem; padding:0.4rem 1rem;">
                                <i class="fas fa-circle-notch fa-spin"></i> ${found.status}
                            </span>
                        </div>
                        
                        <!-- Progress Stepper -->
                        <div class="tracker-stepper">
                            ${stages.map((st, i) => `
                                <div class="tracker-step ${i <= currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}">
                                    <div class="tracker-icon"><i class="${st.icon}"></i></div>
                                    <span>${st.id}</span>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Rincian Cetak & Metode -->
                        <div style="background:var(--bg-tertiary); padding:1rem; border-radius:0.6rem; font-size:0.88rem; line-height:1.6;">
                            <p><strong>Item Cetak:</strong> ${found.items.map(it => `${Security.sanitizeHTML(it.name)} (${Security.sanitizeHTML(it.specs || '-')})`).join(', ')}</p>
                            <p><strong>Metode Pengambilan:</strong> ${Security.sanitizeHTML(found.deliveryMethod || 'Ambil di Toko')}</p>
                        </div>

                        <!-- Kartu Status Pembayaran & Tagihan Terpadu -->
                        <div style="background:var(--bg-secondary); border:1.5px solid var(--border-color); border-radius:var(--radius-lg); padding:1.25rem; margin-top:1.25rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border-color);">
                                <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                                    <i class="fas fa-wallet" style="color:var(--accent-start);"></i> Status Pembayaran & Tagihan
                                </div>
                                ${payBadge}
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; font-size:0.85rem;">
                                <div>
                                    <span style="color:var(--text-secondary); font-size:0.78rem;">Total Transaksi:</span>
                                    <div style="font-weight:800; font-size:1.05rem; color:var(--text-primary); font-family:var(--font-mono);">${formatRupiah(total)}</div>
                                </div>
                                <div>
                                    <span style="color:var(--text-secondary); font-size:0.78rem;">Uang Masuk (Terbayar):</span>
                                    <div style="font-weight:800; font-size:1.05rem; color:#10b981; font-family:var(--font-mono);">${formatRupiah(amountPaid)}</div>
                                </div>
                                <div>
                                    <span style="color:var(--text-secondary); font-size:0.78rem;">Sisa Tagihan (Piutang):</span>
                                    <div style="font-weight:800; font-size:1.05rem; color:${remainingBalance > 0 ? '#ef4444' : '#10b981'}; font-family:var(--font-mono);">${formatRupiah(remainingBalance)}</div>
                                </div>
                            </div>

                            ${actionBoxHTML}
                        </div>
                    </div>
                `;

                // Wire Pelunasan DP dari Tracker
                const settleBtn = document.getElementById('btn-tracker-settle');
                if (settleBtn) {
                    settleBtn.addEventListener('click', async () => {
                        if (!confirm(`Konfirmasi pelunasan sisa tagihan sebesar ${formatRupiah(remainingBalance)} untuk pesanan ${found.id} via QRIS / Transfer?`)) {
                            return;
                        }
                        settleBtn.disabled = true;
                        settleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses Pelunasan...';
                        try {
                            const pRes = await fetch('/api/orders/settle-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: found.id, paymentMethod: 'qris' })
                            });
                            const pData = await pRes.json();
                            if (pData.success) {
                                UI.showToast('Pelunasan Berhasil 🎉', `Pesanan ${found.id} telah LUNAS 100%!`, 'success');
                                trackerBtn.click();
                            } else {
                                UI.showToast('Gagal Pelunasan', pData.message, 'error');
                                settleBtn.disabled = false;
                            }
                        } catch (err) {
                            UI.showToast('Kesalahan Jaringan', err.message, 'error');
                            settleBtn.disabled = false;
                        }
                    });
                }

                // Wire Demo Sim Bukti Bayar dari Tracker
                const simProofBtn = document.getElementById('btn-tracker-sim-proof');
                if (simProofBtn) {
                    simProofBtn.addEventListener('click', async () => {
                        simProofBtn.disabled = true;
                        simProofBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim Struk Contoh...';
                        const proofUrl = generateBankReceiptCanvas(found.id, found.amountPaid || found.total, found.paymentMethod);
                        try {
                            const uRes = await fetch('/api/orders/upload-payment-proof', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    orderId: found.id,
                                    proofImage: proofUrl,
                                    note: 'Struk contoh dikirim via Pelacakan Pesanan'
                                })
                            });
                            const uData = await uRes.json();
                            if (uData.success) {
                                UI.showToast('Struk Terkirim ⚡', 'Bukti bayar m-BCA berhasil dikirim! Menunggu ACC toko.', 'success');
                                trackerBtn.click();
                            } else {
                                UI.showToast('Gagal', uData.message, 'error');
                                simProofBtn.disabled = false;
                            }
                        } catch (err) {
                            UI.showToast('Kesalahan Jaringan', err.message, 'error');
                            simProofBtn.disabled = false;
                        }
                    });
                }

                // Wire Lihat Bukti Struk Terlampir
                const viewProofBtn = document.getElementById('btn-tracker-view-proof');
                if (viewProofBtn && found.paymentProof && found.paymentProof.image) {
                    viewProofBtn.addEventListener('click', () => {
                        const win = window.open('');
                        win.document.write(`<img src="${found.paymentProof.image}" style="max-width:100%; height:auto;" alt="Struk Transfer">`);
                    });
                }

            } catch (err) {
                trackerResult.innerHTML = `<div class="alert alert-error">Gagal mengambil data dari server: ${err.message}</div>`;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        init,
        render,
        getCustomerCart,
        renderCustomerCartDrawer,
        openServiceCalculatorModal,
        get pendingProductId() { return pendingProductId; },
        set pendingProductId(val) { pendingProductId = val; }
    };
})();
