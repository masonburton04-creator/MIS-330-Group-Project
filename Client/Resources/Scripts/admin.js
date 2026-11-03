// =============================================================
// Crimson Supply - admin.js
// The admin workspace: dashboard, products, categories, orders
// and the five business reports.
//
// Hiding the Admin link is only for convenience. The real protection
// is on the server: every admin API endpoint has
// [Authorize(Roles = "Admin")], so a customer gets 403 Forbidden.
// =============================================================

// Product pictures that ship with the site (Client/Resources/Images/products)
const IMAGE_LIBRARY = [
    'backpack', 'binder', 'calculator', 'colored-pencils', 'composition', 'cutting-mat', 'desk-organizer',
    'desk-planner', 'dot-notebook', 'fineliners', 'flash-drive', 'folders', 'fountain-pen', 'gel-pens',
    'highlighters', 'laptop-sleeve', 'laptop-stand', 'legal-pad', 'mechanical-pencil', 'mouse',
    'pencil-case', 'pencils', 'sketchbook', 'spiral-notebook', 'stapler', 'sticky-notes', 'usb-cable', 'watercolor'
].map(name => `Resources/Images/products/${name}.svg`);

const ORDER_STATUSES = ['Placed', 'Ready for Pickup', 'Completed', 'Cancelled'];

// Data the admin screens share (reloaded each time a screen opens)
const admin = {
    products: [],
    orders: [],
    productFilters: { search: '', category: '', status: 'active' },
    orderFilter: 'all',
    orderSearch: ''
};

async function showAdmin(route) {
    if (!state.user) {
        go('#/signin?next=' + encodeURIComponent(route.parts.join('/')));
        return;
    }
    showView('admin');
    const main = document.getElementById('adminMain');

    if (state.user.role !== 'Admin') {
        main.innerHTML = emptyState('Admins only.',
            'Your account is a customer account. If you need admin access, ask the store owner to promote your account.',
            '<a href="#/" class="btn-cs btn-cs-dark">Back to the store</a>');
        return;
    }

    const tab = route.parts[1] || 'dashboard';
    document.querySelectorAll('[data-admin-tab]').forEach(link =>
        link.classList.toggle('active', link.dataset.adminTab === tab));

    const screens = {
        dashboard: renderDashboard,
        products: renderProductsAdmin,
        categories: renderCategoriesAdmin,
        orders: renderOrdersAdmin,
        reports: renderReports
    };
    const screen = screens[tab];
    if (!screen) {
        main.innerHTML = emptyState('Unknown admin page.', '', '<a href="#/admin" class="btn-cs btn-cs-dark">Dashboard</a>');
        return;
    }

    main.innerHTML = '<div class="loading-block"><span class="spinner"></span> Loading…</div>';
    try {
        await screen(main);
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            // Session expired, or the role changed since sign-in
            await loadSession();
        }
        main.innerHTML = errorState(error.message);
    }
}

function adminHeader(title, subtitle, actionsHtml = '') {
    return `
        <header class="admin-head">
            <div>
                <p class="eyebrow">Admin workspace</p>
                <h1 class="admin-title">${title}</h1>
                <p class="muted">${subtitle}</p>
            </div>
            <div class="admin-head-actions">${actionsHtml}</div>
        </header>`;
}

// Re-opens the current admin screen (after a change was saved)
function refreshAdmin() {
    showAdmin(parseRoute());
}


// ===== DASHBOARD =====

