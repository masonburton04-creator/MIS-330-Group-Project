// =============================================================
// Crimson Supply - index.js
// The core of the front end:
//   * shared helpers (calling the API, formatting, toasts, modals)
//   * the router that shows one <section class="view"> at a time
//   * the storefront pages: home, shop/search, product detail, kits
//
// Other files add the rest of the site:
//   cart.js    -> bag, checkout, order receipt
//   account.js -> sign in, register, profile, order history
//   admin.js   -> admin workspace and reports
// =============================================================

// ===== Shared settings and state =====

const LOW_STOCK_LIMIT = 10;      // same threshold the admin reports use
const TAX_RATE = 0.08;           // shown as an estimate; the API calculates the real total
const NEW_PRODUCT_DAYS = 21;     // products added within this many days get a "New" badge
const PLACEHOLDER_IMAGE = 'Resources/Images/products/placeholder.svg';

const state = {
    user: null,                  // the signed-in user (from /api/account/me), or null
    categories: [],              // all categories, loaded once at startup
    bestSellerIds: new Set(),    // top sellers, used for "Bestseller" badges
    products: new Map(),         // every product we've displayed, by id (used by "Add" buttons)
    currentView: null
};

// Ready-made kits on the home and Kits pages.
// Each kit is a list of SKUs; the products themselves (price, stock, picture)
// always come live from the database.
const KITS = [
    {
        id: 'lecture',
        name: 'The Lecture Kit',
        tagline: 'A full semester of notes, color-coded.',
        skus: ['NBP-202', 'WRT-101', 'WRT-104', 'BAG-502']
    },
    {
        id: 'studio',
        name: 'The Studio Kit',
        tagline: 'Sketch, paint, cut, repeat.',
        skus: ['ART-601', 'ART-602', 'WRT-102', 'ART-604']
    },
    {
        id: 'desk',
        name: 'The Desk Reset',
        tagline: 'A calmer, faster workspace.',
        skus: ['DSK-301', 'DSK-305', 'TEC-402', 'TEC-404']
    }
];


// ===== Calling the API =====

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

// Every request to the C# API goes through this function.
// path is relative to /api/, e.g. api('products?categoryId=2').
// The browser sends the login cookie automatically (same site).
async function api(path, options = {}) {
    const settings = { method: options.method || 'GET', headers: {} };
    if (options.body !== undefined) {
        settings.headers['Content-Type'] = 'application/json';
        settings.body = JSON.stringify(options.body);
    }

    let response;
    try {
        response = await fetch('/api/' + path, settings);
    } catch {
        throw new ApiError("We couldn't reach the Crimson Supply server. Please check that the API is running.", 0);
    }

    // The API returns JSON for data and plain text for error messages
    const text = await response.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!response.ok) {
        let message = typeof data === 'string' && data ? data : 'Something went wrong. Please try again.';
        if (data && data.errors) {
            message = 'Some of the values entered are not valid. Please check the form.';
        }
        if (response.status === 403) {
            message = 'That action needs an admin account.';
        }
        throw new ApiError(message, response.status);
    }
    return data;
}


// ===== Formatting helpers =====

// Escapes text before it is placed inside HTML, so a product name like
// "<b>Pen</b>" is shown as text instead of becoming real HTML.
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
function money(amount) {
    return moneyFormat.format(Number(amount) || 0);
}

function formatDate(value, withTime = false) {
    const date = new Date(value);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    if (withTime) {
        options.hour = 'numeric';
        options.minute = '2-digit';
    }
    return date.toLocaleString('en-US', options);
}

function icon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function productImage(imageUrl) {
    return imageUrl ? esc(imageUrl) : PLACEHOLDER_IMAGE;
}

// <img> with a graceful fallback: if the picture is missing, show the placeholder
function imgTag(imageUrl, alt, extra = '') {
    return `<img src="${productImage(imageUrl)}" alt="${esc(alt)}" loading="lazy" ${extra}
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">`;
}

function stockInfo(stock) {
    if (stock <= 0) return { label: 'Sold out', css: 'out' };
    if (stock <= LOW_STOCK_LIMIT) return { label: `Only ${stock} left`, css: 'low' };
    return { label: 'In stock', css: 'in' };
}

function isNewProduct(product) {
    const ageInDays = (Date.now() - new Date(product.createdAt)) / 86400000;
    return ageInDays <= NEW_PRODUCT_DAYS;
}

function initials(user) {
    return ((user.firstName[0] || '') + (user.lastName[0] || '')).toUpperCase();
}


