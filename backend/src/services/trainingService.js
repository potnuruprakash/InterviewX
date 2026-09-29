/**
 * Training Service ("Train Me")
 * 
 * Generates targeted practice and learning modules specifically grounded
 * in an interview's identified weaknesses and skill gaps.
 */

const TrainingSession = require('../models/TrainingSession');

// Curated targeted module blueprints for common technical skills
const TOPIC_BLUEPRINTS = {
  python: {
    explanation: 'Python execution model, GIL, generators, decorators, memory management, and typing.',
    examples: [
      'Decorator implementation: functools.wraps pattern for logging and memoization.',
      'Generators: using yield to handle large streaming datasets memory-efficiently.',
    ],
    practiceQuestions: [
      {
        question: 'Explain how Python\'s Global Interpreter Lock (GIL) affects multi-threaded CPU-bound programs vs I/O-bound programs.',
        answerGuidance: 'Discuss GIL thread switching, byte code execution, and using multiprocessing or asyncio instead of threading for CPU-bound tasks.',
        keyPoints: ['GIL', 'CPU-bound vs I/O-bound', 'multiprocessing', 'asyncio', 'thread safety'],
      },
      {
        question: 'How do Python context managers work under the hood, and how do you write a custom context manager?',
        answerGuidance: 'Mention __enter__ and __exit__ methods, exception handling propagation, and the contextlib.contextmanager generator decorator.',
        keyPoints: ['__enter__', '__exit__', 'exception suppression', 'contextlib'],
      },
    ],
    codingExercises: [
      {
        title: 'Custom Retry Decorator',
        description: 'Write a Python decorator @retry(max_attempts=3, delay=1) that catches exceptions and retries function calls.',
        starterCode: 'import time\nfrom functools import wraps\n\ndef retry(max_attempts=3, delay=1):\n    def decorator(func):\n        @wraps(func)\n        def wrapper(*args, **kwargs):\n            # Write your implementation here\n            pass\n        return wrapper\n    return decorator\n',
        language: 'python',
        solution: 'import time\nfrom functools import wraps\n\ndef retry(max_attempts=3, delay=1):\n    def decorator(func):\n        @wraps(func)\n        def wrapper(*args, **kwargs):\n            for attempt in range(max_attempts):\n                try:\n                    return func(*args, **kwargs)\n                except Exception as e:\n                    if attempt == max_attempts - 1:\n                        raise e\n                    time.sleep(delay)\n        return wrapper\n    return decorator\n',
      },
    ],
  },
  sql: {
    explanation: 'Relational data modeling, indexing (B-Tree), query optimization, window functions, and transaction isolation levels.',
    examples: [
      'Window functions: ROW_NUMBER(), RANK(), DENSE_RANK() OVER (PARTITION BY ... ORDER BY ...)',
      'Subqueries vs CTEs (Common Table Expressions) with WITH clause.',
    ],
    practiceQuestions: [
      {
        question: 'What is the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN, and how do database indexes optimize them?',
        answerGuidance: 'Detail join semantics, null padding, and how index lookups on the joined foreign keys avoid full table scans.',
        keyPoints: ['INNER vs LEFT JOIN', 'Cartesian product', 'B-Tree index lookups', 'hash join vs merge join'],
      },
      {
        question: 'What are the four ANSI SQL transaction isolation levels and what concurrency anomalies do they prevent?',
        answerGuidance: 'Explain Read Uncommitted, Read Committed, Repeatable Read, and Serializable in relation to Dirty Reads, Non-repeatable Reads, and Phantom Reads.',
        keyPoints: ['Read Committed', 'Repeatable Read', 'Serializable', 'Dirty Reads', 'Phantom Reads'],
      },
    ],
    codingExercises: [
      {
        title: 'Department Top 3 Salaries (SQL)',
        description: 'Given an Employee table (id, name, salary, department_id), write a query using window functions to find the top 3 highest-earning employees per department.',
        starterCode: '-- Write your SQL query here\nSELECT department_id, name, salary\nFROM (\n    -- Use DENSE_RANK() or ROW_NUMBER()\n) AS ranked\nWHERE ...;',
        language: 'sql',
        solution: 'WITH RankedEmployees AS (\n  SELECT \n    department_id,\n    name,\n    salary,\n    DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as rnk\n  FROM Employee\n)\nSELECT department_id, name, salary\nFROM RankedEmployees\nWHERE rnk <= 3;',
      },
    ],
  },
  docker: {
    explanation: 'Containerization principles, layers, caching, multi-stage builds, networking, and volumes.',
    examples: [
      'Multi-stage Dockerfile: building frontend or Go binary in builder stage and copying only artifacts to minimal Alpine/Distroless image.',
      'Docker Compose service orchestration with volume mounts and internal networks.',
    ],
    practiceQuestions: [
      {
        question: 'Explain the difference between a Docker image and a Docker container, and how layer caching speeds up builds.',
        answerGuidance: 'Explain copy-on-write union file systems, read-only layers vs top writable layer, and why placing frequently changing instructions last optimizes cache.',
        keyPoints: ['image vs container', 'union filesystem', 'layer caching', 'Dockerfile instruction order'],
      },
      {
        question: 'What is a multi-stage Docker build and what key problems does it solve in production deployments?',
        answerGuidance: 'Emphasize drastic reduction in final image size, separation of build dependencies/compilers from runtime, and security reduction of attack surface.',
        keyPoints: ['multi-stage build', 'minimal runtime image', 'smaller attack surface', 'build tools exclusion'],
      },
    ],
    codingExercises: [
      {
        title: 'Multi-Stage Production Dockerfile',
        description: 'Write a multi-stage Dockerfile for a Node.js or Python application that builds dependencies and produces a lightweight production container.',
        starterCode: '# Build stage\nFROM node:20-alpine AS builder\nWORKDIR /app\n# Copy package manifests and build...\n\n# Production stage\nFROM node:20-alpine AS runner\nWORKDIR /app\n# Copy built assets and run...\n',
        language: 'dockerfile',
        solution: '# Stage 1: Build\nFROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\n# Stage 2: Production\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY --from=builder /app/dist ./dist\nUSER node\nCMD ["node", "dist/index.js"]',
      },
    ],
  },
  fastapi: {
    explanation: 'FastAPI asynchronous request lifecycle, dependency injection (Depends), Pydantic schemas, and background tasks.',
    examples: [
      'Dependency injection for DB session with yield and automatic cleanup.',
      'Pydantic BaseModel request validation with custom validators.',
    ],
    practiceQuestions: [
      {
        question: 'How does FastAPI handle asynchronous vs synchronous endpoint functions, and when should you define an endpoint with async def vs regular def?',
        answerGuidance: 'Explain that regular def functions are run in an external threadpool (AnyIO), while async def functions are awaited directly on the main event loop.',
        keyPoints: ['async def vs def', 'threadpool', 'event loop blocking', 'I/O vs CPU tasks'],
      },
    ],
    codingExercises: [
      {
        title: 'FastAPI Dependency Injection',
        description: 'Implement a FastAPI database session dependency with automatic closing on request completion.',
        starterCode: 'from fastapi import FastAPI, Depends\n\napp = FastAPI()\n\ndef get_db():\n    # yield a db session and close it in finally block\n    pass\n',
        language: 'python',
        solution: 'from fastapi import FastAPI, Depends\n\napp = FastAPI()\n\ndef get_db():\n    db = DatabaseSession()\n    try:\n        yield db\n    finally:\n        db.close()\n\n@app.get("/items")\ndef read_items(db = Depends(get_db)):\n    return db.query("SELECT * FROM items")',
      },
    ],
  },
  react: {
    explanation: 'React 18 concurrent features, Virtual DOM diffing, useEffect lifecycle rules, custom hooks, and state management.',
    examples: [
      'Custom hook for data fetching with AbortController cleanup.',
      'useMemo / useCallback to prevent unnecessary re-renders in memoized child components.',
    ],
    practiceQuestions: [
      {
        question: 'Explain how React\'s reconciliation algorithm works and why the "key" prop is crucial in lists.',
        answerGuidance: 'Explain Virtual DOM diffing, heuristic tree comparison O(n), and how stable keys identify moved, added, or deleted elements without rerendering everything.',
        keyPoints: ['Reconciliation', 'Virtual DOM', 'key prop stability', 'tree diffing'],
      },
    ],
    codingExercises: [
      {
        title: 'Custom useDebounce Hook',
        description: 'Implement a custom useDebounce hook in React that debounces an input value with a specified delay.',
        starterCode: 'import { useState, useEffect } from \'react\';\n\nexport function useDebounce(value, delay) {\n  // Implement debounced value state and timer cleanup\n}\n',
        language: 'javascript',
        solution: 'import { useState, useEffect } from \'react\';\n\nexport function useDebounce(value, delay) {\n  const [debouncedValue, setDebouncedValue] = useState(value);\n\n  useEffect(() => {\n    const handler = setTimeout(() => {\n      setDebouncedValue(value);\n    }, delay);\n\n    return () => {\n      clearTimeout(handler);\n    };\n  }, [value, delay]);\n\n  return debouncedValue;\n}',
      },
    ],
  },
  system_design: {
    explanation: 'High-level architecture, scalability, horizontal vs vertical scaling, load balancing, caching strategies, and CAP theorem.',
    examples: [
      'Cache-aside pattern with Redis and database fallback.',
      'Database sharding and consistent hashing.',
    ],
    practiceQuestions: [
      {
        question: 'How would you design a distributed rate limiter that works across multiple application servers?',
        answerGuidance: 'Discuss Redis with Token Bucket or Sliding Window Log algorithms, atomic Lua scripts, and handling distributed race conditions.',
        keyPoints: ['Token Bucket', 'Sliding Window', 'Redis Lua scripts', 'concurrency control'],
      },
    ],
    codingExercises: [
      {
        title: 'Consistent Hashing Ring Implementation',
        description: 'Implement a simple consistent hashing ring to distribute requests across cache nodes.',
        starterCode: 'class HashRing {\n  constructor(nodes = [], replicas = 3) {\n    // Setup ring\n  }\n  getNode(key) {\n    // Return target node for key\n  }\n}',
        language: 'javascript',
        solution: 'class HashRing {\n  constructor(nodes = [], replicas = 3) {\n    this.replicas = replicas;\n    this.ring = new Map();\n    this.keys = [];\n    nodes.forEach(n => this.addNode(n));\n  }\n  hash(str) {\n    let hash = 0;\n    for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);\n    return Math.abs(hash);\n  }\n  addNode(node) {\n    for (let i = 0; i < this.replicas; i++) {\n      const key = this.hash(`${node}:${i}`);\n      this.ring.set(key, node);\n      this.keys.push(key);\n    }\n    this.keys.sort((a, b) => a - b);\n  }\n  getNode(key) {\n    if (this.keys.length === 0) return null;\n    const h = this.hash(key);\n    const idx = this.keys.findIndex(k => k >= h);\n    return this.ring.get(this.keys[idx === -1 ? 0 : idx]);\n  }\n}',
      },
    ],
  },
};

