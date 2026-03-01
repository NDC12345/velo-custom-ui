import api from './api'

export default {
  async listDirectory(clientId, path = '/') {
    const { data } = await api.get(`/api/vfs/${clientId}`, {
      params: { path }
    })
    return data
  },

  async listDirectoryFiles(clientId, path = '/') {
    const { data } = await api.get(`/api/vfs/${clientId}/files`, {
      params: { path }
    })
    return data
  },

  async statFile(clientId, path) {
    const { data } = await api.get(`/api/vfs/${clientId}/stat`, {
      params: { path }
    })
    return data
  },

  async statDirectory(clientId, path) {
    const { data } = await api.get(`/api/vfs/${clientId}/stat-dir`, {
      params: { path }
    })
    return data
  },

  async statDownload(clientId, path) {
    const { data } = await api.get(`/api/vfs/${clientId}/stat-download`, {
      params: { path }
    })
    return data
  },

  async downloadFile(clientId, path, offset = 0, length = 1000000) {
    const { data } = await api.get(`/api/vfs/${clientId}/download`, {
      params: { path, offset, length }
    })
    return data
  },

  async triggerDownload(clientId, path) {
    const { data } = await api.post(`/api/vfs/${clientId}/download`, { path })
    return data
  },

  async refreshDirectory(clientId, path) {
    const { data } = await api.post(`/api/vfs/${clientId}/refresh`, { path })
    return data
  }
}
