#!/bin/bash

# =====================================================
# WhatsApp AI Agents - Docker Setup Script
# =====================================================

echo "
╔═══════════════════════════════════════════════════════════╗
║       🤖 WhatsApp AI Agents - Docker Setup                 ║
╚═══════════════════════════════════════════════════════════╝
"

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    echo "Configurando variables de entorno..."
    echo ""

    read -p "🔑 LOCAL_AGENT_SECRET (inventa uno): " SECRET
    read -p "🌐 CLOUD_BACKEND_URL (tu worker URL): " CLOUD_URL

    echo ""
    read -p "📧 ¿Configurar Gmail? (s/n): " GMAIL

    if [ "$GMAIL" = "s" ] || [ "$GMAIL" = "S" ]; then
        read -p "   GOOGLE_CLIENT_ID: " GOOGLE_ID
        read -p "   GOOGLE_CLIENT_SECRET: " GOOGLE_SECRET
        read -p "   GOOGLE_REFRESH_TOKEN: " GOOGLE_REFRESH
    fi

    cat > .env << EOF
LOCAL_AGENT_SECRET=$SECRET
CLOUD_BACKEND_URL=$CLOUD_URL
GOOGLE_CLIENT_ID=${GOOGLE_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_SECRET:-}
GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH:-}
EOF

    echo ""
    echo "✅ Archivo .env creado"
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    echo "   Instálalo desde: https://docker.com"
    exit 1
fi

echo ""
echo "🐳 Construyendo imagen Docker..."
docker-compose build

echo ""
echo "🚀 Iniciando contenedor..."
docker-compose up -d

echo ""
echo "
╔═══════════════════════════════════════════════════════════╗
║                    ✅ ¡LISTO!                              ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  El agente está corriendo en Docker.                      ║
║                                                           ║
║  Comandos útiles:                                         ║
║    docker-compose logs -f    # Ver logs                   ║
║    docker-compose stop       # Parar                      ║
║    docker-compose start      # Iniciar                    ║
║    docker-compose down       # Eliminar                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
