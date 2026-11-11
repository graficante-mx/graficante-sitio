# Graficante · sitio

Landing de Graficante en Next.js 15, portada del prototipo aprobado (`../web/landing-prototipo.html`).

## Estructura
- `content/landing.html`: marcado de la landing (sale del prototipo). `app/page.tsx` lo sirve estático.
- `app/globals.css`: estilos de la landing. `app/legal.css`: aviso de privacidad y términos.
- `public/js/site.js`: comportamiento (scroll suave, ASCII, galerías, modal de casos, chat de Grafi, formulario).
- `public/img`, `public/media`, `public/lottie`: imágenes, video y tutoriales de Vibe (Lottie).
- `app/api/contact/route.ts`: recibe el formulario y lo envía por correo con Resend.
- `app/sitemap.ts`, `app/robots.ts`, `app/not-found.tsx`, `app/icon.svg`, `app/apple-icon.png`, `public/og.png`.

## Local
```bash
bun install
bun run dev
```
Sin `RESEND_API_KEY`, en local los mensajes del formulario solo aparecen en la consola.

## Publicar en Vercel
1. Sube esta carpeta a un repositorio de GitHub e impórtalo en Vercel (o usa `vercel` desde la terminal).
2. Variables de entorno (ver `.env.example`): `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`.
3. En Resend, verifica el dominio (`graficante.mx`) para poder enviar desde `web@graficante.mx`.
4. En Vercel, activa Analytics y conecta el dominio.
