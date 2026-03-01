import api from './api'

export default {
  async searchClients(params = {}, signal = null) {
    const config = { params }
    if (signal) config.signal = signal
    const { data } = await api.get('/api/clients', config)
    return data
  },

  async getClient(clientId) {
    const { data } = await api.get(`/api/clients/${clientId}`)
    return data
  },

  async getClientFlows(clientId, params = {}) {
    const { data } = await api.get(`/api/clients/${clientId}/flows`, { params })
    return data
  },

  async getClientMetadata(clientId) {
    const { data } = await api.get(`/api/clients/${clientId}/metadata`)
    return data
  },

  async setClientMetadata(clientId, metadata) {
    const { data } = await api.post(`/api/clients/${clientId}/metadata`, metadata)
    return data
  },

  async labelClients(clientIds, operation, labels) {
    const { data } = await api.post('/api/clients/label', {
      client_ids: clientIds,
      operation,
      labels
    })
    return data
  },

  async notifyClient(clientId) {
    const { data } = await api.post(`/api/clients/${clientId}/notify`)
    return data
  },

  async deleteClient(clientId) {
    const { data } = await api.delete(`/api/clients/${clientId}`)
    return data
  }
}
