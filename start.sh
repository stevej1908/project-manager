#!/bin/bash

echo "================================================"
echo "  Project Manager - Starting Application"
echo "================================================"
echo ""

# Check if node_modules exists in root
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

# Check if node_modules exists in server
if [ ! -d "server/node_modules" ]; then
    echo "Installing server dependencies..."
    cd server
    npm install
    cd ..
fi

echo ""
echo "Starting servers..."
echo "- Backend API: http://localhost:5000"
echo "- Frontend App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers using concurrently
npm run dev
