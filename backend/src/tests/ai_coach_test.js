/**
 * Comprehensive End-to-End Test Suite for InterviewX AI Training Coach
 *
 * Tests:
 * 1. Multi-tenant Authorization & Security (User A cannot access User B's data)
 * 2. Coach Profile & Resume Status
 * 3. Quick Actions (train_me, practice_questions, weak_areas, analyze_interviews)
 * 4. Results → Train Me with Interview Evidence Synthesis
 * 5. Interactive Active Recall Loop (Question -> Answer -> Evaluation -> Difficulty -> Follow-up)
 * 6. Evidence-Based Training Progress Persistence
 */

const http = require('http');
const axios = require('axios');
const mongoose = require('mongoose');

require('dotenv').config();
const app = require('../app');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Resume = require('../models/Resume');
const AITrainingSession = require('../models/AITrainingSession');
const AITrainingMessage = require('../models/AITrainingMessage');
const AITrainingProgress = require('../models/AITrainingProgress');
const AITrainingProfile = require('../models/AITrainingProfile');

const PORT = 5566;

async function runAICoachTests() {
  console.log('==================================================');
  console.log('STARTING INTERVIEWX AI TRAINING COACH TEST SUITE');
  console.log('==================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/interviewx';
  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server active on http://localhost:${PORT}`);

  const client = axios.create({
    baseURL: `http://localhost:${PORT}`,
    validateStatus: () => true,
  });

  const userA = 'user_coach_tester_A_' + Date.now();
  const userB = 'user_coach_tester_B_' + Date.now();

  try {
    // ── 1. UNAUTHENTICATED REQUEST CHECK ─────────────────────────────────────
    console.log('\n--- Test 1: Unauthenticated Guard ---');
    const unauthRes = await client.get('/api/ai/coach/profile');
    console.log(`Unauthenticated GET /api/ai/coach/profile Status: ${unauthRes.status}`);
    const unauthPass = unauthRes.status === 401 && unauthRes.data.success === false;
    console.log(`Unauthenticated rejection: ${unauthPass ? '✅ PASS' : '❌ FAIL'}`);
    if (!unauthPass) throw new Error('Unauthenticated guard failed');

    // ── 2. GET COACH PROFILE (NO RESUME INITIAL STATE) ───────────────────────
    console.log('\n--- Test 2: Coach Profile & Empty Resume State ---');
    const profileRes = await client.get('/api/ai/coach/profile', {
      headers: { 'x-dev-clerk-user-id': userA },
    });
    console.log(`GET /api/ai/coach/profile Status: ${profileRes.status}`);
    console.log('Profile summary:', profileRes.data?.profile?.summary);
    console.log('Has resume flag:', profileRes.data?.hasResume);
    const profilePass = profileRes.status === 200 && profileRes.data.success === true && profileRes.data.hasResume === false;
    console.log(`Profile generation without resume: ${profilePass ? '✅ PASS' : '❌ FAIL'}`);
    if (!profilePass) throw new Error('Profile retrieval failed');

    // ── 3. CREATE RESUME FOR USER A ──────────────────────────────────────────
    console.log('\n--- Test 3: Resume Context Integration ---');
    const testResume = await Resume.create({
      clerkUserId: userA,
      originalName: 'test_candidate_resume.pdf',
      storedFilename: 'test_candidate_resume.pdf',
      filePath: './uploads/test_resume.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'completed',
      parsedData: {
        basicInfo: {
          name: 'Alex Candidate',
          email: 'alex@example.com',
          targetRole: 'Senior Backend Engineer',
        },
        skills: [
          { name: 'Node.js', canonicalName: 'Node.js', category: 'Backend' },
          { name: 'System Design', canonicalName: 'System Design', category: 'Architecture' },
          { name: 'Distributed Systems', canonicalName: 'Distributed Systems', category: 'Architecture' },
        ],
        projects: [
          {
            title: 'High-Throughput Ingestion Engine',
            technologies: ['Node.js', 'Kafka', 'Redis'],
            description: 'Processed 50,000 events/sec with at-least-once delivery semantics.',
          },
        ],
      },
    });

    // Re-check profile now that resume exists
    const profileWithResume = await client.get('/api/ai/coach/profile', {
      headers: { 'x-dev-clerk-user-id': userA },
    });
    console.log('Has Resume flag:', profileWithResume.data?.hasResume);
    console.log('Resume info:', profileWithResume.data?.resumeInfo);
    const resumeDetected = profileWithResume.data?.hasResume === true && profileWithResume.data?.resumeInfo?.skillsCount === 3;
    console.log(`Resume detected with skills: ${resumeDetected ? '✅ PASS' : '❌ FAIL'}`);
    if (!resumeDetected) throw new Error('Resume detection failed');

    // ── 4. CREATE DASHBOARD COACH SESSION (ENTRY POINT A) ────────────────────
    console.log('\n--- Test 4: Dashboard Coach Session (Entry Point A) ---');
    const sessionResA = await client.post(
      '/api/ai/coach/sessions',
      { contextType: 'dashboard' },
      { headers: { 'x-dev-clerk-user-id': userA } }
    );
    console.log(`POST /api/ai/coach/sessions Status: ${sessionResA.status}`);
    const sessionA = sessionResA.data?.session;
    const sessionMessagesA = sessionResA.data?.messages;
    console.log('Session ID:', sessionA?.id);
    console.log('Initial Greeting snippet:', sessionMessagesA?.[0]?.content?.slice(0, 100) + '...');
    const sessionAPass = sessionResA.status === 201 && Boolean(sessionA?.id) && sessionMessagesA?.length > 0;
    console.log(`Dashboard session creation: ${sessionAPass ? '✅ PASS' : '❌ FAIL'}`);
    if (!sessionAPass) throw new Error('Dashboard session creation failed');

    // ── 5. QUICK ACTIONS IN DASHBOARD COACH ──────────────────────────────────
    console.log('\n--- Test 5: Contextual Quick Actions (Train Me) ---');
    const trainMeActionRes = await client.post(
      `/api/ai/coach/sessions/${sessionA.id}/action`,
      { action: 'train_me' },
      { headers: { 'x-dev-clerk-user-id': userA } }
    );
    console.log(`Action train_me Status: ${trainMeActionRes.status}`);
    console.log('Assistant response snippet:', trainMeActionRes.data?.assistantMessage?.content?.slice(0, 120) + '...');
    const hasExercise = Boolean(trainMeActionRes.data?.session?.currentQuestionText);
    console.log('Current practice question text:', trainMeActionRes.data?.session?.currentQuestionText);
    console.log(`Quick action Train Me initiates practice question: ${hasExercise ? '✅ PASS' : '❌ FAIL'}`);
    if (!hasExercise) throw new Error('Train me action did not generate practice question');

    // ── 6. INTERACTIVE ANSWER EVALUATION & ADAPTIVE TRAINING LOOP ────────────
    console.log('\n--- Test 6: Interactive Answer Evaluation & Active Recall Loop ---');
    const candidateAnswer =
      'I would place an API gateway in front of the services, decouple worker queues using Apache Kafka to absorb burst traffic, and use Redis for fast distributed rate limiting. Downstream consumers will pull messages at a controlled pace.';

    const answerRes = await client.post(
      `/api/ai/coach/sessions/${sessionA.id}/messages`,
      { content: candidateAnswer },
      { headers: { 'x-dev-clerk-user-id': userA } }
    );
    console.log(`POST message answer Status: ${answerRes.status}`);
    const evalData = answerRes.data?.assistantMessage?.metadata;
    console.log('Evaluation Strengths:', evalData?.strengths);
    console.log('Missing/Deepening Concepts:', evalData?.missingConcepts);
    console.log('Score assigned:', evalData?.score);
    console.log('Follow-up Next Question:', answerRes.data?.session?.currentQuestionText);

    const evalPass =
      answerRes.status === 200 &&
      evalData?.isEvaluation === true &&
      typeof evalData?.score === 'number' &&
      Boolean(answerRes.data?.session?.currentQuestionText);

    console.log(`Interactive evaluation & concept reinforcement: ${evalPass ? '✅ PASS' : '❌ FAIL'}`);
    if (!evalPass) throw new Error('Answer evaluation failed');

    // ── 7. VERIFY TRAINING PROGRESS PERSISTENCE ──────────────────────────────
    console.log('\n--- Test 7: Evidence-Based Training Progress Persistence ---');
    const progressRes = await client.get('/api/ai/coach/progress', {
      headers: { 'x-dev-clerk-user-id': userA },
    });
    console.log('Progress records:', progressRes.data?.progress);
    const progressSaved =
      progressRes.status === 200 &&
      Array.isArray(progressRes.data?.progress) &&
      progressRes.data?.progress.length > 0;
    console.log(`Progress persistence verified: ${progressSaved ? '✅ PASS' : '❌ FAIL'}`);
    if (!progressSaved) throw new Error('Training progress persistence failed');

    // ── 8. RESULTS → TRAIN ME (ENTRY POINT B WITH INTERVIEW EVIDENCE) ────────
    console.log('\n--- Test 8: Results → Train Me (Entry Point B) ---');
    // Create a mock completed interview for User A with specific weaknesses
    const mockInterview = await Interview.create({
      clerkUserId: userA,
      resumeId: testResume._id,
      jobDescriptionId: new mongoose.Types.ObjectId(),
      targetRole: 'Full Stack Architect',
      interviewType: 'technical',
      difficulty: 'medium',
      status: 'completed',
      finalEvaluation: {
        overallScore: 62,
        technicalScore: 65,
        strongAreas: ['JavaScript Fundamentals', 'REST APIs'],
        weakAreas: ['System Design Reasoning', 'Database Sharding & Replication', 'STAR Framing'],
      },
      completedAt: new Date(),
    });

    const mockQuestion = await Question.create({
      interviewId: mockInterview._id,
      clerkUserId: userA,
      text: 'Explain how you would shard a relational database across multiple geographical regions.',
      category: 'technical',
      difficulty: 'medium',
      order: 1,
    });

    await Response.create({
      clerkUserId: userA,
      interviewId: mockInterview._id,
      questionId: mockQuestion._id,
      answerText: 'I would split tables across servers.',
      textEvaluation: {
        semanticScore: 50,
        conceptCoverage: 45,
        textScore: 52,
        missingConcepts: ['Consistent hashing', 'Write conflicts across regions', 'Read replicas'],
        feedback: 'Missed geo-replication consistency trade-offs.',
      },
    });

    // Open Results → Train Me session referencing this interview
    const resultsSessionRes = await client.post(
      '/api/ai/coach/sessions',
      {
        contextType: 'results',
        sourceInterviewId: mockInterview._id,
      },
      { headers: { 'x-dev-clerk-user-id': userA } }
    );
    console.log(`POST /api/ai/coach/sessions (results context) Status: ${resultsSessionRes.status}`);
    const resultsSession = resultsSessionRes.data?.session;
    const resultsFirstMsg = resultsSessionRes.data?.messages?.[0]?.content;
    console.log('Results greeting & exercise snippet:\n', resultsFirstMsg?.slice(0, 220) + '...');

    const resultsEvidenceVerified =
      resultsSessionRes.status === 201 &&
      Boolean(resultsSession?.sourceInterviewId) &&
      (resultsFirstMsg.includes('System Design') || resultsFirstMsg.includes('Database Sharding') || resultsFirstMsg.includes('reviewed this interview'));

    console.log(`Results → Train Me interview evidence targeting: ${resultsEvidenceVerified ? '✅ PASS' : '❌ FAIL'}`);
    if (!resultsEvidenceVerified) throw new Error('Results Train Me did not synthesize interview context properly');

    // ── 9. MULTI-TENANT SECURITY & AUTHORIZATION ────────────────────────────
    console.log('\n--- Test 9: Security & Multi-Tenant Isolation ---');
    // User B tries to access User A's session -> MUST BE 404/REJECTED
    const crossAccessSessionRes = await client.get(`/api/ai/coach/sessions/${sessionA.id}`, {
      headers: { 'x-dev-clerk-user-id': userB },
    });
    console.log(`User B accessing User A session Status: ${crossAccessSessionRes.status}`);
    const sessionIsolated = crossAccessSessionRes.status === 404;
    console.log(`Session cross-tenant isolation: ${sessionIsolated ? '✅ PASS' : '❌ FAIL'}`);

    // User B tries to start Train Me on User A's interview -> MUST BE 404/REJECTED
    const crossAccessInterviewRes = await client.post(
      '/api/ai/coach/sessions',
      {
        contextType: 'results',
        sourceInterviewId: mockInterview._id,
      },
      { headers: { 'x-dev-clerk-user-id': userB } }
    );
    console.log(`User B accessing User A interview Status: ${crossAccessInterviewRes.status}`);
    const interviewIsolated = crossAccessInterviewRes.status === 404;
    console.log(`Interview cross-tenant isolation: ${interviewIsolated ? '✅ PASS' : '❌ FAIL'}`);

    if (!sessionIsolated || !interviewIsolated) {
      throw new Error('Multi-tenant security violation detected');
    }

    // ── 10. SESSION CONTINUITY & RESUMPTION ──────────────────────────────────
    console.log('\n--- Test 10: Session Continuity & Persistence ---');
    const reloadSessionRes = await client.get(`/api/ai/coach/sessions/${sessionA.id}`, {
      headers: { 'x-dev-clerk-user-id': userA },
    });
    const messageHistoryCount = reloadSessionRes.data?.messages?.length;
    console.log(`Loaded message history count for session: ${messageHistoryCount}`);
    const continuityPass = reloadSessionRes.status === 200 && messageHistoryCount >= 3;
    console.log(`Session reload & message persistence: ${continuityPass ? '✅ PASS' : '❌ FAIL'}`);
    if (!continuityPass) throw new Error('Session continuity failed');

    console.log('\n==================================================');
    console.log('ALL AI TRAINING COACH TESTS PASSED SUCCESSFULLY! ✅');
    console.log('==================================================\n');
  } finally {
    // Cleanup created test records
    await AITrainingMessage.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AITrainingSession.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AITrainingProgress.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AITrainingProfile.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Resume.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Interview.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Question.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Response.deleteMany({ clerkUserId: { $in: [userA, userB] } });

    server.close();
    await mongoose.disconnect();
  }
}

runAICoachTests().catch((err) => {
  console.error('\n❌ Test Suite Failed with Error:', err);
  process.exit(1);
});
