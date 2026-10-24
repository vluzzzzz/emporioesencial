// sd
'use strict';
const HERO_STOCK = {};
// ── FALLBACK hardcodeado ──────────────────────────────────────────────────
// Si Supabase no está configurado o falla, la web usa estos datos y NO se
// rompe. loadCatalog() los sobreescribe cuando Supabase responde.
// Las 4 fotos del emporio, repetidas en todo el catálogo mientras se cargan
// los productos reales desde /admin.
const IMG = {
  soplador:'images/emporio-images/1.jpeg',
  cocina:'images/emporio-images/2.jpeg',
  cera:'images/emporio-images/3.jpeg',
  limpiavidrios:'images/emporio-images/4.jpeg',
};
let PRODUCTS=[
  {id:1,key:'set-cocina-silicona',name:'Set de Cocina de Silicona',price:'$10.000',rawPrice:10000,image:IMG.cocina,bgLabel:'COCINA',scale:0.9,offsetX:0,offsetY:0},
  {id:2,key:'calentador-cera',name:'Calentador de Cera',price:'$12.990',rawPrice:12990,image:IMG.cera,bgLabel:'BELLEZA',scale:0.9,offsetX:0,offsetY:0},
  {id:3,key:'soplador-bateria',name:'Soplador a Batería 18V',price:'$29.990',rawPrice:29990,image:IMG.soplador,bgLabel:'HERRAMIENTAS',scale:0.9,offsetX:0,offsetY:0},
];
const PRICE_TIERS={
  'set-cocina-silicona':[{qty:1,price:10000}],
  'utensilios-bambu':[{qty:1,price:8990}],
  'organizador-cocina':[{qty:1,price:7490}],
  'tabla-picar':[{qty:1,price:6990}],
  'set-cuchillos':[{qty:1,price:15990}],
  'rallador-multiuso':[{qty:1,price:4990}],
  'escurridor-platos':[{qty:1,price:9990}],
  'set-tapers':[{qty:1,price:12990}],
  'molde-silicona':[{qty:1,price:5990}],
  'dispensador-condimentos':[{qty:1,price:7990}],
  'calentador-cera':[{qty:1,price:12990}],
  'kit-depilacion':[{qty:1,price:9990}],
  'espejo-led':[{qty:1,price:14990}],
  'secador-cabello':[{qty:1,price:19990}],
  'plancha-pelo':[{qty:1,price:17990}],
  'set-brochas':[{qty:1,price:8990}],
  'masajeador-facial':[{qty:1,price:11990}],
  'rizador-pestanas':[{qty:1,price:3990}],
  'organizador-maquillaje':[{qty:1,price:10990}],
  'set-manicura':[{qty:1,price:6990}],
  'soplador-bateria':[{qty:1,price:29990}],
  'taladro-bateria':[{qty:1,price:34990}],
  'set-herramientas':[{qty:1,price:19990}],
  'destornillador-set':[{qty:1,price:7990}],
  'llave-ajustable':[{qty:1,price:5990}],
  'cinta-metrica':[{qty:1,price:3490}],
  'pistola-silicona':[{qty:1,price:8990}],
  'nivel-laser':[{qty:1,price:22990}],
  'caja-herramientas':[{qty:1,price:13990}],
  'multiherramienta':[{qty:1,price:9990}],
  'limpiavidrios-telescopico':[{qty:1,price:4990}],
  'mopa-giratoria':[{qty:1,price:15990}],
  'set-limpieza-hogar':[{qty:1,price:11990}],
  'escoba-recogedor':[{qty:1,price:7990}],
  'cepillo-electrico':[{qty:1,price:18990}],
  'panos-microfibra':[{qty:1,price:4990}],
  'limpiador-vapor':[{qty:1,price:27990}],
  'organizador-limpieza':[{qty:1,price:8990}],
  'aspiradora-mano':[{qty:1,price:24990}],
  'guantes-limpieza':[{qty:1,price:2990}],
};
const getUnitPrice=(key,qty)=>{const t=PRICE_TIERS[key];if(!t||!t.length)return 0;let p=t[0].price;for(const r of t)if(qty>=r.qty)p=r.price;return p;};

/* ── CATÁLOGO ───────────────────────────────────────────────────────────────
   Única fuente de productos de toda la web. De acá salen la fila de ofertas,
   el panel de categorías, el buscador y los productos similares de la ficha.
   Antes las tarjetas estaban escritas a mano en index.html y cada sección
   leía del HTML de la otra; por eso al abrir un similar se armaba una tarjeta
   distinta en vez de reusar la misma. Ahora todas salen del mismo lugar.
   loadCatalog() lo reemplaza entero si Supabase responde.                   */
