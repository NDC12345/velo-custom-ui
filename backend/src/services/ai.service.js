const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const logger = require('../utils/logger');
const { query } = require('../config/database');

// ═══════════════════════════════════════════════════════════════════════════════
//  Provider registry – each entry describes a supported AI backend
// ═══════════════════════════════════════════════════════════════════════════════
const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    icon: 'mdi-google',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    fields: ['apiKey'],
  },
  openrouter: {
    name: 'OpenRouter',
    icon: 'mdi-router-wireless',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    models: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
    ],
    fields: ['apiKey'],
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: 'mdi-server',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'mistral', 'codellama', 'deepseek-r1', 'phi3', 'qwen2.5'],
    fields: ['baseUrl'],
    defaultBaseUrl: 'http://localhost:11434',
  },
  openai: {
    name: 'OpenAI',
    icon: 'mdi-brain',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini'],
    fields: ['apiKey'],
    baseUrl: 'https://api.openai.com/v1',
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    icon: 'mdi-cog',
    defaultModel: '',
    models: [],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
};

class AIService {
  constructor() {
    this.chatSessions = new Map(); // userId → Gemini chat | unused for other providers
    this.histories      = new Map(); // userId → OpenAI-style message array
    this.providerCache  = new Map(); // userId → resolved config
    this.globalProvider  = null;
    this._initGlobal();
  }

