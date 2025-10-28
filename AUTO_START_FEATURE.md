# Auto-Start Server Feature

## Overview

The Runtime Vision plugin now **automatically starts and stops the telemetry server** using Claude Code session hooks. Users no longer need to manually start the server!

## How It Works

### Session Lifecycle Integration

```
Claude Code Session Start
         ↓
SessionStart Hook Triggers
         ↓
scripts/start-server.sh Executes
         ↓
Server Starts in Background (nohup)
         ↓
PID Saved to ~/.claude/runtime-vision-server.pid
         ↓
Server Runs (http://localhost:7357)
         ↓
User Works with Claude & Browser App
         ↓
Claude Code Session End
         ↓
SessionEnd Hook Triggers
         ↓
scripts/stop-server.sh Executes
         ↓
Server Gracefully Stopped
         ↓
PID File Cleaned Up
```

## Implementation Details

### 1. Hooks Configuration (`hooks/hooks.json`)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/start-server.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/stop-server.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Key Points:**
- Uses `${CLAUDE_PLUGIN_ROOT}` variable for portable paths
- SessionStart timeout: 30 seconds (enough time to start server)
- SessionEnd timeout: 10 seconds (enough time to stop gracefully)
- Matcher: `*` (runs for all session starts/ends)

### 2. Start Server Script (`scripts/start-server.sh`)

**Responsibilities:**
1. Check if server is already running (via PID file)
2. Validate server file exists
3. Start server using `nohup` (background, detached from hook)
4. Save PID to `~/.claude/runtime-vision-server.pid`
5. Wait 1 second and verify server started
6. Report success or failure

**Key Features:**
- **Idempotent:** Won't start duplicate servers
- **Background execution:** Uses `nohup` to prevent SIGHUP
- **Logging:** Output redirected to `~/.claude/runtime-vision-server.log`
- **PID tracking:** Saves process ID for cleanup
- **Verification:** Checks if process is actually running

**Exit codes:**
- `0` - Success (server started or already running)
- `1` - Failure (server file not found or failed to start)

### 3. Stop Server Script (`scripts/stop-server.sh`)

**Responsibilities:**
1. Check if PID file exists
2. Read PID from file
3. Check if process is still running
4. Send SIGTERM (graceful shutdown)
5. Wait up to 5 seconds for shutdown
6. Force kill (SIGKILL) if still running
7. Clean up PID file

**Key Features:**
- **Graceful shutdown:** Tries SIGTERM first
- **Fallback:** Uses SIGKILL after timeout
- **Safe:** Handles missing PID file or dead process
- **Cleanup:** Always removes PID file

