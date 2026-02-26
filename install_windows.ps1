# ============================================================
# CryptoTrack - Script d'installation automatique Windows 11
# ============================================================
# Exécuter en tant qu'Administrateur :
# PowerShell -ExecutionPolicy Bypass -File install_windows.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectName = "CryptoTrack"
$InstallPath = "$env:USERPROFILE\$ProjectName"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Installation de $ProjectName sur Windows 11" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour vérifier si une commande existe
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# ============================================================
# ETAPE 1 : Vérification des prérequis
# ============================================================
Write-Host "[1/6] Vérification des prérequis..." -ForegroundColor Yellow

# Python
if (Test-Command "python") {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ Python installé : $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Python non trouvé. Installation..." -ForegroundColor Red
    winget install Python.Python.3.11 --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Node.js
if (Test-Command "node") {
    $nodeVersion = node --version 2>&1
    Write-Host "  ✓ Node.js installé : $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js non trouvé. Installation..." -ForegroundColor Red
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Git (optionnel mais recommandé)
if (Test-Command "git") {
    Write-Host "  ✓ Git installé" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Git non trouvé (optionnel)" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================
# ETAPE 2 : Création de la structure du projet
# ============================================================
Write-Host "[2/6] Création de la structure du projet..." -ForegroundColor Yellow

if (Test-Path $InstallPath) {
    Write-Host "  ⚠ Le dossier $InstallPath existe déjà." -ForegroundColor Yellow
    $confirm = Read-Host "  Voulez-vous le supprimer et recommencer ? (o/n)"
    if ($confirm -eq "o") {
        Remove-Item -Recurse -Force $InstallPath
    } else {
        Write-Host "  Installation annulée." -ForegroundColor Red
        exit
    }
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\frontend\src" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\frontend\src\components" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\frontend\src\components\ui" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\frontend\public" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\data" -Force | Out-Null

Write-Host "  ✓ Structure créée dans $InstallPath" -ForegroundColor Green
Write-Host ""

# ============================================================
# ETAPE 3 : Téléchargement/Copie des fichiers
# ============================================================
Write-Host "[3/6] Préparation des fichiers de configuration..." -ForegroundColor Yellow

# Backend .env
$backendEnv = @"
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=crypto_portfolio

# JWT Secret (générer une clé aléatoire en production)
JWT_SECRET=votre_secret_jwt_a_changer_en_production

# Server Configuration
HOST=0.0.0.0
PORT=8001
"@
$backendEnv | Out-File -FilePath "$InstallPath\backend\.env" -Encoding UTF8

# Backend requirements.txt
$requirements = @"
fastapi==0.104.1
uvicorn==0.24.0
motor==3.3.2
pymongo==4.6.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
aiohttp==3.9.1
requests==2.31.0
pydantic==2.5.2
python-dotenv==1.0.0
"@
$requirements | Out-File -FilePath "$InstallPath\backend\requirements.txt" -Encoding UTF8

# Frontend .env
$frontendEnv = @"
REACT_APP_BACKEND_URL=http://localhost:8001
"@
$frontendEnv | Out-File -FilePath "$InstallPath\frontend\.env" -Encoding UTF8

# Frontend package.json
$packageJson = @"
{
  "name": "cryptotrack-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "react-scripts": "5.0.1",
    "axios": "^1.6.2",
    "lucide-react": "^0.294.0",
    "recharts": "^2.10.3",
    "sonner": "^1.2.4",
    "date-fns": "^2.30.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",
    "tailwindcss-animate": "^1.0.7",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
"@
$packageJson | Out-File -FilePath "$InstallPath\frontend\package.json" -Encoding UTF8

Write-Host "  ✓ Fichiers de configuration créés" -ForegroundColor Green
Write-Host ""

# ============================================================
# ETAPE 4 : Installation des dépendances Backend
# ============================================================
Write-Host "[4/6] Installation des dépendances Backend (Python)..." -ForegroundColor Yellow

Set-Location "$InstallPath\backend"
python -m venv venv
& "$InstallPath\backend\venv\Scripts\Activate.ps1"
pip install -r requirements.txt --quiet

Write-Host "  ✓ Dépendances Python installées" -ForegroundColor Green
Write-Host ""

# ============================================================
# ETAPE 5 : Installation des dépendances Frontend
# ============================================================
Write-Host "[5/6] Installation des dépendances Frontend (Node.js)..." -ForegroundColor Yellow

Set-Location "$InstallPath\frontend"
npm install --silent 2>$null

Write-Host "  ✓ Dépendances Node.js installées" -ForegroundColor Green
Write-Host ""

# ============================================================
# ETAPE 6 : Création des scripts de lancement
# ============================================================
Write-Host "[6/6] Création des scripts de lancement..." -ForegroundColor Yellow

# Script pour démarrer le backend
$startBackend = @"
@echo off
title CryptoTrack - Backend
cd /d "$InstallPath\backend"
call venv\Scripts\activate.bat
echo.
echo ========================================
echo   CryptoTrack Backend
echo   http://localhost:8001
echo ========================================
echo.
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
pause
"@
$startBackend | Out-File -FilePath "$InstallPath\start_backend.bat" -Encoding ASCII

# Script pour démarrer le frontend
$startFrontend = @"
@echo off
title CryptoTrack - Frontend
cd /d "$InstallPath\frontend"
echo.
echo ========================================
echo   CryptoTrack Frontend
echo   http://localhost:3000
echo ========================================
echo.
npm start
pause
"@
$startFrontend | Out-File -FilePath "$InstallPath\start_frontend.bat" -Encoding ASCII

# Script pour tout démarrer
$startAll = @"
@echo off
echo ========================================
echo   Démarrage de CryptoTrack
echo ========================================
echo.
echo Démarrage du Backend...
start "" "$InstallPath\start_backend.bat"
timeout /t 5 /nobreak >nul
echo Démarrage du Frontend...
start "" "$InstallPath\start_frontend.bat"
echo.
echo ========================================
echo   Application démarrée !
echo   Backend:  http://localhost:8001
echo   Frontend: http://localhost:3000
echo ========================================
echo.
pause
"@
$startAll | Out-File -FilePath "$InstallPath\START_CRYPTOTRACK.bat" -Encoding ASCII

# Script pour installer MongoDB
$installMongo = @"
@echo off
echo ========================================
echo   Installation de MongoDB
echo ========================================
echo.
winget install MongoDB.Server --accept-source-agreements --accept-package-agreements
echo.
echo MongoDB installé. Démarrez le service avec :
echo   net start MongoDB
echo.
pause
"@
$installMongo | Out-File -FilePath "$InstallPath\install_mongodb.bat" -Encoding ASCII

Write-Host "  ✓ Scripts de lancement créés" -ForegroundColor Green
Write-Host ""

# ============================================================
# INSTRUCTIONS FINALES
# ============================================================
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Installation terminée avec succès !" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dossier d'installation : $InstallPath" -ForegroundColor White
Write-Host ""
Write-Host "  PROCHAINES ETAPES :" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Installer MongoDB (si pas déjà fait) :" -ForegroundColor White
Write-Host "     Double-cliquez sur : install_mongodb.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Copier les fichiers source :" -ForegroundColor White
Write-Host "     - Copiez server.py dans : $InstallPath\backend\" -ForegroundColor Cyan
Write-Host "     - Copiez le dossier src dans : $InstallPath\frontend\" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Lancer l'application :" -ForegroundColor White
Write-Host "     Double-cliquez sur : START_CRYPTOTRACK.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Ouvrir dans le navigateur :" -ForegroundColor White
Write-Host "     http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green

# Ouvrir le dossier d'installation
explorer $InstallPath

Set-Location $InstallPath
