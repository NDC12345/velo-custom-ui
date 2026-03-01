import { defineStore } from 'pinia'
import { ref } from 'vue'
import clientService from '@/services/client.service'

export const useClientStore = defineStore('client', () => {
  const clients = ref([])
  const currentClient = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchClients(params = {}, signal = null) {
    loading.value = true
    error.value = null
    try {
      const response = await clientService.searchClients(params, signal)
      clients.value = response.items || response
      return response
    } catch (err) {
      // Don't update error state for cancelled requests
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') throw err
      error.value = err.response?.data?.error || 'Failed to fetch clients'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchClient(clientId) {
    loading.value = true
    error.value = null
    try {
      const response = await clientService.getClient(clientId)
      currentClient.value = response
      return response
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch client'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function labelClient(clientIds, operation, labels) {
    try {
      return await clientService.labelClients(clientIds, operation, labels)
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to label clients'
      throw err
    }
  }

  async function deleteClient(clientId) {
    try {
      await clientService.deleteClient(clientId)
      clients.value = clients.value.filter(c => c.client_id !== clientId)
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to delete client'
      throw err
    }
  }

  return {
    clients,
    currentClient,
    loading,
    error,
    fetchClients,
    fetchClient,
    labelClient,
    deleteClient
  }
})
