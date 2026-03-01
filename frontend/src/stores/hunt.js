import { defineStore } from 'pinia'
import { ref } from 'vue'
import huntService from '@/services/hunt.service'

export const useHuntStore = defineStore('hunt', () => {
  const hunts = ref([])
  const currentHunt = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchHunts(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await huntService.getHunts(params)
      hunts.value = response.items || response
      return response
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch hunts'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchHunt(huntId) {
    loading.value = true
    error.value = null
    try {
      const response = await huntService.getHunt(huntId)
      currentHunt.value = response
      return response
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch hunt'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createHunt(huntData) {
    loading.value = true
    error.value = null
    try {
      const response = await huntService.createHunt(huntData)
      // Reload full list so the new hunt appears with all fields (description, state, etc.)
      // rather than unshifting the incomplete { hunt_id, flow_id } create-response.
      await fetchHunts()
      return response
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to create hunt'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function modifyHunt(huntId, modification) {
    try {
      const response = await huntService.modifyHunt(huntId, modification)
      const index = hunts.value.findIndex(h => h.hunt_id === huntId)
      if (index !== -1) {
        hunts.value[index] = { ...hunts.value[index], ...response }
      }
      return response
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to modify hunt'
      throw err
    }
  }

  async function deleteHunt(huntId) {
    try {
      await huntService.deleteHunt(huntId)
      hunts.value = hunts.value.filter(h => h.hunt_id !== huntId)
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to delete hunt'
      throw err
    }
  }

  return {
    hunts,
    currentHunt,
    loading,
    error,
    fetchHunts,
    fetchHunt,
    createHunt,
    modifyHunt,
    deleteHunt
  }
})
