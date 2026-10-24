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
  function abrirCategorias(){
    const estado = {
      arbol: Cats.lista().map(c => ({ ...c, subs: c.subs.map(x => ({ ...x })) })),
      abierta: null,
    };

    const { ov, cerrar } = Sesion.panel('Categorías', 'Menú de la tienda',
      `<p class="venta-vacio" style="margin-bottom:16px">Tocá una categoría para abrirla: adentro cambiás su foto y sus subcategorías. Las que <b>no se muestran</b> quedan guardadas pero desaparecen del menú y de la portada.</p>
       <div id="edCats"></div>
       <div class="ed-lista-fila" style="margin-top:16px">
         <input type="text" id="edCatNueva" placeholder="Nombre de la categoría nueva">
         <button type="button" class="ed-btn" id="edCatAgregar" style="flex:none">Agregar</button>
       </div>
       <p class="venta-msg" id="edCatMsg"></p>`,
      '<button type="button" class="venta-btn" id="edCatGuardar">Guardar</button>');

    const usanCat  = s => CATALOGO.filter(p => p.cat === s).length;
    const usanTodo = c => CATALOGO.filter(p => p.cat === c.slug || c.subs.some(s => s.slug === p.cat)).length;
    // En palabras, no en un número suelto: "3 productos" se entiende solo.
    const cuantos = n => n === 0 ? 'Sin productos' : n === 1 ? '1 producto' : n + ' productos';

    function pintar(){
      const box = ov.querySelector('#edCats');
      box.innerHTML = estado.arbol.map((c, i) => {
        const abierta = estado.abierta === i;
        const oculta = c.oculta === true;
        return `
        <div class="ed-cat-bloque${abierta ? ' abierta' : ''}${oculta ? ' oculta' : ''}" data-i="${i}">
          <div class="ed-cat">
            <button type="button" class="ed-cat-chev" data-abrir="${i}" aria-label="Abrir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
            <span class="ed-cat-mini">
              ${c.img ? `<img src="${escH(c.img)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
            </span>
            <span class="ed-cat-datos">
              <b>${escH(c.nombre)}</b>
              <small>${cuantos(usanTodo(c))}${c.subs.length ? ' · ' + c.subs.length + (c.subs.length === 1 ? ' subcategoría' : ' subcategorías') : ''}${oculta ? ' · oculta' : ''}</small>
            </span>
            ${c.destacada ? '<span class="ed-chip">Portada</span>' : ''}
          </div>

          ${abierta ? `
            <div class="ed-cat-cuerpo">
              <label class="venta-f"><span>Nombre</span>
                <input type="text" data-nombre="${i}" value="${escH(c.nombre)}">
              </label>

              <p class="venta-sec">Foto de la categoría</p>
              <div class="ed-cat-foto">
                <div class="ed-foto-ancha">
                  ${c.img ? `<img src="${escH(c.img)}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="ed-sin-foto">Sin foto</span>'}
                </div>
                <div class="ed-cat-foto-acc">
                  <label class="ed-btn ghost">Subir foto
                    <input type="file" accept="image/*" data-foto="${i}" hidden>
                  </label>
                  ${c.img ? `<button type="button" class="ed-mini" data-quitarfoto="${i}">Quitar foto</button>` : ''}
                </div>
              </div>

              <div class="ed-cat-sw">
                <label class="ed-sw">
                  <input type="checkbox" data-dest="${i}" ${c.destacada ? 'checked' : ''}>
                  <span><b>Mostrar en la portada</b><small>Sale como tarjeta grande en el inicio</small></span>
                </label>
                <label class="ed-sw">
                  <input type="checkbox" data-ver="${i}" ${oculta ? '' : 'checked'}>
                  <span><b>Visible en el menú</b><small>Si la apagás se guarda, pero nadie la ve</small></span>
                </label>
              </div>

              <p class="venta-sec">Subcategorías</p>
              <div class="ed-subs">
                ${c.subs.map((s, k) => `
                  <div class="ed-sub${s.oculta ? ' oculta' : ''}">
                    <input type="text" data-sub="${i}-${k}" value="${escH(s.nombre)}">
                    <span class="ed-sub-n">${cuantos(usanCat(s.slug))}</span>
                    <label class="ed-ojo" title="${s.oculta ? 'Mostrar' : 'Ocultar'}">
                      <input type="checkbox" data-subver="${i}-${k}" ${s.oculta ? '' : 'checked'}>
                      <svg class="ed-ojo-si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
                      <svg class="ed-ojo-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8"/></svg>
                    </label>
                    <button type="button" class="ed-mini" data-subborrar="${i}-${k}">Eliminar</button>
                  </div>`).join('') || '<p class="venta-vacio" style="margin:2px 0 10px">Todavía no tiene subcategorías.</p>'}
                <div class="ed-lista-fila" style="margin-top:8px">
                  <input type="text" data-subnueva="${i}" placeholder="Subcategoría nueva">
                  <button type="button" class="ed-btn ghost" data-subagregar="${i}" style="flex:none">Agregar</button>
                </div>
              </div>

              <div class="ed-cat-pie">
                <button type="button" class="ed-mini peligro" data-borrar="${i}">Eliminar esta categoría</button>
              </div>
            </div>` : ''}
        </div>`;
      }).join('');

      box.querySelectorAll('[data-abrir]').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.abrir;
        estado.abierta = estado.abierta === i ? null : i;
        pintar();
      }));
      box.querySelectorAll('[data-nombre]').forEach(x => x.addEventListener('input', e => {
        estado.arbol[+e.target.dataset.nombre].nombre = e.target.value;
      }));
      box.querySelectorAll('[data-dest]').forEach(x => x.addEventListener('change', e => {
        estado.arbol[+e.target.dataset.dest].destacada = e.target.checked;
        pintar();
      }));
      box.querySelectorAll('[data-ver]').forEach(x => x.addEventListener('change', e => {
        estado.arbol[+e.target.dataset.ver].oculta = !e.target.checked;
        pintar();
      }));
      box.querySelectorAll('[data-sub]').forEach(x => x.addEventListener('input', e => {
        const [a, k] = e.target.dataset.sub.split('-').map(Number);
        estado.arbol[a].subs[k].nombre = e.target.value;
      }));
      box.querySelectorAll('[data-subver]').forEach(x => x.addEventListener('change', e => {
        const [a, k] = e.target.dataset.subver.split('-').map(Number);
        estado.arbol[a].subs[k].oculta = !e.target.checked;
        pintar();
      }));

      box.querySelectorAll('[data-foto]').forEach(inp => inp.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const i = +e.target.dataset.foto;
        toast('Subiendo foto…');
        try {
          const url = await uploadFile(file, 'categorias/');
          const c = estado.arbol[i];
          c.img = url;
          // La foto sirve de tarjeta y de banner de la sección.
          if (!c.banner) { c.banner = url; c.bannerMobile = url; }
          pintar();
          toast('Foto lista');
        } catch (err) { toast(mensajeError(err), true); }
        e.target.value = '';
      }));
      box.querySelectorAll('[data-quitarfoto]').forEach(b => b.addEventListener('click', () => {
        const c = estado.arbol[+b.dataset.quitarfoto];
        c.img = ''; c.banner = ''; c.bannerMobile = '';
        pintar();
      }));

      box.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', async () => {
        const c = estado.arbol[+b.dataset.borrar];
        const n = usanTodo(c);
        if (n) {
          toast('No se puede eliminar: tiene ' + cuantos(n).toLowerCase() + ' adentro. Podés ocultarla.', true);
          return;
        }
        if (await confirmar('¿Eliminar la categoría "' + c.nombre + '" y sus subcategorías?', 'Eliminar')) {
          estado.arbol.splice(+b.dataset.borrar, 1);
          estado.abierta = null;
          pintar();
        }
      }));

      box.querySelectorAll('[data-subborrar]').forEach(b => b.addEventListener('click', async () => {
        const [a, k] = b.dataset.subborrar.split('-').map(Number);
        const sub = estado.arbol[a].subs[k];
        const n = usanCat(sub.slug);
        if (n) {
          toast('No se puede eliminar: tiene ' + cuantos(n).toLowerCase() + ' adentro. Podés ocultarla.', true);
          return;
        }
        if (await confirmar('¿Eliminar "' + sub.nombre + '"?', 'Eliminar')) {
          estado.arbol[a].subs.splice(k, 1);
          pintar();
        }
      }));

      box.querySelectorAll('[data-subagregar]').forEach(b => b.addEventListener('click', () =>
        agregarSub(+b.dataset.subagregar, box.querySelector('[data-subnueva="' + b.dataset.subagregar + '"]'))));
      box.querySelectorAll('[data-subnueva]').forEach(inp => inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregarSub(+e.target.dataset.subnueva, e.target); }
      }));
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

    function agregarSub(i, inp){
      const nombre = inp.value.trim();
      if (!nombre) return;
      estado.arbol[i].subs.push({ slug: nuevoSlug(nombre, estado.arbol[i].slug), nombre });
      inp.value = '';
      pintar();
    }

    pintar();

    const agregar = () => {
      const inp = ov.querySelector('#edCatNueva');
      const nombre = inp.value.trim();
      if (!nombre) return;
      estado.arbol.push({ slug: nuevoSlug(nombre), nombre, arriba:'Todo en', destacada:false,
        orden: estado.arbol.length + 1, img:'', medida:'800 × 500', subs:[] });
      inp.value = '';
      estado.abierta = estado.arbol.length - 1;
      pintar();
    };
    ov.querySelector('#edCatAgregar').addEventListener('click', agregar);
    ov.querySelector('#edCatNueva').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); agregar(); }
    });

    ov.querySelector('#edCatGuardar').addEventListener('click', async e => {
      const btn = e.target, msg = ov.querySelector('#edCatMsg');
      if (estado.arbol.some(c => !c.nombre.trim() || c.subs.some(s => !s.nombre.trim()))) {
        msg.className = 'venta-msg err';
        msg.textContent = 'Hay una categoría o subcategoría sin nombre.';
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
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }


  Edicion.registrar(montarAnclas);

  return { abrirBanners, abrirCategorias, guardarConfig };
})();
