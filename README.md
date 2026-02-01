# 🤖 WhatsApp AI Agents

Sistema de 4 agentes IA accesibles vía **Telegram** (y WhatsApp), conectados a tu ordenador. **100% gratuito**.

## ¿Qué hace?

Envía mensajes y controla tu ordenador con IA:

| Agente | Funciones |
|--------|-----------|
| 📁 **Archivos** | Buscar, leer, crear y organizar archivos |
| 🌐 **Web** | Buscar en Google, extraer contenido de páginas |
| 📅 **Productividad** | Notas, tareas, recordatorios |
| 💬 **Email** | Enviar, leer y responder emails (Gmail) |

## Arquitectura

```
┌──────────────────┐     ┌─────────────────────────────────┐
│  Telegram/WA     │     │      CLOUD (Cloudflare)         │
│  Usuarios        │────▶│  Webhook → Groq AI → MCP Queue  │
└──────────────────┘     └──────────────┬──────────────────┘
                                        │ Polling
                         ┌──────────────▼──────────────────┐
                         │         TU ORDENADOR            │
                         │  ┌───────────────────────────┐  │
                         │  │     4 AGENTES MCP         │  │
                         │  │  📁 Files    🌐 Web       │  │
                         │  │  📅 Tasks    💬 Email     │  │
                         │  └───────────────────────────┘  │
                         └─────────────────────────────────┘
```

---

## 🚀 Inicio Rápido (15 minutos)

### Opción A: Con Docker (Recomendado)

```bash
git clone https://github.com/naattiiiiiiiii/whatsapp-ai-agents
cd whatsapp-ai-agents
./docker-setup.sh
```

### Opción B: Sin Docker

```bash
git clone https://github.com/naattiiiiiiiii/whatsapp-ai-agents
cd whatsapp-ai-agents
./install.sh
```

---

## 📱 Configurar Telegram (2 minutos)

1. Abre Telegram y busca **@BotFather**
2. Envía `/newbot`
3. Nombre: `Mi AI Agent`
4. Username: `tunombre_ai_bot`
5. **Copia el token** que te da

### Obtener tu Chat ID (admin):
1. Busca **@RawDataBot** en Telegram
2. Envía `/start`
3. Copia tu **"id"** (número)

---

## ☁️ Servicios Cloud (todos gratuitos)

