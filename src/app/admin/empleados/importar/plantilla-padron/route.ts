import { puede } from '@/lib/permisos'
import { obtenerAdmin } from '@/lib/sesion'

// Plantilla CSV para el padrón. Semicolon + BOM para que Excel en español la
// abra en columnas sin pasos extra.
const CABECERA = 'Número de legajo;Apellido;Nombre;CUIL;Mail;Celular'
const EJEMPLO = '201;Pérez;Ana;20-27103275-8;ana@ejemplo.com;3814000000'

export async function GET() {
  const admin = await obtenerAdmin()
  if (!admin || !puede(admin.rol, 'operar')) {
    return new Response('No autorizado', { status: 401 })
  }

  const csv = '﻿' + [CABECERA, EJEMPLO].join('\r\n') + '\r\n'
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-padron.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
