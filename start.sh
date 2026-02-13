#!/bin/bash
# Split-Flap Display - Startup Script
# Starts Server (port 3001) and Client (port 3000)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Split-Flap Display - Starting"
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

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# 1. Start Server
echo -e "\n${YELLOW}[1/2] Starting Server...${NC}"
if check_port 3001; then
    echo -e "${GREEN}Server is already running on port 3001${NC}"
else
    cd "$SCRIPT_DIR/server"
    nohup npm start > "$SCRIPT_DIR/logs/server.log" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$SCRIPT_DIR/logs/server.pid"

    echo "Waiting for Server to start..."
    for i in {1..15}; do
        if check_port 3001; then
            echo -e "${GREEN}Server started successfully (PID: $SERVER_PID)${NC}"
            break
        fi
        sleep 1
    done

    if ! check_port 3001; then
        echo -e "${RED}Server failed to start within 15 seconds${NC}"
        echo "Check logs/server.log for details"
        exit 1
    fi

    cd "$SCRIPT_DIR"
fi

# 2. Start Client
echo -e "\n${YELLOW}[2/2] Starting Client...${NC}"
if check_port 3000; then
    echo -e "${GREEN}Client is already running on port 3000${NC}"
else
    cd "$SCRIPT_DIR/client"
    nohup npm run dev > "$SCRIPT_DIR/logs/client.log" 2>&1 &
    CLIENT_PID=$!
    echo $CLIENT_PID > "$SCRIPT_DIR/logs/client.pid"

    echo "Waiting for Client to start..."
    for i in {1..15}; do
        if check_port 3000; then
            echo -e "${GREEN}Client started successfully (PID: $CLIENT_PID)${NC}"
            break
        fi
        sleep 1
    done

    if ! check_port 3000; then
        echo -e "${RED}Client failed to start within 15 seconds${NC}"
        echo "Check logs/client.log for details"
        exit 1
    fi

    cd "$SCRIPT_DIR"
fi

# Summary
echo -e "\n=========================================="
echo -e "${GREEN}Split-Flap Display Started${NC}"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Server:  http://localhost:3001"
echo "  - Client:  http://localhost:3000"
echo ""
echo "Logs:"
echo "  - Server:  $SCRIPT_DIR/logs/server.log"
echo "  - Client:  $SCRIPT_DIR/logs/client.log"
echo ""
echo "To stop the application, run: ./stop.sh"
echo "=========================================="
