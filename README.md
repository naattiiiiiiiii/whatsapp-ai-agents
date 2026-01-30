# 🤖 WhatsApp AI Agents

Sistema de 4 agentes IA accesibles vía WhatsApp, conectados a tu ordenador. **100% gratuito**.

## ¿Qué hace?

Envía mensajes a WhatsApp y controla tu ordenador con IA:

| Agente | Qué puede hacer |
|--------|-----------------|
| 📁 **Archivos** | Buscar, leer, crear y organizar archivos |
| 🌐 **Web** | Buscar en Google, extraer contenido de páginas |
| 📅 **Productividad** | Calendario, notas, tareas, recordatorios |
| 💬 **Comunicación** | Enviar y leer emails |

## Arquitectura

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   WhatsApp   │     │         CLOUD (Cloudflare)          │
│   Usuarios   │────▶│  Webhook → Groq Router → MCP Queue  │
└──────────────┘     └──────────────┬──────────────────────┘
                                    │ Polling
                     ┌──────────────▼──────────────────────┐
                     │           TU PC LOCAL               │
                     │  ┌─────────────────────────────────┐│
                     │  │    4 AGENTES MCP                ││
                     │  │  📁 Archivos  🌐 Web            ││
                     │  │  📅 Productividad  💬 Comms     ││
                     │  └─────────────────────────────────┘│
                     └─────────────────────────────────────┘
```

## Stack Tecnológico (Todo Gratis)

| Componente | Tecnología | Límite Gratis |
|------------|------------|---------------|
| Backend | Cloudflare Workers | 100k req/día |
| Base de datos | Turso | 9GB, 500M rows/mes |
| Cache | Upstash Redis | 10k commands/día |
| Modelo IA | Groq (Llama 3.3 70B) | 6000 req/día |
| WhatsApp | WhatsApp Cloud API | 1000 conv/mes |

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/naattiiiiiiiii/whatsapp-ai-agents.git
cd whatsapp-ai-agents
```

### 2. Instalar dependencias

```bash
# macOS/Linux
./install.sh

# Windows
./install.ps1
```

### 3. Crear cuentas gratuitas

1. **WhatsApp Cloud API**: [developers.facebook.com](https://developers.facebook.com)
   - Crear App Business → Añadir WhatsApp
   - Obtener `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`

2. **Groq API**: [console.groq.com](https://console.groq.com)
   - Crear cuenta → Generar API Key

3. **Turso DB**: [turso.tech](https://turso.tech)
   - Crear cuenta → Crear database
   - Obtener URL y Token

4. **Upstash Redis**: [upstash.com](https://upstash.com)
   - Crear cuenta → Crear Redis database
   - Obtener REST URL y Token

### 4. Configurar credenciales

```bash
# Cloud Backend
cp apps/cloud-backend/.dev.vars.example apps/cloud-backend/.dev.vars
# Editar con tus credenciales

# Local Agent
cp apps/local-agent/.env.example apps/local-agent/.env
# Editar con tus credenciales
```

### 5. Desplegar

```bash
# Instalar Wrangler CLI
npm install -g wrangler
wrangler login

# Configurar secretos en Cloudflare
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put WHATSAPP_PHONE_ID
wrangler secret put GROQ_API_KEY
wrangler secret put TURSO_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put UPSTASH_REDIS_URL
wrangler secret put UPSTASH_REDIS_TOKEN
wrangler secret put LOCAL_AGENT_SECRET

# Desplegar backend
cd apps/cloud-backend
npm run deploy
```

### 6. Configurar Webhook en Meta

1. Ve a tu app en [developers.facebook.com](https://developers.facebook.com)
2. WhatsApp → Configuración → Webhook
3. URL: `https://tu-worker.workers.dev/webhook`
4. Verify Token: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
5. Suscribirse a: `messages`

### 7. Ejecutar agente local

```bash
npm run dev:local
```

**Nota**: Tu PC debe estar encendido para que funcionen los agentes.

## Uso

### Ejemplos de mensajes

```
📁 "Busca archivos PDF en Descargas"
📁 "Lee el archivo informe.txt"
📁 "Crea un archivo notas.txt con la lista de compras"

🌐 "Busca en Google: restaurantes Madrid"
🌐 "Extrae el contenido de https://ejemplo.com"

📅 "¿Qué eventos tengo hoy?"
📅 "Crea una nota con ideas para el proyecto"
📅 "Añade tarea: comprar leche"

💬 "Envía email a juan@email.com diciendo que llego tarde"
💬 "¿Qué emails tengo sin leer?"
```

### Sistema de usuarios

Si quieres que otras personas usen TU sistema:

1. Ellos envían mensaje a tu WhatsApp
2. Reciben código de autorización (ej: `ABC123`)
3. Te comparten el código
4. Tú autorizas con: `/autorizar ABC123 NombrePersona`

**Comandos admin:**
- `/autorizar <código> <nombre>` - Autorizar usuario
- `/revocar <teléfono>` - Quitar acceso
- `/usuarios` - Ver lista de usuarios

## Estructura del Proyecto

```
whatsapp-ai-agents/
├── apps/
│   ├── cloud-backend/      # Cloudflare Workers
│   │   └── src/
│   │       ├── webhook/    # Recibe mensajes WhatsApp
│   │       ├── router/     # Enruta con Groq
│   │       ├── db/         # Turso + Redis
│   │       └── mcp-client/ # Comunicación con PC
│   │
│   └── local-agent/        # Corre en tu PC
│       └── src/
│           ├── server/     # Servidor MCP
│           └── agents/
│               ├── files/       # Agente archivos
│               ├── web/         # Agente web
│               ├── productivity/# Agente productividad
│               └── comms/       # Agente comunicación
│
└── packages/
    └── shared/             # Tipos compartidos
```

## Licencia

MIT
