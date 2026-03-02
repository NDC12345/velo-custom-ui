<template>
  <div class="chat-view">
    <!-- Sidebar -->
    <v-navigation-drawer
      v-model="drawer"
      temporary
      class="chat-sidebar"
      width="300"
      :scrim="true"
      location="start"
    >
      <!-- Sidebar Header -->
      <div class="sidebar-header pa-4">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-plus"
          @click="createNewChat"
          rounded="xl"
          size="large"
        >
          New Chat
        </v-btn>
      </div>

      <v-divider style="border-color: var(--border);"></v-divider>

      <!-- Conversation History -->
      <div class="conversation-list">
        <v-list density="compact" class="pa-2" bg-color="transparent">
          <v-list-subheader class="text-caption" style="color: var(--text-muted);">
            RECENT CONVERSATIONS
          </v-list-subheader>
          
          <v-list-item
            v-for="conv in recentConversations"
            :key="conv.id"
            :active="currentConversationId === conv.id"
            @click="loadConversation(conv.id)"
            rounded="xl"
            class="mb-1"
          >
            <template #prepend>
              <v-icon size="18" color="var(--text-muted)">mdi-message-text</v-icon>
            </template>

            <v-list-item-title class="text-body-2" style="color: var(--text-primary);">
              {{ conv.title }}
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption" style="color: var(--text-muted);">
              {{ formatTime(conv.updatedAt) }}
            </v-list-item-subtitle>

            <template #append>
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                color="grey"
                @click.stop="deleteConversation(conv.id)"
              ></v-btn>
            </template>
          </v-list-item>
        </v-list>
      </div>

      <!-- User Profile -->
      <template #append>
        <v-divider style="border-color: var(--border);"></v-divider>
        <div class="pa-4">
          <v-list-item class="px-0" rounded="xl">
            <template #prepend>
              <v-avatar color="primary" size="40" style="border-radius: 14px;">
                <v-img v-if="userAvatar" :src="userAvatar"></v-img>
                <span v-else class="text-h6">{{ userInitials }}</span>
              </v-avatar>
            </template>

            <v-list-item-title class="text-body-2" style="color: var(--text-primary);">
              {{ userName }}
            </v-list-item-title>

            <template #append>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    color="grey"
                    v-bind="props"
                  ></v-btn>
                </template>
                
                <v-list rounded="xl">
                  <v-list-item @click="uploadAvatarDialog = true" rounded="xl">
                    <template #prepend>
                      <v-icon>mdi-account-circle</v-icon>
                    </template>
                    <v-list-item-title>Change Avatar</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="logout" rounded="xl">
                    <template #prepend>
                      <v-icon>mdi-logout</v-icon>
                    </template>
                    <v-list-item-title>Logout</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- Main Chat Area -->
    <div class="chat-main">
      <!-- Chat Header -->
      <div class="chat-header">
        <v-toolbar color="transparent" flat density="compact" class="px-2">
          <v-btn
            icon="mdi-format-list-bulleted"
            @click="drawer = !drawer"
            class="mr-1"
            size="small"
          ></v-btn>

          <v-btn
            icon="mdi-arrow-left"
            @click="goBack"
            size="small"
          ></v-btn>

          <v-spacer></v-spacer>

          <v-chip v-if="contextInfo" color="primary" variant="outlined" size="small" class="mr-2" rounded="xl">
            <v-icon start size="14">{{ contextInfo.icon }}</v-icon>
            {{ contextInfo.label }}
          </v-chip>

          <v-btn
            icon="mdi-refresh"
            @click="clearConversation"
            title="Clear conversation"
            size="small"
          ></v-btn>
        </v-toolbar>
      </div>

      <!-- Messages Container — flex-1 with scroll -->
      <div ref="messagesContainer" class="messages-container">
        <!-- Welcome Screen (when no messages) -->
        <div v-if="messages.length === 0" class="welcome-screen">
          <div class="text-center">
            <div class="ai-welcome-icon mx-auto mb-4">
              <img src="/gemini-star.svg" width="48" height="48" alt="AI" />
            </div>
            <h1 class="text-h4 font-weight-bold mt-4 mb-2">
              Velociraptor AI Assistant
            </h1>
            <p class="text-body-1 text-grey">
              Ask me anything about digital forensics, VQL queries, or incident response
            </p>

            <!-- Quick Suggestions -->
            <div class="suggestions mt-8">
              <v-row justify="center">
                <v-col
                  v-for="suggestion in quickSuggestions"
                  :key="suggestion.title"
                  cols="12"
                  md="5"
                >
                  <v-card
                    @click="sendQuickSuggestion(suggestion.prompt)"
                    class="suggestion-card"
                    hover
                    rounded="lg"
                  >
                    <v-card-text>
                      <div class="d-flex align-center mb-2">
                        <v-icon :color="suggestion.color" class="mr-2">
                          {{ suggestion.icon }}
                        </v-icon>
                        <span class="font-weight-bold">{{ suggestion.title }}</span>
                      </div>
                      <p class="text-caption text-grey mb-0">
                        {{ suggestion.description }}
                      </p>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </div>
        </div>

        <!-- Messages List -->
        <div v-else class="messages-list">
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-wrapper"
            :class="message.role"
          >
            <div class="message">
              <!-- Avatar -->
              <div
                class="message-avatar"
                :class="message.role === 'user' ? 'avatar-user' : 'avatar-ai'"
              >
                <v-img v-if="message.role === 'user' && userAvatar" :src="userAvatar" class="fill-height"></v-img>
                <v-icon v-else-if="message.role === 'user'" size="18" color="white">mdi-account</v-icon>
                <img v-else src="/gemini-star.svg" width="18" height="18" alt="AI" class="ai-avatar-icon" />
              </div>

              <!-- Message Content -->
              <div class="message-content">
                <div class="message-header mb-2">
                  <span class="font-weight-bold">
                    {{ message.role === 'user' ? userName : 'AI Assistant' }}
                  </span>
                  <span class="text-caption text-grey ml-2">
                    {{ formatTime(message.timestamp) }}
                  </span>
                </div>

                <div class="message-text" v-html="formatMessage(message.text)"></div>

                <!-- Code blocks with copy button -->
                <div v-if="message.code" class="message-code mt-3">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-caption text-grey">{{ message.codeLanguage }}</span>
                    <v-btn
                      icon="mdi-content-copy"
                      size="x-small"
                      variant="text"
                      @click="copyCode(message.code)"
                    ></v-btn>
                  </div>
                  <pre><code>{{ message.code }}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div v-if="isTyping" class="message-wrapper assistant">
            <div class="message">
              <div class="message-avatar avatar-ai">
                <img src="/gemini-star.svg" width="18" height="18" alt="AI" class="ai-avatar-icon" />
              </div>
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area — fixed at bottom of flex column -->
      <div class="input-area">
        <div class="input-inner">
          <v-textarea
            v-model="inputMessage"
            placeholder="Ask AI anything about Velociraptor..."
            variant="outlined"
            rows="1"
            auto-grow
            max-rows="5"
            hide-details
            bg-color="transparent"
            @keydown.enter.prevent="handleEnter"
            class="message-input"
            rounded="xl"
          >
            <template #append-inner>
              <v-btn
                class="send-btn-plain"
                :disabled="!inputMessage.trim() || isTyping"
                :loading="isTyping"
                @click="sendMessage"
                size="small"
                variant="text"
                title="Send message"
              >
                <v-icon class="send-icon">mdi-send</v-icon>
              </v-btn>
            </template>
          </v-textarea>
          <p class="text-caption text-center mt-2 mb-0" style="color: var(--text-muted);">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>

    <!-- Avatar Upload Dialog -->
    <v-dialog v-model="uploadAvatarDialog" max-width="460">
      <v-card rounded="xl">
        <v-card-title class="px-6 pt-6">Change Profile Picture</v-card-title>
        <v-card-text class="px-6">
          <div class="text-center py-4">
            <v-avatar size="100" class="mb-4" style="border-radius: 24px;">
              <v-img v-if="previewAvatar" :src="previewAvatar"></v-img>
              <v-img v-else-if="userAvatar" :src="userAvatar"></v-img>
              <span v-else class="text-h3">{{ userInitials }}</span>
            </v-avatar>

            <v-file-input
              v-model="avatarFile"
              accept="image/*"
              label="Choose image"
              prepend-icon="mdi-image"
              variant="outlined"
              rounded="xl"
              @change="onAvatarSelected"
            ></v-file-input>
          </div>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="uploadAvatarDialog = false" rounded="xl">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="uploadingAvatar"
            :disabled="!avatarFile"
            @click="uploadAvatar"
            rounded="xl"
          >
            Upload
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore } from '@/stores/auth'
import aiService from '@/services/ai.service'
import userService from '@/services/user.service'
import clientService from '@/services/client.service'
import { sanitizeMarkdown } from '@/utils/sanitize'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// State
const drawer = ref(false)
const messages = ref([])
const inputMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref(null)

