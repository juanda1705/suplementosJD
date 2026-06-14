/**
 * ============================================================
 * SUPLEMENTOS JD - ZONA FIT | app.js
 * Frontend logic: Supabase client, cart state, rendering
 * ============================================================
 */

'use strict';

// --- CONFIGURATION (replace with your values) ---------------
const SUPABASE_URL      = 'https://rmisqvgkskyuemceobay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pNZidKSq0aBmiDbs3qUJ6Q_0x_j8TBq';
const EDGE_FN_BASE     = `${SUPABASE_URL}/functions/v1`;

// --- SUPABASE CLIENT ----------------------------------------
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// CART MODULE
// ============================================================
const Cart = (() => {
  const STORAGE_KEY = 'jd_cart_v2';

  /**
   * Cart item schema:
   * { variant_id, product_id, name, brand, flavor, size,
   *   price, image, quantity }
   */

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    } catch {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    _broadcast();
  }

  function _broadcast() {
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: load() } }));
  }

  function add(item) {
    const items = load();
    const idx = items.findIndex(i => i.variant_id === item.variant_id);
    if (idx > -1) {
      items[idx].quantity = Math.min(items[idx].quantity + item.quantity, 10);
    } else {
      items.push({ ...item, quantity: Math.max(1, item.quantity) });
    }
    save(items);
  }

  function remove(variantId) {
    save(load().filter(i => i.variant_id !== variantId));
  }

  function updateQty(variantId, delta) {
    const items = load();
    const idx = items.findIndex(i => i.variant_id === variantId);
    if (idx < 0) return;
    const newQty = items[idx].quantity + delta;
    if (newQty <= 0) {
      items.splice(idx, 1);
    } else {
      items[idx].quantity = Math.min(newQty, 10);
    }
    save(items);
  }

  function clear() { save([]); }

  function count() { return load().reduce((s, i) => s + i.quantity, 0); }

  function total() {
    return load().reduce((s, i) => s + i.price * i.quantity, 0);
  }

  return { load, add, remove, updateQty, clear, count, total };
})();

// ============================================================
// UTILITIES
// ============================================================

/** Format COP currency */
function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Sanitize text to prevent XSS */
function esc(str) {
  const el = document.createElement('div');
  el.textContent = str ?? '';
  return el.innerHTML;
}

/** Show toast notification */
function showToast(message, type = 'info', duration = 3500) {
  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="8"/><line x1="12" x2="12" y1="12" y2="16"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] ?? icons.info}</span><span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
// CART DRAWER
// ============================================================
function initCartDrawer() {
  const overlay    = document.getElementById('cart-overlay');
  const drawer     = document.getElementById('cart-drawer');
  const closeBtn   = document.getElementById('cart-close-btn');
  const cartBtns   = document.querySelectorAll('[data-action="open-cart"]');

  if (!drawer) return;

  function open()  { overlay?.classList.add('open'); drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function close() { overlay?.classList.remove('open'); drawer.classList.remove('open'); document.body.style.overflow = ''; }

  cartBtns.forEach(btn => btn.addEventListener('click', open));
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  renderCartDrawer();
  window.addEventListener('cart:updated', renderCartDrawer);
}

function renderCartDrawer() {
  const items      = Cart.load();
  const listEl     = document.getElementById('cart-items-list');
  const totalEl    = document.getElementById('cart-total-value');
  const badgeEls   = document.querySelectorAll('.cart-badge');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  // Update badge
  const count = Cart.count();
  badgeEls.forEach(b => {
    b.textContent = count > 99 ? '99+' : count;
    b.classList.toggle('hidden', count === 0);
    if (count > 0) {
      b.classList.add('bump');
      setTimeout(() => b.classList.remove('bump'), 300);
    }
  });

  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="cart-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
        </svg>
        <p>Tu carrito está vacío.<br>Agrega tus suplementos favoritos.</p>
      </div>`;
    if (totalEl) totalEl.textContent = formatCOP(0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;
  if (totalEl) totalEl.textContent = formatCOP(Cart.total());

  listEl.innerHTML = items.map(item => `
    <div class="cart-item" data-variant="${esc(item.variant_id)}">
      <img class="cart-item-img" src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" onerror="this.src='https://placehold.co/72x72/161616/FFD700?text=JD'">
      <div class="cart-item-info">
        <p class="cart-item-name">${esc(item.name)}</p>
        ${item.flavor || item.size ? `<p class="cart-item-variant">${esc([item.flavor, item.size].filter(Boolean).join(' · '))}</p>` : ''}
        <p class="cart-item-price">${formatCOP(item.price * item.quantity)}</p>
        <div class="qty-controls">
          <button class="qty-btn" data-action="qty-dec" data-variant="${esc(item.variant_id)}" aria-label="Disminuir cantidad">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" data-action="qty-inc" data-variant="${esc(item.variant_id)}" aria-label="Aumentar cantidad">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-action="remove-item" data-variant="${esc(item.variant_id)}" aria-label="Eliminar del carrito">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`).join('');

  // Event delegation for cart actions
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const variantId = btn.dataset.variant;
    if (btn.dataset.action === 'qty-dec') Cart.updateQty(variantId, -1);
    if (btn.dataset.action === 'qty-inc') Cart.updateQty(variantId, +1);
    if (btn.dataset.action === 'remove-item') Cart.remove(variantId);
  }, { once: true });
}

