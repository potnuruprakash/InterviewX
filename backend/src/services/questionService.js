/**
 * Phase 3 — Personalized Interview Question Generation Service
 *
 * Generates a personalized question set from:
 *   - Candidate profile (resume analysis)
 *   - Job description profile (JD analysis)
 *   - Skill gap analysis (Phase 2 output)
 *
 * Question types:
 *   technical, project, experience, behavioral, job_specific, skill_gap, follow_up
 */

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const BEHAVIORAL_TEMPLATES = [
  {
    text: 'Tell me about a time when you had to work on a challenging project with a tight deadline. How did you manage your time and priorities?',
    type: 'behavioral',
    category: 'behavioral',
    difficulty: 'medium',
    targetSkill: 'time-management',
    source: 'behavioral',
    expectedConcepts: ['prioritization', 'communication', 'outcome', 'lessons learned', 'time management'],
  },
  {
    text: 'Describe a situation where you disagreed with a team member or manager about a technical decision. How did you handle it?',
    type: 'behavioral',
    category: 'behavioral',
    difficulty: 'medium',
    targetSkill: 'conflict-resolution',
    source: 'behavioral',
    expectedConcepts: ['respectful disagreement', 'data-driven', 'listening', 'compromise', 'outcome'],
  },
  {
    text: 'Tell me about a time you made a significant mistake in a project. What happened, and what did you learn?',
    type: 'behavioral',
    category: 'behavioral',
    difficulty: 'medium',
    targetSkill: 'accountability',
    source: 'behavioral',
    expectedConcepts: ['ownership', 'impact assessment', 'corrective action', 'prevention', 'growth mindset'],
  },
  {
    text: 'Describe a situation where you had to learn a new technology or skill quickly. How did you approach it?',
    type: 'behavioral',
    category: 'behavioral',
    difficulty: 'easy',
    targetSkill: 'learning-agility',
    source: 'behavioral',
    expectedConcepts: ['structured learning', 'resources', 'practice', 'feedback', 'application'],
  },
  {
    text: 'Tell me about a successful collaboration experience. What made it work?',
    type: 'behavioral',
    category: 'behavioral',
    difficulty: 'easy',
    targetSkill: 'teamwork',
    source: 'behavioral',
    expectedConcepts: ['communication', 'shared goals', 'trust', 'contribution', 'outcome'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICAL SKILL TEMPLATES — keyed by normalized skill name
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_QUESTION_TEMPLATES = {
  // JavaScript / TypeScript
  javascript: [
    {
      text: 'Explain the JavaScript event loop. How does it handle asynchronous operations?',
      difficulty: 'medium',
      expectedConcepts: ['call stack', 'callback queue', 'microtask queue', 'event loop', 'promises', 'async/await'],
    },
    {
      text: 'What are closures in JavaScript, and can you provide a real-world use case?',
      difficulty: 'medium',
      expectedConcepts: ['lexical scope', 'inner function', 'outer variable', 'encapsulation', 'module pattern'],
    },
    {
      text: 'What is the difference between `let`, `const`, and `var` in JavaScript?',
      difficulty: 'easy',
      expectedConcepts: ['block scope', 'function scope', 'hoisting', 'reassignment', 'temporal dead zone'],
    },
  ],
  typescript: [
    {
      text: 'How does TypeScript improve JavaScript development? Explain key features you use regularly.',
      difficulty: 'medium',
      expectedConcepts: ['static typing', 'interfaces', 'type inference', 'generics', 'compile-time errors'],
    },
    {
      text: 'What are TypeScript generics, and when would you use them?',
      difficulty: 'hard',
      expectedConcepts: ['type parameter', 'reusability', 'type safety', 'constraints', 'generic functions'],
    },
  ],
  react: [
    {
      text: 'Explain the React component lifecycle. How do hooks like `useEffect` fit into this?',
      difficulty: 'medium',
      expectedConcepts: ['mounting', 'updating', 'unmounting', 'useEffect cleanup', 'dependency array'],
    },
    {
      text: 'How does React state management work? Compare `useState`, `useReducer`, and external libraries like Redux.',
      difficulty: 'hard',
      expectedConcepts: ['local state', 'useReducer', 'Redux', 'Context API', 'state updates', 're-render'],
    },
    {
      text: 'What is React reconciliation, and how does the virtual DOM improve performance?',
      difficulty: 'hard',
      expectedConcepts: ['virtual DOM', 'diffing algorithm', 'fiber', 'reconciliation', 'keys', 'performance'],
    },
  ],
  'node.js': [
    {
      text: 'Explain Node.js non-blocking I/O. How does it differ from traditional server models?',
      difficulty: 'medium',
      expectedConcepts: ['event-driven', 'single thread', 'libuv', 'non-blocking I/O', 'scalability'],
    },
    {
      text: 'How would you handle error handling in a Node.js Express application?',
      difficulty: 'medium',
      expectedConcepts: ['middleware', 'try-catch', 'async errors', 'error handler', 'HTTP status codes'],
    },
  ],
  python: [
    {
      text: 'What are Python generators, and when would you use them over regular functions?',
      difficulty: 'medium',
      expectedConcepts: ['yield', 'lazy evaluation', 'memory efficiency', 'iterator protocol', 'generator expression'],
    },
    {
      text: 'Explain Python decorators with a practical example.',
      difficulty: 'medium',
      expectedConcepts: ['wrapper function', 'higher-order function', '@syntax', 'functools.wraps', 'use cases'],
    },
  ],
  sql: [
    {
      text: 'Explain database normalization. What are the differences between 1NF, 2NF, and 3NF?',
      difficulty: 'medium',
      expectedConcepts: ['1NF atomicity', '2NF partial dependency', '3NF transitive dependency', 'denormalization', 'trade-offs'],
    },
    {
      text: 'How would you optimize a slow SQL query? Walk me through your process.',
      difficulty: 'hard',
      expectedConcepts: ['EXPLAIN', 'index', 'query rewrite', 'joins', 'N+1 problem', 'caching'],
    },
  ],
  mongodb: [
    {
      text: 'What are MongoDB indexes, and how do you decide which fields to index?',
      difficulty: 'medium',
      expectedConcepts: ['B-tree index', 'compound index', 'covered query', 'write overhead', 'selectivity'],
    },
    {
      text: 'Explain the MongoDB aggregation pipeline with an example use case.',
      difficulty: 'hard',
      expectedConcepts: ['$match', '$group', '$project', '$lookup', 'pipeline stages', 'performance'],
    },
  ],
  docker: [
    {
      text: 'Explain the difference between Docker images and containers. How does a Dockerfile work?',
      difficulty: 'easy',
      expectedConcepts: ['image layers', 'container runtime', 'FROM', 'RUN', 'CMD', 'ENTRYPOINT'],
    },
    {
      text: 'How would you set up a multi-container application using Docker Compose?',
      difficulty: 'medium',
      expectedConcepts: ['services', 'networks', 'volumes', 'depends_on', 'environment variables'],
    },
  ],
  kubernetes: [
    {
      text: 'Explain Kubernetes Pods, Deployments, and Services. How do they relate?',
      difficulty: 'hard',
      expectedConcepts: ['Pod', 'Deployment', 'ReplicaSet', 'Service', 'labels', 'selectors'],
    },
  ],
  aws: [
    {
      text: 'What AWS services have you used? Walk me through how you architected a solution with AWS.',
      difficulty: 'medium',
      expectedConcepts: ['EC2', 'S3', 'Lambda', 'RDS', 'architecture decisions', 'cost optimization'],
    },
  ],
  'machine learning': [
    {
      text: 'Explain the bias-variance trade-off in machine learning. How do you manage it?',
      difficulty: 'hard',
      expectedConcepts: ['underfitting', 'overfitting', 'regularization', 'cross-validation', 'model complexity'],
    },
  ],
  'deep learning': [
    {
      text: 'Explain how backpropagation works in neural networks.',
      difficulty: 'hard',
      expectedConcepts: ['gradient descent', 'chain rule', 'loss function', 'weight update', 'activation function'],
    },
  ],
  git: [
    {
      text: 'Explain the difference between `git merge` and `git rebase`. When would you use each?',
      difficulty: 'medium',
      expectedConcepts: ['merge commit', 'linear history', 'rebase', 'conflict resolution', 'golden rule'],
    },
  ],
  java: [
    {
      text: 'Explain Java garbage collection. How does it work, and how can you influence it?',
      difficulty: 'hard',
      expectedConcepts: ['heap', 'young generation', 'old generation', 'GC algorithms', 'memory management'],
    },
  ],
  'c++': [
    {
      text: 'What is the difference between stack and heap memory in C++? When would you use each?',
      difficulty: 'hard',
      expectedConcepts: ['RAII', 'smart pointers', 'malloc/free', 'stack allocation', 'memory leak'],
    },
  ],
  'rest api': [
    {
      text: 'What are the key principles of RESTful API design? How would you design a REST API for a social media application?',
      difficulty: 'medium',
      expectedConcepts: ['statelessness', 'resource-based URLs', 'HTTP methods', 'status codes', 'versioning'],
    },
  ],
  graphql: [
    {
      text: 'What are the advantages of GraphQL over REST? When would you choose one over the other?',
      difficulty: 'medium',
      expectedConcepts: ['over-fetching', 'under-fetching', 'schema', 'resolvers', 'mutations', 'subscriptions'],
    },
  ],
  redis: [
    {
      text: 'How does Redis work as a caching layer? What data structures does it support?',
      difficulty: 'medium',
      expectedConcepts: ['in-memory', 'TTL', 'string', 'hash', 'list', 'set', 'sorted set', 'cache invalidation'],
    },
  ],
  // General programming concepts
  'data structures': [
    {
      text: 'Explain the time complexity of common operations for arrays, linked lists, hash maps, and trees.',
      difficulty: 'medium',
      expectedConcepts: ['O(1) hash lookup', 'O(n) linked list search', 'O(log n) BST', 'O(1) array access', 'trade-offs'],
    },
  ],
  algorithms: [
    {
      text: 'Explain Big O notation and give examples of O(1), O(log n), O(n), and O(n²) algorithms.',
      difficulty: 'medium',
      expectedConcepts: ['time complexity', 'space complexity', 'worst case', 'best case', 'amortized'],
    },
  ],
  'system design': [
    {
      text: 'How would you design a URL shortener service? Walk me through your architecture.',
      difficulty: 'hard',
      expectedConcepts: ['hashing', 'database', 'caching', 'load balancing', 'scalability', 'CDN'],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIENCE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_TEMPLATES = [
  {
    text: 'Walk me through your professional background and the most impactful role you have held.',
    type: 'experience',
    category: 'experience',
    difficulty: 'easy',
    targetSkill: 'professional-experience',
    source: 'experience',
    expectedConcepts: ['impact', 'responsibilities', 'growth', 'achievements', 'relevance'],
  },
  {
    text: 'What is the most complex technical problem you have solved in a professional setting?',
    type: 'experience',
    category: 'experience',
    difficulty: 'medium',
    targetSkill: 'problem-solving',
    source: 'experience',
    expectedConcepts: ['problem definition', 'approach', 'solution', 'outcome', 'trade-offs'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CODING CHALLENGE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const CODING_TEMPLATES = {
  javascript: [
    {
      difficulty: 'easy',
      targetSkill: 'JavaScript',
      text: 'Implement a function `twoSum(nums, target)` that returns indices of the two numbers such that they add up to target. Each input has exactly one solution and you may not use the same element twice. Aim for O(n) time complexity.',
      starterCode: `function twoSum(nums, target) {
  // Your code here
}

// Example: twoSum([2, 7, 11, 15], 9) -> [0, 1]`,
      language: 'javascript',
      expectedConcepts: ['hash map', 'linear time O(n)', 'complement lookup', 'array indexing'],
    },
    {
      difficulty: 'medium',
      targetSkill: 'JavaScript',
      text: 'Implement a custom `promiseAll(promises)` function in JavaScript that replicates `Promise.all`. It should resolve with an array of values when all input promises have resolved, or reject immediately if any promise rejects.',
      starterCode: `function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    // Your code here
  });
}`,
      language: 'javascript',
      expectedConcepts: ['Promise constructor', 'counter tracking', 'rejection short-circuit', 'order preservation'],
    },
    {
      difficulty: 'hard',
      targetSkill: 'JavaScript',
      text: 'Design and implement an LRU (Least Recently Used) Cache with `get(key)` and `put(key, value)` methods. Both operations must run in O(1) average time complexity.',
      starterCode: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    // Initialize data structures
  }

  get(key) {
    // Return value or -1
  }

  put(key, value) {
    // Update or insert key-value pair and evict least recently used if needed
  }
}`,
      language: 'javascript',
      expectedConcepts: ['hash map', 'doubly linked list', 'O(1) operations', 'eviction policy'],
    },
  ],
  react: [
    {
      difficulty: 'easy',
      targetSkill: 'React',
      text: 'Implement a custom React hook `useToggle(initialValue = false)` that returns a boolean state and a toggle function that flips the state. It should also accept an optional boolean to force a specific state.',
      starterCode: `import { useState, useCallback } from 'react';

export function useToggle(initialValue = false) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['useState', 'useCallback', 'boolean toggle', 'custom hook'],
    },
    {
      difficulty: 'medium',
      targetSkill: 'React',
      text: 'Implement a custom React hook `useDebounce(value, delay)` that delays updating the returned value until after the specified delay in milliseconds has elapsed since the last change.',
      starterCode: `import { useState, useEffect } from 'react';

export function useDebounce(value, delay) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['useEffect cleanup', 'setTimeout', 'debouncing', 'state synchronization'],
    },
    {
      difficulty: 'hard',
      targetSkill: 'React',
      text: 'Implement a lightweight state management store `createStore(initialState)` that provides a `useStore()` hook and `setState()` method, ensuring components only re-render when their subscribed state slice changes.',
      starterCode: `export function createStore(initialState) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['pub-sub listener pattern', 'shallow equality check', 'subscription cleanup', 're-render optimization'],
    },
  ],
  python: [
    {
      difficulty: 'easy',
      targetSkill: 'Python',
      text: 'Write a Python function `is_valid_palindrome(s: str) -> bool` that checks if a string is a palindrome, considering only alphanumeric characters and ignoring cases. Aim for O(n) time and O(1) auxiliary space.',
      starterCode: `def is_valid_palindrome(s: str) -> bool:
    # Your code here
    pass`,
      language: 'python',
      expectedConcepts: ['two pointers', 'in-place check', 'character filtering', 'O(1) space'],
    },
    {
      difficulty: 'medium',
      targetSkill: 'Python',
      text: 'Write a Python function `length_of_longest_substring(s: str) -> int` to find the length of the longest substring without repeating characters in O(n) time.',
      starterCode: `def length_of_longest_substring(s: str) -> int:
    # Your code here
    pass`,
      language: 'python',
      expectedConcepts: ['sliding window', 'hash set or map', 'O(n) time', 'window boundaries'],
    },
    {
      difficulty: 'hard',
      targetSkill: 'Python',
      text: 'Design a serialize and deserialize algorithm for a binary tree into a string format and reconstruct the tree from the string format.',
      starterCode: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Codec:
    def serialize(self, root):
        # Return string representation
        pass

    def deserialize(self, data):
        # Reconstruct and return root node
        pass`,
      language: 'python',
      expectedConcepts: ['pre-order traversal or BFS', 'null node markers', 'tree reconstruction', 'recursion'],
    },
  ],
  sql: [
    {
      difficulty: 'easy',
      targetSkill: 'SQL',
      text: 'Write an SQL query to find the second highest salary from the Employee table. If there is no second highest salary, return NULL.',
      starterCode: `-- Table: Employee (id INT, salary INT)
SELECT 
    -- Your query here
;`,
      language: 'sql',
      expectedConcepts: ['DISTINCT', 'OFFSET', 'LIMIT or MAX subquery', 'NULL handling'],
    },
    {
      difficulty: 'medium',
      targetSkill: 'SQL',
      text: 'Write an SQL query to find employees who earn more than the average salary of their department. Return department_name, employee_name, and salary.',
      starterCode: `-- Tables: Employee (id, name, salary, department_id), Department (id, name)
SELECT 
    -- Your query here
;`,
      language: 'sql',
      expectedConcepts: ['JOIN', 'correlated subquery or window function', 'AVG() OVER()', 'GROUP BY'],
    },
    {
      difficulty: 'hard',
      targetSkill: 'SQL',
      text: 'Write an SQL query to find the top 3 highest-earning employees in each department using window functions without gaps in ranking.',
      starterCode: `-- Tables: Employee (id, name, salary, department_id), Department (id, name)
WITH RankedEmployees AS (
    -- Your CTE here
)
SELECT 
    -- Your final select here
;`,
      language: 'sql',
      expectedConcepts: ['DENSE_RANK()', 'PARTITION BY', 'Common Table Expression (CTE)', 'ranking filter'],
    },
  ],
  algorithms: [
    {
      difficulty: 'easy',
      targetSkill: 'Algorithms',
      text: 'Given an array of integers `nums` and an integer `k`, return true if any value appears at least twice within distance `k` of each other.',
      starterCode: `function containsNearbyDuplicate(nums, k) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['sliding window', 'Set or Map lookup', 'index difference <= k', 'O(n) time'],
    },
    {
      difficulty: 'medium',
      targetSkill: 'Algorithms',
      text: 'Given an m x n 2D binary grid representing a map of 1s (land) and 0s (water), return the number of connected islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
      starterCode: `function numIslands(grid) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['Breadth-First Search (BFS) or DFS', 'visited tracking / grid traversal', 'boundary conditions', 'connected components'],
    },
    {
      difficulty: 'hard',
      targetSkill: 'Algorithms',
      text: 'Given a non-empty string `s` and a dictionary `wordDict` containing a list of non-empty words, determine if `s` can be segmented into a space-separated sequence of one or more dictionary words.',
      starterCode: `function wordBreak(s, wordDict) {
  // Your code here
}`,
      language: 'javascript',
      expectedConcepts: ['dynamic programming', 'memoization or tabulation', 'substring matching', 'time complexity'],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const determineDifficulty = (experienceYears, skillCoveragePercentage, interviewDifficulty) => {
  // Use configured difficulty as base, adjust slightly based on profile
  if (interviewDifficulty) return interviewDifficulty;
  if (experienceYears >= 5 || skillCoveragePercentage >= 80) return 'hard';
  if (experienceYears >= 2 || skillCoveragePercentage >= 50) return 'medium';
  return 'easy';
};

const normalizeSkillKey = (skill) => {
  if (!skill) return null;
  return skill.toLowerCase().trim()
    .replace(/\bjs\b/g, 'javascript')
    .replace(/\bnodejs\b/g, 'node.js')
    .replace(/\bnode\b(?!\.js)/g, 'node.js')
    .replace(/\breact\.?js\b/g, 'react')
    .replace(/\bml\b/g, 'machine learning')
    .replace(/\bdl\b/g, 'deep learning')
    .replace(/\bpostgres(ql)?\b/g, 'sql')
    .replace(/\bmysql\b/g, 'sql')
    .replace(/\brest\b/g, 'rest api')
    .replace(/\bk8s\b/g, 'kubernetes');
};

const findTemplatesForSkill = (skill) => {
  const key = normalizeSkillKey(skill);
  if (!key) return [];

  // Exact match
  if (SKILL_QUESTION_TEMPLATES[key]) return SKILL_QUESTION_TEMPLATES[key];

  // Partial match
  for (const [templateKey, templates] of Object.entries(SKILL_QUESTION_TEMPLATES)) {
    if (key.includes(templateKey) || templateKey.includes(key)) return templates;
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate coding questions from candidate skills / matched skills.
 */
const generateCodingQuestions = (matchedSkills = [], difficulty = 'medium', count = 1) => {
  const questions = [];
  const candidateKeys = matchedSkills.map((s) => normalizeSkillKey(s)).filter(Boolean);

  let candidatesPool = [];
  for (const key of candidateKeys) {
    if (CODING_TEMPLATES[key]) {
      candidatesPool.push(...CODING_TEMPLATES[key]);
    }
  }

  if (candidatesPool.length === 0) {
    candidatesPool = [...(CODING_TEMPLATES.javascript || []), ...(CODING_TEMPLATES.algorithms || [])];
  }

  const diffFiltered = candidatesPool.filter((t) => t.difficulty === difficulty);
  const pool = diffFiltered.length > 0 ? diffFiltered : candidatesPool;
  const selected = shuffle(pool).slice(0, count);

  for (const t of selected) {
    questions.push({
      text: t.text,
      type: 'coding',
      category: 'coding',
      difficulty: t.difficulty || difficulty,
      targetSkill: t.targetSkill || 'Programming',
      skill: t.targetSkill || 'Programming',
      source: 'job_description',
      sourceProject: null,
      starterCode: t.starterCode || null,
      language: t.language || 'javascript',
      expectedConcepts: t.expectedConcepts || [],
      expectedKeyPoints: t.expectedConcepts || [],
      followUpAllowed: true,
      contextNote: 'Coding Challenge',
    });
  }

  return questions;
};

/**
 * Generate technical questions for matched/required skills.
 */
const generateTechnicalQuestions = (matchedSkills = [], difficulty = 'medium', maxPerSkill = 1) => {
  const questions = [];
  const seen = new Set();

  for (const skill of matchedSkills) {
    const templates = findTemplatesForSkill(skill);
    if (!templates.length) continue;

    const diffFiltered = templates.filter((t) => t.difficulty === difficulty);
    const pool = diffFiltered.length > 0 ? diffFiltered : templates;
    const selected = shuffle(pool).slice(0, maxPerSkill);

    for (const t of selected) {
      if (seen.has(t.text)) continue;
      seen.add(t.text);
      questions.push({
        text: t.text,
        type: 'technical',
        category: 'technical',
        difficulty: t.difficulty || difficulty,
        targetSkill: skill,
        skill: skill,
        source: 'job_description',
        sourceProject: null,
        expectedConcepts: t.expectedConcepts || [],
        expectedKeyPoints: t.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: null,
      });
    }
  }

  return questions;
};

/**
 * Generate questions based on resume projects.
 */
const generateProjectQuestions = (projects = [], skills = [], difficulty = 'medium') => {
  if (!projects.length) return [];
  const questions = [];
  const seen = new Set();

  for (const project of projects.slice(0, 3)) {
    const name = typeof project === 'string' ? project : (project.name || project.title || project);
    if (!name) continue;

    // Identify skills related to this project
    const projectSkillsRaw = typeof project === 'object'
      ? (project.technologies || project.skills || project.tech || [])
      : skills.slice(0, 3);
    const projectSkills = Array.isArray(projectSkillsRaw) ? projectSkillsRaw : [];

    const templates = [
      {
        text: `Walk me through your ${name} project. What was the core problem it solved, and what architecture decisions did you make?`,
        expectedConcepts: ['problem statement', 'architecture', 'technology choices', 'outcome', 'challenges'],
      },
      {
        text: `What was the most challenging technical decision you made while building ${name}? What were the trade-offs?`,
        expectedConcepts: ['trade-offs', 'alternatives considered', 'decision rationale', 'outcome', 'learning'],
      },
      {
        text: `How did you handle testing and quality assurance in the ${name} project?`,
        expectedConcepts: ['unit tests', 'integration tests', 'QA process', 'coverage', 'CI/CD'],
      },
    ];

    if (projectSkills.length > 0) {
      const skillStr = projectSkills.slice(0, 2).join(' and ');
      templates.push({
        text: `In your ${name} project, you used ${skillStr}. How did you leverage these technologies, and what specific challenges did you encounter?`,
        expectedConcepts: ['implementation details', 'specific challenges', 'solutions', 'learnings', 'performance'],
      });
    }

    const selected = shuffle(templates).slice(0, 2);
    for (const t of selected) {
      if (seen.has(t.text)) continue;
      seen.add(t.text);
      questions.push({
        text: t.text,
        type: 'project',
        category: 'project',
        difficulty,
        targetSkill: projectSkills[0] || 'project-experience',
        skill: projectSkills[0] || 'project-experience',
        source: 'resume',
        sourceProject: name,
        expectedConcepts: t.expectedConcepts,
        expectedKeyPoints: t.expectedConcepts,
        followUpAllowed: true,
        contextNote: null,
      });
    }
  }

  return questions;
};

/**
 * Generate experience questions from resume experience section.
 */
const generateExperienceQuestions = (experience = [], difficulty = 'medium') => {
  if (!experience.length) {
    return shuffle(EXPERIENCE_TEMPLATES).slice(0, 1);
  }

  const questions = [];
  const positions = experience.slice(0, 2);

  for (const pos of positions) {
    const company = typeof pos === 'string' ? pos : (pos.company || pos.employer || 'your previous role');
    const title = typeof pos === 'object' ? (pos.title || pos.role || 'software engineer') : 'software engineer';

    questions.push({
      text: `In your role as ${title} at ${company}, what was your most significant contribution, and how did it impact the team or product?`,
      type: 'experience',
      category: 'experience',
      difficulty,
      targetSkill: 'professional-experience',
      skill: 'professional-experience',
      source: 'experience',
      sourceProject: null,
      expectedConcepts: ['specific contribution', 'measurable impact', 'skills used', 'collaboration', 'outcome'],
      expectedKeyPoints: ['specific contribution', 'measurable impact', 'skills used', 'collaboration', 'outcome'],
      followUpAllowed: true,
      contextNote: null,
    });
  }

  return questions;
};

/**
 * Generate behavioral questions.
 */
const generateBehavioralQuestions = (count = 2, difficulty = 'medium') => {
  const filtered = BEHAVIORAL_TEMPLATES.filter((t) => t.difficulty === difficulty || t.difficulty === 'medium');
  return shuffle(filtered).slice(0, count);
};

/**
 * Generate skill-gap questions for missing required skills.
 */
const generateSkillGapQuestions = (missingSkills = [], difficulty = 'medium') => {
  if (!missingSkills.length) return [];
  const questions = [];
  const seen = new Set();

  for (const skill of missingSkills.slice(0, 3)) {
    const templates = findTemplatesForSkill(skill);

    if (templates.length > 0) {
      const t = shuffle(templates)[0];
      if (seen.has(t.text)) continue;
      seen.add(t.text);

      const note = `${skill} was not identified in the provided resume, so this question assesses the candidate's familiarity with it.`;
      questions.push({
        text: t.text,
        type: 'skill_gap',
        category: 'skill_gap',
        difficulty: t.difficulty || difficulty,
        targetSkill: skill,
        skill: skill,
        source: 'skill_gap',
        sourceProject: null,
        expectedConcepts: t.expectedConcepts || [],
        expectedKeyPoints: t.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: note,
      });
    } else {
      // No template — generic skill gap question
      const text = `The role requires experience with ${skill}. Could you describe your familiarity with ${skill}, any exposure you have had to it, or how you would approach learning it?`;
      if (seen.has(text)) continue;
      seen.add(text);

      const note = `${skill} was not identified in the provided resume, so this question assesses the candidate's familiarity with it.`;
      questions.push({
        text,
        type: 'skill_gap',
        category: 'skill_gap',
        difficulty: 'easy',
        targetSkill: skill,
        skill: skill,
        source: 'skill_gap',
        sourceProject: null,
        expectedConcepts: [`${skill} basics`, `${skill} use cases`, 'learning approach'],
        expectedKeyPoints: [`${skill} basics`, `${skill} use cases`, 'learning approach'],
        followUpAllowed: true,
        contextNote: note,
      });
    }
  }

  return questions;
};

/**
 * Generate job-specific questions from JD responsibilities.
 */
const generateJobSpecificQuestions = (responsibilities = [], requiredSkills = [], difficulty = 'medium') => {
  if (!responsibilities.length && !requiredSkills.length) return [];
  const questions = [];

  if (responsibilities.length > 0) {
    const resp = responsibilities[0];
    const respText = typeof resp === 'string' ? resp : JSON.stringify(resp);
    questions.push({
      text: `The role involves: "${respText.substring(0, 150)}". Can you describe how your experience has prepared you for this responsibility?`,
      type: 'job_specific',
      category: 'conceptual',
      difficulty,
      targetSkill: 'job-fit',
      skill: 'job-fit',
      source: 'job_description',
      sourceProject: null,
      expectedConcepts: ['relevant experience', 'specific examples', 'alignment', 'impact', 'skills'],
      expectedKeyPoints: ['relevant experience', 'specific examples', 'alignment', 'impact', 'skills'],
      followUpAllowed: true,
      contextNote: null,
    });
  }

  return questions;
};

/**
 * Generate a follow-up question based on a previous question and answer.
 * Called by the adaptive engine when an answer is incomplete.
 */
const generateFollowUpQuestion = (originalQuestion, originalAnswer, missingConcepts = []) => {
  const conceptList = missingConcepts.slice(0, 2).join(' and ');
  const followUpText = conceptList
    ? `Your previous answer covered some aspects, but could you elaborate on ${conceptList} in more detail?`
    : `Could you expand on your previous answer? Please provide more specific examples or technical details.`;

  return {
    text: followUpText,
    type: 'follow_up',
    category: 'follow_up',
    difficulty: originalQuestion.difficulty || 'medium',
    targetSkill: originalQuestion.targetSkill || originalQuestion.skill || 'general',
    skill: originalQuestion.targetSkill || originalQuestion.skill || 'general',
    source: 'behavioral',
    sourceProject: originalQuestion.sourceProject || null,
    expectedConcepts: missingConcepts,
    expectedKeyPoints: missingConcepts,
    followUpAllowed: false,
    contextNote: `Follow-up to: "${(originalQuestion.text || '').substring(0, 80)}..."`,
    isAdaptive: true,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a full personalized interview question set.
 *
 * @param {Object} params
 * @param {Object} params.candidateProfile   Resume analysis result
 * @param {Object} params.jobProfile         JD analysis result
 * @param {Object} params.skillAnalysis      Skill gap analysis result
 * @param {string} params.interviewType      'mixed'|'technical'|'behavioral'|'hr'
 * @param {string} params.difficulty         'easy'|'medium'|'hard'
 * @param {number} params.totalQuestions     Target count (max 15)
 * @returns {Array} Array of question objects ready for DB insertion
 */
const generateInterviewQuestions = ({
  candidateProfile = {},
  jobProfile = {},
  skillAnalysis = {},
  interviewType = 'mixed',
  difficulty = 'medium',
  totalQuestions = 10,
}) => {
  const max = Math.min(totalQuestions, 15);
  const questions = [];

  // Extract candidate data safely
  const candidateSkills = candidateProfile.skills || candidateProfile.extractedSkills || [];
  const candidateProjects = candidateProfile.projects || [];
  const candidateExperience = candidateProfile.experience || candidateProfile.workExperience || [];

  // Extract job data safely
  const requiredSkills = jobProfile.requiredSkills || skillAnalysis.notIdentifiedRequiredSkills
    ? [...(skillAnalysis.matchedRequiredSkills || []), ...(skillAnalysis.notIdentifiedRequiredSkills || [])]
    : [];
  const responsibilities = jobProfile.responsibilities || [];

  // Extract skill gap data
  const matchedSkills = skillAnalysis.matchedRequiredSkills || [];
  const missingSkills = skillAnalysis.notIdentifiedRequiredSkills || [];

  // Determine allocation based on interview type
  let allocation;
  if (interviewType === 'technical') {
    allocation = { technical: 0.6, project: 0.2, experience: 0.1, behavioral: 0.1, skillGap: 0.2 };
  } else if (interviewType === 'behavioral') {
    allocation = { technical: 0.2, project: 0.1, experience: 0.2, behavioral: 0.5, skillGap: 0.1 };
  } else if (interviewType === 'hr') {
    allocation = { technical: 0.1, project: 0.1, experience: 0.2, behavioral: 0.4, skillGap: 0.2 };
  } else {
    // mixed
    allocation = { technical: 0.35, project: 0.2, experience: 0.1, behavioral: 0.2, skillGap: 0.15 };
  }

  // Generate each type
  const techCount = Math.max(1, Math.round(max * allocation.technical));
  const projCount = Math.max(0, Math.round(max * allocation.project));
  const expCount = Math.max(0, Math.round(max * allocation.experience));
  const behCount = Math.max(1, Math.round(max * allocation.behavioral));
  const gapCount = Math.max(0, Math.round(max * allocation.skillGap));

  // Technical — from matched skills
  if (matchedSkills.length > 0) {
    const techQuestions = generateTechnicalQuestions(matchedSkills, difficulty, Math.ceil(techCount / Math.max(matchedSkills.length, 1)));
    questions.push(...techQuestions.slice(0, techCount));
  }

  // Project — from resume projects
  if (projCount > 0 && candidateProjects.length > 0) {
    const projQuestions = generateProjectQuestions(candidateProjects, candidateSkills, difficulty);
    questions.push(...projQuestions.slice(0, projCount));
  }

  // Experience — from resume experience
  if (expCount > 0) {
    const expQuestions = generateExperienceQuestions(candidateExperience, difficulty);
    questions.push(...expQuestions.slice(0, expCount));
  }

  // Behavioral
  const behQuestions = generateBehavioralQuestions(behCount, difficulty);
  questions.push(...behQuestions.slice(0, behCount));

  // Coding challenges — for technical / developer roles
  const roleText = `${jobProfile.targetRole || ''} ${jobProfile.title || ''} ${candidateProfile.targetRole || ''}`;
  const isDevRole = /developer|engineer|full\s*stack|frontend|backend|web|software|programmer|coder|sde/i.test(roleText) ||
    candidateSkills.some((s) => /javascript|react|python|node|sql|typescript|java|c\+\+|golang/i.test(String(s)));
  const includeCoding = (interviewType === 'technical' || (interviewType === 'mixed' && isDevRole)) && interviewType !== 'behavioral' && interviewType !== 'hr';
  const codingCount = includeCoding ? Math.min(2, Math.max(1, Math.round(max * 0.2))) : 0;

  if (codingCount > 0) {
    const codingQuestions = generateCodingQuestions([...matchedSkills, ...candidateSkills], difficulty, codingCount);
    questions.push(...codingQuestions);
  }

  // Skill gap — from missing required skills
  if (gapCount > 0 && missingSkills.length > 0) {
    const gapQuestions = generateSkillGapQuestions(missingSkills, difficulty);
    questions.push(...gapQuestions.slice(0, gapCount));
  }

  // Job-specific — fill remaining slots
  const remaining = max - questions.length;
  if (remaining > 0) {
    const jobQs = generateJobSpecificQuestions(responsibilities, requiredSkills, difficulty);
    questions.push(...jobQs.slice(0, remaining));
  }

  // Deduplicate and trim to max
  const deduped = [];
  const texts = new Set();
  for (const q of shuffle(questions)) {
    if (!texts.has(q.text)) {
      texts.add(q.text);
      deduped.push(q);
    }
    if (deduped.length >= max) break;
  }

  // Assign order
  return deduped.map((q, i) => ({ ...q, order: i }));
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY STATIC BANK (Phase 1 fallback)
// ─────────────────────────────────────────────────────────────────────────────

const STATIC_BANK = {
  technical: [
    {
      text: 'Can you explain the difference between synchronous and asynchronous programming? Provide an example where async programming would be beneficial.',
      category: 'technical',
      difficulty: 'medium',
      skill: 'programming-concepts',
      expectedKeyPoints: ['blocking vs non-blocking', 'event loop', 'callbacks/promises/async-await', 'I/O operations'],
    },
    {
      text: 'What are the key principles of RESTful API design? How would you design a REST API for a social media application?',
      category: 'technical',
      difficulty: 'medium',
      skill: 'system-design',
      expectedKeyPoints: ['statelessness', 'resource-based URLs', 'HTTP methods', 'status codes', 'versioning'],
    },
    {
      text: 'Explain the concept of database indexing. When would you use an index, and what are its trade-offs?',
      category: 'technical',
      difficulty: 'medium',
      skill: 'databases',
      expectedKeyPoints: ['faster reads', 'slower writes', 'B-tree index', 'composite index', 'when to avoid'],
    },
    {
      text: 'Describe the concept of Big O notation. What is the time complexity of common data structure operations?',
      category: 'technical',
      difficulty: 'medium',
      skill: 'algorithms',
      expectedKeyPoints: ['O(1), O(n), O(log n)', 'worst case', 'space complexity', 'array O(1) access'],
    },
    {
      text: 'What are the SOLID principles of object-oriented design?',
      category: 'technical',
      difficulty: 'medium',
      skill: 'software-design',
      expectedKeyPoints: ['SRP, OCP, LSP, ISP, DIP', 'one reason to change', 'cohesion'],
    },
  ],
  behavioral: [...BEHAVIORAL_TEMPLATES],
  project: [
    {
      text: 'Walk me through your most technically challenging project.',
      category: 'project',
      difficulty: 'medium',
      skill: 'project-experience',
      expectedKeyPoints: ['problem definition', 'tech stack', 'architecture', 'outcome', 'learnings'],
    },
  ],
};

/**
 * Legacy static question selection (Phase 1 fallback).
 */
const getQuestionsForInterview = (interviewType = 'mixed', difficulty = 'medium', count = 10) => {
  let pool = [];
  if (interviewType === 'mixed') {
    pool = [...STATIC_BANK.technical, ...STATIC_BANK.behavioral, ...STATIC_BANK.project];
  } else {
    pool = STATIC_BANK[interviewType] || STATIC_BANK.technical;
  }
  const filtered = pool.filter((q) => q.difficulty === difficulty);
  const questionPool = filtered.length >= count ? filtered : pool;
  return [...questionPool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, questionPool.length));
};

module.exports = {
  generateInterviewQuestions,
  generateTechnicalQuestions,
  generateProjectQuestions,
  generateExperienceQuestions,
  generateBehavioralQuestions,
  generateSkillGapQuestions,
  generateJobSpecificQuestions,
  generateFollowUpQuestion,
  getQuestionsForInterview,
  STATIC_BANK,
};
