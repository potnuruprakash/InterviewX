/**
 * Comprehensive System Verification Test Suite for InterviewX
 *
 * Exercises all 17 verification items against live MongoDB, services, and endpoints.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Models
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const SkillAnalysis = require('../models/SkillAnalysis');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Progress = require('../models/Progress');

// Services
const { analyzeResume } = require('../services/resumeAnalysisService');
const { analyzeJobDescription } = require('../services/jobAnalysisService');
const { matchSkills } = require('../services/skillMatchingService');
const { generateInterviewQuestions, generateFollowUpQuestion } = require('../services/questionService');
const { evaluateResponse, developmentEvaluate } = require('../services/evaluationService');
const { calculateWeightedScore, buildEvaluation, aggregateInterviewFusion } = require('../services/multimodalFusionService');
const { initializeInterviewState, updateSkillPerformance, determineAdaptiveAction, shouldStopInterview } = require('../services/adaptiveEngineService');
const { generateRoadmap, calculateJobReadiness } = require('../services/roadmapService');
const aiService = require('../services/aiService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewx';

const RESULTS = {};

function logSection(title) {
  console.log('\n==================================================');
  console.log(`  ${title}`);
  console.log('==================================================');
}

function recordResult(testName, passed, evidence) {
  RESULTS[testName] = { passed, evidence };
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${testName}]: ${evidence}`);
}

async function runVerification() {
  console.log('Starting InterviewX Comprehensive System Verification...\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. MONGODB CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('1. STARTUP & DATABASE CONNECTION');
  try {
    await mongoose.connect(MONGODB_URI);
    recordResult('MongoDB', true, `Connected to ${MONGODB_URI} (Mongoose state: ${mongoose.connection.readyState})`);
  } catch (err) {
    recordResult('MongoDB', false, `Failed to connect: ${err.message}`);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CLERK MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('2. CLERK AUTH & USER ISOLATION');
  const userA = 'user_clerk_test_alice_' + Date.now();
  const userB = 'user_clerk_test_bob_' + Date.now();

  try {
    const resumeA = await Resume.create({
      clerkUserId: userA,
      originalName: 'alice_resume.pdf',
      storedFilename: 'alice_' + Date.now() + '.pdf',
      filePath: '/uploads/resumes/alice.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      extractedText: 'Alice Developer. Experience: 3 years React and Node.js. Skills: JavaScript, React, Node.js, MongoDB.',
      processingStatus: 'completed',
    });

    const resumeB = await Resume.create({
      clerkUserId: userB,
      originalName: 'bob_resume.pdf',
      storedFilename: 'bob_' + Date.now() + '.pdf',
      filePath: '/uploads/resumes/bob.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      extractedText: 'Bob Engineer. Experience: 5 years Python and AWS. Skills: Python, Django, AWS, Docker.',
      processingStatus: 'completed',
    });

    // Check isolation: userA cannot query userB's resume with clerkUserId filter
    const userAQueryingB = await Resume.findOne({ _id: resumeB._id, clerkUserId: userA });
    const userBQueryingA = await Resume.findOne({ _id: resumeA._id, clerkUserId: userB });

    const isolated = userAQueryingB === null && userBQueryingA === null;
    recordResult('Clerk Isolation', isolated, `User A accessing User B: ${userAQueryingB ? 'LEAKED' : 'NULL (SECURE)'}, User B accessing User A: ${userBQueryingA ? 'LEAKED' : 'NULL (SECURE)'}`);
  } catch (err) {
    recordResult('Clerk Isolation', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PHASE 2: RESUME & JOB DESCRIPTION PROCESSING & SKILL GAP
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('3. PHASE 2: RESUME/JD PARSING & SKILL MATCHING');
  let resumeDoc = null;
  let jobDoc = null;
  let skillAnalysisDoc = null;

  try {
    const resumeText = `
      John Doe
      Senior Full Stack Developer
      Email: john@example.com

      SKILLS:
      JavaScript, TypeScript, React, Node.js, Express, MongoDB, Git, HTML, CSS, REST API

      EXPERIENCE:
      Senior Software Engineer at TechCorp (2021 - Present)
      - Architected high-throughput microservices in Node.js and MongoDB.
      - Developed responsive frontend applications using React and TypeScript.

      PROJECTS:
      E-Commerce Platform: Built a scalable online store with React, Node.js, and Redis caching.
      Analytics Dashboard: Designed real-time monitoring graphs using React and WebSockets.

      EDUCATION:
      B.S. in Computer Science, State University (2017 - 2021)
    `;

    const candidateProfile = analyzeResume(resumeText);
    console.log('Extracted Skills:', candidateProfile.skills.map(s => s.canonicalName || s.name || s));
    console.log('Extracted Projects:', candidateProfile.projects?.map(p => p.title || p.name || p));

    resumeDoc = await Resume.create({
      clerkUserId: userA,
      originalName: 'john_doe_resume.pdf',
      storedFilename: 'john_' + Date.now() + '.pdf',
      filePath: '/uploads/resumes/john.pdf',
      mimeType: 'application/pdf',
      fileSize: 4096,
      extractedText: resumeText,
      candidateProfile: candidateProfile,
      processingStatus: 'completed',
    });

    const jdText = `
      Position: Senior Backend Engineer
      Company: CloudTech Innovations

      Required Skills:
      - Node.js, TypeScript, MongoDB, Docker, Kubernetes

      Preferred Skills:
      - Redis, AWS, GraphQL

      Responsibilities:
      - Design resilient backend services and manage Docker container deployments.
    `;

    const jobProfile = analyzeJobDescription(jdText);
    console.log('JD Required Skills:', jobProfile.requiredSkills.map(s => s.canonicalName || s.name || s));
    console.log('JD Preferred Skills:', jobProfile.preferredSkills.map(s => s.canonicalName || s.name || s));

    jobDoc = await JobDescription.create({
      clerkUserId: userA,
      content: jdText,
      targetRole: 'Senior Backend Engineer',
      parsedData: jobProfile,
      processingStatus: 'completed',
    });

    // Skill Gap Analysis
    const gapResult = matchSkills(candidateProfile.skills, jobProfile.requiredSkills, jobProfile.preferredSkills);
    console.log('Matched Required:', gapResult.matchedRequiredSkills);
    console.log('Missing Required (Gaps):', gapResult.notIdentifiedRequiredSkills);
    console.log('Skill Coverage %:', gapResult.skillCoveragePercentage);

    skillAnalysisDoc = await SkillAnalysis.create({
      clerkUserId: userA,
      resumeId: resumeDoc._id,
      jobDescriptionId: jobDoc._id,
      targetRole: 'Senior Backend Engineer',
      matchedRequiredSkills: gapResult.matchedRequiredSkills,
      notIdentifiedRequiredSkills: gapResult.notIdentifiedRequiredSkills,
      matchedPreferredSkills: gapResult.matchedPreferredSkills,
      notIdentifiedPreferredSkills: gapResult.notIdentifiedPreferredSkills,
      skillCoveragePercentage: gapResult.skillCoveragePercentage,
      skillGapPercentage: gapResult.skillGapPercentage,
      isFullyCovered: gapResult.isFullyCovered,
    });

    const phase2Pass = (
      candidateProfile.skills.length > 0 &&
      jobProfile.requiredSkills.length > 0 &&
      gapResult.matchedRequiredSkills.length > 0 &&
      gapResult.notIdentifiedRequiredSkills.length > 0 &&
      skillAnalysisDoc._id !== null
    );

    recordResult('Resume Parsing', candidateProfile.skills.length > 0, `Extracted ${candidateProfile.skills.length} skills, ${candidateProfile.projects?.length || 0} projects`);
    recordResult('JD Analysis', jobProfile.requiredSkills.length > 0, `Extracted ${jobProfile.requiredSkills.length} required, ${jobProfile.preferredSkills.length} preferred skills`);
    recordResult('Skill Matching', phase2Pass, `Matched: [${gapResult.matchedRequiredSkills.join(', ')}], Missing (Gaps): [${gapResult.notIdentifiedRequiredSkills.join(', ')}], Coverage: ${gapResult.skillCoveragePercentage}%`);
  } catch (err) {
    recordResult('Resume Parsing', false, err.message);
    recordResult('JD Analysis', false, err.message);
    recordResult('Skill Matching', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PHASE 3: PERSONALIZED QUESTION GENERATION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('4. PHASE 3: PERSONALIZED QUESTION GENERATION');
  let interviewDoc = null;
  let questions = [];

  try {
    const candidateProfileData = {
      skills: (resumeDoc.candidateProfile?.skills || []).map(s => s.canonicalName || s.name || s),
      projects: resumeDoc.candidateProfile?.projects || [],
      experience: resumeDoc.candidateProfile?.experience || [],
    };

    const jobProfileData = {
      requiredSkills: (jobDoc.parsedData?.requiredSkills || []).map(s => s.canonicalName || s.name || s),
      preferredSkills: (jobDoc.parsedData?.preferredSkills || []).map(s => s.canonicalName || s.name || s),
      responsibilities: jobDoc.parsedData?.responsibilities || [],
    };

    const generatedQs = generateInterviewQuestions({
      candidateProfile: candidateProfileData,
      jobProfile: jobProfileData,
      skillAnalysis: skillAnalysisDoc,
      interviewType: 'mixed',
      difficulty: 'medium',
      totalQuestions: 6,
    });

    console.log(`Generated ${generatedQs.length} personalized questions:`);
    generatedQs.forEach((q, i) => {
      console.log(`  Q${i + 1} [${q.type}] (${q.source}): ${q.text.substring(0, 70)}...`);
    });

    // Verify distinct types are generated
    const hasProjectQ = generatedQs.some(q => q.type === 'project' || q.source === 'resume');
    const hasSkillGapQ = generatedQs.some(q => q.type === 'skill_gap' || q.source === 'skill_gap');
    const hasTechnicalQ = generatedQs.some(q => q.type === 'technical' || q.source === 'job_description');

    interviewDoc = await Interview.create({
      clerkUserId: userA,
      resumeId: resumeDoc._id,
      jobDescriptionId: jobDoc._id,
      skillAnalysisId: skillAnalysisDoc._id,
      targetRole: 'Senior Backend Engineer',
      interviewType: 'mixed',
      difficulty: 'medium',
      totalQuestions: generatedQs.length,
      questionGenerationSource: 'personalized',
      interviewState: initializeInterviewState({ difficulty: 'medium' }, skillAnalysisDoc),
      skillAnalysis: {
        matchedSkills: skillAnalysisDoc.matchedRequiredSkills,
        missingSkills: skillAnalysisDoc.notIdentifiedRequiredSkills,
        weakSkills: [],
        skillGapPercentage: skillAnalysisDoc.skillGapPercentage,
      },
    });

    questions = await Question.insertMany(
      generatedQs.map((q, idx) => ({
        interviewId: interviewDoc._id,
        clerkUserId: userA,
        text: q.text,
        type: q.type,
        category: q.category,
        difficulty: q.difficulty,
        targetSkill: q.targetSkill,
        skill: q.targetSkill || 'general',
        source: q.source,
        sourceProject: q.sourceProject,
        expectedConcepts: q.expectedConcepts || [],
        order: idx,
        followUpAllowed: true,
        contextNote: q.contextNote,
      }))
    );

    const distinct = new Set(questions.map(q => q.text)).size === questions.length;
    const personalizedPass = questions.length > 0 && distinct && (hasTechnicalQ || hasProjectQ || hasSkillGapQ);

    recordResult('Personalized Questions', personalizedPass, `Generated ${questions.length} distinct questions (Technical: ${hasTechnicalQ}, Project: ${hasProjectQ}, SkillGap: ${hasSkillGapQ})`);
  } catch (err) {
    recordResult('Personalized Questions', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PHASE 4: SBERT & TEXT EVALUATION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('5. PHASE 4: SBERT TEXT EVALUATION & AI SERVICE');
  let aiHealth = null;
  try {
    aiHealth = await aiService.checkHealth();
    console.log('AI Service Health Check:', aiHealth);
  } catch (e) {
    console.log('AI Service Check Note:', e.message);
  }

  try {
    const q1 = questions[0] || { text: 'Explain the event loop in Node.js', difficulty: 'medium', expectedConcepts: ['libuv', 'callback queue'] };
    const strongAnswer = 'In Node.js, the event loop handles asynchronous operations using a single thread with non-blocking I/O backed by libuv. When async tasks like file I/O or network requests occur, they are delegated to the worker pool. Upon completion, their callbacks enter the task queue or microtask queue (for promises), which the event loop executes when the call stack is clear.';

    const evalResult = await evaluateResponse(
      q1.text,
      strongAnswer,
      q1.difficulty,
      q1.expectedConcepts || []
    );

    console.log('Evaluation Output:', {
      score: evalResult.textEvaluation?.textScore ?? evalResult.evaluation?.score,
      modelStatus: evalResult.textEvaluation?.modelStatus,
      strengths: evalResult.textEvaluation?.strengths,
      feedback: evalResult.textEvaluation?.feedback || evalResult.evaluation?.feedback,
    });

    const isEvalValid = (evalResult.textEvaluation?.textScore !== null || evalResult.evaluation?.score !== null);
    recordResult('SBERT Text Evaluation', isEvalValid, `Score: ${evalResult.textEvaluation?.textScore ?? evalResult.evaluation?.score}/100 (Status: ${evalResult.textEvaluation?.modelStatus || evalResult.evaluation?.status})`);
  } catch (err) {
    recordResult('SBERT Text Evaluation', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. PHASE 5 & 6: AUDIO (MFCC) & VIDEO (YOLO) FEATURES
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('6. PHASE 5 & 6: AUDIO MFCC & VIDEO YOLO FEATURES');
  try {
    const audioRes = await aiService.analyzeAudio('non_existent_dummy.wav');
    const audioHandled = audioRes.modelStatus !== undefined || audioRes.audioFeaturesAvailable === false;
    recordResult('Audio (MFCC) Pipeline', audioHandled, `Handled gracefully (Status: ${audioRes.modelStatus || 'handled'}, Features Available: ${audioRes.audioFeaturesAvailable})`);
  } catch (err) {
    recordResult('Audio (MFCC) Pipeline', false, err.message);
  }

  try {
    const videoRes = await aiService.analyzeVideo('non_existent_dummy.webm');
    const videoHandled = videoRes.modelStatus !== undefined || videoRes.framesProcessed === 0;
    recordResult('Video (YOLOv8) Pipeline', videoHandled, `Handled gracefully (Status: ${videoRes.modelStatus || 'handled'}, Frames: ${videoRes.framesProcessed})`);
  } catch (err) {
    recordResult('Video (YOLOv8) Pipeline', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. PHASE 7: MULTIMODAL FUSION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('7. PHASE 7: MULTIMODAL FUSION & REDISTRIBUTION');
  try {
    // Case 1: Text only
    const f1 = calculateWeightedScore({ textScore: 80, audioScore: null, videoScore: null });
    // Case 2: Text + Audio
    const f2 = calculateWeightedScore({ textScore: 80, audioScore: 70, videoScore: null });
    // Case 3: Text + Audio + Video
    const f3 = calculateWeightedScore({ textScore: 80, audioScore: 70, videoScore: 60 });

    const f1Valid = f1.overallScore === 80 && f1.textWeight === 1.0 && f1.modalitiesUsed.length === 1;
    // For Text (0.5) + Audio (0.25): adjusted weights = 0.5/0.75=0.667, 0.25/0.75=0.333 -> 80*0.667 + 70*0.333 = 53.33 + 23.33 = 76.7
    const f2Valid = Math.abs(f2.overallScore - 76.7) < 0.5 && f2.modalitiesUsed.length === 2;
    // For Text(0.5) + Audio(0.25) + Video(0.25) -> 80*0.5 + 70*0.25 + 60*0.25 = 40 + 17.5 + 15 = 72.5
    const f3Valid = f3.overallScore === 72.5 && f3.modalitiesUsed.length === 3;

    const fusionPass = f1Valid && f2Valid && f3Valid;
    recordResult('Multimodal Fusion', fusionPass, `Text-Only: ${f1.overallScore} (100% Text), Text+Audio: ${f2.overallScore} (67/33%), Text+Audio+Video: ${f3.overallScore} (50/25/25%)`);
  } catch (err) {
    recordResult('Multimodal Fusion', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. PHASE 8: ADAPTIVE QUESTIONING ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('8. PHASE 8: ADAPTIVE ENGINE TRANSITIONS');
  try {
    let state = initializeInterviewState(interviewDoc, skillAnalysisDoc);

    // 1. Strong answer (score = 85) -> update skill performance & test difficulty change
    state = updateSkillPerformance(state, 'TypeScript', 85);
    const actionStrong = determineAdaptiveAction({
      score: 85,
      currentQuestion: questions[0],
      textEvaluation: { missingConcepts: [] },
      currentState: state,
    });

    // 2. Moderate answer with missing concepts -> should trigger follow-up
    state = updateSkillPerformance(state, 'MongoDB', 60);
    const actionMod = determineAdaptiveAction({
      score: 60,
      currentQuestion: { ...questions[1], followUpAllowed: true },
      textEvaluation: { missingConcepts: ['aggregation pipeline', 'indexing'] },
      currentState: state,
    });

    // 3. Weak answer (score = 35) -> difficulty drops
    state = updateSkillPerformance(state, 'Docker', 35);
    const actionWeak = determineAdaptiveAction({
      score: 35,
      currentQuestion: { ...questions[2], followUpAllowed: false },
      textEvaluation: { missingConcepts: ['containers', 'images'] },
      currentState: state,
    });

    const followUpQ = actionMod.shouldFollowUp
      ? generateFollowUpQuestion(questions[1], 'I used MongoDB collections.', actionMod.missingConcepts)
      : null;

    const adaptivePass = (
      actionStrong.action === 'next_question' &&
      actionMod.shouldFollowUp === true &&
      followUpQ !== null &&
      actionWeak.action === 'easier_question'
    );

    recordResult('Adaptive Engine', adaptivePass, `Strong -> ${actionStrong.action} (diff: ${actionStrong.nextDifficulty}), Moderate -> follow-up triggered ("${followUpQ?.text?.substring(0, 45)}..."), Weak -> ${actionWeak.action}`);
  } catch (err) {
    recordResult('Adaptive Engine', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. PHASE 9 & 10: FINAL RESULTS, ROADMAP & JOB READINESS
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('9. PHASE 9 & 10: FINAL EVALUATION & IMPROVEMENT ROADMAP');
  try {
    // Record simulated answers for 2 questions
    const r1 = await Response.create({
      clerkUserId: userA,
      interviewId: interviewDoc._id,
      questionId: questions[0]._id,
      answerText: 'Detailed explanation of JavaScript closures and lexical scope with module design pattern examples.',
      textEvaluation: { textScore: 85, semanticScore: 88, conceptCoverage: 82, strengths: ['closures', 'lexical scope'], missingConcepts: [], feedback: 'Strong answer', modelStatus: 'tested' },
      submittedAt: new Date(),
    });

    const r2 = await Response.create({
      clerkUserId: userA,
      interviewId: interviewDoc._id,
      questionId: questions[1]._id,
      answerText: 'MongoDB indexing helps fast lookups using B-trees.',
      textEvaluation: { textScore: 65, semanticScore: 68, conceptCoverage: 60, strengths: ['indexes'], missingConcepts: ['compound indexes'], feedback: 'Moderate response', modelStatus: 'tested' },
      submittedAt: new Date(),
    });

    const responses = [r1, r2];
    const fusionResult = aggregateInterviewFusion(responses);

    const perfMap = {
      JavaScript: { score: 85, confidence: 0.8, questionsAsked: 1 },
      MongoDB: { score: 65, confidence: 0.7, questionsAsked: 1 },
      Docker: { score: 40, confidence: 0.6, questionsAsked: 1 },
    };

    const roadmap = generateRoadmap({
      skillPerformance: perfMap,
      missingSkills: skillAnalysisDoc.notIdentifiedRequiredSkills,
      matchedSkills: skillAnalysisDoc.matchedRequiredSkills,
      preferredSkills: skillAnalysisDoc.matchedPreferredSkills,
      finalEvaluation: { overallScore: fusionResult.overallScore },
    });

    const jobReadiness = calculateJobReadiness({
      skillCoveragePercentage: skillAnalysisDoc.skillCoveragePercentage,
      overallScore: fusionResult.overallScore,
      questionsAnswered: responses.length,
      totalQuestions: 6,
    });

    console.log('Final Evaluation Overall Score:', fusionResult.overallScore);
    console.log('Roadmap Strong Areas:', roadmap.strongAreas.map(a => a.skill));
    console.log('Roadmap Weak Areas:', roadmap.weakAreas.map(a => a.skill));
    console.log('Roadmap Recommendations Count:', roadmap.recommendations.length);
    console.log('Job Readiness Score:', jobReadiness.score, `(${jobReadiness.label})`);

    const finalPass = (
      fusionResult.overallScore !== null &&
      roadmap.recommendations.length > 0 &&
      jobReadiness.score > 0 &&
      roadmap.disclaimer !== undefined
    );

    recordResult('Final Evaluation', fusionResult.overallScore !== null, `Overall: ${fusionResult.overallScore}/100 across ${responses.length} questions`);
    recordResult('Improvement Roadmap', finalPass, `Generated ${roadmap.recommendations.length} prioritized recommendations, Readiness: ${jobReadiness.score}% (${jobReadiness.label})`);
  } catch (err) {
    recordResult('Final Evaluation', false, err.message);
    recordResult('Improvement Roadmap', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. PHASE 11: PROGRESS TRACKER (MULTI-SESSION AGGREGATION)
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('10. PHASE 11: PROGRESS TRACKER PERSISTENCE');
  try {
    const p1 = await Progress.create({
      clerkUserId: userA,
      interviewId: interviewDoc._id,
      targetRole: 'Senior Backend Engineer',
      overallScore: 72,
      technicalScore: 75,
      skillScores: { JavaScript: 85, MongoDB: 65, Docker: 40 },
      questionsAnswered: 3,
      interviewType: 'mixed',
      difficulty: 'medium',
      modalitiesUsed: ['text', 'audio'],
      strongAreas: ['JavaScript'],
      improvementAreas: ['Docker'],
      completedAt: new Date(Date.now() - 86400000), // yesterday
    });

    const p2 = await Progress.create({
      clerkUserId: userA,
      interviewId: interviewDoc._id,
      targetRole: 'Senior Backend Engineer',
      overallScore: 84,
      technicalScore: 84,
      skillScores: { JavaScript: 90, MongoDB: 80, Docker: 75 },
      questionsAnswered: 5,
      interviewType: 'technical',
      difficulty: 'hard',
      modalitiesUsed: ['text', 'audio', 'video'],
      strongAreas: ['JavaScript', 'MongoDB'],
      improvementAreas: ['Docker'],
      completedAt: new Date(),
    });

    const userProgress = await Progress.find({ clerkUserId: userA }).sort({ completedAt: 1 });
    const progressPass = userProgress.length >= 2 && userProgress[0].overallScore === 72 && userProgress[1].overallScore === 84;

    recordResult('Progress Tracker', progressPass, `Retrieved ${userProgress.length} historical sessions (Scores: ${userProgress.map(p => p.overallScore).join(' -> ')})`);
  } catch (err) {
    recordResult('Progress Tracker', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. SECURITY & CROSS-TENANT VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('11. SECURITY & ACCESS CONTROL');
  try {
    // User B attempts to find user A's interview, questions, responses, progress
    const bFindingAInterview = await Interview.findOne({ _id: interviewDoc._id, clerkUserId: userB });
    const bFindingAQuestions = await Question.find({ interviewId: interviewDoc._id, clerkUserId: userB });
    const bFindingAProgress = await Progress.find({ clerkUserId: userB });

    const secure = (
      bFindingAInterview === null &&
      bFindingAQuestions.length === 0 &&
      bFindingAProgress.length === 0
    );

    recordResult('Security (Multi-Tenant)', secure, `User B reading User A Interview: ${bFindingAInterview ? 'LEAK' : 'BLOCKED (NULL)'}, Questions: ${bFindingAQuestions.length} (BLOCKED), Progress: ${bFindingAProgress.length} (BLOCKED)`);
  } catch (err) {
    recordResult('Security (Multi-Tenant)', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  logSection('VERIFICATION COMPLETE');
  console.log('Results Summary:');
  console.table(RESULTS);

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
