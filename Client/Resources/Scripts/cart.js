// =============================================================
// Crimson Supply - cart.js
// The shopping bag, checkout, and the order receipt page.
//
// The bag is saved in the browser's localStorage so it survives a
// page refresh, and guests can fill it before signing in. It only
// stores product ids and quantities plus a copy of the name/price
// for display. Before checkout, every item is re-checked against
// the API, and the server recalculates prices and stock itself.
// =============================================================

const CART_KEY = 'crimsonSupplyBag';

// ===== Order helpers shared with account.js and admin.js =====

function orderNumber(orderId) {
    return 'CS-' + String(orderId).padStart(5, '0');
}

function statusChip(status) {
    const css = {
        'Placed': 'placed',
        'Ready for Pickup': 'ready',
        'Completed': 'completed',
        'Cancelled': 'cancelled'
    }[status] || 'placed';
    return `<span class="status-chip ${css}">${esc(status)}</span>`;
}


// ===== Reading and saving the bag =====

function getCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];   // storage blocked or corrupted: start with an empty bag
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
        // Private browsing can block storage; the bag still works until the page reloads
    }
    updateCartBadge();
    if (document.getElementById('cartDrawer').classList.contains('show')) {
        renderCartDrawer();
    }
}

function cartUnitCount(cart = getCart()) {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartSubtotal(cart = getCart()) {
    return cart.filter(item => !item.unavailable)
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    const count = cartUnitCount();
    badge.textContent = count;
    badge.classList.toggle('empty', count === 0);
    // Restart the little "bump" animation
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
}


// ===== Changing the bag =====

// Adds a product. Never lets the bag hold more than the stock on hand (or 99).
// Returns true if anything was added.
function addToCart(product, quantity = 1, { quiet = false } = {}) {
    const cart = getCart();
    const limit = Math.min(product.stockQuantity, 99);
    let item = cart.find(i => i.productId === product.productId);
    const alreadyInBag = item ? item.quantity : 0;

    if (limit <= 0) {
        showToast(`${product.productName} is sold out.`, 'error');
        return false;
    }
    if (alreadyInBag >= limit) {
        showToast(`You already have all ${limit} available in your bag.`, 'error');
        return false;
    }

    const newQuantity = Math.min(limit, alreadyInBag + quantity);
    if (!item) {
        item = { productId: product.productId };
        cart.push(item);
    }
    // Keep a display copy of the product's details
    Object.assign(item, {
        sku: product.sku,
        productName: product.productName,
        categoryName: product.categoryName,
        price: product.price,
        imageUrl: product.imageUrl,
        stockQuantity: product.stockQuantity,
        quantity: newQuantity,
        unavailable: false
    });
    saveCart(cart);

    if (!quiet) {
        const added = newQuantity - alreadyInBag;
        const note = added < quantity ? ` (only ${limit} available)` : '';
        showToast(`Added ${added} × ${product.productName}${note}`, 'success', { label: 'Checkout', href: '#/checkout' });
    }
    return true;
}

function setCartQuantity(productId, quantity) {
    const cart = getCart();
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(quantity, item.stockQuantity, 99));
    saveCart(cart);
}

function removeFromCart(productId) {
    saveCart(getCart().filter(i => i.productId !== productId));
}

function clearCart() {
    saveCart([]);
}

// Re-checks every bag item against the API: current price, current stock,
// and whether the product is still sold. Returns messages about anything that changed.
async function refreshCartFromServer() {
    const cart = getCart();
    const messages = [];

    const results = await Promise.allSettled(cart.map(item => api('products/' + item.productId)));
    results.forEach((result, index) => {
        const item = cart[index];
        if (result.status === 'rejected') {
            // 404 = product removed or deactivated. Other errors: leave the item as it was.
            if (result.reason.status === 404) {
                if (!item.unavailable) messages.push(`${item.productName} is no longer available.`);
                item.unavailable = true;
            }
            return;
        }

        const product = result.value;
        if (product.price !== item.price) {
            messages.push(`${product.productName} is now ${money(product.price)}.`);
        }
        item.productName = product.productName;
        item.price = product.price;
        item.imageUrl = product.imageUrl;
        item.stockQuantity = product.stockQuantity;
        item.unavailable = product.stockQuantity <= 0;

        if (item.unavailable) {
            messages.push(`${product.productName} just sold out.`);
        } else if (item.quantity > product.stockQuantity) {
            item.quantity = product.stockQuantity;
            messages.push(`Only ${product.stockQuantity} of ${product.productName} left, so we lowered your quantity.`);
        }
    });

    saveCart(cart);
    return messages;
}


// ===== Bag drawer =====

