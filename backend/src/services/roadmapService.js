/**
 * Improvement Roadmap Service (Phase 10)
 *
 * Generates personalized improvement recommendations based on:
 *   - Interview performance scores per skill
 *   - Skill gap analysis (required skills not in resume)
 *   - JD importance (required vs preferred)
 *   - Strong areas to reinforce
 *
 * IMPORTANT:
 *   - Does NOT fabricate learning resources
 *   - Uses general guidance only
 *   - Labels as prototype/experimental metric
 */

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  STRONG: 75,
  WEAK: 50,
  JD_REQUIRED_WEIGHT: 1.5,
  JD_PREFERRED_WEIGHT: 1.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL GUIDANCE (no fabricated URLs)
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_GUIDANCE = {
  react: {
    topics: ['React hooks (useState, useEffect, useContext)', 'Component composition', 'State management (Redux, Zustand, Context API)', 'React performance optimization', 'Testing with React Testing Library'],
    studyApproach: 'Build 2-3 small React projects focusing specifically on state management patterns.',
  },
  javascript: {
    topics: ['Event loop and async/await', 'Closures and scope', 'Prototypal inheritance', 'ES6+ features', 'Browser APIs'],
    studyApproach: 'Practice implementing common algorithms in JavaScript and review MDN documentation for core concepts.',
  },
  python: {
    topics: ['Python generators and iterators', 'Decorators and context managers', 'List comprehensions', 'OOP in Python', 'Standard library (asyncio, collections, functools)'],
    studyApproach: 'Complete Python exercises on real data manipulation tasks and study the official Python documentation.',
  },
  docker: {
    topics: ['Docker images and containers', 'Dockerfile best practices', 'Docker Compose for multi-service apps', 'Docker networking', 'Volume management'],
    studyApproach: 'Containerize an existing project step-by-step. Practice writing Dockerfiles and docker-compose.yml files.',
  },
  kubernetes: {
    topics: ['Pods, Deployments, Services', 'ConfigMaps and Secrets', 'Namespaces and RBAC', 'Ingress controllers', 'kubectl commands'],
    studyApproach: 'Set up a local Kubernetes cluster with Minikube and deploy a sample application.',
  },
  sql: {
    topics: ['Query optimization and EXPLAIN', 'Joins (INNER, LEFT, RIGHT, FULL)', 'Indexes and covering indexes', 'Transactions and ACID properties', 'Window functions'],
    studyApproach: 'Practice SQL on real datasets. Focus on writing complex queries and analyzing query plans.',
  },
  mongodb: {
    topics: ['Document data modeling', 'Aggregation pipeline', 'Indexes and performance', 'Mongoose schema design', 'Transactions in MongoDB'],
    studyApproach: 'Design schemas for 3 different types of applications and practice the aggregation pipeline with sample data.',
  },
  aws: {
    topics: ['Core services: EC2, S3, Lambda, RDS, IAM', 'Architecture best practices', 'Cost optimization', 'Security groups and VPCs', 'CloudFormation basics'],
    studyApproach: 'Complete the AWS Cloud Practitioner fundamentals and build a simple serverless application.',
  },
  'system design': {
    topics: ['Scalability patterns', 'Load balancing', 'Caching strategies', 'Database sharding', 'Microservices vs monolith'],
    studyApproach: 'Study 5-10 system design case studies. Practice designing systems from scratch in 30-minute sessions.',
  },
  'machine learning': {
    topics: ['Supervised vs unsupervised learning', 'Model evaluation metrics', 'Feature engineering', 'Bias-variance trade-off', 'Common algorithms (regression, trees, SVMs)'],
    studyApproach: 'Implement ML pipelines on public datasets using scikit-learn. Focus on understanding each step.',
  },
  git: {
    topics: ['Branching strategies (GitFlow, trunk-based)', 'Merge vs rebase', 'Interactive rebase', 'Git hooks', 'Resolving conflicts'],
    studyApproach: 'Practice git workflows in a team environment. Set up a sample project with a defined branching strategy.',
  },
  testing: {
    topics: ['Unit testing principles', 'Integration testing', 'Mocking and stubbing', 'Test-Driven Development (TDD)', 'CI/CD integration'],
    studyApproach: 'Add comprehensive tests to an existing project. Aim for 80%+ coverage with meaningful tests.',
  },
};