async function renderDashboard(main) {
    const [summaryRows, lowStock, orders, months] = await Promise.all([
        api('reports/summary'),
        api('reports/low-stock'),
        api('orders'),
        api('reports/sales-by-month')
    ]);
    const summary = summaryRows[0];
    admin.orders = orders;

    main.innerHTML = `
        ${adminHeader(`Good ${timeOfDay()}, ${esc(state.user.firstName)}.`, `Here's the store at ${formatDate(new Date(), true)}.`,
            '<a href="#/admin/products?new=1" class="btn-cs btn-cs-primary">' + icon('plus') + ' New product</a>')}

        <div class="kpi-grid">
            ${kpi('Gross sales', money(summary.totalRevenue), 'All non-cancelled orders, incl. tax')}
            ${kpi('Last 30 days', money(summary.revenueLast30Days), 'Sales in the past 30 days')}
            ${kpi('Orders', summary.ordersCount, `${summary.openOrders} waiting for pickup`, summary.openOrders > 0 ? 'link:#/admin/orders' : '')}
            ${kpi('Average order', money(summary.avgOrderTotal), 'Across all orders')}
            ${kpi('Customers', summary.customersCount, 'Registered customer accounts')}
            ${kpi('Low stock', summary.lowStockCount, `of ${summary.activeProducts} active products at ${LOW_STOCK_LIMIT} or fewer`, summary.lowStockCount > 0 ? 'warn' : '')}
        </div>

        <div class="admin-grid-2">
            <section class="admin-card">
                <div class="admin-card-head">
                    <h2>Merchandise sales by month</h2>
                    <a href="#/admin/reports" class="link-arrow">All reports ${icon('arrow')}</a>
                </div>
                ${months.length ? columnChart(months, {
                    label: row => monthLabel(row.salesMonth),
                    value: row => row.merchandiseSales,
                    tip: row => `${money(row.merchandiseSales)}<br>${row.ordersCount} orders`,
                    title: 'Merchandise sales by month'
                }) : '<p class="muted">No sales yet.</p>'}
            </section>

            <section class="admin-card">
                <div class="admin-card-head">
                    <h2>Needs restocking</h2>
                    <a href="#/admin/products" class="link-arrow">All products ${icon('arrow')}</a>
                </div>
                ${lowStock.length ? `<ul class="restock-list">
                    ${lowStock.map(p => `
                    <li>
                        ${imgTag(p.imageUrl, '')}
                        <div><p class="strong">${esc(p.productName)}</p><p class="muted mono">${esc(p.sku)} · ${esc(p.categoryName)}</p></div>
                        <span class="stock-pill ${stockInfo(p.stockQuantity).css}">${p.stockQuantity === 0 ? 'Sold out' : p.stockQuantity + ' left'}</span>
                        <button type="button" class="btn-cs btn-cs-ghost btn-cs-sm" data-restock="${p.productId}" data-name="${esc(p.productName)}" data-stock="${p.stockQuantity}">Restock</button>
                    </li>`).join('')}
                </ul>` : `<p class="all-good">${icon('check')} Every product has more than ${LOW_STOCK_LIMIT} in stock.</p>`}
            </section>
        </div>

        <section class="admin-card">
            <div class="admin-card-head">
                <h2>Recent orders</h2>
                <a href="#/admin/orders" class="link-arrow">Manage orders ${icon('arrow')}</a>
            </div>
            ${orderTable(orders.slice(0, 6), false)}
        </section>`;

    wireRestockButtons(main);
    wireOrderTable(main);
}

function timeOfDay() {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function kpi(label, value, note, flag = '') {
    const isLink = flag.startsWith('link:');
    const tag = isLink ? 'a' : 'div';
    return `
        <${tag} class="kpi ${flag === 'warn' ? 'warn' : ''}" ${isLink ? `href="${flag.slice(5)}"` : ''}>
            <p class="kpi-label">${label}</p>
            <p class="kpi-value">${value}</p>
            <p class="kpi-note">${flag === 'warn' ? icon('alert') : ''}${note}</p>
        </${tag}>`;
}

function monthLabel(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}


// ===== PRODUCTS =====

async function renderProductsAdmin(main) {
    admin.products = await api('products/manage');
    if (state.categories.length === 0) await loadCategories();

    main.innerHTML = `
        ${adminHeader('Products', `${admin.products.length} products in the catalog. Hidden products stay on past orders but aren't sold.`,
            `<button type="button" class="btn-cs btn-cs-primary" id="newProductButton">${icon('plus')} New product</button>`)}

        <div class="admin-toolbar">
            <label class="toolbar-search">${icon('search')}
                <span class="visually-hidden">Search products</span>
                <input type="search" id="adminProductSearch" placeholder="Search name or SKU" value="${esc(admin.productFilters.search)}">
            </label>
            <label class="toolbar-select"><span class="visually-hidden">Category</span>
                <select id="adminProductCategory">
                    <option value="">All categories</option>
                    ${state.categories.map(c => `<option value="${c.categoryId}" ${String(c.categoryId) === admin.productFilters.category ? 'selected' : ''}>${esc(c.categoryName)}</option>`).join('')}
                </select>
            </label>
            <div class="segmented" role="group" aria-label="Product status">
                ${['active', 'hidden', 'low', 'all'].map(s => `
                    <button type="button" data-status="${s}" class="${admin.productFilters.status === s ? 'active' : ''}">
                        ${{ active: 'Active', hidden: 'Hidden', low: 'Low stock', all: 'All' }[s]}
                    </button>`).join('')}
            </div>
        </div>

        <div class="admin-card flush"><div id="adminProductTable"></div></div>`;

    renderProductRows();

    document.getElementById('adminProductSearch').addEventListener('input', event => {
        admin.productFilters.search = event.target.value;
        renderProductRows();
    });
    document.getElementById('adminProductCategory').addEventListener('change', event => {
        admin.productFilters.category = event.target.value;
        renderProductRows();
    });
    main.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
        admin.productFilters.status = button.dataset.status;
        main.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b === button));
        renderProductRows();
    }));
    document.getElementById('newProductButton').addEventListener('click', () => openProductForm(null));

    // #/admin/products?new=1 (from the dashboard) opens the form right away
    if (parseRoute().params.get('new') === '1') openProductForm(null);
}

function renderProductRows() {
    const { search, category, status } = admin.productFilters;
    const term = search.trim().toLowerCase();

    const rows = admin.products.filter(p =>
        (!term || p.productName.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
        && (!category || String(p.categoryId) === category)
        && (status === 'all'
            || (status === 'active' && p.isActive)
            || (status === 'hidden' && !p.isActive)
            || (status === 'low' && p.isActive && p.stockQuantity <= LOW_STOCK_LIMIT)));

    const table = document.getElementById('adminProductTable');
    if (rows.length === 0) {
        table.innerHTML = emptyState('No products match.', 'Try a different search or filter.');
        return;
    }

    table.innerHTML = `
        <div class="table-scroll">
        <table class="data-table">
            <thead><tr>
                <th scope="col">Product</th><th scope="col">Category</th><th scope="col" class="num">Price</th>
                <th scope="col" class="num">Stock</th><th scope="col" class="num">Sold</th><th scope="col">Status</th>
                <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr></thead>
            <tbody>
            ${rows.map(p => `
                <tr class="${p.isActive ? '' : 'row-muted'}">
                    <td><div class="cell-product">${imgTag(p.imageUrl, '')}
                        <div><a href="#/product/${p.productId}" class="strong">${esc(p.productName)}</a><span class="mono muted">${esc(p.sku)}</span></div></div></td>
                    <td>${esc(p.categoryName)}</td>
                    <td class="num">${money(p.price)}</td>
                    <td class="num"><span class="stock-pill ${stockInfo(p.stockQuantity).css}">${p.stockQuantity}</span></td>
                    <td class="num">${p.unitsSold}</td>
                    <td>${p.isActive ? '<span class="status-chip completed">Active</span>' : '<span class="status-chip cancelled">Hidden</span>'}</td>
                    <td class="actions">
                        <button type="button" class="btn-cs btn-cs-ghost btn-cs-sm" data-restock="${p.productId}" data-name="${esc(p.productName)}" data-stock="${p.stockQuantity}">Restock</button>
                        <button type="button" class="icon-button" data-edit="${p.productId}" aria-label="Edit ${esc(p.productName)}" title="Edit">${icon('edit')}</button>
                        <button type="button" class="icon-button" data-toggle-active="${p.productId}" aria-label="${p.isActive ? 'Hide' : 'Show'} ${esc(p.productName)}" title="${p.isActive ? 'Hide from store' : 'Show in store'}">${icon(p.isActive ? 'eye' : 'refresh')}</button>
                        <button type="button" class="icon-button danger" data-delete="${p.productId}" aria-label="Delete ${esc(p.productName)}" title="Delete">${icon('trash')}</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;

    wireRestockButtons(table);
    table.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () =>
        openProductForm(admin.products.find(p => p.productId === Number(button.dataset.edit)))));
    table.querySelectorAll('[data-toggle-active]').forEach(button => button.addEventListener('click', () =>
        toggleProductActive(admin.products.find(p => p.productId === Number(button.dataset.toggleActive)))));
    table.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () =>
        deleteProduct(admin.products.find(p => p.productId === Number(button.dataset.delete)))));
}

// Add / edit product form (in the shared modal). product = null means "new product".
function openProductForm(product) {
    const isNew = product === null;
    const p = product || { sku: '', productName: '', description: '', price: '', stockQuantity: 0, imageUrl: IMAGE_LIBRARY[0], categoryId: '' };
    const inLibrary = IMAGE_LIBRARY.includes(p.imageUrl);

    openModal({
        title: isNew ? 'New product' : `Edit ${p.productName}`,
        size: 'lg',
        body: `
            <form id="productForm" class="product-form" novalidate>
                <div class="product-form-grid">
                    <div class="product-form-preview">
                        <img id="pfPreview" src="${productImage(p.imageUrl)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
                        <div class="field">
                            <label for="pfImage">Picture</label>
                            <select id="pfImage">
                                ${IMAGE_LIBRARY.map(path => `<option value="${path}" ${path === p.imageUrl ? 'selected' : ''}>${path.split('/').pop().replace('.svg', '').replace(/-/g, ' ')}</option>`).join('')}
                                <option value="custom" ${!inLibrary ? 'selected' : ''}>Custom path…</option>
                            </select>
                        </div>
                        <div class="field" id="pfCustomField" ${inLibrary ? 'hidden' : ''}>
                            <label for="pfCustomImage">Image path or URL</label>
                            <input id="pfCustomImage" maxlength="255" value="${inLibrary ? '' : esc(p.imageUrl || '')}" placeholder="Resources/Images/products/…">
                        </div>
                    </div>
                    <div>
                        <div class="field-row">
                            <div class="field"><label for="pfName">Product name</label><input id="pfName" maxlength="100" required value="${esc(p.productName)}"></div>
                            <div class="field narrow"><label for="pfSku">SKU</label><input id="pfSku" class="mono" maxlength="30" required value="${esc(p.sku)}" placeholder="WRT-107"></div>
                        </div>
                        <div class="field-row">
                            <div class="field"><label for="pfCategory">Category</label>
                                <select id="pfCategory" required>
                                    <option value="">Choose…</option>
                                    ${state.categories.map(c => `<option value="${c.categoryId}" ${c.categoryId === p.categoryId ? 'selected' : ''}>${esc(c.categoryName)}</option>`).join('')}
                                </select></div>
                            <div class="field narrow"><label for="pfPrice">Price ($)</label><input id="pfPrice" type="number" min="0" max="100000" step="0.01" required value="${p.price}"></div>
                        </div>
                        <div class="field">
                            <label for="pfStock">${isNew ? 'Starting stock' : 'Stock on hand'}</label>
                            ${isNew
                                ? '<input id="pfStock" type="number" min="0" max="100000" step="1" value="0" required>'
                                : `<p class="field-static"><span class="stock-pill ${stockInfo(p.stockQuantity).css}">${p.stockQuantity}</span> Use <strong>Restock</strong> to change stock, so sales that happen meanwhile are never overwritten.</p>`}
                        </div>
                        <div class="field"><label for="pfDescription">Description <span class="optional">optional</span></label>
                            <textarea id="pfDescription" rows="4" maxlength="2000">${esc(p.description || '')}</textarea></div>
                    </div>
                </div>
                <div class="form-error" id="productFormError" role="alert" hidden></div>
            </form>`,
        footer: `
            <button type="button" class="btn-cs btn-cs-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" form="productForm" class="btn-cs btn-cs-primary" id="productFormSave">${isNew ? 'Add product' : 'Save changes'}</button>`
    });

    const imageSelect = document.getElementById('pfImage');
    const customInput = document.getElementById('pfCustomImage');
    const preview = document.getElementById('pfPreview');
    const chosenImage = () => imageSelect.value === 'custom' ? customInput.value.trim() : imageSelect.value;
    const updatePreview = () => {
        preview.onerror = () => { preview.onerror = null; preview.src = PLACEHOLDER_IMAGE; };
        preview.src = chosenImage() || PLACEHOLDER_IMAGE;
    };
    imageSelect.addEventListener('change', () => {
        document.getElementById('pfCustomField').hidden = imageSelect.value !== 'custom';
        updatePreview();
    });
    customInput.addEventListener('input', updatePreview);

    document.getElementById('productForm').addEventListener('submit', async event => {
        event.preventDefault();
        const body = {
            sku: document.getElementById('pfSku').value.trim().toUpperCase(),
            productName: document.getElementById('pfName').value.trim(),
            categoryId: Number(document.getElementById('pfCategory').value),
            price: Number(document.getElementById('pfPrice').value),
            stockQuantity: isNew ? Number(document.getElementById('pfStock').value) : p.stockQuantity,
            description: document.getElementById('pfDescription').value.trim(),
            imageUrl: chosenImage()
        };

        let problem = null;
        if (!body.productName || !body.sku) problem = 'Product name and SKU are required.';
        else if (!body.categoryId) problem = 'Please choose a category.';
        else if (document.getElementById('pfPrice').value === '' || body.price < 0) problem = 'Enter a price of $0 or more.';
        else if (Math.round(body.price * 100) !== body.price * 100) problem = 'Price can have at most two decimal places.';
        else if (isNew && (!Number.isInteger(body.stockQuantity) || body.stockQuantity < 0)) problem = 'Starting stock must be a whole number, 0 or more.';
        showFormError('productFormError', problem || '');
        if (problem) return;

        await withBusyButton(document.getElementById('productFormSave'), async () => {
            try {
                if (isNew) {
                    await api('products', { method: 'POST', body });
                    showToast(`${body.productName} added to the catalog.`, 'success');
                } else {
                    await api('products/' + p.productId, { method: 'PUT', body });
                    showToast(`${body.productName} saved.`, 'success');
                }
                closeModal();
                await loadCategories();     // product counts changed
                if (parseRoute().params.get('new') === '1') {
                    go('#/admin/products');
                } else {
                    refreshAdmin();
                }
            } catch (error) {
                showFormError('productFormError', error.message);
            }
        });
    });
}

// Restock buttons appear on the dashboard and the product table
function wireRestockButtons(container) {
    container.querySelectorAll('[data-restock]').forEach(button => button.addEventListener('click', () =>
        openRestockForm(Number(button.dataset.restock), button.dataset.name, Number(button.dataset.stock))));
}

function openRestockForm(productId, productName, currentStock) {
    openModal({
        title: `Restock ${productName}`,
        size: 'sm',
        body: `
            <form id="restockForm" novalidate>
                <p class="restock-now">On the shelf now: <strong>${currentStock}</strong></p>
                <div class="field">
                    <label for="restockChange">Units to add <span class="optional">use a negative number to remove</span></label>
                    <input id="restockChange" type="number" step="1" value="25" required>
                </div>
                <div class="quick-adds">
                    ${[10, 25, 50, 100].map(n => `<button type="button" class="chip" data-quick="${n}">+${n}</button>`).join('')}
                </div>
                <p class="restock-after">New stock: <strong id="restockResult">${currentStock + 25}</strong></p>
                <div class="form-error" id="restockError" role="alert" hidden></div>
            </form>`,
        footer: `
            <button type="button" class="btn-cs btn-cs-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" form="restockForm" class="btn-cs btn-cs-primary" id="restockSave">Update stock</button>`
    });

    const input = document.getElementById('restockChange');
    const result = document.getElementById('restockResult');
    const update = () => {
        const after = currentStock + (parseInt(input.value, 10) || 0);
        result.textContent = after;
        result.classList.toggle('text-danger-cs', after < 0);
    };
    input.addEventListener('input', update);
    document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', () => {
        input.value = button.dataset.quick;
        update();
    }));

    document.getElementById('restockForm').addEventListener('submit', async event => {
        event.preventDefault();
        const change = parseInt(input.value, 10);
        if (!Number.isInteger(change) || change === 0) {
            showFormError('restockError', 'Enter a whole number other than 0.');
            return;
        }
        if (currentStock + change < 0) {
            showFormError('restockError', 'Stock cannot go below 0.');
            return;
        }
        await withBusyButton(document.getElementById('restockSave'), async () => {
            try {
                const newStock = await api(`products/${productId}/stock`, { method: 'PATCH', body: { change } });
                closeModal();
                showToast(`${productName} now has ${newStock} in stock.`, 'success');
                refreshAdmin();
            } catch (error) {
                showFormError('restockError', error.message);
            }
        });
    });
}

async function toggleProductActive(product) {
    const hiding = product.isActive;
    if (hiding) {
        const ok = await confirmDialog({
            title: 'Hide this product?',
            message: `<strong>${esc(product.productName)}</strong> will disappear from the store. Past orders keep it, and you can show it again any time.`,
            confirmLabel: 'Hide product'
        });
        if (!ok) return;
    }
    try {
        await api(`products/${product.productId}/active`, { method: 'PATCH', body: { isActive: !hiding } });
        showToast(`${product.productName} is ${hiding ? 'hidden from' : 'back in'} the store.`, 'success');
        await loadCategories();
        refreshAdmin();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteProduct(product) {
    const ok = await confirmDialog({
        title: 'Delete permanently?',
        message: product.unitsSold > 0
            ? `<strong>${esc(product.productName)}</strong> appears on past orders, so the database won't allow deleting it. Hide it instead to stop selling it.`
            : `This permanently removes <strong>${esc(product.productName)}</strong>. This can't be undone.`,
        confirmLabel: product.unitsSold > 0 ? 'Try anyway' : 'Delete',
        danger: true
    });
    if (!ok) return;
    try {
        await api('products/' + product.productId, { method: 'DELETE' });
        showToast(`${product.productName} deleted.`, 'success');
        await loadCategories();
        refreshAdmin();
    } catch (error) {
        showToast(error.message, 'error');
    }
}


