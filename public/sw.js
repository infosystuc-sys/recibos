// Service worker mínimo: hace la app instalable y da un fallback offline para
// la navegación. No cachea PDFs ni respuestas de la API (siempre van a la red).
const CACHE = 'conforme-v1'
const SHELL = ['/mi', '/mi/ingresar', '/activar', '/icono-192.png', '/icono-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navegación: red primero, y si no hay, la última versión cacheada de /mi.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/mi')))
    return
  }
  // Estáticos del shell: cache primero.
  if (SHELL.some((p) => url.pathname === p) || url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
  }
})
