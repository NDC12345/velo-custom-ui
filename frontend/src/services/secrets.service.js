import api from './api';

/**
 * Secrets Service
 * Manages Velociraptor secrets (credentials, API keys, etc.)
 */

/**
 * Get all secret definitions
 * @returns {Promise<Object>} Secret definitions
 */
export const getSecretDefinitions = async () => {
  const response = await api.get('/api/secrets');
  return response.data;
};

/**
 * Get specific secret (redacted)
 * @param {string} type - Secret type/name
 * @returns {Promise<Object>} Secret (redacted)
 */
export const getSecret = async (type) => {
  const response = await api.get(`/api/secrets/${type}`);
  return response.data;
};

/**
 * Define new secret
 * @param {Object} secretData - Secret definition
 * @returns {Promise<Object>} Result
 */
export const defineSecret = async (secretData) => {
  const response = await api.post('/api/secrets', secretData);
  return response.data;
};

/**
 * Add secret value
 * @param {string} type - Secret type
 * @param {Object} secretValue - Secret value data
 * @returns {Promise<Object>} Result
 */
export const addSecret = async (type, secretValue) => {
  const response = await api.post(`/api/secrets/${type}/add`, secretValue);
  return response.data;
};

/**
 * Modify secret
 * @param {string} type - Secret type
 * @param {Object} secretData - Updated secret data
 * @returns {Promise<Object>} Result
 */
export const modifySecret = async (type, secretData) => {
  const response = await api.put(`/api/secrets/${type}`, secretData);
  return response.data;
};

/**
 * Delete secret
 * @param {string} type - Secret type
 * @returns {Promise<void>}
 */
export const deleteSecret = async (type) => {
  const response = await api.delete(`/api/secrets/${type}`);
  return response.data;
};

export default {
  getSecretDefinitions,
  getSecret,
  defineSecret,
  addSecret,
  modifySecret,
  deleteSecret,
};
