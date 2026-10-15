/**
 * ============================================================
 * SUPLEMENTOS JD | admin.js
 * Panel de administración completo
 * ============================================================
 */

'use strict';

// --- CONFIG (mismas credenciales que app.js) -----------------
const SUPABASE_URL      = 'https://rmisqvgkskyuemceobay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pNZidKSq0aBmiDbs3qUJ6Q_0x_j8TBq';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// UTILS
// ============================================================
function esc(str) {
  const el = document.createElement('div');
  el.textContent = str ?? '';
  return el.innerHTML;
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(n ?? 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateISO(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function showToast(msg, type = 'info') {
  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="8"/><line x1="12" x2="12" y1="12" y2="16"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] ?? icons.info}</span><span>${esc(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 300ms, transform 300ms';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** Promise-based confirm dialog */
function confirmDialog(title, text, okLabel = 'Eliminar') {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent  = text;
    document.getElementById('confirm-ok').textContent    = okLabel;
    document.getElementById('confirm-overlay').classList.add('open');
    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = (val) => {
      document.getElementById('confirm-overlay').classList.remove('open');
      ok.replaceWith(ok.cloneNode(true));     // remove old listeners
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(val);
    };
    document.getElementById('confirm-ok').addEventListener('click', () => cleanup(true), { once: true });
    document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false), { once: true });
  });
}

function statusBadge(status) {
  const map = {
    pending:   ['Pendiente',  'badge-pending'],
    paid:      ['Pagado',     'badge-paid'],
    shipped:   ['Enviado',    'badge-shipped'],
    delivered: ['Entregado',  'badge-delivered'],
    cancelled: ['Cancelado',  'badge-cancelled'],
  };
  const [label, cls] = map[status] ?? ['Desconocido', 'badge-inactive'];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

// ============================================================
// NAVIGATION
// ============================================================
const panelTitles = {
  dashboard:  'Dashboard',
  products:   'Productos',
  categories: 'Categorías',
  orders:     'Pedidos',
  caja:       'Caja / Contabilidad',
  clientes:   'Clientes potenciales',
};

window.adminNav = function(panel) {
  document.querySelectorAll('[data-panel]').forEach(l => {
    l.classList.toggle('active', l.dataset.panel === panel);
    if (l.closest('.admin-mobile-nav')) {
      if (l.dataset.panel === panel) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
    }
  });
  const mobileMoreButton = document.getElementById('mobile-more-btn');
  const mobileMoreMenu = document.getElementById('admin-mobile-more');
  const morePanelActive = panel === 'categories' || panel === 'clientes';
  mobileMoreButton?.classList.toggle('active', morePanelActive);
  mobileMoreButton?.setAttribute('aria-expanded', 'false');
  mobileMoreMenu?.classList.remove('open');
  document.querySelectorAll('.admin-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${panel}`);
  });
  document.getElementById('topbar-title').textContent = panelTitles[panel] ?? panel;

  // Lazy-load each panel once
  if (panel === 'dashboard')  loadDashboard();
  if (panel === 'products')   loadProducts();
  if (panel === 'categories') loadCategories();
  if (panel === 'orders')     loadOrders();
  if (panel === 'caja')       loadCaja();
  if (panel === 'clientes')   loadProspects();
  document.getElementById('admin-sidebar')?.classList.remove('open');
};

// ============================================================
// AUTH
// ============================================================
const adminEntryStartedAt = performance.now();
const adminEntryMinimumMs = 980;
let adminEntryTimer = 0;
let initialAdminEntryReleased = false;

function releaseInitialAdminEntry() {
  if (initialAdminEntryReleased) return;
  initialAdminEntryReleased = true;
  const remaining = Math.max(0, adminEntryMinimumMs - (performance.now() - adminEntryStartedAt));
  window.clearTimeout(adminEntryTimer);
  adminEntryTimer = window.setTimeout(() => {
    document.body.classList.add('admin-ready');
    document.getElementById('admin-entry-loader')?.setAttribute('aria-hidden', 'true');
  }, remaining);
}

function replayAdminEntryForLogin() {
  const loader = document.getElementById('admin-entry-loader');
  window.clearTimeout(adminEntryTimer);
  document.body.classList.remove('admin-ready');
  loader?.setAttribute('aria-hidden', 'false');
  const title = loader?.querySelector('.admin-entry-loader__title');
  const caption = loader?.querySelector('.admin-entry-loader__caption');
  if (title) title.textContent = 'Acceso verificado';
  if (caption) caption.textContent = 'Preparando tu espacio de administración';
  adminEntryTimer = window.setTimeout(() => {
    document.body.classList.add('admin-ready');
    loader?.setAttribute('aria-hidden', 'true');
  }, 920);
}

function hasAdminRole(user) {
  const appMetadata = user?.app_metadata ?? {};
  return appMetadata.role === 'admin'
    || (Array.isArray(appMetadata.roles) && appMetadata.roles.includes('admin'));
}

async function openAdminShellForVerifiedAdmin(candidateUser) {
  try {
    // Verify the signed-in identity with Supabase; never trust user-editable metadata.
    const { data, error } = await sb.auth.getUser();
    const verifiedUser = data?.user;
    if (!error && verifiedUser?.id === candidateUser?.id && hasAdminRole(verifiedUser)) {
      showShell(verifiedUser);
      return true;
    }
  } catch (error) {
    console.error('No fue posible validar los permisos del panel.', error);
  }

  await sb.auth.signOut();
  return false;
}

async function initAuth() {
  let session = null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    session = data?.session ?? null;
  } catch (error) {
    // The login screen remains available if the session check cannot reach Supabase.
    console.error('No fue posible recuperar la sesión del panel.', error);
  }
  const forceLogin = new URLSearchParams(window.location.search).get('login') === '1';
  if (session && !forceLogin) {
    const authorized = await openAdminShellForVerifiedAdmin(session.user);
    if (!authorized) {
      const errEl = document.getElementById('login-error');
      errEl.textContent = 'Esta cuenta no tiene permisos de administrador.';
      errEl.classList.add('visible');
    }
  }

  // Login button
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.remove('visible');

    if (!email || !password) {
      errEl.textContent = 'Completa todos los campos.';
      errEl.classList.add('visible');
      return;
    }

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando…';

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      errEl.textContent = 'Correo o contraseña incorrectos.';
      errEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Entrar al panel';
      return;
    }

    const authorized = await openAdminShellForVerifiedAdmin(data.user);
    if (!authorized) {
      errEl.textContent = 'Esta cuenta no tiene permisos de administrador.';
      errEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Entrar al panel';
    } else if (forceLogin) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('login');
      window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
  });

  // Allow Enter key on password field
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  // Logout is available in both the desktop sidebar and mobile dock.
  const logout = async () => {
    await sb.auth.signOut();
    document.getElementById('admin-shell').classList.remove('visible');
    document.getElementById('admin-login').style.display = 'flex';
  };
  ['logout-btn', 'mobile-logout-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', logout);
  });

  // Keep the intro visible until the initial session and role check has finished.
  releaseInitialAdminEntry();
}

