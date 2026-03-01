import api from './api'

export default {
  async collectArtifact(collectionData) {
    const { data } = await api.post('/api/flows/collect', collectionData)
    return data
  },

  async getFlow(flowId, clientId) {
    const { data } = await api.get(`/api/flows/${flowId}`, {
      params: { client_id: clientId }
    })
    return data
  },

  async getFlowResults(flowId, clientId, params = {}) {
    const { data } = await api.get(`/api/flows/${flowId}/results`, {
      params: { client_id: clientId, ...params }
    })
    return data
  },

  async getFlowRequests(flowId, clientId) {
    const { data } = await api.get(`/api/flows/${flowId}/requests`, {
      params: { client_id: clientId }
    })
    return data
  },

  async cancelFlow(flowId, clientId) {
    const { data } = await api.post(`/api/flows/${flowId}/cancel`, {
      client_id: clientId
    })
    return data
  },

  async resumeFlow(flowId, clientId) {
    const { data } = await api.post(`/api/flows/${flowId}/resume`, {
      client_id: clientId
    })
    return data
  },

  async archiveFlow(flowId, clientId) {
    const { data } = await api.post(`/api/flows/${flowId}/archive`, {
      client_id: clientId
    })
    return data
  }
}
