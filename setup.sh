#!/bin/bash

# ============================================================
# Playwright Automation Dashboard - First-time Setup
# ============================================================

set -e

echo ""
echo "============================================================"
echo " Playwright Automation Dashboard - First-time Setup"
echo "============================================================"
echo ""

# ── Step 0: Check Node.js ──────────────────────────────────────
echo "[0/4] Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js not found. Install from https://nodejs.org"
    exit 1
fi

NODE_VER=$(node --version)
echo "        Found Node.js ${NODE_VER}"
echo ""

# ── Step 1: Install root project dependencies ──────────────────
echo "[1/4] Installing project dependencies..."
echo "        (playwright, typescript, dotenv, etc.)"
echo ""

if ! npm install; then
    echo "[ERROR] npm install failed."
    exit 1
fi

echo "        Done."
echo ""

# ── Step 2: Install Playwright browsers ────────────────────────
echo "[2/4] Installing Playwright Chromium browser..."

if ! npx playwright install chromium; then
    echo "[WARNING] Chromium install failed."
    echo "          Retry: npx playwright install chromium"
fi

echo "        Done."
echo ""

# ── Step 3: Setup dashboard folder and install server deps ─────
echo "[3/4] Setting up dashboard and installing server dependencies..."

mkdir -p dashboard/public

if ! npm install express glob --prefix dashboard; then
    echo "[ERROR] Failed to install dashboard dependencies."
    exit 1
fi

echo "        Done."
echo ""

# ── Step 4: Verify express is accessible ───────────────────────
echo "[4/4] Verifying dashboard dependencies..."

if node -e "require('express'); console.log('        express OK');" 2>/dev/null; then
    :
elif node -e "require('./dashboard/node_modules/express'); console.log('        express OK');" 2>/dev/null; then
    :
else
    echo "[WARNING] express may not be accessible."
    echo "          Try running ./setup.sh again."
fi

echo "        Done."
echo ""

# ── Done ───────────────────────────────────────────────────────
echo "============================================================"
echo " Setup complete!"
echo ""
echo "    Node.js     : ${NODE_VER}"
echo "    Playwright  : Chromium installed"
echo "    Dashboard   : express + glob installed"
echo ""
echo " Run ./automation.sh to start the dashboard."
echo "============================================================"
echo ""

read -p "Press Enter to exit..."