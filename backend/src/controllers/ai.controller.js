const aiService = require('../services/ai.service');
const logger = require('../utils/logger');

class AIController {
  // POST /api/ai/chat - Send message to AI
  async chat(req, res) {
    try {
      const { message, context } = req.body;
      const userId = req.user.userId;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const response = await aiService.chat(userId, message, context || {});
      res.json({ success: true, data: response });
    } catch (error) {
      logger.error('AI chat error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to process AI chat' });
    }
  }

  // POST /api/ai/chat/stream - Stream AI response
  async streamChat(req, res) {
    try {
      const { message, context } = req.body;
      const userId = req.user.userId;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await aiService.streamChat(userId, message, context || {}, (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      logger.error('AI stream chat error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message || 'Failed to stream AI chat' });
      }
    }
  }

  // POST /api/ai/analyze-vql - Analyze VQL query
  async analyzeVQL(req, res) {
    try {
      const { vql } = req.body;
      const userId = req.user.userId;

      if (!vql || typeof vql !== 'string') {
        return res.status(400).json({ success: false, error: 'VQL query is required' });
      }

      const analysis = await aiService.analyzeVQL(userId, vql);
      res.json({ success: true, data: { analysis, timestamp: new Date().toISOString() } });
    } catch (error) {
      logger.error('VQL analysis error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to analyze VQL' });
    }
  }

  // POST /api/ai/suggest-artifacts - Get artifact suggestions
  async suggestArtifacts(req, res) {
    try {
      const { description } = req.body;
      const userId = req.user.userId;

      if (!description || typeof description !== 'string') {
        return res.status(400).json({ success: false, error: 'Investigation description is required' });
      }

      const suggestions = await aiService.suggestArtifacts(userId, description);
      res.json({ success: true, data: { suggestions, timestamp: new Date().toISOString() } });
    } catch (error) {
      logger.error('Artifact suggestion error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to suggest artifacts' });
    }
  }

  // DELETE /api/ai/chat/history - Clear chat history
  async clearHistory(req, res) {
    try {
      const userId = req.user.userId;
      const cleared = aiService.clearChatHistory(userId);
      res.json({ success: true, data: { cleared, message: 'Chat history cleared' } });
    } catch (error) {
      logger.error('Clear history error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/ai/status - Get AI service status (now per-user)
  async getStatus(req, res) {
    try {
      const userId = req.user.userId;
      const stats = await aiService.getStatus(userId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Get AI status error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ─── New: provider management ──────────────────────────────────────────────

  // GET /api/ai/providers - List supported providers
  async getProviders(req, res) {
    res.json({ success: true, data: aiService.constructor.getProviders() });
  }

  // GET /api/ai/provider - Get current user's provider config
  async getProviderConfig(req, res) {
    try {
      const userId = req.user.userId;
      const cfg = await aiService.getUserConfig(userId);
      // Return a copy with masked API key – never mutate the cache
      const safe = cfg ? { ...cfg } : null;
      if (safe?.apiKey) safe.apiKey = safe.apiKey.slice(0, 8) + '••••••';
      res.json({ success: true, data: safe });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // PUT /api/ai/provider - Save user's provider config
  async saveProviderConfig(req, res) {
    try {
      const userId = req.user.userId;
      const { provider, apiKey, baseUrl, model } = req.body;
      if (!provider) return res.status(400).json({ success: false, error: 'Provider is required' });

      const saved = await aiService.saveUserConfig(userId, { provider, apiKey, baseUrl, model });
      // Return a copy with masked key
      const safe = { ...saved };
      if (safe.apiKey) safe.apiKey = safe.apiKey.slice(0, 8) + '••••••';
      res.json({ success: true, data: safe });
    } catch (error) {
      logger.error('Save provider config error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/ai/provider/test - Test a provider without saving
  async testProvider(req, res) {
    try {
      const { provider, apiKey, baseUrl, model } = req.body;
      if (!provider) return res.status(400).json({ success: false, error: 'Provider is required' });

      const result = await aiService.testProvider({ provider, apiKey, baseUrl, model });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Test provider error:', error);
      res.status(500).json({ success: false, data: { ok: false, message: error.message } });
    }
  }

  // POST /api/ai/provider/models - List models for a provider config
  async listModels(req, res) {
    try {
      const { provider, apiKey, baseUrl } = req.body;
      const models = await aiService.listModels({ provider, apiKey, baseUrl });
      res.json({ success: true, data: models });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AIController();