// ============================================================
// CHECKOUT
// ============================================================
async function initiateCheckout() {
  const items = Cart.load();
  if (items.length === 0) { showToast('Tu carrito está vacío.', 'error'); return; }

  const btn = document.getElementById('cart-checkout-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }

  try {
    const res = await fetch(`${EDGE_FN_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        items: items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      throw new Error(data.error ?? 'No se pudo crear la sesión de pago.');
    }

    Cart.clear();
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message ?? 'Error al conectar con el servidor de pagos.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Ir a pagar'; }
  }
}

// ============================================================
// PRODUCT CARD RENDERER
// ============================================================
function createProductCardHTML(product, options = {}) {
  const { showBadge = true } = options;
  const image = product.images?.[0] ?? `https://placehold.co/400x400/111111/FFD700?text=${encodeURIComponent(product.name)}`;
  const price = product.base_price ?? 0;
  const badge = product.is_featured
    ? '<span class="product-card-badge badge-featured">Top Venta</span>'
    : '';

  return `
    <article class="product-card">
      <a href="product.html?slug=${encodeURIComponent(product.slug)}" class="product-card-img-wrap" tabindex="-1" aria-hidden="true">
        ${showBadge ? badge : ''}
        <img class="product-card-img" src="${esc(image)}" alt="${esc(product.name)}" loading="lazy"
             onerror="this.src='https://placehold.co/400x400/111111/FFD700?text=JD'">
        <div class="product-card-quick-add">
          <a href="product.html?slug=${encodeURIComponent(product.slug)}" class="btn btn-primary btn-sm">Ver producto</a>
        </div>
      </a>
      <div class="product-card-body">
        <p class="product-card-brand">${esc(product.brand)}</p>
        <a href="product.html?slug=${encodeURIComponent(product.slug)}">
          <h3 class="product-card-name">${esc(product.name)}</h3>
        </a>
        ${product.short_desc ? `<p class="product-card-desc">${esc(product.short_desc)}</p>` : ''}
        <div class="product-card-footer">
          <span class="product-card-price">
            <span class="currency">$</span>${Math.floor(price).toLocaleString('es-CO')}
          </span>
          <a href="product.html?slug=${encodeURIComponent(product.slug)}" class="btn btn-outline btn-sm">Comprar</a>
        </div>
      </div>
    </article>`;
}

function createSkeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="product-card skeleton">
      <div class="product-card-img-wrap skeleton"></div>
      <div class="product-card-body">
        <div class="sk-line brand skeleton"></div>
        <div class="sk-line title skeleton"></div>
        <div class="sk-line skeleton"></div>
        <div class="sk-line price skeleton"></div>
      </div>
    </div>`).join('');
}

// ============================================================
// CATALOG PAGE
// ============================================================
async function initCatalogPage() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Show loading skeletons
  grid.innerHTML = createSkeletonCards(8);

  // Active filters state
  const filters = { categories: new Set(), goals: new Set() };
  let sortBy = 'name';
  let allProducts = [];

  // Load categories for filter sidebar
  const { data: categories } = await sb.from('categories').select('id, name, slug').order('name');
  renderCategoryFilters(categories ?? []);

  // Load products
  await loadProducts();

  document.getElementById('sort-select')?.addEventListener('change', e => {
    sortBy = e.target.value;
    renderGrid();
  });

  async function loadProducts() {
    const { data, error } = await sb
      .from('products')
      .select(`
        id, name, slug, brand, short_desc, base_price,
        is_featured, goal_tags, images,
        categories ( slug )
      `)
      .eq('is_active', true)
      .order('name');

    if (error) {
      grid.innerHTML = `<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:40px">Error cargando productos. Intenta de nuevo.</p>`;
      return;
    }

    allProducts = data ?? [];

    // Check URL params for category filter
    const params = new URLSearchParams(window.location.search);
    const catSlug = params.get('category');
    if (catSlug) filters.categories.add(catSlug);

    renderGrid();
    updateCount();
  }

  function getFiltered() {
    return allProducts.filter(p => {
      const catMatch = filters.categories.size === 0 || filters.categories.has(p.categories?.slug);
      const goalMatch = filters.goals.size === 0 || (p.goal_tags ?? []).some(g => filters.goals.has(g));
      return catMatch && goalMatch;
    }).sort((a, b) => {
      if (sortBy === 'price-asc')  return a.base_price - b.base_price;
      if (sortBy === 'price-desc') return b.base_price - a.base_price;
      if (sortBy === 'featured')   return b.is_featured - a.is_featured;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  function renderGrid() {
    const filtered = getFiltered();
    const countEl = document.getElementById('products-count');
    if (countEl) countEl.innerHTML = `<strong>${filtered.length}</strong> productos`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:64px 0;color:var(--text-muted)">
          <p style="font-size:16px;margin-bottom:12px">Sin resultados para los filtros actuales.</p>
          <button class="btn btn-outline btn-sm" onclick="clearFilters()">Limpiar filtros</button>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => createProductCardHTML(p)).join('');
  }

  function updateCount() {
    const countEl = document.getElementById('products-count');
    if (countEl) countEl.innerHTML = `<strong>${allProducts.length}</strong> productos`;
  }

  function renderCategoryFilters(cats) {
    const container = document.getElementById('filter-categories');
    if (!container) return;
    container.innerHTML = cats.map(cat => `
      <label class="filter-option">
        <input type="checkbox" value="${esc(cat.slug)}" ${filters.categories.has(cat.slug) ? 'checked' : ''}>
        ${esc(cat.name)}
      </label>`).join('');

    container.addEventListener('change', e => {
      const cb = e.target;
      if (cb.checked) filters.categories.add(cb.value);
      else filters.categories.delete(cb.value);
      renderGrid();
    });
  }

  window.clearFilters = () => {
    filters.categories.clear();
    filters.goals.clear();
    document.querySelectorAll('.filter-option input').forEach(cb => cb.checked = false);
    renderGrid();
  };
}

// ============================================================
// PRODUCT DETAIL PAGE
// ============================================================
async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('slug');
  if (!slug) { window.location.replace('catalogo.html'); return; }

  // Load product + variants
  const { data: product, error } = await sb
    .from('products')
    .select(`*, categories(name, slug), product_variants(*)`)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    document.querySelector('.product-detail')?.insertAdjacentHTML('beforebegin',
      `<p class="text-muted" style="text-align:center;padding:80px">Producto no encontrado.</p>`);
    return;
  }

  // Update page title
  document.title = `${product.name} | Suplementos JD`;

  // Gallery
  initGallery(product.images ?? []);

  // Product info
  document.getElementById('product-brand')?.insertAdjacentText('afterbegin', product.brand);
  document.getElementById('product-name')?.insertAdjacentText('afterbegin', product.name);
  document.getElementById('product-short-desc')?.insertAdjacentText('afterbegin', product.short_desc ?? '');

  // Tabs content
  if (product.benefits?.length) {
    const el = document.getElementById('tab-benefits');
    if (el) el.innerHTML = `<ul>${product.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }

  if (product.usage_mode) {
    const el = document.getElementById('tab-usage');
    if (el) el.innerHTML = `<p style="color:var(--text-secondary);line-height:1.8;font-size:15px">${esc(product.usage_mode)}</p>`;
  }

  if (product.nutrition_table) {
    renderNutritionTable(product.nutrition_table);
  }

  // Variants
  const variants = product.product_variants ?? [];
  initVariantSelectors(product, variants);

  // Breadcrumb
  const breadcrumb = document.getElementById('product-breadcrumb-cat');
  if (breadcrumb && product.categories) {
    breadcrumb.innerHTML = `<a href="catalogo.html?category=${encodeURIComponent(product.categories.slug)}">${esc(product.categories.name)}</a>`;
  }
}

function initGallery(images) {
  const mainImg  = document.getElementById('gallery-main-img');
  const thumbs   = document.getElementById('gallery-thumbs');
  if (!mainImg || !thumbs) return;

  const fallback = 'https://placehold.co/600x600/111111/FFD700?text=JD';
  const imgs = images.length > 0 ? images : [fallback];

  mainImg.src = imgs[0];
  mainImg.alt = 'Imagen del producto';

  thumbs.innerHTML = imgs.map((src, i) => `
    <button class="gallery-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Ver imagen ${i + 1}">
      <img src="${esc(src)}" alt="Vista ${i + 1}" loading="lazy" onerror="this.src='${fallback}'">
    </button>`).join('');

  thumbs.addEventListener('click', e => {
    const btn = e.target.closest('.gallery-thumb');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    mainImg.src = imgs[idx];
    thumbs.querySelectorAll('.gallery-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
  });
}

function initVariantSelectors(product, variants) {
  const flavorGroup = document.getElementById('flavor-group');
  const sizeGroup   = document.getElementById('size-group');
  const priceEl     = document.getElementById('product-price');
  const addBtn      = document.getElementById('add-to-cart-btn');
  const qtyInput    = document.getElementById('qty-value');

  if (!variants.length) {
    // No variants: use base price
    if (priceEl) priceEl.querySelector('.price-amount').textContent = Math.floor(product.base_price).toLocaleString('es-CO');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        Cart.add({
          variant_id: product.id,
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          flavor: null, size: null,
          price: product.base_price,
          image: product.images?.[0] ?? '',
          quantity: parseInt(qtyInput?.textContent ?? '1'),
        });
        showToast(`${product.name} añadido al carrito.`, 'success');
      });
    }
    return;
  }

  const flavors = [...new Set(variants.filter(v => v.flavor).map(v => v.flavor))];
  const sizes   = [...new Set(variants.filter(v => v.size).map(v => v.size))];

  let selectedFlavor = flavors[0] ?? null;
  let selectedSize   = sizes[0] ?? null;

  // Render flavor buttons
  if (flavorGroup && flavors.length) {
    flavorGroup.querySelector('.variant-options').innerHTML = flavors.map(f => `
      <button class="variant-btn ${f === selectedFlavor ? 'selected' : ''}" data-flavor="${esc(f)}">${esc(f)}</button>`).join('');

    flavorGroup.addEventListener('click', e => {
      const btn = e.target.closest('.variant-btn[data-flavor]');
      if (!btn) return;
      selectedFlavor = btn.dataset.flavor;
      flavorGroup.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('selected', b.dataset.flavor === selectedFlavor));
      const sel = document.getElementById('selected-flavor');
      if (sel) sel.textContent = selectedFlavor;
      updateVariantState();
    });

    const sel = document.getElementById('selected-flavor');
    if (sel) sel.textContent = selectedFlavor;
  } else {
    flavorGroup?.style.setProperty('display', 'none');
  }

  // Render size buttons
  if (sizeGroup && sizes.length) {
    sizeGroup.querySelector('.variant-options').innerHTML = sizes.map(s => `
      <button class="variant-btn ${s === selectedSize ? 'selected' : ''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');

    sizeGroup.addEventListener('click', e => {
      const btn = e.target.closest('.variant-btn[data-size]');
      if (!btn) return;
      selectedSize = btn.dataset.size;
      sizeGroup.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('selected', b.dataset.size === selectedSize));
      const sel = document.getElementById('selected-size');
      if (sel) sel.textContent = selectedSize;
      updateVariantState();
    });

    const sel = document.getElementById('selected-size');
    if (sel) sel.textContent = selectedSize;
  } else {
    sizeGroup?.style.setProperty('display', 'none');
  }

  function getActiveVariant() {
    return variants.find(v => {
      const fMatch = !selectedFlavor || v.flavor === selectedFlavor;
      const sMatch = !selectedSize   || v.size   === selectedSize;
      return fMatch && sMatch && v.is_active;
    }) ?? null;
  }

  function updateVariantState() {
    const variant = getActiveVariant();
    const priceAmount = priceEl?.querySelector('.price-amount');
    if (priceAmount) {
      priceAmount.textContent = variant
        ? Math.floor(variant.price).toLocaleString('es-CO')
        : Math.floor(product.base_price).toLocaleString('es-CO');
    }
    if (addBtn) {
      addBtn.disabled = !variant || variant.stock === 0;
      addBtn.textContent = !variant ? 'Selecciona opciones' : variant.stock === 0 ? 'Sin stock' : 'Agregar al carrito';
    }
  }

  updateVariantState();

  // Add to cart
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const variant = getActiveVariant();
      if (!variant) return;
      const qty = parseInt(qtyInput?.textContent ?? '1');
      Cart.add({
        variant_id: variant.id,
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        flavor: variant.flavor ?? null,
        size:   variant.size   ?? null,
        price:  Number(variant.price),
        image:  product.images?.[0] ?? '',
        quantity: qty,
      });
      showToast(`${product.name} añadido al carrito.`, 'success');
    });
  }
}

