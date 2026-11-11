'use client';
import { useEffect } from 'react';

// Carga el comportamiento de la landing (scroll suave, animaciones ASCII, galerías, chat…)
// después de montar: primero Lenis y Lottie desde npm, luego el script del sitio, una sola vez.
export function SiteScripts() {
  useEffect(() => {
    const w = window as unknown as { Lenis?: unknown; lottie?: unknown; __siteLoaded?: boolean };
    if (w.__siteLoaded) return;
    w.__siteLoaded = true;
    Promise.all([import('lenis'), import('lottie-web/build/player/lottie_light')]).then(([lenis, lottie]) => {
      w.Lenis = lenis.default;
      w.lottie = lottie.default;
      const s = document.createElement('script');
      s.src = '/js/site.js';
      document.body.appendChild(s);
    });
  }, []);
  return null;
}
