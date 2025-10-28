/**
 * Claude Telemetry Browser SDK
 * Captures browser events and sends to telemetry server
 *
 * Usage:
 *   <script src="http://localhost:7357/sdk"></script>
 *   <script>
 *     ClaudeTelemetry.init({ session: 'my-session' });
 *   </script>
 */

(function(window) {
  'use strict';

  const ClaudeTelemetry = {
    config: {
      endpoint: 'http://localhost:7357/events',
      session: 'default',
      batchSize: 50,
      batchInterval: 1000,
      captureConsole: true,
      captureNetwork: true,
      captureErrors: true
    },

    eventQueue: [],
    originalFetch: null,
    originalXHR: null,
    originalConsole: {},
    flushTimer: null,

    init: function(options) {
      // Merge options
      Object.assign(this.config, options || {});

      // Start instrumentation
      if (this.config.captureNetwork) {
        this.patchFetch();
        this.patchXHR();
      }

      if (this.config.captureConsole) {
        this.patchConsole();
      }

      if (this.config.captureErrors) {
        this.captureErrors();
      }

      // Start batch timer
      this.startBatchTimer();

      console.log('[ClaudeTelemetry] Initialized for session:', this.config.session);
    },

    // Patch fetch API
    patchFetch: function() {
      const self = this;
      self.originalFetch = window.fetch;

      window.fetch = function(url, options) {
        const startTime = Date.now();
        const method = (options && options.method) || 'GET';

        return self.originalFetch.apply(this, arguments)
          .then(response => {
            const duration = Date.now() - startTime;

            self.captureEvent({
              type: 'net',
              data: {
                method: method,
                url: url.toString(),
                status: response.status,
                statusText: response.statusText,
                dur_ms: duration
              }
            });

            return response;
          })
          .catch(error => {
            const duration = Date.now() - startTime;

            self.captureEvent({
              type: 'net',
              data: {
                method: method,
                url: url.toString(),
                error: error.message,
                dur_ms: duration
              }
            });

            throw error;
          });
      };
    },

    // Patch XMLHttpRequest
    patchXHR: function() {
      const self = this;
      self.originalXHR = window.XMLHttpRequest;

      function PatchedXHR() {
        const xhr = new self.originalXHR();
        const startTime = Date.now();
        let method, url;

        // Intercept open
        const originalOpen = xhr.open;
        xhr.open = function(m, u) {
          method = m;
          url = u;
          return originalOpen.apply(this, arguments);
        };

        // Intercept load
        xhr.addEventListener('load', function() {
          const duration = Date.now() - startTime;

          self.captureEvent({
            type: 'net',
            data: {
              method: method,
              url: url,
              status: xhr.status,
              statusText: xhr.statusText,
              dur_ms: duration
            }
          });
        });

        // Intercept error
        xhr.addEventListener('error', function() {
          const duration = Date.now() - startTime;

          self.captureEvent({
            type: 'net',
            data: {
              method: method,
              url: url,
              error: 'Network error',
              dur_ms: duration
            }
          });
        });

        return xhr;
      }

      window.XMLHttpRequest = PatchedXHR;
    },

    // Patch console methods
    patchConsole: function() {
      const self = this;
      const methods = ['log', 'warn', 'error', 'info', 'debug'];

      methods.forEach(method => {
        self.originalConsole[method] = console[method];

        console[method] = function() {
          // Call original
          self.originalConsole[method].apply(console, arguments);

          // Capture event
          const args = Array.from(arguments);
          const message = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');

          self.captureEvent({
            type: 'console',
            data: {
              level: method,
              message: message.slice(0, 500) // Limit message length
            }
          });
        };
      });
    },

    // Capture errors
    captureErrors: function() {
      const self = this;

      window.addEventListener('error', function(event) {
        self.captureEvent({
          type: 'error',
          data: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error ? event.error.stack : null
          }
        });
      });

      window.addEventListener('unhandledrejection', function(event) {
        self.captureEvent({
          type: 'error',
          data: {
            message: 'Unhandled Promise Rejection: ' + event.reason,
            stack: event.reason && event.reason.stack ? event.reason.stack : null
          }
        });
      });
    },

    // Capture an event
    captureEvent: function(event) {
      event.ts = Date.now();
      event.session = this.config.session;
      event.v = 1;

      this.eventQueue.push(event);

      // Flush if batch size reached
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    },

    // Start batch timer
    startBatchTimer: function() {
      const self = this;

      this.flushTimer = setInterval(function() {
        if (self.eventQueue.length > 0) {
          self.flush();
        }
      }, this.config.batchInterval);
    },

    // Flush events to server
    flush: function() {
      if (this.eventQueue.length === 0) return;

      const events = this.eventQueue.splice(0, this.eventQueue.length);

      // Send each event separately for now (can optimize to batch later)
      events.forEach(event => {
        this.sendEvent(event);
      });
    },

    // Send single event to server
    sendEvent: function(event) {
      const self = this;

      // Use fetch for better CORS compatibility
      // Must call with window context
      self.originalFetch.call(window, this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function(err) {
        // Silently fail - don't want to disrupt app
        self.originalConsole.warn && self.originalConsole.warn('[ClaudeTelemetry] Failed to send event:', err);
      });
    },

    // Manual event capture
    capture: function(type, data) {
      this.captureEvent({
        type: type,
        data: data
      });
    }
  };

  // Expose globally
  window.ClaudeTelemetry = ClaudeTelemetry;

})(window);
