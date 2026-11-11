
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  /* ---------- scroll suave (Lenis) y menú ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) { lenis = new window.Lenis({lerp: .16, wheelMultiplier: 1.1, smoothWheel: true}); /* suave pero sin sensación de arrastre */ window.__lenis = lenis; }
  const nav = $('nav');
  // al bajar se compacta; al subir (más de 8 px seguidos) vuelve el menú completo, más opaco para leerse sobre el contenido
  let lastY = 0, acc = 0;
  const onScroll = y => {
    const d = y - lastY; lastY = y; acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
    if (y <= 80) { nav.classList.remove('scrolled', 'up'); return; }
    if (acc > 8) { nav.classList.add('scrolled'); nav.classList.remove('up'); }
    else if (acc < -8) { nav.classList.remove('scrolled'); nav.classList.add('up'); }
    else if (!nav.classList.contains('up')) nav.classList.add('scrolled');
  };
  if (lenis) { lenis.on('scroll', e => onScroll(e.scroll)); (function raf(t){ lenis.raf(t); requestAnimationFrame(raf); })(performance.now()); }
  else addEventListener('scroll', () => onScroll(scrollY), {passive: true});
  onScroll(scrollY);

  /* ---------- terreno de ondas en ASCII (como un paisaje de partículas, hecho con caracteres) ---------- */
  const cv = $('terrain'), ctx = cv.getContext('2d'), hero = document.querySelector('.hero');
  const RAMP = ' .·:-=+*%#@';
  // ruido de valor 2D con octavas: colinas suaves que se desplazan despacio
  const perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const fade = t => t * t * (3 - 2 * t), hash = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.1, y * 2.1) * .28 + vnoise(x * 4.3, y * 4.3) * .17;
  // atlas: cada carácter pintado una vez por nivel de brillo, luego solo se copia (rápido)
  let A = null;
  function buildAtlas(dpr){
    const L = 12, fs = Math.round(15 * dpr), cell = Math.ceil(fs * 1.1), c = document.createElement('canvas');
    c.width = cell * RAMP.length; c.height = cell * L; const g = c.getContext('2d');
    g.font = `500 ${fs}px Figtree, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const dark = [46, 46, 46], bone = [241, 241, 239];
    for (let l = 0; l < L; l++) {
      const t = l / (L - 1), col = mix(dark, bone, t);                      // solo neutros: de gris oscuro a hueso
      g.fillStyle = `rgb(${col})`; [...RAMP].forEach((ch, k) => g.fillText(ch, k * cell + cell / 2, l * cell + cell / 2));
    }
    A = {c, cell, L};
  }
  let W = 0, H = 0, dpr = 1;
  const mouse = {x: .5, y: .5, tx: .5, ty: .5, on: 0, ton: 0};
  function size(){
    dpr = Math.min(matchMedia('(max-width:760px)').matches ? 1.25 : 1.5, devicePixelRatio || 1); const r = cv.getBoundingClientRect();
    W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); buildAtlas(dpr);
  }
  hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height; mouse.ton = 1; });
  hero.addEventListener('pointerleave', () => { mouse.ton = 0; });
  const NX = 150, NZ = 52, ZN = 1.2, ZF = 8;
  function draw(t){
    if (!A) return;
    ctx.clearRect(0, 0, W, H);
    mouse.x += (mouse.tx - mouse.x) * .035; mouse.y += (mouse.ty - mouse.y) * .035; mouse.on += (mouse.ton - mouse.on) * .03;
    const fx = W * .6, fy = H * 1.15, horizon = H * .3, camY = 1.45,   // horizonte bajo: el paisaje se queda abajo
      drift = t * .00011;   // avance lento: ~0.11 colinas por segundo
    // punto del terreno bajo el cursor (aprox.): profundidad según la altura en pantalla, x según la columna
    const my = Math.min(.98, Math.max(.05, mouse.y)), mz = Math.max(ZN, (camY - .45) * fy / Math.max(1, my * H - horizon));
    const mxw = (mouse.x * W - W / 2) * mz / fx;
    for (let k = NZ - 1; k >= 0; k--) {                          // de lejos a cerca
      const z = ZN + (ZF - ZN) * Math.pow(k / (NZ - 1), 1.35);
      const span = z * (W / fx) * .62, sc = Math.min(1.2, Math.max(.3, 1.6 / z)), fog = Math.min(1, Math.max(0, 1.2 - (z - ZN) / (ZF - ZN)));
      const off = (k * .37) % 1;                                  // filas desfasadas: sin columnas alineadas
      for (let i = 0; i < NX; i++) {
        const x = ((i + off) / NX - .5) * span * 2;
        const nx = x * .42, nz = z * .42 - drift;
        const bump = mouse.on * .18 * Math.exp(-((x - mxw) ** 2 + (z - mz) ** 2) / 2.2);   // el cursor levanta una loma suave
        const h = fbm(nx + 7, nz) * .95 + bump, hR = fbm(nx + 7.04, nz) * .95 + bump;   // olas más bajas
        const sy = horizon + (camY - h) / z * fy, sx = W / 2 + x / z * fx;
        if (sx < -20 || sx > W + 20 || sy > H + 20 || sy < -20) continue;
        let b = (h - .22) * 1.6 + (h - hR) * 11;                   // altura + luz lateral
        b = Math.min(1, Math.max(0, b)) * fog;
        if (b < .04) continue;
        ctx.globalAlpha = Math.min(1, (b - .04) / .18);          // aparece y se apaga gradualmente, sin parpadeos
        const ci = Math.min(RAMP.length - 1, 1 + Math.floor(b * (RAMP.length - 1))), li = Math.min(A.L - 1, Math.floor(b * A.L));
        const sz = A.cell * sc * .8;
        ctx.drawImage(A.c, ci * A.cell, li * A.cell, A.cell, A.cell, sx - sz / 2, sy - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }
  let vis = true;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(hero);
  let lastT = 0; const FRAME = matchMedia('(max-width:760px)').matches ? 1000 / 24 : 1000 / 30;   // el terreno se mueve lento: 24–30 fps se ven igual y cuestan la mitad
  function loop(t){ if (vis && !document.hidden && t - lastT >= FRAME) { lastT = t; draw(t); } requestAnimationFrame(loop); }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); if (reduce) draw(0); }, 200); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { size(); if (reduce) draw(0); else requestAnimationFrame(loop); });
})();

;

/* ---------- botones: al pasar el cursor, el texto se descifra en ASCII ---------- */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const RAMP = '.:-=+*/|<>';
  function prep(b){
    // En reposo el texto es un solo nodo: conserva el kerning y el tracking de la fuente.
    const node = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = lbl.dataset.t = node.textContent; node.replaceWith(lbl);
    let busy = false;
    function run(){
      if (busy) return; busy = true;
      const text = lbl.dataset.t;
      // El texto nunca se parte en letras: es una sola cadena con su tracking natural.
      // Las letras ya resueltas quedan fijas a la izquierda; solo la cola cambia, dentro de una caja de ancho fijo.
      const w = lbl.getBoundingClientRect().width;
      lbl.style.width = w + 'px';
      const idx = [...text].map((c, i) => i).filter(i => text[i].trim()), n = idx.length, T0 = performance.now();
      const done = new Array(text.length).fill(0); idx.forEach((i, k) => { done[i] = 120 + (k / n) * 300 + Math.random() * 60; });
      (function frame(now){
        const t = now - T0; let left = 0, out = '';
        for (let i = 0; i < text.length; i++) {
          if (!text[i].trim() || t >= done[i]) out += text[i];
          else { left++; out += RAMP[(Math.random() * RAMP.length) | 0]; }
        }
        lbl.textContent = out;
        if (left) setTimeout(() => requestAnimationFrame(frame), 45);
        else { lbl.textContent = text; lbl.style.width = ''; busy = false; }
      })(T0);
    }
    b.addEventListener('pointerenter', run);
    b.addEventListener('focus', run);
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => document.querySelectorAll('.btn').forEach(prep));
})();



/* ---------- servicios: arte pixelado animado y aparición al hacer scroll ---------- */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // aparición
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), {threshold: .18});
  document.querySelectorAll('.reveal').forEach(el => reduce ? el.classList.add('on') : io.observe(el));
  // metáforas en semitono: cuadros claros sobre negro, de tamaño según la intensidad
// Campos de oscuridad (0–1) para cada metáfora. X,Y en 0–1; k = ancho/alto.
const B4 = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v => (v + .5) / 16);   // tramado ordenado (Bayer 4×4)
function bez(a, b, c, s){ const u = 1 - s; return [u*u*a[0] + 2*u*s*b[0] + s*s*c[0], u*u*a[1] + 2*u*s*b[1] + s*s*c[1]]; }
const F = {
  // 1 · Brote: el contenido que echa raíz y crece
  sprout(X, Y, t, k){
    const sw = Math.sin(t * .6) * .03, head = [.5 + sw, .33];
    let d = 0;
    // tallo
    if (!F._st || F._st.t !== t) { const pts = []; for (let s = 0; s <= 1; s += 1 / 28) pts.push(bez([.5, 1.02], [.43 + sw * .5, .62], head, s)); F._st = {t, pts}; }   // el tallo se calcula una vez por cuadro
    if (Math.abs(X - .5) < .12) for (const p of F._st.pts) { const dd = Math.hypot((X - p[0]) * k, Y - p[1]); if (dd < .02) { d = Math.max(d, .9 - dd * 10); break; } }
    // hojas (elipses giradas)
    const leaf = (cx, cy, rx, ry, ang) => { const c = Math.cos(ang), s = Math.sin(ang), x = (X - cx) * k, y = Y - cy, xr = x * c + y * s, yr = -x * s + y * c, q = (xr / rx) ** 2 + (yr / ry) ** 2; return q < 1 ? .45 + .4 * (1 - q) * (xr > 0 ? .6 : 1) : 0; };
    d = Math.max(d, leaf(.38 + sw * .3, .7, .15, .05, -.5), leaf(.62 + sw * .3, .8, .13, .045, .45));
    // flor: pétalos que respiran, centro oscuro
    const x = (X - head[0]) * k, y = Y - head[1], r = Math.hypot(x, y), th = Math.atan2(y, x);
    const R = .27 * (.45 + .55 * Math.abs(Math.cos(3 * th + t * .08))) * (1 + .03 * Math.sin(t * 1.3));
    if (r < .075) d = Math.max(d, .97 - r * 2);
    else if (r < R) d = Math.max(d, .3 + .6 * (r / R) ** 1.4 * (.75 + .25 * Math.cos(th * 6)));
    return d;
  },
  // 2 · Imán: las campañas atraen a la gente correcta
  magnet(X, Y, t, k){
    const cx = .5, cy = .52, x = (X - cx) * k, y = Y - cy, r = Math.hypot(x, y), R1 = .3, R0 = .16;
    let d = 0;
    if (y >= 0 && r > R0 && r < R1) d = .45 + .5 * ((x / R1 + 1) / 2) * (1 - .3 * Math.abs((r - (R0 + R1) / 2) / ((R1 - R0) / 2)));               // arco inferior, sombreado de izq. a der.
    if (y < 0 && y > -.34 && Math.abs(x) > R0 && Math.abs(x) < R1) d = y < -.26 ? .2 : .45 + .5 * ((x / R1 + 1) / 2);   // patas y polos claros
    return d;
  },
  // 3 · Puerta entreabierta con luz: tu sitio es la entrada a tu negocio
  door(X, Y, t, k){
    const floor = .78, x0 = .36, x1 = .64, top = .1, ang = 1.05 + .12 * Math.sin(t * .45), xe = x0 + (x1 - x0) * Math.cos(ang);
    let b = 0;                                                                       // muro y piso negros
    if (X > x0 - .014 && X < x1 + .014 && Y > top - .014 && Y < floor && !(X > x0 && X < x1 && Y > top)) b = .35;   // marco
    if (X > x0 && X < x1 && Y > top && Y < floor) {
      if (X < xe) { const p = (X - x0) / Math.max(.001, xe - x0); b = .12 + .18 * p; }   // hoja de la puerta, en sombra
      else b = .95 - .15 * Math.abs(Y - .45);                                          // la luz que sale por la rendija
    }
    if (Y > floor) { const s = (Y - floor) / .22, l = xe - s * .1, rgt = x1 + s * .34; if (X > l && X < rgt) b = .75 - .5 * s; }   // haz en el piso
    return b;
  }
};
// partículas que van hacia los polos del imán (se dibujan aparte, como píxeles sueltos)
function magnetParticles(t, n){
  const out = [];
  for (let i = 0; i < n; i++) {
    const sd = Math.sin(i * 127.1) * 43758.5453, rnd = sd - Math.floor(sd), sd2 = Math.sin(i * 311.7) * 12345.678, rnd2 = sd2 - Math.floor(sd2);
    const p = (t * .07 + rnd) % 1, side = i % 2 ? 1 : -1;
    const sx = side > 0 ? .55 + rnd2 * .45 : rnd2 * .45, sy = .05 + ((rnd * 7) % 1) * .9;
    const tx = .5 + side * .23 / 1.333, ty = .2;
    const e = p * p * (3 - 2 * p);
    out.push([sx + (tx - sx) * e, sy + (ty - sy) * e, 1 - p * .3]);
  }
  return out;
}

  const arts = [...document.querySelectorAll('.art')].map(el => ({el, cv: el.querySelector('canvas'), name: el.dataset.pattern, fn: F[el.dataset.pattern] || F.door, vis: false}));
  const ioA = new IntersectionObserver(es => es.forEach(e => { const a = arts.find(x => x.el === e.target); if (a) a.vis = e.isIntersecting; }));
  arts.forEach(a => { ioA.observe(a.el); a.t = Math.random() * 10; });
  function size(a){ const dpr = Math.min(2, devicePixelRatio || 1), r = a.cv.getBoundingClientRect(); a.cv.width = Math.round(r.width * dpr); a.cv.height = Math.round(r.height * dpr); a.dpr = dpr; }
  function draw(a){
    const c = a.cv.getContext('2d'), W = a.cv.width, H = a.cv.height, cell = 6 * a.dpr, cols = Math.floor(W / cell), rows = Math.floor(H / cell), k = W / H;
    c.clearRect(0, 0, W, H); c.fillStyle = '#E9E9E6';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let f = a.fn((i + .5) / cols, (j + .5) / rows, a.t, k);
      if (f <= 0) continue; f = Math.pow(Math.min(1, f), 1.6); if (f < .05) continue;   // curva: más rango de grises, no todo lleno
      const q = Math.ceil(f * 4) / 4, s = cell * (.2 + .66 * q);                    // 4 tamaños de cuadro: semitono
      c.globalAlpha = .3 + .7 * q;
      c.fillRect(i * cell + (cell - s) / 2, j * cell + (cell - s) / 2, s, s);
    }
    c.globalAlpha = 1;
    if (a.name === 'magnet') { const s = cell * .5; for (const [x, y] of magnetParticles(a.t, 160)) c.fillRect(Math.floor(x * cols) * cell + cell * .25, Math.floor(y * rows) * cell + cell * .25, s, s); }
  }
  let last = performance.now();
  function loop(now){
    const dt = Math.min(64, now - last) / 1000; last = now;
    arts.forEach(a => { if (!a.vis) return; a.t += dt; a.acc = (a.acc || 0) + dt; if (a.acc >= 1 / 24) { a.acc = 0; draw(a); } });   // ~24 cuadros por segundo: suficiente para un movimiento lento
    requestAnimationFrame(loop);
  }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => arts.forEach(a => { size(a); draw(a); }), 200); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { arts.forEach(a => { size(a); draw(a); }); if (!reduce) requestAnimationFrame(loop); });
})();

/* ---------- idioma: español / inglés ---------- */
(() => {
  const EN = {
    '.links a': ['Services', 'Process', 'Work', 'Plans', 'FAQ'],
    '.mnav .l': ['Services', 'Process', 'Work', 'Plans', 'FAQ'],
    '.sub': ['We create marketing, design, web and social content with artificial intelligence and a human eye, so your brand gets to what&rsquo;s next first.'],
    '.clients-lab': ['Brands already growing with us'],
    '#svc-h': ['Everything your brand needs, in <b>one team.</b>'],
    '.sec-head p': ['Social, video, ads, web and apps with the same voice everywhere. AI gives us speed; judgment decides what ships.'],
    '.svc h3': ['Content that <b>sticks.</b>', 'Campaigns that <b>convert.</b>', 'Sites that <b>sell.</b>'],
    '.svc .body p': ['Strategy, calendar, posts and short video for social, in a style your audience recognizes at first glance.',
                     'Ads for Meta and Google with AI-made variants. We measure and keep only the ones that sell.',
                     'Landing pages and apps coded by hand: fast, measurable, easy to update and ready to grow with your business.'],
    '.svc .tags li span': ['Social media', 'Short video', 'Ads', 'Strategy', 'Websites', 'Apps'],
    '.note i': ['01 · Sprout', '02 · Pole', '03 · Access'],
    '#proc-h': ['AI speeds things up. <b>Judgment decides.</b>'],
    '#proceso .sec-side p': ['This is how we mix new tools and craft in every project: fast where we can, careful where it matters.'],
    '.step h3': ['Diagnosis', 'Exploring with AI', 'Judgment and production', 'Measure and adjust'],
    '.step p': ['We get to know your brand, your customer and what isn&rsquo;t working today. Without this, AI only makes noise.',
                'We test dozens of ideas, tones and visuals in the time it used to take to make one.',
                'We pick the best and finish it by hand: design, copy, video and code with studio care.',
                'We read the results every week and fix what underperforms, so every month works better.'],
    '.step .who span': ['People', 'AI', 'People', 'AI + people'],
    '#cases-h': ['Results you can <b>see.</b>'],
    '#casos .sec-side p': ['A few recent projects: what we were asked for, what we did and what happened next.'],
    '.case-kind': ['Crypto trading platform · Launch', 'AI agents platform · Web, ads and social', 'Our own explainer channel · AI content', 'Framer templates · Our own product'],
    '.case h3': ['A launch campaign with its own character.', 'An AI brand that looks as trustworthy as it promises.', 'A history channel that publishes four videos a day.', 'Four premium templates, published on Framer.'],
    '.case-more > p': ['We designed the teaser and waitlist phases: X headers, KOL banners, verticals and threads starring Chepe, the brand&rsquo;s astronaut. Plus motion graphics videos, UI/UX improvements to the app and animated in-app tutorials.',
                       'We redesigned Topline&rsquo;s website, its new ad campaign and its social posts, to explain AI agents with human oversight to law firms, clinics and financial firms.',
                       'We built Resumario, our own channel: scripts, illustration, voice and animation made with AI and reviewed by hand. It&rsquo;s where we test first what we later do for clients.',
                       'We design and publish templates on the Framer Marketplace: NAVARA and Linnea for skincare clinics, Everly for wedding invitations and Palácio Aurora for luxury residences. Anyone can remix them for free.'],
    '.case-link': ['Watch the motion video on X<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg>'],
    '.made li span': ['Campaign', 'Motion', 'UI/UX', 'Website', 'Campaign', 'Social', 'Video', 'Social', 'Strategy', 'Website', 'Framer', 'Product'],
    '.kpis dd': ['campaign pieces', 'launch phases', 'and motion', 'full redesign', 'new campaign', 'LinkedIn posts', 'followers', 'impressions', 'interactions', 'templates', 'leads', 'referred sales'],
    '.quote-hero .q-tr': ['', ''],
    '.quote-hero .q-role': ['CEO, Vibe Trading', 'CEO, Topline'],
    '#faq-h': ['Frequently asked <b>questions.</b>'],
    '.faq-head p': ['What almost everyone asks us before we start. Got another one? <a href="#contacto">Write to us</a>.'],
    '.qa .q': ['How much does it cost to work with you?', 'What does AI do and what do people do?', 'How long do you take to deliver?', 'Are the content and files mine?', 'Do I need a brand identity already?', 'Do you work with brands outside Mexico?', 'Do you shoot the photos and videos?'],
    '.qa .a p': ['It depends on the scope. Social and campaigns run on monthly plans; websites and apps as fixed projects. After a short call we send you a quote in under 24 business hours.',
                 'AI helps us explore ideas, variants and drafts fast. People decide, fix and finish every piece: nothing goes live without someone on the team reviewing it.',
                 'A landing page ships in 3 to 5 business days once we have your materials, a social calendar starts in the first week, and a campaign is ready in five to ten business days.',
                 'Yes. Everything we deliver is yours: designs, copy, videos, source files and code, with no hidden licences.',
                 'No. If you don&rsquo;t have one yet, we build it with you; if you do, we respect it and take it further.',
                 'Yes. We work remotely, in Spanish and English, with brands from any country.',
                 'We don’t do photo or video shoots. We edit the footage you share, even if it’s shot on your phone, and complement it with stock images and AI-made pieces. If you need a professional shoot, we can recommend a photographer we trust.'],
    '#contact-h': ['Ready to get there <b>first?</b>'],
    '.contact .lead': ['Tell us what you want to achieve. We reply in under 24 business hours with a clear proposal, no strings attached.'],
    '.direct small': ['Email', 'WhatsApp', 'Book'],
    '.direct li:nth-child(3) span': ['A 20-minute call'],
    '.form .t': ['Name', 'Email', 'Tell us a little <i>(optional)</i>'],
    '.form .fh': ['Tell us about your project'],
    '.form .fs': ['Takes 1 minute'],
    '.form .msg': ['Enter your name', 'Check your email'],
    '.form legend': ['What do you need?', 'Approximate budget'],
    '.chips span': ['Social &amp; video', 'Campaigns', 'Website or app', 'Brand identity', 'Under MX$15k', 'MX$15k to 40k', 'Over MX$40k', 'Not sure yet'],
    '.form .fine': ['We reply in under 24 business hours. By sending, you accept our <a href="/privacidad">Privacy notice</a>.'],
    '.form .ok b': ['Thank you!'],
    '.form .ok p': ['We got your message. We&rsquo;ll write back in under 24 business hours.'],
    '.foot-top .slogan': ['Design with judgment.'],
    '.foot-top .slogan + p': ['A marketing, design and web agency that uses AI so your brand gets there first.'],
    '.foot h4': ['Site', 'Contact', 'Social'],
    '.foot-cols > div:nth-child(1) a': ['Services', 'Process', 'Work', 'Plans', 'FAQ'],
    '.foot-cols > div:nth-child(2) li:nth-child(2) a': ['Get a quote'],
    '.foot-bot span:last-child': ['<a href="/privacidad">Privacy notice</a> · <a href="/terminos">Terms</a> · Guadalajara, Mexico']
  };
  const BTN = {'.case-open': ['See the case', 'See the case', 'See the case', 'See the case'], '.mnav .btn': ['Get a quote'], '.form .btn': ['Send message'], '.cta': ['Get a quote'], '.ctas .btn.y': ['Get a quote'], '.ctas .btn.g': ['See how we work'], '.sec-side .btn': ['Get a quote']};
  const H1 = {es: ['Criterio', '*humano', 'a', 'velocidad', 'de', 'IA.'], en: ['*Human', 'judgment', 'at', 'the', 'speed', 'of', 'AI.']};
  const META = {es: {title: 'Graficante · Diseño con criterio', logo: 'Graficante, inicio'}, en: {title: 'Graficante · Design with judgment', logo: 'Graficante, home'}};
  // une las tres últimas palabras de cada párrafo con un espacio que no se parte: nunca queda una palabra sola en la última línea
  function noOrphans(){ document.querySelectorAll('.svc .body p, .sec-head p, .sub, .step p, .case-more > p, .faq-head p, .qa .a p, .contact .lead').forEach(el => { el.innerHTML = el.innerHTML.replace(/\s+([^\s<>]+)\s+([^\s<>]+)\s*$/, '\u00a0$1\u00a0$2'); }); }   // la última línea siempre lleva al menos tres palabras
  noOrphans();
  // los párrafos usan todo el ancho de la tarjeta; si uno queda con menos líneas, se reserva su alto para que etiquetas y botones se alineen
  function evenCards(){
    const ps = [...document.querySelectorAll('.svc .body p')]; if (!ps.length) return;
    ps.forEach(p => { p.style.minHeight = ''; p.style.maxWidth = ''; });
    if (matchMedia('(max-width:960px)').matches) return;
    const h = Math.max(...ps.map(p => p.getBoundingClientRect().height));
    ps.forEach(p => { p.style.minHeight = h + 'px'; });
  }
  evenCards(); let ert = 0; addEventListener('resize', () => { clearTimeout(ert); ert = setTimeout(evenCards, 150); });
  if (document.fonts) document.fonts.ready.then(evenCards);
  const ES = {}, ESB = {};
  for (const sel in EN) ES[sel] = [...document.querySelectorAll(sel)].map(el => el.innerHTML);
  const btnText = b => { const l = b.querySelector('.lbl'); if (l) return l.dataset.t; const n = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); return n ? n.textContent : ''; };
  for (const sel in BTN) ESB[sel] = [...document.querySelectorAll(sel)].map(btnText);
  function setBtn(b, t){ const l = b.querySelector('.lbl'); if (l) { l.textContent = l.dataset.t = t; l.style.width = ''; return; } const n = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (n) n.textContent = t; }
  function setLang(lang){
    document.documentElement.lang = lang;
    for (const sel in EN) document.querySelectorAll(sel).forEach((el, i) => { const v = (lang === 'en' ? EN : ES)[sel][i]; if (v != null) el.innerHTML = v; });
    for (const sel in BTN) document.querySelectorAll(sel).forEach((b, i) => setBtn(b, (lang === 'en' ? BTN : ESB)[sel][i]));
    const h1 = document.querySelector('h1'), words = H1[lang];
    h1.setAttribute('aria-label', words.join(' ').replace(/\*/g, ''));
    h1.innerHTML = words.map(w => `<span class="w"><span class="${w[0] === '*' ? 'accent' : ''}">${w.replace('*', '')}</span></span>`).join(' ');
    document.querySelectorAll('[data-en]').forEach(el => { if (el.dataset.es == null) el.dataset.es = el.innerHTML; el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.es; });   // textos con su traducción en el propio elemento
    document.querySelectorAll('.plan-pick').forEach(b => setBtn(b, (lang === 'en' ? 'Choose ' + b.dataset.planEn : 'Elegir ' + b.dataset.plan)));
    noOrphans(); evenCards(); { const on = document.querySelector('.step.on h3'), t = document.getElementById('proc-t'); if (on && t) t.textContent = on.textContent; }
    { const PH = {es: ['Tu nombre', 'tu@marca.com', 'Tu marca, tu meta y para cuándo la necesitas'], en: ['Your name', 'you@brand.com', 'Your brand, your goal and when you need it']}[lang]; document.querySelectorAll('.form .row input, .form textarea').forEach((el, i) => { if (PH[i]) el.placeholder = PH[i]; }); }
    document.title = META[lang].title; { const d = document.querySelector('meta[name="description"]'); if (d) d.content = lang === 'en' ? 'A marketing, design, web and social agency that uses AI so your brand gets there first, with human judgment in every piece.' : 'Agencia de marketing, diseño, web y redes que usa la IA para que tu marca llegue primero, con criterio humano en cada pieza.'; }
    document.querySelectorAll('.logo').forEach(a => a.setAttribute('aria-label', META[lang].logo));
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    try { localStorage.setItem('gf-lang', lang); } catch (e) {}
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  let saved = null; try { saved = localStorage.getItem('gf-lang'); } catch (e) {}
  if (saved === 'en') (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setLang('en'));
})();

/* ---------- cómo trabajamos: el paso visible cambia la forma del show ASCII ---------- */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('proc-ascii'); if (!cv) return;
  const ctx = cv.getContext('2d'), RAMP = ' .:-=+*%#@';
  const G = ["M 2379.24 2476.47 C 2311.01 2531.58 2220.14 2557.58 2133 2551.29 C 2051.1 2545.38 1979 2519.47 1914.44 2465.54 C 1874.92 2432.52 1836.04 2383.01 1814.72 2336.03 C 1806.59 2318.11 1798.43 2297.02 1793.19 2278 C 1774.77 2211.17 1775.13 2137.03 1796.71 2071 C 1820.3 1998.83 1858.94 1939.43 1918.48 1891.96 C 1939.54 1875.18 1961.83 1859.71 1986 1847.84 C 2042.82 1819.93 2101.98 1807.05 2165 1806.13 C 2198.48 1805.63 2232.02 1805.86 2265.5 1805.9 C 2346.47 1806.01 2427.54 1805.42 2508.5 1806.76 C 2512.27 1806.83 2519.17 1806.13 2521.92 1809.53 C 2529.81 1819.25 2517.17 1829.4 2510.9 1835.46 C 2498.17 1847.76 2485.38 1859.98 2472.8 1872.43 C 2458.11 1886.96 2442.93 1900.74 2427.91 1914.91 C 2398.24 1942.91 2368.9 1971.24 2339.19 1999.2 C 2332.86 2005.15 2326.23 2010.83 2318.89 2015.48 C 2314.92 2015.6 2310.97 2015.58 2307 2015.49 C 2255.37 2014.3 2203.64 2014.05 2152 2014.69 C 2146.1 2014.76 2140.43 2015.04 2134.5 2015.32 C 2084.21 2017.7 2033.86 2041.96 2005.24 2084.13 C 1986.49 2111.77 1976.21 2145.1 1976.18 2178.5 C 1976.1 2274.14 2043.26 2336.78 2137 2340.61 C 2141.83 2340.8 2146.67 2340.97 2151.5 2340.96 C 2181.64 2340.9 2211.62 2339.92 2241.73 2341.42 C 2250.08 2348.67 2258.38 2355.98 2266.32 2363.68 C 2304.5 2400.73 2342 2438.48 2379.24 2476.47 z", "M 2182.05 2140.3 C 2186.83 2139.67 2191.67 2139.65 2196.5 2139.6 C 2264.47 2138.96 2332.53 2139.58 2400.5 2140.06 C 2452.65 2140.43 2504.86 2139.8 2557 2140.61 C 2574.95 2140.9 2577.99 2145.47 2578.15 2162 C 2578.15 2162.01 2578.16 2165.99 2578.16 2166 C 2578.18 2231.33 2577.88 2296.67 2577.88 2362 C 2577.87 2416.64 2578.39 2471.36 2577.84 2526 C 2577.78 2531.75 2577.72 2538.24 2573.5 2542.15 C 2567 2548.16 2558.88 2538.88 2554.29 2534.69 C 2542.65 2524.04 2523.03 2505.07 2510.12 2492.85 C 2510.12 2492.85 2507.42 2490.26 2507.41 2490.26 C 2493.67 2476.99 2480.11 2463.49 2466.45 2450.14 C 2438.7 2423 2411.75 2395.12 2384.07 2367.92 C 2361.28 2345.53 2339.33 2322.34 2316.5 2300 C 2316.49 2300 2312.93 2296.54 2312.93 2296.53 C 2288.33 2272.73 2262.78 2249.91 2238.69 2225.6 C 2222.3 2209.07 2205.73 2192.62 2189.53 2175.9 C 2175.33 2161.25 2172.32 2157.75 2182.05 2140.3 z"], GB = [1774.77, 1805.42, 803.62, 752.16];
  // una forma por paso: lupa (diagnóstico), dispersión (exploración), lápiz (criterio), gráfica (medición); al final, la G
  const SH = ['M42 42m-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0M61 61L86 86',
              'SCATTER',
              'M22 78L30 58L68 20L80 32L42 70ZM30 58L42 70M62 26L74 38M22 78L28 72',
              'M14 86H88M24 86V66M42 86V52M60 86V38M78 86V24M18 58L38 44L56 32L80 14M80 14H68M80 14V26'];
  window.__procSH = SH;
  const steps = [...document.querySelectorAll('.step')], ticks = [...document.querySelectorAll('.proc-bar .ticks i')];
  const kEl = document.getElementById('proc-k'), tEl = document.getElementById('proc-t');
  let D = null, cur = 0;
  function build(){
    const dpr = Math.min(2, devicePixelRatio || 1), r = cv.getBoundingClientRect(); if (!r.width) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const CH = Math.max(8, r.height / 30) * dpr, CW = CH * .62, cols = Math.ceil(cv.width / CW), rows = Math.ceil(cv.height / CH);
    const mk = document.createElement('canvas'); mk.width = cv.width; mk.height = cv.height; const m = mk.getContext('2d');
    const size = cv.height * .78, ox = (cv.width - size) / 2, oy = (cv.height - size) / 2;
    const sample = () => { const d = m.getImageData(0, 0, mk.width, mk.height).data, list = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const cx = x * CW + CW / 2, cy = y * CH + CH / 2; let n = 0;
        for (const [dx, dy] of [[0, 0], [-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) { const px = Math.round(cx + dx * CW), py = Math.round(cy + dy * CH); if (px >= 0 && py >= 0 && px < mk.width && py < mk.height && d[(py * mk.width + px) * 4 + 3] > 128) n++; }
        if (n) list.push({x: cx, y: cy, ch: RAMP[Math.min(9, 3 + Math.round(n / 5 * 6))]}); }
      return list; };
    const targets = SH.map(path => {
      m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, mk.width, mk.height); m.fillStyle = m.strokeStyle = '#fff';
      if (path === 'SCATTER') {                                              // ideas sueltas por todo el cuadro
        const list = []; let sd = 7; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < 260; i++) { const x = Math.floor(rnd() * cols), y = Math.floor(rnd() * rows); list.push({x: x * CW + CW / 2, y: y * CH + CH / 2, ch: '.:-=+*%#'[Math.floor(rnd() * 8)]}); }
        return list;
      }
      m.setTransform(size / 100, 0, 0, size / 100, ox, oy); m.lineWidth = 6.5; m.lineCap = m.lineJoin = 'round'; m.stroke(new Path2D(path));
      return sample();
    });
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, mk.width, mk.height); m.fillStyle = '#fff';
    { const k = size * .8 / GB[3]; m.setTransform(k, 0, 0, k, cv.width / 2 - GB[2] * k / 2 - GB[0] * k, cv.height / 2 - GB[3] * k / 2 - GB[1] * k); G.forEach(p => m.fill(new Path2D(p))); }
    const P = Math.max(...targets.map(l => l.length));
    D = {CH, targets, P, font: `500 ${Math.round(CH * .9)}px Figtree, system-ui, sans-serif`,
         delay: Array.from({length: P}, () => Math.random() * 320), wob: Array.from({length: P}, () => (Math.random() - .5) * 2)};
    D.from = D.to = assign(Array.from({length: P}, () => ({x: Math.random() * cv.width, y: Math.random() * cv.height, ch: '.'})), targets[cur]);
    D.from = D.to.map(p => p); D.t0 = performance.now() - 5000;
  }
  function assign(curPts, list){
    const P = curPts.length, mx = curPts.reduce((a, p) => a + p.x, 0) / P, my = curPts.reduce((a, p) => a + p.y, 0) / P;
    const order = curPts.map((p, i) => [Math.atan2(p.y - my, p.x - mx), i]).sort((a, b) => a[0] - b[0]).map(e => e[1]);
    const lx = list.reduce((a, p) => a + p.x, 0) / list.length, ly = list.reduce((a, p) => a + p.y, 0) / list.length;
    const sorted = list.slice().sort((a, b) => Math.atan2(a.y - ly, a.x - lx) - Math.atan2(b.y - ly, b.x - lx));
    const to = new Array(P); order.forEach((pi, j) => { to[pi] = sorted[Math.floor(j * sorted.length / P)]; }); return to;
  }
  function go(k){
    if (!D) return; if (k === cur && D.started) return; cur = k;
    const now = performance.now(), MOVE = 1100, tau = now - D.t0;
    // posición actual (por si llega a medio vuelo) como punto de partida
    D.from = D.to.map((b, i) => { const a = D.from[i], u = Math.min(1, Math.max(0, (tau - D.delay[i]) / MOVE)); const e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; return {x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, ch: b.ch}; });
    D.to = assign(D.from, D.targets[k]); D.t0 = now; D.started = true;
    steps.forEach((s, j) => s.classList.toggle('on', j === k)); ticks.forEach((t, j) => t.classList.toggle('on', j === k));
    kEl.textContent = '0' + (k + 1); tEl.style.opacity = 0; setTimeout(() => { tEl.textContent = steps[k].querySelector('h3').textContent; tEl.style.opacity = 1; }, 180);
  }
  function draw(now){
    if (!D) return;
    const tau = now - D.t0, MOVE = 1100;
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.font = D.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < D.P; i++) {
      const a = D.from[i], b = D.to[i], u = reduce ? 1 : Math.min(1, Math.max(0, (tau - D.delay[i]) / MOVE)), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, bend = Math.sin(u * Math.PI) * D.wob[i] * .18;
      ctx.fillStyle = u > 0 && u < 1 ? '#8F8F8F' : '#F1F1EF';
      ctx.fillText(u >= 1 ? b.ch : (u < .5 ? a.ch : b.ch), a.x + dx * e - dy * bend, a.y + dy * e + dx * bend);
    }
  }
  // paso activo: el último cuyo título ya pasó la línea del 55 % de la pantalla (antes del primero, el 1; después del último, el 4).
  // Se revisa en cada cuadro mientras la sección está a la vista, así no se salta pasos con scroll rápido ni se dispara fuera de lugar.
  const sec = document.getElementById('proceso'); let near = false;
  new IntersectionObserver(es => { near = es[0].isIntersecting; }, {rootMargin: '20% 0px 20% 0px'}).observe(sec);
  function activeStep(){
    const line = innerHeight * .55; let k = 0;
    steps.forEach((s, j) => { if (s.querySelector('h3').getBoundingClientRect().top < line) k = j; });
    return k;
  }
  (function loop(t){
    if (near && D) { const k = activeStep(); if (k !== cur || !D.started) go(k); draw(t); }
    requestAnimationFrame(loop);
  })(performance.now());
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
})();

/* ---------- casos: visuales en semitono y cifras que cuentan al aparecer ---------- */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // cifras
  const nums = [...document.querySelectorAll('.stat .num')];
  const ioN = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; ioN.unobserve(e.target); const el = e.target, to = +el.dataset.to;
    if (reduce) { el.textContent = to; return; }
    const T0 = performance.now(), D = 1400;
    (function f(t){ const u = Math.min(1, (t - T0) / D), e2 = 1 - Math.pow(1 - u, 3); el.textContent = Math.round(to * e2); if (u < 1) requestAnimationFrame(f); })(T0);
  }), {threshold: .6});
  nums.forEach(n => { n.textContent = reduce ? n.dataset.to : '0'; ioN.observe(n); });
  // visuales: el símbolo de cada marca en cuadros de semitono con una luz que gira
  const FC = {
    altamar: (X, Y, t, k) => { const x = (X - .5) * k, y = Y - .5, r = Math.hypot(x, y), a = Math.atan2(y, x); if (r > .34 || r < .14) return 0; return .35 + .65 * (.5 + .5 * Math.cos(a - t * .6)); },
    topline: (X, Y, t, k) => { const x = X, y = Y, c = .82 - .62 * Math.pow(x, 1.4) + .04 * Math.sin(x * 9), d = y - c;   // una curva de ingresos que sube, con el área debajo
      const glow = .5 + .5 * Math.cos((x - ((t * .12) % 1.4) + .2) * 9); if (x < .1 || x > .9 || y > .86) return 0;
      if (Math.abs(d) < .02) return .55 + .45 * glow; if (d > 0) return Math.max(0, .36 - d * .9) * (.35 + .65 * glow); return 0; },
    kora:    (X, Y, t, k) => { const x = (X - .5) * k, y = Y - .5, d = Math.abs(x) + Math.abs(y); if (d > .36) return 0; const a = Math.atan2(y, x); return .3 + .7 * (.5 + .5 * Math.cos(a + t * .5)) * (1 - d / .5); }
  };
  const arts = [...document.querySelectorAll('.case-art')].filter(el => el.querySelector('canvas') && !el.hasAttribute('data-logo')).map(el => ({el, cv: el.querySelector('canvas'), fn: FC[el.dataset.case] || FC.altamar, t: Math.random() * 5, vis: false}));
  const io = new IntersectionObserver(es => es.forEach(e => { const a = arts.find(x => x.el === e.target); if (a) a.vis = e.isIntersecting; }));
  arts.forEach(a => io.observe(a.el));
  function size(a){ const dpr = Math.min(2, devicePixelRatio || 1), r = a.cv.getBoundingClientRect(); a.cv.width = Math.round(r.width * dpr); a.cv.height = Math.round(r.height * dpr); a.dpr = dpr; }
  function draw(a){
    const c = a.cv.getContext('2d'), W = a.cv.width, H = a.cv.height, cell = 6 * a.dpr, cols = Math.floor(W / cell), rows = Math.floor(H / cell), k = W / H;
    c.clearRect(0, 0, W, H); c.fillStyle = '#E9E9E6';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let f = a.fn((i + .5) / cols, (j + .5) / rows, a.t, k); if (f <= 0) continue; f = Math.pow(Math.min(1, f), 1.6); if (f < .05) continue;
      const q = Math.ceil(f * 4) / 4, s = cell * (.2 + .66 * q); c.globalAlpha = .3 + .7 * q; c.fillRect(i * cell + (cell - s) / 2, j * cell + (cell - s) / 2, s, s);
    }
    c.globalAlpha = 1;
  }
  let last = performance.now();
  (function loop(now){ const dt = Math.min(64, now - last) / 1000; last = now;
    arts.forEach(a => { if (!a.vis || !a.dpr) return; a.t += dt; a.acc = (a.acc || 0) + dt; if (a.acc >= 1 / 24) { a.acc = 0; draw(a); } });
    if (!reduce) requestAnimationFrame(loop); })(last);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => arts.forEach(a => { size(a); draw(a); }), 200); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => arts.forEach(a => { size(a); draw(a); }));
})();

/* ---------- preguntas, formulario y enlaces internos ---------- */
(() => {
  document.querySelectorAll('.qa button').forEach(b => b.addEventListener('click', () => {
    const li = b.closest('.qa'), open = !li.classList.contains('open');
    document.querySelectorAll('.qa.open').forEach(o => { if (o !== li) { o.classList.remove('open'); o.querySelector('button').setAttribute('aria-expanded', 'false'); } });   // una abierta a la vez
    li.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
  }));
  const f = document.querySelector('.form');
  if (f) {
    f._t0 = performance.now(); f.addEventListener('focusin', () => { if (!f._seen) { f._seen = true; f._t0 = performance.now(); } });
    const check = i => { const bad = !i.checkValidity() || !i.value.trim(); i.closest('.fld').classList.toggle('err', bad); return !bad; };
    f.querySelectorAll('input[required]').forEach(i => { i.addEventListener('blur', () => { if (i.value) check(i); }); i.addEventListener('input', () => { if (i.closest('.fld').classList.contains('err')) check(i); }); });
    f.addEventListener('submit', e => {   // prototipo: no envía nada todavía
      e.preventDefault();
      const bad = [...f.querySelectorAll('input[required]')].filter(i => !check(i));
      if (bad.length) { bad[0].focus(); return; }
      if (f.classList.contains('sending')) return;
      const bot = f.querySelector('input[name=website]').value || performance.now() - (f._t0 || 0) < 2500;   // trampa llena o envío en menos de 2.5 s: casi seguro un bot
      if (bot) { f.classList.add('sent'); return; }   // al bot se le muestra el «gracias», pero no se envía nada
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, btn = f.querySelector('.btn.full'), lbl = btn && btn.querySelector('.lbl');
      if (reduce) { f.classList.add('sent'); return; }
      f.classList.add('sending');   // 1) el botón se queda amarillo y la flecha despega mientras se envía
      const en = document.documentElement.lang === 'en', label0 = lbl ? lbl.dataset.t : '';
      if (lbl) { lbl.style.width = ''; lbl.textContent = lbl.dataset.t = en ? 'Sending…' : 'Enviando…'; }
      [...f.children].forEach((c, k) => c.style.setProperty('--i', k));
      const fd = new FormData(f), data = {nombre: fd.get('nombre'), correo: fd.get('correo'), mensaje: fd.get('mensaje') || '', necesita: fd.getAll('n'), presupuesto: fd.get('p') || '', website: fd.get('website') || '', idioma: en ? 'en' : 'es'};
      const t0 = performance.now();
      fetch('/api/contact', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
        .then(r => { if (!r.ok) throw new Error(r.status); })
        .then(() => setTimeout(() => {   // al menos ~650 ms de «enviando» para que la transición se lea
          const h = f.offsetHeight; f.style.height = h + 'px'; f.classList.add('anim', 'leaving');   // 2) los campos se desvanecen en cascada
          setTimeout(() => {
            f.classList.add('sent'); f.style.height = 'auto'; const h2 = f.offsetHeight; f.style.height = h + 'px';
            void f.offsetHeight; f.style.height = h2 + 'px';   // 3) la tarjeta se encoge suave hasta el alto de la confirmación
            setTimeout(() => { f.style.height = ''; f.classList.remove('anim'); }, 650);
          }, 420);
        }, Math.max(0, 650 - (performance.now() - t0))))
        .catch(() => {   // si falla, el formulario vuelve a su estado y se avisa con un mensaje claro
          f.classList.remove('sending'); if (lbl) { lbl.textContent = lbl.dataset.t = label0; }
          let err = f.querySelector('.send-err'); if (!err) { err = document.createElement('p'); err.className = 'send-err'; err.setAttribute('role', 'alert'); f.querySelector('.fine').before(err); }
          err.textContent = en ? 'We couldn’t send your message. Please try again or write to us on WhatsApp.' : 'No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp.';
        });
    });
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); const t = id === '#inicio' ? document.body : document.querySelector(id); if (!t) return;
    e.preventDefault();
    if (window.__lenis) window.__lenis.scrollTo(id === '#inicio' ? 0 : t, {offset: -24, duration: 1.4});
    else (id === '#inicio' ? scrollTo({top: 0, behavior: 'smooth'}) : t.scrollIntoView({behavior: 'smooth'}));
  }));
})();

/* ---------- footer: el logo completo en caracteres ASCII ---------- */
(() => {
  const box = document.querySelector('.foot-mark'); if (!box || typeof Image === 'undefined') return;
  const svg = box.querySelector('svg'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, RAMP = ' .:-=+*#%@', NOISE = '.:-=+*/|<>';
  const vb = svg.viewBox.baseVal, AR = vb.height / vb.width;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg).replace(/currentColor/g, '#fff'));
  let G = null, vis = false, t0 = 0, mouse = {x: -1e4, y: -1e4};
  function build(){
    if (!img.complete || !img.naturalWidth && !img.width) return;
    const W = box.clientWidth; if (!W) return;
    const dpr = Math.min(2, devicePixelRatio || 1), cw = Math.max(4, Math.min(8, W / 150)), chh = cw * 1.25;
    const cols = Math.floor(W / cw), rows = Math.ceil(W * AR / chh) + 1, H = rows * chh;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    const off = document.createElement('canvas'), S = 4; off.width = cols * S; off.height = rows * S;
    const o = off.getContext('2d'), ih = off.width * AR * cw / chh;   // las celdas son más altas que anchas: se compensa para no estirar el logo
    o.drawImage(img, 0, (off.height - ih) / 2, off.width, ih);
    const d = o.getImageData(0, 0, off.width, off.height).data, cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let a = 0; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a += d[((j * S + y) * off.width + i * S + x) * 4 + 3];
      const c = a / (S * S * 255); if (c < .06) continue;
      cells.push({x: (i + .5) * cw, y: (j + .5) * chh, c, ch: RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(c * (RAMP.length - 1)))], dl: i / cols * 900 + Math.random() * 300, n: NOISE[Math.random() * NOISE.length | 0]});
    }
    G = {cells, cw, chh, dpr, font: `500 ${(cw / .6).toFixed(1)}px ui-monospace,"SF Mono",Menlo,monospace`};
    box.classList.add('ascii'); draw(performance.now());
  }
  function draw(now){
    if (!G) return; const T = reduce ? 1e9 : now - t0;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = G.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of G.cells) {
      const u = (T - p.dl) / 500; if (u < 0) continue;   // entra de izquierda a derecha, primero como ruido y luego se asienta
      const dx = p.x - mouse.x, dy = p.y - mouse.y, near = Math.exp(-(dx * dx + dy * dy) / 9000);   // el cursor ilumina y revuelve
      if (near > .5 && Math.random() < .08) p.n = NOISE[Math.random() * NOISE.length | 0];
      const settled = u >= 1, glyph = !settled || near > .5 ? p.n : p.ch;
      const l = Math.round(60 + 30 * p.c + (settled ? 0 : 60 * (1 - u)) + 150 * near);
      ctx.fillStyle = `rgb(${l},${l},${l - 2})`; ctx.fillText(glyph, p.x, p.y);
    }
  }
  box.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  box.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !t0) t0 = performance.now(); }, {threshold: .2}).observe(box);
  let last = 0;
  (function loop(now){ if (vis && G && now - last > 33) { last = now; draw(now); } if (!reduce) requestAnimationFrame(loop); })(0);
  img.onload = build; if (img.complete) build();
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
})();

/* ---------- contacto: campo ASCII en tono sobre tono que avanza en diagonal ---------- */
(() => {
  const sec = document.getElementById('contacto'), cv = sec && sec.querySelector('.contact-ascii'); if (!cv) return;
  const ctx = cv.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, RAMP = ' .·:-=+*#';
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  let W = 0, H = 0, dpr = 1, vis = false, mouse = {x: -1e4, y: -1e4}, t = Math.random() * 50;
  const CW = 12, CH = 16;
  function size(){ const r = sec.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '500 12px ui-monospace,"SF Mono",Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cols = Math.ceil(W / CW), rows = Math.ceil(H / CH);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + .5) * CW, y = (j + .5) * CH, X = x / W, Y = y / H;
      const m = Math.max(0, 1 - Math.hypot(X * .9, (1 - Y) * 1.1) / .95);   // más presente en la esquina inferior izquierda, se apaga hacia el texto y el formulario
      if (m <= 0) continue;
      const n = .65 * noise(i * .08 - t * .5, j * .1 + t * .35) + .35 * noise(i * .19 + t * .2, j * .23 - t * .3);   // fluye hacia arriba y a la derecha
      const dx = x - mouse.x, dy = y - mouse.y, near = Math.exp(-(dx * dx + dy * dy) / 12000);
      let v = Math.min(1, Math.max(0, (n - .38) * 2.2) * m + near * .5); if (v < .08) continue;
      ctx.fillStyle = `rgba(241,241,239,${(.08 + .32 * v).toFixed(3)})`;
      ctx.fillText(RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)))], x, y);
    }
  }
  sec.addEventListener('pointermove', e => { const r = sec.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  sec.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(sec);
  let last = 0;
  (function loop(now){ if (vis && W && now - last > 50) { t += (now - last) / 1000 * .25; last = now; draw(); } if (!reduce) requestAnimationFrame(loop); else if (W) draw(); })(0);
  size(); draw(); let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw(); }, 200); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { size(); draw(); }).observe(sec);
})();

/* ---------- proceso en celular: un visual por paso que se arma al entrar en pantalla ---------- */
(() => {
  const SH = window.__procSH, RAMP = ' .:-=+*%#@'; if (!SH) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, mq = matchMedia('(max-width:960px)');
  const arts = [...document.querySelectorAll('.step')].map((st, k) => {
    const box = document.createElement('div'); box.className = 'step-art'; box.setAttribute('aria-hidden', 'true');
    const cv = document.createElement('canvas'); box.appendChild(cv); st.insertBefore(box, st.firstChild);
    return {k, box, cv, A: null, t0: 0, played: false};
  });
  function build(a){
    const r = a.cv.getBoundingClientRect(); if (!r.width) return false;
    const dpr = Math.min(2, devicePixelRatio || 1), cv = a.cv; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const CH = Math.max(7, r.height / 24) * dpr, CW = CH * .62, cols = Math.ceil(cv.width / CW), rows = Math.ceil(cv.height / CH);
    const mk = document.createElement('canvas'); mk.width = cv.width; mk.height = cv.height; const m = mk.getContext('2d');
    const size = cv.height * .8, ox = (cv.width - size) / 2, oy = (cv.height - size) / 2, path = SH[a.k]; let list = [];
    if (path === 'SCATTER') { let sd = 7; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 160; i++) list.push({x: Math.floor(rnd() * cols) * CW + CW / 2, y: Math.floor(rnd() * rows) * CH + CH / 2, ch: '.:-=+*%#'[Math.floor(rnd() * 8)]}); }
    else {
      m.strokeStyle = '#fff'; m.setTransform(size / 100, 0, 0, size / 100, ox, oy); m.lineWidth = 7; m.lineCap = m.lineJoin = 'round'; m.stroke(new Path2D(path));
      const d = m.getImageData(0, 0, mk.width, mk.height).data;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const cx = x * CW + CW / 2, cy = y * CH + CH / 2; let n = 0;
        for (const [dx, dy] of [[0, 0], [-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) { const px = Math.round(cx + dx * CW), py = Math.round(cy + dy * CH); if (px >= 0 && py >= 0 && px < mk.width && py < mk.height && d[(py * mk.width + px) * 4 + 3] > 128) n++; }
        if (n) list.push({x: cx, y: cy, ch: RAMP[Math.min(9, 3 + Math.round(n / 5 * 6))]}); }
    }
    a.A = {list, font: `500 ${Math.round(CH * .9)}px Figtree, system-ui, sans-serif`,
      from: list.map(() => ({x: Math.random() * cv.width, y: Math.random() * cv.height})), delay: list.map(() => Math.random() * 380), wob: list.map(() => (Math.random() - .5) * 2)};
    return true;
  }
  function draw(a, now){
    const A = a.A, c = a.cv.getContext('2d'), tau = a.played ? now - a.t0 : -1; let busy = false;
    c.clearRect(0, 0, a.cv.width, a.cv.height); c.font = A.font; c.textAlign = 'center'; c.textBaseline = 'middle';
    A.list.forEach((b, i) => {
      const f = A.from[i], u = reduce ? 1 : Math.min(1, Math.max(0, (tau - A.delay[i]) / 1100)); if (u < 1) busy = true;
      const e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, dx = b.x - f.x, dy = b.y - f.y, bend = Math.sin(u * Math.PI) * A.wob[i] * .18;
      c.fillStyle = u >= 1 ? '#F1F1EF' : u > 0 ? '#8F8F8F' : 'rgba(143,143,143,.35)';
      c.fillText(u >= 1 ? b.ch : '.', f.x + dx * e - dy * bend, f.y + dy * e + dx * bend);   // antes de entrar: polvo de puntos; luego vuelan a su forma
    });
    return busy;
  }
  function run(a){ (function f(now){ if (draw(a, now)) requestAnimationFrame(f); })(performance.now()); }
  const io = new IntersectionObserver(es => es.forEach(e => {
    const a = arts.find(x => x.box === e.target); if (!a || !e.isIntersecting || a.played || !mq.matches) return;
    if (!a.A && !build(a)) return; a.played = true; a.t0 = performance.now(); run(a);
  }), {threshold: .5});
  function setup(){ arts.forEach(a => { if (!mq.matches) return; if (build(a)) draw(a, performance.now() + (a.played ? 1e6 : 0)); }); }
  arts.forEach(a => io.observe(a.box));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(setup);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(setup, 200); });
})();

/* ---------- menú en celular ---------- */
(() => {
  const nav = document.getElementById('nav'), b = nav && nav.querySelector('.menu-btn'); if (!b) return;
  const lab = () => document.documentElement.lang === 'en' ? ['Open menu', 'Close menu'] : ['Abrir menú', 'Cerrar menú'];
  const set = open => { nav.classList.toggle('open', open); b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', lab()[open ? 1 : 0]); if (window.__lenis) window.__lenis[open ? 'stop' : 'start'](); };   // con el menú abierto la página no se desplaza
  b.addEventListener('click', e => { e.stopPropagation(); set(!nav.classList.contains('open')); });
  nav.querySelectorAll('.mnav a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('click', e => { if (nav.classList.contains('open') && !nav.contains(e.target)) set(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); b.focus(); } });
  { const mq = matchMedia('(max-width:760px)'), on = e => { if (!e.matches) set(false); }; mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener && mq.addListener(on); }   // Safari viejo usa addListener
})();

/* ---------- casos: el logo de cada marca en caracteres ASCII ---------- */
(() => {
  const boxes = [...document.querySelectorAll('.case-art[data-logo]')]; if (!boxes.length || typeof Image === 'undefined') return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, RAMP = ' .:-=+*#%@', NOISE = '.:-=+*/|<>';
  const L = boxes.map(box => {
    const tpl = box.querySelector('template'), img = new Image(), o = {box, cv: box.querySelector('canvas'), img, G: null, vis: false, t0: 0, mouse: {x: -1e4, y: -1e4}};
    img.onload = () => build(o);
    if (tpl) { const svg = tpl.innerHTML.trim().replace(/fill="(?!none)[^"]*"/g, 'fill="#fff"').replace(/currentColor/g, '#fff'); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')); }
    else img.src = box.dataset.src;   // logo en PNG: solo se usa su transparencia
    box.addEventListener('pointermove', e => { const r = o.cv.getBoundingClientRect(); o.mouse.x = e.clientX - r.left; o.mouse.y = e.clientY - r.top; });
    box.addEventListener('pointerleave', () => { o.mouse.x = o.mouse.y = -1e4; });
    return o;
  });
  function build(o){
    const r = o.cv.getBoundingClientRect(); if (!r.width || !o.img.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = r.width, H = r.height; o.cv.width = Math.round(W * dpr); o.cv.height = Math.round(H * dpr);
    const cols0 = +o.box.dataset.cols || 80, cw = Math.max(3.5, Math.min(8, W / cols0)), chh = cw * 1.25,   // data-cols: más columnas = caracteres más finos y logo más nítido
     cols = Math.floor(W / cw), rows = Math.floor(H / chh);
    const ar = o.img.height / o.img.width, fw = +o.box.dataset.fw || .56, lw = Math.min(W * fw, H * .62 / ar), lh = lw * ar, x0 = (W - lw) / 2, y0 = (H - lh) / 2;   // el logo ocupa ~56 % del ancho, centrado
    const S = 4, off = document.createElement('canvas'); off.width = cols * S; off.height = rows * S;
    const m = off.getContext('2d'); m.drawImage(o.img, x0 / cw * S, y0 / chh * S, lw / cw * S, lh / chh * S);   // escala por separado en x/y: las celdas no son cuadradas
    const d = m.getImageData(0, 0, off.width, off.height).data, cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let a = 0; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a += d[((j * S + y) * off.width + i * S + x) * 4 + 3];
      const c = a / (S * S * 255);
      const x = (i + .5) * cw + (W - cols * cw) / 2, y = (j + .5) * chh + (H - rows * chh) / 2;
      if (c < .06) { if (Math.random() < .035) cells.push({x, y, c: 0, ch: '.', bg: true, dl: Math.random() * 1200, n: '.'}); continue; }   // polvo de fondo muy tenue
      cells.push({x, y, c, ch: RAMP[Math.min(9, 2 + Math.floor(c * 7.99))], dl: i / cols * 700 + Math.random() * 300, n: NOISE[Math.random() * NOISE.length | 0]});
    }
    o.G = {cells, dpr, font: `500 ${(cw / .6).toFixed(1)}px ui-monospace,"SF Mono",Menlo,monospace`, W, H};
    draw(o, performance.now());
  }
  function draw(o, now){
    const G = o.G; if (!G) return; const c = o.cv.getContext('2d'), T = reduce ? 1e9 : (o.t0 ? now - o.t0 : -1), sweep = ((now / 2600) % 1.6 - .3) * G.W;
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); c.clearRect(0, 0, G.W, G.H); c.font = G.font; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of G.cells) {
      const u = (T - p.dl) / 500; if (u < 0) continue;
      const dx = p.x - o.mouse.x, dy = p.y - o.mouse.y, near = Math.exp(-(dx * dx + dy * dy) / 5000), lit = reduce ? 0 : Math.exp(-Math.pow((p.x - sweep) / 60, 2));   // el cursor revuelve; una luz recorre el logo
      if (p.bg) { c.fillStyle = `rgba(241,241,239,${(.08 + .25 * near).toFixed(3)})`; c.fillText('.', p.x, p.y); continue; }
      if (near > .45 && Math.random() < .1) p.n = NOISE[Math.random() * NOISE.length | 0];
      const settled = u >= 1, l = Math.round(120 + 90 * p.c + 45 * lit + 40 * near - (settled ? 0 : 60 * (1 - u)));
      c.fillStyle = `rgb(${l},${l},${l - 2})`; c.fillText(!settled || near > .45 ? p.n : p.ch, p.x, p.y);
    }
  }
  const io = new IntersectionObserver(es => es.forEach(e => { const o = L.find(x => x.box === e.target); if (!o) return; o.vis = e.isIntersecting; if (o.vis && !o.t0) o.t0 = performance.now(); }), {threshold: .3});
  L.forEach(o => io.observe(o.box));
  let last = 0;
  (function loop(now){ if (now - last > 33) { last = now; L.forEach(o => { if (o.vis) draw(o, now); }); } if (!reduce) requestAnimationFrame(loop); })(0);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => L.forEach(build), 200); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => L.forEach(build));
})();

/* ---------- casos: carrusel de piezas reales dentro de cada visual (automático, con flechas, puntos, deslizar y teclado) ---------- */
(() => {
  document.querySelectorAll('.case-art').forEach(box => {
    const slides = [...box.querySelectorAll('.slide')]; if (!slides.length) return;
    const ticks = [...box.querySelectorAll('.reel-ticks button')], cap = box.querySelector('.reel-cap'), N = slides.length;
    let k = -1, vis = false, hover = false, timer = 0, started = false, manual = false;
    box.setAttribute('tabindex', '0'); box.setAttribute('role', 'region'); box.setAttribute('aria-roledescription', 'carrusel');
    const show = n => {   // n = -1 es el logo ASCII
      k = n; box.classList.toggle('showing', k >= 0);
      slides.forEach((s, j) => s.classList.toggle('on', j === k)); ticks.forEach((t, j) => { t.classList.toggle('on', j === k); t.setAttribute('aria-current', j === k); });
      cap.textContent = k >= 0 ? slides[k].dataset[document.documentElement.lang === 'en' ? 'en' : 'es'] : '';
      slides.forEach((s, j) => { if (!s.classList.contains('lottie')) return;   // tutoriales reales de la app (Lottie): se cargan al verse y solo corren mientras están en pantalla
        if (j === k) { if (!s._anim && window.lottie) { s._anim = window.lottie.loadAnimation({container: s.querySelector('.lt'), renderer: 'svg', loop: true, autoplay: false, path: '/lottie/' + s.dataset.lottie + '.json', rendererSettings: {preserveAspectRatio: 'xMidYMid meet'}}); }
          if (s._anim) { s._anim.goToAndPlay(0, true); } }
        else if (s._anim) s._anim.stop(); });
      slides.forEach((s, j) => { const v = s.querySelector('video'); if (!v) return; if (j === k) { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); });   // el video solo corre mientras se ve
    };
    const auto = () => { clearTimeout(timer); if (!vis || manual) return;
      if (!hover) show(k + 1 >= N ? -1 : k + 1);
      timer = setTimeout(auto, k < 0 ? 2600 : (slides[k].classList.contains('video') ? 15600 : slides[k].classList.contains('lottie') ? 4600 : 3400)); };   // el video se ve completo (15 s)
    const go = n => { manual = true; clearTimeout(timer); show((n + N) % N);   // al tocar los controles se apaga el avance automático
      clearTimeout(box._resume); box._resume = setTimeout(() => { manual = false; auto(); }, 12000); };   // y vuelve solo tras 12 s sin tocar
    box.querySelector('.reel-nav.prev').addEventListener('click', e => { e.stopPropagation(); go(k < 0 ? N - 1 : k - 1); });
    box.querySelector('.reel-nav.next').addEventListener('click', e => { e.stopPropagation(); go(k + 1); });
    ticks.forEach((t, j) => t.addEventListener('click', e => { e.stopPropagation(); go(j); }));
    box.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(k + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(k < 0 ? N - 1 : k - 1); } });
    let sx = null, sy = 0;
    box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
    box.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? k + 1 : (k < 0 ? N - 1 : k - 1)); }, {passive: true});
    box.addEventListener('pointerenter', () => { hover = true; });
    box.addEventListener('pointerleave', () => { hover = false; });
    new IntersectionObserver(es => { vis = es[0].isIntersecting; clearTimeout(timer); if (vis) timer = setTimeout(auto, started ? 1200 : 2800); started = started || vis; }, {threshold: .4}).observe(box);
  });
})();

/* ---------- casos: detalle en modal (escritorio) o bottom sheet (celular) ---------- */
(() => {
  const dlg = document.querySelector('.case-dlg'); if (!dlg || !dlg.showModal) return;
  const sheet = dlg.querySelector('.sheet'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; let opener = null, closing = 0;
  function open(card, btn){
    opener = btn;
    dlg.querySelector('.case-kind').textContent = card.querySelector('.case-kind').textContent;
    dlg.querySelector('h3').textContent = card.querySelector('h3').textContent;
    dlg.querySelector('.dlg-more').innerHTML = card.querySelector('.case-more').innerHTML;
    dlg.querySelector('.kpis').innerHTML = card.querySelector('.kpis').innerHTML;
    dlg.querySelector('.x').setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Close' : 'Cerrar');
    clearTimeout(closing); sheet.scrollTop = 0; sheet.style.removeProperty('--drag');
    dlg.showModal(); if (window.__lenis) window.__lenis.stop();
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('show')));
  }
  function close(){
    if (!dlg.open) return; dlg.classList.remove('show');
    closing = setTimeout(() => { dlg.close(); sheet.style.removeProperty('--drag'); if (window.__lenis) window.__lenis.start(); if (opener) opener.focus(); }, reduce ? 0 : 380);
  }
  document.querySelectorAll('.case-open').forEach(b => b.addEventListener('click', () => open(b.closest('.case'), b)));
  dlg.querySelector('.x').addEventListener('click', close);
  dlg.querySelector('.veil').addEventListener('click', close);
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });   // Esc anima la salida en vez de cerrar de golpe
  // bottom sheet: arrastrar hacia abajo para cerrar
  let y0 = null, dy = 0;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop > 0) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, {passive: true});
  sheet.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 4) { dlg.classList.add('dragging'); sheet.style.setProperty('--drag', dy + 'px'); } }, {passive: true});
  sheet.addEventListener('touchend', () => { if (y0 == null) return; dlg.classList.remove('dragging'); if (dy > 110) close(); else sheet.style.removeProperty('--drag'); y0 = null; });
})();



/* ---------- planes: «Elegir» lleva al formulario con el plan ya indicado ---------- */
(() => {
  const f = document.querySelector('.form'); if (!f) return;
  document.querySelectorAll('.plan-pick').forEach(b => b.addEventListener('click', () => {
    const en = document.documentElement.lang === 'en', name = en ? b.dataset.planEn : b.dataset.plan;
    (b.dataset.needs || '').split(',').forEach(v => { const c = f.querySelector(`input[name=n][value="${v}"]`); if (c) c.checked = true; });
    const ta = f.querySelector('textarea'); if (ta && !ta.value.trim()) ta.value = en ? `I'm interested in the ${name} plan.` : `Me interesa el plan ${name}.`;
    const el = document.getElementById('contacto');
    if (window.__lenis) window.__lenis.scrollTo(el, {offset: -24, duration: 1.4}); else el.scrollIntoView({behavior: 'smooth'});
    setTimeout(() => { const n = f.querySelector('input[name=nombre]'); if (n) n.focus({preventScroll: true}); }, 1500);
  }));
})();

