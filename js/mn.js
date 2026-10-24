// mn
'use strict';
document.querySelectorAll('.porque-card').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('flipped')));

document.addEventListener('DOMContentLoaded', () => {
  // Refuerzo del arranque arriba: si la URL no trae ancla, se sube del todo.
  if (!location.hash) window.scrollTo(0, 0);

  // ── 1. YA. Nada de esto depende de Supabase, así que no espera a la red.
  //    Antes todo iba detrás de `await loadCatalog()` y la página se quedaba
  //    en blanco varios segundos: cinta, banners, categorías y buscador
  //    aparecían recién cuando contestaba la base de datos.
  document.body.classList.add('sheet-ready');
  Banners.init();Reviews.init();Buscador.init();
  NavScroll.init();ProductModal.init();
  Trust.init();
  CatPage.init();
  Filas.init();
  ProtegerImagenes.init();

  const MEGA_CATS=[
    {name:'Cocina',cat:'cocina',subs:[{name:'Utensilios',cat:'cocina-utensilios'},{name:'Ollas y sartenes',cat:'cocina-ollas'},{name:'Vajilla',cat:'cocina-vajilla'},{name:'Organizadores',cat:'cocina-organizadores'},{name:'Electro cocina',cat:'cocina-electro'}]},
    {name:'Hogar y decoración',cat:'hogar',subs:[{name:'Decoración',cat:'hogar-decoracion'},{name:'Textiles',cat:'hogar-textiles'},{name:'Iluminación',cat:'hogar-iluminacion'},{name:'Cuadros',cat:'hogar-cuadros'},{name:'Relojes',cat:'hogar-relojes'}]},
    {name:'Belleza y cuidado personal',cat:'belleza',subs:[{name:'Maquillaje',cat:'belleza-maquillaje'},{name:'Cuidado facial',cat:'belleza-facial'},{name:'Cabello',cat:'belleza-cabello'},{name:'Uñas',cat:'belleza-unas'},{name:'Accesorios',cat:'belleza-accesorios'}]},
    {name:'Herramientas',cat:'herramientas',subs:[{name:'Manuales',cat:'herr-manuales'},{name:'Eléctricas',cat:'herr-electricas'},{name:'Set de puntas',cat:'herr-puntas'},{name:'Medición',cat:'herr-medicion'},{name:'Ferretería',cat:'herr-ferreteria'}]},
    {name:'Limpieza',cat:'limpieza',subs:[{name:'Limpieza hogar',cat:'limp-hogar'},{name:'Accesorios',cat:'limp-accesorios'},{name:'Baño',cat:'limp-bano'},{name:'Lavandería',cat:'limp-lavanderia'}]},
    {name:'Organización',cat:'organizacion',subs:[{name:'Cajas',cat:'org-cajas'},{name:'Ganchos',cat:'org-ganchos'},{name:'Closet',cat:'org-closet'},{name:'Cocina',cat:'org-cocina'}]},
    {name:'Electrodomésticos',cat:'electrodomesticos',subs:[{name:'Cocina',cat:'electro-cocina'},{name:'Ventilación',cat:'electro-ventilacion'},{name:'Cuidado personal',cat:'electro-personal'}]},
    {name:'Baño',cat:'bano',subs:[{name:'Accesorios',cat:'bano-accesorios'},{name:'Organización',cat:'bano-organizacion'},{name:'Toallas',cat:'bano-toallas'}]},
    {name:'Dormitorio',cat:'dormitorio',subs:[{name:'Ropa de cama',cat:'dorm-cama'},{name:'Almohadas',cat:'dorm-almohadas'},{name:'Organización',cat:'dorm-organizacion'}]},
    {name:'Mascotas',cat:'mascotas',subs:[{name:'Alimentación',cat:'masc-alimentacion'},{name:'Juguetes',cat:'masc-juguetes'},{name:'Higiene',cat:'masc-higiene'}]},
    {name:'Jardín y exterior',cat:'jardin',subs:[{name:'Herramientas',cat:'jard-herramientas'},{name:'Decoración',cat:'jard-decoracion'},{name:'Riego',cat:'jard-riego'}]},
    {name:'Autos',cat:'autos',subs:[{name:'Accesorios',cat:'auto-accesorios'},{name:'Limpieza',cat:'auto-limpieza'},{name:'Organización',cat:'auto-organizacion'}]},
    {name:'Tecnología',cat:'tecnologia',subs:[{name:'Accesorios',cat:'tec-accesorios'},{name:'Cables',cat:'tec-cables'},{name:'Audio',cat:'tec-audio'}]},
  ];
  const megaList=document.getElementById('megaList');
  const megaPanel=document.getElementById('megaPanel');
  const megaImg=i=>`images/emporio-images/${(i%23)+1}.jpeg`;
  function renderMegaPanel(idx){
    const c=MEGA_CATS[idx];if(!c||!megaPanel)return;
    const tiles=c.subs.map((s,i)=>`<a class="mega-tile" href="#panel" data-cat-abrir="${s.cat}"><span class="mega-tile-img"><img src="${megaImg(idx+i)}" alt="" loading="lazy"></span><span class="mega-tile-name">${s.name}</span></a>`).join('');
    megaPanel.innerHTML=`<a class="mega-tile mega-tile--all" href="#panel" data-cat-abrir="${c.cat}"><span class="mega-tile-img"><img src="${megaImg(idx)}" alt="" loading="lazy"></span><span class="mega-tile-name">Ver todo ${c.name}</span></a>${tiles}`;
  }
  function renderMega(){
    if(!megaList)return;
    megaList.innerHTML=MEGA_CATS.map((c,i)=>`<li><button class="mega-item${i===0?' active':''}" data-idx="${i}">${c.name}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></li>`).join('');
    megaList.querySelectorAll('.mega-item').forEach(b=>{
      const act=()=>{megaList.querySelectorAll('.mega-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderMegaPanel(Number(b.dataset.idx));};
      b.addEventListener('mouseenter',act);
      b.addEventListener('click',act);
    });
    renderMegaPanel(0);
  }
  renderMega();

  const navCats=document.getElementById('navCats');
  const navCatsBtn=document.getElementById('navCatsBtn');
  const navCatsMenu=document.getElementById('navCatsMenu');
  if(navCats&&navCatsBtn&&navCatsMenu){
    const cerrarCats=()=>{navCats.classList.remove('open');navCatsMenu.hidden=true;navCatsBtn.setAttribute('aria-expanded','false');};
    navCatsBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const abrir=navCatsMenu.hidden;
      navCats.classList.toggle('open',abrir);
      navCatsMenu.hidden=!abrir;
      navCatsBtn.setAttribute('aria-expanded',String(abrir));
    });
    navCatsMenu.addEventListener('click',cerrarCats);
    document.addEventListener('click',e=>{if(!navCats.contains(e.target))cerrarCats();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarCats();});
  }

  // ── 2. Después, sin bloquear. Las dos consultas salen juntas, no una tras
  //    otra: no dependen entre sí y en serie tardarían el doble.
  //
  //    El catálogo se aplica primero porque las filas de la portada guardan
  //    slugs, y esos slugs tienen que existir en el catálogo nuevo antes de
  //    que la configuración mande a repintarlas.
  loadCatalog()
    .then(ok => { if (ok) Filas.init(); })
    .catch(err => console.error('Catálogo:', err));

  SiteConfig.cargar()
    .catch(err => console.error('Configuración:', err));

  SiteConfig.cargarReviews()
    .catch(err => console.error('Reseñas:', err));
});
