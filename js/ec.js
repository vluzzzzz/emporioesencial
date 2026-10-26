// ec
'use strict';
/* ============================================================================
 *  EdCaja — el botón CAJA de la barra.
 *
 *  Lo usa el moderador que atiende el mostrador. Ve los pedidos presenciales
 *  de su sucursal, busca el que llegó y lo marca entregado. Recién ahí la
 *  comisión le queda al vendedor.
 *
 *  El administrador también lo ve, pero sin el filtro de sucursal: le aparecen
 *  todas.
 *
 *  Esto es comodidad, no seguridad: RLS solo le deja ver y marcar los pedidos
 *  de su propia sucursal, y el disparador venta_guardia no lo deja tocar nada
 *  más que la entrega.
 * ========================================================================== */
const EdCaja = (() => {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const cuando = d => new Date(d).toLocaleDateString('es-CL');
  const hora = d => new Date(d).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });

  const sb = window.sb;
  let perfil = null, pedidos = [], pestana = 'retirar', busqueda = '', boton = null;
  let toast = m => console.log(m), mensajeError = e => String(e && e.message || e), confirmarFn = null;

  const ICO = {
    tienda: '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9.5 20v-5h5v5"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    ok: '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.2 2.5 2.5 4.7-5"/>',
    no: '<circle cx="12" cy="12" r="8.6"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    vacio: '<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 5 4h14l2 5.5"/><path d="M9 14h6"/>',
  };
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const fotoDe = slug => (typeof CATALOGO !== 'undefined'
    ? (CATALOGO.find(p => p.slug === slug) || {}).image || '' : '');

  // Sin tildes ni mayúsculas: "jose" encuentra a "José".
  const limpio = t => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  function montarBoton(p){
    perfil = p;
    const izq = document.querySelector('.nav-left');
    if (!izq || izq.querySelector('.nav-caja-btn')) return;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'nav-caja-btn';
    boton.innerHTML = `${svg(ICO.tienda)}<span>Caja</span><i class="nav-caja-n" hidden></i>`;
    boton.addEventListener('click', () => abrir());
    izq.appendChild(boton);
    contar();
  }

  // El contador del botón dice cuántos clientes están esperando, sin que el
  // moderador tenga que abrir el panel para enterarse.
  async function contar(){
    try {
      const { count } = await sb.from('ventas')
        .select('id', { count:'exact', head:true })
        .eq('tipo', 'presencial').eq('entrega', 'por_retirar');
      const i = boton && boton.querySelector('.nav-caja-n');
      if (!i) return;
      i.textContent = count || '';
      i.hidden = !count;
    } catch (_) {}
  }

  async function cargar(){
    await Sesion.cargarSucursales();
    const { data, error } = await sb.from('ventas')
      .select('*').eq('tipo', 'presencial')
      .order('created_at', { ascending:false }).limit(500);
    if (error) throw error;
    pedidos = data || [];
  }

  async function abrir(){
    if (typeof EdUtil !== 'undefined') {
      toast = EdUtil.toast; mensajeError = EdUtil.mensajeError; confirmarFn = EdUtil.confirmar;
    }
    const sucursal = perfil && perfil.rol === 'moderador'
      ? Sesion.nombreSucursal(perfil.sucursal_id) : 'Todas las sucursales';

    const { ov } = Sesion.panel('Caja', sucursal,
      `<div class="ev-tabs">
         <button type="button" class="ev-tab activa" data-p="retirar">Por retirar</button>
         <button type="button" class="ev-tab" data-p="entregados">Entregados hoy</button>
         <div class="ev-filtros" id="ecFiltros"></div>
       </div>
       <div class="venta-wrap" id="ecCuerpo"><p class="venta-vacio">Cargando…</p></div>`,
      '', true);

    ov.querySelectorAll('.ev-tab').forEach(t => t.addEventListener('click', () => {
      ov.querySelectorAll('.ev-tab').forEach(x => x.classList.toggle('activa', x === t));
      pestana = t.dataset.p;
      pintar(ov);
    }));

    try { await cargar(); } catch (err) {
      ov.querySelector('#ecCuerpo').innerHTML = '<p class="venta-vacio">No se pudo cargar: ' + esc(mensajeError(err)) + '</p>';
      return;
    }
    pestana = 'retirar';
    busqueda = '';
    pintar(ov);
  }

  // El cliente llega y dice un código, su nombre o el del vendedor. Los tres
  // caminos entran por la misma casilla: si son cuatro dígitos se busca el
  // código, y si no, los nombres.
  function filtrar(lista){
    const q = busqueda.trim();
    if (!q) return lista;
    if (/^\d{1,4}$/.test(q)) {
      const porCodigo = lista.filter(v => String(v.codigo_retiro || '').startsWith(q));
      if (porCodigo.length || q.length === 4) return porCodigo;
    }
    const t = limpio(q);
    return lista.filter(v => [v.cliente_nombre, v.vendedor_nombre, v.producto_nombre]
      .some(c => limpio(c).includes(t)));
  }

  function pintar(ov){
    const box = ov.querySelector('#ecCuerpo');
    const filtros = ov.querySelector('#ecFiltros');
    const hoy = new Date().toDateString();

    const base = pestana === 'retirar'
      ? pedidos.filter(v => v.entrega === 'por_retirar')
      : pedidos.filter(v => v.entrega !== 'por_retirar'
          && new Date(v.entregado_en || v.created_at).toDateString() === hoy);
    const vistos = filtrar(base);

    if (filtros) {
      filtros.innerHTML = `
        <label class="ev-buscador ec-buscador">
          ${svg(ICO.lupa)}
          <input type="search" id="ecBuscar" placeholder="Código, nombre del cliente o del vendedor" autocomplete="off" value="${esc(busqueda)}">
        </label>
        ${base.length ? `<span class="ev-aviso-pend">${base.length} ${pestana === 'retirar' ? 'esperando' : 'entregado' + (base.length === 1 ? '' : 's')}</span>` : ''}`;
      const casilla = filtros.querySelector('#ecBuscar');
      casilla.addEventListener('input', e => {
        busqueda = e.target.value;
        pintar(ov);
      });
      if (busqueda) { casilla.focus(); casilla.setSelectionRange(busqueda.length, busqueda.length); }
    }

    if (!vistos.length) {
      box.innerHTML = `<div class="ev-det-vacio">${svg(ICO.vacio)}<p>${
        busqueda ? 'Ningún pedido coincide con esa búsqueda.'
        : pestana === 'retirar' ? 'No hay pedidos esperando retiro.'
        : 'Todavía no entregaste ningún pedido hoy.'}</p></div>`;
      return;
    }

    box.innerHTML = `<div class="ec-lista">${vistos.map(tarjeta).join('')}</div>`;
    box.querySelectorAll('[data-marcar]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      marcar(ov, b.dataset.marcar, b.dataset.como);
    }));
    box.querySelectorAll('[data-ver]').forEach(t => t.addEventListener('click', () =>
      verPedido(ov, t.dataset.ver)));
  }

  const selloDe = v => v.entrega === 'por_retirar' ? 'Por retirar'
                     : v.entrega === 'entregado' ? 'Entregado' : 'No retirado';
  const claseDe = v => v.entrega === 'por_retirar' ? 'pendiente'
                     : v.entrega === 'entregado' ? 'aceptado' : 'denegado';

  // En el mostrador solo importan tres cosas: quién viene a buscarlo, quién se
  // lo vendió y cuánto hay que cobrar. El precio por unidad y la comisión no
  // son asunto de la caja.
  function tarjeta(v){
    const espera = v.entrega === 'por_retirar';
    const clase = claseDe(v);
    return `
      <article class="ev-venta ec-pedido ${clase}" data-ver="${esc(v.id)}" title="Clic para ver el pedido completo">
        <div class="ec-codigo"><b>${esc(v.codigo_retiro || '—')}</b><span>Código de retiro</span></div>

        <div class="ev-venta-top">
          <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
          <div class="ev-venta-datos">
            <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
            <small class="ec-quien"><i>Cliente</i>${esc(v.cliente_nombre || 'Sin nombre')}</small>
            <small class="ec-quien"><i>Vendedor</i>${esc(v.vendedor_nombre || 'Sin nombre')}</small>
            <small class="ec-cuando">${esc(Sesion.nombreSucursal(v.sucursal_id))} · ${esc(v.metodo_pago)} · ${cuando(v.created_at)} ${hora(v.created_at)}</small>
          </div>
          <span class="ev-sello ${clase}">${selloDe(v)}</span>
        </div>

        <div class="ev-cifras dos">
          <div><span>Unidades</span><b>${v.cantidad || 1}</b></div>
          <div class="pagar"><span>Cobrar al cliente</span><b>${plata(v.total)}</b></div>
        </div>

        ${espera ? `
          <div class="ev-resolver">
            <button type="button" class="ev-ok" data-marcar="${esc(v.id)}" data-como="entregado">${svg(ICO.ok)}Entregar al cliente</button>
            <button type="button" class="ev-no" data-marcar="${esc(v.id)}" data-como="no_retirado">${svg(ICO.no)}No lo retiró</button>
          </div>`
        : `<div class="ev-resolver">
            ${v.entregado_en ? `<span class="ec-sello-hora">${v.entrega === 'entregado' ? 'Entregado' : 'Cerrado'} a las ${hora(v.entregado_en)}</span>` : ''}
            <button type="button" class="ev-rever" data-marcar="${esc(v.id)}" data-como="por_retirar">Volver a dejarlo en espera</button>
          </div>
          ${v.motivo ? `<p class="ev-motivo">${esc(v.motivo)}</p>` : ''}`}
      </article>`;
  }

  // La ficha completa, para cuando la tarjeta no alcanza: el teléfono para
  // llamar al cliente que no llega, el correo, las notas que dejó el vendedor.
  // Sin precio por unidad ni comisión: eso es del panel del administrador.
  function verPedido(padre, id){
    const v = pedidos.find(x => String(x.id) === String(id));
    if (!v) return;
    const espera = v.entrega === 'por_retirar';
    const linea = (t, d) => `<div class="ev-datos-l"><span>${t}</span><b>${esc(d || '—')}</b></div>`;
    const telLinea = (t, tel, msg, quien) =>
      `<div class="ev-datos-l"><span>${t}</span><b>${Sesion.waChip(tel, msg, quien)}</b></div>`;

    const cuerpo = `
      <div class="ec-codigo grande"><b>${esc(v.codigo_retiro || '—')}</b><span>Código de retiro</span></div>

      <div class="ev-resumen-pedido">
        <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <b>${esc(v.producto_nombre)}</b>
          <small>${v.cantidad || 1} unidad${(v.cantidad || 1) === 1 ? '' : 'es'}</small>
          <small>Registrado el ${cuando(v.created_at)} · ${hora(v.created_at)}</small>
        </div>
        <span class="ev-sello ${claseDe(v)}">${selloDe(v)}</span>
      </div>

      <p class="venta-sec">Quién lo retira</p>
      <div class="ev-datos">
        ${linea('Cliente', v.cliente_nombre)}
        ${telLinea('Teléfono', v.cliente_telefono,
          'Hola ' + (v.cliente_nombre || '') + ', te escribo de Esencial Emporio por tu pedido de ' + v.producto_nombre + '.',
          v.cliente_nombre)}
        ${v.cliente_email ? linea('Correo', v.cliente_email) : ''}
      </div>

      <p class="venta-sec">Quién lo vendió</p>
      <div class="ev-datos">
        ${linea('Vendedor', v.vendedor_nombre)}
        ${linea('Sucursal', Sesion.nombreSucursal(v.sucursal_id))}
        ${v.notas ? linea('Notas del vendedor', v.notas) : ''}
      </div>

      <p class="venta-sec">Cobro</p>
      <div class="ev-datos">
        ${linea('Forma de pago', v.metodo_pago)}
        ${linea('Retiro en sucursal', 'Sin costo')}
        <div class="ev-datos-l total"><span>Cobrar al cliente</span><b>${plata(v.total)}</b></div>
      </div>

      ${!espera && v.entregado_en ? `<div class="ev-previo">
        <span>${v.entrega === 'entregado' ? 'Se entregó' : 'Se cerró'}</span>
        <p>${cuando(v.entregado_en)} a las ${hora(v.entregado_en)}${v.motivo ? '. ' + esc(v.motivo) : ''}</p>
      </div>` : ''}`;

    const pie = espera
      ? `<div class="ev-resolver" style="margin:0;width:100%">
           <button type="button" class="ev-ok" data-ir="entregado">${svg(ICO.ok)}Entregar al cliente</button>
           <button type="button" class="ev-no" data-ir="no_retirado">${svg(ICO.no)}No lo retiró</button>
         </div>`
      : `<button type="button" class="ev-rever" data-ir="por_retirar">Volver a dejarlo en espera</button>`;

    const { ov, cerrar } = Sesion.panel('Pedido', 'Retiro en ' + Sesion.nombreSucursal(v.sucursal_id), cuerpo, pie);
    ov.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => {
      cerrar();
      marcar(padre, v.id, b.dataset.ir);
    }));
  }

  // Entregar mueve los dos ejes a la vez: el del mostrador y el del dinero.
  // Así la comisión del vendedor entra por el mismo camino de siempre.
  const CAMBIOS = {
    entregado:   { estado:'aceptado',  titulo:'Entregar al cliente', verbo:'Entregar' },
    no_retirado: { estado:'denegado',  titulo:'Marcar como no retirado', verbo:'Cerrar pedido' },
    por_retirar: { estado:'pendiente', titulo:'Volver a dejarlo en espera', verbo:'Dejar en espera' },
  };

  function marcar(padre, id, como){
    const v = pedidos.find(x => String(x.id) === String(id));
    const paso = CAMBIOS[como];
    if (!v || !paso) return;
    const entrega = como === 'entregado';

    const cuerpo = `
      <form id="ecMarcar">
        <div class="ev-resumen-pedido">
          <img src="${esc(fotoDe(v.producto_slug))}" alt="" onerror="this.style.visibility='hidden'">
          <div>
            <b>${esc(v.producto_nombre)}${v.cantidad > 1 ? ' × ' + v.cantidad : ''}</b>
            <small>Cliente: ${esc(v.cliente_nombre || 'Sin nombre')}</small>
            <small>Vendedor: ${esc(v.vendedor_nombre || 'Sin nombre')}</small>
          </div>
          <span class="ec-codigo chico"><b>${esc(v.codigo_retiro || '—')}</b><span>Código</span></span>
        </div>

        <div class="ev-datos" style="margin-top:16px">
          <div class="ev-datos-l total"><span>Cobrar al cliente</span><b>${plata(v.total)}</b></div>
          <div class="ev-datos-l"><span>Forma de pago</span><b>${esc(v.metodo_pago || '—')}</b></div>
        </div>

        ${entrega ? `<p class="ec-aviso">Antes de entregar, confirma que el cliente es
          <b>${esc(v.cliente_nombre || 'el del pedido')}</b> y que lo atendió
          <b>${esc(v.vendedor_nombre || 'ese vendedor')}</b>. Al marcar entregado, la comisión le queda al vendedor.</p>` : ''}

        <label class="venta-f venta-ancho" style="margin-top:16px"><span>Observación${entrega ? ' (opcional)' : ''}</span>
          <textarea name="motivo" rows="3" placeholder="${entrega ? 'Alguna nota de la entrega' : 'Por qué no se retiró: el cliente no llegó, se arrepintió…'}">${esc(v.motivo || '')}</textarea>
        </label>
        <p class="venta-msg" id="ecMsg"></p>
      </form>`;

    const pie = `<button type="submit" form="ecMarcar" class="venta-btn${entrega ? '' : ' peligro'}">${paso.verbo}</button>`;
    const { ov, cerrar } = Sesion.panel(paso.titulo, 'Pedido de ' + (v.vendedor_nombre || 'el vendedor'), cuerpo, pie);
    const f = ov.querySelector('#ecMarcar');

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('button[type=submit]');
      const msg = ov.querySelector('#ecMsg');
      const motivo = f.motivo.value.trim();
      if (como === 'no_retirado' && !motivo) {
        msg.className = 'venta-msg err';
        msg.textContent = 'Escribe por qué no se retiró, para que el vendedor sepa.';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const ahora = new Date().toISOString();
        const fila = {
          entrega: como,
          estado: paso.estado,
          motivo,
          entregado_en: como === 'por_retirar' ? null : ahora,
          entregado_por: como === 'por_retirar' ? null : perfil.id,
          resuelto_en: como === 'por_retirar' ? null : ahora,
        };
        const { error } = await sb.from('ventas').update(fila).eq('id', v.id);
        if (error) throw error;
        Object.assign(v, fila);
        cerrar();
        pintar(padre);
        contar();
        toast(entrega ? 'Entregado, la comisión ya es del vendedor'
          : como === 'no_retirado' ? 'Pedido cerrado, el stock volvió' : 'El pedido quedó en espera otra vez');
      } catch (err) {
        btn.disabled = false; btn.textContent = paso.verbo;
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  return { montarBoton, abrir };
})();
