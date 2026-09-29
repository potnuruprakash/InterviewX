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

// ─── Standard Role Competency Profiles ───────────────────────────────────────

const STANDARD_ROLE_PROFILES = {
  'python full stack developer': {
    title: 'Python Full Stack Developer',
    requiredSkills: ['Python', 'REST APIs', 'FastAPI', 'React', 'JavaScript', 'SQL', 'Git'],
    preferredSkills: ['Docker', 'AWS', 'Redis'],
    roleExpectations: [
      'Full stack web application development',
      'RESTful API architecture with Python/FastAPI',
      'Frontend component engineering with React and JavaScript',
      'Database modeling and querying with SQL',
      'Version control and collaborative workflows with Git',
    ],
  },
  'python developer': {
    title: 'Python Developer',
    requiredSkills: ['Python', 'FastAPI', 'Django', 'REST APIs', 'SQL', 'Git'],
    preferredSkills: ['Docker', 'PostgreSQL', 'Redis', 'AWS'],
    roleExpectations: [
      'Backend development and microservices with Python',
      'API design and integration',
      'Database schema management and performance tuning',
    ],
  },
  'frontend developer': {
    title: 'Frontend Developer',
    requiredSkills: ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'REST APIs', 'Git'],
    preferredSkills: ['Next.js', 'Tailwind CSS', 'Redux', 'Jest'],
    roleExpectations: [
      'UI/UX implementation with React and modern CSS',
      'State management and performance optimization',
      'Responsive design and cross-browser compatibility',
    ],
  },
  'react developer': {
    title: 'React Developer',
    requiredSkills: ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'REST APIs', 'Git'],
    preferredSkills: ['Next.js', 'Redux', 'Tailwind CSS', 'Vite'],
    roleExpectations: [
      'Component-driven UI development with React',
      'Frontend state management and asynchronous data fetching',
    ],
  },
  'full stack developer': {
    title: 'Full Stack Developer',
    requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express.js', 'SQL', 'REST APIs', 'Git'],
    preferredSkills: ['Docker', 'AWS', 'MongoDB', 'Redis'],
    roleExpectations: [
      'End-to-end full stack feature engineering',
      'Server-side API and database integration',
      'Frontend interactive user interfaces',
    ],
  },
  'backend developer': {
    title: 'Backend Developer',
    requiredSkills: ['Node.js', 'Python', 'REST APIs', 'SQL', 'Git', 'Database Design'],
    preferredSkills: ['Docker', 'Microservices', 'Redis', 'AWS'],
    roleExpectations: [
      'Scalable backend system architecture',
      'Secure API design, authentication, and database querying',
    ],
  },
  'java full stack developer': {
    title: 'Java Full Stack Developer',
    requiredSkills: ['Java', 'Spring Boot', 'REST APIs', 'SQL', 'React', 'JavaScript', 'Git'],
    preferredSkills: ['Docker', 'AWS', 'Kubernetes', 'Hibernate', 'Microservices'],
    roleExpectations: [
      'Enterprise application development with Spring Boot',
      'Full stack architecture with modern frontend',
      'Relational database and transaction management',
    ],
  },
  'data scientist': {
    title: 'Data Scientist',
    requiredSkills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'NumPy', 'Scikit-Learn', 'Data Analysis'],
    preferredSkills: ['Deep Learning', 'PyTorch', 'TensorFlow', 'BigQuery', 'Tableau'],
    roleExpectations: [
      'Predictive modeling and statistical analysis',
      'Data preprocessing, feature engineering, and pipeline creation',
    ],
  },
  'machine learning engineer': {
    title: 'Machine Learning Engineer',
    requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'SQL', 'Git', 'Docker'],
    preferredSkills: ['MLOps', 'Kubernetes', 'FastAPI', 'AWS'],
    roleExpectations: [
      'Production ML pipeline design and model deployment',
      'Deep neural network training and evaluation',
    ],
  },
  'devops engineer': {
    title: 'DevOps Engineer',
    requiredSkills: ['Linux', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'Bash', 'AWS', 'Terraform'],
    preferredSkills: ['Prometheus', 'Grafana', 'Ansible', 'Python', 'Jenkins'],
    roleExpectations: [
      'Infrastructure as code and cloud orchestration',
      'Automated CI/CD pipelines and production monitoring',
    ],
  },
  'system design engineer': {
    title: 'System Design Engineer',
    requiredSkills: ['System Design', 'Microservices', 'Distributed Systems', 'REST APIs', 'Database Design', 'Scalability'],
    preferredSkills: ['Kafka', 'Redis', 'Kubernetes', 'High Availability'],
    roleExpectations: [
      'High-throughput distributed architecture planning',
      'Fault tolerance, caching, and database partitioning',
    ],
  },
};

