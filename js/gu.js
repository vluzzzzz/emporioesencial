// gu
'use strict';
/* ============================================================================
 *  Guía de despacho — la vista que abre el repartidor con el link.
 *
 *  Es solo lectura: pide la guía por su uuid y la dibuja. Los datos vienen
 *  copiados dentro de la fila `guias`, así que esta página nunca toca la
 *  tabla de ventas y no hay forma de llegar a la comisión ni a la ganancia.
 *
 *  Si el administrador apaga el link (activa = false), la consulta no
 *  devuelve nada: la regla de RLS filtra, no este archivo.
 * ========================================================================== */
(() => {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const $ = id => document.getElementById(id);

  function aviso(t){
    const a = $('gAviso');
    a.textContent = t;
    a.hidden = false;
    requestAnimationFrame(() => a.classList.add('ver'));
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => {
      a.classList.remove('ver');
      setTimeout(() => { a.hidden = true; }, 220);
    }, 2200);
  }

  function falla(t){
    const e = $('gEstado');
    e.className = 'g-estado err';
    e.textContent = t;
  }

  const WA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5 5 16.3a7.8 7.8 0 1 1 3 3z"/><path d="M9.2 9c-.3 1.6 1.2 3.6 2.3 4.5s2.5 1.5 3.6 1.2l.6-1.4-1.9-1-.8.8a5.6 5.6 0 0 1-2-2l.9-.8-1-1.9z" fill="currentColor" stroke="none"/></svg>';

  // WhatsApp quiere el número sin signos y con código de país.
  function wa(tel, texto){
    let n = String(tel || '').replace(/\D/g, '');
    if (n.length === 9 && n.charAt(0) === '9') n = '56' + n;
    else if (n.length === 8) n = '569' + n;
    return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  // El teléfono se toca para llamar: el repartidor está con una mano ocupada.
  // Al lado va WhatsApp, que es por donde se escribe de verdad.
  const linea = (rot, dato, clase, msg) => {
    if (!dato) return '';
    const limpio = String(dato).replace(/[^\d+]/g, '');
    const esTel = clase === 'tel' && limpio.replace(/\D/g, '').length >= 8;
    const cuerpo = esTel
      ? `<a class="g-wa" href="${esc(wa(dato, msg))}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${WA}</a>` +
        `<a href="tel:${esc(limpio)}">${esc(dato)}</a>`
      : esc(dato);
    return `<div class="g-l"><span>${esc(rot)}</span><b>${cuerpo}</b></div>`;
  };

  function pintar(d){
    document.title = 'Guía · ' + (d.producto || 'Pedido') + ' · Esencial Emporio';

    if (d.foto) $('gFoto').src = d.foto; else $('gFoto').style.display = 'none';
    $('gNombre').textContent = d.producto || 'Producto';
    const cant = Number(d.cantidad) || 1;
    $('gCant').textContent = cant + ' unidad' + (cant === 1 ? '' : 'es');
    $('gPrecio').textContent = plata(d.precio);

    $('gCliente').innerHTML =
      linea('Nombre', d.cliente) +
      linea('Teléfono', d.cliente_tel, 'tel', 'Hola' + (d.cliente ? ' ' + d.cliente : '') + ', te escribo de Esencial Emporio por la entrega de tu pedido.') +
      linea('Dirección', d.direccion) +
      linea('Comuna', d.comuna) +
      linea('Observación', d.observacion);

    $('gVendedor').innerHTML =
      linea('Vendedor', d.vendedor) +
      linea('Teléfono', d.vendedor_tel, 'tel', 'Hola' + (d.vendedor ? ' ' + d.vendedor : '') + ', te consulto por el pedido de ' + (d.producto || '') + '.');

    $('gFecha').textContent = d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL') : '';
    $('gCodigo').textContent = d.codigo ? 'Pedido ' + d.codigo : '';

    $('gEstado').hidden = true;
    $('gGuia').hidden = false;
    $('gAcc').hidden = false;
  }

  /* ── Guardar como imagen ──────────────────────────────────
   * Se dibuja a mano en un canvas. Una librería para esto pesa más que
   * toda la página, y aquí el diseño lo conozco entero.                  */
  function comoImagen(d){
    const E = 2, A = 760;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const F = (p, s) => (s || 400) + ' ' + p + 'px "DM Sans",system-ui,sans-serif';

    const filas = [
      ['Entregar a', null],
      ['Nombre', d.cliente],
      ['Teléfono', d.cliente_tel],
      ['Dirección', d.direccion],
      ['Comuna', d.comuna],
      ['Observación', d.observacion],
      ['Consultas', null],
      ['Vendedor', d.vendedor],
      ['Teléfono', d.vendedor_tel],
    ].filter(f => f[1] !== '' && f[1] != null || f[1] === null);

    const alto = 72 + 118 + filas.reduce((a, f) => a + (f[1] === null ? 46 : 52), 0) + 56;
    c.width = A * E; c.height = alto * E;
    x.scale(E, E);

    x.fillStyle = '#fff'; x.fillRect(0, 0, A, alto);
    x.fillStyle = '#111'; x.fillRect(0, 0, A, 72);
    x.fillStyle = '#b98f2e'; x.font = F(13, 700);
    x.fillText('GUÍA DE DESPACHO', 28, 42);
    x.fillStyle = '#fff'; x.font = F(20, 700);
    x.textAlign = 'right'; x.fillText('ESENCIAL EMPORIO', A - 28, 44); x.textAlign = 'left';

    let y = 72;
    x.fillStyle = '#111'; x.font = F(21, 700);
    x.fillText(recortar(x, d.producto || 'Producto', A - 56), 28, y + 40);
    x.fillStyle = '#6b6b72'; x.font = F(14);
    const cant = Number(d.cantidad) || 1;
    x.fillText(cant + ' unidad' + (cant === 1 ? '' : 'es') + ' · ' + plata(d.precio), 28, y + 66);
    y += 92;
    x.strokeStyle = '#d2d2d7'; x.lineWidth = 1;
    raya(x, 28, y, A - 28);
    y += 26;

    filas.forEach(([rot, dato]) => {
      if (dato === null) {
        x.fillStyle = '#6b6b72'; x.font = F(12, 700);
        x.fillText(rot.toUpperCase(), 28, y + 16);
        y += 46;
        return;
      }
      x.fillStyle = '#6b6b72'; x.font = F(13);
      x.fillText(rot, 28, y + 22);
      x.fillStyle = '#111'; x.font = F(16, 600);
      x.textAlign = 'right';
      x.fillText(recortar(x, String(dato), A / 2 - 40), A - 28, y + 22);
      x.textAlign = 'left';
      y += 52;
      x.strokeStyle = '#ececf0';
      raya(x, 28, y - 14, A - 28);
    });

    x.fillStyle = '#6b6b72'; x.font = F(12);
    x.fillText((d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL') : '') +
               (d.codigo ? '   ·   Pedido ' + d.codigo : ''), 28, alto - 20);

    c.toBlob(b => {
      if (!b) { aviso('No se pudo armar la imagen'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'guia-' + (d.codigo || 'pedido') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      aviso('Imagen guardada');
    }, 'image/png');
  }

  function raya(x, a, y, b){
    x.beginPath(); x.moveTo(a, y + .5); x.lineTo(b, y + .5); x.stroke();
  }
  function recortar(x, t, max){
    if (x.measureText(t).width <= max) return t;
    let s = t;
    while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }

  async function compartir(){
    const url = location.href;
    const datos = { title: document.title, text: 'Guía de despacho', url };
    if (navigator.share) {
      try { await navigator.share(datos); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      aviso('Link copiado');
    } catch {
      prompt('Copia el link:', url);
    }
  }

  /* ── Arranque ─────────────────────────────────────────── */
  (async function init(){
    const id = new URLSearchParams(location.search).get('g');
    if (!id) return falla('Este link no tiene guía.');
    if (!window.sb) return falla('No se pudo conectar. Prueba de nuevo en un rato.');

    let fila, error;
    try {
      ({ data: fila, error } = await window.sb
        .from('guias').select('datos').eq('id', id).maybeSingle());
    } catch (e) { error = e; }

    if (error) return falla('No se pudo abrir la guía. Prueba de nuevo en un rato.');
    if (!fila) return falla('Esta guía ya no está disponible. Pedile un link nuevo al administrador.');

    const d = fila.datos || {};
    pintar(d);
    $('gImprimir').addEventListener('click', () => window.print());
    $('gCompartir').addEventListener('click', compartir);
    $('gImagen').addEventListener('click', () => comoImagen(d));
  })();
})();
