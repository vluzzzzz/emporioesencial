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
  /* ── Banners ──────────────────────────────────────────── */
  // Cada banner necesita sus dos fotos: la ancha de computadora y la
  // cuadrada de teléfono. Con una sola, en el celular se recorta mal.
  function abrirBanners(){
    const estado = { lista: BANNERS.map(b => ({ ...b })), sucio: false };

    const { ov, cerrar } = Sesion.panel('Banner', 'Portada',
      '<div class="venta-wrap" id="edBanners"></div>',
      '<span class="ed-aviso" id="edBanAviso"></span>' +
      '<button type="button" class="venta-btn" id="edBanGuardar">Guardar</button>',
      true);

    const marcar = () => {
      estado.sucio = true;
      const a = ov.querySelector('#edBanAviso');
      a.className = 'ed-aviso';
      a.textContent = 'Hay cambios sin guardar';
    };

    function hueco(b, i, campo, titulo, medida){
      const url = b[campo] || '';
      return `
        <div class="eb-hueco${url ? '' : ' falta'}">
          <div class="eb-hueco-cab">
            <b>${titulo}</b>
            <small>${medida}</small>
          </div>
          <div class="eb-foto ${campo === 'mobile' ? 'celu' : ''}">
            ${url ? `<img src="${escH(url)}" alt="">` : '<span class="eb-sinfoto">Falta esta imagen</span>'}
            <label class="eb-subir" title="${url ? 'Cambiar' : 'Subir'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>
              <input type="file" accept="image/*" data-sube="${i}-${campo}" hidden>
            </label>
          </div>
        </div>`;
    }

    function pintar(){
      const box = ov.querySelector('#edBanners');
      box.innerHTML = `
        <p class="ec-intro">Cada banner lleva <b>dos imágenes</b>: la ancha para computadora y la cuadrada para teléfono. El ojo decide si se muestra; lo que apagas se guarda igual. Sin ningún banner visible, la página arranca directo por el catálogo.</p>
        ${estado.lista.map((b, i) => `
          <div class="eb-card${b.oculto ? ' oculta' : ''}" data-i="${i}">
            <div class="eb-cab">
              <b>Banner ${i + 1}</b>
              <label class="ec-ojo" title="${b.oculto ? 'Mostrar' : 'Ocultar'}">
                <input type="checkbox" data-ver="${i}" ${b.oculto ? '' : 'checked'}>
                <svg class="ec-ojo-si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
                <svg class="ec-ojo-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8"/></svg>
                <span>${b.oculto ? 'Oculto' : 'Se muestra'}</span>
              </label>
              <button type="button" class="ec-borrar" data-borrar="${i}" aria-label="Eliminar banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>
              </button>
            </div>
            <div class="eb-huecos">
              ${hueco(b, i, 'desktop', 'Computadora', '1920 × 560')}
              ${hueco(b, i, 'mobile', 'Teléfono', '1080 × 1080')}
            </div>
            <label class="venta-f" style="margin-top:12px"><span>Texto alternativo</span>
              <input type="text" data-alt="${i}" value="${escH(b.alt || '')}" placeholder="Qué muestra la imagen">
            </label>
          </div>`).join('') || '<p class="venta-vacio">Sin banners. La portada arranca por el catálogo.</p>'}
        <button type="button" class="ec-nueva" id="ebNuevo" style="margin-top:16px;min-height:120px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <span>Banner nuevo</span>
        </button>`;

      box.querySelectorAll('[data-alt]').forEach(x => x.addEventListener('input', e => {
        estado.lista[+e.target.dataset.alt].alt = e.target.value;
        marcar();
      }));
      box.querySelectorAll('[data-ver]').forEach(x => x.addEventListener('change', e => {
        estado.lista[+e.target.dataset.ver].oculto = !e.target.checked;
        marcar(); pintar();
      }));
      box.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', async () => {
        if (await confirmar('¿Eliminar este banner? Se van sus dos imágenes.', 'Eliminar')) {
          estado.lista.splice(+b.dataset.borrar, 1);
          marcar(); pintar();
        }
      }));
      box.querySelectorAll('[data-sube]').forEach(inp => inp.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const [i, campo] = e.target.dataset.sube.split('-');
        toast('Subiendo imagen…');
        try {
          estado.lista[+i][campo] = await uploadFile(file, 'banners/');
          marcar(); pintar();
          toast('Imagen lista');
        } catch (err) { toast(mensajeError(err), true); }
        e.target.value = '';
      }));
      box.querySelector('#ebNuevo').addEventListener('click', () => {
        estado.lista.push({ desktop:'', mobile:'', alt:'' });
        marcar(); pintar();
      });
    }
    pintar();

    ov.querySelector('#edBanGuardar').addEventListener('click', async e => {
      const btn = e.target, aviso = ov.querySelector('#edBanAviso');
      // Sin las dos fotos el banner se vería recortado en un teléfono.
      const incompleto = estado.lista.findIndex(b => !b.desktop || !b.mobile);
      if (incompleto >= 0) {
        aviso.className = 'ed-aviso err';
        aviso.textContent = 'Al banner ' + (incompleto + 1) + ' le falta una imagen: necesita la de computadora y la de teléfono.';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await guardarConfig('banners', estado.lista);
        BANNERS = estado.lista;
        Banners.init();
        Edicion.remontar();
        cerrar();
        toast(estado.lista.some(b => !b.oculto) ? 'Banner actualizado' : 'La portada queda sin banner');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        aviso.className = 'ed-aviso err';
        aviso.textContent = mensajeError(err);
      }
    });
  }

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

    /* ── Orden por arrastre ──────────────────────────────── */
    // La manito levanta la tarjeta: queda pegada al puntero, un hueco punteado
    // marca el lugar de destino y las demás se corren con una animación corta
    // (FLIP). Al soltar, la tarjeta cae en el hueco. Al guardar, el orden del
    // array es el que se sube: `orden` para categorías y el propio orden del
    // array para las subcategorías.
    const listaActual = () => estado.dentro !== null ? estado.arbol[estado.dentro].subs : estado.arbol;
    const sinMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DURACION = 170;
    let drag = null;

    // FLIP: se mide dónde está cada tarjeta, el llamador reordena el DOM y acá
    // se anima cada una desde su posición vieja a la nueva. Es lo que hace que
    // "se corran" en vez de saltar de golpe.
    function medir(box){
      const mapa = new Map();
      box.querySelectorAll('.ec-card').forEach(c => mapa.set(c, c.getBoundingClientRect()));
      return mapa;
    }

    function animarDesde(box, antes){
      const dur = sinMovimiento() ? 0 : DURACION;
      box.querySelectorAll('.ec-card').forEach(c => {
        const a = antes.get(c);
        if (!a) return;
        const b = c.getBoundingClientRect();
        const dx = Math.round(a.left - b.left), dy = Math.round(a.top - b.top);
        if (!dx && !dy) return;
        c.animate(
          [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
          { duration: dur, easing: 'cubic-bezier(.2,.85,.25,1)' }
        );
      });
    }

    function reacomodar(box, cambiar){
      const antes = medir(box);
      cambiar();
      animarDesde(box, antes);
    }

    // El nodo que se arrastra no cambia de posición en el array hasta soltar,
    // así que hay que realinear índices y los data-* de cada control.
    function sincronizarOrden(box){
      const cards = [...box.querySelectorAll('.ec-card')];
      const actual = listaActual();
      const nuevo = cards.map(c => actual[+c.dataset.idx]).filter(Boolean);
      if (nuevo.length !== actual.length) return;
      actual.length = 0;
      actual.push(...nuevo);
      cards.forEach((c, i) => {
        c.dataset.idx = i;
        ['nombre', 'ver', 'foto', 'quitafoto', 'borrar', 'entrar', 'mano'].forEach(k => {
          c.querySelectorAll('[data-' + k + ']').forEach(n => { n.dataset[k] = i; });
        });
      });
    }

    function agarrar(e){
      if (e.button !== 0 || drag) return;
      const card = e.currentTarget.closest('.ec-card');
      const box = card && card.parentElement;
      if (!card || !box) return;
      e.preventDefault();

      const r = card.getBoundingClientRect();
      // El hueco ocupa el lugar de la tarjeta para que la grilla no se achique
      // mientras la tarjeta está levantada.
      const hueco = document.createElement('div');
      hueco.className = 'ec-hueco';
      hueco.style.width = r.width + 'px';
      hueco.style.height = r.height + 'px';
      box.insertBefore(hueco, card);

      card.classList.add('arrastrando');
      card.style.position = 'fixed';
      card.style.left = r.left + 'px';
      card.style.top = r.top + 'px';
      card.style.width = r.width + 'px';
      card.style.height = r.height + 'px';
      card.style.margin = '0';
      card.style.zIndex = '999';
      card.style.pointerEvents = 'none';

      // La tarjeta sale del panel mientras vuela. Así no la recorta el cuerpo
      // con scroll ni la tapa la barra de Guardar, y las coordenadas del
      // puntero son las de la pantalla.
      ov.appendChild(card);

      drag = {
        card, hueco, id: e.pointerId,
        x0: e.clientX, y0: e.clientY,
        dx: e.clientX - r.left, dy: e.clientY - r.top,
        movido: false,
      };
      document.body.classList.add('ec-arrastrando');
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
      document.addEventListener('pointercancel', soltar);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    }

    function mover(e){
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.movido && Math.abs(e.clientY - drag.y0) < 5 && Math.abs(e.clientX - drag.x0) < 5) return;
      drag.movido = true;
      e.preventDefault();

      // La tarjeta sigue al puntero.
      drag.card.style.left = (e.clientX - drag.dx) + 'px';
      drag.card.style.top = (e.clientY - drag.dy) + 'px';

      // ¿Sobre qué tarjeta está? (la levantada no molesta: no recibe puntero).
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const otra = el && el.closest ? el.closest('.ec-card') : null;
      if (!otra || otra === drag.card) return;
      const box = drag.hueco.parentElement;
      if (!box || !box.contains(otra)) return;

      const r = otra.getBoundingClientRect();
      // La grilla tiene varias columnas: si el puntero está a la altura de la
      // tarjeta destino, manda el eje horizontal; si está en otra fila, el
      // vertical.
      const mismaFila = e.clientY >= r.top && e.clientY <= r.bottom;
      const antes = mismaFila
        ? e.clientX < r.left + r.width / 2
        : e.clientY < r.top + r.height / 2;
      const destino = antes ? otra : otra.nextSibling;
      if (destino === drag.hueco) return;
      reacomodar(box, () => box.insertBefore(drag.hueco, destino));
    }

    function soltar(e){
      if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
      const { card, hueco, movido } = drag;
      const box = hueco.parentElement;
      drag = null;
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      document.body.classList.remove('ec-arrastrando');
      card.classList.remove('arrastrando');

      // Se mide con la tarjeta todavía pegada al puntero, para animarla
      // también a ella al caer en su lugar.
      const antes = box ? medir(box) : null;
      if (antes) antes.set(card, card.getBoundingClientRect());
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.width = '';
      card.style.height = '';
      card.style.margin = '';
      card.style.zIndex = '';
      card.style.pointerEvents = '';

      if (!box) { hueco.remove(); card.remove(); return; }
      box.insertBefore(card, hueco);
      hueco.remove();
      animarDesde(box, antes);

      if (!movido) return;
      sincronizarOrden(box);
      marcar();
    }

    function tarjeta(it, idx, esSub){
      const oculta = it.oculta === true;
      const n = esSub ? usanCat(it.slug) : usanTodo(it);
      return `
        <div class="ec-card${oculta ? ' oculta' : ''}" data-idx="${idx}" data-sub="${esSub ? 1 : 0}">
          <button type="button" class="ec-mano" data-mano="${idx}" aria-label="Arrastrar para cambiar el orden" title="Arrastra para cambiar el orden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6.5a1.5 1.5 0 0 1 3 0V11m0 0V5.5a1.5 1.5 0 0 1 3 0V11m0 0V7a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 6.5-6 6.5h-1a6 6 0 0 1-4.6-2.2L4 14.4a1.6 1.6 0 0 1 2.4-2.1L9 15"/></svg>
          </button>
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
          ? 'Las subcategorías de <b>' + escH(dentro.nombre) + '</b>. La foto se ve en círculo dentro del menú, así que conviene <b>cuadrada, de 400 × 400</b>, con el producto al centro. Arrastra la <b>manito</b> para cambiar el orden en que aparecen.'
          : 'Cambia la foto y el nombre de cada una. La foto se ve en círculo dentro del menú: conviene <b>cuadrada, de 400 × 400</b>. El ojo decide si aparece en la tienda: lo que apagas se guarda igual, solo deja de verse. Arrastra la <b>manito</b> para cambiar el orden del menú.'}</p>
        <div class="ec-grid">
          ${items.map((it, i) => tarjeta(it, i, esSub)).join('')}
          <button type="button" class="ec-nueva" id="ecNueva">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>${dentro ? 'Subcategoría nueva' : 'Categoría nueva'}</span>
          </button>
        </div>`;

      const lista = () => estado.dentro !== null ? estado.arbol[estado.dentro].subs : estado.arbol;

      // El arrastre se conecta por tarjeta; los oyentes de mover/soltar se
      // ponen en document solo mientras dura el arrastre (la tarjeta viaja
      // fuera de la grilla y sus eventos ya no pasan por la caja).
      box.querySelectorAll('[data-mano]').forEach(m => m.addEventListener('pointerdown', agarrar));

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
          toast('No se puede eliminar: tiene ' + cuantos(n).toLowerCase() + ' adentro. Puedes ocultarla.', true);
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
          <p class="venta-vacio" style="margin-top:12px">Se crea vacía y después le pones la foto.</p>
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
        const arbol = estado.arbol.map((c, i) => ({
          ...c,
          orden: i + 1,
          subs: c.subs.map((s, j) => ({ ...s, orden: j + 1 })),
        }));
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
