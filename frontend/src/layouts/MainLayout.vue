<template>
  <div class="app-shell">
    <!-- ───── Sidebar ───── -->
    <aside class="sidebar" :class="{ collapsed: collapsed }">
      <!-- Logo -->
      <div class="sidebar__logo" @click="$router.push('/')">
        <div class="logo-mark">
          <img src="/velo-logo.svg" width="18" height="18" alt="" />
        </div>
        <transition name="fade-text">
          <div v-if="!collapsed" class="logo-text">
            <span class="logo-text__name">VELO</span>
            <span class="logo-text__tag">TI</span>
          </div>
        </transition>
      </div>

      <!-- Nav -->
      <nav class="sidebar__nav">
        <template v-for="group in navGroups" :key="group.label">
          <div v-if="!collapsed" class="nav-section">{{ group.label }}</div>
          <div v-else class="nav-divider"></div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            custom
            v-slot="{ isActive, navigate }"
          >
            <button
              class="nav-item"
              :class="{ active: isActiveRoute(item.path, isActive) }"
              :style="isActiveRoute(item.path, isActive) ? { '--item-color': item.color || '#60a5fa' } : {}"
              @click="navigate"
              :title="collapsed ? item.title : undefined"
            >
              <div class="nav-item__indicator"></div>
              <v-icon
                size="18"
                class="nav-item__icon"
                :color="isActiveRoute(item.path, isActive) ? (item.color || '#60a5fa') : undefined"
              >{{ item.icon }}</v-icon>
              <span v-if="!collapsed" class="nav-item__label">{{ item.title }}</span>
              <span v-if="!collapsed && item.badge" class="nav-item__dot"></span>
            </button>
          </router-link>
        </template>

        <!-- AI -->
        <div v-if="!collapsed" class="nav-section nav-section--ai">ASSISTANT</div>
        <div v-else class="nav-divider"></div>
        <button
          class="nav-item nav-item--ai"
          :class="{ active: isActiveRoute('/chat') }"
          :style="isActiveRoute('/chat') ? { '--item-color': '#a78bfa' } : {}"
          @click="$router.push('/chat')"
          :title="collapsed ? 'AI Assistant' : undefined"
        >
          <div class="nav-item__indicator"></div>
          <v-icon size="18" class="nav-item__icon nav-item__icon--ai">mdi-creation-outline</v-icon>
          <span v-if="!collapsed" class="nav-item__label">AI Assistant</span>
          <span v-if="!collapsed" class="nav-item__ai-badge">AI</span>
        </button>
      </nav>

      <!-- Footer -->
      <div class="sidebar__footer">
        <button
          class="nav-item"
          :class="{ active: isActiveRoute('/settings') }"
          :style="isActiveRoute('/settings') ? { '--item-color': '#94a3b8' } : {}"
          @click="$router.push('/settings')"
          :title="collapsed ? 'Settings' : undefined"
        >
          <v-icon size="18" class="nav-item__icon">mdi-cog-sync-outline</v-icon>
          <span v-if="!collapsed" class="nav-item__label">Settings</span>
        </button>
        <button class="nav-item nav-item--danger" @click="handleLogout" :title="collapsed ? 'Logout' : undefined">
          <v-icon size="18" class="nav-item__icon">mdi-logout-variant</v-icon>
          <span v-if="!collapsed" class="nav-item__label">Logout</span>
        </button>
      </div>
    </aside>

    <!-- ───── Main Area ───── -->
    <div class="main-area">
      <!-- Topbar -->
      <header class="topbar">
        <div class="topbar__left">
          <button class="topbar__toggle" @click="collapsed = !collapsed">
            <v-icon size="18">{{ collapsed ? 'mdi-menu' : 'mdi-menu-open' }}</v-icon>
          </button>
          <div class="breadcrumb">
            <span class="breadcrumb__root">VeloTI</span>
            <v-icon size="11" class="breadcrumb__sep">mdi-chevron-right</v-icon>
            <span class="breadcrumb__page">{{ currentPageTitle }}</span>
          </div>
        </div>
        <div class="topbar__right">
          <!-- XDR system status indicators -->
          <div class="xdr-status-bar">
            <span class="xsb-item" title="Online endpoints">
              <span class="xsb-dot dot-live"></span>
              <span class="xsb-val">{{ geoStore.onlineCount }}</span>
            </span>
            <span class="xsb-sep">|</span>
            <span class="xsb-item" title="Total endpoints">
              <v-icon size="11" style="opacity:.5;margin-right:2px">mdi-monitor-multiple</v-icon>
              <span class="xsb-val">{{ geoStore.totalClients }}</span>
            </span>
            <span v-if="geoStore.incidentCount" class="xsb-sep">|</span>
            <span v-if="geoStore.incidentCount" class="xsb-item xsb-critical" title="Active incidents">
              <v-icon size="11" color="#ef4444" style="margin-right:2px">mdi-alert-circle</v-icon>
              <span class="xsb-val">{{ geoStore.incidentCount }}</span>
            </span>
          </div>
          <!-- Theme toggle -->
          <button class="topbar__btn" :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="themeStore.toggleTheme()">
            <v-icon size="17" color="#94a3b8">{{ themeStore.isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
          </button>
          <!-- Search trigger -->
          <button class="topbar__btn" title="Quick search" @click="$router.push('/clients')">
            <v-icon size="17" color="#94a3b8">mdi-magnify</v-icon>
          </button>
          <button class="topbar__btn topbar__btn--alerts" title="Events" @click="$router.push('/events')">
            <v-icon size="17" color="#94a3b8">mdi-timeline-alert</v-icon>
          </button>
          <!-- User -->
          <div class="user-menu" @click.stop="showUserMenu = !showUserMenu">
            <v-avatar size="26" rounded="lg" color="#1c2438">
              <v-img v-if="userAvatarUrl" :src="userAvatarUrl" :alt="user?.username" />
              <span v-else style="font-size: 11px; font-weight: 700; color: #60a5fa;">
                {{ (user?.username || 'U')[0].toUpperCase() }}
              </span>
            </v-avatar>
            <span v-if="!collapsed" class="user-menu__name">{{ user?.username || 'User' }}</span>
            <v-icon size="14" class="user-menu__caret">mdi-chevron-down</v-icon>
          </div>
          <!-- Dropdown -->
          <transition name="dropdown">
            <div v-if="showUserMenu" class="user-dropdown" v-click-outside="() => showUserMenu = false">
              <div class="user-dropdown__header">
                <div class="user-dropdown__name">{{ user?.username }}</div>
                <div class="user-dropdown__email">{{ user?.email || 'Velociraptor User' }}</div>
              </div>
              <div class="user-dropdown__sep"></div>
              <button class="user-dropdown__item" @click="$router.push('/settings'); showUserMenu = false">
                <v-icon size="15" class="mr-2">mdi-cog-outline</v-icon> Settings
              </button>
              <button class="user-dropdown__item user-dropdown__item--danger" @click="handleLogout">
                <v-icon size="15" class="mr-2">mdi-logout</v-icon> Logout
              </button>
            </div>
          </transition>
        </div>
      </header>

      <!-- Content -->
      <main class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
        <AskAIButton />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useGeoStore } from '@/stores/useGeoStore'
import { useWebSocket } from '@/composables/useWebSocket'
import AskAIButton from '@/components/AskAIButton.vue'
import userService from '@/services/user.service'

const router = useRouter()
const route  = useRoute()
const authStore = useAuthStore()

const collapsed = ref(false)
const showUserMenu = ref(false)
const user = computed(() => authStore.user)
const userAvatarUrl = computed(() => userService.getAvatarUrl(user.value?.avatar_url))
const themeStore = useThemeStore()
const geoStore   = useGeoStore()

// Global WebSocket — lives for the full session, survives route navigation.
// MapContainer no longer manages its own WS connection.
const { connect: wsConnect } = useWebSocket()

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/',        icon: 'mdi-monitor-dashboard',  title: 'Dashboard', color: '#60a5fa' },
    ],
  },
  {
    label: 'INVESTIGATE',
    items: [
      { path: '/clients', icon: 'mdi-server-security',   title: 'Clients',   color: '#f97316' },
      { path: '/hunts',   icon: 'mdi-target-account',   title: 'Hunts',     color: '#f97316' },
      { path: '/events',  icon: 'mdi-timeline-alert',   title: 'Events',    color: '#f97316' },
    ],
  },
  {
    label: 'ANALYZE',
    items: [
      { path: '/artifacts', icon: 'mdi-shield-search',   title: 'Artifacts', color: '#34d399' },
      { path: '/vql',       icon: 'mdi-database-search', title: 'VQL Lab',   color: '#34d399' },
      { path: '/notebooks', icon: 'mdi-notebook-edit',   title: 'Notebooks', color: '#34d399' },
      { path: '/reports',   icon: 'mdi-chart-areaspline',title: 'Reports',   color: '#34d399' },
      { path: '/timeline',  icon: 'mdi-chart-timeline',  title: 'Timeline',  color: '#34d399' },
    ],
  },
  {
    label: 'SERVER',
    items: [
      { path: '/server-admin', icon: 'mdi-server-network', title: 'Server', color: '#a78bfa' },
      { path: '/tools',        icon: 'mdi-tools',          title: 'Tools',  color: '#a78bfa' },
    ],
  },
]

