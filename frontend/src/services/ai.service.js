import api from './api'

/**
 * AI service for chat, automation, and provider management
 */
export default {
  // ── Chat ──────────────────────────────────────────────────
  async chat(message, options = {}) {
    try {
      const payload = { message }
      if (options.context) payload.context = options.context
      const response = await api.post('/api/ai/chat', payload)
      return response.data
    } catch (error) {
      console.error('AI chat error:', error)
      throw error
    }
  },

  async analyzeVQL(vql) {
    const response = await api.post('/api/ai/analyze-vql', { vql })
    return response.data
  },

  async suggestArtifacts(description) {
    const response = await api.post('/api/ai/suggest-artifacts', { description })
    return response.data
  },

  async getStatus() {
    const response = await api.get('/api/ai/status')
    return response.data
  },

  async clearHistory() {
    const response = await api.delete('/api/ai/chat/history')
    return response.data
  },

  // ── Provider management ───────────────────────────────────
  async getProviders() {
    const response = await api.get('/api/ai/providers')
    return response.data
  },

  async getProviderConfig() {
    const response = await api.get('/api/ai/provider')
    return response.data
  },

  async saveProviderConfig(config) {
    const response = await api.put('/api/ai/provider', config)
    return response.data
  },

  async testProvider(config) {
    const response = await api.post('/api/ai/provider/test', config)
    return response.data
  },

  async listModels(config) {
    const response = await api.post('/api/ai/provider/models', {
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    })
    return response.data
  },
}