let CATALOGO = [
  {slug:'set-cocina-silicona',       cat:'cocina',       name:'Set de Cocina de Silicona 12 Piezas', image:IMG.cocina,        desc:'Set completo de utensilios de cocina de silicona con mango de madera. Resistentes al calor y antiadherentes.'},
  {slug:'utensilios-bambu',          cat:'cocina',       name:'Juego de Utensilios de Bambú',        image:IMG.cocina,        desc:'Juego de utensilios de cocina de bambú natural. Livianos, resistentes y amables con tus sartenes.'},
  {slug:'organizador-cocina',        cat:'cocina',       name:'Organizador de Cocina',               image:IMG.cocina,        desc:'Organizador multiuso para mantener ordenados los utensilios y accesorios de tu cocina.'},
  {slug:'tabla-picar',               cat:'cocina',       name:'Tabla de Picar de Bambú',             image:IMG.cocina,        desc:'Tabla de picar de bambú resistente y antideslizante. Ideal para el uso diario en la cocina.'},
  {slug:'set-cuchillos',             cat:'cocina',       name:'Set de Cuchillos de Cocina',          image:IMG.cocina,        desc:'Set de cuchillos de acero inoxidable con filo duradero. Para cortar, picar y rebanar con precisión.'},
  {slug:'rallador-multiuso',         cat:'cocina',       name:'Rallador Multiuso 4 Caras',           image:IMG.cocina,        desc:'Rallador de acero inoxidable con cuatro caras para distintos cortes. Mango cómodo y base estable.'},
  {slug:'escurridor-platos',         cat:'cocina',       name:'Escurridor de Platos Plegable',       image:IMG.cocina,        desc:'Escurridor plegable que ahorra espacio. Drena el agua directo al lavaplatos.'},
  {slug:'set-tapers',                cat:'cocina',       name:'Set de Tapers Herméticos 10 Piezas',  image:IMG.cocina,        desc:'Set de contenedores herméticos para guardar y conservar alimentos frescos por más tiempo.'},
  {slug:'molde-silicona',            cat:'cocina',       name:'Molde de Silicona para Hornear',      image:IMG.cocina,        desc:'Molde de silicona antiadherente y flexible. Desmolda fácil y resiste altas temperaturas.'},
  {slug:'dispensador-condimentos',   cat:'cocina',       name:'Dispensador de Condimentos',          image:IMG.cocina,        desc:'Dispensador práctico para sal, pimienta y especias. Mantiene tus condimentos a mano y ordenados.'},
  {slug:'calentador-cera',           cat:'belleza',      name:'Calentador de Cera Profesional',      image:IMG.cera,          desc:'Calentador de cera profesional para todo tipo de ceras. Incluye contenedor de aluminio y control de temperatura.'},
  {slug:'kit-depilacion',            cat:'belleza',      name:'Kit de Depilación',                   image:IMG.cera,          desc:'Kit completo de depilación para uso en casa. Práctico, fácil de usar y de larga duración.'},
  {slug:'espejo-led',                cat:'belleza',      name:'Espejo con Luz LED',                  image:IMG.cera,          desc:'Espejo de maquillaje con iluminación LED regulable. Luz pareja para un acabado perfecto.'},
  {slug:'secador-cabello',           cat:'belleza',      name:'Secador de Cabello Compacto',         image:IMG.cera,          desc:'Secador de cabello potente y liviano con varias temperaturas. Secado rápido y parejo.'},
  {slug:'plancha-pelo',              cat:'belleza',      name:'Plancha de Pelo Cerámica',            image:IMG.cera,          desc:'Plancha de cerámica con calentamiento rápido. Alisa y da forma cuidando tu cabello.'},
  {slug:'set-brochas',               cat:'belleza',      name:'Set de Brochas de Maquillaje',        image:IMG.cera,          desc:'Set de brochas suaves para un maquillaje profesional. Incluye estuche para guardarlas.'},
  {slug:'masajeador-facial',         cat:'belleza',      name:'Masajeador Facial',                   image:IMG.cera,          desc:'Masajeador facial para relajar y tonificar la piel. Fácil de usar en casa.'},
  {slug:'rizador-pestanas',          cat:'belleza',      name:'Rizador de Pestañas',                 image:IMG.cera,          desc:'Rizador de pestañas con almohadilla de silicona. Curva natural y duradera.'},
  {slug:'organizador-maquillaje',    cat:'belleza',      name:'Organizador de Maquillaje',           image:IMG.cera,          desc:'Organizador transparente para mantener tu maquillaje ordenado y a la vista.'},
  {slug:'set-manicura',              cat:'belleza',      name:'Set de Manicura',                      image:IMG.cera,          desc:'Set completo de manicura y pedicura en estuche. Todo lo que necesitas para tus uñas.'},
  {slug:'soplador-bateria',          cat:'herramientas', name:'Soplador / Ventilador a Batería 18V', image:IMG.soplador,      desc:'Soplador inalámbrico potente de 18V. Ideal para limpieza y secado. Incluye batería y cargador.'},
  {slug:'taladro-bateria',           cat:'herramientas', name:'Taladro a Batería',                   image:IMG.soplador,      desc:'Taladro inalámbrico recargable con torque ajustable. Para perforar y atornillar en casa.'},
  {slug:'set-herramientas',          cat:'herramientas', name:'Set de Herramientas 40 Piezas',       image:IMG.soplador,      desc:'Set de herramientas esenciales para el hogar. Todo lo que necesitas para reparaciones básicas.'},
  {slug:'destornillador-set',        cat:'herramientas', name:'Set de Destornilladores de Precisión',image:IMG.soplador,      desc:'Set de destornilladores de precisión para electrónica y reparaciones delicadas.'},
  {slug:'llave-ajustable',           cat:'herramientas', name:'Llave Ajustable',                     image:IMG.soplador,      desc:'Llave ajustable de acero resistente. Se adapta a distintos tamaños de tuercas.'},
  {slug:'cinta-metrica',             cat:'herramientas', name:'Cinta Métrica 5m',                    image:IMG.soplador,      desc:'Cinta métrica de 5 metros con freno y clip de cinturón. Medición precisa y cómoda.'},
  {slug:'pistola-silicona',          cat:'herramientas', name:'Pistola de Silicona Caliente',        image:IMG.soplador,      desc:'Pistola de silicona caliente para manualidades y reparaciones. Calentamiento rápido.'},
  {slug:'nivel-laser',               cat:'herramientas', name:'Nivel Láser',                         image:IMG.soplador,      desc:'Nivel láser para colgar cuadros y alinear con precisión. Fácil de usar.'},
  {slug:'caja-herramientas',         cat:'herramientas', name:'Caja Organizadora de Herramientas',   image:IMG.soplador,      desc:'Caja resistente con compartimentos para ordenar y transportar tus herramientas.'},
  {slug:'multiherramienta',          cat:'herramientas', name:'Multiherramienta Plegable',           image:IMG.soplador,      desc:'Multiherramienta plegable con varias funciones. Compacta para llevar a todos lados.'},
  {slug:'limpiavidrios-telescopico', cat:'limpieza',     name:'Limpiavidrios Telescópico',           image:IMG.limpiavidrios, desc:'Limpiavidrios telescópico extensible de 21 a 86 cm. Mango antideslizante y correa de seguridad.'},
  {slug:'mopa-giratoria',            cat:'limpieza',     name:'Mopa Giratoria 360°',                 image:IMG.limpiavidrios, desc:'Mopa giratoria 360° con balde escurridor. Limpia pisos sin esfuerzo y seca más rápido.'},
  {slug:'set-limpieza-hogar',        cat:'limpieza',     name:'Set de Limpieza para el Hogar',       image:IMG.limpiavidrios, desc:'Set completo de implementos de limpieza para mantener cada rincón de tu hogar impecable.'},
  {slug:'escoba-recogedor',          cat:'limpieza',     name:'Set Escoba y Recogedor',              image:IMG.limpiavidrios, desc:'Set de escoba y recogedor con mango largo. Barre sin agacharte y guarda fácil.'},
  {slug:'cepillo-electrico',         cat:'limpieza',     name:'Cepillo de Limpieza Eléctrico',       image:IMG.limpiavidrios, desc:'Cepillo eléctrico recargable para baño y cocina. Quita la suciedad difícil sin esfuerzo.'},
  {slug:'panos-microfibra',          cat:'limpieza',     name:'Pack de Paños de Microfibra',         image:IMG.limpiavidrios, desc:'Pack de paños de microfibra absorbentes. Limpian sin rayar y no dejan pelusas.'},
  {slug:'limpiador-vapor',           cat:'limpieza',     name:'Limpiador a Vapor',                   image:IMG.limpiavidrios, desc:'Limpiador a vapor para desinfectar superficies sin químicos. Práctico y potente.'},
  {slug:'organizador-limpieza',      cat:'limpieza',     name:'Organizador de Artículos de Limpieza',image:IMG.limpiavidrios, desc:'Organizador para guardar y ordenar todos tus productos de limpieza en un solo lugar.'},
  {slug:'aspiradora-mano',           cat:'limpieza',     name:'Aspiradora de Mano',                  image:IMG.limpiavidrios, desc:'Aspiradora de mano inalámbrica, liviana y potente. Ideal para el auto y rincones.'},
  {slug:'guantes-limpieza',          cat:'limpieza',     name:'Pack de Guantes de Limpieza',         image:IMG.limpiavidrios, desc:'Pack de guantes resistentes y reutilizables. Protegen tus manos en cada tarea.'},
];

