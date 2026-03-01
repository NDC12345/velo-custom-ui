import api from './api';

/**
 * Case Service - Manage investigation cases
 * Cases are stored in local database, not in Velociraptor
 */
class CaseService {
  // ─── Cases ──────────────────────────────────────────────────────────────────

  /**
   * Get all investigation cases with optional filters
   * @param {Object} params - Query parameters (status, severity, search, offset, limit)
   * @returns {Promise<Object>} { items, total, offset, limit }
   */
  async getCases(params = {}) {
    const { data } = await api.get('/api/cases', { params });
    return data;
  }

  /**
   * Get a single case by ID with evidence and comments
   * @param {string} caseId - Case UUID
   * @returns {Promise<Object>} Full case data
   */
  async getCase(caseId) {
    const { data } = await api.get(`/api/cases/${caseId}`);
    return data;
  }

  /**
   * Create new investigation case
   * @param {Object} caseData - Case details
   * @returns {Promise<Object>} Created case
   */
  async createCase(caseData) {
    const { data } = await api.post('/api/cases', caseData);
    return data;
  }

  /**
   * Update existing case
   * @param {string} caseId - Case ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated case
   */
  async updateCase(caseId, updates) {
    const { data } = await api.patch(`/api/cases/${caseId}`, updates);
    return data;
  }

  /**
   * Delete case
   * @param {string} caseId - Case ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteCase(caseId) {
    await api.delete(`/api/cases/${caseId}`);
    return true;
  }

  /**
   * Get case statistics for dashboard
   * @returns {Promise<Object>} Stats summary
   */
  async getCaseStats() {
    const { data } = await api.get('/api/cases/stats');
    return data;
  }

  // ─── Evidence ───────────────────────────────────────────────────────────────

  /**
   * List evidence for a case
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} { items, total }
   */
  async listEvidence(caseId) {
    const { data } = await api.get(`/api/cases/${caseId}/evidence`);
    return data;
  }

  /**
   * Add evidence to a case
   * @param {string} caseId - Case ID
   * @param {Object} evidence - Evidence data
   * @returns {Promise<Object>} Created evidence
   */
  async addEvidence(caseId, evidence) {
    const { data } = await api.post(`/api/cases/${caseId}/evidence`, evidence);
    return data;
  }

  /**
   * Remove evidence from a case
   * @param {string} caseId - Case ID
   * @param {string} evidenceId - Evidence ID
   * @returns {Promise<boolean>} Success
   */
  async removeEvidence(caseId, evidenceId) {
    await api.delete(`/api/cases/${caseId}/evidence/${evidenceId}`);
    return true;
  }

  // ─── Comments ───────────────────────────────────────────────────────────────

  /**
   * List comments for a case
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} { items, total }
   */
  async listComments(caseId) {
    const { data } = await api.get(`/api/cases/${caseId}/comments`);
    return data;
  }

  /**
   * Add comment to a case
   * @param {string} caseId - Case ID
   * @param {Object} comment - { content, comment_type? }
   * @returns {Promise<Object>} Created comment
   */
  async addComment(caseId, comment) {
    const { data } = await api.post(`/api/cases/${caseId}/comments`, comment);
    return data;
  }

  /**
   * Delete comment
   * @param {string} caseId - Case ID
   * @param {string} commentId - Comment ID
   * @returns {Promise<boolean>} Success
   */
  async deleteComment(caseId, commentId) {
    await api.delete(`/api/cases/${caseId}/comments/${commentId}`);
    return true;
  }
}

export default new CaseService();
