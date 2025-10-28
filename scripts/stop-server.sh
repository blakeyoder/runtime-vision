#!/usr/bin/env bash

# Runtime Vision - Stop telemetry server
# This script is called by SessionEnd hook

set -e

PID_FILE="$HOME/.claude/runtime-vision-server.pid"
LOG_FILE="$HOME/.claude/runtime-vision-server.log"

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
  # No PID file, server not running (or wasn't started by hook)
  exit 0
fi

# Read PID
PID=$(cat "$PID_FILE")

# Check if process is running
if ! ps -p "$PID" > /dev/null 2>&1; then
  # Process not running, just clean up PID file
  rm -f "$PID_FILE"
  exit 0
fi

# Kill the process
kill "$PID" 2>/dev/null || true

# Wait up to 5 seconds for graceful shutdown
for i in {1..10}; do
  if ! ps -p "$PID" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Force kill if still running
if ps -p "$PID" > /dev/null 2>&1; then
  kill -9 "$PID" 2>/dev/null || true
fi

# Clean up PID file
rm -f "$PID_FILE"

echo "Runtime Vision telemetry server stopped"
exit 0
