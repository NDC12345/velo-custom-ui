import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import './assets/tailwind.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   30_000,   // 30 s – treat data as fresh
      gcTime:      300_000,  // 5 min – keep in cache
      retry:       2,
      retryDelay:  (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
