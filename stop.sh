#!/bin/bash
# Split-Flap Display - Shutdown Script
# Stops Client and Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Split-Flap Display - Stopping"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -t -i :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null
        return 0
    fi
    return 1
}

# 1. Stop Client
echo -e "\n${YELLOW}[1/2] Stopping Client...${NC}"
if [ -f "$SCRIPT_DIR/logs/client.pid" ]; then
    CLIENT_PID=$(cat "$SCRIPT_DIR/logs/client.pid")
    if ps -p $CLIENT_PID > /dev/null 2>&1; then
        kill $CLIENT_PID 2>/dev/null
        sleep 1
    fi
    rm -f "$SCRIPT_DIR/logs/client.pid"
fi

# Also kill any process on port 3000
if check_port 3000; then
    kill_port 3000
fi

if ! check_port 3000; then
    echo -e "${GREEN}Client stopped${NC}"
else
    echo -e "${RED}Client may still be running${NC}"
fi

# 2. Stop Server
echo -e "\n${YELLOW}[2/2] Stopping Server...${NC}"
if [ -f "$SCRIPT_DIR/logs/server.pid" ]; then
    SERVER_PID=$(cat "$SCRIPT_DIR/logs/server.pid")
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        kill $SERVER_PID 2>/dev/null
        sleep 1
    fi
    rm -f "$SCRIPT_DIR/logs/server.pid"
fi

# Also kill any process on port 3001
if check_port 3001; then
    kill_port 3001
fi

if ! check_port 3001; then
    echo -e "${GREEN}Server stopped${NC}"
else
    echo -e "${RED}Server may still be running${NC}"
fi

# Summary
echo -e "\n=========================================="
echo -e "${GREEN}Split-Flap Display Stopped${NC}"
echo "=========================================="
echo ""
echo "Status:"
if check_port 3001; then
    echo "  - Server: Still running on port 3001"
else
    echo "  - Server: Stopped"
fi
if check_port 3000; then
    echo "  - Client: Still running on port 3000"
else
    echo "  - Client: Stopped"
fi
echo ""
echo "=========================================="
