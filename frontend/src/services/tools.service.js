import api from './api';

/**
 * Tools Service
 * Manages Velociraptor tools (binaries, scripts, etc.)
 */

/**
 * Get all tools
 * @returns {Promise<Object>} Tools list
 */
export const getTools = async () => {
  const response = await api.get('/api/tools');
  return response.data;
};

/**
 * Get specific tool info
 * @param {string} name - Tool name
 * @returns {Promise<Object>} Tool information
 */
export const getToolInfo = async (name) => {
  const response = await api.get(`/api/tools`, { params: { name } });
  return response.data;
};

/**
 * Set/update tool information
 * @param {Object} toolData - Tool data
 * @returns {Promise<Object>} Updated tool
 */
export const setToolInfo = async (toolData) => {
  const response = await api.post('/api/tools', toolData);
  return response.data;
};

/**
 * Upload tool binary
 * @param {File} file - Tool binary file
 * @param {Object} metadata - Tool metadata
 * @returns {Promise<Object>} Upload result
 */
export const uploadTool = async (file, metadata = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  Object.keys(metadata).forEach(key => {
    formData.append(key, metadata[key]);
  });

  const response = await api.post('/api/uploads/tool', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Delete tool
 * @param {string} name - Tool name
 * @returns {Promise<void>}
 */
export const deleteTool = async (name) => {
  const response = await api.delete(`/api/tools/${name}`);
  return response.data;
};

export default {
  getTools,
  getToolInfo,
  setToolInfo,
  uploadTool,
  deleteTool,
};
