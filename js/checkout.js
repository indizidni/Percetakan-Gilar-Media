/**
 * ============================================
 *  CHECKOUT.JS — Online Checkout & Payment Gateway
 *  Connects Customer Orders Directly to Server JSON Database (/api/orders)
 * ============================================
 */
'use strict';

const Checkout = (() => {
    let currentStep = 1;
    let activeCompletedOrder = null;
    let currentProofDataUrl = null;
    let livePaymentSettings = null;

    function init() {
        setupCheckoutButton();
        setupStepNavigation();
        setupFormSubmission();
        setupCopyButtons();
        setupSuccessClose();
        setupPaymentProofEvents();
        loadLivePaymentSettings();
    }

    // ─── Open Checkout ───
    function setupCheckoutButton() {
        const btn = document.getElementById('checkout-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const cart = CustomerModule.getCustomerCart();
            if (cart.length === 0) {
                UI.showToast('Keranjang Kosong', 'Pilih layanan cetak terlebih dahulu', 'error');
                return;
            }

            // Ensure customer is logged in before checking out
            if (!Security.isCustomerLoggedIn()) {
                UI.showToast('Akun Diperlukan 🔒', 'Silakan Masuk atau Buat Akun Baru terlebih dahulu sebelum checkout.', 'warning');
                UI.closeCart();
                UI.openModal('customer-auth-modal');
                return;
            }

            // Pre-fill user data
            const session = Security.getActiveSession();
            if (session) {
                const nameEl = document.getElementById('customer-name');
                const phoneEl = document.getElementById('customer-phone');
                const addrEl = document.getElementById('customer-address');
                if (nameEl && !nameEl.value) nameEl.value = session.name || '';
                if (phoneEl && !phoneEl.value) phoneEl.value = session.phone || '';
                if (addrEl && !addrEl.value) addrEl.value = session.address || '';
            }

            UI.closeCart();
            goToStep(1);
            Security.refreshCSRFToken();
            UI.openModal('checkout-modal');
        });
    }

    // ─── Step Navigation ───
    function setupStepNavigation() {
        const toStep2 = document.getElementById('to-step-2');
        if (toStep2) {
            toStep2.addEventListener('click', () => {
                if (validateStep1()) goToStep(2);
            });
        }

        const backStep1 = document.getElementById('back-step-1');
        if (backStep1) {
            backStep1.addEventListener('click', () => goToStep(1));
        }

        const toStep3 = document.getElementById('to-step-3');
        if (toStep3) {
            toStep3.addEventListener('click', () => {
                if (validateStep2()) {
                    renderOrderSummary();
                    goToStep(3);
                }
            });
        }

        const backStep2 = document.getElementById('back-step-2');
        if (backStep2) {
            backStep2.addEventListener('click', () => goToStep(2));
        }
    }

    function goToStep(step) {
        currentStep = step;
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`step-${i}`);
            if (el) el.classList.toggle('hidden', i !== step);
        }
        if (step === 2) {
            updatePaymentTypeOptions();
        }
    }

    function updatePaymentTypeOptions() {
        const cartItems = CustomerModule.getCustomerCart();
        const total = cartItems.reduce((acc, i) => acc + i.price, 0);
        const dpWrap = document.getElementById('label-pay-dp-wrap');
        const fullDesc = document.getElementById('label-pay-full-desc');
        const dpDesc = document.getElementById('label-pay-dp-desc');
        const dpRadio = document.querySelector('input[name="paymentType"][value="dp"]');
        const fullRadio = document.querySelector('input[name="paymentType"][value="full"]');

        if (fullDesc) fullDesc.textContent = `Bayar penuh lunas: ${formatRupiah(total)}`;

        if (total >= 100000) {
            const dpAmount = Math.round(total * 0.5);
            const remaining = total - dpAmount;
            if (dpWrap) {
                dpWrap.style.opacity = '1';
                dpWrap.style.pointerEvents = 'auto';
            }
            if (dpRadio) dpRadio.disabled = false;
            if (dpDesc) dpDesc.textContent = `DP 50% (${formatRupiah(dpAmount)}), sisa ${formatRupiah(remaining)} saat ambil`;
        } else {
            if (dpWrap) {
                dpWrap.style.opacity = '0.5';
                dpWrap.style.pointerEvents = 'none';
            }
            if (dpRadio) {
                dpRadio.disabled = true;
                if (dpRadio.checked && fullRadio) fullRadio.checked = true;
            }
            if (dpDesc) dpDesc.textContent = `Minimal order Rp 100.000 untuk opsi DP 50%`;
        }
    }

    // ─── Validation ───
    function validateStep1() {
        let valid = true;

        const name = document.getElementById('customer-name');
        const nameError = document.getElementById('name-error');
        const nameVal = Security.sanitizeInput(name ? name.value : '');
        if (!nameVal || nameVal.length < 2) {
            nameError.textContent = 'Nama lengkap pemesan wajib diisi';
            if (name) name.classList.add('error');
            valid = false;
        } else {
            nameError.textContent = '';
            if (name) name.classList.remove('error');
        }

        const phone = document.getElementById('customer-phone');
        const phoneError = document.getElementById('phone-error');
        const phoneVal = Security.sanitizeInput(phone ? phone.value : '');
        if (!Security.isValidPhone(phoneVal)) {
            phoneError.textContent = 'Nomor WhatsApp tidak valid (format: 08xxxxxxxxxx)';
            if (phone) phone.classList.add('error');
            valid = false;
        } else {
            phoneError.textContent = '';
            if (phone) phone.classList.remove('error');
        }

        const address = document.getElementById('customer-address');
        const addressError = document.getElementById('address-error');
        const addressVal = Security.sanitizeInput(address ? address.value : '');
        if (!addressVal || addressVal.length < 5) {
            addressError.textContent = 'Alamat atau catatan pengambilan wajib diisi';
            if (address) address.classList.add('error');
            valid = false;
        } else {
            addressError.textContent = '';
            if (address) address.classList.remove('error');
        }

        return valid;
    }

    function validateStep2() {
        const paymentError = document.getElementById('payment-error');
        const selected = document.querySelector('input[name="payment"]:checked');

        if (!selected) {
            paymentError.textContent = 'Pilih metode pembayaran';
            return false;
        }

        paymentError.textContent = '';
        return true;
    }

    // ─── Order Summary ───
    function renderOrderSummary() {
        const container = document.getElementById('order-summary');
        if (!container) return;

        const cartItems = CustomerModule.getCustomerCart();
        const total = cartItems.reduce((acc, i) => acc + i.price, 0);

        const name = Security.sanitizeHTML(Security.sanitizeInput(document.getElementById('customer-name').value));
        const phone = Security.sanitizeHTML(Security.sanitizeInput(document.getElementById('customer-phone').value));
        const address = Security.sanitizeHTML(Security.sanitizeInput(document.getElementById('customer-address').value));
        const deliveryMethod = document.getElementById('delivery-method') ? document.getElementById('delivery-method').value : 'pickup';
        const paymentInput = document.querySelector('input[name="payment"]:checked');
        const payment = paymentInput ? paymentInput.value : 'qris';
        const paymentLabel = getPaymentLabel(payment);

        const payTypeRadio = document.querySelector('input[name="paymentType"]:checked');
        const isDP = payTypeRadio && payTypeRadio.value === 'dp';
        const dpAmount = Math.round(total * 0.5);
        const remaining = total - dpAmount;

        let html = '<h5 style="margin-bottom: 0.75rem; font-weight: 700;">Rincian Pesanan Cetak</h5>';

        cartItems.forEach(item => {
            html += `
                <div class="order-summary-item">
                    <div>
                        <strong>${Security.sanitizeHTML(item.name)}</strong><br>
                        <small style="color:var(--text-secondary);">${Security.sanitizeHTML(item.specs)}</small>
                    </div>
                    <span>${formatRupiah(item.price)}</span>
                </div>
            `;
        });

        html += `
            <div class="order-summary-item">
                <span>Pengambilan / Pengiriman</span>
                <strong style="color: var(--success);">${deliveryMethod === 'pickup' ? 'Ambil di Workshop Percetakan Gilar Media (Gratis)' : 'Kurir Ekspedisi (Bisa COD / Free)'}</strong>
            </div>
            <div class="order-summary-item">
                <span>Metode Pembayaran</span>
                <span>${Security.sanitizeHTML(paymentLabel)}</span>
            </div>
            <div class="order-summary-item">
                <span>Skema Pembayaran</span>
                <strong style="color: ${isDP ? '#f59e0b' : 'var(--success)'};">${isDP ? 'Uang Muka (DP 50%)' : 'Bayar Lunas (100%)'}</strong>
            </div>
            ${isDP ? `
                <div class="order-summary-item" style="background:rgba(245,158,11,0.1); padding:0.5rem 0.65rem; border-radius:6px; margin:0.35rem 0;">
                    <span style="font-weight:700; color:#f59e0b;">Wajib Dibayar Sekarang (DP 50%)</span>
                    <strong style="font-size:1.05rem; color:#f59e0b;">${formatRupiah(dpAmount)}</strong>
                </div>
                <div class="order-summary-item" style="color:var(--text-secondary); font-size:0.85rem;">
                    <span>Sisa Pelunasan (Saat Barang Jadi)</span>
                    <strong>${formatRupiah(remaining)}</strong>
                </div>
            ` : ''}
            <div class="order-summary-item total">
                <span>Total Biaya Cetak</span>
                <span class="order-total-price">${formatRupiah(total)}</span>
            </div>
            <div class="order-customer-info">
                <p><strong>Nama Pemesan:</strong> ${name}</p>
                <p><strong>WhatsApp:</strong> ${phone}</p>
                <p><strong>Alamat / Catatan:</strong> ${address}</p>
            </div>
        `;

        container.innerHTML = html;
    }

    // ─── Submit Order to Server JSON Database (/api/orders) ───
    function setupFormSubmission() {
        const form = document.getElementById('checkout-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!Security.checkRateLimit('checkout_online', 3, 60000)) {
                UI.showToast('Terlalu Cepat', 'Silakan tunggu sebentar sebelum memesan lagi', 'error');
                return;
            }

            const btn = document.getElementById('place-order-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan ke Database...';

            await processOnlineOrder();
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Konfirmasi Pesanan Sekarang';
        });
    }

    async function processOnlineOrder() {
        const orderId = Security.generateTransactionId('DM-ONL');
        const paymentInput = document.querySelector('input[name="payment"]:checked');
        const payment = paymentInput ? paymentInput.value : 'qris';

        const payTypeRadio = document.querySelector('input[name="paymentType"]:checked');
        const isDP = payTypeRadio && payTypeRadio.value === 'dp';

        const nameInput = document.getElementById('customer-name');
        const phoneInput = document.getElementById('customer-phone');
        const addressInput = document.getElementById('customer-address');
        const deliveryMethod = document.getElementById('delivery-method') ? document.getElementById('delivery-method').value : 'pickup';

        const cartItems = CustomerModule.getCustomerCart();
        const total = cartItems.reduce((acc, i) => acc + i.price, 0);
        const session = Security.getActiveSession() || {};

        const dpAmount = Math.round(total * 0.5);
        const amountPaid = isDP ? dpAmount : total;
        const remainingBalance = isDP ? (total - amountPaid) : 0;
        // Online orders start with 'belum_bayar' until proof is uploaded & ACC'ed by Admin
        const paymentStatus = 'belum_bayar';

        const orderRecord = {
            id: orderId,
            channel: 'online',
            createdAt: new Date().toISOString(),
            userId: session.userId || null,
            customer: {
                name: Security.sanitizeInput(nameInput ? nameInput.value : session.name || ''),
                phone: Security.sanitizeInput(phoneInput ? phoneInput.value : session.phone || ''),
                email: session.email || '',
                address: Security.sanitizeInput(addressInput ? addressInput.value : session.address || '')
            },
            deliveryMethod: deliveryMethod === 'pickup' ? 'Ambil di Toko' : 'Kirim Ekspedisi',
            paymentMethod: payment,
            paymentType: isDP ? 'dp' : 'full',
            paymentStatus,
            amountPaid,
            remainingBalance,
            items: [...cartItems],
            total,
            status: 'Verifikasi Desain'
        };

        try {
            // Save directly to server JSON database
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderRecord)
            });
            const data = await res.json();

            if (!data.success) {
                UI.showToast('Gagal Membuat Pesanan', data.message || 'Terjadi kesalahan server', 'error');
                return;
            }

            UI.closeModal('checkout-modal');

            const orderIdEl = document.getElementById('order-id');
            if (orderIdEl) orderIdEl.textContent = `Nomor ID Pesanan: ${orderId}`;

            // Handle payment sections
            const qrisSection = document.getElementById('qris-payment-section');
            const transferSection = document.getElementById('transfer-payment-section');
            const ewalletSection = document.getElementById('ewallet-payment-section');
            const codSection = document.getElementById('cod-payment-section');

            if (qrisSection) qrisSection.classList.add('hidden');
            if (transferSection) transferSection.classList.add('hidden');
            if (ewalletSection) ewalletSection.classList.add('hidden');
            if (codSection) codSection.classList.add('hidden');

            if (payment === 'qris') {
                if (qrisSection) qrisSection.classList.remove('hidden');
                const customImg = document.getElementById('qris-img-custom');
                const canvasEl = document.getElementById('qris-canvas');
                if (livePaymentSettings && livePaymentSettings.qrisImage) {
                    if (customImg) {
                        customImg.src = livePaymentSettings.qrisImage;
                        customImg.style.display = 'block';
                    }
                    if (canvasEl) canvasEl.style.display = 'none';
                } else {
                    if (customImg) customImg.style.display = 'none';
                    if (canvasEl) canvasEl.style.display = 'block';
                    generateQRIS(orderId);
                }
            } else if (payment === 'transfer') {
                if (transferSection) transferSection.classList.remove('hidden');
            } else if (payment === 'ewallet') {
                if (ewalletSection) ewalletSection.classList.remove('hidden');
            } else if (payment === 'cod') {
                if (codSection) codSection.classList.remove('hidden');
            }

            // Simpan referensi pesanan aktif untuk lampiran bukti pembayaran
            activeCompletedOrder = orderRecord;
            currentProofDataUrl = null;

            const proofBox = document.getElementById('payment-proof-upload-box');
            if (proofBox) {
                if (payment === 'cod') {
                    proofBox.style.display = 'none';
                } else {
                    proofBox.style.display = 'block';
                    const previewBox = document.getElementById('proof-preview-container');
                    if (previewBox) previewBox.style.display = 'none';
                    const previewImg = document.getElementById('proof-preview-img');
                    if (previewImg) previewImg.src = '';
                    const fileInput = document.getElementById('input-payment-proof-file');
                    if (fileInput) fileInput.value = '';
                    const statusPill = document.getElementById('proof-status-pill');
                    if (statusPill) {
                        statusPill.style.background = 'rgba(245,158,11,0.15)';
                        statusPill.style.color = '#f59e0b';
                        statusPill.style.borderColor = '#f59e0b';
                        statusPill.innerHTML = '<i class="fas fa-clock"></i> Belum Konfirmasi';
                    }
                    const submitBtn = document.getElementById('btn-submit-payment-proof');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.className = 'btn btn-success btn-block';
                        submitBtn.style.color = '';
                        submitBtn.style.borderColor = '';
                        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Bukti Pembayaran Sekarang';
                    }
                }
            }

            UI.openModal('success-modal');

            // Clear customer cart
            Security.safeSetStorage('dm_cust_cart', []);
            CustomerModule.render();

            const form = document.getElementById('checkout-form');
            if (form) form.reset();
        } catch (err) {
            console.error('Order Error:', err);
            UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
        }
    }

    // ─── Load Pengaturan Rekening & QRIS dari Server (/api/payment-settings) ───
    async function loadLivePaymentSettings() {
        try {
            const res = await fetch('/api/payment-settings');
            const data = await res.json();
            if (data.success && data.settings) {
                livePaymentSettings = data.settings;
                applyPaymentSettingsToUI(data.settings);
            }
        } catch (err) {
            console.warn('Could not load payment settings:', err.message);
        }
    }

    function applyPaymentSettingsToUI(cfg) {
        if (!cfg) return;

        // BCA
        if (cfg.bankBCA && cfg.bankBCA.accountNumber) {
            const bcaEl = document.getElementById('pay-bca-acc');
            const btnBca = document.getElementById('btn-copy-bca');
            if (bcaEl) bcaEl.textContent = cfg.bankBCA.accountNumber;
            if (btnBca) btnBca.setAttribute('data-copy', cfg.bankBCA.accountNumber.replace(/[^0-9]/g, ''));
        }

        // BNI
        if (cfg.bankBNI && cfg.bankBNI.accountNumber) {
            const bniEl = document.getElementById('pay-bni-acc');
            const btnBni = document.getElementById('btn-copy-bni');
            if (bniEl) bniEl.textContent = cfg.bankBNI.accountNumber;
            if (btnBni) btnBni.setAttribute('data-copy', cfg.bankBNI.accountNumber.replace(/[^0-9]/g, ''));
        }

        // Mandiri
        if (cfg.bankMandiri && cfg.bankMandiri.accountNumber) {
            const manEl = document.getElementById('pay-mandiri-acc');
            const btnMan = document.getElementById('btn-copy-mandiri');
            if (manEl) manEl.textContent = cfg.bankMandiri.accountNumber;
            if (btnMan) btnMan.setAttribute('data-copy', cfg.bankMandiri.accountNumber.replace(/[^0-9]/g, ''));
        }

        // Holder name
        if (cfg.bankBCA && cfg.bankBCA.holderName) {
            const holderEl = document.getElementById('pay-holder-name');
            if (holderEl) holderEl.textContent = cfg.bankBCA.holderName;
        }

        // E-Wallet
        if (cfg.ewallet) {
            const ewEl = document.getElementById('pay-ewallet-acc');
            const btnEw = document.getElementById('btn-copy-ewallet');
            const provEl = document.getElementById('pay-ewallet-provider');
            const ewHolderEl = document.getElementById('pay-ewallet-holder');
            if (ewEl && cfg.ewallet.accountNumber) ewEl.textContent = cfg.ewallet.accountNumber;
            if (btnEw && cfg.ewallet.accountNumber) btnEw.setAttribute('data-copy', cfg.ewallet.accountNumber.replace(/[^0-9]/g, ''));
            if (provEl && cfg.ewallet.provider) provEl.textContent = cfg.ewallet.provider;
            if (ewHolderEl && cfg.ewallet.holderName) ewHolderEl.textContent = cfg.ewallet.holderName;
        }

        // Custom QRIS image
        const qrisImg = document.getElementById('qris-img-custom');
        const qrisCanvas = document.getElementById('qris-canvas');
        if (cfg.qrisImage && cfg.qrisImage.trim()) {
            if (qrisImg) {
                qrisImg.src = cfg.qrisImage;
                qrisImg.style.display = 'block';
            }
            if (qrisCanvas) qrisCanvas.style.display = 'none';
        } else {
            if (qrisImg) qrisImg.style.display = 'none';
            if (qrisCanvas) qrisCanvas.style.display = 'block';
        }
    }

    // ─── Visual QRIS Canvas Generator ───
    function generateQRIS(orderId) {
        const canvas = document.getElementById('qris-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const cellSize = 8;
        const gridSize = Math.floor(size / cellSize);

        let seed = 0;
        for (let i = 0; i < orderId.length; i++) {
            seed = ((seed << 5) - seed + orderId.charCodeAt(i)) | 0;
        }

        function pseudoRandom() {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed & 1) === 0;
        }

        ctx.fillStyle = '#0f172a';

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if ((x < 4 && y < 4) || (x >= gridSize - 4 && y < 4) || (x < 4 && y >= gridSize - 4)) {
                    const isOuter = x === 0 || y === 0 || x === 3 || y === 3 || x === gridSize - 1 || x === gridSize - 4 || y === gridSize - 1 || y === gridSize - 4;
                    const isInner = (x === 1 || x === 2) && (y === 1 || y === 2) ||
                                   (x >= gridSize - 3 && x <= gridSize - 2) && (y === 1 || y === 2) ||
                                   (x === 1 || x === 2) && (y >= gridSize - 3 && y <= gridSize - 2);
                    if (isOuter || isInner) {
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                } else if (pseudoRandom()) {
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PERCETAKAN GILAR MEDIA QRIS', size / 2, size - 6);
    }

    function setupCopyButtons() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-copy');
            if (!btn) return;

            const text = btn.getAttribute('data-copy');
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                UI.showToast('Tersalin!', `${text} berhasil disalin`, 'success');
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            });
        });
    }

    function setupSuccessClose() {
        const btn = document.getElementById('close-success');
        if (btn) {
            btn.addEventListener('click', () => {
                UI.closeModal('success-modal');
                const trackerInput = document.getElementById('tracker-order-id');
                const orderIdEl = document.getElementById('order-id');
                if (trackerInput && orderIdEl) {
                    const extracted = orderIdEl.textContent.replace('Nomor ID Pesanan: ', '').trim();
                    trackerInput.value = extracted;
                    document.getElementById('order-tracking-section').scrollIntoView({ behavior: 'smooth' });
                    // Auto trigger tracking
                    const trackBtn = document.getElementById('btn-track-order');
                    if (trackBtn) trackBtn.click();
                }
            });
        }
    }

    function getPaymentLabel(value) {
        const labels = {
            qris: 'QRIS Digital Otomatis (Gopay, OVO, DANA, BCA, dll)',
            transfer: 'Transfer Bank Virtual (BCA / BNI)',
            ewallet: 'E-Wallet Saldo (DANA / OVO / GoPay)',
            cod: 'COD (Bayar Tunai saat Ambil di Toko)'
        };
        return labels[value] || value;
    }

        // ─── Visual Indonesian m-BCA Transfer Receipt Generator (Canvas) ───
    function generateSampleBankReceipt(orderId, amount, paymentMethod) {
        const canvas = document.createElement('canvas');
        const width = 380;
        const height = 515;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Header Gradient (BCA Dark Navy Blue)
        const headerH = 95;
        const grad = ctx.createLinearGradient(0, 0, width, headerH);
        grad.addColorStop(0, '#005baa');
        grad.addColorStop(1, '#003e7e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, headerH);

        // Header Text: BCA mobile m-Transfer
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

        // Subheader Badge (Status Berhasil)
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

        // Transaction Details Rows
        const rows = [
            { label: 'TANGGAL & WAKTU', val: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) },
            { label: 'NO. REFERENSI', val: 'TRX-' + (Date.now().toString().slice(-8)) + '-' + Math.floor(1000 + Math.random() * 9000) },
            { label: 'BANK TUJUAN', val: 'BCA (014) - KCU JAKARTA' },
            { label: 'REKENING TUJUAN', val: '889-1029-3847' },
            { label: 'NAMA PENERIMA', val: 'PERCETAKAN GILAR MEDIA' },
            { label: 'NOMINAL TRANSFER', val: 'Rp ' + Number(amount || 0).toLocaleString('id-ID'), highlight: true },
            { label: 'BERITA / NO. PESANAN', val: orderId || 'DM-ONL-SAMPLE' },
            { label: 'JENIS TRANSAKSI', val: paymentMethod === 'qris' ? 'QRIS Digital Auto Settlement' : 'Transfer Antar Rekening BCA' }
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

        // Security watermark & footer box
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

    // ─── Setup Event Listeners Unggah Bukti Bayar & Demo Sidang ───
    function setupPaymentProofEvents() {
        const fileInput = document.getElementById('input-payment-proof-file');
        const browseBtn = document.getElementById('btn-browse-payment-proof');
        const simBtn = document.getElementById('btn-demo-sim-proof');
        const removeBtn = document.getElementById('btn-remove-proof');
        const submitBtn = document.getElementById('btn-submit-payment-proof');
        const previewContainer = document.getElementById('proof-preview-container');
        const previewImg = document.getElementById('proof-preview-img');
        const previewName = document.getElementById('proof-preview-name');
        const statusPill = document.getElementById('proof-status-pill');

        if (!submitBtn) return;

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    UI.showToast('Format Salah', 'Harap pilih file gambar (JPG, PNG, atau WEBP)', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentProofDataUrl = ev.target.result;
                    if (previewImg) previewImg.src = currentProofDataUrl;
                    if (previewName) previewName.textContent = file.name;
                    if (previewContainer) previewContainer.style.display = 'block';
                    UI.showToast('File Terpilih', file.name, 'info');
                };
                reader.readAsDataURL(file);
            });
        }

        if (simBtn) {
            simBtn.addEventListener('click', () => {
                let orderId = 'DM-ONL-DEMO';
                let amount = 100000;
                let method = 'qris';

                if (activeCompletedOrder) {
                    orderId = activeCompletedOrder.id;
                    amount = activeCompletedOrder.amountPaid || activeCompletedOrder.total;
                    method = activeCompletedOrder.paymentMethod || 'qris';
                } else {
                    const orderIdEl = document.getElementById('order-id');
                    if (orderIdEl) {
                        const txt = orderIdEl.textContent.replace('Nomor ID Pesanan: ', '').trim();
                        if (txt) orderId = txt;
                    }
                }

                currentProofDataUrl = generateSampleBankReceipt(orderId, amount, method);
                if (previewImg) previewImg.src = currentProofDataUrl;
                if (previewName) previewName.textContent = 'm-BCA-Transfer-Sukses.jpg';
                if (previewContainer) previewContainer.style.display = 'block';

                UI.showToast('Struk Demo Terpasang ⚡', 'Contoh struk m-BCA siap dikirim untuk demo sidang skripsi!', 'success');
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                currentProofDataUrl = null;
                if (fileInput) fileInput.value = '';
                if (previewContainer) previewContainer.style.display = 'none';
                if (previewImg) previewImg.src = '';
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                if (!currentProofDataUrl) {
                    UI.showToast('Bukti Belum Dipilih', 'Harap unggah screenshot struk atau gunakan tombol [⚡ Pasang Contoh Struk]', 'warning');
                    return;
                }

                let targetOrderId = activeCompletedOrder ? activeCompletedOrder.id : null;
                if (!targetOrderId) {
                    const orderIdEl = document.getElementById('order-id');
                    if (orderIdEl) {
                        targetOrderId = orderIdEl.textContent.replace('Nomor ID Pesanan: ', '').trim();
                    }
                }

                if (!targetOrderId) {
                    UI.showToast('ID Pesanan Kosong', 'Tidak dapat menemukan ID pesanan untuk dikaitkan', 'error');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim Bukti ke Toko...';

                try {
                    const res = await fetch('/api/orders/upload-payment-proof', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: targetOrderId,
                            proofImage: currentProofDataUrl,
                            note: 'Bukti pembayaran resmi diunggah pelanggan via checkout web'
                        })
                    });
                    const data = await res.json();

                    if (data.success) {
                        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bukti Berhasil Dikirim!';
                        submitBtn.className = 'btn btn-outline btn-block';
                        submitBtn.style.color = '#10b981';
                        submitBtn.style.borderColor = '#10b981';

                        if (statusPill) {
                            statusPill.style.background = 'rgba(245,158,11,0.2)';
                            statusPill.style.color = '#f59e0b';
                            statusPill.style.borderColor = '#f59e0b';
                            statusPill.innerHTML = '<i class="fas fa-hourglass-half fa-spin"></i> Menunggu Verifikasi Toko';
                        }

                        UI.showToast('Berhasil Dikirim 📩', 'Bukti bayar Anda telah diterima kasir / admin dan menunggu ACC verifikasi.', 'success');
                    } else {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Bukti Pembayaran Sekarang';
                        UI.showToast('Gagal Mengirim', data.message || 'Terjadi kesalahan sistem', 'error');
                    }
                } catch (err) {
                    console.error('Upload proof error:', err);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Bukti Pembayaran Sekarang';
                    UI.showToast('Kesalahan Jaringan', 'Gagal menghubungi server database', 'error');
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        goToStep
    });
})();
