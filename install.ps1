# =====================================================
# WhatsApp AI Agents - Script de Instalación (Windows)
# =====================================================

$ErrorActionPreference = "Stop"

Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║       🤖 WhatsApp AI Agents - Instalación                  ║
╚═══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Función para verificar comandos
function Check-Command {
    param($Command, $Name)
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "✓ $Name instalado" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Name no encontrado" -ForegroundColor Red
        return $false
    }
}

# Verificar requisitos
Write-Host "Verificando requisitos..." -ForegroundColor Yellow
Write-Host ""

$Missing = $false

if (-not (Check-Command "node" "Node.js")) { $Missing = $true }
if (-not (Check-Command "npm" "npm")) { $Missing = $true }

# Verificar versión de Node
if (-not $Missing) {
    $NodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
    if ([int]$NodeVersion -lt 18) {
        Write-Host "✗ Node.js 18+ requerido (tienes v$NodeVersion)" -ForegroundColor Red
        $Missing = $true
    }
}

if ($Missing) {
    Write-Host ""
    Write-Host "Faltan requisitos. Por favor instala:" -ForegroundColor Red
    Write-Host "  - Node.js 18+: https://nodejs.org/"
    exit 1
}

Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow

# Instalar dependencias
npm install

# Build shared package
Write-Host ""
Write-Host "Compilando paquetes..." -ForegroundColor Yellow
Push-Location packages/shared
npm run build
Pop-Location

Write-Host ""
Write-Host "✓ Instalación completada" -ForegroundColor Green
Write-Host ""

# Crear archivo de configuración si no existe
if (-not (Test-Path "apps/local-agent/.env")) {
    Write-Host "Creando archivo de configuración..." -ForegroundColor Yellow
    Copy-Item "apps/local-agent/.env.example" "apps/local-agent/.env"
    Write-Host "⚠ Configura apps/local-agent/.env con tus credenciales" -ForegroundColor Yellow
}

Write-Host @"

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

"@ -ForegroundColor Cyan
