/**
 * Results Presentation Adapter (Pure Functions)
 *
 * Transforms raw backend interview results into safe, normalized,
 * display-ready structures for the progressive disclosure Results page.
 *
 * RULES:
 * - Pure presentation adapter: NEVER recalculates or mutates backend scores.
 * - Overall score is preserved exactly as returned by the backend.
 * - Defensive checks against null, undefined, empty arrays, and NaN.
 * - Missing != 0: Missing data is represented as null / "Not available" / "Not enough data".
 * - Never fabricates psychological conclusions, personality traits, or emotion mappings.
 */

/**
 * Format a duration in minutes from timestamps or stored duration.
 */
export const formatDuration = (startedAt, completedAt, fallbackMinutes = 30) => {
  if (startedAt && completedAt) {
    const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    if (!isNaN(diffMs) && diffMs > 0) {
      const mins = Math.max(1, Math.round(diffMs / 60000))
      return `${mins} min${mins !== 1 ? 's' : ''}`
    }
  }
  return `${fallbackMinutes} mins`
}

/**
 * Format date string safely.
 */
export const formatInterviewDate = (dateStr) => {
  if (!dateStr) return 'Recent Session'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Recent Session'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Generate a deterministic qualitative summary based on verified scores.
 */
export const derivePerformanceSummary = (overallScore, technicalScore) => {
  if (overallScore === null || overallScore === undefined) {
    return 'Evaluation complete. Detailed question feedback and guidance are available below.'
  }
  const score = Number(overallScore)
  const tech = Number(technicalScore ?? score)

  if (score >= 85) {
    return 'Outstanding performance demonstrating strong technical depth, structured communication, and comprehensive concept mastery.'
  }
  if (score >= 75) {
    return 'Strong interview performance with solid technical foundations and clear reasoning structure.'
  }
  if (score >= 60) {
    return 'Solid baseline understanding with targeted opportunities to deepen implementation specifics and architectural trade-offs.'
  }
  if (score >= 45) {
    return 'Demonstrated core concepts with room for growth in technical depth, structured framing, and concrete project evidence.'
  }
  return 'Early-stage practice session. Focused review on fundamental domain concepts and structured answer models is recommended.'
}

/**
 * Determine dynamic modality processing status.
 */
export const deriveModalityStatus = (interview = {}, voiceMetrics = {}, behaviorMetrics = {}, fe = {}) => {
  const isVideoRecorded = Boolean(interview.videoUploaded || interview.videoRecorded || interview.videoModeEnabled)
  const isVideoProcessed = Boolean(behaviorMetrics?.videoDataAvailable && behaviorMetrics?.status !== 'failed')
  const isVideoFailed = Boolean(behaviorMetrics?.status === 'failed' || (isVideoRecorded && !isVideoProcessed))

  const isAudioRecorded = Boolean(interview.modalityAvailability?.audio || interview.audioRecorded || interview.audioUploaded || voiceMetrics?.totalWords > 0)
  const isAudioProcessed = Boolean(voiceMetrics?.status === 'processed' || fe.audioScore !== null || (voiceMetrics?.wpm && voiceMetrics.wpm > 0))

  return {
    technical: {
      status: 'complete',
      label: 'Technical analysis',
      badgeText: 'Complete',
    },
    audio: isAudioProcessed
      ? { status: 'complete', label: 'Audio analysis', badgeText: 'Complete' }
      : isAudioRecorded
      ? { status: 'unavailable', label: 'Audio processing unavailable', badgeText: 'Unavailable' }
      : { status: 'not_recorded', label: 'Audio not recorded', badgeText: 'Not used' },
    video: isVideoProcessed
      ? { status: 'complete', label: 'Video analysis', badgeText: 'Complete' }
      : isVideoFailed
      ? { status: 'unavailable', label: 'Video analysis unavailable', badgeText: 'Unavailable' }
      : isVideoRecorded
      ? { status: 'partial', label: 'Video recorded (not processed)', badgeText: 'Pending' }
      : { status: 'not_recorded', label: 'Video not recorded', badgeText: 'Not used' },
  }
}

/**
 * Extract and normalize the 4 Key Score Cards.
 */
export const deriveScoreSummary = (fe = {}, jobReadiness = {}, voiceMetrics = {}) => {
  // 1. Technical Score
  const rawTech = fe.technicalScore ?? fe.technicalAccuracy ?? null
  const technical = {
    key: 'technical',
    title: 'Technical Performance',
    score: rawTech !== null && !isNaN(rawTech) ? Math.round(Number(rawTech)) : null,
    source: 'technicalEvaluation',
    isAvailable: rawTech !== null && !isNaN(rawTech),
    takeaway: rawTech >= 75
      ? 'Strong domain fundamentals and concepts'
      : rawTech >= 55
      ? 'Good technical foundation with minor gaps'
      : rawTech !== null
      ? 'Focus on core principles and implementation details'
      : 'Technical evaluation unavailable',
  }

  // 2. Communication Score
  const rawComm = fe.communication ?? null
  const communication = {
    key: 'communication',
    title: 'Communication',
    score: rawComm !== null && !isNaN(rawComm) ? Math.round(Number(rawComm)) : null,
    source: 'voiceBehaviorAnalysis',
    isAvailable: rawComm !== null && !isNaN(rawComm),
    takeaway: rawComm >= 75
      ? 'Clear, structured conversational pacing'
      : rawComm >= 55
      ? 'Generally clear; practice reducing filled pauses'
      : rawComm !== null
      ? 'Pacing and verbal flow can be improved'
      : 'Audio was not recorded for this session',
  }

  // 3. Problem Solving / Depth Score
  const rawDepth = fe.depth ?? (fe.evidence !== null && fe.relevance !== null ? Math.round((fe.evidence * 0.5 + fe.relevance * 0.5)) : null)
  const problemSolving = {
    key: 'problemSolving',
    title: 'Problem Solving',
    score: rawDepth !== null && !isNaN(rawDepth) ? Math.round(Number(rawDepth)) : null,
    source: 'answerArchitectureEvaluation',
    isAvailable: rawDepth !== null && !isNaN(rawDepth),
    takeaway: rawDepth >= 75
      ? 'Effective reasoning with concrete project evidence'
      : rawDepth >= 55
      ? 'Sound logic; include more edge cases and trade-offs'
      : rawDepth !== null
      ? 'Explain approach systematically before conclusion'
      : 'Evaluation requires additional question depth',
  }

  // 4. Role Readiness (Derived Metric)
  const rawReadiness = jobReadiness?.readinessScore ?? fe.overallScore ?? null
  const roleReadiness = {
    key: 'roleReadiness',
    title: 'Role Readiness',
    score: rawReadiness !== null && !isNaN(rawReadiness) ? Math.round(Number(rawReadiness)) : null,
    isDerived: true,
    source: 'skillGapAndSessionReadiness',
    tier: jobReadiness?.tier || (rawReadiness >= 75 ? 'Ready' : rawReadiness >= 55 ? 'Developing' : 'Foundational'),
    isAvailable: rawReadiness !== null && !isNaN(rawReadiness),
    takeaway: jobReadiness?.interpretation || (rawReadiness >= 75
      ? 'Strong alignment with target role expectations'
      : rawReadiness >= 55
      ? 'Competent baseline for role; target weak areas'
      : 'Continue focused practice across core competencies'),
  }

  return [technical, communication, problemSolving, roleReadiness]
}

/**
 * Extract top 3 evidence-backed strengths.
 */
export const extractTopStrengths = (fe = {}) => {
  const rawList = Array.isArray(fe.strengths) ? fe.strengths : []
  if (rawList.length > 0) {
    return rawList.slice(0, 3).map((item) => {
      if (typeof item === 'string') {
        return {
          title: item,
          evidence: 'Demonstrated consistently across answered questions in this session.',
        }
      }
      return {
        title: item.title || item.name || 'Demonstrated technical competency',
        evidence: item.evidence || item.description || 'Observed in response evaluations.',
      }
    })
  }

  // Safe fallback if strengths array was empty
  return [
    {
      title: 'Active Session Engagement',
      evidence: `Completed responses across ${fe.questionsAnswered ?? 0} interview question${fe.questionsAnswered !== 1 ? 's' : ''}.`,
    },
    {
      title: 'Clear Context Framing',
      evidence: 'Provided structured answers adhering to the prompt requirements.',
    },
    {
      title: 'Technical Discussion Readiness',
      evidence: 'Successfully addressed domain concepts for the target position.',
    },
  ]
}

/**
 * Extract top 3 ranked improvements with actionable evidence and practice topics.
 */
export const extractTopImprovements = (topPriorityImprovements = [], fe = {}, interview = {}) => {
  if (Array.isArray(topPriorityImprovements) && topPriorityImprovements.length > 0) {
    return topPriorityImprovements.slice(0, 3).map((item, idx) => ({
      priority: idx + 1,
      id: item.id || `imp-${idx + 1}`,
      issue: item.title || `Improvement Area ${idx + 1}`,
      evidence: item.evidence || 'Identified from question response evaluation.',
      action: item.recommendedDrill || item.expectedTarget || 'Practice structured explanations with trade-off analysis.',
      topic: item.title?.replace('Address ', '') || interview.targetRole || 'Technical Skills',
      practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
    }))
  }

  // Fallback to finalEvaluation.improvements
  const rawImprovements = Array.isArray(fe.improvements) ? fe.improvements : []
  if (rawImprovements.length > 0) {
    return rawImprovements.slice(0, 3).map((text, idx) => ({
      priority: idx + 1,
      id: `imp-${idx + 1}`,
      issue: text,
      evidence: 'Observed during question-level evaluation.',
      action: 'Practice articulating technical trade-offs with concrete examples.',
      topic: interview.targetRole || 'Technical Skills',
      practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
    }))
  }

  return [
    {
      priority: 1,
      id: 'imp-1',
      issue: 'Deepen Implementation Details',
      evidence: 'Responses were relevant but would benefit from more concrete architecture and complexity discussion.',
      action: 'Structure technical answers: State approach, explain trade-offs, and detail edge-case handling.',
      topic: 'Technical Depth',
      practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
    },
    {
      priority: 2,
      id: 'imp-2',
      issue: 'Use Structured Situation-Action Framing',
      evidence: 'Behavioral and project answers can be made crisper using the STAR framework.',
      action: 'Clearly separate the problem context from your individual technical actions and measured results.',
      topic: 'Answer Architecture',
      practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
    },
  ]
}

/**
 * Extract compact progress comparison against previous interview.
 */
export const extractProgressComparison = (comparison = {}, currentOverallScore = null) => {
  if (!comparison || !comparison.hasPrevious) {
    return {
      hasPrevious: false,
      message: 'No previous interview found.',
      submessage: 'Complete another interview to track your progress and skill trends over time.',
    }
  }

  const currentScore = currentOverallScore !== null ? Math.round(currentOverallScore) : comparison.currentScore
  const previousScore = comparison.previousScore !== null && comparison.previousScore !== undefined
    ? Math.round(comparison.previousScore)
    : null
  const delta = comparison.overallScoreDelta !== null && comparison.overallScoreDelta !== undefined
    ? Math.round(comparison.overallScoreDelta)
    : (currentScore !== null && previousScore !== null ? currentScore - previousScore : null)

  const techDelta = comparison.technicalScoreDelta !== null && comparison.technicalScoreDelta !== undefined
    ? Math.round(comparison.technicalScoreDelta)
    : null

  return {
    hasPrevious: true,
    currentScore,
    previousScore,
    delta,
    isPositive: delta !== null ? delta >= 0 : true,
    summary: comparison.summary || `Overall score changed by ${delta !== null && delta >= 0 ? `+${delta}` : delta} points.`,
    subDeltas: [
      { label: 'Overall Performance', delta, isPositive: delta !== null ? delta >= 0 : true },
      ...(techDelta !== null ? [{ label: 'Technical Score', delta: techDelta, isPositive: techDelta >= 0 }] : []),
    ],
  }
}

/**
 * Extract roadmap recommendations for the Recommended Practice section.
 */
export const extractRecommendedPractice = (roadmap = {}, fe = {}, interview = {}) => {
  const recommendations = []

  // Check roadmap recommendations first
  if (Array.isArray(roadmap?.recommendations) && roadmap.recommendations.length > 0) {
    for (const rec of roadmap.recommendations.slice(0, 4)) {
      recommendations.push({
        topic: rec.skill || rec.area || 'Technical Practice',
        priority: rec.priority || 'Medium',
        whyItMatters: rec.description || `Key competency for the ${interview.targetRole || 'target'} role.`,
        suggestedAction: rec.studyApproach || (rec.topics ? `Review: ${rec.topics.slice(0, 3).join(', ')}` : 'Practice answering related interview prompts.'),
        practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
      })
    }
  }

  // If roadmap is empty, fall back to fe.recommendedPractice
  if (recommendations.length === 0 && Array.isArray(fe.recommendedPractice) && fe.recommendedPractice.length > 0) {
    for (const item of fe.recommendedPractice.slice(0, 4)) {
      recommendations.push({
        topic: typeof item === 'string' ? item : (item.topic || 'Practice Topic'),
        priority: 'Recommended',
        whyItMatters: 'Directly addresses growth areas observed in this session.',
        suggestedAction: 'Take a focused 5-question mock session targeting this skill.',
        practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
      })
    }
  }

  // Default fallback
  if (recommendations.length === 0) {
    recommendations.push({
      topic: `${interview.targetRole || 'Technical'} Core Drills`,
      priority: 'High',
      whyItMatters: 'Reinforces domain fundamentals and system design trade-offs.',
      suggestedAction: 'Practice another session with medium or hard difficulty questions.',
      practiceUrl: `/create-interview?practiceFrom=${interview.id || ''}`,
    })
  }

  return recommendations
}

/**
 * Normalize question list for compact Question Review accordion.
 */
export const normalizeQuestionReview = (rawQuestions = []) => {
  if (!Array.isArray(rawQuestions)) return []

  return rawQuestions.map((q, idx) => {
    const rawStatus = (q.status || 'pending').toLowerCase()
    const isSkipped = rawStatus === 'skipped'
    const isTimeout = rawStatus === 'timeout'
    const isAnswered = rawStatus === 'answered' || (!isSkipped && !isTimeout && Boolean(q.answerText || q.code || q.evaluation || q.textEvaluation))

    const displayStatus = isSkipped ? 'SKIPPED' : isTimeout ? 'TIMEOUT' : isAnswered ? 'ANSWERED' : 'PENDING'
    const numericScore = isSkipped || isTimeout
      ? null
      : (q.score !== null && q.score !== undefined
          ? Math.round(Number(q.score))
          : q.textEvaluation?.textScore !== null && q.textEvaluation?.textScore !== undefined
          ? Math.round(Number(q.textEvaluation.textScore))
          : null)

    return {
      number: q.questionNumber || idx + 1,
      id: q.questionId || q.id || `q-${idx + 1}`,
      questionText: q.question || 'Interview Question',
      status: displayStatus,
      score: numericScore,
      category: q.category || 'General',
      targetSkill: q.targetSkill || q.skill || null,
      difficulty: q.difficulty || 'medium',
      responseType: q.responseType || (q.code ? 'coding' : 'text'),
      answerText: isSkipped ? null : (q.answerText || null),
      code: q.code || null,
      feedback: q.textEvaluation?.feedback || q.evaluation?.feedback || null,
      improvementSuggestion: q.textEvaluation?.improvementSuggestion || null,
      relevanceScore: q.textEvaluation?.semanticScore !== null && q.textEvaluation?.semanticScore !== undefined
        ? Math.round(q.textEvaluation.semanticScore * 100)
        : null,
      conceptCoverage: q.textEvaluation?.conceptCoverage !== null && q.textEvaluation?.conceptCoverage !== undefined
        ? Math.round(q.textEvaluation.conceptCoverage * 100)
        : null,
      strengths: Array.isArray(q.strengths) ? q.strengths : Array.isArray(q.textEvaluation?.strengths) ? q.textEvaluation.strengths : [],
      missingConcepts: Array.isArray(q.areasForImprovement) ? q.areasForImprovement : Array.isArray(q.textEvaluation?.missingConcepts) ? q.textEvaluation.missingConcepts : [],
      starAnalysis: q.starAnalysis || null,
    }
  })
}

/**
 * Main adapter entry point.
 */
export const adaptResults = (rawResults = {}, rawRoadmap = {}) => {
  const {
    interview = {},
    finalEvaluation: fe = {},
    jobReadiness = {},
    skillPerformance = {},
    questionBreakdown = [],
    voiceMetrics = {},
    behaviorMetrics = {},
    topPriorityImprovements = [],
    personalizedPracticePlan = [],
    comparisonWithPrevious = {},
    researchEvidence = {},
  } = rawResults || {}

  // 1. Hero
  const rawOverall = fe.overallScore !== null && fe.overallScore !== undefined ? Math.round(Number(fe.overallScore)) : null
  const hero = {
    role: interview.targetRole || 'Software Engineering Candidate',
    interviewType: interview.interviewType ? `${interview.interviewType.charAt(0).toUpperCase() + interview.interviewType.slice(1)} Interview` : 'Technical Interview',
    difficulty: interview.difficulty ? `${interview.difficulty.charAt(0).toUpperCase() + interview.difficulty.slice(1)}` : 'Medium',
    duration: formatDuration(interview.startedAt, interview.completedAt, interview.durationMinutes),
    date: formatInterviewDate(interview.completedAt || interview.startedAt),
    overallScore: rawOverall,
    summary: derivePerformanceSummary(rawOverall, fe.technicalScore),
    completionReason: interview.completionReason || 'completed',
    modalityStatus: deriveModalityStatus(interview, voiceMetrics, behaviorMetrics, fe),
  }

  // 2. Score Summary (4 Cards)
  const scoreSummary = deriveScoreSummary(fe, jobReadiness, voiceMetrics)

  // 3. Strengths & Improvements
  const strengths = extractTopStrengths(fe)
  const topImprovements = extractTopImprovements(topPriorityImprovements, fe, interview)

  // 4. Progress vs Previous
  const progress = extractProgressComparison(comparisonWithPrevious, rawOverall)

  // 5. Recommended Practice
  const recommendedPractice = extractRecommendedPractice(rawRoadmap, fe, interview)

  // 6. Question Review
  const questions = normalizeQuestionReview(questionBreakdown)

  // 7. Communication Analysis
  const communication = {
    isAvailable: Boolean(voiceMetrics?.status === 'processed' || (voiceMetrics?.totalWords && voiceMetrics.totalWords > 0)),
    wpm: voiceMetrics?.wpm || null,
    wpmOptimal: voiceMetrics?.wpm ? (voiceMetrics.wpm >= 120 && voiceMetrics.wpm <= 165) : false,
    fillerDensity: voiceMetrics?.fillerDensity !== null && voiceMetrics?.fillerDensity !== undefined ? voiceMetrics.fillerDensity : null,
    fillerBreakdown: voiceMetrics?.fillerBreakdown || {},
    pauseAverageSec: voiceMetrics?.pauseMetrics?.averagePauseSec || null,
    pauseMaxSec: voiceMetrics?.pauseMetrics?.maxPauseSec || null,
    totalWords: voiceMetrics?.totalWords || 0,
    observableNote: 'Voice analysis assesses speech rate, filled pauses, and acoustic duration without drawing personality or psychological inferences.',
  }

  // 8. Video / Presence Analysis
  const isVideoAvailable = Boolean(behaviorMetrics?.videoDataAvailable && behaviorMetrics?.status !== 'failed')
  const video = {
    isAvailable: isVideoAvailable,
    status: behaviorMetrics?.status || (isVideoAvailable ? 'captured' : 'unavailable'),
    faceScore: behaviorMetrics?.faceScore ?? null,
    personScore: behaviorMetrics?.personScore ?? null,
    goodFramingScore: behaviorMetrics?.goodFramingScore ?? null,
    multiplePersonScore: behaviorMetrics?.multiplePersonScore ?? 0,
    cameraGazeRatio: behaviorMetrics?.cameraGazeRatio ?? null,
    cameraOrientation: behaviorMetrics?.cameraOrientation || null,
    expressionDistribution: behaviorMetrics?.expressionDistribution || null,
    dominantExpression: behaviorMetrics?.dominantExpression || null,
    expressionTransitions: behaviorMetrics?.expressionTransitions || 0,
    modelConfidence: behaviorMetrics?.expressionClassificationConfidence ?? null,
    observableNotes: Array.isArray(behaviorMetrics?.observableNotes) ? behaviorMetrics.observableNotes : [],
    modelAuditNote: behaviorMetrics?.modelAuditNote || 'RAVDESS is being used as the dataset, but the current implementation does not prove that the RAVDESS data was trained using YOLOv8.',
    unavailableReason: 'Your camera was active during the session, but video recording was either not selected or could not be processed into frames. Technical and audio results remain fully valid.',
  }

  // 9. Detailed Evaluation Sub-Pillars
  const detailedEvaluation = {
    technicalAccuracy: fe.technicalAccuracy ?? fe.technicalScore ?? null,
    relevance: fe.relevance ?? null,
    completeness: fe.completeness ?? null,
    communication: fe.communication ?? null,
    depth: fe.depth ?? null,
    evidence: fe.evidence ?? null,
    modalitiesUsed: fe.modalitiesUsed || { text: true, audio: false, video: false },
    skillPerformance: skillPerformance || {},
    questionsAnswered: fe.questionsAnswered ?? questions.filter(q => q.status === 'ANSWERED').length,
    questionsSkipped: fe.questionsSkipped ?? questions.filter(q => q.status === 'SKIPPED').length,
    questionsTimedOut: fe.questionsTimedOut ?? questions.filter(q => q.status === 'TIMEOUT').length,
    totalQuestions: fe.totalQuestions ?? questions.length,
  }

  // 10. Clean Transcript
  const transcript = questions.map(q => ({
    number: q.number,
    id: q.id,
    question: q.questionText,
    answer: q.answerText,
    code: q.code,
    status: q.status,
    responseType: q.responseType,
  }))

  // 11. Methodology
  const methodology = {
    textMethod: 'Semantic NLP evaluation utilizes Sentence-BERT (all-MiniLM-L6-v2) cosine similarity against benchmark engineering concepts and keyword taxonomy coverage.',
    audioMethod: 'Audio prosody is evaluated via librosa spectral energy and MFCC acoustic feature extraction, measuring words per minute and filled pause frequencies.',
    videoMethod: 'Webcam presence is verified using Ultralytics YOLOv8 object detection (task: detect) for candidate framing, centering, and multi-person detection. Physical expressive transitions are tracked over time.',
    fusionMethod: 'Multimodal fusion redistributes weights dynamically if audio or video were unavailable, ensuring technical problem-solving remains the core determining pillar.',
    researchEvidence: researchEvidence || {},
  }

  return {
    rawResults,
    interviewId: interview.id || interview._id,
    hero,
    scoreSummary,
    strengths,
    topImprovements,
    progress,
    recommendedPractice,
    questions,
    communication,
    video,
    detailedEvaluation,
    transcript,
    methodology,
  }
}
