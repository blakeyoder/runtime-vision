#!/usr/bin/env node

/**
 * Standalone HTTP telemetry server for browser event capture
 * No MCP - just HTTP endpoints for ingestion and querying
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// In-memory event store: { session_id: [events...] }
const eventStore = {};

// Server configuration
const PORT = process.env.RUNTIME_VISION_PORT || 7358;
const HOST = '127.0.0.1';

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers for browser SDK
  const origin = req.headers.origin || 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /sdk - Serve the browser SDK
  if (req.method === 'GET' && req.url === '/sdk') {
    try {
      const sdkPath = path.join(__dirname, '../packages/browser-sdk/telemetry-sdk.js');
      const sdk = fs.readFileSync(sdkPath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache'
      });
      res.end(sdk);
      log('Served SDK');
    } catch (err) {
      log(`Error serving SDK: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Failed to load SDK' }));
    }
    return;
  }

  // POST /events - Ingest events
  if (req.method === 'POST' && req.url === '/events') {
    try {
      const body = await readBody(req);
      const event = JSON.parse(body);

      // Add timestamp if not present
      if (!event.ts) {
        event.ts = Date.now();
      }

      // Get or create session
      const sessionId = event.session || 'default';
      if (!eventStore[sessionId]) {
        eventStore[sessionId] = [];
      }

      // Store event
      eventStore[sessionId].push(event);

      // Keep only last 1000 events per session
      if (eventStore[sessionId].length > 1000) {
        eventStore[sessionId] = eventStore[sessionId].slice(-1000);
      }

      log(`Stored event: ${event.type} for session ${sessionId}`);

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'accepted',
        sessionEvents: eventStore[sessionId].length
      }));
    } catch (err) {
      log(`Error ingesting event: ${err.message}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // GET /context - Query events
  if (req.method === 'GET' && req.url.startsWith('/context')) {
    try {
      const params = parseQueryString(req.url);
      const sessionId = params.session;
      const since = params.since || '5m';
      const types = params.types ? params.types.split(',') : null;
      const limit = parseInt(params.limit) || 100;

      // Get events for session (or all sessions if not specified)
      let events = [];
      if (sessionId) {
        events = eventStore[sessionId] || [];
      } else {
        // Aggregate events from all sessions
        events = Object.values(eventStore).flat();
      }

      // Filter by time
      const sinceMs = parseTimeRange(since);
      const cutoff = Date.now() - sinceMs;
      events = events.filter(e => e.ts >= cutoff);

      // Filter by types
      if (types && types.length > 0) {
        events = events.filter(e => types.includes(e.type));
      }

      // Limit results
      events = events.slice(-limit);

      // Generate summaries
      const summaries = events.map(e => ({
        ts: e.ts,
        type: e.type,
        summary: generateSummary(e)
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        session: sessionId || 'all',
        count: events.length,
        summaries: summaries,
        events: events
      }, null, 2));
    } catch (err) {
      log(`Error querying context: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // GET /sessions - List active sessions
  if (req.method === 'GET' && req.url === '/sessions') {
    const sessions = Object.keys(eventStore).map(sessionId => ({
      sessionId,
      eventCount: eventStore[sessionId].length,
      lastEvent: eventStore[sessionId][eventStore[sessionId].length - 1]?.ts
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions }, null, 2));
    return;
  }

  // GET /health - Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      sessions: Object.keys(eventStore).length,
      totalEvents: Object.values(eventStore).reduce((sum, events) => sum + events.length, 0)
    }));
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'not-found', url: req.url }));
});

// Helper: Read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Helper: Parse query string
function parseQueryString(url) {
  const params = {};
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return params;

  const query = url.slice(queryStart + 1);
  query.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });

  return params;
}

// Helper: Parse time range (e.g., "5m" -> milliseconds)
function parseTimeRange(range) {
  const match = range.match(/^(\d+)([smhd])$/);
  if (!match) return 5 * 60 * 1000; // Default 5 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * units[unit];
}

// Helper: Generate event summary
function generateSummary(event) {
  switch (event.type) {
    case 'net':
      return `${event.data?.method || 'GET'} ${event.data?.url} → ${event.data?.status || '?'}`;
    case 'console':
      return `${event.data?.level || 'log'}: ${event.data?.message || ''}`.slice(0, 100);
    case 'error':
      return `${event.data?.message || 'Error'}`.slice(0, 100);
    default:
      return JSON.stringify(event.data || {}).slice(0, 100);
  }
}

// Helper: Log to stderr
function log(message) {
  const timestamp = new Date().toISOString();
  process.stderr.write(`[${timestamp}] ${message}\n`);
}

// Start server
server.listen(PORT, HOST, () => {
  log(`Telemetry server listening on http://${HOST}:${PORT}`);
  log(`Health check: http://${HOST}:${PORT}/health`);
  log(`Context API: http://${HOST}:${PORT}/context?session=SESSION&since=5m`);
});

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  log('Shutting down...');
  server.close(() => {
    log('Server stopped');
    process.exit(0);
  });

  // Force exit after 2 seconds
  setTimeout(() => {
    log('Forced exit');
    process.exit(1);
  }, 2000);
}
