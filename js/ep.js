// ep
'use strict';
/* ============================================================================
 *  EdProducto — editar un producto sin salir de la tienda.
 *  Es el reemplazo de la pestaña Catálogo del panel viejo: misma lógica de
 *  guardado, pero el admin ve el cambio en la página al instante.
 * ========================================================================== */
const EdProducto = (() => {
  const { escH, slug: slugify, rid, toast, confirmar, mensajeError, uploadFile } = EdUtil;
  const sb = window.sb;

  // Campo vacío significa que ese producto no lleva inventario.
  const unidades = f => f.unidades.value.trim() === '' ? null : Math.max(0, parseInt(f.unidades.value, 10) || 0);

  const precioDe = s => {
    const t = PRICE_TIERS[s] || [];
    return t.length ? t[0].price : 0;
  };

  function montarAnclas(){
    const sec = document.getElementById('mas');
    if (sec && !sec.querySelector('[data-editar="producto-nuevo"]')) {
      const caja = document.createElement('div');
      caja.className = 'ed-ancla';
      caja.innerHTML = `
        <button type="button" class="ed-btn" data-editar="producto-nuevo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Producto nuevo
        </button>`;
      sec.appendChild(caja);
    }
    // El lápiz de la ficha se monta una sola vez: populate() escribe dentro de
    // los nodos pero nunca reemplaza sus contenedores.
    const info = document.getElementById('ppageInfo');
    if (info && !info.querySelector('[data-editar="ficha"]')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-btn';
      b.dataset.editar = 'ficha';
      b.style.marginTop = '16px';
      b.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        Editar este producto`;
      info.appendChild(b);
    }
  }

  /* ── Panel de edición ─────────────────────────────────── */
  function abrir(s){
    const p = findProduct(s);
    if (!p) { toast('No se encontró ese producto', true); return; }

    const fotos = (GALLERY[s] || [p.image]).filter(Boolean);
    const caracts = FEATURES[s] || [];

    const cuerpo = `
      <form id="edForm">
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Nombre</span>
            <input type="text" name="nombre" value="${escH(p.name)}" required>
          </label>
          <label class="venta-f"><span>Precio</span>
            <input type="number" name="precio" min="0" step="1" value="${precioDe(s)}" required>
          </label>
          <label class="venta-f"><span>Precio anterior (opcional)</span>
            <input type="number" name="antes" min="0" step="1" value="${p.compare ?? ''}" placeholder="Para el chip de descuento">
          </label>
          <div class="venta-f venta-ancho"><span>Categoría</span>
            ${Sesion.desplegable('cat', Cats.planas().map(c => ({ valor:c.slug, texto:c.nombre })), Cats.nombre(p.cat))}
          </div>
          <label class="venta-f venta-ancho"><span>Descripción</span>
            <textarea name="desc" rows="3">${escH(p.desc)}</textarea>
          </label>
        </div>

        <p class="venta-sec">Fotos</p>
        <div class="ed-fotos" id="edFotos"></div>

        <p class="venta-sec">Características</p>
        <div class="ed-lista" id="edCaracts"></div>
        <button type="button" class="ed-btn ghost" id="edMasCaract" style="margin-top:10px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Agregar característica
        </button>

        <p class="venta-sec">Stock</p>
        <div class="venta-g2">
          <label class="venta-f venta-ancho"><span>Unidades disponibles</span>
            <input type="number" name="unidades" min="0" step="1" value="${p.stock ?? (p.inStock === false ? 0 : '')}" placeholder="Dejalo vacío para no llevar la cuenta">
            <small class="ep-stock-ayuda" id="epStockAyuda"></small>
          </label>
        </div>
        <p class="venta-msg" id="edMsg"></p>
      </form>`;

    const pie = `
      <button type="button" class="venta-btn borrar" id="edBorrar">Eliminar</button>
      <button type="submit" form="edForm" class="venta-btn">Guardar</button>`;

    const { ov, cerrar } = Sesion.panel(p.name, 'Editar producto', cuerpo, pie);
    const f = ov.querySelector('#edForm');

    const estado = { fotos: fotos.slice(), caracts: caracts.slice(), cat: p.cat };
    Sesion.conectarDesplegables(ov, (campo, valor) => { if (campo === 'cat') estado.cat = valor; });

    const ayuda = ov.querySelector('#epStockAyuda');
    const pintarAyuda = () => {
      const n = unidades(f);
      if (n === null)  { ayuda.textContent = 'Sin control de stock: el producto siempre se ofrece.'; ayuda.className = 'ep-stock-ayuda'; }
      else if (n === 0){ ayuda.textContent = 'En cero: el producto se muestra en gris y con el cartel AGOTADO.'; ayuda.className = 'ep-stock-ayuda sin'; }
      else if (n <= 5) { ayuda.textContent = 'Quedan pocas: ' + n + (n === 1 ? ' unidad.' : ' unidades.'); ayuda.className = 'ep-stock-ayuda poco'; }
      else             { ayuda.textContent = n + ' unidades a la venta.'; ayuda.className = 'ep-stock-ayuda'; }
    };
    f.unidades.addEventListener('input', pintarAyuda);
    pintarAyuda();

    pintarFotos(ov, estado);
    pintarCaracts(ov, estado);
    ov.querySelector('#edMasCaract').addEventListener('click', () => {
      estado.caracts.push('');
      pintarCaracts(ov, estado);
    });

    ov.querySelector('#edBorrar').addEventListener('click', async () => {
      const si = await confirmar('¿Eliminar "' + p.name + '"? No se puede deshacer.');
      if (si) { await borrar(s); cerrar(); }
    });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = ov.querySelector('button[type=submit]');
      const msg = ov.querySelector('#edMsg');
      btn.disabled = true; btn.textContent = 'Guardando…';
      msg.className = 'venta-msg'; msg.textContent = '';
      const n = unidades(f);
      try {
        await guardar(s, {
          name: f.nombre.value,
          category: estado.cat,
          description: f.desc.value,
          image: estado.fotos[0] || '',
          gallery: estado.fotos.slice(1),
          features: estado.caracts,
          precio: parseInt(f.precio.value, 10) || 0,
          compare_at_price: f.antes.value === '' ? null : (parseInt(f.antes.value, 10) || null),
          stock_qty: n,
          in_stock: n === null ? true : n > 0,
        });
        toast('Producto guardado');
        cerrar();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  function pintarFotos(ov, estado){
    const box = ov.querySelector('#edFotos');
    box.innerHTML = estado.fotos.map((src, i) => `
      <div class="ed-foto${i === 0 ? ' principal' : ''}">
        <img src="${escH(src)}" alt="" onerror="this.style.visibility='hidden'">
        <button type="button" data-i="${i}" aria-label="Quitar foto">&times;</button>
        ${i === 0 ? '<span class="ed-foto-tag">Principal</span>' : ''}
      </div>`).join('') + `
      <label class="ed-subir">+
        <input type="file" accept="image/*" multiple>
      </label>`;

    box.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => {
      estado.fotos.splice(+b.dataset.i, 1);
      pintarFotos(ov, estado);
    }));
    box.querySelector('.ed-subir input').addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      toast('Subiendo ' + files.length + (files.length === 1 ? ' foto…' : ' fotos…'));
      try {
        for (const file of files) estado.fotos.push(await uploadFile(file, 'catalog/'));
        pintarFotos(ov, estado);
        toast('Fotos listas');
      } catch (err) { toast(mensajeError(err), true); }
      e.target.value = '';
    });
  }

  function pintarCaracts(ov, estado){
    const box = ov.querySelector('#edCaracts');
    box.innerHTML = estado.caracts.map((c, i) => `
      <div class="ed-lista-fila">
        <input type="text" value="${escH(c)}" data-i="${i}" placeholder="Ej: Libre de BPA">
        <button type="button" data-del="${i}" aria-label="Quitar">&times;</button>
      </div>`).join('') || '<p class="venta-vacio">Sin características todavía.</p>';

    box.querySelectorAll('input[data-i]').forEach(inp =>
      inp.addEventListener('input', e => { estado.caracts[+e.target.dataset.i] = e.target.value; }));
    box.querySelectorAll('button[data-del]').forEach(b =>
      b.addEventListener('click', () => { estado.caracts.splice(+b.dataset.del, 1); pintarCaracts(ov, estado); }));
  }

  /* ── Base de datos ────────────────────────────────────── */
  async function guardar(s, d){
    const p = findProduct(s);
    const { data, error } = await sb.from('products').update({
      name: d.name.trim(),
      category: d.category,
      description: d.description,
      image: d.image,
      gallery: d.gallery,
      features: d.features.filter(f => f.trim() !== ''),
      compare_at_price: d.compare_at_price,
      stock_qty: d.stock_qty,
      in_stock: d.in_stock,
    }).eq('id', p.id).select('*, price_tiers(qty,price,active)').maybeSingle();
    if (error) throw error;
    // Con RLS, una cuenta sin permiso no da error: devuelve cero filas.
    if (!data) throw new Error('SIN_PERMISO');

    await sb.from('price_tiers').delete().eq('product_id', p.id);
    const { error: e2 } = await sb.from('price_tiers')
      .insert({ product_id: p.id, qty: 1, price: d.precio, active: true });
    if (e2) throw e2;
    data.price_tiers = [{ qty: 1, price: d.precio, active: true }];

    aplicarProducto(data);
    refrescar(s);
  }

  async function crear(){
    const cuerpo = `
      <form id="edNuevo">
        <label class="venta-f venta-ancho"><span>Nombre del producto</span>
          <input type="text" name="nombre" required placeholder="Ej: Set de Ollas 5 Piezas">
        </label>
        <p class="venta-vacio" style="margin-top:12px">Se crea vacío y enseguida se abre para que le pongas precio y fotos.</p>
        <p class="venta-msg" id="nuevoMsg"></p>
      </form>`;
    const { ov, cerrar } = Sesion.panel('Producto nuevo', 'Catálogo', cuerpo,
      '<button type="submit" form="edNuevo" class="venta-btn">Crear</button>');
    const f = ov.querySelector('#edNuevo');
    f.nombre.focus();

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const nombre = f.nombre.value.trim();
      if (!nombre) return;
      const btn = ov.querySelector('.venta-btn');
      const msg = ov.querySelector('#nuevoMsg');
      btn.disabled = true; btn.textContent = 'Creando…';
      try {
        const s = (slugify(nombre) || 'producto') + '-' + rid();
        const pos = CATALOGO.reduce((m, p) => Math.max(m, p.position || 0), CATALOGO.length) + 1;
        const { data, error } = await sb.from('products')
          .insert({ slug: s, name: nombre, category: 'cocina', image_scale: 0.85, in_stock: true, position: pos })
          .select('*, price_tiers(qty,price,active)').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('SIN_PERMISO');
        await sb.from('price_tiers').insert({ product_id: data.id, qty: 1, price: 0, active: true });
        data.price_tiers = [{ qty: 1, price: 0, active: true }];
        aplicarProducto(data);
        refrescar(s);
        cerrar();
        toast('Producto creado');
        abrir(s);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Crear';
        msg.className = 'venta-msg err';
        msg.textContent = mensajeError(err);
      }
    });
  }

  async function borrar(s){
    const p = findProduct(s);
    if (!p) return;
    try {
      const { error } = await sb.from('products').delete().eq('id', p.id);
      if (error) throw error;
      quitarProducto(s);
      const ficha = document.getElementById('ppage');
      if (ficha && ficha.dataset.slug === s) document.getElementById('ppageBack')?.click();
      refrescar(s);
      toast('Producto eliminado');
    } catch (err) { toast(mensajeError(err), true); }
  }

  // Repinta todo lo que puede estar mostrando este producto, sin recargar.
  function refrescar(s){
    Filas.init();
    if (CatPage.estaAbierta()) CatPage.abrir(CatPage.catActual());
    const ficha = document.getElementById('ppage');
    if (ficha && ficha.dataset.slug === s && ficha.style.display !== 'none') ProductModal.irA(s);
    Trust.decorarTarjetas();
    Edicion.remontar();
  }

  Edicion.registrar(montarAnclas);

  return { abrir, crear, borrar, guardar };
})();
