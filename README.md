# Runtime Vision

**Real-time browser telemetry for Claude Code debugging.**

When bugs happen during development, Claude can see exactly what went wrong by querying browser events from your live session—no more guessing, no more manual debugging.

[![Version](https://img.shields.io/badge/version-0.2.0--beta-blue)](https://github.com/blakeyoder/runtime-vision)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Table of Contents

- [What This Does](#what-this-does)
- [The Problem It Solves](#the-problem-it-solves)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [What Gets Captured](#what-gets-captured)
- [Usage Examples](#usage-examples)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What This Does

This plugin gives Claude Code **instant context** about what's happening in your browser during development. When something breaks, Claude can query the last few minutes of browser events and diagnose issues with actual runtime data instead of guessing.

### Components

1. **HTTP Telemetry Server** - Collects and stores browser events
2. **Browser SDK** - Captures network requests, console logs, and errors
3. **Debug Skill** - Guides Claude through querying telemetry when debugging

---

## The Problem It Solves

### Before Claude Telemetry

**Traditional debugging workflow:**
1. Something breaks in browser
2. Open DevTools manually
3. Try to reproduce the issue
4. Check Network tab, Console, Sources
5. Read stack traces
6. Trace through code
7. Ask Claude to help (but without context)
8. Try a fix
9. Refresh and repeat

### After Claude Telemetry

**Telemetry-powered workflow:**
1. Something breaks
2. Ask Claude: "Can you fix this?"
3. Claude queries telemetry automatically
4. Claude sees the actual error, request, and stack trace
5. Claude proposes a fix with evidence
6. Done

### Real Example

**You:** "The checkout is failing with a 500 error"

**Claude automatically:**
1. Queries: `curl "http://localhost:7357/context?since=5m&types=net,error"`
2. Sees: `POST /api/checkout → 500` + `ValidationError: billing_zip required`
3. Reads: `src/api/checkout.ts:88`
4. Fixes: Adds billing_zip validation
5. Responds: "Fixed! The checkout was missing billing_zip validation at line 88."

**The key difference:** Claude has the actual runtime data instead of guessing from code alone.

---

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  Your App (localhost:3000)             │
│  Browser SDK captures events            │
└────────────┬────────────────────────────┘
             │ POST /events
             ▼
┌─────────────────────────────────────────┐
│  Telemetry Server (localhost:7357)     │
│  Stores events in-memory                │
└────────────┬────────────────────────────┘
             │ GET /context?since=5m
             ▼
┌─────────────────────────────────────────┐
│  Claude Code (debug-with-telemetry)    │
│  Queries → Analyzes → Fixes             │
└─────────────────────────────────────────┘
```

### The Plugin

**Purpose:** Package the telemetry server and skill for Claude Code

**Contains:**
- HTTP server for event collection
- Browser SDK for event capture
- Debug skill for Claude workflow

### The Skill

**Purpose:** Guide Claude through debugging with telemetry

**What it does:**
- Automatically queries recent browser events when you report bugs
- Analyzes network failures, console errors, and JavaScript exceptions
- Correlates events with source code
- Proposes fixes based on evidence

**When it activates:**
- User says: "fix the checkout error"
- User says: "I'm getting a 500"
- User says: "something's wrong with..."

---

## Quick Start

### Prerequisites

- Node.js 14+ installed
- A web application you're developing locally

### Installation

#### 1. Clone the repository

```bash
cd /path/to/your/projects
git clone https://github.com/blakeyoder/runtime-vision.git
cd runtime-vision
```

#### 2. Start the telemetry server

**The server starts automatically!** When you use Claude Code with this plugin, the telemetry server automatically starts in the background and stops when your session ends.

You can verify it's running:

```bash
curl http://localhost:7357/health
```

**Manual start (optional):**
If you need to start it manually, run:

```bash
node servers/http-server.js
```

#### 3. Add SDK to your app

Add this to your HTML (before closing `</body>` tag):

**For static HTML/vanilla JS:**
```html
<!-- Claude Telemetry SDK -->
<script src="http://localhost:7357/sdk"></script>
<script>
  ClaudeTelemetry.init({
    session: 'my-app-' + Date.now()
  });
</script>
```

**For Next.js (app/layout.tsx):**
```tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Claude Telemetry SDK */}
        <Script
          src="http://localhost:7357/sdk"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && (window as any).ClaudeTelemetry) {
              (window as any).ClaudeTelemetry.init({
                session: 'my-app-' + Date.now()
              });
            }
          }}
        />
        {children}
      </body>
    </html>
  );
}
```

**For React/Vite (index.html):**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>

    <!-- Claude Telemetry SDK -->
    <script src="http://localhost:7357/sdk"></script>
    <script>
      ClaudeTelemetry.init({ session: 'my-app-dev' });
    </script>

    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### 4. Verify it's working

Open your app in a browser. The telemetry server should already be running (it starts automatically when you use Claude Code).

Check that events are being captured:

```bash
curl "http://localhost:7357/context?since=1m" | jq .count
```

If you see a number > 0, events are being captured! 🎉

#### 5. Use it with Claude

In Claude Code, just describe bugs naturally:

```
"The login form is throwing an error"
"The API is returning 500"
"Something's broken on the checkout page"
```

Claude will automatically query the telemetry and debug with real data.

---

## What Gets Captured

The Browser SDK captures events from your live development session and streams them to the telemetry server.

### Network Requests

**All HTTP requests made by JavaScript:**

- `fetch()` calls
- `XMLHttpRequest` (XHR)
- AJAX from libraries (Axios, jQuery, etc.)

**Captured data:**
```json
{
  "type": "net",
  "ts": 1761612632029,
  "session": "my-app-1234",
  "data": {
    "method": "POST",
    "url": "/api/checkout",
    "status": 500,
    "statusText": "Internal Server Error",
    "dur_ms": 234
  }
}
```

**What's NOT captured:**
- Request/response bodies (privacy)
- Authentication tokens
- Form data
- Only URL, method, status, and timing

### Console Logs

**All console output:**

- `console.log()`
- `console.warn()`
- `console.error()`
- `console.info()`
- `console.debug()`

**Captured data:**
```json
{
  "type": "console",
  "ts": 1761612632039,
  "session": "my-app-1234",
  "data": {
    "level": "error",
    "message": "ValidationError: billing_zip is required"
  }
}
```

**Note:** Messages are truncated to 500 characters to prevent memory bloat.

### JavaScript Errors

**All uncaught exceptions:**

- Runtime errors (`TypeError`, `ReferenceError`, etc.)
- Unhandled promise rejections
- Global error events

**Captured data:**
```json
{
  "type": "error",
  "ts": 1761612632048,
  "session": "my-app-1234",
  "data": {
    "message": "Uncaught TypeError: Cannot read property 'total' of undefined",
    "filename": "checkout.js",
    "lineno": 88,
    "colno": 15,
    "stack": "TypeError: Cannot read property 'total' of undefined\n  at checkout.js:88:15\n  at processOrder (checkout.js:42:5)"
  }
}
```

### Custom Events

**Manual tracking (optional):**

```javascript
ClaudeTelemetry.capture('custom', {
  action: 'checkout_started',
  cart_total: 99.99,
  items: 3
});
```

**Captured data:**
```json
{
  "type": "custom",
  "ts": 1761612632050,
  "session": "my-app-1234",
  "data": {
    "action": "checkout_started",
    "cart_total": 99.99,
    "items": 3
  }
}
```

### Event Lifecycle

1. **Capture** - SDK intercepts browser APIs and creates events
2. **Queue** - Events stored in memory (batch size: 50, interval: 1000ms)
3. **Transmit** - Batches sent via `fetch()` to `POST /events`
4. **Store** - Server keeps last 1000 events per session in memory
5. **Query** - Claude retrieves via `GET /context?since=5m`

---

## Usage Examples

### Daily Development Workflow

**The telemetry server starts automatically when you start a Claude Code session!**

```bash
# Just start your app
npm run dev
```

Now browse your app normally. When something breaks, switch to Claude Code and ask for help:

**Note:** The server runs in the background and automatically stops when your Claude Code session ends. You don't need to manage it manually!

### Example 1: API Error

**You:** "The products page is showing a 500 error"

**Claude:**
1. Queries: `curl "http://localhost:7357/context?since=5m&types=net,error"`
2. Finds: `GET /api/products → 500` at 14:32:15
3. Sees: `TypeError: Cannot read property 'map' of undefined` at products.tsx:42
4. Reads: `src/pages/products.tsx`
5. Identifies: Missing null check on API response
6. Fixes: Adds `products?.map()` with fallback

### Example 2: Form Validation

**You:** "The checkout form isn't submitting"

**Claude:**
1. Queries telemetry for recent errors
2. Finds: `ValidationError: billing_zip is required`
3. Traces to: `src/components/CheckoutForm.tsx:88`
4. Adds: Billing zip field validation
5. Updates: Form schema

### Example 3: Performance Issue

**You:** "The dashboard is really slow"

**Claude:**
1. Queries: `curl "http://localhost:7357/context?since=5m&types=net"`
2. Analyzes: Request durations
3. Finds: `GET /api/dashboard/stats → 200 (8234ms)` - Very slow!
4. Suggests: Add caching, optimize query, or implement pagination

---

## Architecture

### Components

#### HTTP Telemetry Server (`servers/http-server.js`)

**Purpose:** Collect and serve browser events

**Lifecycle:**
- ✅ **Auto-starts** when you start a Claude Code session
- ✅ **Auto-stops** when your session ends
- Runs in the background (no terminal required)
- PID tracked in `~/.claude/runtime-vision-server.pid`

**Endpoints:**
- `POST /events` - Ingest events from browser SDK
- `GET /sdk` - Serve the browser SDK JavaScript
- `GET /context` - Query events (with filters)
- `GET /sessions` - List active sessions
- `GET /health` - Health check

**Storage:**
- In-memory (resets on restart)
- Per-session isolation
- 1000 event limit per session (rolling window)

**CORS:**
- Enabled for all origins
- Supports localhost development

#### Browser SDK (`packages/browser-sdk/telemetry-sdk.js`)

**Purpose:** Capture browser events

**Architecture:**
- IIFE (Immediately Invoked Function Expression)
- Exposes: `window.ClaudeTelemetry`
- Size: ~8KB unminified
- Zero dependencies

**Instrumentation:**
- Patches `window.fetch` (preserves original)
- Patches `XMLHttpRequest` (preserves original)
- Patches `console.*` methods (preserves original)
- Registers `window.onerror` handler
- Registers `window.onunhandledrejection` handler

**Transmission:**
- Batches events (default: 50 events or 1000ms)
- Uses `fetch()` with `keepalive` and `mode: cors`
- Silent failures (doesn't disrupt app)

#### Debug Skill (`skills/debug-with-telemetry/skill.md`)

**Purpose:** Guide Claude through debugging workflow

**Workflow:**
1. **Query** - Fetch recent events via curl
2. **Analyze** - Identify patterns (failures, errors, timing)
3. **Correlate** - Match events to source code
4. **Fix** - Propose solution with evidence

**Parameters:**
- `since` - Time range (1m, 5m, 10m, 1h)
- `types` - Event filters (net, console, error)
- `session` - Specific session ID
- `limit` - Max events to return

---

## Configuration

### Server Configuration

Edit `servers/http-server.js`:

```javascript
const PORT = 7357;  // Change server port
const HOST = '127.0.0.1';  // Change host
```

### SDK Configuration

When initializing:

```javascript
ClaudeTelemetry.init({
  // Required
  session: 'unique-session-id',  // Identifies this session

  // Optional
  endpoint: 'http://localhost:7357/events',  // Server URL
  batchSize: 50,                  // Events before auto-flush
  batchInterval: 1000,            // Flush interval (ms)
  captureConsole: true,           // Capture console logs
  captureNetwork: true,           // Capture network requests
  captureErrors: true             // Capture JS errors
});
```

### Session Management

**Single developer:**
```javascript
session: 'dev-session-' + Date.now()
```

**Team development:**
```javascript
session: 'blake-dev-' + Date.now()
session: 'jane-dev-' + Date.now()
```

**Feature-based:**
```javascript
session: 'checkout-feature-' + Date.now()
session: 'auth-refactor-' + Date.now()
```

---

## Troubleshooting

### SDK Not Loading

**Error:** `Failed to load resource: http://localhost:7357/sdk`