// Context from route (for Velociraptor artifacts/hunts/alerts)
const contextData = ref(null)

// Conversations
const conversations = ref([
  {
    id: 1,
    title: 'VQL Query Help',
    updatedAt: new Date(),
  },
])
const currentConversationId = ref(1)

// Limit number of recent conversations rendered to avoid huge lists
const recentConversations = computed(() => conversations.value.slice(0, 50))

// User — use auth store instead of authService.getUser()
const userName = computed(() => authStore.user?.username || 'User')
const userInitials = computed(() => {
  const name = userName.value
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})
const userAvatar = ref(null)
const userProfile = ref(null)

// Avatar upload
const uploadAvatarDialog = ref(false)
const avatarFile = ref(null)
const previewAvatar = ref(null)
const uploadingAvatar = ref(false)

// Context info display
const contextInfo = computed(() => {
  if (!contextData.value) return null
  
  const ctx = contextData.value
  
  if (ctx.huntData) {
    return {
      icon: 'mdi-crosshairs',
      label: `Hunt: ${ctx.huntData.hunt_id || 'Active'}`
    }
  }
  
  if (ctx.clientData) {
    return {
      icon: 'mdi-laptop',
      label: `Client: ${ctx.clientData.hostname || ctx.clientData.client_id}`
    }
  }
  
  if (ctx.alertData) {
    return {
      icon: 'mdi-alert',
      label: `Alert: ${ctx.alertData.title}`
    }
  }
  
  if (ctx.artifactName) {
    return {
      icon: 'mdi-file-document',
      label: `Artifact: ${ctx.artifactName}`
    }
  }
  
  if (ctx.flowData) {
    return {
      icon: 'mdi-flow',
      label: `Flow: ${ctx.flowData.flow_id}`
    }
  }
  
  if (ctx.vqlQuery) {
    return {
      icon: 'mdi-code-braces',
      label: 'VQL Query'
    }
  }
  
  return null
})

