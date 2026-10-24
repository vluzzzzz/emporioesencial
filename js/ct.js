// ct
'use strict';
/* ============================================================================
 *  Cats — la única lista de categorías de la web.
 *  Antes vivía repartida en cuatro archivos: el mega menú, los nombres de la
 *  página de categoría, las tarjetas de la portada y el panel. Ahora sale de
 *  acá, y la clave `categorias_arbol` de site_config la pisa.
 *
 *  El árbol de abajo es la semilla: si Supabase no responde, la web anda igual.
 * ========================================================================== */
const Cats = (() => {
  const IMG = n => 'images/emporio-images/' + n + '.jpeg';

  let ARBOL = [
    { slug:'cocina', nombre:'Cocina', arriba:'Todo en', destacada:true, orden:1,
      img:IMG(2), medida:'800 × 1000', banner:IMG(2), bannerMobile:IMG(2), bannerArchivo:'banner-cocina.webp',
      subs:[{slug:'cocina-utensilios',nombre:'Utensilios'},{slug:'cocina-ollas',nombre:'Ollas y sartenes'},{slug:'cocina-vajilla',nombre:'Vajilla'},{slug:'cocina-organizadores',nombre:'Organizadores'},{slug:'cocina-electro',nombre:'Electro cocina'}] },
    { slug:'hogar', nombre:'Hogar y decoración', arriba:'Todo en', destacada:false, orden:2,
      img:IMG(6), medida:'800 × 500',
      subs:[{slug:'hogar-decoracion',nombre:'Decoración'},{slug:'hogar-textiles',nombre:'Textiles'},{slug:'hogar-iluminacion',nombre:'Iluminación'},{slug:'hogar-cuadros',nombre:'Cuadros'},{slug:'hogar-relojes',nombre:'Relojes'}] },
    { slug:'belleza', nombre:'Belleza y cuidado personal', arriba:'Todo en', destacada:true, orden:3,
      img:IMG(3), medida:'800 × 500', banner:IMG(3), bannerMobile:IMG(3), bannerArchivo:'banner-belleza.webp',
      subs:[{slug:'belleza-maquillaje',nombre:'Maquillaje'},{slug:'belleza-facial',nombre:'Cuidado facial'},{slug:'belleza-cabello',nombre:'Cabello'},{slug:'belleza-unas',nombre:'Uñas'},{slug:'belleza-accesorios',nombre:'Accesorios'}] },
    { slug:'herramientas', nombre:'Herramientas', arriba:'Todo en', destacada:true, orden:4,
      img:IMG(1), medida:'800 × 500', banner:IMG(1), bannerMobile:IMG(1), bannerArchivo:'banner-herramientas.webp',
      subs:[{slug:'herr-manuales',nombre:'Manuales'},{slug:'herr-electricas',nombre:'Eléctricas'},{slug:'herr-puntas',nombre:'Set de puntas'},{slug:'herr-medicion',nombre:'Medición'},{slug:'herr-ferreteria',nombre:'Ferretería'}] },
    { slug:'limpieza', nombre:'Limpieza', arriba:'Todo en', destacada:true, orden:5,
      img:IMG(4), medida:'800 × 1000', banner:IMG(4), bannerMobile:IMG(4), bannerArchivo:'banner-limpieza.webp',
      subs:[{slug:'limp-hogar',nombre:'Limpieza hogar'},{slug:'limp-accesorios',nombre:'Accesorios'},{slug:'limp-bano',nombre:'Baño'},{slug:'limp-lavanderia',nombre:'Lavandería'}] },
    { slug:'organizacion', nombre:'Organización', arriba:'Todo en', destacada:false, orden:6,
      img:IMG(8), medida:'800 × 500',
      subs:[{slug:'org-cajas',nombre:'Cajas'},{slug:'org-ganchos',nombre:'Ganchos'},{slug:'org-closet',nombre:'Closet'},{slug:'org-cocina',nombre:'Cocina'}] },
    { slug:'electrodomesticos', nombre:'Electrodomésticos', arriba:'Todo en', destacada:false, orden:7,
      img:IMG(7), medida:'800 × 500',
      subs:[{slug:'electro-cocina',nombre:'Cocina'},{slug:'electro-ventilacion',nombre:'Ventilación'},{slug:'electro-personal',nombre:'Cuidado personal'}] },
    { slug:'bano', nombre:'Baño', arriba:'Todo en', destacada:false, orden:8,
      img:IMG(9), medida:'800 × 500',
      subs:[{slug:'bano-accesorios',nombre:'Accesorios'},{slug:'bano-organizacion',nombre:'Organización'},{slug:'bano-toallas',nombre:'Toallas'}] },
    { slug:'dormitorio', nombre:'Dormitorio', arriba:'Todo en', destacada:false, orden:9,
      img:IMG(13), medida:'800 × 500',
      subs:[{slug:'dorm-cama',nombre:'Ropa de cama'},{slug:'dorm-almohadas',nombre:'Almohadas'},{slug:'dorm-organizacion',nombre:'Organización'}] },
    { slug:'mascotas', nombre:'Mascotas', arriba:'Todo en', destacada:false, orden:10,
      img:IMG(11), medida:'800 × 500',
      subs:[{slug:'masc-alimentacion',nombre:'Alimentación'},{slug:'masc-juguetes',nombre:'Juguetes'},{slug:'masc-higiene',nombre:'Higiene'}] },
    { slug:'jardin', nombre:'Jardín y exterior', arriba:'Todo en', destacada:false, orden:11,
      img:IMG(5), medida:'800 × 500',
      subs:[{slug:'jard-herramientas',nombre:'Herramientas'},{slug:'jard-decoracion',nombre:'Decoración'},{slug:'jard-riego',nombre:'Riego'}] },
    { slug:'autos', nombre:'Autos', arriba:'Todo en', destacada:false, orden:12,
      img:IMG(16), medida:'800 × 500',
      subs:[{slug:'auto-accesorios',nombre:'Accesorios'},{slug:'auto-limpieza',nombre:'Limpieza'},{slug:'auto-organizacion',nombre:'Organización'}] },
    { slug:'tecnologia', nombre:'Tecnología', arriba:'Todo en', destacada:false, orden:13,
      img:IMG(20), medida:'800 × 500',
      subs:[{slug:'tec-accesorios',nombre:'Accesorios'},{slug:'tec-cables',nombre:'Cables'},{slug:'tec-audio',nombre:'Audio'}] },
  ];

  const porOrden = (a, b) => (a.orden || 0) - (b.orden || 0);

  function aplicar(arbol){
    if (!Array.isArray(arbol) || !arbol.length) return false;
    ARBOL = arbol.map(c => ({ ...c, subs: Array.isArray(c.subs) ? c.subs : [] }));
    return true;
  }

  const lista = () => ARBOL.slice().sort(porOrden);

  function nombre(slug){
    if (slug === 'todos') return 'Todo el catálogo';
    for (const c of ARBOL) {
      if (c.slug === slug) return c.nombre;
      const s = c.subs.find(x => x.slug === slug);
      if (s) return s.nombre;
    }
    return slug;
  }

  function padreDe(slug){
    const c = ARBOL.find(c => c.subs.some(s => s.slug === slug));
    return c ? c.slug : null;
  }

  // ¿Un producto de `catProducto` entra en la vista `catPedida`? Pedir Cocina
  // tiene que traer también lo que está en Ollas y sartenes.
  function incluye(catPedida, catProducto){
    if (catPedida === 'todos') return true;
    if (catPedida === catProducto) return true;
    return padreDe(catProducto) === catPedida;
  }

  const mega = () => lista().map(c => ({
    name: c.nombre, cat: c.slug,
    subs: c.subs.map(s => ({ name: s.nombre, cat: s.slug })),
  }));

  const tarjetas = () => lista().filter(c => c.destacada).map(c => ({
    arriba: c.arriba || 'Todo en', titulo: c.nombre, cat: c.slug,
    img: c.img || '', medida: c.medida || '800 × 500',
    banner: c.banner || '', bannerMobile: c.bannerMobile || '', bannerArchivo: c.bannerArchivo || '',
  }));

  // Padres y subcategorías en una sola lista, para los desplegables.
  function planas(){
    const out = [];
    lista().forEach(c => {
      out.push({ slug: c.slug, nombre: c.nombre });
      c.subs.forEach(s => out.push({ slug: s.slug, nombre: c.nombre + ' · ' + s.nombre }));
    });
    return out;
  }

  const bannerDe = cat => lista().find(c => c.slug === cat) || null;

  return { aplicar, lista, nombre, padreDe, incluye, mega, tarjetas, planas, bannerDe };
})();