function renderCartDrawer() {
    const cart = getCart();
    const body = document.getElementById('cartDrawerBody');
    const foot = document.getElementById('cartDrawerFoot');
    document.getElementById('cartDrawerCount').textContent = cart.length ? `(${cartUnitCount(cart)})` : '';

    if (cart.length === 0) {
        body.innerHTML = `
            <div class="bag-empty">
                <img src="Resources/Images/products/pencil-case.svg" alt="">
                <h3>Your bag is empty.</h3>
                <p>Good news: that means there's room for a fresh notebook.</p>
                <a href="#/shop" class="btn-cs btn-cs-dark">Start shopping</a>
            </div>`;
        foot.innerHTML = '';
        return;
    }

    body.innerHTML = `<ul class="bag-list">${cart.map(bagLine).join('')}</ul>`;

    const subtotal = cartSubtotal(cart);
    const hasProblem = cart.some(item => item.unavailable);
    foot.innerHTML = `
        <dl class="totals">
            <div><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
            <div class="muted"><dt>Est. tax (8%)</dt><dd>${money(subtotal * TAX_RATE)}</dd></div>
            <div><dt>Pickup</dt><dd class="free">Free</dd></div>
        </dl>
        ${hasProblem ? '<p class="bag-warning">Remove unavailable items to check out.</p>' : ''}
        <a href="#/checkout" class="btn-cs btn-cs-primary btn-cs-lg w-100 ${hasProblem ? 'disabled' : ''}"
           ${hasProblem ? 'aria-disabled="true" tabindex="-1"' : ''}>
           Checkout · ${money(subtotal + subtotal * TAX_RATE)}
        </a>`;

    body.querySelectorAll('.qty-stepper').forEach(stepper => {
        const productId = Number(stepper.dataset.productId);
        wireQuantityStepper(stepper, quantity => setCartQuantity(productId, quantity));
    });
}

function bagLine(item) {
    return `
        <li class="bag-line ${item.unavailable ? 'unavailable' : ''}">
            <a href="#/product/${item.productId}" class="bag-thumb">${imgTag(item.imageUrl, item.productName)}</a>
            <div class="bag-info">
                <a href="#/product/${item.productId}" class="bag-name">${esc(item.productName)}</a>
                <p class="bag-unit">${item.unavailable ? '<span class="text-danger-cs">Unavailable</span>' : money(item.price) + ' each'}</p>
                ${item.unavailable ? '' : `
                <div class="qty-stepper small" data-max="${Math.min(item.stockQuantity, 99)}" data-product-id="${item.productId}">
                    <button type="button" data-step="-1" aria-label="Decrease quantity">${icon('minus')}</button>
                    <input type="number" value="${item.quantity}" min="1" max="${Math.min(item.stockQuantity, 99)}" aria-label="Quantity of ${esc(item.productName)}">
                    <button type="button" data-step="1" aria-label="Increase quantity">${icon('plus')}</button>
                </div>`}
            </div>
            <div class="bag-right">
                <span class="bag-total">${item.unavailable ? '' : money(item.price * item.quantity)}</span>
                <button type="button" class="link-button" data-remove-id="${item.productId}">Remove</button>
            </div>
        </li>`;
}

function wireCartDrawer() {
    const drawer = document.getElementById('cartDrawer');

    // Every time the bag opens, show it right away, then re-check stock and prices
    drawer.addEventListener('show.bs.offcanvas', async () => {
        renderCartDrawer();
        if (getCart().length === 0) return;
        try {
            const messages = await refreshCartFromServer();
            messages.forEach(message => showToast(message, 'info'));
        } catch {
            // Offline: keep showing the saved bag
        }
    });

    drawer.addEventListener('click', event => {
        const removeButton = event.target.closest('[data-remove-id]');
        if (removeButton) removeFromCart(Number(removeButton.dataset.removeId));

        // Any link in the bag (Checkout, a product name) closes the drawer.
        // The link itself still navigates normally.
        if (event.target.closest('a[href]')) {
            bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
        }
    });
}


// ===== CHECKOUT =====

async function showCheckout() {
    showView('checkout');
    const body = document.getElementById('checkoutBody');

    if (getCart().length === 0) {
        body.innerHTML = emptyState('Your bag is empty.', 'Add a few things, then come back to check out.',
            '<a href="#/shop" class="btn-cs btn-cs-dark">Browse products</a>');
        return;
    }

    body.innerHTML = '<div class="loading-block"><span class="spinner"></span> Checking stock and prices…</div>';
    let messages = [];
    try {
        messages = await refreshCartFromServer();
    } catch (error) {
        body.innerHTML = errorState(error.message);
        return;
    }
    renderCheckout(messages);
}

