/**
 * MITRE ATT&CK mapping service — frontend API client.
 */
import api from './api'

class MitreService {
    async listMappings({ tactic, caseId, limit } = {}) {
        const params = {}
        if (tactic) params.tactic = tactic
        if (caseId) params.caseId = caseId
        if (limit) params.limit = limit
        const { data } = await api.get('/api/mitre', { params })
        return data.items || []
    }

    async addMapping(payload) {
        const { data } = await api.post('/api/mitre', payload)
        return data
    }

    async deleteMapping(mappingId) {
        await api.delete(`/api/mitre/${mappingId}`)
    }

    /**
     * Returns matrix object: { tactic → [{ technique_id, technique_name, evidence_count }] }
     */
    async getMatrix() {
        const { data } = await api.get('/api/mitre/matrix')
        return data
    }

    async getCoverage() {
        const { data } = await api.get('/api/mitre/coverage')
        return data
    }
}

export default new MitreService()
