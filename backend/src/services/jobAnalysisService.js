/**
 * Job Description Analysis Service — Phase 2
 *
 * Section-aware, deterministic JD parser.
 * Extracts: jobTitle, company, location, experienceRequirement,
 *           requiredSkills, preferredSkills, responsibilities, softSkills.
 *
 * Required and preferred skills are ALWAYS kept separate.
 * The coverage metric in Phase 2 uses required skills only.
 */

const { normalizeFromText, extractSkillsFromText } = require('./skillNormalizationService');

// ─── Section Heading Patterns ────────────────────────────────────────────────

const JD_SECTION_PATTERNS = {
  required: [
    /^(required\s+qualifications?|requirements?|required\s+skills?|technical\s+requirements?|must\s+have|must-have|mandatory\s+requirements?|key\s+requirements?|minimum\s+qualifications?)$/i,
  ],
  preferred: [
    /^(preferred\s+qualifications?|preferred\s+skills?|nice\s+to\s+have|nice-to-have|good\s+to\s+have|good-to-have|bonus\s+qualifications?|optional\s+skills?|additional\s+qualifications?)$/i,
  ],
  responsibilities: [
    /^(responsibilities?|what\s+you['']ll\s+do|role\s+responsibilities?|key\s+responsibilities?|your\s+responsibilities?|job\s+responsibilities?|what\s+you\s+will\s+do|duties|key\s+duties|role\s+overview)$/i,
    /^responsibilities?$/i,
  ],
  about: [
    /^(about\s+the\s+role|job\s+description|about\s+the\s+position|role\s+description|overview|about\s+the\s+job|about\s+us|company\s+overview)$/i,
    /^about$/i,
  ],
  benefits: [
    /^(benefits?|what\s+we\s+offer|perks?|compensation|salary|package|why\s+join|why\s+us)$/i,
  ],
};

const detectJDSectionType = (line) => {
  // Strip trailing colon/punctuation before matching
  const trimmed = line.trim().replace(/:+$/, '').trim();
  if (!trimmed) return null;
  for (const [type, patterns] of Object.entries(JD_SECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return type;
    }
  }
  return null;
};


// ─── Soft Skills Dictionary ──────────────────────────────────────────────────

const SOFT_SKILL_PATTERNS = [
  /\bcommunication\s*skills?\b/i,
  /\bteamwork\b/i,
  /\bteam\s+player\b/i,
  /\bleadership\b/i,
  /\bproblem.?solving\b/i,
  /\banalytical\s+(thinking|skills?)\b/i,
  /\bcritical\s+thinking\b/i,
  /\btime\s+management\b/i,
  /\badaptability\b/i,
  /\bcollaboration\b/i,
  /\bcreativity\b/i,
  /\battention\s+to\s+detail\b/i,
  /\bself.?motivated\b/i,
  /\bfast\s+learner\b/i,
  /\bquick\s+learner\b/i,
  /\binterpersonal\s+skills?\b/i,
  /\bpresentation\s+skills?\b/i,
  /\bnegotiation\b/i,
  /\bmentoring\b/i,
  /\bcoaching\b/i,
  /\bproject\s+management\b/i,
  /\bstakeholder\s+management\b/i,
];

const extractSoftSkills = (text) => {
  const found = [];
  for (const pattern of SOFT_SKILL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const skill = match[0].replace(/\s+/g, ' ').trim();
      if (!found.includes(skill)) found.push(skill);
    }
  }
  return found;
};

// ─── Experience Requirement Extractor ───────────────────────────────────────

const extractExperienceRequirement = (text) => {
  const patterns = [
    /(\d+\+?\s*(?:to\s*\d+\s*)?\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+)?experience)/i,
    /(\d+\s*[-–]\s*\d+\s+years?\s+(?:of\s+)?(?:work\s+)?experience)/i,
    /(minimum\s+\d+\s+years?\s+(?:of\s+)?(?:work\s+)?experience)/i,
    /(at\s+least\s+\d+\s+years?\s+(?:of\s+)?experience)/i,
    /(entry.?level|fresher|0-1\s+years?|0\s+to\s+1\s+years?|no\s+experience\s+required)/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return match[0].trim();
  }
  return null;
};

// ─── Company / Location Extractors ──────────────────────────────────────────

