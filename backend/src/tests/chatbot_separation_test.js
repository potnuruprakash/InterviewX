/**
 * Automated Verification Test Suite for InterviewX Chatbot Separation & UX Upgrade
 *
 * Tests:
 * 1. Unauthenticated route protection (401)
 * 2. Dashboard Chatbot:
 *    - Session creation & distinct welcome message
 *    - Message processing without interviewer behavior
 *    - Auto-generated session titles (40-60 chars)
 * 3. Fresh Session on Each Chatbot Open:
 *    - Session 1 != Session 2, both preserved in history
 * 4. Results Chatbot:
 *    - User ownership verification (User B cannot access User A's result)
 *    - Scoped session creation & Results welcome message
 *    - Context-grounded response using actual interview scores, questions, weaknesses
 * 5. Zero Shared History:
 *    - Dashboard sessions never appear in Results history
 *    - Results sessions never appear in Dashboard history
 *    - Result A sessions never appear in Result B sessions
 * 6. History Retrieval:
 *    - Manual retrieval of past sessions loads full conversation
 */

const http = require('http');
const axios = require('axios');
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore
}

process.env.NODE_ENV = 'test';
process.env.TEST_AUTH_ENABLED = 'true';
require('dotenv').config();
const app = require('../app');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');

const PORT = 5599;

