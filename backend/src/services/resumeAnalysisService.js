/**
 * Resume Analysis Service — Phase 2
 *
 * Section-aware, deterministic resume parser.
 * Extracts: basicInfo, skills, projects, experience, education, certifications.
 *
 * Pipeline:
 *   1. Detect section boundaries using heading patterns
 *   2. Apply section-specific parsers to each block
 *   3. Extract skills from the skills section + implied from projects/experience
 *   4. Normalize all skills via skillNormalizationService
 *   5. Deduplicate
 */

const {
  normalizeList,
  normalizeFromText,
  extractSkillsFromText,
  getCanonicalName,
} = require('./skillNormalizationService');

// ─── Section Heading Patterns ───────────────────────────────────────────────

const SECTION_PATTERNS = {
  skills: [
    /^(technical\s+skills?|core\s+skills?|programming\s+skills?|technologies(\s+used)?|skills?\s+summary|key\s+skills?|technical\s+expertise|skills?\s+&\s+technologies|tools?\s+&\s+technologies|tech\s+stack|competencies|areas\s+of\s+expertise|technical\s+competencies)$/i,
    /^skills?$/i,
  ],
  experience: [
    /^(work\s+experience|professional\s+experience|employment(\s+history)?|internship(s)?|work\s+history|career\s+history|professional\s+background|industry\s+experience)$/i,
    /^experience$/i,
  ],
  projects: [
    /^(academic\s+projects?|personal\s+projects?|project\s+experience|notable\s+projects?|key\s+projects?|side\s+projects?|open\s+source\s+projects?)$/i,
    /^projects?$/i,
  ],
  education: [
    /^(academic\s+(background|qualification(s)?)|educational\s+qualification(s)?|academic\s+history|qualifications?)$/i,
    /^education$/i,
  ],
  certifications: [
    /^(professional\s+certifications?|certificates?|certifications?\s+&\s+courses?|licenses?\s+&\s+certifications?)$/i,
    /^certifications?$/i,
  ],
  summary: [
    /^(professional\s+summary|career\s+summary|objective|profile|about\s+me|summary\s+of\s+qualifications?)$/i,
    /^summary$/i,
  ],
};

const ALL_SECTION_TYPES = Object.keys(SECTION_PATTERNS);

/**
 * Detect which section type a given line heading matches.
 * @param {string} line
 * @returns {string|null} section type or null
 */
const detectSectionType = (line) => {
  // Strip trailing colon/punctuation before matching
  const trimmed = line.trim().replace(/:+$/, '').trim();
  if (!trimmed) return null;

  for (const [type, patterns] of Object.entries(SECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return type;
    }
  }
  return null;
};


/**
 * A line is likely a section heading if:
 * - It matches a known section pattern, OR
 * - It is short (< 60 chars), all caps or title-cased, and followed by content
 */
const isLikelySectionHeading = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (detectSectionType(trimmed)) return true;
  return false;
};

// ─── Basic Information Extraction ───────────────────────────────────────────

const extractBasicInfo = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Email
  const emailMatch = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : null;

  // Phone — international + Indian formats
  const phoneMatch = text.match(
    /(\+?(\d[\s\-.]?){8,14}\d)/
  );
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null;

  // Name heuristic: first non-empty line in header that looks like a name
  let name = null;
  for (const line of lines.slice(0, 6)) {
    const noEmail = !/@/.test(line);
    const noPhone = !/^\+?\d[\d\s\-.()+]{6,}/.test(line);
    const noUrlOrSocial = !/https?:\/\/|www\.|linkedin|github|gmail|portfolio|curriculum|resume/i.test(line);
    const noPipes = !/\|/.test(line);
    const notAHeading = !isLikelySectionHeading(line);
    const reasonableLength = line.length > 2 && line.length < 50;
    const looksLikeName = /^[A-Za-z\s.'-]+$/.test(line);

    if (noEmail && noPhone && noUrlOrSocial && noPipes && notAHeading && reasonableLength && looksLikeName) {
      name = line;
      break;
    }
  }

  // Location heuristic: line containing city-like content
  let location = null;
  const locationPatterns = [
    /\b(bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|new\s+delhi|noida|gurgaon|gurugram|ahmedabad|jaipur|lucknow|kochi|chandigarh|indore|bhopal|nagpur|visakhapatnam|surat|vadodara)\b/i,
    /\b([A-Z][a-z]+,\s*[A-Z]{2})\b/, // City, State
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+,\s*[A-Z][a-z]+)\b/, // City State Country
  ];

  for (const line of lines.slice(0, 10)) {
    for (const pat of locationPatterns) {
      if (pat.test(line) && !/@/.test(line)) {
        location = line.trim();
        break;
      }
    }
    if (location) break;
  }

  return { name, email, phone, location };
};

// ─── Section Splitting ───────────────────────────────────────────────────────

