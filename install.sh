#!/bin/bash

# =====================================================
# WhatsApp AI Agents - Script de Instalación (macOS/Linux)
# =====================================================

set -e

echo "
╔═══════════════════════════════════════════════════════════╗
║       🤖 WhatsApp AI Agents - Instalación                  ║
╚═══════════════════════════════════════════════════════════╝
"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar comandos
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 instalado"
        return 0
    else
        echo -e "${RED}✗${NC} $1 no encontrado"
        return 1
    fi
}

# Verificar requisitos
echo "Verificando requisitos..."
echo ""

MISSING=0

check_command "node" || MISSING=1
check_command "npm" || MISSING=1

# Verificar versión de Node
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗${NC} Node.js 18+ requerido (tienes v$NODE_VERSION)"
    MISSING=1
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo -e "${RED}Faltan requisitos. Por favor instala:${NC}"
    echo "  - Node.js 18+: https://nodejs.org/"
    exit 1
fi

echo ""
echo "Instalando dependencias..."

# Instalar dependencias
npm install

# Build shared package
echo ""
echo "Compilando paquetes..."
cd packages/shared && npm run build && cd ../..

echo ""
echo -e "${GREEN}✓ Instalación completada${NC}"
echo ""

# Crear archivo de configuración si no existe
if [ ! -f "apps/local-agent/.env" ]; then
    echo "Creando archivo de configuración..."
    cp apps/local-agent/.env.example apps/local-agent/.env
    echo -e "${YELLOW}⚠ Configura apps/local-agent/.env con tus credenciales${NC}"
fi

echo "
╔═══════════════════════════════════════════════════════════╗
║                    Próximos pasos:                         ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  1. Configura WhatsApp Business API:                      ║
║     - Crea cuenta en developers.facebook.com              ║
║     - Configura WhatsApp Cloud API                        ║
║     - Obtén WHATSAPP_TOKEN y WHATSAPP_PHONE_ID            ║
║                                                           ║
║  2. Configura Cloudflare Workers:                         ║
║     - Instala wrangler: npm install -g wrangler           ║
║     - Login: wrangler login                               ║
║     - Configura secretos (ver wrangler.toml)              ║
║                                                           ║
║  3. Configura servicios gratuitos:                        ║
║     - Turso DB: turso.tech                                ║
║     - Upstash Redis: upstash.com                          ║
║     - Groq API: console.groq.com                          ║
║                                                           ║
║  4. Edita apps/local-agent/.env con tus credenciales      ║
║                                                           ║
║  5. Inicia el sistema:                                    ║
║     - Cloud: npm run dev:cloud                            ║
║     - Local: npm run dev:local                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
