#!/bin/bash

echo ""
echo "🚀 Starting Playwright Automation Dashboard..."
echo "🌐 Open browser at: http://localhost:3000"
echo ""

# Open browser based on OS
(
    sleep 2

    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:3000
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://localhost:3000
    fi
) &

# Start the Node.js server
node dashboard/server.js