**Exit codes:**
- `0` - Always (can't block session end)

### 4. Plugin Configuration (`plugin.json`)

```json
{
  "name": "runtime-vision",
  "version": "0.2.0-beta",
  "description": "Real-time browser telemetry for Claude Code debugging",
  "author": {
    "name": "Blake Yoder",
    "email": "me@blakeyoder.com"
  },
  "repository": "https://github.com/blakeyoder/runtime-vision",
  "hooks": "./hooks/hooks.json"
}
```

**Key Addition:**
- `"hooks": "./hooks/hooks.json"` - References hook configuration

## File Locations

### Plugin Files
- `hooks/hooks.json` - Hook definitions
- `scripts/start-server.sh` - Start server script (executable)
- `scripts/stop-server.sh` - Stop server script (executable)
- `.claude-plugin/plugin.json` - Plugin manifest (references hooks)

### User Files (Created at Runtime)
- `~/.claude/runtime-vision-server.pid` - Process ID
- `~/.claude/runtime-vision-server.log` - Server output log

## User Experience

### Before (Manual Start)

```bash
# Terminal 1: Start server manually
node servers/http-server.js
# Keep this terminal open...

# Terminal 2: Start app
npm run dev

# Terminal 3: Use Claude Code
claude
```

### After (Auto-Start)

```bash
# Just start your app
npm run dev

# Use Claude Code - server starts automatically!
claude
```

## Benefits

1. **Zero Configuration** - Server starts automatically, no user action needed
2. **Clean Lifecycle** - Server stops when session ends, no orphan processes
3. **No Terminal** - Server runs in background, no dedicated terminal required
4. **Reliable** - PID tracking ensures proper cleanup
5. **Transparent** - Logs available at `~/.claude/runtime-vision-server.log`
6. **Idempotent** - Won't start duplicate servers if already running

## Troubleshooting

### Check if Server is Running

```bash
# Via health endpoint
curl http://localhost:7357/health

# Via PID file
cat ~/.claude/runtime-vision-server.pid
ps -p $(cat ~/.claude/runtime-vision-server.pid)

# Via port
lsof -ti:7357
```

### View Server Logs

```bash
tail -f ~/.claude/runtime-vision-server.log
```

### Manually Stop Server

```bash
# Via stop script
bash ~/.claude/plugins/runtime-vision/scripts/stop-server.sh

# Via kill
kill $(cat ~/.claude/runtime-vision-server.pid)

# Force kill
kill -9 $(cat ~/.claude/runtime-vision-server.pid)
```

### Manually Start Server

```bash
# Via start script
bash ~/.claude/plugins/runtime-vision/scripts/start-server.sh

# Direct
node ~/.claude/plugins/runtime-vision/servers/http-server.js
```

### Clean Up Stale State

```bash
# Remove PID and log files
rm -f ~/.claude/runtime-vision-server.pid ~/.claude/runtime-vision-server.log

# Kill any process on port 7357
lsof -ti:7357 | xargs kill -9
```

## Testing

### Test Start Script

```bash
# Set CLAUDE_PLUGIN_ROOT
export CLAUDE_PLUGIN_ROOT=/path/to/runtime-vision

# Run start script
bash scripts/start-server.sh

# Should see:
# ✅ Runtime Vision telemetry server started (PID: XXXXX)
#    Server running at http://localhost:7357
#    Logs: /Users/you/.claude/runtime-vision-server.log

# Verify
curl http://localhost:7357/health
```

### Test Stop Script

```bash
# Run stop script
bash scripts/stop-server.sh

# Should see:
# Runtime Vision telemetry server stopped

# Verify
curl http://localhost:7357/health
# Should fail with connection refused
```

### Test Idempotency

```bash
# Start twice
bash scripts/start-server.sh
bash scripts/start-server.sh

# Should see "already running" message second time
# Only one server process should exist
ps aux | grep http-server.js | grep -v grep
```

## Environment Variables

### Available in Hooks

- `CLAUDE_PLUGIN_ROOT` - Absolute path to plugin root directory
- `CLAUDE_PROJECT_DIR` - Absolute path to current project
- `CLAUDE_ENV_FILE` - File for persisting environment variables

### Used by Scripts

- `CLAUDE_PLUGIN_ROOT` - Used to locate server and create absolute paths
- Standard shell variables (`HOME`, `PATH`, etc.)

## Security Considerations

1. **PID File Location:** `~/.claude/` directory (user-only access)
2. **Log File Location:** `~/.claude/` directory (user-only access)
3. **Server Binding:** `127.0.0.1` only (localhost, not network-accessible)
4. **Process Ownership:** Runs as current user
5. **No Sudo Required:** No elevated privileges needed

## Future Enhancements

Potential improvements:

1. **Configurable Port** - Allow users to specify port via env var
2. **Multiple Sessions** - Support multiple concurrent sessions
3. **Health Monitoring** - Restart server if it crashes
4. **Server Options** - Pass configuration via environment variables
5. **Debug Mode** - Verbose logging option
6. **Systemd Integration** - Optional systemd service for Linux

## Compatibility

- **macOS:** ✅ Full support (tested)
- **Linux:** ✅ Should work (nohup, ps, kill are standard)
- **Windows:** ⚠️ May need WSL or Git Bash (uses Bash scripts)

## Summary

The auto-start feature makes Runtime Vision **truly seamless**:

- No manual server management
- No dedicated terminal
- No orphan processes
- Clean lifecycle integration with Claude Code

Users can focus on coding while the plugin handles the infrastructure!
