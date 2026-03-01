import api from './api'

export default {
  async getClientTags(clientId) {
    const { data } = await api.get(`/api/tags/${clientId}`)
    return data
  },

  async addTag(clientId, tagData) {
    const { data } = await api.post(`/api/tags/${clientId}`, tagData)
    return data
  },

  async updateTag(tagId, tagData) {
    const { data } = await api.put(`/api/tags/${tagId}`, tagData)
    return data
  },

  async deleteTag(tagId) {
    const { data } = await api.delete(`/api/tags/${tagId}`)
    return data
  },

  async getUserSettings() {
    const { data } = await api.get('/api/settings')
    return data
  },

  async updateSetting(key, value) {
    const { data } = await api.put(`/api/settings/${key}`, { value })
    return data
  }
}
