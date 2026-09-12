/**
 * Skill Matching Service — Phase 2
 *
 * Deterministic, explainable skill matching with transferable skill detection.
 *
 * Compares candidate canonical skill names against JD required/preferred skills.
 * Coverage is based ONLY on required skills.
 * Preferred skills are reported separately.
 *
 * Transferable skills: skills the candidate has that belong to the same category
 * as a missing required skill (e.g., Python → Backend even if Node.js is required).
 */

// ─── Skill Category Taxonomy ─────────────────────────────────────────────────
// Maps canonical skill names (lowercase) to their domain category.
// Used to detect "transferable" skills (same category, different tool).

const SKILL_CATEGORIES = {
  // Frontend
  'html': 'frontend',
  'css': 'frontend',
  'javascript': 'frontend',
  'typescript': 'frontend',
  'react': 'frontend_framework',
  'vue.js': 'frontend_framework',
  'angular': 'frontend_framework',
  'next.js': 'frontend_framework',
  'svelte': 'frontend_framework',
  'jquery': 'frontend',
  'sass': 'frontend',
  'tailwind css': 'frontend',
  'bootstrap': 'frontend',
  'webpack': 'frontend_tooling',
  'vite': 'frontend_tooling',

  // Backend
  'node.js': 'backend',
  'express.js': 'backend',
  'python': 'backend',
  'django': 'backend_framework',
  'flask': 'backend_framework',
  'fastapi': 'backend_framework',
  'java': 'backend',
  'spring boot': 'backend_framework',
  'c#': 'backend',
  '.net': 'backend_framework',
  'ruby': 'backend',
  'ruby on rails': 'backend_framework',
  'go': 'backend',
  'rust': 'backend',
  'php': 'backend',
  'laravel': 'backend_framework',

  // Database
  'sql': 'database',
  'mysql': 'database',
  'postgresql': 'database',
  'sqlite': 'database',
  'mongodb': 'database_nosql',
  'redis': 'database_nosql',
  'dynamodb': 'database_nosql',
  'cassandra': 'database_nosql',
  'firebase': 'database_nosql',

  // Cloud / DevOps
  'aws': 'cloud',
  'azure': 'cloud',
  'gcp': 'cloud',
  'google cloud': 'cloud',
  'docker': 'devops',
  'kubernetes': 'devops',
  'terraform': 'devops',
  'ansible': 'devops',
  'jenkins': 'devops',
  'github actions': 'devops',
  'ci/cd': 'devops',

  // API / Integration
  'rest api': 'api',
  'graphql': 'api',
  'grpc': 'api',
  'websocket': 'api',

  // Version Control
  'git': 'version_control',
  'github': 'version_control',
  'gitlab': 'version_control',
  'bitbucket': 'version_control',

  // Testing
  'jest': 'testing',
  'pytest': 'testing',
  'mocha': 'testing',
  'cypress': 'testing',
  'selenium': 'testing',
  'unit testing': 'testing',

  // Data Science / ML
  'machine learning': 'ml',
  'deep learning': 'ml',
  'tensorflow': 'ml_framework',
  'pytorch': 'ml_framework',
  'scikit-learn': 'ml_framework',
  'pandas': 'data_science',
  'numpy': 'data_science',
  'data analysis': 'data_science',

  // Soft Skills
  'communication': 'soft_skill',
  'teamwork': 'soft_skill',
  'problem solving': 'soft_skill',
  'leadership': 'soft_skill',
};

// Map category → its parent super-category (for broader transferability)
const CATEGORY_SUPER_MAP = {
  'frontend': 'web',
  'frontend_framework': 'web',
  'frontend_tooling': 'web',
  'backend': 'web',
  'backend_framework': 'web',
  'database': 'data_storage',
  'database_nosql': 'data_storage',
  'cloud': 'infrastructure',
  'devops': 'infrastructure',
  'api': 'web',
  'version_control': 'engineering',
  'testing': 'engineering',
  'ml': 'data_science',
  'ml_framework': 'data_science',
  'data_science': 'data_science',
};

