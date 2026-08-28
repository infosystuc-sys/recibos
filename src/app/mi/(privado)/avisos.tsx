'use client'

import { useEffect, useState, useTransition } from 'react'
import { borrarSuscripcionPush, guardarSuscripcionPush } from '@/acciones/push'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

type Estado = 'cargando' | 'no-soportado' | 'sin-configurar' | 'activo' | 'inactivo'

export default function Avisos() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const [iosSinInstalar, setIosSinInstalar] = useState(false)

  useEffect(() => {
    if (!VAPID) {
      setEstado('sin-configurar')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('no-soportado')
      return
    }
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    // @ts-expect-error standalone es específico de iOS Safari
    const instalada = window.navigator.standalone === true
    if (esIos && !instalada) setIosSinInstalar(true)

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'activo' : 'inactivo'))
      .catch(() => setEstado('no-soportado'))
  }, [])

  function activar() {
    setError(null)
    iniciar(async () => {
      try {
        const permiso = await Notification.requestPermission()
        if (permiso !== 'granted') {
          setError('No diste permiso para recibir avisos.')
          return
        }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(VAPID!),
        })
        const json = sub.toJSON()
        const r = await guardarSuscripcionPush({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        })
        if ('error' in r) {
          setError(r.error)
          return
        }
        setEstado('activo')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo activar los avisos.')
      }
    })
  }

  function desactivar() {
    setError(null)
    iniciar(async () => {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await borrarSuscripcionPush(sub.endpoint)
        await sub.unsubscribe()
      }
      setEstado('inactivo')
    })
  }

  if (estado === 'cargando' || estado === 'no-soportado' || estado === 'sin-configurar') return null

  return (
    <div className="rounded-lg border p-4 text-sm">
      {estado === 'activo' ? (
        <div className="flex items-center justify-between">
          <span className="text-green-700 dark:text-green-400">Avisos activados en este dispositivo.</span>
          <button type="button" onClick={desactivar} disabled={pendiente} className="underline">
            Desactivar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p>Activá los avisos para enterarte cuando publiquen un recibo nuevo.</p>
          {iosSinInstalar && (
            <p className="text-neutral-500">
              En iPhone primero agregá la app a la pantalla de inicio (Compartir → «Agregar a
              inicio»).
            </p>
          )}
          <button
            type="button"
            onClick={activar}
            disabled={pendiente}
            className="self-start rounded-lg border px-4 py-2 disabled:opacity-50"
          >
            {pendiente ? 'Activando…' : 'Activar avisos'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
