"""Pasa el prototipo aprobado (../web/landing-prototipo.html) al proyecto Next.

Separa estilos, marcado y comportamiento; saca imágenes, video y animaciones a /public;
y aplica los ajustes de producción (Lottie desde archivos, formulario contra /api/contact,
rutas de las páginas legales). Ejecutar desde la carpeta del sitio:  python3 scripts/export-prototype.py
"""
import base64, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', 'web', 'landing-prototipo.html')
src = open(SRC, encoding='utf-8').read()

def out(rel, data, mode='w'):
    p = os.path.join(ROOT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f: f.write(data)

css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = src[src.find('</style>') + 8:src.find('<script src="https://unpkg.com/lenis')]
js = '\n;\n'.join(re.findall(r'<script>(.*?)</script>', src, re.S))
for k, v in re.findall(r'<script type="application/json" id="(lt-[^"]+)">(.*?)</script>', src, re.S):
    out(f'public/lottie/{k}.json', v)

seen = {}
def save(m):
    mime, b64 = m.group(1), m.group(2); data = base64.b64decode(b64); h = hashlib.sha1(data).hexdigest()[:10]
    ext = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'video/mp4': 'mp4'}[mime]
    name = f"/{'media' if ext == 'mp4' else 'img'}/{h}.{ext}"
    if h not in seen: out('public' + name, data, 'wb'); seen[h] = name
    return name
pat = re.compile(r'data:(image/webp|image/png|image/jpeg|video/mp4);base64,([A-Za-z0-9+/=]+)')
body, css = pat.sub(save, body), pat.sub(save, css)

for a, b in [('privacidad.html', '/privacidad'), ('terminos.html', '/terminos')]:
    body, js = body.replace(a, b), js.replace(a, b)

def patch(s, old, new, label):
    if s.count(old) != 1: sys.exit(f'No se pudo aplicar el ajuste «{label}»: el prototipo cambió en esa parte.')
    return s.replace(old, new)

js = patch(js, "const d = document.getElementById(s.dataset.lottie); s._anim = window.lottie.loadAnimation({container: s.querySelector('.lt'), renderer: 'svg', loop: true, autoplay: false, animationData: JSON.parse(d.textContent),",
           "s._anim = window.lottie.loadAnimation({container: s.querySelector('.lt'), renderer: 'svg', loop: true, autoplay: false, path: '/lottie/' + s.dataset.lottie + '.json',", 'Lottie desde archivos')
a = js.find("      f.classList.add('sending');   // 1)"); b = js.find("      }, 650);\n    });\n  }", a)
if a < 0 or b < 0: sys.exit('No se encontró el envío del formulario en el prototipo.')
js = js[:a] + open(os.path.join(ROOT, 'scripts', 'form-submit.js'), encoding='utf-8').read().rstrip('\n') + js[b + len("      }, 650);"):]

out('content/landing.html', body)
out('app/globals.css', css + "\n.form .send-err{margin:0;font-size:14px;line-height:1.5;color:#FFB8AD;text-align:center}\n")
out('public/js/site.js', js)
print(f'Listo: {len(seen)} archivos de imagen/video, {len(body)//1024} KB de marcado, {len(js)//1024} KB de script.')