// ===== Shared UI pieces =====

// Remembers products so "Add to bag" buttons can find them by id
function rememberProducts(products) {
    products.forEach(product => state.products.set(product.productId, product));
}

function productCard(product) {
    const stock = stockInfo(product.stockQuantity);
    let badge = '';
    if (product.stockQuantity <= 0) badge = '<span class="badge-sticker sold">Sold out</span>';
    else if (state.bestSellerIds.has(product.productId)) badge = '<span class="badge-sticker best">Bestseller</span>';
    else if (isNewProduct(product)) badge = '<span class="badge-sticker new">New</span>';

    return `
        <article class="product-card">
            <a class="product-media" href="#/product/${product.productId}" tabindex="-1" aria-hidden="true">
                ${imgTag(product.imageUrl, '')}
                ${badge}
            </a>
            <div class="product-body">
                <p class="product-cat">${esc(product.categoryName)}</p>
                <h3 class="product-name"><a href="#/product/${product.productId}">${esc(product.productName)}</a></h3>
                <p class="stock-line ${stock.css}"><span class="stock-dot"></span>${stock.label}</p>
                <div class="product-foot">
                    <span class="price">${money(product.price)}</span>
                    <button class="add-button" type="button" data-add-id="${product.productId}"
                            ${product.stockQuantity <= 0 ? 'disabled' : ''}
                            aria-label="Add ${esc(product.productName)} to bag">
                        ${product.stockQuantity <= 0 ? 'Sold out' : icon('plus') + '<span>Add</span>'}
                    </button>
                </div>
            </div>
        </article>`;
}

function skeletonCards(count) {
    return Array.from({ length: count }, () => `
        <div class="product-card skeleton" aria-hidden="true">
            <div class="product-media"></div>
            <div class="product-body"><span class="sk-line w40"></span><span class="sk-line w80"></span><span class="sk-line w60"></span></div>
        </div>`).join('');
}

// A friendly error panel with a "Try again" button that re-runs the current page
function errorState(message) {
    return `
        <div class="empty-state error">
            <div class="empty-icon">${icon('alert')}</div>
            <h3>That didn't load.</h3>
            <p>${esc(message)}</p>
            <button class="btn-cs btn-cs-dark" type="button" data-retry>${icon('refresh')} Try again</button>
        </div>`;
}

function emptyState(title, message, actionHtml = '') {
    return `
        <div class="empty-state">
            <div class="empty-doodle" aria-hidden="true">
                <svg viewBox="0 0 120 90"><rect x="18" y="14" width="70" height="62" rx="4" fill="#FFFDF9" stroke="#2A2420" stroke-width="3"/><path d="M30 32h46M30 44h46M30 56h30" stroke="#E3D9CB" stroke-width="3"/><circle cx="82" cy="58" r="16" fill="#F7F2EA" stroke="#A3132E" stroke-width="4"/><path d="m93 70 12 12" stroke="#A3132E" stroke-width="5" stroke-linecap="round"/></svg>
            </div>
            <h3>${esc(title)}</h3>
            <p>${message}</p>
            ${actionHtml}
        </div>`;
}

// Small pop-up messages in the corner. type: 'success', 'error' or 'info'.
function showToast(message, type = 'info', link = null) {
    const stack = document.getElementById('toastStack');
    const toast = document.createElement('div');
    toast.className = `toast-note ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
        <span class="toast-icon">${icon(type === 'error' ? 'alert' : 'check')}</span>
        <span class="toast-text">${esc(message)}</span>
        ${link ? `<a href="${link.href}" class="toast-link">${esc(link.label)}</a>` : ''}`;
    stack.appendChild(toast);

    setTimeout(() => toast.classList.add('leaving'), type === 'error' ? 6000 : 3500);
    setTimeout(() => toast.remove(), type === 'error' ? 6400 : 3900);
}

// ----- The shared Bootstrap modal -----
const modalElement = () => document.getElementById('appModal');

function openModal({ title, body, footer = '', size = '' }) {
    document.getElementById('appModalTitle').textContent = title;
    document.getElementById('appModalBody').innerHTML = body;
    document.getElementById('appModalFooter').innerHTML = footer;
    document.getElementById('appModalFooter').hidden = footer === '';
    document.getElementById('appModalDialog').className =
        'modal-dialog modal-dialog-centered modal-dialog-scrollable ' + (size ? 'modal-' + size : '');
    bootstrap.Modal.getOrCreateInstance(modalElement()).show();
}

