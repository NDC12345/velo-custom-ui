/**
 * SSE (Server-Sent Events) Service
 *
 * Provides real-time event streaming from the backend.
 * Supports auto-reconnect, channel subscription, and event handlers.
 */

class SSEService {
  constructor() {
    /** @type {EventSource|null} */
    this.eventSource = null
    /** @type {Map<string, Set<Function>>} */
    this.handlers = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 2000
    this.connected = false
  }

  /**
   * Connect to the SSE event stream
   * @param {string[]} channels - Channels to subscribe to
   */
  connect(channels = ['notifications', 'client-status', 'hunt-progress', 'flow-status']) {
    if (this.eventSource) {
      this.disconnect()
    }

    const channelParam = channels.join(',')
    const url = `/api/sse/events?channels=${encodeURIComponent(channelParam)}`

    this.eventSource = new EventSource(url, { withCredentials: true })

    this.eventSource.addEventListener('connected', (e) => {
      this.connected = true
      this.reconnectAttempts = 0
      console.log('[SSE] Connected:', JSON.parse(e.data))
      this._emit('connected', JSON.parse(e.data))
    })

    // Register for specific event types
    const eventTypes = [
      'client-online', 'client-offline',
      'hunt-started', 'hunt-progress', 'hunt-completed',
      'flow-started', 'flow-completed', 'flow-error',
      'server-alert', 'notification',
      'row', 'status', 'progress', 'complete', 'error',
    ]

    for (const type of eventTypes) {
      this.eventSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data)
          this._emit(type, data)
        } catch (err) {
          console.warn(`[SSE] Failed to parse ${type} event:`, err)
        }
      })
    }

    this.eventSource.onerror = () => {
      this.connected = false
      console.warn('[SSE] Connection error, attempting reconnect...')
      this._emit('disconnected', {})
      this._reconnect(channels)
    }
  }

  /**
   * Disconnect from the SSE stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.connected = false
    this.reconnectAttempts = 0
  }

  /**
   * Subscribe to an event type
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event).add(handler)

    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  /**
   * Unsubscribe from an event type
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    this.handlers.get(event)?.delete(handler)
  }

  /**
   * Stream VQL query results via SSE
   * @param {string} vql - VQL query
   * @param {Object} callbacks - { onRow, onStatus, onProgress, onComplete, onError }
   * @returns {Function} Cancel function
   */
  streamVQL(vql, callbacks = {}) {
    // Use fetch for POST-based SSE (EventSource only supports GET)
    const controller = new AbortController()

    fetch('/api/sse/vql-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vql }),
      signal: controller.signal,
      credentials: 'include',
    }).then(async (response) => {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (currentEvent) {
                case 'row': callbacks.onRow?.(data); break
                case 'status': callbacks.onStatus?.(data); break
                case 'progress': callbacks.onProgress?.(data); break
                case 'complete': callbacks.onComplete?.(data); break
                case 'error': callbacks.onError?.(data); break
              }
            } catch (e) {
              // Skip malformed data
            }
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.({ message: err.message })
      }
    })

    // Return cancel function
    return () => controller.abort()
  }

  /** @private */
  _emit(event, data) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (err) {
          console.error(`[SSE] Handler error for ${event}:`, err)
        }
      }
    }
  }

  /** @private */
  _reconnect(channels) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      this._emit('error', { message: 'Max reconnect attempts reached' })
      return
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts)
    this.reconnectAttempts++

    setTimeout(() => {
      console.log(`[SSE] Reconnect attempt ${this.reconnectAttempts}...`)
      this.connect(channels)
    }, delay)
  }
}

export default new SSEService()
