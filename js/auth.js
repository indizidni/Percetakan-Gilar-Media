/**
 * ============================================
 *  AUTH.JS — Customer Authentication & Account Management
 *  Connected to Node.js Backend & JSON Database (/api/...)
 * ============================================
 */
'use strict';

const Auth = (() => {
    function init() {
        setupAuthForms();
        updateNavbarUserBadge();
    }

    // ─── Register Customer Account (Saved to data/users.json) ───
    async function registerCustomer(formData) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success && result.user) {
                Security.setActiveSession(result.user);
                updateNavbarUserBadge();
                UI.showToast('Registrasi Berhasil! 🎉', result.message, 'success');
                return { success: true, user: result.user };
            } else {
                UI.showToast('Gagal Daftar', result.message || 'Terjadi kesalahan sistem', 'error');
                return { success: false, message: result.message };
            }
        } catch (err) {
            console.error('Register API Error:', err);
            UI.showToast('Kesalahan Jaringan', 'Tidak dapat terhubung ke server database', 'error');
            return { success: false, message: err.message };
        }
    }

    // ─── Login Customer Account (Verified against data/users.json) ───
    async function loginCustomer(identifier, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier, password })
            });

            const result = await response.json();
            if (result.success && result.user) {
                Security.setActiveSession(result.user);
                updateNavbarUserBadge();
                UI.showToast('Login Berhasil! 👋', result.message, 'success');
                return { success: true, user: result.user };
            } else {
                UI.showToast('Login Gagal', result.message || 'Username atau password salah', 'error');
                return { success: false, message: result.message };
            }
        } catch (err) {
            console.error('Login API Error:', err);
            UI.showToast('Kesalahan Jaringan', 'Tidak dapat terhubung ke server database', 'error');
            return { success: false, message: err.message };
        }
    }

    // ─── Logout ───
    function logout() {
        Security.clearSession();
        updateNavbarUserBadge();
        UI.showToast('Berhasil Keluar', 'Anda telah keluar dari akun pelanggan', 'info');
    }

    // ─── Update Navbar User Display ───
    function updateNavbarUserBadge() {
        const session = Security.getActiveSession();
        const container = document.getElementById('user-nav-action-area');
        if (!container) return;

        if (session && session.role === Security.ROLES.CUSTOMER) {
            container.innerHTML = `
                <div class="user-profile-chip" style="display:flex; align-items:center; gap:0.6rem; background:var(--bg-card); border:1px solid var(--border-color); padding:0.35rem 0.85rem; border-radius:var(--radius-full);">
                    <div style="width:28px; height:28px; border-radius:50%; background:var(--gradient-primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.75rem;">
                        ${(session.name || 'P')[0].toUpperCase()}
                    </div>
                    <div style="line-height:1.2;">
                        <strong style="font-size:0.85rem; display:block;">${Security.sanitizeHTML(session.name)}</strong>
                        <small style="font-size:0.72rem; color:var(--text-tertiary);">${Security.sanitizeHTML(session.phone || 'Pelanggan')}</small>
                    </div>
                    <button type="button" id="btn-do-logout" title="Keluar Akun" style="color:var(--danger); margin-left:0.35rem; font-size:0.88rem; cursor:pointer; padding:2px;">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;

            const logoutBtn = document.getElementById('btn-do-logout');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    logout();
                });
            }
        } else {
            container.innerHTML = `
                <button type="button" class="btn btn-outline btn-sm" id="btn-open-login-modal">
                    <i class="fas fa-user-circle"></i> Masuk / Daftar Akun
                </button>
            `;

            const loginBtn = document.getElementById('btn-open-login-modal');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    UI.openModal('customer-auth-modal');
                });
            }
        }
    }

    function switchAuthTab(target) {
        document.querySelectorAll('.auth-tab-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-auth-tab') === target);
        });
        document.querySelectorAll('.auth-pane').forEach(p => {
            p.classList.toggle('active', p.id === `auth-pane-${target}`);
        });
    }

    // ─── Setup Register & Login Forms ───
    function setupAuthForms() {
        // Tab Switcher inside Modal
        document.querySelectorAll('.auth-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-auth-tab');
                switchAuthTab(target);
            });
        });

        // Tab Switcher links (e.g. Masuk di sini / Daftar Akun Baru)
        document.querySelectorAll('[data-switch-auth-tab]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-switch-auth-tab');
                switchAuthTab(target);
            });
        });

        // Register Form
        const regForm = document.getElementById('customer-register-form');
        if (regForm) {
            regForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('reg-name').value.trim();
                const phone = document.getElementById('reg-phone').value.trim();
                const email = document.getElementById('reg-email').value.trim();
                const address = document.getElementById('reg-address').value.trim();
                const password = document.getElementById('reg-password').value;

                if (!name || !phone || !password) {
                    UI.showToast('Peringatan', 'Harap isi semua kolom wajib!', 'warning');
                    return;
                }

                const submitBtn = regForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan Akun...';

                const res = await registerCustomer({ name, phone, email, address, password });
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Buat Akun & Lanjutkan Belanja';

                if (res.success) {
                    UI.closeModal('customer-auth-modal');
                    regForm.reset();
                    // If there was a pending order action, trigger it
                    if (typeof CustomerModule !== 'undefined' && CustomerModule.pendingProductId) {
                        CustomerModule.openServiceCalculatorModal(CustomerModule.pendingProductId);
                        CustomerModule.pendingProductId = null;
                    }
                }
            });
        }

        // 1-Klik Masuk Akun Pelanggan Demo (Untuk Uji Coba Cepat & Sidang)
        const quickDemoBtn = document.getElementById('btn-quick-customer-demo');
        if (quickDemoBtn) {
            quickDemoBtn.addEventListener('click', () => {
                const demoUser = {
                    id: 'USR-CUST-DEMO',
                    userId: 'USR-CUST-DEMO',
                    role: 'customer',
                    username: 'budi_demo',
                    name: 'Budi Pratama (Demo Pelanggan)',
                    email: 'budi.pratama@gmail.com',
                    phone: '081234567890',
                    address: 'Jl. Merdeka No. 45, Kota Solusindo'
                };
                Security.setActiveSession(demoUser);
                updateNavbarUserBadge();
                UI.closeModal('customer-auth-modal');
                UI.showToast('Login Demo Berhasil ⚡', 'Masuk sebagai Budi Pratama (Akun Demo)', 'success');
                const checkoutBtn = document.getElementById('checkout-btn');
                if (checkoutBtn) checkoutBtn.click();
            });
        }

        // Login Form
        const logForm = document.getElementById('customer-login-form');
        if (logForm) {
            logForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const identifier = document.getElementById('log-identifier').value.trim();
                const password = document.getElementById('log-password').value;

                if (!identifier || !password) {
                    UI.showToast('Peringatan', 'Masukkan nomor WhatsApp/Email dan kata sandi!', 'warning');
                    return;
                }

                const submitBtn = logForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...';

                const res = await loginCustomer(identifier, password);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk Akun';

                if (res.success) {
                    UI.closeModal('customer-auth-modal');
                    logForm.reset();
                    if (typeof CustomerModule !== 'undefined' && CustomerModule.pendingProductId) {
                        CustomerModule.openServiceCalculatorModal(CustomerModule.pendingProductId);
                        CustomerModule.pendingProductId = null;
                    }
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        init,
        registerCustomer,
        loginCustomer,
        logout,
        updateNavbarUserBadge,
        switchTab: switchAuthTab
    });
})();
