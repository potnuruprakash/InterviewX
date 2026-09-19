/**
 * Google Gemini Provider for InterviewX AI Assistant
 *
 * Implements conversational chat completions using Gemini REST API.
 */

const axios = require('axios');

class GeminiProvider {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.isAvailable = Boolean(apiKey && apiKey.trim() && !apiKey.includes('your_gemini_api_key'));
  }

  async generateChatCompletion(messages, options = {}) {
    if (!this.isAvailable || !this.apiKey) {
      throw new Error('GEMINI_NOT_CONFIGURED: Valid GEMINI_API_KEY is not configured in backend/.env');
    }

    const modelName = options.model || this.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    // Transform messages to Gemini format (contents with parts)
    const contents = [];
    let systemInstruction = null;

    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction = { parts: [{ text: m.content }] };
      } else {
        const role = m.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: m.content }],
        });
      }
    }

    const requestBody = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1000,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000,
    });

    const candidates = response.data?.candidates;
    const text = candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content: text,
      model: modelName,
      usage: response.data?.usageMetadata || null,
      provider: 'gemini',
    };
  }
}

module.exports = GeminiProvider;
