// sc — nav pegada, filas de productos y sección de categoría
'use strict';
const NavScroll=(()=>{function init(){const nav=document.querySelector('.nav');window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',window.scrollY>40),{passive:true});}return{init};})();

/* ════════════════════════════════════════════════════════════════════════════
   ZONA EDITABLE — qué productos salen en cada fila de la portada, y en qué
   orden. Son los slugs del catálogo (js/sd.js); si pones uno que no existe,
   se saltea sin romper nada.

   ⚠ Esta lista es solo el punto de partida: si hay
   algo guardado en el panel, eso gana y lo de aquí no se usa. Edita en el
   panel salvo que quieras cambiar el valor de arranque.
   ════════════════════════════════════════════════════════════════════════════ */

// Fila de arriba, con la imagen al costado. Va antes de las categorías.
let OFERTAS = [
  'set-cocina-silicona',
  'calentador-cera',
  'soplador-bateria',
  'limpiavidrios-telescopico',
  'espejo-led',
];

// Fila de abajo, a lo ancho. Va después de las categorías. Aquí están los que
// no salen arriba, así que entre las dos filas se ve todo el catálogo.
let MAS_PRODUCTOS = [
  'utensilios-bambu',
  'organizador-cocina',
  'kit-depilacion',
  'taladro-bateria',
  'set-herramientas',
  'mopa-giratoria',
  'set-limpieza-hogar',
];
/* ═══════════════════════════ FIN ZONA EDITABLE ═════════════════════════════ */

// Pinta una lista de productos dentro de un contenedor y la deja lista para
// usar: escala de imagen, estrellas, descuento y stock.
function pintarProductos(el, lista, opts){
  if(!el) return false;
  const nuevo = lista.map(p=>cardHTML(p, opts)).join('');
  // Para grillas con paginación o que se actualizan dinámicamente, siempre repintar
  const forzar = el.id === 'masGrid' || el.id === 'cpageGrid' || el.id === 'cpageMasGrid';
  if (!forzar && nuevo.replace(/\s+/g,'') === (el.dataset.pintado||'')) return false;
  el.innerHTML = nuevo;
  el.dataset.pintado = nuevo.replace(/\s+/g,'');
  el.querySelectorAll('.product-card').forEach(c=>c.style.setProperty('--card-img-scale',c.dataset.imgScale??0.75));
  if(typeof Trust!=='undefined') Trust.decorarTarjetas();
  return true;
}

// Entrada suave de las tarjetas al aparecer en pantalla.
function animarProductos(el){
  if(!el || typeof gsap==='undefined') return;
  const cards=el.querySelectorAll('.product-card');
  if(!cards.length) return;
  if(reduceMotion()){gsap.set(cards,{opacity:1,y:0});return;}
  // La entrada se anima una sola vez. Si se repite en cada repintado, las
  // tarjetas que el visitante ya estaba mirando se apagan de golpe y vuelven:
  // eso es lo que se veía como un parpadeo al contestar Supabase.
  if(el.dataset.animado){gsap.set(cards,{opacity:1,y:0});return;}
  el.dataset.animado='1';
  gsap.set(cards,{opacity:0,y:40});
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      const c=e.target,i=[...cards].indexOf(c);
      gsap.to(c,{opacity:1,y:0,duration:.6,ease:'power3.out',delay:(i%5)*.07});
      obs.unobserve(c);
    });
  },{threshold:.1});
  cards.forEach(c=>obs.observe(c));
}

// Las dos filas de la portada. Se vuelve a llamar cuando contesta Supabase,
// así que pintar de nuevo tiene que ser inofensivo: lo es, porque cada fila
// se rehace desde cero.
/* Carrusel horizontal de tarjetas. No usa Swiper: la pista es un contenedor
   con desplazamiento nativo, así en el teléfono se arrastra con el dedo y con
   la inercia del sistema. Las flechas solo empujan ese desplazamiento. */