// ===== CATEGORIES =====

async function renderCategoriesAdmin(main) {
    await loadCategories();
    const products = await api('products/manage');

    main.innerHTML = `
        ${adminHeader('Categories', 'Departments shown in the store menu and filters.',
            `<button type="button" class="btn-cs btn-cs-primary" id="newCategoryButton">${icon('plus')} New category</button>`)}
        <div class="category-admin-grid">
            ${state.categories.map(c => {
                const all = products.filter(p => p.categoryId === c.categoryId);
                const hidden = all.length - c.productCount;
                return `
                <article class="category-admin-card">
                    <div class="dept-fan small" aria-hidden="true">${all.slice(0, 3).map(p => imgTag(p.imageUrl, '')).join('')}</div>
                    <h2>${esc(c.categoryName)}</h2>
                    <p class="muted">${esc(c.description || 'No description')}</p>
                    <p class="mono small-meta">${c.productCount} active${hidden ? ` · ${hidden} hidden` : ''}</p>
                    <div class="card-actions">
                        <a class="btn-cs btn-cs-ghost btn-cs-sm" href="#/shop?category=${c.categoryId}">View in store</a>
                        <button type="button" class="icon-button" data-edit-category="${c.categoryId}" aria-label="Edit ${esc(c.categoryName)}">${icon('edit')}</button>
                        <button type="button" class="icon-button danger" data-delete-category="${c.categoryId}" data-count="${all.length}" aria-label="Delete ${esc(c.categoryName)}">${icon('trash')}</button>
                    </div>
                </article>`;
            }).join('') || emptyState('No categories yet.', 'Add your first department.')}
        </div>`;

    document.getElementById('newCategoryButton').addEventListener('click', () => openCategoryForm(null));
    main.querySelectorAll('[data-edit-category]').forEach(button => button.addEventListener('click', () =>
        openCategoryForm(state.categories.find(c => c.categoryId === Number(button.dataset.editCategory)))));
    main.querySelectorAll('[data-delete-category]').forEach(button => button.addEventListener('click', () =>
        deleteCategory(state.categories.find(c => c.categoryId === Number(button.dataset.deleteCategory)), Number(button.dataset.count))));
}

