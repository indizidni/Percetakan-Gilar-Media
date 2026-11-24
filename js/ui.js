/**
 * ============================================
 *  UI.JS — Global User Interface Controller
 *  Handles: Dark/Light Mode, Drawer, Modals, Toasts
 * ============================================
 */
'use strict';

const UI = (() => {
    function init() {
        setupThemeToggle();
        setupNavbarScroll();
        setupCartSidebar();
        setupModalClose();
        setupBackToTop();
        setupAuthModalTrigger();
    }

    // ─── Theme Toggle ───
    function setupThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        const saved = Security.safeGetStorage('dm_theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const icon = toggle.querySelector('i');
            if (icon) icon.className = 'fas fa-sun';
        }

        toggle.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const icon = toggle.querySelector('i');

            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                if (icon) icon.className = 'fas fa-moon';
                Security.safeSetStorage('dm_theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (icon) icon.className = 'fas fa-sun';
                Security.safeSetStorage('dm_theme', 'dark');
            }
        });
    }

    // ─── Navbar Scroll Effect ───
    function setupNavbarScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 40);
        });
    }

    // ─── Cart Sidebar ───
    function setupCartSidebar() {
        const cartToggle = document.getElementById('cart-toggle');
        const cartClose = document.getElementById('cart-close');
        const cartOverlay = document.getElementById('cart-overlay');

        if (cartToggle) {
            cartToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCart();
            });
        }
        if (cartClose) {
            cartClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeCart();
            });
        }
        if (cartOverlay) {
            cartOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeCart();
            });
        }

        // Global delegation fallback so any cart button or child icon always triggers openCart
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#cart-toggle, [data-open-cart]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                openCart();
            }
        });
    }

    function openCart() {
        const sidebar = document.getElementById('cart-sidebar');
        const overlay = document.getElementById('cart-overlay');
        if (typeof CustomerModule !== 'undefined') {
            CustomerModule.renderCustomerCartDrawer();
        }
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        const sidebar = document.getElementById('cart-sidebar');
        const overlay = document.getElementById('cart-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ─── Modals Management ───
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('active');
        const anyActive = document.querySelector('.modal-overlay.active');
        if (!anyActive) {
            document.body.style.overflow = '';
        }
    }

    function setupModalClose() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-overlay');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
                closeCart();
                document.body.style.overflow = '';
            }
        });
    }

    function setupAuthModalTrigger() {
        const btn = document.getElementById('btn-open-login-modal');
        if (btn) {
            btn.addEventListener('click', () => {
                const target = document.getElementById('customer-auth-modal') ? 'customer-auth-modal' : 'auth-modal';
                openModal(target);
            });
        }
    }

    // ─── Back to Top ───
    function setupBackToTop() {
        const btn = document.getElementById('back-to-top');
        if (!btn) return;

        window.addEventListener('scroll', () => {
            btn.classList.toggle('visible', window.scrollY > 400);
        });

        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ─── Toast Notifications ───
    function showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon"><i class="${icons[type] || icons.info}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${Security.sanitizeHTML(title)}</div>
                <div class="toast-message">${Security.sanitizeHTML(message)}</div>
            </div>
            <button class="toast-close" type="button"><i class="fas fa-times"></i></button>
        `;

        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            removeToast(toast);
        });

        setTimeout(() => removeToast(toast), 4000);
    }

    function removeToast(toast) {
        if (!toast || !toast.parentElement) return;
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }

    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        openCart,
        closeCart,
        openModal,
        closeModal,
        showToast
    });
})();
