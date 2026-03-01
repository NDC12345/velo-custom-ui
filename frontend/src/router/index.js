import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: '/clients',
          name: 'clients',
          component: () => import('@/views/ClientsView.vue'),
        },
        {
          path: '/clients/:id',
          name: 'client-detail',
          component: () => import('@/views/ClientDetailView.vue'),
        },
        {
          path: '/workspace',
          redirect: '/clients',
        },
        {
          path: '/hunts',
          name: 'hunts',
          component: () => import('@/views/HuntsView.vue'),
        },
        {
          path: '/events',
          name: 'events',
          component: () => import('@/views/EventsView.vue'),
        },
        {
          path: '/reports',
          name: 'reports',
          component: () => import('@/views/ReportsView.vue'),
        },
        {
          path: '/vfs',
          name: 'vfs',
          component: () => import('@/views/VFSView.vue'),
        },
        {
          path: '/artifacts',
          name: 'artifacts',
          component: () => import('@/views/ArtifactsView.vue'),
        },
        {
          path: '/vql',
          name: 'vql',
          component: () => import('@/views/VQLView.vue'),
        },
        {
          path: '/server-admin',
          name: 'server-admin',
          component: () => import('@/views/ServerAdminView.vue'),
        },
        {
          path: '/notebooks',
          name: 'notebooks',
          component: () => import('@/views/NotebooksView.vue'),
        },
        {
          path: '/tools',
          name: 'tools',
          component: () => import('@/views/ToolsView.vue'),
        },
        {
          path: '/secrets',
          name: 'secrets',
          component: () => import('@/views/SecretsView.vue'),
        },
        {
          path: '/downloads',
          name: 'downloads',
          component: () => import('@/views/DownloadsView.vue'),
        },
        {
          path: '/timeline',
          name: 'timeline',
          component: () => import('@/views/TimelineView.vue'),
        },
        {
          path: '/users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
        },
        {
          path: '/flows/:flowId',
          name: 'flow-detail',
          component: () => import('@/views/FlowDetailView.vue'),
        },
        {
          path: '/settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
