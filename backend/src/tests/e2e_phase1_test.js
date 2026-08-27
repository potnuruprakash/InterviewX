const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = 'http://localhost:5000/api';

// Create a dummy PDF file outside of watched backend directories to prevent node --watch server restart
const tempDir = path.join(os.tmpdir(), 'adaptive_ai_tests');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const testPdfPath = path.join(tempDir, 'test_resume.pdf');
fs.writeFileSync(testPdfPath, '%PDF-1.4 Mock Resume content for candidate John Doe with Python, React, Node.js');

async function runPhase1E2ETest() {
  console.log('=== RUNNING PHASE 1 END-TO-END VERIFICATION TEST ===\n');
  const results = {};

  const userAHeaders = { 'x-dev-clerk-user-id': 'user_2Phase1UserA_Test123' };
  const userBHeaders = { 'x-dev-clerk-user-id': 'user_2Phase1UserB_Test456' };

  try {
    // 1. Check Unauthenticated access rejection
    console.log('1. Testing Unauthenticated Request Rejection...');
    try {
      await axios.get(`${API_BASE}/interviews`);
      results.unauthenticatedRejection = 'FAIL (Allowed request without auth)';
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('   ✓ Protected route correctly rejected unauthenticated request (401 Unauthorized)');
        results.unauthenticatedRejection = 'PASS';
      } else {
        results.unauthenticatedRejection = `FAIL (${err.message})`;
      }
    }

    // 2. Upload Resume (User A)
    console.log('\n2. Testing Resume Upload for User A...');
    const formData = new FormData();
    formData.append('resume', fs.createReadStream(testPdfPath));
    const resumeRes = await axios.post(`${API_BASE}/resumes/upload`, formData, {
      headers: { ...userAHeaders, ...formData.getHeaders() },
    });
    const resumeId = resumeRes.data.resume.id;
    console.log(`   ✓ Resume uploaded successfully. ID: ${resumeId}`);
    results.resumeUpload = 'PASS';

    // 3. Create Job Description (User A)
    console.log('\n3. Testing Job Description Creation for User A...');
    const jobRes = await axios.post(
      `${API_BASE}/jobs`,
      {
        targetRole: 'Full Stack Engineer',
        content: 'We are looking for a Full Stack Engineer proficient in React, Node.js, Python, and MongoDB.',
      },
      { headers: userAHeaders }
    );
    const jobId = jobRes.data.job.id;
    console.log(`   ✓ Job Description saved. ID: ${jobId}`);
    results.jobCreation = 'PASS';

    // 4. Create Interview Session (User A)
    console.log('\n4. Testing Interview Creation for User A...');
    const interviewRes = await axios.post(
      `${API_BASE}/interviews`,
      {
        resumeId,
        jobDescriptionId: jobId,
        interviewType: 'technical',
        difficulty: 'medium',
        totalQuestions: 3,
      },
      { headers: userAHeaders }
    );
    const interviewId = interviewRes.data.interview.id;
    console.log(`   ✓ Interview created. ID: ${interviewId}, Total Questions: ${interviewRes.data.interview.totalQuestions}`);
    results.interviewCreation = 'PASS';

    // 5. Start Interview & Display Question 1
    console.log('\n5. Testing Start Interview...');
    const startRes = await axios.post(`${API_BASE}/interviews/${interviewId}/start`, {}, { headers: userAHeaders });
    const q1 = startRes.data.currentQuestion;
    console.log(`   ✓ Interview started. Q1: "${q1.text.substring(0, 60)}..." [Category: ${q1.category}, Difficulty: ${q1.difficulty}]`);
    results.startInterview = 'PASS';
    results.questionDisplay = 'PASS';

    // 6. Submit Text Answer to Question 1 & Verify Development Evaluation
    console.log('\n6. Testing Answer Submission & Development Evaluation...');
    const answerText = 'Synchronous programming blocks execution until a task completes, whereas asynchronous programming allows other operations to continue while waiting for long-running I/O or network tasks using event loops or promises.';
    const subRes = await axios.post(
      `${API_BASE}/interviews/${interviewId}/responses`,
      {
        questionId: q1.id,
        answerText,
      },
      { headers: userAHeaders }
    );

    const evalRes = subRes.data.response.evaluation;
    console.log(`   ✓ Answer submitted and saved to MongoDB.`);
    console.log(`   ✓ Evaluation result: Score = ${evalRes.score}/100, Status = ${evalRes.status}, isDevelopmentEvaluation = ${evalRes.isDevelopmentEvaluation}`);
    if (evalRes.isDevelopmentEvaluation && evalRes.status === 'development_evaluation') {
      results.answerSubmission = 'PASS';
      results.devEvaluation = 'PASS';
    } else {
      results.devEvaluation = 'FAIL (Missing development placeholder flags)';
    }

    // Submit answers to remaining questions to complete the interview
    let nextQ = subRes.data.nextQuestion;
    while (nextQ) {
      const resp = await axios.post(
        `${API_BASE}/interviews/${interviewId}/responses`,
        {
          questionId: nextQ.id,
          answerText: 'This is a detailed response explaining the concepts with examples and best practices.',
        },
        { headers: userAHeaders }
      );
      nextQ = resp.data.nextQuestion;
    }

    // 7. Get Results & Progress
    console.log('\n7. Testing Results Retrieval & Progress Tracking...');
    const resultsRes = await axios.get(`${API_BASE}/interviews/${interviewId}/results`, { headers: userAHeaders });
    console.log(`   ✓ Final Results retrieved. Overall Score: ${resultsRes.data.results.overallScore}/100`);

    const progressRes = await axios.get(`${API_BASE}/progress`, { headers: userAHeaders });
    console.log(`   ✓ Progress retrieved. Total sessions: ${progressRes.data.summary.totalInterviews}, Latest score: ${progressRes.data.summary.latestScore}`);
    results.resultsAndProgress = 'PASS';

    // 8. User Data Isolation Test (User B trying to access User A's interview)
    console.log('\n8. Testing User Data Isolation (User B accessing User A\'s interview)...');
    try {
      await axios.get(`${API_BASE}/interviews/${interviewId}`, { headers: userBHeaders });
      results.userIsolation = 'FAIL (User B was able to access User A\'s interview)';
    } catch (err) {
      if (err.response && (err.response.status === 404 || err.response.status === 403)) {
        console.log('   ✓ User B correctly blocked from accessing User A\'s resource (404/403)');
        results.userIsolation = 'PASS';
      } else {
        results.userIsolation = `FAIL (${err.message})`;
      }
    }

    console.log('\n=== E2E TEST SUMMARY ===');
    console.table(results);
    return results;
  } catch (err) {
    console.error('\n❌ TEST ERROR:', err.response?.data || err.message);
    process.exit(1);
  }
}

runPhase1E2ETest();