// Si Supabase no trae categoría, se deduce de la primera palabra del slug.
const FAMILIAS = {set:'cocina', calentador:'belleza', kit:'belleza', espejo:'belleza', soplador:'herramientas', taladro:'herramientas', limpiavidrios:'limpieza', mopa:'limpieza'};
const familiaDe = slug => FAMILIAS[String(slug||'').split('-')[0]] || 'otros';

const findProduct  = slug => CATALOGO.find(p => p.slug === slug) || null;
const porCategoria = cat  => CATALOGO.filter(p => p.cat === cat);

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
  const oos = sin ? '<div class="oos-tag">SIN STOCK</div>' : '';
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
        <div class="card-stars-wrap"></div>
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
  const oos = p.in_stock === false ? '<div class="oos-tag">SIN STOCK</div>' : '';
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

    // PRICE_TIERS + FEATURES por slug (solo tramos activos con precio > 0)
    products.forEach(p => {
      const tiers = (p.price_tiers || [])
        .filter(t => t.active !== false && t.price > 0)
        .sort((a,b)=>a.qty-b.qty)
        .map(t=>({ qty:t.qty, price:t.price }));
      if (tiers.length) PRICE_TIERS[p.slug] = tiers;
      FEATURES[p.slug] = p.features || [];
      // imágenes del detalle = principal + secundarias (galería)
      GALLERY[p.slug] = [p.image, ...(p.gallery || [])].filter(Boolean);
      // Colores desde el panel. Sin ellos se respeta lo que esté escrito acá
      // abajo en COLOR_VARIANTS, si no los colores aparecían un instante y se
      // borraban al llegar la respuesta de la base.
      const cols = Array.isArray(p.colors) ? p.colors.filter(c => c && c.img) : [];
      if (cols.length) COLOR_VARIANTS[p.slug] = cols;
    });

    // HERO (carrusel principal)
    PRODUCTS.length = 0;
    products.filter(p => p.is_hero)
      .sort((a,b)=>(a.hero_order||0)-(b.hero_order||0))
      .forEach((p, idx) => {
        const p1 = tierOne(p.slug);
        const heroName = p.hero_name || p.name;
        PRODUCTS.push({
          id: idx + 1, key: p.slug, name: heroName,
          price: fmt(p1), rawPrice: p1, image: p.hero_image || p.image,
          bgLabel: p.hero_bg_label || (p.name || '').toUpperCase(),
          scale: p.hero_scale ?? 1, offsetX: p.hero_offset_x ?? 0, offsetY: p.hero_offset_y ?? 0,
        });
        HERO_STOCK[heroName] = p.in_stock !== false;
      });

    // Catálogo completo. Las secciones se repintan solas desde acá.
    CATALOGO = products.map(p => ({
      slug: p.slug,
      cat: p.category || familiaDe(p.slug),
      name: p.name,
      image: p.image,
      desc: p.description || '',
      imgScale: p.image_scale ?? 0.75,
      compare: p.compare_at_price,
      stock: p.stock_qty,
      inStock: p.in_stock !== false,
    }));

    document.body.classList.add('sheet-ready');
    return true;
  } catch (err) {
    console.error('❗ No se pudo cargar el catálogo desde Supabase:', err);
    document.body.classList.add('sheet-ready');
    return false;
  }
}


