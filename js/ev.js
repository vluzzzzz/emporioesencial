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

  // El teléfono vive en el perfil, no en la venta: la venta solo guarda el
  // nombre con que se registró.
  function vendedorDe(v){
    const u = usuarios.find(x => x.id === v.vendedor_id) || {};
    return {
      nombre: u.nombre || v.vendedor_nombre || u.email || 'Sin nombre',
      telefono: u.telefono || 'Sin teléfono',
    };
  }

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
    pintar(ov);
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
  // La venta puede traerla calculada de la base; si no, se saca acá.
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

  function correrMes(pasos){
    const [a, m] = mesVisto.split('-').map(Number);
    const d = new Date(a, m - 1 + pasos, 1);
    mesVisto = clave(d);
    diaVisto = null;
  }



  function delMes(c){
    return ventas.filter(v => clave(new Date(v.created_at)) === c
      && (!vendedorVisto || v.vendedor_id === vendedorVisto));
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
    guia: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8h5"/><path d="M9 12.5h7M9 16h5"/>',
    copiar: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
    ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
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
        })), 'Elegí el mes', mesVisto, false, ICO.calendario)}
      </div>
      <div class="ev-filtro">
        <span>Vendedor</span>
        ${Sesion.desplegable('quien', [{ valor:'', texto:'Todo el equipo' }].concat(
          usuarios.filter(u => u.rol === 'vendedor' || ventas.some(v => v.vendedor_id === u.id))
                  .map(u => ({ valor:u.id, texto:u.nombre || u.email }))),
          'Todo el equipo', vendedorVisto, true, ICO.persona)}
      </div>
      ${pendientes.length ? `<span class="ev-aviso-pend">${pendientes.length} por aprobar este mes</span>` : ''}`;

    box.innerHTML = `
      <div class="ev-resumen">
        <div class="vt2">
          <span class="vt2-ico">${svg(ICO.caja)}</span>
          <div><span>Productos vendidos</span><b>${resumen.unidades}</b></div>
        </div>
        <div class="vt2 destacada">
          <span class="vt2-ico">${svg(ICO.moneda)}</span>
          <div><span>Ganancia en productos</span><b>${plata(resumen.productos)}</b></div>
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

      `;

    if (filtros) Sesion.conectarDesplegables(filtros, (campo, valor) => {
      if (campo === 'mes') mesVisto = valor;
      if (campo === 'quien') vendedorVisto = valor;
      diaVisto = null;
      pintarVentas(box);
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
        ${delDia.length ? delDia.map(tarjetaVenta).join('')
          : `<div class="ev-det-vacio">${svg(ICO.calendario)}<p>No se registró ninguna venta este día.</p></div>`}

      </div>`;

    caja.querySelectorAll('[data-resolver]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      resolver(box, b.dataset.resolver, b.dataset.como);
    }));
    caja.querySelectorAll('[data-ver]').forEach(t => t.addEventListener('click', () =>
      verPedido(box, t.dataset.ver)));
  }

  // La ficha completa del pedido. Desde acá el administrador puede cambiar
  // de opinión, esté aceptado o denegado.
  function verPedido(box, id){
    const v = ventas.find(x => String(x.id) === String(id));
    if (!v) return;
    const estado = estadoDe(v);
    const linea = (t, d) => `<div class="ev-datos-l"><span>${t}</span><b>${esc(d || '—')}</b></div>`;
    // Todo teléfono se puede tocar para escribir por WhatsApp.
    const telLinea = (t, tel, msg, quien) =>
      `<div class="ev-datos-l"><span>${t}</span><b>${Sesion.waChip(tel, msg, quien)}</b></div>`;

    const cuerpo = `
      <div class="ev-resumen-pedido">
        <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
          <small>${plata(v.precio_unitario)} por unidad · ${v.cantidad || 1} unidad${(v.cantidad || 1) === 1 ? '' : 'es'}</small>
          <small>${cuando(v.created_at)} · ${hora(v.created_at)}</small>
        </div>
        <span class="ev-sello ${estado}">${estado === 'pendiente' ? 'Pendiente' : estado === 'aceptado' ? 'Aceptada' : 'Denegado'}</span>
      </div>

      <p class="venta-sec">A quién se lo enviamos</p>
      <div class="ev-datos">
        ${linea('Cliente', v.cliente_nombre)}
        ${telLinea('Teléfono', v.cliente_telefono,
          'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.',
          v.cliente_nombre)}
        ${v.cliente_email ? linea('Correo', v.cliente_email) : ''}
        ${linea('Dirección', v.cliente_direccion)}
        ${linea('Comuna', v.comuna)}
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
        ${linea('Cobrado al cliente', plata(v.total))}
        <div class="ev-datos-l verde"><span>Ganancia del negocio</span><b>${plata((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
        ${linea('Despacho', plata(v.costo_despacho))}
        <div class="ev-datos-l total"><span>Pagar al vendedor</span><b>${estado === 'denegado' ? '—' : plata(comisionDe(v))}</b></div>
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
        <button type="button" class="ev-guia" id="evGuia">${svg(ICO.guia)}Guía para el repartidor</button>
        <button type="button" class="ev-borrar" id="evBorrar">${svg(ICO.tacho)}Eliminar pedido</button>
      </div>`;

    const { ov, cerrar } = Sesion.panel('Pedido', cuando(v.created_at), cuerpo, pie);
    ov.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => {
      cerrar();
      resolver(box, v.id, b.dataset.ir);
    }));
    ov.querySelector('#evGuia').addEventListener('click', e => guiaDespacho(v, e.currentTarget));
    ov.querySelector('#evBorrar').addEventListener('click', () => borrarPedido(box, v, cerrar));
  }

  /* ── Guía para el repartidor ──────────────────────────── */
  // Un link de solo lectura con lo que el repartidor necesita: a dónde va,
  // a quién le entrega y a quién le pregunta. Nunca la comisión. Los datos
  // van copiados dentro de la guía, así el link no depende del pedido y el
  // que lo abre no llega a la tabla de ventas.
  function datosGuia(v){
    const u = vendedorDe(v);
    return {
      codigo: String(v.id).slice(0, 8),
      producto: v.producto_nombre,
      cantidad: v.cantidad || 1,
      precio: (v.precio_unitario || 0) * (v.cantidad || 1),
      foto: new URL(fotoDe(v.producto_slug) || '', location.href).href,
      cliente: v.cliente_nombre,
      cliente_tel: v.cliente_telefono,
      direccion: v.cliente_direccion,
      comuna: v.comuna,
      observacion: v.notas || '',
      vendedor: u.nombre,
      vendedor_tel: u.telefono === 'Sin teléfono' ? '' : u.telefono,
      fecha: v.created_at,
    };
  }

  async function guiaDespacho(v, btn){
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = 'Buscando la guía…';
    try {
      const { data: hay, error: e1 } = await sb.from('guias')
        .select('id,activa').eq('venta_id', v.id).order('created_at', { ascending:false }).limit(1);
      if (e1) throw e1;

      let guia = hay && hay[0];
      if (!guia) {
        const { data, error } = await sb.from('guias')
          .insert({ venta_id: v.id, datos: datosGuia(v) }).select('id,activa').single();
        if (error) throw error;
        guia = data;
      }
      btn.disabled = false; btn.innerHTML = original;
      panelGuia(v, guia);
    } catch (err) {
      btn.disabled = false; btn.innerHTML = original;
      toast(mensajeError(err));
    }
  }

  function panelGuia(v, guia){
    const url = new URL('guia.html', location.href);
    url.searchParams.set('g', guia.id);
    const link = url.href;
    const u = vendedorDe(v);

    const cuerpo = `
      <p class="ev-guia-ayuda">Pasale este link al repartidor. Adentro va la dirección,
        el teléfono del cliente y a quién consultarle. No muestra la comisión ni la
        ganancia, y no se puede editar desde ahí.</p>

      <div class="ev-link">
        <input type="text" id="evLink" value="${esc(link)}" readonly>
        <button type="button" id="evCopiar">${svg(ICO.copiar)}Copiar</button>
      </div>

      <div class="ev-guia-acc">
        <a class="ev-guia-btn" href="${esc(link)}" target="_blank" rel="noopener">${svg(ICO.ojo)}Ver la guía</a>
        ${u.telefono !== 'Sin teléfono' ? `<a class="ev-guia-btn wa" href="${esc(Sesion.wasap(u.telefono, 'Hola ' + u.nombre + ', te escribo por el pedido de ' + v.producto_nombre + ' para ' + (v.cliente_nombre || 'el cliente') + '.'))}" target="_blank" rel="noopener">${svg(ICO.wasap)}WhatsApp al vendedor</a>` : ''}
      </div>

      <label class="ev-interruptor">
        <input type="checkbox" id="evActiva"${guia.activa ? ' checked' : ''}>
        <span class="ev-sw"></span>
        <span class="ev-interruptor-txt">
          <b>Link encendido</b>
          <small>Apagalo y el link deja de abrirse para todos.</small>
        </span>
      </label>`;

    const { ov } = Sesion.panel('Guía de despacho', 'Pedido ' + String(v.id).slice(0, 8), cuerpo, '');

    ov.querySelector('#evCopiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Link copiado'); }
      catch { ov.querySelector('#evLink').select(); }
    });

    ov.querySelector('#evActiva').addEventListener('change', async e => {
      const on = e.target.checked;
      const { error } = await sb.from('guias').update({ activa: on }).eq('id', guia.id);
      if (error) { e.target.checked = !on; toast(mensajeError(error)); return; }
      guia.activa = on;
      toast(on ? 'Link encendido' : 'Link apagado');
    });
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
      '¿Seguro que querés eliminar este pedido? Se borra para siempre y no se puede deshacer.',
      'Eliminar pedido', 5, ficha);
    if (!ok) return;
    try {
      const { error } = await sb.from('ventas').delete().eq('id', v.id);
      if (error) throw error;
      ventas = ventas.filter(x => String(x.id) !== String(v.id));
      cerrar();
      pintarVentas(box);
      toast('Pedido eliminado');
    } catch (err) {
      toast(mensajeError(err));
    }
  }


  function tarjetaVenta(v){
    const estado = estadoDe(v);
    const com = comisionDe(v);
    return `
      <article class="ev-venta ${estado}" data-ver="${esc(v.id)}" title="Clic para ver el pedido completo">
        <div class="ev-venta-top">
          <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="ev-venta-datos">
            <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
            <small>${esc(v.cliente_nombre)} · ${Sesion.waChip(v.cliente_telefono, 'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.', v.cliente_nombre)}</small>
            <small>${esc(v.cliente_direccion)}, ${esc(v.comuna)}</small>
            <small>${esc(v.metodo_pago)} · ${esc(v.vendedor_nombre)} · ${hora(v.created_at)}</small>
          </div>
          <span class="ev-sello ${estado}">${estado === 'pendiente' ? 'Pendiente' : estado === 'aceptado' ? 'Aceptada' : 'Denegado'}</span>
        </div>

        <div class="ev-cifras">
          <div><span>Cobrado</span><b>${plata(v.total)}</b></div>
          <div class="gana"><span>Ganancia</span><b>${plata((v.precio_unitario || 0) * (v.cantidad || 1))}</b></div>
          <div><span>Envío</span><b>${plata(v.costo_despacho)}</b></div>
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
        msg.textContent = 'Escribí por qué se deniega, para que el vendedor sepa.';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const { error } = await sb.from('ventas')
          .update({ estado: como, motivo, resuelto_en: new Date().toISOString() })
          .eq('id', v.id);
        if (error) throw error;
        v.estado = como; v.motivo = motivo;
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
  function pintarEquipo(ov, box){
    box.innerHTML = `
      <div class="ev-nuevo">
        <p class="venta-sec" style="margin-top:0">Vendedor nuevo</p>
        <div class="venta-g2">
          <label class="venta-f"><span>Nombre y apellido <i class="req">obligatorio</i></span><input type="text" id="nvNombre" placeholder="Ej: Camila Soto" required></label>
          <label class="venta-f"><span>Correo <i class="req">obligatorio</i></span><input type="email" id="nvEmail" placeholder="vendedor@correo.cl" required></label>
          <label class="venta-f"><span>Teléfono <i class="req">obligatorio</i></span>${Sesion.campoTel('id="nvTel" required')}</label>
          <label class="venta-f"><span>Contraseña provisoria <i class="req">obligatorio</i></span><input type="text" id="nvClave" placeholder="Mínimo 8 caracteres" required></label>
          <label class="venta-f venta-ancho"><span>Observación</span><input type="text" id="nvObs" placeholder="Zona, horario, notas internas"></label>
        </div>
        <button type="button" class="venta-btn" id="nvCrear" style="margin-top:14px">Crear vendedor</button>
        <p class="venta-msg" id="nvMsg"></p>
      </div>

      <div class="ev-equipo-cab">
        <p class="venta-sec" style="margin:0">Equipo</p>
        <label class="ev-buscador">
          ${svg(ICO.lupa)}
          <input type="search" id="evBuscar" placeholder="Buscar por nombre, correo o teléfono" autocomplete="off">
        </label>
      </div>
      <div class="ev-grid" id="evEquipo"></div>
      <p class="venta-vacio" id="evNadie" hidden>Nadie del equipo coincide con esa búsqueda.</p>`;

    ov.querySelector('#nvCrear').addEventListener('click', e => crearVendedor(ov, e.target));

    const grilla = box.querySelector('#evEquipo');
    const nadie = box.querySelector('#evNadie');
    const buscador = box.querySelector('#evBuscar');

    // Sin tildes ni mayúsculas: "jose" encuentra a "José".
    const limpio = t => String(t || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    function pintarGrilla(){
      const q = limpio(buscador.value.trim());
      const vistos = usuarios.filter(u => !q ||
        [u.nombre, u.email, u.telefono, u.observacion,
         u.rol === 'admin' ? 'administrador' : 'vendedor'].some(c => limpio(c).includes(q)));

      grilla.innerHTML = vistos.map(u => `
        <div class="ev-ficha${u.activo ? '' : ' apagada'}">
          <span class="ev-ini">${esc((u.nombre || u.email).trim().charAt(0).toUpperCase())}</span>
          <span class="ev-txt">
            <b>${esc(u.nombre || u.email)}</b>
            <small>${u.rol === 'admin' ? 'Administrador' : 'Vendedor'}${u.activo ? '' : ' · desactivado'}</small>
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
              { valor:'admin', texto:'Administrador', nota:'Edita la web' },
            ], 'Elegí el rol', u.rol)}
          </div>
          <label class="venta-f venta-ancho"><span>Observación</span>
            <input type="text" data-uf="observacion" value="${esc(u.observacion)}">
          </label>
          <label class="venta-f venta-ancho"><span>Contraseña nueva (opcional)</span>
            <input type="text" data-uf="clave" placeholder="Dejalo vacío para no cambiarla">
          </label>
        </div>
        <p class="venta-msg" id="evPersonaMsg"></p>
      </form>

      <div class="ev-zona-roja">
        <b>Sacar del equipo</b>
        ${conVentas
          ? `<p>${esc(u.nombre || u.email)} tiene ${conVentas} venta${conVentas === 1 ? '' : 's'} registrada${conVentas === 1 ? '' : 's'}.
             No se puede borrar sin perder esa plata del historial. Usá <b>Desactivar</b>:
             deja de poder entrar, y sus ventas quedan.</p>`
          : `<p>Se borra la cuenta y no puede entrar nunca más. No se puede deshacer.</p>
             <button type="button" class="ev-borrar" id="evBorrarU">${svg(ICO.tacho)}Eliminar vendedor</button>`}
      </div>`;

    const pie = `
      <button type="button" class="venta-btn borrar" id="evActivo">${u.activo ? 'Desactivar' : 'Activar'}</button>
      <button type="submit" form="evPersona" class="venta-btn">Guardar</button>`;

    const { ov, cerrar } = Sesion.panel(u.nombre || u.email, 'Editar persona', cuerpo, pie);
    const borrarBtn = ov.querySelector('#evBorrarU');
    if (borrarBtn) borrarBtn.addEventListener('click', () => borrarVendedor(padre, u, cerrar));
    const f = ov.querySelector('#evPersona');
    Sesion.conectarDesplegables(ov);

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
      nombre: g('#nvNombre'), email: g('#nvEmail'), telefono: Sesion.telGuardar(g('#nvTel')),
      password: ov.querySelector('#nvClave').value, observacion: g('#nvObs'), rol: 'vendedor',
    };
    const msg = ov.querySelector('#nvMsg');
    msg.className = 'venta-msg';
    const falla = t => { msg.className = 'venta-msg err'; msg.textContent = t; };
    // El nombre y el teléfono salen en cada pedido, así que son obligatorios.
    if (!cuerpo.nombre) return falla('Escribí el nombre y el apellido del vendedor.');
    if (!cuerpo.email) return falla('Falta el correo.');
    if (!cuerpo.telefono) return falla('Escribí el teléfono: sale en cada pedido que registre.');
    if (cuerpo.telefono.replace(/\D/g, '').length < 8) return falla('Ese teléfono parece incompleto.');
    if (cuerpo.password.length < 8) return falla('La contraseña necesita 8 caracteres o más.');

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
      nombre: val('nombre'), telefono: Sesion.telGuardar(val('telefono')),
      observacion: val('observacion'),
      rol: f.querySelector('[name=rol]').value || 'vendedor',
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
  async function borrarVendedor(padre, u, cerrar){
    const ficha = `
      <div class="ev-resumen-pedido">
        <span class="ev-ini">${esc((u.nombre || u.email).trim().charAt(0).toUpperCase())}</span>
        <div>
          <b>${esc(u.nombre || u.email)}</b>
          <small>${esc(u.email)}</small>
          <small>${u.rol === 'admin' ? 'Administrador' : 'Vendedor'}${u.telefono ? ' · ' + esc(u.telefono) : ''}</small>
        </div>
      </div>`;

    const ok = await confirmarFn(
      '¿Seguro que querés eliminar a esta persona del equipo? Se borra su cuenta ' +
      'y no va a poder entrar nunca más. No se puede deshacer.',
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
      toast('Vendedor eliminado');
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
          toast('No se puede eliminar: hay ventas despachadas a ' + c.nombre + '. Podés apagarla con el ojo.', true);
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
    }

    pintar();
  }

  async function guardarComunas(ov, box, btn, nuevas, borradas){
    const aviso = box.querySelector('#evComunasAviso');
    const todas = comunas.concat(nuevas);
    if (todas.some(c => !c.nombre.trim())) {
      aviso.className = 'ed-aviso err';
      aviso.textContent = 'Hay una comuna sin nombre.';
      return;
    }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      if (borradas.length) {
        const { error } = await sb.from('comunas').delete().in('id', borradas);
        if (error) throw error;
      }
      const { error } = await sb.from('comunas')
        .upsert(todas.map((c, i) => ({ ...c, position: i + 1 })), { onConflict: 'id' });
      if (error) throw error;
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
