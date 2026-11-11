import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const description = 'Agencia de marketing, diseño, web y redes que usa la IA para que tu marca llegue primero, con criterio humano en cada pieza.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Graficante · Diseño con criterio',
  description,
  openGraph: {
    type: 'website',
    siteName: 'Graficante',
    title: 'Graficante · Criterio humano a velocidad de IA',
    description,
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    locale: 'es_MX',
    alternateLocale: ['en_US'],
  },
  twitter: { card: 'summary_large_image', title: 'Graficante · Criterio humano a velocidad de IA', description, images: ['/og.png'] },
};

export const viewport: Viewport = { themeColor: '#0E0E0E', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- las tipografías se usan en todo el sitio */}
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&family=Playfair+Display:wght@500&family=Source+Serif+4:opsz,wght@8..60,700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
