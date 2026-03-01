/**
 * Approval workflow service — frontend API client.
 */
import api from './api'

class ApprovalService {
    async listApprovals({ status, limit, offset } = {}) {
        const params = {}
        if (status) params.status = status
        if (limit) params.limit = limit
        if (offset) params.offset = offset
        const { data } = await api.get('/api/approvals', { params })
        return data.items || []
    }

    async getApproval(approvalId) {
        const { data } = await api.get(`/api/approvals/${approvalId}`)
        return data
    }

    async createApproval({ actionType, actionPayload, targetResource, reason }) {
        const { data } = await api.post('/api/approvals', {
            actionType, actionPayload, targetResource, reason,
        })
        return data
    }

    async approve(approvalId, decisionNote = '') {
        const { data } = await api.post(`/api/approvals/${approvalId}/decide`, {
            decision: 'approved', decisionNote,
        })
        return data
    }

    async reject(approvalId, decisionNote = '') {
        const { data } = await api.post(`/api/approvals/${approvalId}/decide`, {
            decision: 'rejected', decisionNote,
        })
        return data
    }

    async cancel(approvalId) {
        const { data } = await api.post(`/api/approvals/${approvalId}/cancel`)
        return data
    }

    async getPendingCount() {
        const { data } = await api.get('/api/approvals/pending-count')
        return data.count || 0
    }
}

export default new ApprovalService()
