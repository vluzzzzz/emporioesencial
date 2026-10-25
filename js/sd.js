// sd
'use strict';
const HERO_STOCK = {};
// ── FALLBACK hardcodeado ──────────────────────────────────────────────────
// Si Supabase no está configurado o falla, la web usa estos datos y NO se
// rompe. loadCatalog() los sobreescribe cuando Supabase responde.
// Las 4 fotos del emporio, repetidas en todo el catálogo mientras se cargan
// los productos reales con el modo edición.
const IMG = {
  soplador:'images/emporio-images/1.webp',
  cocina:'images/emporio-images/2.webp',
  cera:'images/emporio-images/3.webp',
  limpiavidrios:'images/emporio-images/4.webp',
};
let PRODUCTS=[
  {id:1,key:'set-tazones-colocolo',name:'Set 4 Tazones Colo-Colo',price:'$15.990',rawPrice:15990,image:'images/emporio-images/14.webp',bgLabel:'COLO-COLO',scale:0.9,offsetX:0,offsetY:0},
  {id:2,key:'schopero-frozen-colocolo',name:'Schopero Frozen Colo-Colo',price:'$9.990',rawPrice:9990,image:'images/emporio-images/21.webp',bgLabel:'SCHOPERO',scale:0.9,offsetX:0,offsetY:0},
  {id:3,key:'mug-rosado-colocolo',name:'Mug 1200 ml Colo-Colo',price:'$14.990',rawPrice:14990,image:'images/emporio-images/12.webp',bgLabel:'CAMPEONAS',scale:0.9,offsetX:0,offsetY:0},
];
const PRICE_TIERS={
  'soplador-bateria':[{qty:1,price:29990}],
  'set-cocina-silicona':[{qty:1,price:10000}],
  'calentador-cera':[{qty:1,price:12990}],
  'limpiavidrios-telescopico':[{qty:1,price:4990}],
  'botella-sorbete-colocolo':[{qty:1,price:7990}],
  'bolsa-reutilizable-colocolo':[{qty:1,price:3990}],
  'mug-termico-colocolo':[{qty:1,price:8990}],
  'cojin-cuello-colocolo':[{qty:1,price:9990}],
  'jarro-cerveza-colocolo':[{qty:1,price:7490}],
  'tabla-picar-colocolo':[{qty:1,price:11990}],
  'schopero-colocolo':[{qty:1,price:6990}],
  'mug-rosado-colocolo':[{qty:1,price:14990}],
  'cojin-escudo-colocolo':[{qty:1,price:10990}],
  'set-tazones-colocolo':[{qty:1,price:15990}],
  'llavero-colocolo':[{qty:1,price:2990}],
  'vaso-sorbete-colocolo':[{qty:1,price:5990}],
  'set-vaso-destapador-colocolo':[{qty:1,price:12990}],
  'billetera-colocolo':[{qty:1,price:9990}],
  'vaso-schopero-campeon-colocolo':[{qty:1,price:6490}],
  'shaker-colocolo':[{qty:1,price:10990}],
  'schopero-frozen-colocolo':[{qty:1,price:9990}],
  'gorro-colocolo':[{qty:1,price:8990}],
  'adorno-escudo-colocolo':[{qty:1,price:13990}],
};
const getUnitPrice=(key,qty)=>{const t=PRICE_TIERS[key];if(!t||!t.length)return 0;let p=t[0].price;for(const r of t)if(qty>=r.qty)p=r.price;return p;};

/* ── CATÁLOGO ───────────────────────────────────────────────────────────────
   Única fuente de productos de toda la web. De acá salen la fila de ofertas,
   el panel de categorías, el buscador y los productos similares de la ficha.
   Antes las tarjetas estaban escritas a mano en index.html y cada sección
   leía del HTML de la otra; por eso al abrir un similar se armaba una tarjeta
   distinta en vez de reusar la misma. Ahora todas salen del mismo lugar.
   loadCatalog() lo reemplaza entero si Supabase responde.                   */
