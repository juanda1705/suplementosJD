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
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
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
};

window.adminNav = function(panel) {
  document.querySelectorAll('.admin-nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.panel === panel);
  });
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
};

// ============================================================
// AUTH
// ============================================================
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showShell(session.user);
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

    showShell(data.user);
  });

  // Allow Enter key on password field
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    document.getElementById('admin-shell').classList.remove('visible');
    document.getElementById('admin-login').style.display = 'flex';
  });
}

function showShell(user) {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-shell').classList.add('visible');
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

  // Update pending badge in sidebar
  const badge = document.getElementById('pending-badge');
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

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
            <td><img class="product-thumb" src="${esc(p.images?.[0] ?? '')}" alt="" onerror="this.src='https://placehold.co/44x44/161616/FFD700?text=JD'"></td>
            <td class="product-name-cell">${esc(p.name)}</td>
            <td>${esc(p.brand ?? '—')}</td>
            <td>${esc(p.categories?.name ?? '—')}</td>
            <td style="color:var(--gold-primary);font-weight:700">${formatCOP(p.base_price)}</td>
            <td>${p.is_active
              ? '<span class="status-badge badge-active">Activo</span>'
              : '<span class="status-badge badge-inactive">Inactivo</span>'}</td>
            <td style="text-align:center">${p.is_featured ? '⭐' : '—'}</td>
            <td>
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
            <td style="font-family:monospace;font-size:12px">${esc(o.wompi_reference ?? o.id?.slice(0, 8))}</td>
            <td>${esc(o.customer_email ?? '—')}</td>
            <td style="white-space:nowrap">${formatDate(o.created_at)}</td>
            <td style="color:var(--gold-primary);font-weight:700">${formatCOP(o.total)}</td>
            <td>${statusBadge(o.status)}</td>
            <td>
              <select class="order-status-select" onchange="updateOrderStatus('${esc(o.id)}', this.value)">
                <option value="pending"   ${o.status === 'pending'   ? 'selected' : ''}>Pendiente</option>
                <option value="paid"      ${o.status === 'paid'      ? 'selected' : ''}>Pagado</option>
                <option value="shipped"   ${o.status === 'shipped'   ? 'selected' : ''}>Enviado</option>
                <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Entregado</option>
                <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
              </select>
            </td>
            <td>
              <button class="icon-btn" onclick="openOrderModal('${esc(o.id)}')" title="Ver detalle">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
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
    // Refresh pending badge
    const pending = _orders.filter(x => x.status === 'pending').length;
    const badge = document.getElementById('pending-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }
};

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
// CAJA / CONTABILIDAD
// ============================================================
let _cajaEntries = [];
let _cajaLoaded  = false;

const CAJA_TABLE = 'cash_entries';

window.cajaSwitchTab = function(tab) {
  document.getElementById('caja-tab-venta').classList.toggle('active', tab === 'venta');
  document.getElementById('caja-tab-gasto').classList.toggle('active', tab === 'gasto');
  document.getElementById('caja-panel-venta').classList.toggle('active', tab === 'venta');
  document.getElementById('caja-panel-gasto').classList.toggle('active', tab === 'gasto');
};

async function loadCaja() {
  const today = new Date().toISOString().split('T')[0];
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

  const { data, error } = await query;

  if (error) {
    const msg = error.code === '42P01'
      ? `<div class="admin-empty"><p style="max-width:460px;line-height:1.8">
          La tabla <code>cash_entries</code> aún no existe.<br>
          Ejecuta este SQL en el <strong>SQL Editor</strong> de Supabase:
          <code style="display:block;background:var(--bg-elevated);padding:12px;border-radius:8px;font-size:11px;text-align:left;white-space:pre;margin-top:10px">
CREATE TABLE cash_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL CHECK (type IN ('sale','expense')),
  description    text NOT NULL,
  amount         numeric(12,0) NOT NULL,
  payment_method text,
  category       text,
  sale_date      date NOT NULL,
  client         text,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id)
);
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON cash_entries
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');</code></p></div>`
      : `<div class="admin-empty"><p>Error: ${esc(error.message)}</p></div>`;

    document.getElementById('caja-table-wrap').innerHTML = msg;
    document.getElementById('caja-metrics').innerHTML =
      '<p style="padding:var(--space-md);color:var(--text-muted);font-size:13px">Crea la tabla en Supabase para ver métricas.</p>';
    return;
  }

  _cajaEntries = data ?? [];
  renderCajaMetrics();
  renderCajaTable();
}

function renderCajaMetrics() {
  const today = new Date().toISOString().split('T')[0];
  const todaySales    = _cajaEntries.filter(e => e.type === 'sale'    && e.sale_date === today);
  const todayExpenses = _cajaEntries.filter(e => e.type === 'expense' && e.sale_date === today);
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
            <td style="white-space:nowrap;color:var(--text-muted);font-size:13px">${formatDate(e.sale_date)}</td>
            <td><span class="status-badge ${typeBadge[e.type] ?? ''}">${typeLabel[e.type] ?? esc(e.type)}</span></td>
            <td>
              <span style="font-weight:600;color:var(--text-primary)">${esc(e.description)}</span>
              ${e.notes ? `<br><span style="font-size:12px;color:var(--text-muted)">${esc(e.notes)}</span>` : ''}
            </td>
            <td style="font-size:13px;color:var(--text-muted)">${esc(e.client || e.category || '—')}</td>
            <td style="font-size:13px">${methodMap[e.payment_method] ?? esc(e.payment_method ?? '—')}</td>
            <td class="${e.type === 'sale' ? 'amount-positive' : 'amount-negative'}">
              ${e.type === 'sale' ? '+' : '−'}${formatCOP(e.amount)}
            </td>
            <td>
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

  document.getElementById('caja-venta-submit').addEventListener('click', async () => {
    const desc   = document.getElementById('caja-venta-desc').value.trim();
    const amount = Number(document.getElementById('caja-venta-amount').value);
    const date   = document.getElementById('caja-venta-date').value;
    if (!desc || !amount || !date) { showToast('Completa descripción, monto y fecha.', 'error'); return; }
    const btn = document.getElementById('caja-venta-submit');
    btn.disabled = true;
    const { error } = await sb.from(CAJA_TABLE).insert({
      type: 'sale', description: desc, amount: Math.round(amount),
      payment_method: document.getElementById('caja-venta-method').value,
      sale_date: date,
      client: document.getElementById('caja-venta-client').value.trim() || null,
      notes:  document.getElementById('caja-venta-notes').value.trim()  || null,
    });
    btn.disabled = false;
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    ['caja-venta-desc','caja-venta-amount','caja-venta-client','caja-venta-notes'].forEach(id => { document.getElementById(id).value = ''; });
    showToast('Venta registrada.', 'success');
    await fetchCajaEntries();
  });

  document.getElementById('caja-gasto-submit').addEventListener('click', async () => {
    const desc   = document.getElementById('caja-gasto-desc').value.trim();
    const amount = Number(document.getElementById('caja-gasto-amount').value);
    const date   = document.getElementById('caja-gasto-date').value;
    if (!desc || !amount || !date) { showToast('Completa descripción, monto y fecha.', 'error'); return; }
    const btn = document.getElementById('caja-gasto-submit');
    btn.disabled = true;
    const { error } = await sb.from(CAJA_TABLE).insert({
      type: 'expense', description: desc, amount: Math.round(amount),
      payment_method: document.getElementById('caja-gasto-method').value,
      category: document.getElementById('caja-gasto-category').value,
      sale_date: date,
      notes: document.getElementById('caja-gasto-notes').value.trim() || null,
    });
    btn.disabled = false;
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    ['caja-gasto-desc','caja-gasto-amount','caja-gasto-notes'].forEach(id => { document.getElementById(id).value = ''; });
    showToast('Gasto registrado.', 'success');
    await fetchCajaEntries();
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
// SIDEBAR NAV WIRING
// ============================================================
document.querySelectorAll('.admin-nav-link[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => adminNav(btn.dataset.panel));
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
