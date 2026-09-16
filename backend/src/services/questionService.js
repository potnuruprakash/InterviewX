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
      text: 'Explain the JavaScript event loop. How does it coordinate the call stack, microtask queue (Promises), and macrotask queue (setTimeout)?',
      difficulty: 'medium',
      expectedConcepts: ['call stack', 'callback queue', 'microtask queue', 'event loop', 'promises', 'async/await'],
    },
    {
      text: 'What are closures in JavaScript, and can you provide a real-world use case such as data encapsulation or function memoization?',
      difficulty: 'medium',
      expectedConcepts: ['lexical scope', 'inner function', 'outer variable', 'encapsulation', 'module pattern'],
    },
    {
      text: 'What is the difference between `let`, `const`, and `var` in JavaScript, specifically regarding hoisting and the temporal dead zone?',
      difficulty: 'easy',
      expectedConcepts: ['block scope', 'function scope', 'hoisting', 'reassignment', 'temporal dead zone'],
    },
    {
      text: 'How does prototypical inheritance work in JavaScript, and how do ES6 classes map to prototypes under the hood?',
      difficulty: 'hard',
      expectedConcepts: ['prototype chain', '__proto__', 'Object.create', 'constructor functions', 'class syntax syntactic sugar'],
    },
    {
      text: 'How do you diagnose and prevent memory leaks in client-side JavaScript (e.g., detached DOM trees, lingering event listeners, uncollected closures)?',
      difficulty: 'hard',
      expectedConcepts: ['heap snapshot', 'detached DOM nodes', 'event listener removal', 'weakmap/weakset', 'garbage collection'],
    },
  ],
  typescript: [
    {
      text: 'How does TypeScript improve JavaScript development? Explain key features you use regularly to enforce type safety in team codebases.',
      difficulty: 'medium',
      expectedConcepts: ['static typing', 'interfaces', 'type inference', 'generics', 'compile-time errors'],
    },
    {
      text: 'What are TypeScript generics, and how would you build a reusable type-safe repository or utility function using generic constraints?',
      difficulty: 'hard',
      expectedConcepts: ['type parameter', 'reusability', 'type safety', 'constraints', 'generic functions'],
    },
    {
      text: 'Explain the difference between `interface` and `type` alias in TypeScript. When would you prefer one over the other?',
      difficulty: 'easy',
      expectedConcepts: ['declaration merging', 'unions and primitives', 'extending vs intersection', 'performance in compiler'],
    },
    {
      text: 'Explain TypeScript conditional types and template literal types. Can you share an example of how you use them to derive dynamic types?',
      difficulty: 'hard',
      expectedConcepts: ['infer keyword', 'distributive conditional types', 'string manipulation types', 'mapped types'],
    },
  ],
  react: [
    {
      text: 'Explain the React component lifecycle. How do modern hooks like `useEffect`, `useLayoutEffect`, and `useCallback` model this pipeline?',
      difficulty: 'medium',
      expectedConcepts: ['mounting', 'updating', 'unmounting', 'useEffect cleanup', 'dependency array'],
    },
    {
      text: 'How does React state management work? Compare `useState`, `useReducer`, and Context API against external libraries like Redux or Zustand.',
      difficulty: 'medium',
      expectedConcepts: ['local state', 'useReducer', 'Redux', 'Context API', 'state updates', 're-render'],
    },
    {
      text: 'What is React reconciliation (Fiber architecture), and how does key prop usage prevent unnecessary DOM reconstructions?',
      difficulty: 'hard',
      expectedConcepts: ['virtual DOM', 'diffing algorithm', 'fiber', 'reconciliation', 'keys', 'performance'],
    },
    {
      text: 'How do you diagnose and eliminate unnecessary re-renders in a large React application using React Profiler, `React.memo`, and custom hooks?',
      difficulty: 'hard',
      expectedConcepts: ['React DevTools Profiler', 'memoization', 'referential equality', 'render phases', 'virtualized lists'],
    },
    {
      text: 'Explain Server Components (RSC) versus Client Components in modern React frameworks. What architectural problems do Server Components solve?',
      difficulty: 'hard',
      expectedConcepts: ['zero-bundle-size components', 'direct backend data fetching', 'streaming SSR', 'client boundaries'],
    },
  ],
  'node.js': [
    {
      text: 'Explain Node.js non-blocking I/O and the libuv event loop phases (timers, I/O callbacks, poll, check, close).',
      difficulty: 'medium',
      expectedConcepts: ['event-driven', 'single thread', 'libuv', 'non-blocking I/O', 'scalability'],
    },
    {
      text: 'How do you handle uncaught exceptions, unhandled promise rejections, and graceful shutdowns in a production Express application?',
      difficulty: 'medium',
      expectedConcepts: ['middleware', 'try-catch', 'async errors', 'error handler', 'SIGTERM / SIGINT handling', 'HTTP status codes'],
    },
    {
      text: 'How do Node.js Streams and backpressure work when processing large files or continuous data feeds without exhausting system memory?',
      difficulty: 'hard',
      expectedConcepts: ['readable/writable streams', 'pipeline API', 'backpressure', 'highWaterMark', 'memory management'],
    },
    {
      text: 'How would you scale a Node.js API to utilize all CPU cores on a multi-core server? Compare the Cluster module with worker threads and reverse proxies.',
      difficulty: 'hard',
      expectedConcepts: ['cluster module', 'worker threads', 'forking processes', 'PM2 process manager', 'load balancing'],
    },
  ],
  python: [
    {
      text: 'What are Python generators and iterators, and when would you use them over list comprehensions for memory efficiency?',
      difficulty: 'medium',
      expectedConcepts: ['yield', 'lazy evaluation', 'memory efficiency', 'iterator protocol', 'generator expression'],
    },
    {
      text: 'Explain Python decorators with a practical example, including how to preserve function metadata using `functools.wraps`.',
      difficulty: 'medium',
      expectedConcepts: ['wrapper function', 'higher-order function', '@syntax', 'functools.wraps', 'use cases'],
    },
    {
      text: 'Explain the Global Interpreter Lock (GIL) in CPython. How does it impact multithreading versus multiprocessing for CPU-bound tasks?',
      difficulty: 'hard',
      expectedConcepts: ['GIL mechanism', 'CPU-bound vs I/O-bound', 'multiprocessing module', 'asyncio', 'thread concurrency'],
    },
    {
      text: 'How does Python handle memory management and garbage collection (reference counting plus generational cyclic GC)?',
      difficulty: 'hard',
      expectedConcepts: ['reference counting', 'cyclic references', 'generation 0/1/2', 'gc module', 'memory deallocation'],
    },
  ],
  sql: [
    {
      text: 'Explain database normalization. What are the differences between 1NF, 2NF, and 3NF, and when is denormalization justified?',
      difficulty: 'medium',
      expectedConcepts: ['1NF atomicity', '2NF partial dependency', '3NF transitive dependency', 'denormalization', 'trade-offs'],
    },
    {
      text: 'How would you optimize a slow SQL query? Walk me through your process using `EXPLAIN ANALYZE` and indexing strategies.',
      difficulty: 'hard',
      expectedConcepts: ['EXPLAIN ANALYZE', 'index usage', 'query rewrite', 'joins', 'N+1 problem', 'caching'],
    },
    {
      text: 'Explain the difference between clustered and non-clustered indexes, and how composite index column ordering impacts query performance.',
      difficulty: 'medium',
      expectedConcepts: ['B-tree leaf nodes', 'index scan vs seek', 'leftmost prefix rule', 'covering index', 'write overhead'],
    },
    {
      text: 'Compare SQL transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable). What anomalies does each level prevent?',
      difficulty: 'hard',
      expectedConcepts: ['dirty reads', 'non-repeatable reads', 'phantom reads', 'MVCC', 'locking mechanisms'],
    },
    {
      text: 'How do advanced SQL window functions (like `ROW_NUMBER()`, `RANK()`, `LEAD()`, `LAG()`) work, and what is a practical scenario where you used them?',
      difficulty: 'medium',
      expectedConcepts: ['PARTITION BY', 'ORDER BY', 'ranking', 'offset functions', 'running totals'],
    },
  ],
  mongodb: [
    {
      text: 'What are MongoDB indexes, and how do you decide which fields to index in a compound index using the Equality, Sort, Range rule?',
      difficulty: 'medium',
      expectedConcepts: ['B-tree index', 'compound index', 'ESR rule', 'covered query', 'write overhead', 'selectivity'],
    },
    {
      text: 'Explain the MongoDB aggregation pipeline with an example use case using `$match`, `$group`, `$project`, and `$lookup`.',
      difficulty: 'medium',
      expectedConcepts: ['$match', '$group', '$project', '$lookup', 'pipeline stages', 'performance'],
    },
    {
      text: 'How do you design document schemas in MongoDB: when do you choose embedding versus referencing across collections?',
      difficulty: 'medium',
      expectedConcepts: ['1-to-N relationships', 'document growth', '16MB limit', 'read vs write frequency', 'atomicity'],
    },
    {
      text: 'How does replica set failover and write concern (`w: majority`) guarantee data durability and consistency in MongoDB?',
      difficulty: 'hard',
      expectedConcepts: ['primary election', 'oplog replication', 'write concerns', 'read preferences', 'eventual consistency'],
    },
  ],
  docker: [
    {
      text: 'Explain the difference between Docker images and containers. How does layer caching work when building a Dockerfile?',
      difficulty: 'easy',
      expectedConcepts: ['image layers', 'container runtime', 'FROM', 'RUN', 'CMD', 'ENTRYPOINT', 'layer caching'],
    },
    {
      text: 'How would you optimize a Dockerfile to minimize image size and enhance container security (e.g., multi-stage builds, non-root users)?',
      difficulty: 'medium',
      expectedConcepts: ['multi-stage builds', 'distroless/alpine base', 'non-root user', '.dockerignore', 'caching order'],
    },
    {
      text: 'How do Docker networks work (bridge, host, overlay), and how do containers communicate securely in a multi-container Docker Compose setup?',
      difficulty: 'medium',
      expectedConcepts: ['bridge network', 'DNS resolution', 'port mapping', 'volumes', 'environment isolation'],
    },
    {
      text: 'How do you troubleshoot a container that exits unexpectedly immediately upon starting, or an out-of-memory (OOM) killed container?',
      difficulty: 'medium',
      expectedConcepts: ['docker logs', 'docker inspect exit codes', 'memory limits', 'entrypoint debugging', 'health checks'],
    },
  ],
  kubernetes: [
    {
      text: 'Explain Kubernetes Pods, Deployments, and Services. How do they relate to each other in an application lifecycle?',
      difficulty: 'medium',
      expectedConcepts: ['Pod', 'Deployment', 'ReplicaSet', 'Service', 'labels', 'selectors'],
    },
    {
      text: 'How do you configure readiness, liveness, and startup probes in Kubernetes, and what happens when a probe fails during a rolling deployment?',
      difficulty: 'medium',
      expectedConcepts: ['readinessProbe', 'livenessProbe', 'startupProbe', 'pod restart', 'traffic routing', 'zero-downtime'],
    },
    {
      text: 'Walk me through how you troubleshoot a Kubernetes Pod stuck in `CrashLoopBackOff` or `ImagePullBackOff`. What commands and logs do you inspect?',
      difficulty: 'medium',
      expectedConcepts: ['kubectl describe', 'kubectl logs', 'events inspection', 'exit codes', 'secret/configmap mounts'],
    },
    {
      text: 'How do you implement horizontal pod autoscaling (HPA) and resource management (CPU/memory requests vs limits) to prevent OOMKilled events under peak load?',
      difficulty: 'hard',
      expectedConcepts: ['metrics server', 'HPA target metrics', 'CPU/memory requests vs limits', 'QoS classes', 'OOMKilled prevention'],
    },
    {
      text: 'Compare Kubernetes StatefulSets vs Deployments. How do you handle persistent storage and headless services for stateful workloads like databases?',
      difficulty: 'hard',
      expectedConcepts: ['StatefulSet sticky identity', 'PersistentVolumeClaims', 'headless service', 'ordered deployment', 'storage classes'],
    },
  ],
  aws: [
    {
      text: 'What AWS services have you used? Walk me through how you architected a cloud solution with AWS.',
      difficulty: 'medium',
      expectedConcepts: ['EC2', 'S3', 'Lambda', 'RDS', 'architecture decisions', 'cost optimization'],
    },
    {
      text: 'How would you architect a serverless, event-driven API on AWS using API Gateway, AWS Lambda, SQS, and DynamoDB?',
      difficulty: 'hard',
      expectedConcepts: ['serverless architecture', 'cold starts', 'dead-letter queues', 'DynamoDB partition keys', 'IAM roles'],
    },
    {
      text: 'Explain the difference between S3 storage classes (Standard, Infrequent Access, Glacier) and how lifecycle policies optimize storage costs.',
      difficulty: 'easy',
      expectedConcepts: ['storage tiers', 'lifecycle rules', 'retrieval costs', 'durability', 'cost optimization'],
    },
    {
      text: 'How do you design a secure VPC network topology on AWS, including public vs private subnets, NAT Gateways, and Security Groups?',
      difficulty: 'hard',
      expectedConcepts: ['VPC CIDR blocks', 'route tables', 'NAT Gateway', 'Security Groups vs NACLs', 'bastion/transit gateway'],
    },
    {
      text: 'How would you diagnose and resolve a sudden performance spike or high connection count in an RDS PostgreSQL or MySQL instance?',
      difficulty: 'medium',
      expectedConcepts: ['CloudWatch metrics', 'Performance Insights', 'connection pooling / RDS Proxy', 'slow query log', 'read replicas'],
    },
  ],
  'machine learning': [
    {
      text: 'Explain the bias-variance trade-off in machine learning. How do regularization techniques like L1 (Lasso) and L2 (Ridge) manage it?',
      difficulty: 'medium',
      expectedConcepts: ['underfitting', 'overfitting', 'L1/L2 regularization', 'cross-validation', 'model complexity'],
    },
    {
      text: 'How do you handle severe class imbalance in a dataset (e.g. 99.9% negative, 0.1% positive) during model training and evaluation?',
      difficulty: 'hard',
      expectedConcepts: ['precision-recall curve', 'PR-AUC / F1-score', 'SMOTE / oversampling', 'class weights', 'cost-sensitive learning'],
    },
    {
      text: 'Compare decision tree ensembles: Random Forests vs Gradient Boosted Trees (XGBoost/LightGBM). When would you prefer one over the other?',
      difficulty: 'medium',
      expectedConcepts: ['bagging vs boosting', 'parallel training', 'loss gradient fitting', 'hyperparameter tuning', 'interpretability'],
    },
    {
      text: 'Walk me through how you validate a machine learning model without data leakage, especially when dealing with time-series or grouped data.',
      difficulty: 'hard',
      expectedConcepts: ['train-validation-test split', 'time-series split', 'group k-fold', 'feature engineering pipeline isolation', 'data leakage'],
    },
  ],
  'deep learning': [
    {
      text: 'Explain how backpropagation and gradient descent work in neural networks. What role does the chain rule play in weight updates?',
      difficulty: 'medium',
      expectedConcepts: ['gradient descent', 'chain rule', 'loss function', 'weight update', 'activation function'],
    },
    {
      text: 'What are vanishing and exploding gradients, and how do modern architectures (such as ResNet skip connections or LayerNorm) mitigate them?',
      difficulty: 'hard',
      expectedConcepts: ['gradient propagation', 'skip/residual connections', 'batch/layer normalization', 'ReLU/GELU activations', 'gradient clipping'],
    },
    {
      text: 'Explain the core intuition behind the Transformer architecture and self-attention mechanism compared to recurrent networks (RNNs/LSTMs).',
      difficulty: 'hard',
      expectedConcepts: ['self-attention', 'query-key-value matrices', 'parallelization', 'positional encoding', 'multi-head attention'],
    },
    {
      text: 'How do you prevent overfitting in deep neural networks? Compare dropout, weight decay, early stopping, and data augmentation.',
      difficulty: 'medium',
      expectedConcepts: ['dropout rate', 'L2 weight decay', 'early stopping on validation loss', 'data augmentation', 'batch size effects'],
    },
  ],
  git: [
    {
      text: 'Explain the difference between `git merge` and `git rebase`. When would you use each in a collaborative team workflow?',
      difficulty: 'easy',
      expectedConcepts: ['merge commit', 'linear history', 'rebase', 'conflict resolution', 'golden rule of rebasing'],
    },
    {
      text: 'How do you resolve a complex merge conflict where multiple commits touched the same lines of code in different branches?',
      difficulty: 'medium',
      expectedConcepts: ['conflict markers', 'git diff', 'git status', 'aborting merge/rebase', 'testing after resolution'],
    },
    {
      text: 'Explain how `git cherry-pick`, `git stash`, and `git revert` work. How does `git revert` differ fundamentally from `git reset --hard`?',
      difficulty: 'medium',
      expectedConcepts: ['cherry-pick commit hash', 'stash push/pop', 'safe revert commit', 'reset history rewrites', 'public vs local branch safety'],
    },
    {
      text: 'What branching strategy do you prefer (e.g., Trunk-Based Development vs GitFlow), and how does it support continuous integration and rapid delivery?',
      difficulty: 'medium',
      expectedConcepts: ['trunk-based development', 'short-lived feature branches', 'pull request review', 'feature flags', 'CI automation'],
    },
  ],
  java: [
    {
      text: 'Explain Java garbage collection. How do generational collectors (like G1 or ZGC) work, and how do you diagnose memory leaks or high GC pause times?',
      difficulty: 'hard',
      expectedConcepts: ['heap space', 'young/old generation', 'GC algorithms', 'memory management', 'heap dumps / profilers'],
    },
    {
      text: 'Explain the difference between `Comparable` and `Comparator` in Java. When would you prefer one over the other?',
      difficulty: 'easy',
      expectedConcepts: ['natural ordering', 'custom comparator', 'compareTo vs compare', 'lambda expressions', 'sorting collections'],
    },
    {
      text: 'How does thread synchronization work in Java? Compare the `synchronized` keyword with `ReentrantLock` and concurrent collections.',
      difficulty: 'medium',
      expectedConcepts: ['intrinsic lock / monitor', 'ReentrantLock fairness', 'deadlocks', 'ConcurrentHashMap', 'atomic variables'],
    },
    {
      text: 'What are the key functional features in modern Java (Streams, Lambdas, Optional), and what are common pitfalls when using parallel streams?',
      difficulty: 'medium',
      expectedConcepts: ['stream pipeline', 'intermediate vs terminal operations', 'common ForkJoinPool', 'null safety with Optional', 'side-effects'],
    },
    {
      text: 'Explain how the Java Virtual Machine (JVM) executes bytecode. What is Just-In-Time (JIT) compilation and tiered compilation?',
      difficulty: 'hard',
      expectedConcepts: ['bytecode interpretation', 'JIT compiler (C1/C2)', 'hotspot detection', 'inlining', 'escape analysis'],
    },
  ],
  'c++': [
    {
      text: 'What is the difference between stack and heap memory in C++? How does RAII ensure exception-safe resource management?',
      difficulty: 'medium',
      expectedConcepts: ['RAII', 'stack allocation speed', 'heap fragmentation', 'deterministic destruction', 'exception safety'],
    },
    {
      text: 'Explain the differences between `std::unique_ptr`, `std::shared_ptr`, and `std::weak_ptr`. How do weak pointers prevent circular reference leaks?',
      difficulty: 'medium',
      expectedConcepts: ['exclusive ownership', 'reference counting control block', 'std::weak_ptr lock', 'custom deleters', 'overhead'],
    },
    {
      text: 'Explain move semantics and rvalue references (`&&`) in modern C++. How do `std::move` and `std::forward` eliminate unnecessary deep copies?',
      difficulty: 'hard',
      expectedConcepts: ['rvalues vs lvalues', 'move constructor', 'move assignment', 'perfect forwarding', 'resource transfer'],
    },
    {
      text: 'What are C++ virtual functions, virtual tables (vtables), and virtual table pointers (vptrs)? What is the runtime cost of dynamic polymorphism?',
      difficulty: 'hard',
      expectedConcepts: ['vtable structure', 'vptr indirection', 'dynamic dispatch overhead', 'virtual destructors', 'cache misses'],
    },
  ],
  'rest api': [
    {
      text: 'What are the key principles of RESTful API design? How do idempotency and safe HTTP methods apply to PUT, POST, PATCH, and DELETE?',
      difficulty: 'medium',
      expectedConcepts: ['statelessness', 'resource-based URLs', 'HTTP methods', 'status codes', 'idempotency'],
    },
    {
      text: 'How do you handle API versioning, pagination (cursor vs offset), and backward compatibility in a growing public API?',
      difficulty: 'medium',
      expectedConcepts: ['cursor-based pagination', 'offset-limit trade-offs', 'URI vs header versioning', 'breaking change prevention'],
    },
    {
      text: 'How do you design a rate-limiting and throttling strategy for a multi-tenant REST API to prevent abuse and ensure service availability?',
      difficulty: 'hard',
      expectedConcepts: ['token bucket / leaky bucket', 'Redis rate limiting', 'HTTP 429 Too Many Requests', 'sliding window', 'tier limits'],
    },
    {
      text: 'How do you structure error responses in a REST API according to standards like RFC 7807 (Problem Details)? Provide an example.',
      difficulty: 'easy',
      expectedConcepts: ['RFC 7807', 'HTTP status codes', 'structured error payload', 'validation error details', 'debug traceability'],
    },
  ],
  graphql: [
    {
      text: 'What are the architectural advantages and trade-offs of GraphQL compared to REST? When would you choose one over the other?',
      difficulty: 'easy',
      expectedConcepts: ['over-fetching', 'under-fetching', 'strongly typed schema', 'single endpoint', 'caching complexity'],
    },
    {
      text: 'How do you solve the N+1 query problem in GraphQL resolvers using batching tools like DataLoader?',
      difficulty: 'medium',
      expectedConcepts: ['N+1 problem', 'DataLoader batching', 'memoization cache', 'event loop tick dispatch', 'database load reduction'],
    },
    {
      text: 'How do you implement authentication, field-level authorization, and query depth/complexity limiting in a GraphQL API?',
      difficulty: 'hard',
      expectedConcepts: ['context injection', 'field middleware/directives', 'query cost analysis', 'depth limiting', 'DDoS protection'],
    },
  ],
  redis: [
    {
      text: 'How does Redis work as an in-memory datastore? Explain common caching strategies like Cache-Aside, Write-Through, and Write-Behind.',
      difficulty: 'medium',
      expectedConcepts: ['in-memory performance', 'TTL', 'Cache-Aside pattern', 'Write-Through', 'cache invalidation'],
    },
    {
      text: 'Explain the core Redis data structures (Strings, Hashes, Lists, Sets, Sorted Sets) and provide a real-world use case for Sorted Sets.',
      difficulty: 'easy',
      expectedConcepts: ['data types', 'ZSET score ranking', 'leaderboards', 'rate limiter sliding window', 'time complexity'],
    },
    {
      text: 'How do you prevent and mitigate cache stampede (thundering herd), cache penetration, and cache avalanche in high-traffic Redis deployments?',
      difficulty: 'hard',
      expectedConcepts: ['mutex locking / singleflight', 'probabilistic early expiration', 'bloom filters for non-existent keys', 'TTL jitter', 'circuit breakers'],
    },
    {
      text: 'Compare Redis persistence mechanisms (RDB point-in-time snapshots vs AOF logs). What are the trade-offs between durability and latency?',
      difficulty: 'medium',
      expectedConcepts: ['RDB fork snapshot', 'AOF fsync policies (everysec/always)', 'recovery time', 'durability vs throughput', 'hybrid persistence'],
    },
  ],
  // General programming concepts
  'data structures': [
    {
      text: 'Explain the time and space complexity of common operations for arrays, linked lists, hash tables, and balanced binary search trees.',
      difficulty: 'medium',
      expectedConcepts: ['O(1) hash lookup', 'O(n) linked list search', 'O(log n) BST', 'O(1) array access', 'trade-offs'],
    },
    {
      text: 'How does a Hash Map handle collisions under the hood? Compare separate chaining with open addressing and discuss worst-case performance.',
      difficulty: 'medium',
      expectedConcepts: ['hash function distribution', 'separate chaining (linked list/tree)', 'open addressing (linear probing)', 'load factor', 'rehashing'],
    },
    {
      text: 'When would you select a Trie (Prefix Tree) or a Priority Queue (Heap) over a standard hash map or sorted array?',
      difficulty: 'hard',
      expectedConcepts: ['prefix search', 'autocomplete', 'min/max heap operations', 'O(log k) priority retrieval', 'space complexity'],
    },
  ],
  algorithms: [
    {
      text: 'Explain Big O notation and give examples of O(1), O(log n), O(n), O(n log n), and O(n²) algorithms.',
      difficulty: 'easy',
      expectedConcepts: ['time complexity', 'space complexity', 'worst case', 'best case', 'amortized analysis'],
    },
    {
      text: 'Compare Depth-First Search (DFS) and Breadth-First Search (BFS). In what scenarios would you choose BFS over DFS for graph or tree traversal?',
      difficulty: 'medium',
      expectedConcepts: ['queue vs stack/recursion', 'shortest path in unweighted graphs', 'topological sort', 'memory requirements', 'cycle detection'],
    },
    {
      text: 'Explain the principles of Dynamic Programming. How do memoization (top-down) and tabulation (bottom-up) eliminate redundant subproblem calculations?',
      difficulty: 'hard',
      expectedConcepts: ['overlapping subproblems', 'optimal substructure', 'memoization top-down', 'tabulation bottom-up', 'state transitions'],
    },
  ],
  'system design': [
    {
      text: 'How would you design a scalable URL shortener service (like bit.ly)? Walk me through data storage, hashing, redirection latency, and caching.',
      difficulty: 'medium',
      expectedConcepts: ['base62 encoding / hashing', 'database schema', 'Redis cache layer', 'read vs write ratio', 'redirect status 301 vs 302'],
    },
    {
      text: 'How do you design a real-time notification service handling millions of daily notifications across WebSockets, Push, and Email?',
      difficulty: 'hard',
      expectedConcepts: ['message brokers (Kafka/RabbitMQ)', 'WebSocket connection gateway', 'idempotent delivery', 'user notification preferences', 'rate limiting'],
    },
    {
      text: 'Explain how you design a distributed rate limiter that coordinates limits across multiple stateless application instances with low latency.',
      difficulty: 'hard',
      expectedConcepts: ['Redis sliding window / token bucket', 'Lua scripting for atomicity', 'local in-memory batching', 'graceful degradation', 'clock drift'],
    },
    {
      text: 'Compare horizontal vs vertical scaling and explain how database sharding, replication, and connection pooling solve database bottlenecks.',
      difficulty: 'medium',
      expectedConcepts: ['read replicas', 'sharding key selection', 'connection pooling', 'failover', 'CAP theorem trade-offs'],
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
// DEDUPLICATION & SIMILARITY CONFIGURATION (3-LAYER SYSTEM)
// ─────────────────────────────────────────────────────────────────────────────

const EXACT_DUPLICATE = 1.0;
const NEAR_DUPLICATE_THRESHOLD = 0.85;       // Level 2: Token Jaccard >= 0.85 (conservative)
const STRUCTURAL_DUPLICATE_THRESHOLD = 0.55; // Level 3: Same skill + category + intent with substantial token overlap

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'from',
  'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'to', 'of', 'in', 'on', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'how',
  'why', 'you', 'your', 'we', 'our', 'i', 'me', 'my', 'he', 'she', 'they', 'them',
  'their', 'theirs', 'it', 'its', 'please', 'tell', 'walk'
]);

