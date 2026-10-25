// aviso-venta — le avisa por correo al dueño cada vez que entra un pedido.
//
// <meta charset> incluido: Resend manda el correo en UTF-8.
// El navegador manda solo el id. Los datos del correo se leen de la base con
// la llave de servicio, así que el vendedor no puede inventar un aviso con
// montos que no son.
//
// Variables en Vercel:
//   RESEND_API_KEY     la llave de Resend
//   AVISO_EMAIL_TO     a quién le llega (varios separados por coma)
//   AVISO_EMAIL_FROM   de quién sale; sin dominio propio dejá el de prueba
//   SITIO_URL          la web, para armar el botón "Revisar pedido"
const { sbRest, sbConfigurado, UUID_RE, SB_URL } = require('./_supabase');

const ANON_KEY = () => process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND = () => process.env.RESEND_API_KEY || '';
const PARA = () => String(process.env.AVISO_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);
const DESDE = () => process.env.AVISO_EMAIL_FROM || 'Esencial Emporio <onboarding@resend.dev>';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');

async function usuarioDelToken(token) {
  const r = await fetch(`${SB_URL()}/auth/v1/user`, {
    headers: { apikey: ANON_KEY(), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

function sitio(req) {
  if (process.env.SITIO_URL) return String(process.env.SITIO_URL).replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return host ? `https://${host}` : '';
}

function cuerpoHtml(v, enlace) {
  const fila = (rot, dato) => dato
    ? `<tr>
         <td style="padding:9px 14px;border-bottom:1px solid #e7e7ea;color:#6b6b72;font-size:13px">${esc(rot)}</td>
         <td style="padding:9px 14px;border-bottom:1px solid #e7e7ea;text-align:right;font-size:14px;font-weight:600">${esc(dato)}</td>
       </tr>` : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e7ea">

      <tr><td style="padding:18px 22px;background:#111">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#b98f2e">Pedido nuevo</div>
        <div style="margin-top:3px;font-size:19px;font-weight:700;color:#fff">Esencial Emporio</div>
      </td></tr>

      <tr><td style="padding:20px 22px 6px">
        <div style="font-size:18px;font-weight:700;line-height:1.3">${esc(v.producto_nombre)}${v.cantidad > 1 ? ' &times; ' + v.cantidad : ''}</div>
        <div style="margin-top:4px;font-size:13px;color:#6b6b72">${plata(v.precio_unitario)} por unidad &middot; lo registró ${esc(v.vendedor_nombre || 'un vendedor')}</div>
      </td></tr>

      <tr><td style="padding:14px 22px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e7ea;border-radius:12px;border-collapse:separate;overflow:hidden">
          ${fila('Cliente', v.cliente_nombre)}
          ${fila('Teléfono', v.cliente_telefono)}
          ${fila('Dirección', v.cliente_direccion)}
          ${fila('Comuna', v.comuna)}
          ${fila('Forma de pago', v.metodo_pago)}
          ${fila('Observación', v.notas)}
          <tr>
            <td style="padding:9px 14px;color:#6b6b72;font-size:13px">Cobrado al cliente</td>
            <td style="padding:9px 14px;text-align:right;font-size:14px;font-weight:600">${plata(v.total)}</td>
          </tr>
          <tr style="background:#f5f5f7">
            <td style="padding:12px 14px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Pagar al vendedor</td>
            <td style="padding:12px 14px;text-align:right;font-size:18px;font-weight:700;color:#1e7a3a">${plata(v.comision)}</td>
          </tr>
        </table>
      </td></tr>

      ${enlace ? `<tr><td style="padding:20px 22px 24px" align="center">
        <a href="${esc(enlace)}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#111;color:#e9d9a8;font-size:15px;font-weight:700;text-decoration:none">Revisar pedido</a>
        <div style="margin-top:10px;font-size:12px;color:#6b6b72">Abre la web para aceptar la comisión o denegar el pedido.</div>
      </td></tr>` : ''}

    </table>
  </td></tr></table>
</body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!sbConfigurado()) return res.status(500).json({ error: 'Falta la configuración de Supabase' });
  // Sin llave de Resend no es un error del vendedor: la venta ya se guardó.
  if (!RESEND() || !PARA().length) return res.status(200).json({ ok: true, enviado: false, motivo: 'aviso sin configurar' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Falta la sesión' });

  try {
    const quien = await usuarioDelToken(token);
    if (!quien || !quien.id) return res.status(401).json({ error: 'Sesión no válida' });

    const id = String((req.body || {}).id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Pedido no válido' });

    const filas = await sbRest('ventas', { method: 'GET', query: `?id=eq.${encodeURIComponent(id)}&select=*` });
    const v = Array.isArray(filas) && filas[0];
    if (!v) return res.status(404).json({ error: 'No existe ese pedido' });

    // Solo avisa de la venta propia, o de cualquiera si es administrador.
    if (v.vendedor_id !== quien.id) {
      const perfil = await sbRest('profiles', {
        method: 'GET', query: `?id=eq.${encodeURIComponent(quien.id)}&select=rol,activo`,
      });
      const p = Array.isArray(perfil) && perfil[0];
      if (!(p && p.activo && p.rol === 'admin')) return res.status(403).json({ error: 'Sin permiso' });
    }

    const base = sitio(req);
    const enlace = base ? `${base}/?pedido=${encodeURIComponent(v.id)}` : '';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: DESDE(),
        to: PARA(),
        subject: `Pedido nuevo · ${v.producto_nombre} · ${plata(v.total)}`,
        html: cuerpoHtml(v, enlace),
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: out.message || 'Resend rechazó el envío' });

    return res.status(200).json({ ok: true, enviado: true, id: out.id });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
};
