import api from './api'

/**
 * Shell Service
 * Execute shell commands on remote clients and retrieve results.
 */
export default {
  /**
   * Execute a shell command on a client
   * @param {string} clientId - Client ID (e.g., C.xxxx)
   * @param {string} command - Command to execute
   * @param {string} shellType - Shell type: 'powershell' | 'cmd' | 'bash'
   * @returns {Promise<Object>} { flow_id, client_id, artifact }
   */
  async execute(clientId, command, shellType = 'powershell') {
    const { data } = await api.post(`/api/clients/${clientId}/shell`, {
      command,
      shell_type: shellType,
    })
    return data
  },

  /**
   * Get shell command results
   * @param {string} clientId - Client ID
   * @param {string} flowId - Flow ID from execute()
   * @returns {Promise<Object>} { flow_id, client_id, state, results, total }
   */
  async getResults(clientId, flowId) {
    const { data } = await api.get(`/api/clients/${clientId}/shell/${flowId}`)
    return data
  },

  /**
   * Poll for results until complete
   * @param {string} clientId - Client ID
   * @param {string} flowId - Flow ID
   * @param {Function} onUpdate - Callback with { state, results }
   * @param {number} interval - Poll interval in ms (default: 3000)
   * @returns {Function} Cancel function
   */
  pollResults(clientId, flowId, onUpdate, interval = 3000) {
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const result = await this.getResults(clientId, flowId)
        onUpdate(result)
        if (result.state === 'FINISHED' || result.state === 'ERROR') {
          active = false
          return
        }
      } catch (e) {
        console.error('Shell poll error:', e)
      }
      if (active) setTimeout(poll, interval)
    }
    poll()
    return () => { active = false }
  },
}