const Carru=(()=>{
  function paso(pista){
    const card=pista.querySelector('.product-card');
    if(!card)return pista.clientWidth;
    const est=getComputedStyle(pista);
    const gap=parseFloat(est.columnGap||est.gap)||14;
    const ancho=card.getBoundingClientRect().width+gap;
    // Avanza casi una pantalla, dejando una tarjeta a la vista como pista de
    // que la fila sigue. Con una sola visible, avanza de a una.
    const caben=Math.max(1,Math.floor(pista.clientWidth/ancho));
    return ancho*(caben>1?caben-1:1);
  }

  // Las flechas se esconden en las puntas: una flecha que no hace nada
  // enseña mal dónde termina la fila.
  function actualizar(pista){
    const caja=pista.closest('.carru');
    if(!caja)return;
    const prev=caja.querySelector('.carru-prev'),next=caja.querySelector('.carru-next');
    const sobra=pista.scrollWidth-pista.clientWidth;
    const x=pista.scrollLeft;
    if(prev)prev.hidden=sobra<8||x<8;
    if(next)next.hidden=sobra<8||x>=sobra-8;
  }

  function conectar(pista){
    if(!pista||pista.dataset.carruListo)return;
    const caja=pista.closest('.carru');
    if(!caja)return;
    pista.dataset.carruListo='1';
    caja.querySelectorAll('.carru-arr').forEach(b=>b.addEventListener('click',()=>{
      const d=b.classList.contains('carru-next')?1:-1;
      pista.scrollBy({left:paso(pista)*d,behavior:reduceMotion()?'auto':'smooth'});
    }));
    pista.addEventListener('scroll',()=>actualizar(pista),{passive:true});
    window.addEventListener('resize',()=>actualizar(pista),{passive:true});
  }

  // Después de pintar hay que esperar un cuadro: hasta que el navegador no
  // calcula posiciones, scrollWidth y clientWidth valen lo mismo y las
  // flechas quedarían escondidas siempre.
  function revisar(pista){
    if(!pista)return;
    conectar(pista);
    requestAnimationFrame(()=>requestAnimationFrame(()=>actualizar(pista)));
  }

  return{revisar};
})();