function renderCheckout(messages = []) {
    const body = document.getElementById('checkoutBody');
    const cart = getCart();
    if (cart.length === 0) {
        showCheckout();
        return;
    }

    const subtotal = cartSubtotal(cart);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const hasProblem = cart.some(item => item.unavailable);
    const user = state.user;

    body.innerHTML = `
        ${messages.length ? `<div class="notice">${icon('alert')}<div><strong>Your bag was updated:</strong><ul>${messages.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div></div>` : ''}
        <div class="checkout-grid">
            <div class="checkout-main">
                ${user ? `
                <section class="checkout-card">
                    <h2 class="card-title"><span class="step-num">1</span> Pickup details</h2>
                    <div class="pickup-detail">
                        <div class="avatar">${esc(initials(user))}</div>
                        <div>
                            <p class="strong">${esc(user.firstName)} ${esc(user.lastName)}</p>
                            <p class="muted">${esc(user.email)}${user.phone ? ' · ' + esc(user.phone) : ''}</p>
                        </div>
                        <a href="#/account/profile" class="link-button">Edit</a>
                    </div>
                    <div class="pickup-card">
                        ${icon('store')}
                        <div><strong>Crimson Supply pickup counter</strong><p>Ready about 2 hours after you order. Bring your order number.</p></div>
                    </div>
                </section>

                <section class="checkout-card">
                    <h2 class="card-title"><span class="step-num">2</span> Payment</h2>
                    <label class="pay-option selected">
                        <input type="radio" name="payment" checked>
                        <span><strong>Pay at pickup</strong><br><span class="muted">This is a simulated checkout. No card details are collected and no payment is processed.</span></span>
                    </label>
                </section>` : `
                <section class="checkout-card signin-prompt">
                    <h2 class="card-title">${icon('user')} Sign in to place your order</h2>
                    <p class="muted">Browsing is open to everyone, but orders are saved to an account so you can track your pickup. Your bag will be waiting.</p>
                    <div class="d-flex flex-wrap gap-2">
                        <a href="#/signin?next=checkout" class="btn-cs btn-cs-primary">Sign in</a>
                        <a href="#/register?next=checkout" class="btn-cs btn-cs-ghost">Create an account</a>
                    </div>
                </section>`}

                <section class="checkout-card">
                    <div class="card-title-row">
                        <h2 class="card-title"><span class="step-num">${user ? 3 : '·'}</span> Items</h2>
                        <button type="button" class="link-button" data-bs-toggle="offcanvas" data-bs-target="#cartDrawer">Edit bag</button>
                    </div>
                    <ul class="review-list">
                        ${cart.map(item => `
                        <li class="${item.unavailable ? 'unavailable' : ''}">
                            ${imgTag(item.imageUrl, '')}
                            <div class="review-name">
                                <span>${esc(item.productName)}</span>
                                <span class="muted mono">${esc(item.sku || '')}${item.unavailable ? ' · <span class="text-danger-cs">Unavailable</span>' : ` · ${item.quantity} × ${money(item.price)}`}</span>
                            </div>
                            <span class="review-total">${item.unavailable ? '' : money(item.price * item.quantity)}</span>
                        </li>`).join('')}
                    </ul>
                </section>
            </div>

            <aside class="checkout-summary">
                <h2 class="card-title">Order summary</h2>
                <dl class="totals">
                    <div><dt>Subtotal (${cartUnitCount(cart.filter(i => !i.unavailable))} items)</dt><dd>${money(subtotal)}</dd></div>
                    <div><dt>Sales tax (8%)</dt><dd>${money(tax)}</dd></div>
                    <div><dt>Pickup</dt><dd class="free">Free</dd></div>
                    <div class="grand"><dt>Total</dt><dd>${money(subtotal + tax)}</dd></div>
                </dl>
                ${hasProblem ? '<p class="bag-warning">Remove unavailable items from your bag to continue.</p>' : ''}
                <button type="button" class="btn-cs btn-cs-primary btn-cs-lg w-100" id="placeOrderButton" ${!user || hasProblem ? 'disabled' : ''}>
                    Place order
                </button>
                <p class="fine">The store confirms the final price and stock when you place your order.</p>
            </aside>
        </div>`;

    const placeButton = document.getElementById('placeOrderButton');
    placeButton.addEventListener('click', () => withBusyButton(placeButton, placeOrder));
}

async function placeOrder() {
    const items = getCart()
        .filter(item => !item.unavailable)
        .map(item => ({ productId: item.productId, quantity: item.quantity }));

    try {
        const confirmation = await api('orders', { method: 'POST', body: { items } });
        clearCart();
        go(`#/order/${confirmation.orderId}?placed=1`);
    } catch (error) {
        if (error.status === 401) {
            state.user = null;
            renderAccountArea();   // account.js
            showToast('Please sign in again to place your order.', 'error');
            renderCheckout();
            return;
        }
        // 404 / 409 = something sold out or changed. Re-check the bag and show what changed.
        showToast(error.message, 'error');
        if (error.status === 404 || error.status === 409) {
            const messages = await refreshCartFromServer().catch(() => []);
            renderCheckout(messages);
        }
    }
}


// ===== ORDER RECEIPT (confirmation and order details) =====

async function showOrder(route) {
    showView('order');
    const body = document.getElementById('orderBody');
    const orderId = parseInt(route.parts[1], 10);
    const justPlaced = route.params.get('placed') === '1';

    if (!state.user) {
        go(`#/signin?next=${encodeURIComponent('order/' + orderId)}`);
        return;
    }

    body.innerHTML = '<div class="loading-block"><span class="spinner"></span> Loading your receipt…</div>';
    let order;
    try {
        order = await api('orders/' + orderId);
    } catch (error) {
        body.innerHTML = error.status === 404
            ? emptyState('We couldn’t find that order.', 'It may belong to a different account.',
                '<a href="#/account/orders" class="btn-cs btn-cs-dark">Your orders</a>')
            : errorState(error.message);
        return;
    }

    const steps = ['Placed', 'Ready for Pickup', 'Completed'];
    const currentStep = steps.indexOf(order.orderStatus);

    body.innerHTML = `
        <div class="order-wrap">
            <div class="order-hero">
                ${justPlaced ? `
                    <div class="confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span style="--i:${i}"></span>`).join('')}</div>
                    <p class="eyebrow"><span class="eyebrow-dot"></span>Order confirmed</p>
                    <h1 class="page-title">Thanks, ${esc(state.user.firstName)}! We're pulling your items now.</h1>
                    <p class="page-lede">Your order will be ready at the pickup counter in about 2 hours. A copy is saved in your order history.</p>`
                : `
                    <nav class="crumbs" aria-label="Breadcrumb"><a href="${state.user.role === 'Admin' && order.userId !== state.user.userId ? '#/admin/orders' : '#/account/orders'}">Orders</a><span>/</span><span>${orderNumber(order.orderId)}</span></nav>
                    <h1 class="page-title">Order ${orderNumber(order.orderId)}</h1>`}

                ${order.orderStatus === 'Cancelled'
                    ? `<div class="notice">${icon('alert')}<div>This order was cancelled. Its items were returned to stock.</div></div>`
                    : `<ol class="progress-steps" aria-label="Order progress">
                        ${steps.map((step, i) => `<li class="${i <= currentStep ? 'done' : ''} ${i === currentStep ? 'current' : ''}">${step}</li>`).join('')}
                       </ol>`}

                <div class="order-actions">
                    <a href="#/account/orders" class="btn-cs btn-cs-dark">Order history</a>
                    <a href="#/shop" class="btn-cs btn-cs-ghost">Keep shopping</a>
                    <button type="button" class="btn-cs btn-cs-ghost" onclick="window.print()">Print receipt</button>
                </div>
            </div>

            <article class="receipt" aria-label="Receipt">
                <header class="receipt-head">
                    <p class="receipt-brand">Crimson<em>Supply</em></p>
                    <p class="mono">Pickup counter · Receipt</p>
                </header>
                <dl class="receipt-meta">
                    <div><dt>Order</dt><dd class="mono">${orderNumber(order.orderId)}</dd></div>
                    <div><dt>Date</dt><dd>${formatDate(order.orderDate, true)}</dd></div>
                    <div><dt>Customer</dt><dd>${esc(order.customerName)}</dd></div>
                    <div><dt>Status</dt><dd>${statusChip(order.orderStatus)}</dd></div>
                </dl>
                <ul class="receipt-items">
                    ${order.items.map(item => `
                    <li>
                        <span class="qty">${item.quantity}×</span>
                        <span class="name"><a href="#/product/${item.productId}">${esc(item.productName)}</a><small class="mono">${esc(item.sku)} @ ${money(item.unitPrice)}</small></span>
                        <span class="amt">${money(item.quantity * item.unitPrice)}</span>
                    </li>`).join('')}
                </ul>
                <dl class="receipt-totals">
                    <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
                    <div><dt>Tax</dt><dd>${money(order.tax)}</dd></div>
                    <div class="grand"><dt>Total due at pickup</dt><dd>${money(order.totalAmount)}</dd></div>
                </dl>
                <p class="receipt-foot mono">Thanks for shopping with us ✦ No payment was taken online</p>
            </article>
        </div>`;
}

document.addEventListener('DOMContentLoaded', wireCartDrawer);
