#!/bin/bash
# Split-Flap Display - Status Script
# Shows status of all services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Split-Flap Display - Status"
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

# Server
echo -e "\n${YELLOW}Server:${NC}"
if check_port 3001; then
    echo -e "  Status: ${GREEN}Running${NC}"
    echo "  URL: http://localhost:3001"

    # Try to get current message
    HEALTH=$(curl -s http://localhost:3001/api/status 2>/dev/null)
    if [ -n "$HEALTH" ]; then
        echo "  Health: OK"
    fi

    if [ -f "$SCRIPT_DIR/logs/server.pid" ]; then
        PID=$(cat "$SCRIPT_DIR/logs/server.pid")
        if ps -p $PID > /dev/null 2>&1; then
            echo "  PID: $PID"
        fi
    fi
else
    echo -e "  Status: ${RED}Not Running${NC}"
fi

# Client
echo -e "\n${YELLOW}Client:${NC}"
if check_port 3000; then
    echo -e "  Status: ${GREEN}Running${NC}"
    echo "  URL: http://localhost:3000"

    if [ -f "$SCRIPT_DIR/logs/client.pid" ]; then
        PID=$(cat "$SCRIPT_DIR/logs/client.pid")
        if ps -p $PID > /dev/null 2>&1; then
            echo "  PID: $PID"
        fi
    fi
else
    echo -e "  Status: ${RED}Not Running${NC}"
fi

# Log files
echo -e "\n${YELLOW}Log Files:${NC}"
if [ -f "$SCRIPT_DIR/logs/server.log" ]; then
    SIZE=$(ls -lh "$SCRIPT_DIR/logs/server.log" | awk '{print $5}')
    echo "  Server:  logs/server.log ($SIZE)"
else
    echo "  Server:  No log file"
fi

if [ -f "$SCRIPT_DIR/logs/client.log" ]; then
    SIZE=$(ls -lh "$SCRIPT_DIR/logs/client.log" | awk '{print $5}')
    echo "  Client:  logs/client.log ($SIZE)"
else
    echo "  Client:  No log file"
fi

echo -e "\n=========================================="
echo "Commands:"
echo "  ./start.sh   - Start all services"
echo "  ./stop.sh    - Stop all services"
echo "  ./status.sh  - Show this status"
echo "=========================================="