function openCategoryForm(category) {
    const isNew = category === null;
    openModal({
        title: isNew ? 'New category' : `Edit ${category.categoryName}`,
        body: `
            <form id="categoryForm" novalidate>
                <div class="field"><label for="cfName">Name</label><input id="cfName" maxlength="50" required value="${isNew ? '' : esc(category.categoryName)}"></div>
                <div class="field"><label for="cfDescription">Description <span class="optional">optional</span></label>
                    <textarea id="cfDescription" rows="3" maxlength="255">${isNew ? '' : esc(category.description || '')}</textarea></div>
                <div class="form-error" id="categoryFormError" role="alert" hidden></div>
            </form>`,
        footer: `
            <button type="button" class="btn-cs btn-cs-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" form="categoryForm" class="btn-cs btn-cs-primary" id="categorySave">${isNew ? 'Add category' : 'Save'}</button>`
    });

    document.getElementById('categoryForm').addEventListener('submit', async event => {
        event.preventDefault();
        const body = {
            categoryName: document.getElementById('cfName').value.trim(),
            description: document.getElementById('cfDescription').value.trim()
        };
        if (!body.categoryName) {
            showFormError('categoryFormError', 'Category name is required.');
            return;
        }
        await withBusyButton(document.getElementById('categorySave'), async () => {
            try {
                if (isNew) {
                    await api('categories', { method: 'POST', body });
                } else {
                    await api('categories/' + category.categoryId, { method: 'PUT', body });
                }
                closeModal();
                showToast(`Category ${isNew ? 'added' : 'saved'}.`, 'success');
                refreshAdmin();
            } catch (error) {
                showFormError('categoryFormError', error.message);
            }
        });
    });
}

