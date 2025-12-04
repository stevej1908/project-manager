#!/bin/bash
# Kill process using a specific port
# Usage: ./kill-port.sh [port_number]
# Example: ./kill-port.sh 5000

# Default to port 5000 if no argument provided
PORT=${1:-5000}

echo "================================================"
echo "  Killing Process on Port $PORT"
echo "================================================"
echo ""

echo "Searching for process using port $PORT..."
echo ""

# Find the process ID using the port
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    PID=$(lsof -ti:$PORT)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    PID=$(lsof -ti:$PORT 2>/dev/null || fuser $PORT/tcp 2>/dev/null | awk '{print $1}')
else
    # Try generic approach
    PID=$(lsof -ti:$PORT 2>/dev/null)
fi

if [ -z "$PID" ]; then
    echo "No process found using port $PORT"
    echo ""
    exit 0
fi

echo "Found process with PID: $PID"
echo "Attempting to kill process..."
echo ""

# Try to kill the process
if kill -9 $PID 2>/dev/null; then
    echo ""
    echo "✓ SUCCESS: Process killed successfully!"
    echo "Port $PORT is now available."
    echo ""
else
    echo ""
    echo "✗ ERROR: Could not kill process."
    echo "You may need to run this script with sudo:"
    echo "  sudo ./kill-port.sh $PORT"
    echo ""
    exit 1
fi