function showShell(user) {
  // On later sign-ins, replay the transition only after Supabase verified the admin role.
  if (initialAdminEntryReleased) replayAdminEntryForLogin();
  document.getElementById('admin-login').style.display = 'none';
  const shell = document.getElementById('admin-shell');
  shell.classList.remove('is-entering');
  shell.classList.add('visible');
  requestAnimationFrame(() => shell.classList.add('is-entering'));
  window.setTimeout(() => shell.classList.remove('is-entering'), 900);
  document.getElementById('admin-email-display').textContent = user.email;
  document.getElementById('admin-avatar').textContent = (user.email?.[0] ?? 'A').toUpperCase();
  loadDashboard();
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  const [ordersRes, productsRes] = await Promise.all([
    sb.from('orders').select('id, total, status, created_at, wompi_reference, customer_email'),
    sb.from('products').select('id, name, is_active, is_featured, base_price, images'),
  ]);

  const orders   = ordersRes.data   ?? [];
  const products = productsRes.data ?? [];

  // Metrics
  const totalRevenue = orders.filter(o => o.status === 'paid' || o.status === 'delivered' || o.status === 'shipped')
    .reduce((s, o) => s + (o.total ?? 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  document.getElementById('metrics-grid').innerHTML = `
    <div class="metric-card">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="1" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <p class="metric-label">Ingresos confirmados</p>
      <p class="metric-value">${formatCOP(totalRevenue)}</p>
      <p class="metric-sub">Pedidos pagados / enviados / entregados</p>
    </div>
    <div class="metric-card">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <p class="metric-label">Total pedidos</p>
      <p class="metric-value">${orders.length}</p>
      <p class="metric-sub">${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}</p>
    </div>
    <div class="metric-card">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      </div>
      <p class="metric-label">Productos</p>
      <p class="metric-value">${products.length}</p>
      <p class="metric-sub">${products.filter(p => p.is_active).length} activos</p>
    </div>
    <div class="metric-card">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <p class="metric-label">Destacados</p>
      <p class="metric-value">${products.filter(p => p.is_featured).length}</p>
      <p class="metric-sub">Aparecen en el inicio</p>
    </div>
  `;

  // Update pending-order count in desktop navigation and the mobile dock.
  ['pending-badge', 'mobile-pending-badge'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? '' : 'none';
  });

  // Recent orders (last 5)
  const recent = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  document.getElementById('recent-orders-list').innerHTML = recent.length === 0
    ? `<div class="admin-empty"><p>Sin pedidos aún.</p></div>`
    : `<table class="admin-table">
        <thead><tr><th>Referencia</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          ${recent.map(o => `
            <tr style="cursor:pointer" onclick="openOrderModal('${esc(o.id)}')">
              <td style="font-family:monospace;font-size:12px">${esc(o.wompi_reference ?? o.id)}</td>
              <td>${formatDate(o.created_at)}</td>
              <td style="color:var(--gold-primary);font-weight:700">${formatCOP(o.total)}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

  // Featured products
  const featured = products.filter(p => p.is_featured).slice(0, 5);
  document.getElementById('featured-products-list').innerHTML = featured.length === 0
    ? `<div class="admin-empty"><p>Sin productos destacados.</p></div>`
    : `<table class="admin-table">
        <thead><tr><th>Imagen</th><th>Producto</th><th>Precio</th></tr></thead>
        <tbody>
          ${featured.map(p => `
            <tr>
              <td><img class="product-thumb" src="${esc(p.images?.[0] ?? '')}" alt="" onerror="this.src='https://placehold.co/44x44/161616/FFD700?text=JD'"></td>
              <td class="product-name-cell">${esc(p.name)}</td>
              <td style="color:var(--gold-primary);font-weight:700">${formatCOP(p.base_price)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
}

// ============================================================
// PRODUCTS
// ============================================================
let _products = [];
let _categories = [];

async function loadProducts() {
  document.getElementById('products-table-wrap').innerHTML =
    `<div class="admin-loading"><div class="spin"></div></div>`;

  const [prodRes, catRes] = await Promise.all([
    sb.from('products').select(`
      id, name, slug, brand, base_price, is_active, is_featured, images,
      categories ( name )
    `).order('name'),
    sb.from('categories').select('id, name, slug').order('name'),
  ]);

  _products   = prodRes.data   ?? [];
  _categories = catRes.data    ?? [];

  renderProductsTable(_products);
}

function renderProductsTable(list) {
  if (list.length === 0) {
    document.getElementById('products-table-wrap').innerHTML =
      `<div class="admin-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
        <p>No hay productos. Crea el primero.</p>
      </div>`;
    return;
  }

  document.getElementById('products-table-wrap').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th></th>
          <th>Producto</th>
          <th>Marca</th>
          <th>Categoría</th>
          <th>Precio</th>
          <th>Estado</th>
          <th>Destacado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(p => `
          <tr>
            <td data-label="Imagen"><img class="product-thumb" src="${esc(p.images?.[0] ?? '')}" alt="" onerror="this.src='https://placehold.co/44x44/161616/FFD700?text=JD'"></td>
            <td class="product-name-cell" data-label="Producto">${esc(p.name)}</td>
            <td data-label="Marca">${esc(p.brand ?? '—')}</td>
            <td data-label="Categoría">${esc(p.categories?.name ?? '—')}</td>
            <td data-label="Precio" style="color:var(--gold-primary);font-weight:700">${formatCOP(p.base_price)}</td>
            <td data-label="Estado">${p.is_active
              ? '<span class="status-badge badge-active">Activo</span>'
              : '<span class="status-badge badge-inactive">Inactivo</span>'}</td>
            <td data-label="Destacado" style="text-align:center">${p.is_featured ? '⭐' : '—'}</td>
            <td data-label="Acciones">
              <div class="table-actions">
                <button class="icon-btn gold" title="Editar" onclick="openProductModal('${esc(p.id)}')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="icon-btn danger" title="Eliminar" onclick="deleteProduct('${esc(p.id)}', '${esc(p.name)}')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// Search
document.getElementById('product-search')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderProductsTable(_products.filter(p =>
    p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)
  ));
});

// ============================================================
// PRODUCT MODAL
// ============================================================
let _editingProductId = null;
let _productImages    = []; // { url: string, file?: File }
let _goalTags         = [];
let _variants         = [];

window.openProductModal = async function(productId = null) {
  _editingProductId = productId;
  _productImages    = [];
  _goalTags         = [];
  _variants         = [];

  // Populate category dropdown
  const catSel = document.getElementById('p-category');
  catSel.innerHTML = `<option value="">Sin categoría</option>` +
    _categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

  // Reset form
  ['p-name','p-brand','p-slug','p-price','p-short-desc','p-desc'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p-active').checked   = true;
  document.getElementById('p-featured').checked = false;
  document.getElementById('variants-list').innerHTML = '';
  document.getElementById('img-preview-grid').innerHTML = '';
  renderGoalTags();

  if (productId) {
    document.getElementById('product-modal-title').textContent = 'Editar producto';
    const { data: p } = await sb.from('products')
      .select('*, categories(id, name), product_variants(*)')
      .eq('id', productId).single();

    if (p) {
      document.getElementById('p-name').value       = p.name ?? '';
      document.getElementById('p-brand').value      = p.brand ?? '';
      document.getElementById('p-slug').value       = p.slug ?? '';
      document.getElementById('p-price').value      = p.base_price ?? '';
      document.getElementById('p-short-desc').value = p.short_desc ?? '';
      document.getElementById('p-desc').value       = p.description ?? '';
      document.getElementById('p-active').checked   = p.is_active ?? true;
      document.getElementById('p-featured').checked = p.is_featured ?? false;
      catSel.value = p.category_id ?? '';
      _goalTags = p.goal_tags ?? [];
      _productImages = (p.images ?? []).map(url => ({ url }));
      _variants = (p.product_variants ?? []).map(v => ({
        id: v.id, flavor: v.flavor ?? '', size: v.size ?? '',
        price: v.price ?? '', stock: v.stock ?? 0
      }));
    }
  } else {
    document.getElementById('product-modal-title').textContent = 'Nuevo producto';
  }

  renderGoalTags();
  renderImgPreview();
  renderVariants();
  document.getElementById('product-modal-overlay').classList.add('open');
};

// Auto-slug from name
document.getElementById('p-name')?.addEventListener('input', e => {
  if (!_editingProductId) {
    document.getElementById('p-slug').value = slugify(e.target.value);
  }
});

// Close buttons
['product-modal-close','product-modal-cancel'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('product-modal-overlay').classList.remove('open');
  });
});

// Save product
document.getElementById('product-modal-save')?.addEventListener('click', saveProduct);

async function saveProduct() {
  const name      = document.getElementById('p-name').value.trim();
  const brand     = document.getElementById('p-brand').value.trim();
  const slug      = document.getElementById('p-slug').value.trim();
  const price     = parseFloat(document.getElementById('p-price').value);
  const shortDesc = document.getElementById('p-short-desc').value.trim();
  const desc      = document.getElementById('p-desc').value.trim();
  const isActive  = document.getElementById('p-active').checked;
  const isFeatured= document.getElementById('p-featured').checked;
  const catId     = document.getElementById('p-category').value || null;

  if (!name || !slug || isNaN(price)) {
    showToast('Nombre, slug y precio son obligatorios.', 'error');
    return;
  }

  const btn = document.getElementById('product-modal-save');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    // 1. Upload new images to Supabase Storage
    const uploadedUrls = [];
    for (const img of _productImages) {
      if (img.file) {
        const ext  = img.file.name.split('.').pop();
        const path = `products/${slug}-${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from('product-images').upload(path, img.file, { upsert: true });
        if (upErr) {
          const isBucketMissing = upErr.message?.toLowerCase().includes('bucket') ||
                                  upErr.statusCode === 404 || upErr.error === 'Bucket not found';
          if (isBucketMissing) {
            throw new Error(
              'Bucket "product-images" no existe en Supabase Storage. ' +
              'Ve a tu proyecto Supabase → Storage → New bucket → ' +
              'Nombre: product-images → marca "Public bucket" → Create.'
            );
          }
          throw new Error('Error subiendo imagen: ' + upErr.message);
        }
        const { data: urlData } = sb.storage.from('product-images').getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      } else {
        uploadedUrls.push(img.url);
      }
    }

    const payload = {
      name, brand, slug, base_price: price,
      short_desc: shortDesc || null,
      description: desc || null,
      is_active: isActive, is_featured: isFeatured,
      category_id: catId,
      goal_tags: _goalTags,
      images: uploadedUrls,
    };

    let productId = _editingProductId;

    if (_editingProductId) {
      const { error } = await sb.from('products').update(payload).eq('id', _editingProductId);
      if (error) throw error;
    } else {
      const { data, error } = await sb.from('products').insert(payload).select('id').single();
      if (error) throw error;
      productId = data.id;
    }

    // 2. Save variants
    if (productId && _variants.length > 0) {
      // Delete old ones and re-insert (simplest approach for edits)
      await sb.from('product_variants').delete().eq('product_id', productId);
      const variantsPayload = _variants
        .filter(v => v.price)
        .map(v => ({
          product_id: productId,
          flavor: v.flavor || null,
          size:   v.size   || null,
          price:  parseFloat(v.price),
          stock:  parseInt(v.stock) || 0,
        }));
      if (variantsPayload.length > 0) {
        const { error: vErr } = await sb.from('product_variants').insert(variantsPayload);
        if (vErr) throw vErr;
      }
    }

    showToast(_editingProductId ? 'Producto actualizado.' : 'Producto creado.', 'success');
    document.getElementById('product-modal-overlay').classList.remove('open');
    loadProducts();
    loadDashboard();

  } catch (err) {
    console.error(err);
    showToast(err.message ?? 'Error guardando el producto.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar producto';
  }
}

window.deleteProduct = async function(id, name) {
  const ok = await confirmDialog(
    '¿Eliminar producto?',
    `Esto eliminará "${name}" permanentemente. No se puede deshacer.`
  );
  if (!ok) return;

  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) {
    showToast('Error al eliminar: ' + error.message, 'error');
  } else {
    showToast('Producto eliminado.', 'success');
    loadProducts();
    loadDashboard();
  }
};

// --- Image handling ---
function renderImgPreview() {
  const grid = document.getElementById('img-preview-grid');
  if (_productImages.length === 0) { grid.innerHTML = ''; return; }
  grid.innerHTML = _productImages.map((img, i) => `
    <div class="img-preview-item">
      <img src="${esc(img.url)}" alt="Imagen ${i+1}">
      <button class="img-preview-remove" onclick="removeProductImage(${i})" title="Quitar imagen">×</button>
    </div>`).join('');
}

window.removeProductImage = function(idx) {
  _productImages.splice(idx, 1);
  renderImgPreview();
};

document.getElementById('img-file-input')?.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    _productImages.push({ url, file });
  });
  renderImgPreview();
  e.target.value = '';
});

