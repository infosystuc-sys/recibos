import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Conforme — Recibos de sueldo',
    short_name: 'Conforme',
    description: 'Ver, conformar y descargar tus recibos de sueldo.',
    start_url: '/mi',
    scope: '/mi',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#17215f',
    lang: 'es-AR',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
