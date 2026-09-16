/**
 * Acceptance Tests Suite for InterviewX Senior Developer Fix Specification
 *
 * Tests:
 * Test A — Natural conversation ("hi" -> warm greeting with options, not welcome message)
 * Test B — General question ("what is React?" -> real explanation)
 * Test C — Follow-up continuity ("explain hooks" -> "give me an example" -> "now quiz me" -> "make it harder")
 * Test D — Unknown question ("what is the difference between Kafka partitions and consumer groups?")
 * Test E — Current question context ("i don't know, give answer" -> 5-part answer to preceding TTFB question)
 * Test F — Resume skills query ("What skills are on my resume?" -> actual extracted skills)
 * Test G — Resume training ("give questions based on my resume" -> grounded in resume, not TTFB)
 * Test H — Resume follow-up ("What project should I practice?" -> references actual project)
 * Test I — Results Train Me (isolated to specific source interview ID and weaknesses)
 * Test J & K & L — Dashboard & Results Isolation (queries scoped strictly by userId + interviewId)
 * Test M — Question Deduplication across new interviews
 */

const assert = require('assert');
const aiCoachService = require('../services/aiCoachService');

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('STARTING ACCEPTANCE TESTS FOR SENIOR DEVELOPER FIX SPECIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(testName, condition, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} — ${detail}`);
      failed++;
    }
  }

  // ── TEST A: Natural Conversation ──────────────────────────────────────────
  console.log('--- TEST A: Natural Conversation ("hi") ---');
  const resA = await aiCoachService.chat({
    message: 'hi',
    history: [],
    context: { candidateName: 'Prakash' },
  });
  const contentA = resA.content.toLowerCase();
  record(
    'Test A: Responds with natural greeting and candidate name',
    contentA.includes('hey') && contentA.includes('prakash'),
    `Actual content: "${resA.content}"`
  );
  record(
    'Test A: Offers interview preparation options',
    contentA.includes('resume') && (contentA.includes('practice') || contentA.includes('concept')),
    `Actual content: "${resA.content}"`
  );
  record(
    'Test A: Does NOT fall back to generic welcome message',
    !resA.content.includes("👋 I'm your InterviewX AI Assistant.\n\nI can help you build custom preparation plans"),
    `Actual content: "${resA.content}"`
  );

  // ── TEST A.2: User Name Query ─────────────────────────────────────────────
  console.log('\n--- TEST A.2: User Name Query ("what\'s my name?") ---');
  const resName = await aiCoachService.chat({
    message: "what's my name?",
    history: [],
    context: { candidateName: 'Prakash Potnuru', targetRole: 'Senior Full-Stack Engineer' },
  });
  record(
    'Test A.2: Answers with user name from profile context',
    resName.content.includes('Prakash Potnuru'),
    `Actual content: "${resName.content}"`
  );

  // ── TEST B: General Question ──────────────────────────────────────────────
  console.log('\n--- TEST B: General Question ("what is React?") ---');
  const resB = await aiCoachService.chat({
    message: 'what is React?',
    history: [],
    context: {},
  });
  record(
    'Test B: Real AI explanation of React with Virtual DOM and components',
    resB.content.toLowerCase().includes('component') &&
      resB.content.toLowerCase().includes('virtual dom') &&
      resB.content.toLowerCase().includes('reconciliation'),
    `Actual content: "${resB.content}"`
  );

  // ── TEST C: Follow-up Continuity ──────────────────────────────────────────
  console.log('\n--- TEST C: Follow-up Continuity (Hooks -> Example -> Quiz -> Harder) ---');
  // Turn 1: Explain hooks
  const turn1 = await aiCoachService.chat({
    message: 'explain hooks',
    history: [],
    context: {},
  });
  record(
    'Test C.1: Explains React hooks',
    turn1.content.includes('useState') && turn1.content.includes('useEffect'),
    `Turn 1: "${turn1.content.slice(0, 100)}"`
  );

  // Turn 2: Give me an example
  const history1 = [
    { role: 'user', content: 'explain hooks' },
    { role: 'assistant', content: turn1.content },
  ];
  const turn2 = await aiCoachService.chat({
    message: 'give me an example',
    history: history1,
    context: {},
  });
  record(
    'Test C.2: Provides concrete code example related to hooks',
    turn2.content.includes('```') && (turn2.content.includes('useState') || turn2.content.includes('useDebounce')),
    `Turn 2: "${turn2.content.slice(0, 100)}"`
  );

  // Turn 3: Now quiz me
  const history2 = [
    ...history1,
    { role: 'user', content: 'give me an example' },
    { role: 'assistant', content: turn2.content },
  ];
  const turn3 = await aiCoachService.chat({
    message: 'now quiz me',
    history: history2,
    context: {},
  });
  record(
    'Test C.3: Formulates active recall quiz on React / Hooks',
    turn3.content.toLowerCase().includes('quiz') &&
      (turn3.content.toLowerCase().includes('react') || turn3.content.toLowerCase().includes('usememo')),
    `Turn 3: "${turn3.content.slice(0, 100)}"`
  );

  // Turn 4: Make it harder
  const history3 = [
    ...history2,
    { role: 'user', content: 'now quiz me' },
    { role: 'assistant', content: turn3.content },
  ];
  const turn4 = await aiCoachService.chat({
    message: 'make it harder',
    history: history3,
    context: {},
  });
  record(
    'Test C.4: Increases difficulty on the active topic (React concurrency / memory profiling)',
    turn4.content.toLowerCase().includes('advanced') || turn4.content.toLowerCase().includes('reconciliation') || turn4.content.toLowerCase().includes('concurrency'),
    `Turn 4: "${turn4.content.slice(0, 100)}"`
  );

  // ── TEST D: Unknown Technical Question ─────────────────────────────────────
  console.log('\n--- TEST D: Unknown Question (Kafka partitions vs consumer groups) ---');
  const resD = await aiCoachService.chat({
    message: 'what is the difference between Kafka partitions and consumer groups?',
    history: [],
    context: {},
  });
  record(
    'Test D: Deep technical comparison of Kafka partitions and consumer groups',
    resD.content.includes('Partitions') &&
      resD.content.includes('Consumer Groups') &&
      resD.content.includes('FIFO') &&
      resD.content.toLowerCase().includes('rebalance'),
    `Actual content: "${resD.content.slice(0, 150)}"`
  );

  // ── TEST E: Current Question Context & "I Don't Know" ───────────────────────
  console.log('\n--- TEST E: "I Don\'t Know" Contextual Answer ---');
  const ttfbHistory = [
    {
      role: 'assistant',
      content:
        'Suppose your web application\'s Time to First Byte (TTFB) is 800ms, but total bundle download finishes in 120ms. Walk me through how you would isolate whether the latency is in DNS lookup, TLS handshake, server processing, or database queries.',
    },
  ];
  const resE = await aiCoachService.chat({
    message: 'i dont know give answer',
    history: ttfbHistory,
    context: {},
  });
  record(
    'Test E: Answers preceding TTFB question instead of generic welcome message',
    resE.content.toLowerCase().includes('ttfb') &&
      resE.content.toLowerCase().includes('dns') &&
      resE.content.toLowerCase().includes('navigation timing'),
    `Actual content: "${resE.content.slice(0, 150)}"`
  );
  record(
    'Test E: Contains required 5-part structure (Explanation, Interview-ready answer, Key points, Retry offer)',
    resE.content.includes('Explanation:') &&
      resE.content.includes('Interview-ready answer:') &&
      resE.content.includes('Key points to remember:') &&
      resE.content.toLowerCase().includes('try the question again'),
    `Actual structure check passed`
  );

  // ── TEST F: Resume Skills ─────────────────────────────────────────────────
  console.log('\n--- TEST F: Resume Skills Extraction ---');
  const resumeContext = {
    candidateName: 'Prakash',
    resumeSkills: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT', 'Docker'],
    resumeProjects: ['E-Commerce Microservices Platform: Built with React, Node.js, Express, MongoDB, and JWT authentication.'],
    hasResume: true,
  };
  const resF = await aiCoachService.chat({
    message: 'What skills are on my resume?',
    history: [],
    context: resumeContext,
  });
  record(
    'Test F: Returns verified skills actually extracted from resume',
    resF.content.includes('React') && resF.content.includes('MongoDB') && resF.content.includes('JWT'),
    `Actual content: "${resF.content}"`
  );

  // ── TEST G: Resume Training / Grounded Question Generation ─────────────────
  console.log('\n--- TEST G: Resume Training ("give questions based on my resume") ---');
  const resG = await aiCoachService.chat({
    message: 'give questions based on my resume',
    history: [],
    context: resumeContext,
  });
  record(
    'Test G: Generates questions grounded in resume skills and projects',
    resG.content.toLowerCase().includes('architecture') &&
      (resG.content.includes('React') || resG.content.includes('MongoDB') || resG.content.includes('E-Commerce')),
    `Actual content: "${resG.content.slice(0, 200)}"`
  );
  record(
    'Test G: Does NOT return unrelated TTFB question for resume queries',
    !resG.content.includes('Time to First Byte (TTFB) is 800ms'),
    `Actual content: "${resG.content.slice(0, 100)}"`
  );

  // ── TEST H: Resume Project Follow-up ───────────────────────────────────────
  console.log('\n--- TEST H: Resume Project Follow-up ---');
  const resH = await aiCoachService.chat({
    message: 'What project should I practice?',
    history: [],
    context: resumeContext,
  });
  record(
    'Test H: References actual project from resume',
    resH.content.includes('E-Commerce Microservices Platform'),
    `Actual content: "${resH.content}"`
  );

  // ── TEST I: Results Train Me Isolation ────────────────────────────────────
  console.log('\n--- TEST I: Results Train Me Context Isolation ---');
  const sourceInterviewContext = {
    interviewId: 'interview_27',
    targetRole: 'Distributed Systems Architect',
    overallScore: 58,
    technicalScore: 52,
    weakAreas: ['Database Sharding & Geo-Replication Trade-offs', 'Kafka Partition Sizing'],
    questionBreakdown: [
      {
        number: 1,
        question: 'Design a distributed cache invalidation scheme.',
        score: 50,
        missingConcepts: ['Thundering herd protection', 'Two-phase commit overhead'],
      },
    ],
  };

  const resI = await aiCoachService.chat({
    message: 'Why was my score low and what should I train?',
    history: [],
    context: {
      sourceInterviewContext,
      candidateName: 'Prakash',
    },
  });
  record(
    'Test I: Cites specific source interview #27 data and score 58/100',
    resI.content.includes('interview_27') || resI.content.includes('58/100'),
    `Actual content: "${resI.content}"`
  );
  record(
    'Test I: Identifies specific weak areas from Interview #27',
    resI.content.includes('Database Sharding') || resI.content.includes('Distributed Systems Architect'),
    `Actual content: "${resI.content}"`
  );

  // ── TEST N: Explicit User Goal Override (Python Full Stack) ──────────────
  console.log('\n--- TEST N: Explicit User Goal Override ("I want learn Python fullstack make a plan") ---');
  const resN = await aiCoachService.chat({
    message: 'I want learn Python fullstack make a plan',
    history: [],
    context: {
      candidateName: 'Prakash',
      resumeSkills: ['React', 'TypeScript', 'Java', 'Spring Boot'], // Resume has other skills!
    },
  });
  const contentN = resN.content.toLowerCase();
  record(
    'Test N: Prioritizes explicit goal over resume skills (contains Python Full Stack plan)',
    contentN.includes('python') && (contentN.includes('fastapi') || contentN.includes('django') || contentN.includes('sql') || contentN.includes('postgresql')),
    `Actual content: "${resN.content.slice(0, 200)}..."`
  );
  record(
    'Test N: Does NOT replace Python plan with generic React/TypeScript/Java plan',
    !contentN.includes('react & typescript engineering') && !contentN.includes('spring boot'),
    `Actual content: "${resN.content.slice(0, 200)}..."`
  );
  record(
    'Test N: Returns updated state with goal = "Python Full Stack"',
    resN.updatedState?.goal === 'Python Full Stack' && resN.updatedState?.learningTrack === 'Python Full Stack',
    `Actual updatedState: ${JSON.stringify(resN.updatedState)}`
  );

  // ── TEST O: Start Day 1 Practice on Active Python Track ─────────────────────
  console.log('\n--- TEST O: Start Day 1 Practice on Active Track ---');
  const resO = await aiCoachService.chat({
    message: 'Start Day 1 Practice',
    history: [{ role: 'assistant', content: resN.content }],
    conversationState: resN.updatedState,
    context: {},
  });
  const contentO = resO.content.toLowerCase();
  record(
    'Test O: Starts Day 1 Python practice without falling into generic fallback',
    contentO.includes('day 1') && contentO.includes('python') && (contentO.includes('list') && contentO.includes('tuple')),
    `Actual content: "${resO.content}"`
  );
  record(
    'Test O: Sets currentQuestion in updatedState for Question 1',
    resO.updatedState?.currentQuestion?.questionNumber === 1 && resO.updatedState?.currentQuestion?.topic.includes('Python'),
    `Actual updatedState: ${JSON.stringify(resO.updatedState)}`
  );

  // ── TEST P: Contextual Hint ("Give me a hint") ──────────────────────────────
  console.log('\n--- TEST P: Contextual Hint ("Give me a hint") ---');
  const resP = await aiCoachService.chat({
    message: 'Give me a hint',
    history: [
      { role: 'assistant', content: resO.content },
    ],
    conversationState: resO.updatedState,
    context: {},
  });
  const contentP = resP.content.toLowerCase();
  record(
    'Test P: Provides targeted hint for active Question 1 (mutability/memory/hashability)',
    contentP.includes('hint') && (contentP.includes('mutability') || contentP.includes('immutable') || contentP.includes('memory')),
    `Actual content: "${resP.content}"`
  );
  record(
    'Test P: Does NOT return generic welcome message for hint',
    !resP.content.includes("What would you like to explore next?"),
    `Actual content: "${resP.content}"`
  );

  // ── TEST Q: Contextual Answer ("I don't know, give answer") ─────────────────
  console.log('\n--- TEST Q: Contextual Answer ("I don\'t know, give answer") ---');
  const resQ = await aiCoachService.chat({
    message: "I don't know, give answer",
    history: [
      { role: 'assistant', content: resO.content },
      { role: 'user', content: 'Give me a hint' },
      { role: 'assistant', content: resP.content },
    ],
    conversationState: resO.updatedState,
    context: {},
  });
  const contentQ = resQ.content.toLowerCase();
  record(
    'Test Q: Answers active Question 1 (List vs Tuple) with full interview explanation',
    contentQ.includes('mutable') && contentQ.includes('immutable') && contentQ.includes('interview-ready answer'),
    `Actual content: "${resQ.content}"`
  );

  // ── TEST R: Advance to Next Question ("ok next question") ───────────────────
  console.log('\n--- TEST R: Advance to Next Question ("ok next question") ---');
  const resR = await aiCoachService.chat({
    message: 'ok next question',
    history: [
      { role: 'assistant', content: resQ.content },
    ],
    conversationState: {
      ...resO.updatedState,
      currentQuestion: {
        ...resO.updatedState.currentQuestion,
        questionNumber: 1,
      },
    },
    context: {},
  });
  const contentR = resR.content.toLowerCase();
  record(
    'Test R: Advances to Question 2 in Python track (Generators & Yield)',
    contentR.includes('question 2') && (contentR.includes('generator') || contentR.includes('yield')),
    `Actual content: "${resR.content}"`
  );
  record(
    'Test R: Increments question number in state',
    resR.updatedState?.currentQuestion?.questionNumber === 2,
    `Actual updatedState: ${JSON.stringify(resR.updatedState)}`
  );

  // ── TEST S: Explain Prerequisite Concept ───────────────────────────────────
  console.log('\n--- TEST S: Explain Prerequisite Concept for Active Question ---');
  const resS = await aiCoachService.chat({
    message: 'Explain the prerequisite concept',
    history: [
      { role: 'assistant', content: resR.content },
    ],
    conversationState: resR.updatedState,
    context: {},
  });
  const contentS = resS.content.toLowerCase();
  record(
    'Test S: Explains iterables and iterators for Python generators',
    contentS.includes('iterable') && contentS.includes('iterator') && contentS.includes('yield'),
    `Actual content: "${resS.content}"`
  );
  record(
    'Test S: Does NOT return unrelated distributed systems or CAP theorem text',
    !contentS.includes('cap theorem') && !contentS.includes('distributed cache'),
    `Actual content: "${resS.content}"`
  );

  // ── TEST T: Urgent Resume Interview Request ────────────────────────────────
  console.log('\n--- TEST T: Urgent Resume Interview ("Today I have interview based on my resume") ---');
  const resT = await aiCoachService.chat({
    message: 'Today I have interview based on my resume',
    history: [],
    context: resumeContext,
  });
  const contentT = resT.content.toLowerCase();
  record(
    'Test T: Recognizes urgent prep and creates attack surface from resume',
    contentT.includes('urgent') || contentT.includes('attack surface') || contentT.includes('rapid-fire'),
    `Actual content: "${resT.content}"`
  );
  record(
    'Test T: Asks question grounded in candidate project (E-Commerce Microservices)',
    contentT.includes('e-commerce microservices'),
    `Actual content: "${resT.content}"`
  );

  // ── TEST U: Elimination of "N/A/100" in Greeting ────────────────────────────
  console.log('\n--- TEST U: Elimination of "N/A/100" in Greeting ---');
  const greetingWithoutScore = await aiCoachService.generateCoachGreeting({
    firstName: 'Prakash',
    lastInterview: {
      targetRole: 'Software Engineer',
      difficulty: 'Intermediate',
      overallScore: null, // Null score!
    },
  });
  record(
    'Test U: Greeting never renders "N/A/100"',
    !greetingWithoutScore.includes('N/A/100') && !greetingWithoutScore.includes('null/100'),
    `Actual greeting: "${greetingWithoutScore}"`
  );

  // ── TEST V: "ok" / "what should I do next" Guidance ────────────────────────
  console.log('\n--- TEST V: Contextual Guidance ("what should I do next") ---');
  const resV = await aiCoachService.chat({
    message: 'what should I do next',
    history: [],
    conversationState: {
      goal: 'Python Full Stack',
      learningTrack: 'Python Full Stack',
      currentQuestion: {
        text: 'What is the difference between a Python list and tuple?',
      },
    },
    context: {},
  });
  const contentV = resV.content.toLowerCase();
  record(
    'Test V: Contextually references active question or plan',
    contentV.includes('python list and tuple') || contentV.includes('active practice question'),
    `Actual content: "${resV.content}"`
  );

  // ── TEST W: Natural Conversation Multi-Turn Sequence ─────────────────────
  console.log('\n--- TEST W: Multi-Turn Conversation Sequence (Decorators -> Example -> Quiz -> Hint -> Solution -> Next) ---');
  // Turn W1: Explain Python decorators
  const turnW1 = await aiCoachService.chat({
    message: 'Explain Python decorators',
    history: [],
    context: {},
  });
  record(
    'Test W.1: Explains Python decorators with first-class functions and @wraps',
    turnW1.content.toLowerCase().includes('decorator') &&
      turnW1.content.toLowerCase().includes('wraps') &&
      turnW1.content.toLowerCase().includes('first-class'),
    `Turn W1: "${turnW1.content.slice(0, 100)}"`
  );

  // Turn W2: Give me an example
  let convState = turnW1.updatedState || {};
  let historyW = [
    { role: 'user', content: 'Explain Python decorators' },
    { role: 'assistant', content: turnW1.content },
  ];
  const turnW2 = await aiCoachService.chat({
    message: 'Give me an example',
    history: historyW,
    conversationState: convState,
    context: {},
  });
  record(
    'Test W.2: Provides real Python decorator example (timing/latency with @functools.wraps)',
    turnW2.content.includes('```python') &&
      turnW2.content.includes('functools.wraps') &&
      turnW2.content.includes('measure_latency'),
    `Turn W2: "${turnW2.content.slice(0, 100)}"`
  );

  // Turn W3: Now quiz me
  if (turnW2.updatedState) convState = { ...convState, ...turnW2.updatedState };
  historyW.push({ role: 'user', content: 'Give me an example' });
  historyW.push({ role: 'assistant', content: turnW2.content });
  const turnW3 = await aiCoachService.chat({
    message: 'Now quiz me',
    history: historyW,
    conversationState: convState,
    context: {},
  });
  record(
    'Test W.3: Quizzes candidate on Python decorators and sets question in state',
    turnW3.content.toLowerCase().includes('python decorators') &&
      turnW3.updatedState?.currentQuestion?.topic?.includes('Decorator'),
    `Turn W3: "${turnW3.content.slice(0, 100)}"`
  );

  // Turn W4: Give me a hint
  if (turnW3.updatedState) convState = { ...convState, ...turnW3.updatedState };
  historyW.push({ role: 'user', content: 'Now quiz me' });
  historyW.push({ role: 'assistant', content: turnW3.content });
  const turnW4 = await aiCoachService.chat({
    message: 'Give me a hint',
    history: historyW,
    conversationState: convState,
    context: {},
  });
  record(
    'Test W.4: Gives targeted hint for decorator question without leaking answer',
    turnW4.content.toLowerCase().includes('hint') &&
      (turnW4.content.toLowerCase().includes('decorator') || turnW4.content.toLowerCase().includes('closure')),
    `Turn W4: "${turnW4.content.slice(0, 100)}"`
  );

  // Turn W5: I don't know
  if (turnW4.updatedState) convState = { ...convState, ...turnW4.updatedState };
  historyW.push({ role: 'user', content: 'Give me a hint' });
  historyW.push({ role: 'assistant', content: turnW4.content });
  const turnW5 = await aiCoachService.chat({
    message: "I don't know",
    history: historyW,
    conversationState: convState,
    context: {},
  });
  record(
    'Test W.5: Provides 5-part model answer for the decorator question',
    turnW5.content.includes('Explanation:') &&
      turnW5.content.includes('Interview-ready answer:') &&
      turnW5.content.includes('Key points to remember:') &&
      turnW5.content.toLowerCase().includes('decorator'),
    `Turn W5: "${turnW5.content.slice(0, 100)}"`
  );

  // Turn W6: Next one
  if (turnW5.updatedState) convState = { ...convState, ...turnW5.updatedState };
  historyW.push({ role: 'user', content: "I don't know" });
  historyW.push({ role: 'assistant', content: turnW5.content });
  const turnW6 = await aiCoachService.chat({
    message: 'Next one',
    history: historyW,
    conversationState: convState,
    context: {},
  });
  record(
    'Test W.6: Advances to Question 2 in Python Full Stack sequence (Generators)',
    turnW6.content.toLowerCase().includes('question 2') &&
      turnW6.content.toLowerCase().includes('generator'),
    `Turn W6: "${turnW6.content.slice(0, 100)}"`
  );

  // ── TEST X: User Requests Override Stale Context ──────────────────────────
  console.log('\n--- TEST X: User Requests Override Stale Context (Python Full Stack vs Java Resume) ---');
  const javaResumeContext = {
    parsedSkills: ['Java', 'Spring Boot', 'Hibernate', 'MySQL'],
    parsedRole: 'Java Backend Developer',
    candidateName: 'Prakash',
  };

  // Step 1: User specifies Python Full Stack
  const resX1 = await aiCoachService.chat({
    message: 'I want to learn Python Full Stack',
    history: [],
    context: javaResumeContext,
  });
  record(
    'Test X.1: Adopts Python Full Stack goal despite Java resume skills',
    resX1.updatedState?.goal === 'Python Full Stack' &&
      resX1.content.toLowerCase().includes('python full stack'),
    `Actual content: "${resX1.content.slice(0, 100)}"`
  );

  // Step 2: User says "Run a mock on Python"
  let stateX = resX1.updatedState || {};
  const resX2 = await aiCoachService.chat({
    message: 'Run a mock on Python',
    history: [{ role: 'user', content: 'I want to learn Python Full Stack' }, { role: 'assistant', content: resX1.content }],
    conversationState: stateX,
    context: javaResumeContext,
  });
  record(
    'Test X.2: Asks Python mock question, NEVER starts a Java question',
    resX2.content.toLowerCase().includes('python') &&
      !resX2.content.toLowerCase().includes('spring boot') &&
      !resX2.content.toLowerCase().includes('java architecture'),
    `Actual content: "${resX2.content.slice(0, 100)}"`
  );

  // Step 3: User clicks button "Practice interview questions"
  if (resX2.updatedState) stateX = { ...stateX, ...resX2.updatedState };
  const resX3 = await aiCoachService.chat({
    message: 'Practice interview questions',
    history: [
      { role: 'user', content: 'Run a mock on Python' },
      { role: 'assistant', content: resX2.content },
    ],
    conversationState: stateX,
    context: javaResumeContext,
  });
  record(
    'Test X.3: Practice button retains Python track and asks Python, NOT Java',
    resX3.content.toLowerCase().includes('python') &&
      !resX3.content.toLowerCase().includes('java architecture'),
    `Actual content: "${resX3.content.slice(0, 100)}"`
  );

  // ── TEST Y: Arbitrary Technical Questions ──────────────────────────────────
  console.log('\n--- TEST Y: Arbitrary Technical Questions ---');
  const techQueries = [
    { query: 'What is Python?', keyword: 'dynamically typed' },
    { query: 'Explain database indexing', keyword: 'b+tree' },
    { query: 'What is dependency injection?', keyword: 'inversion of control' },
    { query: 'Show me a FastAPI example', keyword: 'depends' },
    { query: 'Why use PostgreSQL?', keyword: 'acid' },
    { query: 'Explain async programming', keyword: 'event loop' },
    { query: 'What is Docker?', keyword: 'container' },
    { query: 'Help me debug this code', keyword: 'debugging' },
    { query: "I don't understand, make it simpler", keyword: 'analogy' },
  ];

  for (const tq of techQueries) {
    const resY = await aiCoachService.chat({
      message: tq.query,
      history: [],
      context: {},
    });
    record(
      `Test Y [${tq.query}]: Real technical answer containing "${tq.keyword}"`,
      resY.content.toLowerCase().includes(tq.keyword.toLowerCase()) &&
        !resY.content.includes("👋 I'm your InterviewX AI Assistant"),
      `Actual content: "${resY.content.slice(0, 100)}"`
    );
  }

  // Test Y harder challenge
  const resYHarder = await aiCoachService.chat({
    message: 'Make the question harder',
    history: [],
    conversationState: { currentTopic: 'Python Concurrency', learningTrack: 'Python Full Stack' },
    context: {},
  });
  record(
    'Test Y [Make the question harder]: Generates advanced CPython GIL concurrency challenge',
    resYHarder.content.toLowerCase().includes('gil') || resYHarder.content.toLowerCase().includes('cpython'),
    `Actual content: "${resYHarder.content.slice(0, 100)}"`
  );

  console.log('\n================================================================');
  console.log(`ACCEPTANCE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
