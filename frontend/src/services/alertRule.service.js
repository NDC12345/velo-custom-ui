/**
 * Alert rules service — frontend API client.
 */
import api from './api'

class AlertRuleService {
    async listRules({ ruleType, enabled, limit, offset } = {}) {
        const params = {}
        if (ruleType) params.ruleType = ruleType
        if (enabled !== undefined) params.enabled = String(enabled)
        if (limit) params.limit = limit
        if (offset) params.offset = offset
        const { data } = await api.get('/api/alert-rules', { params })
        return data.items || []
    }

    async getRule(ruleId) {
        const { data } = await api.get(`/api/alert-rules/${ruleId}`)
        return data
    }

    async createRule(payload) {
        const { data } = await api.post('/api/alert-rules', payload)
        return data
    }

    async updateRule(ruleId, updates) {
        const { data } = await api.put(`/api/alert-rules/${ruleId}`, updates)
        return data
    }

    async deleteRule(ruleId) {
        await api.delete(`/api/alert-rules/${ruleId}`)
    }
}

export default new AlertRuleService()
