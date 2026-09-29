/**
 * LLM Service
 * 
 * Provides unified interface for calling LLM providers (OpenAI / OpenAI-compatible).
 * Supports both LLM_API_KEY and OPENAI_API_KEY environment variables.
 */

const axios = require('axios');

const getApiKey = () => {
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '' || key === 'your_llm_api_key_here' || key === 'YOUR_LLM_API_KEY_HERE') {
    return null;
  }
  return key.trim();
};

const isConfigured = () => {
  return !!getApiKey();
};

const getProvider = () => {
  return process.env.LLM_PROVIDER || 'openai';
};

/**
 * Generate technical explanation for common concepts when external LLM is offline/mocked
 */
const generateLocalExplanation = (query, context = {}) => {
  const lower = query.toLowerCase();

  if (/what is react|explain react|tell me about react/i.test(lower)) {
    return `**React** is an open-source JavaScript library developed by Meta for building dynamic, component-driven user interfaces.

### Core Architectural Concepts:
1. **Component-Based Architecture**: UI is decomposed into self-contained, reusable components (functions) that manage their own state and render declarations.
2. **Virtual DOM & Reconciliation**: React maintains an in-memory representation of the real DOM. When component state changes, React's reconciliation engine (Fiber) calculates the minimal diff and applies batched updates to the actual browser DOM efficiently.
3. **Declarative State & Hooks**: Modern React uses functional components with Hooks:
   - \`useState\` / \`useReducer\` for local state management
   - \`useEffect\` for side effects and lifecycles (subscriptions, data fetching)
   - \`useMemo\` and \`useCallback\` for referential equality and performance tuning
4. **Unidirectional Data Flow**: Data flows strictly downwards via props, while state updates flow upwards via event callbacks, making applications predictable and easier to debug.`;
  }

  if (/what is python|explain python/i.test(lower)) {
    return `**Python** is a high-level, interpreted, dynamically-typed programming language renowned for readable syntax, rapid prototyping, and extensive ecosystem support.

### Key Technical Pillars:
1. **Execution Model**: Python code compiles to bytecode (\`.pyc\`), executed by the CPython Virtual Machine.
2. **Global Interpreter Lock (GIL)**: A mutex that protects CPython object memory, preventing multiple native threads from executing Python bytecodes concurrently. Multi-core parallelism is achieved via \`multiprocessing\` or asynchronous I/O with \`asyncio\`.
3. **Memory Management**: Automatic reference counting paired with a generational cyclic garbage collector.
4. **Batteries Included**: Comprehensive standard library alongside top-tier frameworks like FastAPI and Django.`;
  }

  return null;
};

/**
 * Main completion call with real LLM invocation and clear error handling
 */
const generateCompletion = async ({ messages, systemPrompt, maxTokens = 600, temperature = 0.7, allowLocalFallback = true }) => {
  const apiKey = getApiKey();

  // If real key exists, call OpenAI API
  if (apiKey) {
    const endpoint = process.env.LLM_API_BASE || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';

    const fullMessages = [];
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    try {
      const response = await axios.post(
        endpoint,
        {
          model,
          messages: fullMessages,
          max_tokens: maxTokens,
          temperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('LLM provider returned empty response.');
      }
      return content.trim();
    } catch (err) {
      const apiMsg = err.response?.data?.error?.message || err.message;
      const error = new Error(`LLM API request failed: ${apiMsg}`);
      error.code = 'LLM_API_ERROR';
      error.status = err.response?.status || 500;
      throw error;
    }
  }

  // If key is missing, check if local technical explanation is available
  if (allowLocalFallback && messages && messages.length > 0) {
    const lastUserMsg = messages[messages.length - 1].content;
    const localResp = generateLocalExplanation(lastUserMsg);
    if (localResp) {
      return localResp;
    }
  }

  // No key and no fallback -> throw clear configuration error (never fake success)
  const error = new Error('LLM_CONFIG_ERROR: No valid LLM_API_KEY or OPENAI_API_KEY configured. Please provide a valid key in backend/.env.');
  error.code = 'LLM_CONFIG_ERROR';
  throw error;
};

module.exports = {
  getApiKey,
  isConfigured,
  getProvider,
  generateCompletion,
  generateLocalExplanation,
};