/**
 * Get the category for a skill (checks lowercase canonical name).
 * @param {string} skillName
 * @returns {string|null}
 */
const getSkillCategory = (skillName) => {
  if (!skillName) return null;
  return SKILL_CATEGORIES[skillName.toLowerCase().trim()] || null;
};

/**
 * Check if two skills are in the same category or super-category.
 * @param {string} skillA
 * @param {string} skillB
 * @returns {boolean}
 */
const areSkillsRelated = (skillA, skillB) => {
  const catA = getSkillCategory(skillA);
  const catB = getSkillCategory(skillB);
  if (!catA || !catB) return false;
  if (catA === catB) return true;
  const superA = CATEGORY_SUPER_MAP[catA];
  const superB = CATEGORY_SUPER_MAP[catB];
  return Boolean(superA && superB && superA === superB);
};

const extractCanonical = (s) => {
  if (!s) return null;
  if (typeof s === 'string') return s.trim();
  if (typeof s === 'object') {
    return (s.canonicalName || s.name || s.skill || '').trim() || null;
  }
  return null;
};

/**
 * Match candidate skills against required and preferred JD skills.
 *
 * @param {Array<{ canonicalName: string }|string>} candidateSkills
 * @param {Array<{ canonicalName: string }|string>} requiredSkills
 * @param {Array<{ canonicalName: string }|string>} preferredSkills
 * @returns {Object} Matching result
 */
const matchSkills = (candidateSkills, requiredSkills, preferredSkills) => {
  // Build a set of candidate canonical skill names (lowercase for safety)
  const candidateSet = new Set(
    (candidateSkills || [])
      .map(extractCanonical)
      .filter(Boolean)
      .map((s) => s.toLowerCase())
  );

  const candidateNames = Array.from(candidateSet);

  // Build sets for required and preferred
  const requiredCanonicals = (requiredSkills || [])
    .map(extractCanonical)
    .filter(Boolean);

  const preferredCanonicals = (preferredSkills || [])
    .map(extractCanonical)
    .filter(Boolean);

  // All JD skills (required + preferred) — for computing additionalSkills
  const allJDSkillSet = new Set([
    ...requiredCanonicals.map((s) => s.toLowerCase()),
    ...preferredCanonicals.map((s) => s.toLowerCase()),
  ]);

  // ── Required skill matching ──────────────────────────────────────
  const matchedRequiredSkills = [];
  const notIdentifiedRequiredSkills = [];
  const transferableSkills = []; // candidate has a related skill but not exact match

  for (const skill of requiredCanonicals) {
    const lower = skill.toLowerCase().trim();
    if (candidateSet.has(lower)) {
      matchedRequiredSkills.push(skill);
    } else {
      // Check if any candidate skill is in the same domain (transferable)
      const isTransferable = candidateNames.some((candidateName) =>
        areSkillsRelated(candidateName, lower)
      );

      if (isTransferable) {
        // The candidate doesn't have the exact skill but has a related one
        // Count as "not identified" for coverage, but flag as transferable
        transferableSkills.push(skill);
        notIdentifiedRequiredSkills.push(skill);
      } else {
        notIdentifiedRequiredSkills.push(skill);
      }
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

  // Pure missing skills (required skills with no match and no transferable related skills)
  const missingSkills = notIdentifiedRequiredSkills.filter(
    (skill) => !transferableSkills.some((ts) => ts.toLowerCase().trim() === skill.toLowerCase().trim())
  );

  return {
    matchedSkills: matchedRequiredSkills,
    partiallyMatchedSkills: transferableSkills,
    missingSkills,
    matchedRequiredSkills,
    notIdentifiedRequiredSkills,
    transferableSkills,       // skills candidate has in the same domain as missing required
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

module.exports = { matchSkills, calculateCoverage, analyzeSkillGap, getSkillCategory, areSkillsRelated };