/* ---------- plan destacado: campo ASCII amarillo animado ---------- */
(() => {
  const cv = document.querySelector('.plan-glow'); if (!cv) return;
  const card = cv.parentElement, ctx = cv.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, RAMP = ' .·:-=+*#';
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  let W = 0, H = 0, dpr = 1, vis = false, t = 0, mouse = {x: -1e4, y: -1e4};
  const CW = 11, CH = 15;
  function size(){ const r = card.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '600 11px ui-monospace,"SF Mono",Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cols = Math.ceil(W / CW), rows = Math.ceil(H * .75 / CH);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + .5) * CW, y = (j + .5) * CH;
      const n = .6 * noise(i * .12 + t * .15, j * .16 + t * .6) + .4 * noise(i * .27 - t * .2, j * .31 + t * .9);   // sube despacio, como calor
      const dx = x - mouse.x, dy = y - mouse.y, near = Math.exp(-(dx * dx + dy * dy) / 9000);
      const v = Math.min(1, Math.max(0, (n - .42) * 2.4) + near * .55); if (v < .1) continue;
      ctx.fillStyle = `rgba(238,220,91,${(.08 + .26 * v).toFixed(3)})`;   // tenue: el texto encima siempre se lee
      ctx.fillText(RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)))], x, y);
    }
  }
  card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  card.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(card);
  let last = 0;
  (function loop(now){ if (vis && W && now - last > 50) { t += (now - last) / 1000 * .35; last = now; draw(); } if (!reduce) requestAnimationFrame(loop); })(0);
  size(); draw(); if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { size(); draw(); }).observe(card);
})();
