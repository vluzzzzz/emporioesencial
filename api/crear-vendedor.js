const { sbRest, sbConfigurado, SB_URL } = require('./_supabase');

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
      if (b.id === quien.id) return res.status(400).json({ error: 'No te podés borrar a vos mismo' });
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

      const r = await fetch(`${SB_URL()}/auth/v1/admin/users/${encodeURIComponent(b.id)}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` },
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      return res.status(200).json({ ok: true, ventas: ids.length });
    }

    const nombre = String(b.nombre || '').trim().slice(0, 120);
    const telefono = String(b.telefono || '').trim().slice(0, 50);
    const observacion = String(b.observacion || '').trim().slice(0, 500);
    const rol = b.rol === 'admin' ? 'admin' : 'vendedor';

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo no válido' });

    // Una cuenta oculta no se delata ni acá: si alguien prueba crear un
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
      user_metadata: { nombre, telefono, observacion, rol },
    });

    await sbRest('profiles', {
      method: 'POST',
      body: { id: creado.id, email, nombre, telefono, observacion, rol, activo: true },
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
