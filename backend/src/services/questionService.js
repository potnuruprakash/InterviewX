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
    {
      text: 'How does V8 optimize JavaScript execution under the hood? Explain hidden classes, inline caching, and memory management in V8.',
      difficulty: 'hard',
      expectedConcepts: ['hidden classes', 'inline caching', 'JIT compilation', 'Ignition and TurboFan', 'Scavenger GC'],
    },
    {
      text: 'Explain prototypal inheritance and prototype pollution vulnerabilities in JavaScript, and how to defend against them.',
      difficulty: 'hard',
      expectedConcepts: ['prototype chain', 'Object.create', '__proto__', 'prototype pollution', 'Object.freeze'],
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
    {
      text: 'How do Kubernetes ConfigMaps and Secrets differ, and how do you securely inject them into pods?',
      difficulty: 'medium',
      expectedConcepts: ['ConfigMaps', 'Secrets', 'environment variables', 'volume mounts', 'base64 encoding', 'RBAC'],
    },
    {
      text: 'What is an Ingress controller in Kubernetes, and how does it route external traffic to internal services?',
      difficulty: 'medium',
      expectedConcepts: ['Ingress', 'Ingress controller', 'routing rules', 'TLS termination', 'ClusterIP', 'NodePort'],
    },
    {
      text: 'Explain how Kubernetes Horizontal Pod Autoscaler (HPA) works and what metrics it monitors.',
      difficulty: 'hard',
      expectedConcepts: ['HPA', 'CPU utilization', 'memory metrics', 'custom metrics', 'scale up/down', 'metrics-server'],
    },
  ],
  aws: [
    {
      text: 'What AWS services have you used? Walk me through how you architected a solution with AWS.',
      difficulty: 'medium',
      expectedConcepts: ['EC2', 'S3', 'Lambda', 'RDS', 'architecture decisions', 'cost optimization'],
    },
    {
      text: 'How do IAM roles, policies, and instance profiles ensure the principle of least privilege in AWS?',
      difficulty: 'medium',
      expectedConcepts: ['IAM roles', 'policies', 'least privilege', 'temporary credentials', 'STS', 'trust relationships'],
    },
    {
      text: 'Explain the trade-offs between AWS Lambda serverless computing and Amazon ECS/EKS container deployments.',
      difficulty: 'hard',
      expectedConcepts: ['cold starts', 'cost per execution', 'statefulness', 'concurrency limits', 'long-running tasks', 'ECS/EKS'],
    },
    {
      text: 'How would you architect a high-availability, multi-region disaster recovery strategy on AWS?',
      difficulty: 'hard',
      expectedConcepts: ['Route 53', 'cross-region replication', 'RTO', 'RPO', 'active-active', 'active-passive'],
    },
  ],
  'machine learning': [
    {
      text: 'Explain the bias-variance trade-off in machine learning. How do you manage it?',
      difficulty: 'hard',
      expectedConcepts: ['underfitting', 'overfitting', 'regularization', 'cross-validation', 'model complexity'],
    },
    {
      text: 'How do precision, recall, and F1-score differ, and when would you optimize for recall over precision?',
      difficulty: 'medium',
      expectedConcepts: ['confusion matrix', 'true positives', 'false positives', 'false negatives', 'imbalanced data', 'F1-score'],
    },
    {
      text: 'What strategies do you use for handling imbalanced datasets in classification problems?',
      difficulty: 'medium',
      expectedConcepts: ['SMOTE', 'oversampling', 'undersampling', 'class weights', 'ROC-AUC', 'stratified sampling'],
    },
    {
      text: 'Explain feature engineering techniques such as one-hot encoding, target encoding, and standardization.',
      difficulty: 'medium',
      expectedConcepts: ['one-hot encoding', 'target encoding', 'scaling', 'standardization', 'outliers', 'cardinality'],
    },
  ],
  'deep learning': [
    {
      text: 'Explain how backpropagation works in neural networks.',
      difficulty: 'hard',
      expectedConcepts: ['gradient descent', 'chain rule', 'loss function', 'weight update', 'activation function'],
    },
    {
      text: 'What is the vanishing gradient problem in deep neural networks, and how do activation functions like ReLU or architectures like ResNet mitigate it?',
      difficulty: 'hard',
      expectedConcepts: ['vanishing gradients', 'sigmoid/tanh saturation', 'ReLU', 'residual connections', 'skip connections', 'batch normalization'],
    },
    {
      text: 'How does the self-attention mechanism in Transformer models compare to recurrent mechanisms in LSTMs?',
      difficulty: 'hard',
      expectedConcepts: ['attention matrix', 'queries', 'keys', 'values', 'parallelization', 'long-range dependencies'],
    },
    {
      text: 'Explain dropout and batch normalization, and how each prevents overfitting in deep learning.',
      difficulty: 'medium',
      expectedConcepts: ['dropout rate', 'internal covariate shift', 'mini-batch statistics', 'regularization', 'training vs inference'],
    },
  ],
  git: [
    {
      text: 'Explain the difference between `git merge` and `git rebase`. When would you use each?',
      difficulty: 'medium',
      expectedConcepts: ['merge commit', 'linear history', 'rebase', 'conflict resolution', 'golden rule'],
    },
    {
      text: 'How would you recover a deleted commit or branch in Git using git reflog?',
      difficulty: 'medium',
      expectedConcepts: ['reflog', 'commit hash', 'HEAD pointer', 'detached HEAD', 'branch recreation'],
    },
    {
      text: 'Explain the Git branching strategy you prefer (such as Trunk-Based Development or Git Flow) and why.',
      difficulty: 'easy',
      expectedConcepts: ['trunk-based', 'feature branches', 'pull requests', 'release cadence', 'CI/CD integration'],
    },
    {
      text: 'How do you resolve a complex merge conflict involving multiple files in Git?',
      difficulty: 'medium',
      expectedConcepts: ['conflict markers', 'diff analysis', 'rebase abort/continue', 'merge tools', 'team communication'],
    },
  ],
  java: [
    {
      text: 'Explain Java garbage collection. How does it work, and how can you influence it?',
      difficulty: 'hard',
      expectedConcepts: ['heap', 'young generation', 'old generation', 'GC algorithms', 'memory management'],
    },
    {
      text: 'Explain polymorphism in Java.',
      difficulty: 'medium',
      expectedConcepts: ['method overriding', 'method overloading', 'interfaces', 'runtime polymorphism', 'dynamic binding'],
    },
    {
      text: 'What is the difference between Comparable and Comparator interfaces in Java, and when should each be used?',
      difficulty: 'medium',
      expectedConcepts: ['compareTo', 'compare', 'natural ordering', 'multiple sort criteria', 'java.util.Collections'],
    },
    {
      text: 'How does Java handle concurrency with the java.util.concurrent package, ExecutorService, and synchronized blocks?',
      difficulty: 'hard',
      expectedConcepts: ['ExecutorService', 'thread pools', 'synchronized', 'ReentrantLock', 'volatile', 'deadlocks'],
    },
  ],
  'c++': [
    {
      text: 'What is the difference between stack and heap memory in C++? When would you use each?',
      difficulty: 'hard',
      expectedConcepts: ['RAII', 'smart pointers', 'malloc/free', 'stack allocation', 'memory leak'],
    },
    {
      text: 'Explain RAII (Resource Acquisition Is Initialization) and how modern smart pointers prevent leaks.',
      difficulty: 'hard',
      expectedConcepts: ['std::unique_ptr', 'std::shared_ptr', 'std::weak_ptr', 'destructor cleanup', 'reference counting'],
    },
    {
      text: 'What are virtual functions and vtables in C++, and how do they enable runtime polymorphism?',
      difficulty: 'hard',
      expectedConcepts: ['virtual table', 'vptr', 'dynamic dispatch', 'override', 'abstract class'],
    },
    {
      text: 'What is move semantics in C++11, and how does std::move optimize resource transfers?',
      difficulty: 'hard',
      expectedConcepts: ['rvalue references', 'std::move', 'move constructor', 'move assignment', 'zero-copy transfer'],
    },
  ],
  'rest api': [
    {
      text: 'What are the key principles of RESTful API design? How would you design a REST API for a social media application?',
      difficulty: 'medium',
      expectedConcepts: ['statelessness', 'resource-based URLs', 'HTTP methods', 'status codes', 'versioning'],
    },
    {
      text: 'Explain REST APIs.',
      difficulty: 'easy',
      expectedConcepts: ['client-server', 'stateless', 'HTTP verbs', 'JSON', 'endpoints', 'uniform interface'],
    },
    {
      text: 'How do idempotent HTTP methods (like PUT and DELETE) differ from non-idempotent ones like POST, and how do you handle idempotency keys?',
      difficulty: 'medium',
      expectedConcepts: ['idempotency', 'PUT vs POST', 'idempotency keys', 'safe methods', 'network retries'],
    },
    {
      text: 'What are the best practices for REST API versioning, error handling, and pagination?',
      difficulty: 'medium',
      expectedConcepts: ['URI versioning', 'RFC 7807 problem details', 'cursor-based pagination', 'offset pagination', 'rate limiting'],
    },
  ],
  graphql: [
    {
      text: 'What are the advantages of GraphQL over REST? When would you choose one over the other?',
      difficulty: 'medium',
      expectedConcepts: ['over-fetching', 'under-fetching', 'schema', 'resolvers', 'mutations', 'subscriptions'],
    },
    {
      text: 'How do you solve the N+1 query problem in GraphQL using DataLoader?',
      difficulty: 'hard',
      expectedConcepts: ['DataLoader', 'batching', 'caching', 'N+1 problem', 'resolver execution tree'],
    },
    {
      text: 'Explain GraphQL schemas, types, queries, and mutations with concrete examples.',
      difficulty: 'medium',
      expectedConcepts: ['schema definition language', 'Query type', 'Mutation type', 'Input types', 'resolvers'],
    },
    {
      text: 'How does caching work in GraphQL compared to traditional HTTP caching in REST APIs?',
      difficulty: 'hard',
      expectedConcepts: ['POST requests', 'normalized cache', 'Apollo Client cache', 'persisted queries', 'CDN caching'],
    },
  ],
  redis: [
    {
      text: 'How does Redis work as a caching layer? What data structures does it support?',
      difficulty: 'medium',
      expectedConcepts: ['in-memory', 'TTL', 'string', 'hash', 'list', 'set', 'sorted set', 'cache invalidation'],
    },
    {
      text: 'Explain Redis eviction policies (such as LRU and LFU) and how you configure TTLs for cache invalidation.',
      difficulty: 'medium',
      expectedConcepts: ['allkeys-lru', 'volatile-lru', 'LFU', 'maxmemory', 'TTL expiration', 'cache stampede'],
    },
    {
      text: 'How do you ensure data persistence and high availability in Redis using RDB, AOF, and Redis Sentinel/Cluster?',
      difficulty: 'hard',
      expectedConcepts: ['RDB snapshotting', 'AOF append-only file', 'Sentinel failover', 'Redis Cluster sharding', 'replication'],
    },
    {
      text: 'How would you implement a distributed lock in Redis safely, considering node crashes and timeouts?',
      difficulty: 'hard',
      expectedConcepts: ['SET NX PX', 'Redlock algorithm', 'lease renewal', 'fencing tokens', 'atomicity with Lua scripts'],
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
// DEDUPLICATION ENGINE & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const NEAR_DUPLICATE_THRESHOLD = 0.85;
const STRUCTURAL_DUPLICATE_THRESHOLD = 0.65;

/**
 * Fisher-Yates shuffle algorithm:
 * Guarantees uniform random distribution without mutating the source array.
 */
const fisherYatesShuffle = (arr) => {
  if (!Array.isArray(arr)) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Backwards compatibility alias
const shuffle = fisherYatesShuffle;

/**
 * Normalizes question text for robust deduplication:
 * - strips punctuation
 * - collapses whitespace
 * - lowercase
 */
const normalizeQuestionText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[?!.,;:()'"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'does', 'do', 'did', 'it', 'its', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);

const stemWord = (word) => {
  return word
    .replace(/(ing|ed|ly|es|s)$/, '')
    .replace(/ies$/, 'y');
};

const extractContentTokens = (text) => {
  const norm = normalizeQuestionText(text);
  return norm
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stemWord);
};

/**
 * Token-based Jaccard similarity using content tokens
 */
const calculateTokenJaccard = (a, b) => {
  const getTokens = (val) => {
    if (Array.isArray(val)) return new Set(val.map((v) => stemWord(String(v).toLowerCase())));
    if (typeof val === 'string') return new Set(extractContentTokens(val));
    return new Set();
  };
  const setA = getTokens(a);
  const setB = getTokens(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Detect primary intent of the question
 */
const detectQuestionIntent = (text) => {
  const t = (text || '').toLowerCase();
  if (/design|architect|architecture|structure|system design/i.test(t)) return 'design';
  if (/compare|difference|versus|vs|trade-off|pros and cons/i.test(t)) return 'compare';
  if (/optimize|optimization|performance|scale|scaling/i.test(t)) return 'optimize';
  if (/debug|troubleshoot|fix|issue|root cause/i.test(t)) return 'debug';
  if (/implement|code|write|create|build/i.test(t)) return 'implement';
  if (/explain|what is|how does|what are|describe|walk me through/i.test(t)) return 'explain';
  return 'general';
};

/**
 * Layered Deduplication Check:
 * Layer 1: Exact normalized string match
 * Layer 2: Near-duplicate Jaccard similarity (>= 0.70)
 * Layer 3: Shared technical skill and structural intent duplicate (>= 0.40)
 */
const isDuplicateQuestion = (candidateText, existingQuestions = [], context = {}) => {
  if (!candidateText || !existingQuestions || existingQuestions.length === 0) {
    return { isDuplicate: false };
  }

  const normCandidate = normalizeQuestionText(candidateText);
  const candidateIntent = detectQuestionIntent(candidateText);
  const candidateTokens = extractContentTokens(candidateText);

  for (const existing of existingQuestions) {
    const existingText = typeof existing === 'string' ? existing : existing?.text;
    if (!existingText) continue;

    const normExisting = normalizeQuestionText(existingText);

    // Layer 1: Exact match after normalization
    if (normCandidate === normExisting) {
      return { isDuplicate: true, layer: 1, matchedText: existingText };
    }

    // Layer 2: Near-exact token match
    const existingTokens = extractContentTokens(existingText);
    const jaccard = calculateTokenJaccard(candidateTokens, existingTokens);

    if (jaccard >= 0.70) {
      return { isDuplicate: true, layer: 2, matchedText: existingText, similarity: jaccard };
    }

    // Layer 3: Structural / Intent-level duplicate
    const existingIntent = detectQuestionIntent(existingText);
    const sameIntent = candidateIntent === existingIntent && candidateIntent !== 'general';

    if (sameIntent && jaccard >= 0.40) {
      return { isDuplicate: true, layer: 3, matchedText: existingText, similarity: jaccard };
    }

    const skill = (context.skill || '').toLowerCase();
    if (
      candidateIntent === 'explain' &&
      existingIntent === 'explain' &&
      skill &&
      normCandidate.includes(skill) &&
      normExisting.includes(skill)
    ) {
      return { isDuplicate: true, layer: 3, matchedText: existingText, reason: 'same_concept_explain' };
    }
  }

  return { isDuplicate: false };
};

const determineDifficulty = (experienceYears, skillCoveragePercentage, interviewDifficulty) => {
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
const INTRO_TEMPLATES = [
  (role, skill) => `To start off, could you briefly introduce yourself and share how your experience with ${skill} aligns with this ${role} position?`,
  (role, skill) => `Welcome! Walk me through your professional background and highlight a key project involving ${skill} that demonstrates your strengths as a ${role}.`,
  (role, skill) => `Let's begin with a brief overview of your technical journey and what specifically excites you about taking on the responsibilities of a ${role}?`,
  (role, skill) => `To kick things off, could you summarize your core technical strengths in ${skill} and how you apply them in day-to-day engineering as a ${role}?`,
  (role, skill) => `Could you share an introduction covering your most impactful achievements using ${skill} and how they prepare you for this ${role} role?`,
];

/**
 * Generate a complete, personalized set of interview questions.
 */
const generateInterviewQuestions = ({
  candidateProfile = {},
  jobProfile = {},
  skillAnalysis = {},
  interviewType = 'mixed',
  difficulty = 'medium',
  totalQuestions = 10,
  targetRole,
  avoidTexts = [],
  weakAreas = [],
  isPracticeAttempt = false,
}) => {
  const max = Math.min(totalQuestions, 15);
  const questions = [];
  const resolvedRole = targetRole || jobProfile.targetRole || 'Software Engineer';

  // Extract candidate data safely
  const candidateSkills = candidateProfile.skills || candidateProfile.extractedSkills || [];
  const candidateProjects = candidateProfile.projects || [];
  const candidateExperience = candidateProfile.experience || candidateProfile.workExperience || [];

  // Extract job data safely
  const requiredSkills = jobProfile.requiredSkills || (skillAnalysis.notIdentifiedRequiredSkills
    ? [...(skillAnalysis.matchedRequiredSkills || []), ...(skillAnalysis.notIdentifiedRequiredSkills || [])]
    : []);
  const responsibilities = jobProfile.responsibilities || [];

  // Extract skill gap data
  const matchedSkills = skillAnalysis.matchedSkills || skillAnalysis.matchedRequiredSkills || candidateSkills;
  const missingSkills = skillAnalysis.missingSkills || skillAnalysis.notIdentifiedRequiredSkills || [];

  // Build avoid list
  const avoidList = Array.isArray(avoidTexts) ? avoidTexts : [];

  // 1. Rotating Introduction Question
  const primarySkill = matchedSkills[0] || candidateSkills[0] || 'software development';
  let introQuestion = null;
  const introOffset = avoidList.length % INTRO_TEMPLATES.length;
  for (let i = 0; i < INTRO_TEMPLATES.length; i++) {
    const idx = (introOffset + i) % INTRO_TEMPLATES.length;
    const text = INTRO_TEMPLATES[idx](resolvedRole, primarySkill);
    if (!isDuplicateQuestion(text, avoidList).isDuplicate) {
      introQuestion = {
        text,
        type: 'behavioral',
        category: 'experience',
        difficulty: 'easy',
        targetSkill: primarySkill,
        skill: primarySkill,
        source: 'experience',
        expectedConcepts: ['background', 'key projects', 'relevant skills', 'fit for role'],
        expectedKeyPoints: ['background', 'key projects', 'relevant skills', 'fit for role'],
        followUpAllowed: true,
      };
      break;
    }
  }

  // 2. Targeted Weak Areas (if reattempting or practicing)
  if (weakAreas && weakAreas.length > 0) {
    for (const weakSkill of weakAreas) {
      const templates = findTemplatesForSkill(weakSkill);
      for (const t of shuffle(templates)) {
        if (!isDuplicateQuestion(t.text, avoidList).isDuplicate) {
          questions.push({
            text: t.text,
            type: 'skill_gap',
            category: 'technical',
            difficulty: t.difficulty || difficulty,
            targetSkill: weakSkill,
            skill: weakSkill,
            source: 'skill_gap',
            expectedConcepts: t.expectedConcepts || [],
            expectedKeyPoints: t.expectedConcepts || [],
            followUpAllowed: true,
          });
          break;
        }
      }
    }
  }

  // 3. Skill gaps from JD
  if (missingSkills.length > 0) {
    const gapQuestions = generateSkillGapQuestions(missingSkills, difficulty);
    for (const gq of gapQuestions) {
      if (!isDuplicateQuestion(gq.text, avoidList).isDuplicate) {
        questions.push(gq);
      }
    }
  }

  // 4. Role-specific questions
  if (responsibilities.length > 0 || resolvedRole) {
    const jobQs = generateJobSpecificQuestions(responsibilities, requiredSkills.length ? requiredSkills : [resolvedRole], difficulty);
    for (const jq of jobQs) {
      if (!isDuplicateQuestion(jq.text, avoidList).isDuplicate) {
        questions.push(jq);
      }
    }
  }

  // 5. Technical questions from matched & candidate skills
  const skillsForTech = matchedSkills.length > 0 ? matchedSkills : candidateSkills;
  if (skillsForTech.length > 0) {
    const techQuestions = generateTechnicalQuestions(skillsForTech, difficulty, 3);
    for (const tq of techQuestions) {
      if (!isDuplicateQuestion(tq.text, avoidList).isDuplicate) {
        questions.push(tq);
      }
    }
  }

  // 6. Project questions from candidate projects
  if (candidateProjects.length > 0) {
    const projQuestions = generateProjectQuestions(candidateProjects, candidateSkills, difficulty);
    for (const pq of projQuestions) {
      if (!isDuplicateQuestion(pq.text, avoidList).isDuplicate) {
        questions.push(pq);
      }
    }
  }

  // 7. Experience questions
  if (candidateExperience.length > 0) {
    const expQuestions = generateExperienceQuestions(candidateExperience, difficulty);
    for (const eq of expQuestions) {
      if (!isDuplicateQuestion(eq.text, avoidList).isDuplicate) {
        questions.push(eq);
      }
    }
  }

  // 8. Behavioral questions
  const behQuestions = generateBehavioralQuestions(3, difficulty);
  for (const bq of behQuestions) {
    if (!isDuplicateQuestion(bq.text, avoidList).isDuplicate) {
      questions.push(bq);
    }
  }

  // Deduplicate and assemble
  const deduped = [];
  const seenTexts = [];

  if (introQuestion) {
    deduped.push(introQuestion);
    seenTexts.push(introQuestion.text);
  }

  for (const q of questions) {
    if (deduped.length >= max) break;
    const dupCheck = isDuplicateQuestion(q.text, seenTexts, { skill: q.targetSkill || q.skill });
    const avoidCheck = isDuplicateQuestion(q.text, avoidList, { skill: q.targetSkill || q.skill });
    if (!dupCheck.isDuplicate && !avoidCheck.isDuplicate) {
      deduped.push(q);
      seenTexts.push(q.text);
    }
  }

  // Fallback replenishment if needed to reach requested max
  if (deduped.length < max) {
    const fallbackPool = [
      ...SYSTEM_DESIGN_TEMPLATES.map((t) => ({ ...t, type: 'technical', category: 'conceptual', source: 'job_description' })),
      ...BEHAVIORAL_TEMPLATES.map((t) => ({ ...t, type: 'behavioral', category: 'behavioral', source: 'behavioral' })),
      ...(STATIC_BANK.technical || []).map((t) => ({ ...t, type: 'technical', category: 'technical', source: 'static_bank' })),
    ];

    for (const fb of shuffle(fallbackPool)) {
      if (deduped.length >= max) break;
      const dupCheck = isDuplicateQuestion(fb.text, seenTexts, { skill: fb.targetSkill });
      const avoidCheck = isDuplicateQuestion(fb.text, avoidList, { skill: fb.targetSkill });
      if (!dupCheck.isDuplicate && !avoidCheck.isDuplicate) {
        deduped.push({
          text: fb.text,
          type: fb.type || 'technical',
          category: fb.category || 'technical',
          difficulty: fb.difficulty || difficulty,
          targetSkill: fb.targetSkill || resolvedRole,
          skill: fb.skill || resolvedRole,
          source: fb.source || 'static_bank',
          expectedConcepts: fb.expectedConcepts || ['architecture', 'trade-offs', 'scalability'],
          expectedKeyPoints: fb.expectedKeyPoints || fb.expectedConcepts || ['architecture', 'trade-offs', 'scalability'],
          followUpAllowed: true,
        });
        seenTexts.push(fb.text);
      }
    }
  }

  // Last-resort synthesized unique question if still under max
  let counter = 1;
  while (deduped.length < max) {
    const synthText = `In your work as a ${resolvedRole}, how would you approach end-to-end technical execution and quality assurance for feature ${counter}?`;
    deduped.push({
      text: synthText,
      type: 'technical',
      category: 'conceptual',
      difficulty,
      targetSkill: resolvedRole,
      skill: resolvedRole,
      source: 'job_description',
      expectedConcepts: ['testing', 'architecture', 'CI/CD', 'monitoring'],
      expectedKeyPoints: ['testing', 'architecture', 'CI/CD', 'monitoring'],
      followUpAllowed: true,
    });
    counter++;
  }

  // Assign order
  return deduped.slice(0, max).map((q, i) => ({ ...q, order: i }));
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

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM DESIGN TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_DESIGN_TEMPLATES = [
  {
    text: 'Design a scalable URL shortening service (like Bitly). Explain your data model, hashing approach, caching strategy, and how you handle 100M daily writes.',
    targetSkill: 'System Design',
    category: 'system_design',
    difficulty: 'hard',
    expectedConcepts: ['Base62 encoding', 'hashing vs counter', 'caching with Redis', 'database sharding', 'read/write ratio', 'load balancing'],
  },
  {
    text: 'Design an API rate limiter to protect microservices from abuse. Discuss algorithms (token bucket, sliding window), storage (Redis), and distributed synchronization.',
    targetSkill: 'System Design',
    category: 'system_design',
    difficulty: 'medium',
    expectedConcepts: ['token bucket', 'sliding window log', 'Redis atomic operations', 'HTTP 429 status', 'distributed concurrency'],
  },
  {
    text: 'Design a real-time notification service that sends push, email, and SMS notifications to millions of users reliably without duplication.',
    targetSkill: 'System Design',
    category: 'system_design',
    difficulty: 'hard',
    expectedConcepts: ['message queue (Kafka/RabbitMQ)', 'idempotency', 'retry with exponential backoff', 'dead letter queue', 'worker pools'],
  },
  {
    text: 'How would you design a scalable database caching strategy for a high-traffic e-commerce checkout system? Discuss Cache-Aside, Write-Through, and cache invalidation.',
    targetSkill: 'System Design',
    category: 'system_design',
    difficulty: 'medium',
    expectedConcepts: ['Cache-Aside', 'Write-Through', 'cache stampede', 'TTL invalidation', 'Redis cluster'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HR & CULTURE FIT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const HR_TEMPLATES = [
  {
    text: 'Why are you interested in this specific role and domain, and how does it fit into your long-term engineering career trajectory?',
    targetSkill: 'Career Alignment',
    category: 'hr',
    difficulty: 'easy',
    expectedConcepts: ['motivation', 'domain interest', 'career goals', 'skills growth', 'company alignment'],
  },
  {
    text: 'Describe your ideal team environment and engineering culture. How do you handle working with cross-functional partners like Product and Design?',
    targetSkill: 'Team Collaboration',
    category: 'hr',
    difficulty: 'medium',
    expectedConcepts: ['open communication', 'cross-functional collaboration', 'empathy', 'shared ownership', 'constructive feedback'],
  },
  {
    text: 'How do you handle ambiguous requirements or sudden changes in project priorities from leadership?',
    targetSkill: 'Adaptability',
    category: 'hr',
    difficulty: 'medium',
    expectedConcepts: ['asking clarifying questions', 'prioritization', 'flexibility', 'stakeholder management', 'resilience'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PREREQUISITE / FOUNDATIONAL TEMPLATES (For very low performance scores)
// ─────────────────────────────────────────────────────────────────────────────

const PREREQUISITE_QUESTIONS = {
  python: {
    text: 'What are the basic differences between a list and a tuple in Python, and in what situations would you choose one over the other?',
    targetSkill: 'Python',
    difficulty: 'easy',
    expectedConcepts: ['mutability vs immutability', 'syntax [] vs ()', 'hashability', 'memory and performance', 'dictionary keys'],
  },
  react: {
    text: 'What is the purpose of state in React, and how does updating state cause a component to re-render?',
    targetSkill: 'React',
    difficulty: 'easy',
    expectedConcepts: ['useState', 'immutability', 're-render trigger', 'props vs state', 'unidirectional data flow'],
  },
  sql: {
    text: 'What is the difference between an INNER JOIN and a LEFT JOIN in SQL? Give a simple real-world example of when you would use a LEFT JOIN.',
    targetSkill: 'SQL',
    difficulty: 'easy',
    expectedConcepts: ['matching rows only', 'all left rows included', 'NULL for unmatched right rows', 'example use case'],
  },
  docker: {
    text: 'What is a Docker container, and how is it fundamentally different from a traditional virtual machine?',
    targetSkill: 'Docker',
    difficulty: 'easy',
    expectedConcepts: ['shared host kernel', 'isolation', 'lightweight', 'hypervisor vs container engine', 'resource efficiency'],
  },
  fastapi: {
    text: 'What is FastAPI, and how does it use Python type hints and Pydantic for automated request validation?',
    targetSkill: 'FastAPI',
    difficulty: 'easy',
    expectedConcepts: ['Pydantic models', 'automatic validation', 'Swagger/OpenAPI docs', 'type hints', 'async support'],
  },
  git: {
    text: 'Explain the difference between `git pull` and `git fetch`. What does a branch in Git represent?',
    targetSkill: 'Git',
    difficulty: 'easy',
    expectedConcepts: ['fetch downloads remote changes', 'pull does fetch plus merge', 'commit pointers', 'HEAD pointer'],
  },
  javascript: {
    text: 'What is the difference between synchronous and asynchronous code execution in JavaScript? What problem do callbacks or Promises solve?',
    targetSkill: 'JavaScript',
    difficulty: 'easy',
    expectedConcepts: ['single-threaded', 'blocking vs non-blocking', 'event loop', 'callbacks', 'Promises'],
  },
  general: {
    text: 'Explain how client-server communication works when a user opens a webpage in their web browser.',
    targetSkill: 'Web Fundamentals',
    difficulty: 'easy',
    expectedConcepts: ['DNS lookup', 'TCP connection', 'HTTP GET request', 'HTTP response status code', 'rendering HTML/CSS/JS'],
  },
};

// (Deduplication engine is defined above with layered analysis)

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC ADAPTIVE QUESTION GENERATOR (Next Question on the fly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the next personalized, adaptive question for an interview session.
 *
 * @param {Object} params
 * @param {Object} params.interview - Active interview document
 * @param {Object} params.candidateProfile - Resume profile
 * @param {Object} params.jobProfile - JD profile
 * @param {Object} params.skillGap - { strongSkills, partialSkills, missingSkills }
 * @param {string} params.interviewType - 'technical'|'coding'|'behavioral'|'hr'|'system_design'|'mixed'
 * @param {string} params.difficulty - 'easy'|'medium'|'hard'
 * @param {boolean} params.isPrerequisite - Whether to generate a prerequisite question
 * @param {string} params.targetTopic - Specific topic to assess
 * @param {Set<string>} params.pastQuestionTexts - Set of previous questions from this and past sessions
 * @param {number} params.order - Zero-based question index
 * @returns {Object} Question document data ready for MongoDB
 */
const generateNextPersonalizedQuestion = ({
  interview = {},
  candidateProfile = {},
  jobProfile = {},
  skillGap = {},
  interviewType = 'technical',
  difficulty = 'medium',
  isPrerequisite = false,
  targetTopic = null,
  pastQuestionTexts = new Set(),
  order = 0,
}) => {
  const targetRole = jobProfile.title || jobProfile.jobTitle || interview.targetRole || 'Software Engineer';
  const roleLower = targetRole.toLowerCase();

  // Determine role primary language
  const isPythonRole = /python/i.test(roleLower) || (candidateProfile.skills || []).some((s) => /python/i.test(s));
  const isJavaRole = /java\b|spring/i.test(roleLower) && !isPythonRole;
  const primaryLanguage = isPythonRole ? 'python' : (isJavaRole ? 'java' : 'javascript');

  // Determine active topic if not specified
  let topic = targetTopic;
  if (!topic) {
    const candidates = [
      ...(skillGap.missingSkills || []),
      ...(skillGap.partialSkills || []),
      ...(skillGap.strongSkills || []),
    ];
    // Filter candidates to strictly match role technologies
    const filteredCandidates = candidates.filter((c) => {
      if (isPythonRole && /java\b|spring|c\+\+|dotnet/i.test(c)) return false;
      return true;
    });
    topic = filteredCandidates[0] || (isPythonRole ? 'Python' : 'JavaScript');
  }

  const topicKey = (topic || '').toLowerCase().trim();

  // 1. If Prerequisite question requested (due to very low performance)
  if (isPrerequisite) {
    const prereqTemplate = PREREQUISITE_QUESTIONS[topicKey] || PREREQUISITE_QUESTIONS.general;
    if (!isDuplicateQuestion(prereqTemplate.text, pastQuestionTexts).isDuplicate) {
      return {
        text: prereqTemplate.text,
        type: 'technical',
        category: 'conceptual',
        difficulty: 'easy',
        targetSkill: prereqTemplate.targetSkill || topic,
        skill: prereqTemplate.targetSkill || topic,
        source: 'skill_gap',
        expectedConcepts: prereqTemplate.expectedConcepts,
        expectedKeyPoints: prereqTemplate.expectedConcepts,
        followUpAllowed: false,
        contextNote: `Foundational check: assessing fundamental understanding of ${topic}.`,
        isAdaptive: true,
        order,
      };
    }
  }

  // 2. Coding Interview Type
  if (interviewType === 'coding' || (interviewType === 'mixed' && order % 3 === 1)) {
    const langKey = primaryLanguage === 'python' ? 'python' : 'javascript';
    const templates = CODING_TEMPLATES[langKey] || CODING_TEMPLATES.javascript;
    const candidates = templates.filter((t) => t.difficulty === difficulty || t.difficulty === 'medium');

    for (const t of shuffle(candidates.length ? candidates : templates)) {
      if (!isDuplicateQuestion(t.text, pastQuestionTexts).isDuplicate) {
        return {
          text: t.text,
          type: 'coding',
          category: 'coding',
          difficulty: t.difficulty,
          targetSkill: t.targetSkill,
          skill: t.targetSkill,
          source: 'job_description',
          expectedConcepts: t.expectedConcepts,
          expectedKeyPoints: t.expectedConcepts,
          starterCode: t.starterCode,
          language: t.language,
          followUpAllowed: false,
          contextNote: `Coding challenge in ${t.language}.`,
          isAdaptive: true,
          order,
        };
      }
    }
  }

  // 3. System Design Interview Type
  if (interviewType === 'system_design' || (interviewType === 'mixed' && order === 3)) {
    const candidates = SYSTEM_DESIGN_TEMPLATES.filter((t) => t.difficulty === difficulty || difficulty === 'medium');
    for (const t of shuffle(candidates.length ? candidates : SYSTEM_DESIGN_TEMPLATES)) {
      if (!isDuplicateQuestion(t.text, pastQuestionTexts).isDuplicate) {
        return {
          text: t.text,
          type: 'system_design',
          category: 'system_design',
          difficulty: t.difficulty,
          targetSkill: t.targetSkill,
          skill: t.targetSkill,
          source: 'job_description',
          expectedConcepts: t.expectedConcepts,
          expectedKeyPoints: t.expectedConcepts,
          followUpAllowed: true,
          contextNote: 'System design architecture question.',
          isAdaptive: true,
          order,
        };
      }
    }
  }

  // 4. Behavioral Interview Type
  if (interviewType === 'behavioral' || (interviewType === 'mixed' && order % 4 === 2)) {
    const candidates = BEHAVIORAL_TEMPLATES.filter((t) => t.difficulty === difficulty || difficulty === 'medium');
    for (const t of shuffle(candidates.length ? candidates : BEHAVIORAL_TEMPLATES)) {
      if (!isDuplicateQuestion(t.text, pastQuestionTexts).isDuplicate) {
        return {
          text: t.text,
          type: 'behavioral',
          category: 'behavioral',
          difficulty: t.difficulty,
          targetSkill: t.targetSkill,
          skill: t.targetSkill,
          source: 'behavioral',
          expectedConcepts: t.expectedConcepts,
          expectedKeyPoints: t.expectedConcepts,
          followUpAllowed: true,
          contextNote: null,
          isAdaptive: true,
          order,
        };
      }
    }
  }

  // 5. HR Interview Type
  if (interviewType === 'hr') {
    for (const t of shuffle(HR_TEMPLATES)) {
      if (!isDuplicateQuestion(t.text, pastQuestionTexts).isDuplicate) {
        return {
          text: t.text,
          type: 'hr',
          category: 'hr',
          difficulty: t.difficulty,
          targetSkill: t.targetSkill,
          skill: t.targetSkill,
          source: 'behavioral',
          expectedConcepts: t.expectedConcepts,
          expectedKeyPoints: t.expectedConcepts,
          followUpAllowed: true,
          contextNote: 'Culture and career alignment assessment.',
          isAdaptive: true,
          order,
        };
      }
    }
  }

  // 6. Technical / Role-Specific questions
  const templates = findTemplatesForSkill(topicKey);
  const candidates = templates.filter((t) => t.difficulty === difficulty || difficulty === 'medium');
  const pool = candidates.length > 0 ? candidates : templates;

  for (const t of shuffle(pool)) {
    if (!isDuplicateQuestion(t.text, pastQuestionTexts).isDuplicate) {
      return {
        text: t.text,
        type: 'technical',
        category: 'technical',
        difficulty: t.difficulty || difficulty,
        targetSkill: topic,
        skill: topic,
        source: (skillGap.missingSkills || []).includes(topic) ? 'skill_gap' : 'job_description',
        expectedConcepts: t.expectedConcepts || [],
        expectedKeyPoints: t.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: (skillGap.missingSkills || []).includes(topic)
          ? `${topic} was not identified in the resume; testing familiarity.`
          : null,
        isAdaptive: true,
        order,
      };
    }
  }

  // 7. Dynamic targeted scenario question (guaranteed fresh & deduplicated)
  const questionVariations = [
    {
      text: `In a production ${targetRole} environment using ${topic}, describe how you would design and debug an unexpected memory leak or high-latency bottleneck. What tools and architectural patterns would you use?`,
      expectedConcepts: ['profiling tools', 'concurrency management', 'monitoring', 'root cause analysis', 'caching/indexes'],
    },
    {
      text: `When architecting a solution with ${topic} for a ${targetRole} position, what are the primary trade-offs between horizontal vs vertical scalability, and how do you ensure high availability?`,
      expectedConcepts: ['horizontal scaling', 'load balancing', 'stateless design', 'failover', 'replication'],
    },
    {
      text: `How does ${topic} integrate with security best practices in a ${targetRole} stack? Discuss secure credential management, authentication, and protection against common OWASP vulnerabilities.`,
      expectedConcepts: ['JWT / OAuth', 'HTTPS / encryption', 'SQL injection / XSS prevention', 'least privilege', 'environment variables'],
    },
  ];

  for (const v of shuffle(questionVariations)) {
    if (!isDuplicateQuestion(v.text, pastQuestionTexts).isDuplicate) {
      return {
        text: v.text,
        type: 'technical',
        category: 'conceptual',
        difficulty,
        targetSkill: topic,
        skill: topic,
        source: 'job_description',
        expectedConcepts: v.expectedConcepts,
        expectedKeyPoints: v.expectedConcepts,
        followUpAllowed: true,
        contextNote: `Deep technical scenario on ${topic}.`,
        isAdaptive: true,
        order,
      };
    }
  }

  // 8. Fallback guaranteed unique question
  const fallbackText = `As a ${targetRole}, walk me through your engineering workflow when implementing a complex feature with ${topic} from initial technical specification to production deployment.`;
  return {
    text: fallbackText,
    type: 'technical',
    category: 'conceptual',
    difficulty,
    targetSkill: topic,
    skill: topic,
    source: 'job_description',
    expectedConcepts: ['technical specs', 'clean code', 'unit testing', 'CI/CD pipeline', 'monitoring'],
    expectedKeyPoints: ['technical specs', 'clean code', 'unit testing', 'CI/CD pipeline', 'monitoring'],
    followUpAllowed: true,
    contextNote: null,
    isAdaptive: true,
    order,
  };
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
  generateNextPersonalizedQuestion,
  fisherYatesShuffle,
  normalizeQuestionText,
  isDuplicateQuestion,
  calculateTokenJaccard,
  detectQuestionIntent,
  SKILL_QUESTION_TEMPLATES,
  NEAR_DUPLICATE_THRESHOLD,
  STRUCTURAL_DUPLICATE_THRESHOLD,
  getQuestionsForInterview,
  STATIC_BANK,
  CODING_TEMPLATES,
  SYSTEM_DESIGN_TEMPLATES,
  HR_TEMPLATES,
  PREREQUISITE_QUESTIONS,
};

