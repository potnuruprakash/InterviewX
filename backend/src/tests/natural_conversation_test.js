/**
 * Verification Test for Natural Conversational AI in InterviewX
 * Tests the 10 exact prompts required by the user:
 * 1. hi
 * 2. how are you?
 * 3. thanks
 * 4. what is Django?
 * 5. explain Django MVT
 * 6. explain it simply
 * 7. why MongoDB in InterviewX?
 * 8. what are trending technologies?
 * 9. fix my Django error
 * 10. start a mock interview
 *
 * Verifies:
 * - Each response is meaningfully different and tailored to the prompt.
 * - ZERO occurrences of forced template headers:
 *   "Technical Guidance & Concepts", "Technical Analysis", "Foundational Concept",
 *   "Core Principles", "Key Mechanics", "Interview Trade-offs", "Observability", "Resilience", "Encapsulation"
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const aiCoachService = require('../services/aiCoachService');

const FORBIDDEN_TEMPLATE_STRINGS = [
  'Technical Guidance & Concepts',
  'Technical Analysis',
  'Foundational Concept',
  'Core Principles',
  'Key Mechanics',
  'Critical Interview Trade-offs',
  'Interview Context & Trade-offs',
  'Observability:',
  'Resilience:',
  'Encapsulation:',
];

function assertNoForcedTemplates(content, prompt) {
  for (const forbidden of FORBIDDEN_TEMPLATE_STRINGS) {
    assert(
      !content.includes(forbidden),
      `Response for "${prompt}" should NOT contain forced template string "${forbidden}". Content snippet: ${content.slice(0, 100)}`
    );
  }
}

async function runNaturalConversationTests() {
  console.log('====================================================');
  console.log('Testing InterviewX Natural Conversational Assistant');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  const responses = {};

  // 1. "hi"
  await test('1. User: "hi" responds conversationally without technical templates', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'hi',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['hi'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'hi');
    assert(
      res.content.toLowerCase().includes('hi') || res.content.toLowerCase().includes('help') || res.content.toLowerCase().includes('hello'),
      'Should be a friendly greeting'
    );
    assert(res.content.length < 100, 'Greeting should be concise, not a multi-paragraph lecture');
    console.log(`     Response: "${res.content.trim()}"`);
  });

  // 2. "how are you?"
  await test('2. User: "how are you?" responds casually', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'how are you?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['how are you?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'how are you?');
    assert(
      res.content.toLowerCase().includes('well') || res.content.toLowerCase().includes('good') || res.content.toLowerCase().includes('doing'),
      'Should acknowledge feeling well'
    );
    assert(res.content.length < 350, 'Casual reply should be concise');
    console.log(`     Response: "${res.content.trim()}"`);
  });

  // 3. "thanks"
  await test('3. User: "thanks" responds with welcome', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'thanks',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['thanks'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'thanks');
    assert(
      res.content.toLowerCase().includes('welcome') || res.content.toLowerCase().includes('anytime'),
      'Should say welcome or anytime'
    );
    assert(res.content.length < 60, 'Thanks reply should be short');
    console.log(`     Response: "${res.content.trim()}"`);
  });

  // 4. "what is Django?"
  await test('4. User: "what is Django?" explains framework naturally', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'what is Django?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['what is Django?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'what is Django?');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('python') && lower.includes('framework'),
      'Should explain Django as a Python framework'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 5. "explain Django MVT"
  await test('5. User: "explain Django MVT" explains Model, View, Template with code', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'explain Django MVT',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['explain Django MVT'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'explain Django MVT');
    const lower = res.content.toLowerCase();
    assert(lower.includes('model'), 'Should explain Model');
    assert(lower.includes('view'), 'Should explain View');
    assert(lower.includes('template'), 'Should explain Template');
    assert(res.content.includes('```'), 'Should include code example');
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 6. "explain it simply"
  await test('6. User: "explain it simply" understands context from previous MVT explanation', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'explain it simply',
      history: [
        { role: 'user', content: 'explain Django MVT' },
        { role: 'assistant', content: responses['explain Django MVT'] || 'MVT stands for Model-View-Template...' },
      ],
      context: { candidateName: 'Prakash' },
    });
    responses['explain it simply'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'explain it simply');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('database') || lower.includes('webpage') || lower.includes('middleman') || lower.includes('model'),
      'Should provide a simple intuitive explanation of the previous MVT topic'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 7. "why MongoDB in InterviewX?"
  await test('7. User: "why MongoDB in InterviewX?" uses InterviewX project context', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'why MongoDB in InterviewX?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['why MongoDB in InterviewX?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'why MongoDB in InterviewX?');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('interviewx') || lower.includes('multimodal') || lower.includes('question') || lower.includes('schema'),
      'Should relate MongoDB specifically to InterviewX architecture'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 8. "what are trending technologies?"
  await test('8. User: "what are trending technologies?" lists modern tech stack naturally', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'what are trending technologies?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['what are trending technologies?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'what are trending technologies?');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('ai') || lower.includes('next.js') || lower.includes('rust') || lower.includes('cloud') || lower.includes('typescript'),
      'Should mention modern trending technologies'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 9. "fix my Django error"
  await test('9. User: "fix my Django error" asks for traceback and provides concrete debugging help', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'fix my Django error',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['fix my Django error'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'fix my Django error');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('traceback') || lower.includes('terminal') || lower.includes('error'),
      'Should ask for traceback or code'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 10. "How can I improve communication skills?"
  await test('10. User: "How can I improve communication skills?" gives practical guidance', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'How can I improve communication skills?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['How can I improve communication skills?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'How can I improve communication skills?');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('communication') && (lower.includes('star') || lower.includes('bluf') || lower.includes('pacing') || lower.includes('audience') || lower.includes('structure')),
      'Should give actionable communication advice (frameworks, pacing, audience calibration)'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 11. "What is the difference between Java and Python?"
  await test('11. User: "What is the difference between Java and Python?" provides clear comparison', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'What is the difference between Java and Python?',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['What is the difference between Java and Python?'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'What is the difference between Java and Python?');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('java') && lower.includes('python') && (lower.includes('statically') || lower.includes('dynamically') || lower.includes('jvm') || lower.includes('compiled')),
      'Should compare typing, compilation/execution, and strengths'
    );
    assert(res.content.includes('```'), 'Should include code comparison snippet');
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 12. "start a mock interview"
  await test('12. User: "start a mock interview" prompts for target role and enters practice mode', async () => {
    const res = await aiCoachService.generateDashboardAssistantResponse({
      message: 'start a mock interview',
      history: [],
      context: { candidateName: 'Prakash' },
    });
    responses['start a mock interview'] = res.content;
    assert(res.content, 'Content should not be empty');
    assertNoForcedTemplates(res.content, 'start a mock interview');
    assert.strictEqual(res.mode, 'interview_practice');
    const lower = res.content.toLowerCase();
    assert(
      lower.includes('mock interview') || lower.includes('role') || lower.includes('topic'),
      'Should prompt for role or topic to start'
    );
    console.log(`     Response preview: "${res.content.trim().slice(0, 90)}..."`);
  });

  // 13. Spelling tolerance & informal English test
  await test('13. Informal & spelling mistake tolerance ("hw r u", "whts trendng tech", "dif between java and pythn")', async () => {
    const r1 = await aiCoachService.generateDashboardAssistantResponse({ message: 'hw r u', history: [] });
    assert(r1.content.toLowerCase().includes('doing well') || r1.content.toLowerCase().includes('well'), 'Should understand "hw r u"');

    const r2 = await aiCoachService.generateDashboardAssistantResponse({ message: 'whts trendng tech', history: [] });
    assert(r2.content.toLowerCase().includes('trending') || r2.content.toLowerCase().includes('ai') || r2.content.toLowerCase().includes('technolog'), 'Should understand "whts trendng tech"');

    const r3 = await aiCoachService.generateDashboardAssistantResponse({ message: 'dif between java and pythn', history: [] });
    assert(r3.content.toLowerCase().includes('java') && r3.content.toLowerCase().includes('python'), 'Should understand "dif between java and pythn"');
  });

  // 14. Diversity verification: Ensure all responses are meaningfully distinct
  await test('14. Diversity: All test responses are distinct and tailored', () => {
    const values = Object.values(responses);
    const uniqueValues = new Set(values);
    assert.strictEqual(
      uniqueValues.size,
      values.length,
      'All test responses must be completely distinct from one another'
    );
  });

  console.log('\n====================================================');
  console.log(`Natural Conversation Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runNaturalConversationTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
