// ev
'use strict';
/* ============================================================================
 *  EdVendedores — el botón VENDEDORES de la barra.
 *  Reemplaza las pestañas Ventas, Usuarios y Despacho del panel viejo.
 *
 *  No depende del interruptor Editar: administrar personas no es editar
 *  contenido, y obligar a prender la edición para mirar las ventas molesta.
 * ========================================================================== */
const EdVendedores = (() => {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const cuando = d => new Date(d).toLocaleDateString('es-CL');

  const sb = window.sb;
  let usuarios = [], ventas = [], comunas = [], pestana = 'ventas';
  let toast = m => console.log(m), mensajeError = e => String(e && e.message || e), confirmarFn = null;

  function montarBoton(){
    const izq = document.querySelector('.nav-left');
    if (!izq || izq.querySelector('.nav-vendedores-btn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nav-vendedores-btn';
    b.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.2"/><path d="M17 11a3.2 3.2 0 1 0-2-5.7"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.8"/>
      </svg>
      <span>Vendedores</span>`;
    b.addEventListener('click', abrir);
    izq.appendChild(b);
  }

  const fotoDe = slug => (CATALOGO.find(p => p.slug === slug) || {}).image || '';

  async function cargar(){
    const [u, v, c] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending:false }),
      sb.from('ventas').select('*').order('created_at', { ascending:false }).limit(500),
      sb.from('comunas').select('*').order('position'),
    ]);
    usuarios = u.data || [];
    ventas = v.data || [];
    comunas = c.data || [];
  }

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
    const suma = g => g.lista.reduce((a, v) => a + (v.total || 0), 0);
    return [...mapa.values()].sort((a, b) => suma(b) - suma(a));
  }

  function filaVenta(v){
    return `
      <li>
        <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div class="vl-info">
          <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
          <small>${esc(v.cliente_nombre)} · ${esc(v.cliente_telefono)}</small>
          <small>${esc(v.cliente_direccion)}, ${esc(v.comuna)}</small>
          <small>${esc(v.metodo_pago)} · ${cuando(v.created_at)}</small>
        </div>
        <div class="vl-cuenta">
          <div class="vl-linea"><span>Producto</span><b>${plata((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
          <div class="vl-linea"><span>Envío</span><b>${plata(v.costo_despacho)}</b></div>
          <div class="vl-linea vl-final"><span>Total</span><b>${plata(v.total)}</b></div>
        </div>
      </li>`;
  }

  /* ── Panel ────────────────────────────────────────────── */
  async function abrir(){
    if (typeof EdUtil !== 'undefined') {
      toast = EdUtil.toast; mensajeError = EdUtil.mensajeError; confirmarFn = EdUtil.confirmar;
    }
    const { ov } = Sesion.panel('Vendedores', 'Equipo y ventas',
      `<div class="ev-tabs">
         <button type="button" class="ev-tab activa" data-p="ventas">Ventas</button>
         <button type="button" class="ev-tab" data-p="equipo">Equipo</button>
         <button type="button" class="ev-tab" data-p="despacho">Despacho</button>
       </div>
       <div class="venta-wrap" id="evCuerpo"><p class="venta-vacio">Cargando…</p></div>`,
      '', true);

    ov.querySelectorAll('.ev-tab').forEach(t => t.addEventListener('click', () => {
      ov.querySelectorAll('.ev-tab').forEach(x => x.classList.toggle('activa', x === t));
      pestana = t.dataset.p;
      pintar(ov);
    }));

    try { await cargar(); } catch (err) {
      ov.querySelector('#evCuerpo').innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(mensajeError(err)) + '</p>';
      return;
    }
    pestana = 'ventas';
    pintar(ov);
  }

  function pintar(ov){
    const box = ov.querySelector('#evCuerpo');
    if (pestana === 'ventas')   return pintarVentas(box);
    if (pestana === 'equipo')   return pintarEquipo(ov, box);
    if (pestana === 'despacho') return pintarDespacho(ov, box);
  }

  function pintarVentas(box){
    const grupos = porVendedor();
    if (!grupos.length) { box.innerHTML = '<p class="venta-vacio">Todavía no hay vendedores.</p>'; return; }
    const total = ventas.reduce((a, v) => a + (v.total || 0), 0);
    const envios = ventas.reduce((a, v) => a + (v.costo_despacho || 0), 0);

    box.innerHTML = `
      <div class="venta-tarjetas">
        <div class="vt"><span>Ventas</span><b>${ventas.length}</b></div>
        <div class="vt"><span>Productos</span><b>${plata(total - envios)}</b></div>
        <div class="vt"><span>Envíos</span><b>${plata(envios)}</b></div>
        <div class="vt destacada"><span>Total</span><b>${plata(total)}</b></div>
      </div>
      <div class="ev-grid">
      ${grupos.map(g => {
        const t = g.lista.reduce((a, v) => a + (v.total || 0), 0);
        return `
        <div class="ev-vendedor">
          <button type="button" class="ev-head" data-abrir="${esc(g.id)}">
            <span class="ev-ini">${esc((g.nombre || '?').trim().charAt(0).toUpperCase())}</span>
            <span class="ev-txt">
              <b>${esc(g.nombre)}</b>
              <small>${g.lista.length} venta${g.lista.length === 1 ? '' : 's'} · ${plata(t)}</small>
            </span>
            <span class="ev-ver">Ver todo</span>
          </button>
          ${g.lista.length
            ? `<ul class="venta-lista">${g.lista.slice(0, 3).map(filaVenta).join('')}</ul>`
            : '<p class="venta-vacio">Todavía no registró ninguna venta.</p>'}
        </div>`;
      }).join('')}
      </div>`;

    box.querySelectorAll('[data-abrir]').forEach(b =>
      b.addEventListener('click', () => historial(b.dataset.abrir)));
  }

  function historial(id){
    const g = porVendedor().find(x => x.id === id);
    if (!g) return;
    const total = g.lista.reduce((a, v) => a + (v.total || 0), 0);
    const envios = g.lista.reduce((a, v) => a + (v.costo_despacho || 0), 0);
    const cuerpo = `
      <div class="venta-tarjetas">
        <div class="vt"><span>Ventas</span><b>${g.lista.length}</b></div>
        <div class="vt"><span>Productos</span><b>${plata(total - envios)}</b></div>
        <div class="vt"><span>Envíos</span><b>${plata(envios)}</b></div>
        <div class="vt destacada"><span>Total</span><b>${plata(total)}</b></div>
      </div>
      ${g.lista.length
        ? `<ul class="venta-lista">${g.lista.map(filaVenta).join('')}</ul>`
        : '<p class="venta-vacio">Sin ventas.</p>'}`;
    Sesion.panel(g.nombre, 'Vendedor', '<div class="venta-wrap">' + cuerpo + '</div>', '', true);
  }

  /* ── Equipo ───────────────────────────────────────────── */
  function pintarEquipo(ov, box){
    box.innerHTML = `
      <div class="ev-nuevo">
        <p class="venta-sec" style="margin-top:0">Vendedor nuevo</p>
        <div class="venta-g2">
          <label class="venta-f"><span>Nombre y apellido</span><input type="text" id="nvNombre" placeholder="Ej: Camila Soto"></label>
          <label class="venta-f"><span>Correo</span><input type="email" id="nvEmail" placeholder="vendedor@correo.cl"></label>
          <label class="venta-f"><span>Teléfono</span><input type="tel" id="nvTel" placeholder="+56 9 ..."></label>
          <label class="venta-f"><span>Contraseña provisoria</span><input type="text" id="nvClave" placeholder="Mínimo 8 caracteres"></label>
          <label class="venta-f venta-ancho"><span>Observación</span><input type="text" id="nvObs" placeholder="Zona, horario, notas internas"></label>
        </div>
        <button type="button" class="venta-btn" id="nvCrear" style="margin-top:14px">Crear vendedor</button>
        <p class="venta-msg" id="nvMsg"></p>
      </div>

      <p class="venta-sec">Equipo</p>
      <div class="ev-grid">
        ${usuarios.map(u => `
          <div class="ev-ficha${u.activo ? '' : ' apagada'}">
            <span class="ev-ini">${esc((u.nombre || u.email).trim().charAt(0).toUpperCase())}</span>
            <span class="ev-txt">
              <b>${esc(u.nombre || u.email)}</b>
              <small>${u.rol === 'admin' ? 'Administrador' : 'Vendedor'}${u.activo ? '' : ' · desactivado'}</small>
            </span>
            <button type="button" class="ev-lapiz" data-editar-u="${esc(u.id)}" aria-label="Editar ${esc(u.nombre || u.email)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
          </div>`).join('')}
      </div>`;

    ov.querySelector('#nvCrear').addEventListener('click', e => crearVendedor(ov, e.target));
    box.querySelectorAll('[data-editar-u]').forEach(b =>
      b.addEventListener('click', () => editarPersona(ov, b.dataset.editarU)));
  }

  // Los datos de una persona se editan en su propio panel: en la grilla solo
  // va el nombre, para poder ver todo el equipo de una mirada.
  function editarPersona(padre, id){
    const u = usuarios.find(x => x.id === id);
    if (!u) return;

    const cuerpo = `
      <form id="evPersona">
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Nombre y apellido</span>
            <input type="text" data-uf="nombre" value="${esc(u.nombre)}">
          </label>
          <label class="venta-f venta-ancho"><span>Correo</span>
            <input type="text" value="${esc(u.email)}" disabled>
            <small class="ev-nota">El correo con el que entra no se puede cambiar.</small>
          </label>
          <label class="venta-f"><span>Teléfono</span>
            <input type="tel" data-uf="telefono" value="${esc(u.telefono)}">
          </label>
          <label class="venta-f"><span>Rol</span>
            <select data-uf="rol">
              <option value="vendedor"${u.rol === 'vendedor' ? ' selected' : ''}>Vendedor</option>
              <option value="admin"${u.rol === 'admin' ? ' selected' : ''}>Administrador</option>
            </select>
          </label>
          <label class="venta-f venta-ancho"><span>Observación</span>
            <input type="text" data-uf="observacion" value="${esc(u.observacion)}">
          </label>
          <label class="venta-f venta-ancho"><span>Contraseña nueva (opcional)</span>
            <input type="text" data-uf="clave" placeholder="Dejalo vacío para no cambiarla">
          </label>
        </div>
        <p class="venta-msg" id="evPersonaMsg"></p>
      </form>`;

    const pie = `
      <button type="button" class="venta-btn borrar" id="evActivo">${u.activo ? 'Desactivar' : 'Activar'}</button>
      <button type="submit" form="evPersona" class="venta-btn">Guardar</button>`;

    const { ov, cerrar } = Sesion.panel(u.nombre || u.email, 'Editar persona', cuerpo, pie);
    const f = ov.querySelector('#evPersona');

    ov.querySelector('#evActivo').addEventListener('click', async e => {
      await cambiarActivo(padre, id, e.target);
      cerrar();
    });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('button[type=submit]');
      const msg = ov.querySelector('#evPersonaMsg');
      btn.disabled = true; btn.textContent = 'Guardando…';
      msg.className = 'venta-msg'; msg.textContent = '';
      try {
        await guardarUsuario(padre, f, id);
        cerrar();
        toast('Guardado');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  async function token(){
    const { data:{ session } } = await sb.auth.getSession();
    return session ? session.access_token : '';
  }

  async function crearVendedor(ov, btn){
    const g = id => ov.querySelector(id).value.trim();
    const cuerpo = {
      nombre: g('#nvNombre'), email: g('#nvEmail'), telefono: g('#nvTel'),
      password: ov.querySelector('#nvClave').value, observacion: g('#nvObs'), rol: 'vendedor',
    };
    const msg = ov.querySelector('#nvMsg');
    msg.className = 'venta-msg';
    if (!cuerpo.nombre || !cuerpo.email) { msg.className = 'venta-msg err'; msg.textContent = 'Falta el nombre o el correo.'; return; }
    if (cuerpo.password.length < 8) { msg.className = 'venta-msg err'; msg.textContent = 'La contraseña necesita 8 caracteres o más.'; return; }

    btn.disabled = true; btn.textContent = 'Creando…';
    try {
      const r = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + await token() },
        body: JSON.stringify(cuerpo),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || 'No se pudo crear');
      await cargar();
      pintar(ov);
      toast('Vendedor creado');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Crear vendedor';
      msg.className = 'venta-msg err';
      msg.textContent = String(err.message || err);
    }
  }

  async function guardarUsuario(padre, f, id){
    const val = campo => f.querySelector('[data-uf=' + campo + ']').value.trim();
    const clave = val('clave');

    const { error } = await sb.from('profiles').update({
      nombre: val('nombre'), telefono: val('telefono'),
      observacion: val('observacion'), rol: val('rol'),
    }).eq('id', id);
    if (error) throw error;

    if (clave) {
      if (clave.length < 8) throw new Error('La contraseña necesita 8 caracteres o más');
      const r = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + await token() },
        body: JSON.stringify({ accion:'clave', id, password: clave }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'No se pudo cambiar la contraseña');
    }
    await cargar();
    pintar(padre);
  }

  async function cambiarActivo(ov, id, btn){
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    if (u.activo && confirmarFn && !(await confirmarFn('¿Desactivar a ' + (u.nombre || u.email) + '? No va a poder entrar.', 'Desactivar'))) return;
    btn.disabled = true;
    const { error } = await sb.from('profiles').update({ activo: !u.activo }).eq('id', id);
    if (error) { toast(mensajeError(error), true); btn.disabled = false; return; }
    await cargar();
    pintar(ov);
    toast(u.activo ? 'Cuenta desactivada' : 'Cuenta activada');
  }

  /* ── Despacho ─────────────────────────────────────────── */
  function pintarDespacho(ov, box){
    box.innerHTML = `
      <p class="venta-vacio" style="margin-bottom:16px">Es lo que se suma al precio cuando el vendedor elige la comuna. Si apagás una, deja de aparecer en el formulario.</p>
      <div class="ev-comunas">
        ${comunas.map(c => `
          <div class="ev-comuna" data-c="${esc(c.id)}">
            <span>${esc(c.nombre)}</span>
            <input type="number" min="0" step="500" data-cf="costo" value="${c.costo}">
            <label class="ed-dest"><input type="checkbox" data-cf="activa" ${c.activa ? 'checked' : ''}><span>Activa</span></label>
          </div>`).join('')}
      </div>
      <button type="button" class="venta-btn" id="evGuardarComunas" style="margin-top:18px">Guardar comunas</button>`;

    ov.querySelector('#evGuardarComunas').addEventListener('click', async e => {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const filas = [...box.querySelectorAll('.ev-comuna')].map(el => ({
          ...comunas.find(x => x.id === el.dataset.c),
          costo: parseInt(el.querySelector('[data-cf=costo]').value, 10) || 0,
          activa: el.querySelector('[data-cf=activa]').checked,
        }));
        const { error } = await sb.from('comunas').upsert(filas, { onConflict: 'id' });
        if (error) throw error;
        comunas = filas;
        toast('Comunas guardadas');
      } catch (err) {
        toast(mensajeError(err), true);
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar comunas';
      }
    });
  }

  return { montarBoton, abrir };
})();