/**
 * Normalizes question text for robust comparison.
 * Lowercases, collapses whitespaces, and removes punctuation.
 */
const normalizeQuestionText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
};

/**
 * Lightweight deterministic stemmer for common English suffixes.
 * Normalizes inflections (e.g. handle/handled, operation/operations) without external dependencies.
 */
const stemToken = (word) => {
  if (!word || word.length <= 3) return word;
  return word
    .replace(/(ing|edly|ingly|ed|es|s|ly|tion|ment)$/, '')
    .replace(/e$/, '');
};

/**
 * Extracts meaningful content tokens, omitting common stop words and applying lightweight stemming.
 */
const extractContentTokens = (text) => {
  const norm = normalizeQuestionText(text);
  if (!norm) return new Set();
  const words = norm.split(' ');
  const tokens = new Set();
  for (const w of words) {
    if (w.length > 1 && !STOP_WORDS.has(w)) {
      tokens.add(stemToken(w));
    }
  }
  return tokens;
};

/**
 * Computes Jaccard similarity between two token sets.
 */
const calculateTokenJaccard = (tokensA, tokensB) => {
  if (!tokensA || !tokensB || tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Detects question intent from text patterns.
 */
const detectQuestionIntent = (text) => {
  const lower = (text || '').toLowerCase();
  if (/\b(design|architect|structure|scal(e|ing)|high-throughput)\b/.test(lower)) return 'design';
  if (/\b(troubleshoot|diagnos(e|ing)|debug|optimiz(e|ation)|bottleneck|slow|crash|leak)\b/.test(lower)) return 'troubleshoot';
  if (/\b(compare|difference|trade-off|versus|vs|pros and cons|when would you choose)\b/.test(lower)) return 'tradeoff';
  if (/\b(how do you|how would you|implement|setup|configure|walk through|build)\b/.test(lower)) return 'implementation';
  if (/\b(explain|what (is|are)|describe|define|how does|why does)\b/.test(lower)) return 'explain';
  return 'general';
};

/**
 * 3-Layer Duplicate Detection:
 *
 * LEVEL 1 — Exact normalized match (punctuation/spacing invariant)
 * LEVEL 2 — Near-exact similarity (Jaccard on content tokens >= NEAR_DUPLICATE_THRESHOLD)
 * LEVEL 3 — Structural similarity (same skill + category + intent with Jaccard >= STRUCTURAL_DUPLICATE_THRESHOLD)
 *
 * Never rejects legitimate questions sharing vocabulary across different intents
 * (e.g. "Explain polymorphism in Java" vs "Design a polymorphic payment system").
 */
const isDuplicateQuestion = (candidate, existingQuestionsOrTexts = [], options = {}) => {
  const candidateText = typeof candidate === 'string' ? candidate : candidate?.text;
  if (!candidateText) return { isDuplicate: false };

  const normCandidate = normalizeQuestionText(candidateText);
  if (!normCandidate) return { isDuplicate: false };

  const candidateTokens = extractContentTokens(candidateText);
  const candidateIntent = options.intent || detectQuestionIntent(candidateText);
  const candidateSkill = (options.skill || candidate?.targetSkill || candidate?.skill || '').toLowerCase();
  const candidateCategory = (options.category || candidate?.category || candidate?.type || '').toLowerCase();

  const nearThreshold = options.nearThreshold || NEAR_DUPLICATE_THRESHOLD;
  const structuralThreshold = options.structuralThreshold || STRUCTURAL_DUPLICATE_THRESHOLD;

  const existingList = Array.isArray(existingQuestionsOrTexts)
    ? existingQuestionsOrTexts
    : (existingQuestionsOrTexts instanceof Set ? Array.from(existingQuestionsOrTexts) : []);

  for (const existing of existingList) {
    const existingText = typeof existing === 'string' ? existing : existing?.text;
    if (!existingText) continue;

    // LEVEL 1: Exact normalized match
    const normExisting = normalizeQuestionText(existingText);
    if (normCandidate === normExisting) {
      return { isDuplicate: true, layer: 1, reason: 'exact_match', matchedWith: existingText };
    }

    // LEVEL 2: Near-exact token Jaccard similarity
    const existingTokens = extractContentTokens(existingText);
    const jaccard = calculateTokenJaccard(candidateTokens, existingTokens);
    if (jaccard >= nearThreshold) {
      return { isDuplicate: true, layer: 2, reason: 'near_exact_similarity', score: jaccard, matchedWith: existingText };
    }

    // LEVEL 3: Structural similarity (same skill + category + intent)
    const existingSkill = (existing?.targetSkill || existing?.skill || options.existingSkill || options.skill || '').toLowerCase();
    const existingCategory = (existing?.category || existing?.type || options.existingCategory || options.category || '').toLowerCase();
    const existingIntent = detectQuestionIntent(existingText);

    const sameSkill = Boolean(candidateSkill && existingSkill && candidateSkill === existingSkill);
    const sameCategory = Boolean(candidateCategory && existingCategory && candidateCategory === existingCategory);
    const sameIntent = candidateIntent !== 'general' && candidateIntent === existingIntent;

    let tokenIntersection = 0;
    for (const token of candidateTokens) {
      if (existingTokens.has(token)) tokenIntersection++;
    }
    const minTokens = Math.min(candidateTokens.size, existingTokens.size);
    const containment = minTokens > 0 ? tokenIntersection / minTokens : 0;

    if (sameSkill && sameCategory && sameIntent && (jaccard >= structuralThreshold || containment >= 0.65)) {
      return { isDuplicate: true, layer: 3, reason: 'structural_intent_similarity', score: Math.max(jaccard, containment), matchedWith: existingText };
    }
  }

  return { isDuplicate: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates non-mutating shuffle.
 * Guarantees uniform random distribution without array mutation.
 */
const fisherYatesShuffle = (arr) => {
  if (!Array.isArray(arr) || arr.length <= 1) return [...(arr || [])];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
};

// Backward-compatible alias
const shuffle = fisherYatesShuffle;

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
const generateCodingQuestions = (matchedSkills = [], difficulty = 'medium', count = 1, avoidQuestions = []) => {
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
  const shuffled = fisherYatesShuffle(pool);

  for (const t of shuffled) {
    if (isDuplicateQuestion(t, avoidQuestions).isDuplicate) continue;
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
    if (questions.length >= count) break;
  }

  return questions;
};

/**
 * Generate technical questions for matched/required skills.
 * Prioritizes weak skills from previous evaluation when available.
 */
const generateTechnicalQuestions = (
  matchedSkills = [],
  difficulty = 'medium',
  maxPerSkill = 1,
  avoidQuestions = [],
  weakAreas = []
) => {
  const questions = [];
  const seen = new Set();

  // Normalize weak areas for prioritization
  const normalizedWeakSet = new Set(
    (weakAreas || []).map((w) => normalizeSkillKey(w) || w.toLowerCase().trim()).filter(Boolean)
  );

  // Partition skills: weak skills first, then remaining matched skills
  const prioritizedSkills = [];
  const otherSkills = [];

  for (const skill of matchedSkills) {
    const key = normalizeSkillKey(skill);
    if (key && (normalizedWeakSet.has(key) || normalizedWeakSet.has(skill.toLowerCase().trim()))) {
      prioritizedSkills.push(skill);
    } else {
      otherSkills.push(skill);
    }
  }

  const orderedSkills = [...fisherYatesShuffle(prioritizedSkills), ...fisherYatesShuffle(otherSkills)];

  for (const skill of orderedSkills) {
    const templates = findTemplatesForSkill(skill);
    if (!templates.length) continue;

    const isWeakArea = prioritizedSkills.includes(skill);
    const diffFiltered = templates.filter((t) => t.difficulty === difficulty);
    const pool = diffFiltered.length > 0 ? diffFiltered : templates;
    const shuffled = fisherYatesShuffle(pool);

    let addedForSkill = 0;
    for (const t of shuffled) {
      if (seen.has(t.text)) continue;

      // Duplicate check against avoid list and previously selected
      const dupCheck = isDuplicateQuestion(
        { ...t, targetSkill: skill, category: 'technical' },
        [...avoidQuestions, ...questions]
      );
      if (dupCheck.isDuplicate) continue;

      seen.add(t.text);
      questions.push({
        text: t.text,
        type: 'technical',
        category: 'technical',
        difficulty: t.difficulty || difficulty,
        targetSkill: skill,
        skill: skill,
        source: isWeakArea ? 'skill_gap' : 'job_description',
        sourceProject: null,
        expectedConcepts: t.expectedConcepts || [],
        expectedKeyPoints: t.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: isWeakArea ? `Targeted reattempt question for improvement in ${skill}` : null,
      });
      addedForSkill++;
      if (addedForSkill >= maxPerSkill) break;
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

// ─────────────────────────────────────────────────────────────────────────────
// INTRODUCTION INTENT VARIANTS (6 Distinct Professional Angles)
// ─────────────────────────────────────────────────────────────────────────────

const INTRODUCTION_INTENTS = [
  {
    intent: 'professional_background',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Welcome, ${name}. To start our conversation, please walk me through your professional background in technology, highlighting the key milestones that prepared you for this ${targetRole} role.`
        : `To start our interview, please walk me through your professional background in technology, highlighting the key milestones that prepared you for this ${targetRole} role.`,
      expectedConcepts: ['career summary', 'technical milestones', 'relevant experience', 'clear communication'],
    }),
  },
  {
    intent: 'recent_project',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Welcome, ${name}. To begin, could you walk me through the most impactful engineering project you recently delivered, detailing the core challenges you solved and your contributions as a ${targetRole}?`
        : `To begin our interview, could you walk me through the most impactful engineering project you recently delivered, detailing the core technical challenges you solved?`,
      expectedConcepts: ['project context', 'technical contribution', 'problem solving', 'outcome and impact'],
    }),
  },
  {
    intent: 'strongest_skill',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Hello, ${name}. As we kick off, I would love to hear about what you consider your strongest technical competency, and how you have applied it to build robust production systems relevant to a ${targetRole}.`
        : `To start off, what do you consider your strongest technical competency, and how have you applied it to solve complex challenges in production environments?`,
      expectedConcepts: ['core technical strength', 'depth of knowledge', 'production application', 'engineering judgment'],
    }),
  },
  {
    intent: 'role_motivation',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Welcome, ${name}. To begin our conversation, what specifically drew your interest to this ${targetRole} position, and how does your engineering background align with the challenges of this role?`
        : `To start our interview, what specifically drew your interest to this ${targetRole} opportunity, and how does this role align with your technical strengths?`,
      expectedConcepts: ['role motivation', 'career alignment', 'technical strengths', 'value proposition'],
    }),
  },
  {
    intent: 'engineering_philosophy',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Welcome, ${name}. To get started, could you share your overarching engineering philosophy—how you approach code quality, trade-offs between delivery speed and maintainability, and collaboration as a ${targetRole}?`
        : `To get started, how do you approach code quality, engineering trade-offs, and technical problem-solving when delivering critical software systems?`,
      expectedConcepts: ['engineering philosophy', 'code quality', 'trade-off evaluation', 'collaboration'],
    }),
  },
  {
    intent: 'technical_evolution',
    buildQuestion: (name, targetRole) => ({
      text: name
        ? `Hello, ${name}. To open our discussion, how has your technical focus and skill set evolved over recent years, and what modern technologies are you most passionate about leveraging in this ${targetRole} role?`
        : `To begin, walk me through how your technical focus has evolved recently, and what modern software paradigms or tools you find most effective in your daily work.`,
      expectedConcepts: ['continuous learning', 'technology adaptation', 'modern tooling', 'technical maturity'],
    }),
  },
];

/**
 * Generate introduction / warm-up question tailored to candidate profile and target role.
 * Rotates across distinct professional intents and avoids previously asked questions.
 */
const generateIntroductionQuestions = (targetRole = 'Software Engineer', candidateProfile = {}, avoidQuestions = []) => {
  const name = candidateProfile.basicInfo?.name;
  const shuffledVariants = fisherYatesShuffle(INTRODUCTION_INTENTS);

  let chosenVariant = null;
  let fallbackVariant = null;

  for (const variant of shuffledVariants) {
    const candidateQ = variant.buildQuestion(name, targetRole);
    if (!fallbackVariant) fallbackVariant = { ...candidateQ, intent: variant.intent };

    const dupCheck = isDuplicateQuestion(candidateQ, avoidQuestions);
    if (!dupCheck.isDuplicate) {
      chosenVariant = { ...candidateQ, intent: variant.intent };
      break;
    }
  }

  const selected = chosenVariant || fallbackVariant;

  return [
    {
      text: selected.text,
      type: 'introduction',
      category: 'introduction',
      difficulty: 'easy',
      targetSkill: 'communication',
      skill: 'communication',
      source: 'general_pool',
      sourceProject: null,
      expectedConcepts: selected.expectedConcepts,
      expectedTopics: selected.expectedConcepts,
      expectedKeyPoints: selected.expectedConcepts,
      followUpAllowed: true,
      contextNote: 'Introduction question to establish communication cadence and technical background.',
    },
  ];
};

/**
 * Generate questions based on resume projects.
 * Explicitly references project titles, technology stack, and architectural decisions.
 */
const generateProjectQuestions = (projects = [], skills = [], difficulty = 'medium', avoidQuestions = []) => {
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

    const selected = fisherYatesShuffle(templates).slice(0, 2);
    for (const t of selected) {
      if (seen.has(t.text)) continue;

      const dupCheck = isDuplicateQuestion(t, [...avoidQuestions, ...questions]);
      if (dupCheck.isDuplicate) continue;

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
const generateExperienceQuestions = (experience = [], difficulty = 'medium', avoidQuestions = []) => {
  if (!experience.length) {
    const shuffled = fisherYatesShuffle(EXPERIENCE_TEMPLATES);
    const chosen = shuffled.find((q) => !isDuplicateQuestion(q, avoidQuestions).isDuplicate) || shuffled[0];
    return [chosen].map((q) => ({
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

    const candidateObj = { text: qText, targetSkill: 'professional-experience', category: 'resume' };
    if (isDuplicateQuestion(candidateObj, [...avoidQuestions, ...questions]).isDuplicate) {
      continue;
    }

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
const generateBehavioralQuestions = (count = 2, difficulty = 'medium', avoidQuestions = []) => {
  const filtered = BEHAVIORAL_TEMPLATES.filter((t) => t.difficulty === difficulty || t.difficulty === 'medium');
  const pool = filtered.length > 0 ? filtered : BEHAVIORAL_TEMPLATES;
  const shuffled = fisherYatesShuffle(pool);

  const selected = [];
  for (const q of shuffled) {
    if (isDuplicateQuestion(q, [...avoidQuestions, ...selected]).isDuplicate) continue;
    selected.push({
      ...q,
      source: 'general_pool',
      expectedTopics: q.expectedConcepts || [],
    });
    if (selected.length >= count) break;
  }

  // If pool exhausted by avoid list, pick least similar
  if (selected.length < count) {
    for (const q of shuffled) {
      if (!selected.some(s => s.text === q.text)) {
        selected.push({
          ...q,
          source: 'general_pool',
          expectedTopics: q.expectedConcepts || [],
        });
      }
      if (selected.length >= count) break;
    }
  }

  return selected;
};

/**
 * Generate skill-gap questions for missing or weak required skills.
 */
const generateSkillGapQuestions = (missingSkills = [], difficulty = 'medium', avoidQuestions = []) => {
  if (!missingSkills.length) return [];
  const questions = [];
  const seen = new Set();

  for (const skill of missingSkills.slice(0, 3)) {
    const templates = findTemplatesForSkill(skill);

    if (templates.length > 0) {
      const shuffledTemplates = fisherYatesShuffle(templates);
      const chosen = shuffledTemplates.find(
        (t) => !isDuplicateQuestion({ ...t, targetSkill: skill }, [...avoidQuestions, ...questions]).isDuplicate
      ) || shuffledTemplates[0];

      if (seen.has(chosen.text)) continue;
      seen.add(chosen.text);

      const note = `${skill} was identified in the job description requirements but not explicitly in your resume.`;
      questions.push({
        text: chosen.text,
        type: 'skill_gap',
        category: 'skill_gap',
        difficulty: chosen.difficulty || difficulty,
        targetSkill: skill,
        skill: skill,
        source: 'skill_gap',
        sourceProject: null,
        expectedConcepts: chosen.expectedConcepts || [],
        expectedTopics: chosen.expectedConcepts || [],
        expectedKeyPoints: chosen.expectedConcepts || [],
        followUpAllowed: true,
        contextNote: note,
      });
    } else {
      const text = `The job description emphasizes hands-on experience with ${skill}. Could you describe your familiarity with ${skill}, any related tools you have used, or how you would ramp up on it rapidly?`;
      if (seen.has(text)) continue;
      if (isDuplicateQuestion({ text, targetSkill: skill }, [...avoidQuestions, ...questions]).isDuplicate) continue;

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
const generateJobSpecificQuestions = (responsibilities = [], requiredSkills = [], difficulty = 'medium', avoidQuestions = []) => {
  if (!responsibilities.length && !requiredSkills.length) return [];
  const questions = [];

  if (responsibilities.length > 0) {
    const shuffledResp = fisherYatesShuffle(responsibilities);
    for (const resp of shuffledResp) {
      const respText = typeof resp === 'string' ? resp : (resp.text || JSON.stringify(resp));
      const text = `One key responsibility highlighted in this job is: "${respText.substring(0, 160).trim()}". How has your past engineering experience prepared you to handle this effectively?`;

      if (!isDuplicateQuestion(text, avoidQuestions).isDuplicate) {
        questions.push({
          text,
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
        break;
      }
    }
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
// MAIN GENERATOR — PROGRESSIVE, DIVERSE & PERSONALIZED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a full personalized interview question set with progressive flow:
 * Introduction → Resume Experience → Projects → Role & Technical Skills (Prioritizing Weak Areas on Reattempt) → JD / Skill Gap → Behavioral
 *
 * Supported params:
 *   - candidateProfile: parsed resume data
 *   - jobProfile: parsed job description data
 *   - skillAnalysis: skill gap matching output
 *   - targetRole: configured job role
 *   - interviewType: 'mixed' | 'technical' | 'behavioral'
 *   - difficulty: 'easy' | 'medium' | 'hard'
 *   - totalQuestions: target count
 *   - avoidTexts: array/set of questions from previous interviews to exclude
 *   - weakAreas: array of weak skills from previous evaluation to prioritize
 *   - isPracticeAttempt: boolean flag indicating if this is a targeted improvement interview
 */
const generateInterviewQuestions = ({
  candidateProfile = {},
  jobProfile = {},
  skillAnalysis = {},
  targetRole = 'Software Engineer',
  interviewType = 'mixed',
  difficulty = 'medium',
  totalQuestions = 10,
  avoidTexts = [],
  weakAreas = [],
  isPracticeAttempt = false,
}) => {
  const max = Math.max(3, Math.min(totalQuestions, 15));
  const questions = [];

  const avoidList = Array.isArray(avoidTexts)
    ? avoidTexts
    : (avoidTexts instanceof Set ? Array.from(avoidTexts) : []);

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

  // ── Stage 1: Introduction (Always first, rotates variant without repetition) ──
  const introQuestions = generateIntroductionQuestions(targetRole, candidateProfile, avoidList);
  questions.push(...introQuestions);

  // ── Stage 2: Resume Experience (if available) ──────────────────────────────
  if (candidateExperience.length > 0 && max >= 4) {
    const expQuestions = generateExperienceQuestions(candidateExperience, difficulty, [...avoidList, ...questions]);
    if (expQuestions.length > 0) {
      questions.push(expQuestions[0]);
    }
  }

  // ── Stage 3: Resume Project Questions (Referencing specific projects) ──────
  if (candidateProjects.length > 0 && questions.length < max) {
    const projQuestions = generateProjectQuestions(candidateProjects, candidateSkills, difficulty, [...avoidList, ...questions]);
    const maxProjectsToInclude = max >= 10 ? 2 : 1;
    questions.push(...projQuestions.slice(0, maxProjectsToInclude));
  }

  // ── Stage 4: Role-Specific & Matched Technical Questions ───────────────────
  // Role question: shuffle pool and select a candidate that is NOT in avoid list
  const roleQuestions = getRoleSpecificQuestions(targetRole, difficulty);
  if (roleQuestions.length > 0 && questions.length < max) {
    const shuffledRole = fisherYatesShuffle(roleQuestions);
    const selectedRole = shuffledRole.find(
      (rq) => !isDuplicateQuestion(rq, [...avoidList, ...questions]).isDuplicate
    ) || shuffledRole[0];

    if (selectedRole) {
      questions.push(selectedRole);
    }
  }

  // Technical questions for candidate's matched skills + prioritized weak areas
  const skillsToAssess = matchedSkills.length > 0 ? matchedSkills : candidateSkills;
  if ((skillsToAssess.length > 0 || weakAreas.length > 0) && questions.length < max) {
    const neededTechCount = Math.max(1, Math.floor((max - questions.length) * 0.6));
    const techQuestions = generateTechnicalQuestions(
      skillsToAssess,
      difficulty,
      1,
      [...avoidList, ...questions],
      weakAreas
    );
    questions.push(...techQuestions.slice(0, neededTechCount));
  }

  // ── Stage 5: Job Description & Skill Gap Questions ────────────────────────
  if (missingSkills.length > 0 && questions.length < max - 1) {
    const gapQuestions = generateSkillGapQuestions(missingSkills, difficulty, [...avoidList, ...questions]);
    if (gapQuestions.length > 0) {
      questions.push(gapQuestions[0]);
    }
  }

  if (responsibilities.length > 0 && questions.length < max - 1) {
    const jobQs = generateJobSpecificQuestions(responsibilities, requiredSkills, difficulty, [...avoidList, ...questions]);
    if (jobQs.length > 0) {
      questions.push(jobQs[0]);
    }
  }

  // ── Stage 6: Behavioral STAR Questions ─────────────────────────────────────
  if (questions.length < max) {
    const behCount = Math.max(1, Math.min(2, max - questions.length));
    const behQuestions = generateBehavioralQuestions(behCount, difficulty, [...avoidList, ...questions]);
    questions.push(...behQuestions);
  }

  // ── Fallback Fillers if below max (Role questions & general pool) ───────────
  if (questions.length < max) {
    if (roleQuestions.length > 1) {
      const remainingRole = fisherYatesShuffle(roleQuestions).filter(
        (rq) => !isDuplicateQuestion(rq, [...avoidList, ...questions]).isDuplicate
      );
      questions.push(...remainingRole.slice(0, max - questions.length));
    }
  }

  // ── Stage 7: Layered Intra-Batch Deduplication & Quality Filtering ─────────
  const deduped = [];
  for (const q of questions) {
    if (!q || !q.text || q.text.trim().length < 15) continue;

    const dupCheck = isDuplicateQuestion(q, deduped);
    if (!dupCheck.isDuplicate) {
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
  return fisherYatesShuffle(questionPool).slice(0, Math.min(count, questionPool.length));
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
  fisherYatesShuffle,
  normalizeQuestionText,
  isDuplicateQuestion,
  calculateTokenJaccard,
  detectQuestionIntent,
  EXACT_DUPLICATE,
  NEAR_DUPLICATE_THRESHOLD,
  STRUCTURAL_DUPLICATE_THRESHOLD,
  STATIC_BANK,
  SKILL_QUESTION_TEMPLATES,
};
