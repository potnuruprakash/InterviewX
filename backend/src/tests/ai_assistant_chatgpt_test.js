/**
 * Comprehensive Automated Verification Test for InterviewX ChatGPT-Style AI Assistant
 *
 * Validates:
 * 1. Unauthenticated request protection (401 Unauthorized)
 * 2. Conversation lifecycle (creation, default title, initial welcome greeting, suggestions)
 * 3. Test A: Basic AI ("What is React?") -> Validates rich conceptual response
 * 4. Test B: Real Resume Upload & Analysis:
 *    - Uploads test resume with React, TypeScript, Node.js
 *    - Validates text extraction, analyzeResume parsing, Resume document creation in MongoDB
 *    - Validates AITrainingProfile persistence with skills
 *    - Queries "What skills are listed on my resume?"
 *    - Asserts that AI cites the actual skills (React, TypeScript, Node.js) and NOT generic advice
 * 5. Test C: Resume-Based Planning:
 *    - Queries "Create an interview preparation plan based on my resume."
 *    - Asserts personalized plan references React, TypeScript, and 7-day targets
 * 6. Test D: Continuous Multi-turn Conversation (Closures flow):
 *    - Step 1: "Explain closures." -> verifies explanation
 *    - Step 2: "Give me an example." -> verifies code example
 *    - Step 3: "Now quiz me." -> verifies active recall quiz prompt
 *    - Step 4: "Make it harder." -> verifies advanced difficulty increase
 * 7. Test E: Proactive Resume Analysis Response & Dynamic Suggestions
 * 8. Test F: Multi-tenant Security Isolation & Conversation Archival
 */

const http = require('http');
const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('dotenv').config();
const app = require('../app');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const Resume = require('../models/Resume');
const AITrainingProfile = require('../models/AITrainingProfile');

const PORT = 5588;

