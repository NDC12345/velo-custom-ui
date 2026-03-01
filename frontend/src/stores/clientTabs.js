import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useClientTabsStore = defineStore('clientTabs', () => {
  // Each tab: { id: clientId, hostname: string, os: string, isOnline: bool }
  const tabs = ref([])
  const activeTabId = ref(null)

  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) || null)
  const hasTabs = computed(() => tabs.value.length > 0)

  /**
   * Open a client tab. If already open, just switch to it.
   * @param {Object} client - client object from Velociraptor
   */
  function openTab(client) {
    const id = client.client_id || client.id
    if (!id) return

    const existing = tabs.value.find(t => t.id === id)
    if (existing) {
      activeTabId.value = id
      return
    }

    tabs.value.push({
      id,
      hostname: client.os_info?.hostname || client.hostname || id.slice(0, 16),
      os: client.os_info?.system || 'Unknown',
      isOnline: isClientOnline(client),
    })
    activeTabId.value = id
  }

  /**
   * Close a tab by clientId. Activates adjacent tab if active tab is closed.
   */
  function closeTab(clientId) {
    const idx = tabs.value.findIndex(t => t.id === clientId)
    if (idx === -1) return

    tabs.value.splice(idx, 1)

    if (activeTabId.value === clientId) {
      // Prefer the tab to the left, then right, then null
      const next = tabs.value[Math.max(0, idx - 1)]
      activeTabId.value = next?.id || null
    }
  }

  /** Switch active tab */
  function setActive(clientId) {
    if (tabs.value.some(t => t.id === clientId)) {
      activeTabId.value = clientId
    }
  }

  /** Update hostname/status after data loads */
  function updateTab(clientId, patch) {
    const tab = tabs.value.find(t => t.id === clientId)
    if (tab) Object.assign(tab, patch)
  }

  /** Close all tabs */
  function closeAll() {
    tabs.value = []
    activeTabId.value = null
  }

  function isClientOnline(client) {
    const seen = client.last_seen_at || client.last_seen || 0
    const ms = seen > 1e15 ? seen / 1000 : seen > 1e12 ? seen : seen * 1000
    return Date.now() - ms < 3600000
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    hasTabs,
    openTab,
    closeTab,
    setActive,
    updateTab,
    closeAll,
  }
})
