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

// ─────────────────────────────────────────────────────────────────────────────
// ROLE-SPECIFIC QUESTIONS BANK (8 Role Modes)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_SPECIFIC_QUESTIONS = {
  'frontend developer': [
    {
      text: 'Explain how the browser renders a web page from HTML parsing to pixel painting. How does virtual DOM reconciliation optimize this pipeline?',
      difficulty: 'medium',
      targetSkill: 'frontend-architecture',
      expectedConcepts: ['DOM tree', 'CSSOM', 'render tree', 'reflow/layout', 'repaint', 'virtual DOM diffing'],
    },
    {
      text: 'How do you optimize Core Web Vitals (LCP, FID/INP, CLS) in a modern single-page application? What specific techniques have you implemented?',
      difficulty: 'hard',
      targetSkill: 'web-performance',
      expectedConcepts: ['LCP optimization', 'code splitting', 'lazy loading', 'CLS stabilization', 'image optimization'],
    },
    {
      text: 'Compare client-side rendering (CSR), server-side rendering (SSR), and static site generation (SSG). How do you decide which rendering strategy to adopt?',
      difficulty: 'medium',
      targetSkill: 'rendering-strategies',
      expectedConcepts: ['hydration', 'SEO considerations', 'time to interactive', 'caching strategies', 'server overhead'],
    },
    {
      text: 'How do you manage complex application state across deeply nested components while preventing unnecessary re-renders?',
      difficulty: 'medium',
      targetSkill: 'state-management',
      expectedConcepts: ['selectors', 'memoization', 'context API trade-offs', 'immutability', 'render optimization'],
    },
  ],
  'backend developer': [
    {
      text: 'How do you design a high-throughput RESTful or gRPC microservice that guarantees idempotency and graceful error handling under heavy load?',
      difficulty: 'hard',
      targetSkill: 'api-architecture',
      expectedConcepts: ['idempotency keys', 'retry mechanisms', 'circuit breaker pattern', 'rate limiting', 'distributed tracing'],
    },
    {
      text: 'Explain the trade-offs between SQL relational databases (e.g., PostgreSQL) and NoSQL document stores (e.g., MongoDB) when architecting transactional systems.',
      difficulty: 'medium',
      targetSkill: 'database-design',
      expectedConcepts: ['ACID compliance', 'schema flexibility', 'horizontal scaling', 'read/write patterns', 'indexing strategies'],
    },
    {
      text: 'How would you architect a distributed caching layer using Redis to avoid cache stampede, cache penetration, and cache avalanche?',
      difficulty: 'hard',
      targetSkill: 'caching-strategies',
      expectedConcepts: ['cache invalidation', 'TTL jitter', 'mutex locks', 'bloom filters', 'cache-aside pattern'],
    },
    {
      text: 'How do you handle background asynchronous processing and message delivery guarantees using queueing systems like RabbitMQ or Kafka?',
      difficulty: 'medium',
      targetSkill: 'message-queues',
      expectedConcepts: ['at-least-once delivery', 'dead-letter exchanges', 'worker pools', 'backpressure', 'consumer idempotency'],
    },
  ],
  'full stack developer': [
    {
      text: 'Walk me through how you design an end-to-end feature from the database schema and backend API layer up to the client state management and UI presentation.',
      difficulty: 'medium',
      targetSkill: 'full-stack-architecture',
      expectedConcepts: ['schema modeling', 'API contract', 'authentication flow', 'state management', 'error boundaries'],
    },
    {
      text: 'How do you structure client-server communication for real-time collaborative applications? Compare WebSockets, Server-Sent Events (SSE), and long-polling.',
      difficulty: 'hard',
      targetSkill: 'realtime-systems',
      expectedConcepts: ['bidirectional vs unidirectional', 'heartbeats', 'connection re-establishment', 'scalability across instances', 'state synchronization'],
    },
    {
      text: 'What security vulnerabilities do you proactively defend against in a full-stack application (e.g., XSS, CSRF, SQL Injection, SSRF)?',
      difficulty: 'medium',
      targetSkill: 'application-security',
      expectedConcepts: ['input sanitization', 'parameterized queries', 'CORS & CSP', 'httpOnly cookies', 'rate limiting'],
    },
  ],
  'data analyst': [
    {
      text: 'Describe how you use advanced SQL window functions (e.g., ROW_NUMBER, RANK, LAG/LEAD) to perform cohort retention and time-series trend analysis.',
      difficulty: 'medium',
      targetSkill: 'sql-analysis',
      expectedConcepts: ['partition by', 'order by', 'lag/lead offsets', 'cohort definitions', 'aggregation logic'],
    },
    {
      text: 'How do you validate data integrity and diagnose pipeline anomalies when reporting critical business KPIs to executive stakeholders?',
      difficulty: 'medium',
      targetSkill: 'data-quality',
      expectedConcepts: ['null handling', 'outlier detection', 'reconciliation checks', 'statistical thresholds', 'data lineage'],
    },
    {
      text: 'How do you design an A/B test analysis framework to establish statistical significance without falling into common p-hacking pitfalls?',
      difficulty: 'hard',
      targetSkill: 'experimentation',
      expectedConcepts: ['sample size calculation', 'confidence intervals', 'p-value interpretation', 'type I and II errors', 'practical significance'],
    },
  ],
  'data scientist': [
    {
      text: 'How do you evaluate and address high bias versus high variance in predictive machine learning models? Walk through your regularization and validation strategy.',
      difficulty: 'medium',
      targetSkill: 'machine-learning',
      expectedConcepts: ['L1/L2 regularization', 'cross-validation', 'learning curves', 'feature selection', 'ensemble techniques'],
    },
    {
      text: 'In an imbalanced classification scenario (e.g., fraud detection at 0.1% incidence), which evaluation metrics and sampling strategies do you employ?',
      difficulty: 'hard',
      targetSkill: 'model-evaluation',
      expectedConcepts: ['precision-recall curve', 'PR-AUC / ROC-AUC', 'F1-score', 'SMOTE or undersampling', 'cost-sensitive learning'],
    },
    {
      text: 'How do you detect and mitigate data drift and concept drift once a machine learning model is actively deployed in production?',
      difficulty: 'hard',
      targetSkill: 'mlops',
      expectedConcepts: ['statistical distribution tests', 'KS-test / PSI', 'monitoring prediction latency', 'automated retraining', 'feature store monitoring'],
    },
  ],
  'devops engineer': [
    {
      text: 'How do you design a zero-downtime deployment strategy (e.g., Blue-Green or Canary) in a Kubernetes-orchestrated production environment?',
      difficulty: 'hard',
      targetSkill: 'kubernetes-deployments',
      expectedConcepts: ['readiness and liveness probes', 'traffic splitting', 'automated rollbacks', 'ingress routing', 'database migration safety'],
    },
    {
      text: 'Explain how you structure modular, testable Infrastructure as Code (IaC) using Terraform, including state management and secret isolation.',
      difficulty: 'medium',
      targetSkill: 'infrastructure-as-code',
      expectedConcepts: ['remote state locks', 'module encapsulation', 'workspace separation', 'drift detection', 'secret management'],
    },
    {
      text: 'What observability pillars (metrics, logs, traces) do you establish to achieve sub-minute mean-time-to-detection (MTTD) during major outages?',
      difficulty: 'medium',
      targetSkill: 'observability',
      expectedConcepts: ['distributed tracing', 'log aggregation', 'SLIs/SLOs', 'synthetic monitoring', 'alert fatigue reduction'],
    },
  ],
  'software engineer': [
    {
      text: 'How do you apply SOLID design principles and clean architectural patterns to prevent technical debt in a rapidly evolving codebase?',
      difficulty: 'medium',
      targetSkill: 'software-architecture',
      expectedConcepts: ['single responsibility', 'dependency inversion', 'coupling vs cohesion', 'interface segregation', 'refactoring'],
    },
    {
      text: 'How do you diagnose and resolve performance bottlenecks, memory leaks, and concurrency race conditions in a distributed system?',
      difficulty: 'hard',
      targetSkill: 'system-troubleshooting',
      expectedConcepts: ['profiling tools', 'heap dump analysis', 'thread contention', 'lock contention', 'horizontal vs vertical scaling'],
    },
  ],
  'behavioral/hr': [
    {
      text: 'Describe a situation where you had to manage competing priorities across different cross-functional stakeholders with conflicting deadlines.',
      difficulty: 'medium',
      targetSkill: 'stakeholder-management',
      expectedConcepts: ['prioritization framework', 'transparent communication', 'expectation setting', 'compromise', 'business outcome'],
    },
    {
      text: 'Tell me about a time when a critical bug or outage occurred under your watch. How did you coordinate the response and conduct the post-mortem?',
      difficulty: 'medium',
      targetSkill: 'incident-management',
      expectedConcepts: ['triage under pressure', 'clear status updates', 'blameless post-mortem', 'root cause analysis', 'prevention action items'],
    },
  ],
};