const matchStandardRoleProfile = (roleTitle) => {
  if (!roleTitle || typeof roleTitle !== 'string') return null;
  const cleaned = roleTitle.toLowerCase().trim();

  // Exact match
  if (STANDARD_ROLE_PROFILES[cleaned]) return STANDARD_ROLE_PROFILES[cleaned];

  // Substring match
  for (const [key, profile] of Object.entries(STANDARD_ROLE_PROFILES)) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return profile;
    }
  }

  // Word overlap heuristic
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;

  for (const [key, profile] of Object.entries(STANDARD_ROLE_PROFILES)) {
    const keyWords = key.split(/\s+/);
    const overlap = words.filter((w) => keyWords.includes(w)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = profile;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
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
  let effectiveRole = targetRole;
  if (!effectiveRole && typeof rawText === 'string') {
    // If first line or text mentions a known standard role, use it
    for (const [key, profile] of Object.entries(STANDARD_ROLE_PROFILES)) {
      if (rawText.toLowerCase().includes(key)) {
        effectiveRole = profile.title;
        break;
      }
    }
  }
  if (!effectiveRole) {
    effectiveRole = typeof rawText === 'string' && rawText.length < 80 ? rawText : 'Software Engineer';
  }
  const matchedProfile = matchStandardRoleProfile(effectiveRole);

  const text = (rawText && typeof rawText === 'string') ? rawText.trim() : '';
  const sections = text ? splitJDIntoSections(text) : [];

  let extractedRequired = [];
  let extractedPreferred = [];
  let responsibilities = [];

  for (const section of sections) {
    switch (section.type) {
      case 'required':
        extractedRequired = extractSkillsBlock(section.lines);
        break;
      case 'preferred':
        extractedPreferred = extractSkillsBlock(section.lines);
        break;
      case 'responsibilities':
        responsibilities = extractResponsibilities(section.lines);
        break;
      default:
        break;
    }
  }

  // If no explicit sectioning found in text, extract from full text
  if (text && extractedRequired.length === 0 && extractedPreferred.length === 0) {
    extractedRequired = extractSkillsBlock(text.split('\n'));
  }

  // Base skills from standard role taxonomy if matched
  let baseRequiredSkills = [];
  let basePreferredSkills = [];
  let roleExpectations = [];

  if (matchedProfile) {
    baseRequiredSkills = normalizeFromText(matchedProfile.requiredSkills.join(', '), 'required');
    basePreferredSkills = normalizeFromText(matchedProfile.preferredSkills.join(', '), 'preferred');
    roleExpectations = [...matchedProfile.roleExpectations];
  }

  // Merge extracted with base skills: explicit extracted take priority, augmented with base
  const requiredMap = new Map();
  for (const s of [...baseRequiredSkills, ...extractedRequired]) {
    if (s && s.canonicalName && !requiredMap.has(s.canonicalName)) {
      requiredMap.set(s.canonicalName, s);
    }
  }
  const requiredSkills = Array.from(requiredMap.values());

  const preferredMap = new Map();
  for (const s of [...basePreferredSkills, ...extractedPreferred]) {
    if (s && s.canonicalName && !requiredMap.has(s.canonicalName) && !preferredMap.has(s.canonicalName)) {
      preferredMap.set(s.canonicalName, s);
    }
  }
  const preferredSkills = Array.from(preferredMap.values());

  const softSkills = text ? extractSoftSkills(text) : ['Problem Solving', 'Communication', 'Teamwork'];
  const experienceRequirement = text ? extractExperienceRequirement(text) : '1-3 years';
  const company = text ? extractCompany(text) : null;
  const location = text ? extractLocation(text) : null;

  const jobTitle = targetRole || matchedProfile?.title || 'Software Engineer';

  const requiredSkillNames = requiredSkills.map((s) => s.name || s.canonicalName);
  const preferredSkillNames = preferredSkills.map((s) => s.name || s.canonicalName);

  return {
    title: jobTitle,
    jobTitle,
    company,
    location,
    experienceRequirement,
    requiredSkills,
    preferredSkills,
    requiredSkillNames,
    preferredSkillNames,
    roleExpectations: roleExpectations.length > 0 ? roleExpectations : [
      `Application development aligned with ${jobTitle} standards`,
      'Technical problem solving and collaborative code delivery',
    ],
    responsibilities: responsibilities.length > 0 ? responsibilities : roleExpectations,
    softSkills,
  };
};

module.exports = {
  analyzeJobDescription,
  matchStandardRoleProfile,
  STANDARD_ROLE_PROFILES,
};