### 1. Groq API (IA)
1. Ve a [console.groq.com](https://console.groq.com)
2. Crea cuenta → API Keys → Create
3. **Copia la API Key**

### 2. Turso (Base de datos)
```bash
# Instalar CLI
brew install tursodatabase/tap/turso  # Mac
# o: curl -sSfL https://get.tur.so/install.sh | bash

# Login y crear DB
turso auth login
turso db create whatsapp-agents
turso db show whatsapp-agents --url        # Copia la URL
turso db tokens create whatsapp-agents     # Copia el token
```

### 3. Upstash Redis (Cache)
1. Ve a [upstash.com](https://upstash.com)
2. Crea cuenta → Create Database → Regional
3. Pestaña "REST API" → Copia **URL** y **Token**

---

## 🚀 Desplegar en Cloudflare

```bash
# Instalar Wrangler
npm install -g wrangler
wrangler login

# Configurar secretos
cd apps/cloud-backend
wrangler secret put TELEGRAM_BOT_TOKEN      # Token de BotFather
wrangler secret put TELEGRAM_ADMIN_CHAT_ID  # Tu Chat ID
wrangler secret put GROQ_API_KEY            # API key de Groq
wrangler secret put TURSO_URL               # URL de Turso
wrangler secret put TURSO_AUTH_TOKEN        # Token de Turso
wrangler secret put UPSTASH_REDIS_URL       # URL de Upstash
wrangler secret put UPSTASH_REDIS_TOKEN     # Token de Upstash
wrangler secret put LOCAL_AGENT_SECRET      # Inventa uno seguro

# Desplegar
wrangler deploy
```

### Configurar Webhook de Telegram
```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://<TU_WORKER>.workers.dev/telegram"
```

---

## 💻 Ejecutar Agente Local

```bash
# Configurar
cp apps/local-agent/.env.example apps/local-agent/.env
# Editar .env con tus datos

# Ejecutar
npm run dev:local
```

**⚠️ El ordenador debe estar encendido** para que funcionen los agentes.

---

## 📧 Configurar Gmail (Opcional)

### 1. Google Cloud Console
1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear proyecto → APIs y servicios → Habilitar Gmail API
3. Credenciales → Crear credenciales → ID de cliente OAuth
4. Tipo: **Aplicación web**
5. URI de redirección: `https://developers.google.com/oauthplayground`
6. Copia **Client ID** y **Client Secret**

### 2. Pantalla de consentimiento
1. APIs y servicios → Pantalla de consentimiento OAuth
2. Usuarios de prueba → Añadir tu email

### 3. Obtener Refresh Token
1. Ve a [OAuth Playground](https://developers.google.com/oauthplayground)
2. ⚙️ → Marca "Use your own OAuth credentials"
3. Pega Client ID y Client Secret
4. Izquierda: Gmail API v1 → `https://mail.google.com/`
5. Authorize APIs → Login → Exchange for tokens
6. Copia el **Refresh Token**

### 4. Configurar en .env
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//xxx
```

---

## 👥 Sistema de Usuarios

### Para USAR el bot (fácil):
1. Abre el bot en Telegram
2. Escribe "hola"
3. Recibes código → Se lo das al admin
4. Admin te autoriza → ¡Listo!

### Comandos de Admin:
```
/autorizar ABC123 Nombre  - Autorizar usuario
/revocar tg_123456789     - Revocar acceso
/usuarios                 - Ver lista
/ayuda                    - Ver comandos
```

### ⚠️ Seguridad
Si autorizas a alguien, **tiene acceso a tu ordenador** (archivos, web, email). Solo autoriza gente de confianza.

---

## 🧪 Ejemplos de Uso

### 📁 Archivos
```
Lista los archivos en mi escritorio
Busca archivos PDF en Descargas
Crea un archivo notas.txt con la lista de compras
```

### 🌐 Web
```
Busca información sobre inteligencia artificial
Extrae el contenido de https://example.com
```

### 📅 Productividad
```
Crea una tarea: comprar leche
Lista mis tareas pendientes
Crea una nota con ideas para el proyecto
```

### 💬 Email
```
Muéstrame mis emails sin leer
Envía un email a juan@email.com diciendo hola
Crea un borrador para el jefe sobre la reunión
```

---

## 🐳 Docker

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

---

## 📊 Límites Gratuitos

| Servicio | Límite |
|----------|--------|
| Telegram | ∞ ilimitado |
| Groq | 6,000 requests/día |
| Cloudflare Workers | 100,000 requests/día |
| Turso | 9GB, 500M rows/mes |
| Upstash | 10,000 commands/día |

---

## 🔧 Troubleshooting

### El bot no responde
1. Verifica que el agente local esté corriendo: `curl http://localhost:3001/health`
2. Revisa los logs de Cloudflare: `wrangler tail`
3. Verifica el webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`

### Error de Turso (401)
- Asegúrate de crear el token SIN la flag `--read-only`
- Comando correcto: `turso db tokens create whatsapp-agents`

### Gmail no funciona
- Verifica que añadiste tu email como usuario de prueba
- El refresh token expira si no se usa - regenera si es necesario

---

## 📁 Estructura del Proyecto

```
whatsapp-ai-agents/
├── apps/
│   ├── cloud-backend/      # Cloudflare Workers
│   │   └── src/
│   │       ├── webhook/    # Telegram + WhatsApp handlers
│   │       ├── router/     # Groq AI routing
│   │       └── db/         # Turso + Redis
│   │
│   └── local-agent/        # Corre en tu PC
│       └── src/
│           ├── server/     # Servidor MCP
│           └── agents/     # Los 4 agentes
│
├── packages/shared/        # Tipos compartidos
├── Dockerfile             # Para Docker
├── docker-compose.yml     # Configuración Docker
└── docker-setup.sh        # Script de setup
```

---

## 📄 Licencia

MIT

---

**Creado con ❤️ por [@naattiiiiiiiii](https://github.com/naattiiiiiiiii)**