async function deleteCategory(category, productCount) {
    if (productCount > 0) {
        showToast(`${category.categoryName} still has ${productCount} product${productCount === 1 ? '' : 's'}. Move or delete them first.`, 'error');
        return;
    }
    const ok = await confirmDialog({
        title: 'Delete category?',
        message: `<strong>${esc(category.categoryName)}</strong> has no products and will be removed.`,
        confirmLabel: 'Delete',
        danger: true
    });
    if (!ok) return;
    try {
        await api('categories/' + category.categoryId, { method: 'DELETE' });
        showToast('Category deleted.', 'success');
        refreshAdmin();
    } catch (error) {
        showToast(error.message, 'error');
    }
}


// ===== ORDERS =====

async function renderOrdersAdmin(main) {
    admin.orders = await api('orders');

    const counts = { all: admin.orders.length };
    ORDER_STATUSES.forEach(s => counts[s] = admin.orders.filter(o => o.orderStatus === s).length);

    main.innerHTML = `
        ${adminHeader('Orders', 'Move orders from placed to ready to completed. Cancelling returns the items to stock.')}
        <div class="admin-toolbar">
            <label class="toolbar-search">${icon('search')}
                <span class="visually-hidden">Search orders</span>
                <input type="search" id="adminOrderSearch" placeholder="Order number, customer or email" value="${esc(admin.orderSearch)}">
            </label>
            <div class="segmented" role="group" aria-label="Order status">
                ${['all', ...ORDER_STATUSES].map(s => `
                    <button type="button" data-order-filter="${s}" class="${admin.orderFilter === s ? 'active' : ''}">
                        ${s === 'all' ? 'All' : s} <span class="seg-count">${counts[s]}</span>
                    </button>`).join('')}
            </div>
        </div>
        <div class="admin-card flush" id="adminOrderTable"></div>`;

    renderOrderRows();
    document.getElementById('adminOrderSearch').addEventListener('input', event => {
        admin.orderSearch = event.target.value;
        renderOrderRows();
    });
    main.querySelectorAll('[data-order-filter]').forEach(button => button.addEventListener('click', () => {
        admin.orderFilter = button.dataset.orderFilter;
        main.querySelectorAll('[data-order-filter]').forEach(b => b.classList.toggle('active', b === button));
        renderOrderRows();
    }));
}

