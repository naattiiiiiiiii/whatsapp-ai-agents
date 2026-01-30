# 🤖 WhatsApp AI Agents - Guía de Configuración

## Arquitectura

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   WhatsApp   │     │         CLOUD (Cloudflare)          │
│   Usuarios   │────▶│  Webhook → Groq Router → MCP Queue  │
└──────────────┘     └──────────────┬──────────────────────┘
                                    │ Polling
                     ┌──────────────▼──────────────────────┐
                     │           TU PC LOCAL               │
                     │  ┌─────────────────────────────┐    │
                     │  │    4 AGENTES MCP            │    │
                     │  │  📁 Archivos  🌐 Web        │    │
                     │  │  📅 Productividad  💬 Comms │    │
                     │  └─────────────────────────────┘    │
                     └─────────────────────────────────────┘
```

## Paso 1: WhatsApp Cloud API

1. Ve a [developers.facebook.com](https://developers.facebook.com)
2. Crea una nueva App → Tipo: Business
3. Añade el producto "WhatsApp"
4. En WhatsApp → Getting Started:
   - Anota el **Phone number ID**
   - Genera un **Access Token** (permanente)
5. Configura el Webhook:
   - URL: `https://tu-worker.workers.dev/webhook`
   - Verify Token: elige uno seguro
   - Suscríbete a: `messages`

## Paso 2: Cloudflare Workers

```bash
# Instalar Wrangler CLI
npm install -g wrangler

# Login
wrangler login

# Configurar secretos
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put WHATSAPP_PHONE_ID
wrangler secret put GROQ_API_KEY
wrangler secret put TURSO_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put UPSTASH_REDIS_URL
wrangler secret put UPSTASH_REDIS_TOKEN
wrangler secret put LOCAL_AGENT_SECRET  # Genera uno seguro

# Desplegar
cd apps/cloud-backend
npm run deploy
```

## Paso 3: Turso DB (Base de datos)

1. Ve a [turso.tech](https://turso.tech) y crea cuenta
2. Crea una nueva base de datos
3. Obtén la URL y el Auth Token:
   ```bash
   turso db show tu-db --url
   turso db tokens create tu-db
   ```

## Paso 4: Upstash Redis (Cache)

1. Ve a [upstash.com](https://upstash.com) y crea cuenta
2. Crea una nueva base de datos Redis
3. Copia la REST URL y Token

## Paso 5: Groq API

1. Ve a [console.groq.com](https://console.groq.com)
2. Genera una API Key

## Paso 6: Configuración Local

Edita `apps/local-agent/.env`:

```env
LOCAL_AGENT_SECRET=el-mismo-secreto-que-pusiste-en-cloudflare
CLOUD_BACKEND_URL=https://whatsapp-ai-agents.tu-usuario.workers.dev
PORT=3001
FILES_BASE_DIR=/Users/tu-usuario
POLLING_INTERVAL=2
```

## Paso 7: Google OAuth (Opcional - para Gmail/Calendar)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea proyecto → Habilita Gmail API y Calendar API
3. Crea credenciales OAuth 2.0
4. Usa el OAuth Playground para obtener refresh token:
   - https://developers.google.com/oauthplayground
   - Scopes: `gmail.send`, `gmail.readonly`, `calendar`

## Ejecutar el Sistema

### Desarrollo

```bash
# Terminal 1 - Cloud Backend
npm run dev:cloud

# Terminal 2 - Agente Local
npm run dev:local
```

### Producción

```bash
# Desplegar cloud
npm run deploy

# Ejecutar agente local (debe estar siempre corriendo)
npm run dev:local
```

## Sistema de Usuarios

### Flujo de Autorización

1. Usuario nuevo envía mensaje al WhatsApp
2. Recibe código de autorización (ej: `ABC123`)
3. Comparte código con el admin
4. Admin envía: `/autorizar ABC123 Juan`
5. Usuario queda autorizado

### Comandos de Admin

- `/autorizar <código> <nombre>` - Autorizar usuario
- `/revocar <teléfono>` - Revocar acceso
- `/usuarios` - Ver lista de usuarios
- `/ayuda` - Ver comandos

## Pruebas

### Test WhatsApp → Cloud
Envía un mensaje al número de WhatsApp y verifica en los logs de Cloudflare:
```bash
wrangler tail
```

### Test Agente Local
```bash
curl http://localhost:3001/health
```

### Test Herramientas
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "X-Agent-Secret: tu-secreto" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"tool":"files_list","arguments":{"path":"."}}}'
```

## Límites Gratuitos

| Servicio | Límite |
|----------|--------|
| WhatsApp Cloud API | 1000 conversaciones/mes |
| Groq API | 6000 requests/día |
| Cloudflare Workers | 100k requests/día |
| Turso | 9GB storage, 500M rows/mes |
| Upstash | 10k commands/día |

## Troubleshooting

### El webhook no recibe mensajes
- Verifica que el Verify Token coincida
- Asegúrate de estar suscrito a `messages`
- Revisa los logs: `wrangler tail`

### El agente local no conecta
- Verifica que `CLOUD_BACKEND_URL` sea correcto
- Comprueba que `LOCAL_AGENT_SECRET` coincida en ambos lados
- Revisa que el puerto no esté ocupado

### Errores de permisos en archivos
- El agente solo puede acceder dentro de `FILES_BASE_DIR`
- Verifica los permisos del directorio

### Gmail/Calendar no funciona
- Asegúrate de haber habilitado las APIs en Google Cloud
- Verifica que el refresh token no haya expirado
- Regenera el token si es necesario
