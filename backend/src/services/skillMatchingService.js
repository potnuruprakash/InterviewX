/**
 * Skill Matching Service — Phase 2
 *
 * Deterministic, explainable skill matching.
 * No SBERT. No embeddings. No LLM.
 *
 * Compares candidate canonical skill names against JD required/preferred skills.
 * Coverage is based ONLY on required skills.
 * Preferred skills are reported separately.
 */

/**
 * Match candidate skills against required and preferred JD skills.
 *
 * @param {Array<{ canonicalName: string }>} candidateSkills
 * @param {Array<{ canonicalName: string }>} requiredSkills
 * @param {Array<{ canonicalName: string }>} preferredSkills
 * @returns {Object} Matching result
 */
const matchSkills = (candidateSkills, requiredSkills, preferredSkills) => {
  // Build a set of candidate canonical skill names (lowercase for safety)
  const candidateSet = new Set(
    (candidateSkills || [])
      .filter((s) => s && s.canonicalName)
      .map((s) => s.canonicalName.toLowerCase().trim())
  );

  // Build sets for required and preferred
  const requiredCanonicals = (requiredSkills || [])
    .filter((s) => s && s.canonicalName)
    .map((s) => s.canonicalName);

  const preferredCanonicals = (preferredSkills || [])
    .filter((s) => s && s.canonicalName)
    .map((s) => s.canonicalName);

  // All JD skills (required + preferred) — for computing additionalSkills
  const allJDSkillSet = new Set([
    ...requiredCanonicals.map((s) => s.toLowerCase().trim()),
    ...preferredCanonicals.map((s) => s.toLowerCase().trim()),
  ]);

  // ── Required skill matching ──────────────────────────────────────
  const matchedRequiredSkills = [];
  const notIdentifiedRequiredSkills = [];

  for (const skill of requiredCanonicals) {
    if (candidateSet.has(skill.toLowerCase().trim())) {
      matchedRequiredSkills.push(skill);
    } else {
      notIdentifiedRequiredSkills.push(skill);
    }
  }

  // ── Preferred skill matching ─────────────────────────────────────
  const matchedPreferredSkills = [];
  const notIdentifiedPreferredSkills = [];

  for (const skill of preferredCanonicals) {
    if (candidateSet.has(skill.toLowerCase().trim())) {
      matchedPreferredSkills.push(skill);
    } else {
      notIdentifiedPreferredSkills.push(skill);
    }
  }

  // ── Additional candidate skills ──────────────────────────────────
  // Skills the candidate has that aren't in required OR preferred
  const additionalSkills = [];
  for (const s of candidateSkills || []) {
    if (!s || !s.canonicalName) continue;
    const lower = s.canonicalName.toLowerCase().trim();
    if (!allJDSkillSet.has(lower)) {
      additionalSkills.push(s.canonicalName);
    }
  }

  return {
    matchedRequiredSkills,
    notIdentifiedRequiredSkills,
    matchedPreferredSkills,
    notIdentifiedPreferredSkills,
    additionalSkills,
  };
};

/**
 * Calculate skill coverage and gap.
 * Coverage is based ONLY on required skills.
 * Preferred skills do NOT affect the main coverage score.
 *
 * @param {string[]} matchedRequired
 * @param {string[]} allRequired
 * @returns {{ requiredSkillCount, matchedRequiredSkillCount, notIdentifiedRequiredSkillCount, skillCoveragePercentage, skillGapPercentage }}
 */
const calculateCoverage = (matchedRequired, allRequired) => {
  const requiredSkillCount = (allRequired || []).length;
  const matchedRequiredSkillCount = (matchedRequired || []).length;
  const notIdentifiedRequiredSkillCount = requiredSkillCount - matchedRequiredSkillCount;

  let skillCoveragePercentage = 0;
  let skillGapPercentage = 100;

  if (requiredSkillCount > 0) {
    skillCoveragePercentage = Math.round(
      (matchedRequiredSkillCount / requiredSkillCount) * 100
    );
    skillGapPercentage = 100 - skillCoveragePercentage;
  }

  return {
    requiredSkillCount,
    matchedRequiredSkillCount,
    notIdentifiedRequiredSkillCount,
    skillCoveragePercentage,
    skillGapPercentage,
  };
};

/**
 * Combined function: match and calculate coverage in one call.
 *
 * @param {Array} candidateSkills
 * @param {Array} requiredSkills
 * @param {Array} preferredSkills
 * @returns {Object} Full analysis result
 */
const analyzeSkillGap = (candidateSkills, requiredSkills, preferredSkills) => {
  const matching = matchSkills(candidateSkills, requiredSkills, preferredSkills);
  const coverage = calculateCoverage(matching.matchedRequiredSkills, requiredSkills);

  return {
    ...matching,
    ...coverage,
  };
};

module.exports = { matchSkills, calculateCoverage, analyzeSkillGap };
