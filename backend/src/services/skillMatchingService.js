/**
 * Skill Matching Service — Phase 2
 *
 * Deterministic, explainable skill matching.
 * No SBERT. No embeddings. No LLM.
 *
 * Compares candidate canonical skill names against JD required/preferred skills.
 * The main match/gap score is based on required skills:
 *   - exact/strong match = 1.0
 *   - related/partial match = 0.625
 *   - missing = 0
 *
 * 0.625 is intentional: a partial match represents meaningful related evidence
 * but must remain materially below an exact demonstration. It also keeps the
 * displayed score aligned with the product's Matched / Partial / Missing model.
 * Preferred skills are reported separately and do not inflate required-skill coverage.
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

const MATCH_WEIGHTS = Object.freeze({
  strong: 1,
  partial: 0.625,
  missing: 0,
});

/**
 * Normalize a skill name for deterministic comparison.
 */
const normalizeSkill = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');

/**
 * Check if candidate possesses a related skill in the same family/category.
 */
const hasRelatedSkill = (candidateSet, targetSkill, targetCategory, candidateSkills) => {
  const targetLower = normalizeSkill(targetSkill);

  for (const family of RELATED_SKILL_FAMILIES) {
    const normalizedFamily = family.map(normalizeSkill);
    const isTargetInFamily = normalizedFamily.some(
      (member) => member === targetLower || targetLower.includes(member)
    );

    if (isTargetInFamily) {
      for (const member of normalizedFamily) {
        if (member !== targetLower && candidateSet.has(member)) {
          return true;
        }
      }
    }
  }

  if (
    targetCategory &&
    targetCategory !== 'other' &&
    targetCategory !== 'concept' &&
    Array.isArray(candidateSkills)
  ) {
    const matchesCategory = candidateSkills.some((s) => {
      if (!s) return false;
      const candidateName = normalizeSkill(s.canonicalName || s.name);
      return (
        normalizeSkill(s.category) === normalizeSkill(targetCategory) &&
        candidateName !== targetLower
      );
    });

    if (matchesCategory) return true;
  }

  return false;
};

/**
 * Match candidate skills against required and preferred JD skills.
 *
 * Produces:
 *   strongSkills   - exact evidence
 *   partialSkills  - related evidence
 *   missingSkills  - no relevant evidence
 */
const matchSkills = (candidateSkills, requiredSkills, preferredSkills) => {
  const skillsList = Array.isArray(candidateSkills)
    ? candidateSkills
    : (candidateSkills && Array.isArray(candidateSkills.skills) ? candidateSkills.skills : []);

  const candidateSet = new Set(
    skillsList
      .filter((s) => s && (s.canonicalName || s.name || typeof s === 'string'))
      .map((s) => normalizeSkill(typeof s === 'string' ? s : (s.canonicalName || s.name)))
      .filter(Boolean)
  );

  const reqList = (requiredSkills || []).map((s) =>
    typeof s === 'string'
      ? { canonicalName: s, name: s, category: 'other' }
      : s
  );

  const prefList = (preferredSkills || []).map((s) =>
    typeof s === 'string'
      ? { canonicalName: s, name: s, category: 'other' }
      : s
  );

  const matchedRequiredSkills = [];
  const notIdentifiedRequiredSkills = [];
  const strongSkills = [];
  const partialSkills = [];
  const missingSkills = [];

  for (const skill of reqList) {
    const skillName = skill.name || skill.canonicalName;
    const lower = normalizeSkill(skill.canonicalName || skillName);

    if (candidateSet.has(lower)) {
      matchedRequiredSkills.push(skillName);
      strongSkills.push(skillName);
    } else if (
      hasRelatedSkill(candidateSet, skillName, skill.category, skillsList)
    ) {
      notIdentifiedRequiredSkills.push(skillName);
      partialSkills.push(skillName);
    } else {
      notIdentifiedRequiredSkills.push(skillName);
      missingSkills.push(skillName);
    }
  }

  const matchedPreferredSkills = [];
  const notIdentifiedPreferredSkills = [];

  for (const skill of prefList) {
    const skillName = skill.name || skill.canonicalName;
    const lower = normalizeSkill(skill.canonicalName || skillName);

    if (candidateSet.has(lower)) {
      matchedPreferredSkills.push(skillName);
    } else {
      notIdentifiedPreferredSkills.push(skillName);
    }
  }

  const allJDSkillSet = new Set([
    ...reqList.map((s) => normalizeSkill(s.canonicalName || s.name)),
    ...prefList.map((s) => normalizeSkill(s.canonicalName || s.name)),
  ]);

  const additionalSkills = [];
  for (const s of skillsList) {
    const skillName = typeof s === 'string' ? s : (s.canonicalName || s.name);
    const lower = normalizeSkill(skillName);

    if (lower && !allJDSkillSet.has(lower) && !additionalSkills.includes(skillName)) {
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
 * Calculate the overall required-skill match and skill gap.
 *
 * Important:
 * - matchedRequiredSkillCount means exact/strong matches only.
 * - partialSkillCount is reported separately.
 * - overallMatchPercentage includes weighted partial credit.
 * - skillGapPercentage is the complement of the overall match.
 */
const calculateCoverage = (
  matchedRequired,
  allRequired,
  partialSkills = [],
  missingSkills = []
) => {
  const requiredSkillCount = (allRequired || []).length;
  const matchedRequiredSkillCount = (matchedRequired || []).length;
  const partialSkillCount = (partialSkills || []).length;
  const missingSkillCount = (missingSkills || []).length;

  let overallMatchPercentage = 0;
  let skillGapPercentage = 100;

  if (requiredSkillCount > 0) {
    const effectivePoints =
      matchedRequiredSkillCount * MATCH_WEIGHTS.strong +
      partialSkillCount * MATCH_WEIGHTS.partial +
      missingSkillCount * MATCH_WEIGHTS.missing;

    overallMatchPercentage = Math.min(
      100,
      Math.max(0, Math.round((effectivePoints / requiredSkillCount) * 100))
    );

    skillGapPercentage = 100 - overallMatchPercentage;
  }

  return {
    requiredSkillCount,
    matchedRequiredSkillCount,
    partialSkillCount,
    missingSkillCount,
    notIdentifiedRequiredSkillCount: partialSkillCount + missingSkillCount,
    overallMatchPercentage,
    skillCoveragePercentage: overallMatchPercentage,
    skillGapPercentage,
    matchWeights: MATCH_WEIGHTS,
  };
};

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
    matching.partialSkills,
    matching.missingSkills
  );

  return {
    ...matching,
    ...coverage,
  };
};

module.exports = {
  MATCH_WEIGHTS,
  matchSkills,
  calculateCoverage,
  analyzeSkillGap,
};
