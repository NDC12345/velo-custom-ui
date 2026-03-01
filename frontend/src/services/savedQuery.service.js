/**
 * Saved queries service — frontend API client.
 */
import api from './api'

class SavedQueryService {
    async listQueries({ queryType, shared, limit, offset } = {}) {
        const params = {}
        if (queryType) params.queryType = queryType
        if (shared) params.shared = 'true'
        if (limit) params.limit = limit
        if (offset) params.offset = offset
        const { data } = await api.get('/api/queries', { params })
        return data.items || []
    }

    async getQuery(queryId) {
        const { data } = await api.get(`/api/queries/${queryId}`)
        return data
    }

    async createQuery({ name, description, queryType, queryText, parameters, isShared, tags }) {
        const { data } = await api.post('/api/queries', {
            name, description, queryType, queryText, parameters, isShared, tags,
        })
        return data
    }

    async updateQuery(queryId, updates) {
        const { data } = await api.put(`/api/queries/${queryId}`, updates)
        return data
    }

    async deleteQuery(queryId) {
        await api.delete(`/api/queries/${queryId}`)
    }

    async runQuery(queryId) {
        const { data } = await api.post(`/api/queries/${queryId}/run`)
        return data
    }
}

export default new SavedQueryService()
