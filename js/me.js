// me
'use strict';
/* ============================================================================
 *  Menu — el mega menú de categorías de la barra.
 *  Vivía dentro del DOMContentLoaded de mn.js, así que no se podía repintar
 *  desde afuera. Ahora es un módulo: al editar categorías se llama a
 *  Menu.renderMega() y el menú se actualiza solo.
 * ========================================================================== */
const Menu = (() => {
  const megaImg = i => 'images/emporio-images/' + ((i % 23) + 1) + '.jpeg';
  let cats = [];

  function renderMegaPanel(idx){
    const panel = document.getElementById('megaPanel');
    const c = cats[idx];
    if (!c || !panel) return;
    const tiles = c.subs.map((s,i)=>`<a class="mega-tile" href="#panel" data-cat-abrir="${s.cat}"><span class="mega-tile-img"><img src="${megaImg(idx+i)}" alt="" loading="lazy"></span><span class="mega-tile-name">${s.name}</span></a>`).join('');
    panel.innerHTML = `<a class="mega-tile mega-tile--all" href="#panel" data-cat-abrir="${c.cat}"><span class="mega-tile-img"><img src="${megaImg(idx)}" alt="" loading="lazy"></span><span class="mega-tile-name">Ver todo ${c.name}</span></a>${tiles}`;
  }

  function renderMega(){
    const megaList = document.getElementById('megaList');
    if (!megaList) return;
    cats = Cats.mega();
    megaList.innerHTML = cats.map((c,i)=>`<li><button class="mega-item${i===0?' active':''}" data-idx="${i}">${c.name}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></li>`).join('');
    megaList.querySelectorAll('.mega-item').forEach(b => {
      const act = () => {
        megaList.querySelectorAll('.mega-item').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderMegaPanel(Number(b.dataset.idx));
      };
      b.addEventListener('mouseenter', act);
      b.addEventListener('click', act);
    });
    renderMegaPanel(0);
  }

  function init(){
    renderMega();
    const navCats = document.getElementById('navCats');
    const navCatsBtn = document.getElementById('navCatsBtn');
    const navCatsMenu = document.getElementById('navCatsMenu');
    if (!navCats || !navCatsBtn || !navCatsMenu) return;
    const cerrar = () => {
      navCats.classList.remove('open');
      navCatsMenu.hidden = true;
      navCatsBtn.setAttribute('aria-expanded','false');
    };
    navCatsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const abrir = navCatsMenu.hidden;
      navCats.classList.toggle('open', abrir);
      navCatsMenu.hidden = !abrir;
      navCatsBtn.setAttribute('aria-expanded', String(abrir));
    });
    navCatsMenu.addEventListener('click', cerrar);
    document.addEventListener('click', e => { if (!navCats.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  }

  return { init, renderMega };
})();
