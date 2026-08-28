// Service worker mínimo de Conforme: solo push. El cacheo offline (Serwist)
// se puede sumar después sin cambiar este contrato.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { title: 'Conforme', body: evento.data ? evento.data.text() : '' }
  }
  const titulo = datos.title || 'Conforme'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      data: { url: datos.url || '/mi' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/mi'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if (cliente.url.includes(destino) && 'focus' in cliente) return cliente.focus()
      }
      return self.clients.openWindow(destino)
    }),
  )
})