function renderOrderRows() {
    const term = admin.orderSearch.trim().toLowerCase();
    const rows = admin.orders.filter(o =>
        (admin.orderFilter === 'all' || o.orderStatus === admin.orderFilter)
        && (!term || orderNumber(o.orderId).toLowerCase().includes(term) || String(o.orderId) === term
            || o.customerName.toLowerCase().includes(term) || o.customerEmail.toLowerCase().includes(term)));

    const container = document.getElementById('adminOrderTable');
    container.innerHTML = rows.length ? orderTable(rows, true) : emptyState('No orders match.', 'Try another status or search.');
    wireOrderTable(container);
}

// The order table is used on the dashboard (read-only) and the Orders screen (editable status)
function orderTable(orders, editable) {
    if (orders.length === 0) return '<p class="muted pad">No orders yet.</p>';
    return `
        <div class="table-scroll">
        <table class="data-table">
            <thead><tr>
                <th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Customer</th>
                <th scope="col" class="num">Items</th><th scope="col" class="num">Total</th><th scope="col">Status</th>
                <th scope="col"><span class="visually-hidden">Details</span></th>
            </tr></thead>
            <tbody>
            ${orders.map(o => `
                <tr>
                    <td class="mono strong">${orderNumber(o.orderId)}</td>
                    <td>${formatDate(o.orderDate, true)}</td>
                    <td><span class="strong">${esc(o.customerName)}</span><span class="muted block">${esc(o.customerEmail)}</span></td>
                    <td class="num">${o.unitCount}</td>
                    <td class="num">${money(o.totalAmount)}</td>
                    <td>${editable && o.orderStatus !== 'Cancelled' ? `
                        <label class="visually-hidden" for="status-${o.orderId}">Status of ${orderNumber(o.orderId)}</label>
                        <select class="status-select" id="status-${o.orderId}" data-status-order="${o.orderId}">
                            ${ORDER_STATUSES.map(s => `<option ${s === o.orderStatus ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>` : statusChip(o.orderStatus)}</td>
                    <td class="actions"><button type="button" class="btn-cs btn-cs-ghost btn-cs-sm" data-view-order="${o.orderId}">Details</button></td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

function wireOrderTable(container) {
    container.querySelectorAll('[data-view-order]').forEach(button => button.addEventListener('click', () =>
        showOrderDetails(Number(button.dataset.viewOrder))));

    container.querySelectorAll('[data-status-order]').forEach(select => select.addEventListener('change', async () => {
        const order = admin.orders.find(o => o.orderId === Number(select.dataset.statusOrder));
        const newStatus = select.value;

        if (newStatus === 'Cancelled') {
            const ok = await confirmDialog({
                title: `Cancel ${orderNumber(order.orderId)}?`,
                message: `The ${order.unitCount} item${order.unitCount === 1 ? '' : 's'} on this order go back into stock, and the order is removed from sales reports. This can't be undone.`,
                confirmLabel: 'Cancel order',
                danger: true
            });
            if (!ok) {
                select.value = order.orderStatus;
                return;
            }
        }

        select.disabled = true;
        try {
            await api(`orders/${order.orderId}/status`, { method: 'PUT', body: { status: newStatus } });
            showToast(`${orderNumber(order.orderId)} is now “${newStatus}”.`, 'success');
            refreshAdmin();
        } catch (error) {
            showToast(error.message, 'error');
            select.value = order.orderStatus;
            select.disabled = false;
        }
    }));
}

