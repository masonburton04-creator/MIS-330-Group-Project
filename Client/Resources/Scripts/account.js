// =============================================================
// Crimson Supply - account.js
// Signing in and out, registration, and the customer's account
// pages (order history, profile, password).
//
// The API keeps the user signed in with an HttpOnly cookie, so this
// file never stores passwords or tokens. It only asks the API
// "who is signed in?" (/api/account/me) and keeps the answer in state.user.
// =============================================================

// ===== Session =====

async function loadSession() {
    try {
        state.user = await api('account/me');   // null when nobody is signed in
    } catch {
        state.user = null;   // the API is unreachable or the session expired
    }
    renderAccountArea();
}

// The header's account button, and the Admin shortcut for admins
function renderAccountArea() {
    const area = document.getElementById('accountArea');
    const user = state.user;
    document.getElementById('adminLink').hidden = !(user && user.role === 'Admin');

    if (!user) {
        area.innerHTML = `<a href="#/signin" class="account-link">${icon('user')}<span class="d-none d-md-inline">Sign in</span></a>`;
        return;
    }

    area.innerHTML = `
        <div class="dropdown">
            <button class="account-button" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <span class="avatar small">${esc(initials(user))}</span>
                <span class="d-none d-md-inline">${esc(user.firstName)}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end account-menu">
                <li class="account-menu-head"><strong>${esc(user.firstName)} ${esc(user.lastName)}</strong><span>${esc(user.email)}</span></li>
                <li><a class="dropdown-item" href="#/account/orders">${icon('bag')} Orders</a></li>
                <li><a class="dropdown-item" href="#/account/profile">${icon('user')} Profile</a></li>
                ${user.role === 'Admin' ? `<li><a class="dropdown-item" href="#/admin">${icon('grid')} Admin workspace</a></li>` : ''}
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item" type="button" id="signOutButton">${icon('logout')} Sign out</button></li>
            </ul>
        </div>`;
    document.getElementById('signOutButton').addEventListener('click', signOut);
}

async function signOut() {
    try {
        await api('account/logout', { method: 'POST' });
    } catch {
        // Even if the request fails, forget the user on this page
    }
    state.user = null;
    renderAccountArea();
    showToast('You are signed out. See you soon!', 'success');
    if (['account', 'admin', 'order'].includes(state.currentView)) {
        go('#/');
    } else {
        router();
    }
}


// ===== SIGN IN / REGISTER =====

// "next" says where to go after signing in, e.g. #/signin?next=checkout
function nextAfterSignIn(route) {
    const next = route.params.get('next');
    // Only allow simple in-site paths like "checkout" or "order/12"
    return next && /^[a-z0-9/]+$/i.test(next) ? '#/' + next : null;
}

function showAuth(route) {
    const next = nextAfterSignIn(route);
    if (state.user) {
        go(next || '#/account');
        return;
    }
    showView('auth');

    const isRegister = route.name === 'register';
    const nextQuery = route.params.get('next') ? '?next=' + encodeURIComponent(route.params.get('next')) : '';
    document.getElementById('signInForm').hidden = isRegister;
    document.getElementById('registerForm').hidden = !isRegister;

    const signInTab = document.getElementById('tabSignIn');
    const registerTab = document.getElementById('tabRegister');
    signInTab.href = '#/signin' + nextQuery;
    registerTab.href = '#/register' + nextQuery;
    signInTab.classList.toggle('active', !isRegister);
    registerTab.classList.toggle('active', isRegister);
    signInTab.setAttribute('aria-selected', String(!isRegister));
    registerTab.setAttribute('aria-selected', String(isRegister));
    document.querySelectorAll('.auth-switch a').forEach(link => {
        link.href = (link.getAttribute('href').includes('register') ? '#/register' : '#/signin') + nextQuery;
    });

    const note = document.getElementById('authNote');
    note.hidden = !next;
    note.textContent = next === '#/checkout'
        ? 'Sign in or create an account to finish checking out. Your bag is saved.'
        : 'Please sign in to continue.';

    document.getElementById('signInError').hidden = true;
    document.getElementById('registerError').hidden = true;
    (isRegister ? document.getElementById('regFirst') : document.getElementById('signInEmail')).focus();
}