// Helper to trim messages for performance
const trimMessages = (limit = 200) => {
  if (messages.value.length > limit) {
    messages.value = messages.value.slice(-limit)
  }
}

// Quick suggestions
const quickSuggestions = [
  {
    icon: 'mdi-code-braces',
    color: 'blue',
    title: 'Write VQL Query',
    description: 'Get help writing VQL queries for artifact collection',
    prompt: 'Help me write a VQL query to find recently modified files',
  },
  {
    icon: 'mdi-shield-alert',
    color: 'orange',
    title: 'Analyze Alert',
    description: 'Investigate security alerts and incidents',
    prompt: 'How do I investigate a suspicious process alert?',
  },
  {
    icon: 'mdi-file-search',
    color: 'green',
    title: 'Forensic Analysis',
    description: 'Learn about digital forensics techniques',
    prompt: 'What artifacts should I collect for a ransomware investigation?',
  },
  {
    icon: 'mdi-book-open-variant',
    color: 'purple',
    title: 'Learn Velociraptor',
    description: 'Understand Velociraptor features and capabilities',
    prompt: 'Explain how Velociraptor hunts work',
  },
]

// Methods
const createNewChat = () => {
  const newId = conversations.value.length + 1
  conversations.value.unshift({
    id: newId,
    title: 'New Conversation',
    updatedAt: new Date(),
  })
  currentConversationId.value = newId
  messages.value = []
}