/**
 * Split text into labeled sections.
 * @param {string} text
 * @returns {Array<{ type: string, lines: string[] }>}
 */
const splitIntoSections = (text) => {
  const lines = text.split('\n');
  const sections = [];
  let currentType = 'header'; // Before the first detected heading
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const detectedType = detectSectionType(trimmed);

    if (detectedType) {
      if (currentLines.length > 0) {
        sections.push({ type: currentType, lines: currentLines });
      }
      currentType = detectedType;
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

// ─── Skills Section Parser ───────────────────────────────────────────────────

const parseSkillsSection = (lines) => {
  const text = lines.join('\n');
  return normalizeFromText(text, 'skills_section');
};

// ─── Education Parser ────────────────────────────────────────────────────────

const DEGREE_PATTERNS = [
  /\b(b\.?tech|bachelor\s+of\s+technology|be\b|bachelor\s+of\s+engineering)\b/i,
  /\b(b\.?e\.?|b\.?sc\.?|b\.?a\.?|b\.?com\.?|bca\b|bba\b|b\.?ed\.?)\b/i,
  /\b(m\.?tech|master\s+of\s+technology|me\b|master\s+of\s+engineering)\b/i,
  /\b(m\.?sc\.?|m\.?a\.?|mca\b|mba\b|m\.?ed\.?|m\.?com\.?)\b/i,
  /\b(ph\.?d\.?|doctorate|doctor\s+of\s+philosophy)\b/i,
  /\b(diploma|polytechnic|certificate\s+course)\b/i,
  /\b(12th|10th|hsc|ssc|higher\s+secondary|secondary\s+school|matriculation)\b/i,
];

const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;

const parseEducationSection = (lines) => {
  const education = [];
  const text = lines.join('\n');
  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const blockLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    let degree = null;
    let institution = null;
    let fieldOfStudy = null;
    let graduationYear = null;

    for (const line of blockLines) {
      // Degree detection
      if (!degree) {
        for (const pat of DEGREE_PATTERNS) {
          if (pat.test(line)) {
            degree = line;
            break;
          }
        }
      }
      // Year
      if (!graduationYear) {
        const yearMatch = line.match(YEAR_PATTERN);
        if (yearMatch) graduationYear = parseInt(yearMatch[0], 10);
      }
      // Institution heuristic: contains "University", "College", "Institute", "School"
      if (!institution && /university|college|institute|school|iit|nit|bits\b/i.test(line)) {
        institution = line;
      }
    }

    // Field of study heuristics
    const csPatterns = /\b(computer\s+science|information\s+technology|software\s+engineering|data\s+science|artificial\s+intelligence|electronics|mechanical|civil|electrical|chemical)\b/i;
    const csMatch = text.match(csPatterns);
    if (csMatch) fieldOfStudy = csMatch[0];

    if (degree || institution) {
      education.push({ degree, institution, fieldOfStudy, graduationYear });
    }
  }

  return education;
};

// ─── Experience Parser ───────────────────────────────────────────────────────

const DURATION_PATTERN = /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)[\s,\-]*(\d{4})\s*[-–to]+\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,\-]*(\d{4})|present|current|now)\b/i;

const parseExperienceSection = (lines) => {
  const experiences = [];
  const text = lines.join('\n');
  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const blockLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (blockLines.length < 2) continue;

    let jobTitle = null;
    let organization = null;
    let duration = null;
    const responsibilities = [];
    const technologies = [];

    for (const line of blockLines) {
      // Duration
      if (!duration) {
        const durMatch = line.match(DURATION_PATTERN);
        if (durMatch) {
          duration = durMatch[0];
          continue;
        }
      }
      // Organization
      if (!organization && /\b(pvt\.?|ltd\.?|inc\.?|corp\.?|llc|technologies|solutions|systems|services|consulting|company|startup|laboratories|labs)\b/i.test(line)) {
        organization = line;
        continue;
      }
      // Job title heuristic
      if (!jobTitle) {
        const titlePat = /\b(engineer|developer|analyst|intern|manager|designer|architect|scientist|consultant|lead|senior|junior|associate|full.?stack|front.?end|back.?end|devops|sde|swe)\b/i;
        if (titlePat.test(line) && line.length < 80) {
          jobTitle = line;
          continue;
        }
      }
      // Responsibility: bullet or numbered item
      if (/^[-•*▪►\d+\.)]/.test(line) || line.length < 200) {
        responsibilities.push(line.replace(/^[-•*▪►\d+\.)]\s*/, '').trim());
      }
    }

    // Extract technologies from block
    const techFromBlock = extractSkillsFromText(block, 'experience');
    technologies.push(...techFromBlock.map((s) => s.canonicalName));

    if (jobTitle || organization) {
      experiences.push({
        jobTitle,
        organization,
        duration,
        responsibilities: responsibilities.slice(0, 10),
        technologies: [...new Set(technologies)],
      });
    }
  }

  return experiences;
};

