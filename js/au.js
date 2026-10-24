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

  function pintarVentas(){
    const box = $('#listVentas');
    const filtro = $('#filtroVendedor').value;
    const lista = filtro ? ventas.filter(v => v.vendedor_id === filtro) : ventas;
    const suma = lista.reduce((a, v) => a + (v.total || 0), 0);
    $('#resumenVentas').textContent = lista.length
      ? `${lista.length} venta${lista.length === 1 ? '' : 's'} · ${fmt(suma)} en total`
      : 'Sin ventas registradas todavía.';

    if (!lista.length) { box.innerHTML = '<div class="empty">Sin ventas.</div>'; return; }
    box.innerHTML = lista.map(v => `
      <div class="card venta-fila">
        <div class="prod-head">
          <h3>${escH(v.producto_nombre)} ${v.cantidad > 1 ? '× ' + v.cantidad : ''}</h3>
          <span class="slug-badge">${fmt(v.total)}</span>
        </div>
        <p class="hint">
          <b>${escH(v.cliente_nombre)}</b> · ${escH(v.cliente_telefono)}${v.cliente_email ? ' · ' + escH(v.cliente_email) : ''}<br>
          ${escH(v.cliente_direccion)}, ${escH(v.comuna)} · despacho ${fmt(v.costo_despacho)}<br>
          ${escH(v.metodo_pago)} · vendió ${escH(v.vendedor_nombre)} · ${escH(fecha(v.created_at))}
          ${v.notas ? '<br>' + escH(v.notas) : ''}
        </p>
      </div>`).join('');
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

  return { init };
})();