const loadConversation = (id) => {
  currentConversationId.value = id
  // TODO: Load messages from backend
  messages.value = []
}

const deleteConversation = (id) => {
  conversations.value = conversations.value.filter(c => c.id !== id)
  if (currentConversationId.value === id && conversations.value.length > 0) {
    currentConversationId.value = conversations.value[0].id
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  const userMessage = {
    id: Date.now(),
    role: 'user',
    text: inputMessage.value,
    timestamp: new Date(),
  }

  messages.value.push(userMessage)
  // Keep messages bounded for performance
  trimMessages()
  const userInput = inputMessage.value
  inputMessage.value = ''

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  // Send to AI with context
  isTyping.value = true

  try {
    // Build API call with optional Velociraptor context
    const options = {}

    // Add Velociraptor context if available
    if (contextData.value) {
      options.context = contextData.value
    }

    const response = await aiService.chat(userInput, options)

    const aiMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      text: response.data?.message || response.message || 'No response',
      timestamp: new Date(),
    }

    messages.value.push(aiMessage)
    // Trim message history to keep memory use reasonable
    trimMessages()

    // Update conversation title if first message
    if (messages.value.length === 2) {
      const conv = conversations.value.find(c => c.id === currentConversationId.value)
      if (conv) {
        conv.title = userInput.slice(0, 50) + (userInput.length > 50 ? '...' : '')
        conv.updatedAt = new Date()
      }
    }
  } catch (error) {
    console.error('AI chat error:', error)
    
    const errorMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      text: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
      timestamp: new Date(),
    }

    messages.value.push(errorMessage)
    trimMessages()
  } finally {
    isTyping.value = false
    await nextTick()
    scrollToBottom()
  }
}

const goBack = () => {
  router.back()
}

const clearConversation = () => {
  if (confirm('Clear this conversation? This cannot be undone.')) {
    messages.value = []
    contextData.value = null
    
    // Reset conversation title
    const conv = conversations.value.find(c => c.id === currentConversationId.value)
    if (conv) {
      conv.title = 'New Conversation'
      conv.updatedAt = new Date()
    }
  }
}

const sendQuickSuggestion = (prompt) => {
  inputMessage.value = prompt
  sendMessage()
}

const handleEnter = (event) => {
  if (!event.shiftKey) {
    sendMessage()
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

const formatMessage = (text) => {
  if (!text) return ''

  // Split text into code-block segments and plain-text segments
  const parts = []
  let lastIndex = 0
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g
  let m
  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, m.index) })
    parts.push({ type: 'code', lang: m[1] || 'code', content: m[2] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) })

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const fmtText = (s) => {
    // Escape HTML FIRST to prevent injection through bold/italic/heading content
    const safe = esc(s)
    return safe
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/^### (.+)$/gm, '<h3 class="msg-h">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="msg-h">$1</h3>')
      .replace(/^# (.+)$/gm, '<h3 class="msg-h">$1</h3>')
      .replace(/^[-*] (.+)$/gm, '<li class="msg-li">$1</li>')
      .replace(/\n/g, '<br>')
  }

  const raw = parts.map((p, i) => {
    if (p.type === 'text') return fmtText(p.content)
    const blockId = `vcb_${Date.now()}_${i}`
    const lang = esc(p.lang || 'code')
    return `<div class="msg-code-block" id="${blockId}">
  <div class="msg-code-header">
    <span class="msg-code-lang">${lang}</span>
    <button class="msg-code-copy" onclick="window.__veloAiCopy('${blockId}')">Copy</button>
  </div>
  <pre class="msg-code-pre"><code>${esc(p.content.trimEnd())}</code></pre>
</div>`
  }).join('')

  return sanitizeMarkdown(raw)
}

const copyCode = (code) => {
  navigator.clipboard.writeText(code)
}

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}

