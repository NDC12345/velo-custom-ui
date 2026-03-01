import api from './api'

export default {
  async getNotebooks(params = {}) {
    try {
      const { data } = await api.get('/api/notebooks', { params })
      return data
    } catch (err) {
      // Some Velociraptor instances require a NotebookId on GET /api/notebooks
      // (older/newer API variants). Treat that response as "no notebooks" so
      // the UI can continue to function instead of showing an error.
      if (err?.response?.data && typeof err.response.data === 'object') {
        const errMsg = err.response.data.error || err.response.data.message || ''
        if (errMsg.includes('NotebookId') || errMsg.includes('NotebookId must be specified')) {
          // return empty shape expected by the UI
          console.warn('Velociraptor API requires NotebookId; treating as empty list')
          return { items: [] }
        }
      }
      throw err
    }
  },

  async getNotebook(notebookId) {
    const { data } = await api.get(`/api/notebooks/${notebookId}`)
    return data
  },

  async createNotebook(notebookData) {
    const { data } = await api.post('/api/notebooks', notebookData)
    return data
  },

  async updateNotebook(notebookId, notebookData) {
    const { data } = await api.put(`/api/notebooks/${notebookId}`, notebookData)
    return data
  },

  async deleteNotebook(notebookId) {
    const { data } = await api.delete(`/api/notebooks/${notebookId}`)
    return data
  },

  // Cell operations
  async newCell(notebookId, cellData) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/cells/new`, cellData)
    return data
  },

  async getCell(notebookId, cellId) {
    const { data } = await api.get(`/api/notebooks/${notebookId}/cells/${cellId}`)
    return data
  },

  async updateCell(notebookId, cellData) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/cells`, cellData)
    return data
  },

  async revertCell(notebookId, cellId) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/cells/${cellId}/revert`)
    return data
  },

  async cancelCell(notebookId, cellId) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/cells/${cellId}/cancel`)
    return data
  },

  // Notebook downloads & attachments
  async createDownloadFile(notebookId, downloadData = {}) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/download`, downloadData)
    return data
  },

  async uploadAttachment(notebookId, attachmentData) {
    const { data } = await api.post(`/api/notebooks/${notebookId}/attachment`, attachmentData)
    return data
  },

  async removeAttachment(notebookId, attachmentData) {
    const { data } = await api.delete(`/api/notebooks/${notebookId}/attachment`, { data: attachmentData })
    return data
  },

  async exportNotebook(notebookId, type = 'html') {
    const { data } = await api.get(`/api/notebooks/${notebookId}/export`, {
      params: { type }
    })
    return data
  }
}
