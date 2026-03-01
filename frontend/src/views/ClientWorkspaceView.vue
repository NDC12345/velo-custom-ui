<template>
  <div class="workspace">

    <!-- ── Empty State ─────────────────────────────────────────── -->
    <div v-if="!tabsStore.hasTabs" class="workspace-empty">
      <div class="workspace-empty__icon">
        <v-icon size="56" color="#388bfd">mdi-monitor-multiple</v-icon>
      </div>
      <h2 class="workspace-empty__title">No clients open</h2>
      <p class="workspace-empty__sub">
        Open a client from the <strong>Endpoints</strong> list to begin investigation.
        Each client opens in its own tab so you can work on several simultaneously.
      </p>
      <v-btn
        color="primary"
        variant="tonal"
        rounded="lg"
        prepend-icon="mdi-laptop"
        @click="$router.push('/clients')"
      >
        Browse Endpoints
      </v-btn>
    </div>

    <!-- ── Workspace (tabs + content) ──────────────────────────── -->
    <template v-else>

      <!-- Tab Bar -->
      <div class="ws-tabbar">
        <div class="ws-tabbar__tabs">
          <div
            v-for="tab in tabsStore.tabs"
            :key="tab.id"
            class="ws-tab"
            :class="{ 'ws-tab--active': tabsStore.activeTabId === tab.id }"
            @click="tabsStore.setActive(tab.id)"
          >
            <!-- OS icon -->
            <v-icon size="14" class="ws-tab__os-icon" :color="tabsStore.activeTabId === tab.id ? '#58a6ff' : '#8b949e'">
              {{ getOsIcon(tab.os) }}
            </v-icon>

            <!-- Online dot -->
            <span class="ws-tab__dot" :class="tab.isOnline ? 'online' : 'offline'"></span>

            <!-- Label -->
            <span class="ws-tab__label">{{ tab.hostname }}</span>

            <!-- Close -->
            <button
              class="ws-tab__close"
              @click.stop="tabsStore.closeTab(tab.id)"
              title="Close tab"
            >
              <v-icon size="12">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div class="ws-tabbar__actions">
          <v-btn
            size="x-small"
            variant="text"
            rounded="lg"
            prepend-icon="mdi-plus"
            style="color: var(--text-muted); font-size: 11px;"
            @click="$router.push('/clients')"
            title="Open another endpoint"
          >
            Add
          </v-btn>
          <v-btn
            size="x-small"
            variant="text"
            rounded="lg"
            style="color: var(--text-muted); font-size: 11px;"
            @click="tabsStore.closeAll()"
            title="Close all tabs"
          >
            Close All
          </v-btn>
        </div>
      </div>

      <!-- Tab Panels: kept alive with v-show so state persists -->
      <div class="ws-panels">
        <div
          v-for="tab in tabsStore.tabs"
          :key="tab.id"
          v-show="tabsStore.activeTabId === tab.id"
          class="ws-panel"
        >
          <ClientDetailView
            :clientId="tab.id"
            :embedded="true"
          />
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { useClientTabsStore } from '@/stores/clientTabs'
import ClientDetailView from './ClientDetailView.vue'

const tabsStore = useClientTabsStore()

function getOsIcon(os) {
  if (!os) return 'mdi-laptop'
  const s = os.toLowerCase()
  if (s.includes('windows')) return 'mdi-microsoft-windows'
  if (s.includes('linux'))   return 'mdi-linux'
  if (s.includes('darwin') || s.includes('mac')) return 'mdi-apple'
  return 'mdi-laptop'
}
</script>

<style scoped>
/* Workspace container */
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
}

/* Empty state */
.workspace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 60vh;
  text-align: center;
  padding: 40px;
}
.workspace-empty__icon {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  background: rgba(56, 139, 253, 0.1);
  border: 1px solid rgba(56, 139, 253, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.workspace-empty__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.workspace-empty__sub {
  max-width: 440px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0;
}

/* ── Tab Bar ── */
.ws-tabbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px 0;
  border-bottom: 1px solid var(--border, rgba(99,110,123,.25));
  background: var(--bg-elevated, #161b22);
  /* sticky so it stays in view while scrolling the panel */
  position: sticky;
  top: 0;
  z-index: 10;
  overflow-x: auto;
  scrollbar-width: none;
}
.ws-tabbar::-webkit-scrollbar { display: none; }

.ws-tabbar__tabs {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.ws-tabbar__tabs::-webkit-scrollbar { display: none; }

.ws-tabbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 0 4px 4px;
}

/* Individual tab */
.ws-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 10px;
  border-radius: 8px 8px 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #8b949e);
  background: transparent;
  white-space: nowrap;
  max-width: 200px;
  min-width: 100px;
  transition: background 0.15s, color 0.15s;
  position: relative;
  user-select: none;
}
.ws-tab:hover {
  background: var(--bg-paper, #21262d);
  color: var(--text-secondary, #c9d1d9);
}
.ws-tab--active {
  background: var(--bg-app, #0d1117);
  border-color: var(--border, rgba(99,110,123,.25));
  color: var(--text-primary, #e6edf3);
  /* Cover the bottom border of the tabbar */
  margin-bottom: -1px;
  padding-bottom: 8px;
}

.ws-tab__os-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.ws-tab__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ws-tab__dot.online  { background: #3fb950; }
.ws-tab__dot.offline { background: #6e7681; }

.ws-tab__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ws-tab__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted, #8b949e);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}
.ws-tab:hover .ws-tab__close,
.ws-tab--active .ws-tab__close {
  opacity: 1;
}
.ws-tab__close:hover {
  background: rgba(248,81,73,0.18);
  color: #f85149;
}

/* ── Panels ── */
.ws-panels {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0 0;
}

.ws-panel {
  animation: panel-in 0.2s ease both;
}

@keyframes panel-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
