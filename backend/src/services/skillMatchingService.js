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

// Related skill families for detecting partial skill competency
const RELATED_SKILL_FAMILIES = [
  ['javascript', 'typescript', 'ecmascript'],
  ['react', 'nextjs', 'redux', 'react native', 'vue', 'angular'],
  ['html', 'css', 'sass', 'tailwind css', 'bootstrap'],
  ['python', 'django', 'flask', 'fastapi'],
  ['node.js', 'express.js', 'nestjs'],
  ['java', 'spring boot', 'hibernate', 'kotlin'],
  ['sql', 'mysql', 'postgresql', 'sqlite', 'oracle', 'database design'],
  ['mongodb', 'nosql', 'dynamodb', 'cassandra'],
  ['docker', 'kubernetes', 'containerization'],
  ['aws', 'azure', 'gcp', 'cloud'],
  ['git', 'github', 'gitlab', 'ci/cd'],
  ['rest apis', 'restful apis', 'graphql', 'api development', 'microservices'],
  ['machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy'],
];

/**
 * Check if candidate possesses a related skill in the same family/category.
 */
const hasRelatedSkill = (candidateSet, targetSkill, targetCategory, candidateSkills) => {
  const targetLower = targetSkill.toLowerCase().trim();

  // Check defined families
  for (const family of RELATED_SKILL_FAMILIES) {
    const isTargetInFamily = family.some((member) => member === targetLower || targetLower.includes(member));
    if (isTargetInFamily) {
      for (const member of family) {
        if (member !== targetLower && candidateSet.has(member)) {
          return true;
        }
      }
    }
  }

  // Check category match if category is specific
  if (targetCategory && targetCategory !== 'other' && targetCategory !== 'concept') {
    const matchesCategory = candidateSkills.some(
      (s) => (s.category || '').toLowerCase() === targetCategory.toLowerCase() &&
             s.canonicalName.toLowerCase() !== targetLower
    );
    if (matchesCategory) return true;
  }

  return false;
};

/**
 * Match candidate skills against required and preferred JD skills.
 * Produces tri-state matching: strongSkills, partialSkills, missingSkills.
 *
 * @param {Array<{ canonicalName: string, category: string }>} candidateSkills
 * @param {Array<{ canonicalName: string, category: string }>} requiredSkills
 * @param {Array<{ canonicalName: string, category: string }>} preferredSkills
 * @returns {Object} Matching result
 */
const matchSkills = (candidateSkills, requiredSkills, preferredSkills) => {
  // Support passing candidateProfile object
  const skillsList = Array.isArray(candidateSkills)
    ? candidateSkills
    : (candidateSkills && Array.isArray(candidateSkills.skills) ? candidateSkills.skills : []);

  // Build a set of candidate canonical skill names (lowercase for safety)
  const candidateSet = new Set(
    skillsList
      .filter((s) => s && (s.canonicalName || s.name || typeof s === 'string'))
      .map((s) => (typeof s === 'string' ? s : (s.canonicalName || s.name)).toLowerCase().trim())
  );

  // Normalize inputs to array of skill objects
  const reqList = (requiredSkills || []).map((s) =>
    typeof s === 'string' ? { canonicalName: s, name: s, category: 'other' } : s
  );
  const prefList = (preferredSkills || []).map((s) =>
    typeof s === 'string' ? { canonicalName: s, name: s, category: 'other' } : s
  );

  const matchedRequiredSkills = [];
  const notIdentifiedRequiredSkills = [];

  const strongSkills = [];
  const partialSkills = [];
  const missingSkills = [];

  for (const skill of reqList) {
    const skillName = skill.name || skill.canonicalName;
    const lower = (skill.canonicalName || skillName).toLowerCase().trim();

    if (candidateSet.has(lower)) {
      matchedRequiredSkills.push(skillName);
      strongSkills.push(skillName);
    } else if (hasRelatedSkill(candidateSet, skillName, skill.category, candidateSkills || [])) {
      notIdentifiedRequiredSkills.push(skillName);
      partialSkills.push(skillName);
    } else {
      notIdentifiedRequiredSkills.push(skillName);
      missingSkills.push(skillName);
    }
  }

  // ── Preferred skill matching ─────────────────────────────────────
  const matchedPreferredSkills = [];
  const notIdentifiedPreferredSkills = [];

  for (const skill of prefList) {
    const skillName = skill.name || skill.canonicalName;
    const lower = (skill.canonicalName || skillName).toLowerCase().trim();

    if (candidateSet.has(lower)) {
      matchedPreferredSkills.push(skillName);
    } else {
      notIdentifiedPreferredSkills.push(skillName);
    }
  }

  // ── Additional candidate skills ──────────────────────────────────
  const allJDSkillSet = new Set([
    ...reqList.map((s) => (s.canonicalName || s.name).toLowerCase().trim()),
    ...prefList.map((s) => (s.canonicalName || s.name).toLowerCase().trim()),
  ]);

  const additionalSkills = [];
  for (const s of skillsList) {
    const skillName = typeof s === 'string' ? s : (s.canonicalName || s.name);
    if (!skillName) continue;
    const lower = skillName.toLowerCase().trim();
    if (!allJDSkillSet.has(lower) && !additionalSkills.includes(skillName)) {
      additionalSkills.push(skillName);
    }
  }

  return {
    matchedRequiredSkills,
    notIdentifiedRequiredSkills,
    matchedPreferredSkills,
    notIdentifiedPreferredSkills,
    strongSkills,
    partialSkills,
    missingSkills,
    additionalSkills,
  };
};

/**
 * Calculate skill coverage and gap.
 * Coverage is based on required skills with strong skills at 100% and partial skills at 50%.
 *
 * @param {string[]} matchedRequired
 * @param {string[]} allRequired
 * @param {string[]} partialSkills
 * @returns {{ requiredSkillCount, matchedRequiredSkillCount, notIdentifiedRequiredSkillCount, skillCoveragePercentage, skillGapPercentage }}
 */
const calculateCoverage = (matchedRequired, allRequired, partialSkills = []) => {
  const requiredSkillCount = (allRequired || []).length;
  const matchedRequiredSkillCount = (matchedRequired || []).length;
  const partialCount = (partialSkills || []).length;
  const notIdentifiedRequiredSkillCount = requiredSkillCount - matchedRequiredSkillCount;

  let skillCoveragePercentage = 0;
  let skillGapPercentage = 100;

  if (requiredSkillCount > 0) {
    // Weighted coverage: strong = 1.0, partial = 0.5
    const effectivePoints = matchedRequiredSkillCount + (partialCount * 0.5);
    skillCoveragePercentage = Math.min(100, Math.round((effectivePoints / requiredSkillCount) * 100));
    skillGapPercentage = Math.max(0, 100 - skillCoveragePercentage);
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
  let req = requiredSkills;
  let pref = preferredSkills;
  if (requiredSkills && !Array.isArray(requiredSkills) && requiredSkills.requiredSkills) {
    req = requiredSkills.requiredSkills;
    pref = requiredSkills.preferredSkills || preferredSkills || [];
  }

  const matching = matchSkills(candidateSkills, req, pref);
  const coverage = calculateCoverage(
    matching.matchedRequiredSkills,
    req,
    matching.partialSkills
  );

  return {
    ...matching,
    ...coverage,
  };
};

module.exports = { matchSkills, calculateCoverage, analyzeSkillGap };