// --- Goal tags ---
function renderGoalTags() {
  const wrap = document.getElementById('goal-tags-wrap');
  const existingInput = document.getElementById('goal-tags-input');

  // Remove old chips but keep the input
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());

  _goalTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(tag)} <button onclick="removeGoalTag(${i})">×</button>`;
    wrap.insertBefore(chip, existingInput);
  });
}

window.removeGoalTag = function(idx) {
  _goalTags.splice(idx, 1);
  renderGoalTags();
};

document.getElementById('goal-tags-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().toLowerCase().replace(/,/g, '');
    if (val && !_goalTags.includes(val)) {
      _goalTags.push(val);
      renderGoalTags();
    }
    e.target.value = '';
  }
});

// --- Variants ---
function renderVariants() {
  const list = document.getElementById('variants-list');
  list.innerHTML = _variants.map((v, i) => `
    <div class="variant-row">
      <input class="form-input" type="text" placeholder="Sabor" value="${esc(v.flavor)}"
             oninput="_variants[${i}].flavor = this.value">
      <input class="form-input" type="text" placeholder="Tamaño" value="${esc(v.size)}"
             oninput="_variants[${i}].size = this.value">
      <input class="form-input" type="number" placeholder="Precio" value="${esc(v.price)}"
             oninput="_variants[${i}].price = this.value">
      <input class="form-input" type="number" placeholder="Stock" value="${esc(String(v.stock))}"
             oninput="_variants[${i}].stock = this.value">
      <button class="icon-btn danger" onclick="removeVariant(${i})" title="Eliminar variante">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
      </button>
    </div>`).join('');
}

window.removeVariant = function(idx) {
  _variants.splice(idx, 1);
  renderVariants();
};

document.getElementById('add-variant-btn')?.addEventListener('click', () => {
  _variants.push({ flavor: '', size: '', price: '', stock: 0 });
  renderVariants();
});

document.getElementById('add-product-btn')?.addEventListener('click', () => openProductModal());

// ============================================================
// CATEGORIES
// ============================================================
let _editingCatId = null;

async function loadCategories() {
  document.getElementById('cat-grid').innerHTML =
    `<div class="admin-loading"><div class="spin"></div></div>`;

  const { data: cats } = await sb.from('categories').select('*').order('name');
  _categories = cats ?? [];

  if (_categories.length === 0) {
    document.getElementById('cat-grid').innerHTML =
      `<div class="admin-empty"><p>Sin categorías. Crea la primera.</p></div>`;
    return;
  }

  document.getElementById('cat-grid').innerHTML = _categories.map(c => `
    <div class="cat-card">
      <p class="cat-card-name">${esc(c.name)}</p>
      <p class="cat-card-slug">${esc(c.slug)}</p>
      ${c.description ? `<p style="font-size:13px;color:var(--text-muted)">${esc(c.description)}</p>` : ''}
      <div class="cat-card-actions">
        <button class="icon-btn gold" onclick="openCatModal('${esc(c.id)}')" title="Editar">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="deleteCat('${esc(c.id)}', '${esc(c.name)}')" title="Eliminar">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

window.openCatModal = async function(catId = null) {
  _editingCatId = catId;
  document.getElementById('cat-name').value  = '';
  document.getElementById('cat-slug').value  = '';
  document.getElementById('cat-desc').value  = '';

  if (catId) {
    document.getElementById('cat-modal-title').textContent = 'Editar categoría';
    const cat = _categories.find(c => c.id === catId);
    if (cat) {
      document.getElementById('cat-name').value = cat.name ?? '';
      document.getElementById('cat-slug').value = cat.slug ?? '';
      document.getElementById('cat-desc').value = cat.description ?? '';
    }
  } else {
    document.getElementById('cat-modal-title').textContent = 'Nueva categoría';
  }

  document.getElementById('cat-modal-overlay').classList.add('open');
};

['cat-modal-close','cat-modal-cancel'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('cat-modal-overlay').classList.remove('open');
  });
});

document.getElementById('cat-name')?.addEventListener('input', e => {
  if (!_editingCatId) {
    document.getElementById('cat-slug').value = slugify(e.target.value);
  }
});

document.getElementById('cat-modal-save')?.addEventListener('click', async () => {
  const name = document.getElementById('cat-name').value.trim();
  const slug = document.getElementById('cat-slug').value.trim();
  const desc = document.getElementById('cat-desc').value.trim();
  if (!name || !slug) { showToast('Nombre y slug obligatorios.', 'error'); return; }

  const payload = { name, slug, description: desc || null };
  let error;

  if (_editingCatId) {
    ({ error } = await sb.from('categories').update(payload).eq('id', _editingCatId));
  } else {
    ({ error } = await sb.from('categories').insert(payload));
  }

  if (error) {
    showToast('Error: ' + error.message, 'error');
  } else {
    showToast(_editingCatId ? 'Categoría actualizada.' : 'Categoría creada.', 'success');
    document.getElementById('cat-modal-overlay').classList.remove('open');
    loadCategories();
  }
});

window.deleteCat = async function(id, name) {
  const ok = await confirmDialog('¿Eliminar categoría?',
    `Esto eliminará "${name}". Los productos vinculados quedarán sin categoría.`);
  if (!ok) return;
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) showToast('Error: ' + error.message, 'error');
  else { showToast('Categoría eliminada.', 'success'); loadCategories(); }
};

document.getElementById('add-cat-btn')?.addEventListener('click', () => openCatModal());

// ============================================================
// ORDERS
// ============================================================
let _orders = [];

async function loadOrders() {
  document.getElementById('orders-table-wrap').innerHTML =
    `<div class="admin-loading"><div class="spin"></div></div>`;

  const { data } = await sb.from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  _orders = data ?? [];
  renderOrdersTable(_orders);
}

function renderOrdersTable(list) {
  if (list.length === 0) {
    document.getElementById('orders-table-wrap').innerHTML =
      `<div class="admin-empty"><p>Sin pedidos aún.</p></div>`;
    return;
  }

  document.getElementById('orders-table-wrap').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Referencia</th>
          <th>Cliente</th>
          <th>Fecha</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Actualizar</th>
          <th>Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(o => `
          <tr>
            <td data-label="Referencia" style="font-family:monospace;font-size:12px">${esc(o.wompi_reference ?? o.id?.slice(0, 8))}</td>
            <td data-label="Cliente">${esc(o.customer_email ?? '—')}</td>
            <td data-label="Fecha" style="white-space:nowrap">${formatDate(o.created_at)}</td>
            <td data-label="Total" style="color:var(--gold-primary);font-weight:700">${formatCOP(o.total)}</td>
            <td data-label="Estado">${statusBadge(o.status)}</td>
            <td data-label="Actualizar">
              <select class="order-status-select" onchange="updateOrderStatus('${esc(o.id)}', this.value)">
                <option value="pending"   ${o.status === 'pending'   ? 'selected' : ''}>Pendiente</option>
                <option value="paid"      ${o.status === 'paid'      ? 'selected' : ''}>Pagado</option>
                <option value="shipped"   ${o.status === 'shipped'   ? 'selected' : ''}>Enviado</option>
                <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Entregado</option>
                <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
              </select>
            </td>
            <td data-label="Detalle">
              <div class="order-row-actions">
                <button class="icon-btn" onclick="openOrderModal('${esc(o.id)}')" title="Ver detalle" aria-label="Ver detalle del pedido">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                ${o.status === 'cancelled' ? `
                  <button class="icon-btn danger" type="button" data-delete-cancelled-order="${esc(o.id)}" title="Eliminar pedido cancelado" aria-label="Eliminar pedido cancelado">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

window.updateOrderStatus = async function(orderId, newStatus) {
  const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) {
    showToast('Error actualizando estado: ' + error.message, 'error');
  } else {
    showToast('Estado actualizado.', 'success');
    // Update local cache
    const o = _orders.find(x => x.id === orderId);
    if (o) o.status = newStatus;
    applyOrderFilters();
    // Refresh pending badge
    const pending = _orders.filter(x => x.status === 'pending').length;
    ['pending-badge', 'mobile-pending-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      badge.textContent = pending;
      badge.style.display = pending > 0 ? '' : 'none';
    });
  }
};

