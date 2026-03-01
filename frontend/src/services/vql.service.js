import api from './api'

export default {
  async executeQuery(query, env = [], maxRows = 1000) {
    const payload = {
      query: Array.isArray(query) ? query : [{ VQL: query, Name: 'Query' }],
      max_row: maxRows,
    }
    if (env.length) payload.env = env
    const { data } = await api.post('/api/query', payload)
    return data
  },

  async getCompletions(prefix = '', type = '') {
    const { data } = await api.get('/api/completions', {
      params: { prefix, type }
    })
    return data
  },

  async reformatVQL(vql) {
    const { data } = await api.post('/api/vql/reformat', { vql })
    return data
  }
}