function closeModal() {
    bootstrap.Modal.getOrCreateInstance(modalElement()).hide();
}

// Asks the user to confirm a risky action. Returns a Promise of true/false.
function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise(resolve => {
        let confirmed = false;
        openModal({
            title,
            body: `<p class="confirm-text">${message}</p>`,
            footer: `
                <button type="button" class="btn-cs btn-cs-ghost" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn-cs ${danger ? 'btn-cs-danger' : 'btn-cs-dark'}" id="confirmYes">${esc(confirmLabel)}</button>`,
            size: 'sm'
        });
        document.getElementById('confirmYes').addEventListener('click', () => {
            confirmed = true;
            closeModal();
        }, { once: true });
        modalElement().addEventListener('hidden.bs.modal', () => resolve(confirmed), { once: true });
    });
}

// Disables a button and shows a spinner while an async action runs
async function withBusyButton(button, work) {
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Working…';
    try {
        return await work();
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}


// ===== Router =====
// The address after "#" decides which section is visible, e.g.
//   #/                 home           #/product/12       product detail
//   #/shop?category=2  shop           #/checkout         checkout
//   #/account/orders   account        #/admin/reports    admin workspace
// Using the hash means the browser's Back button works and links can be shared,
// while the whole site stays in one HTML file.

// Each entry is wrapped in an arrow function because some of these functions live in
// cart.js, account.js and admin.js, which load after this file.
const routes = {
    '': route => showHome(route),
    'shop': route => showShop(route),
    'product': route => showProduct(route),
    'kits': route => showKits(route),
    'checkout': route => showCheckout(route),   // cart.js
    'order': route => showOrder(route),         // cart.js
    'signin': route => showAuth(route),         // account.js
    'register': route => showAuth(route),       // account.js
    'account': route => showAccount(route),     // account.js
    'admin': route => showAdmin(route)          // admin.js
};

function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = hash.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || '', parts, params: new URLSearchParams(query) };
}

function router() {
    const route = parseRoute();
    const handler = routes[route.name];

    // Close the mobile menu and the bag drawer after navigating.
    // (Links inside the drawer can't use data-bs-dismiss: Bootstrap blocks a link's
    // navigation when it closes the drawer, so the drawer is closed here instead.)
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(mobileNav).hide();
    }
    const cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer.classList.contains('show')) {
        bootstrap.Offcanvas.getOrCreateInstance(cartDrawer).hide();
    }

    // The header search box only keeps its text while showing search results
    if (route.name !== 'shop') {
        document.getElementById('headerSearchInput').value = '';
    }

    if (handler) {
        handler(route);
    } else {
        showView('notfound');
    }
}

