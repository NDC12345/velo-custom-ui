import api from './api'

export default {
  async getArtifacts(params = {}) {
    const { data } = await api.get('/api/artifacts', { params })
    return data
  },

  async getArtifact(artifactName) {
    const { data } = await api.get(`/api/artifacts/${encodeURIComponent(artifactName)}`)
    return data
  },

  async getArtifactFile(artifactName, vfsPath) {
    const { data } = await api.get(`/api/artifacts/${encodeURIComponent(artifactName)}/file`, {
      params: { vfs_path: vfsPath }
    })
    return data
  },

  async setArtifact(artifactData) {
    const { data } = await api.post('/api/artifacts', artifactData)
    return data
  },

  async loadArtifactPack(packData) {
    const { data } = await api.post('/api/artifacts/pack', packData)
    return data
  },

  async deleteArtifact(artifactName) {
    const { data } = await api.delete(`/api/artifacts/${encodeURIComponent(artifactName)}`)
    return data
  }
}
