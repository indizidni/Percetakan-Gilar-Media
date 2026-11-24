/**
 * ============================================
 *  ADMIN.JS — POV Master Admin (Digital Media)
 *  Fitur: Analitik Keuangan (Toko Offline Kasir vs Toko Online),
 *  Manajemen Produk & Harga Toko (data/products.json),
 *  Inventori Stok Bahan Cetak, Manajemen Role, & Audit Keamanan
 * ============================================
 */
'use strict';

const AdminModule = (() => {
    // Default initial inventory of raw printing materials (Sesuai regulasi terbaru)
    const DEFAULT_INVENTORY = [
        { id: 'mat-flexi-standar', name: 'Roll Flexi Standar Outdoor (3.2m × 50m)', unit: 'meter', stock: 290, minStock: 50 },
        { id: 'mat-x-banner', name: 'Rangka Standing X-Banner Fiber 60x160cm', unit: 'set', stock: 45, minStock: 15 },
        { id: 'mat-stiker-kromo', name: 'Kertas Stiker Kromo A3', unit: 'lembar', stock: 1450, minStock: 300 },
        { id: 'mat-kertas-bw', name: 'Kertas BW (Blues White) (Undangan & Kartu Nama)', unit: 'lembar', stock: 1100, minStock: 250 },
        { id: 'mat-art-carton', name: 'Kertas Art Carton (Kartu Nama & Box Nasi)', unit: 'lembar', stock: 920, minStock: 250 },
        { id: 'mat-art-paper', name: 'Kertas Art Paper 100g - 120g (Brosur & Kalender)', unit: 'rim', stock: 28, minStock: 5 },
        { id: 'mat-kertas-ncr', name: 'Kertas NCR Folio Rangkap 2 (Nota Buku)', unit: 'rim', stock: 35, minStock: 8 },
        { id: 'mat-yasin-cover', name: 'Bahan Hard Cover & Soft Cover (Buku Yasin)', unit: 'pcs', stock: 220, minStock: 40 },
        { id: 'mat-kertas-duplex-box', name: 'Kertas Duplex / Ivory Food Grade (Box Nasi Kemasan)', unit: 'lembar', stock: 2500, minStock: 500 },
        { id: 'mat-kertas-foto', name: 'Kertas Foto Premium (Cetak Foto)', unit: 'lembar', stock: 350, minStock: 50 },
        { id: 'mat-ink-solvent', name: 'Tinta Mesin Outdoor Eco-Solvent (CMYK)', unit: 'liter', stock: 18, minStock: 5 },
        { id: 'mat-tinta-digital', name: 'Tinta Mesin Digital Printing & Offset', unit: 'liter', stock: 24, minStock: 6 }
    ];

    let cachedProducts = [];
    let cachedCategories = [];
    let cachedCashLedger = {
        initialFloat: 200000,
        logs: []
    };
    let cachedFinancialOverride = {
        enabled: false,
        updatedAt: null,
        updatedBy: null
    };

    function init() {
        setupAdminTabs();
        setupInventoryRestockEvents();
        setupProductManagementEvents();
        setupCategoryEvents();
        setupOrderTableEvents();
        setupCashLedgerEvents();
        setupFinancialOverrideEvents();
    }

    async function render() {
        // Enforce RBAC Role Guard
        if (!Security.hasPermission(Security.ROLES.ADMIN)) {
            UI.showToast('Akses Ditolak', 'Hanya Master Admin yang berhak membuka panel ini.', 'error');
            return;
        }

        await syncOrdersFromServer();
        await syncCashLedgerFromServer();
        await syncFinancialOverrideFromServer();
        renderFinancialAnalytics();
        renderCashLedgerSection();
        await renderCategoryManager();
        await renderProductsManagement();
        await renderMaterialsInventory();
        await renderRBACUsers();
        renderSecurityAuditLogs();
        await syncPaymentSettingsFromServer();
        setupPaymentConfigEvents();
        renderAllOrdersTable();
    }

    // ─── 1. Sinkronisasi Data Pesanan dari Server (data/orders.json) ───
    async function syncOrdersFromServer() {
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                Security.safeSetStorage('dm_all_orders', data.orders);
            }
        } catch (err) {
            console.warn('Sync orders warning:', err.message);
        }
    }

    // ─── 1.5. Sinkronisasi Override Angka Finansial dari Server ───
    async function syncFinancialOverrideFromServer() {
        try {
            const res = await fetch('/api/financial-override');
            const data = await res.json();
            if (data.success) {
                cachedFinancialOverride = data;
                Security.safeSetStorage('dm_financial_override', data);
            }
        } catch (err) {
            console.warn('Sync financial override warning, using fallback:', err.message);
            const local = Security.safeGetStorage('dm_financial_override');
            if (local) cachedFinancialOverride = local;
        }
    }

    // ─── 2. Analisis Keuangan Offline vs Online & Rekapan Arus Kas ───
    function renderFinancialAnalytics() {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const period = (document.getElementById('admin-revenue-period') ? document.getElementById('admin-revenue-period').value : 'all');
        const badge = document.getElementById('override-active-badge');
        
        let totalRevenue, realCashIn, pendingBalance;
        let offlineRevenue, onlineRevenue, offlinePct, onlinePct;
        let totalOrdersCount, aov;
        let qrisStats, cashStats, bankStats, ewalletStats;

        if (cachedFinancialOverride && cachedFinancialOverride.enabled) {
            // MODE PENYESUAIAN MANUAL (CUSTOM OVERRIDE MASTER ADMIN)
            if (badge) badge.style.display = 'inline-flex';

            totalRevenue = Number(cachedFinancialOverride.totalRevenue) || 0;
            realCashIn = Number(cachedFinancialOverride.realCashIn) || 0;
            pendingBalance = Number(cachedFinancialOverride.pendingBalance) || 0;
            totalOrdersCount = Number(cachedFinancialOverride.totalOrdersCount) || 0;
            aov = Number(cachedFinancialOverride.aov) || (totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0);

            offlineRevenue = Number(cachedFinancialOverride.offlineRevenue) || 0;
            onlineRevenue = Number(cachedFinancialOverride.onlineRevenue) || 0;
            const totalSplit = (offlineRevenue + onlineRevenue) || 1;
            offlinePct = Math.round((offlineRevenue / totalSplit) * 100);
            onlinePct = 100 - offlinePct;

            const qrisTot = Number(cachedFinancialOverride.qrisTotal) || 0;
            const cashTot = Number(cachedFinancialOverride.cashTotal) || 0;
            const bankTot = Number(cachedFinancialOverride.bankTotal) || 0;
            const ewalletTot = Number(cachedFinancialOverride.ewalletTotal) || 0;
            const baseSum = realCashIn > 0 ? realCashIn : (qrisTot + cashTot + bankTot + ewalletTot) || 1;

            qrisStats = {
                total: qrisTot,
                count: Number(cachedFinancialOverride.qrisCount) || 0,
                pct: Math.round((qrisTot / baseSum) * 100)
            };
            cashStats = {
                total: cashTot,
                count: Number(cachedFinancialOverride.cashCount) || 0,
                pct: Math.round((cashTot / baseSum) * 100)
            };
            bankStats = {
                total: bankTot,
                count: Number(cachedFinancialOverride.bankCount) || 0,
                pct: Math.round((bankTot / baseSum) * 100)
            };
            ewalletStats = {
                total: ewalletTot,
                count: Number(cachedFinancialOverride.ewalletCount) || 0,
                pct: Math.round((ewalletTot / baseSum) * 100)
            };
        } else {
            // MODE OTOMATIS (REALTIME DATABASE ORDERS)
            if (badge) badge.style.display = 'none';

            const now = new Date();
            const filteredOrders = allOrders.filter(o => {
                if (period === 'all') return true;
                if (!o.createdAt) return true;
                const orderDate = new Date(o.createdAt);
                if (isNaN(orderDate.getTime())) return true;

                if (period === 'today') {
                    return orderDate.toDateString() === now.toDateString();
                } else if (period === 'week') {
                    const diffTime = Math.abs(now - orderDate);
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    return diffDays <= 7;
                } else if (period === 'month') {
                    return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
                }
                return true;
            });

            // 1. Akumulasi Bruto Nilai Pesanan
            totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            // 2. Realisasi Kas Masuk Nyata (Real Cash In): Lunas (100%) + DP 50%
            realCashIn = filteredOrders.reduce((sum, o) => {
                if (o.amountPaid !== undefined) return sum + o.amountPaid;
                if (o.paymentStatus === 'belum_bayar') return sum;
                return sum + (o.total || 0);
            }, 0);

            // 3. Sisa Piutang DP yang belum lunas
            pendingBalance = filteredOrders.reduce((sum, o) => {
                if (o.remainingBalance !== undefined) return sum + o.remainingBalance;
                if (o.paymentType === 'dp' && o.paymentStatus !== 'lunas') {
                    return sum + Math.round((o.total || 0) * 0.5);
                }
                return sum;
            }, 0);

            // 4. Komparasi Offline vs Online
            offlineRevenue = filteredOrders.filter(o => o.channel === 'offline').reduce((sum, o) => sum + (o.total || 0), 0);
            onlineRevenue = filteredOrders.filter(o => o.channel === 'online').reduce((sum, o) => sum + (o.total || 0), 0);
            const totalSplit = (offlineRevenue + onlineRevenue) || 1;
            offlinePct = Math.round((offlineRevenue / totalSplit) * 100);
            onlinePct = 100 - offlinePct;

            // 5. Total Pesanan & Average Order Value (AOV)
            totalOrdersCount = filteredOrders.length;
            aov = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

            // 6. Breakdown Saluran Pembayaran (4 Saluran) berdasarkan Kas Masuk
            function calcChannelStats(filterFn) {
                const list = filteredOrders.filter(filterFn);
                const total = list.reduce((sum, o) => {
                    if (o.amountPaid !== undefined) return sum + o.amountPaid;
                    return sum + (o.total || 0);
                }, 0);
                const count = list.length;
                const pct = realCashIn > 0 ? Math.round((total / realCashIn) * 100) : 0;
                return { total, count, pct };
            }

            qrisStats = calcChannelStats(o => (o.paymentMethod || '').toLowerCase() === 'qris');
            cashStats = calcChannelStats(o => {
                const m = (o.paymentMethod || '').toLowerCase();
                return m === 'tunai' || m === 'cash' || m === 'cod';
            });
            bankStats = calcChannelStats(o => (o.paymentMethod || '').toLowerCase() === 'transfer');
            ewalletStats = calcChannelStats(o => (o.paymentMethod || '').toLowerCase() === 'ewallet');
        }

        // Update DOM Metrik 4 Card Utama
        setElText('admin-stat-total-rev', formatRupiah(totalRevenue));
        setElText('admin-stat-cash-in', formatRupiah(realCashIn));
        setElText('admin-stat-pending-bal', formatRupiah(pendingBalance));
        setElText('admin-stat-total-orders', `${totalOrdersCount} Pesanan`);
        setElText('admin-stat-aov', formatRupiah(aov));

        // Update Visual Split Progress Bar
        setElText('admin-stat-offline-rev', formatRupiah(offlineRevenue));
        setElText('admin-stat-online-rev', formatRupiah(onlineRevenue));
        setElText('admin-offline-pct', `${offlinePct}%`);
        setElText('admin-online-pct', `${onlinePct}%`);

        const barOffline = document.getElementById('admin-bar-offline');
        const barOnline = document.getElementById('admin-bar-online');
        if (barOffline) barOffline.style.width = `${offlinePct}%`;
        if (barOnline) barOnline.style.width = `${onlinePct}%`;

        // Update 4 Payment Channels
        setElText('admin-pay-qris', formatRupiah(qrisStats.total));
        setElText('admin-pay-qris-sub', `${qrisStats.count} transaksi (${qrisStats.pct}%)`);

        setElText('admin-pay-cash', formatRupiah(cashStats.total));
        setElText('admin-pay-cash-sub', `${cashStats.count} transaksi (${cashStats.pct}%)`);

        setElText('admin-pay-bank', formatRupiah(bankStats.total));
        setElText('admin-pay-bank-sub', `${bankStats.count} transaksi (${bankStats.pct}%)`);

        setElText('admin-pay-ewallet', formatRupiah(ewalletStats.total));
        setElText('admin-pay-ewallet-sub', `${ewalletStats.count} transaksi (${ewalletStats.pct}%)`);
    }

    // ─── 2.5. Manajemen Kas Laci & Modal Kembalian dari Pemilik ───
    async function syncCashLedgerFromServer() {
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
            console.warn('Sync cash ledger warning, using fallback:', err);
            const local = Security.safeGetStorage('dm_cash_ledger');
            if (local) cachedCashLedger = local;
        }
    }

    function renderCashLedgerSection() {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const offlineOrders = allOrders.filter(o => o.channel === 'offline');
        const cashSales = offlineOrders.filter(o => o.paymentMethod === 'tunai').reduce((sum, o) => sum + (o.amountPaid || o.total || 0), 0);

        const initialFloat = cachedCashLedger.initialFloat !== undefined ? cachedCashLedger.initialFloat : 200000;
        const logs = cachedCashLedger.logs || [];
        const cashIn = logs.filter(l => l.type === 'in').reduce((sum, l) => sum + (l.amount || 0), 0);
        const cashOut = logs.filter(l => l.type === 'out').reduce((sum, l) => sum + (l.amount || 0), 0);
        const totalDrawer = initialFloat + cashSales + cashIn - cashOut;

        setElText('admin-cash-float-display', formatRupiah(initialFloat));
        const inputFloat = document.getElementById('admin-input-float');
        if (inputFloat && !inputFloat.value) inputFloat.value = initialFloat;

        setElText('admin-cash-sales-display', formatRupiah(cashSales));
        setElText('admin-cash-in-display', '+' + formatRupiah(cashIn));
        setElText('admin-cash-out-display', '-' + formatRupiah(cashOut));
        setElText('admin-cash-total-drawer', formatRupiah(totalDrawer));

        // Render Table Logs
        const tbody = document.getElementById('admin-cash-logs-tbody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-tertiary);">
                        Belum ada catatan mutasi kas masuk / keluar laci toko.
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
                        <strong style="color:var(--text-primary); font-size:0.8rem;">${formatDateTime(l.timestamp)}</strong>
                    </td>
                    <td>
                        <span style="display:inline-block; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:4px; background:${badgeBg}; color:${badgeColor};">
                            ${isModal ? 'MODAL AWAL' : (isIn ? 'KAS MASUK' : 'KAS KELUAR')}
                        </span>
                    </td>
                    <td><strong style="color:var(--text-primary); font-size:0.84rem;">${Security.sanitizeHTML(l.category)}</strong></td>
                    <td style="font-size:0.82rem; color:var(--text-secondary);">${Security.sanitizeHTML(l.notes || '-')}</td>
                    <td style="text-align:right; font-weight:800; font-family:var(--font-mono); color:${badgeColor}; font-size:0.9rem;">
                        ${sign}${formatRupiah(l.amount)}
                    </td>
                    <td>
                        <span style="font-size:0.78rem; color:var(--text-tertiary);">
                            <i class="fas fa-user-circle"></i> ${Security.sanitizeHTML(l.operator || 'Admin')}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setupCashLedgerEvents() {
        // Quick float buttons
        document.querySelectorAll('.btn-quick-float').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amt');
                const input = document.getElementById('admin-input-float');
                if (input) input.value = amt;
            });
        });

        // Set Float Form
        const formFloat = document.getElementById('admin-form-set-float');
        if (formFloat) {
            formFloat.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amt = parseInt(document.getElementById('admin-input-float').value, 10);
                if (isNaN(amt) || amt < 0) {
                    UI.showToast('Nominal Salah', 'Nominal modal awal harus berupa angka non-negatif.', 'error');
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Bapak Hendra (Master Admin)';

                try {
                    const res = await fetch('/api/cash-ledger/set-float', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initialFloat: amt, operator, notes: 'Pengaturan modal uang kembalian dari pemilik' })
                    });
                    const data = await res.json();
                    if (data.success) {
                        cachedCashLedger = {
                            initialFloat: data.initialFloat,
                            logs: data.logs || []
                        };
                        Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                        Security.logAuditEvent('INITIAL_FLOAT_UPDATED', `Modal awal kembalian toko diatur menjadi Rp ${amt} oleh ${operator}`);
                        UI.showToast('Modal Awal Disimpan', `Modal uang kembalian toko diatur ke ${formatRupiah(amt)}`, 'success');
                        renderCashLedgerSection();
                    } else {
                        UI.showToast('Gagal', data.message || 'Terjadi kesalahan sistem', 'error');
                    }
                } catch (err) {
                    cachedCashLedger.initialFloat = amt;
                    Security.safeSetStorage('dm_cash_ledger', cachedCashLedger);
                    UI.showToast('Modal Awal Tersimpan', `Modal uang kembalian toko diatur ke ${formatRupiah(amt)}`, 'success');
                    renderCashLedgerSection();
                }
            });
        }

        // Admin Cash In & Out Modal buttons
        const btnIn = document.getElementById('btn-admin-add-cash-in');
        if (btnIn) {
            btnIn.addEventListener('click', () => {
                const amtInput = document.getElementById('admin-input-cash-in-amt');
                if (amtInput) amtInput.value = '';
                const notesInput = document.getElementById('admin-input-cash-in-notes');
                if (notesInput) notesInput.value = '';
                UI.openModal('admin-modal-cash-in');
            });
        }

        const btnOut = document.getElementById('btn-admin-add-cash-out');
        if (btnOut) {
            btnOut.addEventListener('click', () => {
                const amtInput = document.getElementById('admin-input-cash-out-amt');
                if (amtInput) amtInput.value = '';
                const notesInput = document.getElementById('admin-input-cash-out-notes');
                if (notesInput) notesInput.value = '';
                UI.openModal('admin-modal-cash-out');
            });
        }

        // Quick pills for In
        document.querySelectorAll('.btn-admin-quick-in').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amt');
                const input = document.getElementById('admin-input-cash-in-amt');
                if (input) input.value = amt;
            });
        });

        // Quick pills for Out
        document.querySelectorAll('.btn-admin-quick-out').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amt');
                const input = document.getElementById('admin-input-cash-out-amt');
                if (input) input.value = amt;
            });
        });

        // Form Admin Cash In
        const formIn = document.getElementById('admin-form-cash-in');
        if (formIn) {
            formIn.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amount = parseInt(document.getElementById('admin-input-cash-in-amt').value, 10);
                const category = document.getElementById('admin-select-cash-in-cat').value;
                const notes = document.getElementById('admin-input-cash-in-notes').value.trim();

                if (!amount || amount <= 0) {
                    UI.showToast('Nominal Salah', 'Nominal kas masuk harus lebih dari 0.', 'error');
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Bapak Hendra (Master Admin)';

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
                        Security.logAuditEvent('ADMIN_CASH_IN', `Kas masuk Rp ${amount} (${category}) dicatat oleh ${operator}`);
                        UI.closeModal('admin-modal-cash-in');
                        UI.showToast('Kas Masuk Berhasil', `+${formatRupiah(amount)} ditambahkan ke kas laci toko`, 'success');
                        renderCashLedgerSection();
                    }
                } catch (err) {
                    console.error('Admin cash in error:', err);
                }
            });
        }

        // Form Admin Cash Out
        const formOut = document.getElementById('admin-form-cash-out');
        if (formOut) {
            formOut.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amount = parseInt(document.getElementById('admin-input-cash-out-amt').value, 10);
                const category = document.getElementById('admin-select-cash-out-cat').value;
                const notes = document.getElementById('admin-input-cash-out-notes').value.trim();

                if (!amount || amount <= 0) {
                    UI.showToast('Nominal Salah', 'Nominal pengeluaran kas harus lebih dari 0.', 'error');
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Bapak Hendra (Master Admin)';

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
                        Security.logAuditEvent('ADMIN_CASH_OUT', `Kas keluar Rp ${amount} (${category}) dicatat oleh ${operator}`);
                        UI.closeModal('admin-modal-cash-out');
                        UI.showToast('Pengeluaran Dicatat', `-${formatRupiah(amount)} dikeluarkan dari laci toko`, 'info');
                        renderCashLedgerSection();
                    }
                } catch (err) {
                    console.error('Admin cash out error:', err);
                }
            });
        }
    }

    // ─── 2.6. Event Handlers Penyesuaian Angka Finansial (Master Admin) ───
    function setupFinancialOverrideEvents() {
        const btnOpen = document.getElementById('btn-open-financial-override');
        const modalId = 'modal-financial-override';
        const toggle = document.getElementById('override-enabled-toggle');
        const statusPill = document.getElementById('override-status-pill');
        const toggleLabel = document.getElementById('override-toggle-label');
        const form = document.getElementById('form-financial-override');
        const btnReset = document.getElementById('btn-reset-financial-override');

        function updateToggleUI(isChecked) {
            if (toggle) toggle.checked = isChecked;
            if (statusPill) {
                if (isChecked) {
                    statusPill.textContent = 'Mode Penyesuaian Kustom Aktif';
                    statusPill.style.background = 'rgba(99,102,241,0.2)';
                    statusPill.style.color = '#818cf8';
                    statusPill.style.borderColor = '#6366f1';
                } else {
                    statusPill.textContent = 'Mode Otomatis (Database Transaksi)';
                    statusPill.style.background = 'rgba(16,185,129,0.15)';
                    statusPill.style.color = '#10b981';
                    statusPill.style.borderColor = '#10b981';
                }
            }
            if (toggleLabel) {
                toggleLabel.textContent = isChecked ? 'Mode Kustom Aktif' : 'Gunakan Nilai Kustom';
            }
        }

        function populateFormValues(data) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = (val !== undefined && val !== null) ? val : 0;
            };

            setVal('override-input-total-rev', data.totalRevenue);
            setVal('override-input-cash-in', data.realCashIn);
            setVal('override-input-pending-bal', data.pendingBalance);
            setVal('override-input-order-count', data.totalOrdersCount);
            setVal('override-input-aov', data.aov);

            setVal('override-input-offline-rev', data.offlineRevenue);
            setVal('override-input-online-rev', data.onlineRevenue);

            setVal('override-input-qris-total', data.qrisTotal);
            setVal('override-input-qris-count', data.qrisCount);

            setVal('override-input-cash-total', data.cashTotal);
            setVal('override-input-cash-count', data.cashCount);

            setVal('override-input-bank-total', data.bankTotal);
            setVal('override-input-bank-count', data.bankCount);

            setVal('override-input-ewallet-total', data.ewalletTotal);
            setVal('override-input-ewallet-count', data.ewalletCount);
        }

        function calculateCurrentDatabaseMetrics() {
            const allOrders = Security.safeGetStorage('dm_all_orders') || [];
            const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const realCashIn = allOrders.reduce((sum, o) => {
                if (o.amountPaid !== undefined) return sum + o.amountPaid;
                if (o.paymentStatus === 'belum_bayar') return sum;
                return sum + (o.total || 0);
            }, 0);
            const pendingBalance = allOrders.reduce((sum, o) => {
                if (o.remainingBalance !== undefined) return sum + o.remainingBalance;
                if (o.paymentType === 'dp' && o.paymentStatus !== 'lunas') {
                    return sum + Math.round((o.total || 0) * 0.5);
                }
                return sum;
            }, 0);
            const offlineRevenue = allOrders.filter(o => o.channel === 'offline').reduce((sum, o) => sum + (o.total || 0), 0);
            const onlineRevenue = allOrders.filter(o => o.channel === 'online').reduce((sum, o) => sum + (o.total || 0), 0);
            const totalOrdersCount = allOrders.length;
            const aov = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

            function calcMethod(filterFn) {
                const list = allOrders.filter(filterFn);
                const total = list.reduce((sum, o) => sum + (o.amountPaid !== undefined ? o.amountPaid : (o.total || 0)), 0);
                return { total, count: list.length };
            }

            const qris = calcMethod(o => (o.paymentMethod || '').toLowerCase() === 'qris');
            const cash = calcMethod(o => {
                const m = (o.paymentMethod || '').toLowerCase();
                return m === 'tunai' || m === 'cash' || m === 'cod';
            });
            const bank = calcMethod(o => (o.paymentMethod || '').toLowerCase() === 'transfer');
            const ewallet = calcMethod(o => (o.paymentMethod || '').toLowerCase() === 'ewallet');

            return {
                totalRevenue,
                realCashIn,
                pendingBalance,
                totalOrdersCount,
                aov,
                offlineRevenue,
                onlineRevenue,
                qrisTotal: qris.total,
                qrisCount: qris.count,
                cashTotal: cash.total,
                cashCount: cash.count,
                bankTotal: bank.total,
                bankCount: bank.count,
                ewalletTotal: ewallet.total,
                ewalletCount: ewallet.count
            };
        }

        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                if (cachedFinancialOverride && cachedFinancialOverride.enabled) {
                    updateToggleUI(true);
                    populateFormValues(cachedFinancialOverride);
                } else {
                    updateToggleUI(false);
                    populateFormValues(calculateCurrentDatabaseMetrics());
                }
                UI.openModal(modalId);
            });
        }

        if (toggle) {
            toggle.addEventListener('change', () => {
                updateToggleUI(toggle.checked);
            });
        }

        // Preset 1: Salin DB
        const btnCopyDb = document.getElementById('btn-preset-copy-db');
        if (btnCopyDb) {
            btnCopyDb.addEventListener('click', () => {
                const dbVals = calculateCurrentDatabaseMetrics();
                populateFormValues(dbVals);
                updateToggleUI(true);
                UI.showToast('Data Disalin', 'Nominal database pesanan berhasil disalin ke form input!', 'info');
            });
        }

        // Preset 2: Toko Aktif (~Rp 1,5 Juta)
        const btnActiveShop = document.getElementById('btn-preset-active-shop');
        if (btnActiveShop) {
            btnActiveShop.addEventListener('click', () => {
                populateFormValues({
                    totalRevenue: 1540000,
                    realCashIn: 1290000,
                    pendingBalance: 250000,
                    totalOrdersCount: 14,
                    aov: 110000,
                    offlineRevenue: 920000,
                    onlineRevenue: 620000,
                    qrisTotal: 720000,
                    qrisCount: 6,
                    cashTotal: 570000,
                    cashCount: 8,
                    bankTotal: 0,
                    bankCount: 0,
                    ewalletTotal: 0,
                    ewalletCount: 0
                });
                updateToggleUI(true);
                UI.showToast('Preset Toko Dimuat', 'Preset toko aktif (~Rp 1,5 Juta) telah diisikan ke form!', 'info');
            });
        }

        // Preset 3: Proyek Tender (~Rp 8,5 Juta)
        const btnBigTender = document.getElementById('btn-preset-big-tender');
        if (btnBigTender) {
            btnBigTender.addEventListener('click', () => {
                populateFormValues({
                    totalRevenue: 8550000,
                    realCashIn: 6850000,
                    pendingBalance: 1700000,
                    totalOrdersCount: 38,
                    aov: 225000,
                    offlineRevenue: 4800000,
                    onlineRevenue: 3750000,
                    qrisTotal: 3450000,
                    qrisCount: 16,
                    cashTotal: 2600000,
                    cashCount: 17,
                    bankTotal: 800000,
                    bankCount: 5,
                    ewalletTotal: 0,
                    ewalletCount: 0
                });
                updateToggleUI(true);
                UI.showToast('Preset Proyek Besar Dimuat', 'Preset skala besar (~Rp 8,5 Juta) telah diisikan ke form!', 'info');
            });
        }

        // Form Submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Bapak Hendra (Master Admin)';

                const payload = {
                    enabled: toggle ? toggle.checked : true,
                    operator,
                    totalRevenue: parseInt(document.getElementById('override-input-total-rev').value, 10) || 0,
                    realCashIn: parseInt(document.getElementById('override-input-cash-in').value, 10) || 0,
                    pendingBalance: parseInt(document.getElementById('override-input-pending-bal').value, 10) || 0,
                    totalOrdersCount: parseInt(document.getElementById('override-input-order-count').value, 10) || 0,
                    aov: parseInt(document.getElementById('override-input-aov').value, 10) || 0,
                    offlineRevenue: parseInt(document.getElementById('override-input-offline-rev').value, 10) || 0,
                    onlineRevenue: parseInt(document.getElementById('override-input-online-rev').value, 10) || 0,
                    qrisTotal: parseInt(document.getElementById('override-input-qris-total').value, 10) || 0,
                    qrisCount: parseInt(document.getElementById('override-input-qris-count').value, 10) || 0,
                    cashTotal: parseInt(document.getElementById('override-input-cash-total').value, 10) || 0,
                    cashCount: parseInt(document.getElementById('override-input-cash-count').value, 10) || 0,
                    bankTotal: parseInt(document.getElementById('override-input-bank-total').value, 10) || 0,
                    bankCount: parseInt(document.getElementById('override-input-bank-count').value, 10) || 0,
                    ewalletTotal: parseInt(document.getElementById('override-input-ewallet-total').value, 10) || 0,
                    ewalletCount: parseInt(document.getElementById('override-input-ewallet-count').value, 10) || 0
                };

                try {
                    const res = await fetch('/api/financial-override', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        cachedFinancialOverride = data;
                        Security.safeSetStorage('dm_financial_override', data);
                        Security.logAuditEvent('FINANCIAL_OVERRIDE_SAVED', `Master Admin memperbarui nominal finansial (Mode: ${data.enabled ? 'Kustom' : 'Otomatis'})`);
                        renderFinancialAnalytics();
                        UI.closeModal(modalId);
                        UI.showToast('Sukses Disimpan', data.message || 'Pengaturan nominal berhasil diterapkan!', 'success');
                    } else {
                        UI.showToast('Gagal', data.message || 'Gagal menyimpan penyesuaian.', 'error');
                    }
                } catch (err) {
                    console.error('Error saving override:', err);
                    cachedFinancialOverride = payload;
                    Security.safeSetStorage('dm_financial_override', payload);
                    renderFinancialAnalytics();
                    UI.closeModal(modalId);
                    UI.showToast('Tersimpan Lokal', 'Penyesuaian nominal diterapkan secara lokal.', 'success');
                }
            });
        }

        // Reset Button
        if (btnReset) {
            btnReset.addEventListener('click', async () => {
                if (!confirm('Kembalikan ke Mode Otomatis?\nSemua angka finansial akan dihitung ulang secara otomatis dari database transaksi orders.json.')) {
                    return;
                }

                const session = Security.getActiveSession() || {};
                const operator = session.name || session.username || 'Bapak Hendra (Master Admin)';

                try {
                    const res = await fetch('/api/financial-override', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: false, operator })
                    });
                    const data = await res.json();
                    if (data.success) {
                        cachedFinancialOverride = data;
                        Security.safeSetStorage('dm_financial_override', data);
                        Security.logAuditEvent('FINANCIAL_OVERRIDE_RESET', `Master Admin menonaktifkan penyesuaian manual (Kembali ke mode database otomatis)`);
                        renderFinancialAnalytics();
                        UI.closeModal(modalId);
                        UI.showToast('Mode Otomatis Aktif', 'Nominal finansial kembali dihitung otomatis dari database pesanan.', 'info');
                    }
                } catch (err) {
                    console.error('Error resetting override:', err);
                    cachedFinancialOverride.enabled = false;
                    Security.safeSetStorage('dm_financial_override', cachedFinancialOverride);
                    renderFinancialAnalytics();
                    UI.closeModal(modalId);
                    UI.showToast('Mode Otomatis Aktif', 'Kembali ke hitungan otomatis database.', 'info');
                }
            });
        }
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ─── 3. Rekap Semua Pesanan Transaksi (Lengkap & Detail) ───
    function renderAllOrdersTable() {
        const tbody = document.getElementById('admin-orders-tbody');
        if (!tbody) return;

        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const searchQuery = (document.getElementById('admin-order-search') ? document.getElementById('admin-order-search').value : '').toLowerCase().trim();
        const payStatusFilter = (document.getElementById('admin-order-filter-pay') ? document.getElementById('admin-order-filter-pay').value : 'all');
        const channelFilter = (document.getElementById('admin-order-filter-channel') ? document.getElementById('admin-order-filter-channel').value : 'all');

        const filtered = allOrders.filter(o => {
            // Channel filter
            if (channelFilter !== 'all' && (o.channel || 'offline') !== channelFilter) return false;

            // Payment status filter
            const pStatus = o.paymentStatus || (o.paymentType === 'dp' ? 'dp_dibayar' : 'lunas');
            if (payStatusFilter !== 'all' && pStatus !== payStatusFilter) return false;

            // Search query filter
            if (searchQuery) {
                const idMatch = (o.id || '').toLowerCase().includes(searchQuery);
                const custName = (o.customer && o.customer.name ? o.customer.name : '').toLowerCase();
                const custPhone = (o.customer && o.customer.phone ? o.customer.phone : '').toLowerCase();
                const itemsMatch = (o.items || []).some(i => (i.name || '').toLowerCase().includes(searchQuery));
                if (!idMatch && !custName.includes(searchQuery) && !custPhone.includes(searchQuery) && !itemsMatch) {
                    return false;
                }
            }

            return true;
        });

        // Update count badge
        const countBadge = document.getElementById('admin-orders-count-badge');
        if (countBadge) countBadge.textContent = `${filtered.length} Pesanan`;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-tertiary);">
                        <i class="fas fa-inbox" style="font-size:2.2rem; margin-bottom:0.6rem; display:block; opacity:0.4;"></i>
                        Tidak ada riwayat transaksi yang cocok dengan filter pencarian
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(o => {
            const pStatus = o.paymentStatus || (o.paymentType === 'dp' ? 'dp_dibayar' : 'lunas');
            const total = o.total || 0;
            const amountPaid = o.amountPaid !== undefined ? o.amountPaid : (pStatus === 'dp_dibayar' ? Math.round(total * 0.5) : total);
            const remainingBalance = o.remainingBalance !== undefined ? o.remainingBalance : (pStatus === 'dp_dibayar' ? (total - amountPaid) : 0);

            // Customer phone & WhatsApp link
            const phone = o.customer ? (o.customer.phone || '') : '';
            const phoneClean = phone.replace(/[^0-9]/g, '').replace(/^0/, '62');

            // Formatted Items List
            const itemsHTML = (o.items || []).map(item => `
                <div style="margin-bottom:0.4rem; padding-bottom:0.35rem; border-bottom:1px dashed rgba(255,255,255,0.06);">
                    <div style="font-weight:700; color:var(--text-primary); font-size:0.86rem;">
                        ${Security.sanitizeHTML(item.name)} <span style="color:var(--accent-start); font-size:0.8rem;">(×${item.quantity || 1})</span>
                    </div>
                    ${item.specs ? `<div class="order-spec-chip"><i class="fas fa-sliders-h" style="font-size:0.65rem;"></i> ${Security.sanitizeHTML(item.specs)}</div>` : ''}
                    ${item.fileName ? `<div class="order-file-badge"><i class="fas fa-paperclip"></i> ${Security.sanitizeHTML(item.fileName)}</div>` : ''}
                    ${item.notes ? `<div style="font-size:0.73rem; color:var(--text-tertiary); margin-top:2px; font-style:italic;">Catatan: "${Security.sanitizeHTML(item.notes)}"</div>` : ''}
                </div>
            `).join('');

            // Payment badge & breakdown
            let payBadgeHTML = '';
            if (pStatus === 'lunas') {
                payBadgeHTML = `
                    <span class="badge-pay-lunas"><i class="fas fa-check-circle"></i> LUNAS (100%)</span>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px;">
                        Terbayar: <strong>${formatRupiah(total)}</strong>
                    </div>
                `;
            } else if (pStatus === 'menunggu_verifikasi') {
                payBadgeHTML = `
                    <span class="badge-pay-verifying"><i class="fas fa-clock fa-spin"></i> PERLU VERIFIKASI</span>
                    <div style="font-size:0.74rem; color:var(--text-secondary); margin-top:3px;">
                        Bukti Terkirim: <strong>${formatRupiah(amountPaid || (o.paymentType === 'dp' ? Math.round(total * 0.5) : total))}</strong>
                    </div>
                `;
            } else if (pStatus === 'dp_dibayar') {
                payBadgeHTML = `
                    <span class="badge-pay-dp"><i class="fas fa-hourglass-half"></i> DP 50% DIBAYAR</span>
                    <div style="font-size:0.74rem; margin-top:3px; line-height:1.4;">
                        <div>Masuk: <strong style="color:#10b981;">${formatRupiah(amountPaid)}</strong></div>
                        <div>Sisa Tagihan: <strong style="color:#ef4444;">${formatRupiah(remainingBalance)}</strong></div>
                    </div>
                `;
            } else {
                payBadgeHTML = `
                    <span class="badge-pay-unpaid"><i class="fas fa-times-circle"></i> BELUM BAYAR</span>
                    <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:3px;">
                        Tagihan: <strong>${formatRupiah(total)}</strong>
                    </div>
                `;
            }

            const methodLabel = getPaymentMethodLabel(o.paymentMethod);

            return `
                <tr>
                    <td>
                        <strong style="color:var(--accent-start); font-family:var(--font-mono); font-size:0.86rem; display:block; letter-spacing:0.3px;">
                            ${Security.sanitizeHTML(o.id)}
                        </strong>
                        <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:3px;">
                            <i class="far fa-clock"></i> ${formatDateTime(o.createdAt)}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${o.channel === 'online' ? 'badge-new' : 'badge-hot'}" style="font-size:0.75rem; display:inline-flex; align-items:center; gap:0.35rem;">
                            <i class="fas ${o.channel === 'online' ? 'fa-globe' : 'fa-store'}"></i>
                            ${o.channel ? o.channel.toUpperCase() : 'OFFLINE'}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.88rem;">
                            ${Security.sanitizeHTML(o.customer ? o.customer.name : 'Pelanggan Walk-In')}
                        </div>
                        ${phone ? `
                            <div style="margin-top:2px;">
                                <a href="https://wa.me/${phoneClean}" target="_blank" style="color:var(--success); font-size:0.78rem; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem;">
                                    <i class="fab fa-whatsapp"></i> ${Security.sanitizeHTML(phone)}
                                </a>
                            </div>
                        ` : ''}
                        <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:3px;">
                            <i class="fas fa-map-marker-alt"></i> ${Security.sanitizeHTML(o.deliveryMethod || (o.channel === 'offline' ? 'Ambil di Toko' : 'Kirim Ekspedisi'))}
                        </div>
                    </td>
                    <td>${itemsHTML || '-'}</td>
                    <td>
                        <strong style="color:var(--text-primary); font-size:0.95rem; font-weight:800; font-family:var(--font-mono);">
                            ${formatRupiah(total)}
                        </strong>
                    </td>
                    <td>
                        ${payBadgeHTML}
                        <div style="margin-top:4px; font-size:0.72rem; color:var(--text-tertiary);">
                            <i class="fas fa-wallet"></i> ${methodLabel}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${o.status === 'Siap Diambil / Dikirim' || o.status === 'Selesai' ? 'badge-new' : 'badge-hot'}" style="font-size:0.76rem; display:inline-flex; align-items:center; gap:0.3rem;">
                            <i class="fas fa-tools"></i> ${Security.sanitizeHTML(o.status || 'Diproses')}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap:0.4rem;">
                            <button type="button" class="btn btn-sm btn-outline btn-view-invoice" data-order-id="${o.id}" title="Buka & Cetak Nota Resmi" style="font-size:0.76rem; padding:0.4rem 0.65rem; font-weight:700;">
                                <i class="fas fa-file-invoice"></i> Lihat Nota
                            </button>
                            ${(pStatus === 'menunggu_verifikasi' || o.paymentProof) ? `
                                <button type="button" class="btn btn-sm btn-outline btn-inspect-proof" data-order-id="${o.id}" title="Periksa Bukti Bayar / Struk Transfer" style="font-size:0.74rem; padding:0.35rem 0.6rem; font-weight:800; color:#f59e0b; border-color:#f59e0b;">
                                    <i class="fas fa-file-invoice-dollar"></i> Periksa Bukti
                                </button>
                                <button type="button" class="btn btn-sm btn-success btn-quick-acc" data-order-id="${o.id}" title="ACC & Lanjutkan ke Antrian Mesin Cetak" style="font-size:0.74rem; padding:0.35rem 0.6rem; font-weight:800;">
                                    <i class="fas fa-check"></i> ACC Bayar
                                </button>
                            ` : ''}
                            ${(pStatus !== 'menunggu_verifikasi' && remainingBalance > 0) ? `
                                <button type="button" class="btn btn-sm btn-success btn-settle-dp" data-order-id="${o.id}" data-rem="${remainingBalance}" title="Catat Pelunasan Sisa DP" style="font-size:0.74rem; padding:0.35rem 0.6rem; font-weight:800;">
                                    <i class="fas fa-coins"></i> Lunasi DP
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners for buttons in table
        tbody.querySelectorAll('.btn-view-invoice').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-order-id');
                openInvoiceModal(id);
            });
        });

        tbody.querySelectorAll('.btn-settle-dp').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-order-id');
                settleOrderPayment(id);
            });
        });

        tbody.querySelectorAll('.btn-inspect-proof').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-order-id');
                openPaymentProofModal(id);
            });
        });

        tbody.querySelectorAll('.btn-quick-acc').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-order-id');
                verifyOrderPayment(id, 'approve');
            });
        });
    }

    // ─── 3.0. Helper Barcode Generator SVG ───
    function generateBarcodeSVG(code) {
        const safeCode = (code || 'DM-ORD-0000').toUpperCase();
        let x = 6;
        let rects = '';
        for (let i = 0; i < safeCode.length; i++) {
            const charCode = safeCode.charCodeAt(i);
            const w1 = ((charCode % 3) * 0.8 + 1.2).toFixed(1);
            const gap1 = (((charCode >> 1) % 2) * 0.8 + 1.0).toFixed(1);
            const w2 = (((charCode >> 2) % 3) * 0.8 + 1.4).toFixed(1);
            const gap2 = (((charCode >> 3) % 2) * 0.8 + 1.1).toFixed(1);

            rects += `<rect x="${x}" y="0" width="${w1}" height="28" fill="#0f172a" />`;
            x += parseFloat(w1) + parseFloat(gap1);
            rects += `<rect x="${x.toFixed(1)}" y="0" width="${w2}" height="28" fill="#0f172a" />`;
            x += parseFloat(w2) + parseFloat(gap2);
        }
        const totalWidth = Math.max(180, Math.ceil(x + 6));
        return `
            <svg viewBox="0 0 ${totalWidth} 28" width="160" height="26" xmlns="http://www.w3.org/2000/svg">
                ${rects}
            </svg>
        `;
    }

    // ─── 3.1. Buka Modal Nota Resmi / Invoice Percetakan ───
    function openInvoiceModal(orderId) {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const o = allOrders.find(item => item.id === orderId);

        if (!o) {
            UI.showToast('Nota Tidak Ditemukan', `Data pesanan ${orderId} tidak tersedia.`, 'error');
            return;
        }

        const pStatus = o.paymentStatus || (o.paymentType === 'dp' ? 'dp_dibayar' : 'lunas');
        const total = o.total || 0;
        const amountPaid = o.amountPaid !== undefined ? o.amountPaid : (pStatus === 'dp_dibayar' ? Math.round(total * 0.5) : total);
        const remainingBalance = o.remainingBalance !== undefined ? o.remainingBalance : (pStatus === 'dp_dibayar' ? (total - amountPaid) : 0);

        setElText('inv-order-id', o.id);
        setElText('inv-created-at', formatDateTime(o.createdAt));
        setElText('inv-cust-name', o.customer ? (o.customer.name || 'Pelanggan Walk-In') : 'Pelanggan Walk-In');
        setElText('inv-cust-phone', o.customer && o.customer.phone ? o.customer.phone : '-');
        setElText('inv-cust-address', o.customer && o.customer.address ? o.customer.address : (o.deliveryMethod || 'Ambil di Toko Fisik'));
        setElText('inv-channel', o.channel === 'online' ? 'Online Storefront (Web Toko)' : 'Kasir Walk-In Fisik (Offline)');
        setElText('inv-pay-method', getPaymentMethodLabel(o.paymentMethod));
        setElText('inv-cashier', o.cashierName || 'Bapak Hendra (Master Admin)');

        // Status Badge in Nota
        const statusBadgeEl = document.getElementById('inv-pay-status-badge');
        if (statusBadgeEl) {
            if (pStatus === 'lunas') {
                statusBadgeEl.innerHTML = '<strong style="color:#10b981;">LUNAS (100% Pembayaran Selesai)</strong>';
            } else if (pStatus === 'dp_dibayar') {
                statusBadgeEl.innerHTML = '<strong style="color:#d97706;">UANG MUKA (DP 50% Masuk)</strong>';
            } else {
                statusBadgeEl.innerHTML = '<strong style="color:#dc2626;">BELUM LUNAS</strong>';
            }
        }

        // Render Invoice Items Table
        const itemsTbody = document.getElementById('inv-items-tbody');
        if (itemsTbody) {
            itemsTbody.innerHTML = (o.items || []).map((item, idx) => {
                const qty = item.quantity || 1;
                const unitPrice = item.price ? Math.round(item.price / qty) : 0;
                const subtotal = item.price || 0;

                return `
                    <tr>
                        <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                        <td>
                            <strong style="color:#0f172a; font-size:0.9rem;">${Security.sanitizeHTML(item.name)}</strong>
                            ${item.specs ? `<div style="font-size:0.8rem; color:#475569; margin-top:2px;">Spesifikasi: ${Security.sanitizeHTML(item.specs)}</div>` : ''}
                            ${item.fileName ? `<div style="font-size:0.75rem; color:#4338ca; margin-top:2px;"><i class="fas fa-file-pdf"></i> File Desain: ${Security.sanitizeHTML(item.fileName)}</div>` : ''}
                            ${item.notes ? `<div style="font-size:0.75rem; color:#64748b; font-style:italic;">Catatan: "${Security.sanitizeHTML(item.notes)}"</div>` : ''}
                        </td>
                        <td style="text-align:center; font-weight:700;">${qty}</td>
                        <td style="text-align:right;">${formatRupiah(unitPrice)}</td>
                        <td style="text-align:right; font-weight:700;">${formatRupiah(subtotal)}</td>
                    </tr>
                `;
            }).join('');
        }

        // Totals & DP Breakdown
        setElText('inv-subtotal', formatRupiah(total));
        setElText('inv-total', formatRupiah(total));
        setElText('inv-dp-paid', formatRupiah(amountPaid));
        setElText('inv-remaining', formatRupiah(remainingBalance));

        const rowDP = document.getElementById('inv-row-dp');
        const rowSisa = document.getElementById('inv-row-sisa');
        if (rowDP) rowDP.style.display = (o.paymentType === 'dp' || remainingBalance > 0) ? 'flex' : 'none';
        if (rowSisa) rowSisa.style.display = remainingBalance > 0 ? 'flex' : 'none';

        // Signatures
        setElText('inv-sig-cashier', o.cashierName || 'Bapak Hendra (Percetakan Gilar Media)');
        setElText('inv-sig-customer', o.customer ? (o.customer.name || 'Pelanggan') : 'Pelanggan');

        // Stamp badge & Barcode
        const stampEl = document.getElementById('inv-stamp-badge');
        if (stampEl) {
            if (pStatus === 'lunas') {
                stampEl.innerHTML = '<i class="fas fa-check-circle"></i> LUNAS / PAID (100%)';
                stampEl.style.borderColor = '#16a34a';
                stampEl.style.color = '#16a34a';
            } else if (pStatus === 'dp_dibayar') {
                stampEl.innerHTML = '<i class="fas fa-hourglass-half"></i> UANG MUKA (DP 50% DITERIMA)';
                stampEl.style.borderColor = '#d97706';
                stampEl.style.color = '#d97706';
            } else {
                stampEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> BELUM LUNAS';
                stampEl.style.borderColor = '#dc2626';
                stampEl.style.color = '#dc2626';
            }
        }

        const barcodeContainer = document.getElementById('inv-barcode-svg');
        if (barcodeContainer) {
            barcodeContainer.innerHTML = generateBarcodeSVG(o.id);
        }
        setElText('inv-barcode-text', `* ${o.id} *`);
        setElText('inv-print-time', new Date().toLocaleString('id-ID') + ' WIB');

        // Settle button inside modal
        const settleContainer = document.getElementById('inv-settle-action-container');
        if (settleContainer) {
            if (remainingBalance > 0) {
                settleContainer.innerHTML = `
                    <button type="button" class="btn btn-success" id="btn-settle-from-modal" style="font-weight:800;">
                        <i class="fas fa-coins"></i> Catat Pelunasan Sisa DP Sekarang (${formatRupiah(remainingBalance)})
                    </button>
                `;
                const modalSettleBtn = document.getElementById('btn-settle-from-modal');
                if (modalSettleBtn) {
                    modalSettleBtn.addEventListener('click', () => {
                        settleOrderPayment(o.id);
                    });
                }
            } else {
                settleContainer.innerHTML = `
                    <span style="color:var(--success); font-weight:700; font-size:0.85rem; display:inline-flex; align-items:center; gap:0.4rem;">
                        <i class="fas fa-check-circle"></i> Transaksi ini telah LUNAS sepenuhnya
                    </span>
                `;
            }
        }

        UI.openModal('admin-invoice-modal');
    }

    // ─── 3.1.B. Modal & Cetak Rekapan Keuangan & Arus Kas (Dokumen Resmi A4) ───
    function openFinancialRecapModal(period = null) {
        const periodSelect = document.getElementById('admin-revenue-period');
        const modalSelect = document.getElementById('modal-recap-period-select');
        const activePeriod = period || (periodSelect ? periodSelect.value : 'all');

        if (modalSelect) {
            modalSelect.value = activePeriod;
            if (!modalSelect.dataset.recapListener) {
                modalSelect.addEventListener('change', () => {
                    renderFinancialRecapDocument(modalSelect.value);
                });
                modalSelect.dataset.recapListener = 'true';
            }
        }

        renderFinancialRecapDocument(activePeriod);

        const doPrintBtn = document.getElementById('btn-do-print-financial');
        if (doPrintBtn && !doPrintBtn.dataset.recapListener) {
            doPrintBtn.addEventListener('click', () => {
                document.body.classList.add('print-recap');
                document.body.classList.remove('print-invoice');
                window.print();
            });
            doPrintBtn.dataset.recapListener = 'true';
        }

        UI.openModal('admin-financial-recap-modal');
    }

    function renderFinancialRecapDocument(period = 'all') {
        const container = document.getElementById('financial-recap-print-area');
        if (!container) return;

        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const now = new Date();
        const filteredOrders = allOrders.filter(o => {
            if (period === 'all') return true;
            if (!o.createdAt) return true;
            const orderDate = new Date(o.createdAt);
            if (isNaN(orderDate.getTime())) return true;

            if (period === 'today') {
                return orderDate.toDateString() === now.toDateString();
            } else if (period === 'week') {
                const diffTime = Math.abs(now - orderDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays <= 7;
            } else if (period === 'month') {
                return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
            }
            return true;
        });

        const offlineOrders = filteredOrders.filter(o => o.channel === 'offline');
        const onlineOrders = filteredOrders.filter(o => o.channel === 'online');

        let totalRevenue, realCashIn, pendingBalance;
        let offlineRev, onlineRev, offlinePct, onlinePct;
        let totalOrdersCount, aov;
        let qris, cash, bank, ewallet;

        const isOverride = cachedFinancialOverride && cachedFinancialOverride.enabled;

        if (isOverride) {
            totalRevenue = Number(cachedFinancialOverride.totalRevenue) || 0;
            realCashIn = Number(cachedFinancialOverride.realCashIn) || 0;
            pendingBalance = Number(cachedFinancialOverride.pendingBalance) || 0;
            totalOrdersCount = Number(cachedFinancialOverride.totalOrdersCount) || 0;
            aov = Number(cachedFinancialOverride.aov) || (totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0);

            offlineRev = Number(cachedFinancialOverride.offlineRevenue) || 0;
            onlineRev = Number(cachedFinancialOverride.onlineRevenue) || 0;
            const totalSplit = (offlineRev + onlineRev) || 1;
            offlinePct = Math.round((offlineRev / totalSplit) * 100);
            onlinePct = 100 - offlinePct;

            const qrisTot = Number(cachedFinancialOverride.qrisTotal) || 0;
            const cashTot = Number(cachedFinancialOverride.cashTotal) || 0;
            const bankTot = Number(cachedFinancialOverride.bankTotal) || 0;
            const ewalletTot = Number(cachedFinancialOverride.ewalletTotal) || 0;
            const baseSum = realCashIn > 0 ? realCashIn : (qrisTot + cashTot + bankTot + ewalletTot) || 1;

            qris = {
                total: qrisTot,
                count: Number(cachedFinancialOverride.qrisCount) || 0,
                pct: Math.round((qrisTot / baseSum) * 100)
            };
            cash = {
                total: cashTot,
                count: Number(cachedFinancialOverride.cashCount) || 0,
                pct: Math.round((cashTot / baseSum) * 100)
            };
            bank = {
                total: bankTot,
                count: Number(cachedFinancialOverride.bankCount) || 0,
                pct: Math.round((bankTot / baseSum) * 100)
            };
            ewallet = {
                total: ewalletTot,
                count: Number(cachedFinancialOverride.ewalletCount) || 0,
                pct: Math.round((ewalletTot / baseSum) * 100)
            };
        } else {
            // 1. Akumulasi Bruto Nilai Pesanan
            totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            // 2. Realisasi Kas Masuk Nyata (Real Cash In): Lunas + DP 50%
            realCashIn = filteredOrders.reduce((sum, o) => {
                if (o.amountPaid !== undefined) return sum + o.amountPaid;
                if (o.paymentStatus === 'belum_bayar') return sum;
                return sum + (o.total || 0);
            }, 0);

            // 3. Sisa Piutang DP yang belum lunas
            pendingBalance = filteredOrders.reduce((sum, o) => {
                if (o.remainingBalance !== undefined) return sum + o.remainingBalance;
                if (o.paymentType === 'dp' && o.paymentStatus !== 'lunas') {
                    return sum + Math.round((o.total || 0) * 0.5);
                }
                return sum;
            }, 0);

            // 4. Komparasi Saluran
            offlineRev = offlineOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            onlineRev = onlineOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const totalSplit = (offlineRev + onlineRev) || 1;
            offlinePct = Math.round((offlineRev / totalSplit) * 100);
            onlinePct = 100 - offlinePct;

            // 5. Total Pesanan & AOV
            totalOrdersCount = filteredOrders.length;
            aov = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

            // 6. Realisasi Saluran Pembayaran (Kas Masuk)
            function calcMethodStats(filterFn) {
                const list = filteredOrders.filter(filterFn);
                const total = list.reduce((sum, o) => sum + (o.amountPaid !== undefined ? o.amountPaid : (o.total || 0)), 0);
                const count = list.length;
                const pct = realCashIn > 0 ? Math.round((total / realCashIn) * 100) : 0;
                return { total, count, pct };
            }
            qris = calcMethodStats(o => (o.paymentMethod || '').toLowerCase() === 'qris');
            cash = calcMethodStats(o => {
                const m = (o.paymentMethod || '').toLowerCase();
                return m === 'tunai' || m === 'cash' || m === 'cod';
            });
            bank = calcMethodStats(o => (o.paymentMethod || '').toLowerCase() === 'transfer');
            ewallet = calcMethodStats(o => (o.paymentMethod || '').toLowerCase() === 'ewallet');
        }

        // 7. Rekonsiliasi Kas Laci (Modal Pemilik + Tunai - Pengeluaran)
        const initialFloat = cachedCashLedger.initialFloat !== undefined ? cachedCashLedger.initialFloat : 200000;
        const cashLogs = cachedCashLedger.logs || [];
        const cashInManual = cashLogs.filter(l => l.type === 'in').reduce((sum, l) => sum + (l.amount || 0), 0);
        const cashOutManual = cashLogs.filter(l => l.type === 'out').reduce((sum, l) => sum + (l.amount || 0), 0);
        const cashSales = isOverride ? cash.total : offlineOrders.filter(o => o.paymentMethod === 'tunai').reduce((sum, o) => sum + (o.amountPaid || o.total || 0), 0);
        const totalCashInDrawer = initialFloat + cashSales + cashInManual - cashOutManual;

        const periodLabelMap = {
            all: 'Semua Waktu (Akumulasi Sejak Awal Berdiri)',
            today: `Hari Ini (${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })})`,
            week: '7 Hari Terakhir',
            month: `Bulan Ini (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`
        };
        const periodLabel = periodLabelMap[period] || 'Semua Waktu';
        const printDateFormatted = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }) + ', ' + now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        }) + ' WIB';

        const docNumber = `DM-FIN-REP/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 8999) + 1000)}`;

        container.innerHTML = `
            <!-- Kop Surat Resmi Dokumen Finansial -->
            <div class="financial-header">
                <div class="financial-brand">
                    <h2>
                        <i class="fas fa-print" style="color:#4f46e5;"></i>
                        PERCETAKAN GILAR MEDIA (PRINTING & ADVERTISING)
                    </h2>
                    <div class="brand-tagline">Layanan Solusi Percetakan Digital, Offset, Sablon & Advertising Komersial</div>
                    <div class="brand-contact">
                        Workshop & Loket: Jl. Percetakan Utama No. 88, Kota Solusindo<br>
                        Telp: (021) 7890-1234 | WhatsApp Resmi: 0812-3456-7890 | Email: finance@gilarmedia.com<br>
                        NIB: 9120004512034 | NPWP Badan Usaha: 82.910.456.7-012.000 | Website: gilarmedia.com
                    </div>
                </div>
                <div class="financial-doc-meta">
                    <h3>LAPORAN KEUANGAN & ARUS KAS</h3>
                    <p><strong>No. Dokumen:</strong> ${docNumber}</p>
                    <p><strong>Periode Buku:</strong> ${periodLabel}</p>
                    <p><strong>Tanggal Cetak:</strong> ${printDateFormatted}</p>
                    <p><strong>Otorisasi:</strong> Bapak Hendra (Master Admin)</p>
                </div>
            </div>

            <div class="financial-divider-double"></div>

            ${isOverride ? `
            <div style="background:#f5f3ff; border:1px solid #c4b5fd; border-radius:6px; padding:6px 12px; margin-bottom:12px; font-size:8pt; color:#5b21b6; font-weight:700; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-certificate"></i>
                <span>Catatan Dokumen: Angka Finansial Disajikan Berdasarkan Penyesuaian Akuntansi Master Admin Toko (Otorisasi Pemilik Percetakan).</span>
            </div>
            ` : ''}

            <!-- Bagian 1: Ringkasan Eksekutif Finansial -->
            <div class="financial-section-title">
                <i class="fas fa-chart-pie" style="color:#4f46e5;"></i> I. Ringkasan Eksekutif Finansial & Likuiditas Kas
            </div>
            <div class="financial-kpi-grid">
                <div class="financial-kpi-card kpi-rev">
                    <span class="kpi-label">Total Omset Bruto (Nilai Pesanan)</span>
                    <span class="kpi-val">${formatRupiah(totalRevenue)}</span>
                    <span class="kpi-sub"><i class="fas fa-coins"></i> Nilai bruto seluruh pesanan masuk</span>
                </div>
                <div class="financial-kpi-card kpi-cash">
                    <span class="kpi-label">Kas Masuk Nyata (Real Cash In)</span>
                    <span class="kpi-val" style="color:#16a34a;">${formatRupiah(realCashIn)}</span>
                    <span class="kpi-sub"><i class="fas fa-check-double"></i> Uang riil diterima (Lunas 100% + DP 50%)</span>
                </div>
                <div class="financial-kpi-card kpi-rem">
                    <span class="kpi-label">Sisa Piutang DP (Belum Lunas)</span>
                    <span class="kpi-val" style="color:#d97706;">${formatRupiah(pendingBalance)}</span>
                    <span class="kpi-sub"><i class="fas fa-hourglass-half"></i> Tagihan ditagih saat serah terima cetak</span>
                </div>
                <div class="financial-kpi-card kpi-orders">
                    <span class="kpi-label">Volume & Average Order Value (AOV)</span>
                    <span class="kpi-val" style="color:#0891b2;">${totalOrdersCount} Pesanan</span>
                    <span class="kpi-sub"><i class="fas fa-calculator"></i> Rata-rata per order: ${formatRupiah(aov)}</span>
                </div>
            </div>

            <!-- Bagian 2: Komparasi Saluran Penjualan & Realisasi Pembayaran -->
            <div class="financial-section-title">
                <i class="fas fa-balance-scale" style="color:#4f46e5;"></i> II. Komparasi Saluran Penjualan & Saluran Penerimaan Kas
            </div>
            <div class="financial-comparison-grid">
                <div class="financial-comparison-box">
                    <h4><i class="fas fa-store"></i> Kontribusi Saluran Penjualan</h4>
                    <div class="financial-channel-row">
                        <span>Toko Offline (Kasir Walk-In) [${offlineOrders.length} pesanan]</span>
                        <strong>${formatRupiah(offlineRev)} (${offlinePct}%)</strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Toko Online (Digital Web Store) [${onlineOrders.length} pesanan]</span>
                        <strong>${formatRupiah(onlineRev)} (${onlinePct}%)</strong>
                    </div>
                    <div class="financial-channel-row" style="font-weight:800; border-top:1px solid #cbd5e1; margin-top:4px; padding-top:4px;">
                        <span>Total Akumulasi Seluruh Saluran</span>
                        <strong>${formatRupiah(totalRevenue)} (100%)</strong>
                    </div>
                </div>

                <div class="financial-comparison-box">
                    <h4><i class="fas fa-wallet"></i> Realisasi Saluran Pembayaran (Kas Masuk)</h4>
                    <div class="financial-channel-row">
                        <span>QRIS Digital (Scan QR)</span>
                        <strong>${formatRupiah(qris.total)} <span style="font-size:0.72rem; color:#64748b;">(${qris.count} trx - ${qris.pct}%)</span></strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Tunai / Cash Kasir Walk-In</span>
                        <strong>${formatRupiah(cash.total)} <span style="font-size:0.72rem; color:#64748b;">(${cash.count} trx - ${cash.pct}%)</span></strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Transfer Bank Virtual</span>
                        <strong>${formatRupiah(bank.total)} <span style="font-size:0.72rem; color:#64748b;">(${bank.count} trx - ${bank.pct}%)</span></strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Saldo E-Wallet (DANA/OVO/GoPay)</span>
                        <strong>${formatRupiah(ewallet.total)} <span style="font-size:0.72rem; color:#64748b;">(${ewallet.count} trx - ${ewallet.pct}%)</span></strong>
                    </div>
                </div>
            </div>

            <!-- Bagian 3: Rekonsiliasi Kas Laci Fisik & Modal Pemilik -->
            <div class="financial-section-title">
                <i class="fas fa-cash-register" style="color:#4f46e5;"></i> III. Rekonsiliasi Arus Kas Laci Fisik Toko (Modal Pemilik & Uang Toko)
            </div>
            <div class="financial-comparison-grid">
                <div class="financial-comparison-box">
                    <h4><i class="fas fa-coins"></i> Perhitungan Uang Fisik di Laci Kasir</h4>
                    <div class="financial-channel-row">
                        <span>Modal Awal Uang Kembalian (Pemilik)</span>
                        <strong style="color:#4f46e5;">${formatRupiah(initialFloat)}</strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Penerimaan Kas Tunai dari Pelanggan (Nota)</span>
                        <strong style="color:#16a34a;">+${formatRupiah(cashSales)}</strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Kas Masuk Manual / Tambahan Suntikan</span>
                        <strong style="color:#0891b2;">+${formatRupiah(cashInManual)}</strong>
                    </div>
                    <div class="financial-channel-row">
                        <span>Pengeluaran Kas Kecil Operasional Toko</span>
                        <strong style="color:#dc2626;">-${formatRupiah(cashOutManual)}</strong>
                    </div>
                    <div class="financial-channel-row" style="font-weight:900; border-top:1.5px solid #0f172a; margin-top:4px; padding-top:4px;">
                        <span style="text-transform:uppercase;">Total Saldo Uang Fisik di Laci:</span>
                        <strong style="color:#16a34a; font-size:0.95rem;">${formatRupiah(totalCashInDrawer)}</strong>
                    </div>
                </div>

                <div class="financial-comparison-box">
                    <h4><i class="fas fa-info-circle"></i> Catatan Pemisahan Omset vs Modal</h4>
                    <p style="font-size:0.75rem; color:#475569; margin:0 0 0.5rem 0; line-height:1.45;">
                        Sistem memisahkan secara ketat antara <strong>Omset Hasil Penjualan Cetak (${formatRupiah(totalRevenue)})</strong> dengan <strong>Uang Modal Kembalian dari Pemilik (${formatRupiah(initialFloat)})</strong> agar pembukuan tidak rancu.
                    </p>
                    <div style="font-size:0.72rem; color:#334155; background:#fff; padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1;">
                        <strong>Status Kasir:</strong> Total uang tunai fisik yang wajib ada di laci saat dihitung adalah sebesar <strong>${formatRupiah(totalCashInDrawer)}</strong>.
                    </div>
                </div>
            </div>

            <!-- Bagian 4: Buku Jurnal Transaksi Masuk -->
            <div class="financial-section-title">
                <i class="fas fa-table" style="color:#4f46e5;"></i> IV. Buku Pembantu Jurnal Transaksi Masuk (Periode: ${periodLabel})
            </div>
            <table class="financial-table">
                <thead>
                    <tr>
                        <th class="th-center" style="width:30px;">No</th>
                        <th style="min-width:110px;">No. Order & Waktu</th>
                        <th style="min-width:130px;">Pelanggan & Kontak</th>
                        <th class="th-center" style="width:65px;">Saluran</th>
                        <th>Rincian Item Cetak</th>
                        <th class="th-num" style="min-width:85px;">Total Nilai</th>
                        <th class="th-num" style="min-width:85px;">Kas Diterima</th>
                        <th class="th-num" style="min-width:85px;">Sisa Piutang</th>
                        <th class="th-center" style="width:90px;">Status Bayar</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredOrders.length === 0 ? `
                        <tr>
                            <td colspan="9" style="text-align:center; padding:1.5rem; color:#64748b;">
                                Tidak ada data transaksi pada periode yang dipilih.
                            </td>
                        </tr>
                    ` : filteredOrders.map((o, idx) => {
                        const pStatus = o.paymentStatus || (o.paymentType === 'dp' ? 'dp_dibayar' : 'lunas');
                        const total = o.total || 0;
                        const paid = o.amountPaid !== undefined ? o.amountPaid : (pStatus === 'dp_dibayar' ? Math.round(total * 0.5) : total);
                        const rem = o.remainingBalance !== undefined ? o.remainingBalance : (pStatus === 'dp_dibayar' ? (total - paid) : 0);
                        const itemsSummary = (o.items || []).map(it => `${it.name} (${it.quantity}x)`).join(', ');

                        let badgeColor = '#16a34a';
                        let badgeText = 'LUNAS';
                        if (pStatus === 'dp_dibayar' || rem > 0) {
                            badgeColor = '#d97706';
                            badgeText = 'DP 50%';
                        } else if (pStatus === 'belum_bayar') {
                            badgeColor = '#dc2626';
                            badgeText = 'BELUM';
                        }

                        return `
                            <tr>
                                <td class="td-center">${idx + 1}</td>
                                <td>
                                    <strong style="font-family:var(--font-mono); font-size:0.75rem; color:#0f172a;">${Security.sanitizeHTML(o.id)}</strong>
                                    <div style="font-size:0.68rem; color:#64748b;">${formatDateTime(o.createdAt)}</div>
                                </td>
                                <td>
                                    <div style="font-weight:700; color:#0f172a;">${Security.sanitizeHTML(o.customer ? o.customer.name : 'Walk-In')}</div>
                                    <div style="font-size:0.68rem; color:#64748b;">${Security.sanitizeHTML(o.customer && o.customer.phone ? o.customer.phone : '-')}</div>
                                </td>
                                <td class="td-center">
                                    <span style="font-size:0.68rem; font-weight:700; padding:2px 5px; border-radius:3px; background:${o.channel === 'online' ? '#e0e7ff' : '#fef3c7'}; color:${o.channel === 'online' ? '#3730a3' : '#92400e'};">
                                        ${(o.channel || 'OFFLINE').toUpperCase()}
                                    </span>
                                </td>
                                <td style="font-size:0.74rem;">${Security.sanitizeHTML(itemsSummary) || '-'}</td>
                                <td class="td-num"><strong>${formatRupiah(total)}</strong></td>
                                <td class="td-num" style="color:#16a34a; font-weight:700;">${formatRupiah(paid)}</td>
                                <td class="td-num" style="color:${rem > 0 ? '#d97706' : '#64748b'}; font-weight:${rem > 0 ? '700' : 'normal'};">${formatRupiah(rem)}</td>
                                <td class="td-center">
                                    <span style="display:inline-block; font-size:0.68rem; font-weight:800; color:${badgeColor}; border:1px solid ${badgeColor}; padding:1px 6px; border-radius:3px;">
                                        ${badgeText}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" style="text-align:right; text-transform:uppercase; font-size:0.76rem;">Total Akumulasi Rekapitulasi:</td>
                        <td class="td-num"><strong>${formatRupiah(totalRevenue)}</strong></td>
                        <td class="td-num" style="color:#16a34a;"><strong>${formatRupiah(realCashIn)}</strong></td>
                        <td class="td-num" style="color:#d97706;"><strong>${formatRupiah(pendingBalance)}</strong></td>
                        <td class="td-center" style="font-size:0.72rem; color:#475569;">${totalOrdersCount} Trx</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Bagian 4: Pengesahan & Tanda Tangan Resmi -->
            <div class="financial-signatures">
                <div class="financial-sig-box">
                    <div class="sig-title">Disiapkan & Dibuat Oleh:</div>
                    <div class="sig-name">Admin Keuangan & Kasir</div>
                    <div class="sig-role">Percetakan Gilar Media</div>
                </div>
                <div class="financial-sig-box">
                    <div class="sig-title">Diperiksa & Disahkan Oleh:</div>
                    <div class="sig-name">Bapak Hendra</div>
                    <div class="sig-role">Pemilik Percetakan / Direktur Operasional</div>
                </div>
            </div>

            <!-- Catatan Kaki & Hak Cipta -->
            <div class="financial-footer-disclaimer">
                <span>Dokumen ini dicetak otomatis secara sah oleh Sistem Manajemen Percetakan Gilar Media.</span>
                <span>Waktu Sinkronisasi Database: ${printDateFormatted}</span>
            </div>
        `;
    }

    // ─── 3.2. Catat Pelunasan Sisa DP (Endpoint POST /api/orders/settle-payment) ───
    async function settleOrderPayment(orderId) {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const found = allOrders.find(o => o.id === orderId);
        const rem = found ? (found.remainingBalance || Math.round((found.total || 0) * 0.5)) : 0;

        if (!confirm(`Konfirmasi pelunasan sisa pembayaran sebesar ${formatRupiah(rem)} untuk pesanan ${orderId}?\n\nSetelah dikonfirmasi, status pesanan akan menjadi LUNAS 100%.`)) {
            return;
        }

        try {
            const res = await fetch('/api/orders/settle-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
            const data = await res.json();

            if (data.success && data.order) {
                // Update local storage
                const updatedOrders = allOrders.map(o => o.id === orderId ? data.order : o);
                Security.safeSetStorage('dm_all_orders', updatedOrders);

                UI.showToast('Pelunasan Berhasil', data.message || `Pesanan ${orderId} telah LUNAS!`, 'success');

                // Re-render analytics and tables
                renderFinancialAnalytics();
                renderAllOrdersTable();

                // If invoice modal is open, refresh it
                const invoiceModal = document.getElementById('admin-invoice-modal');
                if (invoiceModal && invoiceModal.classList.contains('active')) {
                    openInvoiceModal(orderId);
                }
            } else {
                UI.showToast('Gagal Pelunasan', data.message || 'Terjadi kesalahan sistem.', 'error');
            }
        } catch (err) {
            console.error('Settle DP error:', err);
            UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database.', 'error');
        }
    }

    // ─── 3.3. Setup Event Listeners untuk Tabel & Filter ───
    // ─── 3.2. Modal Verifikasi Bukti Pembayaran (Bukti Transfer / QRIS) ───
    function openPaymentProofModal(orderId) {
        const allOrders = Security.safeGetStorage('dm_all_orders') || [];
        const o = allOrders.find(item => item.id === orderId);

        if (!o) {
            UI.showToast('Data Tidak Ditemukan', `Pesanan ${orderId} tidak ditemukan.`, 'error');
            return;
        }

        activeProofOrderId = orderId;

        // Populate elements
        const orderIdEl = document.getElementById('proof-modal-order-id');
        const custNameEl = document.getElementById('proof-modal-cust-name');
        const custPhoneEl = document.getElementById('proof-modal-cust-phone');
        const methodEl = document.getElementById('proof-modal-payment-method');
        const amountEl = document.getElementById('proof-modal-amount-due');
        const imgEl = document.getElementById('proof-modal-image');
        const noImgEl = document.getElementById('proof-modal-no-img');
        const timeEl = document.getElementById('proof-modal-timestamp');
        const noteEl = document.getElementById('proof-modal-note');

        if (orderIdEl) orderIdEl.textContent = o.id;
        if (custNameEl) custNameEl.textContent = o.customer ? o.customer.name : 'Pelanggan Walk-In';
        if (custPhoneEl) custPhoneEl.textContent = o.customer ? (o.customer.phone || '-') : '-';
        if (methodEl) methodEl.textContent = (getPaymentMethodLabel(o.paymentMethod)) + (o.paymentType === 'dp' ? ' [DP 50%]' : ' [Lunas 100%]');

        const total = o.total || 0;
        const due = o.paymentType === 'dp' ? Math.round(total * 0.5) : total;
        if (amountEl) amountEl.textContent = formatRupiah(due) + (o.paymentType === 'dp' ? ' (DP 50%)' : ' (Lunas)');

        if (o.paymentProof && o.paymentProof.image) {
            if (imgEl) {
                imgEl.src = o.paymentProof.image;
                imgEl.style.display = 'block';
            }
            if (noImgEl) noImgEl.style.display = 'none';
            if (timeEl) timeEl.innerHTML = `<i class="far fa-clock"></i> Diunggah pada: ${formatDateTime(o.paymentProof.uploadedAt)}`;
            if (noteEl) noteEl.textContent = o.paymentProof.note || 'Tidak ada catatan tambahan';
        } else {
            if (imgEl) {
                imgEl.src = '';
                imgEl.style.display = 'none';
            }
            if (noImgEl) noImgEl.style.display = 'block';
            if (timeEl) timeEl.textContent = 'Belum ada bukti pembayaran terlampir';
            if (noteEl) noteEl.textContent = 'Pelanggan belum mengunggah struk transfer';
        }

        UI.openModal('admin-payment-proof-modal');
    }

    // ─── 3.2.1. Eksekusi Verifikasi Pembayaran (Approve / Reject) ───
    async function verifyOrderPayment(orderId, action, rejectReason = '') {
        const actionLabel = action === 'approve' ? 'menyetujui & ACC' : 'menolak';
        if (!confirm(`Apakah Anda yakin ingin ${actionLabel} bukti pembayaran untuk pesanan ${orderId}?`)) {
            return;
        }

        try {
            const res = await fetch('/api/orders/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    action,
                    rejectReason,
                    verifiedBy: 'Bapak Hendra (Master Admin)'
                })
            });
            const data = await res.json();

            if (data.success) {
                UI.showToast(
                    action === 'approve' ? 'Pembayaran Disetujui! ✅' : 'Bukti Ditolak ❌',
                    data.message || 'Status pembayaran berhasil diperbarui.',
                    action === 'approve' ? 'success' : 'warning'
                );

                UI.closeModal('admin-payment-proof-modal');

                // Sinkronkan ulang orders dari server
                await syncOrdersFromServer();
                renderFinancialAnalytics();
                renderAllOrdersTable();
            } else {
                UI.showToast('Gagal Verifikasi', data.message || 'Terjadi kesalahan sistem.', 'error');
            }
        } catch (err) {
            console.error('Verify payment error:', err);
            UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database.', 'error');
        }
    }

        function setupOrderTableEvents() {
        const approveBtn = document.getElementById('btn-proof-modal-approve');
        if (approveBtn) {
            approveBtn.addEventListener('click', () => {
                if (activeProofOrderId) {
                    verifyOrderPayment(activeProofOrderId, 'approve');
                }
            });
        }

        const rejectBtn = document.getElementById('btn-proof-modal-reject');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => {
                if (activeProofOrderId) {
                    const reason = prompt('Masukkan alasan penolakan bukti transfer:', 'Nominal transfer tidak sesuai / mutasi bank belum tertera');
                    if (reason !== null && reason.trim()) {
                        verifyOrderPayment(activeProofOrderId, 'reject', reason.trim());
                    }
                }
            });
        }
        const periodSelect = document.getElementById('admin-revenue-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                renderFinancialAnalytics();
            });
        }

        const searchInput = document.getElementById('admin-order-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderAllOrdersTable();
            });
        }

        const payStatusFilter = document.getElementById('admin-order-filter-pay');
        if (payStatusFilter) {
            payStatusFilter.addEventListener('change', () => {
                renderAllOrdersTable();
            });
        }

        const channelFilter = document.getElementById('admin-order-filter-channel');
        if (channelFilter) {
            channelFilter.addEventListener('change', () => {
                renderAllOrdersTable();
            });
        }

        // Print Invoice Action button
        const printInvBtn = document.getElementById('btn-print-invoice-action');
        if (printInvBtn) {
            printInvBtn.addEventListener('click', () => {
                document.body.classList.add('print-invoice');
                document.body.classList.remove('print-recap');
                window.print();
            });
        }

        // Cetak Rekapan Keuangan
        const printFinancialBtn = document.getElementById('btn-print-financial-recap');
        if (printFinancialBtn) {
            printFinancialBtn.addEventListener('click', () => {
                openFinancialRecapModal();
            });
        }

        // Cetak Daftar Transaksi
        const printOrdersBtn = document.getElementById('btn-print-orders-table');
        if (printOrdersBtn) {
            printOrdersBtn.addEventListener('click', () => {
                openFinancialRecapModal();
            });
        }

        window.addEventListener('afterprint', () => {
            document.body.classList.remove('print-recap', 'print-invoice');
        });
    }

    // ─── Helper Formatter ───
    function formatDateTime(isoStr) {
        if (!isoStr) return '-';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) + ', ' + d.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        }) + ' WIB';
    }

    function getPaymentMethodLabel(method) {
        if (!method) return 'QRIS Digital';
        const m = method.toLowerCase();
        if (m === 'qris') return 'QRIS Digital (Scan QR)';
        if (m === 'tunai' || m === 'cash') return 'Tunai / Cash Kasir';
        if (m === 'cod') return 'COD (Bayar Tunai saat Ambil)';
        if (m === 'transfer') return 'Transfer Bank Virtual';
        if (m === 'ewallet') return 'Saldo E-Wallet (DANA/OVO/GoPay)';
        return method.toUpperCase();
    }

    // ─── 3.5. Manajemen Kategori Layanan Cetak (data/categories.json) ───
    async function syncCategoriesFromServer() {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if (data.success && Array.isArray(data.categories)) {
                cachedCategories = data.categories;
                return cachedCategories;
            }
        } catch (err) {
            console.warn('Error fetching categories:', err);
        }
        return cachedCategories;
    }

    async function renderCategoryManager() {
        await syncCategoriesFromServer();
        const pillsContainer = document.getElementById('admin-category-pills');
        const newProdCatSelect = document.getElementById('new-prod-cat');
        const editProdCatSelect = document.getElementById('edit-prod-cat');

        if (pillsContainer) {
            if (cachedCategories.length === 0) {
                pillsContainer.innerHTML = `<small style="color:var(--text-tertiary);">Belum ada kategori aktif</small>`;
            } else {
                pillsContainer.innerHTML = cachedCategories.map(cat => `
                    <div class="cat-pill" data-id="${cat.id}">
                        <i class="${cat.icon || 'fas fa-tag'}" style="color:var(--accent-start);"></i>
                        <strong style="color:var(--text-primary); text-transform:uppercase;">${Security.sanitizeHTML(cat.name)}</strong>
                        <span class="cat-count" title="${cat.count || 0} produk">${cat.count || 0}</span>
                        <button type="button" class="btn-cat-action btn-edit-cat" data-id="${cat.id}" data-name="${Security.sanitizeHTML(cat.name)}" data-icon="${cat.icon || ''}" title="Edit / Ganti Nama Kategori">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-cat-action btn-del-cat" data-id="${cat.id}" data-name="${Security.sanitizeHTML(cat.name)}" data-count="${cat.count || 0}" title="Hapus Kategori">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `).join('');

                // Edit category button
                pillsContainer.querySelectorAll('.btn-edit-cat').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = btn.getAttribute('data-id');
                        const name = btn.getAttribute('data-name');
                        const icon = btn.getAttribute('data-icon') || 'fas fa-tags';
                        openCategoryModal('edit', { id, name, icon });
                    });
                });

                // Delete category button
                pillsContainer.querySelectorAll('.btn-del-cat').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const id = btn.getAttribute('data-id');
                        const name = btn.getAttribute('data-name');
                        const count = parseInt(btn.getAttribute('data-count'), 10) || 0;

                        const msg = count > 0 
                            ? `Yakin ingin menghapus kategori '${name}'? Terdapat ${count} produk dalam kategori ini yang akan dialihkan ke kategori 'UMUM'.`
                            : `Yakin ingin menghapus kategori '${name}'?`;

                        if (confirm(msg)) {
                            await deleteCategory(id);
                        }
                    });
                });
            }
        }

        // Populate selects
        const optionsHTML = cachedCategories.map(c => 
            `<option value="${c.id}">${Security.sanitizeHTML(c.name)} (${c.id.toUpperCase()})</option>`
        ).join('');

        if (newProdCatSelect) {
            const currentVal = newProdCatSelect.value;
            newProdCatSelect.innerHTML = optionsHTML;
            if (currentVal && cachedCategories.some(c => c.id === currentVal)) {
                newProdCatSelect.value = currentVal;
            }
        }

        if (editProdCatSelect) {
            const currentVal = editProdCatSelect.value;
            editProdCatSelect.innerHTML = optionsHTML;
            if (currentVal && cachedCategories.some(c => c.id === currentVal)) {
                editProdCatSelect.value = currentVal;
            }
        }
    }

    function openCategoryModal(action, data = {}) {
        const titleEl = document.getElementById('cat-modal-title');
        const actionInput = document.getElementById('cat-action');
        const oldIdInput = document.getElementById('cat-old-id');
        const nameInput = document.getElementById('cat-name-input');
        const idInput = document.getElementById('cat-id-input');
        const iconSelect = document.getElementById('cat-icon-input');
        const submitBtn = document.getElementById('cat-modal-submit-btn');

        if (actionInput) actionInput.value = action;
        if (action === 'edit') {
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-edit" style="color:var(--accent-start)"></i> Edit Kategori '${data.name}'`;
            if (oldIdInput) oldIdInput.value = data.id;
            if (nameInput) nameInput.value = data.name;
            if (idInput) idInput.value = data.id;
            if (iconSelect && data.icon) iconSelect.value = data.icon;
            if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-save"></i> Simpan Perubahan Kategori`;
        } else {
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-layer-group" style="color:var(--accent-start)"></i> Tambah Kategori Baru`;
            if (oldIdInput) oldIdInput.value = '';
            if (nameInput) nameInput.value = '';
            if (idInput) idInput.value = '';
            if (iconSelect) iconSelect.value = 'fas fa-tags';
            if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Tambah Kategori`;
        }

        UI.openModal('admin-category-modal');
    }

    async function deleteCategory(catId) {
        try {
            const res = await fetch('/api/categories/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: catId, reassignTo: 'umum' })
            });
            const data = await res.json();
            if (data.success) {
                UI.showToast('Kategori Dihapus 🗑️', data.message, 'success');
                Security.logAuditEvent('CATEGORY_DELETED', `Admin deleted category '${catId}'`);
                Security.safeSetStorage('dm_sync_event', { event: 'category_deleted', at: Date.now() });
                await renderCategoryManager();
                await renderProductsManagement();
            } else {
                UI.showToast('Gagal Menghapus', data.message || 'Terjadi kesalahan di server', 'error');
            }
        } catch (err) {
            UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
        }
    }

    function setupCategoryEvents() {
        const addCatBtn = document.getElementById('btn-open-add-cat-modal');
        if (addCatBtn) {
            addCatBtn.addEventListener('click', () => {
                openCategoryModal('add');
            });
        }

        const catForm = document.getElementById('admin-category-form');
        if (catForm) {
            catForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const action = document.getElementById('cat-action').value;
                const oldId = document.getElementById('cat-old-id').value;
                const name = document.getElementById('cat-name-input').value.trim();
                const newId = document.getElementById('cat-id-input').value.trim();
                const icon = document.getElementById('cat-icon-input').value;

                if (!name) {
                    UI.showToast('Peringatan', 'Nama kategori wajib diisi!', 'warning');
                    return;
                }

                try {
                    let res, data;
                    if (action === 'edit') {
                        res = await fetch('/api/categories/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oldId, name, newId, icon })
                        });
                    } else {
                        res = await fetch('/api/categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, id: newId, icon })
                        });
                    }

                    data = await res.json();
                    if (data.success) {
                        UI.showToast(action === 'edit' ? 'Kategori Diperbarui! 🏷️' : 'Kategori Ditambahkan! 🏷️', data.message, 'success');
                        Security.logAuditEvent(action === 'edit' ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED', `Admin ${action} category '${name}'`);
                        Security.safeSetStorage('dm_sync_event', { event: 'category_changed', at: Date.now() });
                        UI.closeModal('admin-category-modal');
                        catForm.reset();
                        await renderCategoryManager();
                        await renderProductsManagement();
                    } else {
                        UI.showToast('Gagal Simpan', data.message || 'Terjadi kesalahan', 'error');
                    }
                } catch (err) {
                    UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
                }
            });
        }
    }

    // ─── 4. Manajemen Produk & Pengaturan Harga Toko (data/products.json) ───
    async function renderProductsManagement() {
        const tbody = document.getElementById('admin-products-tbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            cachedProducts = (data.success && Array.isArray(data.products)) ? data.products : [];

            if (cachedProducts.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-tertiary);">Belum ada produk di database</td></tr>`;
                return;
            }

            tbody.innerHTML = cachedProducts.map(p => `
                <tr data-prod-id="${p.id}">
                    <td>
                        <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&h=100&fit=crop'}" 
                             alt="${Security.sanitizeHTML(p.name)}" 
                             style="width:48px; height:48px; border-radius:var(--radius-md); object-fit:cover; border:1px solid var(--border-color);">
                    </td>
                    <td>
                        <strong>${Security.sanitizeHTML(p.name)}</strong>
                        ${p.badge ? `<span class="badge badge-${p.badge}" style="margin-left:0.4rem; font-size:0.7rem;">${p.badge.toUpperCase()}</span>` : ''}
                        <br><small style="color:var(--text-secondary);">${Security.sanitizeHTML(p.description || '')}</small>
                    </td>
                    <td>
                        <span class="badge btn-quick-cat" data-id="${p.id}" style="background:var(--bg-tertiary); color:var(--text-primary); cursor:pointer; font-weight:700;" title="Klik untuk ubah data & kategori produk">
                            ${Security.sanitizeHTML(p.category ? p.category.toUpperCase() : 'UMUM')}
                        </span>
                    </td>
                    <td><strong>${Security.sanitizeHTML(p.type || 'pcs')}</strong> (${Security.sanitizeHTML(p.unit || 'pcs')})</td>
                    <td>
                        <strong style="color:var(--accent-start); font-size:1.05rem; font-weight:800;">
                            ${formatRupiah(p.pricePerUnit || 0)}
                        </strong>
                        <small style="color:var(--text-tertiary);">/${Security.sanitizeHTML(p.unit || 'pcs')}</small>
                    </td>
                    <td><small><i class="fas fa-stopwatch" style="color:var(--accent-start)"></i> ${Security.sanitizeHTML(p.productionTime || '1 - 2 Jam')}</small></td>
                    <td>
                        <div style="display:flex; gap:0.4rem;">
                            <button type="button" class="btn btn-sm btn-outline btn-edit-prod-price" data-id="${p.id}" title="Ubah Data, Harga & Kategori">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button type="button" class="btn btn-sm btn-danger btn-del-prod" data-id="${p.id}" title="Hapus Produk">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Attach edit button clicks
            tbody.querySelectorAll('.btn-edit-prod-price, .btn-quick-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    openEditPriceModal(id);
                });
            });

            // Attach delete button clicks
            tbody.querySelectorAll('.btn-del-prod').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const prod = cachedProducts.find(p => p.id === id);
                    const prodName = prod ? prod.name : id;
                    if (confirm(`Yakin ingin menghapus produk '${prodName}' dari katalog toko?`)) {
                        await deleteProduct(id);
                    }
                });
            });
        } catch (err) {
            console.error('Error fetching products for admin:', err);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> Gagal menghubungkan ke database produk</td></tr>`;
        }
    }

    function openEditPriceModal(productId) {
        const prod = cachedProducts.find(p => p.id === productId);
        if (!prod) return;

        document.getElementById('edit-prod-id').value = prod.id;
        document.getElementById('edit-prod-name').value = prod.name;
        document.getElementById('edit-prod-price').value = prod.pricePerUnit;
        document.getElementById('edit-prod-unit').value = prod.unit;
        document.getElementById('edit-prod-time').value = prod.productionTime || '1 - 2 Jam';
        document.getElementById('edit-prod-desc').value = prod.description || '';

        const catSelect = document.getElementById('edit-prod-cat');
        if (catSelect && cachedCategories.length > 0) {
            catSelect.innerHTML = cachedCategories.map(c => 
                `<option value="${c.id}" ${c.id === (prod.category || '').toLowerCase() ? 'selected' : ''}>${Security.sanitizeHTML(c.name)} (${c.id.toUpperCase()})</option>`
            ).join('');
        }

        const badgeSelect = document.getElementById('edit-prod-badge');
        if (badgeSelect) {
            badgeSelect.value = prod.badge || '';
        }

        UI.openModal('admin-edit-price-modal');
    }

    async function deleteProduct(productId) {
        try {
            const res = await fetch('/api/products/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId })
            });
            const data = await res.json();
            if (data.success) {
                UI.showToast('Produk Dihapus 🗑️', data.message, 'success');
                Security.logAuditEvent('PRODUCT_DELETED', `Admin deleted product '${productId}'`);
                Security.safeSetStorage('dm_sync_event', { event: 'product_deleted', at: Date.now() });
                await renderCategoryManager();
                await renderProductsManagement();
            } else {
                UI.showToast('Gagal Menghapus', data.message, 'error');
            }
        } catch (err) {
            UI.showToast('Kesalahan Jaringan', 'Tidak dapat menghapus produk', 'error');
        }
    }

    function setupProductManagementEvents() {
        // Toggle add product box
        const toggleBtn = document.getElementById('btn-toggle-add-product');
        const addBox = document.getElementById('admin-add-product-box');
        const cancelBtn = document.getElementById('btn-cancel-add-prod');

        if (toggleBtn && addBox) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = addBox.style.display === 'none';
                addBox.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    document.getElementById('new-prod-name').focus();
                }
            });
        }

        if (cancelBtn && addBox) {
            cancelBtn.addEventListener('click', () => {
                addBox.style.display = 'none';
                document.getElementById('admin-add-product-form').reset();
            });
        }

        // Add Product Form submit
        const addForm = document.getElementById('admin-add-product-form');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('new-prod-name').value.trim();
                const category = document.getElementById('new-prod-cat').value;
                const type = document.getElementById('new-prod-type').value;
                const pricePerUnit = parseInt(document.getElementById('new-prod-price').value, 10);
                const unit = document.getElementById('new-prod-unit').value.trim();
                const productionTime = document.getElementById('new-prod-time').value.trim();
                const badge = document.getElementById('new-prod-badge').value;
                const description = document.getElementById('new-prod-desc').value.trim();
                const imageUrl = document.getElementById('new-prod-img').value.trim();

                if (!name || isNaN(pricePerUnit) || pricePerUnit <= 0) {
                    UI.showToast('Peringatan', 'Harap isi nama dan harga satuan produk!', 'warning');
                    return;
                }

                try {
                    const res = await fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name,
                            category,
                            type,
                            pricePerUnit,
                            unit,
                            productionTime,
                            badge,
                            description,
                            imageUrl
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        UI.showToast('Produk Tersimpan! 🛒', data.message, 'success');
                        Security.logAuditEvent('PRODUCT_CREATED', `Admin added new product '${name}' @ Rp ${pricePerUnit}`);
                        Security.safeSetStorage('dm_sync_event', { event: 'product_added', at: Date.now() });
                        addForm.reset();
                        addBox.style.display = 'none';
                        await renderCategoryManager();
                        await renderProductsManagement();
                    } else {
                        UI.showToast('Gagal Menambah Produk', data.message, 'error');
                    }
                } catch (err) {
                    UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
                }
            });
        }

        // Edit Product & Category Form submit
        const editForm = document.getElementById('admin-edit-price-form');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-prod-id').value;
                const name = document.getElementById('edit-prod-name').value.trim();
                const catEl = document.getElementById('edit-prod-cat');
                const badgeEl = document.getElementById('edit-prod-badge');
                const category = catEl ? catEl.value : '';
                const badge = badgeEl ? badgeEl.value : '';
                const pricePerUnit = parseInt(document.getElementById('edit-prod-price').value, 10);
                const unit = document.getElementById('edit-prod-unit').value.trim();
                const productionTime = document.getElementById('edit-prod-time').value.trim();
                const description = document.getElementById('edit-prod-desc').value.trim();

                if (!id || isNaN(pricePerUnit) || pricePerUnit <= 0) {
                    UI.showToast('Peringatan', 'Harga satuan harus berupa angka valid!', 'warning');
                    return;
                }

                try {
                    const res = await fetch('/api/products/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id,
                            name,
                            category,
                            badge,
                            pricePerUnit,
                            unit,
                            productionTime,
                            description
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        UI.showToast('Produk & Kategori Diperbarui! 💰', data.message, 'success');
                        Security.logAuditEvent('PRODUCT_UPDATED', `Admin updated product '${id}' (Kategori: ${category}, Harga: Rp ${pricePerUnit})`);
                        UI.closeModal('admin-edit-price-modal');
                        await renderCategoryManager();
                        await renderProductsManagement();
                    } else {
                        UI.showToast('Gagal Update', data.message, 'error');
                    }
                } catch (err) {
                    UI.showToast('Kesalahan Jaringan', 'Tidak dapat update harga ke database', 'error');
                }
            });
        }
    }

    // ─── 5. Inventori Bahan Baku Percetakan ───
    function getInventory() {
        const stored = Security.safeGetStorage('dm_inventory');
        if (Array.isArray(stored) && stored.length > 0) return stored;
        Security.safeSetStorage('dm_inventory', DEFAULT_INVENTORY);
        return DEFAULT_INVENTORY;
    }

    async function renderMaterialsInventory() {
        const tbody = document.getElementById('admin-inventory-tbody');
        if (!tbody) return;

        // Sinkronisasi inventori terkini dari server
        let inventory = getInventory();
        try {
            const res = await fetch('/api/inventory');
            const data = await res.json();
            if (data.success && Array.isArray(data.inventory) && data.inventory.length > 0) {
                inventory = data.inventory;
                Security.safeSetStorage('dm_inventory', inventory);
            }
        } catch (e) {
            // Gunakan fallback lokal jika server offline
        }

        tbody.innerHTML = inventory.map(item => {
            const isLow = item.stock <= item.minStock;
            return `
                <tr style="${isLow ? 'background: rgba(239, 68, 68, 0.04);' : ''}">
                    <td>
                        <strong>${Security.sanitizeHTML(item.name)}</strong>
                        ${isLow ? '<span class="badge badge-hot" style="margin-left:0.5rem;"><i class="fas fa-exclamation-triangle"></i> STOK KRITIS</span>' : ''}
                    </td>
                    <td>${Security.sanitizeHTML(item.unit)}</td>
                    <td>
                        <strong style="font-size: 1.05rem; color: ${isLow ? 'var(--danger)' : 'var(--text-primary)'};">
                            ${item.stock}
                        </strong>
                    </td>
                    <td style="color: var(--text-tertiary);">${item.minStock} ${Security.sanitizeHTML(item.unit)}</td>
                    <td>
                        <div class="restock-action-group">
                            <input type="number" 
                                   class="restock-qty-input" 
                                   data-id="${item.id}" 
                                   value="50" 
                                   min="1" 
                                   step="1"
                                   placeholder="Qty"
                                   title="Ketik angka jumlah restock lalu klik tombol atau tekan Enter">
                            <button type="button" 
                                    class="btn btn-sm btn-outline btn-restock" 
                                    data-id="${item.id}"
                                    title="Tambah stok bahan">
                                <i class="fas fa-plus"></i> Restock
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Event listener: Klik tombol Restock
        tbody.querySelectorAll('.btn-restock').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const input = tbody.querySelector(`.restock-qty-input[data-id="${id}"]`);
                const val = input ? input.value : 50;
                restockMaterial(id, val);
            });
        });

        // Event listener: Tekan Enter pada input angka
        tbody.querySelectorAll('.restock-qty-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const id = input.getAttribute('data-id');
                    restockMaterial(id, input.value);
                }
            });
        });
    }

    async function restockMaterial(matId, rawQty) {
        const qty = parseInt(rawQty, 10);
        if (isNaN(qty) || qty <= 0) {
            UI.showToast('Input Tidak Valid', 'Masukkan angka jumlah restock yang valid (minimal 1).', 'warning');
            return;
        }

        // Coba kirim ke REST API server
        try {
            const res = await fetch('/api/inventory/restock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matId, qty })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.inventory)) {
                Security.safeSetStorage('dm_inventory', data.inventory);
                const found = data.inventory.find(i => i.id === matId);
                const name = found ? found.name : matId;
                const unit = found ? found.unit : '';
                Security.logAuditEvent('MATERIAL_RESTOCKED', `Added +${qty} ${unit} to '${name}'`);
                await renderMaterialsInventory();
                UI.showToast('Restock Berhasil', `Stok ${name} bertambah +${qty} ${unit}`, 'success');
                return;
            } else if (!data.success) {
                UI.showToast('Gagal Restock', data.message || 'Gagal memperbarui stok di server.', 'error');
                return;
            }
        } catch (err) {
            console.warn('REST API restock gagal terhubung, beralih ke local storage:', err.message);
        }

        // Fallback LocalStorage jika offline
        const inventory = getInventory();
        const found = inventory.find(i => i.id === matId);
        if (found) {
            found.stock += qty;
            Security.safeSetStorage('dm_inventory', inventory);
            Security.logAuditEvent('MATERIAL_RESTOCKED', `Added +${qty} ${found.unit} to '${found.name}'`);
            renderMaterialsInventory();
            UI.showToast('Restock Berhasil', `Stok ${found.name} bertambah +${qty} ${found.unit}`, 'success');
        }
    }

    function setupInventoryRestockEvents() {
        // Additional inventory hooks if needed
    }

    // ─── 6. Manajemen Akun & Hak Akses (RBAC) ───
    async function renderRBACUsers() {
        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            const users = (data.success && Array.isArray(data.users)) ? data.users : [];

            if (users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-tertiary);">Belum ada data pengguna terdaftar</td></tr>`;
                return;
            }

            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <div style="width:30px; height:30px; border-radius:50%; background:var(--gradient-primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.75rem;">
                                ${(u.name || u.username || 'U')[0].toUpperCase()}
                            </div>
                            <strong style="font-family:var(--font-mono);">${Security.sanitizeHTML(u.username || u.phone)}</strong>
                        </div>
                    </td>
                    <td>
                        <strong>${Security.sanitizeHTML(u.name || '-')}</strong>
                        ${u.phone ? `<br><small style="color:var(--text-tertiary);">${Security.sanitizeHTML(u.phone)}</small>` : ''}
                    </td>
                    <td>
                        <span class="role-badge badge-${u.role || 'customer'}">
                            <i class="fas fa-${u.role === 'admin' ? 'user-shield' : u.role === 'cashier' ? 'cash-register' : 'user'}"></i>
                            ${(u.role || 'customer').toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <span style="color:var(--success); font-weight:700; font-size:0.85rem;">
                            <i class="fas fa-check-circle"></i> Aktif & Terverifikasi
                        </span>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Failed to load users:', err);
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> Gagal menghubungkan ke database pengguna</td></tr>`;
        }
    }

    // ─── 7. Security Audit Log ───
    function renderSecurityAuditLogs() {
        const container = document.getElementById('admin-audit-logs');
        if (!container) return;

        const logs = Security.getAuditLogs();
        if (logs.length === 0) {
            container.innerHTML = `<p style="color:var(--text-tertiary); text-align:center; padding:1.5rem;"><i class="fas fa-shield-alt" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.4;"></i>Tidak ada insiden keamanan</p>`;
            return;
        }

        container.innerHTML = logs.map(l => `
            <div class="audit-log-row">
                <span class="audit-time" style="color:var(--text-tertiary);">${new Date(l.time).toLocaleTimeString('id-ID')}</span>
                <span class="badge ${l.event.includes('ERROR') || l.event.includes('LIMIT') ? 'badge-hot' : 'badge-new'}" style="font-size:0.72rem;">
                    ${Security.sanitizeHTML(l.event)}
                </span>
                <span class="audit-details" style="color:var(--text-secondary);">${Security.sanitizeHTML(l.details)}</span>
            </div>
        `).join('');
    }

    // ─── 7.5. Pengaturan Rekening & QRIS Toko (/api/payment-settings) ───
    async function syncPaymentSettingsFromServer() {
        try {
            const res = await fetch('/api/payment-settings');
            const data = await res.json();
            if (data.success && data.settings) {
                cachedPaymentSettings = data.settings;
                renderPaymentSettingsForm();
            }
        } catch (err) {
            console.warn('Sync payment settings warning:', err.message);
        }
    }

    function renderPaymentSettingsForm() {
        if (!cachedPaymentSettings) return;

        const cfg = cachedPaymentSettings;
        const qrisMerchant = document.getElementById('cfg-qris-merchant');
        const bankHolder = document.getElementById('cfg-bank-holder');
        const bcaNum = document.getElementById('cfg-bca-num');
        const bniNum = document.getElementById('cfg-bni-num');
        const mandiriNum = document.getElementById('cfg-mandiri-num');
        const ewHolder = document.getElementById('cfg-ewallet-holder');
        const ewNum = document.getElementById('cfg-ewallet-num');
        const previewImg = document.getElementById('cfg-qris-preview');
        const placeholder = document.getElementById('cfg-qris-placeholder');
        const resetBtn = document.getElementById('btn-reset-qris');

        if (qrisMerchant) qrisMerchant.value = cfg.qrisMerchantName || '';
        if (bankHolder) bankHolder.value = (cfg.bankBCA && cfg.bankBCA.holderName) || '';
        if (bcaNum) bcaNum.value = (cfg.bankBCA && cfg.bankBCA.accountNumber) || '';
        if (bniNum) bniNum.value = (cfg.bankBNI && cfg.bankBNI.accountNumber) || '';
        if (mandiriNum) mandiriNum.value = (cfg.bankMandiri && cfg.bankMandiri.accountNumber) || '';
        if (ewHolder) ewHolder.value = (cfg.ewallet && cfg.ewallet.holderName) || '';
        if (ewNum) ewNum.value = (cfg.ewallet && cfg.ewallet.accountNumber) || '';

        if (cfg.qrisImage && cfg.qrisImage.trim()) {
            if (previewImg) {
                previewImg.src = cfg.qrisImage;
                previewImg.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            if (resetBtn) resetBtn.style.display = 'inline-flex';
        } else {
            if (previewImg) {
                previewImg.src = '';
                previewImg.style.display = 'none';
            }
            if (placeholder) placeholder.style.display = 'block';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }

    function setupPaymentConfigEvents() {
        const fileInput = document.getElementById('cfg-qris-file');
        const browseBtn = document.getElementById('btn-browse-qris');
        const resetBtn = document.getElementById('btn-reset-qris');
        const previewImg = document.getElementById('cfg-qris-preview');
        const placeholder = document.getElementById('cfg-qris-placeholder');
        const form = document.getElementById('form-payment-config');

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (previewImg) {
                        previewImg.src = ev.target.result;
                        previewImg.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                    if (resetBtn) resetBtn.style.display = 'inline-flex';
                    UI.showToast('Foto Terpilih', file.name, 'info');
                };
                reader.readAsDataURL(file);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (fileInput) fileInput.value = '';
                if (previewImg) {
                    previewImg.src = '';
                    previewImg.style.display = 'none';
                }
                if (placeholder) placeholder.style.display = 'block';
                resetBtn.style.display = 'none';
                if (cachedPaymentSettings) cachedPaymentSettings.qrisImage = '';
                UI.showToast('QRIS Direset', 'Menggunakan QRIS Generator Sistem', 'info');
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = document.getElementById('btn-save-payment-config');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan Pengaturan...';
                }

                const payload = {
                    qrisMerchantName: (document.getElementById('cfg-qris-merchant') ? document.getElementById('cfg-qris-merchant').value.trim() : 'PERCETAKAN GILAR MEDIA'),
                    qrisImage: (previewImg && previewImg.src.startsWith('data:image')) ? previewImg.src : (cachedPaymentSettings ? cachedPaymentSettings.qrisImage : ''),
                    bankBCA: {
                        bankName: 'Bank BCA',
                        accountNumber: (document.getElementById('cfg-bca-num') ? document.getElementById('cfg-bca-num').value.trim() : ''),
                        holderName: (document.getElementById('cfg-bank-holder') ? document.getElementById('cfg-bank-holder').value.trim() : '')
                    },
                    bankBNI: {
                        bankName: 'Bank BNI',
                        accountNumber: (document.getElementById('cfg-bni-num') ? document.getElementById('cfg-bni-num').value.trim() : ''),
                        holderName: (document.getElementById('cfg-bank-holder') ? document.getElementById('cfg-bank-holder').value.trim() : '')
                    },
                    bankMandiri: {
                        bankName: 'Bank Mandiri',
                        accountNumber: (document.getElementById('cfg-mandiri-num') ? document.getElementById('cfg-mandiri-num').value.trim() : ''),
                        holderName: (document.getElementById('cfg-bank-holder') ? document.getElementById('cfg-bank-holder').value.trim() : '')
                    },
                    ewallet: {
                        provider: 'DANA / GoPay / OVO',
                        accountNumber: (document.getElementById('cfg-ewallet-num') ? document.getElementById('cfg-ewallet-num').value.trim() : ''),
                        holderName: (document.getElementById('cfg-ewallet-holder') ? document.getElementById('cfg-ewallet-holder').value.trim() : '')
                    },
                    updatedBy: 'Bapak Hendra (Master Admin)'
                };

                try {
                    const res = await fetch('/api/payment-settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();

                    if (data.success) {
                        cachedPaymentSettings = data.settings;
                        Security.logAuditEvent('PAYMENT_CONFIG_UPDATED', 'Memperbarui nomor rekening & barcode QRIS toko');
                        renderSecurityAuditLogs();
                        UI.showToast('Pengaturan Berhasil Disimpan! 🎉', 'Nomor rekening dan QRIS terbaru langsung diterapkan ke toko pelanggan.', 'success');
                    } else {
                        UI.showToast('Gagal Menyimpan', data.message || 'Terjadi kesalahan sistem', 'error');
                    }
                } catch (err) {
                    console.error('Save payment config error:', err);
                    UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Pengaturan Rekening & QRIS';
                    }
                }
            });
        }
    }

    // ─── 8. Tab Switching Navigation ───
    function setupAdminTabs() {
        const tabBtns = document.querySelectorAll('.admin-nav-tab');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-admin-tab');

                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.admin-section-pane').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const pane = document.getElementById(`admin-pane-${target}`);
                if (pane) pane.classList.add('active');
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        init,
        render,
        renderProductsManagement,
        restockMaterial
    });
})();
