import { NextResponse } from 'next/server';

// Recibe el formulario de contacto y lo envía al correo del equipo con Resend.
// Variables: RESEND_API_KEY, CONTACT_TO (a quién llega) y CONTACT_FROM (remitente de un dominio verificado en Resend).

type Payload = { nombre?: unknown; correo?: unknown; mensaje?: unknown; necesita?: unknown; presupuesto?: unknown; website?: unknown; idioma?: unknown };

const hits = new Map<string, number[]>();   // límite simple por IP: 5 envíos cada 10 minutos (por instancia)
function limited(ip: string) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 10 * 60_000);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function POST(req: Request) {
  let body: Payload;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (str(body.website, 200)) return NextResponse.json({ ok: true });   // trampa para bots: se finge éxito y no se envía nada

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'too_many' }, { status: 429 });

  const nombre = str(body.nombre, 120), correo = str(body.correo, 200), mensaje = str(body.mensaje, 4000);
  const presupuesto = str(body.presupuesto, 40), idioma = str(body.idioma, 2) === 'en' ? 'en' : 'es';
  const necesita = Array.isArray(body.necesita) ? body.necesita.map(v => str(v, 40)).filter(Boolean).slice(0, 8) : [];
  if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 422 });

  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO, from = process.env.CONTACT_FROM;
  if (!key || !to || !from) {
    if (process.env.NODE_ENV !== 'production') {   // en local, sin llaves, solo se muestra en la consola
      console.log('[contacto] sin Resend configurado; mensaje:', { nombre, correo, necesita, presupuesto, mensaje, idioma });
      return NextResponse.json({ ok: true, dev: true });
    }
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  const rows: [string, string][] = [['Nombre', nombre], ['Correo', correo], ['Necesita', necesita.join(', ') || '—'], ['Presupuesto', presupuesto || '—'], ['Idioma', idioma], ['Mensaje', mensaje || '—']];
  const html = `<h2>Nuevo mensaje desde graficante.mx</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to.split(',').map(s => s.trim()), reply_to: correo, subject: `Nuevo contacto: ${nombre}`, html, text }),
  });
  if (!r.ok) { console.error('[contacto] Resend respondió', r.status, await r.text()); return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 502 }); }
  return NextResponse.json({ ok: true });
}