**Solution:** Make sure telemetry server is running:
```bash
node servers/http-server.js
```

### No Events Captured

**Check 1:** Is SDK initialized?

Open browser console:
```javascript
ClaudeTelemetry
// Should show SDK object, not undefined
```

**Check 2:** Are events queued?

```javascript
ClaudeTelemetry.eventQueue.length
// Should be > 0 after browsing
```

**Check 3:** Can SDK reach server?

Check browser Network tab for POST requests to `http://localhost:7357/events`

### CORS Errors

**Error:** `Cross-Origin Request Blocked`

**Solution:** Server has CORS enabled, but check:
1. Server is running on correct port (7357)
2. No firewall blocking localhost
3. Browser isn't blocking mixed content (HTTP/HTTPS)

### Events Not Showing in Claude

**Check:** Query manually:
```bash
curl "http://localhost:7357/context?since=5m" | jq
```

If empty:
- Events aren't reaching server
- Wrong session ID
- Events expired (>5 minutes old)

**Check server logs** for POST /events requests

### Next.js Specific Issues

**Issue:** SDK loads but doesn't initialize

**Solution:** Use `onLoad` callback:
```tsx
<Script
  src="http://localhost:7357/sdk"
  strategy="afterInteractive"
  onLoad={() => {
    if (typeof window !== 'undefined' && (window as any).ClaudeTelemetry) {
      (window as any).ClaudeTelemetry.init({ session: 'my-session' });
    }
  }}
/>
```

