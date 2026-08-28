'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { registrarEvento } from '@/lib/auditoria'
import { exigirAdmin } from '@/lib/sesion'
import { clienteServicio } from '@/lib/supabase/cliente-servicio'
import { esquemaEmpresa } from '@/lib/validaciones/empresa'

export async function crearEmpresa(_estado: string | null, datos: FormData) {
  const admin = await exigirAdmin('administrar')

  const analisis = esquemaEmpresa.safeParse({
    razonSocial: datos.get('razonSocial'),
    cuit: datos.get('cuit'),
    nombreCorto: datos.get('nombreCorto'),
    textoConformidad: datos.get('textoConformidad'),
  })
  if (!analisis.success) return analisis.error.issues[0].message

  const supabase = clienteServicio()
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      razon_social: analisis.data.razonSocial,
      cuit: analisis.data.cuit,
      nombre_corto: analisis.data.nombreCorto,
      texto_conformidad: analisis.data.textoConformidad,
    })
    .select('id')
    .single()

  if (error) {
    return error.code === '23505'
      ? 'Ya existe una empresa con ese CUIT.'
      : `No se pudo crear la empresa: ${error.message}`
  }

  await registrarEvento({
    actorTipo: 'admin',
    actorId: admin.id,
    accion: 'empresa.crear',
    entidad: 'empresas',
    entidadId: data.id,
    detalle: { cuit: analisis.data.cuit },
  })

  revalidatePath('/admin/empresas')
  redirect('/admin/empresas')
}
