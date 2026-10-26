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
  // La versión sale de la dirección de este mismo archivo. Escrita a mano se
  // quedaba atrás y el navegador servía módulos viejos junto a páginas nuevas.
  const V = (document.currentScript && new URL(document.currentScript.src, location.href).searchParams.get('v')) || '1';
  const MODULOS = ['js/eu.js', 'js/ep.js', 'js/eb.js'];
  const LLAVE = 'emporio-editando';

  let perfil = null, activa = false, cargando = null, boton = null;
  const montadores = [];

  function init(p){
    if (!p || boton) return;

    // El moderador no edita la web: solo carga las ventas del mostrador. Se
    // lleva ese módulo y nada más.
    if (p.rol === 'moderador') {
      perfil = p;
      cargarCss();
      cargarUno('js/eu.js', () => cargarUno('js/ec.js', () => EdLocal.montarBoton(p)));
      return;
    }
    if (p.rol !== 'admin') return;
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
    // El de venta local no monta botón propio: el administrador lo abre desde
    // Vendedores → Ventas, que es donde mira los números.
    cargarUno('js/eu.js', () => cargarUno('js/ev.js', () => EdVendedores.montarBoton()));
    cargarUno('js/eu.js', () => cargarUno('js/ec.js', () => EdLocal.usar(p)));

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

  // Un archivo se baja una sola vez, aunque lo pidan dos caminos a la vez.
  // Bajarlo dos veces rompía el módulo: `const EdUtil` ya estaba declarado.
  const enVuelo = {};
  function bajar(src){
    if (!enVuelo[src]) {
      enVuelo[src] = new Promise(listo => {
        const s = document.createElement('script');
        s.src = src + '?v=' + V;
        s.onload = () => listo();
        s.onerror = () => { console.error('No se pudo cargar', src); listo(); };
        document.body.appendChild(s);
      });
    }
    return enVuelo[src];
  }

  function cargarUno(src, alCargar){
    bajar(src).then(alCargar);
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
    cargarCss();
    // En serie: ep.js y eb.js usan EdUtil, así que eu.js tiene que estar antes.
    cargando = MODULOS.reduce((antes, m) => antes.then(() => bajar(m)), Promise.resolve());
    return cargando;
  }

  // Los módulos registran aquí lo que tienen que volver a montar cuando una
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

  // Si el clic llega antes de que terminen de bajar los módulos, se espera en
  // vez de no hacer nada: antes el primer clic después de prender se perdía.
  async function despachar(que, el){
    await cargarModulos();
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
    if (typeof EdUtil !== 'undefined') EdUtil.toast('No se pudo abrir el editor. Recarga la página con Ctrl+F5.', true);
  }

  return {
    init, alternar, registrar, remontar,
    activa: () => activa,
    perfil: () => perfil,
  };
})();
