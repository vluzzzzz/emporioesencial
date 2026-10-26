const { sbRest, sbConfigurado, SB_URL, UUID_RE } = require('./_supabase');

const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = () => process.env.SUPABASE_ANON_KEY || SB_KEY();

async function usuarioDelToken(token) {
  const r = await fetch(`${SB_URL()}/auth/v1/user`, {
    headers: { apikey: ANON_KEY(), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

async function esAdmin(id) {
  const out = await sbRest('profiles', {
    method: 'GET',
    query: `?id=eq.${encodeURIComponent(id)}&select=rol,activo`,
  });
  const p = Array.isArray(out) && out[0];
  return !!(p && p.activo && p.rol === 'admin');
}

// Un moderador sin sucursal no sabría qué caja atender, y una sucursal
// apagada ya no recibe pedidos nuevos.
async function sucursalValida(id) {
  if (!UUID_RE.test(String(id || ''))) return false;
  const out = await sbRest('sucursales', {
    method: 'GET',
    query: `?id=eq.${encodeURIComponent(id)}&activa=is.true&select=id`,
  });
  return Array.isArray(out) && out.length > 0;
}

// Las tablas de pagos llegaron después. Si el proyecto todavía no corrió
// ese archivo, el borrado tiene que seguir igual.
async function soltar(tabla, query, method, body) {
  try {
    await sbRest(tabla, { method, query, body, prefer: 'return=minimal' });
  } catch (err) {
    if (!/does not exist|42P01|PGRST205/i.test(String(err && err.message || err))) throw err;
  }
}

async function crearUsuario(fila) {
  const r = await fetch(`${SB_URL()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fila),
  });
  const txt = await r.text();
  let json = null;
  try { json = JSON.parse(txt); } catch {}
  if (!r.ok) {
    const msg = (json && (json.msg || json.message || json.error_description)) || txt;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return json;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!sbConfigurado()) return res.status(500).json({ error: 'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Falta la sesión' });

  try {
    const quien = await usuarioDelToken(token);
    if (!quien || !quien.id) return res.status(401).json({ error: 'Sesión no válida' });
    if (!(await esAdmin(quien.id))) return res.status(403).json({ error: 'Solo un administrador puede crear vendedores' });

    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');

    if (b.accion === 'clave') {
      if (!b.id) return res.status(400).json({ error: 'Falta el usuario' });
      if (password.length < 8) return res.status(400).json({ error: 'La contraseña necesita 8 caracteres o más' });
      const r = await fetch(`${SB_URL()}/auth/v1/admin/users/${encodeURIComponent(b.id)}`, {
        method: 'PUT',
        headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      return res.status(200).json({ ok: true });
    }

    // Borrar a alguien del equipo, con todo su historial. Las ventas van
    // primero porque la base no deja borrar a quien todavía tiene alguna
    // (ventas.vendedor_id es on delete restrict).
    if (b.accion === 'borrar') {
      if (!b.id) return res.status(400).json({ error: 'Falta el usuario' });
      if (b.id === quien.id) return res.status(400).json({ error: 'No te puedes borrar a ti mismo' });
      const suyo = `?vendedor_id=eq.${encodeURIComponent(b.id)}`;

      // Las guías de despacho apuntan a las ventas: se van con ellas.
      const suyas = await sbRest('ventas', { method: 'GET', query: suyo + '&select=id' });
      const ids = (Array.isArray(suyas) ? suyas : []).map(v => v.id);
      if (ids.length) {
        await sbRest('guias', {
          method: 'DELETE',
          query: `?venta_id=in.(${ids.map(encodeURIComponent).join(',')})`,
        });
      }
      await sbRest('ventas', { method: 'DELETE', query: suyo });

      // Sus pagos y su cuenta bancaria se van solos con la cuenta, pero solo
      // si las tablas de pagos ya están creadas. Si todavía no se corrió ese
      // archivo, no es motivo para frenar el borrado.
      await soltar('pagos',          `?vendedor_id=eq.${encodeURIComponent(b.id)}`, 'DELETE');
      await soltar('datos_bancarios', `?vendedor_id=eq.${encodeURIComponent(b.id)}`, 'DELETE');

      // Lo que esta persona tocó en ventas de OTROS no se borra: esas ventas
      // son de otro vendedor y su comisión tiene que quedar. Lo que se suelta
      // es la huella de quién las cargó o las resolvió.
      const huellas = [
        ['ventas', 'vendido_por'],
        ['ventas', 'resuelto_por'],
        ['pagos',  'pagado_por'],
        ['guias',  'creada_por'],
      ];
      for (const [tabla, campo] of huellas) {
        await soltar(tabla, `?${campo}=eq.${encodeURIComponent(b.id)}`, 'PATCH', { [campo]: null });
      }

      const r = await fetch(`${SB_URL()}/auth/v1/admin/users/${encodeURIComponent(b.id)}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` },
      });
      if (!r.ok) {
        const txt = await r.text();
        // La base frena el borrado si queda algo apuntando a esa cuenta.
        // Decir cuál es la tabla ahorra media hora de adivinanzas.
        if (/foreign key|still referenced/i.test(txt)) {
          const tabla = (txt.match(/table "([^"]+)"/g) || []).pop() || '';
          return res.status(409).json({
            error: 'Todavía queda algo apuntando a esta cuenta' + (tabla ? ' en ' + tabla.replace(/table |"/g, '') : '') +
              '. Corre supabase/borrar-persona.sql en Supabase y prueba de nuevo.',
          });
        }
        return res.status(r.status).json({ error: txt });
      }
      return res.status(200).json({ ok: true, ventas: ids.length });
    }

    // Borrar una sucursal se lleva sus pedidos presenciales, y deja sin caja a
    // sus moderadores. Van primero porque la base no deja borrarla mientras
    // alguno de los dos siga apuntando a ella.
    if (b.accion === 'borrar-sucursal') {
      if (!UUID_RE.test(String(b.id || ''))) return res.status(400).json({ error: 'Falta la sucursal' });
      const suya = `?sucursal_id=eq.${encodeURIComponent(b.id)}`;

      const pedidos = await sbRest('ventas', { method: 'GET', query: suya + '&select=id' });
      const ids = (Array.isArray(pedidos) ? pedidos : []).map(v => v.id);
      if (ids.length) {
        await sbRest('guias', {
          method: 'DELETE',
          query: `?venta_id=in.(${ids.map(encodeURIComponent).join(',')})`,
        });
        await sbRest('ventas', { method: 'DELETE', query: suya });
      }

      // Sus moderadores no se borran: quedan desactivados y como vendedores,
      // para que el administrador decida después a qué caja los manda.
      const gente = await sbRest('profiles', { method: 'GET', query: suya + '&select=id' });
      const personas = (Array.isArray(gente) ? gente : []).length;
      if (personas) {
        await sbRest('profiles', {
          method: 'PATCH',
          query: suya,
          body: { rol: 'vendedor', sucursal_id: null, activo: false },
          prefer: 'return=minimal',
        });
      }

      await sbRest('sucursales', { method: 'DELETE', query: `?id=eq.${encodeURIComponent(b.id)}` });
      return res.status(200).json({ ok: true, ventas: ids.length, personas });
    }

    const nombre = String(b.nombre || '').trim().slice(0, 120);
    const telefono = String(b.telefono || '').trim().slice(0, 50);
    const observacion = String(b.observacion || '').trim().slice(0, 500);
    const rol = ['admin','moderador'].includes(b.rol) ? b.rol : 'vendedor';
    const sucursal_id = rol === 'moderador' ? String(b.sucursal_id || '') : null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo no válido' });
    if (rol === 'moderador' && !(await sucursalValida(sucursal_id))) {
      return res.status(400).json({ error: 'Elige una sucursal activa para el moderador' });
    }

    // Una cuenta oculta no se delata ni aquí: si alguien prueba crear un
    // vendedor con ese correo, la respuesta es la misma que daría un correo
    // escrito mal, no un "ya existe" que confirmaría que está.
    const yaEsta = await sbRest('profiles', {
      method: 'GET',
      query: `?email=eq.${encodeURIComponent(email)}&oculto=is.true&select=id`,
    });
    if (Array.isArray(yaEsta) && yaEsta.length) {
      return res.status(400).json({ error: 'Correo no válido' });
    }

    if (password.length < 8) return res.status(400).json({ error: 'La contraseña necesita 8 caracteres o más' });
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del vendedor' });
    if (telefono.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Falta el teléfono del vendedor' });

    const creado = await crearUsuario({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, telefono, observacion, rol, sucursal_id },
    });

    await sbRest('profiles', {
      method: 'POST',
      body: { id: creado.id, email, nombre, telefono, observacion, rol, sucursal_id, activo: true },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });

    return res.status(200).json({ ok: true, id: creado.id, email, nombre, rol });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/already been registered|already exists/i.test(msg)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    return res.status(err.status || 500).json({ error: msg });
  }
};
