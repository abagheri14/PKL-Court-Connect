# ══════════════════════════════════════════════════════════════════════════════
# PKL Court Connect — Setup Script (Windows PowerShell)
# ══════════════════════════════════════════════════════════════════════════════
# Run with: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        PKL Court Connect — Environment Setup            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeVersion = $null
try { $nodeVersion = (node -v 2>$null) } catch {}
if (-not $nodeVersion) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$major = [int]($nodeVersion -replace 'v','').Split('.')[0]
if ($major -lt 20) {
    Write-Host "❌ Node.js 20+ required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green

# Check pnpm
$pnpmVersion = $null
try { $pnpmVersion = (pnpm -v 2>$null) } catch {}
if (-not $pnpmVersion) {
    Write-Host "📦 Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    $pnpmVersion = (pnpm -v)
}
Write-Host "✅ pnpm $pnpmVersion" -ForegroundColor Green

# Check MySQL
$mysqlVersion = $null
try { $mysqlVersion = (mysql --version 2>$null) } catch {}
if (-not $mysqlVersion) {
    Write-Host "⚠️  MySQL client not found. Make sure MySQL 8.x is installed and running." -ForegroundColor Yellow
} else {
    Write-Host "✅ MySQL client found" -ForegroundColor Green
}

Write-Host ""

# Set up .env
if (-not (Test-Path ".env")) {
    Write-Host "📋 Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "   ⚠️  Please edit .env with your database credentials before proceeding." -ForegroundColor Yellow
    Write-Host ""
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
pnpm install

Write-Host ""

# Database setup instructions
Write-Host "🗃️  Database Setup" -ForegroundColor Cyan
Write-Host "────────────────────"
Write-Host "Run ONE of the following to set up the database:"
Write-Host ""
Write-Host "  Option A (Recommended — Drizzle push):" -ForegroundColor Green
Write-Host "    pnpm db:push"
Write-Host ""
Write-Host "  Option B (Consolidated SQL):" -ForegroundColor Green
Write-Host "    mysql -u root -p pkl_court_connect < database\init.sql"
Write-Host ""
Write-Host "  Make sure to first create the database:" -ForegroundColor Yellow
Write-Host '    mysql -u root -p -e "CREATE DATABASE pkl_court_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
Write-Host ""

Write-Host "✅ Setup complete! Run 'pnpm dev' to start the development server." -ForegroundColor Green