async function showOrderDetails(orderId) {
    openModal({ title: orderNumber(orderId), body: '<div class="loading-block"><span class="spinner"></span> Loading…</div>' });
    try {
        const order = await api('orders/' + orderId);
        document.getElementById('appModalBody').innerHTML = `
            <dl class="detail-meta">
                <div><dt>Customer</dt><dd>${esc(order.customerName)}<br><span class="muted">${esc(order.customerEmail)}</span></dd></div>
                <div><dt>Placed</dt><dd>${formatDate(order.orderDate, true)}</dd></div>
                <div><dt>Status</dt><dd>${statusChip(order.orderStatus)}</dd></div>
            </dl>
            <ul class="review-list">
                ${order.items.map(item => `
                <li>
                    ${imgTag(item.imageUrl, '')}
                    <div class="review-name"><span>${esc(item.productName)}</span><span class="muted mono">${esc(item.sku)} · ${item.quantity} × ${money(item.unitPrice)}</span></div>
                    <span class="review-total">${money(item.quantity * item.unitPrice)}</span>
                </li>`).join('')}
            </ul>
            <dl class="totals">
                <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
                <div><dt>Tax</dt><dd>${money(order.tax)}</dd></div>
                <div class="grand"><dt>Total</dt><dd>${money(order.totalAmount)}</dd></div>
            </dl>`;
    } catch (error) {
        document.getElementById('appModalBody').innerHTML = errorState(error.message);
    }
}


// ===== REPORTS =====
// Each report's data comes straight from one SQL query in ReportsController.cs
// (the same queries are in Database/reports.sql).

async function renderReports(main) {
    const [byProduct, byCategory, byMonth, customers, inventory] = await Promise.all([
        api('reports/sales-by-product'),
        api('reports/sales-by-category'),
        api('reports/sales-by-month'),
        api('reports/customers'),
        api('reports/inventory')
    ]);

    const categoryRevenue = byCategory.reduce((sum, row) => sum + row.revenue, 0);

    main.innerHTML = `
        ${adminHeader('Business reports', 'Live from MySQL. Cancelled orders are excluded from sales figures.',
            `<button type="button" class="btn-cs btn-cs-ghost" onclick="refreshAdmin()">${icon('refresh')} Refresh</button>`)}

        <nav class="report-jump" aria-label="Jump to report">
            <button type="button" data-jump="report-1">1 · Sales by product</button>
            <button type="button" data-jump="report-2">2 · Sales by category</button>
            <button type="button" data-jump="report-3">3 · Sales by month</button>
            <button type="button" data-jump="report-4">4 · Customers</button>
            <button type="button" data-jump="report-5">5 · Inventory</button>
        </nav>

        ${reportCard(1, 'Sales by product', 'Which products bring in the most money?',
            'JOIN OrderItem → CustomerOrder → Product → Category · GROUP BY product · SUM(), COUNT(DISTINCT)',
            byProduct.length ? hBarChart(byProduct.slice(0, 10), {
                label: r => r.productName, value: r => r.revenue, format: money,
                tip: r => `${r.productName}: ${money(r.revenue)} from ${r.unitsSold} units`,
                title: 'Revenue for the top 10 products'
            }) + `<p class="chart-note">Top 10 of ${byProduct.length} products that have sold.</p>` : '',
            dataTable(byProduct, [
                { label: 'Product', value: r => `${esc(r.productName)}<span class="mono muted block">${esc(r.sku)}</span>` },
                { label: 'Category', value: r => esc(r.categoryName) },
                { label: 'Orders', value: r => r.ordersCount, num: true },
                { label: 'Units sold', value: r => r.unitsSold, num: true },
                { label: 'Revenue', value: r => money(r.revenue), num: true }
            ]))}

        ${reportCard(2, 'Sales by category', 'Which departments perform best?',
            'JOIN Category → Product → OrderItem → CustomerOrder · GROUP BY category · SUM(), AVG()',
            byCategory.length ? hBarChart(byCategory, {
                label: r => r.categoryName, value: r => r.revenue,
                format: v => `${money(v)} · ${Math.round(v / categoryRevenue * 100)}%`,
                tip: r => `${r.categoryName}: ${money(r.revenue)} (${r.unitsSold} units)`,
                title: 'Revenue by category'
            }) : '',
            dataTable(byCategory, [
                { label: 'Category', value: r => esc(r.categoryName) },
                { label: 'Orders', value: r => r.ordersCount, num: true },
                { label: 'Units sold', value: r => r.unitsSold, num: true },
                { label: 'Avg unit price', value: r => money(r.avgUnitPrice), num: true },
                { label: 'Revenue', value: r => money(r.revenue), num: true },
                { label: 'Share', value: r => Math.round(r.revenue / categoryRevenue * 100) + '%', num: true }
            ]))}

        ${reportCard(3, 'Sales by month', 'How are sales trending over time?',
            'JOIN CustomerOrder → OrderItem · GROUP BY DATE_FORMAT(orderDate) · COUNT(DISTINCT), SUM()',
            byMonth.length ? columnChart(byMonth, {
                label: r => monthLabel(r.salesMonth), value: r => r.merchandiseSales,
                tip: r => `${money(r.merchandiseSales)}<br>${r.ordersCount} orders · avg ${money(r.avgOrderValue)}`,
                title: 'Merchandise sales by month'
            }) : '',
            dataTable(byMonth, [
                { label: 'Month', value: r => monthLabel(r.salesMonth) },
                { label: 'Orders', value: r => r.ordersCount, num: true },
                { label: 'Units sold', value: r => r.unitsSold, num: true },
                { label: 'Merchandise sales', value: r => money(r.merchandiseSales), num: true },
                { label: 'Avg order value', value: r => money(r.avgOrderValue), num: true }
            ]))}

        ${reportCard(4, 'Customer purchasing activity', 'Who are the most valuable customers?',
            'User LEFT JOIN CustomerOrder · GROUP BY customer · COUNT(), SUM(), AVG(), MAX()',
            '',
            dataTable(customers, [
                { label: 'Customer', value: r => `<span class="strong">${esc(r.customerName)}</span><span class="muted block">${esc(r.email)}</span>` },
                { label: 'Orders', value: r => r.ordersCount, num: true },
                { label: 'Avg order', value: r => r.ordersCount ? money(r.avgOrderTotal) : '—', num: true },
                { label: 'Last order', value: r => r.lastOrderDate ? formatDate(r.lastOrderDate) : 'Never' },
                { label: 'Total spent', value: r => inlineBar(r.totalSpent, customers[0] ? customers[0].totalSpent : 0, money(r.totalSpent)) }
            ]), true)}

        ${reportCard(5, 'Inventory health by category', 'Where is stock running low, and how much is on the shelves?',
            'Category LEFT JOIN Product · GROUP BY category · COUNT(), SUM(), SUM(CASE …)',
            '',
            dataTable(inventory, [
                { label: 'Category', value: r => esc(r.categoryName) },
                { label: 'Active products', value: r => r.activeProducts, num: true },
                { label: 'Units in stock', value: r => r.unitsInStock, num: true },
                { label: 'Low stock', value: r => r.lowStockProducts ? `<span class="stock-pill low">${icon('alert')} ${r.lowStockProducts} low</span>` : '<span class="muted">0</span>', num: true },
                { label: 'Sold out', value: r => r.outOfStockProducts ? `<span class="stock-pill out">${icon('alert')} ${r.outOfStockProducts} out</span>` : '<span class="muted">0</span>', num: true },
                { label: 'Inventory value', value: r => inlineBar(r.inventoryValue, Math.max(...inventory.map(i => i.inventoryValue)), money(r.inventoryValue)) }
            ]), true)}`;

    main.querySelectorAll('[data-jump]').forEach(link => link.addEventListener('click', () =>
        document.getElementById(link.dataset.jump).scrollIntoView({ behavior: 'smooth' })));
}

