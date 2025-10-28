# Runtime Vision - Quick Start Guide

**Real-time browser telemetry for Claude Code debugging in 5 minutes.**

## Installation

### 1. Install the Plugin

The plugin is available in the Claude Code marketplace. To install:

```bash
# In Claude Code
/plugins install runtime-vision
```

Or install manually from the marketplace directory.

### 2. Verify Server is Running

The telemetry server **starts automatically** when you launch Claude Code with this plugin. Verify it's running:

```bash
curl http://localhost:7357/health
```

You should see:
```json
{"status":"ok","uptime":12.3,"sessions":0,"totalEvents":0}
```

### 3. Add SDK to Your Browser App

**Choose your setup:**

#### Vanilla HTML/JavaScript
Add before closing `</body>`:
```html
<script src="http://localhost:7357/sdk"></script>
<script>
  ClaudeTelemetry.init({ session: 'my-app-' + Date.now() });
</script>
```

#### Next.js (app/layout.tsx)
```tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Script
          src="http://localhost:7357/sdk"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && (window as any).ClaudeTelemetry) {
              (window as any).ClaudeTelemetry.init({ session: 'dev-' + Date.now() });
            }
          }}
        />
        {children}
      </body>
    </html>
  );
}
```

#### React/Vite (index.html)
Add before closing `</body>`:
```html
<script src="http://localhost:7357/sdk"></script>
<script>
  ClaudeTelemetry.init({ session: 'dev-' + Date.now() });
</script>
```

#### Vue (index.html or App.vue)
Add to `index.html` or use `useHead()` in `App.vue`:
```html
<script src="http://localhost:7357/sdk"></script>
<script>
  ClaudeTelemetry.init({ session: 'dev-' + Date.now() });
</script>
```

### 4. Test It

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Open in browser** and interact with your app

3. **Check events are captured:**
   ```bash
   curl "http://localhost:7357/context?since=1m" | jq .count
   ```

   If you see a number > 0, it's working! 🎉

## Using with Claude

Just describe bugs naturally in Claude Code:

```
"The login is throwing a 500 error"
"Something broke on the checkout page"
"The API request is failing"
```

Claude will automatically:
1. Query the telemetry server
2. Analyze recent browser events
3. Find the error with context
4. Propose a fix with evidence

## Configuration

### Custom Port

Set the `RUNTIME_VISION_PORT` environment variable:

```bash
export RUNTIME_VISION_PORT=8888
```

Then update your SDK endpoint:
```javascript
ClaudeTelemetry.init({
  session: 'my-session',
  endpoint: 'http://localhost:8888/events'
});
```

### SDK Options

```javascript
ClaudeTelemetry.init({
  session: 'my-session',           // Required: unique session ID
  endpoint: 'http://localhost:7357/events',  // Optional: server URL
  batchSize: 50,                   // Optional: events before flush
  batchInterval: 1000,             // Optional: flush interval (ms)
  captureConsole: true,            // Optional: capture console logs
  captureNetwork: true,            // Optional: capture network requests
  captureErrors: true              // Optional: capture JS errors
});
```

## Troubleshooting

### Server Not Starting

Check the startup hook logs:
```bash
cat ~/.claude/runtime-vision-server.log
```

If port conflict, change the port:
```bash
export RUNTIME_VISION_PORT=8888
```

### SDK Not Loading

1. Check server is running: `curl http://localhost:7357/health`
2. Check browser console for errors
3. Verify CORS (should work automatically for localhost)

### No Events Captured

1. Check SDK is loaded in browser:
   ```javascript
   console.log(ClaudeTelemetry);  // Should not be undefined
   ```

2. Check events are queued:
   ```javascript
   console.log(ClaudeTelemetry.eventQueue.length);  // Should be > 0
   ```

3. Check network requests to `/events` in browser DevTools

### Events Not Showing in Claude

Query manually to test:
```bash
curl "http://localhost:7357/context?since=5m&types=net,error" | jq
```

If empty:
- Wait a moment and try again (batching delay)
- Check session ID matches
- Ensure events are recent (<5 minutes)

## What Gets Captured

✅ **Captured:**
- Network request URLs, methods, status codes, timing
- Console logs (log, warn, error, info, debug)
- JavaScript errors and stack traces
- Custom events you send

❌ **NOT Captured:**
- Request/response bodies
- Form data or passwords
- Authentication tokens
- Personal information

All data stays **local** and **in-memory** (no database, no persistence).

## Need More Help?

- Full documentation: [README.md](README.md)
- Report issues: https://github.com/blakeyoder/runtime-vision/issues
- Email: me@blakeyoder.com

---

**That's it!** You're ready to debug with real-time browser telemetry. 🚀
