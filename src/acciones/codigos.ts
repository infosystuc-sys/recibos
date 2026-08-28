'use server'

import { revalidatePath } from 'next/cache'
import { registrarEvento } from '@/lib/auditoria'
import { generarCodigo, hashearCodigo } from '@/lib/codigo-activacion'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'

const DIAS_VIGENCIA = 30

/** Devuelve el código en claro. Es la ÚNICA vez que existe fuera del hash. */
export async function generarCodigoActivacion(
  personaId: string,
  motivo: 'alta' | 'reset' = 'alta',
): Promise<{ codigo: string } | { error: string }> {
  const admin = await exigirAdmin('operar')
  const supabase = clienteServicio()

  // Anular cualquier código anterior que siga vigente.
  await supabase
    .from('codigos_activacion')
    .update({ anulado_at: new Date().toISOString() })
    .eq('persona_id', personaId)
    .is('usado_at', null)
    .is('anulado_at', null)

  const codigo = generarCodigo()
  const expira = new Date()
  expira.setDate(expira.getDate() + DIAS_VIGENCIA)

  const { error } = await supabase.from('codigos_activacion').insert({
    persona_id: personaId,
    codigo_hash: hashearCodigo(personaId, codigo),
    motivo,
    creado_por: admin.id,
    expira_at: expira.toISOString(),
  })

  if (error) return { error: `No se pudo generar el código: ${error.message}` }

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: motivo === 'alta' ? 'codigo.generar' : 'codigo.resetear',
    entidad: 'personas',
    entidadId: personaId,
  })

  revalidatePath('/admin/empleados')
  return { codigo }
}
