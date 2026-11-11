import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Página no encontrada · Graficante' };

export default function NotFound() {
  return (
    <main style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, textAlign: 'center' }}>
      <svg viewBox="0 5 48 39" width="72" aria-hidden="true"><rect x="3" y="7" width="42" height="35" rx="11" fill="#F1F1EF" /><rect x="13" y="22" width="6" height="2.5" rx="1.2" fill="#141414" /><rect x="29" y="22" width="6" height="2.5" rx="1.2" fill="#141414" /><path d="M19 35.5q5 -3 10 0" fill="none" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" /></svg>
      <h1 style={{ margin: 0, font: '600 clamp(36px,6vw,56px)/1.05 var(--font)', letterSpacing: '-.04em', color: '#F1F1EF' }}>Esta página no existe.</h1>
      <p style={{ margin: 0, color: '#8F8F8F', fontSize: 16 }}>Grafi la buscó por todas partes. Volvamos al inicio.</p>
      <Link href="/" className="btn y">Ir al inicio</Link>
    </main>
  );
}
