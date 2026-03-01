# VELO Custom UI — Frontend Comprehensive Audit

> **Generated:** Exhaustive inventory of every file in `velo-custom-ui/frontend/src/`
> **Framework:** Vue 3.4.15 + Vite 5.0.11 + Vuetify 3.5.1 + Pinia 2.1.7

---

## Table of Contents

1. [Tech Stack & Dependencies](#1-tech-stack--dependencies)
2. [Architecture Overview](#2-architecture-overview)
3. [Router Configuration](#3-router-configuration)
4. [Stores (Pinia)](#4-stores-pinia)
5. [Services (API Layer)](#5-services-api-layer)
6. [Views — Full Inventory](#6-views--full-inventory)
7. [Components](#7-components)
8. [Layout & Theme](#8-layout--theme)
9. [Real-Time / Polling Patterns](#9-real-time--polling-patterns)
10. [API Endpoint Master List](#10-api-endpoint-master-list)
11. [Issues & Inconsistencies](#11-issues--inconsistencies)
12. [Missing Features vs. Standard Velociraptor GUI](#12-missing-features-vs-standard-velociraptor-gui)

---

## 1. Tech Stack & Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vue` | 3.4.15 | Core framework |
| `vue-router` | 4.2.5 | Client-side routing (history mode) |
| `pinia` | 2.1.7 | State management |
| `vuetify` | 3.5.1 | Material Design component library |
| `axios` | 1.6.5 | HTTP client |
| `chart.js` | 4.4.1 | Charting engine |
| `vue-chartjs` | 5.3.0 | Vue wrapper for Chart.js (imported but unused — raw Chart.js used) |
| `@mdi/font` | 7.4.47 | Material Design Icons |
| `date-fns` | 3.2.0 | Date formatting |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | 5.0.11 | Build tool |
| `@vitejs/plugin-vue` | 5.0.3 | Vue SFC compilation |
| `vite-plugin-vuetify` | 2.0.1 | Vuetify tree-shaking & styles |
| `eslint` | 8.56.0 | Linting |
| `eslint-plugin-vue` | 9.20.1 | Vue-specific lint rules |

### Auth Pattern

- **Tokens:** HttpOnly cookies for `access_token` and `refresh_token`
- **CSRF:** Non-HttpOnly `csrf_token` cookie read by JS and injected as `X-CSRF-Token` header on non-GET requests
- **Token Refresh:** Axios response interceptor catches 401, queues concurrent requests, calls `POST /api/auth/refresh`, replays queue
- **User Profile:** Stored in `sessionStorage` under key `velo_user`

---

## 2. Architecture Overview

```
src/
├── main.js                    # App bootstrap (Pinia, Router, Vuetify)
├── App.vue                    # Root shell: <v-app :theme="veloTI"><router-view/>
├── router/index.js            # Route definitions + auth guard
├── plugins/vuetify.js         # Vuetify config, custom dark theme "veloTI"
├── styles/theme.css           # CSS design system (449 lines)
├── layouts/MainLayout.vue     # Sidebar + topbar shell (547 lines)
├── stores/                    # 4 Pinia stores
├── services/                  # 21 service modules
├── views/                     # 22+ view components
│   └── auth/                  # LoginView, RegisterView (alternative auth views)
└── components/
    ├── AskAIButton.vue        # Floating AI assistant panel (708 lines)
    └── charts/                # 7 Chart.js wrappers
```

**Composition Pattern:** Almost all files use `<script setup>` (Composition API). Exceptions:
- `NotebooksView.vue` — Options API (`export default {}`)
- `UsersView.vue` — Options API (`export default {}`)

---

## 3. Router Configuration

**File:** `src/router/index.js`
**Mode:** `createWebHistory()`
**Auth Guard:** `beforeEach` — redirects to `/login` if `requiresAuth` and no `velo_user` in sessionStorage; redirects to `/` if already authenticated and visiting `/login`.

| Route Path | View Component | Auth Required | Parent Layout | Notes |
|---|---|---|---|---|
| `/login` | `LoginView.vue` | No | None | Split-pane branded login |
| `/chat` | `ChatView.vue` | Yes | None (standalone) | Full-screen AI chat |
| `/` | `DashboardView.vue` | Yes | `MainLayout` | Home dashboard |
| `/clients` | `ClientsView.vue` | Yes | `MainLayout` | Endpoint browser with tabs |
| `/clients/:id` | `ClientDetailView.vue` | Yes | `MainLayout` | Single client detail |
| `/workspace` | — | Yes | `MainLayout` | Redirects to `/clients` |
| `/hunts` | `HuntsView.vue` | Yes | `MainLayout` | Hunt manager |
| `/alerts` | `AlertsView.vue` | Yes | `MainLayout` | Alert list |
| `/events` | `EventsView.vue` | Yes | `MainLayout` | Server event viewer |
| `/cases` | `CasesView.vue` | Yes | `MainLayout` | Notebook-based case management |
| `/reports` | `ReportsView.vue` | Yes | `MainLayout` | Report card grid |
| `/vfs` | `VFSView.vue` | Yes | `MainLayout` | Standalone VFS browser |
| `/artifacts` | `ArtifactsView.vue` | Yes | `MainLayout` | Artifact manager |
| `/vql` | `VQLView.vue` | Yes | `MainLayout` | VQL query lab |
| `/server-admin` | `ServerAdminView.vue` | Yes | `MainLayout` | Users/Monitoring/Tools/Secrets |
| `/notebooks` | `NotebooksView.vue` | Yes | `MainLayout` | Notebook editor |
| `/tools` | `ToolsView.vue` | Yes | `MainLayout` | Tool binary list |
| `/secrets` | `SecretsView.vue` | Yes | `MainLayout` | Secret definitions |
| `/downloads` | `DownloadsView.vue` | Yes | `MainLayout` | Download queue |
| `/timeline` | `TimelineView.vue` | Yes | `MainLayout` | Timeline viewer + annotations |
| `/users` | `UsersView.vue` | Yes | `MainLayout` | User CRUD |
| `/flows/:flowId` | `FlowDetailView.vue` | Yes | `MainLayout` | Flow results/logs/request |
| `/settings` | `SettingsView.vue` | Yes | `MainLayout` | Profile, connection, AI, security |

**Additional non-routed views:**
- `ClientWorkspaceView.vue` — Multi-tab workspace using `clientTabsStore`, embeds `ClientDetailView` per tab
- `views/auth/LoginView.vue` — Simpler login form variant (not currently routed)
- `views/auth/RegisterView.vue` — Registration form with Velo server URL (not currently routed)

---

## 4. Stores (Pinia)

### 4.1 `stores/auth.js`

| Property | Type | Description |
|---|---|---|
| `user` | `ref(null)` | Current user object |

| Action | API Call | Description |
|---|---|---|
| `login(credentials)` | `POST /api/auth/login` | Authenticates, stores user in sessionStorage |
| `logout()` | `POST /api/auth/logout` | Clears session, removes sessionStorage |
| `fetchCurrentUser()` | `GET /api/auth/me` | Loads current user profile |
| `changePassword(data)` | `POST /api/auth/change-password` | Changes password |
| `register(data)` | `POST /api/auth/register` | Creates new account |

### 4.2 `stores/client.js`

| Property | Type | Description |
|---|---|---|
| `clients` | `ref([])` | Client list |
| `currentClient` | `ref(null)` | Selected client |
| `loading` | `ref(false)` | Loading state |
| `error` | `ref(null)` | Error state |

| Action | API Call | Description |
|---|---|---|
| `fetchClients(params)` | `GET /api/clients` | Fetches client list (with AbortController) |
| `fetchClient(id)` | `GET /api/clients/:id` | Fetches single client |
| `labelClient(id, labels, op)` | `POST /api/clients/label` | Add/remove labels |
| `deleteClient(id)` | `DELETE /api/clients/:id` | Deletes client |

### 4.3 `stores/clientTabs.js`

| Property | Type | Description |
|---|---|---|
| `tabs` | `ref([])` | Array of open client tab objects |
| `activeTabId` | `ref(null)` | Currently active tab ID |

| Action | Description |
|---|---|
| `openTab(client)` | Opens or activates a tab for a client |
| `closeTab(id)` | Closes a tab |
| `setActive(id)` | Switches active tab |
| `updateTab(id, data)` | Updates tab metadata |
| `closeAll()` | Closes all tabs |
| `isOnline(client)` | Checks if `last_seen_at` is within 1 hour |

### 4.4 `stores/hunt.js`

| Property | Type | Description |
|---|---|---|
| `hunts` | `ref([])` | Hunt list |
| `currentHunt` | `ref(null)` | Selected hunt |
| `loading`, `error` | `ref` | State flags |

| Action | API Call | Description |
|---|---|---|
| `fetchHunts()` | `GET /api/hunts` | Loads all hunts |
| `fetchHunt(id)` | `GET /api/hunts/:id` | Load single hunt |
| `createHunt(data)` | `POST /api/hunts` | Create new hunt |
| `modifyHunt(id, data)` | `PATCH /api/hunts/:id` | Modify hunt state |
| `deleteHunt(id)` | `DELETE /api/hunts/:id` | Delete hunt |

---

## 5. Services (API Layer)

### 5.1 `services/api.js` — Axios Instance

- Base URL: `import.meta.env.VITE_API_URL` or `''` (relative)
- Timeout: 8000ms
- `withCredentials: true`
- **Request interceptor:** Injects `X-CSRF-Token` from `csrf_token` cookie for non-GET requests
- **Response interceptor:** 401 → attempts `POST /api/auth/refresh`, queues concurrent requests, replays on success

### 5.2 `services/auth.service.js`

| Method | Endpoint | Description |
|---|---|---|
| `login(data)` | `POST /api/auth/login` | Login |
| `logout()` | `POST /api/auth/logout` | Logout |
| `getCurrentUser()` | `GET /api/auth/me` | Get current user |
| `refreshToken()` | `POST /api/auth/refresh` | Refresh access token |
| `getUser()` | sessionStorage | Read cached user |

### 5.3 `services/client.service.js`

| Method | Endpoint |
|---|---|
| `getClients(params)` | `GET /api/clients` |
| `getClient(id)` | `GET /api/clients/:id` |
| `getClientFlows(id)` | `GET /api/clients/:id/flows` |
| `getClientMetadata(id)` | `GET /api/clients/:id/metadata` |
| `updateClientMetadata(id, data)` | `POST /api/clients/:id/metadata` |
| `labelClient(data)` | `POST /api/clients/label` |
| `sendClientNotification(id, data)` | `POST /api/clients/:id/notify` |
| `deleteClient(id)` | `DELETE /api/clients/:id` |
| `searchClients(query)` | `GET /api/clients?search=...` |

### 5.4 `services/hunt.service.js`

| Method | Endpoint |
|---|---|
| `getHunts(params)` | `GET /api/hunts` |
| `getHunt(id)` | `GET /api/hunts/:id` |
| `createHunt(data)` | `POST /api/hunts` |
| `estimateHunt(data)` | `POST /api/hunts/estimate` |
| `modifyHunt(id, data)` | `PATCH /api/hunts/:id` |
| `deleteHunt(id)` | `DELETE /api/hunts/:id` |
| `getHuntResults(id)` | `GET /api/hunts/:id/results` |
| `getHuntStats(id)` | `GET /api/hunts/:id/stats` |
| `getHuntFlows(id)` | `GET /api/hunts/:id/flows` |
| `getHuntTags(id)` | `GET /api/hunts/:id/tags` |

### 5.5 `services/artifact.service.js`

| Method | Endpoint |
|---|---|
| `getArtifacts(params)` | `GET /api/artifacts` |
| `getArtifact(name)` | `GET /api/artifacts/:name` |
| `getArtifactFile(name)` | `GET /api/artifacts/:name/file` |
| `createArtifact(data)` | `POST /api/artifacts` |
| `packArtifact(data)` | `POST /api/artifacts/pack` |
| `deleteArtifact(name)` | `DELETE /api/artifacts/:name` |

### 5.6 `services/flow.service.js`

| Method | Endpoint |
|---|---|
| `collectArtifact(data)` | `POST /api/flows/collect` |
| `getFlowDetails(clientId, flowId)` | `GET /api/flows/:id` |
| `getFlowResults(clientId, flowId, artifact)` | `GET /api/flows/:id/results` |
| `getFlowRequests(flowId)` | `GET /api/flows/:id/requests` |
| `cancelFlow(flowId, clientId)` | `POST /api/flows/:id/cancel` |
| `resumeFlow(flowId)` | `POST /api/flows/:id/resume` |
| `archiveFlow(flowId)` | `POST /api/flows/:id/archive` |

### 5.7 `services/vql.service.js`

| Method | Endpoint |
|---|---|
| `executeQuery(vql, params)` | `POST /api/query` |
| `getCompletions()` | `GET /api/completions` |
| `reformatVQL(vql)` | `POST /api/vql/reformat` |

### 5.8 `services/dashboard.service.js`

Aggregation service — no direct Velociraptor endpoint equivalent.

| Method | Aggregates From |
|---|---|
| `getStats()` | `GET /api/clients` + `GET /api/hunts` + `GET /api/server/metrics` |
| `getClientActivity()` | `GET /api/clients` (calculates 14-day activity) |
| `getActiveAlerts()` | `GET /api/server/monitoring` (derives alerts from metrics) |
| `getEventTimeline()` | `GET /api/server/monitoring` |

### 5.9 `services/ai.service.js`

| Method | Endpoint |
|---|---|
| `chat(message, options)` | `POST /api/ai/chat` |
| `analyzeVQL(vql)` | `POST /api/ai/analyze-vql` |
| `suggestArtifacts(description)` | `POST /api/ai/suggest-artifacts` |
| `getStatus()` | `GET /api/ai/status` |
| `clearHistory()` | `DELETE /api/ai/chat/history` |
| `getProviders()` | `GET /api/ai/providers` |
| `getProviderConfig()` | `GET /api/ai/provider` |
| `saveProviderConfig(data)` | `PUT /api/ai/provider` |
| `testProvider(data)` | `POST /api/ai/provider/test` |
| `listModels(data)` | `POST /api/ai/provider/models` |

### 5.10 `services/case.service.js` — **ALL STUBS / NOT IMPLEMENTED**

Every method returns empty arrays/null with `// TODO:` comments. No backend support.

### 5.11 `services/event.service.js`

| Method | Endpoint |
|---|---|
| `getServerEvents(params)` | `POST /api/server/events` |
| `getActiveAlerts()` | `GET /api/server/monitoring` (derives alerts from CPU/memory thresholds + event text matching) |

### 5.12 `services/notebook.service.js`

| Method | Endpoint |
|---|---|
| `getNotebooks(params)` | `GET /api/notebooks` |
| `getNotebook(id)` | `GET /api/notebooks/:id` |
| `createNotebook(data)` | `POST /api/notebooks` |
| `updateNotebook(id, data)` | `PUT /api/notebooks/:id` |
| `deleteNotebook(id)` | `DELETE /api/notebooks/:id` |
| `createCell(nbId, data)` | `POST /api/notebooks/:id/cells` |
| `getCell(nbId, cellId)` | `GET /api/notebooks/:id/cells/:cellId` |
| `updateCell(nbId, cellId, data)` | `PUT /api/notebooks/:id/cells/:cellId` |
| `revertCell(nbId, cellId)` | `POST /api/notebooks/:id/cells/:cellId/revert` |
| `cancelCell(nbId, cellId)` | `POST /api/notebooks/:id/cells/:cellId/cancel` |
| `exportNotebook(id, format)` | `GET /api/notebooks/:id/export` |
| `downloadNotebook(id)` | `GET /api/notebooks/:id/download` |
| `uploadAttachment(id, file)` | `POST /api/notebooks/:id/attachment` |

### 5.13 `services/reports.service.js` — **⚠ Missing /api prefix**

| Method | Endpoint (WRONG) | Should Be |
|---|---|---|
| `generateReport(data)` | `POST /reports/generate` | `POST /api/reports/generate` |
| `getReportStatus(id)` | `GET /reports/:id/status` | — |
| `downloadReport(id)` | `GET /reports/:id/download` | — |
| `getTemplates()` | `GET /reports/templates` | — |
| `deleteReport(id)` | `DELETE /reports/:id` | — |

### 5.14 `services/server.service.js` (220 lines — largest service)

| Method | Endpoint |
|---|---|
| `getUsers()` | `GET /api/users` |
| `setUser(data)` | `POST /api/users` |
| `deleteUser(name)` | `DELETE /api/users/:name` |
| `setUserRoles(name, roles)` | `POST /api/users/:name/roles` |
| `setUserPassword(name, password)` | `POST /api/users/:name/password` |
| `getUserGUIOptions(name)` | `GET /api/users/:name/gui` |
| `getServerMetrics()` | `GET /api/server/metrics` |
| `getServerMonitoring()` | `GET /api/server/monitoring` |
| `setServerMonitoring(data)` | `POST /api/server/monitoring` |
| `getClientMonitoring()` | `GET /api/server/client-monitoring` |
| `getAvailableEvents()` | `GET /api/events/available` |
| `pushEvents(data)` | `POST /api/events/push` |
| `getTools()` | `GET /api/tools` |
| `createTool(data)` | `POST /api/tools` |
| `getSecretDefinitions()` | `GET /api/secrets` |
| `defineSecret(data)` | `POST /api/secrets` |
| `addSecret(type, data)` | `PUT /api/secrets/:type` |
| `getSecret(type)` | `GET /api/secrets/:type` (undocumented) |
| `getDownloads()` | `GET /api/downloads` |
| `getTable(params)` | `GET /api/table` |
| `getReports()` | `GET /api/reports` |
| `getTimelines()` | `GET /api/timelines` |
| `searchFiles(clientId, params)` | `POST /api/file-search` |
| `getDocs(artifact)` | `GET /api/docs/:artifact` |
| `uploadFile(file)` | `POST /api/uploads` |
| `getClientConfig(params)` | `POST /api/client/config` |

### 5.15 `services/vfs.service.js`

| Method | Endpoint |
|---|---|
| `listDirectory(clientId, path)` | `GET /api/vfs/:clientId` |
| `downloadFile(clientId, path)` | `GET /api/vfs/:clientId/download` |
| `getFileStat(clientId, path)` | `GET /api/vfs/:clientId/stat` |
| `statDir(clientId, path)` | `GET /api/vfs/:clientId/stat-dir` |
| `statDownload(clientId, path)` | `GET /api/vfs/:clientId/stat-download` |
| `createDownload(clientId, path)` | `POST /api/vfs/:clientId/download` |
| `refreshDir(clientId, path)` | `POST /api/vfs/:clientId/refresh` |

### 5.16 `services/user.service.js`

| Method | Endpoint |
|---|---|
| `getProfile()` | `GET /api/user/profile` |
| `updateProfile(data)` | `PUT /api/user/profile` |
| `uploadAvatar(file)` | `POST /api/user/avatar` (multipart) |
| `uploadAvatarBase64(dataUri)` | `POST /api/user/avatar` (base64 body) |
| `deleteAvatar()` | `DELETE /api/user/avatar` |
| `getAvatarUrl(path)` | Constructs avatar URL |

### 5.17 `services/downloads.service.js` — **⚠ Missing /api prefix**

| Method | Endpoint (WRONG) |
|---|---|
| `createDownload(data)` | `POST /downloads` |
| `listDownloads()` | `GET /downloads` |
| `deleteDownload(id)` | `DELETE /downloads/:id` |
| `downloadFile(id, name)` | `GET /downloads/:id/file` |
| `cancelDownload(id)` | `POST /downloads/:id/cancel` |

### 5.18 `services/secrets.service.js` — **⚠ Missing /api prefix**

| Method | Endpoint (WRONG) |
|---|---|
| `getSecretDefinitions()` | `GET /secrets` |
| `defineSecret(data)` | `POST /secrets` |
| `updateSecret(data)` | `PUT /secrets` |
| `deleteSecret(type)` | `DELETE /secrets/:type` |

### 5.19 `services/tag.service.js`

| Method | Endpoint |
|---|---|
| `getClientTags(clientId)` | `GET /api/tags/:clientId` |
| `addTag(clientId, data)` | `POST /api/tags/:clientId` |
| `updateTag(tagId, data)` | `PUT /api/tags/:tagId` |
| `deleteTag(tagId)` | `DELETE /api/tags/:tagId` |
| `getSettings()` | `GET /api/settings` |
| `updateSetting(key, value)` | `PUT /api/settings/:key` |

### 5.20 `services/timeline.service.js` — **⚠ Missing /api prefix**

| Method | Endpoint (WRONG) |
|---|---|
| `getTimeline(params)` | `POST /timelines` |
| `annotateTimeline(data)` | `POST /timelines/annotate` |
| `getAnnotations(id)` | `GET /timelines/:id/annotations` |
| `deleteAnnotation(id)` | `DELETE /timelines/:id/annotations` |

### 5.21 `services/tools.service.js` — **⚠ Missing /api prefix**

| Method | Endpoint (WRONG) |
|---|---|
| `getTools()` | `GET /tools` |
| `createTool(data)` | `POST /tools` |
| `uploadTool(file)` | `POST /uploads/tool` |
| `deleteTool(name)` | `DELETE /tools/:name` |

---

## 6. Views — Full Inventory

### 6.1 `DashboardView.vue` (955 lines)

- **Route:** `/`
- **Velociraptor Mapping:** Custom aggregation dashboard — no direct Velociraptor equivalent
- **Features:**
  - 4 animated KPI cards (Active Clients, Open Incidents, Active Cases, Threat Alerts) with sparkline charts
  - Threat Detection area chart (14-day rolling)
  - Incident Status doughnut chart
  - Case Activity bar chart (weekly)
  - Server Metrics panel (CPU, Memory, Disk progress bars)
  - Hunt Activities table (top 5 hunts)
  - Case Summary section
  - Recent Endpoints ticker (last 8 clients)
  - Skeleton loading states
- **API Calls:** `dashboardService.getStats()` (aggregates `/api/clients` + `/api/hunts` + `/api/server/metrics`), `dashboardService.getClientActivity()`, `dashboardService.getActiveAlerts()`, direct `GET /api/clients`, direct `GET /api/hunts`
- **Charts Used:** `SparklineChart`, `AreaChart`, `DoughnutChart`
- **State:** `useClientTabsStore` (for opening clients from ticker)
- **Polling:** 30s `setInterval`

### 6.2 `ClientsView.vue` (~350 lines)

- **Route:** `/clients`
- **Velociraptor Mapping:** Search Clients / Client List
- **Features:**
  - Browser-style tab bar: pinned "Clients" tab + dynamic client tabs
  - Stat strip: Total / Online / Offline / Windows / Linux / macOS counts
  - Search + OS filter + Status filter
  - `v-data-table` with columns: Status dot, Hostname, Client ID, OS, IP, Last Seen, Labels
  - Inline client detail via embedded `ClientDetailView` in tabs
  - Delete client confirmation dialog
  - Copy client ID to clipboard
- **API Calls:** `clientStore.fetchClients()`
- **State:** `useClientStore`, `useClientTabsStore`
- **Polling:** 60s `setInterval`

### 6.3 `ClientDetailView.vue` (980 lines)

- **Route:** `/clients/:id` and embedded mode (`embedded` prop)
- **Velociraptor Mapping:** Client Overview / Collected Artifacts / VQL Drilldown / Shell / VFS
- **Features (5 tabs):**
  1. **Overview:** System info, Network info, Label CRUD (add/remove chips)
  2. **Collections:** Flow table, collect artifact dialog (autocomplete from `/api/artifacts`), view flow results in dialog, cancel flow
  3. **VQL:** Textarea editor, execute via `POST /api/query` (notebook-based with polling for cell output)
  4. **Shell:** Interactive command execution via artifact collection (`Custom.Shell.Execute` with `execve()` VQL), polls for results via `/api/table`
  5. **VFS:** Breadcrumb path navigation, file listing, directory navigation via `/api/vfs/:clientId`
- **API Calls:** `client.service`, `flow.service`, `artifact.service`, VQL via `POST /api/query`, shell via `POST /api/flows/collect`, VFS via `GET /api/vfs/:clientId`
- **State:** `useClientTabsStore`

### 6.4 `HuntsView.vue` (~500 lines)

- **Route:** `/hunts`
- **Velociraptor Mapping:** Hunt Manager
- **Features:**
  - 4 KPI stat cards (Total, Running, Paused, Completed)
  - Searchable hunt table with columns: Description, State, Artifacts, Scheduled Clients, Created
  - Create Hunt dialog: description, artifact autocomplete (from artifact service), expiry date
  - Hunt Detail dialog (3 tabs): Stats, Flows, Results
  - Modify hunt state: start, pause, stop
  - Delete hunt with confirmation
- **API Calls:** `huntService.*`, `artifactService.getArtifacts()`
- **State:** Local only (no Pinia store used for display, but `hunt.js` store available)

### 6.5 `AlertsView.vue` (~100 lines)

- **Route:** `/alerts`
- **Velociraptor Mapping:** Server monitoring alerts (derived)
- **Features:**
  - Severity filter chips: All / Critical / High / Medium
  - Alert list with severity icons and descriptions
  - Color-coded by severity
- **API Calls:** `eventService.getActiveAlerts()`
- **Polling:** 30s `setInterval`

### 6.6 `ArtifactsView.vue` (~300 lines)

- **Route:** `/artifacts`
- **Velociraptor Mapping:** View Artifacts / Artifact Repository
- **Features:**
  - Search + type filter (All / Client / Server / Events)
  - Artifact data table
  - Detail dialog: description, author, parameters, source VQL
  - Create artifact from YAML editor
  - Delete artifact with confirmation
- **API Calls:** `artifactService.*`

### 6.7 `VQLView.vue` (~350 lines)

- **Route:** `/vql`
- **Velociraptor Mapping:** Notebook VQL cells
- **Features:**
  - Split-pane layout: VQL textarea editor + results table/JSON viewer
  - VQL templates dropdown with pre-built queries
  - Format VQL button
  - Execute via direct `POST /api/query` or fallback to notebook creation + cell execution
  - Completions dialog
- **API Calls:** `vqlService.*`, `notebookService.createNotebook()`, `notebookService.createCell()`

### 6.8 `NotebooksView.vue` (~500 lines, Options API)

- **Route:** `/notebooks`
- **Velociraptor Mapping:** Server Notebooks
- **Features:**
  - Notebook list table
  - Notebook editor with cell management (VQL + Markdown cell types)
  - Run / revert / cancel cells
  - Export notebook (HTML/ZIP)
  - Create / delete notebooks
  - JSON-line output parsing to table format
- **API Calls:** `notebookService.*` (full CRUD + cell operations)

### 6.9 `EventsView.vue` (~100 lines)

- **Route:** `/events`
- **Velociraptor Mapping:** Server Events / Event Monitoring
- **Features:**
  - Timeline view vs. Table view toggle
  - Event list with type/color coding
  - Type icons for different event categories
- **API Calls:** `eventService.getServerEvents()`
- **Polling:** 30s `setInterval`

### 6.10 `CasesView.vue` (~280 lines)

- **Route:** `/cases`
- **Velociraptor Mapping:** Maps to Velociraptor notebooks with type detection via ID prefix
  - `N.H.` prefix → Hunt notebook
  - `N.F.` / `N.C.` prefix → Collection notebook
  - `N.E.` prefix → Event notebook
  - Other → Generic case notebook
- **Features:**
  - Case list table with type detection
  - Create case → creates notebook via `POST /api/notebooks`
  - View case → loads notebook detail
  - Export case notebook
- **API Calls:** Direct `api.get('/api/notebooks')`, `api.post('/api/notebooks')`, `api.get('/api/notebooks/:id')`

### 6.11 `ReportsView.vue` (~280 lines)

- **Route:** `/reports`
- **Velociraptor Mapping:** Notebook exports / Reports
- **Features:**
  - Card grid showing notebooks as reports
  - Notebook type detection (same prefix pattern as Cases)
  - Summary statistics (Total, Recent, Type counts)
  - View report → loads notebook detail
  - Export → downloads notebook export
- **API Calls:** `GET /api/notebooks`, `GET /api/notebooks/:id`, `GET /api/notebooks/:id/export`

### 6.12 `VFSView.vue` (~300 lines)

- **Route:** `/vfs`
- **Velociraptor Mapping:** Virtual File System browser
- **Features:**
  - Client selector (autocomplete search via `GET /api/clients?search=`)
  - Breadcrumb path navigation
  - File table (Name, Size, Mode, Mtime)
  - Directory navigation (click to enter)
  - File preview panel
  - Download trigger button
  - File type icons
- **API Calls:** `vfsService.listDirectory()`, `clientService.searchClients()`

### 6.13 `LoginView.vue` (~250 lines)

- **Route:** `/login`
- **Velociraptor Mapping:** Authentication gateway
- **Features:**
  - Split-pane layout: animated branding left, login form right
  - "VELO TI" branding by "DAMLACHET"
  - Feature highlights panel
  - Username + password form
  - Animated gradient background
- **API Calls:** `authStore.login()` → `POST /api/auth/login`

### 6.14 `ChatView.vue` (1192 lines)

- **Route:** `/chat` (standalone — outside MainLayout)
- **Velociraptor Mapping:** **No equivalent** — custom AI assistant
- **Features:**
  - Full-screen chat interface with sidebar conversation list
  - Welcome screen with 4 quick-suggestion cards (Write VQL, Analyze Alert, Forensic Analysis, Learn Velociraptor)
  - Message list with user/AI avatars
  - Typing indicator animation
  - Markdown rendering: bold, italic, inline code, headers, lists
  - Fenced code blocks with copy-to-clipboard button per block
  - Avatar upload dialog (base64 upload via `userService.uploadAvatarBase64()`)
  - Context-aware: receives `huntData`, `clientData`, `alertData`, `artifactName`, `flowData`, `vqlQuery` via route query params
  - Loads Velociraptor context from current page data for richer AI responses
  - Logout button in sidebar
- **API Calls:** `aiService.chat()` → `POST /api/ai/chat`, `userService.getProfile()`, `userService.uploadAvatarBase64()`, `clientService.getClient()`
- **State:** `useAuthStore`

### 6.15 `ServerAdminView.vue` (~390 lines)

- **Route:** `/server-admin`
- **Velociraptor Mapping:** Server Configuration (users, monitoring, tools, secrets)
- **Features (4 tabs):**
  1. **Users:** User table with avatar initials, role chips (color-coded), add/edit/delete user, reset password
  2. **Monitoring:** Server event monitoring artifacts (chip list), client event monitoring artifacts
  3. **Tools:** External tool table (name, URL, hash)
  4. **Secrets:** Secret definition table, define new secret type with verifier fields, add secret values
- **API Calls:** `serverService.getUsers()`, `serverService.setUser()`, `serverService.deleteUser()`, `serverService.setUserPassword()`, `serverService.getServerMonitoring()`, `serverService.getClientMonitoring()`, `serverService.getTools()`, `serverService.getSecretDefinitions()`, `serverService.defineSecret()`, `serverService.addSecret()`, `serverService.getSecret()`

### 6.16 `SettingsView.vue` (974 lines)

- **Route:** `/settings`
- **Velociraptor Mapping:** User preferences + Server connection config
- **Features:**
  - **Profile card:** Avatar upload, username, email, member since
  - **Velociraptor Connection:** Editable server URL, SSL verify toggle, test connection (`GET /api/users/me/traits` or `PUT /api/user/velo-connection`), save connection
  - **Appearance:** Auto-refresh toggle, animations toggle, compact mode toggle, refresh interval selector (10s–10m)
  - **AI Provider configuration:** Provider selector grid (supports multiple providers), API key input, base URL, model selector with fetch-models, include-page-context toggle, test connection, save provider
  - **Security:** Change Velociraptor password, session information
- **API Calls:**
  - `userService.getProfile()`, `userService.uploadAvatarBase64()`
  - `GET /api/users/me/traits`, `PUT /api/user/velo-connection`, `GET /api/user/velo-connection`
  - `POST /api/auth/change-password`
  - `aiService.getStatus()`, `aiService.getProviders()`, `aiService.getProviderConfig()`, `aiService.saveProviderConfig()`, `aiService.testProvider()`, `aiService.listModels()`

### 6.17 `UsersView.vue` (~270 lines, Options API)

- **Route:** `/users`
- **Velociraptor Mapping:** User management
- **Features:**
  - User list table with search
  - Create user dialog (username, email, password, roles)
  - Edit user dialog (update roles)
  - Reset password dialog
  - Delete user (with confirmation via native `confirm()`)
  - Prevents deleting current user
  - Available roles: admin, analyst, investigator, reader
- **API Calls:** `userService.getUsers()`, `userService.createUser()`, `userService.setUserRoles()`, `userService.setPassword()`, `userService.deleteUser()`
- **Note:** Uses Options API (`export default {}`) unlike most views

### 6.18 `ToolsView.vue` (~120 lines)

- **Route:** `/tools`
- **Velociraptor Mapping:** Server Tools
- **Features:**
  - Searchable tool table (Name, Version, Size, Hash)
  - Delete tool button
  - Format bytes helper
- **API Calls:** `toolsService.getTools()`, `toolsService.deleteTool()`

### 6.19 `SecretsView.vue` (~120 lines)

- **Route:** `/secrets`
- **Velociraptor Mapping:** Secret Management
- **Features:**
  - Secret definition table (Type, Name, Description, Redacted indicator)
  - Create secret dialog (type, name, description, value)
  - Delete secret
- **API Calls:** `secretsService.getSecretDefinitions()`, `secretsService.defineSecret()`, `secretsService.deleteSecret()`

### 6.20 `DownloadsView.vue` (~140 lines)

- **Route:** `/downloads`
- **Velociraptor Mapping:** Download management / Export queue
- **Features:**
  - Download queue table (Name, Type, Status, Size, Created)
  - Status color coding (Pending, In Progress, Complete, Error, Cancelled)
  - Download file button (enabled when COMPLETE)
  - Delete download
  - Format bytes + format date helpers
- **API Calls:** `downloadsService.listDownloads()`, `downloadsService.downloadFile()`, `downloadsService.deleteDownload()`
- **Polling:** 10s `setInterval`

### 6.21 `TimelineView.vue` (~140 lines)

- **Route:** `/timeline`
- **Velociraptor Mapping:** Timeline Viewer
- **Features:**
  - Manual timeline ID input + time range filter
  - Load button triggers timeline fetch
  - Vuetify `v-timeline` component with color-coded dots
  - Each event shows message + optional details
  - Add Annotation dialog (timestamp, type, message)
- **API Calls:** `timelineService.getTimeline()`, `timelineService.annotateTimeline()`

### 6.22 `FlowDetailView.vue` (~220 lines)

- **Route:** `/flows/:flowId` (also supports `embedded` prop)
- **Velociraptor Mapping:** Collection / Flow Results
- **Features:**
  - Metadata card row (Flow ID, Client, Artifact, Created)
  - 3 tabs: Results (data table), Logs (log entries with level chips), Request (raw JSON)
  - Cancel flow button (visible when RUNNING)
  - State color coding (FINISHED, RUNNING, ERROR, CANCELLED)
  - Handles Velociraptor timestamp formats (µs, ms, s)
- **API Calls:** `flowService.getFlowDetails()`, `flowService.getFlowResults()`, `flowService.cancelFlow()`
- **Uses:** `date-fns` format function

### 6.23 `ClientWorkspaceView.vue` (~240 lines)

- **Route:** Not directly routed (component referenced in `ClientsView`)
- **Velociraptor Mapping:** Multi-client investigation workspace
- **Features:**
  - Empty state with "Browse Endpoints" CTA
  - Tab bar with OS icons, online/offline dots, hostname labels, close buttons
  - Close all tabs button
  - Multiple client panels rendered with `v-show` (state persistence via keep-alive pattern)
  - Embeds `ClientDetailView` per tab with `embedded` prop
- **State:** `useClientTabsStore`

### 6.24 `views/auth/LoginView.vue` (~140 lines)

- **Route:** Not routed (alternative/simple login form)
- **Features:**
  - Simple card-based login: username, password
  - Advanced options: custom Velociraptor server URL
  - Gradient background (#667eea → #764ba2)
- **API Calls:** `authStore.login()`

### 6.25 `views/auth/RegisterView.vue` (~160 lines)

- **Route:** Not routed (registration form)
- **Features:**
  - Registration form: username, email, Velo username, Velo password, Velo server URL, SSL verify toggle
  - Field validation (username pattern, email format, URL format)
  - Link to login page
  - Success redirect after 1.5s delay
- **API Calls:** `authStore.register()`

---

## 7. Components

### 7.1 `AskAIButton.vue` (708 lines)

- **Location:** Fixed-position floating button (bottom-right)
- **Used in:** `MainLayout.vue`
- **Features:**
  - Hideable tab (persisted in localStorage `velo_ai_hidden`)
  - Animated FAB with pulse effect
  - Expandable chat panel (340px wide) with glassmorphism styling
  - Context-aware: detects current route and shows relevant quick prompts
  - Built-in markdown renderer (code blocks, bold, italic)
  - Message feed with user/AI bubble styling
  - Thinking animation (bouncing dots)
  - AI readiness check on mount via `aiService.getStatus()`
  - "Not configured" warning with link to Settings
  - "Open full chat" button → navigates to `/chat`
  - Clear conversation button
  - Context labels per route: Dashboard, Endpoints, Hunt Manager, Alerts, Events, VQL Lab, Artifacts, Notebooks, Reports, Cases
- **API Calls:** `aiService.getStatus()`, `aiService.chat()`

### 7.2 Chart Components (in `components/charts/`)

All chart components use raw `Chart.js` (not `vue-chartjs`). All follow the same pattern: `<canvas ref>` → `Chart()` constructor, `watch` for reactive updates, `onBeforeUnmount` for cleanup.

| Component | Type | Props | Used By |
|---|---|---|---|
| `AreaChart.vue` (124 lines) | `line` with fill | `labels, datasets/data, color, stacked, showLegend` | DashboardView (Threat Detection 14-day) |
| `BarChart.vue` (127 lines) | `bar` | `labels, data, color, label` | DashboardView (Case Activity) |
| `DoughnutChart.vue` (85 lines) | `doughnut` | `labels, data, colors, cutout, showLegend` | DashboardView (Incident Status) |
| `SparklineChart.vue` (144 lines) | `line`/`bar` mini | `data, labels, color, type, fill, height` | DashboardView (KPI card sparklines) |
| `LineChart.vue` (120 lines) | `line` | `labels, datasets[]` | Not currently used |
| `HorizontalBarChart.vue` (90 lines) | `bar` (indexAxis: y) | `labels, data, colors, label` | Not currently used |
| `CircularProgress.vue` (100 lines) | SVG circle | `value, size, strokeWidth, color, label` | Not currently used |

**Color palette shared across charts:** `['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f87171', '#facc15']`

---

## 8. Layout & Theme

### 8.1 `MainLayout.vue` (547 lines)

- **Structure:** Sidebar (collapsible) + Topbar + Content area
- **Sidebar Navigation Groups:**
  | Group | Items |
  |---|---|
  | OVERVIEW | Dashboard, Cases |
  | INVESTIGATE | Endpoints, Hunts, Alerts, Events |
  | ANALYZE | Artifacts, VQL Lab, Notebooks, Reports |
  | PLATFORM | Users, Tools, Secrets, Server, VFS Browser, Downloads |
  | ASSISTANT | AI Assistant → `/chat` |
- **Topbar:** Breadcrumbs, search icon trigger, alerts notification button (with badge count), user dropdown (Profile link → Settings, Logout)
- **Features:**
  - Sidebar collapse toggle (min-width 60px, expanded 248px)
  - Sticky sidebar + sticky topbar
  - Page transitions (`fade`)
  - `v-click-outside` directive for dropdown close
  - `AskAIButton` floating component
  - Fetches current user on mount if not loaded

### 8.2 `styles/theme.css` (449 lines)

Full CSS design system with:
- **Design Tokens:** 60+ CSS custom properties for backgrounds, borders, accents, status colors, typography, spacing, radii, shadows, transitions
- **Color System:**
  - Backgrounds: `#080b12` (app) → `#0c1019` (sidebar) → `#111623` (paper) → `#171d2e` (elevated) → `#1c2438` (hover)
  - Primary accent: `#3b82f6`
  - Text: `#e2e8f0` (primary), `#94a3b8` (secondary), `#64748b` (muted)
  - Status: success `#22c55e`, danger `#ef4444`, warning `#f59e0b`
- **Vuetify Global Overrides:** Cards, buttons, text fields, chips, alerts, dialogs, data tables, lists, menus, tooltips, tabs, dividers, progress, snackbars
- **Custom CSS Classes:** `.glass-panel`, `.status-badge`, `.stat-card`, `.page-header`, `.kpi-row`, `.empty-state`, `.skeleton`
- **Scrollbar:** Custom 5px slim scrollbar
- **Animations:** `skeleton-shimmer`, `pulse-ring`, `subtle-glow`, `fade`, `slide-up`

### 8.3 `plugins/vuetify.js`

- Theme name: `veloTI`
- Dark mode: true
- Colors: primary `#3b82f6`, secondary `#8b5cf6`, accent `#22d3ee`, error `#ef4444`, info `#3b82f6`, success `#22c55e`, warning `#f59e0b`, background `#080b12`, surface `#111623`
- Component defaults: compact density for most inputs, rounded shapes

---

## 9. Real-Time / Polling Patterns

**No WebSocket or SSE implementation found.** All real-time data uses `setInterval` polling.

| View | Interval | What is Polled |
|---|---|---|
| `DashboardView` | 30s | `dashboardService.getStats()`, clients, hunts, alerts |
| `ClientsView` | 60s | `clientStore.fetchClients()` |
| `AlertsView` | 30s | `eventService.getActiveAlerts()` |
| `EventsView` | 30s | `eventService.getServerEvents()` |
| `DownloadsView` | 10s | `downloadsService.listDownloads()` |
| `ClientDetailView` VQL tab | 2s (during execution) | Polls notebook cell output until complete |
| `ClientDetailView` Shell tab | 2s (during execution) | Polls `/api/table` for shell command results |

---

## 10. API Endpoint Master List

All unique backend API endpoints called by the frontend:

### Authentication
| Method | Endpoint |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/auth/logout` |
| POST | `/api/auth/refresh` |
| GET | `/api/auth/me` |
| POST | `/api/auth/register` |
| POST | `/api/auth/change-password` |

### Clients
| Method | Endpoint |
|---|---|
| GET | `/api/clients` |
| GET | `/api/clients/:id` |
| GET | `/api/clients/:id/flows` |
| GET | `/api/clients/:id/metadata` |
| POST | `/api/clients/:id/metadata` |
| POST | `/api/clients/label` |
| POST | `/api/clients/:id/notify` |
| DELETE | `/api/clients/:id` |

### Hunts
| Method | Endpoint |
|---|---|
| GET | `/api/hunts` |
| GET | `/api/hunts/:id` |
| POST | `/api/hunts` |
| POST | `/api/hunts/estimate` |
| PATCH | `/api/hunts/:id` |
| DELETE | `/api/hunts/:id` |
| GET | `/api/hunts/:id/results` |
| GET | `/api/hunts/:id/stats` |
| GET | `/api/hunts/:id/flows` |
| GET | `/api/hunts/:id/tags` |

### Flows
| Method | Endpoint |
|---|---|
| POST | `/api/flows/collect` |
| GET | `/api/flows/:id` |
| GET | `/api/flows/:id/results` |
| GET | `/api/flows/:id/requests` |
| POST | `/api/flows/:id/cancel` |
| POST | `/api/flows/:id/resume` |
| POST | `/api/flows/:id/archive` |

### Artifacts
| Method | Endpoint |
|---|---|
| GET | `/api/artifacts` |
| GET | `/api/artifacts/:name` |
| GET | `/api/artifacts/:name/file` |
| POST | `/api/artifacts` |
| POST | `/api/artifacts/pack` |
| DELETE | `/api/artifacts/:name` |

### VQL
| Method | Endpoint |
|---|---|
| POST | `/api/query` |
| GET | `/api/completions` |
| POST | `/api/vql/reformat` |

### Notebooks
| Method | Endpoint |
|---|---|
| GET | `/api/notebooks` |
| GET | `/api/notebooks/:id` |
| POST | `/api/notebooks` |
| PUT | `/api/notebooks/:id` |
| DELETE | `/api/notebooks/:id` |
| POST | `/api/notebooks/:id/cells` |
| GET | `/api/notebooks/:id/cells/:cellId` |
| PUT | `/api/notebooks/:id/cells/:cellId` |
| POST | `/api/notebooks/:id/cells/:cellId/revert` |
| POST | `/api/notebooks/:id/cells/:cellId/cancel` |
| GET | `/api/notebooks/:id/export` |
| GET | `/api/notebooks/:id/download` |
| POST | `/api/notebooks/:id/attachment` |

### Server & Monitoring
| Method | Endpoint |
|---|---|
| GET | `/api/server/metrics` |
| GET | `/api/server/monitoring` |
| POST | `/api/server/monitoring` |
| GET | `/api/server/client-monitoring` |
| POST | `/api/server/events` |
| GET | `/api/events/available` |
| POST | `/api/events/push` |
| GET | `/api/table` |

### Users
| Method | Endpoint |
|---|---|
| GET | `/api/users` |
| POST | `/api/users` |
| DELETE | `/api/users/:name` |
| POST | `/api/users/:name/roles` |
| POST | `/api/users/:name/password` |
| GET | `/api/users/:name/gui` |
| GET | `/api/users/me/traits` |

### User Profile
| Method | Endpoint |
|---|---|
| GET | `/api/user/profile` |
| PUT | `/api/user/profile` |
| POST | `/api/user/avatar` |
| DELETE | `/api/user/avatar` |
| GET | `/api/user/velo-connection` |
| PUT | `/api/user/velo-connection` |

### VFS
| Method | Endpoint |
|---|---|
| GET | `/api/vfs/:clientId` |
| GET | `/api/vfs/:clientId/download` |
| GET | `/api/vfs/:clientId/stat` |
| GET | `/api/vfs/:clientId/stat-dir` |
| GET | `/api/vfs/:clientId/stat-download` |
| POST | `/api/vfs/:clientId/download` |
| POST | `/api/vfs/:clientId/refresh` |
| GET | `/api/vfs/:clientId/files` |

### AI (Custom)
| Method | Endpoint |
|---|---|
| POST | `/api/ai/chat` |
| POST | `/api/ai/analyze-vql` |
| POST | `/api/ai/suggest-artifacts` |
| GET | `/api/ai/status` |
| DELETE | `/api/ai/chat/history` |
| GET | `/api/ai/providers` |
| GET | `/api/ai/provider` |
| PUT | `/api/ai/provider` |
| POST | `/api/ai/provider/test` |
| POST | `/api/ai/provider/models` |

### Tags & Settings
| Method | Endpoint |
|---|---|
| GET | `/api/tags/:clientId` |
| POST | `/api/tags/:clientId` |
| PUT | `/api/tags/:tagId` |
| DELETE | `/api/tags/:tagId` |
| GET | `/api/settings` |
| PUT | `/api/settings/:key` |

### Tools, Secrets, Downloads (via server.service — correct /api prefix)
| Method | Endpoint |
|---|---|
| GET | `/api/tools` |
| POST | `/api/tools` |
| GET | `/api/secrets` |
| POST | `/api/secrets` |
| PUT | `/api/secrets/:type` |
| GET | `/api/downloads` |
| POST | `/api/file-search` |
| GET | `/api/docs/:artifact` |
| POST | `/api/uploads` |
| POST | `/api/client/config` |
| GET | `/api/reports` |
| GET | `/api/timelines` |

### ⚠ Endpoints with MISSING /api prefix (from standalone services)
| Service | Method | Written As | Should Likely Be |
|---|---|---|---|
| `reports.service.js` | POST | `/reports/generate` | `/api/reports/generate` |
| `reports.service.js` | GET | `/reports/:id/status` | `/api/reports/:id/status` |
| `reports.service.js` | GET | `/reports/:id/download` | `/api/reports/:id/download` |
| `reports.service.js` | GET | `/reports/templates` | `/api/reports/templates` |
| `reports.service.js` | DELETE | `/reports/:id` | `/api/reports/:id` |
| `downloads.service.js` | POST | `/downloads` | `/api/downloads` |
| `downloads.service.js` | GET | `/downloads` | `/api/downloads` |
| `downloads.service.js` | DELETE | `/downloads/:id` | `/api/downloads/:id` |
| `downloads.service.js` | GET | `/downloads/:id/file` | `/api/downloads/:id/file` |
| `downloads.service.js` | POST | `/downloads/:id/cancel` | `/api/downloads/:id/cancel` |
| `secrets.service.js` | GET | `/secrets` | `/api/secrets` |
| `secrets.service.js` | POST | `/secrets` | `/api/secrets` |
| `secrets.service.js` | PUT | `/secrets` | `/api/secrets` |
| `secrets.service.js` | DELETE | `/secrets/:type` | `/api/secrets/:type` |
| `timeline.service.js` | POST | `/timelines` | `/api/timelines` |
| `timeline.service.js` | POST | `/timelines/annotate` | `/api/timelines/annotate` |
| `timeline.service.js` | GET | `/timelines/:id/annotations` | `/api/timelines/:id/annotations` |
| `timeline.service.js` | DELETE | `/timelines/:id/annotations` | `/api/timelines/:id/annotations` |
| `tools.service.js` | GET | `/tools` | `/api/tools` |
| `tools.service.js` | POST | `/tools` | `/api/tools` |
| `tools.service.js` | POST | `/uploads/tool` | `/api/uploads/tool` |
| `tools.service.js` | DELETE | `/tools/:name` | `/api/tools/:name` |

---

## 11. Issues & Inconsistencies

### Critical

1. **`case.service.js` is entirely stub.** All methods return empty arrays or null with `// TODO:` comments. `CasesView.vue` works around this by using `api.get('/api/notebooks')` directly.

2. **Services with missing `/api` prefix** (see table above). Five services (`reports`, `downloads`, `secrets`, `timeline`, `tools`) omit the `/api` prefix. If the backend expects the prefix, all these requests will 404. Note: `server.service.js` has the same operations *with* the correct `/api` prefix, creating duplicated but inconsistent routes.

3. **Duplicate service methods.** `server.service.js` provides `getTools()`, `getSecretDefinitions()`, `defineSecret()`, `getDownloads()`, `getReports()`, `getTimelines()` — all with `/api` prefix. The standalone services (`tools.service.js`, `secrets.service.js`, `downloads.service.js`, etc.) have the same operations WITHOUT `/api` prefix. Views use different services for the same thing.

### Medium

4. **Mixed Composition/Options API.** `NotebooksView.vue` and `UsersView.vue` use Options API; all other views use `<script setup>`. Should be standardized.

5. **`vue-chartjs` imported but unused.** Listed as dependency but all chart components use raw `Chart.js` directly. Can be removed.

6. **UsersView.vue uses `userService` method names that don't exist.** The file calls `userService.getUsers()`, `userService.createUser()`, `userService.setUserRoles()`, `userService.setPassword()`, `userService.deleteUser()`. However, `user.service.js` only exports `getProfile`, `updateProfile`, `uploadAvatar`, `uploadAvatarBase64`, `deleteAvatar`, `getAvatarUrl`. The user management functions exist only in `server.service.js`. This view will throw runtime errors.

7. **ServerAdminView vs. standalone views.** `ServerAdminView` contains Users, Monitoring, Tools, Secrets tabs. But separate `/users`, `/tools`, `/secrets` routes also exist with their own independent views. Redundant UI for the same data.

8. **`UsersView.vue` roles mismatch.** Uses `['admin', 'analyst', 'investigator', 'reader']` while `ServerAdminView.vue` uses `['administrator', 'reader', 'analyst', 'investigator', 'artifact_writer', 'api']` — the Velociraptor-correct roles.

9. **`views/auth/LoginView.vue` and `views/auth/RegisterView.vue` are not routed.** The router uses `views/LoginView.vue` for `/login`. The `auth/` subdirectory views are orphaned.

### Low

10. **No input validation/sanitization** on VQL queries before sending to the API.

11. **Shell tab in ClientDetailView** executes commands via artifact collection of `Custom.Shell.Execute` — this is a powerful capability with no confirmation beyond the text input.

12. **No error boundaries** — an unhandled component error will crash the entire view.

13. **Dashboard data is simulated/derived.** `dashboardService` generates demo-like data (chart labels like "Jan"–"Dec", random values) when real data is insufficient. Some charts may show fabricated data rather than actual metrics.

14. **`reports.service.js` duplicates notebook.service.js** export logic — both can export notebooks but via different endpoint patterns.

---

## 12. Missing Features vs. Standard Velociraptor GUI

| Standard Velociraptor Feature | Custom UI Status | Notes |
|---|---|---|
| WebSocket/SSE real-time updates | ❌ Missing | Uses polling (10–60s intervals) instead |
| Client event monitoring configuration | ⚠ View-only | View exists in ServerAdmin, but no ability to add/remove monitored artifacts |
| Server event monitoring configuration | ⚠ View-only | Same as above |
| Artifact parameter editing when collecting | ⚠ Partial | Autocomplete for artifact name but no parameter form for artifact-specific settings |
| Flow log streaming | ❌ Missing | FlowDetailView loads logs once, no streaming |
| VFS file content preview | ⚠ Basic | VFSView shows file metadata but limited in-browser file content viewing |
| VFS file download with progress | ❌ Missing | Download triggers but no progress tracking |
| Multi-notebook cell reordering | ❌ Missing | Notebook cells are list-only, no drag-to-reorder |
| Notebook cell output visualization (tables, charts) | ⚠ Basic | JSON-line parsing to simple table, no chart rendering within notebooks |
| Org/multi-org support | ❌ Missing | No organization concept |
| Client interrogation trigger | ❌ Missing | No explicit "Interrogate" button |
| Client quarantine | ❌ Missing | No network isolation controls |
| Favorites / Starred artifacts | ❌ Missing | No user-specific saved artifact list |
| Artifact upload from file | ⚠ Partial | YAML textarea only, no file upload |
| Custom label colors | ❌ Missing | Labels are text-only chips |
| Offline pack collector builder | ❌ Missing | No offline collector generation UI |
| Column sorting persistence | ❌ Missing | Table sort state not persisted |
| Export to CSV | ❌ Missing | No direct CSV export from result tables |
| Hunt scheduling | ❌ Missing | Hunts have expiry but no cron/schedule trigger |
| Client approval workflow | ❌ Missing | No approval mechanism for new clients |
| Audit log viewer | ❌ Missing | No server audit trail UI |
| ACL / fine-grained permission editor | ❌ Missing | Role assignment only, no per-resource ACL |

### Custom Features NOT in Standard Velociraptor

| Feature | Description |
|---|---|
| **AI Assistant** (AskAIButton + ChatView) | Floating contextual AI chat + full-screen AI conversation with multiple provider support (OpenAI, Ollama, OpenRouter, etc.) |
| **Cases view** | Notebook-based case management with type detection and investigation workflow |
| **Custom Dashboard** | Aggregated KPI cards, sparklines, charts, server metrics — fully custom |
| **Multi-client tab workspace** | Browser-style tabbed investigation across multiple clients |
| **User avatar system** | Base64 avatar uploads with profile management |
| **Velociraptor connection management** | Per-user configurable Velociraptor server URL with SSL toggle |
| **AI provider configuration** | Settings page for configuring multiple AI backends with API keys and model selection |
| **Custom branding** | "VELO TI" by "DAMLACHET" branding throughout |

---

*End of audit. Every file in `frontend/src/` has been read completely and documented above.*