// Shows one view and hides the others
function showView(name) {
    if (state.currentView !== name) {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    state.currentView = name;

    document.querySelectorAll('.view').forEach(view => {
        view.hidden = view.id !== 'view-' + name;
    });
    document.body.dataset.view = name;

    // Highlight the matching main-nav link
    const route = parseRoute();
    document.querySelectorAll('[data-nav]').forEach(link => {
        const isNew = route.params.get('sort') === 'newest';
        const active = (link.dataset.nav === 'shop' && name === 'shop' && !isNew)
            || (link.dataset.nav === 'new' && name === 'shop' && isNew)
            || (link.dataset.nav === 'kits' && name === 'kits');
        link.classList.toggle('active', active);
    });
}

function go(hash) {
    if (location.hash === hash) {
        router();
    } else {
        location.hash = hash;
    }
}


// ===== Categories (header menu, footer, filters) =====

async function loadCategories() {
    try {
        state.categories = await api('categories');
    } catch {
        state.categories = [];
    }

    const links = state.categories.map(c =>
        `<a href="#/shop?category=${c.categoryId}">${esc(c.categoryName)}</a>`);

    document.getElementById('deptMenu').innerHTML = state.categories.map(c => `
        <li><a class="dropdown-item" href="#/shop?category=${c.categoryId}">
            <span>${esc(c.categoryName)}</span><span class="dept-count">${c.productCount}</span>
        </a></li>`).join('') || '<li><span class="dropdown-item-text">No departments yet</span></li>';
    document.getElementById('mobileDepts').innerHTML = links.join('');
    document.getElementById('footerDepts').innerHTML = links.map(link => `<li>${link}</li>`).join('');
}

function categoryName(categoryId) {
    const category = state.categories.find(c => c.categoryId === Number(categoryId));
    return category ? category.categoryName : '';
}

// The top 4 sellers get a "Bestseller" badge everywhere they appear
async function loadBestSellers() {
    try {
        const top = await api('products?sort=popular&limit=4');
        state.bestSellerIds = new Set(top.filter(p => p.unitsSold > 0).map(p => p.productId));
        return top;
    } catch {
        return [];
    }
}


// ===== HOME =====

async function showHome() {
    showView('home');
    renderHomeDepartments([]);

    const best = document.getElementById('homeBestSellers');
    const fresh = document.getElementById('homeNewArrivals');
    best.innerHTML = skeletonCards(4);
    fresh.innerHTML = skeletonCards(4);
    document.getElementById('homeKits').innerHTML = '';

    try {
        // Three requests run at the same time; each uses a different server-side sort
        const [popular, newest, all] = await Promise.all([
            loadBestSellers(),
            api('products?sort=newest&limit=8'),
            api('products')
        ]);
        rememberProducts(all);

        renderHero(popular.length ? popular : all.slice(0, 3), all);
        renderHomeDepartments(all);

        best.innerHTML = popular.length
            ? popular.map(productCard).join('')
            : emptyState('No best sellers yet', 'Once orders come in, the most popular products will show up here.');
        fresh.innerHTML = newest.map(productCard).join('');
        renderKitCards(document.getElementById('homeKits'), all);
    } catch (error) {
        best.innerHTML = errorState(error.message);
        fresh.innerHTML = '';
    }
}

function renderHero(featured, all) {
    const stats = document.getElementById('heroStats');
    const inStock = all.filter(p => p.stockQuantity > 0).length;
    stats.innerHTML = `
        <div><dt>Products in stock</dt><dd>${inStock}</dd></div>
        <div><dt>Departments</dt><dd>${state.categories.length}</dd></div>
        <div><dt>Pickup</dt><dd>2 hrs</dd></div>`;

    // Up to three products laid out like items on a desk
    const board = document.querySelector('#heroArt .hero-board');
    board.innerHTML = featured.slice(0, 3).map((product, index) => `
        <a class="hero-tile tile-${index + 1}" href="#/product/${product.productId}" tabindex="-1">
            ${imgTag(product.imageUrl, '')}
            <span class="tape"></span>
        </a>`).join('') + (featured[0] ? `
        <div class="hero-receipt">
            <p class="mono">No. 1 this term</p>
            <p class="hero-receipt-name">${esc(featured[0].productName)}</p>
            <p class="hero-receipt-row"><span>${featured[0].unitsSold} sold</span><strong>${money(featured[0].price)}</strong></p>
        </div>` : '');
}

function renderHomeDepartments(allProducts) {
    const grid = document.getElementById('homeDepartments');
    if (state.categories.length === 0) {
        grid.innerHTML = emptyState('No departments yet', 'An admin can add categories from the admin workspace.');
        return;
    }

    grid.innerHTML = state.categories.map((category, index) => {
        // A fan of up to three product pictures from this department
        const pictures = allProducts.filter(p => p.categoryId === category.categoryId).slice(0, 3);
        return `
            <a class="dept-card" href="#/shop?category=${category.categoryId}" style="--i:${index}">
                <span class="dept-tab">${String(index + 1).padStart(2, '0')}</span>
                <div class="dept-fan" aria-hidden="true">
                    ${pictures.map(p => imgTag(p.imageUrl, '')).join('')}
                </div>
                <div class="dept-text">
                    <h3>${esc(category.categoryName)}</h3>
                    <p>${esc(category.description || '')}</p>
                    <span class="dept-meta">${category.productCount} product${category.productCount === 1 ? '' : 's'} ${icon('arrow')}</span>
                </div>
            </a>`;
    }).join('');
}


// ===== KITS =====

// Finds a kit's products (in the kit's order) among the products loaded from the API
function kitProducts(kit, allProducts) {
    return kit.skus
        .map(sku => allProducts.find(p => p.sku === sku))
        .filter(product => product !== undefined);
}

function renderKitCards(container, allProducts) {
    const cards = KITS.map(kit => {
        const items = kitProducts(kit, allProducts);
        if (items.length === 0) return '';
        const total = items.reduce((sum, p) => sum + p.price, 0);
        return `
            <article class="kit-card">
                <div class="kit-collage" aria-hidden="true">
                    ${items.slice(0, 4).map(p => imgTag(p.imageUrl, '')).join('')}
                </div>
                <div class="kit-text">
                    <h3>${esc(kit.name)}</h3>
                    <p>${esc(kit.tagline)}</p>
                    <p class="kit-meta">${items.length} items · ${money(total)}</p>
                    <div class="kit-actions">
                        <button class="btn-cs btn-cs-light" type="button" data-add-kit="${kit.id}">${icon('bag')} Add kit to bag</button>
                        <a class="link-arrow light" href="#/kits?kit=${kit.id}">What's inside ${icon('arrow')}</a>
                    </div>
                </div>
            </article>`;
    }).join('');
    container.innerHTML = cards || emptyState('Kits are restocking', 'Check back soon.');
}

async function showKits(route) {
    showView('kits');
    const list = document.getElementById('kitsList');
    list.innerHTML = `<div class="product-grid">${skeletonCards(4)}</div>`;

    try {
        const all = await api('products');
        rememberProducts(all);

        list.innerHTML = KITS.map(kit => {
            const items = kitProducts(kit, all);
            if (items.length === 0) return '';
            const total = items.reduce((sum, p) => sum + p.price, 0);
            const available = items.filter(p => p.stockQuantity > 0).length;
            return `
                <section class="kit-section" id="kit-${kit.id}" aria-labelledby="kit-title-${kit.id}">
                    <div class="kit-section-head">
                        <div>
                            <h2 class="section-title" id="kit-title-${kit.id}">${esc(kit.name)}</h2>
                            <p class="page-lede">${esc(kit.tagline)} ${items.length} items for ${money(total)}.</p>
                        </div>
                        <button class="btn-cs btn-cs-primary" type="button" data-add-kit="${kit.id}" ${available === 0 ? 'disabled' : ''}>
                            ${icon('bag')} Add ${available === items.length ? 'all ' + items.length : available + ' in-stock'} items
                        </button>
                    </div>
                    <div class="product-grid">${items.map(productCard).join('')}</div>
                </section>`;
        }).join('') || emptyState('Kits are restocking', 'None of the kit products are available right now.');

        // #/kits?kit=studio scrolls to that kit
        const target = route.params.get('kit');
        if (target && document.getElementById('kit-' + target)) {
            document.getElementById('kit-' + target).scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        list.innerHTML = errorState(error.message);
    }
}

// Adds every in-stock product in a kit to the bag
function addKitToCart(kitId) {
    const kit = KITS.find(k => k.id === kitId);
    const items = kitProducts(kit, [...state.products.values()]).filter(p => p.stockQuantity > 0);
    if (items.length === 0) {
        showToast('Everything in this kit is sold out right now.', 'error');
        return;
    }
    items.forEach(product => addToCart(product, 1, { quiet: true }));
    showToast(`${kit.name}: ${items.length} items added to your bag.`, 'success', { label: 'Checkout', href: '#/checkout' });
}


// ===== SHOP / SEARCH =====

let shopRequestNumber = 0;   // ignores slow responses that arrive after a newer search

// Reads the filters from the address, e.g. #/shop?q=pen&category=1&min=5&max=20&stock=1&sort=price-asc
function readShopFilters(params) {
    return {
        q: (params.get('q') || '').trim(),
        category: params.get('category') || '',
        min: params.get('min') || '',
        max: params.get('max') || '',
        stock: params.get('stock') === '1',
        sort: params.get('sort') || 'featured'
    };
}

// Builds a shop address from a filter object (empty values are left out)
function shopHash(filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.min !== '') params.set('min', filters.min);
    if (filters.max !== '') params.set('max', filters.max);
    if (filters.stock) params.set('stock', '1');
    if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
    const query = params.toString();
    return '#/shop' + (query ? '?' + query : '');
}

function updateShopFilters(changes) {
    const current = readShopFilters(parseRoute().params);
    go(shopHash({ ...current, ...changes }));
}

async function showShop(route) {
    showView('shop');
    const filters = readShopFilters(route.params);

    // Page heading changes with the search/department
    const deptName = categoryName(filters.category);
    const category = state.categories.find(c => c.categoryId === Number(filters.category));
    let title = 'Everything';
    let lede = 'Every pen, pad, cable and kit we stock.';
    if (filters.q) {
        title = `Results for “${filters.q}”`;
        lede = deptName ? `Searching in ${deptName}.` : 'Searching every department.';
    } else if (deptName) {
        title = deptName;
        lede = category.description || '';
    } else if (filters.sort === 'newest') {
        title = 'New arrivals';
        lede = 'The latest additions to the shelves, newest first.';
    } else if (filters.sort === 'popular') {
        title = 'Best sellers';
        lede = 'Ranked by units sold.';
    }
    document.getElementById('shopTitle').textContent = title;
    document.getElementById('shopLede').textContent = lede;
    document.getElementById('shopCrumb').textContent = deptName || (filters.q ? 'Search' : 'Shop');
    document.getElementById('headerSearchInput').value = filters.q;

    // Keep the filter controls in sync with the address
    document.getElementById('filterCategories').innerHTML = `
        <label class="cat-option"><input type="radio" name="filterCategory" value="" ${filters.category === '' ? 'checked' : ''}>
            <span>All departments</span></label>
        ${state.categories.map(c => `
        <label class="cat-option"><input type="radio" name="filterCategory" value="${c.categoryId}" ${String(c.categoryId) === filters.category ? 'checked' : ''}>
            <span>${esc(c.categoryName)}</span><span class="cat-count">${c.productCount}</span></label>`).join('')}`;
    document.getElementById('filterMin').value = filters.min;
    document.getElementById('filterMax').value = filters.max;
    document.getElementById('filterInStock').checked = filters.stock;
    document.getElementById('sortSelect').value = filters.sort;
    renderActiveChips(filters, deptName);

    // Build the API request from the same filters
    const query = new URLSearchParams();
    if (filters.q) query.set('search', filters.q);
    if (filters.category) query.set('categoryId', filters.category);
    if (filters.min !== '') query.set('minPrice', filters.min);
    if (filters.max !== '') query.set('maxPrice', filters.max);
    if (filters.stock) query.set('inStock', 'true');
    query.set('sort', filters.sort);

    const grid = document.getElementById('shopGrid');
    const count = document.getElementById('resultsCount');
    grid.innerHTML = skeletonCards(8);
    count.textContent = 'Loading…';

    const requestNumber = ++shopRequestNumber;
    try {
        if (state.bestSellerIds.size === 0) await loadBestSellers();
        const products = await api('products?' + query.toString());
        if (requestNumber !== shopRequestNumber) return;   // a newer search already started

        rememberProducts(products);
        count.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
        grid.innerHTML = products.length
            ? products.map(productCard).join('')
            : emptyState('Nothing matches that… yet.',
                filters.q ? `We couldn't find anything for “${esc(filters.q)}”. Try a shorter word, like “pen” or “note”.`
                          : 'Try removing a filter or two.',
                '<a class="btn-cs btn-cs-dark" href="#/shop">Clear filters</a>');
    } catch (error) {
        if (requestNumber !== shopRequestNumber) return;
        count.textContent = '';
        grid.innerHTML = errorState(error.message);
    }
}

// Removable "chips" that summarize the active filters
function renderActiveChips(filters, deptName) {
    const chips = [];
    if (filters.q) chips.push({ label: `“${filters.q}”`, clear: { q: '' } });
    if (deptName) chips.push({ label: deptName, clear: { category: '' } });
    if (filters.min !== '' || filters.max !== '') {
        const label = filters.min !== '' && filters.max !== '' ? `${money(filters.min)}–${money(filters.max)}`
            : filters.min !== '' ? `From ${money(filters.min)}` : `Up to ${money(filters.max)}`;
        chips.push({ label, clear: { min: '', max: '' } });
    }
    if (filters.stock) chips.push({ label: 'In stock', clear: { stock: false } });

    document.getElementById('activeChips').innerHTML = chips.map(chip => `
        <button type="button" class="chip" data-clear='${esc(JSON.stringify(chip.clear))}'>
            ${esc(chip.label)} ${icon('x')}<span class="visually-hidden">remove filter</span>
        </button>`).join('');
}

function wireShopControls() {
    const form = document.getElementById('filterForm');

    // Department and in-stock apply immediately
    form.addEventListener('change', event => {
        if (event.target.name === 'filterCategory') {
            updateShopFilters({ category: event.target.value });
        } else if (event.target.id === 'filterInStock') {
            updateShopFilters({ stock: event.target.checked });
        }
    });

    // Prices apply when the form is submitted
    form.addEventListener('submit', event => {
        event.preventDefault();
        const min = document.getElementById('filterMin').value;
        const max = document.getElementById('filterMax').value;
        if (min !== '' && max !== '' && Number(min) > Number(max)) {
            showToast('The minimum price is higher than the maximum.', 'error');
            return;
        }
        updateShopFilters({ min, max });
    });

    document.querySelectorAll('[data-price]').forEach(button => {
        button.addEventListener('click', () => {
            const [min, max] = button.dataset.price.split('-');
            updateShopFilters({ min, max });
        });
    });

    document.getElementById('filterReset').addEventListener('click', () => go('#/shop'));
    document.getElementById('sortSelect').addEventListener('change', event => updateShopFilters({ sort: event.target.value }));

    document.getElementById('activeChips').addEventListener('click', event => {
        const chip = event.target.closest('[data-clear]');
        if (chip) updateShopFilters(JSON.parse(chip.dataset.clear));
    });

    // The header search box works from any page
    document.getElementById('headerSearch').addEventListener('submit', event => {
        event.preventDefault();
        const q = document.getElementById('headerSearchInput').value.trim();
        go(shopHash({ q, category: '', min: '', max: '', stock: false, sort: 'featured' }));
    });
}


// ===== PRODUCT DETAIL =====

async function showProduct(route) {
    showView('product');
    const container = document.getElementById('productDetail');
    const id = parseInt(route.parts[1], 10);

    container.innerHTML = `<div class="detail-grid"><div class="detail-media skeleton"></div>
        <div class="detail-info"><span class="sk-line w40"></span><span class="sk-line w80 tall"></span><span class="sk-line w60"></span></div></div>`;

    let product;
    try {
        product = await api('products/' + id);
    } catch (error) {
        container.innerHTML = error.status === 404
            ? emptyState('This product is off the shelf.', 'It may have been discontinued. Have a look at what else we stock.',
                '<a class="btn-cs btn-cs-dark" href="#/shop">Browse products</a>')
            : errorState(error.message);
        return;
    }
    rememberProducts([product]);
    if (state.bestSellerIds.size === 0) await loadBestSellers();

    const stock = stockInfo(product.stockQuantity);
    const maxQuantity = Math.min(product.stockQuantity, 99);
    // The stock meter fills up to 50 units
    const meterPercent = Math.min(100, Math.round(product.stockQuantity / 50 * 100));

    container.innerHTML = `
        <nav class="crumbs" aria-label="Breadcrumb">
            <a href="#/">Home</a><span>/</span>
            <a href="#/shop?category=${product.categoryId}">${esc(product.categoryName)}</a><span>/</span>
            <span>${esc(product.productName)}</span>
        </nav>

        <div class="detail-grid">
            <div class="detail-media">
                ${imgTag(product.imageUrl, product.productName)}
                ${state.bestSellerIds.has(product.productId) ? '<span class="badge-sticker best big">Bestseller</span>' : ''}
                ${!product.isActive ? '<span class="badge-sticker sold big">Hidden from store</span>' : ''}
            </div>

            <div class="detail-info">
                <a class="product-cat" href="#/shop?category=${product.categoryId}">${esc(product.categoryName)}</a>
                <h1 class="detail-title">${esc(product.productName)}</h1>
                <p class="detail-price">${money(product.price)}</p>

                <div class="stock-meter ${stock.css}">
                    <div class="stock-meter-head">
                        <span class="stock-line ${stock.css}"><span class="stock-dot"></span>${stock.label}</span>
                        <span class="mono">${product.stockQuantity} on the shelf</span>
                    </div>
                    <div class="stock-meter-bar"><span style="width:${meterPercent}%"></span></div>
                </div>

                ${product.stockQuantity > 0 ? `
                <div class="buy-row">
                    <div class="qty-stepper" data-max="${maxQuantity}">
                        <button type="button" data-step="-1" aria-label="Decrease quantity">${icon('minus')}</button>
                        <input type="number" id="detailQty" value="1" min="1" max="${maxQuantity}" aria-label="Quantity">
                        <button type="button" data-step="1" aria-label="Increase quantity">${icon('plus')}</button>
                    </div>
                    <button class="btn-cs btn-cs-primary btn-cs-lg grow" type="button" id="detailAdd">${icon('bag')} Add to bag</button>
                </div>` : `
                <div class="sold-out-note">${icon('alert')} Sold out for now. Restocks usually land within a week.</div>`}

                <p class="detail-desc">${esc(product.description || 'No description yet.')}</p>

                <dl class="spec-list">
                    <div><dt>SKU</dt><dd class="mono">${esc(product.sku)}</dd></div>
                    <div><dt>Department</dt><dd>${esc(product.categoryName)}</dd></div>
                    <div><dt>Sold so far</dt><dd>${product.unitsSold} unit${product.unitsSold === 1 ? '' : 's'}</dd></div>
                    <div><dt>On shelves since</dt><dd>${formatDate(product.createdAt)}</dd></div>
                </dl>

                <div class="pickup-card">
                    ${icon('store')}
                    <div><strong>Free pickup at the counter</strong><p>Ready about 2 hours after you order. Pay when you pick up.</p></div>
                </div>
            </div>
        </div>

        <section class="section" aria-labelledby="relatedHeading">
            <div class="section-head">
                <h2 class="section-title small" id="relatedHeading">More from ${esc(product.categoryName)}</h2>
                <a class="link-arrow" href="#/shop?category=${product.categoryId}">See all ${icon('arrow')}</a>
            </div>
            <div class="product-grid" id="relatedGrid">${skeletonCards(4)}</div>
        </section>`;

    if (product.stockQuantity > 0) {
        wireQuantityStepper(container.querySelector('.qty-stepper'));
        document.getElementById('detailAdd').addEventListener('click', event => {
            const quantity = parseInt(document.getElementById('detailQty').value, 10) || 1;
            if (addToCart(product, quantity)) flashAdded(event.currentTarget);
        });
    }

    // Related products: same category, without this one
    try {
        const related = (await api(`products?categoryId=${product.categoryId}&limit=5`))
            .filter(p => p.productId !== product.productId).slice(0, 4);
        rememberProducts(related);
        document.getElementById('relatedGrid').innerHTML = related.length
            ? related.map(productCard).join('')
            : '<p class="muted">This is the only product in this department right now.</p>';
    } catch {
        document.getElementById('relatedGrid').innerHTML = '';
    }
}

// The - / + quantity control (used on product pages and in the bag)
function wireQuantityStepper(stepper, onChange) {
    const input = stepper.querySelector('input');
    const max = Number(stepper.dataset.max);

    function setValue(value) {
        const clamped = Math.max(1, Math.min(max, Number.isFinite(value) ? value : 1));
        input.value = clamped;
        if (onChange) onChange(clamped);
    }
    stepper.querySelectorAll('[data-step]').forEach(button =>
        button.addEventListener('click', () => setValue(parseInt(input.value, 10) + Number(button.dataset.step))));
    input.addEventListener('change', () => setValue(parseInt(input.value, 10)));
}

// Briefly turns a button into "Added ✓"
function flashAdded(button) {
    const originalHtml = button.innerHTML;
    button.classList.add('added');
    button.innerHTML = `${icon('check')}<span>Added</span>`;
    setTimeout(() => {
        button.classList.remove('added');
        button.innerHTML = originalHtml;
    }, 1400);
}


// ===== Start-up =====

// One click listener for the whole page handles buttons that are created later
// (product "Add" buttons, kit buttons, "Try again" buttons).
document.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add-id]');
    if (addButton) {
        const product = state.products.get(Number(addButton.dataset.addId));
        if (product && addToCart(product, 1)) flashAdded(addButton);
        return;
    }

    const kitButton = event.target.closest('[data-add-kit]');
    if (kitButton) {
        addKitToCart(kitButton.dataset.addKit);
        return;
    }

    if (event.target.closest('[data-retry]')) {
        router();
    }
});