const extractCompany = (text) => {
  // Look for "Company: X" or "About <Company>"
  const patterns = [
    /^company\s*:\s*(.+)$/im,
    /^organization\s*:\s*(.+)$/im,
    /^employer\s*:\s*(.+)$/im,
    /about\s+([A-Z][A-Za-z\s&.,']+)\s*\n/,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return match[1].trim();
  }
  return null;
};

const extractLocation = (text) => {
  const patterns = [
    /^location\s*:\s*(.+)$/im,
    /^job\s+location\s*:\s*(.+)$/im,
    /^place\s*:\s*(.+)$/im,
    /\b(remote|hybrid|on.?site|in.?office)\b/i,
    /\b(bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|new\s+york|san\s+francisco|london|berlin|toronto|singapore)\b/i,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return (match[1] || match[0]).trim();
  }
  return null;
};

// ─── Section Splitter ────────────────────────────────────────────────────────

const splitJDIntoSections = (text) => {
  const lines = text.split('\n');
  const sections = [];
  let currentType = 'header';
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const detected = detectJDSectionType(trimmed);
    if (detected) {
      if (currentLines.length > 0) {
        sections.push({ type: currentType, lines: currentLines });
      }
      currentType = detected;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ type: currentType, lines: currentLines });
  }

  return sections;
};

// ─── Skill Extraction from a Text Block ─────────────────────────────────────

/**
 * Extract normalized skill objects from a block of text.
 * Returns array of { name, canonicalName, category }.
 */
const extractSkillsBlock = (lines) => {
  const text = lines.join('\n');

  // First: try comma/bullet-separated tokens (explicit skills list)
  const fromList = normalizeFromText(text, 'required');

  // Second: scan full text for any mentioned technical skills
  const fromScan = extractSkillsFromText(text, 'required');

  // Merge, dedup by canonical name
  const seen = new Set();
  const merged = [];
  for (const s of [...fromList, ...fromScan]) {
    if (!seen.has(s.canonicalName)) {
      seen.add(s.canonicalName);
      merged.push({ name: s.name, canonicalName: s.canonicalName, category: s.category });
    }
  }
  return merged;
};

// ─── Responsibilities Extractor ──────────────────────────────────────────────

const extractResponsibilities = (lines) => {
  const results = [];
  for (const line of lines) {
    const cleaned = line.trim().replace(/^[-•*▪►✓✔\d+\.)]\s*/, '').trim();
    if (cleaned.length > 10 && cleaned.length < 300) {
      results.push(cleaned);
    }
  }
  return results.slice(0, 15); // cap at 15
};

// ─── Main JD Analyzer ───────────────────────────────────────────────────────

/**
 * Analyze a job description and return a structured JD profile.
 *
 * @param {string} rawText - Raw JD text
 * @param {string} targetRole - User-provided target role
 * @returns {Object} Structured JD profile
 */
const analyzeJobDescription = (rawText, targetRole) => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('No job description text provided.');
  }

  const text = rawText.trim();

  const sections = splitJDIntoSections(text);

  let requiredSkills = [];
  let preferredSkills = [];
  let responsibilities = [];

  // Process each detected section
  for (const section of sections) {
    switch (section.type) {
      case 'required':
        requiredSkills = extractSkillsBlock(section.lines);
        break;
      case 'preferred':
        preferredSkills = extractSkillsBlock(section.lines);
        break;
      case 'responsibilities':
        responsibilities = extractResponsibilities(section.lines);
        break;
      default:
        break;
    }
  }

  // If no explicit sections found, scan the whole text for skills
  if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    // All skills from full text are treated as required when no explicit separation
    requiredSkills = extractSkillsBlock(text.split('\n'));
  }

  // Remove preferred skills that are also in required (keep clean separation)
  const requiredCanonicals = new Set(requiredSkills.map((s) => s.canonicalName));
  preferredSkills = preferredSkills.filter((s) => !requiredCanonicals.has(s.canonicalName));

  // Extract soft skills from the full text
  const softSkills = extractSoftSkills(text);

  // Extract meta info
  const experienceRequirement = extractExperienceRequirement(text);
  const company = extractCompany(text);
  const location = extractLocation(text);

  // Job title: use targetRole as primary, fall back to pattern
  const jobTitlePatterns = [
    /^(job\s+title|position|role)\s*:\s*(.+)$/im,
    /^(software\s+engineer|full\s+stack|frontend|backend|data\s+scientist|ml\s+engineer|devops|sde|swe)\b/im,
  ];
  let jobTitle = targetRole || null;
  if (!jobTitle) {
    for (const pat of jobTitlePatterns) {
      const match = text.match(pat);
      if (match) {
        jobTitle = (match[2] || match[0]).trim();
        break;
      }
    }
  }

  return {
    jobTitle,
    company,
    location,
    experienceRequirement,
    requiredSkills,
    preferredSkills,
    responsibilities,
    softSkills,
  };
};

module.exports = { analyzeJobDescription };
