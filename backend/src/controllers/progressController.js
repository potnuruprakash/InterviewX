const Progress = require('../models/Progress');
const Interview = require('../models/Interview');
const { sendError, sendSuccess } = require('../utils/errorHandler');

/**
 * GET /api/progress
 * Get all progress records for the authenticated user.
 */
const getUserProgress = async (req, res) => {
  try {
    const [progress, totalInterviewsCount] = await Promise.all([
      Progress.find({ clerkUserId: req.clerkUserId })
        .sort({ completedAt: -1 })
        .limit(50)
        .populate('interviewId', 'targetRole interviewType difficulty'),
      Interview.countDocuments({ clerkUserId: req.clerkUserId }),
    ]);

    // Build trend data for charts
    const trend = progress
      .slice()
      .reverse()
      .map((p, index) => ({
        attempt: index + 1,
        score: p.overallScore,
        role: p.targetRole,
        date: p.completedAt,
        questionsAnswered: p.questionsAnswered,
        interviewType: p.interviewType,
        isDevelopmentEvaluation: p.isDevelopmentEvaluation,
      }));

    const latestScore = progress.length > 0 ? progress[0].overallScore : null;
    const bestScore = progress.length > 0 ? Math.max(...progress.map((p) => p.overallScore || 0)) : null;
    const totalInterviews = Math.max(totalInterviewsCount, progress.length);

    return sendSuccess(res, {
      progress: progress.map((p) => ({
        id: p._id,
        interviewId: p.interviewId?._id,
        targetRole: p.targetRole,
        overallScore: p.overallScore,
        technicalScore: p.technicalScore,
        questionsAnswered: p.questionsAnswered,
        interviewType: p.interviewType,
        difficulty: p.difficulty,
        isDevelopmentEvaluation: p.isDevelopmentEvaluation,
        modalitiesUsed: p.modalitiesUsed,
        strongAreas: p.strongAreas,
        improvementAreas: p.improvementAreas,
        skillGaps: p.skillGaps,
        skillScores: p.skillScores ? Object.fromEntries(p.skillScores) : {},
        completedAt: p.completedAt,
      })),
      summary: {
        totalInterviews,
        totalCompleted: progress.length,
        latestScore,
        bestScore,
        trend,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'PROGRESS_FETCH_FAILED', 'Could not retrieve progress.', error.message);
  }
};

module.exports = { getUserProgress };