window.deleteCancelledOrder = async function(orderId) {
  const order = _orders.find(item => item.id === orderId);
  if (!order || order.status !== 'cancelled') {
    showToast('Solo se pueden eliminar pedidos cancelados.', 'error');
    return;
  }

  const reference = order.wompi_reference ?? order.id?.slice(0, 8) ?? 'sin referencia';
  const confirmed = await confirmDialog(
    'Eliminar pedido cancelado',
    `El pedido ${reference} se eliminará permanentemente. Esta acción no se puede deshacer.`,
    'Eliminar pedido'
  );
  if (!confirmed) return;

  try {
    // Recheck status in the database too; the DELETE RLS policy limits this to admins and cancelled rows.
    const deleteRequest = () => sb.from('orders')
      .delete()
      .eq('id', orderId)
      .eq('status', 'cancelled')
      .select('id');

    let { data, error } = await deleteRequest();

    if (error) {
      console.error('Error eliminando pedido cancelado:', error);
      const permissionDenied = error.code === '42501' || /row-level security|permission denied|policy/i.test(error.message ?? '');
      showToast(
        permissionDenied
          ? 'Supabase bloqueó la eliminación. Aplica la migración de pedidos cancelados.'
          : `No se pudo eliminar el pedido: ${error.message}`,
        'error'
      );
      return;
    }

    let deleted = data?.some(row => row.id === orderId) ?? false;
    if (!deleted) {
      // Role claims live in the access token; refresh once in case the admin role was just granted.
      const { error: refreshError } = await sb.auth.refreshSession();
      if (!refreshError) {
        const retry = await deleteRequest();
        data = retry.data;
        error = retry.error;
        if (error) {
          console.error('Error reintentando la eliminación del pedido:', error);
          showToast('Supabase bloqueó el borrado. Revisa la migración de pedidos cancelados y vuelve a iniciar sesión.', 'error');
          return;
        }
        deleted = data?.some(row => row.id === orderId) ?? false;
      }
    }

    if (!deleted) {
      // If the row disappeared despite a filtered RETURNING response, reflect the database state.
      const { data: currentOrder, error: lookupError } = await sb.from('orders')
        .select('id, status')
        .eq('id', orderId)
        .maybeSingle();

      if (!lookupError && !currentOrder) {
        deleted = true;
      } else if (!lookupError && currentOrder.status !== 'cancelled') {
        const cachedOrder = _orders.find(item => item.id === orderId);
        if (cachedOrder) cachedOrder.status = currentOrder.status;
        applyOrderFilters();
        showToast('El pedido cambió de estado y no se eliminó.', 'error');
        return;
      }
    }

    if (!deleted) {
      showToast('Supabase no autorizó el borrado. Ejecuta la migración 20261015_cancelled_orders_delete.sql y vuelve a iniciar sesión.', 'error');
      await loadOrders();
      return;
    }

    _orders = _orders.filter(item => item.id !== orderId);
    applyOrderFilters();
    showToast('Pedido cancelado eliminado.', 'success');
    loadDashboard();
  } catch (error) {
    console.error('Error de conexión eliminando pedido:', error);
    showToast('No se pudo eliminar el pedido. Revisa la conexión e inténtalo de nuevo.', 'error');
  }
};

document.getElementById('orders-table-wrap')?.addEventListener('click', event => {
  const deleteButton = event.target.closest('[data-delete-cancelled-order]');
  if (deleteButton) window.deleteCancelledOrder(deleteButton.dataset.deleteCancelledOrder);
});

window.openOrderModal = function(orderId) {
  const o = _orders.find(x => x.id === orderId);
  if (!o) return;

  document.getElementById('order-modal-title').textContent =
    `Pedido ${o.wompi_reference ?? o.id?.slice(0, 8)}`;

  const items = Array.isArray(o.items) ? o.items : [];

  const subtotal = items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const shipping = o.shipping ?? 0;
  const locationParts = [o.customer_city, o.customer_dept].filter(Boolean);
  const location = locationParts.length ? locationParts.join(', ') : null;

  document.getElementById('order-modal-body').innerHTML = `
    <!-- Summary row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg)">
      <div>
        <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Estado</p>
        ${statusBadge(o.status)}
      </div>
      <div>
        <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Fecha</p>
        <p style="font-size:14px">${formatDate(o.created_at)}</p>
      </div>
    </div>

    <!-- Customer info -->
    <p style="font-size:13px;font-weight:700;margin-bottom:var(--space-sm)">Datos del cliente</p>
    <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:14px 16px;border:1px solid var(--bg-border);margin-bottom:var(--space-lg);display:grid;gap:8px">
      ${o.customer_name ? `
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Nombre</span>
        <span style="font-size:14px;font-weight:600">${esc(o.customer_name)}</span>
      </div>` : ''}
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Email</span>
        <span style="font-size:14px">${esc(o.customer_email ?? '—')}</span>
      </div>
      ${o.customer_phone ? `
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Teléfono</span>
        <a href="tel:${esc(o.customer_phone)}" style="font-size:14px;color:var(--gold-primary)">${esc(o.customer_phone)}</a>
      </div>` : ''}
      ${o.customer_address ? `
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Dirección</span>
        <span style="font-size:14px">${esc(o.customer_address)}</span>
      </div>` : ''}
      ${location ? `
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Ciudad</span>
        <span style="font-size:14px">${esc(location)}</span>
      </div>` : ''}
      ${o.customer_notes ? `
      <div style="display:flex;gap:10px">
        <span style="font-size:12px;color:var(--text-muted);min-width:70px;padding-top:1px">Notas</span>
        <span style="font-size:14px;font-style:italic;color:var(--text-secondary)">${esc(o.customer_notes)}</span>
      </div>` : ''}
    </div>

    <!-- Products -->
    <p style="font-size:13px;font-weight:700;margin-bottom:var(--space-sm)">Productos</p>
    <div style="background:var(--bg-elevated);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--bg-border);margin-bottom:var(--space-md)">
      ${items.length === 0 ? '<p style="padding:16px;color:var(--text-muted);font-size:13px">Sin detalles de productos.</p>' :
        items.map(item => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--bg-border)">
            <img src="${esc(item.image ?? '')}" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover;background:var(--bg-card)" onerror="this.src='https://placehold.co/40x40/161616/FFD700?text=JD'">
            <div style="flex:1">
              <p style="font-size:14px;font-weight:600">${esc(item.name)}</p>
              ${item.flavor || item.size ? `<p style="font-size:12px;color:var(--text-muted)">${esc([item.flavor, item.size].filter(Boolean).join(' · '))}</p>` : ''}
            </div>
            <span style="font-size:13px;color:var(--text-secondary)">×${item.quantity}</span>
            <span style="font-size:14px;font-weight:700;color:var(--gold-primary)">${formatCOP(item.price * item.quantity)}</span>
          </div>`).join('')}
    </div>

    <!-- Totals -->
    <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px 16px;border:1px solid var(--bg-border);display:grid;gap:8px">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary)">
        <span>Subtotal</span>
        <span>${formatCOP(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary)">
        <span>Envío</span>
        <span>${shipping === 0 ? '<span style="color:#4CAF50">Gratis</span>' : formatCOP(shipping)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;border-top:1px solid var(--bg-border);padding-top:8px;margin-top:2px">
        <span>Total</span>
        <span style="color:var(--gold-primary)">${formatCOP(o.total)}</span>
      </div>
    </div>`;

  document.getElementById('order-modal-overlay').classList.add('open');
};

['order-modal-close','order-modal-close2'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('order-modal-overlay').classList.remove('open');
  });
});

// Order filters
document.getElementById('order-status-filter')?.addEventListener('change', applyOrderFilters);
document.getElementById('order-search')?.addEventListener('input', applyOrderFilters);

function applyOrderFilters() {
  const status = document.getElementById('order-status-filter').value;
  const q = document.getElementById('order-search').value.toLowerCase();
  renderOrdersTable(_orders.filter(o =>
    (!status || o.status === status) &&
    (!q || (o.wompi_reference ?? '').toLowerCase().includes(q) || (o.customer_email ?? '').toLowerCase().includes(q))
  ));
}

// ============================================================
// CLIENTES POTENCIALES / CRM LIGERO
// ============================================================
const PROSPECT_TABLE = 'customer_prospects';
let _prospects = [];
let _prospectsWired = false;

async function loadProspects() {
  const list = document.getElementById('prospect-list');
  if (!list) return;
  const { data, error } = await sb.from(PROSPECT_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    list.innerHTML = `<div class="finance-empty">No se pudieron cargar los prospectos. Si la tabla aún no existe, ejecuta <code>supabase/migrations/20261015_finance_crm.sql</code> en Supabase.<br><small>${esc(error.message)}</small></div>`;
    wireProspects();
    return;
  }
  _prospects = data ?? [];
  renderProspects();
  wireProspects();
}

function renderProspects() {
  const list = document.getElementById('prospect-list');
  if (!list) return;
  const term = document.getElementById('prospect-search')?.value.trim().toLocaleLowerCase('es-CO') ?? '';
  const statusFilter = document.getElementById('prospect-filter-status')?.value ?? '';
  const statusLabels = { new: 'Nuevo', contacted: 'Contactado', interested: 'Interesado', converted: 'Convertido', lost: 'Cerrado' };
  const sourceLabels = { whatsapp: 'WhatsApp', instagram: 'Instagram', tienda: 'Tienda', referido: 'Referido', otro: 'Otro' };
  const filtered = _prospects.filter(p => {
    const searchable = `${p.name ?? ''} ${p.phone ?? ''}`.toLocaleLowerCase('es-CO');
    return (!term || searchable.includes(term)) && (!statusFilter || p.status === statusFilter);
  });
  if (!filtered.length) {
    list.innerHTML = `<div class="finance-empty">${_prospects.length ? 'No hay clientes que coincidan con el filtro.' : 'Aún no has agregado clientes potenciales.'}</div>`;
    return;
  }
  list.innerHTML = filtered.map(p => {
    const digits = String(p.phone ?? '').replace(/\D/g, '');
    const whatsapp = digits ? `<a class="btn btn-outline btn-sm" href="https://wa.me/${digits}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : '';
    return `<article class="finance-record">
      <div class="finance-record-main">
        <div class="finance-record-title">${esc(p.name)}</div>
        <div class="finance-record-meta">${esc(p.phone)} · ${esc(sourceLabels[p.source] ?? p.source ?? 'Otro')}${p.next_contact_date ? ` · Seguimiento: ${esc(formatDate(p.next_contact_date))}` : ''}</div>
        ${p.notes ? `<div class="finance-record-meta">${esc(p.notes)}</div>` : ''}
      </div>
      <div class="finance-record-actions">
        ${whatsapp}
        <select class="form-input prospect-status" aria-label="Estado de ${esc(p.name)}" data-prospect-status="${esc(p.id)}">
          ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${p.status === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </article>`;
  }).join('');
}

