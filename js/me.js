// me
'use strict';
/* ============================================================================
 *  Menu — el mega menú de categorías de la barra.
 *  Vivía dentro del DOMContentLoaded de mn.js, así que no se podía repintar
 *  desde afuera. Ahora es un módulo: al editar categorías se llama a
 *  Menu.renderMega() y el menú se actualiza solo.
 * ========================================================================== */
const Menu = (() => {
  // Si la categoría todavía no tiene su foto cargada, se usa una del
  // catálogo para que el menú no quede con huecos.
  const fallback = i => 'images/emporio-images/' + ((i % 23) + 1) + '.webp';
  let cats = [];

  const esChico = () => window.matchMedia('(max-width:860px)').matches;
  const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Desplegar a 'auto' no se puede animar, así que se anima hasta la altura
  // medida y recién al terminar se suelta, para que siga creciendo si hace
  // falta. Las fotos entran escalonadas detrás.
  function desplegar(subs){
    subs.hidden = false;
    const tiles = subs.querySelectorAll('.mega-tile');
    if (sinMovimiento()) { subs.classList.add('abierto'); subs.style.height = 'auto'; return; }
    tiles.forEach((t, i) => t.style.setProperty('--d', (i * 45) + 'ms'));
    const alto = subs.scrollHeight;
    subs.style.height = '0px';
    // El reflow va antes de la clase: si no, el navegador nunca ve a las
    // fotos en su estado inicial y aparecen de golpe en vez de entrar.
    void subs.offsetHeight;
    subs.classList.add('abierto');
    subs.style.height = alto + 'px';
    subs.addEventListener('transitionend', function fin(e){
      if (e.propertyName !== 'height') return;
      subs.style.height = 'auto';
      subs.removeEventListener('transitionend', fin);
    });
  }

  function plegar(subs){
    const item = subs.closest('.mega-li').querySelector('.mega-item');
    item.classList.remove('active');
    item.setAttribute('aria-expanded', 'false');
    if (sinMovimiento()) { subs.classList.remove('abierto'); subs.hidden = true; subs.style.height = ''; return; }
    subs.style.height = subs.scrollHeight + 'px';
    void subs.offsetHeight;
    subs.classList.remove('abierto');
    subs.style.height = '0px';
    subs.addEventListener('transitionend', function fin(e){
      if (e.propertyName !== 'height') return;
      subs.hidden = true;
      subs.style.height = '';
      subs.removeEventListener('transitionend', fin);
    });
  }

  function tiles(c, idx){
    const subs = c.subs.map((s,i)=>`<a class="mega-tile" href="#panel" data-cat-abrir="${s.cat}"><span class="mega-tile-img"><img src="${s.img || fallback(idx+i)}" alt="" loading="lazy"></span><span class="mega-tile-name">${s.name}</span></a>`).join('');
    return `<a class="mega-tile mega-tile--all" href="#panel" data-cat-abrir="${c.cat}"><span class="mega-tile-img"><img src="${c.img || fallback(idx)}" alt="" loading="lazy"></span><span class="mega-tile-name">Ver todo ${c.name}</span></a>${subs}`;
  }

  // Escritorio: las subcategorías van en el panel de la derecha.
  function renderMegaPanel(idx){
    const panel = document.getElementById('megaPanel');
    const c = cats[idx];
    if (!c || !panel) return;
    panel.innerHTML = tiles(c, idx);
  }

  function renderMega(){
    const megaList = document.getElementById('megaList');
    if (!megaList) return;
    cats = Cats.mega();
    // Cada categoría lleva su propio panel de subcategorías. En el teléfono
    // se abre ahí mismo, debajo de la categoría tocada; en escritorio queda
    // oculto y manda el panel de la derecha.
    megaList.innerHTML = cats.map((c,i)=>`
      <li class="mega-li">
        <button class="mega-item${i===0?' active':''}" data-idx="${i}" aria-expanded="false">
          ${c.name}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <div class="mega-subs" data-subs="${i}" hidden>${tiles(c, i)}</div>
      </li>`).join('');

    megaList.querySelectorAll('.mega-item').forEach(b => {
      const idx = Number(b.dataset.idx);
      const marcar = () => {
        megaList.querySelectorAll('.mega-item').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderMegaPanel(idx);
      };
      b.addEventListener('mouseenter', () => { if (!esChico()) marcar(); });
      b.addEventListener('click', () => {
        if (!esChico()) { marcar(); return; }
        // En chico funciona como acordeón: se abre una sola a la vez.
        const subs = megaList.querySelector('[data-subs="' + idx + '"]');
        const abierto = subs.classList.contains('abierto');
        megaList.querySelectorAll('.mega-subs.abierto').forEach(x => { if (x !== subs) plegar(x); });
        megaList.querySelectorAll('.mega-item').forEach(x => {
          x.classList.remove('active');
          x.setAttribute('aria-expanded', 'false');
        });
        if (abierto) plegar(subs);
        else {
          desplegar(subs);
          b.classList.add('active');
          b.setAttribute('aria-expanded', 'true');
        }
      });
    });
    renderMegaPanel(0);
  }

  // En el teléfono la barra lleva hasta cinco botones y el buscador quedaba
  // aplastado a unos pocos píxeles. Abajo de cierto ancho baja a su propia
  // fila, que ocupa todo el ancho.
  function acomodarBuscador(){
    const bus = document.querySelector('.nav-buscador');
    const fila = document.getElementById('navBusMovil');
    const der = document.querySelector('.nav-right');
    if (!bus || !fila || !der) return;
    const chico = window.matchMedia('(max-width:860px)').matches;
    if (chico && bus.parentElement !== fila) fila.appendChild(bus);
    if (!chico && bus.parentElement !== der) der.insertBefore(bus, der.firstChild);
  }

  function init(){
    renderMega();
    acomodarBuscador();
    window.addEventListener('resize', acomodarBuscador, { passive:true });
    const navCats = document.getElementById('navCats');
    const navCatsBtn = document.getElementById('navCatsBtn');
    const navCatsMenu = document.getElementById('navCatsMenu');
    if (!navCats || !navCatsBtn || !navCatsMenu) return;
    // En el teléfono el cajón ocupa la pantalla: necesita su propia X.
    if (!navCatsMenu.querySelector('.mega-x')) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'mega-x';
      x.setAttribute('aria-label', 'Cerrar categorías');
      x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.addEventListener('click', () => cerrar());
      navCatsMenu.insertBefore(x, navCatsMenu.firstChild);
    }

    let velo = document.getElementById('navCatsVelo');
    if (!velo) {
      velo = document.createElement('div');
      velo.id = 'navCatsVelo';
      velo.className = 'nav-cats-velo';
      velo.hidden = true;
      velo.addEventListener('click', () => cerrar());
      document.body.appendChild(velo);
    }

    const cerrar = () => {
      navCats.classList.remove('open');
      document.body.classList.remove('cats-abierto');
      navCatsMenu.hidden = true;
      velo.hidden = true;
      navCatsBtn.setAttribute('aria-expanded','false');
    };
    navCatsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const abrir = navCatsMenu.hidden;
      navCats.classList.toggle('open', abrir);
      document.body.classList.toggle('cats-abierto', abrir);
      navCatsMenu.hidden = !abrir;
      velo.hidden = !abrir;
      navCatsBtn.setAttribute('aria-expanded', String(abrir));
    });
    navCatsMenu.addEventListener('click', e => {
      if (e.target.closest('[data-cat-abrir]')) cerrar();
    });
    document.addEventListener('click', e => { if (!navCats.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  }

  return { init, renderMega, acomodarBuscador };
})();
