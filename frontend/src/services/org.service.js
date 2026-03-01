/**
 * Organization service — multi-org management from frontend.
 */
import api from './api'

class OrgService {
    // ─── Organizations ─────────────────────────────────────────────
    async listOrgs() {
        const { data } = await api.get('/api/orgs')
        return data.items || []
    }

    async getOrg(orgId) {
        const { data } = await api.get(`/api/orgs/${orgId}`)
        return data
    }

    async createOrg(payload) {
        const { data } = await api.post('/api/orgs', payload)
        return data
    }

    async updateOrg(orgId, payload) {
        const { data } = await api.put(`/api/orgs/${orgId}`, payload)
        return data
    }

    async deleteOrg(orgId) {
        await api.delete(`/api/orgs/${orgId}`)
    }

    // ─── Members ───────────────────────────────────────────────────
    async listMembers(orgId) {
        const { data } = await api.get(`/api/orgs/${orgId}/members`)
        return data.items || []
    }

    async addMember(orgId, userId, role = 'member') {
        const { data } = await api.post(`/api/orgs/${orgId}/members`, { userId, role })
        return data
    }

    async updateMemberRole(orgId, userId, role) {
        const { data } = await api.put(`/api/orgs/${orgId}/members/${userId}`, { role })
        return data
    }

    async removeMember(orgId, userId) {
        await api.delete(`/api/orgs/${orgId}/members/${userId}`)
    }

    // ─── API Keys ──────────────────────────────────────────────────
    async listApiKeys(orgId) {
        const { data } = await api.get(`/api/orgs/${orgId}/api-keys`)
        return data.items || []
    }

    async createApiKey(orgId, payload) {
        const { data } = await api.post(`/api/orgs/${orgId}/api-keys`, payload)
        return data
    }

    async revokeApiKey(orgId, keyId) {
        await api.delete(`/api/orgs/${orgId}/api-keys/${keyId}`)
    }
}

export default new OrgService()