const FEATURES={
  'set-cocina-silicona':['12 piezas','Silicona apta para alimentos','Mango de madera','Incluye soporte'],
  'utensilios-bambu':['Bambú natural','Livianos y resistentes','No rayan tus sartenes','Fáciles de lavar'],
  'organizador-cocina':['Multiuso','Ahorra espacio','Material resistente','Fácil de limpiar'],
  'tabla-picar':['Bambú resistente','Antideslizante','Fácil de lavar','Uso diario'],
  'set-cuchillos':['Acero inoxidable','Filo duradero','Mango ergonómico','Varios tamaños'],
  'rallador-multiuso':['4 caras','Acero inoxidable','Mango cómodo','Base estable'],
  'escurridor-platos':['Plegable','Ahorra espacio','Drena solo','Resistente'],
  'set-tapers':['10 piezas','Cierre hermético','Apto microondas','Apilables'],
  'molde-silicona':['Antiadherente','Flexible','Resiste el horno','Desmolda fácil'],
  'dispensador-condimentos':['Práctico','Varios compartimentos','Fácil de llenar','Ordenado'],
  'calentador-cera':['Uso profesional','Control de temperatura','Contenedor de aluminio','Tapa transparente'],
  'kit-depilacion':['Uso en casa','Práctico y fácil','Larga duración','Incluye accesorios'],
  'espejo-led':['Luz LED regulable','Luz pareja','Recargable','Base estable'],
  'secador-cabello':['Potente','Varias temperaturas','Liviano','Secado rápido'],
  'plancha-pelo':['Placas de cerámica','Calienta rápido','Cuida el cabello','Liviana'],
  'set-brochas':['Cerdas suaves','Maquillaje parejo','Incluye estuche','Fáciles de limpiar'],
  'masajeador-facial':['Relaja la piel','Fácil de usar','Recargable','Compacto'],
  'rizador-pestanas':['Almohadilla de silicona','Curva natural','Duradero','Fácil de usar'],
  'organizador-maquillaje':['Transparente','Varios compartimentos','Ahorra espacio','Fácil de limpiar'],
  'set-manicura':['Set completo','Estuche incluido','Acero inoxidable','Portátil'],
  'soplador-bateria':['Batería 18V','Inalámbrico','Incluye cargador','Alto rendimiento'],
  'taladro-bateria':['Inalámbrico recargable','Torque ajustable','Perfora y atornilla','Incluye brocas'],
  'set-herramientas':['40 piezas','Para el hogar','Estuche incluido','Acero resistente'],
  'destornillador-set':['De precisión','Varias puntas','Mango antideslizante','Para electrónica'],
  'llave-ajustable':['Acero resistente','Se adapta','Mango firme','Uso rudo'],
  'cinta-metrica':['5 metros','Freno de cinta','Clip de cinturón','Medición precisa'],
  'pistola-silicona':['Calienta rápido','Para manualidades','Fácil de usar','Incluye barras'],
  'nivel-laser':['Línea láser','Fácil de alinear','Compacto','Para colgar cuadros'],
  'caja-herramientas':['Compartimentos','Resistente','Asa para transportar','Cierre seguro'],
  'multiherramienta':['Varias funciones','Plegable','Compacta','Acero inoxidable'],
  'limpiavidrios-telescopico':['Extensible 21–86 cm','Mango antideslizante','Correa de seguridad','Liviano'],
  'mopa-giratoria':['Giro 360°','Balde escurridor','Seca más rápido','Repuesto incluido'],
  'set-limpieza-hogar':['Set completo','Para todo el hogar','Materiales duraderos','Práctico de guardar'],
  'escoba-recogedor':['Mango largo','Sin agacharte','Cerdas suaves','Guarda fácil'],
  'cepillo-electrico':['Recargable','Varios cabezales','Quita suciedad difícil','Para baño y cocina'],
  'panos-microfibra':['Muy absorbentes','No rayan','Sin pelusas','Reutilizables'],
  'limpiador-vapor':['Sin químicos','Desinfecta','Potente','Varios accesorios'],
  'organizador-limpieza':['Todo en un lugar','Resistente','Fácil de mover','Ahorra espacio'],
  'aspiradora-mano':['Inalámbrica','Liviana','Potente','Ideal para el auto'],
  'guantes-limpieza':['Resistentes','Reutilizables','Protegen las manos','Antideslizantes'],
};
// { slug: [imgPrincipal, ...secundarias] } — desde Supabase (vacío = usa fallback hardcodeado)
const GALLERY={};
// Variantes de color — SOLO los slugs listados acá muestran colores (dots + selector + validación).
/* Cada color lleva 'agotado'. En true sigue a la vista pero en gris y no se
   puede elegir, y desde /admin se vuelve a encender sin perder las fotos. */
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
