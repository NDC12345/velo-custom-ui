import api from './api'

export default {
  async getHunts(params = {}) {
    const { data } = await api.get('/api/hunts', { params })
    return data
  },

  async getHunt(huntId) {
    const { data } = await api.get(`/api/hunts/${huntId}`)
    return data
  },

  async createHunt(huntData) {
    const { data } = await api.post('/api/hunts', huntData)
    return data
  },

  async estimateHunt(huntData) {
    const { data } = await api.post('/api/hunts/estimate', huntData)
    return data
  },

  async modifyHunt(huntId, modification) {
    const { data } = await api.patch(`/api/hunts/${huntId}`, modification)
    return data
  },

  async deleteHunt(huntId) {
    const { data } = await api.delete(`/api/hunts/${huntId}`)
    return data
  },

  async getHuntResults(huntId, params = {}) {
    const { data } = await api.get(`/api/hunts/${huntId}/results`, { params })
    return data
  },

  async getHuntStats(huntId) {
    const { data } = await api.get(`/api/hunts/${huntId}/stats`)
    return data
  },

  async getHuntFlows(huntId, params = {}) {
    const { data } = await api.get(`/api/hunts/${huntId}/flows`, { params })
    return data
  },

  async getHuntTags(huntId) {
    const { data } = await api.get(`/api/hunts/${huntId}/tags`)
    return data
  }
}
