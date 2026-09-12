/**
 * Skill Normalization Service — Phase 2
 *
 * Loads the centralized technicalSkills.json dictionary and provides
 * normalization functions for skill names.
 *
 * Single source of truth: backend/src/data/skills/technicalSkills.json
 */

const path = require('path');
const skillData = require('../data/skills/technicalSkills.json');

/**
 * Build a fast lookup map: lowercased alias → canonical name
 * Built once at module load time.
 */
const buildAliasMap = () => {
  const map = new Map();
  for (const [canonicalName, info] of Object.entries(skillData.skills)) {
    // The canonical name itself (lowercased) maps to itself
    map.set(canonicalName.toLowerCase().trim(), canonicalName);
    // All defined aliases map to the canonical name
    if (Array.isArray(info.aliases)) {
      for (const alias of info.aliases) {
        map.set(alias.toLowerCase().trim(), canonicalName);
      }
    }
  }
  return map;
};

const ALIAS_MAP = buildAliasMap();

/**
 * Normalize a single skill name to its canonical form.
 * Returns null if the skill is not in the dictionary.
 *
 * @param {string} skillName
 * @returns {{ originalSkill: string, canonicalSkill: string, category: string } | null}
 */
const normalize = (skillName) => {
  if (!skillName || typeof skillName !== 'string') return null;

  const cleaned = skillName.toLowerCase().trim().replace(/\s+/g, ' ');
  const canonical = ALIAS_MAP.get(cleaned);

  if (!canonical) return null;

  const category = skillData.skills[canonical]?.category || 'other';

  return {
    originalSkill: skillName.trim(),
    canonicalSkill: canonical,
    category,
  };
};

/**
 * Normalize a list of skill strings.
 * Deduplicates by canonical name.
 * Preserves the original skill name alongside the canonical name.
 *
 * @param {string[]} skills - Raw skill name strings
 * @returns {Array<{ name: string, canonicalName: string, category: string, source: string }>}
 */
const normalizeList = (skills, source = 'unknown') => {
  if (!Array.isArray(skills)) return [];

  const seen = new Set();
  const result = [];

  for (const rawSkill of skills) {
    const normalized = normalize(rawSkill);
    if (normalized && !seen.has(normalized.canonicalSkill)) {
      seen.add(normalized.canonicalSkill);
      result.push({
        name: normalized.originalSkill,
        canonicalName: normalized.canonicalSkill,
        category: normalized.category,
        source,
      });
    }
  }

  return result;
};

/**
 * Given raw text (e.g. a comma/newline/space separated list), split into
 * individual skill tokens and normalize each.
 *
 * Handles common resume formats:
 *   - Comma-separated:  "JavaScript, React, Node.js"
 *   - Newline-separated: "JavaScript\nReact\nNode.js"
 *   - Bullet-separated: "• JavaScript • React • Node.js"
 *   - Space-separated (PDF multi-col): "JavaScript  React  Node.js"
 *
 * @param {string} text
 * @param {string} source
 * @returns {Array<{ name, canonicalName, category, source }>}
 */
const normalizeFromText = (text, source = 'unknown') => {
  if (!text) return [];

  // Step 0: Ensure colons attached directly to letters get spaced properly (e.g. "Languages:Java" -> "Languages: Java")
  const preprocessed = text.replace(/([A-Za-z0-9&/_-]+):(?=[A-Za-z0-9])/g, (m, g1) => g1 + ': ');

  // Step 1: Split on common explicit delimiters: comma, pipe, semicolon, newline, bullet, dash at line start
  const afterDelimiters = preprocessed.split(/[,|\n;•\r]+/);

  // Step 2: Within each token from step 1, also split on 2+ consecutive spaces/tabs
  // This handles PDF-extracted multi-column skill lists where columns are spaced out
  const tokens = [];
  for (const chunk of afterDelimiters) {
    const subTokens = chunk.split(/[ \t]{2,}/);
    for (const sub of subTokens) {
      tokens.push(sub);
    }
  }

  const cleaned = [];
  for (const t of tokens) {
    const raw = t.replace(/^[-–•*▪►]\s*/, '').trim();
    if (!raw || raw.length >= 60) continue;

    // If token has a category prefix like "Programming Languages: Java" or "Frontend: HTML",
    // strip the prefix before the colon if the whole token is not an exact known skill.
    if (raw.includes(':') && !isKnownSkill(raw)) {
      const afterColon = raw.split(':').slice(1).join(':').trim();
      if (afterColon) {
        cleaned.push(afterColon);
        continue;
      }
    }
    cleaned.push(raw);
  }

  return normalizeList(cleaned, source);
};

/**
 * Check if a given skill string is in the dictionary.
 *
 * @param {string} skillName
 * @returns {boolean}
 */
const isKnownSkill = (skillName) => {
  return normalize(skillName) !== null;
};

/**
 * Get canonical name for a skill, or null.
 *
 * @param {string} skillName
 * @returns {string | null}
 */
const getCanonicalName = (skillName) => {
  const result = normalize(skillName);
  return result ? result.canonicalSkill : null;
};

/**
 * Given a text block, extract ALL known skills mentioned anywhere in it.
 * Scans every token against the alias dictionary.
 *
 * @param {string} text
 * @param {string} source
 * @returns {Array<{ name, canonicalName, category, source }>}
 */
const extractSkillsFromText = (text, source = 'implied') => {
  if (!text) return [];

  // Separate colons so attached words like "ProgrammingLanguages:Java" split cleanly
  const preprocessed = text
    .replace(/([A-Za-z0-9&/_-]+):(?=[A-Za-z0-9])/g, (m, g1) => g1 + ': ')
    .replace(/:/g, ' ');

  const seen = new Set();
  const result = [];

  // Try multi-word phrases (up to 4 words) as well as single words
  const words = preprocessed.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= 4 && i + len <= words.length; len++) {
      const phrase = words.slice(i, i + len).join(' ').replace(/[,;:.()\[\]{}'"!?]/g, '').trim();
      if (phrase.length < 1) continue;

      const normalized = normalize(phrase);
      if (normalized && !seen.has(normalized.canonicalSkill)) {
        seen.add(normalized.canonicalSkill);
        result.push({
          name: normalized.originalSkill,
          canonicalName: normalized.canonicalSkill,
          category: normalized.category,
          source,
        });
      }
    }
  }

  return result;
};

module.exports = {
  normalize,
  normalizeList,
  normalizeFromText,
  isKnownSkill,
  getCanonicalName,
  extractSkillsFromText,
  ALIAS_MAP,
};
