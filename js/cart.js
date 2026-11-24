/**
 * ============================================
 *  CART.JS — Shopping Cart Module
 *  Architecture: Modular, Event-Driven, Strict CSP Compliant
 * ============================================
 */
'use strict';

const Cart = (() => {
    const STORAGE_KEY = 'tokoku_cart';
    const MAX_ITEMS = 50;
    const MAX_QUANTITY = 99;

    let items = [];

    function init() {
        loadCart();
        setupCartDelegation();
        updateUI();
    }

    // ─── Load from localStorage ───
    function loadCart() {
        const stored = Security.safeGetStorage(STORAGE_KEY);
        if (Array.isArray(stored)) {
            // Validate each item
            items = stored.filter(item =>
                item &&
                typeof item.id === 'string' &&
                typeof item.quantity === 'number' &&
                item.quantity > 0 &&
                item.quantity <= MAX_QUANTITY &&
                ProductsData.some(p => p.id === item.id)
            ).slice(0, MAX_ITEMS);
        }
    }

    // ─── Save to localStorage ───
    function saveCart() {
        Security.safeSetStorage(STORAGE_KEY, items.map(({ id, quantity }) => ({ id, quantity })));
    }

    // ─── Add Item ───
    function addItem(productId, quantity = 1) {
        // Rate limit: max 10 additions per 10 seconds
        if (!Security.checkRateLimit('cart_add', 10, 10000)) {
            UI.showToast('Peringatan', 'Terlalu banyak permintaan. Silakan tunggu.', 'error');
            return;
        }

        const product = ProductsData.find(p => p.id === productId);
        if (!product) return;

        const existing = items.find(i => i.id === productId);
        if (existing) {
            const newQty = existing.quantity + quantity;
            if (newQty > product.stock) {
                UI.showToast('Stok Tidak Cukup', `Stok ${product.name} hanya tersisa ${product.stock}`, 'error');
                return;
            }
            if (newQty > MAX_QUANTITY) {
                UI.showToast('Batas Maksimum', `Maksimum pembelian ${MAX_QUANTITY} per item`, 'error');
                return;
            }
            existing.quantity = newQty;
        } else {
            if (items.length >= MAX_ITEMS) {
                UI.showToast('Keranjang Penuh', `Maksimum kapasitas ${MAX_ITEMS} item`, 'error');
                return;
            }
            if (quantity > product.stock) {
                UI.showToast('Stok Tidak Cukup', `Stok ${product.name} hanya tersisa ${product.stock}`, 'error');
                return;
            }
            items.push({ id: productId, quantity: Math.min(quantity, MAX_QUANTITY) });
        }

        saveCart();
        updateUI();
        UI.showToast('Berhasil! 🛒', `${product.name} ditambahkan ke keranjang`, 'success');
        bumpCartBadge();
    }

    // ─── Remove Item ───
    function removeItem(productId) {
        const product = ProductsData.find(p => p.id === productId);
        items = items.filter(i => i.id !== productId);
        saveCart();
        updateUI();
        if (product) {
            UI.showToast('Dihapus', `${product.name} dihapus dari keranjang`, 'info');
        }
    }

    // ─── Update Quantity ───
    function updateQuantity(productId, delta) {
        const item = items.find(i => i.id === productId);
        if (!item) return;

        const product = ProductsData.find(p => p.id === productId);
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            removeItem(productId);
            return;
        }

        if (product && newQty > product.stock) {
            UI.showToast('Stok Tidak Cukup', `Stok ${product.name} hanya tersisa ${product.stock}`, 'error');
            return;
        }

        if (newQty > MAX_QUANTITY) return;

        item.quantity = newQty;
        saveCart();
        updateUI();
    }

    // ─── Get Cart Data ───
    function getItems() {
        return items.map(item => {
            const product = ProductsData.find(p => p.id === item.id);
            const price = ProductPrices[item.id] || { price: 0 };
            const image = ProductImages[item.id] || ProductImages['default'];
            return {
                ...item,
                product,
                price: price.price,
                image,
                subtotal: price.price * item.quantity
            };
        }).filter(item => item.product);
    }

    function getTotal() {
        return getItems().reduce((sum, item) => sum + item.subtotal, 0);
    }

    function getCount() {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    }

    function clear() {
        items = [];
        saveCart();
        updateUI();
    }

    // ─── Update UI ───
    function updateUI() {
        updateCartCount();
        renderCartItems();
        updateCartFooter();
    }

    function updateCartCount() {
        const count = getCount();
        const badges = document.querySelectorAll('#cart-count, #mobile-cart-count');
        badges.forEach(badge => {
            badge.textContent = count;
        });
    }

    function bumpCartBadge() {
        const badge = document.getElementById('cart-count');
        if (badge) {
            badge.classList.remove('bump');
            void badge.offsetWidth; // Force reflow
            badge.classList.add('bump');
        }
    }

    function renderCartItems() {
        const container = document.getElementById('cart-items');
        const emptyState = document.getElementById('cart-empty');
        if (!container) return;

        const cartItems = getItems();

        if (cartItems.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                container.appendChild(emptyState);
                emptyState.classList.remove('hidden');
            }
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        container.innerHTML = cartItems.map(item => `
            <div class="cart-item" data-item-id="${Security.sanitizeHTML(item.id)}">
                <div class="cart-item-image">
                    <img src="${Security.sanitizeHTML(item.image)}" alt="${Security.sanitizeHTML(item.product.name)}" loading="lazy">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${Security.sanitizeHTML(item.product.name)}</div>
                    <div class="cart-item-price">${formatRupiah(item.price)}</div>
                    <div class="cart-item-controls">
                        <button type="button" data-cart-action="dec" data-id="${Security.sanitizeHTML(item.id)}" aria-label="Kurangi jumlah">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span>${item.quantity}</span>
                        <button type="button" data-cart-action="inc" data-id="${Security.sanitizeHTML(item.id)}" aria-label="Tambah jumlah">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <button type="button" class="cart-item-remove" data-cart-action="remove" data-id="${Security.sanitizeHTML(item.id)}" aria-label="Hapus dari keranjang">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
    }

    // ─── Setup Event Delegation for Cart Actions (Zero Inline JS) ───
    function setupCartDelegation() {
        const container = document.getElementById('cart-items');
        if (!container) return;

        // Image error fallback
        container.addEventListener('error', (e) => {
            if (e.target && e.target.tagName === 'IMG') {
                e.target.src = ProductImages['default'];
            }
        }, true);

        // Click delegation
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-cart-action]');
            if (!btn) return;

            const action = btn.getAttribute('data-cart-action');
            const id = btn.getAttribute('data-id');
            if (!id) return;

            if (action === 'dec') {
                updateQuantity(id, -1);
            } else if (action === 'inc') {
                updateQuantity(id, 1);
            } else if (action === 'remove') {
                removeItem(id);
            }
        });
    }

    function updateCartFooter() {
        const footer = document.getElementById('cart-footer');
        const totalEl = document.getElementById('cart-total-price');
        if (!footer || !totalEl) return;

        const count = getCount();
        footer.style.display = count > 0 ? 'block' : 'none';
        totalEl.textContent = formatRupiah(getTotal());
    }

    // Init on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return Object.freeze({
        addItem,
        removeItem,
        updateQuantity,
        getItems,
        getTotal,
        getCount,
        clear
    });
})();
