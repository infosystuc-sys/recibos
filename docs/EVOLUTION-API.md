# WhatsApp con Evolution API

Conforme manda los avisos de WhatsApp a través de **Evolution API**, una API REST
self-hosted que se conecta a WhatsApp como un cliente de WhatsApp Web.

## 1. Levantar Evolution API

Lo más simple es Docker. Ejemplo mínimo (`docker-compose.yml`):

```yaml
services:
  evolution:
    image: atendai/evolution-api:v2.1.1
    ports:
      - "8080:8080"
    environment:
      AUTHENTICATION_API_KEY: "una-clave-larga-y-secreta"
      # base de datos y demás según la doc oficial:
      # https://doc.evolution-api.com/v2/pt/install/docker
    volumes:
      - evolution_instances:/evolution/instances

volumes:
  evolution_instances:
```

Ponelo detrás de HTTPS (Caddy / Nginx / el proxy de tu hosting). La URL pública es
`EVOLUTION_API_URL`, la `AUTHENTICATION_API_KEY` es `EVOLUTION_API_KEY`.

## 2. Crear y vincular la instancia

Una "instancia" es un número de WhatsApp conectado.

```bash
# crear
curl -X POST "$EVOLUTION_API_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"instanceName": "conforme", "integration": "WHATSAPP-BAILEYS"}'

# obtener el QR para vincular el teléfono
curl "$EVOLUTION_API_URL/instance/connect/conforme" -H "apikey: $EVOLUTION_API_KEY"
```

Escaneá el QR desde el WhatsApp del número que va a mandar los avisos (idealmente una
línea dedicada). El nombre de la instancia (`conforme`) es `EVOLUTION_INSTANCE`.

Verificar el estado:

```bash
curl "$EVOLUTION_API_URL/instance/connectionState/conforme" -H "apikey: $EVOLUTION_API_KEY"
# {"instance":{"state":"open"}}  -> vinculada y lista
```

`/admin/notificaciones` muestra ese estado.

## 3. Variables de entorno

En Vercel (y `.env.local` para probar):

```
EVOLUTION_API_URL=https://evolution.tu-dominio.com
EVOLUTION_API_KEY=una-clave-larga-y-secreta
EVOLUTION_INSTANCE=conforme
WHATSAPP_PAIS=54          # opcional, default 54 (Argentina)
```

Con las tres primeras cargadas, el canal `whatsapp` aparece **activo** en el panel y la
cola empieza a encolar avisos de WhatsApp para las personas que tengan `telefono` en el
padrón.

## 4. Formato de los teléfonos

`personas.telefono` puede venir con separadores; `src/lib/telefono.ts` lo normaliza
best-effort al formato de WhatsApp (`54 9 <área> <número>` para celulares argentinos, sin
`+` ni guiones). Lo ideal es que el CSV del padrón traiga los celulares con característica.
Números que no se puedan normalizar quedan como `descartada` en la cola (no reintenta).

## 5. Cómo se envía

`POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}` con header
`apikey` y body `{ "number": "...", "text": "..." }`. Un 4xx (que no sea 429) se toma
como problema del mensaje y **no** se reintenta; 5xx y 429 reintentan con backoff.

## Riesgos

- WhatsApp puede **banear** números que mandan muchos mensajes no solicitados. Usá una
  línea dedicada, mandá solo a empleados que esperan el aviso, y arrancá con volumen bajo.
- Evolution API es software de terceros que depende de WhatsApp Web (no oficial). Para algo
  crítico, la API oficial de WhatsApp Business (Cloud API) es más estable — el adaptador
  `canalWhatsapp` se puede reescribir contra esa sin tocar el resto.
