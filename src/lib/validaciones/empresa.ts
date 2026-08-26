import { z } from 'zod'
import { cuilValido, normalizarCuil } from '@/lib/cuil'

// El CUIT usa el mismo algoritmo de dígito verificador que el CUIL.
export const esquemaEmpresa = z.object({
  razonSocial: z.string().trim().min(1, 'Ingresá la razón social'),
  cuit: z
    .string()
    .transform((valor) => normalizarCuil(valor))
    .refine((cuit): cuit is string => cuit !== null, 'El CUIT debe tener 11 dígitos')
    .refine((cuit) => cuilValido(cuit), 'El CUIT no es válido: revisá el dígito verificador'),
  nombreCorto: z.string().trim().min(1, 'Ingresá un nombre corto'),
  textoConformidad: z
    .string()
    .trim()
    .min(20, 'El texto de conformidad es el que el empleado acepta: escribilo completo'),
})

export type DatosEmpresa = z.infer<typeof esquemaEmpresa>
