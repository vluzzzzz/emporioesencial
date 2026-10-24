'use strict';
// au — usuarios, ventas y comunas de despacho
const Admin = (() => {
  let yo = null, usuarios = [], ventas = [], comunas = [];

  const $$ = s => [...document.querySelectorAll(s)];
  const fecha = d => new Date(d).toLocaleString('es-CL', { dateStyle:'short', timeStyle:'short' });

  async function init(){
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return;
    const { data } = await sb.from('profiles')
      .select('id,nombre,email,rol').eq('id', session.user.id).maybeSingle();
    if (!data) {
      await sb.auth.signOut();
      $('#app').classList.add('hidden');
      $('#login').classList.remove('hidden');
      $('#loginErr').textContent = 'Esta cuenta no tiene perfil. Corré supabase/setup-usuarios-ventas.sql y volvé a entrar.';
      return;
    }
    yo = data;

    const quien = $('#admQuien');
    if (quien) quien.textContent = (yo.nombre || yo.email) + ' · ' + (yo.rol === 'admin' ? 'Administrador' : 'Vendedor');

    if (yo.rol !== 'admin') {
      $('#app').classList.add('hidden');
      $('#login').classList.remove('hidden');
      $('#loginErr').textContent = 'Hola ' + (yo.nombre || yo.email) + '. Te llevamos a la tienda…';
      setTimeout(() => location.replace('/'), 900);
      return;
    }
    $$('.adm-solo').forEach(t => t.classList.remove('hidden'));

    $('#nvCrear').addEventListener('click', crearVendedor);
    $('#recargarVentas').addEventListener('click', cargarVentas);
    $('#filtroVendedor').addEventListener('change', pintarVentas);
    $('#guardarComunas').addEventListener('click', guardarComunas);

    await Promise.all([cargarUsuarios(), cargarVentas(), cargarComunas()]);
  }

  /* ── Usuarios ─────────────────────────────────────────── */
  async function cargarUsuarios(){
    const box = $('#listUsuarios');
    const { data, error } = await sb.from('profiles')
      .select('*').order('created_at', { ascending:false });
    if (error) { box.innerHTML = '<div class="empty">Error: ' + escH(error.message) + '</div>'; return; }
    usuarios = data || [];
    pintarUsuarios();
    pintarFiltroVendedor();
  }

  function pintarUsuarios(){
    const box = $('#listUsuarios');
    if (!usuarios.length) { box.innerHTML = '<div class="empty">Todavía no hay usuarios.</div>'; return; }
    box.innerHTML = usuarios.map(u => `
      <div class="card" data-u="${escH(u.id)}">
        <div class="prod-head">
          <h3>${escH(u.nombre || u.email)}</h3>
          <span class="slug-badge">${escH(u.rol)}${u.activo ? '' : ' · inactivo'}</span>
        </div>
        <div class="row2">
          <label class="fld"><span>Nombre</span>
            <input type="text" data-uf="nombre" value="${escH(u.nombre)}">
          </label>
          <label class="fld"><span>Correo</span>
            <input type="text" value="${escH(u.email)}" disabled>
          </label>
          <label class="fld"><span>Teléfono</span>
            <input type="tel" data-uf="telefono" value="${escH(u.telefono)}">
          </label>
          <label class="fld"><span>Rol</span>
            <select data-uf="rol">
              <option value="vendedor"${u.rol === 'vendedor' ? ' selected' : ''}>Vendedor</option>
              <option value="admin"${u.rol === 'admin' ? ' selected' : ''}>Administrador</option>
            </select>
          </label>
          <label class="fld"><span>Observación</span>
            <input type="text" data-uf="observacion" value="${escH(u.observacion)}">
          </label>
          <label class="fld"><span>Contraseña nueva (opcional)</span>
            <input type="text" data-uf="clave" placeholder="Mínimo 8 caracteres">
          </label>
        </div>
        <div class="actions">
          <button class="btn btn-dark" data-ua="guardar">Guardar</button>
          <button class="btn btn-ghost" data-ua="activo">${u.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </div>`).join('');

    box.querySelectorAll('[data-u]').forEach(card => {
      card.addEventListener('click', e => {
        const acc = e.target.closest('[data-ua]')?.dataset.ua;
        if (acc === 'guardar') guardarUsuario(card, e.target);
        if (acc === 'activo') cambiarActivo(card.dataset.u, e.target);
      });
    });
  }

  function pintarFiltroVendedor(){
    const sel = $('#filtroVendedor');
    if (!sel) return;
    const actual = sel.value;
    sel.innerHTML = '<option value="">Todos los vendedores</option>' +
      usuarios.map(u => `<option value="${escH(u.id)}">${escH(u.nombre || u.email)}</option>`).join('');
    sel.value = actual;
  }

  async function crearVendedor(e){
    const btn = e.target;
    const cuerpo = {
      nombre: $('#nvNombre').value.trim(),
      email: $('#nvEmail').value.trim(),
      telefono: $('#nvTelefono').value.trim(),
      password: $('#nvClave').value,
      rol: $('#nvRol').value,
      observacion: $('#nvObs').value.trim(),
    };
    if (!cuerpo.nombre || !cuerpo.email) { toast('Falta el nombre o el correo', true); return; }
    if (cuerpo.password.length < 8) { toast('La contraseña necesita 8 caracteres o más', true); return; }

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const { data:{ session } } = await sb.auth.getSession();
      const r = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(cuerpo),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || 'No se pudo crear');
      ['#nvNombre','#nvEmail','#nvTelefono','#nvClave','#nvObs'].forEach(s => $(s).value = '');
      await cargarUsuarios();
      toast('Vendedor creado');
    } catch (err) {
      toast(String(err.message || err), true);
    } finally {
      btn.disabled = false; btn.textContent = 'Crear vendedor';
    }
  }

  async function guardarUsuario(card, btn){
    const id = card.dataset.u;
    const val = f => card.querySelector(`[data-uf=${f}]`).value.trim();
    const clave = val('clave');

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const { error } = await sb.from('profiles').update({
        nombre: val('nombre'), telefono: val('telefono'),
        observacion: val('observacion'), rol: val('rol'),
      }).eq('id', id);
      if (error) throw error;

      if (clave) {
        if (clave.length < 8) throw new Error('La contraseña necesita 8 caracteres o más');
        const { data:{ session } } = await sb.auth.getSession();
        const r = await fetch('/api/crear-vendedor', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ accion:'clave', id, password: clave }),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'No se pudo cambiar la contraseña');
        card.querySelector('[data-uf=clave]').value = '';
      }
      await cargarUsuarios();
      toast('Usuario guardado');
    } catch (err) {
      toast(String(err.message || err), true);
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }

  async function cambiarActivo(id, btn){
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    btn.disabled = true;
    const { error } = await sb.from('profiles').update({ activo: !u.activo }).eq('id', id);
    if (error) { toast(error.message, true); btn.disabled = false; return; }
    await cargarUsuarios();
    toast(u.activo ? 'Vendedor desactivado' : 'Vendedor activado');
  }

  /* ── Ventas ───────────────────────────────────────────── */
  async function cargarVentas(){
    const box = $('#listVentas');
    box.innerHTML = '<div class="empty">Cargando…</div>';
    const { data, error } = await sb.from('ventas')
      .select('*').order('created_at', { ascending:false }).limit(500);
    if (error) { box.innerHTML = '<div class="empty">Error: ' + escH(error.message) + '</div>'; return; }
    ventas = data || [];
    pintarVentas();
  }

  const fotoDe = slug => (products.find(p => p.slug === slug) || {}).image || '';

  // Las ventas se agrupan por vendedor: primero quién vendió, después qué.
  function porVendedor(){
    const mapa = new Map();
    ventas.forEach(v => {
      if (!mapa.has(v.vendedor_id)) mapa.set(v.vendedor_id, { id:v.vendedor_id, nombre:v.vendedor_nombre, lista:[] });
      mapa.get(v.vendedor_id).lista.push(v);
    });
    usuarios.forEach(u => {
      const g = mapa.get(u.id);
      if (g) g.nombre = u.nombre || u.email;
      else if (u.rol === 'vendedor') mapa.set(u.id, { id:u.id, nombre:u.nombre || u.email, lista:[] });
    });
    return [...mapa.values()].sort((a, b) =>
      b.lista.reduce((x, v) => x + v.total, 0) - a.lista.reduce((x, v) => x + v.total, 0));
  }

  function filaVenta(v){
    return `
      <li>
        <img src="${escH(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div class="av-info">
          <b>${escH(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
          <small>${escH(v.cliente_nombre)} · ${escH(v.cliente_telefono)}</small>
          <small>${escH(v.cliente_direccion)}, ${escH(v.comuna)}</small>
          <small>${escH(v.metodo_pago)} · ${escH(fecha(v.created_at))}</small>
        </div>
        <div class="av-cuenta">
          <div class="av-linea"><span>Producto</span><b>${fmt((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
          <div class="av-linea"><span>Envío</span><b>${fmt(v.costo_despacho)}</b></div>
          <div class="av-linea av-final"><span>Total</span><b>${fmt(v.total)}</b></div>
        </div>
      </li>`;
  }

  function pintarVentas(){
    const box = $('#listVentas');
    const filtro = $('#filtroVendedor').value;
    const grupos = porVendedor().filter(g => !filtro || g.id === filtro);
    const suma = ventas.reduce((a, v) => a + (v.total || 0), 0);
    $('#resumenVentas').textContent = ventas.length
      ? `${ventas.length} venta${ventas.length === 1 ? '' : 's'} de ${grupos.length} vendedor${grupos.length === 1 ? '' : 'es'} · ${fmt(suma)} en total`
      : 'Sin ventas registradas todavía.';

    if (!grupos.length) { box.innerHTML = '<div class="empty">Todavía no hay vendedores.</div>'; return; }
    box.innerHTML = grupos.map(g => {
      const total = g.lista.reduce((a, v) => a + (v.total || 0), 0);
      return `
      <div class="card vendedor" data-v="${escH(g.id)}">
        <button type="button" class="vend-head" data-abrir="${escH(g.id)}">
          <span class="vend-ini">${escH((g.nombre || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="vend-txt">
            <b>${escH(g.nombre)}</b>
            <small>${g.lista.length} venta${g.lista.length === 1 ? '' : 's'} · ${fmt(total)}</small>
          </span>
          <span class="vend-ver">Ver historial</span>
        </button>
        ${g.lista.length ? `
          <p class="vend-sec">Ventas recientes</p>
          <ul class="av-lista">${g.lista.slice(0, 3).map(filaVenta).join('')}</ul>
          ${g.lista.length > 3 ? `<button type="button" class="vend-mas" data-abrir="${escH(g.id)}">Ver las ${g.lista.length} ventas</button>` : ''}
        ` : '<p class="hint">Todavía no registró ninguna venta.</p>'}
      </div>`;
    }).join('');

    box.querySelectorAll('[data-abrir]').forEach(b =>
      b.addEventListener('click', () => historial(b.dataset.abrir)));
  }

  // Historial completo de un vendedor, a pantalla completa.
  function historial(id){
    const g = porVendedor().find(x => x.id === id);
    if (!g) return;
    const total = g.lista.reduce((a, v) => a + (v.total || 0), 0);
    const envios = g.lista.reduce((a, v) => a + (v.costo_despacho || 0), 0);

    const ov = document.createElement('div');
    ov.className = 'vend-full';
    ov.innerHTML = `
      <header class="vf-head">
        <div>
          <p class="vf-kicker">Vendedor</p>
          <h2>${escH(g.nombre)}</h2>
        </div>
        <button type="button" class="vf-x" data-cerrar aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="vf-body">
        <div class="vf-wrap">
          <div class="vf-tarjetas">
            <div class="vt"><span>Ventas</span><b>${g.lista.length}</b></div>
            <div class="vt"><span>Productos</span><b>${fmt(total - envios)}</b></div>
            <div class="vt"><span>Envíos</span><b>${fmt(envios)}</b></div>
            <div class="vt destacada"><span>Total</span><b>${fmt(total)}</b></div>
          </div>
          ${g.lista.length
            ? `<ul class="av-lista">${g.lista.map(filaVenta).join('')}</ul>`
            : '<p class="hint">Este vendedor todavía no registró ventas.</p>'}
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    const cerrar = () => { ov.remove(); document.documentElement.style.overflow = ''; };
    ov.addEventListener('click', e => { if (e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', function salir(e){
      if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', salir); }
    });
  }

  /* ── Comunas ──────────────────────────────────────────── */
  async function cargarComunas(){
    const box = $('#listComunas');
    const { data, error } = await sb.from('comunas').select('*').order('position');
    if (error) { box.innerHTML = '<div class="empty">Error: ' + escH(error.message) + '</div>'; return; }
    comunas = data || [];
    box.innerHTML = `<div class="card comunas-grid">${comunas.map(c => `
      <div class="comuna" data-c="${escH(c.id)}">
        <span>${escH(c.nombre)}</span>
        <input type="number" min="0" step="500" data-cf="costo" value="${c.costo}">
        <label class="switch"><input type="checkbox" data-cf="activa" ${c.activa ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label>
      </div>`).join('')}</div>`;
  }

  async function guardarComunas(e){
    const btn = e.target;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const filas = [...document.querySelectorAll('.comuna')].map(el => {
        const c = comunas.find(x => x.id === el.dataset.c);
        return {
          ...c,
          costo: parseInt(el.querySelector('[data-cf=costo]').value, 10) || 0,
          activa: el.querySelector('[data-cf=activa]').checked,
        };
      });
      const { error } = await sb.from('comunas').upsert(filas, { onConflict: 'id' });
      if (error) throw error;
      comunas = filas;
      toast('Comunas guardadas');
    } catch (err) {
      toast(String(err.message || err), true);
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar comunas';
    }
  }

  return { init, refrescar: () => { if (yo && yo.rol === 'admin' && ventas.length) pintarVentas(); } };
})();
