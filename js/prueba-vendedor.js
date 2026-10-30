/* ============================================================================
 *  MODO PRUEBA · Vendedor (solo en tu computador)
 *  ----------------------------------------------------------------------------
 *  Sirve para ver la tienda tal como la ve un vendedor, sin tocar la tienda
 *  real. No crea usuarios, no escribe en la base y no manda correos.
 *
 *  CÓMO SE USA (con el servidor local andando):
 *
 *      http://localhost:8129/index.html?prueba=vendedor
 *
 *  Qué hace:
 *    · Entra como un vendedor de mentira, sin pedir contraseña.
 *    · El catálogo, los precios y el stock se leen de la base como siempre
 *      (solo lectura), así lo que se ve es real.
 *    · Las ventas NO se guardan en la base: quedan en este navegador y
 *      aparecen en "Mis ventas". No llegan al panel del administrador y no
 *      descuentan stock.
 *    · El aviso por correo se salta.
 *
 *  Se apaga sola: fuera de localhost no hace nada, y en localhost solo se
 *  activa si la dirección lleva ?prueba=vendedor.
 *
 *  Para borrar el modo prueba: quitar la línea de este archivo en index.html
 *  y borrar este archivo. Nada más.
 * ========================================================================== */
(function () {
  'use strict';

  const esLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const pedido = new URLSearchParams(location.search).get('prueba');
  if (!esLocal || pedido !== 'vendedor') return;
  if (!window.sb) return;

  const sb = window.sb;
  const UID = '00000000-0000-4000-8000-000000000001';
  const PERFIL = {
    id: UID,
    nombre: 'Vendedor de prueba',
    email: 'prueba@esencialemporio.cl',
    rol: 'vendedor',
    activo: true,
    sucursal_id: null,
  };
  const CLAVE = 'esencial:prueba:ventas';

  /* ── Las ventas de prueba viven acá ───────────────────── */
  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      return Array.isArray(d) ? d : [];
    } catch (_) {
      return [];
    }
  }

  function escribir(filas) {
    try { localStorage.setItem(CLAVE, JSON.stringify(filas)); } catch (_) {}
  }

  // Misma escala de comisión que la base, para que "Mis ventas" muestre
  // números reales y no ceros.
  function comisionUnidad(precio) {
    const p = Number(precio) || 0;
    if (p <= 0) return 0;
    if (p <= 10500) return 1300;
    if (p <= 22500) return 1800;
    if (p <= 32500) return 2300;
    return 2800;
  }

  const nuevoId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'prueba-' + Date.now() + '-' + Math.random().toString(16).slice(2);

  /* ── Consultas de mentira ─────────────────────────────── */
  // Imita lo justo del cliente de Supabase que usa la web: se puede encadenar
  // select/eq/order/limit y se resuelve como una promesa.
  function consulta(tabla) {
    const e = { tipo: 'select', datos: null, filtros: [], orden: null, limite: null, uno: false };

    const filasBase = () => tabla === 'ventas' ? leer()
      : tabla === 'profiles' ? [PERFIL]
      : [];

    const guardarBase = filas => { if (tabla === 'ventas') escribir(filas); };

    function correr() {
      const filas = filasBase();

      if (e.tipo === 'insert') {
        const nuevas = (Array.isArray(e.datos) ? e.datos : [e.datos]).map(f => Object.assign({
          id: nuevoId(),
          estado: 'pendiente',
          created_at: new Date().toISOString(),
        }, f, {
          comision: f.comision || (f.cantidad || 1) * comisionUnidad(f.precio_unitario),
        }));
        guardarBase(filas.concat(nuevas));
        return { data: nuevas, error: null };
      }

      if (e.tipo === 'update') {
        const dentro = f => e.filtros.every(p => p(f));
        const salida = filas.map(f => dentro(f) ? Object.assign({}, f, e.datos) : f);
        guardarBase(salida);
        return { data: salida.filter(dentro), error: null };
      }

      if (e.tipo === 'delete') {
        guardarBase(filas.filter(f => !e.filtros.every(p => p(f))));
        return { data: null, error: null };
      }

      let data = filas.filter(f => e.filtros.every(p => p(f)));
      if (e.orden) {
        data = data.slice().sort((a, b) => {
          const x = a[e.orden.col], y = b[e.orden.col];
          if (x === y) return 0;
          return (x > y ? 1 : -1) * (e.orden.asc ? 1 : -1);
        });
      }
      if (e.limite != null) data = data.slice(0, e.limite);
      return { data: e.uno ? (data[0] || null) : data, error: null };
    }

    const api = {
      select() { return api; },
      insert(d) { e.tipo = 'insert'; e.datos = d; return api; },
      update(d) { e.tipo = 'update'; e.datos = d; return api; },
      delete() { e.tipo = 'delete'; return api; },
      eq(col, val) { e.filtros.push(f => f[col] === val); return api; },
      in(col, vals) {
        const lista = vals || [];
        e.filtros.push(f => lista.includes(f[col]));
        return api;
      },
      order(col, opciones) {
        e.orden = { col, asc: !opciones || opciones.ascending !== false };
        return api;
      },
      limit(n) { e.limite = n; return api; },
      maybeSingle() { e.uno = true; return api; },
      single() { e.uno = true; return api; },
      then(ok, mal) { return Promise.resolve().then(correr).then(ok, mal); },
      catch(mal) { return api.then(null, mal); },
    };
    return api;
  }

  const fromReal = sb.from.bind(sb);
  sb.from = function (tabla) {
    // Lo que el vendedor lee o escribe se responde acá. Todo lo demás
    // (catálogo, comunas, sucursales, reseñas) va a la base como siempre,
    // solo lectura.
    if (tabla === 'ventas' || tabla === 'pagos' || tabla === 'profiles') return consulta(tabla);
    return fromReal(tabla);
  };

  /* ── La sesión falsa ──────────────────────────────────── */
  sb.auth.getSession = async () => ({
    data: {
      session: {
        user: { id: UID, email: PERFIL.email },
        access_token: 'prueba-local',
      },
    },
  });

  // "Cerrar sesión" en modo prueba no tiene a quién desconectar: se usa para
  // volver a la web normal (sin ?prueba=vendedor).
  sb.auth.signOut = () => {
    location.replace(location.pathname);
    return new Promise(() => {});
  };

  // El correo al dueño no tiene sentido en una prueba y no existe la API
  // corriendo en local: se responde que ya se envió y se sigue.
  //
  // Además, la sesión falsa no es un token de verdad. Cuando la web pide el
  // catálogo, se le saca ese token para que la base la trate como visita
  // anónima y la lectura funcione igual que en la web pública.
  const fetchReal = window.fetch;
  window.fetch = function (url, opciones) {
    const destino = String((url && url.url) || url || '');

    if (destino.indexOf('/api/aviso-venta') !== -1) {
      return Promise.resolve(new Response(
        JSON.stringify({ ok: true, enviado: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    if (window.SUPABASE_URL && destino.indexOf(window.SUPABASE_URL) === 0) {
      const copia = Object.assign({}, opciones || {});
      const cabeceras = new Headers(copia.headers || {});
      if ((cabeceras.get('authorization') || '').indexOf('prueba-local') !== -1) {
        cabeceras.delete('authorization');
      }
      copia.headers = cabeceras;
      return fetchReal.call(this, url, copia);
    }

    return fetchReal.apply(this, arguments);
  };

  /* ── Cartel para no confundirse ───────────────────────── */
  function cartel() {
    if (document.querySelector('.pv-cartel')) return;
    const caja = document.createElement('div');
    caja.className = 'pv-cartel';
    caja.style.cssText = [
      'position:fixed', 'left:14px', 'bottom:14px', 'z-index:99999',
      'display:flex', 'flex-wrap:wrap', 'align-items:center', 'gap:8px 12px',
      'max-width:calc(100vw - 28px)', 'padding:10px 14px', 'border-radius:12px',
      'background:#1b1b1b', 'color:#f4efe3', 'font:600 12px/1.3 system-ui,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,.28)', 'border:1px solid rgba(233,217,168,.35)',
    ].join(';');
    caja.innerHTML = `
      <span style="color:#e9d9a8">Modo prueba · vendedor</span>
      <span style="font-weight:400;opacity:.8">Las ventas quedan solo en este navegador.</span>
      <button type="button" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(233,217,168,.4);background:transparent;color:#e9d9a8;font:inherit;cursor:pointer">Borrar ventas de prueba</button>`;
    caja.querySelector('button').addEventListener('click', () => {
      escribir([]);
      caja.querySelector('button').textContent = 'Borradas';
      setTimeout(() => { caja.querySelector('button').textContent = 'Borrar ventas de prueba'; }, 1200);
    });
    document.body.appendChild(caja);
  }

  if (document.body) cartel();
  else document.addEventListener('DOMContentLoaded', cartel);
})();