const Filas=(()=>{
  function una(id, slugs, reserva, opts){
    const row=document.getElementById(id);
    if(!row)return;
    const elegidos=slugs.map(findProduct).filter(Boolean).filter(p => !p.oculto);
    // Si ningún slug de la lista existe en el catálogo, la fila no se queda
    // vacía: se rellena con los primeros del catálogo.
    const lista=elegidos.length?elegidos:productosVisibles().slice(0,reserva);
    pintarProductos(row,lista,opts);
    animarProductos(row);
    Carru.revisar(row);
  }
  const POR_PAGINA=20;

  let pagina=1;
  // Arrastre de productos (solo con Editar prendido).
  let arrastre=null;      // { slug, item, card, hueco, id, dx, dy, movido }
  let arrastreSlug=null;  // se saca del repintado mientras la tarjeta vuela
  let barra=null;         // barra flotante para cambiar de página
  let bloqueoHasta=0;     // ignora el clic que queda pegado al soltar
  let sobrePag=null, tPag=null, ultimoPunto=null, enganchado=false;

  function paginar(){
    const total=productosVisibles().length;
    const paginasReales=Math.max(1, Math.ceil(total/POR_PAGINA));
    const paginas=paginasReales;
    const base=productosVisibles().slice();
    return{base,total,paginas,paginasReales};
  }

  // Posición de cada tarjeta en pantalla, por slug. Sirve para animar los
  // cambios de lugar (FLIP) cuando se reordena o se cambia de página.
  function medir(grid){
    const mapa=new Map();
    grid.querySelectorAll('.product-card').forEach(c=>mapa.set(c.dataset.id, c.getBoundingClientRect()));
    return mapa;
  }
  function animarCambios(grid, antes){
    if(!antes || (typeof reduceMotion==='function' && reduceMotion())) return;
    grid.querySelectorAll('.product-card').forEach(c=>{
      const a=antes.get(c.dataset.id);
      if(!a) return;
      const b=c.getBoundingClientRect();
      const dx=Math.round(a.left-b.left), dy=Math.round(a.top-b.top);
      if(!dx&&!dy) return;
      c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],
        {duration:170,easing:'cubic-bezier(.2,.85,.25,1)'});
    });
  }

  function pintarPagina(grid, antes){
    const{base,paginas}=paginar();
    if(pagina>paginas) pagina=paginas;
    if(pagina<1) pagina=1;
    const ini=(pagina-1)*POR_PAGINA;
    // Mientras una tarjeta vuela no se pinta también en la grilla.
    const lista=base.slice(ini,ini+POR_PAGINA).filter(p=>p.slug!==arrastreSlug);
    grid.dataset.pintado='';delete grid.dataset.animado;
    pintarProductos(grid,lista,{mover:true});
    if(antes) animarCambios(grid,antes);
    else if(!arrastre) animarProductos(grid);
  }

  // Números que se muestran: la primera, la última y las de alrededor de la
  // actual. Con muchas páginas (10, 20…) no tiene sentido listarlas todas:
  // entre medio va un "…". Con 5 páginas o menos se ven todas.
  function numerosDePagina(actual, total){
    if (total <= 5) return Array.from({length: total}, (_, i) => i + 1);
    const ver = new Set([1, total, actual - 1, actual, actual + 1]);
    if (actual <= 3) { ver.add(2); ver.add(3); }
    if (actual >= total - 2) { ver.add(total - 1); ver.add(total - 2); }
    const nums = [...ver].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const salida = [];
    nums.forEach((n, i) => {
      if (i && n - nums[i - 1] > 1) salida.push('…');
      salida.push(n);
    });
    return salida;
  }

  // Cambia de página sin reiniciar nada más. Devuelve si hubo cambio.
  function irA(n, sinScroll){
    const{paginas}=paginar();
    n=Math.max(1,Math.min(paginas,n));
    const cambio=n!==pagina;
    if(cambio){
      pagina=n;
      const grid=document.getElementById('masGrid');
      if(grid) pintarPagina(grid);
      pintarControles();
      if(arrastre){ colocarHueco(0); actualizarBarra(); }
    }
    if(!sinScroll && cambio) document.getElementById('mas')?.scrollIntoView({behavior:'smooth',block:'start'});
    return cambio;
  }

  function pintarControles(){
    const nav=document.getElementById('paginacion');
    if(!nav)return;
    const{paginas}=paginar();
    if(paginas<=1){
      nav.innerHTML='';
      return;
    }
    if(pagina>paginas) pagina=paginas;
    let html='';
    html+=`<button class="pag-btn pag-prev" data-pag="${pagina-1}" ${pagina===1?'disabled':''} aria-label="Anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>`;
    numerosDePagina(pagina, paginas).forEach(n => {
      html += n === '…'
        ? '<span class="pag-puntos" aria-hidden="true">…</span>'
        : `<button class="pag-btn pag-num${n===pagina?' active':''}" data-pag="${n}"${n===pagina?' aria-current="page"':''}>${n}</button>`;
    });
    html+=`<button class="pag-btn pag-next" data-pag="${pagina+1}" ${pagina===paginas?'disabled':''} aria-label="Siguiente"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`;
    nav.innerHTML=html;
    nav.querySelectorAll('.pag-btn[data-pag]').forEach(b=>b.addEventListener('click',()=>{
      const n=Number(b.dataset.pag);
      if(n<1||n>paginas||n===pagina)return;
      irA(n);
    }));
  }

  /* ── Arrastre de productos ──────────────────────────────
     Solo con Editar prendido. La tarjeta se levanta y sigue al puntero; las
     demás se corren con animación. Abajo aparece una barra para cambiar de
     página sin soltar el producto: se pasa el mouse por un número, se escribe
     la página o se usa la rueda. Al soltar, el producto se inserta en el
     hueco (los demás se corren un lugar) y el orden se guarda en
     `products.position`. */

  function medirCards(box){
    const mapa=new Map();
    box.querySelectorAll('.product-card').forEach(c=>mapa.set(c, c.getBoundingClientRect()));
    return mapa;
  }
  function reacomodar(box, cambiar){
    const antes=medirCards(box);
    cambiar();
    const dur=(typeof reduceMotion==='function' && reduceMotion())?0:170;
    box.querySelectorAll('.product-card').forEach(c=>{
      const a=antes.get(c);
      if(!a) return;
      const b=c.getBoundingClientRect();
      const dx=Math.round(a.left-b.left), dy=Math.round(a.top-b.top);
      if(!dx&&!dy) return;
      c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],
        {duration:dur,easing:'cubic-bezier(.2,.85,.25,1)'});
    });
  }

  function colocarHueco(idx){
    if(!arrastre) return;
    const grid=document.getElementById('masGrid');
    if(!grid) return;
    const cards=[...grid.querySelectorAll('.product-card')];
    const ref=cards[Math.max(0,Math.min(idx,cards.length))]||null;
    if(ref) grid.insertBefore(arrastre.hueco,ref);
    else grid.appendChild(arrastre.hueco);
  }

  function crearBarra(){
    if(barra) return barra;
    barra=document.createElement('div');
    barra.className='po-paginas';
    barra.hidden=true;
    document.body.appendChild(barra);
    return barra;
  }

  // Números tipeados mientras se arrastra: se muestran y, al parar, saltan
  // directo a esa página. Así de la 20 a la 5 no hay que esperar nada.
  let bufferPag='', tBuffer=null;
  function limpiarBuffer(){
    bufferPag='';
    clearTimeout(tBuffer);
    tBuffer=null;
  }

  function actualizarBarra(){
    crearBarra();
    const{paginas}=paginar();
    const nums=numerosDePagina(pagina,paginas);
    let chips='';
    nums.forEach(n=>{
      chips+= n==='…'
        ? '<span class="po-pag-puntos" aria-hidden="true">…</span>'
        : `<button type="button" class="po-pag-chip${n===pagina?' actual':''}" data-arr-pag="${n}" aria-label="Página ${n}">${n}</button>`;
    });
    const pie = bufferPag
      ? `Ir a página ${bufferPag}… (Enter para saltar)`
      : `Página ${pagina} de ${paginas} · pasá el mouse por un número, escribila o usá la rueda`;
    barra.innerHTML=`
      <div class="po-pag-fila">
        <button type="button" class="po-pag-btn po-pag-flecha" data-arr-pag="${pagina-1}" ${pagina<=1?'disabled':''} aria-label="Página anterior">‹</button>
        <span class="po-pag-chips">${chips}</span>
        <button type="button" class="po-pag-btn po-pag-flecha" data-arr-pag="${pagina+1}" ${pagina>=paginas?'disabled':''} aria-label="Página siguiente">›</button>
      </div>
      <p class="po-pag-pie">${pie}</p>`;
    barra.hidden=false;
    if(sobrePag!=null) barra.querySelector('[data-arr-pag="'+sobrePag+'"]')?.classList.add('sobre');
  }
  function ocultarBarra(){
    if(barra){ barra.hidden=true; barra.innerHTML=''; }
    sobrePag=null;
    repitiendo=null;
    clearTimeout(tPag);
    limpiarBuffer();
  }

  // Al pasar el puntero por un número (o por Anterior/Siguiente) un momento,
  // la grilla salta a esa página sin soltar el producto. Con los números 1 y
  // el último siempre visibles, ir de la 20 a la 1 es un solo gesto.
  let repitiendo=null; // { dir, x, y } mientras se mantiene una flecha

  function revisarBarra(x,y){
    if(!arrastre||!barra||barra.hidden) return;
    // Mientras se mantiene una flecha no se vuelve a mirar qué hay debajo: la
    // barra cambia de ancho al cambiar de página y si no, el puntero podía
    // caer sobre el número 20 y saltar de golpe. Se corta si el puntero se
    // mueve de verdad.
    if(repitiendo){
      if(Math.abs(x-repitiendo.x)>8||Math.abs(y-repitiendo.y)>8) repitiendo=null;
      else return;
    }
    const el=document.elementFromPoint(x,y);
    const b=el&&el.closest?el.closest('[data-arr-pag]'):null;
    if(!b||b.disabled){
      sobrePag=null;
      clearTimeout(tPag);
      barra.querySelectorAll('.sobre').forEach(n=>n.classList.remove('sobre'));
      return;
    }
    const objetivo=Number(b.dataset.arrPag);
    if(objetivo===sobrePag) return;
    sobrePag=objetivo;
    barra.querySelectorAll('[data-arr-pag]').forEach(n=>n.classList.toggle('sobre',n===b));
    clearTimeout(tPag);
    tPag=setTimeout(()=>{
      if(!arrastre) return;
      const antesPag=pagina;
      irA(objetivo,true);
      sobrePag=null;
      // Las flechas repiten mientras se las mantenga: se pasa de a una página.
      if(pagina!==antesPag && b.classList.contains('po-pag-flecha')){
        repitiendo={ dir: pagina>antesPag?1:-1, x, y };
        tPag=setTimeout(avanzarRepeticion,140);
      }
    },250);
  }

  function avanzarRepeticion(){
    tPag=null;
    if(!arrastre||!repitiendo){ repitiendo=null; return; }
    const antes=pagina;
    irA(pagina+repitiendo.dir,true);
    if(pagina===antes){ repitiendo=null; return; }
    const flecha=barra.querySelector('[data-arr-pag="'+(pagina+repitiendo.dir)+'"]');
    if(flecha) flecha.classList.add('sobre');
    tPag=setTimeout(avanzarRepeticion,150);
  }

  function restablecer(card){
    card.classList.remove('producto-arrastrando');
    ['position','left','top','width','height','margin','zIndex','pointerEvents','transform','opacity']
      .forEach(k=>{ card.style[k]=''; });
  }

  function empezar(e, card, mano){
    if(arrastre||!enEdicion()) return;
    const grid=document.getElementById('masGrid');
    if(!grid) return;
    const slug=card.dataset.id;
    const origen=CATALOGO.findIndex(p=>p.slug===slug);
    if(origen<0) return;

    const r=card.getBoundingClientRect();
    const hueco=document.createElement('div');
    hueco.className='po-hueco';
    hueco.style.width=r.width+'px';
    hueco.style.height=r.height+'px';
    card.parentElement.insertBefore(hueco,card);

    card.classList.add('producto-arrastrando');
    card.style.transform='';
    card.style.opacity='';
    card.style.position='fixed';
    card.style.left=r.left+'px';
    card.style.top=r.top+'px';
    card.style.width=r.width+'px';
    card.style.height=r.height+'px';
    card.style.margin='0';
    card.style.zIndex='10001';
    card.style.pointerEvents='none';
    document.body.appendChild(card);

    arrastre={ slug, card, hueco, id:e.pointerId, dx:e.clientX-r.left, dy:e.clientY-r.top,
      x0:e.clientX, y0:e.clientY, movido:false, origen };
    arrastreSlug=slug;
    ultimoPunto={x:e.clientX,y:e.clientY};
    document.body.classList.add('arrastrando-producto');
    actualizarBarra();
    document.addEventListener('pointermove',mover,{passive:false});
    document.addEventListener('pointerup',soltar);
    document.addEventListener('pointercancel',soltar);
    document.addEventListener('keydown',tecla);
    document.addEventListener('wheel',rueda,{passive:false});
    try{ mano.setPointerCapture(e.pointerId); }catch(err){}
  }

  // Rueda sobre la barra: una página por muesca. Fuera de la barra no se toca,
  // así se puede seguir bajando por la grilla mientras se arrastra.
  function rueda(e){
    if(!arrastre||!barra||barra.hidden) return;
    const el=ultimoPunto&&document.elementFromPoint(ultimoPunto.x,ultimoPunto.y);
    if(!el||!el.closest||!el.closest('.po-paginas')) return;
    e.preventDefault();
    repitiendo=null;
    clearTimeout(tPag);
    irA(pagina+(e.deltaY>0?1:-1),true);
  }

  function mover(e){
    if(!arrastre||e.pointerId!==arrastre.id) return;
    if(!arrastre.movido && Math.abs(e.clientY-arrastre.y0)<5 && Math.abs(e.clientX-arrastre.x0)<5) return;
    arrastre.movido=true;
    e.preventDefault();
    arrastre.card.style.left=(e.clientX-arrastre.dx)+'px';
    arrastre.card.style.top=(e.clientY-arrastre.dy)+'px';
    ultimoPunto={x:e.clientX,y:e.clientY};
    revisarBarra(e.clientX,e.clientY);

    const el=document.elementFromPoint(e.clientX,e.clientY);
    const otra=el&&el.closest?el.closest('#masGrid .product-card'):null;
    if(!otra) return;
    const grid=document.getElementById('masGrid');
    if(!grid||!grid.contains(otra)) return;
    const r=otra.getBoundingClientRect();
    const mismaFila=e.clientY>=r.top && e.clientY<=r.bottom;
    const antes=mismaFila ? e.clientX<r.left+r.width/2 : e.clientY<r.top+r.height/2;
    const destino=antes?otra:otra.nextSibling;
    if(destino===arrastre.hueco) return;
    reacomodar(grid,()=>grid.insertBefore(arrastre.hueco,destino));
  }

  // Índice final dentro de CATALOGO según dónde quedó el hueco.
  function destinoDeHueco(hueco, grid, slug){
    const rest=CATALOGO.filter(p=>p.slug!==slug);
    const hijos=[...grid.children].filter(n=>n.classList.contains('product-card')||n.classList.contains('po-hueco'));
    const h=hijos.indexOf(hueco);
    if(h<0) return CATALOGO.findIndex(p=>p.slug===slug);
    const cap=(pagina-1)*POR_PAGINA+h;
    if(cap>=rest.length) return rest.length;
    const ref=rest[cap];
    const i=CATALOGO.findIndex(p=>p.slug===ref.slug);
    return i<0?rest.length:i;
  }

  function soltar(e){
    if(!arrastre||(e.pointerId!=null&&e.pointerId!==arrastre.id)) return;
    const {card,hueco,slug,movido}=arrastre;
    const grid=document.getElementById('masGrid');
    document.removeEventListener('pointermove',mover);
    document.removeEventListener('pointerup',soltar);
    document.removeEventListener('pointercancel',soltar);
    document.removeEventListener('keydown',tecla);
    document.removeEventListener('wheel',rueda);
    clearTimeout(tPag);sobrePag=null;ultimoPunto=null;
    document.body.classList.remove('arrastrando-producto');
    ocultarBarra();

    const antes=grid?medir(grid):new Map();
    if(grid) antes.set(slug, card.getBoundingClientRect());
    const destino=grid?destinoDeHueco(hueco,grid,slug):arrastre.origen;

    restablecer(card);
    hueco.remove();
    card.remove();
    arrastre=null;
    arrastreSlug=null;
    bloqueoHasta=Date.now()+400;

    if(!movido){
      if(grid) pintarPagina(grid);
      pintarControles();
      return;
    }

    const ordenPrevio=new Map(CATALOGO.map((p,i)=>[p.slug,i+1]));
    const origenAhora=CATALOGO.findIndex(p=>p.slug===slug);
    if(origenAhora>=0){
      let d=destino;
      if(origenAhora<d) d--;
      d=Math.max(0,Math.min(d,CATALOGO.length-1));
      const item=CATALOGO.splice(origenAhora,1)[0];
      CATALOGO.splice(d,0,item);
    }

    if(grid) pintarPagina(grid,antes);
    pintarControles();
    guardarOrden(ordenPrevio);
  }

  // Mientras se arrastra: los números saltan a esa página (Enter los aplica
  // al instante), Escape cancela y las flechas del teclado pasan de a una.
  function tecla(e){
    if(!arrastre) return;
    const tag=(e.target&&e.target.tagName)||'';
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;

    if(e.key==='Escape'){
      e.preventDefault();
      // Si estabas escribiendo una página, primero se borra eso.
      if(bufferPag){ limpiarBuffer(); actualizarBarra(); return; }
      cancelarArrastre();
      return;
    }
    if(e.key==='Enter'&&bufferPag){
      e.preventDefault();
      saltarBuffer();
      return;
    }
    if(e.key==='Backspace'&&bufferPag){
      e.preventDefault();
      clearTimeout(tPag);sobrePag=null;repitiendo=null;
      bufferPag=bufferPag.slice(0,-1);
      clearTimeout(tBuffer);
      if(bufferPag) tBuffer=setTimeout(saltarBuffer,700);
      actualizarBarra();
      return;
    }
    if(/^[0-9]$/.test(e.key)){
      e.preventDefault();
      clearTimeout(tPag);sobrePag=null;repitiendo=null;
      bufferPag=(bufferPag+e.key).slice(-3);
      clearTimeout(tBuffer);
      actualizarBarra();
      tBuffer=setTimeout(saltarBuffer,700);
      return;
    }
    if(e.key==='ArrowRight'||e.key==='PageDown'){
      e.preventDefault();
      repitiendo=null;clearTimeout(tPag);
      irA(pagina+1,true);
    } else if(e.key==='ArrowLeft'||e.key==='PageUp'){
      e.preventDefault();
      repitiendo=null;clearTimeout(tPag);
      irA(pagina-1,true);
    }
  }

  function saltarBuffer(){
    const n=Number(bufferPag);
    limpiarBuffer();
    if(!arrastre) return;
    repitiendo=null;clearTimeout(tPag);
    if(n>=1) irA(n,true);
    actualizarBarra();
  }

  function cancelarArrastre(){
    if(!arrastre) return;
    const {card,hueco}=arrastre;
    document.removeEventListener('pointermove',mover);
    document.removeEventListener('pointerup',soltar);
    document.removeEventListener('pointercancel',soltar);
    document.removeEventListener('keydown',tecla);
    document.removeEventListener('wheel',rueda);
    clearTimeout(tPag);sobrePag=null;ultimoPunto=null;
    document.body.classList.remove('arrastrando-producto');
    ocultarBarra();
    restablecer(card);
    hueco.remove();
    card.remove();
    arrastre=null;
    arrastreSlug=null;
    const grid=document.getElementById('masGrid');
    if(grid) pintarPagina(grid);
    pintarControles();
  }

  // Guarda `position` solo en las filas que cambiaron de lugar.
  function guardarOrden(previo){
    const sb=window.sb;
    if(!sb||!previo||!previo.size) return;
    const avisar=(txt,malo)=>{
      try{ if(typeof EdUtil!=='undefined'&&EdUtil.toast) EdUtil.toast(txt,malo); else console.log(txt); }catch(e){}
    };
    const cambios=[];
    CATALOGO.forEach((p,i)=>{
      // Sin id no hay fila que actualizar (catálogo de demostración).
      if(p.id!=null && previo.get(p.slug)!==i+1) cambios.push({id:p.id,position:i+1});
    });
    if(!cambios.length) return;
    avisar('Guardando orden…');
    Promise.all(cambios.map(c=>sb.from('products').update({position:c.position}).eq('id',c.id)))
      .then(res=>{
        const malo=res.find(r=>r&&r.error);
        if(malo) throw malo.error;
        avisar('Orden de productos guardado');
      })
      .catch(err=>avisar('No se pudo guardar el orden: '+((err&&err.message)||err),true));
  }

  // Ojo: ni init() ni forceRefresh() vuelven a la página 1. Si el admin está
  // editando un producto de la página 3 y guarda, tiene que seguir en la 3
  // para pasar al siguiente; antes cada guardado lo devolvía al principio.
  // La página se recorta sola si el catálogo se achicó (ver pintarPagina).
  function init(){
    const grid=document.getElementById('masGrid');
    if(!grid)return;
    if(arrastre) tecla({key:'Escape'});
    if(!enganchado){
      enganchado=true;
      // La manito de cada tarjeta arranca el arrastre. Solo dentro de la
      // grilla paginada y solo con el modo edición prendido.
      document.addEventListener('pointerdown', e=>{
        if(!enEdicion()) return;
        const mano=e.target.closest('[data-mover-producto]');
        if(!mano) return;
        const card=mano.closest('.product-card');
        if(!card||!card.closest('#masGrid')) return;
        e.preventDefault(); e.stopPropagation();
        empezar(e,card,mano);
      }, true);
    }
    pintarPagina(grid);
    pintarControles();
    if(typeof Edicion!=='undefined')Edicion.remontar();
  }
  function forceRefresh(){
    const grid=document.getElementById('masGrid');
    if(arrastre) tecla({key:'Escape'});
    if(grid){
      pintarPagina(grid);
    }
    pintarControles();
  }
  return {
    init, forceRefresh,
    arrastrando:()=>!!arrastre,
    acabaDeArrastrar:()=>Date.now()<bloqueoHasta,
  };
})();

