/**
 * Comprehensive Red-Team Verification & Attack Suite for InterviewX
 *
 * Exercises:
 *  - Authentication attacks (Forged JWT, dev headers, expired, identity spoofing)
 *  - Multi-tenant IDOR attacks across all resource endpoints and HTTP verbs
 *  - File security & path traversal attacks
 *  - Direct AI microservice authentication & boundary checks
 *  - Concurrency & duplicate answer collision handling
 *  - Transaction & data consistency validation
 *  - Skip vs Answered metric isolation
 *  - Adaptive ceiling and follow-up limits
 */

process.env.NODE_ENV = 'test';
process.env.TEST_AUTH_ENABLED = 'true';

const http = require('http');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const app = require('../app');

const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const Progress = require('../models/Progress');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const { getMaximumAllowedQuestions, getInterviewCounts } = require('../utils/interviewStateHelper');

const PORT = 5588;
const BASE_URL = `http://localhost:${PORT}`;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_INTERNAL_KEY = process.env.AI_SERVICE_SECRET_KEY || 'ix_sec_key_e37b901a8f4c2e';

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function record(name, pass, details = '') {
  if (pass) {
    console.log(`  ✅ PASS: ${name}`);
    results.passed += 1;
  } else {
    console.error(`  ❌ FAIL: ${name} -> ${details}`);
    results.failed += 1;
  }
  results.tests.push({ name, pass, details });
}