// Avatar upload
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const onAvatarSelected = (event) => {
  if (avatarFile.value && avatarFile.value.length > 0) {
    const file = avatarFile.value[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      previewAvatar.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const uploadAvatar = async () => {
  if (!avatarFile.value || avatarFile.value.length === 0) return

  uploadingAvatar.value = true

  try {
    const file = avatarFile.value[0]
    const dataUri = await fileToDataUrl(file)
    const avatarUrl = await userService.uploadAvatarBase64(dataUri)

    // Update local state
    userAvatar.value = userService.getAvatarUrl(avatarUrl)

    uploadAvatarDialog.value = false
    avatarFile.value = null
    previewAvatar.value = null
  } catch (error) {
    console.error('Avatar upload error:', error)
    alert('Failed to upload avatar. Please try again.')
  } finally {
    uploadingAvatar.value = false
  }
}

// Load user profile on mount
const loadUserProfile = async () => {
  try {
    userProfile.value = await userService.getProfile()
    if (userProfile.value?.avatar_url) {
      userAvatar.value = userService.getAvatarUrl(userProfile.value.avatar_url)
    }
  } catch (error) {
    console.error('Failed to load user profile:', error)
  }
}

// Load context from route
const loadContextFromRoute = async () => {
  const query = route.query
  
  // Check if context is passed via query params
  if (query.context) {
    try {
      contextData.value = JSON.parse(decodeURIComponent(query.context))
      console.log('Loaded context:', contextData.value)
    } catch (error) {
      console.error('Failed to parse context:', error)
    }
  } else {
    // Check individual context fields
    const context = {}
    
    if (query.huntId) {
      context.huntData = {
        hunt_id: query.huntId,
        artifact_names: query.artifactNames?.split(','),
        state: query.huntState
      }
    }
    
    if (query.clientId) {
      // Try to fetch client details from API to avoid hardcoded/partial data
      try {
        const clientId = query.clientId
        const clientResp = await clientService.getClient(clientId)
        context.clientData = clientResp || {
          client_id: clientId,
          hostname: query.hostname,
          os_info: query.osInfo
        }
      } catch (err) {
        // fallback to query values if API fetch fails
        context.clientData = {
          client_id: query.clientId,
          hostname: query.hostname,
          os_info: query.osInfo
        }
        console.error('Failed to fetch client details:', err)
      }
    }
    
    if (query.alertId) {
      context.alertData = {
        title: query.alertTitle,
        severity: query.alertSeverity
      }
    }
    
    if (query.artifactName) {
      context.artifactName = query.artifactName
    }
    
    if (query.flowId) {
      context.flowData = {
        flow_id: query.flowId,
        artifacts_with_results: query.flowArtifacts?.split(',')
      }
    }
    
    if (query.vqlQuery) {
      context.vqlQuery = decodeURIComponent(query.vqlQuery)
    }
    
    if (Object.keys(context).length > 0) {
      contextData.value = context
      console.log('Loaded context from query params:', contextData.value)
    }
  }
}

// Watch messages to auto-scroll
watch(messages, async () => {
  await nextTick()
  scrollToBottom()
}, { deep: true })

onMounted(async () => {
  loadUserProfile()
  await loadContextFromRoute()
  scrollToBottom()

  // Global handler for code-block copy buttons rendered via v-html
  window.__veloAiCopy = (blockId) => {
    const el = document.getElementById(blockId)
    if (!el) return
    const code = el.querySelector('code')?.textContent || ''
    navigator.clipboard.writeText(code).then(() => {
      const btn = el.querySelector('.msg-code-copy')
      if (btn) {
        btn.textContent = 'Copied!'
        btn.classList.add('copied')
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 2000)
      }
    }).catch(() => {})
  }
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  background: var(--bg-app);
  overflow: hidden;
}

.chat-sidebar {
  background: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border) !important;
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0 !important;
}

.sidebar-header {
  background: var(--bg-elevated);
  border-radius: 0 var(--radius-lg) 0 0;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-bottom: 24px;
}

/* Ensure drawer doesn't cause layout shift */
.v-navigation-drawer--temporary {
  position: fixed !important;
}

/* ── Main Chat Layout ── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
}

.chat-header {
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 10;
}

/* Messages container fills remaining space between header and input */
.messages-container {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 24px 120px 24px; /* Extra bottom padding to prevent overlap */
  min-height: 0;
  max-height: 100%;
  position: relative;
}

/* Add smooth scrolling */
.messages-container {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
}

.welcome-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px; /* Changed from height: 100% to min-height */
  padding: 48px 24px;
}

.suggestions {
  max-width: 800px;
  margin: 0 auto;
}

.suggestion-card {
  cursor: pointer;
  transition: border-color 0.2s;
  background: var(--bg-elevated) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-lg) !important;
}

