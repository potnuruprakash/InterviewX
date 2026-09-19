/**
 * LLM Provider Factory
 *
 * Resolves the configured LLM provider (OpenAI or Gemini) based on environment.
 */

const OpenAIProvider = require('./openaiProvider');
const GeminiProvider = require('./geminiProvider');

let openAIInstance = null;
let geminiInstance = null;

const getProvider = (preferredProvider = null) => {
  const providerType = (preferredProvider || process.env.LLM_PROVIDER || 'openai').toLowerCase().trim();

  if (providerType === 'gemini') {
    if (!geminiInstance) geminiInstance = new GeminiProvider();
    if (geminiInstance.isAvailable) return geminiInstance;

    // Fallback to OpenAI if Gemini not available
    if (!openAIInstance) openAIInstance = new OpenAIProvider();
    if (openAIInstance.isAvailable) return openAIInstance;
    return geminiInstance;
  }

  // Default to OpenAI
  if (!openAIInstance) openAIInstance = new OpenAIProvider();
  if (openAIInstance.isAvailable) return openAIInstance;

  // Fallback to Gemini if OpenAI not available
  if (!geminiInstance) geminiInstance = new GeminiProvider();
  if (geminiInstance.isAvailable) return geminiInstance;

  return openAIInstance;
};

module.exports = {
  getProvider,
  OpenAIProvider,
  GeminiProvider,
};