const getSkillGuidance = (skill) => {
  const key = skill.toLowerCase().trim();
  for (const [guidanceKey, guidance] of Object.entries(SKILL_GUIDANCE)) {
    if (key.includes(guidanceKey) || guidanceKey.includes(key)) return guidance;
  }
  return {
    topics: [`${skill} fundamentals`, `${skill} best practices`, `${skill} in production`, 'Common interview questions'],
    studyApproach: `Review core ${skill} concepts, build a small project using ${skill}, and practice explaining your implementation decisions.`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

const calculatePriority = (skill, score, isRequired, isSkillGap) => {
  let priorityScore = 0;

  // Performance factor
  if (score < THRESHOLDS.WEAK) priorityScore += 3;
  else if (score < THRESHOLDS.STRONG) priorityScore += 1;

  // JD importance factor
  if (isRequired) priorityScore += 2;
  else priorityScore += 1;

  // Skill gap factor
  if (isSkillGap) priorityScore += 2;

  if (priorityScore >= 5) return 'High';
  if (priorityScore >= 3) return 'Medium';
  return 'Low';
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROADMAP GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a personalized improvement roadmap.
 *
 * @param {Object} params
 * @param {Object} params.skillPerformance    - Map of skill → { score, confidence, questionsAsked }
 * @param {Array}  params.missingSkills       - Required skills not in resume
 * @param {Array}  params.matchedSkills       - Required skills found in resume
 * @param {Array}  params.preferredSkills     - Preferred skills from JD
 * @param {Object} params.finalEvaluation     - Final interview evaluation
 * @returns {Object} Roadmap with strongAreas, weakAreas, skillGaps, recommendations
 */
const generateRoadmap = ({
  skillPerformance = {},
  missingSkills = [],
  matchedSkills = [],
  preferredSkills = [],
  finalEvaluation = {},
}) => {
  const strongAreas = [];
  const weakAreas = [];
  const recommendations = [];

  // ── 1. Analyze skill performance from interview ───────────────────────────
  for (const [skill, perf] of Object.entries(skillPerformance)) {
    const score = perf.score || 0;
    const isRequired = matchedSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase());

    if (score >= THRESHOLDS.STRONG) {
      strongAreas.push({ skill, score, questionsAsked: perf.questionsAsked });
    } else {
      weakAreas.push({ skill, score, questionsAsked: perf.questionsAsked });

      const guidance = getSkillGuidance(skill);
      const priority = calculatePriority(skill, score, isRequired, false);
      recommendations.push({
        skill,
        area: 'weak_performance',
        priority,
        description: `Demonstrated ${score < THRESHOLDS.WEAK ? 'weak' : 'moderate'} performance on ${skill} questions.`,
        topics: guidance.topics,
        studyApproach: guidance.studyApproach,
      });
    }
  }

  // ── 2. Skill gaps (not in resume, required by JD) ─────────────────────────
  const skillGaps = [];
  for (const skill of missingSkills) {
    // Check if we assessed it in the interview
    const perfEntry = Object.entries(skillPerformance).find(([s]) =>
      s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase())
    );

    const assessedScore = perfEntry ? perfEntry[1].score : null;
    skillGaps.push({
      skill,
      assessedScore,
      isAssessed: assessedScore !== null,
    });

    const guidance = getSkillGuidance(skill);
    const priority = calculatePriority(skill, assessedScore ?? 0, true, true);
    recommendations.push({
      skill,
      area: 'skill_gap',
      priority,
      description: `${skill} is required for this role but was not identified in the resume.`,
      topics: guidance.topics,
      studyApproach: guidance.studyApproach,
    });
  }

  // ── 3. Sort recommendations by priority ───────────────────────────────────
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // ── 4. Overall summary ────────────────────────────────────────────────────
  const overallScore = finalEvaluation.overallScore;
  let summary;
  if (!overallScore) {
    summary = 'Complete the interview to receive a personalized improvement roadmap.';
  } else if (overallScore >= 80) {
    summary = 'Strong overall performance. Focus on deepening expertise in weak areas and maintaining strengths.';
  } else if (overallScore >= 60) {
    summary = 'Moderate performance. Structured practice on weak skills and skill gaps will significantly improve your readiness.';
  } else {
    summary = 'Performance indicates significant growth areas. Systematic study of core concepts and consistent practice is recommended.';
  }

  return {
    summary,
    strongAreas,
    weakAreas,
    skillGaps,
    recommendations: recommendations.slice(0, 10), // Top 10 recommendations
    disclaimer: '⚠️ This roadmap is an experimental prototype metric based on interview performance indicators. It is not a validated hiring assessment.',
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Calculate job readiness indicator.
 *
 * Formula:
 *   Resume-JD alignment (40%)
 *   Interview technical performance (40%)
 *   Interview completion (20%)
 *
 * @param {Object} params
 * @returns {{ score: number, label: string, disclaimer: string }}
 */
const calculateJobReadiness = ({
  skillCoveragePercentage = 0,
  overallScore = 0,
  questionsAnswered = 0,
  totalQuestions = 10,
}) => {
  const completionRatio = Math.min(1, questionsAnswered / Math.max(totalQuestions, 1));

  const resumeAlignment = skillCoveragePercentage / 100;
  const interviewPerformance = overallScore / 100;
  const completionScore = completionRatio;

  const readinessScore = Math.round(
    (resumeAlignment * 0.4 + interviewPerformance * 0.4 + completionScore * 0.2) * 100
  );

  let label;
  if (readinessScore >= 80) label = 'Strong Candidate';
  else if (readinessScore >= 65) label = 'Promising Candidate';
  else if (readinessScore >= 50) label = 'Developing Candidate';
  else label = 'Needs Development';

  return {
    score: readinessScore,
    label,
    breakdown: {
      resumeAlignmentScore: Math.round(resumeAlignment * 100),
      interviewPerformanceScore: Math.round(interviewPerformance * 100),
      completionScore: Math.round(completionScore * 100),
    },
    disclaimer: '⚠️ This is an experimental prototype metric. It does not predict actual hiring outcomes and should not be used as a validated hiring assessment.',
  };
};

module.exports = {
  generateRoadmap,
  calculateJobReadiness,
  getSkillGuidance,
  THRESHOLDS,
};