// Checks that this page was opened through the C# API, which serves both the page
// and its data. Opening index.html as a file, or with VS Code's Live Server
// (port 5500), loads the page but every /api/ request fails, so the store would be empty.
async function apiIsReachable() {
    if (location.protocol === 'file:') return false;
    try {
        const response = await fetch('/api/categories');
        return response.ok;
    } catch {
        return false;
    }
}

function showWrongAddressMessage() {
    document.getElementById('main').innerHTML = `<div class="container-xl">${emptyState(
        'Open the site through the API',
        `This page can't reach the Crimson Supply API from <strong>${esc(location.host || 'a local file')}</strong>.
         In a terminal, run <code>dotnet run</code> in the <code>API</code> folder, then open the site at the API's address.`,
        '<a class="btn-cs btn-cs-primary" href="http://localhost:5095/">Go to http://localhost:5095</a>')}</div>`;
}

async function startApp() {
    if (!(await apiIsReachable())) {
        showWrongAddressMessage();
        return;
    }

    wireShopControls();
    updateCartBadge();              // cart.js

    // Who is signed in, and which categories exist, are needed by most pages
    await Promise.all([loadSession(), loadCategories()]);   // loadSession is in account.js

    window.addEventListener('hashchange', router);
    router();
}

document.addEventListener('DOMContentLoaded', startApp);
