import api from './api'

export default {
  // ========== USER MANAGEMENT ==========
  async getUsers() {
    const { data } = await api.get('/api/users')
    return data
  },

  async getGlobalUsers() {
    const { data } = await api.get('/api/users/global')
    return data
  },

  async getUser(username) {
    const { data } = await api.get(`/api/users/${encodeURIComponent(username)}`)
    return data
  },

  async setUser(userData) {
    const { data } = await api.post('/api/users', userData)
    return data
  },

  async deleteUser(username) {
    const { data } = await api.delete(`/api/users/${encodeURIComponent(username)}`)
    return data
  },

  async setUserPassword(username, password) {
    const { data } = await api.post(`/api/users/${encodeURIComponent(username)}/password`, { password })
    return data
  },

  async getUserRoles(username) {
    const { data } = await api.get(`/api/users/${encodeURIComponent(username)}/roles`)
    return data
  },

  async setUserRoles(username, roles) {
    const { data } = await api.post(`/api/users/${encodeURIComponent(username)}/roles`, { roles })
    return data
  },

  async getUserUITraits() {
    const { data } = await api.get('/api/users/me/traits')
    return data
  },

  async getUserFavorites() {
    const { data } = await api.get('/api/users/me/favorites')
    return data
  },

  async setGUIOptions(options) {
    const { data } = await api.post('/api/users/me/gui-options', options)
    return data
  },

  // ========== SERVER MONITORING ==========
  async getServerMetrics(params = {}) {
    const { data } = await api.get('/api/server/metrics', { params })
    return data
  },

  async getServerMonitoring() {
    const { data } = await api.get('/api/server/monitoring')
    return data
  },

  async setServerMonitoring(monitoringData) {
    const { data } = await api.post('/api/server/monitoring', monitoringData)
    return data
  },

  async getClientMonitoring() {
    const { data } = await api.get('/api/server/client-monitoring')
    return data
  },

  async setClientMonitoring(monitoringData) {
    const { data } = await api.post('/api/server/client-monitoring', monitoringData)
    return data
  },

  // ========== EVENTS ==========
  async listAvailableEventResults(params = {}) {
    const { data } = await api.get('/api/events/available', { params })
    return data
  },

  async pushEvents(eventData) {
    const { data } = await api.post('/api/events/push', eventData)
    return data
  },

  // ========== TOOLS ==========
  async getTools() {
    const { data } = await api.get('/api/tools')
    return data
  },

  async setToolInfo(toolData) {
    const { data } = await api.post('/api/tools', toolData)
    return data
  },

  // ========== SECRETS ==========
  async getSecretDefinitions() {
    const { data } = await api.get('/api/secrets')
    return data
  },

  async defineSecret(secretData) {
    const { data } = await api.post('/api/secrets', secretData)
    return data
  },

  async addSecret(typeName, secretData) {
    const { data } = await api.post(`/api/secrets/${encodeURIComponent(typeName)}/add`, secretData)
    return data
  },

  async getSecret(typeName, name) {
    const { data } = await api.get(`/api/secrets/${encodeURIComponent(typeName)}`, {
      params: { name }
    })
    return data
  },

  async modifySecret(typeName, secretData) {
    const { data } = await api.put(`/api/secrets/${encodeURIComponent(typeName)}`, secretData)
    return data
  },

  // ========== DOWNLOADS ==========
  async createDownload(downloadData) {
    const { data } = await api.post('/api/downloads', downloadData)
    return data
  },

  async getDownload(downloadId) {
    const { data } = await api.get(`/api/downloads/${downloadId}`)
    return data
  },

  // ========== TABLE ==========
  async getTable(params = {}) {
    const { data } = await api.get('/api/table', { params })
    return data
  },

  async downloadTable(tableData) {
    const { data } = await api.post('/api/table/download', tableData)
    return data
  },

  // ========== REPORTS ==========
  async getReport(reportData) {
    const { data } = await api.post('/api/reports/generate', reportData)
    return data
  },

  // ========== TIMELINES ==========
  async getTimeline(timelineData) {
    const { data } = await api.post('/api/timelines', timelineData)
    return data
  },

  async annotateTimeline(annotationData) {
    const { data } = await api.post('/api/timelines/annotate', annotationData)
    return data
  },

  // ========== FILE SEARCH ==========
  async searchFile(searchData) {
    const { data } = await api.post('/api/file-search', searchData)
    return data
  },

  // ========== DOCS ==========
  async searchDocs(params = {}) {
    const { data } = await api.get('/api/docs/search', { params })
    return data
  },

  // ========== UPLOADS ==========
  async uploadTool(toolData) {
    const { data } = await api.post('/api/uploads/tool', toolData)
    return data
  },

  async uploadFormFile(fileData) {
    const { data } = await api.post('/api/uploads/file', fileData)
    return data
  },

  // ========== CLIENT CONFIG GENERATION ==========
  async generateClientConfig(configData) {
    const { data } = await api.post('/api/server/client-config', configData)
    return data
  },

  async createDownloadFile(downloadFileData) {
    const { data } = await api.post('/api/server/create-download', downloadFileData)
    return data
  },

  async getServerMetadata() {
    const { data } = await api.get('/api/server/metadata')
    return data
  },

  // ========== HEALTH ==========
  async healthCheck() {
    const { data } = await api.get('/api/health/velo')
    return data
  }
}
