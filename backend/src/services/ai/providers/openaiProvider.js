/**
 * OpenAI Provider for InterviewX AI Assistant
 *
 * Implements conversational chat completions using official OpenAI SDK.
 */

const OpenAI = require('openai');

class OpenAIProvider {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.isAvailable = Boolean(apiKey && apiKey.trim() && !apiKey.includes('your_openai_api_key'));

    if (this.isAvailable) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.client = null;
    }
  }

  async generateChatCompletion(messages, options = {}) {
    if (!this.isAvailable || !this.client) {
      throw new Error('OPENAI_NOT_CONFIGURED: Valid OPENAI_API_KEY is not configured in backend/.env');
    }

    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 1000;

    const response = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage,
      provider: 'openai',
    };
  }
}

module.exports = OpenAIProvider;
