// eb
'use strict';
/* ============================================================================
 *  EdSitio — banner y categorías, editables desde la misma página.
 *  Guarda en site_config, la misma tabla que usaba el panel viejo.
 * ========================================================================== */
const EdSitio = (() => {
  const { escH, slug: slugify, toast, confirmar, mensajeError, uploadFile } = EdUtil;
  const sb = window.sb;

  function montarAnclas(){
    const sec = document.querySelector('.bnr-section');
    if (sec && !sec.querySelector('[data-editar="banner"]')) {
      const caja = document.createElement('div');
      caja.className = 'ed-ancla';
      caja.innerHTML = `
        <button type="button" class="ed-btn" data-editar="banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m3 15 5-4 4 3 3-2 6 4"/></svg>
          Cambiar banner
        </button>
        <button type="button" class="ed-btn ghost" data-editar="categorias" style="margin-left:10px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          Categorías
        </button>`;
      sec.appendChild(caja);
    }
  }

  async function guardarConfig(clave, valor){
    const { data, error } = await sb.from('site_config')
      .upsert({ key: clave, value: valor }, { onConflict: 'key' }).select('key');
    if (error) throw error;
    if (!data || !data.length) throw new Error('SIN_PERMISO');
  }

  /* ── Banners ──────────────────────────────────────────── */
  function abrirBanners(){
    const estado = { lista: BANNERS.map(b => ({ ...b })) };

    const { ov, cerrar } = Sesion.panel('Banner', 'Portada',
      '<div id="edBanners"></div>' +
      '<button type="button" class="ed-btn ghost" id="edMasBanner" style="margin-top:14px">+ Agregar banner</button>' +
      '<p class="venta-msg" id="edBanMsg"></p>',
      '<button type="button" class="venta-btn" id="edBanGuardar">Guardar</button>');

    function pintar(){
      const box = ov.querySelector('#edBanners');
      box.innerHTML = estado.lista.map((b, i) => `
        <div class="ed-bloque" data-i="${i}">
          <div class="ed-bloque-head">
            <b>Banner ${i + 1}</b>
            <button type="button" class="ed-mini" data-quitar="${i}">Quitar</button>
          </div>
          <div class="ed-foto-ancha">
            <img src="${escH(b.desktop || '')}" alt="" onerror="this.style.visibility='hidden'">
          </div>
          <label class="ed-subir ancho">Subir imagen · 1920 × 560
            <input type="file" accept="image/*" data-sube="${i}">
          </label>
          <label class="venta-f" style="margin-top:10px"><span>Texto alternativo</span>
            <input type="text" data-alt="${i}" value="${escH(b.alt || '')}" placeholder="Qué muestra la imagen">
          </label>
        </div>`).join('') || '<p class="venta-vacio">Sin banners. Agregá el primero.</p>';

      box.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
        estado.lista.splice(+b.dataset.quitar, 1); pintar();
      }));
      box.querySelectorAll('[data-alt]').forEach(i => i.addEventListener('input', e => {
        estado.lista[+e.target.dataset.alt].alt = e.target.value;
      }));
      box.querySelectorAll('[data-sube]').forEach(i => i.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        toast('Subiendo imagen…');
        try {
          const url = await uploadFile(file, 'banners/');
          const b = estado.lista[+e.target.dataset.sube];
          b.desktop = url; b.mobile = url;
          pintar();
          toast('Imagen lista');
        } catch (err) { toast(mensajeError(err), true); }
        e.target.value = '';
      }));
    }
    pintar();

    ov.querySelector('#edMasBanner').addEventListener('click', () => {
      estado.lista.push({ desktop:'', mobile:'', alt:'' });
      pintar();
    });

    ov.querySelector('#edBanGuardar').addEventListener('click', async e => {
      const btn = e.target, msg = ov.querySelector('#edBanMsg');
      if (!estado.lista.length || estado.lista.some(b => !b.desktop)) {
        msg.className = 'venta-msg err';
        msg.textContent = 'Dejá al menos un banner, y que todos tengan imagen.';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await guardarConfig('banners', estado.lista);
        BANNERS = estado.lista;
        Banners.init();
        Edicion.remontar();
        cerrar();
        toast('Banner actualizado');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  /* ── Categorías ───────────────────────────────────────── */
  /* ── Categorías ───────────────────────────────────────── */
  // A pantalla completa y en dos niveles: primero la grilla de categorías,
  // y al entrar en una, la grilla de sus subcategorías. Cada tarjeta muestra
  // su foto, igual que las ve un cliente en el menú.
  function abrirCategorias(){
    const estado = {
      arbol: Cats.lista().map(c => ({ ...c, subs: c.subs.map(x => ({ ...x })) })),
      dentro: null,
      sucio: false,
    };

    const { ov, cerrar } = Sesion.panel('Categorías', 'Menú de la tienda',
      '<div class="venta-wrap" id="edCats"></div>',
      '<span class="ed-aviso" id="edCatAviso"></span>' +
      '<button type="button" class="venta-btn ghost" id="edCatVolver" hidden>Volver</button>' +
      '<button type="button" class="venta-btn" id="edCatGuardar">Guardar</button>',
      true);

    const usanCat  = s => CATALOGO.filter(p => p.cat === s).length;
    const usanTodo = c => CATALOGO.filter(p => p.cat === c.slug || c.subs.some(s => s.slug === p.cat)).length;
    // En palabras, no en un número suelto.
    const cuantos = n => n === 0 ? 'Sin productos' : n === 1 ? '1 producto' : n + ' productos';
    const marcar = () => { estado.sucio = true; ov.querySelector('#edCatAviso').textContent = 'Hay cambios sin guardar'; };

    function tarjeta(it, idx, esSub){
      const oculta = it.oculta === true;
      const n = esSub ? usanCat(it.slug) : usanTodo(it);
      return `
        <div class="ec-card${oculta ? ' oculta' : ''}" data-idx="${idx}" data-sub="${esSub ? 1 : 0}">
          <div class="ec-foto">
            ${it.img ? `<img src="${escH(it.img)}" alt="" onerror="this.closest('.ec-foto').classList.add('vacia')">`
                     : '<span class="ec-sinfoto">Sin foto</span>'}
            <label class="ec-subir" title="Cambiar foto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>
              <input type="file" accept="image/*" data-foto="${idx}" hidden>
            </label>
            ${it.img ? `<button type="button" class="ec-quitafoto" data-quitafoto="${idx}" aria-label="Quitar foto">&times;</button>` : ''}
          </div>

          <input type="text" class="ec-nombre" data-nombre="${idx}" value="${escH(it.nombre)}">
          <p class="ec-dato">${cuantos(n)}${!esSub && it.subs.length ? ' · ' + it.subs.length + (it.subs.length === 1 ? ' subcategoría' : ' subcategorías') : ''}</p>

          <div class="ec-acc">
            <label class="ec-ojo" title="${oculta ? 'Mostrar' : 'Ocultar'}">
              <input type="checkbox" data-ver="${idx}" ${oculta ? '' : 'checked'}>
              <svg class="ec-ojo-si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
              <svg class="ec-ojo-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8"/></svg>
              <span>${oculta ? 'Oculta' : 'En el menú'}</span>
            </label>
            ${esSub ? '' : `
              <button type="button" class="ec-entrar" data-entrar="${idx}">
                Subcategorías
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </button>`}
            <button type="button" class="ec-borrar" data-borrar="${idx}" aria-label="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>
            </button>
          </div>
        </div>`;
    }

    function pintar(){
      const box = ov.querySelector('#edCats');
      const dentro = estado.dentro !== null ? estado.arbol[estado.dentro] : null;
      const items = dentro ? dentro.subs : estado.arbol;
      const esSub = !!dentro;

      ov.querySelector('#edCatVolver').hidden = !dentro;
      ov.querySelector('.venta-head h2').textContent = dentro ? dentro.nombre : 'Categorías';
      ov.querySelector('.venta-kicker').textContent = dentro ? 'Subcategorías' : 'Menú de la tienda';

      box.innerHTML = `
        <p class="ec-intro">${dentro
          ? 'Las subcategorías de <b>' + escH(dentro.nombre) + '</b>. Cada una tiene su foto, la que se ve al abrir el menú.'
          : 'Cambiá la foto y el nombre de cada una. El ojo decide si aparece en el menú de la tienda: lo que apagás se guarda igual, solo deja de verse.'}</p>
        <div class="ec-grid">
          ${items.map((it, i) => tarjeta(it, i, esSub)).join('')}
          <button type="button" class="ec-nueva" id="ecNueva">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>${dentro ? 'Subcategoría nueva' : 'Categoría nueva'}</span>
          </button>
        </div>`;

      const lista = () => estado.dentro !== null ? estado.arbol[estado.dentro].subs : estado.arbol;

      box.querySelectorAll('[data-nombre]').forEach(x => x.addEventListener('input', e => {
        lista()[+e.target.dataset.nombre].nombre = e.target.value;
        marcar();
      }));
      box.querySelectorAll('[data-ver]').forEach(x => x.addEventListener('change', e => {
        lista()[+e.target.dataset.ver].oculta = !e.target.checked;
        marcar(); pintar();
      }));
      box.querySelectorAll('[data-entrar]').forEach(b => b.addEventListener('click', () => {
        estado.dentro = +b.dataset.entrar;
        pintar();
        ov.querySelector('.venta-body').scrollTop = 0;
      }));

      box.querySelectorAll('[data-foto]').forEach(inp => inp.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const it = lista()[+e.target.dataset.foto];
        toast('Subiendo foto…');
        try {
          const url = await uploadFile(file, 'categorias/');
          it.img = url;
          // La foto de una categoría sirve también de banner de su sección.
          if (!esSub) { it.banner = url; it.bannerMobile = url; }
          marcar(); pintar();
          toast('Foto lista');
        } catch (err) { toast(mensajeError(err), true); }
        e.target.value = '';
      }));
      box.querySelectorAll('[data-quitafoto]').forEach(b => b.addEventListener('click', () => {
        const it = lista()[+b.dataset.quitafoto];
        it.img = '';
        if (!esSub) { it.banner = ''; it.bannerMobile = ''; }
        marcar(); pintar();
      }));

      box.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', async () => {
        const i = +b.dataset.borrar;
        const it = lista()[i];
        const n = esSub ? usanCat(it.slug) : usanTodo(it);
        if (n) {
          toast('No se puede eliminar: tiene ' + cuantos(n).toLowerCase() + ' adentro. Podés ocultarla.', true);
          return;
        }
        if (await confirmar('¿Eliminar "' + it.nombre + '"?' + (esSub ? '' : ' Se van también sus subcategorías.'), 'Eliminar')) {
          lista().splice(i, 1);
          marcar(); pintar();
        }
      }));

      box.querySelector('#ecNueva').addEventListener('click', () => crear(esSub));
    }

    // El identificador interno no se edita nunca: cambiarlo dejaría productos
    // sin categoría. Se deriva del nombre al crearla, y nada más.
    function nuevoSlug(nombre, prefijo){
      const base = (prefijo ? prefijo + '-' : '') + slugify(nombre);
      const usados = new Set();
      estado.arbol.forEach(c => { usados.add(c.slug); c.subs.forEach(s => usados.add(s.slug)); });
      if (!usados.has(base)) return base;
      let n = 2;
      while (usados.has(base + '-' + n)) n++;
      return base + '-' + n;
    }

    function crear(esSub){
      const cuerpo = `
        <form id="ecNuevaF">
          <label class="venta-f venta-ancho"><span>Nombre</span>
            <input type="text" name="nombre" required placeholder="${esSub ? 'Ej: Ollas y sartenes' : 'Ej: Cocina'}">
          </label>
          <p class="venta-vacio" style="margin-top:12px">Se crea vacía y después le ponés la foto.</p>
        </form>`;
      const { ov: ov2, cerrar: cerrar2 } = Sesion.panel(
        esSub ? 'Subcategoría nueva' : 'Categoría nueva', 'Categorías', cuerpo,
        '<button type="submit" form="ecNuevaF" class="venta-btn">Crear</button>');
      const f = ov2.querySelector('#ecNuevaF');
      f.nombre.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const nombre = f.nombre.value.trim();
        if (!nombre) return;
        if (esSub) {
          const padre = estado.arbol[estado.dentro];
          padre.subs.push({ slug: nuevoSlug(nombre, padre.slug), nombre, img:'' });
        } else {
          estado.arbol.push({ slug: nuevoSlug(nombre), nombre, arriba:'Todo en', destacada:false,
            orden: estado.arbol.length + 1, img:'', medida:'800 × 500', subs:[] });
        }
        cerrar2();
        marcar(); pintar();
      });
    }

    ov.querySelector('#edCatVolver').addEventListener('click', () => {
      estado.dentro = null;
      pintar();
      ov.querySelector('.venta-body').scrollTop = 0;
    });

    pintar();

    ov.querySelector('#edCatGuardar').addEventListener('click', async e => {
      const btn = e.target;
      const aviso = ov.querySelector('#edCatAviso');
      if (estado.arbol.some(c => !c.nombre.trim() || c.subs.some(s => !s.nombre.trim()))) {
        aviso.textContent = 'Hay una categoría o subcategoría sin nombre.';
        aviso.className = 'ed-aviso err';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const arbol = estado.arbol.map((c, i) => ({ ...c, orden: i + 1 }));
        await guardarConfig('categorias_arbol', arbol);
        Cats.aplicar(arbol);
        Banners.init();
        Menu.renderMega();
        Filas.init();
        Edicion.remontar();
        cerrar();
        toast('Categorías guardadas');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        aviso.textContent = mensajeError(err);
        aviso.className = 'ed-aviso err';
      }
    });
  }


  Edicion.registrar(montarAnclas);

  return { abrirBanners, abrirCategorias, guardarConfig };
})();
