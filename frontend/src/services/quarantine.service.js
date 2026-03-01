import api from './api'

/**
 * Quarantine Service
 * Manages host quarantine/isolation operations.
 */
export default {
  /**
   * Quarantine a host
   * @param {string} clientId - Client ID (e.g., C.xxxx)
   * @param {string} message - Optional quarantine message shown to user
   * @returns {Promise<Object>} { flow_id, client_id, artifact, action }
   */
  async quarantine(clientId, message = '') {
    const { data } = await api.post(`/api/clients/${clientId}/quarantine`, {
      action: 'quarantine',
      message,
    })
    return data
  },

  /**
   * Unquarantine / release a host
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} { flow_id, client_id, artifact, action }
   */
  async unquarantine(clientId) {
    const { data } = await api.post(`/api/clients/${clientId}/quarantine`, {
      action: 'unquarantine',
    })
    return data
  },
}
