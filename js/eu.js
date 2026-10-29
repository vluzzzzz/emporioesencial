// eu
'use strict';
/* ============================================================================
 *  EdUtil — lo que comparten los módulos de edición.
 *  Viene del panel viejo (js/ac.js y js/ap.js), metido en un IIFE: el scope
 *  global de la tienda ya tiene `fmt` y `slugify`, y declararlos de nuevo
 *  rompía la página entera.
 * ========================================================================== */
const EdUtil = (() => {
  const BUCKET = 'site-images';

  const escH = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const rid = () => Math.random().toString(36).slice(2,6);

  function slug(str){
    return String(str).toLowerCase().trim()
      .replace(/[áä]/g,'a').replace(/[éë]/g,'e').replace(/[íï]/g,'i')
      .replace(/[óö]/g,'o').replace(/[úü]/g,'u').replace(/ñ/g,'n')
      .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
  }

  let nodoToast = null, tiempoToast = null;
  function toast(msg, esError){
    if (!nodoToast) {
      nodoToast = document.createElement('div');
      nodoToast.className = 'ed-toast';
      document.body.appendChild(nodoToast);
    }
    nodoToast.textContent = msg;
    nodoToast.classList.toggle('err', !!esError);
    nodoToast.classList.add('ver');
    clearTimeout(tiempoToast);
    tiempoToast = setTimeout(() => nodoToast.classList.remove('ver'), 2800);
  }

  // confirm() del navegador desentona en la tienda; este usa el mismo panel.
  // `espera` son los segundos que el botón queda bloqueado, para que nadie
  // borre algo importante de un clic apurado. `ficha` es HTML ya armado por
  // quien llama, para mostrar qué se está por borrar.
  function confirmar(texto, textoBoton, espera, ficha){
    return new Promise(resolve => {
      const seg = Number(espera) || 0;
      const nombre = escH(textoBoton || 'Eliminar');
      const ov = document.createElement('div');
      ov.className = 'ed-conf';
      ov.innerHTML = `
        <div class="ed-conf-caja">
          <p>${escH(texto)}</p>
          ${ficha || ''}
          <div class="ed-conf-acc">
            <button type="button" class="venta-btn ghost" data-r="0">Cancelar</button>
            <button type="button" class="venta-btn peligro" data-r="1"${seg ? ' disabled' : ''}>${seg ? nombre + ' (' + seg + ')' : nombre}</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('abierto'));

      let reloj = null;
      if (seg) {
        const btn = ov.querySelector('[data-r="1"]');
        let quedan = seg;
        reloj = setInterval(() => {
          quedan--;
          if (quedan > 0) { btn.textContent = nombre + ' (' + quedan + ')'; return; }
          clearInterval(reloj); reloj = null;
          btn.disabled = false;
          btn.textContent = nombre;
        }, 1000);
      }

      // Mismo resguardo que los paneles: el clic que abrió este aviso no lo
      // cierra, y arrastrar desde adentro tampoco.
      const nacio = Date.now();
      let desdeElVelo = false;
      ov.addEventListener('pointerdown', e => { desdeElVelo = e.target === ov; });
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (b && b.disabled) return;
        if (!b && (e.target !== ov || !desdeElVelo || Date.now() - nacio < 250)) return;
        if (reloj) clearInterval(reloj);
        ov.remove();
        resolve(b ? b.dataset.r === '1' : false);
      });
    });
  }

  function mensajeError(err){
    const m = String(err && err.message || err);
    // La base ya lo dice claro cuando no alcanza el stock.
    if (/stock suficiente/i.test(m)) return m;
    if (m === 'SIN_PERMISO' || /row-level security/i.test(m))
      return 'Tu cuenta no tiene permiso para guardar esto.';
    if (/JWT|not authenticated|session/i.test(m))
      return 'Se cerró la sesión. Vuelve a entrar y prueba de nuevo.';
    if (/Failed to fetch|NetworkError/i.test(m))
      return 'Sin conexión con el servidor. Revisa internet y prueba de nuevo.';
    return 'Error al guardar: ' + m;
  }

  // Achica y pasa a WebP antes de subir: las fotos de celular pesan de más.
  function comprimirImagen(file, maxLado = 1200, calidad = 0.8){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w > maxLado || h > maxLado){
          if (w >= h){ h = Math.round(h * maxLado / w); w = maxLado; }
          else       { w = Math.round(w * maxLado / h); h = maxLado; }
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la imagen')), 'image/webp', calidad);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
      img.src = url;
    });
  }

  async function uploadFile(archivo, prefijo){
    const carpeta = prefijo || 'catalog/';
    let file = archivo;
    if (file.type && /^image\/(jpeg|png|webp|bmp)$/.test(file.type)) {
      try { file = await comprimirImagen(file); } catch {}
    }
    const ext = !file.name ? 'webp' : ((file.name.split('.').pop() || 'jpg').toLowerCase());
    const path = `${carpeta}${Date.now()}-${rid()}.${ext}`;
    const { error } = await window.sb.storage.from(BUCKET)
      .upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type || undefined });
    if (error) throw error;
    return window.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return { escH, rid, slug, toast, confirmar, mensajeError, comprimirImagen, uploadFile };
})();
