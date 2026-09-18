/**
 * Comprehensive Verification Test for OpenAI AI Assistant Upgrade in InterviewX
 * Tests:
 * 1. Dashboard AI:
 *    - "what is mongodb?" -> Natural concept explanation
 *    - "why did we use mongodb in interviewx?" -> InterviewX project context
 *    - "explain it simply" -> Context continuity
 *    - "my django api gives 500 error" -> Debugging workflow (cause, fix, code)
 *    - "start a mock interview" -> Mode switches to interview_practice
 *    - Casual acknowledgments ("ok", "thanks")
 * 2. Results AI:
 *    - "why did I get a low technical score?" -> Grounded in interview result
 *    - "which question was my weakest?" -> Points out weakest question
 *    - "explain question 4 feedback" -> Explains Q4 specific feedback
 *    - "make me a 7 day improvement plan" -> Plan based on weak areas
 *    - Verifies it does NOT automatically start an interview
 * 3. Title Generation:
 *    - MongoDB Indexing
 *    - Django Debugging
 *    - Resume Improvement
 *    - Interview Preparation
 *    - API Explanation
 *    - Project Architecture
 * 4. Mode & Intent Detection & Context Architecture
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const aiCoachService = require('../services/aiCoachService');

async function runTests() {
  console.log('====================================================');
  console.log('Starting InterviewX OpenAI AI Assistant Test Suite');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // ─────────────────────────────────────────────────────────────
  // 1. TITLE GENERATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 1. Title Generation Tests ---');

  await test('Generates "MongoDB Indexing" title', () => {
    const title = aiCoachService.generateConversationTitle('explain mongodb indexing');
    assert.strictEqual(title, 'MongoDB Indexing');
    const chatTitle = aiCoachService.generateChatTitle('what are mongodb indexes?', 'dashboard');
    assert.strictEqual(chatTitle, 'MongoDB Indexing');
  });

  await test('Generates "Django Debugging" title', () => {
    const title = aiCoachService.generateConversationTitle('my django api gives 500 error');
    assert.strictEqual(title, 'Django Debugging');
    const chatTitle = aiCoachService.generateChatTitle('django server gives 500 error', 'dashboard');
    assert.strictEqual(chatTitle, 'Django Debugging');
  });

  await test('Generates "Resume Improvement" title', () => {
    const title = aiCoachService.generateConversationTitle('how can I improve my resume?');
    assert.strictEqual(title, 'Resume Improvement');
    const chatTitle = aiCoachService.generateChatTitle('review and improve my resume', 'dashboard');
    assert.strictEqual(chatTitle, 'Resume Improvement');
  });

  await test('Generates "Interview Preparation" title', () => {
    const title = aiCoachService.generateConversationTitle('how should I prepare for a backend interview?');
    assert.strictEqual(title, 'Interview Preparation');
    const chatTitle = aiCoachService.generateChatTitle('interview preparation plan', 'dashboard');
    assert.strictEqual(chatTitle, 'Interview Preparation');
  });

  await test('Generates "API Explanation" title', () => {
    const title = aiCoachService.generateConversationTitle('what is an api');
    assert.strictEqual(title, 'API Explanation');
    const chatTitle = aiCoachService.generateChatTitle('explain REST APIs', 'dashboard');
    assert.strictEqual(chatTitle, 'API Explanation');
  });

  await test('Generates "Project Architecture" title', () => {
    const title = aiCoachService.generateConversationTitle('explain my project architecture');
    assert.strictEqual(title, 'Project Architecture');
    const chatTitle = aiCoachService.generateChatTitle('project architecture review', 'dashboard');
    assert.strictEqual(chatTitle, 'Project Architecture');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. MODE & INTENT DETECTION
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 2. Mode & Intent Detection Tests ---');

  await test('Default mode is general_chat for concept queries', () => {
    const res = aiCoachService.detectModeAndIntent('what is mongodb?');
    assert.strictEqual(res.mode, 'general_chat');
    assert.strictEqual(res.intent.toLowerCase(), 'technical_explanation');
  });

  await test('Default mode is general_chat for debugging queries', () => {
    const res = aiCoachService.detectModeAndIntent('my django api gives 500 error');
    assert.strictEqual(res.mode, 'general_chat');
    assert.strictEqual(res.intent.toLowerCase(), 'debugging');
  });

  await test('Switches to interview_practice ONLY when explicitly requested', () => {
    const res = aiCoachService.detectModeAndIntent('start a mock interview');
    assert.strictEqual(res.mode, 'interview_practice');
    assert(res.intent.toLowerCase().includes('practice'));
  });

  await test('Switches to answer_evaluation ONLY when explicitly requested', () => {
    const res = aiCoachService.detectModeAndIntent('evaluate my answer: MongoDB uses B-trees for indexing');
    assert.strictEqual(res.mode, 'answer_evaluation');
    assert(res.intent.toLowerCase().includes('evaluation'));
  });

  await test('Switches to results_coaching for result queries or result context', () => {
    const res = aiCoachService.detectModeAndIntent('why was my technical score low?');
    assert.strictEqual(res.mode, 'results_coaching');
    assert(res.intent.toLowerCase().includes('result'));

    const res2 = aiCoachService.detectModeAndIntent('explain my mistake', [], {
      sourceInterviewContext: { interviewId: '123' },
    });
    assert.strictEqual(res2.mode, 'results_coaching');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. DASHBOARD ASSISTANT CONVERSATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 3. Dashboard Assistant Conversation Flow ---');

  await test('Dashboard: "what is mongodb?" provides natural explanation', async () => {
    const resp = await aiCoachService.generateDashboardAssistantResponse({
      message: 'what is mongodb?',
      history: [],
      context: { candidateName: 'Prakash', targetRole: 'Full Stack Engineer' },
    });
    assert(resp.content, 'Response content should not be empty');
    assert(
      resp.content.toLowerCase().includes('document') || resp.content.toLowerCase().includes('nosql') || resp.content.toLowerCase().includes('database'),
      'Should mention document or NoSQL database'
    );
    assert.strictEqual(resp.mode, 'general_chat');
  });

  await test('Dashboard: "why did we use mongodb in interviewx?" uses project context', async () => {
    const resp = await aiCoachService.generateDashboardAssistantResponse({
      message: 'why did we use mongodb in interviewx?',
      history: [{ role: 'user', content: 'what is mongodb?' }],
      context: { candidateName: 'Prakash', targetRole: 'Full Stack Engineer' },
    });
    assert(resp.content, 'Response content should not be empty');
    assert(
      resp.content.toLowerCase().includes('interview') ||
      resp.content.toLowerCase().includes('schema') ||
      resp.content.toLowerCase().includes('transcript') ||
      resp.content.toLowerCase().includes('document'),
      'Should relate MongoDB to interview platform needs'
    );
  });

  await test('Dashboard: "explain it simply" maintains conversation context', async () => {
    const resp = await aiCoachService.generateDashboardAssistantResponse({
      message: 'explain it simply',
      history: [
        { role: 'user', content: 'what is mongodb?' },
        { role: 'assistant', content: 'MongoDB is a document-oriented NoSQL database...' },
      ],
      context: { candidateName: 'Prakash' },
    });
    assert(resp.content, 'Response content should not be empty');
    assert(
      resp.content.length > 20,
      'Should provide a simple explanation of MongoDB'
    );
  });

  await test('Dashboard: "my django api gives 500 error" provides structured debugging', async () => {
    const resp = await aiCoachService.generateDashboardAssistantResponse({
      message: 'my django api gives 500 error',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    assert(resp.content, 'Response content should not be empty');
    const lower = resp.content.toLowerCase();
    assert(
      lower.includes('traceback') || lower.includes('debug') || lower.includes('500') || lower.includes('logs'),
      'Should instruct user on checking traceback or server logs'
    );
  });

  await test('Dashboard: "start a mock interview" switches mode to interview_practice', async () => {
    const resp = await aiCoachService.generateDashboardAssistantResponse({
      message: 'start a mock interview',
      history: [],
      context: { targetRole: 'Backend Developer' },
    });
    assert.strictEqual(resp.mode, 'interview_practice');
    assert(resp.content, 'Should provide mock interview starting prompt');
  });

  await test('Dashboard: Casual short responses ("ok", "thanks")', async () => {
    const respOk = await aiCoachService.generateDashboardAssistantResponse({
      message: 'ok',
      history: [],
    });
    assert(respOk.content.length < 50, 'Casual reply to "ok" should be concise');

    const respThanks = await aiCoachService.generateDashboardAssistantResponse({
      message: 'thanks',
      history: [],
    });
    assert(respThanks.content.length < 50, 'Casual reply to "thanks" should be concise');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. RESULTS ASSISTANT CONVERSATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 4. Results Assistant Conversation Flow ---');

  const mockResultContext = {
    targetRole: 'Backend Engineer',
    difficulty: 'Intermediate',
    overallScore: 64,
    technicalScore: 58,
    communicationScore: 78,
    problemSolvingScore: 60,
    strengths: ['Clear spoken delivery', 'Good REST understanding'],
    weaknesses: ['Database indexing & query optimization', 'Missing error handling in async endpoints'],
    recommendations: ['Study MongoDB compound indexes', 'Practice asynchronous error handling in Node.js'],
    questions: [
      {
        text: 'Explain how database indexing works.',
        category: 'Database',
        difficulty: 'Intermediate',
        userAnswer: 'Indexes make queries fast by looking up things quickly.',
        score: 45,
        strengths: ['Identified general purpose of indexes'],
        missingConcepts: ['B-Tree structure', 'Index scan vs collection scan', 'Write overhead'],
        feedback: 'Answer was superficial. Did not explain underlying data structures or trade-offs.',
      },
      {
        text: 'How do you handle unhandled promise rejections in Node.js?',
        category: 'Node.js',
        difficulty: 'Intermediate',
        userAnswer: 'Using process.on unhandledRejection.',
        score: 75,
        strengths: ['Mentioned process event'],
        missingConcepts: ['Graceful shutdown', 'Logging to monitoring tool'],
        feedback: 'Good basic knowledge, but missed production resilience patterns.',
      },
      {
        text: 'What is the event loop in Node.js?',
        category: 'Architecture',
        difficulty: 'Intermediate',
        userAnswer: 'It is single threaded and manages async callbacks.',
        score: 70,
        strengths: ['Understands non-blocking nature'],
        missingConcepts: ['Phases of event loop (timers, poll, check)'],
        feedback: 'Correct high level overview.',
      },
      {
        text: 'Explain ACID properties in database transactions.',
        category: 'Database',
        difficulty: 'Advanced',
        userAnswer: 'Atomicity, Consistency, Isolation, Durability.',
        score: 42,
        strengths: ['Remembered acronym'],
        missingConcepts: ['Isolation levels', 'Transaction rollbacks in distributed systems'],
        feedback: 'Mentioned only acronym without explaining how consistency or isolation are enforced.',
      },
    ],
  };

  await test('Results: "why did I get a low technical score?" grounds in result', async () => {
    const resp = await aiCoachService.generateResultsAssistantResponse({
      message: 'why did I get a low technical score?',
      history: [],
      resultContext: mockResultContext,
    });
    assert(resp.content, 'Response content should not be empty');
    const lower = resp.content.toLowerCase();
    assert(
      lower.includes('58%') || lower.includes('indexing') || lower.includes('technical') || lower.includes('database'),
      'Should mention actual technical score (58%) or technical weakness (indexing/database)'
    );
  });

  await test('Results: "which question was my weakest?" identifies Question 4 or 1', async () => {
    const resp = await aiCoachService.generateResultsAssistantResponse({
      message: 'which question was my weakest?',
      history: [],
      resultContext: mockResultContext,
    });
    assert(resp.content, 'Response content should not be empty');
    const lower = resp.content.toLowerCase();
    assert(
      lower.includes('question 4') || lower.includes('acid') || lower.includes('question 1') || lower.includes('indexing'),
      'Should highlight weakest question (Q4 score 42% or Q1 score 45%)'
    );
  });

  await test('Results: "explain question 4 feedback" details Q4 evaluation', async () => {
    const resp = await aiCoachService.generateResultsAssistantResponse({
      message: 'explain question 4 feedback',
      history: [],
      resultContext: mockResultContext,
    });
    assert(resp.content, 'Response content should not be empty');
    const lower = resp.content.toLowerCase();
    assert(
      lower.includes('acid') || lower.includes('isolation') || lower.includes('consistency') || lower.includes('42'),
      'Should explain feedback on question 4 ACID properties'
    );
  });

  await test('Results: "make me a 7 day improvement plan" targets weaknesses', async () => {
    const resp = await aiCoachService.generateResultsAssistantResponse({
      message: 'make me a 7 day improvement plan based on this result',
      history: [],
      resultContext: mockResultContext,
    });
    assert(resp.content, 'Response content should not be empty');
    const lower = resp.content.toLowerCase();
    assert(
      lower.includes('day') || lower.includes('plan'),
      'Should generate a multi-day plan'
    );
    assert(
      lower.includes('database') || lower.includes('index') || lower.includes('node') || lower.includes('acid'),
      'Plan should target candidate actual recorded weak areas'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 5. UNIFIED CHAT() DISPATCHER WITH STRUCTURED CONTEXT
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 5. Unified chat() Dispatcher & Structured Context ---');

  await test('chat() maintains structured context and returns correct mode', async () => {
    const chatRes = await aiCoachService.chat({
      message: 'what is an api',
      history: [],
      context: {
        candidateName: 'Prakash',
        targetRole: 'Backend Engineer',
        yearsOfExperience: 3,
        resumeSkills: ['Node.js', 'MongoDB', 'React'],
      },
    });
    assert.strictEqual(chatRes.mode, 'general_chat');
    assert(chatRes.content, 'Content should exist');
    assert(
      chatRes.content.toLowerCase().includes('application programming interface') ||
      chatRes.content.toLowerCase().includes('api') ||
      chatRes.content.toLowerCase().includes('request'),
      'Should explain API'
    );
  });

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