// ─── Projects Parser ─────────────────────────────────────────────────────────

const parseProjectsSection = (lines) => {
  const projects = [];
  const text = lines.join('\n');
  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const blockLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    // First non-empty line is likely the project title
    const title = blockLines[0];
    const description = blockLines.slice(1).join(' ').trim();
    const contribution = blockLines.find((l) => /\b(developed|built|created|implemented|designed|led|contributed|worked|managed)\b/i.test(l)) || null;

    // Extract technologies from the block
    const techObjs = extractSkillsFromText(block, 'project');
    const technologies = [...new Set(techObjs.map((t) => t.canonicalName))];

    if (title && title.length < 120) {
      projects.push({ title, description, technologies, contribution });
    }
  }

  return projects;
};

// ─── Certifications Parser ───────────────────────────────────────────────────

const parseGertificationsSection = (lines) => {
  const certifications = [];
  const text = lines.join('\n');
  const blockLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of blockLines) {
    const cleaned = line.replace(/^[-•*▪►\d+\.)]\s*/, '').trim();
    if (!cleaned || cleaned.length < 3) continue;

    // Year/date
    const dateMatch = cleaned.match(/\b((20|19)\d{2})\b/);
    const date = dateMatch ? dateMatch[0] : null;

    // Issuer: look for "by", "from", "Coursera", "Google", "AWS", "Microsoft"
    const issuerMatch = cleaned.match(/\b(coursera|udemy|edx|google|aws|amazon|microsoft|oracle|cisco|ibm|meta|linkedin|nptel|nasscom)\b/i);
    const issuingOrganization = issuerMatch ? issuerMatch[0] : null;

    certifications.push({
      name: cleaned,
      issuingOrganization,
      date,
    });
  }

  return certifications;
};

// ─── Main Analyzer ───────────────────────────────────────────────────────────

/**
 * Analyze extracted resume text and return a structured candidate profile.
 *
 * @param {string} extractedText - Plain text from PDF/DOCX parser
 * @returns {Object} Structured candidate profile
 */
const analyzeResume = (extractedText) => {
  if (!extractedText || typeof extractedText !== 'string') {
    throw new Error('No extracted text provided for analysis.');
  }

  const text = extractedText.trim();

  // Split into sections
  const sections = splitIntoSections(text);

  // Basic info from the full text (especially header area)
  const basicInfo = extractBasicInfo(text);

  // Section-specific data
  let skillsFromSection = [];
  let projects = [];
  let experience = [];
  let education = [];
  let certifications = [];

  for (const section of sections) {
    switch (section.type) {
      case 'skills':
        skillsFromSection = parseSkillsSection(section.lines);
        break;
      case 'projects':
        projects = parseProjectsSection(section.lines);
        break;
      case 'experience':
        experience = parseExperienceSection(section.lines);
        break;
      case 'education':
        education = parseEducationSection(section.lines);
        break;
      case 'certifications':
        certifications = parseGertificationsSection(section.lines);
        break;
      default:
        break;
    }
  }

  // Collect implied skills from projects and experience
  const impliedSkillNames = new Set();
  const skillsFromProjects = [];
  for (const proj of projects) {
    for (const tech of proj.technologies) {
      if (!impliedSkillNames.has(tech)) {
        impliedSkillNames.add(tech);
        skillsFromProjects.push(tech);
      }
    }
  }

  const skillsFromExperience = [];
  for (const exp of experience) {
    for (const tech of exp.technologies) {
      if (!impliedSkillNames.has(tech)) {
        impliedSkillNames.add(tech);
        skillsFromExperience.push(tech);
      }
    }
  }

  // Merge skills: skills section takes priority, then project/experience implied skills
  const canonicalFromSection = new Set(skillsFromSection.map((s) => s.canonicalName));

  const additionalFromProjects = normalizeList(
    skillsFromProjects.filter((s) => !canonicalFromSection.has(getCanonicalName(s) || '')),
    'project'
  );

  const additionalFromExperience = normalizeList(
    skillsFromExperience.filter((s) => !canonicalFromSection.has(getCanonicalName(s) || '')),
    'experience'
  );

  const allSkills = [
    ...skillsFromSection,
    ...additionalFromProjects,
    ...additionalFromExperience,
  ];

  // Final deduplication by canonicalName
  const finalSkills = [];
  const seenCanonical = new Set();
  for (const skill of allSkills) {
    if (!seenCanonical.has(skill.canonicalName)) {
      seenCanonical.add(skill.canonicalName);
      finalSkills.push(skill);
    }
  }

  return {
    basicInfo,
    skills: finalSkills,
    projects,
    experience,
    education,
    certifications,
  };
};

module.exports = { analyzeResume, splitIntoSections, extractBasicInfo };