async function runChatbotSeparationTests() {
  console.log('================================================================');
  console.log('STARTING INTERVIEWX CHATBOT SEPARATION & ARCHITECTURE TESTS');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/interviewx';
  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on http://localhost:${PORT}`);

  const client = axios.create({
    baseURL: `http://localhost:${PORT}`,
    validateStatus: () => true,
  });

  const userA = 'user_chat_test_A_' + Date.now();
  const userB = 'user_chat_test_B_' + Date.now();

  const userAHeaders = { 'x-test-clerk-user-id': userA };
  const userBHeaders = { 'x-test-clerk-user-id': userB };

  const testResults = [];
  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      testResults.push({ name, status: 'PASS' });
    } else {
      console.error(`  ❌ FAIL: ${name} — ${details}`);
      testResults.push({ name, status: 'FAIL', details });
    }
  }

  try {
    // ── 1. UNAUTHENTICATED PROTECTION ──────────────────────────────────────
    console.log('\n--- 1. Testing Unauthenticated Route Protection ---');

    const unauthDashGet = await client.get('/api/chat/dashboard/sessions');
    assertTest(
      'Unauthenticated GET /api/chat/dashboard/sessions rejected with 401',
      unauthDashGet.status === 401,
      `Status: ${unauthDashGet.status}`
    );

    const unauthDashPost = await client.post('/api/chat/dashboard/sessions');
    assertTest(
      'Unauthenticated POST /api/chat/dashboard/sessions rejected with 401',
      unauthDashPost.status === 401,
      `Status: ${unauthDashPost.status}`
    );

    const unauthResGet = await client.get('/api/chat/results/507f1f77bcf86cd799439011/sessions');
    assertTest(
      'Unauthenticated GET /api/chat/results/:id/sessions rejected with 401',
      unauthResGet.status === 401,
      `Status: ${unauthResGet.status}`
    );

    // ── 2. DASHBOARD CHATBOT LIFECYCLE ──────────────────────────────────────
    console.log('\n--- 2. Testing Dashboard Chatbot Lifecycle ---');

    // Create first session
    const dashSession1Res = await client.post('/api/chat/dashboard/sessions', {}, { headers: userAHeaders });
    assertTest('Create Dashboard session status 201', dashSession1Res.status === 201, `Status: ${dashSession1Res.status}`);

    const dashSession1 = dashSession1Res.data?.session;
    const dashMsgs1 = dashSession1Res.data?.messages || [];

    assertTest('Dashboard session contextType is dashboard', dashSession1?.contextType === 'dashboard');
    assertTest('Dashboard session initial title is New Chat', dashSession1?.title === 'New Chat');
    assertTest('Dashboard session has initial assistant welcome message', dashMsgs1.length === 1 && dashMsgs1[0].role === 'assistant');
    assertTest('Dashboard welcome message contains "Dashboard AI 👋"', dashMsgs1[0]?.content?.includes('Dashboard AI 👋'));
    assertTest('Dashboard welcome message contains expected bullet points', dashMsgs1[0]?.content?.includes('Technical concepts'));

    // Post first user message: "Explain Django MVT"
    console.log('\n--- 2.B Posting to Dashboard Chatbot ("Explain Django MVT") ---');
    const postDashMsgRes = await client.post(
      `/api/chat/dashboard/sessions/${dashSession1.id}/messages`,
      { content: 'Explain Django MVT' },
      { headers: userAHeaders }
    );

    assertTest('Post message status 200', postDashMsgRes.status === 200, `Status: ${postDashMsgRes.status}`);
    const dashUserMsg = postDashMsgRes.data?.userMessage;
    const dashAssistantMsg = postDashMsgRes.data?.assistantMessage;
    const updatedDashSession = postDashMsgRes.data?.session;

    assertTest('User message saved', Boolean(dashUserMsg && dashUserMsg.content === 'Explain Django MVT'));
    assertTest('Assistant response received', Boolean(dashAssistantMsg && dashAssistantMsg.content.length > 50));
    assertTest('Assistant response explains Django MVT', dashAssistantMsg.content.includes('Model-View-Template') || dashAssistantMsg.content.includes('Model (M)'));
    assertTest('Session title automatically updated from first message', updatedDashSession?.title === 'Django MVT' || updatedDashSession?.title?.includes('Django'));

    // ── 3. FRESH SESSIONS ON OPEN (CRITICAL REQUIREMENT 2) ──────────────────
    console.log('\n--- 3. Testing Fresh Session on Chatbot Open ---');

    const dashSession2Res = await client.post('/api/chat/dashboard/sessions', {}, { headers: userAHeaders });
    assertTest('Create second Dashboard session status 201', dashSession2Res.status === 201);
    const dashSession2 = dashSession2Res.data?.session;

    assertTest('Session 2 ID is distinct from Session 1 ID', dashSession2?.id !== dashSession1?.id);

    // List Dashboard sessions
    const listDashRes = await client.get('/api/chat/dashboard/sessions', { headers: userAHeaders });
    assertTest('List Dashboard sessions status 200', listDashRes.status === 200);
    const userADashSessions = listDashRes.data?.sessions || [];
    assertTest('Both Dashboard sessions preserved in history', userADashSessions.length >= 2);
    assertTest('Session 1 is in history list', userADashSessions.some((s) => s.id === dashSession1.id));
    assertTest('Session 2 is in history list', userADashSessions.some((s) => s.id === dashSession2.id));

    // ── 4. RESULTS CHATBOT SETUP & SECURITY ─────────────────────────────────
    console.log('\n--- 4. Testing Results Chatbot Setup & Multi-Tenant Security ---');

    // Create interview result for User A
    const dummyResumeId = new mongoose.Types.ObjectId();
    const dummyJobId = new mongoose.Types.ObjectId();

    const interviewA = await Interview.create({
      clerkUserId: userA,
      resumeId: dummyResumeId,
      jobDescriptionId: dummyJobId,
      targetRole: 'Backend Systems Engineer',
      difficulty: 'medium',
      status: 'completed',
      finalEvaluation: {
        overallScore: 78,
        technicalScore: 82,
        communicationScore: 74,
        problemSolvingScore: 79,
        strongAreas: ['Python Concurrency', 'PostgreSQL Query Optimization'],
        weakAreas: ['System Design Scalability', 'Advanced Caching Trade-offs'],
        recommendations: ['Practice horizontal sharding', 'Structure verbal answers with STAR'],
      },
      completedAt: new Date(),
    });

    const questionA1 = await Question.create({
      interviewId: interviewA._id,
      clerkUserId: userA,
      text: 'How does MongoDB handle indexing under high write loads?',
      type: 'technical',
      category: 'technical',
      difficulty: 'medium',
      order: 1,
    });

    await Response.create({
      interviewId: interviewA._id,
      questionId: questionA1._id,
      clerkUserId: userA,
      answerText: 'MongoDB uses B-trees for indexing. Every insert must update the index, creating write amplification.',
      textEvaluation: {
        textScore: 80,
        strengths: ['Identified B-tree structure and write amplification'],
        missingConcepts: ['WiredTiger cache eviction', 'Background indexing vs in-memory pressure'],
        feedback: 'Good fundamental understanding of index maintenance costs.',
      },
    });

    // Create interview result for User B
    const interviewB = await Interview.create({
      clerkUserId: userB,
      resumeId: dummyResumeId,
      jobDescriptionId: dummyJobId,
      targetRole: 'Frontend Architect',
      difficulty: 'hard',
      status: 'completed',
      finalEvaluation: {
        overallScore: 88,
        technicalScore: 90,
        communicationScore: 85,
        strongAreas: ['React Fiber', 'Web Vitals'],
        weakAreas: ['Micro-frontends'],
      },
      completedAt: new Date(),
    });

    // Security Check: User B attempts to access User A's interview result sessions
    console.log('\n--- 4.B Testing Cross-Tenant Security ---');
    const crossAccessGet = await client.get(`/api/chat/results/${interviewA._id}/sessions`, {
      headers: userBHeaders,
    });
    assertTest(
      'User B cannot read User A interview result sessions (404/reject)',
      crossAccessGet.status === 404,
      `Status: ${crossAccessGet.status}`
    );

    const crossAccessPost = await client.post(
      `/api/chat/results/${interviewA._id}/sessions`,
      {},
      { headers: userBHeaders }
    );
    assertTest(
      'User B cannot create sessions on User A interview result (404/reject)',
      crossAccessPost.status === 404,
      `Status: ${crossAccessPost.status}`
    );

    // ── 5. RESULTS CHATBOT CREATION & CONTEXT GROUNDING ─────────────────────
    console.log('\n--- 5. Testing Results Chatbot Creation & Grounded Context ---');

    const resultSessionRes = await client.post(
      `/api/chat/results/${interviewA._id}/sessions`,
      {},
      { headers: userAHeaders }
    );
    assertTest('Create Results session status 201', resultSessionRes.status === 201, `Status: ${resultSessionRes.status}`);

    const resSession = resultSessionRes.data?.session;
    const resMsgs = resultSessionRes.data?.messages || [];

    assertTest('Results session contextType is results', resSession?.contextType === 'results');
    assertTest('Results session sourceInterviewId is linked', String(resSession?.sourceInterviewId) === String(interviewA._id));
    assertTest('Results welcome message contains "Results AI 📊"', resMsgs[0]?.content?.includes('Results AI 📊'));
    assertTest('Results welcome message contains expected performance prompts', resMsgs[0]?.content?.includes('Weak areas'));

    // Post to Results chatbot: "Why did I get this score?"
    console.log('\n--- 5.B Asking Results AI: "Why did I get this score?" ---');
    const postResMsg1 = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/messages`,
      { content: 'Why did I get this score?' },
      { headers: userAHeaders }
    );

    assertTest('Post Results message status 200', postResMsg1.status === 200, `Status: ${postResMsg1.status}`);
    const resAssistantMsg1 = postResMsg1.data?.assistantMessage;

    assertTest(
      'Results AI mentions actual overall score (78%)',
      resAssistantMsg1?.content?.includes('78'),
      `Content snippet: ${resAssistantMsg1?.content?.slice(0, 150)}`
    );
    assertTest(
      'Results AI mentions actual technical score (82%)',
      resAssistantMsg1?.content?.includes('82')
    );
    assertTest(
      'Results AI mentions actual communication score (74%)',
      resAssistantMsg1?.content?.includes('74'),
      `Content was: ${resAssistantMsg1?.content}`
    );

    // Post to Results chatbot: "Explain my weak areas"
    console.log('\n--- 5.C Asking Results AI: "Explain my weak areas" ---');
    const postResMsg2 = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/messages`,
      { content: 'Explain my weak areas' },
      { headers: userAHeaders }
    );

    const resAssistantMsg2 = postResMsg2.data?.assistantMessage;
    assertTest(
      'Results AI cites actual recorded weak areas ("System Design Scalability")',
      resAssistantMsg2?.content?.includes('System Design') || resAssistantMsg2?.content?.includes('Scalability'),
      `Content snippet: ${resAssistantMsg2?.content?.slice(0, 150)}`
    );

    // ── 5.D IDEAL / REFERENCE ANSWER FOR QUESTION 1 ─────────────────────────
    console.log('\n--- 5.D Asking Results AI: "What was the correct answer for question 1?" ---');
    const postResMsg3 = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/messages`,
      { content: 'What was the correct answer for question 1?' },
      { headers: userAHeaders }
    );
    assertTest('Post Question 1 query status 200', postResMsg3.status === 200, `Status: ${postResMsg3.status}`);
    const resAssistantMsg3 = postResMsg3.data?.assistantMessage?.content || '';

    assertTest(
      'Results AI uses actual Question 1 from the interview',
      resAssistantMsg3.includes('MongoDB handle indexing') || resAssistantMsg3.includes('MongoDB'),
      `Content snippet: ${resAssistantMsg3.slice(0, 200)}`
    );
    assertTest(
      'Results AI shows candidate actual submitted answer',
      resAssistantMsg3.includes('B-trees') || resAssistantMsg3.includes('write amplification'),
      `Content snippet: ${resAssistantMsg3.slice(0, 200)}`
    );
    assertTest(
      'Results AI provides Ideal / Reference Answer',
      resAssistantMsg3.includes('Ideal') || resAssistantMsg3.includes('Reference Answer'),
      `Content snippet: ${resAssistantMsg3.slice(0, 200)}`
    );
    assertTest(
      'Results AI provides structured breakdown (What You Did Well / What Was Missing / Why)',
      resAssistantMsg3.includes('What You Did Well') || resAssistantMsg3.includes('What Was Missing') || resAssistantMsg3.includes('Why'),
      `Content snippet: ${resAssistantMsg3.slice(0, 200)}`
    );

    // ── 5.E ASKING "WHAT DID I MISS?" ────────────────────────────────────────
    console.log('\n--- 5.E Asking Results AI: "What did I miss?" ---');
    const postResMsg4 = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/messages`,
      { content: 'What did I miss?' },
      { headers: userAHeaders }
    );
    assertTest('Post "What did I miss?" status 200', postResMsg4.status === 200, `Status: ${postResMsg4.status}`);
    const resAssistantMsg4 = postResMsg4.data?.assistantMessage?.content || '';

    assertTest(
      'Results AI identifies actual missing concepts from evaluation (WiredTiger / cache / pressure)',
      resAssistantMsg4.includes('WiredTiger') || resAssistantMsg4.includes('cache') || resAssistantMsg4.includes('eviction') || resAssistantMsg4.includes('pressure') || resAssistantMsg4.includes('Background indexing'),
      `Content snippet: ${resAssistantMsg4.slice(0, 200)}`
    );

    // ── 5.F ASKING "GIVE ME AN INTERVIEW-READY ANSWER" ───────────────────────
    console.log('\n--- 5.F Asking Results AI: "Give me an interview-ready answer." ---');
    const postResMsg5 = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/messages`,
      { content: 'Give me an interview-ready answer.' },
      { headers: userAHeaders }
    );
    assertTest('Post "Give me an interview-ready answer" status 200', postResMsg5.status === 200, `Status: ${postResMsg5.status}`);
    const resAssistantMsg5 = postResMsg5.data?.assistantMessage?.content || '';

    assertTest(
      'Results AI provides concise interview-ready answer',
      resAssistantMsg5.includes('Interview-Ready') || resAssistantMsg5.includes('MongoDB') || resAssistantMsg5.includes('WiredTiger') || resAssistantMsg5.includes('write amplification'),
      `Content snippet: ${resAssistantMsg5.slice(0, 200)}`
    );

    // ── 6. ZERO SHARED HISTORY VERIFICATION (CRITICAL REQUIREMENT 1) ────────
    console.log('\n--- 6. Testing Complete Isolation & Zero Shared History ---');

    // 1. Dashboard sessions must NEVER contain Results sessions
    const dashSessionsCheck = await client.get('/api/chat/dashboard/sessions', { headers: userAHeaders });
    const dashList = dashSessionsCheck.data?.sessions || [];
    assertTest(
      'Dashboard sessions list contains NO Results sessions',
      dashList.every((s) => s.contextType === 'dashboard' && !s.sourceInterviewId)
    );
    assertTest(
      'Dashboard sessions list does not include the Results session',
      !dashList.some((s) => s.id === resSession.id)
    );

    // 2. Results sessions must NEVER contain Dashboard sessions
    const resSessionsCheck = await client.get(`/api/chat/results/${interviewA._id}/sessions`, {
      headers: userAHeaders,
    });
    const resList = resSessionsCheck.data?.sessions || [];
    assertTest(
      'Results sessions list contains NO Dashboard sessions',
      resList.every((s) => s.contextType === 'results' && String(s.sourceInterviewId) === String(interviewA._id))
    );
    assertTest(
      'Results sessions list does not include Dashboard session 1',
      !resList.some((s) => s.id === dashSession1.id)
    );
    assertTest(
      'Results sessions list does not include Dashboard session 2',
      !resList.some((s) => s.id === dashSession2.id)
    );

    // 3. Result A sessions must NEVER appear in Result B
    // Create a second interview for User A: interviewA2 with completely distinct questions
    const interviewA2 = await Interview.create({
      clerkUserId: userA,
      resumeId: dummyResumeId,
      jobDescriptionId: dummyJobId,
      targetRole: 'Data Engineering Lead',
      difficulty: 'hard',
      status: 'completed',
      finalEvaluation: { overallScore: 85, technicalScore: 88, communicationScore: 82 },
      completedAt: new Date(),
    });

    const questionA2_1 = await Question.create({
      interviewId: interviewA2._id,
      clerkUserId: userA,
      text: 'How does Apache Spark handle shuffle partitions and data skew?',
      type: 'technical',
      category: 'technical',
      difficulty: 'hard',
      order: 1,
    });

    await Response.create({
      interviewId: interviewA2._id,
      questionId: questionA2_1._id,
      clerkUserId: userA,
      answerText: 'Spark distributes data across executors using hash partitioning during wide transformations.',
      textEvaluation: {
        textScore: 78,
        strengths: ['Identified hash partitioning across executors'],
        missingConcepts: ['Salting keys for skew mitigation', 'Adaptive Query Execution (AQE) skew join optimization'],
        feedback: 'Good fundamental understanding of shuffle operations.',
      },
    });

    const res2SessionsCheck = await client.get(`/api/chat/results/${interviewA2._id}/sessions`, {
      headers: userAHeaders,
    });
    const res2List = res2SessionsCheck.data?.sessions || [];
    assertTest(
      'Interview A2 session list is empty initially (isolated from Interview A)',
      res2List.length === 0
    );

    // 4. Create session on Interview A2 and verify Results AI cannot access Interview A data
    console.log('\n--- 6.B Testing Question Isolation Between Two Results for Same User ---');
    const res2Create = await client.post(`/api/chat/results/${interviewA2._id}/sessions`, {}, { headers: userAHeaders });
    const res2SessionId = res2Create.data?.session?.id;

    const res2AskQ1 = await client.post(
      `/api/chat/results/${interviewA2._id}/sessions/${res2SessionId}/messages`,
      { content: 'What was the correct answer for question 1?' },
      { headers: userAHeaders }
    );
    const res2Q1Content = res2AskQ1.data?.assistantMessage?.content || '';

    assertTest(
      'Interview A2 Results AI references its own question (Apache Spark / shuffle)',
      res2Q1Content.includes('Spark') || res2Q1Content.includes('shuffle') || res2Q1Content.includes('skew'),
      `Content snippet: ${res2Q1Content.slice(0, 150)}`
    );
    assertTest(
      'Interview A2 Results AI NEVER references Interview A data (MongoDB)',
      !res2Q1Content.toLowerCase().includes('mongodb'),
      `Content unexpectedly contained MongoDB: ${res2Q1Content.slice(0, 150)}`
    );

    // ── 7. HISTORY RETRIEVAL & PERSISTENCE ───────────────────────────────────
    console.log('\n--- 7. Testing Manual History Retrieval ---');

    const getOldSessionRes = await client.get(`/api/chat/dashboard/sessions/${dashSession1.id}`, {
      headers: userAHeaders,
    });
    assertTest('Retrieve old Dashboard session status 200', getOldSessionRes.status === 200);
    const oldSessionData = getOldSessionRes.data?.session;
    const oldMessages = getOldSessionRes.data?.messages || [];
    assertTest('Old session retains auto-updated title', oldSessionData?.title === 'Django MVT' || oldSessionData?.title?.includes('Django'));
    assertTest('Old session retains all messages (welcome, user, assistant)', oldMessages.length >= 3);

    // ── 8. TESTING REGENERATE ENDPOINTS & CONTEXTUAL FOLLOW-UPS ───────────
    console.log('\n--- 8. Testing Regenerate Endpoints & Follow-ups ---');

    // 8.A Dashboard Regenerate
    const dashRegenRes = await client.post(
      `/api/chat/dashboard/sessions/${dashSession1.id}/regenerate`,
      {},
      { headers: userAHeaders }
    );
    assertTest('Dashboard regenerate status 200', dashRegenRes.status === 200, `Status: ${dashRegenRes.status}`);
    assertTest('Dashboard regenerate returns assistant message', !!dashRegenRes.data?.assistantMessage?.content);
    assertTest(
      'Dashboard regenerate provides contextual follow-up suggestions',
      Array.isArray(dashRegenRes.data?.assistantMessage?.metadata?.suggestions) &&
        dashRegenRes.data?.assistantMessage?.metadata?.suggestions.length > 0
    );

    // 8.B Results Regenerate
    const resultRegenRes = await client.post(
      `/api/chat/results/${interviewA._id}/sessions/${resSession.id}/regenerate`,
      {},
      { headers: userAHeaders }
    );
    assertTest('Results regenerate status 200', resultRegenRes.status === 200, `Status: ${resultRegenRes.status}`);
    assertTest('Results regenerate returns assistant message', !!resultRegenRes.data?.assistantMessage?.content);
    assertTest(
      'Results regenerate provides contextual follow-up suggestions',
      Array.isArray(resultRegenRes.data?.assistantMessage?.metadata?.suggestions) &&
        resultRegenRes.data?.assistantMessage?.metadata?.suggestions.length > 0
    );

    // ── SUMMARY ─────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    const passedCount = testResults.filter((r) => r.status === 'PASS').length;
    const failedCount = testResults.filter((r) => r.status === 'FAIL').length;
    console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      console.error('Some tests failed!');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    server.close();
  }
}

runChatbotSeparationTests();