function renderNutritionTable(data) {
  const el = document.getElementById('tab-nutrition');
  if (!el) return;
  const rows = Array.isArray(data) ? data : Object.entries(data).map(([k, v]) => ({ nutriente: k, cantidad: v }));
  el.innerHTML = `
    <table class="nutrition-table">
      <thead><tr><th>Nutriente</th><th>Cantidad por porción</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr ${r.highlight ? 'class="highlight"' : ''}><td>${esc(r.nutriente)}</td><td>${esc(r.cantidad)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

// ============================================================
// TABS (Product page)
// ============================================================
function initTabs() {
  const tabsNav = document.querySelector('.tabs-nav');
  if (!tabsNav) return;

  tabsNav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === target));
  });
}

// ============================================================
// QUANTITY SELECTOR
// ============================================================
function initQtySelector() {
  const display = document.getElementById('qty-value');
  const decBtn  = document.getElementById('qty-dec');
  const incBtn  = document.getElementById('qty-inc');
  if (!display || !decBtn || !incBtn) return;

  let qty = 1;
  const update = () => { display.textContent = qty; };

  decBtn.addEventListener('click', () => { if (qty > 1) { qty--; update(); } });
  incBtn.addEventListener('click', () => { if (qty < 10) { qty++; update(); } });
}

// ============================================================
// HOME PAGE — TOP VENTAS
// ============================================================
async function initHomePage() {
  const grid = document.getElementById('top-ventas-grid');
  if (!grid) return;

  grid.innerHTML = createSkeletonCards(4);

  const { data, error } = await sb
    .from('products')
    .select('id, name, slug, brand, short_desc, base_price, is_featured, images')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('name')
    .limit(4);

  if (error || !data?.length) {
    grid.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center">Próximamente...</p>';
    return;
  }

  grid.innerHTML = data.map(p => createProductCardHTML(p)).join('');
}

// ============================================================
// CHECKOUT STATUS PAGE
// ============================================================
function initCheckoutStatusPage() {
  const params  = new URLSearchParams(window.location.search);
  const status  = params.get('status');
  const section = document.getElementById(`status-${status}`);
  if (section) {
    section.style.display = 'block';
    if (status === 'success') Cart.clear();
  }
}

// ============================================================
// MOBILE MENU
// ============================================================
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggleBtn || !mobileNav) return;

  toggleBtn.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('mobile-nav-open');
    toggleBtn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

// ============================================================
// INIT — Router
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  initCartDrawer();
  initMobileMenu();

  // Checkout button (in drawer)
  document.getElementById('cart-checkout-btn')?.addEventListener('click', initiateCheckout);

  // Route to page-specific logic
  switch (page) {
    case 'home':    initHomePage();    break;
    case 'catalog': initCatalogPage(); break;
    case 'product':
      initProductPage();
      initTabs();
      initQtySelector();
      break;
    case 'status':  initCheckoutStatusPage(); break;
  }
});