/**
 * Generate introduction / warm-up question tailored to candidate profile and target role.
 */
const generateIntroductionQuestions = (targetRole = 'Software Engineer', candidateProfile = {}) => {
  const name = candidateProfile.basicInfo?.name;
  return [
    {
      text: name
        ? `Welcome, ${name}. To start our conversation, please introduce yourself, walk me through your background in technology, and share what specifically drew you to this ${targetRole} role.`
        : `To start our interview, please introduce yourself, summarize your technical background, and share what specifically drew you to this ${targetRole} role.`,
      type: 'introduction',
      category: 'introduction',
      difficulty: 'easy',
      targetSkill: 'communication',
      skill: 'communication',
      source: 'general_pool',
      sourceProject: null,
      expectedConcepts: ['background summary', 'relevant experience', 'motivation for role', 'clear communication'],
      expectedTopics: ['background summary', 'relevant experience', 'motivation for role', 'clear communication'],
      expectedKeyPoints: ['background summary', 'relevant experience', 'motivation for role', 'clear communication'],
      followUpAllowed: true,
      contextNote: 'Introduction question to establish communication cadence and technical background.',
    },
  ];
};

/**
 * Generate questions based on resume projects.
 * Explicitly references project titles, technology stack, and architectural decisions.
 */
const generateProjectQuestions = (projects = [], skills = [], difficulty = 'medium') => {
  if (!projects.length) return [];
  const questions = [];
  const seen = new Set();

  for (const project of projects.slice(0, 3)) {
    const name = typeof project === 'string' ? project : (project.name || project.title || project);
    if (!name) continue;

    // Identify skills / technologies related to this project
    const projectSkillsRaw = typeof project === 'object'
      ? (project.technologies || project.skills || project.tech || [])
      : skills.slice(0, 3);
    const projectSkills = Array.isArray(projectSkillsRaw) ? projectSkillsRaw : [];
    const techStr = projectSkills.length > 0 ? projectSkills.slice(0, 3).join(', ') : '';

    const templates = [
      {
        text: techStr
          ? `You mentioned building "${name}" using ${techStr}. What architectural decisions did you make when structuring the system, and how did you separate responsibilities across components?`
          : `You mentioned building "${name}" on your resume. Walk me through the core architecture, key design decisions, and how you approached component separation.`,
        expectedConcepts: ['architecture decisions', 'component separation', 'tech stack justification', 'state management', 'trade-offs'],
      },
      {
        text: techStr
          ? `In your "${name}" project built with ${techStr}, what was the most challenging technical roadblock or bug you ran into, and how did you diagnose and solve it?`
          : `While developing "${name}", what was the most challenging technical roadblock you encountered, and what specific steps did you take to resolve it?`,
        expectedConcepts: ['technical obstacle', 'debugging strategy', 'solution implementation', 'trade-offs', 'lessons learned'],
      },
      {
        text: `How did you validate the performance, scalability, and test reliability of the "${name}" project before deployment?`,
        expectedConcepts: ['unit and integration tests', 'benchmarking', 'caching or optimization', 'CI/CD pipeline', 'monitoring'],
      },
    ];

    const selected = shuffle(templates).slice(0, 2);
    for (const t of selected) {
      if (seen.has(t.text)) continue;
      seen.add(t.text);
      questions.push({
        text: t.text,
        type: 'project',
        category: 'project',
        difficulty,
        targetSkill: projectSkills[0] || 'software-architecture',
        skill: projectSkills[0] || 'software-architecture',
        source: 'project',
        sourceProject: name,
        expectedConcepts: t.expectedConcepts,
        expectedTopics: t.expectedConcepts,
        expectedKeyPoints: t.expectedConcepts,
        followUpAllowed: true,
        contextNote: `Generated directly from resume project: ${name}`,
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
    return shuffle(EXPERIENCE_TEMPLATES).slice(0, 1).map((q) => ({
      ...q,
      category: 'resume',
      type: 'resume',
      source: 'resume',
      expectedTopics: q.expectedConcepts || [],
    }));
  }

  const questions = [];
  const positions = experience.slice(0, 2);

  for (const pos of positions) {
    const company = typeof pos === 'string' ? pos : (pos.company || pos.organization || pos.employer || 'your previous company');
    const title = typeof pos === 'object' ? (pos.title || pos.jobTitle || pos.role || 'Software Engineer') : 'Software Engineer';
    const tech = typeof pos === 'object' && Array.isArray(pos.technologies) ? pos.technologies.slice(0, 2).join(' and ') : '';

    const qText = tech
      ? `During your time as ${title} at ${company}, you worked with ${tech}. What was your most significant engineering contribution, and what measurable impact did it have?`
      : `In your role as ${title} at ${company}, what was your most significant technical contribution, and how did it influence team velocity or product quality?`;

    questions.push({
      text: qText,
      type: 'resume',
      category: 'resume',
      difficulty,
      targetSkill: 'professional-experience',
      skill: 'professional-experience',
      source: 'resume',
      sourceProject: null,
      expectedConcepts: ['specific contribution', 'measurable impact', 'technologies used', 'collaboration', 'outcome'],
      expectedTopics: ['specific contribution', 'measurable impact', 'technologies used', 'collaboration', 'outcome'],
      expectedKeyPoints: ['specific contribution', 'measurable impact', 'technologies used', 'collaboration', 'outcome'],
      followUpAllowed: true,
      contextNote: `Generated from candidate work experience at ${company}`,
    });
  }

  return questions;
};

/**
 * Generate behavioral questions.
 */
const generateBehavioralQuestions = (count = 2, difficulty = 'medium') => {
  const filtered = BEHAVIORAL_TEMPLATES.filter((t) => t.difficulty === difficulty || t.difficulty === 'medium');
  return shuffle(filtered).slice(0, count).map((q) => ({
    ...q,
    source: 'general_pool',
    expectedTopics: q.expectedConcepts || [],
  }));
};

/**
 * Generate skill-gap questions for missing or weak required skills.
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

      const note = `${skill} was identified in the job description requirements but not explicitly in your resume.`;
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
        expectedTopics: t.expectedConcepts || [],
        expectedKeyPoints: t.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: note,
      });
    } else {
      const text = `The job description emphasizes hands-on experience with ${skill}. Could you describe your familiarity with ${skill}, any related tools you have used, or how you would ramp up on it rapidly?`;
      if (seen.has(text)) continue;
      seen.add(text);

      const note = `${skill} was identified in the job description requirements but not explicitly in your resume.`;
      questions.push({
        text,
        type: 'skill_gap',
        category: 'skill_gap',
        difficulty: 'easy',
        targetSkill: skill,
        skill: skill,
        source: 'skill_gap',
        sourceProject: null,
        expectedConcepts: [`${skill} fundamentals`, 'analogous technologies', 'learning methodology', 'practical application'],
        expectedTopics: [`${skill} fundamentals`, 'analogous technologies', 'learning methodology', 'practical application'],
        expectedKeyPoints: [`${skill} fundamentals`, 'analogous technologies', 'learning methodology', 'practical application'],
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
    const respText = typeof resp === 'string' ? resp : (resp.text || JSON.stringify(resp));
    questions.push({
      text: `One key responsibility highlighted in this job is: "${respText.substring(0, 160).trim()}". How has your past engineering experience prepared you to handle this effectively?`,
      type: 'job_specific',
      category: 'job_description',
      difficulty,
      targetSkill: 'job-fit',
      skill: 'job-fit',
      source: 'job_description',
      sourceProject: null,
      expectedConcepts: ['relevant experience', 'methodological approach', 'impact', 'alignment with role'],
      expectedTopics: ['relevant experience', 'methodological approach', 'impact', 'alignment with role'],
      expectedKeyPoints: ['relevant experience', 'methodological approach', 'impact', 'alignment with role'],
      followUpAllowed: true,
      contextNote: 'Directly derived from the job description responsibilities.',
    });
  }

  return questions;
};

/**
 * Generate a follow-up question based on a previous question and answer.
 * Called by the adaptive engine when an answer is incomplete or strong.
 */
const generateFollowUpQuestion = (originalQuestion, originalAnswer, missingConcepts = []) => {
  const conceptList = missingConcepts.slice(0, 2).join(' and ');
  const followUpText = conceptList
    ? `Your previous answer touched on several good points, but could you elaborate more deeply on ${conceptList} in this context?`
    : `Could you expand on your previous answer with a concrete technical implementation detail or trade-off analysis?`;

  return {
    text: followUpText,
    type: 'follow_up',
    category: 'follow_up',
    difficulty: originalQuestion.difficulty || 'medium',
    targetSkill: originalQuestion.targetSkill || originalQuestion.skill || 'general',
    skill: originalQuestion.targetSkill || originalQuestion.skill || 'general',
    source: 'previous_answer',
    sourceProject: originalQuestion.sourceProject || null,
    expectedConcepts: missingConcepts.length > 0 ? missingConcepts : ['depth', 'architectural trade-offs', 'concrete implementation'],
    expectedTopics: missingConcepts.length > 0 ? missingConcepts : ['depth', 'architectural trade-offs', 'concrete implementation'],
    expectedKeyPoints: missingConcepts,
    followUpAllowed: false,
    contextNote: `Adaptive follow-up to: "${(originalQuestion.text || '').substring(0, 80)}..."`,
    isAdaptive: true,
  };
};

/**
 * Match role-specific questions for a target role.
 */
const getRoleSpecificQuestions = (targetRole = '', difficulty = 'medium') => {
  const normalized = (targetRole || '').toLowerCase().trim();
  for (const [roleKey, roleQuestions] of Object.entries(ROLE_SPECIFIC_QUESTIONS)) {
    if (normalized.includes(roleKey) || roleKey.includes(normalized)) {
      return roleQuestions.map((q) => ({
        text: q.text,
        type: 'technical',
        category: 'technical',
        difficulty: q.difficulty || difficulty,
        targetSkill: q.targetSkill,
        skill: q.targetSkill,
        source: 'job_description',
        sourceProject: null,
        expectedConcepts: q.expectedConcepts,
        expectedTopics: q.expectedConcepts,
        expectedKeyPoints: q.expectedConcepts,
        followUpAllowed: true,
        contextNote: `Role-specific technical question for ${targetRole}`,
      }));
    }
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATOR — PROGRESSIVE & PERSONALIZED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a full personalized interview question set with progressive flow:
 * Introduction → Resume Experience → Projects → Technical Skills → JD / Skill Gap → Behavioral
 */
const generateInterviewQuestions = ({
  candidateProfile = {},
  jobProfile = {},
  skillAnalysis = {},
  targetRole = 'Software Engineer',
  interviewType = 'mixed',
  difficulty = 'medium',
  totalQuestions = 10,
}) => {
  const max = Math.max(3, Math.min(totalQuestions, 15));
  const questions = [];

  // 1. Extract candidate profile data safely
  const candidateSkills = (candidateProfile.skills || candidateProfile.extractedSkills || []).map(
    (s) => (typeof s === 'string' ? s : (s.canonicalName || s.name || ''))
  ).filter(Boolean);
  const candidateProjects = candidateProfile.projects || [];
  const candidateExperience = candidateProfile.experience || candidateProfile.workExperience || [];

  // 2. Extract job and skill gap data safely
  const matchedSkills = (skillAnalysis.matchedSkills || skillAnalysis.matchedRequiredSkills || []);
  const missingSkills = (skillAnalysis.missingSkills || skillAnalysis.notIdentifiedRequiredSkills || []);
  const responsibilities = jobProfile.responsibilities || [];
  const requiredSkills = jobProfile.requiredSkills || [];

  // ── Stage 1: Introduction (Always first) ──────────────────────────────────
  const introQuestions = generateIntroductionQuestions(targetRole, candidateProfile);
  questions.push(...introQuestions);

  // ── Stage 2: Resume Experience (if available) ──────────────────────────────
  if (candidateExperience.length > 0 && max >= 4) {
    const expQuestions = generateExperienceQuestions(candidateExperience, difficulty);
    if (expQuestions.length > 0) {
      questions.push(expQuestions[0]);
    }
  }

  // ── Stage 3: Resume Project Questions (Referencing specific projects) ──────
  if (candidateProjects.length > 0) {
    const projQuestions = generateProjectQuestions(candidateProjects, candidateSkills, difficulty);
    const maxProjectsToInclude = max >= 10 ? 2 : 1;
    questions.push(...projQuestions.slice(0, maxProjectsToInclude));
  }

  // ── Stage 4: Role-Specific & Matched Technical Questions ───────────────────
  const roleQuestions = getRoleSpecificQuestions(targetRole, difficulty);
  if (roleQuestions.length > 0) {
    questions.push(roleQuestions[0]);
  }

  // Technical questions for candidate's matched skills (Python, React, Node.js, etc.)
  const skillsToAssess = matchedSkills.length > 0 ? matchedSkills : candidateSkills;
  if (skillsToAssess.length > 0) {
    const neededTechCount = Math.max(1, Math.floor((max - questions.length) * 0.5));
    const techQuestions = generateTechnicalQuestions(skillsToAssess, difficulty, 1);
    questions.push(...techQuestions.slice(0, neededTechCount));
  }

  // ── Stage 5: Job Description & Skill Gap Questions ────────────────────────
  if (missingSkills.length > 0 && questions.length < max - 1) {
    const gapQuestions = generateSkillGapQuestions(missingSkills, difficulty);
    if (gapQuestions.length > 0) {
      questions.push(gapQuestions[0]);
    }
  }

  if (responsibilities.length > 0 && questions.length < max - 1) {
    const jobQs = generateJobSpecificQuestions(responsibilities, requiredSkills, difficulty);
    if (jobQs.length > 0) {
      questions.push(jobQs[0]);
    }
  }

  // ── Stage 6: Behavioral STAR Questions ─────────────────────────────────────
  if (questions.length < max) {
    const behCount = Math.max(1, Math.min(2, max - questions.length));
    const behQuestions = generateBehavioralQuestions(behCount, difficulty);
    questions.push(...behQuestions);
  }

  // ── Fallback Fillers if below max ──────────────────────────────────────────
  if (questions.length < max) {
    if (roleQuestions.length > 1) {
      questions.push(...roleQuestions.slice(1, max - questions.length + 1));
    }
  }

  // Deduplicate strictly by question text
  const deduped = [];
  const texts = new Set();
  for (const q of questions) {
    if (!texts.has(q.text)) {
      texts.add(q.text);
      deduped.push({
        ...q,
        expectedTopics: q.expectedTopics || q.expectedConcepts || [],
      });
    }
    if (deduped.length >= max) break;
  }

  // Assign sequential order: 0, 1, 2...
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