// Sección de categoría. No es otra ventana ni una franja más de la home: se
// abre encima, en blanco, con el banner de esa categoría arriba de todo y
// nada más. Debajo van sus productos y, más abajo, el resto del catálogo.
// La misma sección sirve para los resultados del buscador.
const CatPage=(()=>{
  let sec,overlay,banner,sub,titulo,grid,masWrap,masGrid,vacio;
  let abierta=false,catActual='todos';



  const lock  =()=>{document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';};
  const unlock=()=>{document.documentElement.style.overflow='';document.body.style.overflow='';};

  function mostrar(){
    if(!sec||abierta)return;
    abierta=true;
    sec.style.display='block';
    overlay.classList.add('active');
    sec.classList.add('active');
    sec.scrollTop=0;
    lock();
    if(typeof gsap!=='undefined'&&!reduceMotion()){
      gsap.fromTo(overlay,{opacity:0},{opacity:1,duration:.25,ease:'power2.out'});
      gsap.fromTo(sec,{opacity:0,y:26},{opacity:1,y:0,duration:.4,ease:'power3.out'});
    }
  }

  function cerrar(){
    if(!sec||!abierta)return;
    abierta=false;
    const fin=()=>{
      sec.style.display='none';sec.classList.remove('active');
      overlay.classList.remove('active');
      if(typeof gsap!=='undefined')gsap.set(sec,{clearProps:'opacity,transform'});
      unlock();
    };
    if(typeof gsap!=='undefined'&&!reduceMotion()){
      gsap.to(overlay,{opacity:0,duration:.2,ease:'power2.in'});
      gsap.to(sec,{opacity:0,y:20,duration:.25,ease:'power2.in',onComplete:fin});
    }else fin();
  }

  // Pinta el contenido. 'dentro' es lo que se pidió, 'fuera' el resto.
  function pintar(subT,titT,dentro,fuera,vacioT,cat){
    clonarPieEn('cpageFooter');
    banner.innerHTML = '';
    banner.hidden = true;
    sub.textContent=subT;
    titulo.textContent=titT;
    vacio.hidden=dentro.length>0;
    if(!dentro.length)vacio.textContent=vacioT;

    pintarProductos(grid,dentro);
    masWrap.hidden=!fuera.length;
    if(fuera.length)pintarProductos(masGrid,fuera);
    else masGrid.innerHTML='';
    animarProductos(grid);animarProductos(masGrid);
    if(typeof Edicion!=='undefined')Edicion.remontar();
  }

  function abrir(cat){
    if(!sec)return;
    catActual=cat;
    const dentro = cat==='todos' ? productosVisibles() : porCategoria(cat);
    const fuera  = cat==='todos' ? []               : productosVisibles().filter(p=>p.cat!==cat);
    pintar(
      cat==='todos' ? 'Todo el catálogo' : 'Categoría',
      Cats.nombre(cat), dentro, fuera,
      'Todavía no hay productos en esta categoría.', cat
    );
    mostrar();
  }

  // Sin acentos ni mayúsculas: "Batería" encuentra "bateria".
  const norm=s=>String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

  function buscar(q){
    if(!sec)return;
    const t=norm(q);
    if(!t){cerrar();return;}
    const hit=productosVisibles().filter(p=>norm(`${p.name} ${p.slug} ${p.desc||''}`).includes(t));
    pintar('Resultados de búsqueda',`"${q.trim()}"`,hit,[],`Sin resultados para "${q.trim()}"`,'');
    mostrar();
  }

  function init(){
    sec=document.getElementById('cpage');
    if(!sec)return;
    overlay=document.getElementById('cpageOverlay');
    banner =document.getElementById('cpageBanner');
    sub    =document.getElementById('cpageSub');
    titulo =document.getElementById('cpageTitulo');
    grid   =document.getElementById('cpageGrid');
    masWrap=document.getElementById('cpageMas');
    masGrid=document.getElementById('cpageMasGrid');
    vacio  =document.getElementById('cpageVacio');
    sec.style.display='none';

    document.getElementById('cpageBack')?.addEventListener('click',cerrar);
    overlay?.addEventListener('click',cerrar);

    // Los enlaces del pie apuntan a la home, que está detrás. Sin cerrar
    // primero, el visitante se quedaría aquí mientras la página de abajo salta
    // a otra parte. "Productos" es la excepción: sirve para abrir esto mismo.
    document.getElementById('cpageFooter')?.addEventListener('click',e=>{
      const a=e.target.closest('a');
      if(a&&!a.dataset.catAbrir)cerrar();
    });
    // Escape cierra, salvo que arriba esté abierta la ficha de un producto.
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      if(document.getElementById('ppage')?.classList.contains('active'))return;
      cerrar();
    });

    // Las tarjetas de categoría y el enlace "Productos" de la nav abren esto.
    document.addEventListener('click',e=>{
      const t=e.target.closest('[data-cat-abrir]');
      if(!t)return;
      e.preventDefault();
      abrir(t.dataset.catAbrir);
    });
  }

  return{init,abrir,buscar,cerrar,mostrar,estaAbierta:()=>abierta,catActual:()=>catActual};
})();