// One report section. Reports with a chart also get a collapsible data table;
// table-only reports show the table directly.
function reportCard(number, title, question, sqlNote, chartHtml, tableHtml, tableOnly = false) {
    const empty = tableHtml === '' ? '<p class="muted">No data yet. Reports fill in as orders are placed.</p>' : '';
    return `
        <section class="admin-card report-card" id="report-${number}" aria-labelledby="report-title-${number}">
            <div class="report-head">
                <span class="report-num">${number}</span>
                <div>
                    <h2 id="report-title-${number}">${title}</h2>
                    <p class="muted">${question}</p>
                </div>
            </div>
            <p class="sql-note mono">${sqlNote}</p>
            ${empty || (tableOnly ? tableHtml : `${chartHtml}
                <details class="report-table"><summary>View data table</summary>${tableHtml}</details>`)}
        </section>`;
}

// columns: [{ label, value: row => html, num: true/false }]
function dataTable(rows, columns) {
    if (rows.length === 0) return '';
    return `
        <div class="table-scroll">
        <table class="data-table compact">
            <thead><tr>${columns.map(c => `<th scope="col" class="${c.num ? 'num' : ''}">${c.label}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${columns.map(c => `<td class="${c.num ? 'num' : ''}">${c.value(row)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        </div>`;
}

// ----- Small charts drawn with HTML and CSS (no chart library needed) -----

// Horizontal bars: one row per item, value printed at the end of each bar
function hBarChart(rows, { label, value, format, tip, title }) {
    const max = Math.max(...rows.map(value), 0) || 1;
    return `
        <div class="hbar-chart" role="img" aria-label="${esc(title)}">
            ${rows.map(row => `
            <div class="hbar-row" title="${esc(tip(row))}">
                <span class="hbar-label">${esc(label(row))}</span>
                <span class="hbar-track"><span class="hbar-fill" style="width:${(value(row) / max * 100).toFixed(1)}%"></span></span>
                <span class="hbar-value">${format(value(row))}</span>
            </div>`).join('')}
        </div>`;
}

// Vertical columns with a hover/focus tooltip and a few gridlines
function columnChart(rows, { label, value, tip, title }) {
    const max = Math.max(...rows.map(value), 0) || 1;
    const niceMax = Math.ceil(max / 100) * 100;
    return `
        <div class="col-chart" role="img" aria-label="${esc(title)}">
            <div class="col-grid" aria-hidden="true">
                ${[1, 0.5, 0].map(f => `<span style="bottom:${f * 100}%"><em>${money(niceMax * f).replace('.00', '')}</em></span>`).join('')}
            </div>
            <div class="col-bars">
                ${rows.map(row => `
                <div class="col" tabindex="0" aria-label="${esc(label(row))}: ${money(value(row))}">
                    <span class="col-tip">${tip(row)}</span>
                    <span class="col-bar" style="height:${(value(row) / niceMax * 100).toFixed(1)}%"></span>
                    <span class="col-label">${esc(label(row))}</span>
                </div>`).join('')}
            </div>
        </div>`;
}

// A bar inside a table cell, with the value printed next to it
function inlineBar(value, max, text) {
    const width = max > 0 ? (value / max * 100).toFixed(1) : 0;
    return `<span class="inline-bar"><span class="inline-bar-track"><span style="width:${width}%"></span></span><span class="inline-bar-text">${text}</span></span>`;
}