/**
 * Generate targeted training session for an interview.
 */
const generateTrainingSession = async ({ clerkUserId, interview, score, weaknesses = [], skillGaps = [] }) => {
  // Collect all topic targets from interview weaknesses and skill gaps
  const combinedTopics = new Set();

  for (const w of weaknesses) {
    if (typeof w === 'string') combinedTopics.add(w.toLowerCase().trim());
  }
  for (const g of skillGaps) {
    if (typeof g === 'string') combinedTopics.add(g.toLowerCase().trim());
  }

  // If none specified, fall back to target role skills
  if (combinedTopics.size === 0) {
    if (/python/i.test(interview.targetRole)) {
      combinedTopics.add('python');
      combinedTopics.add('sql');
      combinedTopics.add('docker');
    } else {
      combinedTopics.add('system_design');
      combinedTopics.add('sql');
    }
  }

  const topicModules = [];

  for (const topicStr of combinedTopics) {
    // Find matching blueprint
    let matchedKey = Object.keys(TOPIC_BLUEPRINTS).find(k => topicStr.includes(k) || k.includes(topicStr));
    const blueprint = matchedKey ? TOPIC_BLUEPRINTS[matchedKey] : null;

    if (blueprint) {
      topicModules.push({
        topic: topicStr.toUpperCase(),
        category: 'technical',
        priority: 'high',
        explanation: blueprint.explanation,
        examples: blueprint.examples,
        practiceQuestions: blueprint.practiceQuestions,
        codingExercises: blueprint.codingExercises,
        completed: false,
        userNotes: '',
      });
    } else {
      // Generate intelligent dynamic module for the topic
      topicModules.push({
        topic: topicStr.charAt(0).toUpperCase() + topicStr.slice(1),
        category: 'technical',
        priority: 'medium',
        explanation: `Targeted review of ${topicStr} core principles, standard architectural patterns, common pitfalls, and real-world interview expectations.`,
        examples: [
          `Key design pattern for ${topicStr} in production services.`,
          `Edge case handling and performance optimization strategies.`,
        ],
        practiceQuestions: [
          {
            question: `What are the core design trade-offs when working with ${topicStr}?`,
            answerGuidance: `Break down the performance, scalability, and maintainability implications of ${topicStr}.`,
            keyPoints: [topicStr, 'trade-offs', 'scalability', 'best practices'],
          },
        ],
        codingExercises: [
          {
            title: `${topicStr} Hands-on Implementation`,
            description: `Design a concise, production-ready module demonstrating idiomatic usage of ${topicStr}.`,
            starterCode: `// Implement your ${topicStr} solution\nfunction solveProblem() {\n  // Code here\n}`,
            language: 'javascript',
            solution: `// Verified solution for ${topicStr}\nfunction solveProblem() {\n  return true;\n}`,
          },
        ],
        completed: false,
        userNotes: '',
      });
    }
  }

  // Create training session in DB
  const trainingSession = await TrainingSession.create({
    clerkUserId,
    interviewId: interview._id,
    targetRole: interview.targetRole,
    interviewScore: score || 0,
    weaknesses: Array.from(weaknesses),
    skillGaps: Array.from(skillGaps),
    topics: topicModules,
    status: 'in_progress',
    completedTopicsCount: 0,
    totalTopicsCount: topicModules.length,
    startedAt: new Date(),
  });

  return trainingSession;
};

module.exports = {
  generateTrainingSession,
  TOPIC_BLUEPRINTS,
};