---

## Privacy & Security

### What's Collected

✅ **Collected:**
- Network request URLs, methods, status codes, timing
- Console log messages
- Error messages and stack traces
- Timestamps and session IDs

❌ **NOT Collected:**
- Request/response bodies
- Form data
- Authentication tokens
- Passwords or sensitive data
- Personal information

### Data Storage

- **In-memory only** - Events lost on server restart
- **No persistence** - No database, no files
- **Local only** - Never leaves your machine
- **Session isolated** - Events separated by session ID

### Retention

- **1000 events per session** - Older events auto-deleted
- **Manual cleanup** - Restart server to clear all data

### Production Use

⚠️ **This is a development tool only!**

Do NOT use in production:
- No authentication
- No encryption
- No access control
- Localhost only

---

## Contributing

Contributions welcome! This is a POC (Proof of Concept) with room for improvement.

### Areas for Enhancement

1. **Persistent storage** - Database or file-based
2. **HTML snapshots** - DOM state capture
3. **User actions** - Click/scroll/input tracking
4. **Performance metrics** - Core Web Vitals
5. **Session replay** - Full interaction recording
6. **TypeScript** - Type definitions
7. **Testing** - Automated tests
8. **Browser extension** - Alternative to SDK injection

### Development Setup

```bash
git clone https://github.com/blakeyoder/runtime-vision.git
cd runtime-vision

# Start server
node servers/http-server.js

# Test with demo page
open packages/browser-sdk/test.html
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## Roadmap

### Phase 1: POC ✅ (Current)
- ✅ Basic event capture (network, console, errors)
- ✅ HTTP telemetry server
- ✅ Claude skill integration
- ✅ Next.js compatibility

### Phase 2: Polish (Next)
- [ ] Persistent storage
- [ ] Session management UI
- [ ] Health monitoring
- [ ] Auto-start server
- [ ] TypeScript definitions

### Phase 3: Advanced Features
- [ ] HTML snapshots
- [ ] User action tracking
- [ ] Session replay
- [ ] Performance metrics
- [ ] Browser extension

### Phase 4: Production Ready
- [ ] Authentication
- [ ] Encryption
- [ ] Multi-user support
- [ ] Cloud deployment option
- [ ] NPM package

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Author

**Blake Yoder**
- Email: me@blakeyoder.com
- GitHub: [@BerryStreetEngineering](https://github.com/BerryStreetEngineering)

---

## Acknowledgments

Built for [Claude Code](https://claude.com/claude-code) by Anthropic.

Inspired by the need for better debugging workflows in modern web development.

---

**Questions or issues?** Open an issue on [GitHub](https://github.com/blakeyoder/runtime-vision/issues) or email me@blakeyoder.com
