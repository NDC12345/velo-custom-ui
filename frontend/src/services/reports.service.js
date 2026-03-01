import api from './api';

/**
 * Reports Service
 * Manages report generation and export
 */

/**
 * Generate report
 * @param {Object} reportConfig - Report configuration
 * @param {string} reportConfig.type - Report type (HTML, PDF, etc.)
 * @param {string} reportConfig.artifact - Artifact name
 * @param {string} reportConfig.client_id - Client ID
 * @param {string} reportConfig.flow_id - Flow ID
 * @param {string} reportConfig.hunt_id - Hunt ID
 * @param {Object} reportConfig.parameters - Report parameters
 * @returns {Promise<Object>} Report result
 */
export const generateReport = async (reportConfig) => {
  const response = await api.post('/api/reports/generate', reportConfig);
  return response.data;
};

/**
 * Get report status
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} Report status
 */
export const getReportStatus = async (reportId) => {
  const response = await api.get(`/api/reports/${reportId}/status`);
  return response.data;
};

/**
 * Download report
 * @param {string} reportId - Report ID
 * @returns {Promise<Blob>} Report file
 */
export const downloadReport = async (reportId) => {
  const response = await api.get(`/api/reports/${reportId}/download`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * List available report templates
 * @returns {Promise<Array>} Report templates
 */
export const getReportTemplates = async () => {
  const response = await api.get('/api/reports/templates');
  return response.data;
};

/**
 * Delete report
 * @param {string} reportId - Report ID
 * @returns {Promise<void>}
 */
export const deleteReport = async (reportId) => {
  const response = await api.delete(`/api/reports/${reportId}`);
  return response.data;
};

export default {
  generateReport,
  getReportStatus,
  downloadReport,
  getReportTemplates,
  deleteReport,
};
