import api from './api';

/**
 * User Service - User profile and avatar management
 */
class UserService {
  /**
   * Get current user profile
   * @returns {Promise<Object>} User profile
   */
  async getProfile() {
    try {
      const response = await api.get('/api/user/profile');
      return response.data?.data || null;
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {Object} updates - Profile fields to update
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfile(updates) {
    try {
      const response = await api.put('/api/user/profile', updates);
      return response.data?.data || null;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  /**
   * Upload user avatar
   * @param {File} file - Image file
   * @returns {Promise<string>} Avatar URL
   */
  async uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      // Let the browser/axios set the Content-Type (including multipart boundary)
      const response = await api.post('/api/user/avatar', formData);

      return response.data?.data?.avatarUrl || null;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      throw error;
    }
  }

  /**
   * Upload avatar as base64 data URI
   * @param {string} dataUri - data:image/...;base64,....
   * @returns {Promise<string>} Avatar data URI
   */
  async uploadAvatarBase64(dataUri) {
    try {
      const response = await api.post('/api/user/avatar/base64', { avatarBase64: dataUri });
      return response.data?.data?.avatarUrl || null;
    } catch (error) {
      console.error('Failed to upload avatar (base64):', error);
      throw error;
    }
  }

  /**
   * Delete user avatar
   * @returns {Promise<boolean>} Success status
   */
  async deleteAvatar() {
    try {
      await api.delete('/api/user/avatar');
      return true;
    } catch (error) {
      console.error('Failed to delete avatar:', error);
      throw error;
    }
  }

  /**
   * Get avatar URL for display
   * @param {string} avatarPath - Avatar path from database
   * @returns {string} Full avatar URL
   */
  getAvatarUrl(avatarPath) {
    if (!avatarPath) return null;
    
    // If already a full URL, return as-is
    if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) {
      return avatarPath;
    }
    
    // Build URL from backend
    const baseUrl = import.meta.env.VITE_API_URL ?? '';
    return `${baseUrl}${avatarPath}`;
  }

  // ─── Velociraptor User Management ──────────────────────────────────────────

  /**
   * List all Velociraptor users
   * @returns {Promise<{items: Array, total: number}>}
   */
  async getUsers() {
    const response = await api.get('/api/users');
    return response.data;
  }

  /**
   * Create a new Velociraptor user
   * @param {Object} userData - { name|username, password, roles[], orgs[] }
   * @returns {Promise<Object>}
   */
  async createUser(userData) {
    const response = await api.post('/api/users', {
      ...userData,
      add_new_user: true,
    });
    return response.data;
  }

  /**
   * Set roles for a Velociraptor user
   * @param {string} username
   * @param {string[]} roles
   * @param {string} [org] - org ID (optional)
   * @returns {Promise<Object>}
   */
  async setUserRoles(username, roles, org = '') {
    const response = await api.post(`/api/users/${encodeURIComponent(username)}/roles`, { roles, org });
    return response.data;
  }

  /**
   * Change a Velociraptor user's password
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async setPassword(username, password) {
    const response = await api.post(`/api/users/${encodeURIComponent(username)}/password`, { password });
    return response.data;
  }

  /**
   * Delete (deactivate) a Velociraptor user by stripping all roles
   * @param {string} username
   * @returns {Promise<Object>}
   */
  async deleteUser(username) {
    const response = await api.delete(`/api/users/${encodeURIComponent(username)}`);
    return response.data;
  }
}

export default new UserService();