const Carousel3D=(()=>{
  function init(){
    if(typeof Swiper==='undefined')return;
    const sw=new Swiper('.csl-swiper',{effect:'coverflow',grabCursor:true,centeredSlides:true,slidesPerView:'auto',loop:false,initialSlide:2,mousewheel:{forceToAxis:true},keyboard:{enabled:true,onlyInViewport:true},coverflowEffect:{rotate:50,stretch:0,depth:50,modifier:1,slideShadows:false},navigation:{prevEl:'.csl-arr-prev',nextEl:'.csl-arr-next'},pagination:{el:'.csl-pagination',clickable:true}});
    const slides=document.querySelectorAll('.csl-swiper .swiper-slide');
    gsap.set(slides,{opacity:0,y:50});
    const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){gsap.to([...slides],{opacity:1,y:0,duration:.7,ease:'power3.out',stagger:.08});obs.disconnect();}});},{threshold:.2});
    obs.observe(document.querySelector('.csl-swiper'));
    let drag=false,pend=null;
    sw.on('sliderMove',()=>{drag=true;});sw.on('touchStart',()=>{drag=false;});
    sw.on('slideChangeTransitionEnd',()=>{if(pend!==null&&!pend.classList.contains('out-of-stock')){const s=pend;pend=null;ProductModal.open(s);}else{pend=null;}});
    document.querySelectorAll('.csl-swiper .swiper-slide[data-name]').forEach((slide,i)=>{
      slide.addEventListener('click',()=>{if(drag||slide.classList.contains('out-of-stock'))return;if(!slide.classList.contains('swiper-slide-active')){pend=slide;sw.slideTo(i);return;}ProductModal.open(slide);});
    });
  }
  return{init};
})();
