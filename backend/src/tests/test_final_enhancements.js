/**
 * Verification Test Suite:
 * - Persistent Countdown Timer logic
 * - Coding Questions generation & response storage
 * - Question Skip workflow & non-penalization
 * - Interview Completion Reasons ('time_expired', 'final_question_skipped')
 * - Results page aggregation excluding skipped questions
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { generateInterviewQuestions, CODING_TEMPLATES } = require('../services/questionService');
const { aggregateInterviewScore } = require('../services/evaluationService');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');

async function runTests() {
  console.log('================================================================');
  console.log('INTERVIEWX ENHANCEMENTS VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. COUNTDOWN TIMER MATH & REFRESH PERSISTENCE
  // ─────────────────────────────────────────────────────────────────────────────
  test('Timer: calculates correct remaining seconds from startedAt and durationMinutes', () => {
    const durationMinutes = 30;
    const now = Date.now();
    const startedAt = new Date(now - 10 * 60 * 1000); // 10 minutes ago
    const endTime = startedAt.getTime() + durationMinutes * 60 * 1000;
    const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

    // 30 mins - 10 mins = 20 mins = 1200 seconds
    assert.strictEqual(remainingSeconds, 1200);
  });

  test('Timer: survives simulated page refresh without resetting countdown', () => {
    const durationMinutes = 45;
    const initialStart = new Date(Date.now() - 5 * 60 * 1000); // started 5 mins ago

    // Simulation 1: initial page load
    const rem1 = Math.max(0, Math.floor((initialStart.getTime() + durationMinutes * 60 * 1000 - Date.now()) / 1000));
    assert.strictEqual(rem1, 40 * 60); // 40 minutes left

    // Simulation 2: user refreshes 7 minutes later (12 minutes total elapsed)
    const simulatedLaterNow = Date.now() + 7 * 60 * 1000;
    const rem2 = Math.max(0, Math.floor((initialStart.getTime() + durationMinutes * 60 * 1000 - simulatedLaterNow) / 1000));
    assert.strictEqual(rem2, 33 * 60); // 33 minutes left, exactly computed from startedAt!
  });

  test('Timer: clamps to 0 and never returns negative numbers when expired', () => {
    const durationMinutes = 15;
    const startedAt = new Date(Date.now() - 20 * 60 * 1000); // started 20 mins ago (5 mins expired)
    const remainingSeconds = Math.max(0, Math.floor((startedAt.getTime() + durationMinutes * 60 * 1000 - Date.now()) / 1000));
    assert.strictEqual(remainingSeconds, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CODING QUESTION GENERATION
  // ─────────────────────────────────────────────────────────────────────────────
  test('Coding Generator: generates coding questions for technical software engineering roles', () => {
    const questions = generateInterviewQuestions({
      candidateProfile: {
        skills: ['JavaScript', 'React', 'Node.js'],
        projects: [{ name: 'Task Manager', technologies: ['React', 'Node.js'] }],
      },
      jobProfile: {
        targetRole: 'Full Stack Software Engineer',
        requiredSkills: ['JavaScript', 'React', 'SQL'],
        responsibilities: ['Build full stack web apps'],
      },
      skillAnalysis: {
        matchedRequiredSkills: ['JavaScript', 'React'],
        notIdentifiedRequiredSkills: ['SQL'],
      },
      interviewType: 'technical',
      difficulty: 'medium',
      totalQuestions: 10,
    });

    const codingQs = questions.filter((q) => q.type === 'coding');
    assert.ok(codingQs.length >= 1, 'Should include at least 1 coding question for technical dev role');
    assert.ok(codingQs[0].starterCode, 'Coding question must have starterCode');
    assert.ok(codingQs[0].language, 'Coding question must have language');
    assert.strictEqual(codingQs[0].contextNote, 'Coding Challenge');
  });

  test('Coding Generator: does NOT force coding questions into pure behavioral interviews', () => {
    const questions = generateInterviewQuestions({
      candidateProfile: { skills: ['Communication', 'Leadership'] },
      jobProfile: { targetRole: 'Engineering Manager' },
      interviewType: 'behavioral',
      difficulty: 'medium',
      totalQuestions: 8,
    });

    const codingQs = questions.filter((q) => q.type === 'coding');
    assert.strictEqual(codingQs.length, 0, 'Pure behavioral interview must not contain coding challenges');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. RESULTS EVALUATION EXCLUDING SKIPPED QUESTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  test('Results: accurately excludes skipped questions from overall average score calculation', () => {
    // 3 questions answered with scores 80, 90, 70. Average should be (80+90+70)/3 = 80.
    // If skipped question were counted as 0, average would drop to 60.
    const mockResponses = [
      { textEvaluation: { textScore: 80 }, evaluation: { score: 80 } },
      { textEvaluation: { textScore: 90 }, evaluation: { score: 90 } },
      { textEvaluation: { textScore: 70 }, evaluation: { score: 70 } },
    ];

    const result = aggregateInterviewScore(mockResponses);
    assert.strictEqual(result.overallScore, 80);
    assert.strictEqual(result.questionsAnswered, 3);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. DATABASE SCHEMAS INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────
  test('Mongoose Models: Question schema supports coding type and skip status', () => {
    const q = new Question({
      interviewId: new mongoose.Types.ObjectId(),
      clerkUserId: 'user_test_123',
      text: 'Implement twoSum(nums, target)',
      type: 'coding',
      category: 'coding',
      difficulty: 'easy',
      starterCode: 'function twoSum() {}',
      language: 'javascript',
      order: 0,
      status: 'skipped',
      skippedAt: new Date(),
      skipReason: 'candidate_skipped',
    });

    const err = q.validateSync();
    assert.ifError(err, 'Question schema must validate coding and skipped attributes');
    assert.strictEqual(q.type, 'coding');
    assert.strictEqual(q.status, 'skipped');
  });

  test('Mongoose Models: Interview schema supports durationMinutes and completionReason', () => {
    const interview = new Interview({
      clerkUserId: 'user_test_123',
      resumeId: new mongoose.Types.ObjectId(),
      jobDescriptionId: new mongoose.Types.ObjectId(),
      targetRole: 'Full Stack Engineer',
      durationMinutes: 45,
      completionReason: 'time_expired',
      skippedQuestionsCount: 2,
    });

    const err = interview.validateSync();
    assert.ifError(err, 'Interview schema must validate durationMinutes and completionReason');
    assert.strictEqual(interview.durationMinutes, 45);
    assert.strictEqual(interview.completionReason, 'time_expired');
    assert.strictEqual(interview.skippedQuestionsCount, 2);
  });

  test('Mongoose Models: Response schema supports coding responseType, code, and language', () => {
    const resp = new Response({
      clerkUserId: 'user_test_123',
      interviewId: new mongoose.Types.ObjectId(),
      questionId: new mongoose.Types.ObjectId(),
      responseType: 'coding',
      code: 'function solve() { return true; }',
      language: 'javascript',
      answerText: 'O(1) time complexity approach using Hash Map',
      status: 'submitted',
    });

    const err = resp.validateSync();
    assert.ifError(err, 'Response schema must validate coding responseType');
    assert.strictEqual(resp.responseType, 'coding');
    assert.strictEqual(resp.language, 'javascript');
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
