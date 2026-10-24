// vn
'use strict';
const Sesion = (() => {
  const sb = window.sb;
  let perfil = null, comunas = [], montado = false;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmt = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const $ = s => document.querySelector(s);

  const precioDe = slug => {
    const t = (typeof PRICE_TIERS !== 'undefined' && PRICE_TIERS[slug]) || [];
    return t.length ? t[0].price : 0;
  };
  const productos = () => (typeof CATALOGO !== 'undefined' ? CATALOGO : []);

  async function init(){
    if (!sb) return;
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return;
    const { data } = await sb.from('profiles')
      .select('id,nombre,email,rol,activo').eq('id', session.user.id).maybeSingle();
    perfil = data && data.activo ? data : null;
    if (!perfil) return;
    pintarNav();
    if (perfil.rol === 'admin' || perfil.rol === 'vendedor') montarBotonFicha();
  }

  // pm.js la llama cada vez que se abre una ficha de producto.
  function ficha(slug){
    const b = $('#ppageVendido');
    if (!b) return;
    b.hidden = !perfil;
    b.dataset.slug = slug;
  }

  function pintarNav(){
    const login = $('.nav-login');
    if (!login) return;
    const nombre = perfil.nombre || perfil.email.split('@')[0];
    const cuenta = document.createElement('div');
    cuenta.className = 'nav-cuenta';
    cuenta.innerHTML = `
      <button class="nav-cuenta-btn" id="navCuentaBtn" aria-haspopup="true" aria-expanded="false">
        <span class="nav-cuenta-ini">${esc(nombre.trim().charAt(0).toUpperCase())}</span>
        <span class="nav-cuenta-txt">
          <b>${esc(nombre)}</b>
          <small>${perfil.rol === 'admin' ? 'Administrador' : 'Vendedor'}</small>
        </span>
      </button>
      <div class="nav-cuenta-menu" id="navCuentaMenu" hidden>
        ${perfil.rol === 'admin' ? '<a href="/admin">Panel de administración</a>' : ''}
        <button type="button" data-acc="ventas">Mis ventas</button>
        <button type="button" data-acc="salir">Cerrar sesión</button>
      </div>`;
    login.replaceWith(cuenta);

    const btn = cuenta.querySelector('#navCuentaBtn');
    const menu = cuenta.querySelector('#navCuentaMenu');
    btn.addEventListener('click', () => {
      const abierto = !menu.hidden;
      menu.hidden = abierto;
      btn.setAttribute('aria-expanded', String(!abierto));
    });
    document.addEventListener('click', e => {
      if (!cuenta.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded','false'); }
    });
    menu.addEventListener('click', async e => {
      const acc = e.target.closest('[data-acc]')?.dataset.acc;
      if (acc === 'salir') { await sb.auth.signOut(); location.reload(); }
      if (acc === 'ventas') { menu.hidden = true; abrirMisVentas(); }
    });
  }

  function montarBotonFicha(){
    if (montado) return;
    montado = true;
    const b = $('#ppageVendido');
    if (b) b.addEventListener('click', () => abrirFormulario(b.dataset.slug));
  }

  async function cargarComunas(){
    if (comunas.length) return comunas;
    const { data } = await sb.from('comunas')
      .select('nombre,costo,activa').eq('activa', true).order('position');
    comunas = data || [];
    return comunas;
  }

  /* ── Formulario de venta ──────────────────────────────── */
  async function abrirFormulario(slug){
    await cargarComunas();
    const prod = productos().find(p => p.slug === slug);
    if (!prod) return;
    const ov = document.createElement('div');
    ov.className = 'venta-ov';
    ov.innerHTML = `
      <form class="venta-card" id="ventaForm">
        <header class="venta-head">
          <div>
            <p class="venta-kicker">Registro de venta</p>
            <h2>Producto vendido</h2>
          </div>
          <button type="button" class="venta-x" data-acc="cerrar" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="venta-body">
          <div class="venta-prod">
            <img src="${esc(prod.image)}" alt="">
            <div>
              <b>${esc(prod.name)}</b>
              <small>${fmt(precioDe(slug))} por unidad</small>
            </div>
          </div>

          <div class="venta-g2">
            <label class="venta-f"><span>Cantidad</span>
              <input type="number" name="cantidad" min="1" step="1" value="1" required>
            </label>
            <label class="venta-f"><span>Precio por unidad</span>
              <input type="number" name="precio" min="0" step="1" value="${precioDe(slug)}" required>
            </label>
          </div>

          <p class="venta-sec">Despacho</p>
          <div class="venta-g2">
            <label class="venta-f"><span>Comuna · Región de Valparaíso</span>
              <select name="comuna" required>
                <option value="">Elegí la comuna</option>
                ${comunas.map(c => `<option value="${esc(c.nombre)}" data-costo="${c.costo}">${esc(c.nombre)}</option>`).join('')}
              </select>
            </label>
            <label class="venta-f"><span>Costo de despacho</span>
              <input type="number" name="despacho" min="0" step="1" value="0" required>
            </label>
          </div>

          <p class="venta-sec">Datos del cliente</p>
          <div class="venta-g2">
            <label class="venta-f"><span>Nombre y apellido</span>
              <input type="text" name="cliente" required placeholder="Ej: María Pérez">
            </label>
            <label class="venta-f"><span>Teléfono</span>
              <input type="tel" name="telefono" required placeholder="+56 9 ...">
            </label>
            <label class="venta-f"><span>Correo (opcional)</span>
              <input type="email" name="email" placeholder="cliente@correo.cl">
            </label>
            <label class="venta-f"><span>Método de pago</span>
              <select name="pago">
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Débito o crédito">Débito o crédito</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label class="venta-f venta-ancho"><span>Dirección de entrega</span>
              <input type="text" name="direccion" required placeholder="Calle, número, depto">
            </label>
            <label class="venta-f venta-ancho"><span>Observaciones (opcional)</span>
              <textarea name="notas" rows="2" placeholder="Horario de entrega, referencias…"></textarea>
            </label>
          </div>
        </div>

        <footer class="venta-pie">
          <div class="venta-total">
            <span>Total de la venta</span>
            <b id="ventaTotal">$0</b>
          </div>
          <div class="venta-acc">
            <button type="button" class="venta-btn ghost" data-acc="cerrar">Cancelar</button>
            <button type="submit" class="venta-btn">Registrar venta</button>
          </div>
          <p class="venta-msg" id="ventaMsg"></p>
        </footer>
      </form>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';

    const f = ov.querySelector('#ventaForm');
    const cerrar = () => { ov.remove(); document.documentElement.style.overflow = ''; };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-acc=cerrar]')) cerrar();
    });
    document.addEventListener('keydown', function esc2(e){
      if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc2); }
    });

    const total = () => {
      const n = +f.cantidad.value || 0, p = +f.precio.value || 0, d = +f.despacho.value || 0;
      ov.querySelector('#ventaTotal').textContent = fmt(n * p + d);
    };
    total();
    f.comuna.addEventListener('change', e => {
      f.despacho.value = e.target.selectedOptions[0]?.dataset.costo || 0;
      total();
    });
    ['cantidad','precio','despacho'].forEach(n => f[n].addEventListener('input', total));

    f.addEventListener('submit', e => { e.preventDefault(); guardar(f, prod, cerrar); });
  }

  async function guardar(f, prod, cerrar){
    const btn = f.querySelector('button[type=submit]');
    const msg = f.querySelector('#ventaMsg');
    const cantidad = +f.cantidad.value || 1;
    const precio = +f.precio.value || 0;
    const despacho = +f.despacho.value || 0;

    btn.disabled = true; btn.textContent = 'Guardando…'; msg.textContent = ''; msg.className = 'venta-msg';

    const { error } = await sb.from('ventas').insert({
      vendedor_id: perfil.id,
      vendedor_nombre: perfil.nombre || perfil.email,
      producto_slug: prod.slug,
      producto_nombre: prod.name,
      cantidad, precio_unitario: precio,
      comuna: f.comuna.value,
      costo_despacho: despacho,
      total: cantidad * precio + despacho,
      cliente_nombre: f.cliente.value.trim(),
      cliente_telefono: f.telefono.value.trim(),
      cliente_email: f.email.value.trim(),
      cliente_direccion: f.direccion.value.trim(),
      metodo_pago: f.pago.value,
      notas: f.notas.value.trim(),
    });

    if (error) {
      btn.disabled = false; btn.textContent = 'Registrar venta';
      msg.className = 'venta-msg err';
      msg.textContent = 'No se pudo registrar: ' + error.message;
      return;
    }
    btn.textContent = 'Venta registrada';
    setTimeout(cerrar, 700);
  }

  /* ── Mis ventas ───────────────────────────────────────── */
  async function abrirMisVentas(){
    const ov = document.createElement('div');
    ov.className = 'venta-ov';
    ov.innerHTML = `
      <div class="venta-card">
        <header class="venta-head">
          <div>
            <p class="venta-kicker">Historial</p>
            <h2>Mis ventas</h2>
          </div>
          <button type="button" class="venta-x" data-acc="cerrar" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="venta-body" id="misVentas"><p class="venta-vacio">Cargando…</p></div>
      </div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    const cerrar = () => { ov.remove(); document.documentElement.style.overflow = ''; };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-acc=cerrar]')) cerrar();
    });

    const { data, error } = await sb.from('ventas')
      .select('*').eq('vendedor_id', perfil.id).order('created_at', { ascending: false }).limit(100);
    const box = ov.querySelector('#misVentas');
    if (error) { box.innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(error.message) + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="venta-vacio">Todavía no registraste ninguna venta.</p>'; return; }

    const suma = data.reduce((a, v) => a + (v.total || 0), 0);
    box.innerHTML = `
      <p class="venta-resumen">${data.length} venta${data.length === 1 ? '' : 's'} · ${fmt(suma)} en total</p>
      <ul class="venta-lista">
        ${data.map(v => `
          <li>
            <div>
              <b>${esc(v.producto_nombre)}</b>
              <small>${esc(v.cliente_nombre)} · ${esc(v.comuna)} · ${new Date(v.created_at).toLocaleDateString('es-CL')}</small>
            </div>
            <span>${fmt(v.total)}</span>
          </li>`).join('')}
      </ul>`;
  }

  return { init, ficha };
})();

document.addEventListener('DOMContentLoaded', () => Sesion.init().catch(e => console.error('Sesion:', e)));
