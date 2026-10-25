// aviso-venta — manda por correo la etiqueta de despacho del pedido nuevo.
//
// Lo que llega es para imprimir y pegar en el paquete: solo los datos del
// cliente. Nada de comisiones ni botones.
//
// El navegador manda solo el id; los datos se leen de la base con la llave
// de servicio, así que el vendedor no puede inventar una etiqueta.
//
// Variables en Vercel:
//   RESEND_API_KEY     la llave de Resend
//   AVISO_EMAIL_TO     a quién le llega (varios separados por coma)
//   AVISO_EMAIL_FROM   de quién sale; sin dominio propio deja el de prueba
const { sbRest, sbConfigurado, UUID_RE, SB_URL } = require('./_supabase');

const ANON_KEY = () => process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND = () => process.env.RESEND_API_KEY || '';
const PARA = () => String(process.env.AVISO_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);
const DESDE = () => process.env.AVISO_EMAIL_FROM || 'Esencial Emporio <onboarding@resend.dev>';

const plata = n => '$' + Number(n || 0).toLocaleString('es-CL');
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

async function usuarioDelToken(token) {
  const r = await fetch(`${SB_URL()}/auth/v1/user`, {
    headers: { apikey: ANON_KEY(), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// El correo es la guía de despacho que se imprime y se pega en el paquete:
// la misma que ve el repartidor en guia.html. A dónde va, a quién le
// entrega, a quién le pregunta y cuánto cobra. Nada de la comisión del
// vendedor ni de la ganancia del negocio.
// Va en todas las ventas, sea transferencia o efectivo.
const CUENTA = {
  titular: 'Macarena Paz Fernández Vargas',
  rut: '18746772-1',
  banco: 'Mercado Pago',
  tipo: 'Cuenta Vista',
  numero: '1054078997',
};

function cuerpoHtml(v, vendedor) {
  const BORDE = '1px solid #d2d2d7';
  const fila = (rot, dato) => dato
    ? `<tr>
         <td style="width:34%;padding:11px 14px;border-bottom:${BORDE};color:#6b6b72;font-size:12.5px;vertical-align:middle">${esc(rot)}</td>
         <td style="padding:11px 14px;border-bottom:${BORDE};border-left:${BORDE};text-align:right;font-size:15px;font-weight:700;vertical-align:middle">${esc(dato)}</td>
       </tr>` : '';

  const titulo = t => `<tr><td colspan="2" style="padding:14px 14px 7px;border-bottom:${BORDE};font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6b72">${esc(t)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 12px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #111;border-collapse:collapse">

      <tr><td colspan="2" style="padding:14px 18px;background:#111">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#b98f2e">Guía de despacho</div>
        <div style="margin-top:2px;font-size:17px;font-weight:700;color:#fff">Esencial Emporio</div>
      </td></tr>

      <tr><td colspan="2" style="padding:16px 18px 13px;border-bottom:${BORDE}">
        <div style="font-size:17px;font-weight:700;line-height:1.3">${esc(v.producto_nombre)}${v.cantidad > 1 ? ' &times; ' + v.cantidad : ''}</div>
        <div style="margin-top:3px;font-size:12.5px;color:#6b6b72">${v.cantidad || 1} unidad${(v.cantidad || 1) === 1 ? '' : 'es'}</div>
      </td></tr>

      ${titulo('Entregar a')}
      ${fila('Nombre', v.cliente_nombre)}
      ${fila('Teléfono', v.cliente_telefono)}
      ${fila('Dirección', v.cliente_direccion)}
      ${fila('Comuna', v.comuna)}
      ${fila('Observación', v.notas)}

      ${titulo('Consultas')}
      ${fila('Vendedor', vendedor.nombre)}
      ${fila('Teléfono', vendedor.telefono)}

      ${titulo('Pago')}
      ${fila('Forma de pago', v.metodo_pago)}
      ${fila('Titular', CUENTA.titular)}
      ${fila('RUT', CUENTA.rut)}
      ${fila('Banco', CUENTA.banco)}
      ${fila('Tipo de cuenta', CUENTA.tipo)}
      ${fila('Número de cuenta', CUENTA.numero)}
      <tr>
        <td style="width:34%;padding:14px;background:#f5f5f7;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;vertical-align:middle">Total</td>
        <td style="padding:14px;background:#f5f5f7;border-left:${BORDE};text-align:right;font-size:22px;font-weight:700;vertical-align:middle">${plata(v.total)}</td>
      </tr>

      <tr><td colspan="2" style="padding:11px 14px;border-top:${BORDE};font-size:11px;color:#6b6b72">
        ${esc(new Date(v.created_at).toLocaleDateString('es-CL'))} &nbsp;&middot;&nbsp; Pedido ${esc(String(v.id).slice(0, 8))}
      </td></tr>

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

    // El teléfono del vendedor vive en su perfil: la venta solo guarda el
    // nombre con que se registró.
    const quienVende = await sbRest('profiles', {
      method: 'GET', query: `?id=eq.${encodeURIComponent(v.vendedor_id)}&select=nombre,telefono,email`,
    });
    const u = (Array.isArray(quienVende) && quienVende[0]) || {};
    const vendedor = {
      nombre: u.nombre || v.vendedor_nombre || u.email || 'Sin nombre',
      telefono: u.telefono || '',
    };

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: DESDE(),
        to: PARA(),
        subject: `Guía · ${v.producto_nombre} · ${v.cliente_nombre || 'cliente'}, ${v.comuna || ''}`.trim(),
        html: cuerpoHtml(v, vendedor),
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: out.message || 'Resend rechazó el envío' });

    return res.status(200).json({ ok: true, enviado: true, id: out.id });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
};
