#!/usr/bin/env bash

# Runtime Vision - Start telemetry server in background
# This script is called by SessionStart hook

set -e

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_PATH="$PLUGIN_ROOT/servers/http-server.js"
PID_FILE="$HOME/.claude/runtime-vision-server.pid"
LOG_FILE="$HOME/.claude/runtime-vision-server.log"

# Check if server is already running by PID file
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    # Server already running
    echo "Runtime Vision telemetry server already running (PID: $PID)"
    exit 0
  else
    # PID file exists but process is dead, clean up
    rm -f "$PID_FILE"
  fi
fi

# Check if port is already in use (server might be running without PID file)
# This handles cases where PID file was deleted but server is still running
if lsof -i :7357 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Runtime Vision telemetry server already running on port 7357"
  # Try to recover PID file for future checks
  RUNNING_PID=$(lsof -i :7357 -sTCP:LISTEN -t 2>/dev/null | head -1)
  if [ -n "$RUNNING_PID" ]; then
    echo "$RUNNING_PID" > "$PID_FILE"
    echo "✅ Recovered PID: $RUNNING_PID"
  fi
  exit 0
fi

# Check if server file exists
if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: Server not found at $SERVER_PATH" >&2
  exit 1
fi

# Start server in background, detached from this process
# Use nohup to prevent SIGHUP, redirect output to log file
nohup node "$SERVER_PATH" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID for cleanup
echo "$SERVER_PID" > "$PID_FILE"

# Give server a moment to start
sleep 1

# Verify server is running
if ps -p "$SERVER_PID" > /dev/null 2>&1; then
  echo "✅ Runtime Vision telemetry server started (PID: $SERVER_PID)"
  echo "   Server running at http://localhost:7357"
  echo "   Logs: $LOG_FILE"
  exit 0
else
  echo "❌ Failed to start Runtime Vision telemetry server" >&2
  rm -f "$PID_FILE"
  exit 1
fi
