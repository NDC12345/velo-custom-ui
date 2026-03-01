import api from './api';

/**
 * Downloads Service
 * Manages download queue and export operations
 */

/**
 * Create download/export
 * @param {Object} downloadConfig - Download configuration
 * @param {string} downloadConfig.client_id - Client ID
 * @param {string} downloadConfig.flow_id - Flow ID
 * @param {string} downloadConfig.hunt_id - Hunt ID
 * @param {string} downloadConfig.vfs_path - VFS path
 * @param {string} downloadConfig.type - Download type (ZIP, CSV, JSON, etc.)
 * @param {string} downloadConfig.password - Optional password for ZIP
 * @returns {Promise<Object>} Download creation result with download_id
 */
export const createDownload = async (downloadConfig) => {
  const response = await api.post('/api/downloads', downloadConfig);
  return response.data;
};

/**
 * Get download status
 * @param {string} downloadId - Download ID
 * @returns {Promise<Object>} Download status and metadata
 */
export const getDownloadStatus = async (downloadId) => {
  const response = await api.get(`/api/downloads/${downloadId}`);
  return response.data;
};

/**
 * Get all pending/completed downloads
 * @returns {Promise<Array>} List of downloads
 */
export const listDownloads = async () => {
  const response = await api.get('/api/downloads');
  return response.data;
};

/**
 * Download file
 * @param {string} downloadId - Download ID
 * @param {string} filename - Filename for save
 * @returns {Promise<Blob>} File blob
 */
export const downloadFile = async (downloadId, filename = 'download.zip') => {
  const response = await api.get(`/api/downloads/${downloadId}/file`, {
    responseType: 'blob',
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  
  return response.data;
};

/**
 * Cancel download
 * @param {string} downloadId - Download ID
 * @returns {Promise<void>}
 */
export const cancelDownload = async (downloadId) => {
  const response = await api.post(`/api/downloads/${downloadId}/cancel`);
  return response.data;
};

/**
 * Delete download
 * @param {string} downloadId - Download ID
 * @returns {Promise<void>}
 */
export const deleteDownload = async (downloadId) => {
  const response = await api.delete(`/api/downloads/${downloadId}`);
  return response.data;
};

/**
 * Download table as CSV/JSON
 * @param {Object} tableConfig - Table download config
 * @param {string} tableConfig.artifact - Artifact name
 * @param {string} tableConfig.client_id - Client ID
 * @param {string} tableConfig.flow_id - Flow ID
 * @param {string} tableConfig.type - Export type (CSV, JSON)
 * @returns {Promise<Blob>} Downloaded file
 */
export const downloadTable = async (tableConfig) => {
  const response = await api.post('/api/table/download', tableConfig, {
    responseType: 'blob',
  });
  return response.data;
};

export default {
  createDownload,
  getDownloadStatus,
  listDownloads,
  downloadFile,
  cancelDownload,
  deleteDownload,
  downloadTable,
};