function wireProspects() {
  if (_prospectsWired) return;
  _prospectsWired = true;
  const form = document.getElementById('prospect-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = document.getElementById('prospect-submit');
    submit.disabled = true;
    try {
      const { error } = await sb.from(PROSPECT_TABLE).insert({
        name: document.getElementById('prospect-name').value.trim(),
        phone: document.getElementById('prospect-phone').value.trim(),
        source: document.getElementById('prospect-source').value,
        status: document.getElementById('prospect-status').value,
        next_contact_date: document.getElementById('prospect-followup').value || null,
        notes: document.getElementById('prospect-notes').value.trim() || null,
      });
      if (error) { showToast(`No se pudo guardar: ${error.message}`, 'error'); return; }
      form.reset();
      document.getElementById('prospect-status').value = 'new';
      showToast('Cliente potencial guardado.', 'success');
      await loadProspects();
    } catch (error) {
      showToast('No se pudo guardar el cliente. Revisa la conexión e inténtalo de nuevo.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById('prospect-search')?.addEventListener('input', renderProspects);
  document.getElementById('prospect-filter-status')?.addEventListener('change', renderProspects);
  document.getElementById('prospect-list')?.addEventListener('change', async event => {
    const select = event.target.closest('[data-prospect-status]');
    if (!select) return;
    const id = select.dataset.prospectStatus;
    const status = select.value;
    select.disabled = true;
    const { error } = await sb.from(PROSPECT_TABLE).update({ status }).eq('id', id);
    select.disabled = false;
    if (error) { showToast(`No se pudo actualizar: ${error.message}`, 'error'); await loadProspects(); return; }
    _prospects = _prospects.map(p => p.id === id ? { ...p, status } : p);
    showToast('Seguimiento actualizado.', 'success');
  });
}

// CAJA / CONTABILIDAD
// ============================================================
let _cajaEntries = [];
let _cajaTodayEntries = [];
let _cajaLoaded  = false;
let _financeWired = false;

const CAJA_TABLE = 'cash_entries';
const SCHEDULED_TABLE = 'scheduled_expenses';
const CLOSINGS_TABLE = 'cash_closings';
let _scheduledExpenses = [];
let _pendingCashCloseDate = null;

window.cajaSwitchTab = function(tab) {
  const isSale = tab === 'venta';
  const saleTab = document.getElementById('caja-tab-venta');
  const expenseTab = document.getElementById('caja-tab-gasto');
  saleTab.classList.toggle('active', isSale);
  expenseTab.classList.toggle('active', !isSale);
  saleTab.setAttribute('aria-selected', String(isSale));
  expenseTab.setAttribute('aria-selected', String(!isSale));
  saleTab.tabIndex = isSale ? 0 : -1;
  expenseTab.tabIndex = isSale ? -1 : 0;
  document.getElementById('caja-panel-venta').classList.toggle('active', isSale);
  document.getElementById('caja-panel-gasto').classList.toggle('active', !isSale);
  document.getElementById('caja-form-title').textContent = isSale ? 'Registrar venta' : 'Registrar gasto';
  document.getElementById('caja-form-help').textContent = isSale
    ? 'Completa los datos del ingreso. Los campos con * son obligatorios.'
    : 'Completa los datos del egreso. Los campos con * son obligatorios.';
};

async function loadCaja() {
  const today = localDateISO();
  ['caja-venta-date','caja-gasto-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
  if (!document.getElementById('caja-filter-from').value) {
    document.getElementById('caja-filter-from').value = today.substring(0, 8) + '01';
    document.getElementById('caja-filter-to').value   = today;
  }
  await fetchCajaEntries();
  wireCajaForm();
  wireFinanceTools();
  await Promise.all([loadScheduledExpenses(), loadCashClosings(), loadPendingCashCloseReminder()]);
}

function setFinanceView(view) {
  document.querySelectorAll('.finance-view-tab').forEach(button => {
    const active = button.dataset.financeView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('#panel-caja .finance-view').forEach(section => {
    section.classList.toggle('active', section.id === `caja-view-${view}`);
  });
  if (view === 'programados') loadScheduledExpenses();
  if (view === 'cierres') loadCashClosings();
}

function wireFinanceTools() {
  if (_financeWired) return;
  _financeWired = true;

  document.querySelectorAll('.finance-view-tab').forEach(button => {
    button.addEventListener('click', () => setFinanceView(button.dataset.financeView));
  });
  document.querySelector('.finance-view-tabs')?.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('.finance-view-tab')];
    const currentIndex = tabs.indexOf(event.target.closest('.finance-view-tab'));
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setFinanceView(nextTab.dataset.financeView);
    nextTab.focus();
  });

  const scheduledForm = document.getElementById('scheduled-expense-form');
  scheduledForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!scheduledForm.reportValidity()) return;
    const amount = Number(document.getElementById('scheduled-amount').value);
    if (!Number.isSafeInteger(amount) || amount < 1) { showToast('Ingresa un monto válido en pesos.', 'error'); return; }
    const dueDate = document.getElementById('scheduled-next-date').value;
    const dueDay = Number(document.getElementById('scheduled-day').value);
    const dateParts = dueDate.split('-').map(Number);
    const dueDateDay = new Date(dateParts[0], dateParts[1], 0).getDate();
    if (Math.min(dueDay, dueDateDay) !== dateParts[2]) {
      showToast('La próxima fecha debe coincidir con el día mensual programado.', 'error');
      return;
    }

    const submit = document.getElementById('scheduled-expense-submit');
    submit.disabled = true;
    try {
      const { error } = await sb.from(SCHEDULED_TABLE).insert({
        description: document.getElementById('scheduled-desc').value.trim(),
        amount,
        category: document.getElementById('scheduled-category').value,
        payment_method: document.getElementById('scheduled-method').value,
        due_day: dueDay,
        next_due_date: dueDate,
        remind_days_before: Number(document.getElementById('scheduled-remind-days').value),
        notes: document.getElementById('scheduled-notes').value.trim() || null,
        active: true,
      });
      if (error) { showToast(`No se pudo programar: ${error.message}`, 'error'); return; }
      scheduledForm.reset();
      document.getElementById('scheduled-day').value = '1';
      const nextMonth = new Date();
      nextMonth.setDate(1);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      document.getElementById('scheduled-next-date').value = localDateISO(nextMonth);
      showToast('Gasto mensual programado.', 'success');
      await loadScheduledExpenses();
    } catch (error) {
      showToast('No se pudo guardar la programación. Revisa la conexión.', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  const reminderDate = document.getElementById('scheduled-next-date');
  const reminderDay = document.getElementById('scheduled-day');
  reminderDate?.addEventListener('change', () => {
    if (reminderDate.value) reminderDay.value = String(Number(reminderDate.value.slice(-2)));
  });
  reminderDay?.addEventListener('change', () => {
    if (!reminderDate.value) return;
    const [year, month] = reminderDate.value.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(Number(reminderDay.value), lastDay);
    reminderDate.value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });

  document.getElementById('finance-notification-permission')?.addEventListener('click', async () => {
    if (!('Notification' in window)) { showToast('Este navegador no ofrece notificaciones de escritorio.', 'error'); return; }
    const permission = await Notification.requestPermission();
    showToast(permission === 'granted' ? 'Avisos del navegador activados.' : 'El navegador no autorizó los avisos.', permission === 'granted' ? 'success' : 'info');
    if (permission === 'granted') checkScheduledNotifications();
  });

  const closeForm = document.getElementById('cash-close-form');
  const closeDate = document.getElementById('cash-close-date');
  const closeOpening = document.getElementById('cash-opening');
  const closeCounted = document.getElementById('cash-counted');
  closeDate.max = localDateISO();
  if (!closeDate.value) closeDate.value = localDateISO();
  [closeDate, closeOpening, closeCounted].forEach(input => input?.addEventListener('input', refreshCashClosePreview));
  closeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!closeForm.reportValidity()) return;
    const date = closeDate.value;
    const opening = Number(closeOpening.value);
    const counted = Number(closeCounted.value);
    if (![opening, counted].every(value => Number.isSafeInteger(value) && value >= 0)) {
      showToast('Los valores de efectivo deben ser pesos enteros iguales o mayores a cero.', 'error');
      return;
    }
    const submit = document.getElementById('cash-close-submit');
    submit.disabled = true;
    try {
      const { error } = await sb.rpc('close_cash_day', {
        p_close_date: date,
        p_opening_balance: opening,
        p_counted_cash: counted,
        p_notes: document.getElementById('cash-close-notes').value.trim() || null,
      });
      if (error) { showToast(`No se pudo cerrar la caja: ${error.message}`, 'error'); return; }
      showToast('Cierre de caja guardado. Los movimientos de ese día quedaron bloqueados.', 'success');
      closeCounted.value = '';
      document.getElementById('cash-close-notes').value = '';
      await Promise.all([loadCashClosings(), loadPendingCashCloseReminder(), refreshCashClosePreview()]);
    } catch (error) {
      showToast('No se pudo guardar el cierre. Revisa tu conexión.', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  setInterval(() => {
    if (document.getElementById('panel-caja')?.classList.contains('active')) loadScheduledExpenses();
  }, 60 * 60 * 1000);
}

async function loadScheduledExpenses() {
  const list = document.getElementById('scheduled-expense-list');
  if (!list) return;
  const { data, error } = await sb.from(SCHEDULED_TABLE)
    .select('*')
    .order('active', { ascending: false })
    .order('next_due_date', { ascending: true });
  if (error) {
    list.innerHTML = `<div class="finance-empty">No se pudieron cargar los gastos programados. Ejecuta <code>supabase/migrations/20261015_finance_crm.sql</code> en Supabase.<br><small>${esc(error.message)}</small></div>`;
    _scheduledExpenses = [];
    renderFinanceAlerts();
    return;
  }
  _scheduledExpenses = data ?? [];
  renderScheduledExpenses();
  checkScheduledNotifications();
}

function reminderWindow(expense) {
  const today = localDateISO();
  const dueDate = expense.next_due_date;
  const notifyDate = shiftDateISO(dueDate, -Number(expense.remind_days_before ?? 0));
  return dueDate <= today || notifyDate <= today;
}

function renderScheduledExpenses() {
  const list = document.getElementById('scheduled-expense-list');
  if (!list) return;
  renderFinanceAlerts();
  if (!_scheduledExpenses.length) {
    list.innerHTML = '<div class="finance-empty">Aún no hay gastos mensuales programados.</div>';
    return;
  }
  list.innerHTML = _scheduledExpenses.map(item => {
    const late = item.active && item.next_due_date < localDateISO();
    const dueLabel = late ? `Vencido desde ${formatDate(item.next_due_date)}` : `Próximo pago: ${formatDate(item.next_due_date)}`;
    return `<article class="finance-record">
      <div class="finance-record-main">
        <div class="finance-record-title">${esc(item.description)}${item.active ? '' : ' · Pausado'}</div>
        <div class="finance-record-meta">${esc(item.category ?? 'Otro')} · Día ${Number(item.due_day)} de cada mes · ${dueLabel}</div>
        ${item.notes ? `<div class="finance-record-meta">${esc(item.notes)}</div>` : ''}
      </div>
      <div class="finance-record-actions">
        <span class="finance-record-amount">${formatCOP(item.amount)}</span>
        ${item.active ? `<button class="btn btn-primary btn-sm" type="button" onclick="recordScheduledExpense('${esc(item.id)}')">Registrar pago</button>` : ''}
        <button class="btn btn-outline btn-sm" type="button" onclick="toggleScheduledExpense('${esc(item.id)}', ${item.active ? 'false' : 'true'})">${item.active ? 'Pausar' : 'Reanudar'}</button>
      </div>
    </article>`;
  }).join('');
}

async function loadPendingCashCloseReminder() {
  const today = localDateISO();
  const start = shiftDateISO(today, -7);
  const [entriesResult, closingsResult] = await Promise.all([
    sb.from(CAJA_TABLE).select('sale_date').ilike('payment_method', 'efectivo')
      .gte('sale_date', start).lt('sale_date', today),
    sb.from(CLOSINGS_TABLE).select('close_date')
      .gte('close_date', start).lt('close_date', today),
  ]);

  _pendingCashCloseDate = null;
  if (!entriesResult.error && !closingsResult.error) {
    const closedDates = new Set((closingsResult.data ?? []).map(item => item.close_date));
    const pendingDates = [...new Set((entriesResult.data ?? []).map(item => item.sale_date))]
      .filter(date => !closedDates.has(date))
      .sort((a, b) => a.localeCompare(b));
    _pendingCashCloseDate = pendingDates[0] ?? null;
  }
  renderFinanceAlerts();
}

function renderFinanceAlerts() {
  const alerts = document.getElementById('caja-alerts');
  if (!alerts) return;
  const active = _scheduledExpenses.filter(item => item.active);
  const dueSoon = active.filter(reminderWindow).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
  const messages = [];

  if (_pendingCashCloseDate) {
    messages.push(`<div class="finance-alert" role="status"><span><strong>Cierre pendiente:</strong> hay movimientos en efectivo sin cierre desde ${esc(formatDate(_pendingCashCloseDate))}. Confirma el efectivo contado antes de bloquear ese día.</span><button class="btn btn-outline btn-sm" type="button" id="pending-cash-close-btn">Revisar cierre</button></div>`);
  }
  if (dueSoon.length) {
    const overdue = dueSoon.filter(item => item.next_due_date < localDateISO()).length;
    const label = overdue ? `${overdue} gasto${overdue === 1 ? '' : 's'} vencido${overdue === 1 ? '' : 's'}` : `${dueSoon.length} pago${dueSoon.length === 1 ? '' : 's'} próximo${dueSoon.length === 1 ? '' : 's'}`;
    messages.push(`<div class="finance-alert" role="status"><span><strong>Recordatorio financiero:</strong> ${label}. Revisa la sección de gastos programados.</span></div>`);
  }
  alerts.innerHTML = messages.join('');
  document.getElementById('pending-cash-close-btn')?.addEventListener('click', async () => {
    setFinanceView('cierres');
    const closeDate = document.getElementById('cash-close-date');
    if (closeDate && _pendingCashCloseDate) {
      closeDate.value = _pendingCashCloseDate;
      await refreshCashClosePreview();
    }
    document.getElementById('cash-close-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function checkScheduledNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = localDateISO();
  _scheduledExpenses.filter(item => item.active && reminderWindow(item)).forEach(item => {
    const key = `jd-scheduled-notice:${item.id}:${item.next_due_date}`;
    try {
      if (localStorage.getItem(key)) return;
      new Notification(`Pago programado: ${item.description}`, {
        body: `${formatCOP(item.amount)} · Fecha: ${formatDate(item.next_due_date)}`,
        tag: key,
      });
      localStorage.setItem(key, today);
    } catch (error) {
      console.warn('No se pudo mostrar el aviso del gasto programado.', error);
    }
  });
}

window.recordScheduledExpense = async function(id) {
  const item = _scheduledExpenses.find(expense => expense.id === id);
  if (!item) return;
  const ok = await confirmDialog('Registrar pago mensual', `¿Confirmas el pago de “${item.description}” por ${formatCOP(item.amount)}? Se añadirá a gastos y la fecha avanzará al próximo mes.`, 'Registrar pago');
  if (!ok) return;
  const { error } = await sb.rpc('record_scheduled_expense', {
    p_schedule_id: id,
    p_paid_on: localDateISO(),
  });
  if (error) { showToast(`No se pudo registrar el pago: ${error.message}`, 'error'); return; }
  showToast('Pago registrado en contabilidad.', 'success');
  await Promise.all([loadScheduledExpenses(), fetchCajaEntries()]);
};

window.toggleScheduledExpense = async function(id, active) {
  const { error } = await sb.from(SCHEDULED_TABLE).update({ active }).eq('id', id);
  if (error) { showToast(`No se pudo actualizar: ${error.message}`, 'error'); return; }
  showToast(active ? 'Programación reanudada.' : 'Programación pausada.', 'success');
  await loadScheduledExpenses();
};

async function refreshCashClosePreview() {
  const date = document.getElementById('cash-close-date')?.value;
  const preview = document.getElementById('cash-close-preview');
  const submit = document.getElementById('cash-close-submit');
  if (!date || !preview) return;
  preview.innerHTML = '<div class="admin-loading"><div class="spin"></div></div>';
  const [{ data: entries, error }, { data: existing, error: closeError }] = await Promise.all([
    sb.from(CAJA_TABLE).select('type, amount, payment_method').eq('sale_date', date),
    sb.from(CLOSINGS_TABLE).select('id, expected_cash, counted_cash, difference').eq('close_date', date).maybeSingle(),
  ]);
  if (error || closeError) {
    submit.disabled = true;
    preview.innerHTML = `<div class="finance-empty" style="grid-column:1/-1">No fue posible calcular el cierre. Ejecuta la migración SQL y verifica permisos de administrador.<br><small>${esc(error?.message ?? closeError?.message ?? '')}</small></div>`;
    return;
  }
  if (existing) {
    submit.disabled = true;
    preview.innerHTML = `<div class="finance-alert" style="grid-column:1/-1">Esta fecha ya fue cerrada. Diferencia registrada: <strong>${formatCOP(existing.difference)}</strong>.</div>`;
    return;
  }
  submit.disabled = false;
  const cashSales = (entries ?? []).filter(entry => entry.type === 'sale' && String(entry.payment_method).toLowerCase() === 'efectivo').reduce((total, entry) => total + Number(entry.amount), 0);
  const cashExpenses = (entries ?? []).filter(entry => entry.type === 'expense' && String(entry.payment_method).toLowerCase() === 'efectivo').reduce((total, entry) => total + Number(entry.amount), 0);
  const expected = Number(document.getElementById('cash-opening').value || 0) + cashSales - cashExpenses;
  const countedRaw = document.getElementById('cash-counted').value;
  const difference = countedRaw === '' ? null : Number(countedRaw) - expected;
  preview.innerHTML = `
    <div class="finance-close-stat"><span>Ventas en efectivo</span><strong>${formatCOP(cashSales)}</strong></div>
    <div class="finance-close-stat"><span>Gastos en efectivo</span><strong>${formatCOP(cashExpenses)}</strong></div>
    <div class="finance-close-stat"><span>Esperado · Diferencia</span><strong>${formatCOP(expected)}${difference === null ? '' : ` · ${difference >= 0 ? '+' : ''}${formatCOP(difference)}`}</strong></div>`;
}

async function loadCashClosings() {
  const list = document.getElementById('cash-close-history');
  if (!list) return;
  const { data, error } = await sb.from(CLOSINGS_TABLE).select('*').order('close_date', { ascending: false }).limit(60);
  if (error) {
    list.innerHTML = `<div class="finance-empty">No se pudo consultar el historial. Ejecuta <code>supabase/migrations/20261015_finance_crm.sql</code> en Supabase.<br><small>${esc(error.message)}</small></div>`;
    await Promise.all([refreshCashClosePreview(), loadCashAuditHistory()]);
    return;
  }
  if (!data?.length) list.innerHTML = '<div class="finance-empty">Todavía no hay cierres registrados.</div>';
  else list.innerHTML = data.map(close => `<article class="finance-record">
    <div class="finance-record-main"><div class="finance-record-title">Cierre · ${esc(formatDate(close.close_date))}</div>
      <div class="finance-record-meta">Base ${formatCOP(close.opening_balance)} · Ventas en efectivo ${formatCOP(close.sales_cash)} · Gastos en efectivo ${formatCOP(close.expenses_cash)}</div>
      ${close.notes ? `<div class="finance-record-meta">${esc(close.notes)}</div>` : ''}
    </div>
    <div class="finance-record-main"><div class="finance-record-title">Conteo: ${formatCOP(close.counted_cash)}</div>
      <div class="finance-record-meta">Esperado: ${formatCOP(close.expected_cash)} · Diferencia: <strong class="${Number(close.difference) === 0 ? 'amount-positive' : 'amount-negative'}">${Number(close.difference) > 0 ? '+' : ''}${formatCOP(close.difference)}</strong></div>
    </div>
  </article>`).join('');
  await Promise.all([refreshCashClosePreview(), loadCashAuditHistory()]);
}

async function loadCashAuditHistory() {
  const list = document.getElementById('cash-audit-history');
  if (!list) return;
  const { data, error } = await sb.from('daily_finance_audits')
    .select('audit_date, movement_count, sales_total, expenses_total, cash_sales, cash_expenses, close_status, expected_cash, counted_cash, difference, audited_at')
    .order('audit_date', { ascending: false })
    .limit(14);
  if (error) {
    list.innerHTML = `<div class="finance-empty">Ejecuta <code>supabase/migrations/20261015190000_daily_finance_audit.sql</code> después de la migración de finanzas para habilitar el resumen diario.<br><small>${esc(error.message)}</small></div>`;
    return;
  }
  if (!data?.length) {
    list.innerHTML = '<div class="finance-empty">El primer resumen aparecerá después de la siguiente revisión diaria en Supabase.</div>';
    return;
  }

  const statusLabels = {
    closed: ['Cierre verificado', 'badge-paid'],
    pending: ['Falta conteo físico', 'badge-pending'],
    no_cash: ['Sin efectivo registrado', 'badge-inactive'],
  };
  list.innerHTML = data.map(audit => {
    const [statusLabel, statusClass] = statusLabels[audit.close_status] ?? ['Estado desconocido', 'badge-inactive'];
    const net = Number(audit.sales_total) - Number(audit.expenses_total);
    const closeMeta = audit.close_status === 'closed'
      ? `Contado ${formatCOP(audit.counted_cash)} · Diferencia ${Number(audit.difference) > 0 ? '+' : ''}${formatCOP(audit.difference)}`
      : audit.close_status === 'pending'
        ? `Ventas en efectivo ${formatCOP(audit.cash_sales)} · Gastos en efectivo ${formatCOP(audit.cash_expenses)} · Requiere conteo físico`
        : 'No había movimientos en efectivo para cerrar';
    return `<article class="finance-record">
      <div class="finance-record-main">
        <div class="finance-record-title">${esc(formatDate(audit.audit_date))} · <span class="status-badge ${statusClass}">${statusLabel}</span></div>
        <div class="finance-record-meta">${Number(audit.movement_count)} movimientos · Ventas ${formatCOP(audit.sales_total)} · Gastos ${formatCOP(audit.expenses_total)}</div>
      </div>
      <div class="finance-record-main">
        <div class="finance-record-title">Neto del día: ${formatCOP(net)}</div>
        <div class="finance-record-meta">${closeMeta}</div>
      </div>
    </article>`;
  }).join('');
}

async function fetchCajaEntries() {
  const from = document.getElementById('caja-filter-from').value;
  const to   = document.getElementById('caja-filter-to').value;
  const type = document.getElementById('caja-filter-type').value;

  let query = sb.from(CAJA_TABLE)
    .select('*')
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (from) query = query.gte('sale_date', from);
  if (to)   query = query.lte('sale_date', to);
  if (type) query = query.eq('type', type);

  const [periodResult, todayResult] = await Promise.all([
    query,
    sb.from(CAJA_TABLE).select('type, amount, sale_date').eq('sale_date', localDateISO()),
  ]);
  const { data, error } = periodResult;

  if (error) {
    const missingTable = ['42P01', 'PGRST205'].includes(error.code);
    const msg = missingTable
      ? `<div class="admin-empty"><p style="max-width:520px;line-height:1.8">La estructura de finanzas aún no está instalada. Ejecuta el archivo <code>supabase/migrations/20261015_finance_crm.sql</code> completo en el <strong>SQL Editor</strong> de Supabase para crear las tablas y sus permisos seguros.</p></div>`
      : `<div class="admin-empty"><p>Error cargando movimientos: ${esc(error.message)}</p></div>`;

    document.getElementById('caja-table-wrap').innerHTML = msg;
    document.getElementById('caja-metrics').innerHTML =
      '<p style="padding:var(--space-md);color:var(--text-muted);font-size:13px">Crea la tabla en Supabase para ver métricas.</p>';
    return;
  }

  _cajaEntries = data ?? [];
  _cajaTodayEntries = todayResult.error
    ? _cajaEntries.filter(entry => entry.sale_date === localDateISO())
    : todayResult.data ?? [];
  renderCajaMetrics();
  renderCajaTable();
}

function renderCajaMetrics() {
  const today = localDateISO();
  const todaySales    = _cajaTodayEntries.filter(e => e.type === 'sale'    && e.sale_date === today);
  const todayExpenses = _cajaTodayEntries.filter(e => e.type === 'expense' && e.sale_date === today);
  const allSales      = _cajaEntries.filter(e => e.type === 'sale');
  const allExpenses   = _cajaEntries.filter(e => e.type === 'expense');
  const sum = arr => arr.reduce((s, e) => s + Number(e.amount), 0);
  const todayNet  = sum(todaySales) - sum(todayExpenses);
  const periodNet = sum(allSales)   - sum(allExpenses);

  document.getElementById('caja-metrics').innerHTML = `
    <div class="caja-metric">
      <div class="caja-metric-label">Ventas hoy</div>
      <div class="caja-metric-value green">${formatCOP(sum(todaySales))}</div>
      <div class="caja-metric-sub">${todaySales.length} movimiento${todaySales.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="caja-metric">
      <div class="caja-metric-label">Gastos hoy</div>
      <div class="caja-metric-value red">${formatCOP(sum(todayExpenses))}</div>
      <div class="caja-metric-sub">${todayExpenses.length} movimiento${todayExpenses.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="caja-metric">
      <div class="caja-metric-label">Saldo hoy</div>
      <div class="caja-metric-value ${todayNet >= 0 ? 'green' : 'red'}">${formatCOP(todayNet)}</div>
      <div class="caja-metric-sub">Neto del día</div>
    </div>
    <div class="caja-metric">
      <div class="caja-metric-label">Neto del período</div>
      <div class="caja-metric-value ${periodNet >= 0 ? 'gold' : 'red'}">${formatCOP(periodNet)}</div>
      <div class="caja-metric-sub">Ventas − gastos filtrados</div>
    </div>`;
}

function renderCajaTable() {
  const wrap = document.getElementById('caja-table-wrap');
  if (_cajaEntries.length === 0) {
    wrap.innerHTML = `<div class="admin-empty"><p>Sin movimientos en el período seleccionado.</p></div>`;
    return;
  }
  const typeLabel  = { sale: 'Venta', expense: 'Gasto' };
  const typeBadge  = { sale: 'badge-sale', expense: 'badge-expense' };
  const methodMap  = { efectivo:'Efectivo', transferencia:'Transferencia', nequi:'Nequi', daviplata:'Daviplata', tarjeta:'Tarjeta' };

  wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Fecha</th><th>Tipo</th><th>Descripción</th>
          <th>Categoría / Cliente</th><th>Método</th><th>Monto</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${_cajaEntries.map(e => `
          <tr>
            <td data-label="Fecha" style="white-space:nowrap;color:var(--text-muted);font-size:13px">${formatDate(e.sale_date)}</td>
            <td data-label="Tipo"><span class="status-badge ${typeBadge[e.type] ?? ''}">${typeLabel[e.type] ?? esc(e.type)}</span></td>
            <td data-label="Descripción">
              <span style="font-weight:600;color:var(--text-primary)">${esc(e.description)}</span>
              ${e.notes ? `<br><span style="font-size:12px;color:var(--text-muted)">${esc(e.notes)}</span>` : ''}
            </td>
            <td data-label="Categoría / cliente" style="font-size:13px;color:var(--text-muted)">${esc(e.client || e.category || '—')}</td>
            <td data-label="Método" style="font-size:13px">${methodMap[e.payment_method] ?? esc(e.payment_method ?? '—')}</td>
            <td data-label="Monto" class="${e.type === 'sale' ? 'amount-positive' : 'amount-negative'}">
              ${e.type === 'sale' ? '+' : '−'}${formatCOP(e.amount)}
            </td>
            <td data-label="Acciones">
              <button class="icon-btn danger" title="Eliminar" onclick="deleteCajaEntry('${esc(e.id)}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function wireCajaForm() {
  if (_cajaLoaded) return;
  _cajaLoaded = true;

  const ventaForm = document.getElementById('caja-panel-venta');
  const gastoForm = document.getElementById('caja-panel-gasto');
  const bindSubmitState = (button, pendingText, readyText, callback) => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('span').textContent = pendingText;
    return callback().finally(() => {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.querySelector('span').textContent = readyText;
    });
  };

  ventaForm.addEventListener('submit', async event => {
    event.preventDefault();
    const descInput = document.getElementById('caja-venta-desc');
    const desc   = descInput.value.trim();
    descInput.value = desc;
    const amount = Number(document.getElementById('caja-venta-amount').value);
    const date   = document.getElementById('caja-venta-date').value;
    if (!ventaForm.reportValidity()) return;
    if (amount < 1) { showToast('El monto debe ser mayor que cero.', 'error'); return; }
    const btn = document.getElementById('caja-venta-submit');
    await bindSubmitState(btn, 'Guardando venta…', 'Registrar venta', async () => {
      try {
        const { error } = await sb.from(CAJA_TABLE).insert({
          type: 'sale', description: desc, amount: Math.round(amount),
          payment_method: document.getElementById('caja-venta-method').value,
          sale_date: date,
          client: document.getElementById('caja-venta-client').value.trim() || null,
          notes:  document.getElementById('caja-venta-notes').value.trim()  || null,
        });
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        ['caja-venta-desc','caja-venta-amount','caja-venta-client','caja-venta-notes'].forEach(id => { document.getElementById(id).value = ''; });
        showToast('Venta registrada.', 'success');
        await fetchCajaEntries();
        await loadPendingCashCloseReminder();
        document.getElementById('caja-venta-desc').focus();
      } catch (error) {
        showToast('No se pudo registrar la venta. Revisa tu conexión e inténtalo de nuevo.', 'error');
      }
    });
  });

  gastoForm.addEventListener('submit', async event => {
    event.preventDefault();
    const descInput = document.getElementById('caja-gasto-desc');
    const desc   = descInput.value.trim();
    descInput.value = desc;
    const amount = Number(document.getElementById('caja-gasto-amount').value);
    const date   = document.getElementById('caja-gasto-date').value;
    if (!gastoForm.reportValidity()) return;
    if (amount < 1) { showToast('El monto debe ser mayor que cero.', 'error'); return; }
    const btn = document.getElementById('caja-gasto-submit');
    await bindSubmitState(btn, 'Guardando gasto…', 'Registrar gasto', async () => {
      try {
        const { error } = await sb.from(CAJA_TABLE).insert({
          type: 'expense', description: desc, amount: Math.round(amount),
          payment_method: document.getElementById('caja-gasto-method').value,
          category: document.getElementById('caja-gasto-category').value,
          sale_date: date,
          notes: document.getElementById('caja-gasto-notes').value.trim() || null,
        });
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        ['caja-gasto-desc','caja-gasto-amount','caja-gasto-notes'].forEach(id => { document.getElementById(id).value = ''; });
        showToast('Gasto registrado.', 'success');
        await fetchCajaEntries();
        await loadPendingCashCloseReminder();
        document.getElementById('caja-gasto-desc').focus();
      } catch (error) {
        showToast('No se pudo registrar el gasto. Revisa tu conexión e inténtalo de nuevo.', 'error');
      }
    });
  });

  document.querySelector('.caja-form-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === 'Home'
      ? 'venta'
      : event.key === 'End'
        ? 'gasto'
        : event.target.id === 'caja-tab-venta' ? 'gasto' : 'venta';
    window.cajaSwitchTab(nextTab);
    document.getElementById(`caja-tab-${nextTab}`).focus();
  });

  document.getElementById('caja-filter-btn').addEventListener('click', fetchCajaEntries);
  document.getElementById('caja-export-btn').addEventListener('click', exportCajaCSV);
}

window.deleteCajaEntry = async function(id) {
  const ok = await confirmDialog('Eliminar movimiento', '¿Eliminar este registro? No se puede deshacer.', 'Eliminar');
  if (!ok) return;
  const { error } = await sb.from(CAJA_TABLE).delete().eq('id', id);
  if (error) { showToast('Error eliminando: ' + error.message, 'error'); return; }
  showToast('Eliminado.', 'success');
  await fetchCajaEntries();
  await loadPendingCashCloseReminder();
};

function exportCajaCSV() {
  if (_cajaEntries.length === 0) { showToast('No hay datos para exportar.', 'error'); return; }
  const header = ['Fecha','Tipo','Descripción','Categoría','Cliente','Método','Monto','Notas'];
  const rows = _cajaEntries.map(e => [
    e.sale_date,
    e.type === 'sale' ? 'Venta' : 'Gasto',
    `"${(e.description ?? '').replace(/"/g,'""')}"`,
    e.category ?? '',
    e.client ?? '',
    e.payment_method ?? '',
    e.amount,
    `"${(e.notes ?? '').replace(/"/g,'""')}"`,
  ]);
  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url,
    download: `caja_${new Date().toISOString().split('T')[0]}.csv`
  }).click();
  URL.revokeObjectURL(url);
}

// ============================================================
// ADMIN NAV WIRING (desktop sidebar + mobile floating dock)
// ============================================================
document.querySelectorAll('[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => adminNav(btn.dataset.panel));
});

const mobileMoreButton = document.getElementById('mobile-more-btn');
const mobileMoreMenu = document.getElementById('admin-mobile-more');
mobileMoreButton?.addEventListener('click', () => {
  const isOpen = mobileMoreMenu?.classList.toggle('open') ?? false;
  mobileMoreButton.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', event => {
  if (!mobileMoreMenu?.classList.contains('open')) return;
  if (mobileMoreMenu.contains(event.target) || mobileMoreButton?.contains(event.target)) return;
  mobileMoreMenu.classList.remove('open');
  mobileMoreButton?.setAttribute('aria-expanded', 'false');
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !mobileMoreMenu?.classList.contains('open')) return;
  mobileMoreMenu.classList.remove('open');
  mobileMoreButton?.setAttribute('aria-expanded', 'false');
  mobileMoreButton?.focus();
});

// Mobile sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.style.display = 'flex';
  sidebarToggle.addEventListener('click', () => {
    document.getElementById('admin-sidebar').classList.toggle('open');
  });
}
// Close sidebar when tapping outside (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;
  if (!sidebar.classList.contains('open')) return;
  if (sidebar.contains(e.target)) return;
  if (sidebarToggle && sidebarToggle.contains(e.target)) return;
  sidebar.classList.remove('open');
});

// Close confirm on overlay click
document.getElementById('confirm-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-overlay')) {
    document.getElementById('confirm-overlay').classList.remove('open');
  }
});

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', initAuth);
