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
