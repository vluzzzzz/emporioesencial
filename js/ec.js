// ec
'use strict';
/* ============================================================================
 *  EdLocal — el botón VENTA LOCAL de la barra.
 *
 *  Lo usa el moderador que atiende el mostrador. El cliente llega, dice de
 *  parte de qué vendedor viene, y el moderador arma el pedido con el catálogo
 *  y se lo acredita a ese vendedor. Ya está pagado y ya está entregado: la
 *  comisión se paga al instante, sin aprobación de nadie.
 *
 *  El administrador abre el mismo panel, pero elige en qué sucursal fue.
 *
 *  Esto es comodidad, no seguridad: RLS solo le deja cargar ventas de su
 *  propia sucursal, el disparador relee los precios del catálogo y el
 *  moderador no puede editar una venta ya cargada, solo anularla.
 * ========================================================================== */
const EdLocal = (() => {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const hora = d => new Date(d).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });

  const sb = window.sb;
  let perfil = null, vendedores = [], ventas = [], boton = null;
  let pestana = 'nueva', ticket = [], busqueda = '', alCambiar = null;
  let toast = m => console.log(m), mensajeError = e => String(e && e.message || e), confirmarFn = null;

  const ICO = {
    tienda: '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9.5 20v-5h5v5"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    persona: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    caja: '<path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5z"/><path d="m3 8.5 9 5 9-5M12 13.5v7"/>',
    moneda: '<ellipse cx="12" cy="7" rx="7.5" ry="3"/><path d="M4.5 7v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V7"/><path d="M4.5 12v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    tacho: '<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.5 6.5l.9 13a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-13"/><path d="M10.3 10.5v6.5M13.7 10.5v6.5"/>',
    vacio: '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9 14h6"/>',
  };
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  // La misma escala que usan el panel del vendedor y la base. La que manda
  // sigue siendo supabase/pedidos-comisiones.sql.
  const comisionUnidad = precio => {
    const p = Number(precio) || 0;
    if (p <= 0) return 0;
    if (p <= 10500) return 1300;
    if (p <= 22500) return 1800;
    if (p <= 32500) return 2300;
    return 2800;
  };
  const comisionDe = v => v.comision > 0 ? v.comision : (v.cantidad || 1) * comisionUnidad(v.precio_unitario);

  const catalogo = () => (typeof CATALOGO !== 'undefined' ? CATALOGO : []);
  const precioDe = slug => {
    const t = (typeof PRICE_TIERS !== 'undefined' && PRICE_TIERS[slug]) || [];
    return t.length ? t[0].price : 0;
  };
  const esAdmin = () => !!perfil && perfil.rol === 'admin';

  // Sin tildes ni mayúsculas: "jose" encuentra a "José".
  const limpio = t => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ── Entrada ──────────────────────────────────────────── */
  // El administrador no necesita un botón más en la barra: abre este mismo
  // panel desde Vendedores → Ventas. Solo deja el perfil listo.
  function usar(p){ perfil = p; }

  function montarBoton(p){
    perfil = p;
    const izq = document.querySelector('.nav-left');
    if (!izq || izq.querySelector('.nav-local-btn')) return;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'nav-local-btn';
    boton.innerHTML = `${svg(ICO.tienda)}<span>Venta local</span>`;
    boton.addEventListener('click', () => abrir());
    izq.appendChild(boton);
  }

  async function cargar(){
    await Sesion.cargarSucursales();
    const [p, v] = await Promise.all([
      sb.from('profiles').select('id,nombre,email,rol,activo')
        .eq('rol', 'vendedor').eq('activo', true),
      sb.from('ventas').select('*').eq('tipo', 'local')
        .order('created_at', { ascending:false }).limit(500),
    ]);
    if (p.error) throw p.error;
    if (v.error) throw v.error;
    vendedores = p.data || [];
    ventas = v.data || [];
  }

  // `alCambiar` lo manda el panel del administrador: cuando se carga o se
  // anula una venta desde aquí, sus totales de atrás quedan viejos.
  async function abrir(cambio){
    alCambiar = typeof cambio === 'function' ? cambio : null;
    if (typeof EdUtil !== 'undefined') {
      toast = EdUtil.toast; mensajeError = EdUtil.mensajeError; confirmarFn = EdUtil.confirmar;
    }
    const donde = esAdmin() ? 'Todas las sucursales' : Sesion.nombreSucursal(perfil.sucursal_id);

    const { ov } = Sesion.panel('Venta local', donde,
      `<div class="ev-tabs">
         <button type="button" class="ev-tab activa" data-p="nueva">Nueva venta</button>
         <button type="button" class="ev-tab" data-p="historial">Historial</button>
       </div>
       <div class="venta-wrap" id="elCuerpo"><p class="venta-vacio">Cargando…</p></div>`,
      '', true);

    ov.querySelectorAll('.ev-tab').forEach(t => t.addEventListener('click', () => {
      ov.querySelectorAll('.ev-tab').forEach(x => x.classList.toggle('activa', x === t));
      pestana = t.dataset.p;
      pintar(ov);
    }));

    try { await cargar(); } catch (err) {
      ov.querySelector('#elCuerpo').innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(mensajeError(err)) + '</p>';
      return;
    }
    pestana = 'nueva';
    ticket = [];
    busqueda = '';
    pintar(ov);
  }

  function pintar(ov){
    const box = ov.querySelector('#elCuerpo');
    if (pestana === 'nueva') return pintarNueva(ov, box);
    return pintarHistorial(ov, box);
  }

  /* ── Nueva venta ──────────────────────────────────────── */
  function pintarNueva(ov, box){
    box.innerHTML = `
      <div class="el-columnas">
        <section class="el-catalogo">
          <header class="el-cat-top">
            <h3>Catálogo</h3>
            <label class="ev-buscador el-buscador">
              ${svg(ICO.lupa)}
              <input type="search" id="elBuscar" placeholder="Buscar producto" autocomplete="off">
            </label>
          </header>
          <div class="el-grilla" id="elGrilla"></div>
        </section>

        <section class="el-ticket">
          <h3>El pedido</h3>
          <div id="elLineas"></div>

          <div class="el-datos">
            <div class="venta-f"><span>De parte de <i class="req">obligatorio</i></span>
              ${Sesion.desplegable('vendedor', vendedores.map(v => ({
                valor: v.id, texto: v.nombre || v.email,
              })), vendedores.length ? 'Busca al vendedor' : 'No hay vendedores activos', '', true, ICO.persona)}
            </div>
            ${esAdmin() ? `<div class="venta-f"><span>Sucursal <i class="req">obligatorio</i></span>
              ${Sesion.desplegable('sucursal', Sesion.sucursales().filter(s => s.activa).map(s => ({
                valor: s.id, texto: s.nombre,
              })), 'Elige la sucursal', '', true, ICO.tienda)}
            </div>` : ''}
            <div class="venta-f"><span>Forma de pago</span>
              ${Sesion.desplegable('pago', ['Efectivo','Transferencia'].map(v => ({ valor:v, texto:v })), 'Elige el método', 'Efectivo')}
            </div>
            <label class="venta-f"><span>Cliente (opcional)</span>
              <input type="text" id="elCliente" placeholder="Nombre de quien compró">
            </label>
          </div>

          <div class="el-pie" id="elPie"></div>
          <p class="venta-msg" id="elMsg"></p>
        </section>
      </div>`;

    const buscador = box.querySelector('#elBuscar');
    buscador.value = busqueda;
    buscador.addEventListener('input', e => { busqueda = e.target.value; pintarGrilla(box); });

    Sesion.conectarDesplegables(box.querySelector('.el-datos'), () => pintarPie(ov, box));

    pintarGrilla(box);
    pintarLineas(ov, box);
  }

  function pintarGrilla(box){
    const q = limpio(busqueda.trim());
    const vistos = catalogo().filter(p => !q ||
      [p.name, p.slug, p.desc].some(c => limpio(c).includes(q)));
    const grilla = box.querySelector('#elGrilla');

    if (!vistos.length) {
      grilla.innerHTML = `<div class="ev-det-vacio">${svg(ICO.vacio)}<p>Ningún producto coincide con esa búsqueda.</p></div>`;
      return;
    }

    grilla.innerHTML = vistos.map(p => {
      const agotado = p.inStock === false || p.stock === 0;
      const puestas = (ticket.find(l => l.slug === p.slug) || {}).qty || 0;
      return `
        <button type="button" class="el-prod${agotado ? ' agotado' : ''}" data-add="${esc(p.slug)}"${agotado ? ' disabled' : ''}>
          <img src="${esc(p.image)}" alt="" onerror="this.style.visibility='hidden'">
          <span class="el-prod-txt">
            <b>${esc(p.name)}</b>
            <small>${plata(precioDe(p.slug))}${p.stock != null ? ' · ' + p.stock + ' en stock' : ''}</small>
          </span>
          ${puestas ? `<span class="el-prod-n">${puestas}</span>` : ''}
          ${agotado ? '<span class="el-prod-ago">Agotado</span>' : ''}
        </button>`;
    }).join('');

    grilla.querySelectorAll('[data-add]').forEach(b =>
      b.addEventListener('click', () => sumar(box, b.dataset.add)));
  }

  function sumar(box, slug){
    const p = catalogo().find(x => x.slug === slug);
    if (!p) return;
    const linea = ticket.find(l => l.slug === slug);
    const tope = p.stock == null ? Infinity : p.stock;
    if (linea) {
      if (linea.qty >= tope) { toast('No queda más stock de ' + p.name, true); return; }
      linea.qty++;
    } else {
      ticket.push({ slug, nombre: p.name, image: p.image, precio: precioDe(slug), qty: 1, tope });
    }
    repintarTicket(box);
  }

  function repintarTicket(box){
    const ov = box.closest('.venta-ov');
    pintarGrilla(box);
    pintarLineas(ov, box);
  }

  function pintarLineas(ov, box){
    const caja = box.querySelector('#elLineas');
    if (!ticket.length) {
      caja.innerHTML = `<div class="ev-det-vacio el-vacio">${svg(ICO.caja)}<p>Toca los productos del catálogo para armar el pedido.</p></div>`;
      pintarPie(ov, box);
      return;
    }

    caja.innerHTML = `<div class="el-lineas">${ticket.map((l, i) => `
      <div class="el-linea" data-i="${i}">
        <img src="${esc(l.image)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="el-linea-txt">
          <b>${esc(l.nombre)}</b>
          <small>${plata(l.precio)} por unidad</small>
        </div>
        <div class="el-cant">
          <button type="button" data-paso="-1" aria-label="Quitar una">−</button>
          <b>${l.qty}</b>
          <button type="button" data-paso="1" aria-label="Sumar una">+</button>
        </div>
        <span class="el-linea-sub">${plata(l.precio * l.qty)}</span>
        <button type="button" class="el-linea-x" data-quitar aria-label="Sacar del pedido">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>`).join('')}</div>`;

    caja.querySelectorAll('[data-paso]').forEach(b => b.addEventListener('click', () => {
      const l = ticket[+b.closest('.el-linea').dataset.i];
      const paso = +b.dataset.paso;
      if (paso > 0 && l.qty >= l.tope) { toast('No queda más stock de ' + l.nombre, true); return; }
      l.qty += paso;
      if (l.qty < 1) ticket.splice(ticket.indexOf(l), 1);
      repintarTicket(box);
    }));
    caja.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
      ticket.splice(+b.closest('.el-linea').dataset.i, 1);
      repintarTicket(box);
    }));

    pintarPie(ov, box);
  }

  // El moderador ve lo que va a cobrar y lo que va a acreditar antes de
  // guardar: una vez cargada, la venta solo se puede anular.
  function pintarPie(ov, box){
    const total = ticket.reduce((a, l) => a + l.precio * l.qty, 0);
    const comision = ticket.reduce((a, l) => a + l.qty * comisionUnidad(l.precio), 0);
    const unidades = ticket.reduce((a, l) => a + l.qty, 0);
    const datos = box.querySelector('.el-datos');
    const vendedor = datos.querySelector('[name=vendedor]').value;
    const sucursal = esAdmin() ? datos.querySelector('[name=sucursal]').value : perfil.sucursal_id;
    const listo = ticket.length > 0 && vendedor && sucursal;

    box.querySelector('#elPie').innerHTML = `
      <div class="el-cuentas">
        <div><span>Unidades</span><b>${unidades}</b></div>
        <div class="el-cobrar"><span>Cobrar al cliente</span><b>${plata(total)}</b></div>
        <div class="el-comision"><span>Comisión del vendedor</span><b>${plata(comision)}</b></div>
      </div>
      <button type="button" class="venta-btn" id="elGuardar"${listo ? '' : ' disabled'}>Registrar venta</button>`;

    box.querySelector('#elGuardar').addEventListener('click', e => guardar(ov, box, e.target));
  }

  async function guardar(ov, box, btn){
    const datos = box.querySelector('.el-datos');
    const msg = box.querySelector('#elMsg');
    const vendedorId = datos.querySelector('[name=vendedor]').value;
    const sucursalId = esAdmin() ? datos.querySelector('[name=sucursal]').value : perfil.sucursal_id;
    const vendedor = vendedores.find(v => v.id === vendedorId);

    msg.className = 'venta-msg';
    const falla = t => { msg.className = 'venta-msg err'; msg.textContent = t; };
    if (!ticket.length) return falla('Agrega al menos un producto.');
    if (!vendedor) return falla('Elige de parte de qué vendedor viene el cliente.');
    if (!sucursalId) return falla('Elige la sucursal.');

    btn.disabled = true; btn.textContent = 'Guardando…';
    const ticketId = crypto.randomUUID();
    const cliente = box.querySelector('#elCliente').value.trim();
    const pago = datos.querySelector('[name=pago]').value || 'Efectivo';

    const filas = ticket.map(l => ({
      ticket_id: ticketId,
      vendedor_id: vendedor.id,
      vendedor_nombre: vendedor.nombre || vendedor.email,
      vendido_por: perfil.id,
      tipo: 'local',
      sucursal_id: sucursalId,
      producto_slug: l.slug,
      producto_nombre: l.nombre,
      cantidad: l.qty,
      precio_unitario: l.precio,
      costo_despacho: 0,
      total: l.precio * l.qty,
      comuna: '',
      cliente_nombre: cliente,
      cliente_direccion: '',
      metodo_pago: pago,
    }));

    const { error } = await sb.from('ventas').insert(filas);
    if (error) {
      btn.disabled = false; btn.textContent = 'Registrar venta';
      return falla(mensajeError(error));
    }

    const comision = ticket.reduce((a, l) => a + l.qty * comisionUnidad(l.precio), 0);
    const slugs = ticket.map(l => l.slug);
    ticket = [];
    busqueda = '';
    await cargar();
    await Promise.all(slugs.map(refrescarStock));
    pintar(ov);
    if (alCambiar) alCambiar();
    toast(plata(comision) + ' de comisión para ' + (vendedor.nombre || vendedor.email));
  }

  // La base descuenta el stock sola. Aquí se vuelve a leer el producto para
  // que la tienda abierta muestre el número nuevo.
  async function refrescarStock(slug){
    if (!slug || typeof aplicarProducto !== 'function') return;
    try {
      const { data } = await sb.from('products')
        .select('*, price_tiers(qty,price,active)').eq('slug', slug).maybeSingle();
      if (!data) return;
      aplicarProducto(data);
      if (typeof Filas !== 'undefined') Filas.init();
      if (typeof CatPage !== 'undefined' && CatPage.estaAbierta()) CatPage.abrir(CatPage.catActual());
      if (typeof Trust !== 'undefined') Trust.decorarTarjetas();
    } catch (_) {}
  }

  /* ── Historial ────────────────────────────────────────── */
  // Mismo calendario que ve el administrador, pero solo con las ventas
  // locales: el moderador necesita ver sus entregas día por día.
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
  const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  const claveMes = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const claveDia = d => claveMes(d) + '-' + String(d.getDate()).padStart(2, '0');
  let mesVisto = claveMes(new Date()), diaVisto = null;

  // Las líneas de un mismo pedido viajan sueltas en la base; aquí se vuelven
  // a juntar para mostrarlas como la venta que fueron.
  function porTicket(lista){
    const mapa = new Map();
    lista.forEach(v => {
      const k = v.ticket_id || v.id;
      if (!mapa.has(k)) mapa.set(k, { id:k, cuando:v.created_at, venta:v, lineas:[] });
      mapa.get(k).lineas.push(v);
    });
    return [...mapa.values()].map(t => ({
      ...t,
      total: t.lineas.reduce((a, v) => a + (v.total || 0), 0),
      comision: t.lineas.reduce((a, v) => a + comisionDe(v), 0),
      unidades: t.lineas.reduce((a, v) => a + (v.cantidad || 1), 0),
    })).sort((a, b) => new Date(b.cuando) - new Date(a.cuando));
  }

  function pintarHistorial(ov, box){
    const delMes = ventas.filter(v => claveMes(new Date(v.created_at)) === mesVisto);
    const tickets = porTicket(delMes);

    const [anio, mes] = mesVisto.split('-').map(Number);
    const dias = new Date(anio, mes, 0).getDate();
    const corrimiento = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
    const hoy = claveDia(new Date());

    const porDia = {};
    tickets.forEach(t => {
      const k = claveDia(new Date(t.cuando));
      (porDia[k] = porDia[k] || []).push(t);
    });
    if (!diaVisto || !diaVisto.startsWith(mesVisto)) {
      const con = Object.keys(porDia).sort();
      diaVisto = con.length ? con[con.length - 1] : null;
    }

    const previo = new Date(anio, mes - 1, 0).getDate();
    const celdas = [];
    for (let i = corrimiento; i > 0; i--) celdas.push(`<div class="ev-dia fuera"><span class="ev-dia-n">${previo - i + 1}</span></div>`);
    for (let d = 1; d <= dias; d++) {
      const k = mesVisto + '-' + String(d).padStart(2, '0');
      const delDia = porDia[k] || [];
      const plataDia = delDia.reduce((a, t) => a + t.total, 0);
      celdas.push(`
        <button type="button" class="ev-dia${delDia.length ? ' con' : ''}${k === hoy ? ' hoy' : ''}${k === diaVisto ? ' elegido' : ''}" data-dia="${k}">
          <span class="ev-dia-n">${d}</span>
          ${delDia.length ? `<span class="ev-dia-c">${delDia.length} venta${delDia.length === 1 ? '' : 's'}</span>` : ''}
          ${plataDia ? `<span class="ev-dia-p">${plata(plataDia)}</span>` : ''}
        </button>`);
    }
    const sobran = (7 - (celdas.length % 7)) % 7;
    for (let i = 1; i <= sobran; i++) celdas.push(`<div class="ev-dia fuera"><span class="ev-dia-n">${i}</span></div>`);

    box.innerHTML = `
      <div class="ev-resumen">
        <div class="vt2">
          <span class="vt2-ico">${svg(ICO.caja)}</span>
          <div><span>Ventas del mes</span><b>${tickets.length}</b></div>
        </div>
        <div class="vt2 destacada">
          <span class="vt2-ico">${svg(ICO.moneda)}</span>
          <div><span>Cobrado</span><b>${plata(tickets.reduce((a, t) => a + t.total, 0))}</b></div>
        </div>
        <div class="vt2">
          <span class="vt2-ico">${svg(ICO.persona)}</span>
          <div><span>Comisiones dadas</span><b>${plata(tickets.reduce((a, t) => a + t.comision, 0))}</b></div>
        </div>
      </div>

      <div class="ev-columnas">
        <section class="ev-cal">
          <header class="ev-cal-top">
            <h3>${MESES[mes - 1]} ${anio}</h3>
            <div class="ev-cal-nav">
              <button type="button" class="ev-flecha" id="elAntes" aria-label="Mes anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
              </button>
              <button type="button" class="ev-hoy" id="elHoy">Hoy</button>
              <button type="button" class="ev-flecha" id="elDespues" aria-label="Mes siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            </div>
          </header>
          <div class="ev-cal-cab">${DIAS.map(d => '<span>' + d + '</span>').join('')}</div>
          <div class="ev-cal-grilla">${celdas.join('')}</div>
        </section>

        <section class="ev-detalle" id="elDia"></section>
      </div>`;

    box.querySelector('#elAntes').addEventListener('click', () => { correrMes(-1); pintarHistorial(ov, box); });
    box.querySelector('#elDespues').addEventListener('click', () => { correrMes(1); pintarHistorial(ov, box); });
    box.querySelector('#elHoy').addEventListener('click', () => {
      mesVisto = claveMes(new Date()); diaVisto = claveDia(new Date()); pintarHistorial(ov, box);
    });
    box.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
      diaVisto = b.dataset.dia; pintarHistorial(ov, box);
    }));

    pintarDia(ov, box, porDia);
  }

  function correrMes(pasos){
    const [a, m] = mesVisto.split('-').map(Number);
    mesVisto = claveMes(new Date(a, m - 1 + pasos, 1));
    diaVisto = null;
  }

  function pintarDia(ov, box, porDia){
    const caja = box.querySelector('#elDia');
    if (!diaVisto) {
      caja.innerHTML = `<div class="ev-det-vacio">${svg(ICO.calendario)}<p>Este mes todavía no tiene ventas locales.</p></div>`;
      return;
    }
    const delDia = porDia[diaVisto] || [];
    const [, m, d] = diaVisto.split('-').map(Number);

    caja.innerHTML = `
      <header class="ev-det-cab">
        <div>
          <h3>${d} de ${MESES[m - 1]}</h3>
          <small>${delDia.length ? delDia.length + ' venta' + (delDia.length === 1 ? '' : 's') : 'Sin ventas este día'}</small>
        </div>
      </header>
      <div class="ev-det-cuerpo">
        ${delDia.length ? delDia.map(tarjeta).join('')
          : `<div class="ev-det-vacio">${svg(ICO.calendario)}<p>No se registró ninguna venta local este día.</p></div>`}
      </div>`;

    caja.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', () => {
      const t = delDia.find(x => x.id === b.dataset.anular);
      if (t) anular(ov, box, t);
    }));
  }

  function tarjeta(t){
    const v = t.venta;
    // Anular borra el ticket entero. Solo quien lo cargó puede hacerlo, así
    // que al resto el botón ni le aparece.
    const mio = esAdmin() || v.vendido_por === perfil.id;
    return `
      <article class="ev-venta el-ticket-card">
        <div class="el-ticket-top">
          <div>
            <small>De parte de</small>
            <b>${esc(v.vendedor_nombre || 'Sin vendedor')}</b>
          </div>
          <span class="el-ticket-hora">${hora(t.cuando)}</span>
        </div>

        <div class="el-ticket-lineas">
          ${t.lineas.map(l => `
            <div class="el-ticket-l">
              <span>${esc(l.producto_nombre)}${l.cantidad > 1 ? ' × ' + l.cantidad : ''}</span>
              <b>${plata(l.total)}</b>
            </div>`).join('')}
        </div>

        <div class="ev-cifras tres">
          <div><span>Unidades</span><b>${t.unidades}</b></div>
          <div class="pagar"><span>Cobrado</span><b>${plata(t.total)}</b></div>
          <div><span>Comisión</span><b>${plata(t.comision)}</b></div>
        </div>

        <div class="el-ticket-pie">
          <small>${esc(v.cliente_nombre || 'Sin nombre de cliente')} · ${esc(v.metodo_pago || '')}${esAdmin() ? ' · ' + esc(Sesion.nombreSucursal(v.sucursal_id)) : ''}</small>
          ${mio ? `<button type="button" class="ev-borrar" data-anular="${esc(t.id)}">${svg(ICO.tacho)}Anular venta</button>` : ''}
        </div>
      </article>`;
  }

  async function anular(ov, box, t){
    const ficha = `
      <div class="ev-previo">
        <span>Se le quita la comisión a ${esc(t.venta.vendedor_nombre || 'el vendedor')}</span>
        <p>${t.lineas.map(l => esc(l.producto_nombre) + (l.cantidad > 1 ? ' × ' + l.cantidad : '')).join(', ')}.
           ${plata(t.total)} cobrados y ${plata(t.comision)} de comisión. El stock vuelve al catálogo.</p>
      </div>`;

    const ok = await confirmarFn(
      '¿Seguro que quieres anular esta venta? Se borra para siempre y no se puede deshacer.',
      'Anular venta', 5, ficha);
    if (!ok) return;

    try {
      const ids = t.lineas.map(l => l.id);
      const { error } = await sb.from('ventas').delete().in('id', ids);
      if (error) throw error;
      const slugs = [...new Set(t.lineas.map(l => l.producto_slug))];
      await cargar();
      await Promise.all(slugs.map(refrescarStock));
      pintar(ov);
      if (alCambiar) alCambiar();
      toast('Venta anulada');
    } catch (err) {
      toast(mensajeError(err), true);
    }
  }

  return { montarBoton, usar, abrir };
})();