function showFormError(elementId, message) {
    const box = document.getElementById(elementId);
    box.textContent = message;
    box.hidden = !message;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordProblem(password) {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return 'Password must include a letter and a number.';
    return null;
}

// Where to land after signing in
function afterSignIn(user) {
    state.user = user;
    renderAccountArea();
    const next = nextAfterSignIn(parseRoute());
    go(next || (user.role === 'Admin' ? '#/admin' : '#/account'));
}

function wireAuthForms() {
    document.getElementById('signInForm').addEventListener('submit', async event => {
        event.preventDefault();
        const email = document.getElementById('signInEmail').value.trim();
        const password = document.getElementById('signInPassword').value;

        if (!looksLikeEmail(email) || password === '') {
            showFormError('signInError', 'Please enter your email and password.');
            return;
        }
        showFormError('signInError', '');

        const button = event.submitter || event.target.querySelector('[type=submit]');
        await withBusyButton(button, async () => {
            try {
                const user = await api('account/login', { method: 'POST', body: { email, password } });
                event.target.reset();
                showToast(`Welcome back, ${user.firstName}!`, 'success');
                afterSignIn(user);
            } catch (error) {
                showFormError('signInError', error.message);
            }
        });
    });

    document.getElementById('registerForm').addEventListener('submit', async event => {
        event.preventDefault();
        const body = {
            firstName: document.getElementById('regFirst').value.trim(),
            lastName: document.getElementById('regLast').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            password: document.getElementById('regPassword').value
        };

        let problem = null;
        if (!body.firstName || !body.lastName) problem = 'Please enter your first and last name.';
        else if (!looksLikeEmail(body.email)) problem = 'Please enter a valid email address.';
        else problem = passwordProblem(body.password);
        showFormError('registerError', problem || '');
        if (problem) return;

        const button = event.submitter || event.target.querySelector('[type=submit]');
        await withBusyButton(button, async () => {
            try {
                const user = await api('account/register', { method: 'POST', body });
                event.target.reset();
                updatePasswordMeter('');
                showToast(`Welcome to Crimson Supply, ${user.firstName}!`, 'success');
                afterSignIn(user);
            } catch (error) {
                showFormError('registerError', error.message);
            }
        });
    });

    document.getElementById('regPassword').addEventListener('input', event => updatePasswordMeter(event.target.value));
}

// A simple strength bar: length plus a mix of character types
function updatePasswordMeter(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const meter = document.getElementById('pwMeter');
    meter.style.width = (score / 5 * 100) + '%';
    meter.dataset.level = score <= 2 ? 'weak' : score <= 3 ? 'ok' : 'strong';
}


// ===== ACCOUNT PAGES =====

async function showAccount(route) {
    if (!state.user) {
        go('#/signin?next=' + encodeURIComponent(route.parts.join('/') || 'account'));
        return;
    }
    showView('account');

    const tab = ['orders', 'profile', 'security'].includes(route.parts[1]) ? route.parts[1] : 'orders';
    document.querySelectorAll('[data-account-tab]').forEach(link =>
        link.classList.toggle('active', link.dataset.accountTab === tab));
    document.querySelectorAll('[data-account-panel]').forEach(panel =>
        panel.hidden = panel.dataset.accountPanel !== tab);

    renderAccountHead(null);

    if (tab === 'profile') {
        fillProfileForm();
    } else if (tab === 'security') {
        document.getElementById('passwordForm').reset();
        showFormError('passwordError', '');
    }

    // Order history is also used for the header stats, so it loads on every tab
    const list = document.getElementById('accountOrders');
    if (tab === 'orders') list.innerHTML = '<div class="loading-block"><span class="spinner"></span> Loading orders…</div>';
    try {
        const orders = await api('orders/mine');
        renderAccountHead(orders);
        if (tab === 'orders') renderOrderHistory(orders);
    } catch (error) {
        if (tab === 'orders') list.innerHTML = errorState(error.message);
    }
}

function renderAccountHead(orders) {
    const user = state.user;
    const activeOrders = orders ? orders.filter(o => o.orderStatus !== 'Cancelled') : [];
    const spent = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    document.getElementById('accountHead').innerHTML = `
        <div class="account-id">
            <div class="avatar large">${esc(initials(user))}</div>
            <div>
                <p class="eyebrow">${user.role === 'Admin' ? 'Admin account' : 'Customer account'}</p>
                <h1 class="page-title">Hi, ${esc(user.firstName)}.</h1>
                <p class="page-lede">Member since ${formatDate(user.createdAt)}</p>
            </div>
        </div>
        <dl class="account-stats">
            <div><dt>Orders</dt><dd>${orders ? activeOrders.length : '—'}</dd></div>
            <div><dt>Total spent</dt><dd>${orders ? money(spent) : '—'}</dd></div>
            <div><dt>Open pickups</dt><dd>${orders ? orders.filter(o => o.orderStatus === 'Placed' || o.orderStatus === 'Ready for Pickup').length : '—'}</dd></div>
        </dl>`;
}

function renderOrderHistory(orders) {
    const list = document.getElementById('accountOrders');
    if (orders.length === 0) {
        list.innerHTML = emptyState('No orders yet.', 'When you place an order, its receipt and pickup status will live here.',
            '<a href="#/shop" class="btn-cs btn-cs-dark">Start shopping</a>');
        return;
    }

    list.innerHTML = orders.map(order => `
        <article class="order-card">
            <header class="order-card-head">
                <div>
                    <p class="mono strong">${orderNumber(order.orderId)}</p>
                    <p class="muted">${formatDate(order.orderDate, true)}</p>
                </div>
                ${statusChip(order.orderStatus)}
                <p class="order-card-total">${money(order.totalAmount)}</p>
            </header>
            <div class="order-thumbs">
                ${order.items.slice(0, 5).map(item => `<a href="#/product/${item.productId}" title="${esc(item.productName)}">${imgTag(item.imageUrl, item.productName)}</a>`).join('')}
                ${order.items.length > 5 ? `<span class="more">+${order.items.length - 5}</span>` : ''}
            </div>
            <p class="order-card-items">${order.items.map(item => `${item.quantity}× ${esc(item.productName)}`).join(' · ')}</p>
            <footer class="order-card-foot">
                <a href="#/order/${order.orderId}" class="btn-cs btn-cs-ghost btn-cs-sm">View receipt</a>
                <button type="button" class="btn-cs btn-cs-dark btn-cs-sm" data-buy-again="${order.orderId}">${icon('refresh')} Buy again</button>
            </footer>
        </article>`).join('');

    list.querySelectorAll('[data-buy-again]').forEach(button => {
        const order = orders.find(o => o.orderId === Number(button.dataset.buyAgain));
        button.addEventListener('click', () => withBusyButton(button, () => buyAgain(order)));
    });
}

// Adds the products from a past order back into the bag, using today's price and stock
async function buyAgain(order) {
    const results = await Promise.allSettled(order.items.map(item => api('products/' + item.productId)));
    let added = 0;
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.stockQuantity > 0) {
            if (addToCart(result.value, order.items[index].quantity, { quiet: true })) added++;
        }
    });

    const skipped = order.items.length - added;
    if (added === 0) {
        showToast('None of those items are available right now.', 'error');
    } else {
        showToast(`${added} item${added === 1 ? '' : 's'} added to your bag${skipped ? ` (${skipped} unavailable)` : ''}.`,
            'success', { label: 'Checkout', href: '#/checkout' });
    }
}