const routeTitles = {
  '/': 'Dashboard', '/clients': 'Clients', '/hunts': 'Hunt Manager',
  '/timeline': 'Timeline', '/artifacts': 'Artifacts',
  '/vql': 'VQL Lab', '/notebooks': 'Notebooks', '/reports': 'Reports',
  '/events': 'Events', '/vfs': 'VFS Browser',
  '/downloads': 'Downloads', '/users': 'Users', '/tools': 'Tools',
  '/secrets': 'Secrets', '/server-admin': 'Server',
  '/chat': 'AI Assistant', '/settings': 'Settings',
}

const currentPageTitle = computed(() => {
  const p = route.path
  if (routeTitles[p]) return routeTitles[p]
  if (p.startsWith('/clients/')) return 'Endpoint Detail'
  if (p.startsWith('/flows/')) return 'Flow Detail'
  return 'Dashboard'
})

const isActiveRoute = (path, routerIsActive = null) => {
  if (routerIsActive !== null) return routerIsActive
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickHandler = (e) => { if (!el.contains(e.target)) binding.value(e) }
    document.addEventListener('click', el._clickHandler, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickHandler, true)
  },
}

async function handleLogout() {
  showUserMenu.value = false
  await authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  if (!user.value) {
    authStore.fetchCurrentUser().catch(() => router.push('/login'))
  }
  // Seed geo store via HTTP immediately so topbar counts and map show data
  // before the WebSocket delivers its first snapshot (can take up to 10s).
  geoStore.fetchSnapshot()
  // Start the persistent WebSocket for real-time geo updates.
  // useWebSocket's onUnmounted(disconnect) fires only when MainLayout itself
  // unmounts (i.e., on logout), so the connection stays alive across routes.
  wsConnect()
})
</script>