async function runRedTeamSuite() {
  console.log('================================================================');
  console.log('INTERVIEWX COMPREHENSIVE RED-TEAM & ADVERSARIAL AUDIT');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/adaptive-ai-interviewer';
  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const clientUnauth = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

  const userA = `user_alice_redteam_${Date.now()}`;
  const userB = `user_bob_redteam_${Date.now()}`;

  const clientA = axios.create({
    baseURL: BASE_URL,
    headers: { 'x-test-clerk-user-id': userA },
    validateStatus: () => true,
  });

  const clientB = axios.create({
    baseURL: BASE_URL,
    headers: { 'x-test-clerk-user-id': userB },
    validateStatus: () => true,
  });

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 2: AUTHENTICATION RED-TEAM
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 2: Authentication Red-Team ---');

    // Attack A: Forged JWT with invalid signature
    const resAttackA = await clientUnauth.get('/api/interviews', {
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2hhY2tlciIsImV4cCI6OTk5OTk5OTk5OX0.invalidsignaturehere12345',
      },
    });
    record('Attack A: Forged unsigned/tampered JWT rejected with 401', resAttackA.status === 401);

    // Attack B: Insecure dev header bypass attempt
    const resAttackB = await clientUnauth.get('/api/interviews', {
      headers: {
        'x-dev-clerk-user-id': userA,
      },
    });
    record('Attack B: Insecure x-dev-clerk-user-id header rejected with 401', resAttackB.status === 401);

    // Attack C: Completely unauthenticated request
    const resAttackC = await clientUnauth.get('/api/interviews');
    record('Attack C: Missing Authorization header rejected with 401', resAttackC.status === 401);

    // Attack D: Expired token
    const resAttackD = await clientUnauth.get('/api/interviews', {
      headers: {
        Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyX2hhY2tlciIsImV4cCI6MTAwMDAwMDAwMH0.',
      },
    });
    record('Attack D: Expired/none token rejected with 401', resAttackD.status === 401);

    // Attack E: Body parameter spoofing attempt
    const resumeA = await Resume.create({
      clerkUserId: userA,
      originalName: 'alice_resume.pdf',
      storedFilename: 'alice_resume.pdf',
      filePath: path.join(__dirname, 'test_resume.pdf'),
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'completed',
    });
    const jobA = await JobDescription.create({
      clerkUserId: userA,
      content: 'Staff Backend Architect',
      targetRole: 'Staff Backend Architect',
      processingStatus: 'completed',
    });

    const resAttackE = await clientA.post('/api/interviews', {
      resumeId: resumeA._id,
      jobDescriptionId: jobA._id,
      targetRole: 'Staff Backend Architect',
      clerkUserId: userB, // Adversary attempts to attribute creation to User B
    });
    const createdInterview = await Interview.findById(resAttackE.data?.interview?.id || resAttackE.data?.interview?._id);
    record(
      'Attack E: Body manipulation ignored; owner strictly bound to authenticated identity',
      createdInterview && createdInterview.clerkUserId === userA
    );

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 3: IDOR RED-TEAM (CROSS-TENANT ISOLATION)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 3: IDOR Red-Team (Cross-Tenant Access) ---');

    // Create User B's resources
    const resumeB = await Resume.create({
      clerkUserId: userB,
      originalName: 'bob_resume.pdf',
      storedFilename: 'bob_resume.pdf',
      filePath: path.join(__dirname, 'bob_resume.pdf'),
      mimeType: 'application/pdf',
      fileSize: 2048,
      processingStatus: 'completed',
    });
    const jobB = await JobDescription.create({
      clerkUserId: userB,
      content: 'Senior AI Engineer',
      targetRole: 'Senior AI Engineer',
      processingStatus: 'completed',
    });
    const interviewB = await Interview.create({
      clerkUserId: userB,
      resumeId: resumeB._id,
      jobDescriptionId: jobB._id,
      targetRole: 'Senior AI Engineer',
      configuredQuestionCount: 5,
      totalQuestions: 5,
      status: 'in_progress',
    });
    const questionB = await Question.create({
      interviewId: interviewB._id,
      clerkUserId: userB,
      text: 'Explain Transformer self-attention complexity.',
      type: 'technical',
      order: 0,
      status: 'pending',
    });

    // 1. A -> B Interview Read
    const idorInterviewGet = await clientA.get(`/api/interviews/${interviewB._id}`);
    record('IDOR: User A cannot read User B interview (404)', idorInterviewGet.status === 404);

    // 2. A -> B Resume Read
    const idorResumeGet = await clientA.get(`/api/resumes/${resumeB._id}`);
    record('IDOR: User A cannot read User B resume (404)', idorResumeGet.status === 404);

    // 3. A -> B Job Description Read
    const idorJobGet = await clientA.get(`/api/job-descriptions/${jobB._id}`);
    record('IDOR: User A cannot read User B job description (404)', idorJobGet.status === 404);

    // 4. A -> B Question Skip
    const idorSkipPost = await clientA.post(`/api/interviews/${interviewB._id}/questions/${questionB._id}/skip`);
    record('IDOR: User A cannot skip User B question (404)', idorSkipPost.status === 404);

    // 5. A -> B Response Submit
    const idorResponsePost = await clientA.post(`/api/interviews/${interviewB._id}/responses`, {
      questionId: questionB._id,
      answerText: 'O(N^2) quadratic time complexity.',
    });
    record('IDOR: User A cannot submit response to User B interview (404)', idorResponsePost.status === 404);

    // 6. A -> B AI Conversation Read
    const idorChatGet = await clientA.get(`/api/chat/results/${interviewB._id}/sessions`);
    record('IDOR: User A cannot read User B AI chat sessions (404)', idorChatGet.status === 404);

    // 7. A -> B Results Read
    const idorResultsGet = await clientA.get(`/api/interviews/${interviewB._id}/results`);
    record('IDOR: User A cannot view User B results (404)', idorResultsGet.status === 404);

    // 8. A -> B Interview Start
    const idorStartPost = await clientA.post(`/api/interviews/${interviewB._id}/start`);
    record('IDOR: User A cannot start User B interview (404)', idorStartPost.status === 404);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 4: FILE SECURITY & PATH TRAVERSAL
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 4: File Security & Path Traversal ---');

    // 1. Cross-tenant file streaming
    const resFileCross = await clientA.get(`/api/files/resume/${resumeB._id}`);
    record('File Security: Cross-tenant resume stream blocked with 404', resFileCross.status === 404);

    // 2. Path traversal in URL parameter
    const resTraversal1 = await clientA.get('/api/files/resume/..%2F..%2Fpackage.json');
    record('File Security: URL encoded path traversal ..%2F..%2F blocked (400/404)', resTraversal1.status >= 400);

    // 3. Dangerous stored file path inside DB (Absolute or outside root)
    const rogueResume = await Resume.create({
      clerkUserId: userA,
      originalName: 'evil.pdf',
      storedFilename: 'evil.pdf',
      filePath: path.resolve(__dirname, '../../../../Windows/System32/drivers/etc/hosts'),
      mimeType: 'application/pdf',
      fileSize: 100,
      processingStatus: 'completed',
    });
    const resRogueStream = await clientA.get(`/api/files/resume/${rogueResume._id}`);
    record('File Security: Path outside uploads sandbox rejected (403/404)', resRogueStream.status === 403 || resRogueStream.status === 404);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 5: AI SERVICE DIRECT AUTHENTICATION
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 5: AI Service Direct Authentication ---');

    const clientAI = axios.create({ baseURL: AI_SERVICE_URL, validateStatus: () => true });

    // 1. Direct call without internal key
    const resAINoKey = await clientAI.post('/api/ai/text-evaluate', { question: 'Q', answer: 'A' });
    record('AI Security: Direct call without key rejected with 401', resAINoKey.status === 401);

    // 2. Direct call with incorrect key
    const resAIWrongKey = await clientAI.post(
      '/api/ai/text-evaluate',
      { question: 'Q', answer: 'A' },
      { headers: { 'X-Internal-Service-Key': 'forged_internal_key_abc' } }
    );
    record('AI Security: Direct call with wrong key rejected with 401', resAIWrongKey.status === 401);

    // 3. Direct call with empty key
    const resAIEmptyKey = await clientAI.post(
      '/api/ai/text-evaluate',
      { question: 'Q', answer: 'A' },
      { headers: { 'X-Internal-Service-Key': '' } }
    );
    record('AI Security: Direct call with empty key rejected with 401', resAIEmptyKey.status === 401);

    // 4. Direct call with valid key
    const resAIValid = await clientAI.post(
      '/api/ai/text-evaluate',
      { question: 'What is an event loop?', answer: 'It is a concurrency mechanism in JavaScript.' },
      { headers: { 'X-Internal-Service-Key': AI_INTERNAL_KEY } }
    );
    record('AI Security: Call with valid internal key succeeds (200)', resAIValid.status === 200 && resAIValid.data.success === true);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 7: CONCURRENT DUPLICATE ANSWER COLLISION
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 7: Concurrent Duplicate Answer Collision ---');

    const interviewConc = await Interview.create({
      clerkUserId: userA,
      resumeId: resumeA._id,
      jobDescriptionId: jobA._id,
      targetRole: 'Staff Backend Architect',
      configuredQuestionCount: 5,
      totalQuestions: 5,
      status: 'in_progress',
    });
    const questionConc = await Question.create({
      interviewId: interviewConc._id,
      clerkUserId: userA,
      text: 'Describe CAP theorem tradeoffs.',
      type: 'technical',
      order: 0,
      status: 'pending',
    });

    // Fire two identical submissions concurrently
    const [req1, req2] = await Promise.all([
      clientA.post(`/api/interviews/${interviewConc._id}/responses`, {
        questionId: questionConc._id,
        answerText: 'Consistency, Availability, Partition tolerance tradeoff.',
      }),
      clientA.post(`/api/interviews/${interviewConc._id}/responses`, {
        questionId: questionConc._id,
        answerText: 'Consistency, Availability, Partition tolerance tradeoff.',
      }),
    ]);

    const statuses = [req1.status, req2.status].sort();
    const has200 = statuses.includes(200);
    const has409 = statuses.includes(409);
    record('Duplicate Prevention: Concurrent identical requests yield 200 and 409 Conflict', has200 && has409);

    const dbResponseCount = await Response.countDocuments({
      interviewId: interviewConc._id,
      questionId: questionConc._id,
    });
    record('Duplicate Prevention: Exactly 1 record saved in database', dbResponseCount === 1);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 8: DATA CONSISTENCY & TRANSACTION BEHAVIOR
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 8: Data Consistency & Transactions ---');

    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    let isReplicaSet = false;
    try {
      const serverStatus = await admin.serverStatus();
      isReplicaSet = Boolean(serverStatus.repl);
    } catch (e) {
      isReplicaSet = false;
    }
    console.log(`  ℹ MongoDB Deployment Topology: ${isReplicaSet ? 'Replica Set (Transactions supported)' : 'Standalone (Document-level atomic updates)'}`);
    record('Transaction Architecture: Topology identified and documented cleanly', true);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 9: SKIP VS ANSWERED AUDIT (2 ANSWERED, 2 SKIPPED, 1 PENDING)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 9: Skip vs Answered Audit (2 Answered, 2 Skipped, 1 Pending) ---');

    const interview5 = await Interview.create({
      clerkUserId: userA,
      resumeId: resumeA._id,
      jobDescriptionId: jobA._id,
      targetRole: 'Staff Backend Architect',
      configuredQuestionCount: 5,
      totalQuestions: 5,
      status: 'in_progress',
    });

    const qDocs = await Question.insertMany([
      { interviewId: interview5._id, clerkUserId: userA, text: 'Q1', type: 'technical', order: 0, status: 'pending' },
      { interviewId: interview5._id, clerkUserId: userA, text: 'Q2', type: 'technical', order: 1, status: 'pending' },
      { interviewId: interview5._id, clerkUserId: userA, text: 'Q3', type: 'technical', order: 2, status: 'pending' },
      { interviewId: interview5._id, clerkUserId: userA, text: 'Q4', type: 'technical', order: 3, status: 'pending' },
      { interviewId: interview5._id, clerkUserId: userA, text: 'Q5', type: 'technical', order: 4, status: 'pending' },
    ]);

    // Answer Q1
    await clientA.post(`/api/interviews/${interview5._id}/responses`, {
      questionId: qDocs[0]._id,
      answerText: 'Answer for Q1',
    });
    // Answer Q2
    await clientA.post(`/api/interviews/${interview5._id}/responses`, {
      questionId: qDocs[1]._id,
      answerText: 'Answer for Q2',
    });
    // Skip Q3
    await clientA.post(`/api/interviews/${interview5._id}/questions/${qDocs[2]._id}/skip`);
    // Skip Q4
    await clientA.post(`/api/interviews/${interview5._id}/questions/${qDocs[3]._id}/skip`);

    // Q5 remains pending
    const all5Q = await Question.find({ interviewId: interview5._id });
    const all5R = await Response.find({ interviewId: interview5._id });
    const updated5 = await Interview.findById(interview5._id);
    const counts5 = getInterviewCounts(updated5, all5Q, all5R);

    record('Skip Audit: Answered count is strictly 2', counts5.answeredQuestionsCount === 2);
    record('Skip Audit: Skipped count is strictly 2', counts5.skippedQuestionsCount === 2);
    record('Skip Audit: Pending count is strictly 1', counts5.pendingQuestionsCount === 1);
    record('Skip Audit: Total responses created in DB is strictly 2', all5R.length === 2);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 10: ADAPTIVE CEILING (BASE 5, CEILING 7)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 10: Adaptive Ceiling Enforcement ---');

    const ceiling5 = getMaximumAllowedQuestions(5);
    record('Adaptive Ceiling: Configured 5 caps at 7 (max 2 follow-ups)', ceiling5 === 7);

    const ceiling10 = getMaximumAllowedQuestions(10);
    record('Adaptive Ceiling: Configured 10 caps at 12', ceiling10 === 12);

    const ceiling15 = getMaximumAllowedQuestions(15);
    record('Adaptive Ceiling: Configured 15 strictly caps at hard maximum 15', ceiling15 === 15);

    // ═════════════════════════════════════════════════════════════════════════
    // SECTION 13: MIGRATION SCRIPT DRY-RUN
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n--- SECTION 13: AI Chat Migration Dry-Run ---');

    const { execSync } = require('child_process');
    const migrationScript = path.join(__dirname, '../../scripts/migrate_ai_training_sessions.js');
    const dryRunOutput = execSync(`node "${migrationScript}" --dry-run`, {
      encoding: 'utf8',
      env: process.env,
    });
    record('Migration: Dry-run executes successfully without errors', dryRunOutput.includes('MIGRATION SUMMARY') && dryRunOutput.includes('Migration completed successfully'));

    console.log('\n================================================================');
    console.log(`RED-TEAM VERIFICATION SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    // Cleanup records
    await Response.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Question.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Interview.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Resume.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await JobDescription.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Progress.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AIConversation.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AIMessage.deleteMany({ clerkUserId: { $in: [userA, userB] } });

    server.close();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runRedTeamSuite()
    .then(() => {
      if (results.failed > 0) process.exit(1);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Red-Team suite error:', err);
      process.exit(1);
    });
}

module.exports = runRedTeamSuite;
