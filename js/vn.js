// vn
'use strict';
const Sesion = (() => {
  const sb = window.sb;
  let perfil = null, comunas = [], sucursales = [], montado = false;

  const ROLES = { admin:'Administrador', moderador:'Moderador de caja', vendedor:'Vendedor' };

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
      .select('id,nombre,email,rol,activo,sucursal_id').eq('id', session.user.id).maybeSingle();
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
    // El moderador no registra ventas: su botón es la caja, y lo monta ec.js.
    if (izq && perfil.rol !== 'moderador') {
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
          <small>${esc(ROLES[perfil.rol] || 'Vendedor')}</small>
        </span>
      </button>
      <div class="nav-cuenta-menu" id="navCuentaMenu" hidden>
        ${perfil.rol === 'moderador' ? '' : '<button type="button" data-acc="ventas">Mis ventas</button>'}
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

  // Se traen todas, no solo las activas: una sucursal apagada ya no se puede
  // elegir, pero sus pedidos viejos igual tienen que mostrar su nombre.
  async function cargarSucursales(){
    if (sucursales.length) return sucursales;
    const { data } = await sb.from('sucursales')
      .select('id,nombre,direccion,comuna,activa').order('position');
    sucursales = data || [];
    return sucursales;
  }

  const esRetiro = v => v.tipo === 'presencial';
  const nombreSucursal = id => (sucursales.find(s => s.id === id) || {}).nombre || 'Sucursal';
  const ICO_TIENDA = '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9.5 20v-5h5v5"/>';

  function marcaRetiro(v){
    return `<small class="ev-retiro">${svgIco(ICO_TIENDA)}Retira en ${esc(nombreSucursal(v.sucursal_id))}` +
      (v.codigo_retiro ? ` · código <b>${esc(v.codigo_retiro)}</b>` : '') + '</small>';
  }

  /* ── Desplegable propio ───────────────────────────────── */
  // Reemplaza al <select> del navegador, que no se puede diseñar.
  // `elegido` deja una opción ya marcada, para los campos que vienen con valor.
  // `buscar` suma una casilla para filtrar cuando la lista es larga.
  function desplegable(nombre, opciones, textoVacio, elegido, buscar, ico){
    const actual = opciones.find(o => o.valor === elegido);
    return `
      <div class="vsel${buscar ? ' con-busca' : ''}" data-sel="${esc(nombre)}">
        <input type="hidden" name="${esc(nombre)}" value="${esc(actual ? actual.valor : '')}">
        <button type="button" class="vsel-btn" aria-haspopup="listbox" aria-expanded="false">
          ${ico ? `<svg class="vsel-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico}</svg>` : ''}
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
    // El clic de afuera cierra, pero con dos resguardos: tiene que haber
    // empezado sobre el velo (si no, arrastrar texto desde adentro cerraba el
    // panel) y no cuenta el primer cuarto de segundo (el toque que lo abrió
    // puede repetirse sobre el velo recién creado y lo cerraba al instante).
    const nacio = Date.now();
    let desdeElVelo = false;
    ov.addEventListener('pointerdown', e => { desdeElVelo = e.target === ov; });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-acc=cerrar]')) return cerrar();
      if (e.target !== ov || !desdeElVelo) return;
      if (Date.now() - nacio < 250) return;
      cerrar();
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
    await Promise.all([cargarComunas(), cargarSucursales()]);
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

        <div class="venta-tipo" role="radiogroup" aria-label="Cómo recibe el cliente">
          <button type="button" class="venta-tipo-b activa" data-tipo="despacho" role="radio" aria-checked="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5h10.5v8H3z"/><path d="M13.5 10.5H18l3 3v2h-7.5z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>
            <span><b>Despacho</b><small>Se lo llevamos a la casa</small></span>
          </button>
          <button type="button" class="venta-tipo-b" data-tipo="presencial" role="radio" aria-checked="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9.5 20v-5h5v5"/></svg>
            <span><b>Retira en sucursal</b><small>El cliente pasa a buscarlo</small></span>
          </button>
          <input type="hidden" name="tipo" value="despacho">
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

        <div id="ventaEnvio">
          <p class="venta-sec">Despacho</p>
          <div class="venta-g2">
            <div class="venta-f venta-ancho"><span>Comuna · Región de Valparaíso</span>
              ${desplegable('comuna', comunas.map(c => ({ valor:c.nombre, texto:c.nombre, extra:c.costo, nota:fmt(c.costo) })), 'Elige la comuna')}
            </div>
            <div class="venta-f"><span>Costo de despacho</span>
              <p class="venta-fijo" id="ventaDespacho">
                Elige la comuna
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
              </p>
              <input type="hidden" name="despacho" value="0">
            </div>
          </div>
        </div>

        <div id="ventaRetiro" hidden>
          <p class="venta-sec">Dónde retira</p>
          <div class="venta-g2">
            <div class="venta-f venta-ancho"><span>Sucursal</span>
              ${desplegable('sucursal', sucursales.filter(s => s.activa).map(s => ({
                valor:s.id, texto:s.nombre, nota:[s.direccion, s.comuna].filter(Boolean).join(', '),
              })), sucursales.some(s => s.activa) ? 'Elige la sucursal' : 'Todavía no hay sucursales', '', true)}
            </div>
          </div>
          <p class="venta-nota-caja">El pedido va a aparecer en la caja de esa sucursal. Al guardar te damos un código de 4 dígitos: dáselo al cliente para que lo retire más rápido.</p>
        </div>

        <p class="venta-sec">Datos del cliente</p>
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Nombre y apellido</span>
            <input type="text" name="cliente" required placeholder="Ej: María Pérez">
          </label>
          <label class="venta-f"><span>Teléfono</span>
            ${campoTel('name="telefono" required')}
          </label>
          <label class="venta-f"><span>Correo (opcional)</span>
            <input type="email" name="email" placeholder="cliente@correo.cl">
          </label>
          <div class="venta-f venta-ancho"><span>Método de pago</span>
            ${desplegable('pago', ['Transferencia','Efectivo'].map(v => ({ valor:v, texto:v })), 'Elige el método')}
          </div>
          <label class="venta-f venta-ancho" id="ventaDir"><span>Dirección de entrega</span>
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

    const presencial = () => f.tipo.value === 'presencial';
    const total = () => {
      const n = +f.cantidad.value || 0, p = +f.precio.value || 0;
      const d = presencial() ? 0 : (+f.despacho.value || 0);
      ov.querySelector('#ventaTotal').textContent = fmt(n * p + d);
    };
    conectarDesplegables(ov, (campo, valor, extra) => {
      if (campo !== 'comuna') return;
      f.despacho.value = extra || 0;
      ov.querySelector('#ventaDespacho').childNodes[0].nodeValue = fmt(extra || 0) + ' ';
      total();
    });

    // Retirar en sucursal no lleva comuna, dirección ni costo de envío.
    ov.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => {
      f.tipo.value = b.dataset.tipo;
      ov.querySelectorAll('[data-tipo]').forEach(x => {
        const activa = x === b;
        x.classList.toggle('activa', activa);
        x.setAttribute('aria-checked', String(activa));
      });
      ov.querySelector('#ventaEnvio').hidden = presencial();
      ov.querySelector('#ventaRetiro').hidden = !presencial();
      ov.querySelector('#ventaDir').hidden = presencial();
      f.direccion.required = !presencial();
      total();
    }));

    f.cantidad.addEventListener('input', total);
    total();

    f.addEventListener('submit', e => { e.preventDefault(); guardar(ov, f, prod, cerrar); });
  }

  async function guardar(ov, f, prod, cerrar){
    const btn = ov.querySelector('.venta-btn');
    const msg = ov.querySelector('#ventaMsg');
    const cantidad = +f.cantidad.value || 1;
    const precio = +f.precio.value || 0;
    const presencial = f.tipo.value === 'presencial';
    const despacho = presencial ? 0 : (+f.despacho.value || 0);

    msg.textContent = ''; msg.className = 'venta-msg';
    const falla = t => { msg.className = 'venta-msg err'; msg.textContent = t; };
    if (presencial && !f.sucursal.value) return falla('Elige en qué sucursal lo retira el cliente.');
    if (!presencial && !f.comuna.value) return falla('Elige la comuna de despacho.');
    // En la caja buscan al cliente por su nombre: sin eso no hay cómo
    // reconocer el pedido cuando llega.
    if (presencial && !f.cliente.value.trim()) return falla('Escribe el nombre del cliente: con eso lo buscan en la caja.');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const { data: creada, error } = await sb.from('ventas').insert({
      vendedor_id: perfil.id,
      vendedor_nombre: perfil.nombre || perfil.email,
      producto_slug: prod.slug,
      producto_nombre: prod.name,
      cantidad, precio_unitario: precio,
      tipo: presencial ? 'presencial' : 'despacho',
      sucursal_id: presencial ? f.sucursal.value : null,
      comuna: presencial ? '' : f.comuna.value,
      costo_despacho: despacho,
      total: cantidad * precio + despacho,
      cliente_nombre: f.cliente.value.trim(),
      cliente_telefono: telGuardar(f.telefono.value),
      cliente_email: f.email.value.trim(),
      cliente_direccion: presencial ? '' : f.direccion.value.trim(),
      metodo_pago: f.pago.value,
      notas: f.notas.value.trim(),
    }).select('id,codigo_retiro').single();

    if (error) {
      btn.disabled = false; btn.textContent = 'Registrar venta';
      msg.className = 'venta-msg err';
      msg.textContent = 'No se pudo registrar: ' + error.message;
      return;
    }
    btn.textContent = 'Venta registrada';
    // El despacho avisa por correo con la etiqueta; el retiro en sucursal no
    // la necesita, porque el pedido ya está en la caja que corresponde.
    if (presencial) { mostrarCodigo(creada, f.cliente.value.trim(), cerrar); return; }
    if (creada && creada.id) avisarPorCorreo(creada.id);
    setTimeout(cerrar, 700);
  }

  // El código es lo único que el vendedor tiene que pasarle al cliente, así
  // que ocupa toda la pantalla y no se pierde entre los otros datos.
  function mostrarCodigo(venta, cliente, cerrar){
    const codigo = (venta && venta.codigo_retiro) || '';
    const { ov } = panel('Pedido listo para retirar', 'Retiro en sucursal', `
      <div class="venta-codigo">
        <span>Código de retiro</span>
        <b>${esc(codigo || '—')}</b>
        <p>Dáselo a ${esc(cliente || 'tu cliente')}. En la caja lo escriben y aparece este pedido al tiro.
           Si lo pierde, igual lo encuentran por su nombre o por el tuyo.</p>
      </div>`, '<button type="button" class="venta-btn" data-acc="cerrar">Entendido</button>');
    ov.addEventListener('click', e => { if (e.target.closest('[data-acc=cerrar]')) cerrar(); });
  }

  // El aviso al dueño va aparte y sin esperarlo: la venta ya quedó guardada,
  // así que un problema con el correo no tiene por qué frenar al vendedor.
  async function avisarPorCorreo(id){
    try {
      const { data:{ session } } = await sb.auth.getSession();
      if (!session) return;
      await fetch('/api/aviso-venta', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ id }),
      });
    } catch (e) {
      console.warn('No se pudo avisar por correo:', e);
    }
  }

  /* ── Mis ventas ───────────────────────────────────────── */
  // Mismo calendario que ve el administrador, pero solo con lo suyo y sin la
  // ganancia del negocio: el vendedor ve lo que vendió y lo que le toca.
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
  const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  const claveMes = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const claveDia = d => claveMes(d) + '-' + String(d.getDate()).padStart(2, '0');
  const ICO_CAJA = '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>';
  const ICO_MONEDA = '<ellipse cx="12" cy="7" rx="7.5" ry="3"/><path d="M4.5 7v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V7"/><path d="M4.5 12v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/>';
  const ICO_PERSONA = '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>';
  const ICO_CAL = '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>';
  const svgIco = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

  async function abrirMisVentas(){
    const { ov } = panel('Mis ventas', 'Historial', '<p class="venta-vacio">Cargando…</p>', '', true);
    const box = ov.querySelector('.venta-body');

    await cargarSucursales();
    const { data, error } = await sb.from('ventas')
      .select('*').eq('vendedor_id', perfil.id).order('created_at', { ascending:false }).limit(500);
    if (error) { box.innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(error.message) + '</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="venta-vacio">Todavía no registraste ninguna venta. Abre un producto y toca Agregar pedido.</p>'; return; }

    let mesVisto = claveMes(new Date(data[0].created_at));
    let diaVisto = null;
    pintarMes();

    function correrMes(pasos){
      const [a, m] = mesVisto.split('-').map(Number);
      mesVisto = claveMes(new Date(a, m - 1 + pasos, 1));
      diaVisto = null;
    }

    function pintarMes(){
      const lista = data.filter(v => claveMes(new Date(v.created_at)) === mesVisto);
      const ok = lista.filter(v => estadoDe(v) === 'aceptado');
      const porRetirar = lista.filter(v => esRetiro(v) && v.entrega === 'por_retirar').length;
      const pendientes = lista.filter(v => estadoDe(v) === 'pendiente' && !esRetiro(v)).length;
      const unidades = ok.reduce((a, v) => a + (v.cantidad || 1), 0);
      const vendido = ok.reduce((a, v) => a + (v.total || 0), 0);
      const comision = ok.reduce((a, v) => a + comisionDe(v), 0);

      const [anio, mes] = mesVisto.split('-').map(Number);
      const dias = new Date(anio, mes, 0).getDate();
      const corrimiento = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
      const hoy = claveDia(new Date());

      const porDia = {};
      lista.forEach(v => {
        const k = claveDia(new Date(v.created_at));
        (porDia[k] = porDia[k] || []).push(v);
      });
      if (!diaVisto || !diaVisto.startsWith(mesVisto)) {
        const con = Object.keys(porDia).sort();
        diaVisto = con.length ? con[con.length - 1] : null;
      }

      const previo = new Date(anio, mes - 1, 0).getDate();
      const celdas = [];
      for (let i = corrimiento; i > 0; i--) celdas.push('<div class="ev-dia fuera"><span class="ev-dia-n">' + (previo - i + 1) + '</span></div>');
      for (let d = 1; d <= dias; d++) {
        const k = mesVisto + '-' + String(d).padStart(2, '0');
        const delDia = porDia[k] || [];
        const pend = delDia.some(v => estadoDe(v) === 'pendiente');
        const paga = delDia.filter(v => estadoDe(v) === 'aceptado').reduce((a, v) => a + comisionDe(v), 0);
        celdas.push(
          '<button type="button" class="ev-dia' + (delDia.length ? ' con' : '') + (k === hoy ? ' hoy' : '') + (k === diaVisto ? ' elegido' : '') + '" data-dia="' + k + '">' +
            '<span class="ev-dia-n">' + d + '</span>' +
            (pend ? '<span class="ev-dia-pend"></span>' : '') +
            (delDia.length ? '<span class="ev-dia-c">' + delDia.length + ' venta' + (delDia.length === 1 ? '' : 's') + '</span>' : '') +
            (paga ? '<span class="ev-dia-p">' + fmt(paga) + '</span>' : '') +
          '</button>');
      }
      const sobran = (7 - (celdas.length % 7)) % 7;
      for (let i = 1; i <= sobran; i++) celdas.push('<div class="ev-dia fuera"><span class="ev-dia-n">' + i + '</span></div>');

      box.innerHTML = `
        <div class="ev-tabs">
          <div class="ev-filtros">
            <div class="ev-filtro">
              <span>Mes</span>
              ${desplegable('mes', MESES.map((n, k) => ({
                valor: anio + '-' + String(k + 1).padStart(2, '0'), texto: n,
              })), 'Elige el mes', mesVisto, false, ICO_CAL)}
            </div>
            ${pendientes ? `<span class="ev-aviso-pend">${pendientes} esperando aprobación</span>` : ''}
            ${porRetirar ? `<span class="ev-aviso-pend retiro">${porRetirar} esperando retiro en sucursal</span>` : ''}
          </div>
        </div>

        <div class="venta-wrap">
          <div class="ev-resumen">
            <div class="vt2">
              <span class="vt2-ico">${svgIco(ICO_CAJA)}</span>
              <div><span>Productos vendidos</span><b>${unidades}</b></div>
            </div>
            <div class="vt2">
              <span class="vt2-ico">${svgIco(ICO_MONEDA)}</span>
              <div><span>Vendido</span><b>${fmt(vendido)}</b></div>
            </div>
            <div class="vt2 destacada">
              <span class="vt2-ico">${svgIco(ICO_PERSONA)}</span>
              <div><span>Te deben pagar</span><b>${fmt(comision)}</b></div>
            </div>
          </div>

          <div class="ev-columnas">
            <section class="ev-cal">
              <header class="ev-cal-top">
                <h3>${MESES[mes - 1]} ${anio}</h3>
                <div class="ev-cal-nav">
                  <button type="button" class="ev-flecha" id="mvAntes" aria-label="Mes anterior">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
                  </button>
                  <button type="button" class="ev-hoy" id="mvHoy">Hoy</button>
                  <button type="button" class="ev-flecha" id="mvDespues" aria-label="Mes siguiente">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                  </button>
                </div>
              </header>
              <div class="ev-cal-cab">${DIAS.map(d => '<span>' + d + '</span>').join('')}</div>
              <div class="ev-cal-grilla">${celdas.join('')}</div>
              <footer class="ev-leyenda">
                <span><i class="lg-pend"></i>Esperando aprobación</span>
                <span><i class="lg-con"></i>Con ventas</span>
                <span><i class="lg-sel"></i>Día seleccionado</span>
                <span><i class="lg-sin"></i>Sin ventas</span>
              </footer>
            </section>

            <section class="ev-detalle" id="mvDia"></section>
          </div>
        </div>`;

      conectarDesplegables(box, (campo, valor) => {
        if (campo !== 'mes') return;
        mesVisto = valor; diaVisto = null; pintarMes();
      });
      box.querySelector('#mvAntes').addEventListener('click', () => { correrMes(-1); pintarMes(); });
      box.querySelector('#mvDespues').addEventListener('click', () => { correrMes(1); pintarMes(); });
      box.querySelector('#mvHoy').addEventListener('click', () => {
        mesVisto = claveMes(new Date()); diaVisto = claveDia(new Date()); pintarMes();
      });
      box.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
        diaVisto = b.dataset.dia; pintarMes();
      }));

      pintarDia(porDia);
    }

    function pintarDia(porDia){
      const caja = box.querySelector('#mvDia');
      if (!diaVisto) {
        caja.innerHTML = '<div class="ev-det-vacio">' + svgIco(ICO_CAL) + '<p>Este mes todavía no tiene ventas tuyas.</p></div>';
        return;
      }
      const delDia = porDia[diaVisto] || [];
      const [, m, d] = diaVisto.split('-').map(Number);
      const pend = delDia.filter(v => estadoDe(v) === 'pendiente').length;

      caja.innerHTML = `
        <header class="ev-det-cab">
          <div>
            <h3>${d} de ${MESES[m - 1]}</h3>
            <small>${delDia.length ? delDia.length + ' pedido' + (delDia.length === 1 ? '' : 's') + ' registrado' + (delDia.length === 1 ? '' : 's') : 'Sin ventas este día'}</small>
          </div>
          ${pend ? `<span class="ev-chip-pend"><i></i>${pend} esperando aprobación</span>` : ''}
        </header>
        <div class="ev-det-cuerpo">
          ${delDia.length ? delDia.map(tarjetaMia).join('')
            : '<div class="ev-det-vacio">' + svgIco(ICO_CAL) + '<p>No registraste ninguna venta este día.</p></div>'}
        </div>`;
    }

    function tarjetaMia(v){
      const estado = estadoDe(v);
      const retiro = esRetiro(v);
      const sello = retiro && v.entrega === 'por_retirar' ? 'Por retirar'
                  : retiro && v.entrega === 'no_retirado' ? 'No retirado'
                  : estado === 'pendiente' ? 'Esperando aprobación'
                  : estado === 'aceptado'  ? 'Aceptada' : 'Denegada';
      const donde = retiro
        ? marcaRetiro(v)
        : `<small>${esc(v.cliente_direccion)}, ${esc(v.comuna)}</small>`;
      return `
        <article class="ev-venta ${estado}">
          <div class="ev-venta-top">
            <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
            <div class="ev-venta-datos">
              <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
              <small>${esc(v.cliente_nombre)} · ${waChip(v.cliente_telefono, 'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.', v.cliente_nombre)}</small>
              ${donde}
              <small>${esc(v.metodo_pago)} · ${new Date(v.created_at).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</small>
            </div>
            <span class="ev-sello ${estado}">${sello}</span>
          </div>

          <div class="ev-cifras tres">
            <div><span>Producto${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</span><b>${fmt((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
            <div><span>${retiro ? 'Retiro' : 'Despacho'}</span><b>${retiro ? 'Sin costo' : fmt(v.costo_despacho)}</b></div>
            <div class="pagar"><span>Tu comisión</span><b>${estado === 'aceptado' ? fmt(comisionDe(v)) : '—'}</b></div>
          </div>

          ${retiro && v.entrega === 'por_retirar'
            ? '<p class="ev-motivo espera">La comisión se suma cuando el cliente retira el producto en la sucursal.</p>' : ''}
          ${estado === 'denegado' && v.motivo ? `<p class="ev-motivo">${esc(v.motivo)}</p>` : ''}
        </article>`;
    }
  }

  /* ── WhatsApp ─────────────────────────────────────────── */
  // Un teléfono suelto no sirve de nada: aquí siempre se puede tocar para
  // escribir. Vive en Sesion porque lo usan la tienda y los módulos de
  // edición, y una sola versión evita que los números se armen distinto.
  const WA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5 5 16.3a7.8 7.8 0 1 1 3 3z"/><path d="M9.2 9c-.3 1.6 1.2 3.6 2.3 4.5s2.5 1.5 3.6 1.2l.6-1.4-1.9-1-.8.8a5.6 5.6 0 0 1-2-2l.9-.8-1-1.9z" fill="currentColor" stroke="none"/></svg>';

  /* ── Teléfonos ────────────────────────────────────────── */
  // El +56 va pegado al campo y no se escribe: así nadie lo olvida ni lo
  // pone dos veces, y todos los números quedan guardados igual.
  function campoTel(attrs, valor){
    return `<span class="tel-campo">
      <span class="tel-pais">+56</span>
      <input type="tel" inputmode="tel" ${attrs} value="${esc(telLocal(valor))}" placeholder="9 1234 5678">
    </span>`;
  }

  // Saca el +56 de lo que esté guardado, para mostrar solo la parte local.
  function telLocal(tel){
    const n = String(tel || '').replace(/\D/g, '');
    if (!n) return '';
    const s = n.startsWith('56') ? n.slice(2) : n;
    return s.length === 9 ? s.replace(/^(\d)(\d{4})(\d{4})$/, '$1 $2 $3') : s;
  }

  // Lo que se guarda: siempre con el país adelante.
  function telGuardar(valor){
    const n = String(valor || '').replace(/\D/g, '');
    if (!n) return '';
    return '+56 ' + telLocal(n);
  }

  // WhatsApp quiere el número sin signos y con código de país.
  function wasap(tel, texto){
    let n = String(tel || '').replace(/\D/g, '');
    if (!n) return '';
    if (n.length === 9 && n.charAt(0) === '9') n = '56' + n;
    else if (n.length === 8) n = '569' + n;
    return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  // El globito verde más el número al lado. Si el teléfono no sirve,
  // devuelve el texto pelado y no un botón roto.
  function waChip(tel, texto, quien){
    const limpio = String(tel || '').replace(/\D/g, '');
    if (limpio.length < 8) return esc(tel || '—');
    return `<a class="wa-chip" href="${esc(wasap(tel, texto))}" target="_blank" rel="noopener"` +
      ` aria-label="Escribirle por WhatsApp${quien ? ' a ' + esc(quien) : ''}"` +
      ` onclick="event.stopPropagation()">${WA_SVG}<span>${esc(tel)}</span></a>`;
  }

  return {
    init, ficha,
    // El chasis de paneles y el desplegable propio los reusan los módulos de
    // edición: una sola implementación, cero CSS repetido.
    panel, desplegable, conectarDesplegables,
    wasap, waChip, campoTel, telGuardar, telLocal,
    perfil: () => perfil,
    esAdmin: () => !!perfil && perfil.rol === 'admin',
    // La caja y el panel del administrador comparten el mismo catálogo de
    // sucursales: una sola lectura y un solo nombre para cada una.
    cargarSucursales, sucursales: () => sucursales,
    nombreSucursal, roles: ROLES,
  };
})();

document.addEventListener('DOMContentLoaded', () => Sesion.init().catch(e => console.error('Sesion:', e)));