.suggestion-card:hover {
  background: var(--bg-hover) !important;
  border-color: var(--border-focus) !important;
}

.messages-list {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.message-wrapper {
  margin-bottom: 20px;
}

.message {
  display: flex;
  gap: 14px;
}

.message-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 14px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-user {
  background: linear-gradient(135deg, #388bfd, #5a6fd6);
}

.avatar-ai {
  background: linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6);
}

.ai-avatar-icon {
  filter: brightness(0) invert(1);
  flex-shrink: 0;
}

/* AI header icon */
.ai-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6);
  flex-shrink: 0;
}
.ai-header-icon img {
  filter: brightness(0) invert(1);
}

/* AI welcome icon */
.ai-welcome-icon {
  width: 90px;
  height: 90px;
  border-radius: 28px;
  background: linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4);
}
.ai-welcome-icon img {
  filter: brightness(0) invert(1);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-text {
  line-height: 1.7;
  word-wrap: break-word;
  color: var(--text-primary);
  font-size: 14px;
}

.message-text :deep(code) {
  background: rgba(56, 139, 253, 0.1);
  padding: 2px 6px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--accent-hover);
}

/* Code block heading + list */
.message-text :deep(.msg-h) {
  font-size: 14px;
  font-weight: 700;
  margin: 10px 0 4px;
  color: var(--text-primary);
}
.message-text :deep(.msg-li) {
  margin-left: 16px;
  list-style-type: disc;
  display: list-item;
}

/* ── Fenced code blocks (rendered via formatMessage) ── */
.message-text :deep(.msg-code-block) {
  margin: 12px 0;
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: #0d1117;
}

.message-text :deep(.msg-code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #161b22;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.message-text :deep(.msg-code-lang) {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #79c0ff;
  font-family: 'JetBrains Mono', monospace;
}

.message-text :deep(.msg-code-copy) {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.message-text :deep(.msg-code-copy:hover) {
  background: rgba(255,255,255,0.08);
  color: #e6edf3;
  border-color: rgba(255,255,255,0.3);
}
.message-text :deep(.msg-code-copy.copied) {
  color: #3fb950;
  border-color: #3fb950;
}

.message-text :deep(.msg-code-pre) {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background: transparent;
}
.message-text :deep(.msg-code-pre code) {
  background: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e6edf3;
}

.message-code {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  overflow: hidden;
}

.message-code pre {
  margin: 0;
  overflow-x: auto;
}

.message-code code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

.typing-indicator {
  display: flex;
  gap: 5px;
  padding: 14px 18px;
  background: var(--bg-elevated);
  border-radius: 18px;
  width: fit-content;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; }
  30% { opacity: 1; }
}

/* ── Input Area — sits at bottom, never overlaps ── */
.input-area {
  flex: 0 0 auto;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  padding: 20px 24px 16px;
  z-index: 100;
  position: relative;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
}

.input-inner {
  max-width: 900px;
  margin: 0 auto;
}

.message-input :deep(.v-field) {
  border: 1px solid var(--border);
  border-radius: 18px !important;
  background: var(--bg-elevated);
}

.message-input :deep(.v-field:focus-within) {
  border-color: var(--border-focus);
}

.message-input :deep(textarea) {
  line-height: 1.6;
  font-size: 14px;
  color: var(--text-primary);
}

/* Styled send button for chat input */
.send-btn-plain {
  padding: 6px 8px;
  min-width: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  color: var(--accent-hover);
}
.send-btn-plain .send-icon { font-size: 18px; }
.send-btn-plain[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.send-btn-plain .v-progress-circular { color: var(--accent-hover) !important; }
</style>