const CATALOGO = [
  {slug:'soplador-bateria',               cat:'herramientas', name:'Soplador / Ventilador a Batería 18V',        image:'images/emporio-images/1.webp',  desc:'Soplador inalámbrico potente de 18V. Ideal para limpieza y secado. Incluye batería y cargador.'},
  {slug:'set-cocina-silicona',            cat:'cocina',       name:'Set de Cocina de Silicona 12 Piezas',        image:'images/emporio-images/2.webp',  desc:'Set completo de utensilios de cocina de silicona con mango de madera. Resistentes al calor y antiadherentes.'},
  {slug:'calentador-cera',                cat:'belleza',      name:'Calentador de Cera Profesional',             image:'images/emporio-images/3.webp',  desc:'Calentador de cera profesional para todo tipo de ceras. Incluye contenedor de aluminio y control de temperatura.'},
  {slug:'limpiavidrios-telescopico',      cat:'limpieza',     name:'Limpiavidrios Telescópico',                  image:'images/emporio-images/4.webp',  desc:'Limpiavidrios telescópico extensible de 21 a 86 cm. Mango antideslizante y correa de seguridad.'},
  {slug:'botella-sorbete-colocolo',       cat:'cocina',       name:'Botella con Sorbete Colo-Colo',              image:'images/emporio-images/5.webp',  desc:'Botella de hidratación Colo-Colo con sorbete y tapa con cierre. Libre de BPA.'},
  {slug:'bolsa-reutilizable-colocolo',    cat:'hogar',        name:'Bolsa Reutilizable Colo-Colo',               image:'images/emporio-images/6.webp',  desc:'Bolsa reutilizable resistente con diseño Colo-Colo. Asas reforzadas para el día a día.'},
  {slug:'mug-termico-colocolo',           cat:'cocina',       name:'Mug Térmico Colo-Colo',                      image:'images/emporio-images/7.webp',  desc:'Mug térmico de acero inoxidable que mantiene la temperatura. Diseño Colo-Colo Eterno Campeón.'},
  {slug:'cojin-cuello-colocolo',          cat:'hogar',        name:'Cojín de Cuello Colo-Colo',                  image:'images/emporio-images/8.webp',  desc:'Cojín de cuello cómodo para viajes y descanso, con diseño Colo-Colo.'},
  {slug:'jarro-cerveza-colocolo',         cat:'cocina',       name:'Jarro de Cerveza Colo-Colo',                 image:'images/emporio-images/9.webp',  desc:'Jarro de vidrio resistente de gran capacidad con diseño Colo-Colo Eterno Campeón.'},
  {slug:'tabla-picar-colocolo',           cat:'cocina',       name:'Tabla de Picar de Madera Colo-Colo',         image:'images/emporio-images/10.webp', desc:'Tabla de picar de madera con grabado Colo-Colo y colgador de cuero. Resistente para el uso diario.'},
  {slug:'schopero-colocolo',              cat:'cocina',       name:'Schopero 500 ml Colo-Colo',                  image:'images/emporio-images/11.webp', desc:'Schopero de vidrio de 500 ml con asa y diseño Colo-Colo. Ideal para la previa.'},
  {slug:'mug-rosado-colocolo',            cat:'cocina',       name:'Mug 1200 ml Colo-Colo Campeonas',            image:'images/emporio-images/12.webp', desc:'Mug de 1200 ml con bombilla y asa, edición Campeonas. Libre de BPA.'},
  {slug:'cojin-escudo-colocolo',          cat:'hogar',        name:'Cojín Escudo Colo-Colo',                     image:'images/emporio-images/13.webp', desc:'Cojín decorativo con forma de escudo Colo-Colo. Suave y resistente.'},
  {slug:'set-tazones-colocolo',           cat:'cocina',       name:'Set 4 Tazones Cerámica Colo-Colo',           image:'images/emporio-images/14.webp', desc:'Set de 4 tazones de cerámica de 400 ml con soporte, diseño Colo-Colo.'},
  {slug:'llavero-colocolo',               cat:'accesorios',   name:'Llavero Colo-Colo',                          image:'images/emporio-images/15.webp', desc:'Llavero metálico resistente con diseño Colo-Colo. Compacto y elegante.'},
  {slug:'vaso-sorbete-colocolo',          cat:'cocina',       name:'Vaso con Sorbete y Tapa Colo-Colo',          image:'images/emporio-images/16.webp', desc:'Vaso con tapa y sorbete, diseño Colo-Colo. Reutilizable y práctico.'},
  {slug:'set-vaso-destapador-colocolo',   cat:'cocina',       name:'Set Vaso de Cerveza + Destapador Colo-Colo', image:'images/emporio-images/17.webp', desc:'Set de regalo con vaso de cerveza y destapador, diseño Colo-Colo.'},
  {slug:'billetera-colocolo',             cat:'accesorios',   name:'Billetera Colo-Colo',                        image:'images/emporio-images/18.webp', desc:'Billetera de material PU con varios compartimentos y diseño Colo-Colo. Incluye caja de regalo.'},
  {slug:'vaso-schopero-campeon-colocolo', cat:'cocina',       name:'Vaso Schopero Campeón Colo-Colo',            image:'images/emporio-images/19.webp', desc:'Vaso schopero de vidrio resistente con diseño "Campeón hay uno solo" Colo-Colo.'},
  {slug:'shaker-colocolo',                cat:'cocina',       name:'Botella Shaker Deportiva Colo-Colo',         image:'images/emporio-images/20.webp', desc:'Botella deportiva tipo shaker con tapa hermética y asa, diseño Colo-Colo.'},
  {slug:'schopero-frozen-colocolo',       cat:'cocina',       name:'Schopero Frozen Colo-Colo',                  image:'images/emporio-images/21.webp', desc:'Schopero congelable con gel interior que mantiene tu bebida fría. Diseño Colo-Colo.'},
  {slug:'gorro-colocolo',                 cat:'accesorios',   name:'Gorro Bucket Colo-Colo',                     image:'images/emporio-images/22.webp', desc:'Gorro bucket de algodón con bordado Colo-Colo. Talla única.'},
  {slug:'adorno-escudo-colocolo',         cat:'hogar',        name:'Adorno Escudo Colo-Colo Eterno Campeón',     image:'images/emporio-images/23.webp', desc:'Adorno decorativo del escudo Colo-Colo en 3D, Eterno Campeón. Base estable para repisa o escritorio.'},
];

