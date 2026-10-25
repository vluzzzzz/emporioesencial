// ed
'use strict';
/* ============================================================================
 *  Edicion — el interruptor "Editar" de la barra.
 *
 *  Apagado, la web es exactamente la que ve un cliente. Prendido, el body
 *  gana la clase `editando` y aparecen los lápices (que son ::after en CSS,
 *  no nodos: así sobreviven a cada repintado de las grillas).
 *
 *  Los módulos pesados (eu/ep/eb) se bajan recién al primer clic. Un visitante
 *  sin sesión no pide ni un byte de todo esto.
 *
 *  Esto es comodidad, no seguridad: aunque alguien fuerce la clase desde la
 *  consola, Supabase rechaza toda escritura que no venga de un admin (RLS).
 * ========================================================================== */
const Edicion = (() => {
  const V = "123";
  const MODULOS = ['js/eu.js', 'js/ep.js', 'js/eb.js'];
  const LLAVE = 'emporio-editando';

  let perfil = null, activa = false, cargando = null, boton = null;
  const montadores = [];

  function init(p){
    if (!p || p.rol !== 'admin' || boton) return;
    perfil = p;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ed-toggle';
    boton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
      </svg>
      <span>Editar</span>`;
    boton.addEventListener('click', () => alternar(!activa));
    const der = document.querySelector('.nav-right');
    if (der) der.insertBefore(boton, der.querySelector('.nav-cuenta') || null);

    // El panel de vendedores no depende del interruptor: el admin lo ve
    // siempre, con los lápices apagados.
    cargarCss();
    cargarUno('js/eu.js', () => cargarUno('js/ev.js', () => EdVendedores.montarBoton()));

    if (localStorage.getItem(LLAVE) === '1') alternar(true);
  }

  let cssPuesto = false;
  function cargarCss(){
    if (cssPuesto) return;
    cssPuesto = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'css/edicion.css?v=' + V;
    document.head.appendChild(css);
  }

  function cargarUno(src, alCargar){
    const s = document.createElement('script');
    s.src = src + '?v=' + V;
    s.onload = alCargar;
    s.onerror = () => console.error('No se pudo cargar', src);
    document.body.appendChild(s);
  }

  async function alternar(v){
    if (v) await cargarModulos();
    activa = !!v;
    document.body.classList.toggle('editando', activa);
    if (boton) boton.classList.toggle('on', activa);
    try { localStorage.setItem(LLAVE, activa ? '1' : '0'); } catch {}
    if (activa) remontar();
  }

  function cargarModulos(){
    if (cargando) return cargando;
    // eu.js ya puede estar cargado desde init(), para el panel de vendedores.
    const faltan = MODULOS.filter(m => !(m === 'js/eu.js' && typeof EdUtil !== 'undefined'));
    cargarCss();
    cargando = new Promise(resolve => {
      // En serie: ep.js usa EdUtil, así que eu.js tiene que estar antes.
      (function siguiente(i){
        if (i >= faltan.length) return resolve();
        const s = document.createElement('script');
        s.src = faltan[i] + '?v=' + V;
        s.onload = () => siguiente(i + 1);
        s.onerror = () => { console.error('No se pudo cargar', faltan[i]); siguiente(i + 1); };
        document.body.appendChild(s);
      })(0);
    });
    return cargando;
  }

  // Los módulos registran acá lo que tienen que volver a montar cuando una
  // grilla se repinta y se lleva por delante un botón anclado.
  function registrar(fn){
    montadores.push(fn);
    if (activa) { try { fn(); } catch (e) { console.error('Edición:', e); } }
  }

  function remontar(){
    if (!activa) return;
    montadores.forEach(fn => { try { fn(); } catch (e) { console.error('Edición:', e); } });
  }

  // Un solo oyente en fase de captura. Mientras el modo está prendido, el
  // clic sobre una tarjeta abre el editor y nunca la ficha del producto.
  document.addEventListener('click', e => {
    if (!activa) return;
    const zona = e.target.closest('[data-editar]');
    if (zona) {
      e.preventDefault();
      e.stopPropagation();
      despachar(zona.dataset.editar, zona);
      return;
    }
    const card = e.target.closest('.product-card');
    if (card) {
      e.preventDefault();
      e.stopPropagation();
      despachar('producto', card);
    }
  }, true);

  function despachar(que, el){
    if (que === 'producto' && typeof EdProducto !== 'undefined') {
      EdProducto.abrir(el.dataset.id || el.dataset.slug || document.getElementById('ppage')?.dataset.slug);
      return;
    }
    if (que === 'producto-nuevo' && typeof EdProducto !== 'undefined') { EdProducto.crear(); return; }
    if (que === 'ficha' && typeof EdProducto !== 'undefined') {
      EdProducto.abrir(document.getElementById('ppage')?.dataset.slug);
      return;
    }
    if (que === 'banner' && typeof EdSitio !== 'undefined') { EdSitio.abrirBanners(); return; }
    if (que === 'categorias' && typeof EdSitio !== 'undefined') { EdSitio.abrirCategorias(); return; }
    console.warn('Edición sin módulo para:', que);
  }

  return {
    init, alternar, registrar, remontar,
    activa: () => activa,
    perfil: () => perfil,
  };
})();
