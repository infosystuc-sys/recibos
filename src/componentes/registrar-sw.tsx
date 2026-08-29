'use client'

import { useEffect } from 'react'

/** Registra el service worker para que la app sea instalable y ande offline. */
export default function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