  // ─── Bootstrap: fall back to env-var Gemini key ──────────────────────────────
  _initGlobal() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey && apiKey !== 'your_google_ai_studio_api_key_here') {
      this.globalProvider = {
        provider: 'gemini',
        apiKey,
        model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
      };
      logger.info('Global AI provider: Gemini (from env)');
    } else {
      logger.warn('No global AI key configured – users can add their own via Settings.');
    }
  }

  // ─── Per-user provider config (persisted in user_settings) ───────────────────

  async getUserConfig(userId) {
    if (this.providerCache.has(userId)) return this.providerCache.get(userId);
    try {
      const res = await query(
        "SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'ai_provider'",
        [userId],
      );
      if (res.rows.length) {
        const cfg = typeof res.rows[0].setting_value === 'string'
          ? JSON.parse(res.rows[0].setting_value)
          : res.rows[0].setting_value;
        this.providerCache.set(userId, cfg);
        return cfg;
      }
    } catch (e) {
      logger.error('Failed to load user AI config:', e.message);
    }
    return null;
  }

  async saveUserConfig(userId, config) {
    const clean = {
      provider: config.provider,
      apiKey:   config.apiKey  || '',
      baseUrl:  config.baseUrl || '',
      model:    config.model   || '',
    };
    await query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value)
       VALUES ($1, 'ai_provider', $2::jsonb)
       ON CONFLICT (user_id, setting_key)
       DO UPDATE SET setting_value = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(clean)],
    );
    this.providerCache.set(userId, clean);
    this.chatSessions.delete(userId);
    this.histories.delete(userId);
    return clean;
  }

  /** user config → global config → null */
  async _resolve(userId) {
    const u = await this.getUserConfig(userId);
    if (u && u.provider && (u.apiKey || u.baseUrl)) return u;
    if (this.globalProvider) return this.globalProvider;
    return null;
  }

  isAvailable() {
    return this.globalProvider !== null;
  }

  getSystemPrompt() {
    return `You are an AI assistant for Velociraptor, a digital forensics and incident response tool. 
You help security analysts with:
- Understanding Velociraptor artifacts and VQL queries
- Investigating security incidents and alerts
- Analyzing client data and hunt results
- Writing and debugging VQL queries
- Explaining forensics concepts and best practices
- Troubleshooting Velociraptor issues

Be concise, accurate, and security-focused. When asked about VQL, provide working examples.
When discussing investigations, emphasize proper forensic methodology.`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════════════════════════════════════════════

  async chat(userId, message, context = {}) {
    const cfg = await this._resolve(userId);
    if (!cfg) throw new Error('AI not configured. Add a provider in Settings → AI Provider.');

    const enhanced = this._buildEnhancedMessage(message, context);
    logger.info(`AI chat [${cfg.provider}] user=${userId}: ${message.substring(0, 50)}…`);

    switch (cfg.provider) {
      case 'gemini':     return this._chatGemini(userId, cfg, enhanced);
      case 'openrouter':
      case 'openai':
      case 'custom':     return this._chatOpenAI(userId, cfg, enhanced);
      case 'ollama':     return this._chatOllama(userId, cfg, enhanced);
      default: throw new Error(`Unknown provider: ${cfg.provider}`);
    }
  }

  async streamChat(userId, message, context = {}, onChunk) {
    const cfg = await this._resolve(userId);
    if (!cfg) throw new Error('AI not configured.');

    const enhanced = this._buildEnhancedMessage(message, context);
    logger.info(`AI stream [${cfg.provider}] user=${userId}: ${message.substring(0, 50)}…`);

    switch (cfg.provider) {
      case 'gemini':     return this._streamGemini(userId, cfg, enhanced, onChunk);
      case 'openrouter':
      case 'openai':
      case 'custom':     return this._streamOpenAI(userId, cfg, enhanced, onChunk);
      case 'ollama':     return this._streamOllama(userId, cfg, enhanced, onChunk);
      default: throw new Error(`Unknown provider: ${cfg.provider}`);
    }
  }

  async analyzeVQL(userId, vqlQuery) {
    const prompt = `Analyze this VQL query and explain what it does, potential issues, and suggest improvements:\n\n\`\`\`vql\n${vqlQuery}\n\`\`\`\n\nProvide:\n1. Brief explanation\n2. Syntax/logic issues\n3. Performance considerations\n4. Suggested improvements`;
    const res = await this.chat(userId, prompt);
    return res.message;
  }

  async suggestArtifacts(userId, description) {
    const prompt = `Based on this investigation scenario: "${description}"\n\nSuggest relevant Velociraptor artifacts to collect and explain why each is useful.\nFormat as a list with artifact names and brief explanations.`;
    const res = await this.chat(userId, prompt);
    return res.message;
  }

  clearChatHistory(userId) {
    this.chatSessions.delete(userId);
    this.histories.delete(userId);
    logger.info(`Cleared chat history for user ${userId}`);
    return true;
  }

  async getStatus(userId) {
    const cfg = await this._resolve(userId);
    return {
      isAvailable: cfg !== null,
      provider:    cfg?.provider || null,
      model:       cfg?.model || null,
      providerName: cfg ? (PROVIDERS[cfg.provider]?.name || cfg.provider) : null,
      activeSessions: this.chatSessions.size + this.histories.size,
    };
  }

  /** Test connectivity without saving */
  async testProvider(config) {
    const testMsg = [{ role: 'user', content: 'Say "ok" in one word.' }];
    try {
      switch (config.provider) {
        case 'gemini': {
          const genAI = new GoogleGenerativeAI(config.apiKey);
          const m = genAI.getGenerativeModel({ model: config.model || 'gemini-2.5-flash' });
          const r = await m.generateContent('Say "ok" in one word.');
          return { ok: true, message: (await r.response).text().slice(0, 100) };
        }
        case 'openrouter':
        case 'openai':
        case 'custom': {
          const url = `${this._oaiBaseUrl(config)}/chat/completions`;
          const r = await axios.post(url, {
            model: config.model || PROVIDERS[config.provider]?.defaultModel || 'gpt-4o-mini',
            messages: testMsg, max_tokens: 10,
          }, { headers: this._oaiHeaders(config), timeout: 30000 });
          return { ok: true, message: r.data.choices?.[0]?.message?.content?.slice(0, 100) || 'ok' };
        }
        case 'ollama': {
          const base = config.baseUrl || 'http://localhost:11434';
          const r = await axios.post(`${base}/api/chat`, {
            model: config.model || 'llama3.2', messages: testMsg, stream: false,
          }, { timeout: 30000 });
          return { ok: true, message: r.data.message?.content?.slice(0, 100) || 'ok' };
        }
        default: throw new Error(`Unknown provider: ${config.provider}`);
      }
    } catch (err) {
      return { ok: false, message: err.response?.data?.error?.message || err.message };
    }
  }

  /** Attempt to list models for a provider */
  async listModels(config) {
    try {
      if (config.provider === 'ollama') {
        const base = config.baseUrl || 'http://localhost:11434';
        const r = await axios.get(`${base}/api/tags`, { timeout: 10000 });
        return (r.data.models || []).map(m => m.name);
      }
      if (config.provider === 'openrouter' || config.provider === 'openai' || config.provider === 'custom') {
        const url = `${this._oaiBaseUrl(config)}/models`;
        const r = await axios.get(url, { headers: this._oaiHeaders(config), timeout: 10000 });
        return (r.data.data || []).map(m => m.id).sort();
      }
    } catch { /* ignore */ }
    return PROVIDERS[config.provider]?.models || [];
  }

  static getProviders() { return PROVIDERS; }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  Gemini implementation
  // ═══════════════════════════════════════════════════════════════════════════════

  _geminiModel(cfg) {
    return new GoogleGenerativeAI(cfg.apiKey).getGenerativeModel({
      model: cfg.model || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
    });
  }

  _geminiChat(userId, cfg) {
    let s = this.chatSessions.get(userId);
    if (!s || s._prov !== 'gemini') {
      s = this._geminiModel(cfg).startChat({
        history: [
          { role: 'user',  parts: [{ text: this.getSystemPrompt() }] },
          { role: 'model', parts: [{ text: "Understood. I'm ready to assist with Velociraptor forensics. How can I help?" }] },
        ],
      });
      s._prov = 'gemini';
      this.chatSessions.set(userId, s);
    }
    return s;
  }

  async _chatGemini(userId, cfg, message) {
    const chat = this._geminiChat(userId, cfg);
    const result = await chat.sendMessage(message);
    const text  = (await result.response).text();
    return { message: text, timestamp: new Date().toISOString() };
  }

  async _streamGemini(userId, cfg, message, onChunk) {
    const chat = this._geminiChat(userId, cfg);
    const result = await chat.sendMessageStream(message);
    for await (const chunk of result.stream) { onChunk(chunk.text()); }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  OpenAI-compatible (OpenRouter · OpenAI · Custom)
  // ═══════════════════════════════════════════════════════════════════════════════

  _oaiBaseUrl(cfg) {
    if (cfg.provider === 'openrouter') return 'https://openrouter.ai/api/v1';
    if (cfg.provider === 'openai')     return 'https://api.openai.com/v1';
    return (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  _oaiHeaders(cfg) {
    const h = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) h['Authorization'] = `Bearer ${cfg.apiKey}`;
    if (cfg.provider === 'openrouter') {
      h['HTTP-Referer'] = 'https://velo-custom-ui.local';
      h['X-Title'] = 'VeloTI AI Assistant';
    }
    return h;
  }

  _history(userId) {
    if (!this.histories.has(userId)) this.histories.set(userId, []);
    return this.histories.get(userId);
  }

  async _chatOpenAI(userId, cfg, message) {
    const hist = this._history(userId);
    if (!hist.length) hist.push({ role: 'system', content: this.getSystemPrompt() });
    hist.push({ role: 'user', content: message });
    if (hist.length > 40) hist.splice(1, hist.length - 30);

    const url = `${this._oaiBaseUrl(cfg)}/chat/completions`;
    const res = await axios.post(url, {
      model: cfg.model || PROVIDERS[cfg.provider]?.defaultModel || 'gpt-4o-mini',
      messages: hist, temperature: 0.7, max_tokens: 4096,
    }, { headers: this._oaiHeaders(cfg), timeout: 120000 });

    const text = res.data.choices?.[0]?.message?.content || 'No response';
    hist.push({ role: 'assistant', content: text });
    return { message: text, timestamp: new Date().toISOString() };
  }

  async _streamOpenAI(userId, cfg, message, onChunk) {
    const hist = this._history(userId);
    if (!hist.length) hist.push({ role: 'system', content: this.getSystemPrompt() });
    hist.push({ role: 'user', content: message });

    const url = `${this._oaiBaseUrl(cfg)}/chat/completions`;
    const res = await axios.post(url, {
      model: cfg.model || PROVIDERS[cfg.provider]?.defaultModel || 'gpt-4o-mini',
      messages: hist, temperature: 0.7, max_tokens: 4096, stream: true,
    }, { headers: this._oaiHeaders(cfg), responseType: 'stream', timeout: 120000 });

    let full = '';
    for await (const chunk of res.data) {
      const lines = chunk.toString().split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const d = JSON.parse(json);
          const t = d.choices?.[0]?.delta?.content || '';
          if (t) { full += t; onChunk(t); }
        } catch { /* skip */ }
      }
    }
    hist.push({ role: 'assistant', content: full });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  Ollama
  // ═══════════════════════════════════════════════════════════════════════════════

  async _chatOllama(userId, cfg, message) {
    const base = cfg.baseUrl || 'http://localhost:11434';
    const hist = this._history(userId);
    if (!hist.length) hist.push({ role: 'system', content: this.getSystemPrompt() });
    hist.push({ role: 'user', content: message });

    const res = await axios.post(`${base}/api/chat`, {
      model: cfg.model || 'llama3.2', messages: hist, stream: false,
    }, { timeout: 120000 });

    const text = res.data.message?.content || 'No response';
    hist.push({ role: 'assistant', content: text });
    return { message: text, timestamp: new Date().toISOString() };
  }

  async _streamOllama(userId, cfg, message, onChunk) {
    const base = cfg.baseUrl || 'http://localhost:11434';
    const hist = this._history(userId);
    if (!hist.length) hist.push({ role: 'system', content: this.getSystemPrompt() });
    hist.push({ role: 'user', content: message });

    const res = await axios.post(`${base}/api/chat`, {
      model: cfg.model || 'llama3.2', messages: hist, stream: true,
    }, { responseType: 'stream', timeout: 120000 });

    let full = '';
    for await (const chunk of res.data) {
      try {
        const d = JSON.parse(chunk.toString());
        const t = d.message?.content || '';
        if (t) { full += t; onChunk(t); }
      } catch { /* skip */ }
    }
    hist.push({ role: 'assistant', content: full });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  Context builder
  // ═══════════════════════════════════════════════════════════════════════════════

  _buildEnhancedMessage(message, context) {
    if (typeof context === 'string') {
      // Legacy: plain string context sent directly
      return `[Context]\n${context}\n\n[User Question]\n${message}`;
    }
    const parts = [];
    if (context.currentView) parts.push(`UI View: ${context.currentView}`);
    if (context.route) parts.push(`Route: ${context.route}`);
    if (context.clientData) {
      parts.push(`Client: ${context.clientData.client_id}`);
      if (context.clientData.os_info) parts.push(`OS: ${context.clientData.os_info.system}`);
      if (context.clientData.hostname) parts.push(`Hostname: ${context.clientData.hostname}`);
    }
    if (context.huntData) {
      parts.push(`Hunt ID: ${context.huntData.hunt_id}`);
      if (context.huntData.artifact_names) parts.push(`Artifacts: ${context.huntData.artifact_names.join(', ')}`);
    }
    if (context.alertData) {
      parts.push(`Alert: ${context.alertData.title || context.alertData.alert_id}`);
      if (context.alertData.severity) parts.push(`Severity: ${context.alertData.severity}`);
    }
    if (context.artifactName) parts.push(`Artifact: ${context.artifactName}`);
    if (context.flowData) {
      parts.push(`Flow ID: ${context.flowData.flow_id || context.flowData.session_id}`);
      if (context.flowData.artifacts_with_results) parts.push(`Collected: ${context.flowData.artifacts_with_results.join(', ')}`);
    }
    if (context.vqlQuery) parts.push(`VQL Query:\n\`\`\`vql\n${context.vqlQuery}\n\`\`\``);

    if (parts.length > 0) return `[Velociraptor Context]\n${parts.join('\n')}\n\n[User Question]\n${message}`;
    return message;
  }

  getChatStats() {
    return {
      activeSessions: this.chatSessions.size + this.histories.size,
      isAvailable: this.isAvailable(),
      model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
    };
  }
}

// Singleton instance
const aiService = new AIService();

module.exports = aiService;
