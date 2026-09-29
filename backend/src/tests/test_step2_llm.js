const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const http = require('http');
const axios = require('axios');
const app = require('../app');
const llmService = require('../services/llmService');
const AIConversation = require('../models/AIConversation');

async function runStep2Tests() {
  console.log('====================================================');
  console.log('  STEP 2: LLM CONFIGURATION & AI COACH VERIFICATION  ');
  console.log('====================================================\n');

  // Verify DB connection
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  // Start test server on port 5055
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(5055, resolve));
  const client = axios.create({ baseURL: 'http://localhost:5055', validateStatus: () => true });

  const testClerkUserId = 'user_test_step2_' + Date.now();
  const headers = { 'x-dev-clerk-user-id': testClerkUserId };

  try {
    // 0. Code path & env variable check
    console.log('[Trace] Checking LLM API Key Configuration:');
    const configuredKey = llmService.getApiKey();
    const isConfigured = llmService.isConfigured();
    const provider = llmService.getProvider();
    console.log(`  LLM Provider: ${provider}`);
    console.log(`  LLM_API_KEY / OPENAI_API_KEY detected: ${isConfigured ? 'YES (Valid Key)' : 'NO / Dummy Placeholder'}`);

    // Test 1: Basic AI response ("What is React?")
    console.log('\n[Test 1] Sending: "What is React?" to AI Coach...');
    const res1 = await client.post('/api/coach/chat', { message: 'What is React?' }, { headers });
    if (res1.status !== 200 || !res1.data.success) {
      throw new Error(`Test 1 Failed: Status ${res1.status}, data: ${JSON.stringify(res1.data)}`);
    }

    const reply1 = res1.data.message;
    console.log('AI Coach Reply Snippet:\n', reply1.slice(0, 220) + '...\n');

    // Assertions for Test 1:
    const isGenericFallback = reply1.includes("I'm InterviewX Coach — your personal technical mentor");
    const hasReactConcepts = /component|virtual dom|state|declarative|library/i.test(reply1);
    const hasJavaLeakage = /\bjava\b|jvm|spring boot|jdk/i.test(reply1);
    const hasSvgArtifacts = /<svg|<\/svg>/i.test(reply1);
    const hasEscapedMarkdown = /\\n|\\r|\\"/i.test(reply1);

    if (isGenericFallback) throw new Error('Test 1 Failed: Received generic hardcoded fallback greeting instead of React explanation.');
    if (!hasReactConcepts) throw new Error('Test 1 Failed: Reply does not contain core React explanation concepts.');
    if (hasJavaLeakage) throw new Error('Test 1 Failed: Java concepts detected in React response.');
    if (hasSvgArtifacts) throw new Error('Test 1 Failed: SVG artifacts detected.');
    if (hasEscapedMarkdown) throw new Error('Test 1 Failed: Escaped markdown artifacts detected.');

    console.log('✅ Test 1 PASSED: Real technical explanation returned with no generic fallback, no Java, no SVG/escaped artifacts.');

    // Test 2: Context preservation
    console.log('\n[Test 2] Testing Multi-Turn Context Tracking...');
    
    // Turn 2.1: "I want to learn Python Full Stack."
    console.log('  Turn 2.1: "I want to learn Python Full Stack."');
    const res2_1 = await client.post('/api/coach/chat', { message: 'I want to learn Python Full Stack.' }, { headers });
    const reply2_1 = res2_1.data.message;
    if (!/python/i.test(reply2_1) || /\bjava\b/i.test(reply2_1)) {
      throw new Error('Test 2.1 Failed: Python context not established or Java leakage occurred.');
    }

    // Turn 2.2: "run mock on Python"
    console.log('  Turn 2.2: "run mock on Python"');
    const res2_2 = await client.post('/api/coach/chat', { message: 'run mock on Python' }, { headers });
    const reply2_2 = res2_2.data.message;
    if (!/python/i.test(reply2_2) || /\bjava\b/i.test(reply2_2)) {
      throw new Error('Test 2.2 Failed: Mock setup did not maintain Python context.');
    }

    // Turn 2.3: "give me a hint"
    console.log('  Turn 2.3: "give me a hint"');
    const res2_3 = await client.post('/api/coach/chat', { message: 'give me a hint' }, { headers });
    const reply2_3 = res2_3.data.message;
    if (!/python/i.test(reply2_3) || /\bjava\b/i.test(reply2_3)) {
      throw new Error('Test 2.3 Failed: Hint did not maintain Python context.');
    }

    // Turn 2.4: "make it harder"
    console.log('  Turn 2.4: "make it harder"');
    const res2_4 = await client.post('/api/coach/chat', { message: 'make it harder' }, { headers });
    const reply2_4 = res2_4.data.message;
    if (!/hard/i.test(reply2_4) || !/python/i.test(reply2_4) || /\bjava\b/i.test(reply2_4)) {
      throw new Error('Test 2.4 Failed: Difficulty adjustment did not maintain Python context or set to hard.');
    }

    console.log('✅ Test 2 PASSED: Context preserved across 4 turns strictly in Python without switching to Java.');

    // Test 3: Error handling when LLM is unavailable
    console.log('\n[Test 3] Testing Error Handling for Unavailable LLM Configuration...');
    const res3 = await client.post(
      '/api/coach/chat',
      { message: 'Explain complex unknown internal architecture query xyz' },
      { headers: { ...headers, 'x-test-error-mode': 'true' } }
    );
    console.log(`  Response status: ${res3.status}`);
    console.log(`  Error code: ${res3.data?.error}`);
    console.log(`  Error message: ${res3.data?.message}`);

    if (res3.status !== 503 || res3.data?.error !== 'LLM_CONFIG_ERROR') {
      throw new Error(`Test 3 Failed: Expected 503 LLM_CONFIG_ERROR, got status ${res3.status}`);
    }

    console.log('✅ Test 3 PASSED: Unavailable LLM correctly produces clear 503 error rather than fake success.');

    console.log('\n====================================================');
    console.log('  STEP 2 VERIFICATION COMPLETE: ALL TESTS PASSED ✅  ');
    console.log('====================================================');
  } finally {
    server.close();
    await AIConversation.deleteMany({ clerkUserId: testClerkUserId });
    await mongoose.disconnect();
  }
}

runStep2Tests().catch((err) => {
  console.error('\n❌ Step 2 Test Suite Failed:', err.message);
  process.exit(1);
});