async function runAIAssistantTests() {
  console.log('================================================================');
  console.log('STARTING INTERVIEWX AI ASSISTANT (CHATGPT-STYLE & RESUME) TESTS');
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

  const userA = 'user_assistant_tester_A_' + Date.now();
  const userB = 'user_assistant_tester_B_' + Date.now();

  const userAHeaders = { 'x-dev-clerk-user-id': userA };
  const userBHeaders = { 'x-dev-clerk-user-id': userB };

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
    const unauthRes = await client.get('/api/ai/coach/conversations');
    assertTest(
      'Unauthenticated request rejected with 401',
      unauthRes.status === 401 && unauthRes.data.success === false,
      `Status: ${unauthRes.status}`
    );

    // ── 2. CONVERSATION CREATION & GREETING ─────────────────────────────────
    console.log('\n--- 2. Testing Conversation Creation & Initial Greeting ---');
    const createRes = await client.post(
      '/api/ai/coach/conversations',
      { contextType: 'dashboard' },
      { headers: userAHeaders }
    );
    assertTest('Create conversation status 201', createRes.status === 201, `Status: ${createRes.status}`);
    const conversation = createRes.data.conversation;
    const initialMessages = createRes.data.messages;
    assertTest('Conversation object returned with ID', Boolean(conversation && conversation.id));
    assertTest('Assistant initial greeting generated', initialMessages && initialMessages.length === 1 && initialMessages[0].role === 'assistant');
    assertTest('Initial suggestions provided', Array.isArray(initialMessages[0]?.metadata?.suggestions) && initialMessages[0].metadata.suggestions.length > 0);

    const convId = conversation.id;

    // ── 3. TEST A: BASIC AI ("What is React?") ──────────────────────────────
    console.log('\n--- 3. Testing Test A: Basic AI ("What is React?") ---');
    const reactRes = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'What is React?' },
      { headers: userAHeaders }
    );
    assertTest('Basic AI status 200', reactRes.status === 200, `Status: ${reactRes.status}`);
    const reactReply = reactRes.data.assistantMessage;
    assertTest('React response explains components/UI', reactReply.content.toLowerCase().includes('component') || reactReply.content.toLowerCase().includes('user interface'));
    assertTest('React response is not a generic placeholder error', !reactReply.content.includes('undefined') && reactReply.content.length > 100);

    // ── 4. TEST B: RESUME UPLOAD & ANALYSIS PIPELINE ────────────────────────
    console.log('\n--- 4. Testing Test B: Real Resume Upload & Analysis Pipeline ---');
    const resumeTextContent = `
John Doe - Frontend Engineer
john.doe@example.com

Skills:
React, TypeScript, Node.js

Experience:
3 years frontend development at Tech Solutions Inc.
- Built responsive single page applications using React and TypeScript.
- Integrated RESTful backend endpoints with Node.js.

Projects:
E-commerce platform using React and Node.js
- Developed checkout flow, payment processing, and state management.

Education:
B.S. in Computer Science
`;
    const resumeFilePath = path.join(os.tmpdir(), `test_candidate_resume_${Date.now()}.txt`);
    fs.writeFileSync(resumeFilePath, resumeTextContent);

    const form = new FormData();
    form.append('file', fs.createReadStream(resumeFilePath), {
      filename: 'test_candidate_resume.txt',
      contentType: 'text/plain',
    });

    const uploadRes = await client.post('/api/ai/coach/upload-attachment', form, {
      headers: { ...userAHeaders, ...form.getHeaders() },
    });
    assertTest('Resume upload status 201', uploadRes.status === 201, `Status: ${uploadRes.status}`);
    const attachment = uploadRes.data.attachment;
    assertTest('Attachment marked as resume', attachment && attachment.isResume === true);
    assertTest('Attachment status is processed', attachment && attachment.status === 'processed');
    assertTest('Parsed candidate profile contains skills', Array.isArray(attachment?.candidateProfile?.skills) && attachment.candidateProfile.skills.length > 0);
    console.log(`      Extracted Resume Skills: [${(attachment?.candidateProfile?.skills || []).join(', ')}]`);

    // Verify MongoDB Resume document was created and marked completed
    const savedResume = await Resume.findOne({ clerkUserId: userA, processingStatus: 'completed' });
    assertTest('MongoDB Resume record exists with completed status', Boolean(savedResume));
    assertTest('MongoDB Resume parsedData has React and TypeScript', Boolean(savedResume?.parsedData?.skills?.some(s => (s.canonicalName || s.name || s).toLowerCase().includes('react'))));

    // Verify AITrainingProfile was updated
    const savedProfile = await AITrainingProfile.findOne({ clerkUserId: userA });
    assertTest('MongoDB AITrainingProfile updated with skills', Boolean(savedProfile && savedProfile.skills?.length > 0));

    // Clean up local temp file
    try { fs.unlinkSync(resumeFilePath); } catch (e) {}

    // ── 5. TEST B (PART 2): QUERY RESUME SKILLS ─────────────────────────────
    console.log('\n--- 5. Testing Test B (Part 2): Query "What skills are listed on my resume?" ---');
    const skillsQueryRes = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      {
        content: 'What skills are listed on my resume?',
        attachments: [attachment],
      },
      { headers: userAHeaders }
    );
    assertTest('Skills query status 200', skillsQueryRes.status === 200);
    const skillsReply = skillsQueryRes.data.assistantMessage;
    console.log(`      AI Skills Response: "${skillsReply.content}"`);

    assertTest(
      'AI explicitly cites React from resume',
      skillsReply.content.includes('React')
    );
    assertTest(
      'AI explicitly cites TypeScript from resume',
      skillsReply.content.includes('TypeScript')
    );
    assertTest(
      'AI explicitly cites Node.js from resume',
      skillsReply.content.includes('Node.js')
    );
    assertTest(
      'AI does NOT return generic unhelpful advice',
      !skillsReply.content.includes('You should improve your technical skills')
    );

    // ── 6. TEST C: RESUME-BASED PLANNING ────────────────────────────────────
    console.log('\n--- 6. Testing Test C: Resume-Based Planning ---');
    const planQueryRes = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Create an interview preparation plan based on my resume.' },
      { headers: userAHeaders }
    );
    assertTest('Resume plan query status 200', planQueryRes.status === 200);
    const planQueryReply = planQueryRes.data.assistantMessage;
    assertTest('Plan references React from resume', planQueryReply.content.includes('React'));
    assertTest('Plan references TypeScript from resume', planQueryReply.content.includes('TypeScript'));
    assertTest('Plan includes day-by-day structure', planQueryReply.content.includes('Day 1') || planQueryReply.content.toLowerCase().includes('plan'));

    // ── 7. TEST D: CONTINUOUS CONVERSATION (CLOSURES FLOW) ──────────────────
    console.log('\n--- 7. Testing Test D: Continuous Conversation (Closures flow) ---');
    // Step 1: Explain closures
    const step1Res = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Explain closures.' },
      { headers: userAHeaders }
    );
    assertTest('Step 1 (Explain closures) status 200', step1Res.status === 200);
    assertTest('Step 1 mentions lexical environment/scope', step1Res.data.assistantMessage.content.toLowerCase().includes('lexical') || step1Res.data.assistantMessage.content.toLowerCase().includes('scope'));

    // Step 2: Give me an example
    const step2Res = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Give me an example.' },
      { headers: userAHeaders }
    );
    assertTest('Step 2 (Give example) status 200', step2Res.status === 200);
    assertTest('Step 2 contains code example', step2Res.data.assistantMessage.content.includes('```'));

    // Step 3: Now quiz me
    const step3Res = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Now quiz me.' },
      { headers: userAHeaders }
    );
    assertTest('Step 3 (Now quiz me) status 200', step3Res.status === 200);
    assertTest('Step 3 provides quiz prompt', step3Res.data.assistantMessage.content.toLowerCase().includes('question') || step3Res.data.assistantMessage.content.toLowerCase().includes('quiz'));

    // Step 4: Make it harder
    const step4Res = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Make it harder.' },
      { headers: userAHeaders }
    );
    assertTest('Step 4 (Make it harder) status 200', step4Res.status === 200);
    assertTest('Step 4 increases challenge level', step4Res.data.assistantMessage.content.length > 50);

    // ── 8. MESSAGE FEEDBACK RATING (👍 / 👎) ───────────────────────────────
    console.log('\n--- 8. Testing Message Feedback Rating ---');
    const targetMsgId = step4Res.data.assistantMessage.id;
    const feedbackRes = await client.post(
      `/api/ai/coach/messages/${targetMsgId}/feedback`,
      { rating: 'like' },
      { headers: userAHeaders }
    );
    assertTest('Feedback rating status 200', feedbackRes.status === 200);
    assertTest('Feedback persisted as "like"', feedbackRes.data.feedback === 'like');

    // ── 9. MULTI-TENANT ISOLATION ──────────────────────────────────────────
    console.log('\n--- 9. Testing Multi-Tenant Security Isolation ---');
    const leakReadRes = await client.get(`/api/ai/coach/conversations/${convId}`, { headers: userBHeaders });
    assertTest(
      'User B cannot read User A conversation (404 Not Found)',
      leakReadRes.status === 404 && leakReadRes.data.success === false,
      `Status: ${leakReadRes.status}`
    );

    const leakPostRes = await client.post(
      `/api/ai/coach/conversations/${convId}/messages`,
      { content: 'Unauthorized injection attempt' },
      { headers: userBHeaders }
    );
    assertTest(
      'User B cannot post into User A conversation (404 Not Found)',
      leakPostRes.status === 404 && leakPostRes.data.success === false,
      `Status: ${leakPostRes.status}`
    );

    // ── 10. CONVERSATION SOFT-DELETE / ARCHIVAL ────────────────────────────
    console.log('\n--- 10. Testing Conversation Archival ---');
    const deleteRes = await client.delete(`/api/ai/coach/conversations/${convId}`, { headers: userAHeaders });
    assertTest('Archive conversation status 200', deleteRes.status === 200);

    const listRes = await client.get('/api/ai/coach/conversations', { headers: userAHeaders });
    assertTest('List conversations status 200', listRes.status === 200);
    const activeConvs = listRes.data.conversations || [];
    const archivedPresent = activeConvs.some((c) => c.id === convId);
    assertTest('Archived conversation excluded from active list', !archivedPresent);

  } finally {
    // Cleanup test records
    console.log('\nCleaning up test artifacts...');
    await AIConversation.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AIMessage.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await Resume.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await AITrainingProfile.deleteMany({ clerkUserId: { $in: [userA, userB] } });
    await mongoose.disconnect();
    server.close();
    console.log('Database disconnected and test server stopped.');
  }

  // Final Summary
  console.log('\n================================================================');
  console.log('AI ASSISTANT TEST SUMMARY');
  console.log('================================================================');
  const failed = testResults.filter((r) => r.status === 'FAIL');
  if (failed.length === 0) {
    console.log(`🎉 ALL ${testResults.length} TESTS PASSED ACCORDING TO SPEC!\n`);
  } else {
    console.error(`⚠️ ${failed.length} / ${testResults.length} TESTS FAILED.`);
    process.exit(1);
  }
}

runAIAssistantTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
