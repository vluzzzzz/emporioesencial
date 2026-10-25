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
  const fotoDe = slug => (productos().find(p => p.slug === slug) || {}).image || '';

  // La misma escala que usa el panel y la base: lo que se le paga al
  // vendedor por unidad, según cuánto cuesta el producto.
  const comisionUnidad = precio => {
    const p = Number(precio) || 0;
    if (p <= 0) return 0;
    if (p <= 10500) return 1300;
    if (p <= 22500) return 1800;
    if (p <= 32500) return 2300;
    return 2800;
  };
  const comisionDe = v => v.comision > 0 ? v.comision : (v.cantidad || 1) * comisionUnidad(v.precio_unitario);
  const estadoDe = v => v.estado || 'aceptado';

  async function init(){
    if (!sb) return;
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) { montarBotonLogin(); return; }
    const { data } = await sb.from('profiles')
      .select('id,nombre,email,rol,activo').eq('id', session.user.id).maybeSingle();
    perfil = data && data.activo ? data : null;
    if (!perfil) { montarBotonLogin(); return; }
    pintarNav();
    montarBotonFicha();
    if (typeof Edicion !== 'undefined') Edicion.init(perfil);
  }

  function montarBotonLogin(){
    const b = $('.nav-login');
    if (b) b.addEventListener('click', abrirLogin);
  }

  function abrirLogin(){
    const cuerpo = `
      <form id="loginForm" autocomplete="on">
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Correo</span>
            <input type="email" name="email" required autocomplete="username" placeholder="tu@correo.cl">
          </label>
          <label class="venta-f venta-ancho"><span>Contraseña</span>
            <input type="password" name="clave" required autocomplete="current-password">
          </label>
        </div>
        <p class="venta-msg" id="loginMsg"></p>
      </form>`;
    const pie = '<button type="submit" form="loginForm" class="venta-btn">Entrar</button>';
    const { ov, cerrar } = panel('Ingresar', 'Equipo Esencial Emporio', cuerpo, pie);
    const f = ov.querySelector('#loginForm');
    f.email.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('.venta-btn');
      const msg = ov.querySelector('#loginMsg');
      btn.disabled = true; btn.textContent = 'Entrando…'; msg.className = 'venta-msg';
      const { error } = await sb.auth.signInWithPassword({
        email: f.email.value.trim(), password: f.clave.value,
      });
      if (error) {
        btn.disabled = false; btn.textContent = 'Entrar';
        msg.className = 'venta-msg err';
        msg.textContent = 'No se pudo entrar: ' + error.message;
        return;
      }
      cerrar();
      location.reload();
    });
  }

  // pm.js la llama cada vez que se abre una ficha de producto.
  function ficha(slug){
    const b = $('#ppageVendido');
    if (!b) return;
    b.hidden = !perfil;
    b.dataset.slug = slug;
  }

  /* ── Barra de arriba ──────────────────────────────────── */
  function pintarNav(){
    const izq = $('.nav-left');
    if (izq) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav-ventas-btn';
      b.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18l-1.7 9.4a2 2 0 0 1-2 1.6H6.7a2 2 0 0 1-2-1.6z"/><path d="M8 21h.01M16 21h.01"/>
        </svg>
        <span>Ventas</span>`;
      b.addEventListener('click', abrirMisVentas);
      izq.appendChild(b);
    }

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

  /* ── Desplegable propio ───────────────────────────────── */
  // Reemplaza al <select> del navegador, que no se puede diseñar.
  // `elegido` deja una opción ya marcada, para los campos que vienen con valor.
  // `buscar` suma una casilla para filtrar cuando la lista es larga.
  function desplegable(nombre, opciones, textoVacio, elegido, buscar){
    const actual = opciones.find(o => o.valor === elegido);
    return `
      <div class="vsel${buscar ? ' con-busca' : ''}" data-sel="${esc(nombre)}">
        <input type="hidden" name="${esc(nombre)}" value="${esc(actual ? actual.valor : '')}">
        <button type="button" class="vsel-btn" aria-haspopup="listbox" aria-expanded="false">
          <span class="vsel-txt${actual ? '' : ' vacio'}">${esc(actual ? actual.texto : textoVacio)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="vsel-caja" hidden>
        ${buscar ? `<label class="vsel-busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input type="text" placeholder="Buscar…" autocomplete="off">
        </label>` : ''}
        <ul class="vsel-lista" role="listbox">
          ${opciones.map(o => `
            <li role="option" class="${o.valor === elegido ? 'elegida' : ''}" data-val="${esc(o.valor)}" data-extra="${esc(o.extra == null ? '' : o.extra)}">
              <span>${esc(o.texto)}</span>
              ${o.nota ? `<small>${esc(o.nota)}</small>` : ''}
            </li>`).join('')}
          <li class="vsel-nada" hidden>Sin resultados</li>
        </ul>
        </div>
      </div>`;
  }

  function conectarDesplegables(raiz, alElegir){
    raiz.querySelectorAll('.vsel').forEach(sel => {
      const btn = sel.querySelector('.vsel-btn');
      const caja = sel.querySelector('.vsel-caja');
      const lista = sel.querySelector('.vsel-lista');
      const busca = sel.querySelector('.vsel-busca input');
      const txt = sel.querySelector('.vsel-txt');
      const campo = sel.querySelector('input');

      btn.addEventListener('click', () => {
        const abierto = !caja.hidden;
        raiz.querySelectorAll('.vsel-caja').forEach(c => { c.hidden = true; });
        raiz.querySelectorAll('.vsel').forEach(s => s.classList.remove('abierto'));
        caja.hidden = abierto;
        sel.classList.toggle('abierto', !abierto);
        btn.setAttribute('aria-expanded', String(!abierto));
        if (abierto) return;
        if (busca) { busca.value = ''; filtrar(''); busca.focus(); }
        // Con listas largas, la opción elegida tiene que quedar a la vista.
        const elegida = lista.querySelector('li.elegida');
        if (elegida) lista.scrollTop = Math.max(0, elegida.offsetTop - lista.clientHeight / 2 + elegida.offsetHeight / 2);
      });

      const limpio = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      function filtrar(q){
        const t = limpio(q);
        let vistos = 0;
        lista.querySelectorAll('li[data-val]').forEach(li => {
          const ok = !t || limpio(li.textContent).includes(t);
          li.hidden = !ok;
          if (ok) vistos++;
        });
        const nada = lista.querySelector('.vsel-nada');
        if (nada) nada.hidden = vistos > 0;
      }
      if (busca) {
        busca.addEventListener('input', e => filtrar(e.target.value));
        busca.addEventListener('click', e => e.stopPropagation());
      }

      lista.addEventListener('click', e => {
        const li = e.target.closest('li');
        if (!li) return;
        campo.value = li.dataset.val;
        txt.textContent = li.querySelector('span').textContent;
        txt.classList.remove('vacio');
        lista.querySelectorAll('li').forEach(x => x.classList.remove('elegida'));
        li.classList.add('elegida');
        caja.hidden = true;
        sel.classList.remove('abierto');
        btn.setAttribute('aria-expanded','false');
        if (alElegir) alElegir(sel.dataset.sel, li.dataset.val, li.dataset.extra);
      });
    });

    raiz.addEventListener('click', e => {
      if (e.target.closest('.vsel')) return;
      raiz.querySelectorAll('.vsel-caja').forEach(c => { c.hidden = true; });
      raiz.querySelectorAll('.vsel').forEach(s => s.classList.remove('abierto'));
    });
  }

  /* ── Panel lateral ────────────────────────────────────── */
  function panel(titulo, kicker, cuerpo, pie, full){
    const ov = document.createElement('div');
    ov.className = 'venta-ov' + (full ? ' venta-full' : '');
    ov.innerHTML = `
      <div class="venta-panel">
        <header class="venta-head">
          <div>
            <p class="venta-kicker">${esc(kicker)}</p>
            <h2>${esc(titulo)}</h2>
          </div>
          <button type="button" class="venta-x" data-acc="cerrar" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="venta-body">${cuerpo}</div>
        ${pie ? `<footer class="venta-pie">${pie}</footer>` : ''}
      </div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => ov.classList.add('abierto'));

    const cerrar = () => {
      ov.classList.remove('abierto');
      document.removeEventListener('keydown', salir);
      setTimeout(() => {
        ov.remove();
        // El scroll vuelve recién cuando no queda ningún panel abierto: con
        // dos encimados, cerrar el de arriba no tiene que soltar la página.
        if (!document.querySelector('.venta-ov')) document.documentElement.style.overflow = '';
      }, 300);
    };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-acc=cerrar]')) cerrar();
    });
    // Escape cierra solo el panel de más arriba, no toda la pila.
    function salir(e){
      if (e.key !== 'Escape') return;
      const paneles = document.querySelectorAll('.venta-ov');
      if (paneles[paneles.length - 1] === ov) cerrar();
    }
    document.addEventListener('keydown', salir);
    return { ov, cerrar };
  }

  /* ── Formulario de venta ──────────────────────────────── */
  async function abrirFormulario(slug){
    await cargarComunas();
    const prod = productos().find(p => p.slug === slug);
    if (!prod) return;

    const cuerpo = `
      <form id="ventaForm">
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
          <div class="venta-f"><span>Precio por unidad</span>
            <p class="venta-fijo">
              ${fmt(precioDe(slug))}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
            </p>
            <input type="hidden" name="precio" value="${precioDe(slug)}">
          </div>
        </div>

        <p class="venta-sec">Despacho</p>
        <div class="venta-g2">
          <div class="venta-f venta-ancho"><span>Comuna · Región de Valparaíso</span>
            ${desplegable('comuna', comunas.map(c => ({ valor:c.nombre, texto:c.nombre, extra:c.costo, nota:fmt(c.costo) })), 'Elegí la comuna')}
          </div>
          <div class="venta-f"><span>Costo de despacho</span>
            <p class="venta-fijo" id="ventaDespacho">
              Elegí la comuna
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
            </p>
            <input type="hidden" name="despacho" value="0">
          </div>
        </div>

        <p class="venta-sec">Datos del cliente</p>
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Nombre y apellido</span>
            <input type="text" name="cliente" required placeholder="Ej: María Pérez">
          </label>
          <label class="venta-f"><span>Teléfono</span>
            <input type="tel" name="telefono" required placeholder="+56 9 ...">
          </label>
          <label class="venta-f"><span>Correo (opcional)</span>
            <input type="email" name="email" placeholder="cliente@correo.cl">
          </label>
          <div class="venta-f venta-ancho"><span>Método de pago</span>
            ${desplegable('pago', ['Transferencia','Efectivo','Débito o crédito','Otro'].map(v => ({ valor:v, texto:v })), 'Elegí el método')}
          </div>
          <label class="venta-f venta-ancho"><span>Dirección de entrega</span>
            <input type="text" name="direccion" required placeholder="Calle, número, depto">
          </label>
          <label class="venta-f venta-ancho"><span>Observaciones (opcional)</span>
            <textarea name="notas" rows="2" placeholder="Horario de entrega, referencias…"></textarea>
          </label>
        </div>
      </form>`;

    const pie = `
      <div class="venta-total">
        <span>Total de la venta</span>
        <b id="ventaTotal">$0</b>
      </div>
      <button type="submit" form="ventaForm" class="venta-btn">Registrar venta</button>
      <p class="venta-msg" id="ventaMsg"></p>`;

    const { ov, cerrar } = panel('Agregar pedido', 'Registro de venta', cuerpo, pie);
    const f = ov.querySelector('#ventaForm');

    const total = () => {
      const n = +f.cantidad.value || 0, p = +f.precio.value || 0, d = +f.despacho.value || 0;
      ov.querySelector('#ventaTotal').textContent = fmt(n * p + d);
    };
    conectarDesplegables(ov, (campo, valor, extra) => {
      if (campo !== 'comuna') return;
      f.despacho.value = extra || 0;
      ov.querySelector('#ventaDespacho').childNodes[0].nodeValue = fmt(extra || 0) + ' ';
      total();
    });
    f.cantidad.addEventListener('input', total);
    total();

    f.addEventListener('submit', e => { e.preventDefault(); guardar(ov, f, prod, cerrar); });
  }

  async function guardar(ov, f, prod, cerrar){
    const btn = ov.querySelector('.venta-btn');
    const msg = ov.querySelector('#ventaMsg');
    const cantidad = +f.cantidad.value || 1;
    const precio = +f.precio.value || 0;
    const despacho = +f.despacho.value || 0;

    msg.textContent = ''; msg.className = 'venta-msg';
    if (!f.comuna.value) { msg.className = 'venta-msg err'; msg.textContent = 'Elegí la comuna de despacho.'; return; }
    btn.disabled = true; btn.textContent = 'Guardando…';

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
    const { ov } = panel('Mis ventas', 'Historial', '<p class="venta-vacio">Cargando…</p>', '', true);
    const box = ov.querySelector('.venta-body');

    const { data, error } = await sb.from('ventas')
      .select('*').eq('vendedor_id', perfil.id).order('created_at', { ascending:false }).limit(100);
    if (error) { box.innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(error.message) + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="venta-vacio">Todavía no registraste ninguna venta. Abrí un producto y tocá Agregar pedido.</p>'; return; }

    // Solo se cobra por lo que el administrador aceptó.
    const pagables = data.filter(v => estadoDe(v) === 'aceptado');
    const pendientes = data.filter(v => estadoDe(v) === 'pendiente').length;
    const suma = pagables.reduce((a, v) => a + (v.total || 0), 0);
    const comision = pagables.reduce((a, v) => a + comisionDe(v), 0);
    const unidades = pagables.reduce((a, v) => a + (v.cantidad || 1), 0);
    box.innerHTML = `
      <div class="venta-wrap">
        ${pendientes ? `<p class="ev-aviso-pend" style="display:inline-block;margin:0 0 16px">${pendientes} pedido${pendientes === 1 ? '' : 's'} esperando aprobación</p>` : ''}
        <div class="venta-tarjetas">
          <div class="vt"><span>Aceptadas</span><b>${pagables.length}</b></div>
          <div class="vt"><span>Productos vendidos</span><b>${unidades}</b></div>
          <div class="vt"><span>Vendido</span><b>${fmt(suma)}</b></div>
          <div class="vt destacada"><span>Te deben pagar</span><b>${fmt(comision)}</b></div>
        </div>
        <ul class="venta-lista">
          ${data.map(v => {
            const prod = (v.precio_unitario || 0) * (v.cantidad || 1);
            const estado = estadoDe(v);
            return `
            <li class="ev-venta ${estado}">
              <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
              <div class="vl-info">
                <b>${esc(v.producto_nombre)}</b>
                <small>${esc(v.cliente_nombre)} · ${esc(v.cliente_telefono)}${v.cliente_email ? ' · ' + esc(v.cliente_email) : ''}</small>
                <small>${esc(v.cliente_direccion)}, ${esc(v.comuna)}</small>
                <small>${esc(v.metodo_pago)} · ${new Date(v.created_at).toLocaleDateString('es-CL')}</small>
                ${v.notas ? `<small>${esc(v.notas)}</small>` : ''}
                <span class="ev-sello ${estado}">${estado === 'pendiente' ? 'Esperando aprobación' : estado === 'aceptado' ? 'Aceptado' : 'Denegado'}</span>
              </div>
              <div class="vl-cuenta">
                <div class="vl-linea"><span>Producto${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</span><b>${fmt(prod)}</b></div>
                <div class="vl-linea"><span>Envío · ${esc(v.comuna)}</span><b>${fmt(v.costo_despacho)}</b></div>
                <div class="vl-linea vl-final"><span>Total</span><b>${fmt(v.total)}</b></div>
                <div class="vl-linea vl-pagar"><span>Tu comisión</span><b>${estado === 'aceptado' ? fmt(comisionDe(v)) : '—'}</b></div>
              </div>
            </li>`;
          }).join('')}
        </ul>
      </div>`;
  }

  return {
    init, ficha,
    // El chasis de paneles y el desplegable propio los reusan los módulos de
    // edición: una sola implementación, cero CSS repetido.
    panel, desplegable, conectarDesplegables,
    perfil: () => perfil,
    esAdmin: () => !!perfil && perfil.rol === 'admin',
  };
})();

document.addEventListener('DOMContentLoaded', () => Sesion.init().catch(e => console.error('Sesion:', e)));