<style scoped>
/* ── Shell ───────────────────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-app);
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width var(--t-normal);
  overflow: hidden;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 50;
}
.sidebar.collapsed { width: 60px; }

/* Logo */
.sidebar__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  min-height: 56px;
  flex-shrink: 0;
}
.logo-mark {
  width: 30px; height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.2);
}
.logo-text { display: flex; flex-direction: column; line-height: 1.15; overflow: hidden; }
.logo-text__name {
  font-size: 14px; font-weight: 800;
  color: var(--text-primary); letter-spacing: 2.5px; white-space: nowrap;
}
.logo-text__tag {
  font-size: 9px; font-weight: 600;
  letter-spacing: 1.5px; color: var(--text-muted); white-space: nowrap;
}

/* Nav */
.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}
.sidebar__nav::-webkit-scrollbar { width: 3px; }
.sidebar__nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

.nav-section {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  padding: 12px 16px 4px;
  white-space: nowrap;
}
.nav-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 12px);
  margin: 1px 6px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  transition: background var(--t-fast), color var(--t-fast);
  white-space: nowrap;
  position: relative;
  text-align: left;
}
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nav-item.active {
  background: color-mix(in srgb, var(--item-color, var(--accent)) 12%, transparent);
  color: var(--item-color, var(--accent-hover));
}
.nav-item.active .nav-item__icon { color: var(--item-color, var(--accent-hover)) !important; }
.nav-item__indicator {
  position: absolute;
  left: -6px;
  top: 20%;
  height: 60%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--item-color, var(--accent));
  opacity: 0;
  transition: opacity var(--t-fast);
}
.nav-item.active .nav-item__indicator { opacity: 1; }

.nav-item__icon { flex-shrink: 0; transition: color var(--t-fast); }
.nav-item__label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.nav-item__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
  animation: subtle-glow 2s ease-in-out infinite;
}

