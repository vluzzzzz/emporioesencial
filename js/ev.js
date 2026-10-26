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
  const hora = d => new Date(d).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });

  const sb = window.sb;
  let usuarios = [], ventas = [], comunas = [], sucursales = [], pestana = 'ventas';
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
    b.addEventListener('click', () => abrir());
    izq.appendChild(b);

    // El botón "Revisar pedido" del correo trae ?pedido=... en la dirección.
    const pedido = new URLSearchParams(location.search).get('pedido');
    if (pedido) {
      history.replaceState(null, '', location.pathname);
      abrir(pedido);
    }
  }

  const fotoDe = slug => (CATALOGO.find(p => p.slug === slug) || {}).image || '';

  // El teléfono vive en el perfil, no en la venta: la venta solo guarda el
  // nombre con que se registró.
  function vendedorDe(v){
    const u = usuarios.find(x => x.id === v.vendedor_id) || {};
    return {
      nombre: u.nombre || v.vendedor_nombre || u.email || 'Sin nombre',
      telefono: u.telefono || 'Sin teléfono',
    };
  }

  // La base descuenta el stock sola al aceptar un pedido. Aquí se vuelve a leer
  // ese producto para que la tienda abierta muestre el número nuevo.
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
      if (typeof Edicion !== 'undefined') Edicion.remontar();
    } catch (_) {}
  }

  async function cargar(){
    const [u, v, c, s] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending:false }),
      sb.from('ventas').select('*').order('created_at', { ascending:false }).limit(500),
      sb.from('comunas').select('*').order('position'),
      sb.from('sucursales').select('*').order('position'),
    ]);
    // La cuenta técnica entra como admin pero no se muestra en el equipo.
    // La regla de RLS ya la esconde; esto es por si alguna vez llega igual.
    usuarios = (u.data || []).filter(x => !x.oculto);
    ventas = v.data || [];
    comunas = c.data || [];
    sucursales = s.data || [];
  }

  const ROLES = { admin:'Administrador', moderador:'Moderador de caja', vendedor:'Vendedor' };
  const rolDe = u => ROLES[u.rol] || 'Vendedor';
  // La venta local la carga el moderador en el mostrador y ya viene aceptada;
  // el delivery lo registra el vendedor y espera aprobación.
  const esLocal = v => v.tipo === 'local';
  const sucursalDe = id => (sucursales.find(s => s.id === id) || {}).nombre || 'Sucursal';
  const quienCargo = v => (usuarios.find(u => u.id === v.vendido_por) || {}).nombre || 'La caja';



  /* ── Panel ────────────────────────────────────────────── */
  // `verPedidoId` viene del link del correo: abre el panel ya parado en el
  // día de ese pedido y con su ficha arriba.
  async function abrir(verPedidoId){
    if (typeof EdUtil !== 'undefined') {
      toast = EdUtil.toast; mensajeError = EdUtil.mensajeError; confirmarFn = EdUtil.confirmar;
    }
    const { ov } = Sesion.panel('Vendedores', 'Equipo y ventas',
      `<div class="ev-tabs">
         <button type="button" class="ev-tab activa" data-p="ventas">Ventas</button>
         <button type="button" class="ev-tab" data-p="equipo">Equipo</button>
         <button type="button" class="ev-tab" data-p="despacho">Despacho</button>
         <div class="ev-filtros" id="evFiltros"></div>
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

    const buscado = verPedidoId && ventas.find(v => String(v.id) === String(verPedidoId));
    if (buscado) {
      const d = new Date(buscado.created_at);
      mesVisto = clave(d);
      diaVisto = claveDia(d);
      vendedorVisto = '';
    }
    pintar(ov);
    if (buscado) verPedido(ov.querySelector('#evCuerpo'), buscado.id);
    else if (verPedidoId) toast('Ese pedido ya no está');
  }

  function pintar(ov){
    const box = ov.querySelector('#evCuerpo');
    const filtros = ov.querySelector('#evFiltros');
    if (filtros) filtros.innerHTML = '';
    if (pestana === 'ventas')   return pintarVentas(box);
    if (pestana === 'equipo')   return pintarEquipo(ov, box);
    if (pestana === 'despacho') return pintarDespacho(ov, box);
  }

  /* ── Comisión del vendedor ────────────────────────────── */
  // Lo que se le paga por unidad, según cuánto cuesta el producto. La misma
  // escala está en supabase/pedidos-comisiones.sql, que es la que manda.
  const TRAMOS = [
    { hasta: 10500, paga: 1300 },
    { hasta: 22500, paga: 1800 },
    { hasta: 32500, paga: 2300 },
    { hasta: Infinity, paga: 2800 },
  ];
  const comisionUnidad = precio => {
    const p = Number(precio) || 0;
    if (p <= 0) return 0;
    return (TRAMOS.find(t => p <= t.hasta) || TRAMOS[TRAMOS.length - 1]).paga;
  };
  // La venta puede traerla calculada de la base; si no, se saca aquí.
  const comisionDe = v => v.comision != null && v.comision > 0
    ? v.comision
    : (v.cantidad || 1) * comisionUnidad(v.precio_unitario);

  const estadoDe = v => v.estado || 'aceptado';
  const cuentaParaPago = v => estadoDe(v) === 'aceptado';

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
  const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  const clave = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const claveDia = d => clave(d) + '-' + String(d.getDate()).padStart(2, '0');

  /* ── Ventas: calendario del mes ───────────────────────── */
  let mesVisto = clave(new Date());
  let diaVisto = null;
  let vendedorVisto = '';
  let tipoVisto = '';

  function correrMes(pasos){
    const [a, m] = mesVisto.split('-').map(Number);
    const d = new Date(a, m - 1 + pasos, 1);
    mesVisto = clave(d);
    diaVisto = null;
  }



  function delMes(c){
    return ventas.filter(v => clave(new Date(v.created_at)) === c
      && (!vendedorVisto || v.vendedor_id === vendedorVisto)
      && (!tipoVisto || (tipoVisto === 'local') === esLocal(v)));
  }

  const ICO = {
    pedidos: '<path d="M3 4h2l2.3 11.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
    caja: '<path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5z"/><path d="m3 8.5 9 5 9-5M12 13.5v7"/>',
    moneda: '<ellipse cx="12" cy="7" rx="7.5" ry="3"/><path d="M4.5 7v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V7"/><path d="M4.5 12v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/>',
    persona: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    ok: '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.2 2.5 2.5 4.7-5"/>',
    no: '<circle cx="12" cy="12" r="8.6"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    rever: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3.5V7h-3.5"/>',
    tacho: '<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.5 6.5l.9 13a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-13"/><path d="M10.3 10.5v6.5M13.7 10.5v6.5"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    tienda: '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9.5 20v-5h5v5"/>',
    camion: '<path d="M3 7.5h10.5v8H3z"/><path d="M13.5 10.5H18l3 3v2h-7.5z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    wasap: '<path d="M3.5 20.5 5 16.3a7.8 7.8 0 1 1 3 3z"/><path d="M9.2 9c-.3 1.6 1.2 3.6 2.3 4.5s2.5 1.5 3.6 1.2l.6-1.4-1.9-1-.8.8a5.6 5.6 0 0 1-2-2l.9-.8-1-1.9z" fill="currentColor" stroke="none"/>',
  };
  const svg = (d, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  function cuentas(c){
    const ok = delMes(c).filter(cuentaParaPago);
    return {
      pedidos: ok.length,
      unidades: ok.reduce((a, v) => a + (v.cantidad || 1), 0),
      productos: ok.reduce((a, v) => a + (v.precio_unitario || 0) * (v.cantidad || 1), 0),
      envios: ok.reduce((a, v) => a + (v.costo_despacho || 0), 0),
      comision: ok.reduce((a, v) => a + comisionDe(v), 0),
    };
  }

  // Lo que hay que transferirle a cada uno a fin de mes, con las dos
  // comisiones por separado: se ganan distinto, pero se pagan juntas.
  function paraPagar(c){
    const ok = delMes(c).filter(cuentaParaPago);
    const mapa = new Map();
    ok.forEach(v => {
      const fila = mapa.get(v.vendedor_id) || {
        id: v.vendedor_id,
        nombre: (usuarios.find(u => u.id === v.vendedor_id) || {}).nombre || v.vendedor_nombre || 'Sin nombre',
        local: 0, delivery: 0, ventas: 0,
      };
      fila[esLocal(v) ? 'local' : 'delivery'] += comisionDe(v);
      fila.ventas++;
      mapa.set(v.vendedor_id, fila);
    });
    return [...mapa.values()]
      .map(f => ({ ...f, total: f.local + f.delivery }))
      .sort((a, b) => b.total - a.total);
  }

  /* ── Ventas: resumen, calendario y detalle del día ────── */
  function pintarVentas(box){
    const lista = delMes(mesVisto);
    const resumen = cuentas(mesVisto);
    const pendientes = lista.filter(v => estadoDe(v) === 'pendiente');

    const [anio, mes] = mesVisto.split('-').map(Number);
    const dias = new Date(anio, mes, 0).getDate();
    const corrimiento = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
    const hoy = claveDia(new Date());

    const porDia = {};
    lista.forEach(v => {
      const k = claveDia(new Date(v.created_at));
      (porDia[k] = porDia[k] || []).push(v);
    });
    // Si no hay día elegido, se abre el último con ventas.
    if (!diaVisto || !diaVisto.startsWith(mesVisto)) {
      const conVenta = Object.keys(porDia).sort();
      diaVisto = conVenta.length ? conVenta[conVenta.length - 1] : null;
    }

    // Los días del mes de al lado completan la cuadrícula.
    const previo = new Date(anio, mes - 1, 0).getDate();
    const celdas = [];
    for (let i = corrimiento; i > 0; i--) celdas.push(`<div class="ev-dia fuera"><span class="ev-dia-n">${previo - i + 1}</span></div>`);
    for (let d = 1; d <= dias; d++) {
      const k = mesVisto + '-' + String(d).padStart(2, '0');
      const delDia = porDia[k] || [];
      const pend = delDia.some(v => estadoDe(v) === 'pendiente');
      const gan = delDia.filter(cuentaParaPago)
        .reduce((a, v) => a + (v.precio_unitario || 0) * (v.cantidad || 1), 0);
      celdas.push(`
        <button type="button" class="ev-dia${delDia.length ? ' con' : ''}${k === hoy ? ' hoy' : ''}${k === diaVisto ? ' elegido' : ''}" data-dia="${k}">
          <span class="ev-dia-n">${d}</span>
          ${pend ? '<span class="ev-dia-pend"></span>' : ''}
          ${delDia.length ? `<span class="ev-dia-c">${delDia.length} venta${delDia.length === 1 ? '' : 's'}</span>` : ''}
          ${gan ? `<span class="ev-dia-p">${plata(gan)}</span>` : ''}
        </button>`);
    }
    const sobran = (7 - (celdas.length % 7)) % 7;
    for (let i = 1; i <= sobran; i++) celdas.push(`<div class="ev-dia fuera"><span class="ev-dia-n">${i}</span></div>`);

    const filtros = box.parentNode && box.parentNode.querySelector('#evFiltros');
    if (filtros) filtros.innerHTML = `
      <div class="ev-filtro">
        <span>Mes</span>
        ${Sesion.desplegable('mes', MESES.map((n, k) => ({
          valor: anio + '-' + String(k + 1).padStart(2, '0'), texto: n,
        })), 'Elige el mes', mesVisto, false, ICO.calendario)}
      </div>
      <div class="ev-filtro">
        <span>Vendedor</span>
        ${Sesion.desplegable('quien', [{ valor:'', texto:'Todo el equipo' }].concat(
          usuarios.filter(u => u.rol === 'vendedor' || ventas.some(v => v.vendedor_id === u.id))
                  .map(u => ({ valor:u.id, texto:u.nombre || u.email }))),
          'Todo el equipo', vendedorVisto, true, ICO.persona)}
      </div>
      <div class="ev-filtro">
        <span>Tipo</span>
        ${Sesion.desplegable('tipo', [
          { valor:'', texto:'Local y delivery' },
          { valor:'local', texto:'Venta local', nota:'En la sucursal' },
          { valor:'delivery', texto:'Venta delivery', nota:'A domicilio' },
        ], 'Local y delivery', tipoVisto, false, ICO.tienda)}
      </div>
      ${pendientes.length ? `<span class="ev-aviso-pend">${pendientes.length} por aprobar este mes</span>` : ''}
      <button type="button" class="ed-btn ev-nueva-local" id="evNuevaLocal">${svg(ICO.tienda)}Nueva venta local</button>`;

    box.innerHTML = `
      <div class="ev-resumen">
        <div class="vt2">
          <span class="vt2-ico">${svg(ICO.caja)}</span>
          <div><span>Productos vendidos</span><b>${resumen.unidades}</b></div>
        </div>
        <div class="vt2 destacada">
          <span class="vt2-ico">${svg(ICO.moneda)}</span>
          <div><span>Total negocio</span><b>${plata(resumen.productos)}</b></div>
        </div>
        <div class="vt2">
          <span class="vt2-ico">${svg(ICO.persona)}</span>
          <div><span>Pagar al vendedor</span><b>${plata(resumen.comision)}</b></div>
        </div>
      </div>

      <div class="ev-columnas">
        <section class="ev-cal">
          <header class="ev-cal-top">
            <h3>${MESES[mes - 1]} ${anio}</h3>
            <div class="ev-cal-nav">
              <button type="button" class="ev-flecha" id="evAntes" aria-label="Mes anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
              </button>
              <button type="button" class="ev-hoy" id="evHoy">Hoy</button>
              <button type="button" class="ev-flecha" id="evDespues" aria-label="Mes siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            </div>
          </header>
          <div class="ev-cal-cab">${DIAS.map(d => '<span>' + d + '</span>').join('')}</div>
          <div class="ev-cal-grilla">${celdas.join('')}</div>
          <footer class="ev-leyenda">
            <span><i class="lg-pend"></i>Pendiente de comisión</span>
            <span><i class="lg-con"></i>Con ventas</span>
            <span><i class="lg-sel"></i>Día seleccionado</span>
            <span><i class="lg-sin"></i>Sin ventas</span>
          </footer>
        </section>

        <section class="ev-detalle" id="evDia"></section>
      </div>

      ${tablaPagos(mesVisto)}`;

    if (filtros) Sesion.conectarDesplegables(filtros, (campo, valor) => {
      if (campo === 'mes') mesVisto = valor;
      if (campo === 'quien') vendedorVisto = valor;
      if (campo === 'tipo') tipoVisto = valor;
      diaVisto = null;
      pintarVentas(box);
    });
    // El mismo panel del moderador, pero el administrador elige la sucursal.
    const nueva = filtros && filtros.querySelector('#evNuevaLocal');
    if (nueva) nueva.addEventListener('click', () => {
      if (typeof EdLocal === 'undefined') return;
      EdLocal.abrir(async () => { await cargar(); pintarVentas(box); });
    });
    box.querySelector('#evAntes').addEventListener('click', () => { correrMes(-1); pintarVentas(box); });
    box.querySelector('#evDespues').addEventListener('click', () => { correrMes(1); pintarVentas(box); });
    box.querySelector('#evHoy').addEventListener('click', () => {
      mesVisto = clave(new Date()); diaVisto = claveDia(new Date()); pintarVentas(box);
    });
    box.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
      diaVisto = b.dataset.dia; pintarVentas(box);
    }));

    pintarDia(box, porDia);
  }

  function tablaPagos(c){
    const filas = paraPagar(c);
    if (!filas.length) return '';
    const suma = k => filas.reduce((a, f) => a + f[k], 0);
    return `
      <section class="ev-pagos">
        <header class="ev-pagos-cab">
          <h3>Para transferir este mes</h3>
          <small>Solo cuenta lo aceptado. Las ventas locales ya están aprobadas; las de delivery, cuando las aceptas.</small>
        </header>
        <div class="ev-pagos-tabla">
          <div class="ev-pagos-f cab">
            <span>Vendedor</span><span>Local</span><span>Delivery</span><span>Total a pagar</span>
          </div>
          ${filas.map(f => `
            <div class="ev-pagos-f">
              <span class="ev-pagos-n">${esc(f.nombre)}<small>${f.ventas} venta${f.ventas === 1 ? '' : 's'}</small></span>
              <span>${plata(f.local)}</span>
              <span>${plata(f.delivery)}</span>
              <span class="ev-pagos-t">${plata(f.total)}</span>
            </div>`).join('')}
          ${filas.length > 1 ? `
            <div class="ev-pagos-f suma">
              <span>Todo el equipo</span>
              <span>${plata(suma('local'))}</span>
              <span>${plata(suma('delivery'))}</span>
              <span class="ev-pagos-t">${plata(suma('total'))}</span>
            </div>` : ''}
        </div>
      </section>`;
  }

  function pintarDia(box, porDia){
    const caja = box.querySelector('#evDia');
    if (!diaVisto) {
      caja.innerHTML = `<div class="ev-det-vacio">${svg(ICO.calendario)}<p>Este mes todavía no tiene ventas.</p></div>`;
      return;
    }
    const delDia = porDia[diaVisto] || [];
    const [a, m, d] = diaVisto.split('-').map(Number);
    const pend = delDia.filter(v => estadoDe(v) === 'pendiente').length;


    caja.innerHTML = `
      <header class="ev-det-cab">
        <div>
          <h3>${d} de ${MESES[m - 1]}</h3>
          <small>${delDia.length ? delDia.length + ' pedido' + (delDia.length === 1 ? '' : 's') + ' registrado' + (delDia.length === 1 ? '' : 's') : 'Sin ventas este día'}</small>
        </div>
        ${pend ? `<span class="ev-chip-pend"><i></i>${pend} pendiente${pend === 1 ? '' : 's'} de comisión</span>` : ''}
      </header>

      <div class="ev-det-cuerpo">
        ${delDia.length ? agrupar(delDia).map(tarjetaVenta).join('')
          : `<div class="ev-det-vacio">${svg(ICO.calendario)}<p>No se registró ninguna venta este día.</p></div>`}

      </div>`;

    caja.querySelectorAll('[data-resolver]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      resolver(box, b.dataset.resolver, b.dataset.como);
    }));
    caja.querySelectorAll('[data-ver]').forEach(t => t.addEventListener('click', () =>
      verPedido(box, t.dataset.ver)));
  }

  // La ficha completa del pedido. Desde aquí el administrador puede cambiar
  // de opinión, esté aceptado o denegado.
  function verPedido(box, id){
    const v = ventas.find(x => String(x.id) === String(id));
    if (!v) return;
    const estado = estadoDe(v);
    const linea = (t, d) => `<div class="ev-datos-l"><span>${t}</span><b>${esc(d || '—')}</b></div>`;
    // Todo teléfono se puede tocar para escribir por WhatsApp.
    const telLinea = (t, tel, msg, quien) =>
      `<div class="ev-datos-l"><span>${t}</span><b>${Sesion.waChip(tel, msg, quien)}</b></div>`;

    const lineas = hermanas(v);
    const varias = lineas.length > 1;
    const totalT = lineas.reduce((a, l) => a + (l.total || 0), 0);
    const comT = lineas.reduce((a, l) => a + comisionDe(l), 0);
    const ganaT = lineas.reduce((a, l) => a + (l.precio_unitario || 0) * (l.cantidad || 1), 0);

    const cuerpo = `
      <div class="ev-resumen-pedido">
        <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <b>${varias ? lineas.length + ' productos' : esc(v.producto_nombre) + (v.cantidad > 1 ? ' × ' + v.cantidad : '')}</b>
          <small>${varias ? lineas.reduce((a, l) => a + (l.cantidad || 1), 0) + ' unidades' : plata(v.precio_unitario) + ' por unidad · ' + (v.cantidad || 1) + ' unidad' + ((v.cantidad || 1) === 1 ? '' : 'es')}</small>
          <small>${cuando(v.created_at)} · ${hora(v.created_at)}</small>
        </div>
        <span class="ev-sello ${estado}">${estado === 'pendiente' ? 'Pendiente' : estado === 'aceptado' ? 'Aceptada' : 'Denegado'}</span>
      </div>

      ${varias ? `<div class="ev-ticket-lineas">${lineas.map(l =>
        `<div class="ev-ticket-l"><span>${esc(l.producto_nombre)}${l.cantidad > 1 ? ' × ' + l.cantidad : ''}</span><b>${plata(l.total)}</b></div>`
      ).join('')}</div>` : ''}

      <p class="venta-sec">${esLocal(v) ? 'Quién se lo llevó' : 'A quién se lo enviamos'}</p>
      <div class="ev-datos">
        ${linea('Cliente', v.cliente_nombre)}
        ${telLinea('Teléfono', v.cliente_telefono,
          'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.',
          v.cliente_nombre)}
        ${v.cliente_email ? linea('Correo', v.cliente_email) : ''}
        ${esLocal(v) ? `
          ${linea('Sucursal', sucursalDe(v.sucursal_id))}
          ${linea('La cargó', quienCargo(v))}`
        : `
          ${linea('Dirección', v.cliente_direccion)}
          ${linea('Comuna', v.comuna)}`}
      </div>

      <p class="venta-sec">Quién lo vendió</p>
      <div class="ev-datos">
        ${linea('Vendedor', vendedorDe(v).nombre)}
        ${telLinea('Teléfono', vendedorDe(v).telefono,
          'Hola ' + vendedorDe(v).nombre + ', te escribo por el pedido de ' + v.producto_nombre +
          ' para ' + (v.cliente_nombre || 'el cliente') + '.', vendedorDe(v).nombre)}
        ${linea('Forma de pago', v.metodo_pago)}
        ${v.notas ? linea('Notas del vendedor', v.notas) : ''}
      </div>

      <p class="venta-sec">Total</p>
      <div class="ev-datos">
        ${linea('Cobrado al cliente', plata(totalT))}
        <div class="ev-datos-l verde"><span>Ganancia del negocio</span><b>${plata(ganaT)}</b></div>
        ${esLocal(v) ? linea('Venta local', 'Sin despacho') : linea('Despacho', plata(v.costo_despacho))}
        <div class="ev-datos-l total"><span>Pagar al vendedor</span><b>${estado === 'denegado' ? '—' : plata(comT)}</b></div>
      </div>

      ${v.motivo ? `<div class="ev-previo">
        <span>${estado === 'denegado' ? 'Se denegó por' : 'Nota del administrador'}</span>
        <p>${esc(v.motivo)}</p>
      </div>` : ''}`;

    const pie = `
      <div class="ev-pie">
        <div class="ev-resolver" style="margin:0;width:100%">
          ${estado === 'pendiente' ? `
            <button type="button" class="ev-ok" data-ir="aceptado">${svg(ICO.ok)}Aceptar comisión</button>
            <button type="button" class="ev-no" data-ir="denegado">${svg(ICO.no)}Denegar pedido</button>`
          : `<button type="button" class="ev-rever" data-ir="${estado === 'denegado' ? 'aceptado' : 'denegado'}">${svg(ICO.rever)}${estado === 'denegado' ? 'Revisar y aceptar' : 'Revisar y denegar'}</button>`}
        </div>
        <button type="button" class="ev-borrar" id="evBorrar">${svg(ICO.tacho)}Eliminar pedido</button>
      </div>`;

    const { ov, cerrar } = Sesion.panel('Pedido', cuando(v.created_at), cuerpo, pie);
    ov.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => {
      cerrar();
      resolver(box, v.id, b.dataset.ir);
    }));
    ov.querySelector('#evBorrar').addEventListener('click', () => borrarPedido(box, v, cerrar));
  }



  // Borrar es definitivo: avisa, y el botón recién se habilita a los 5
  // segundos para que nadie se lleve un pedido por delante de un clic.
  async function borrarPedido(box, v, cerrar){
    const ficha = `
      <div class="ev-resumen-pedido">
        <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
          <small>${plata(v.precio_unitario)} por unidad · ${v.cantidad || 1} unidad${(v.cantidad || 1) === 1 ? '' : 'es'}</small>
          <small>${cuando(v.created_at)} · ${hora(v.created_at)}</small>
        </div>
      </div>
      <p class="ev-conf-venta">Venta de: <b>${esc(vendedorDe(v).nombre)}</b></p>`;

    const ok = await confirmarFn(
      '¿Seguro que quieres eliminar este pedido? Se borra para siempre y no se puede deshacer.',
      'Eliminar pedido', 5, ficha);
    if (!ok) return;
    try {
      const lineas = hermanas(v);
      const ids = lineas.map(l => l.id);
      const { error } = await sb.from('ventas').delete().in('id', ids);
      if (error) throw error;
      ventas = ventas.filter(x => !ids.includes(x.id));
      await Promise.all([...new Set(lineas.map(l => l.producto_slug))].map(refrescarStock));
      cerrar();
      pintarVentas(box);
      toast(lineas.length > 1 ? 'Venta eliminada, con sus ' + lineas.length + ' productos' : 'Pedido eliminado');
    } catch (err) {
      toast(mensajeError(err));
    }
  }


  // Una venta local con varios productos son varias filas con el mismo
  // ticket. Aquí se vuelven a juntar para mostrarlas como la venta que
  // fueron; los totales del mes se siguen sacando de las filas sueltas.
  function agrupar(lista){
    const vistos = new Map(), salida = [];
    lista.forEach(v => {
      if (!v.ticket_id) { salida.push(v); return; }
      const ya = vistos.get(v.ticket_id);
      if (!ya) {
        const cabeza = { ...v, lineas: [v] };
        vistos.set(v.ticket_id, cabeza);
        salida.push(cabeza);
        return;
      }
      ya.lineas.push(v);
      ya.total += v.total || 0;
      ya.cantidad += v.cantidad || 0;
    });
    return salida;
  }

  // Las otras filas del mismo ticket, para cuando hay que mostrarlas o
  // borrarlas todas juntas. Un delivery siempre viaja solo.
  const hermanas = v => v.ticket_id
    ? ventas.filter(x => x.ticket_id === v.ticket_id)
    : [v];

  const comisionTicket = v => (v.lineas || [v]).reduce((a, l) => a + comisionDe(l), 0);
  const productosTicket = v => (v.lineas || [v])
    .reduce((a, l) => a + (l.precio_unitario || 0) * (l.cantidad || 1), 0);

  // La línea que dice de qué tipo fue la venta.
  function marcaTipo(v){
    return esLocal(v)
      ? `<small class="ev-retiro local">${svg(ICO.tienda)}Venta local · ${esc(sucursalDe(v.sucursal_id))}</small>`
      : `<small class="ev-retiro">${svg(ICO.camion)}Venta delivery · ${esc(v.cliente_direccion || 'Sin dirección')}, ${esc(v.comuna)}</small>`;
  }

  function tarjetaVenta(v){
    const estado = estadoDe(v);
    const com = comisionTicket(v);
    const varias = v.lineas && v.lineas.length > 1;
    const titulo = varias
      ? v.lineas.length + ' productos · ' + v.cantidad + ' unidades'
      : esc(v.producto_nombre) + (v.cantidad > 1 ? ' × ' + v.cantidad : '');
    const cliente = esLocal(v)
      ? `<small>${esc(v.cliente_nombre || 'Cliente del mostrador')}</small>`
      : `<small>${esc(v.cliente_nombre)} · ${Sesion.waChip(v.cliente_telefono, 'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.', v.cliente_nombre)}</small>`;
    return `
      <article class="ev-venta ${estado}" data-ver="${esc(v.id)}" title="Clic para ver el pedido completo">
        <div class="ev-venta-top">
          <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="ev-venta-datos">
            <b>${titulo}</b>
            ${cliente}
            ${marcaTipo(v)}
            <small>${esc(v.metodo_pago)} · ${esc(v.vendedor_nombre)} · ${hora(v.created_at)}</small>
          </div>
          <span class="ev-sello ${estado}">${estado === 'pendiente' ? 'Pendiente' : estado === 'aceptado' ? 'Aceptada' : 'Denegado'}</span>
        </div>

        ${varias ? `<div class="ev-ticket-lineas">${v.lineas.map(l =>
          `<div class="ev-ticket-l"><span>${esc(l.producto_nombre)}${l.cantidad > 1 ? ' × ' + l.cantidad : ''}</span><b>${plata(l.total)}</b></div>`
        ).join('')}</div>` : ''}

        <div class="ev-cifras">
          <div><span>Cobrado</span><b>${plata(v.total)}</b></div>
          <div class="gana"><span>Ganancia</span><b>${plata(productosTicket(v))}</b></div>
          <div><span>${esLocal(v) ? 'Local' : 'Envío'}</span><b>${esLocal(v) ? 'Sin costo' : plata(v.costo_despacho)}</b></div>
          <div class="pagar"><span>A pagar</span><b>${estado === 'denegado' ? '—' : plata(com)}</b></div>
        </div>

        ${estado === 'pendiente' ? `
          <div class="ev-resolver">
            <button type="button" class="ev-ok" data-resolver="${esc(v.id)}" data-como="aceptado">${svg(ICO.ok)}Aceptar comisión</button>
            <button type="button" class="ev-no" data-resolver="${esc(v.id)}" data-como="denegado">${svg(ICO.no)}Denegar pedido</button>
          </div>` : (v.motivo ? `<p class="ev-motivo">${esc(v.motivo)}</p>` : '')}
      </article>`;
  }

  function resolver(box, id, como){
    const v = ventas.find(x => String(x.id) === String(id));
    if (!v) return;
    const acepta = como === 'aceptado';
    const previo = estadoDe(v);
    const rever = previo !== 'pendiente';

    const cuerpo = `
      <form id="evResolver">
        <div class="ev-resumen-pedido">
          <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
          <div>
            <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
            <small>${esc(v.cliente_nombre)} · ${esc(v.comuna)}</small>
            <small>${esc(v.vendedor_nombre)} · ${cuando(v.created_at)}</small>
          </div>
        </div>
        <div class="ev-datos" style="margin-top:16px">
          <div class="ev-datos-l"><span>Cobrado al cliente</span><b>${plata(v.total)}</b></div>
          <div class="ev-datos-l verde"><span>Ganancia del negocio</span><b>${plata((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
          <div class="ev-datos-l"><span>Despacho</span><b>${plata(v.costo_despacho)}</b></div>
          <div class="ev-datos-l total"><span>Pagar al vendedor</span><b>${plata(comisionDe(v))}</b></div>
        </div>
        ${rever && v.motivo ? `<div class="ev-previo">
          <span>${previo === 'denegado' ? 'Se había denegado por' : 'Nota anterior'}</span>
          <p>${esc(v.motivo)}</p>
        </div>` : ''}
        <label class="venta-f venta-ancho" style="margin-top:18px"><span>Observación${acepta ? ' (opcional)' : ''}</span>
          <textarea name="motivo" rows="3" placeholder="${acepta ? 'Alguna nota sobre este pedido' : 'Por qué se deniega: no llegó, el cliente se arrepintió…'}">${esc(previo === como ? (v.motivo || '') : '')}</textarea>
        </label>
        <p class="venta-msg" id="evResMsg"></p>
      </form>`;

    const pie = `<button type="submit" form="evResolver" class="venta-btn${acepta ? '' : ' peligro'}">${acepta ? 'Aceptar comisión' : 'Denegar pedido'}</button>`;
    const { ov, cerrar } = Sesion.panel(
      acepta ? 'Aceptar comisión' : 'Denegar pedido',
      (rever ? 'Revisión · pedido de ' : 'Pedido de ') + (v.vendedor_nombre || 'el vendedor'),
      cuerpo, pie);
    const f = ov.querySelector('#evResolver');
    f.motivo.focus();

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('button[type=submit]');
      const msg = ov.querySelector('#evResMsg');
      const motivo = f.motivo.value.trim();
      if (!acepta && !motivo) {
        msg.className = 'venta-msg err';
        msg.textContent = 'Escribe por qué se deniega, para que el vendedor sepa.';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const { error } = await sb.from('ventas')
          .update({ estado: como, motivo, resuelto_en: new Date().toISOString() })
          .eq('id', v.id);
        if (error) throw error;
        v.estado = como; v.motivo = motivo;
        await refrescarStock(v.producto_slug);
        cerrar();
        pintarVentas(box);
        toast(acepta ? 'Comisión aceptada' : 'Pedido denegado');
      } catch (err) {
        btn.disabled = false; btn.textContent = acepta ? 'Aceptar comisión' : 'Denegar pedido';
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  /* ── Equipo ───────────────────────────────────────────── */
  // Una sucursal apagada ya no se ofrece, salvo que sea la que esa persona
  // ya tiene: si no, editarla la movería de local sin querer.
  function selectorSucursal(nombre, elegido){
    const lista = sucursales.filter(s => s.activa || s.id === elegido);
    return Sesion.desplegable(nombre, lista.map(s => ({
      valor: s.id, texto: s.nombre,
      nota: [s.direccion, s.comuna].filter(Boolean).join(', '),
    })), lista.length ? 'Elige la sucursal' : 'Crea una sucursal en Despacho', elegido, true, ICO.tienda);
  }

  function pintarEquipo(ov, box){
    box.innerHTML = `
      <div class="ev-nuevo" id="evNuevo">
        <p class="venta-sec" style="margin-top:0">Persona nueva</p>
        <div class="venta-g2">
          <label class="venta-f"><span>Nombre y apellido <i class="req">obligatorio</i></span><input type="text" id="nvNombre" placeholder="Ej: Camila Soto" required></label>
          <label class="venta-f"><span>Correo <i class="req">obligatorio</i></span><input type="email" id="nvEmail" placeholder="vendedor@correo.cl" required></label>
          <label class="venta-f"><span>Teléfono <i class="req">obligatorio</i></span>${Sesion.campoTel('id="nvTel" required')}</label>
          <label class="venta-f"><span>Contraseña provisoria <i class="req">obligatorio</i></span><input type="text" id="nvClave" placeholder="Mínimo 8 caracteres" required></label>
          <div class="venta-f"><span>Rol</span>
            ${Sesion.desplegable('nvRol', [
              { valor:'vendedor', texto:'Vendedor', nota:'Registra pedidos' },
              { valor:'moderador', texto:'Moderador de caja', nota:'Entrega en una sucursal' },
              { valor:'admin', texto:'Administrador', nota:'Edita la web' },
            ], 'Elige el rol', 'vendedor')}
          </div>
          <div class="venta-f" id="nvSucBox" hidden><span>Sucursal <i class="req">obligatorio</i></span>
            ${selectorSucursal('nvSuc')}
          </div>
          <label class="venta-f venta-ancho"><span>Observación</span><input type="text" id="nvObs" placeholder="Zona, horario, notas internas"></label>
        </div>
        <button type="button" class="venta-btn" id="nvCrear" style="margin-top:14px">Crear persona</button>
        <p class="venta-msg" id="nvMsg"></p>
      </div>

      <div class="ev-equipo-cab">
        <p class="venta-sec" style="margin:0">Equipo</p>
        <label class="ev-buscador">
          ${svg(ICO.lupa)}
          <input type="search" id="evBuscar" placeholder="Buscar por nombre, correo, rol o sucursal" autocomplete="off">
        </label>
      </div>
      <div class="ev-grid" id="evEquipo"></div>
      <p class="venta-vacio" id="evNadie" hidden>Nadie del equipo coincide con esa búsqueda.</p>`;

    // La sucursal solo tiene sentido para el moderador: aparece al elegir ese
    // rol y se va si cambia a otro.
    Sesion.conectarDesplegables(box.querySelector('#evNuevo'), (campo, valor) => {
      if (campo !== 'nvRol') return;
      box.querySelector('#nvSucBox').hidden = valor !== 'moderador';
    });
    ov.querySelector('#nvCrear').addEventListener('click', e => crearVendedor(ov, box, e.target));

    const grilla = box.querySelector('#evEquipo');
    const nadie = box.querySelector('#evNadie');
    const buscador = box.querySelector('#evBuscar');

    // Sin tildes ni mayúsculas: "jose" encuentra a "José".
    const limpio = t => String(t || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    function pintarGrilla(){
      const q = limpio(buscador.value.trim());
      const vistos = usuarios.filter(u => !q ||
        [u.nombre, u.email, u.telefono, u.observacion, rolDe(u),
         u.sucursal_id ? sucursalDe(u.sucursal_id) : ''].some(c => limpio(c).includes(q)));

      grilla.innerHTML = vistos.map(u => `
        <div class="ev-ficha${u.activo ? '' : ' apagada'}">
          <span class="ev-ini">${esc((u.nombre || u.email).trim().charAt(0).toUpperCase())}</span>
          <span class="ev-txt">
            <b>${esc(u.nombre || u.email)}</b>
            <small>${esc(rolDe(u))}${u.rol === 'moderador' ? ' · ' + esc(sucursalDe(u.sucursal_id)) : ''}${u.activo ? '' : ' · desactivado'}</small>
            ${u.telefono ? `<small>${Sesion.waChip(u.telefono, 'Hola ' + (u.nombre || '') + ', te escribo de Esencial Emporio.', u.nombre)}</small>` : ''}
          </span>
          <button type="button" class="ev-lapiz" data-editar-u="${esc(u.id)}" aria-label="Editar ${esc(u.nombre || u.email)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
        </div>`).join('');

      nadie.hidden = vistos.length > 0;
      grilla.querySelectorAll('[data-editar-u]').forEach(b =>
        b.addEventListener('click', () => editarPersona(ov, b.dataset.editarU)));
    }

    buscador.addEventListener('input', pintarGrilla);
    pintarGrilla();
  }

  // Los datos de una persona se editan en su propio panel: en la grilla solo
  // va el nombre, para poder ver todo el equipo de una mirada.
  function editarPersona(padre, id){
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    // Sus ventas mandan: con plata registrada, la base no deja borrarlo.
    const conVentas = ventas.filter(v => v.vendedor_id === id).length;

    const cuerpo = `
      <form id="evPersona" novalidate>
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Nombre y apellido <i class="req">obligatorio</i></span>
            <input type="text" data-uf="nombre" value="${esc(u.nombre)}" required>
          </label>
          <label class="venta-f venta-ancho"><span>Correo</span>
            <input type="text" value="${esc(u.email)}" disabled>
            <small class="ev-nota">El correo con el que entra no se puede cambiar.</small>
          </label>
          <label class="venta-f"><span>Teléfono <i class="req">obligatorio</i></span>
            ${Sesion.campoTel('data-uf="telefono" required', u.telefono)}
          </label>
          <div class="venta-f"><span>Rol</span>
            ${Sesion.desplegable('rol', [
              { valor:'vendedor', texto:'Vendedor', nota:'Solo ventas' },
              { valor:'moderador', texto:'Moderador de caja', nota:'Entrega en una sucursal' },
              { valor:'admin', texto:'Administrador', nota:'Edita la web' },
            ], 'Elige el rol', u.rol)}
          </div>
          <div class="venta-f" id="evSucBox"${u.rol === 'moderador' ? '' : ' hidden'}><span>Sucursal <i class="req">obligatorio</i></span>
            ${selectorSucursal('sucursal', u.sucursal_id)}
          </div>
          <label class="venta-f venta-ancho"><span>Observación</span>
            <input type="text" data-uf="observacion" value="${esc(u.observacion)}">
          </label>
          <label class="venta-f venta-ancho"><span>Contraseña nueva (opcional)</span>
            <input type="text" data-uf="clave" placeholder="Déjalo vacío para no cambiarla">
          </label>
        </div>
        <p class="venta-msg" id="evPersonaMsg"></p>
      </form>

      <div class="ev-zona-roja">
        <b>Sacar del equipo</b>
        ${conVentas
          ? `<p><b>Desactivar</b> le saca la entrada y deja sus ${conVentas} venta${conVentas === 1 ? '' : 's'} en el historial.
             <b>Eliminar</b> borra la cuenta y también esas ventas.</p>`
          : `<p>Se borra la cuenta y no puede entrar nunca más. No se puede deshacer.</p>`}
        <button type="button" class="ev-borrar" id="evBorrarU">${svg(ICO.tacho)}Eliminar vendedor</button>
      </div>`;

    const pie = `
      <button type="button" class="venta-btn borrar" id="evActivo">${u.activo ? 'Desactivar' : 'Activar'}</button>
      <button type="submit" form="evPersona" class="venta-btn">Guardar</button>`;

    const { ov, cerrar } = Sesion.panel(u.nombre || u.email, 'Editar persona', cuerpo, pie);
    const borrarBtn = ov.querySelector('#evBorrarU');
    if (borrarBtn) borrarBtn.addEventListener("click", () => borrarVendedor(padre, u, conVentas, cerrar));
    const f = ov.querySelector('#evPersona');
    Sesion.conectarDesplegables(ov, (campo, valor) => {
      if (campo !== 'rol') return;
      ov.querySelector('#evSucBox').hidden = valor !== 'moderador';
    });

    ov.querySelector('#evActivo').addEventListener('click', async e => {
      await cambiarActivo(padre, id, e.target);
      cerrar();
    });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('button[type=submit]');
      const msg = ov.querySelector('#evPersonaMsg');
      const dato = c => f.querySelector('[data-uf=' + c + ']').value.trim();
      if (!dato('nombre') || !dato('telefono')) {
        msg.className = 'venta-msg err';
        msg.textContent = 'El nombre y el teléfono son obligatorios: salen en cada pedido.';
        return;
      }
      if (f.querySelector('[name=rol]').value === 'moderador' && !f.querySelector('[name=sucursal]').value) {
        msg.className = 'venta-msg err';
        msg.textContent = 'Elige la sucursal que va a atender. Un moderador sin sucursal no ve ningún pedido.';
        return;
      }
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

  async function crearVendedor(ov, box, btn){
    const g = id => ov.querySelector(id).value.trim();
    const rol = box.querySelector('[name=nvRol]').value || 'vendedor';
    const cuerpo = {
      nombre: g('#nvNombre'), email: g('#nvEmail'), telefono: Sesion.telGuardar(g('#nvTel')),
      password: ov.querySelector('#nvClave').value, observacion: g('#nvObs'), rol,
      sucursal_id: rol === 'moderador' ? box.querySelector('[name=nvSuc]').value : null,
    };
    const msg = ov.querySelector('#nvMsg');
    msg.className = 'venta-msg';
    const falla = t => { msg.className = 'venta-msg err'; msg.textContent = t; };
    // El nombre y el teléfono salen en cada pedido, así que son obligatorios.
    if (!cuerpo.nombre) return falla('Escribe el nombre y el apellido.');
    if (!cuerpo.email) return falla('Falta el correo.');
    if (!cuerpo.telefono) return falla('Escribe el teléfono: sale en cada pedido que registre.');
    if (cuerpo.telefono.replace(/\D/g, '').length < 8) return falla('Ese teléfono parece incompleto.');
    if (cuerpo.password.length < 8) return falla('La contraseña necesita 8 caracteres o más.');
    if (rol === 'moderador' && !cuerpo.sucursal_id) {
      return falla('Elige la sucursal que va a atender. Un moderador sin sucursal no ve ningún pedido.');
    }

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
      toast(rol === 'moderador' ? 'Moderador creado' : rol === 'admin' ? 'Administrador creado' : 'Vendedor creado');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Crear persona';
      msg.className = 'venta-msg err';
      msg.textContent = String(err.message || err);
    }
  }

  async function guardarUsuario(padre, f, id){
    const val = campo => f.querySelector('[data-uf=' + campo + ']').value.trim();
    const clave = val('clave');
    const rol = f.querySelector('[name=rol]').value || 'vendedor';

    const { error } = await sb.from('profiles').update({
      nombre: val('nombre'), telefono: Sesion.telGuardar(val('telefono')),
      observacion: val('observacion'),
      rol,
      // Quien deja de ser moderador deja de tener caja: si no, al volver al
      // rol seguiría atado a un local que ya no atiende.
      sucursal_id: rol === 'moderador' ? f.querySelector('[name=sucursal]').value : null,
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

  // Borrar a alguien del equipo es definitivo: avisa con su ficha y el
  // botón espera 5 segundos, igual que al borrar un pedido.
  async function borrarVendedor(padre, u, conVentas, cerrar){
    const suyas = ventas.filter(v => v.vendedor_id === u.id);
    const plata_ = suyas.filter(cuentaParaPago).reduce((a, v) => a + comisionDe(v), 0);

    const ficha = `
      <div class="ev-resumen-pedido">
        <span class="ev-ini">${esc((u.nombre || u.email).trim().charAt(0).toUpperCase())}</span>
        <div>
          <b>${esc(u.nombre || u.email)}</b>
          <small>${esc(u.email)}</small>
          <small>${esc(rolDe(u))}${u.telefono ? ' · ' + esc(u.telefono) : ''}</small>
        </div>
      </div>
      ${conVentas ? `<div class="ev-previo">
        <span>También se borra su historial</span>
        <p>${conVentas} venta${conVentas === 1 ? '' : 's'} registrada${conVentas === 1 ? '' : 's'}${plata_ ? ', con ' + plata(plata_) + ' en comisiones' : ''}.
          Esas ventas van a desaparecer de los totales de cada mes.</p>
      </div>` : ''}`;

    const ok = await confirmarFn(
      conVentas
        ? 'Todas las ventas y el historial de esta persona van a ser eliminados. ¿Estás seguro? No se puede deshacer.'
        : '¿Seguro que quieres eliminar a esta persona del equipo? Se borra su cuenta y no va a poder entrar nunca más. No se puede deshacer.',
      'Eliminar vendedor', 5, ficha);
    if (!ok) return;

    try {
      const r = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + await token() },
        body: JSON.stringify({ accion:'borrar', id: u.id }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || 'No se pudo eliminar');
      await cargar();
      cerrar();
      pintar(padre);
      toast(out.ventas
        ? 'Vendedor eliminado, con sus ' + out.ventas + ' venta' + (out.ventas === 1 ? '' : 's')
        : 'Vendedor eliminado');
    } catch (err) {
      toast(mensajeError(err));
    }
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
    const nuevas = [];   // las que todavía no están en la base
    const borradas = []; // ids a eliminar al guardar

    function filas(){
      return comunas.concat(nuevas);
    }

    function pintar(){
      box.innerHTML = `
        <div class="ev-sucursales-bloque" id="evSucursales"></div>

        <p class="venta-sec">Comunas de despacho</p>
        <p class="ec-intro">Es lo que se suma al precio cuando el vendedor elige la comuna. El ojo la saca del formulario sin perderla; el tacho la elimina para siempre.</p>
        <div class="ev-comunas">
          ${filas().map((c, i) => `
            <div class="ev-comuna${c.activa ? '' : ' apagada'}" data-i="${i}">
              <input type="text" data-cf="nombre" value="${esc(c.nombre)}" placeholder="Nombre de la comuna">
              <input type="number" min="0" step="500" data-cf="costo" value="${c.costo}">
              <label class="ec-ojo" title="${c.activa ? 'Sacar del formulario' : 'Volver a ofrecer'}">
                <input type="checkbox" data-cf="activa" ${c.activa ? 'checked' : ''}>
                <svg class="ec-ojo-si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
                <svg class="ec-ojo-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8"/></svg>
              </label>
              <button type="button" class="ec-borrar" data-quitar="${i}" aria-label="Eliminar comuna">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>
              </button>
            </div>`).join('')}
        </div>
        <div class="ev-nueva-comuna">
          <input type="text" id="evComunaNueva" placeholder="Comuna nueva">
          <input type="number" id="evComunaCosto" min="0" step="500" value="3000" aria-label="Costo de despacho">
          <button type="button" class="ed-btn" id="evComunaAgregar">Agregar</button>
        </div>
        <div class="ev-pie-comunas">
          <span class="ed-aviso" id="evComunasAviso"></span>
          <button type="button" class="venta-btn" id="evGuardarComunas">Guardar comunas</button>
        </div>`;

      box.querySelectorAll('[data-cf=nombre]').forEach(x => x.addEventListener('input', e => {
        filas()[+e.target.closest('.ev-comuna').dataset.i].nombre = e.target.value;
      }));
      box.querySelectorAll('[data-cf=costo]').forEach(x => x.addEventListener('input', e => {
        filas()[+e.target.closest('.ev-comuna').dataset.i].costo = parseInt(e.target.value, 10) || 0;
      }));
      box.querySelectorAll('[data-cf=activa]').forEach(x => x.addEventListener('change', e => {
        filas()[+e.target.closest('.ev-comuna').dataset.i].activa = e.target.checked;
        pintar();
      }));

      box.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', async () => {
        const i = +b.dataset.quitar;
        const c = filas()[i];
        const usada = ventas.some(v => v.comuna === c.nombre);
        if (usada) {
          toast('No se puede eliminar: hay ventas despachadas a ' + c.nombre + '. Puedes apagarla con el ojo.', true);
          return;
        }
        if (confirmarFn && !(await confirmarFn('¿Eliminar ' + c.nombre + ' de la lista de despacho?', 'Eliminar'))) return;
        if (i < comunas.length) { borradas.push(c.id); comunas.splice(i, 1); }
        else nuevas.splice(i - comunas.length, 1);
        pintar();
      }));

      const agregar = () => {
        const inp = box.querySelector('#evComunaNueva');
        const nombre = inp.value.trim();
        if (!nombre) return;
        if (filas().some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
          toast('Esa comuna ya está en la lista', true);
          return;
        }
        nuevas.push({
          nombre,
          costo: parseInt(box.querySelector('#evComunaCosto').value, 10) || 0,
          activa: true,
          position: filas().length + 1,
        });
        inp.value = '';
        pintar();
        box.querySelector('#evComunaNueva').focus();
      };
      box.querySelector('#evComunaAgregar').addEventListener('click', agregar);
      box.querySelector('#evComunaNueva').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregar(); }
      });

      box.querySelector('#evGuardarComunas').addEventListener('click', e => guardarComunas(ov, box, e.target, nuevas, borradas));
      pintarSucursales(ov, box.querySelector('#evSucursales'));
    }

    pintar();
  }

  /* ── Sucursales ───────────────────────────────────────── */
  // Van arriba de las comunas a propósito: sin una sucursal cargada no se
  // puede crear un moderador ni registrar un pedido para retirar.
  function pintarSucursales(ov, caja){
    const nuevas = [];

    function filas(){ return sucursales.concat(nuevas); }

    function pintar(){
      caja.innerHTML = `
        <p class="venta-sec" style="margin-top:0">Sucursales</p>
        <p class="ec-intro">Son los locales donde se atiende en persona. El moderador de cada sucursal carga ahí sus ventas locales. El ojo la saca de los formularios sin perderla; el tacho la elimina con sus ventas.</p>
        <div class="ev-sucursales">
          ${filas().map((s, i) => `
            <div class="ev-sucursal${s.activa ? '' : ' apagada'}" data-i="${i}">
              <div class="ev-sucursal-campos">
                <input type="text" data-sf="nombre" value="${esc(s.nombre)}" placeholder="Nombre del local">
                <input type="text" data-sf="direccion" value="${esc(s.direccion || '')}" placeholder="Calle y número">
                <input type="text" data-sf="comuna" value="${esc(s.comuna || '')}" placeholder="Comuna">
                <input type="text" data-sf="telefono" value="${esc(s.telefono || '')}" placeholder="Teléfono">
              </div>
              <div class="ev-sucursal-acc">
                ${s.id ? `<span class="ev-sucursal-gente">${cuentaGente(s.id)}</span>` : '<span class="ev-sucursal-gente nueva">Sin guardar</span>'}
                <label class="ec-ojo" title="${s.activa ? 'Sacar del formulario' : 'Volver a ofrecer'}">
                  <input type="checkbox" data-sf="activa" ${s.activa ? 'checked' : ''}>
                  <svg class="ec-ojo-si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
                  <svg class="ec-ojo-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8"/></svg>
                </label>
                <button type="button" class="ec-borrar" data-quitar-s="${i}" aria-label="Eliminar sucursal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>
                </button>
              </div>
            </div>`).join('')
          || '<p class="venta-vacio">Todavía no hay ninguna sucursal. Agrega la primera abajo.</p>'}
        </div>
        <div class="ev-nueva-comuna">
          <input type="text" id="evSucNueva" placeholder="Sucursal nueva">
          <button type="button" class="ed-btn" id="evSucAgregar">Agregar</button>
        </div>
        <div class="ev-pie-comunas">
          <span class="ed-aviso" id="evSucAviso"></span>
          <button type="button" class="venta-btn" id="evGuardarSuc">Guardar sucursales</button>
        </div>`;

      ['nombre','direccion','comuna','telefono'].forEach(campo => {
        caja.querySelectorAll('[data-sf=' + campo + ']').forEach(x => x.addEventListener('input', e => {
          filas()[+e.target.closest('.ev-sucursal').dataset.i][campo] = e.target.value;
        }));
      });
      caja.querySelectorAll('[data-sf=activa]').forEach(x => x.addEventListener('change', e => {
        filas()[+e.target.closest('.ev-sucursal').dataset.i].activa = e.target.checked;
        pintar();
      }));

      caja.querySelectorAll('[data-quitar-s]').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.quitarS;
        const s = filas()[i];
        if (!s.id) { nuevas.splice(i - sucursales.length, 1); pintar(); return; }
        borrarSucursal(ov, s);
      }));

      const agregar = () => {
        const inp = caja.querySelector('#evSucNueva');
        const nombre = inp.value.trim();
        if (!nombre) return;
        if (filas().some(s => (s.nombre || '').toLowerCase() === nombre.toLowerCase())) {
          toast('Esa sucursal ya está en la lista', true);
          return;
        }
        nuevas.push({ nombre, direccion:'', comuna:'', telefono:'', activa:true, position: filas().length + 1 });
        inp.value = '';
        pintar();
        caja.querySelector('#evSucNueva').focus();
      };
      caja.querySelector('#evSucAgregar').addEventListener('click', agregar);
      caja.querySelector('#evSucNueva').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregar(); }
      });

      caja.querySelector('#evGuardarSuc').addEventListener('click', e => guardarSucursales(ov, caja, e.target, nuevas));
    }

    pintar();
  }

  function cuentaGente(id){
    const gente = usuarios.filter(u => u.sucursal_id === id).length;
    const pedidos = ventas.filter(v => v.sucursal_id === id).length;
    const partes = [];
    if (gente) partes.push(gente + ' moderador' + (gente === 1 ? '' : 'es'));
    if (pedidos) partes.push(pedidos + ' pedido' + (pedidos === 1 ? '' : 's'));
    return partes.length ? esc(partes.join(' · ')) : 'Sin movimiento';
  }

  async function guardarSucursales(ov, caja, btn, nuevas){
    const aviso = caja.querySelector('#evSucAviso');
    const todas = sucursales.concat(nuevas);
    const falla = t => { aviso.className = 'ed-aviso err'; aviso.textContent = t; };
    if (todas.some(s => !String(s.nombre || '').trim())) return falla('Hay una sucursal sin nombre.');
    const vistos = new Set();
    if (todas.map(s => s.nombre.trim().toLowerCase()).some(n => vistos.has(n) ? true : (vistos.add(n), false))) {
      return falla('Hay dos sucursales con el mismo nombre.');
    }

    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      // Las que ya existen se actualizan por id; las nuevas van sin id, igual
      // que las comunas, para que la base les genere el suyo.
      const conId = [], sinId = [];
      todas.forEach((s, i) => {
        const fila = {
          nombre: s.nombre.trim(), direccion: String(s.direccion || '').trim(),
          comuna: String(s.comuna || '').trim(), telefono: String(s.telefono || '').trim(),
          activa: s.activa, position: i + 1,
        };
        if (s.id) { fila.id = s.id; conId.push(fila); } else sinId.push(fila);
      });
      if (conId.length) {
        const { error } = await sb.from('sucursales').upsert(conId, { onConflict: 'id' });
        if (error) throw error;
      }
      if (sinId.length) {
        const { error } = await sb.from('sucursales').insert(sinId);
        if (error) throw error;
      }
      await cargar();
      pintar(ov);
      toast('Sucursales guardadas');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Guardar sucursales';
      falla(mensajeError(err));
    }
  }

  // Borrar una sucursal arrastra sus pedidos y deja sin caja a sus
  // moderadores, así que avisa con la cuenta y espera 5 segundos, igual que
  // al borrar un pedido o un vendedor. Para sacarla de circulación sin perder
  // nada está el ojo.
  async function borrarSucursal(ov, s){
    const pedidos = ventas.filter(v => v.sucursal_id === s.id).length;
    const gente = usuarios.filter(u => u.sucursal_id === s.id);

    const ficha = `
      <div class="ev-resumen-pedido">
        <span class="ev-ini">${svg(ICO.tienda)}</span>
        <div>
          <b>${esc(s.nombre)}</b>
          <small>${esc([s.direccion, s.comuna].filter(Boolean).join(', ') || 'Sin dirección')}</small>
          <small>${s.activa ? 'Activa' : 'Apagada'}</small>
        </div>
      </div>
      ${pedidos || gente.length ? `<div class="ev-previo">
        <span>Qué se lleva por delante</span>
        <p>${[
          pedidos ? pedidos + ' venta' + (pedidos === 1 ? '' : 's') + ' local' + (pedidos === 1 ? '' : 'es') + ', que se borran con sus comisiones' : '',
          gente.length ? gente.length + ' moderador' + (gente.length === 1 ? '' : 'es') + ' (' + esc(gente.map(u => u.nombre || u.email).join(', ')) + '), que quedan desactivados y como vendedores' : '',
        ].filter(Boolean).join('. ')}.</p>
      </div>` : ''}`;

    const ok = await confirmarFn(
      pedidos || gente.length
        ? 'Esta sucursal tiene movimiento. Al eliminarla se borran sus pedidos y sus moderadores se quedan sin caja. ¿Estás seguro? No se puede deshacer.'
        : '¿Seguro que quieres eliminar esta sucursal? No se puede deshacer.',
      'Eliminar sucursal', 5, ficha);
    if (!ok) return;

    try {
      const r = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + await token() },
        body: JSON.stringify({ accion:'borrar-sucursal', id: s.id }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || 'No se pudo eliminar');
      await cargar();
      pintar(ov);
      toast(out.ventas || out.personas
        ? 'Sucursal eliminada, con sus ' + out.ventas + ' pedido' + (out.ventas === 1 ? '' : 's')
        : 'Sucursal eliminada');
    } catch (err) {
      toast(mensajeError(err));
    }
  }

  async function guardarComunas(ov, box, btn, nuevas, borradas){
    const aviso = box.querySelector('#evComunasAviso');
    const todas = comunas.concat(nuevas);
    if (todas.some(c => !c.nombre.trim())) {
      aviso.className = 'ed-aviso err';
      aviso.textContent = 'Hay una comuna sin nombre.';
      return;
    }
    // El nombre es único en la base: avisar aquí es más claro que el error que
    // devuelve la base.
    const vistos = new Set();
    const repetida = todas.map(c => c.nombre.trim().toLowerCase())
      .find(n => vistos.has(n) ? true : (vistos.add(n), false));
    if (repetida) {
      aviso.className = 'ed-aviso err';
      aviso.textContent = 'Hay dos comunas con el mismo nombre.';
      return;
    }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      if (borradas.length) {
        const { error } = await sb.from('comunas').delete().in('id', borradas);
        if (error) throw error;
      }
      // Las que ya existen se actualizan por id; las nuevas van sin id, para
      // que la base les genere el suyo. Mandarlas juntas hacía que la fila
      // nueva viajara con id nulo y la base la rechazaba.
      const conId = [], sinId = [];
      todas.forEach((c, i) => {
        const fila = { nombre: c.nombre.trim(), costo: c.costo, activa: c.activa, position: i + 1 };
        if (c.id) { fila.id = c.id; conId.push(fila); } else sinId.push(fila);
      });
      if (conId.length) {
        const { error } = await sb.from('comunas').upsert(conId, { onConflict: 'id' });
        if (error) throw error;
      }
      if (sinId.length) {
        const { error } = await sb.from('comunas').insert(sinId);
        if (error) throw error;
      }
      await cargar();
      pintar(ov);
      toast('Comunas guardadas');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Guardar comunas';
      aviso.className = 'ed-aviso err';
      aviso.textContent = mensajeError(err);
    }
  }



  return { montarBoton, abrir };
})();