function fillProfileForm() {
    const user = state.user;
    document.getElementById('profFirst').value = user.firstName;
    document.getElementById('profLast').value = user.lastName;
    document.getElementById('profEmail').value = user.email;
    document.getElementById('profPhone').value = user.phone || '';
    showFormError('profileError', '');
}

function wireAccountForms() {
    document.getElementById('profileForm').addEventListener('submit', async event => {
        event.preventDefault();
        const body = {
            firstName: document.getElementById('profFirst').value.trim(),
            lastName: document.getElementById('profLast').value.trim(),
            email: document.getElementById('profEmail').value.trim(),
            phone: document.getElementById('profPhone').value.trim()
        };
        if (!body.firstName || !body.lastName) return showFormError('profileError', 'Please enter your first and last name.');
        if (!looksLikeEmail(body.email)) return showFormError('profileError', 'Please enter a valid email address.');
        if (body.phone && !/^[0-9+().\-\s]{7,20}$/.test(body.phone)) return showFormError('profileError', 'Please enter a valid phone number.');
        showFormError('profileError', '');

        const button = event.submitter || event.target.querySelector('[type=submit]');
        await withBusyButton(button, async () => {
            try {
                state.user = await api('account/me', { method: 'PUT', body });
                renderAccountArea();
                renderAccountHead(null);
                showToast('Profile saved.', 'success');
                showAccount(parseRoute());
            } catch (error) {
                showFormError('profileError', error.message);
            }
        });
    });

    document.getElementById('passwordForm').addEventListener('submit', async event => {
        event.preventDefault();
        const currentPassword = document.getElementById('pwCurrent').value;
        const newPassword = document.getElementById('pwNew').value;
        const confirm = document.getElementById('pwConfirm').value;

        let problem = currentPassword === '' ? 'Please enter your current password.' : passwordProblem(newPassword);
        if (!problem && newPassword !== confirm) problem = 'The new passwords do not match.';
        showFormError('passwordError', problem || '');
        if (problem) return;

        const button = event.submitter || event.target.querySelector('[type=submit]');
        await withBusyButton(button, async () => {
            try {
                await api('account/password', { method: 'PUT', body: { currentPassword, newPassword } });
                event.target.reset();
                showToast('Password updated.', 'success');
            } catch (error) {
                showFormError('passwordError', error.message);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    wireAuthForms();
    wireAccountForms();
});