// Si Supabase no trae categoría, se deduce de la primera palabra del slug.
const FAMILIAS = {set:'cocina', calentador:'belleza', kit:'belleza', espejo:'belleza', soplador:'herramientas', taladro:'herramientas', limpiavidrios:'limpieza', mopa:'limpieza'};
const familiaDe = slug => FAMILIAS[String(slug||'').split('-')[0]] || 'otros';

const findProduct  = slug => CATALOGO.find(p => p.slug === slug) || null;
const porCategoria = cat  => CATALOGO.filter(p => Cats.incluye(cat, p.cat));

function fmt(n){ return '$'+n.toLocaleString('es-CL'); }

// ¿El usuario pidió menos movimiento en su sistema? Se respeta.
function reduceMotion(){
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o')
    .replace(/[úü]/g, 'u')
    .replace(/[^a-z0-9-]/g, '');
}

// ── Catálogo desde Supabase + render dinámico ──────────────────────────────
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

// Para texto que va DENTRO de una etiqueta. escAttr no alcanza: no escapa < ni >,
// así que un texto escrito a mano con "<" rompería el HTML.
function escTxt(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function colorDots(slug){
  const todos=(typeof COLOR_VARIANTS!=='undefined')?COLOR_VARIANTS[slug]:null;
  if(!todos)return '';
  // En la tarjeta solo van los disponibles: el punto mide doce píxeles y una
  // marca de agotado ahí no se entiende. El aviso va en la ficha.
  const cv=todos.filter(v=>!v.agotado);
  if(!cv.length)return '';
  return '<div class="card-colors">'+cv.map(v=>`<span class="card-color-dot">${v.swatch?`<img src="${escAttr(v.swatch)}" alt="${escAttr(v.name)}">`:`<span style="display:block;width:100%;height:100%;border-radius:50%;background:${v.hex}"></span>`}</span>`).join('')+'</div>';
}

// Precio anterior y stock. Van como data-* para que js/tr.js los lea después.
// Si Supabase no trae la columna, no se escribe el atributo y no se muestra nada.
function extraData(p){
  let out = p.cat ? ` data-cat="${escAttr(p.cat)}"` : '';
  if (p.compare != null && p.compare !== '') out += ` data-compare="${Number(p.compare)}"`;
  if (p.stock   != null && p.stock   !== '') out += ` data-stock="${Number(p.stock)}"`;
  return out;
}

// El pie de la home, copiado dentro de otra sección que se abre encima (la
// ficha de producto y la de categoría). Así se escribe una sola vez: lo que
// cambies en el <footer> de index.html sale en las tres.
// Los id del clon se borran, porque un id repetido rompe getElementById.
function clonarPieEn(destinoId){
  const destino=document.getElementById(destinoId),pie=document.querySelector('body > .footer');
  if(!destino||!pie||destino.childElementCount)return;
  const copia=pie.cloneNode(true);
  copia.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  destino.appendChild(copia);
}

function tierOne(slug){
  const t = PRICE_TIERS[slug] || [];
  return (t.find(x => x.qty === 1) || t[0] || {}).price || 0;
}

// Precio por unidad llevando n unidades (el tramo mayorista que ya se controla
// en el panel). Si no hay un tramo para esa cantidad, devuelve el de 1 unidad.
function tierDesde(slug, n){
  const t = PRICE_TIERS[slug] || [];
  if (!t.length) return 0;
  let p = (t.find(x => x.qty === 1) || t[0]).price || 0;
  t.forEach(r => { if (n >= r.qty) p = r.price; });
  return p;
}

const ICONO_CARRO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 14h9.5c.8 0 1.5-.5 1.7-1.2l3-7H6.2L5.3 3H1v2h3l3.6 7.6-1.3 2.4c-.1.2-.2.5-.2.8 0 1.1.9 2 2 2h12v-2H8.4c-.1 0-.2-.1-.2-.2l.03-.12L9.1 14z"/></svg>';

// Tarjeta comercial: nombre, estrellas (las pone js/tr.js), "desde", precio
// grande y botón de carrito. El clic en cualquier otra parte abre la ficha.
function cardHTML(p, opts){
  const oferta = !!(opts && opts.oferta);
  const p1  = tierOne(p.slug);
  const p3  = oferta ? tierDesde(p.slug, 3) : p1;
  const hayDcto = oferta && p3 > 0 && p3 < p1;
  const precioBase = hayDcto ? p3 : p1;
  const sin = p.inStock === false;
  const oos = sin ? '<div class="oos-tag">AGOTADO</div>' : '';
  return `<div class="product-card temu-card${sin ? ' out-of-stock' : ''}" data-id="${escAttr(p.slug)}" data-name="${escAttr(p.name)}" data-price="${p1}" data-raw="${p1}"${extraData(p)} data-img-scale="${p.imgScale ?? 0.75}" data-desc="${escAttr(p.desc)}"${sin ? ' aria-disabled="true"' : ''}>
      <div class="card-img-wrap"><img src="${escAttr(p.image)}" alt="${escAttr(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><svg class="card-img-placeholder" style="display:none" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${oos}</div>
      <div class="card-info">
        <p class="card-name">${escTxt(p.name)}</p>
        <div class="card-foot">
          <div class="card-precio-col">
            <p class="card-price">${fmt(precioBase)}</p>
            ${hayDcto ? `<span class="dcto"><s class="dcto-antes">${fmt(p1)}</s><span class="dcto-chip">-${Math.round((1 - p3 / p1) * 100)}%</span></span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function slideHTML(p,i){
  const p1 = tierOne(p.slug);
  // Mismo nombre e imagen que el producto → grilla y carrusel quedan conectados.
  const name = p.name;
  const img  = p.image;
  const tag  = p.featured_tag || 'Destacado';   // etiqueta opcional del carrusel
  const out = p.in_stock === false ? ' out-of-stock' : '';
  const dis = p.in_stock === false ? ' aria-disabled="true"' : '';
  const btn = p.in_stock === false ? 'Sin stock' : 'Ver más';
  const oos = p.in_stock === false ? '<div class="oos-tag">AGOTADO</div>' : '';
  const mid = 'mfx' + i;
  return `<div class="swiper-slide csl-slide${out}" data-id="${escAttr(p.slug)}" data-name="${escAttr(name)}" data-price="${p1}" data-raw="${p1}"${extraData(p)} data-img-scale="${p.image_scale ?? 0.75}" data-desc="${escAttr(p.description)}"${dis}>
      <div class="csl-corner"><svg width="31" height="31" viewBox="0 0 31 31" fill="none"><g opacity="0.35"><mask id="${mid}" fill="white"><path d="M30.6 1L1.6 0L0.7 29L29.7 30L30.6 1Z"/></mask><path d="M30.6 1L30.65 -0.47L32.2 -0.42L32.15 1.09L30.6 1ZM30.55 2.55L1.6 1.59L1.7 -1.43L30.65 -0.47L30.55 2.55ZM28.17 29.98L29.13 0.99L32.15 1.09L31.19 30.08L28.17 29.98Z" fill="white" mask="url(#${mid})"/></g></svg></div>
      <span class="csl-tag">${escAttr(tag)}</span>
      <div class="csl-img"><img src="${escAttr(img)}" alt="${escAttr(name)}" loading="lazy">${oos}</div>
      <h3 class="csl-name">${escAttr(name)}</h3>
      <span class="csl-price">${fmt(p1)}</span>
      <button class="csl-rect">${btn}</button>
    </div>`;
}

// Las fotos del repositorio pasaron a WebP. Si la base todavía guarda la ruta
// vieja, se corrige al vuelo para que no se vea una imagen rota mientras no se
// corra supabase/imagenes-webp.sql.
const aWebp = u => String(u || '').replace(/^(images\/emporio-images\/[0-9.]+)\.(jpeg|jpg|png)$/i, '$1.webp');

// Vuelca UNA fila de products a todo lo que la web tiene en memoria. La usa
// loadCatalog al arrancar, y el modo edición para refrescar un solo producto
// sin recargar la página.
function aplicarProducto(p){
  const tiers = (p.price_tiers || [])
    .filter(t => t.active !== false && t.price > 0)
    .sort((a,b)=>a.qty-b.qty)
    .map(t=>({ qty:t.qty, price:t.price }));
  if (tiers.length) PRICE_TIERS[p.slug] = tiers; else delete PRICE_TIERS[p.slug];
  FEATURES[p.slug] = p.features || [];
  // imágenes del detalle = principal + secundarias (galería)
  GALLERY[p.slug] = [p.image, ...(p.gallery || [])].filter(Boolean).map(aWebp);
  // Colores desde el panel. Sin ellos se respeta lo que esté escrito acá
  // abajo en COLOR_VARIANTS, si no los colores aparecían un instante y se
  // borraban al llegar la respuesta de la base.
  const cols = Array.isArray(p.colors) ? p.colors.filter(c => c && c.img) : [];
  if (cols.length) COLOR_VARIANTS[p.slug] = cols;

  const fila = {
    id: p.id,
    slug: p.slug,
    cat: p.category || familiaDe(p.slug),
    name: p.name,
    image: aWebp(p.image),
    desc: p.description || '',
    imgScale: p.image_scale ?? 0.75,
    compare: p.compare_at_price,
    stock: p.stock_qty,
    inStock: p.in_stock !== false,
  };
  const i = CATALOGO.findIndex(x => x.slug === p.slug);
  if (i >= 0) CATALOGO[i] = fila; else CATALOGO.push(fila);
  return fila;
}

function quitarProducto(slug){
  const i = CATALOGO.findIndex(x => x.slug === slug);
  if (i >= 0) CATALOGO.splice(i, 1);
  delete PRICE_TIERS[slug];
  delete FEATURES[slug];
  delete GALLERY[slug];
  delete COLOR_VARIANTS[slug];
}

async function loadCatalog(){
  if (!window.sb) return false;   // Supabase no configurado → se queda el fallback (demo de hogar)
  try {
    const { data, error } = await window.sb
      .from('products')
      .select('*, price_tiers(qty,price,active)')
      .order('position', { ascending: true });
    if (error) throw error;
    const products = data || [];
    if (!products.length) return false;   // sin datos → se queda el fallback

    CATALOGO.length = 0;
    products.forEach(aplicarProducto);

    // HERO (carrusel principal)
    PRODUCTS.length = 0;
    Object.keys(HERO_STOCK).forEach(k => delete HERO_STOCK[k]);
    products.filter(p => p.is_hero)
      .sort((a,b)=>(a.hero_order||0)-(b.hero_order||0))
      .forEach((p, idx) => {
        const p1 = tierOne(p.slug);
        const heroName = p.hero_name || p.name;
        PRODUCTS.push({
          id: idx + 1, key: p.slug, name: heroName,
          price: fmt(p1), rawPrice: p1, image: aWebp(p.hero_image || p.image),
          bgLabel: p.hero_bg_label || (p.name || '').toUpperCase(),
          scale: p.hero_scale ?? 1, offsetX: p.hero_offset_x ?? 0, offsetY: p.hero_offset_y ?? 0,
        });
        HERO_STOCK[heroName] = p.in_stock !== false;
      });

    document.body.classList.add('sheet-ready');
    return true;
  } catch (err) {
    console.error('❗ No se pudo cargar el catálogo desde Supabase:', err);
    document.body.classList.add('sheet-ready');
    return false;
  }
}


const FEATURES={
  'soplador-bateria':['Batería 18V','Inalámbrico','Incluye cargador','Alto rendimiento'],
  'set-cocina-silicona':['12 piezas','Silicona apta para alimentos','Mango de madera','Incluye soporte'],
  'calentador-cera':['Uso profesional','Control de temperatura','Contenedor de aluminio','Tapa transparente'],
  'limpiavidrios-telescopico':['Extensible 21–86 cm','Mango antideslizante','Correa de seguridad','Liviano'],
  'botella-sorbete-colocolo':['Diseño Colo-Colo','Con sorbete','Tapa con cierre','Libre de BPA'],
  'bolsa-reutilizable-colocolo':['Reutilizable','Resistente','Diseño Colo-Colo','Asas reforzadas'],
  'mug-termico-colocolo':['Mantiene la temperatura','Acero inoxidable','Diseño Colo-Colo','Tapa segura'],
  'cojin-cuello-colocolo':['Cómodo','Para viajes','Diseño Colo-Colo','Suave al tacto'],
  'jarro-cerveza-colocolo':['Vidrio resistente','Gran capacidad','Diseño Colo-Colo','Asa firme'],
  'tabla-picar-colocolo':['Madera resistente','Grabado Colo-Colo','Uso diario','Con colgador'],
  'schopero-colocolo':['500 ml','Vidrio resistente','Diseño Colo-Colo','Asa cómoda'],
  'mug-rosado-colocolo':['1200 ml','Con bombilla','Libre de BPA','Edición Campeonas'],
  'cojin-escudo-colocolo':['Forma de escudo','Suave','Diseño Colo-Colo','Decorativo'],
  'set-tazones-colocolo':['4 tazones','Cerámica 400 ml','Con soporte','Diseño Colo-Colo'],
  'llavero-colocolo':['Diseño Colo-Colo','Resistente','Compacto','Metálico'],
  'vaso-sorbete-colocolo':['Con sorbete','Tapa con cierre','Diseño Colo-Colo','Reutilizable'],
  'set-vaso-destapador-colocolo':['Vaso de cerveza','Incluye destapador','Set de regalo','Diseño Colo-Colo'],
  'billetera-colocolo':['Material PU','Varios compartimentos','Diseño Colo-Colo','Caja de regalo'],
  'vaso-schopero-campeon-colocolo':['Vidrio resistente','Campeón hay uno solo','Diseño Colo-Colo','Gran capacidad'],
  'shaker-colocolo':['Botella deportiva','Tapa hermética','Diseño Colo-Colo','Con asa'],
  'schopero-frozen-colocolo':['Se congela','Mantiene frío','Diseño Colo-Colo','Gel interior'],
  'gorro-colocolo':['Gorro bucket','Bordado Colo-Colo','Talla única','Algodón'],
  'adorno-escudo-colocolo':['Escudo 3D','Eterno Campeón','Decorativo','Base estable'],
};
const GALLERY={
  'adorno-escudo-colocolo':['images/emporio-images/23.webp','images/emporio-images/23.1.webp'],
  'tabla-picar-colocolo':['images/emporio-images/10.webp','images/emporio-images/10.2.webp','images/emporio-images/10.3.webp','images/emporio-images/10.4.webp'],
};
// Variantes de color — SOLO los slugs listados acá muestran colores (dots + selector + validación).
/* Cada color lleva 'agotado'. En true sigue a la vista pero en gris y no se
   puede elegir, y se vuelve a encender sin perder las fotos. */
const COLOR_VARIANTS={};
const PRODUCT_CONFIG={
  1:{fontSize:'22vw',productScale:1.1,productY:-15,blobYRatio:0.88,blobSpeed:0.030},
  2:{fontSize:'28vw',productScale:1.1,productY:-10,blobYRatio:0.88,blobSpeed:0.030},
  3:{fontSize:'24vw',productScale:1.1,productY:-20,blobYRatio:0.90,blobSpeed:0.030},
};
const state={current:0,isTransitioning:false,cart:[]};
const DOM={
  productImg:document.getElementById('productImg'),productWrap:document.getElementById('productWrap'),
  bgText:document.getElementById('bgText'),bgTextBlue:document.getElementById('bgTextBlue'),
  bgTextZoom:document.getElementById('bgTextZoom'),bgTextBlueWrap:document.getElementById('bgTextBlueWrap'),
  bgTextPerspective:document.querySelector('.bg-text-perspective'),priceBlock:document.querySelector('.price-block'),
  productPrice:document.getElementById('productPrice'),prevBtn:document.getElementById('prevBtn'),
  nextBtn:document.getElementById('nextBtn'),dotsWrap:document.getElementById('dots'),
  addToCart:document.getElementById('addToCart'),cartDrawer:document.getElementById('cartDrawer'),
  cartOverlay:document.getElementById('cartOverlay'),cartItems:document.getElementById('cartItems'),
  cartFooter:document.getElementById('cartFooter'),cartTotal:document.getElementById('cartTotal'),
  cartCount:document.getElementById('cartCount'),closeCart:document.getElementById('closeCart'),
  cartTrigger:document.querySelector('.cart-trigger'),
};
