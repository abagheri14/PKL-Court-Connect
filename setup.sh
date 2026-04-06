#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# PKL Court Connect — Setup Script (Linux/macOS)
# ══════════════════════════════════════════════════════════════════════════════
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        PKL Court Connect — Environment Setup            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# Check MySQL
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL client not found. Make sure MySQL 8.x is installed and running."
else
    echo "✅ MySQL client found"
fi

echo ""

# Set up .env
if [ ! -f .env ]; then
    echo "📋 Creating .env from .env.example..."
    cp .env.example .env
    echo "   ⚠️  Please edit .env with your database credentials before proceeding."
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

echo ""

# Database setup
echo "🗃️  Database Setup"
echo "────────────────────"
echo "Run ONE of the following to set up the database:"
echo ""
echo "  Option A (Recommended — Drizzle push):"
echo "    pnpm db:push"
echo ""
echo "  Option B (Consolidated SQL):"
echo "    mysql -u root -p pkl_court_connect < database/init.sql"
echo ""
echo "  Make sure to first create the database:"
echo '    mysql -u root -p -e "CREATE DATABASE pkl_court_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
echo ""

echo "✅ Setup complete! Run 'pnpm dev' to start the development server."
