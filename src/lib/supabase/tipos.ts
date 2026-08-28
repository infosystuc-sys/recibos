// Generado desde el esquema de Supabase. No editar a mano.
// Regenerar: npm run tipos

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_usuarios: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_admin"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_admin"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_admin"]
        }
        Relationships: []
      }
      codigos_activacion: {
        Row: {
          anulado_at: string | null
          codigo_hash: string
          creado_por: string | null
          created_at: string
          expira_at: string
          id: string
          motivo: Database["public"]["Enums"]["motivo_codigo"]
          persona_id: string
          usado_at: string | null
        }
        Insert: {
          anulado_at?: string | null
          codigo_hash: string
          creado_por?: string | null
          created_at?: string
          expira_at: string
          id?: string
          motivo?: Database["public"]["Enums"]["motivo_codigo"]
          persona_id: string
          usado_at?: string | null
        }
        Update: {
          anulado_at?: string | null
          codigo_hash?: string
          creado_por?: string | null
          created_at?: string
          expira_at?: string
          id?: string
          motivo?: Database["public"]["Enums"]["motivo_codigo"]
          persona_id?: string
          usado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codigos_activacion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codigos_activacion_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      conformidades: {
        Row: {
          comprobante_codigo: string
          created_at: string
          id: string
          ip: unknown
          persona_id: string
          recibo_id: string
          sha256_documento: string
          texto_legal: string
          user_agent: string | null
        }
        Insert: {
          comprobante_codigo?: string
          created_at?: string
          id?: string
          ip?: unknown
          persona_id: string
          recibo_id: string
          sha256_documento: string
          texto_legal: string
          user_agent?: string | null
        }
        Update: {
          comprobante_codigo?: string
          created_at?: string
          id?: string
          ip?: unknown
          persona_id?: string
          recibo_id?: string
          sha256_documento?: string
          texto_legal?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conformidades_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conformidades_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: true
            referencedRelation: "recibos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activa: boolean
          created_at: string
          cuit: string
          id: string
          logo_url: string | null
          nombre_corto: string
          razon_social: string
          texto_conformidad: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cuit: string
          id?: string
          logo_url?: string | null
          nombre_corto: string
          razon_social: string
          texto_conformidad?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          cuit?: string
          id?: string
          logo_url?: string | null
          nombre_corto?: string
          razon_social?: string
          texto_conformidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos_auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          actor_tipo: Database["public"]["Enums"]["tipo_actor"]
          created_at: string
          detalle: Json
          entidad: string
          entidad_id: string | null
          id: number
          ip: unknown
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_tipo: Database["public"]["Enums"]["tipo_actor"]
          created_at?: string
          detalle?: Json
          entidad: string
          entidad_id?: string | null
          id?: number
          ip?: unknown
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_tipo?: Database["public"]["Enums"]["tipo_actor"]
          created_at?: string
          detalle?: Json
          entidad?: string
          entidad_id?: string | null
          id?: number
          ip?: unknown
        }
        Relationships: []
      }
      importaciones: {
        Row: {
          actualizados: number
          creada_por: string | null
          creados: number
          created_at: string
          empresa_id: string
          errores: number
          filas_total: number
          id: string
          nombre_archivo: string
          resumen: Json
        }
        Insert: {
          actualizados?: number
          creada_por?: string | null
          creados?: number
          created_at?: string
          empresa_id: string
          errores?: number
          filas_total?: number
          id?: string
          nombre_archivo: string
          resumen?: Json
        }
        Update: {
          actualizados?: number
          creada_por?: string | null
          creados?: number
          created_at?: string
          empresa_id?: string
          errores?: number
          filas_total?: number
          id?: string
          nombre_archivo?: string
          resumen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "importaciones_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      legajos: {
        Row: {
          activo: boolean
          created_at: string
          empresa_id: string
          fecha_ingreso: string | null
          id: string
          numero: number
          persona_id: string
          sector: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresa_id: string
          fecha_ingreso?: string | null
          id?: string
          numero: number
          persona_id: string
          sector?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresa_id?: string
          fecha_ingreso?: string | null
          id?: string
          numero?: number
          persona_id?: string
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legajos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legajos_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          creada_por: string | null
          created_at: string
          dato_fijo: number
          empresa_id: string
          estado: Database["public"]["Enums"]["estado_liquidacion"]
          id: string
          notas: string | null
          periodo: number
          publicada_at: string | null
          publicada_por: string | null
          tipo: Database["public"]["Enums"]["tipo_liquidacion"]
        }
        Insert: {
          creada_por?: string | null
          created_at?: string
          dato_fijo: number
          empresa_id: string
          estado?: Database["public"]["Enums"]["estado_liquidacion"]
          id?: string
          notas?: string | null
          periodo: number
          publicada_at?: string | null
          publicada_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_liquidacion"]
        }
        Update: {
          creada_por?: string | null
          created_at?: string
          dato_fijo?: number
          empresa_id?: string
          estado?: Database["public"]["Enums"]["estado_liquidacion"]
          id?: string
          notas?: string | null
          periodo?: number
          publicada_at?: string | null
          publicada_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_liquidacion"]
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_publicada_por_fkey"
            columns: ["publicada_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          canal: Database["public"]["Enums"]["canal_notificacion"]
          created_at: string
          enviada_at: string | null
          error: string | null
          estado: Database["public"]["Enums"]["estado_notificacion"]
          id: string
          intentos: number
          liquidacion_id: string | null
          persona_id: string
          proveedor_msg_id: string | null
          proximo_intento_at: string
          recibo_id: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Insert: {
          canal: Database["public"]["Enums"]["canal_notificacion"]
          created_at?: string
          enviada_at?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_notificacion"]
          id?: string
          intentos?: number
          liquidacion_id?: string | null
          persona_id: string
          proveedor_msg_id?: string | null
          proximo_intento_at?: string
          recibo_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_notificacion"]
          created_at?: string
          enviada_at?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_notificacion"]
          id?: string
          intentos?: number
          liquidacion_id?: string | null
          persona_id?: string
          proveedor_msg_id?: string | null
          proximo_intento_at?: string
          recibo_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "recibos"
            referencedColumns: ["id"]
          },
        ]
      }
      observaciones: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["estado_observacion"]
          id: string
          persona_id: string
          recibo_id: string
          respuesta: string | null
          resuelta_at: string | null
          resuelta_por: string | null
          texto: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_observacion"]
          id?: string
          persona_id: string
          recibo_id: string
          respuesta?: string | null
          resuelta_at?: string | null
          resuelta_por?: string | null
          texto: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_observacion"]
          id?: string
          persona_id?: string
          recibo_id?: string
          respuesta?: string | null
          resuelta_at?: string | null
          resuelta_por?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "observaciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observaciones_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "recibos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observaciones_resuelta_por_fkey"
            columns: ["resuelta_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          apellido_nombre: string
          auth_user_id: string | null
          created_at: string
          cuil: string
          email: string | null
          email_verificado: boolean
          estado: Database["public"]["Enums"]["estado_persona"]
          id: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido_nombre: string
          auth_user_id?: string | null
          created_at?: string
          cuil: string
          email?: string | null
          email_verificado?: boolean
          estado?: Database["public"]["Enums"]["estado_persona"]
          id?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido_nombre?: string
          auth_user_id?: string | null
          created_at?: string
          cuil?: string
          email?: string | null
          email_verificado?: boolean
          estado?: Database["public"]["Enums"]["estado_persona"]
          id?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          persona_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          persona_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          persona_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      recibos: {
        Row: {
          bytes: number
          created_at: string
          cuil_archivo: string
          estado: Database["public"]["Enums"]["estado_recibo"]
          id: string
          legajo_id: string
          liquidacion_id: string
          nombre_original: string
          sha256: string
          storage_path: string
          subido_at: string
          subido_por: string | null
          version: number
        }
        Insert: {
          bytes: number
          created_at?: string
          cuil_archivo: string
          estado?: Database["public"]["Enums"]["estado_recibo"]
          id?: string
          legajo_id: string
          liquidacion_id: string
          nombre_original: string
          sha256: string
          storage_path: string
          subido_at?: string
          subido_por?: string | null
          version?: number
        }
        Update: {
          bytes?: number
          created_at?: string
          cuil_archivo?: string
          estado?: Database["public"]["Enums"]["estado_recibo"]
          id?: string
          legajo_id?: string
          liquidacion_id?: string
          nombre_original?: string
          sha256?: string
          storage_path?: string
          subido_at?: string
          subido_por?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recibos_legajo_id_fkey"
            columns: ["legajo_id"]
            isOneToOne: false
            referencedRelation: "legajos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "admin_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      es_admin: { Args: never; Returns: boolean }
      es_admin_pleno: { Args: never; Returns: boolean }
      liquidacion_publicada: {
        Args: { p_liquidacion: string }
        Returns: boolean
      }
      persona_actual: { Args: never; Returns: string }
      persona_tiene_recibo_en: {
        Args: { p_liquidacion: string }
        Returns: boolean
      }
      puede_operar: { Args: never; Returns: boolean }
    }
    Enums: {
      canal_notificacion: "email" | "push" | "whatsapp"
      estado_liquidacion: "borrador" | "publicada" | "anulada"
      estado_notificacion:
        | "encolada"
        | "enviando"
        | "enviada"
        | "fallida"
        | "descartada"
      estado_observacion: "abierta" | "resuelta"
      estado_persona: "pendiente" | "activo" | "bloqueado"
      estado_recibo: "vigente" | "reemplazado"
      motivo_codigo: "alta" | "reset"
      rol_admin: "admin" | "operador" | "consulta"
      tipo_actor: "admin" | "empleado" | "sistema"
      tipo_liquidacion: "1QA" | "2QA" | "MEN"
      tipo_notificacion: "publicacion" | "recordatorio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_notificacion: ["email", "push", "whatsapp"],
      estado_liquidacion: ["borrador", "publicada", "anulada"],
      estado_notificacion: [
        "encolada",
        "enviando",
        "enviada",
        "fallida",
        "descartada",
      ],
      estado_observacion: ["abierta", "resuelta"],
      estado_persona: ["pendiente", "activo", "bloqueado"],
      estado_recibo: ["vigente", "reemplazado"],
      motivo_codigo: ["alta", "reset"],
      rol_admin: ["admin", "operador", "consulta"],
      tipo_actor: ["admin", "empleado", "sistema"],
      tipo_liquidacion: ["1QA", "2QA", "MEN"],
      tipo_notificacion: ["publicacion", "recordatorio"],
    },
  },
} as const
