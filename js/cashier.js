/**
 * ============================================
 *  CASHIER.JS — POV Kasir & Operator Mesin (Digital Media)
 *  Fitur: POS Kasir Toko Offline, Kalkulator Kembalian Tunai,
 *  Cetak Struk Nota Kasir, & Manajemen Antrian Mesin Cetak
 * ============================================
 */
'use strict';

const CashierModule = (() => {
    let posCart = [];
    let cashierProducts = [];
    let cachedCashLedger = {
        initialFloat: 200000,
        logs: []
    };

    function init() {
        setupPOSEvents();
        setupQueueFilterEvents();
        setupCashManagementEvents();
    }

    async function render() {
        // Enforce RBAC Role Guard
        if (!Security.hasPermission(Security.ROLES.CASHIER) && !Security.hasPermission(Security.ROLES.ADMIN)) {
            UI.showToast('Akses Ditolak', 'Hanya Kasir / Operator yang memiliki akses ke modul ini.', 'error');
            return;
        }

        await syncCashLedger();
        await renderPOSCatalog();
        renderPOSCart();
        await renderJobQueue();
        renderRegisterSummary();
    }

    // ─── 1. POS Katalog Cetak Cepat ───
    async function renderPOSCatalog() {
        const grid = document.getElementById('pos-catalog-grid');
        if (!grid) return;

        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (data.success && Array.isArray(data.products) && data.products.length > 0) {
                cashierProducts = data.products;
            } else {
                cashierProducts = PrintingProducts.map(p => ({
                    ...p,
                    pricePerUnit: (PrintingPrices[p.id] || {}).pricePerUnit || 20000,
                    unit: (PrintingPrices[p.id] || {}).unit || 'pcs',
                    imageUrl: PrintingImages[p.id] || PrintingImages['default']
                }));
            }
        } catch (err) {
            cashierProducts = PrintingProducts.map(p => ({
                ...p,
                pricePerUnit: (PrintingPrices[p.id] || {}).pricePerUnit || 20000,
                unit: (PrintingPrices[p.id] || {}).unit || 'pcs',
                imageUrl: PrintingImages[p.id] || PrintingImages['default']
            }));
        }

        grid.innerHTML = cashierProducts.map(p => {
            const priceVal = p.pricePerUnit || 0;
            const unitVal = p.unit || 'pcs';
            const img = p.imageUrl || PrintingImages[p.id] || PrintingImages['default'];
            return `
                <div class="pos-item-card" data-id="${p.id}">
                    <img src="${img}" alt="${Security.sanitizeHTML(p.name)}">
                    <div class="pos-item-info">
                        <strong>${Security.sanitizeHTML(p.name)}</strong>
                        <div class="pos-item-price">${formatRupiah(priceVal)} <small>/ ${Security.sanitizeHTML(unitVal)}</small></div>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm btn-pos-add" data-id="${p.id}">
                        <i class="fas fa-plus"></i> Tambah
                    </button>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.btn-pos-add').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                addPOSItem(id);
            });
        });
    }

    function addPOSItem(productId) {
        const product = cashierProducts.find(p => p.id === productId) || PrintingProducts.find(p => p.id === productId);
        if (!product) return;

        const pricePerUnit = product.pricePerUnit || (PrintingPrices[productId] || {}).pricePerUnit || 20000;
        const unit = product.unit || (PrintingPrices[productId] || {}).unit || 'pcs';

        let qty = 1;
        let specs = `Standar 1 ${unit}`;
        let subtotal = pricePerUnit;

        if (product.type === 'meteran') {
            const len = prompt('Masukkan Panjang Banner (Meter):', '2');
            const wid = prompt('Masukkan Lebar/Tinggi Banner (Meter):', '1');
            if (!len || !wid) return;
            const area = Math.max(0.5, parseFloat(len) * parseFloat(wid));
            specs = `Ukuran ${len}m × ${wid}m (${area.toFixed(2)} m²) + Finishing Mata Ayam`;
            subtotal = Math.round(area * pricePerUnit + 2500);
        }

        posCart.push({
            id: 'POS-' + Date.now().toString(36),
            productId,
            name: product.name,
            specs,
            quantity: qty,
            price: subtotal
        });

        renderPOSCart();
        UI.showToast('Item Ditambahkan', `${product.name} masuk kasir`, 'info');
    }

    function renderPOSCart() {
        const container = document.getElementById('pos-cart-table-body');
        const totalEl = document.getElementById('pos-total-amount');
        if (!container) return;

        if (posCart.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-tertiary);">
                        Belum ada item cetak dipilih. Klik tombol Tambah pada katalog.
                    </td>
                </tr>
            `;
            if (totalEl) totalEl.textContent = 'Rp 0';
            calculatePOSChange();
            return;
        }

        let total = 0;
        container.innerHTML = posCart.map((item, idx) => {
            total += item.price;
            return `
                <tr>
                    <td>
                        <strong>${Security.sanitizeHTML(item.name)}</strong><br>
                        <small style="color:var(--text-secondary);">${Security.sanitizeHTML(item.specs)}</small>
                    </td>
                    <td>${item.quantity}</td>
                    <td><strong>${formatRupiah(item.price)}</strong></td>
                    <td>
                        <button type="button" class="btn btn-danger btn-sm btn-pos-del" data-index="${idx}">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (totalEl) totalEl.textContent = formatRupiah(total);

        container.querySelectorAll('.btn-pos-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                posCart.splice(idx, 1);
                renderPOSCart();
            });
        });

        calculatePOSChange();
    }

    function getPOSTotal() {
        return posCart.reduce((acc, it) => acc + it.price, 0);
    }

    function calculatePOSChange() {
        const cashInput = document.getElementById('pos-cash-received');
        const changeEl = document.getElementById('pos-cash-change');
        if (!cashInput || !changeEl) return;

        const total = getPOSTotal();
        const received = parseFloat(cashInput.value) || 0;
        const change = received - total;

        if (received >= total && total > 0) {
            changeEl.textContent = formatRupiah(change);
            changeEl.style.color = 'var(--success)';
        } else {
            changeEl.textContent = 'Rp 0';
            changeEl.style.color = 'var(--text-tertiary)';
        }
    }

    function setupPOSEvents() {
        const cashInput = document.getElementById('pos-cash-received');
        if (cashInput) {
            cashInput.addEventListener('input', calculatePOSChange);
        }

        // Quick-Cash Tender Pills
        document.querySelectorAll('.btn-quick-cash').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-cash');
                const total = getPOSTotal();
                if (cashInput) {
                    if (type === 'exact') {
                        cashInput.value = total;
                    } else {
                        cashInput.value = parseInt(type, 10);
                    }
                    calculatePOSChange();
                }
            });
        });

        const payBtn = document.getElementById('btn-pos-checkout');
        if (payBtn) {
            payBtn.addEventListener('click', processOfflineOrder);
        }

        const clearBtn = document.getElementById('btn-pos-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (posCart.length > 0 && confirm('Kosongkan keranjang kasir?')) {
                    posCart = [];
                    renderPOSCart();
                }
            });
        }

        // Manual Custom Item Form Submit
        const manualForm = document.getElementById('pos-manual-item-form');
        if (manualForm) {
            manualForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('pos-manual-name');
                const specsInput = document.getElementById('pos-manual-specs');
                const priceInput = document.getElementById('pos-manual-price');
                const qtyInput = document.getElementById('pos-manual-qty');

                const name = (nameInput ? nameInput.value : '').trim();
                const specs = (specsInput && specsInput.value ? specsInput.value : 'Custom Order Walk-In').trim();
                const price = parseInt(priceInput ? priceInput.value : 0, 10);
                const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;

                if (!name || isNaN(price) || price <= 0) {
                    UI.showToast('Peringatan', 'Masukkan nama layanan dan harga satuan yang valid!', 'warning');
                    return;
                }

                posCart.push({
                    id: 'POS-MAN-' + Date.now().toString(36),
                    productId: 'manual-custom',
                    name,
                    specs,
                    quantity: qty,
                    price: price * qty
                });

                renderPOSCart();

                if (nameInput) nameInput.value = '';
                if (specsInput) specsInput.value = '';
                if (priceInput) priceInput.value = '';
                if (qtyInput) qtyInput.value = '1';

                UI.showToast('Item Manual Ditambahkan 🧾', `${name} (${qty}x) masuk ke nota kasir`, 'success');
            });
        }
    }

    // ─── 2. Proses Transaksi Kasir Offline ───
    async function processOfflineOrder() {
        if (posCart.length === 0) {
            UI.showToast('Keranjang Kosong', 'Pilih atau input item cetak terlebih dahulu', 'warning');
            return;
        }

        const customerName = Security.sanitizeInput(document.getElementById('pos-cust-name').value) || 'Pelanggan Walk-In';
        const customerPhone = Security.sanitizeInput(document.getElementById('pos-cust-phone').value) || '-';
        const paymentRadio = document.querySelector('input[name="pos_payment"]:checked');
        const paymentMethod = paymentRadio ? paymentRadio.value : 'tunai';
        const total = getPOSTotal();
        const cashReceived = parseFloat(document.getElementById('pos-cash-received').value) || total;

        if (paymentMethod === 'tunai' && cashReceived < total) {
            UI.showToast('Uang Kurang', 'Nominal uang tunai diterima kurang dari total belanja!', 'error');
            return;
        }

        const transactionId = Security.generateTransactionId('DM-POS');
        const session = Security.getActiveSession() || {};

        const orderRecord = {
            id: transactionId,
            channel: 'offline', // Toko Offline Kasir
            createdAt: new Date().toISOString(),
            cashierName: session.name || session.displayName || session.username || 'Kasir Toko',
            customer: {
                name: customerName,
                phone: customerPhone,
                address: 'Ambil di Toko Percetakan Gilar Media'
            },
            paymentMethod,
            paymentType: 'full',
            paymentStatus: 'lunas',
            amountPaid: total,
            remainingBalance: 0,
            cashReceived: paymentMethod === 'tunai' ? cashReceived : total,
            change: paymentMethod === 'tunai' ? Math.max(0, cashReceived - total) : 0,
            items: [...posCart],
            total,
            status: 'Proses Printing'
        };

        // Save order locally and sync to server API (data/orders.json)
        try {
            await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderRecord)
            });
        } catch (e) {
            console.warn('Sync POS order to server failed, storing locally:', e);
        }

        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        allOrders.unshift(orderRecord);
        Security.safeSetStorage('dm_all_orders', allOrders);

        // Security Log
        Security.logAuditEvent('POS_ORDER_CREATED', `Offline transaction ${transactionId} by cashier ${session.username || 'kasir'}`);

        // Print receipt preview
        showThermalReceipt(orderRecord);

        // Reset POS
        posCart = [];
        renderPOSCart();
        renderRegisterSummary();
        const custNameEl = document.getElementById('pos-cust-name');
        const custPhoneEl = document.getElementById('pos-cust-phone');
        const cashRecEl = document.getElementById('pos-cash-received');
        if (custNameEl) custNameEl.value = '';
        if (custPhoneEl) custPhoneEl.value = '';
        if (cashRecEl) cashRecEl.value = '';
        calculatePOSChange();
        document.getElementById('pos-cust-phone').value = '';
        document.getElementById('pos-cash-received').value = '';

        // Update Job Queue
        renderJobQueue();
        renderRegisterSummary();

        UI.showToast('Transaksi Sukses!', `Nota ${transactionId} berhasil dicetak`, 'success');
    }

    // ─── 3. Cetak Struk Nota Kasir (Thermal Receipt View 80mm) ───
    function generateBarcodeSVG(code) {
        const safeCode = (code || 'DM-POS-0000').toUpperCase();
        let x = 6;
        let rects = '';
        for (let i = 0; i < safeCode.length; i++) {
            const charCode = safeCode.charCodeAt(i);
            const w1 = ((charCode % 3) * 0.8 + 1.2).toFixed(1);
            const gap1 = (((charCode >> 1) % 2) * 0.8 + 1.0).toFixed(1);
            const w2 = (((charCode >> 2) % 3) * 0.8 + 1.4).toFixed(1);
            const gap2 = (((charCode >> 3) % 2) * 0.8 + 1.1).toFixed(1);

            rects += `<rect x="${x}" y="0" width="${w1}" height="32" fill="#0f172a" />`;
            x += parseFloat(w1) + parseFloat(gap1);
            rects += `<rect x="${x.toFixed(1)}" y="0" width="${w2}" height="32" fill="#0f172a" />`;
            x += parseFloat(w2) + parseFloat(gap2);
        }
        const totalWidth = Math.max(220, Math.ceil(x + 6));
        return `
            <svg class="receipt-barcode-svg" viewBox="0 0 ${totalWidth} 32" width="210" height="30" xmlns="http://www.w3.org/2000/svg">
                ${rects}
            </svg>
        `;
    }

    function showThermalReceipt(order) {
        const modal = document.getElementById('receipt-modal');
        const container = document.getElementById('receipt-print-area');
        if (!modal || !container) return;

        const dateFormatted = new Date(order.createdAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) + ', ' + new Date(order.createdAt).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }) + ' WIB';

        const subtotal = (order.items || []).reduce((sum, it) => sum + (it.price || 0), 0);
        const customerName = order.customer ? (order.customer.name || 'Pelanggan Walk-In') : 'Pelanggan Walk-In';
        const customerPhone = order.customer && order.customer.phone ? order.customer.phone : '';
        const barcodeSVG = generateBarcodeSVG(order.id);

        container.innerHTML = `
            <div class="thermal-receipt">
                <!-- Header Kop Nota Kasir -->
                <div class="receipt-header">
                    <div class="receipt-logo-mark">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                    </div>
                    <div class="receipt-brand-title">PERCETAKAN GILAR MEDIA</div>
                    <div class="receipt-brand-tagline">Digital Printing & Advertising Solusindo</div>
                    <div class="receipt-store-info">
                        Jl. Percetakan Utama No. 88, Kota Solusindo<br>
                        Telp: (021) 7890-1234 | WhatsApp: 0812-3456-7890<br>
                        NIB: 9120004512034 | NPWP: 82.910.456.7-012.000
                    </div>
                </div>

                <div class="receipt-cut-line">================================================</div>

                <!-- Metadata Transaksi Nota -->
                <div class="receipt-meta-table">
                    <div class="receipt-meta-row">
                        <span>NO. NOTA</span>
                        <strong>${Security.sanitizeHTML(order.id)}</strong>
                    </div>
                    <div class="receipt-meta-row">
                        <span>WAKTU</span>
                        <span>${dateFormatted}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span>KASIR</span>
                        <span>${Security.sanitizeHTML(order.cashierName || 'Kasir/Operator')}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span>PELANGGAN</span>
                        <strong>${Security.sanitizeHTML(customerName)}</strong>
                    </div>
                    ${customerPhone ? `
                        <div class="receipt-meta-row">
                            <span>NO. KONTAK</span>
                            <span>${Security.sanitizeHTML(customerPhone)}</span>
                        </div>
                    ` : ''}
                    <div class="receipt-meta-row">
                        <span>SALURAN</span>
                        <span>Outlet Kasir Walk-In (Ambil di Toko)</span>
                    </div>
                </div>

                <div class="receipt-cut-line">------------------------------------------------</div>

                <!-- Rincian Item Pesanan -->
                <div class="receipt-items-container">
                    <div class="receipt-items-head">
                        <span>RINCIAN ITEM & SPESIFIKASI</span>
                        <span>SUBTOTAL</span>
                    </div>
                    ${(order.items || []).map((it, idx) => {
                        const qty = it.quantity || 1;
                        const unitPrice = it.price ? Math.round(it.price / qty) : 0;
                        return `
                            <div class="receipt-item-block">
                                <div class="receipt-item-name">${idx + 1}. ${Security.sanitizeHTML(it.name)}</div>
                                <div class="receipt-item-specs">${Security.sanitizeHTML(it.specs || 'Standar Percetakan')}</div>
                                <div class="receipt-item-price-calc">
                                    <span>${qty} × ${formatRupiah(unitPrice)}</span>
                                    <strong>${formatRupiah(it.price || 0)}</strong>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="receipt-cut-line">================================================</div>

                <!-- Ringkasan Finansial Pembayaran -->
                <div class="receipt-calc-box">
                    <div class="receipt-calc-row">
                        <span>Subtotal Item</span>
                        <span>${formatRupiah(subtotal)}</span>
                    </div>
                    <div class="receipt-calc-row">
                        <span>Diskon / Potongan</span>
                        <span>Rp 0</span>
                    </div>
                    <div class="receipt-calc-row total-highlight">
                        <span>TOTAL TAGIHAN</span>
                        <strong>${formatRupiah(order.total || subtotal)}</strong>
                    </div>
                    <div class="receipt-calc-row">
                        <span>Metode Pembayaran</span>
                        <strong>${(order.paymentMethod || 'tunai').toUpperCase()}</strong>
                    </div>
                    ${(order.remainingBalance && order.remainingBalance > 0) ? `
                        <div class="receipt-calc-row">
                            <span>Uang Muka (DP 50%)</span>
                            <span style="color:#16a34a; font-weight:700;">${formatRupiah(order.amountPaid || Math.round((order.total || subtotal) * 0.5))}</span>
                        </div>
                        <div class="receipt-calc-row" style="color:#dc2626; font-weight:800;">
                            <span>SISA TAGIHAN (BELUM LUNAS)</span>
                            <strong>${formatRupiah(order.remainingBalance)}</strong>
                        </div>
                    ` : `
                        ${order.paymentMethod === 'tunai' ? `
                            <div class="receipt-calc-row">
                                <span>Tunai Diterima</span>
                                <span>${formatRupiah(order.cashReceived || order.total || subtotal)}</span>
                            </div>
                            <div class="receipt-calc-row change-highlight">
                                <span>KEMBALIAN</span>
                                <strong>${formatRupiah(order.change || 0)}</strong>
                            </div>
                        ` : `
                            <div class="receipt-calc-row">
                                <span>Status Bayar</span>
                                <strong style="color:#16a34a;">LUNAS 100%</strong>
                            </div>
                        `}
                    `}
                </div>

                <div class="receipt-cut-line">------------------------------------------------</div>

                <!-- Stempel Status LUNAS / DP -->
                <div class="receipt-stamp-area">
                    ${(order.remainingBalance && order.remainingBalance > 0) ? `
                        <div class="receipt-stamp-badge" style="border-color:#f59e0b; color:#d97706; background:rgba(245,158,11,0.08);">
                            <i class="fas fa-hourglass-half"></i> UANG MUKA (DP 50%)
                        </div>
                    ` : `
                        <div class="receipt-stamp-badge"><i class="fas fa-check-circle"></i> LUNAS / PAID</div>
                    `}
                </div>

                <!-- Barcode SVG -->
                <div class="receipt-barcode-section">
                    ${barcodeSVG}
                    <span class="receipt-barcode-code">* ${Security.sanitizeHTML(order.id)} *</span>
                </div>

                <!-- Ketentuan Pengambilan & Legalitas Percetakan -->
                <div class="receipt-footer-notes">
                    <p><strong>KETENTUAN PENGAMBILAN BARANG:</strong></p>
                    <p>1. Wajib menunjukkan struk nota ini saat serah terima barang.</p>
                    <p>2. Periksa kembali ukuran, warna, dan kualitas hasil cetak.</p>
                    <p>3. Komplain cetak diterima maksimal 1x24 jam sejak barang diambil.</p>
                    <p>4. Pesanan tidak diambil lebih dari 30 hari di luar tanggung jawab toko.</p>
                    <p class="receipt-thankyou">-- TERIMA KASIH ATAS KUNJUNGAN ANDA --</p>
                    <p class="receipt-tag-sub">Struk ini adalah bukti transaksi resmi Percetakan Gilar Media</p>
                </div>
            </div>
        `;

        const printBtn = document.getElementById('btn-do-print-receipt');
        if (printBtn) {
            printBtn.onclick = () => {
                window.print();
            };
        }

        UI.openModal('receipt-modal');
    }

    // ─── 4. Antrian Mesin Cetak (Production Job Queue) ───
    let queueFilter = 'all';

    function setupQueueFilterEvents() {
        document.querySelectorAll('.queue-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.queue-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                queueFilter = btn.getAttribute('data-queue-filter');
                renderJobQueue();
            });
        });
    }

    function renderJobQueue() {
        const list = document.getElementById('job-queue-list');
        if (!list) return;

        const allOrders = Security.safeGetStorage('dm_all_orders') || [];

        let filtered = allOrders;
        if (queueFilter !== 'all') {
            filtered = allOrders.filter(o => o.status === queueFilter);
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); margin-bottom: 0.75rem;"></i>
                    <p>Semua antrian cetak telah selesai diproses!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(o => {
            const pStatus = o.paymentStatus || (o.paymentType === 'dp' ? 'dp_dibayar' : (o.channel === 'offline' ? 'lunas' : 'belum_bayar'));
            const total = o.total || 0;
            const amountPaid = o.amountPaid !== undefined ? o.amountPaid : (pStatus === 'dp_dibayar' ? Math.round(total * 0.5) : (pStatus === 'lunas' ? total : 0));
            const remainingBalance = o.remainingBalance !== undefined ? o.remainingBalance : (total - amountPaid);

            let payBadgeHtml = '';
            if (pStatus === 'lunas') {
                payBadgeHtml = '<span class="badge badge-success" style="font-size:0.74rem;"><i class="fas fa-check-circle"></i> LUNAS</span>';
            } else if (pStatus === 'dp_dibayar') {
                payBadgeHtml = `<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid #f59e0b; font-size:0.74rem;"><i class="fas fa-hourglass-half"></i> Sisa DP: ${formatRupiah(remainingBalance)}</span>`;
            } else if (pStatus === 'menunggu_verifikasi') {
                payBadgeHtml = '<span class="badge" style="background:rgba(245,158,11,0.25); color:#f59e0b; border:1px solid #f59e0b; font-size:0.74rem;"><i class="fas fa-clock fa-spin"></i> Bukti Menunggu ACC</span>';
            } else {
                payBadgeHtml = '<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid #ef4444; font-size:0.74rem;"><i class="fas fa-times-circle"></i> Belum Bayar</span>';
            }

            return `
            <div class="queue-card ${o.channel === 'online' ? 'channel-online' : 'channel-offline'}">
                <div class="queue-header">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="badge ${o.channel === 'online' ? 'badge-new' : 'badge-hot'}">
                            ${o.channel === 'online' ? '<i class="fas fa-globe"></i> ONLINE WEB' : '<i class="fas fa-store"></i> TOKO OFFLINE'}
                        </span>
                        <strong class="queue-id">${o.id}</strong>
                        ${payBadgeHtml}
                    </div>
                    <span class="queue-status-badge badge-status-${slugify(o.status)}">${o.status}</span>
                </div>

                <div class="queue-body">
                    <p><strong>Pelanggan:</strong> ${Security.sanitizeHTML(o.customer.name)} (${o.customer.phone})</p>
                    <div class="queue-items-box">
                        <strong>Rincian Cetak:</strong>
                        <ul>
                            ${o.items.map(it => `
                                <li>${Security.sanitizeHTML(it.name)} — <em>${Security.sanitizeHTML(it.specs || '-')}</em> ${it.fileName ? `[File: ${it.fileName}]` : ''}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <div class="queue-actions">
                    <small style="color:var(--text-tertiary);"><i class="fas fa-clock"></i> ${new Date(o.createdAt).toLocaleTimeString('id-ID')}</small>
                    <div class="queue-action-buttons">
                        <button type="button" class="btn btn-outline btn-sm btn-reprint-receipt" data-id="${o.id}" title="Cetak Ulang Struk Kasir">
                            <i class="fas fa-receipt"></i> Struk
                        </button>
                        ${remainingBalance > 0 ? `
                            <button type="button" class="btn btn-warning btn-sm btn-cashier-settle-dp" data-id="${o.id}" data-rem="${remainingBalance}" title="Pelunasan Piutang DP Pelanggan Walk-In" style="font-weight:800; font-size:0.76rem;">
                                <i class="fas fa-coins"></i> Lunasi DP (${formatRupiah(remainingBalance)})
                            </button>
                        ` : ''}
                        ${(o.paymentProof && o.paymentProof.image) ? `
                            <button type="button" class="btn btn-outline btn-sm btn-cashier-view-proof" data-id="${o.id}" title="Lihat Struk Transfer Pelanggan" style="font-size:0.74rem;">
                                <i class="fas fa-image"></i> Struk Transfer
                            </button>
                        ` : ''}
                        ${o.status !== 'Proses Printing' ? `
                            <button type="button" class="btn btn-outline btn-sm btn-update-status" data-id="${o.id}" data-next="Proses Printing">
                                <i class="fas fa-play"></i> Mulai Cetak
                            </button>
                        ` : ''}
                        ${o.status !== 'Finishing & QC' ? `
                            <button type="button" class="btn btn-outline btn-sm btn-update-status" data-id="${o.id}" data-next="Finishing & QC">
                                <i class="fas fa-cut"></i> Masuk Finishing
                            </button>
                        ` : ''}
                        ${o.status !== 'Siap Diambil / Dikirim' ? `
                            <button type="button" class="btn btn-success btn-sm btn-update-status" data-id="${o.id}" data-next="Siap Diambil / Dikirim">
                                <i class="fas fa-check"></i> Selesai & Siap Ambil
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            `;
        }).join('');

        list.querySelectorAll('.btn-reprint-receipt').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const allOrders = Security.safeGetStorage('dm_all_orders') || [];
                const order = allOrders.find(o => o.id === id);
                if (order) {
                    showThermalReceipt(order);
                }
            });
        });

        list.querySelectorAll('.btn-cashier-settle-dp').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const rem = Number(btn.getAttribute('data-rem') || 0);

                const choice = confirm(
                    `Pelunasan Sisa DP untuk Pesanan ${id}\n` +
                    `Sisa Tagihan: ${formatRupiah(rem)}\n\n` +
                    `Klik [OK] jika pelanggan membayar TUNAI (Uang masuk laci kasir).\n` +
                    `Klik [Cancel] untuk membatalkan.`
                );

                if (!choice) return;

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

                try {
                    const res = await fetch('/api/orders/settle-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: id,
                            paymentMethod: 'tunai',
                            cashierName: 'Rian (Kasir/Operator)'
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        UI.showToast('Pelunasan Berhasil! 💵', data.message || `Pesanan ${id} telah LUNAS! Uang masuk kas laci.`, 'success');

                        await syncCashLedger();
                        const ordRes = await fetch('/api/orders');
                        const ordData = await ordRes.json();
                        if (ordData.success && Array.isArray(ordData.orders)) {
                            Security.safeSetStorage('dm_all_orders', ordData.orders);
                        }

                        renderJobQueue();
                        renderRegisterSummary();

                        if (data.order) {
                            showThermalReceipt(data.order);
                        }
                    } else {
                        UI.showToast('Gagal Pelunasan', data.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fas fa-coins"></i> Lunasi DP (${formatRupiah(rem)})`;
                    }
                } catch (err) {
                    console.error('Cashier settle error:', err);
                    UI.showToast('Kesalahan Jaringan', err.message, 'error');
                    btn.disabled = false;
                }
            });
        });

        list.querySelectorAll('.btn-cashier-view-proof').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const allOrders = Security.safeGetStorage('dm_all_orders') || [];
                const order = allOrders.find(o => o.id === id);
                if (order && order.paymentProof && order.paymentProof.image) {
                    const win = window.open('');
                    win.document.write(`<img src="${order.paymentProof.image}" style="max-width:100%; height:auto;" alt="Struk Transfer">`);
                }
            });
        });

        list.querySelectorAll('.btn-update-status').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const nextStatus = btn.getAttribute('data-next');
                updateOrderStatus(id, nextStatus);
            });
        });
    }

    function updateOrderStatus(orderId, newStatus) {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;
            Security.safeSetStorage('dm_all_orders', allOrders);
            Security.logAuditEvent('ORDER_STATUS_UPDATED', `Order ${orderId} moved to status '${newStatus}'`);
            renderJobQueue();
            UI.showToast('Status Diperbarui', `${orderId} kini berstatus: ${newStatus}`, 'success');
        }
    }

    // ─── 5. Sinkronisasi & Manajemen Kas Laci (Modal Pemilik & Petty Cash) ───
    async function syncCashLedger() {
        try {
            const res = await fetch('/api/cash-ledger');
            const data = await res.json();
            if (data.success) {
                cachedCashLedger = {
                    initialFloat: data.initialFloat !== undefined ? data.initialFloat : 200000,
                    lastUpdated: data.lastUpdated,
                    updatedBy: data.updatedBy,
                    logs: Array.isArray(data.logs) ? data.logs : []
                };
                Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
            }
        } catch (err) {
            console.warn('Sync cash ledger warning, using local cache:', err.message);
            const local = Security.safeGetStorage('dm_cash_ledger');
            if (local) cachedCashLedger = local;
        }
    }

    function renderRegisterSummary() {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const offlineOrders = allOrders.filter(o => o.channel === 'offline');

        const totalOfflineSales = offlineOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const cashSales = offlineOrders.filter(o => o.paymentMethod === 'tunai').reduce((sum, o) => sum + (o.amountPaid || o.total || 0), 0);
        const qrisCount = offlineOrders.filter(o => o.paymentMethod === 'qris').length;

        const initialFloat = cachedCashLedger.initialFloat !== undefined ? cachedCashLedger.initialFloat : 200000;
        const logs = cachedCashLedger.logs || [];
        const cashInManual = logs.filter(l => l.type === 'in').reduce((sum, l) => sum + (l.amount || 0), 0);
        const cashOutManual = logs.filter(l => l.type === 'out').reduce((sum, l) => sum + (l.amount || 0), 0);
        const netManual = cashInManual - cashOutManual;

        // Total Uang Fisik yang Wajib Ada di Laci
        const totalCashInDrawer = initialFloat + cashSales + cashInManual - cashOutManual;

        setElText('reg-initial-float', formatRupiah(initialFloat));
        setElText('reg-offline-sales', formatRupiah(totalOfflineSales));
        setElText('reg-trans-count', `${offlineOrders.length} Nota (${qrisCount} QRIS)`);
        setElText('reg-net-manual', (netManual >= 0 ? '+' : '') + formatRupiah(netManual));
        setElText('reg-manual-sub', `+${formatRupiah(cashInManual)} / -${formatRupiah(cashOutManual)}`);
        setElText('reg-cash-drawer', formatRupiah(totalCashInDrawer));
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setupCashManagementEvents() {
        // 1. Open Modals
        const btnIn = document.getElementById('btn-open-cash-in');
        if (btnIn) {
            btnIn.addEventListener('click', () => {
                const amtInput = document.getElementById('input-cash-in-amount');
                if (amtInput) amtInput.value = '';
                const notesInput = document.getElementById('input-cash-in-notes');
                if (notesInput) notesInput.value = '';
                UI.openModal('modal-cash-in');
            });
        }

        const btnOut = document.getElementById('btn-open-cash-out');
        if (btnOut) {
            btnOut.addEventListener('click', () => {
                const amtInput = document.getElementById('input-cash-out-amount');
                if (amtInput) amtInput.value = '';
                const notesInput = document.getElementById('input-cash-out-notes');
                if (notesInput) notesInput.value = '';
                UI.openModal('modal-cash-out');
            });
        }

        const btnHist = document.getElementById('btn-open-cash-history');
        if (btnHist) {
            btnHist.addEventListener('click', () => {
                renderCashHistoryModal();
                UI.openModal('modal-cash-history');
            });
        }

        // 2. Quick tender pills for Modal In
        document.querySelectorAll('.btn-quick-cash-in').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amt');
                const input = document.getElementById('input-cash-in-amount');
                if (input) input.value = amt;
            });
        });

        // 3. Quick tender pills for Modal Out
        document.querySelectorAll('.btn-quick-cash-out').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amt');
                const input = document.getElementById('input-cash-out-amount');
                if (input) input.value = amt;
            });
        });

        // 4. Form Submit Kas Masuk
        const formIn = document.getElementById('form-cash-in');
        if (formIn) {
            formIn.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amount = parseInt(document.getElementById('input-cash-in-amount').value, 10);
                const category = document.getElementById('select-cash-in-category').value;
                const notes = document.getElementById('input-cash-in-notes').value.trim();

                if (!amount || amount <= 0) {
                    UI.showToast('Nominal Salah', 'Masukkan nominal kas masuk yang valid.', 'error');
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Kasir Toko';

                try {
                    const res = await fetch('/api/cash-ledger/entry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'in', category, amount, notes, operator })
                    });
                    const data = await res.json();
                    if (data.success) {
                        cachedCashLedger = {
                            initialFloat: data.initialFloat,
                            logs: data.logs || []
                        };
                        Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                        Security.logAuditEvent('CASH_IN_RECORDED', `Kas masuk Rp ${amount} (${category}) dicatat oleh ${operator}`);
                        UI.closeModal('modal-cash-in');
                        UI.showToast('Kas Masuk Berhasil', `+${formatRupiah(amount)} ditambahkan ke laci kasir`, 'success');
                        renderRegisterSummary();
                    } else {
                        UI.showToast('Gagal Simpan', data.message || 'Terjadi kesalahan sistem', 'error');
                    }
                } catch (err) {
                    // Local fallback
                    const newEntry = {
                        id: 'CASH-' + Date.now().toString(36).toUpperCase(),
                        timestamp: new Date().toISOString(),
                        type: 'in',
                        category,
                        amount,
                        operator,
                        notes
                    };
                    if (!cachedCashLedger.logs) cachedCashLedger.logs = [];
                    cachedCashLedger.logs.unshift(newEntry);
                    Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                    UI.closeModal('modal-cash-in');
                    UI.showToast('Kas Masuk Tersimpan', `+${formatRupiah(amount)} dicatat di laci`, 'success');
                    renderRegisterSummary();
                }
            });
        }

        // 5. Form Submit Kas Keluar
        const formOut = document.getElementById('form-cash-out');
        if (formOut) {
            formOut.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amount = parseInt(document.getElementById('input-cash-out-amount').value, 10);
                const category = document.getElementById('select-cash-out-category').value;
                const notes = document.getElementById('input-cash-out-notes').value.trim();

                if (!amount || amount <= 0) {
                    UI.showToast('Nominal Salah', 'Masukkan nominal pengeluaran kas yang valid.', 'error');
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Kasir Toko';

                try {
                    const res = await fetch('/api/cash-ledger/entry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'out', category, amount, notes, operator })
                    });
                    const data = await res.json();
                    if (data.success) {
                        cachedCashLedger = {
                            initialFloat: data.initialFloat,
                            logs: data.logs || []
                        };
                        Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                        Security.logAuditEvent('CASH_OUT_RECORDED', `Kas keluar Rp ${amount} (${category}) dicatat oleh ${operator}`);
                        UI.closeModal('modal-cash-out');
                        UI.showToast('Pengeluaran Dicatat', `-${formatRupiah(amount)} dikeluarkan dari laci`, 'info');
                        renderRegisterSummary();
                    } else {
                        UI.showToast('Gagal Simpan', data.message || 'Terjadi kesalahan sistem', 'error');
                    }
                } catch (err) {
                    // Local fallback
                    const newEntry = {
                        id: 'CASH-' + Date.now().toString(36).toUpperCase(),
                        timestamp: new Date().toISOString(),
                        type: 'out',
                        category,
                        amount,
                        operator,
                        notes
                    };
                    if (!cachedCashLedger.logs) cachedCashLedger.logs = [];
                    cachedCashLedger.logs.unshift(newEntry);
                    Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                    UI.closeModal('modal-cash-out');
                    UI.showToast('Pengeluaran Tersimpan', `-${formatRupiah(amount)} dicatat dari laci`, 'info');
                    renderRegisterSummary();
                }
            });
        }
    }

    function renderCashHistoryModal() {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const offlineOrders = allOrders.filter(o => o.channel === 'offline');
        const cashSales = offlineOrders.filter(o => o.paymentMethod === 'tunai').reduce((sum, o) => sum + (o.amountPaid || o.total || 0), 0);

        const initialFloat = cachedCashLedger.initialFloat !== undefined ? cachedCashLedger.initialFloat : 200000;
        const logs = cachedCashLedger.logs || [];
        const cashInManual = logs.filter(l => l.type === 'in').reduce((sum, l) => sum + (l.amount || 0), 0);
        const cashOutManual = logs.filter(l => l.type === 'out').reduce((sum, l) => sum + (l.amount || 0), 0);
        const totalCashInDrawer = initialFloat + cashSales + cashInManual - cashOutManual;

        setElText('hist-modal-float', formatRupiah(initialFloat));
        setElText('hist-cash-sales', formatRupiah(cashSales));
        setElText('hist-cash-in-manual', '+' + formatRupiah(cashInManual));
        setElText('hist-cash-out-manual', '-' + formatRupiah(cashOutManual));
        setElText('hist-total-drawer', formatRupiah(totalCashInDrawer));

        const tbody = document.getElementById('cash-history-tbody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-tertiary);">
                        Belum ada mutasi kas masuk / keluar yang dicatat hari ini.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logs.map(l => {
            const isModal = l.type === 'modal_awal';
            const isIn = l.type === 'in';
            const badgeBg = isModal ? 'rgba(99,102,241,0.15)' : (isIn ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)');
            const badgeColor = isModal ? '#6366f1' : (isIn ? '#10b981' : '#ef4444');
            const sign = isModal ? '' : (isIn ? '+' : '-');

            return `
                <tr>
                    <td>
                        <small style="color:var(--text-tertiary);">${new Date(l.timestamp).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })} WIB</small>
                    </td>
                    <td>
                        <span style="display:inline-block; font-size:0.72rem; font-weight:800; padding:2px 6px; border-radius:4px; background:${badgeBg}; color:${badgeColor}; margin-bottom:2px;">
                            ${isModal ? 'MODAL AWAL' : (isIn ? 'KAS MASUK' : 'KAS KELUAR')}
                        </span>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.78rem;">${Security.sanitizeHTML(l.category)}</div>
                    </td>
                    <td style="font-size:0.78rem; color:var(--text-secondary);">${Security.sanitizeHTML(l.notes || '-')}</td>
                    <td style="text-align:right; font-weight:800; font-family:var(--font-mono); color:${badgeColor};">
                        ${sign}${formatRupiah(l.amount)}
                    </td>
                    <td style="font-size:0.74rem; color:var(--text-tertiary);">${Security.sanitizeHTML(l.operator || 'Staf')}</td>
                </tr>
            `;
        }).join('');
    }

    function slugify(text) {
        return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        init,
        render,
        showThermalReceipt
    });
})();

