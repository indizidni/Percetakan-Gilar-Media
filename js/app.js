/**
 * ============================================
 *  APP.JS — Core Application Logic
 *  Architecture: Modular, Event-Driven, Strict CSP Compliant
 * ============================================
 */
'use strict';

const App = (() => {
    let currentFilter = 'all';
    let searchQuery = '';

    function init() {
        renderCategories();
        renderProducts();
        setupProductGridEvents();
        setupSearch();
        setupFilters();
        setupCategoryCards();
        animateStats();
        setupIntersectionObserver();

        // Refresh and attach CSRF token
        Security.refreshCSRFToken();

        // Hide page loader with smooth fadeout
        setTimeout(() => {
            const loader = document.getElementById('page-loader');
            if (loader) loader.classList.add('loaded');
        }, 600);
    }

    // ─── Render Categories ───
    function renderCategories() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = CategoriesData.map(cat => `
            <div class="category-card ${cat.id === 'all' ? 'active' : ''}" data-category="${Security.sanitizeHTML(cat.id)}">
                <div class="category-icon">
                    <i class="${Security.sanitizeHTML(cat.icon)}"></i>
                </div>
                <h4>${Security.sanitizeHTML(cat.name)}</h4>
                <span>${cat.count} produk</span>
            </div>
        `).join('');
    }

    // ─── Render Products ───
    function renderProducts(filter = 'all', query = '') {
        const grid = document.getElementById('products-grid');
        const empty = document.getElementById('products-empty');
        if (!grid) return;

        let filtered = ProductsData;

        if (filter !== 'all') {
            filtered = filtered.filter(p => p.category === filter);
        }

        if (query) {
            const q = query.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');

        grid.innerHTML = filtered.map(product => {
            const priceData = ProductPrices[product.id] || { price: 0, originalPrice: 0, discount: 0 };
            const imageUrl = ProductImages[product.id] || ProductImages['default'];
            const stars = generateStars(product.rating);

            return `
                <div class="product-card" data-product-id="${Security.sanitizeHTML(product.id)}" data-category="${Security.sanitizeHTML(product.category)}">
                    <div class="product-image">
                        <img src="${Security.sanitizeHTML(imageUrl)}" alt="${Security.sanitizeHTML(product.name)}" loading="lazy" class="product-img">
                        ${product.badge ? `<span class="product-badge ${Security.sanitizeHTML(product.badge)}">${getBadgeText(product.badge)}</span>` : ''}
                        <button class="product-wishlist" data-action="wishlist" aria-label="Simpan ke wishlist">
                            <i class="far fa-heart"></i>
                        </button>
                        <div class="product-actions-overlay">
                            <button class="btn btn-primary btn-sm" data-action="add-cart" data-id="${Security.sanitizeHTML(product.id)}">
                                <i class="fas fa-cart-plus"></i> Tambah
                            </button>
                            <button class="btn btn-outline btn-sm" data-action="view-detail" data-id="${Security.sanitizeHTML(product.id)}">
                                <i class="fas fa-eye"></i> Detail
                            </button>
                        </div>
                    </div>
                    <div class="product-info">
                        <span class="product-category">${Security.sanitizeHTML(product.category)}</span>
                        <h3 class="product-name">${Security.sanitizeHTML(product.name)}</h3>
                        <div class="product-rating">
                            <span class="stars">${stars}</span>
                            <span class="rating-count">(${product.ratingCount.toLocaleString('id-ID')})</span>
                        </div>
                        <div class="product-price-row">
                            <div class="product-price">
                                <span class="current-price">${formatRupiah(priceData.price)}</span>
                                ${priceData.originalPrice > priceData.price ? `<span class="original-price">${formatRupiah(priceData.originalPrice)}</span>` : ''}
                            </div>
                            <button class="add-to-cart-btn" data-action="add-cart" data-id="${Security.sanitizeHTML(product.id)}" aria-label="Tambah ke keranjang">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─── Setup Product Grid Delegated Events (Zero Inline JS) ───
    function setupProductGridEvents() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;

        // Image error fallback using event capturing
        grid.addEventListener('error', (e) => {
            if (e.target && e.target.tagName === 'IMG') {
                e.target.src = ProductImages['default'];
            }
        }, true);

        // Click delegation
        grid.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.stopPropagation();
                const action = actionBtn.getAttribute('data-action');
                const id = actionBtn.getAttribute('data-id');

                if (action === 'add-cart' && id) {
                    Cart.addItem(id);
                } else if (action === 'view-detail' && id) {
                    showProductDetail(id);
                } else if (action === 'wishlist') {
                    actionBtn.classList.toggle('active');
                    const icon = actionBtn.querySelector('i');
                    if (icon) {
                        icon.classList.toggle('far');
                        icon.classList.toggle('fas');
                    }
                }
                return;
            }

            const card = e.target.closest('.product-card');
            if (card) {
                const id = card.getAttribute('data-product-id');
                if (id) showProductDetail(id);
            }
        });
    }

    // ─── Product Detail Modal ───
    function showProductDetail(productId) {
        const product = ProductsData.find(p => p.id === productId);
        if (!product) return;

        const priceData = ProductPrices[product.id] || { price: 0, originalPrice: 0, discount: 0 };
        const imageUrl = ProductImages[product.id] || ProductImages['default'];
        const stars = generateStars(product.rating);

        const detail = document.getElementById('product-detail');
        detail.innerHTML = `
            <div class="product-detail-image">
                <img src="${Security.sanitizeHTML(imageUrl)}" alt="${Security.sanitizeHTML(product.name)}" id="detail-product-img">
            </div>
            <div class="product-detail-info">
                <span class="product-category">${Security.sanitizeHTML(product.category)}</span>
                <h2>${Security.sanitizeHTML(product.name)}</h2>
                <div class="product-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-count">${product.rating} (${product.ratingCount.toLocaleString('id-ID')} ulasan)</span>
                </div>
                <div class="product-detail-price">
                    <span class="current-price">${formatRupiah(priceData.price)}</span>
                    ${priceData.originalPrice > priceData.price ? `
                        <span class="original-price">${formatRupiah(priceData.originalPrice)}</span>
                        <span class="discount-badge">-${priceData.discount}%</span>
                    ` : ''}
                </div>
                <p class="product-description">${Security.sanitizeHTML(product.description)}</p>
                <p style="color: var(--success); font-size: 0.9rem; margin-bottom: 1rem; font-weight: 600;">
                    <i class="fas fa-check-circle"></i> Stok tersedia: ${product.stock} pcs
                </p>
                <div class="product-detail-actions">
                    <div class="quantity-control">
                        <button type="button" id="qty-decrease" aria-label="Kurangi jumlah"><i class="fas fa-minus"></i></button>
                        <span id="qty-value">1</span>
                        <button type="button" id="qty-increase" aria-label="Tambah jumlah"><i class="fas fa-plus"></i></button>
                    </div>
                    <button type="button" class="btn btn-primary" id="detail-add-cart">
                        <i class="fas fa-cart-plus"></i> Tambah ke Keranjang
                    </button>
                </div>
            </div>
        `;

        // Image error fallback
        const detailImg = document.getElementById('detail-product-img');
        if (detailImg) {
            detailImg.addEventListener('error', () => {
                detailImg.src = ProductImages['default'];
            });
        }

        // Quantity controls
        let qty = 1;
        const qtyValue = document.getElementById('qty-value');
        const decBtn = document.getElementById('qty-decrease');
        const incBtn = document.getElementById('qty-increase');
        const addBtn = document.getElementById('detail-add-cart');

        if (decBtn) {
            decBtn.addEventListener('click', () => {
                if (qty > 1) { qty--; qtyValue.textContent = qty; }
            });
        }

        if (incBtn) {
            incBtn.addEventListener('click', () => {
                if (qty < product.stock) { qty++; qtyValue.textContent = qty; }
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                Cart.addItem(productId, qty);
                UI.closeModal('product-modal');
            });
        }

        UI.openModal('product-modal');
    }

    // ─── Search ───
    function setupSearch() {
        const input = document.getElementById('search-input');
        const suggestions = document.getElementById('search-suggestions');
        if (!input) return;

        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = Security.sanitizeInput(input.value);
                searchQuery = query;

                if (query.length >= 2) {
                    showSearchSuggestions(query);
                } else {
                    if (suggestions) suggestions.classList.add('hidden');
                    if (query.length === 0) renderProducts(currentFilter);
                }
            }, 250);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestions) suggestions.classList.add('hidden');
                renderProducts(currentFilter, searchQuery);
            }
        });

        // Close suggestions on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-search') && suggestions) {
                suggestions.classList.add('hidden');
            }
        });
    }

    function showSearchSuggestions(query) {
        const suggestions = document.getElementById('search-suggestions');
        if (!suggestions) return;

        const q = query.toLowerCase();
        const results = ProductsData.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        ).slice(0, 5);

        if (results.length === 0) {
            suggestions.classList.add('hidden');
            return;
        }

        suggestions.innerHTML = results.map(p => {
            const img = ProductImages[p.id] || ProductImages['default'];
            const price = ProductPrices[p.id] || { price: 0 };
            return `
                <div class="search-suggestion-item" data-product-id="${Security.sanitizeHTML(p.id)}">
                    <img src="${Security.sanitizeHTML(img)}" alt="${Security.sanitizeHTML(p.name)}" loading="lazy">
                    <div class="suggestion-info">
                        <div class="suggestion-name">${Security.sanitizeHTML(p.name)}</div>
                        <div class="suggestion-price">${formatRupiah(price.price)}</div>
                    </div>
                </div>
            `;
        }).join('');

        suggestions.classList.remove('hidden');

        suggestions.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-product-id');
                if (id) showProductDetail(id);
                suggestions.classList.add('hidden');
            });
        });
    }

    // ─── Filters ───
    function setupFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter') || 'all';
                renderProducts(currentFilter, searchQuery);

                // Sync category cards
                document.querySelectorAll('.category-card').forEach(c => {
                    c.classList.toggle('active', c.getAttribute('data-category') === currentFilter);
                });
            });
        });
    }

    function setupCategoryCards() {
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card');
            if (!card) return;

            const category = card.getAttribute('data-category') || 'all';
            currentFilter = category;

            document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-filter') === category);
            });

            renderProducts(currentFilter, searchQuery);

            // Scroll smoothly to products section
            const prodSection = document.getElementById('products');
            if (prodSection) {
                prodSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // ─── Stats Counter Animation ───
    function animateStats() {
        const stats = document.querySelectorAll('.stat-number');
        stats.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-count') || '0', 10);
            let current = 0;
            const increment = Math.max(1, Math.floor(target / 50));
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    stat.textContent = target.toLocaleString('id-ID');
                    clearInterval(timer);
                } else {
                    stat.textContent = Math.floor(current).toLocaleString('id-ID');
                }
            }, 25);
        });
    }

    // ─── Intersection Observer ───
    function setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    }

    // ─── Helpers ───
    function generateStars(rating) {
        const full = Math.floor(rating);
        const half = rating % 1 >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '<i class="fas fa-star"></i>'.repeat(full) +
               (half ? '<i class="fas fa-star-half-alt"></i>' : '') +
               '<i class="far fa-star"></i>'.repeat(empty);
    }

    function getBadgeText(badge) {
        const texts = { sale: 'SALE', new: 'BARU', hot: 'HOT' };
        return texts[badge] || '';
    }

    return Object.freeze({
        init,
        renderProducts,
        showProductDetail,
        getCurrentFilter: () => currentFilter
    });
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
