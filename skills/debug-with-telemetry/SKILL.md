---
name: debug-with-telemetry
description: Query runtime telemetry from browser sessions when debugging issues
---

# Debug with Telemetry

When the user reports an error, bug, unexpected behavior, or asks you to investigate/fix something:

## Step 1: Query Telemetry

Use the Bash tool to query recent browser events:

```bash
curl -s "http://localhost:7357/context?since=5m&types=net,console,error"
```

**Query parameters:**
- `since` - Time range: 1m, 5m, 10m, 1h (default: 5m)
- `types` - Event types: net,console,error (comma-separated)
- `session` - Specific session ID (optional, defaults to recent across all)
- `limit` - Max events to return (default: 100)

## Step 2: Analyze the Events

Look for patterns in the telemetry data:

1. **Network failures**: POST/GET requests with 4xx/5xx status codes
2. **Console errors**: Error or warning messages from the browser
3. **JavaScript errors**: Uncaught exceptions with stack traces
4. **Timing**: Sequence of events leading to the issue

The API returns JSON with:
- `summaries`: One-line descriptions of each event
- `events`: Full event details with timestamps

## Step 3: Correlate with Code

1. Read the relevant source files mentioned in errors
2. Cross-reference event timestamps to understand sequence
3. Identify root cause from the evidence

## Step 4: Propose Fix

Based on the telemetry evidence:
1. Explain what you found in the events
2. Show the specific event(s) that indicate the problem
3. Propose a code fix
4. Explain why this will resolve the issue

## Example Usage

**User:** "The checkout is failing"

**You should:**
1. Query telemetry: `curl -s "http://localhost:7357/context?since=5m&types=net,error"`
2. Look for events related to checkout
3. Find the failing request or error
4. Read the relevant code file
5. Propose a fix with evidence from the telemetry

## Important Notes

- Always query telemetry FIRST before guessing
- Use the actual event data as evidence in your response
- If no relevant events found, query with longer time range or check different session
- The telemetry server must be running on localhost:7357

## Time Ranges

Common time ranges:
- `since=1m` - Last minute (for just-happened issues)
- `since=5m` - Last 5 minutes (default, good for recent work)
- `since=10m` - Last 10 minutes
- `since=1h` - Last hour (for issues from earlier in the session)

## Event Types

- `net` - Network requests (fetch, XHR)
- `console` - Browser console messages (log, warn, error)
- `error` - JavaScript errors and exceptions
- `html` - HTML snapshots (if enabled)
- `action` - User interactions (if enabled)

Query multiple types with commas: `types=net,console,error`