/* AI item */
.nav-section--ai { color: #a78bfa !important; }
.nav-item--ai { --item-color: #a78bfa; }
.nav-item--ai .nav-item__icon--ai { color: #a78bfa; }
.nav-item--ai:hover { background: rgba(139, 92, 246, 0.08); color: #a78bfa; }
.nav-item--ai.active { background: rgba(139, 92, 246, 0.12); color: #a78bfa; }
.nav-item--ai.active .nav-item__indicator { background: #8b5cf6; opacity: 1; }
.nav-item--ai.active .nav-item__icon--ai {
  filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.6));
}
.nav-item__ai-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 1px 5px;
  border-radius: 4px;
  background: linear-gradient(135deg, #6366f1, #a78bfa);
  color: #fff;
  flex-shrink: 0;
}
.nav-item--danger:hover { background: var(--danger-subtle); color: var(--danger); }

.sidebar__footer {
  border-top: 1px solid var(--border);
  padding: 6px 0;
  flex-shrink: 0;
}

/* ── Main Area ───────────────────────────────────────────────────────────── */
.main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Topbar */
.topbar {
  height: var(--topbar-height);
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}
.topbar__left { display: flex; align-items: center; gap: 12px; }
.topbar__right { display: flex; align-items: center; gap: 6px; position: relative; }

.topbar__toggle {
  width: 30px; height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--t-fast);
}
.topbar__toggle:hover { background: var(--bg-hover); color: var(--text-primary); }

.breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.breadcrumb__root { color: var(--text-muted); }
.breadcrumb__sep  { color: var(--text-muted); }
.breadcrumb__page { color: var(--text-primary); font-weight: 600; }

.topbar__btn {
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--t-fast);
  position: relative;
}
.topbar__btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.topbar__btn-dot {
  position: absolute;
  top: 6px; right: 6px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--danger);
}

/* User menu */
.user-menu {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--t-fast);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  margin-left: 2px;
}
.user-menu:hover { background: var(--bg-hover); border-color: var(--border-glass); color: var(--text-primary); }
.user-menu__name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-menu__caret { transition: transform var(--t-fast); }

/* User dropdown */
.user-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 210px; background: var(--bg-elevated);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  overflow: hidden;
  backdrop-filter: blur(16px);
}
.user-dropdown__header { padding: 14px 16px; }
.user-dropdown__name { color: var(--text-primary); font-size: 13px; font-weight: 600; }
.user-dropdown__email { color: var(--text-muted); font-size: 11px; margin-top: 2px; }
.user-dropdown__sep { height: 1px; background: var(--border); }
.user-dropdown__item {
  display: flex; align-items: center;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--t-fast);
  text-align: left;
}
.user-dropdown__item:hover { background: var(--bg-hover); color: var(--text-primary); }
.user-dropdown__item--danger:hover { background: var(--danger-subtle); color: var(--danger); }

/* Content */
.content-area {
  flex: 1;
  padding: var(--content-pad);
  overflow-y: auto;
  background: var(--bg-app);
}

/* Transitions */
.fade-text-enter-active, .fade-text-leave-active { transition: opacity 0.15s; }
.fade-text-enter-from, .fade-text-leave-to { opacity: 0; }

.dropdown-enter-active { animation: dd-in 0.14s ease; }
.dropdown-leave-active { animation: dd-in 0.1s ease reverse; }
@keyframes dd-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.page-fade-enter-from  { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to    { opacity: 0; transform: translateY(-4px); }

/* ── XDR status bar ──────────────────────────────────────────────────────────*/
.xdr-status-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid rgba(13,42,69,0.8);
  border-radius: 20px;
  background: rgba(2,13,26,0.5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  margin-right: 8px;
}
.xsb-item {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #4a7fa5;
}
.xsb-item.xsb-critical { color: #ef4444; }
.xsb-val { color: #a0c4dc; font-weight: 600; }
.xsb-sep { color: #0d2a45; font-size: 9px; }
.xsb-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.dot-live {
  background: #00ff9d;
  box-shadow: 0 0 5px #00ff9d80;
  animation: pulse-live 2s ease-in-out infinite;
}
@keyframes pulse-live {
  0%, 100% { opacity: 1; box-shadow: 0 0 5px #00ff9d80; }
  50% { opacity: 0.6; box-shadow: 0 0 2px #00ff9d40; }
}
</style>
