/**
 * Practice Service
 *
 * Dedicated service for generating topic-specific MCQ mock tests (>= 20 questions)
 * and combined weak-area targeted mock assessments.
 */

const { getProvider } = require('./ai/providers/providerFactory');
const { generateCompletion, isConfigured } = require('./llmService');

// ─────────────────────────────────────────────────────────────────────────────
// CURATED DOMAIN QUESTION BANKS (High-standard offline & fallback guarantee)
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_QUESTION_BANKS = {
  react: [
    {
      question: 'What is the primary role of the Virtual DOM in React?',
      options: [
        'To directly replace the browser DOM for faster layout recalculations',
        'To compute minimal diffs in memory before applying batched updates to the real DOM',
        'To bypass HTML rendering and compile directly into WebAssembly',
        'To manage server-side database connections inside React components'
      ],
      correctAnswer: 1,
      explanation: 'React maintains a lightweight Virtual DOM in memory. When state updates occur, the reconciliation engine (Fiber) calculates the minimal diff and batches changes to the browser DOM, minimizing expensive reflows and repaints.',
      topic: 'Virtual DOM & Reconciliation',
      difficulty: 'easy'
    },
    {
      question: 'When using useEffect, what happens if you omit the dependency array entirely?',
      options: [
        'The effect runs only once when the component mounts',
        'The effect runs after every single render of the component',
        'The effect never runs unless explicitly called by an event handler',
        'React throws a compile-time syntax error'
      ],
      correctAnswer: 1,
      explanation: 'Omitting the dependency array causes useEffect to execute after the initial mount and after every subsequent re-render. Providing an empty array [] restricts execution to mount and unmount.',
      topic: 'Hooks (useEffect)',
      difficulty: 'easy'
    },
    {
      question: 'Why should you avoid mutating state directly in React (e.g., state.push(item))?',
      options: [
        'Mutating state directly will throw an uncaught browser DOM security exception',
        'React relies on shallow object equality (Object.is) to detect changes and schedule re-renders',
        'JavaScript arrays are read-only when imported inside React components',
        'Direct mutations cause React to delete the affected component from memory'
      ],
      correctAnswer: 1,
      explanation: 'React uses shallow equality checks (Object.is) to determine if state has changed. Mutating an existing object in-place preserves its reference, causing React to assume no change occurred and skip required re-renders.',
      topic: 'State Management',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of React.useCallback?',
      options: [
        'To memoize the returned value of an expensive mathematical computation',
        'To cache a function definition across renders to preserve referential equality',
        'To execute an asynchronous API call during server-side rendering',
        'To bind class methods automatically to the component context'
      ],
      correctAnswer: 1,
      explanation: 'useCallback caches a function definition between renders. It is primarily used to prevent unnecessary re-renders of memoized child components that depend on stable callback references.',
      topic: 'Performance (useCallback)',
      difficulty: 'medium'
    },
    {
      question: 'In React 18+, what is the difference between useTransition and regular state updates?',
      options: [
        'useTransition forces React to execute the state update synchronously on a web worker',
        'useTransition marks the state update as non-urgent, allowing urgent inputs to interrupt it',
        'useTransition caches previous component renders inside localStorage',
        'useTransition prevents child components from unmounting indefinitely'
      ],
      correctAnswer: 1,
      explanation: 'useTransition allows developers to mark state transitions as non-blocking/non-urgent. Urgent user interactions (typing, clicks) remain responsive while the transition render computes concurrently.',
      topic: 'Concurrent React',
      difficulty: 'advanced'
    },
    {
      question: 'Which of the following is a Rules of Hooks violation in React?',
      options: [
        'Calling custom hooks from inside another custom hook',
        'Calling useMemo inside an if block or after an early return statement',
        'Calling useState at the top level of a functional component body',
        'Passing a state updater function to a child component via props'
      ],
      correctAnswer: 1,
      explanation: 'React relies on the call order of hooks remaining identical on every render cycle. Calling hooks conditionally (inside loops, conditions, or after early returns) corrupts the internal hook queue pointer.',
      topic: 'Rules of Hooks',
      difficulty: 'easy'
    },
    {
      question: 'What problem does React Context primarily solve, and what is its primary trade-off?',
      options: [
        'It replaces Redux entirely without any rendering performance considerations',
        'It solves prop drilling, but every consumer re-renders whenever the context value reference changes',
        'It compiles JSX into native mobile code with zero overhead',
        'It synchronizes client state with backend WebSockets automatically'
      ],
      correctAnswer: 1,
      explanation: 'Context prevents manual prop drilling through intermediate components. However, any change to the provided context value reference triggers re-rendering of all consumers, requiring careful value memoization or state slicing.',
      topic: 'Context API',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of the key prop when rendering lists in React?',
      options: [
        'It establishes CSS stylesheet precedence for list items',
        'It provides a stable identity to help React identify which items changed, were added, or were removed',
        'It sets the tabindex attribute for accessibility screen readers',
        'It automatically sorts list items in alphabetical order'
      ],
      correctAnswer: 1,
      explanation: 'Keys give list elements a stable identity between renders. Without unique, stable keys, reordering or deleting items causes React to reuse wrong component instances and corrupt state.',
      topic: 'Reconciliation & Keys',
      difficulty: 'easy'
    },
    {
      question: 'When should React.useMemo be used?',
      options: [
        'To wrap every single variable declaration in every component unconditionally',
        'To cache the result of an expensive calculation or preserve referential equality of complex objects',
        'To trigger side effects when component props change',
        'To dispatch actions to external global stores'
      ],
      correctAnswer: 1,
      explanation: 'useMemo caches computed values across renders. It should be used when calculations are genuinely computationally intensive, or when passing objects/arrays to memoized children requiring stable references.',
      topic: 'Performance (useMemo)',
      difficulty: 'medium'
    },
    {
      question: 'How does React handle synthetic events differently from native browser DOM events?',
      options: [
        'Synthetic events are dispatched directly to the OS window manager',
        'Synthetic events are pooled/cross-browser wrappers with consistent attributes delegated to the root',
        'Synthetic events cannot access event.preventDefault()',
        'Synthetic events only trigger when Web Workers are enabled'
      ],
      correctAnswer: 1,
      explanation: 'React wraps browser native events in SyntheticEvent wrappers to ensure consistent behavior across browsers and uses event delegation at the React root container for efficiency.',
      topic: 'Event System',
      difficulty: 'medium'
    },
    {
      question: 'What does the cleanup function in useEffect do when returned from the effect callback?',
      options: [
        'It terminates the entire React application thread immediately',
        'It runs before the component unmounts and before re-running the effect on dependency change',
        'It resets component state to its initial useState value',
        'It clears the browser cache and cookies'
      ],
      correctAnswer: 1,
      explanation: 'The function returned by an effect callback is the cleanup function. It runs before the effect re-runs when dependencies change, and runs one final time when the component unmounts to prevent memory leaks.',
      topic: 'Hooks (useEffect Cleanup)',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of Error Boundaries in React?',
      options: [
        'To catch JavaScript syntax errors during code compilation',
        'To catch runtime errors in child component rendering, lifecycle methods, and constructors',
        'To catch unhandled asynchronous network errors inside fetch requests',
        'To prevent browser network disconnects'
      ],
      correctAnswer: 1,
      explanation: 'Error Boundaries are class components that catch JavaScript errors during rendering, lifecycle methods, and constructors of their child component tree, rendering a fallback UI instead of crashing the entire tree.',
      topic: 'Error Boundaries',
      difficulty: 'medium'
    },
    {
      question: 'What is the difference between controlled and uncontrolled components in React forms?',
      options: [
        'Controlled components use Redux; uncontrolled components use Zustand',
        'Controlled component form data is handled by React state; uncontrolled uses DOM refs',
        'Controlled components cannot validate user input',
        'Uncontrolled components are deprecated in React 19'
      ],
      correctAnswer: 1,
      explanation: 'A controlled component has its form value driven by React component state via value and onChange. An uncontrolled component keeps form data in the DOM itself, accessed via React refs.',
      topic: 'Forms & State',
      difficulty: 'easy'
    },
    {
      question: 'What happens during React Fiber\'s render phase vs commit phase?',
      options: [
        'Render phase modifies the DOM; commit phase calculates the difference',
        'Render phase calculates diffs and can be paused/interrupted; commit phase synchronously writes to the DOM',
        'Render phase runs on the server; commit phase runs on the client',
        'Both phases execute identical code in parallel threads'
      ],
      correctAnswer: 1,
      explanation: 'In React Fiber, the render phase is asynchronous and can be paused, resumed, or aborted while computing work. The commit phase is always synchronous and applies actual changes to the DOM and calls effects.',
      topic: 'React Architecture (Fiber)',
      difficulty: 'advanced'
    },
    {
      question: 'What is React.memo used for?',
      options: [
        'To prevent a functional component from re-rendering if its props have not shallowly changed',
        'To store component state permanently in IndexedDB',
        'To memoize asynchronous promises returned by fetch',
        'To replace React Context for deep dependency trees'
      ],
      correctAnswer: 0,
      explanation: 'React.memo is a higher-order component that wraps a component to skip re-rendering when incoming props are shallowly equal to the previous render props.',
      topic: 'Optimization (React.memo)',
      difficulty: 'easy'
    },
    {
      question: 'Why should custom hooks always begin with the word "use"?',
      options: [
        'It is required by the JavaScript V8 engine for garbage collection',
        'It enables linter plugins (eslint-plugin-react-hooks) to enforce Rules of Hooks inside the function',
        'Functions without the "use" prefix cannot return arrays or objects',
        'It binds the function automatically to the nearest parent React component'
      ],
      correctAnswer: 1,
      explanation: 'The "use" naming convention signals to React and tools like ESLint that the function may contain React hooks, allowing static analysis to enforce hook rules correctly.',
      topic: 'Custom Hooks',
      difficulty: 'easy'
    },
    {
      question: 'What is the primary danger of putting an object or array literal directly inside a useEffect dependency array?',
      options: [
        'It causes a syntax error in strict mode',
        'A new reference is created on every render, causing the effect to run on every single render cycle',
        'It mutates the global window object',
        'It prevents the component from ever unmounting'
      ],
      correctAnswer: 1,
      explanation: 'Because JavaScript objects and arrays are compared by reference, declaring an inline literal in render generates a brand new reference each time, making dependency checks always fail and creating an infinite or excessive execution loop.',
      topic: 'Hooks Dependencies',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of useId in React 18+?',
      options: [
        'To generate cryptographic security tokens for JSON Web Tokens',
        'To generate unique, stable IDs across server and client renders to prevent hydration mismatches',
        'To query DOM nodes directly like document.getElementById',
        'To assign unique primary keys to database records'
      ],
      correctAnswer: 1,
      explanation: 'useId generates stable unique IDs that match between server and client rendering, avoiding hydration mismatch warnings for form labels, ARIA attributes, and accessibility identifiers.',
      topic: 'Accessibility & SSR (useId)',
      difficulty: 'medium'
    },
    {
      question: 'How does React 18 automatic batching improve performance?',
      options: [
        'It compresses network requests sent via fetch into a single payload',
        'It batches multiple state updates within promises, setTimeout, and native event handlers into a single re-render',
        'It compiles all JSX files into a single bundle at runtime',
        'It groups database SQL queries together'
      ],
      correctAnswer: 1,
      explanation: 'In React 18, state updates inside promises, timeouts, and native event handlers are automatically batched into a single re-render pass, eliminating unnecessary intermediate render passes.',
      topic: 'React 18 Batching',
      difficulty: 'advanced'
    },
    {
      question: 'In React component testing, why is React Testing Library preferred over testing implementation details?',
      options: [
        'It tests components from the user\'s perspective (DOM output and accessibility) rather than internal state',
        'It compiles tests directly into C++ binaries for 10x speed',
        'It prevents components from using CSS modules',
        'It automatically mocks all network requests without code'
      ],
      correctAnswer: 0,
      explanation: 'React Testing Library promotes testing how users and assistive technologies interact with the component (queries by role, text, label) rather than inspecting internal state or component instances, leading to refactor-resilient tests.',
      topic: 'Testing Best Practices',
      difficulty: 'medium'
    }
  ],

  typescript: [
    {
      question: 'What is the difference between "interface" and "type" aliases in TypeScript?',
      options: [
        'Interfaces cannot describe object shapes; types can only describe primitives',
        'Interfaces can be declaration-merged by defining them multiple times; type aliases cannot be reopened',
        'Type aliases support inheritance via "extends", whereas interfaces only support union operators',
        'Interfaces exist at runtime in the compiled JavaScript output'
      ],
      correctAnswer: 1,
      explanation: 'Interfaces in TypeScript support declaration merging (multiple declarations with the same name merge their members), which is essential for library typing. Type aliases cannot be reopened after creation.',
      topic: 'Interfaces vs Type Aliases',
      difficulty: 'medium'
    },
    {
      question: 'What does the "unknown" type represent in TypeScript compared to "any"?',
      options: [
        'unknown allows calling any arbitrary property or method without type checks',
        'unknown is a type-safe counterpart to any that requires type narrowing before performing operations',
        'unknown is synonymous with null and undefined',
        'unknown compiles to a custom Symbol in generated JavaScript'
      ],
      correctAnswer: 1,
      explanation: 'unknown is the top type in TypeScript. Unlike any, TypeScript will not permit accessing properties or calling methods on an unknown value until you narrow its type via typeof, instanceof, or custom type guards.',
      topic: 'Type Safety (unknown vs any)',
      difficulty: 'medium'
    },
    {
      question: 'What does the utility type Record<K, T> do in TypeScript?',
      options: [
        'Creates an immutable tuple of length K containing values of type T',
        'Constructs an object type whose property keys are K and whose property values are T',
        'Connects a database record table K with entity schema T',
        'Removes all undefined keys from type K'
      ],
      correctAnswer: 1,
      explanation: 'Record<K, T> constructs an object type where keys belong to union K and values are of type T. For example, Record<string, number> represents a dictionary mapping string keys to number values.',
      topic: 'Utility Types (Record)',
      difficulty: 'easy'
    },
    {
      question: 'What is a discriminated union (tagged union) in TypeScript?',
      options: [
        'A union of primitive numbers and strings',
        'A union of object types that share a common literal property used for type narrowing',
        'A type that rejects null values automatically at runtime',
        'A union of classes that implement the same abstract constructor'
      ],
      correctAnswer: 1,
      explanation: 'A discriminated union consists of multiple object types that each share a common literal property (the "discriminant", e.g. type: "success" | "error"). TypeScript automatically narrows the specific type inside conditional branches.',
      topic: 'Discriminated Unions',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of the "keyof" type operator in TypeScript?',
      options: [
        'It returns an array of object runtime keys at runtime',
        'It produces a string or numeric literal union of all known public property names of a type',
        'It encrypts an object using a secret key',
        'It checks whether a key exists in localStorage'
      ],
      correctAnswer: 1,
      explanation: 'The keyof operator takes an object type and produces a union of its keys as string or numeric literal types. For example, keyof { id: number; name: string } evaluates to "id" | "name".',
      topic: 'Type Operators (keyof)',
      difficulty: 'medium'
    },
    {
      question: 'What does the "infer" keyword do inside a conditional type in TypeScript?',
      options: [
        'It forces TypeScript to cast the variable to any',
        'It introduces a generic type variable to be deduced from the matched type pattern',
        'It runs a machine learning inference model on the code',
        'It imports external types from node_modules automatically'
      ],
      correctAnswer: 1,
      explanation: 'The infer keyword allows you to declare a type variable within the extends clause of a conditional type (e.g. T extends Promise<infer U> ? U : T), extracting inner types dynamically.',
      topic: 'Advanced Types (infer)',
      difficulty: 'advanced'
    },
    {
      question: 'What is the difference between "const assertions" (as const) and regular variable declarations?',
      options: [
        'as const locks the variable in browser memory to prevent garbage collection',
        'as const narrows literal types to their exact values and marks all nested properties as readonly',
        'as const ensures the variable cannot be deleted via the delete operator at runtime',
        'as const transpiles the variable into a C++ constant'
      ],
      correctAnswer: 1,
      explanation: 'Applying "as const" instructs TypeScript that expressions should receive the narrowest literal types possible (e.g. "red" instead of string) and marks object properties and array elements as deeply readonly.',
      topic: 'Type Assertions (as const)',
      difficulty: 'medium'
    },
    {
      question: 'What is the behavior of the "never" type in TypeScript?',
      options: [
        'It represents values that can be either null or undefined',
        'It represents the type of values that never occur, such as a function that always throws an error',
        'It allows assigning any value except primitive booleans',
        'It is used to declare variables that are never garbage collected'
      ],
      correctAnswer: 1,
      explanation: 'The never type represents values that will never occur. It is returned by functions that never return (infinite loops or unconditional throws) and represents empty sets in unions during exhaustive type checks.',
      topic: 'Type System (never)',
      difficulty: 'medium'
    },
    {
      question: 'How do you perform exhaustive checking in a switch statement with TypeScript?',
      options: [
        'By using the "default: break;" statement',
        'By assigning the unhandled case value to a variable of type "never" in the default branch',
        'By adding a @strict-check decorator above the switch statement',
        'By importing the "exhaust" module from typescript/lib'
      ],
      correctAnswer: 1,
      explanation: 'Assigning the switch subject to a never variable in the default case (const _exhaustive: never = val;) ensures that if a new member is added to the union and unhandled, TypeScript raises a compile-time type error.',
      topic: 'Exhaustiveness Checking',
      difficulty: 'advanced'
    },
    {
      question: 'What does Partial<T> utility type produce?',
      options: [
        'A type containing only the first half of properties from T',
        'A type with all properties of T set to optional (?)',
        'A type that removes all nullable properties from T',
        'A type that converts all methods of T to asynchronous functions'
      ],
      correctAnswer: 1,
      explanation: 'Partial<T> constructs a type with all properties of T set to optional. It is implemented internally as { [P in keyof T]?: T[P]; }.',
      topic: 'Utility Types (Partial)',
      difficulty: 'easy'
    },
    {
      question: 'What does the Omit<T, K> utility type do?',
      options: [
        'Constructs a type by picking all properties from T and then removing keys specified in K',
        'Deletes keys from the JavaScript object at runtime',
        'Replaces properties in K with null values',
        'Makes properties in K optional while keeping the rest required'
      ],
      correctAnswer: 0,
      explanation: 'Omit<T, K> constructs an object type with all properties of T except those listed in K. It is built as Pick<T, Exclude<keyof T, K>>.',
      topic: 'Utility Types (Omit)',
      difficulty: 'easy'
    },
    {
      question: 'What is a user-defined type guard in TypeScript?',
      options: [
        'A security middleware that checks user session tokens in Express',
        'A function whose return type is a type predicate of the form "arg is Type"',
        'A try-catch block wrapped around a JSON.parse call',
        'A database constraint that validates email formats'
      ],
      correctAnswer: 1,
      explanation: 'A user-defined type guard is a function that returns a type predicate ("arg is TargetType"). When it returns true, TypeScript narrows the type of the passed argument in downstream code blocks.',
      topic: 'Type Guards',
      difficulty: 'medium'
    },
    {
      question: 'What is the difference between "declare" keyword and standard variable declaration in TypeScript?',
      options: [
        'declare tells TypeScript that an entity exists in the runtime environment without emitting JavaScript code',
        'declare allocates unmanaged memory in C++',
        'declare automatically runs the variable through an input sanitizer',
        'declare exports the variable to the global window object in the DOM'
      ],
      correctAnswer: 0,
      explanation: 'The declare keyword is used in ambient declarations (.d.ts files or ambient contexts) to inform the compiler that a variable or function exists externally (e.g. on window or from a CDN script), emitting zero JavaScript.',
      topic: 'Ambient Declarations',
      difficulty: 'medium'
    },
    {
      question: 'What does the "noImplicitAny" compiler option enforce in tsconfig.json?',
      options: [
        'It forbids importing external libraries that do not have .d.ts files',
        'It raises an error on expressions and declarations with an implied "any" type when no type is specified',
        'It converts all primitive types to any automatically',
        'It disables strict null checks'
      ],
      correctAnswer: 1,
      explanation: 'When noImplicitAny is enabled, TypeScript raises a compile error whenever it cannot infer a specific type and would otherwise fall back to any, enforcing explicit typing across codebases.',
      topic: 'Compiler Options (tsconfig)',
      difficulty: 'easy'
    },
    {
      question: 'What is the purpose of Generic Constraints in TypeScript (e.g. <T extends HasId>)?',
      options: [
        'To prevent generic types from being used in React components',
        'To restrict the types that can be passed to a generic parameter to those satisfying a specific shape',
        'To limit the maximum array length of a generic container',
        'To enforce that generic parameters must always be strings'
      ],
      correctAnswer: 1,
      explanation: 'Generic constraints using the extends keyword allow generic functions or classes to require that type parameters satisfy minimum structural interfaces (e.g., must possess an "id" property).',
      topic: 'Generics & Constraints',
      difficulty: 'medium'
    },
    {
      question: 'What does the Pick<T, K> utility type do?',
      options: [
        'Constructs a type by picking only the set of properties K from T',
        'Randomly picks one property from T at runtime',
        'Creates a union of all values in T',
        'Picks the first non-null property from T'
      ],
      correctAnswer: 0,
      explanation: 'Pick<T, K> constructs an object type containing only the keys specified in K (which must be a subset of keyof T).',
      topic: 'Utility Types (Pick)',
      difficulty: 'easy'
    },
    {
      question: 'What does the "satisfies" operator introduced in TypeScript 4.9 achieve?',
      options: [
        'It forces a variable to conform to a type without widening its inferred literal types',
        'It validates JSON payloads against a JSON Schema at runtime',
        'It automatically installs missing npm types packages',
        'It casts an incompatible type to another type unsafely'
      ],
      correctAnswer: 0,
      explanation: 'The satisfies operator validates that an expression matches a given type definition while preserving the most specific literal type inferred for that expression, preventing unintended type widening.',
      topic: 'Type Checking (satisfies)',
      difficulty: 'advanced'
    },
    {
      question: 'What does the NonNullable<T> utility type do?',
      options: [
        'Replaces null and undefined values with empty strings at runtime',
        'Constructs a type by excluding null and undefined from type T',
        'Throws a runtime error if a value is null',
        'Converts all object properties to non-empty arrays'
      ],
      correctAnswer: 1,
      explanation: 'NonNullable<T> excludes null and undefined from a union type T. For example, NonNullable<string | null | undefined> produces string.',
      topic: 'Utility Types (NonNullable)',
      difficulty: 'easy'
    },
    {
      question: 'How does structural typing (duck typing) work in TypeScript?',
      options: [
        'Types must have identical nominal class inheritance trees to be compatible',
        'Type compatibility is based solely on the shape and members of the types rather than explicit declarations',
        'Types are checked exclusively by comparing filenames and package namespaces',
        'TypeScript converts all types into Duck instances'
      ],
      correctAnswer: 1,
      explanation: 'TypeScript uses a structural type system: if object A has all the required properties of type B with compatible types, A is assignable to B, regardless of whether A explicitly implements B.',
      topic: 'Structural Typing',
      difficulty: 'medium'
    },
    {
      question: 'What happens when compiling TypeScript code with target set to "ES6"?',
      options: [
        'The TypeScript compiler generates ES6-compliant JavaScript with classes and arrow functions preserved',
        'The compiler converts all code to ES5 with function prototype polyfills',
        'TypeScript will only run inside Internet Explorer 11',
        'The output is converted into a single minified bundle'
      ],
      correctAnswer: 0,
      explanation: 'The target setting determines the ECMAScript version of the emitted JavaScript. Setting it to ES6 produces modern JavaScript features supported in ES6 (let/const, arrow functions, classes, promises).',
      topic: 'Compilation Targets',
      difficulty: 'easy'
    }
  ],

  'rest apis': [
    {
      question: 'What makes an HTTP method idempotent in REST API design?',
      options: [
        'The method executes in less than 50 milliseconds on the server',
        'Making multiple identical requests produces the exact same server-side state as a single request',
        'The request cannot be intercepted by proxy caches',
        'The client must send an encrypted signature with every payload'
      ],
      correctAnswer: 1,
      explanation: 'An HTTP method is idempotent if the side effects of making N identical requests are the same as making a single request. GET, PUT, and DELETE are idempotent; POST is typically not.',
      topic: 'HTTP Methods & Idempotency',
      difficulty: 'medium'
    },
    {
      question: 'What is the key difference between PUT and PATCH methods?',
      options: [
        'PUT is used to read data; PATCH is used to delete data',
        'PUT replaces the entire resource representation; PATCH applies a partial update to the resource',
        'PUT is non-idempotent; PATCH is strictly idempotent',
        'PUT cannot accept JSON bodies; PATCH only accepts XML'
      ],
      correctAnswer: 1,
      explanation: 'PUT requires the client to supply the complete updated representation of the resource. PATCH is designed for partial updates where only the fields that need modification are submitted.',
      topic: 'PUT vs PATCH',
      difficulty: 'medium'
    },
    {
      question: 'Which HTTP status code should be returned when a resource is successfully created via POST?',
      options: [
        '200 OK',
        '201 Created',
        '204 No Content',
        '202 Accepted'
      ],
      correctAnswer: 1,
      explanation: 'HTTP 201 Created indicates that the request succeeded and resulted in the creation of a new resource, typically accompanied by a Location header referencing the new URI.',
      topic: 'HTTP Status Codes',
      difficulty: 'easy'
    },
    {
      question: 'What is the difference between 401 Unauthorized and 403 Forbidden status codes?',
      options: [
        '401 means the server is down; 403 means the URL does not exist',
        '401 means authentication is missing or invalid; 403 means authenticated identity lacks permission',
        '401 is for GET requests; 403 is for POST requests',
        '401 is a client error; 403 is a server error'
      ],
      correctAnswer: 1,
      explanation: '401 Unauthorized implies unauthenticated (the client must provide valid credentials). 403 Forbidden indicates the client is authenticated, but does not possess the requisite permissions to access the resource.',
      topic: 'Authentication vs Authorization',
      difficulty: 'easy'
    },
    {
      question: 'What is the purpose of the ETag (Entity Tag) HTTP header?',
      options: [
        'It stores the user\'s encrypted password on the client',
        'It provides a cache validator token that represents the specific version of a resource',
        'It specifies the geographical region where the server is hosted',
        'It defines the maximum allowable length of query parameters'
      ],
      correctAnswer: 1,
      explanation: 'ETags are hash identifiers for resource versions. Clients send If-None-Match with the ETag; if the resource has not changed, the server responds with 304 Not Modified without sending the body.',
      topic: 'HTTP Caching & ETags',
      difficulty: 'medium'
    },
    {
      question: 'Why is cursor-based pagination generally preferred over offset-based pagination for large datasets?',
      options: [
        'Offset pagination is deprecated in HTTP 2.0',
        'Cursor pagination prevents duplicate/skipped items when data changes and maintains consistent O(1) database lookups',
        'Cursor pagination does not require indexed columns in the database',
        'Cursor pagination compresses response bodies by 50%'
      ],
      correctAnswer: 1,
      explanation: 'Offset pagination (OFFSET 10000) causes database performance degradation (scanning and discarding rows) and suffers from shifting bugs when items are inserted/deleted. Cursor pagination uses index pointers.',
      topic: 'Pagination Strategies',
      difficulty: 'advanced'
    },
    {
      question: 'What does the HTTP 429 status code represent in REST APIs?',
      options: [
        'The requested URL path is too long',
        'The client has sent too many requests in a given amount of time (Rate Limited)',
        'The server database query exceeded timeout limits',
        'The payload is missing required schema fields'
      ],
      correctAnswer: 1,
      explanation: 'HTTP 429 Too Many Requests indicates that the user or API client has sent too many requests in a given amount of time, exceeding the configured rate limit (often paired with a Retry-After header).',
      topic: 'Rate Limiting',
      difficulty: 'easy'
    },
    {
      question: 'What does HATEOAS (Hypermedia As The Engine Of Application State) dictate in REST maturity?',
      options: [
        'API responses should provide hypermedia links enabling clients to discover next available actions dynamically',
        'All API payloads must be formatted in HTML instead of JSON',
        'Web browsers must execute JavaScript directly inside HTTP response headers',
        'API servers must maintain stateful session cookies for every client'
      ],
      correctAnswer: 0,
      explanation: 'HATEOAS is Richardson Maturity Model Level 3. Responses include navigational links (e.g. "_links") guiding the client regarding valid transitions and actions without hardcoding URIs in the client.',
      topic: 'REST Principles (HATEOAS)',
      difficulty: 'advanced'
    },
    {
      question: 'What is an Idempotency-Key header used for in POST requests (e.g. Stripe API)?',
      options: [
        'To encrypt credit card numbers with AES-256',
        'To allow clients to safely retry POST requests without accidentally creating duplicate transactions',
        'To authenticate the request using OAuth 2.0',
        'To bypass API rate limiting rules'
      ],
      correctAnswer: 1,
      explanation: 'Clients generate a unique UUID in the Idempotency-Key header for POST requests (such as payments). If network failures cause a retry, the server identifies the key and returns the original result without re-executing.',
      topic: 'API Reliability & Idempotency',
      difficulty: 'advanced'
    },
    {
      question: 'Which HTTP status code should be returned when a resource is deleted successfully and no content is returned in the response body?',
      options: [
        '200 OK',
        '204 No Content',
        '202 Accepted',
        '301 Moved Permanently'
      ],
      correctAnswer: 1,
      explanation: '204 No Content confirms that the action was successfully fulfilled and that there is no additional content to send in the response payload body.',
      topic: 'HTTP Status Codes',
      difficulty: 'easy'
    },
    {
      question: 'What is the purpose of the OPTIONS HTTP method in CORS (Cross-Origin Resource Sharing)?',
      options: [
        'To download server configuration options to the browser cache',
        'To perform a preflight check inquiring which origins, headers, and methods the server permits before sending actual requests',
        'To test whether the server supports HTTP/3 protocol',
        'To encrypt all succeeding requests with TLS'
      ],
      correctAnswer: 1,
      explanation: 'Browsers send an automatic preflight OPTIONS request before non-simple cross-origin requests to verify whether the target server approves the requesting origin, HTTP method, and custom headers.',
      topic: 'CORS & Preflight',
      difficulty: 'medium'
    },
    {
      question: 'What is the best practice for versioning REST APIs?',
      options: [
        'Updating the API randomly without communicating changes to existing clients',
        'Using URI path versioning (/api/v1/users) or custom header versioning (Accept: application/vnd.app.v1+json)',
        'Changing the domain name whenever an endpoint schema is modified',
        'Re-installing the database every time a new version is released'
      ],
      correctAnswer: 1,
      explanation: 'Explicit versioning via URL paths (/v1/...) or Accept header versioning allows maintaining backward compatibility for existing consumers while rolling out breaking changes in new iterations.',
      topic: 'API Versioning',
      difficulty: 'easy'
    },
    {
      question: 'What does the HTTP 422 Unprocessable Entity status code communicate?',
      options: [
        'The server could not understand the JSON syntax of the request',
        'The request syntax is valid JSON, but contains semantic validation errors (e.g. email invalid, age negative)',
        'The client has exceeded memory limits',
        'The SSL certificate on the client has expired'
      ],
      correctAnswer: 1,
      explanation: '422 Unprocessable Entity means the server understands the content type and syntax of the request entity, but was unable to process the contained instructions due to semantic validation failures.',
      topic: 'Validation & Errors',
      difficulty: 'medium'
    },
    {
      question: 'What is the role of the Cache-Control header "no-cache"?',
      options: [
        'It tells browsers to permanently delete all local disk caches',
        'It requires caches to revalidate the response with the origin server before serving a cached copy',
        'It prevents HTTPS encryption from being applied',
        'It instructs the server not to write logs to disk'
      ],
      correctAnswer: 1,
      explanation: '"no-cache" does not mean "do not store"; it specifies that a cache must submit the request to the origin server for validation (via ETag/If-Modified-Since) before releasing a cached copy. "no-store" forbids caching entirely.',
      topic: 'Caching Directives',
      difficulty: 'medium'
    },
    {
      question: 'Why should sensitive data never be passed in URL query parameters in GET requests?',
      options: [
        'Query parameters cannot be parsed by backend frameworks',
        'Query parameters are logged in web server access logs, browser history, and proxy servers in plain text',
        'Query parameters are limited to exactly 16 characters in HTTP 1.1',
        'Query parameters are automatically encrypted with public keys'
      ],
      correctAnswer: 1,
      explanation: 'Full URLs including query parameters are stored in server logs, browser histories, referer headers, and proxy caches, exposing API keys, tokens, or passwords to unauthorized inspection.',
      topic: 'API Security',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of Content Negotiation in REST APIs using the Accept header?',
      options: [
        'Allowing clients to request specific representation formats (e.g. application/json vs application/xml)',
        'Negotiating financial subscription tiers for API rate limits',
        'Encrypting the payload with custom cipher suites',
        'Selecting the database dialect on the backend'
      ],
      correctAnswer: 0,
      explanation: 'Content negotiation enables a client to declare acceptable MIME types in the Accept header, allowing the server to deliver representations in JSON, XML, Protobuf, or CSV as requested.',
      topic: 'Content Negotiation',
      difficulty: 'medium'
    },
    {
      question: 'In OAuth 2.0 REST APIs, what is the role of a Refresh Token compared to an Access Token?',
      options: [
        'Refresh tokens are sent in every HTTP header; access tokens are never transmitted',
        'Access tokens are short-lived credentials for API access; refresh tokens are long-lived tokens used to obtain new access tokens',
        'Refresh tokens are used to delete user accounts',
        'Access tokens cannot be decoded by backend services'
      ],
      correctAnswer: 1,
      explanation: 'Access tokens have brief lifespans to limit exposure if intercepted. Refresh tokens are stored securely to renew access tokens without requiring the user to re-authenticate with credentials.',
      topic: 'OAuth 2.0 & Token Auth',
      difficulty: 'medium'
    },
    {
      question: 'What does the HTTP 409 Conflict status code signify?',
      options: [
        'The client sent conflicting HTTP headers',
        'The request could not be processed because of a conflict in the current state of the resource (e.g. duplicate unique key)',
        'The server has two conflicting versions of code deployed',
        'Two users made simultaneous requests from the same IP address'
      ],
      correctAnswer: 1,
      explanation: 'HTTP 409 Conflict indicates that the request conflicts with the current resource state, such as an attempt to register an email address that is already registered or a version conflict in optimistic locking.',
      topic: 'HTTP Status Codes',
      difficulty: 'medium'
    },
    {
      question: 'What is the purpose of JWT (JSON Web Token) signatures in stateless REST APIs?',
      options: [
        'To encrypt the payload so that nobody can read the claims',
        'To allow the receiving server to verify that the token claims have not been tampered with since issuance',
        'To compress the token into a smaller byte array',
        'To automatically refresh the database connection'
      ],
      correctAnswer: 1,
      explanation: 'A JWT signature verifies the authenticity and integrity of the token. By checking the cryptographic signature with a shared secret or public key, the API server confirms the payload was not modified by the client.',
      topic: 'Stateless Authentication (JWT)',
      difficulty: 'medium'
    },
    {
      question: 'What is the primary benefit of designing REST APIs with stateless communication?',
      options: [
        'The server does not need to store client session state between requests, facilitating horizontal scalability',
        'Clients never need to authenticate more than once per year',
        'Web servers consume zero memory during request handling',
        'Database connections are never required'
      ],
      correctAnswer: 0,
      explanation: 'Statelessness requires that each request from client to server contains all of the information necessary to understand and complete the request. This eliminates session synchronization bottlenecks across server clusters.',
      topic: 'REST Principles (Statelessness)',
      difficulty: 'easy'
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL QUESTION BUILDER FOR ANY ARBITRARY SKILL
// ─────────────────────────────────────────────────────────────────────────────

const generateProceduralSkillQuestions = (skill, count = 20) => {
  const normalized = (skill || 'Software Engineering').trim();
  const cleanSkill = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  const templates = [
    {
      q: `What is a fundamental core principle when building production systems with ${cleanSkill}?`,
      opts: [
        `Ensuring high cohesion, clean modular separation of concerns, and robust error handling in ${cleanSkill}`,
        `Hardcoding all configurations and credentials directly in ${cleanSkill} source code`,
        `Ignoring edge cases and relying exclusively on optimistic execution in ${cleanSkill}`,
        `Bypassing automated testing to maximize rapid deployment velocity`
      ],
      correct: 0,
      exp: `Production architecture in ${cleanSkill} requires clear separation of concerns, comprehensive error boundaries, and defensive input validation to guarantee long-term stability and maintainability.`,
      topic: 'Core Fundamentals',
      diff: 'easy'
    },
    {
      q: `Which approach is considered an anti-pattern when designing architecture in ${cleanSkill}?`,
      opts: [
        `Establishing structured logging, performance instrumentation, and metric tracking`,
        `Creating tightly-coupled monolithic components with unmanaged global mutable state in ${cleanSkill}`,
        `Writing unit tests that validate core business logic against unexpected inputs`,
        `Employing continuous integration to lint and type-check ${cleanSkill} artifacts`
      ],
      correct: 1,
      exp: `Tightly coupling components and relying on uncontrolled global mutable state undermines maintainability, testability, and concurrency safety in ${cleanSkill}.`,
      topic: 'Architectural Best Practices',
      diff: 'medium'
    },
    {
      q: `How should exceptional runtime errors and failure scenarios be handled in ${cleanSkill}?`,
      opts: [
        `Silently swallowing all thrown exceptions to keep user interfaces from displaying error screens`,
        `Catching errors at appropriate boundaries, logging contextual telemetry, and returning graceful fallback responses`,
        `Allowing uncaught exceptions to crash the entire application process unconditionally`,
        `Restarting the underlying virtual machine every time an operation fails`
      ],
      correct: 1,
      exp: `Robust error handling in ${cleanSkill} involves catching failures at logical boundaries, emitting structured logs for observability, and failing gracefully without bringing down critical infrastructure.`,
      topic: 'Error Handling & Resilience',
      diff: 'medium'
    },
    {
      q: `What is the primary performance optimization consideration when scaling ${cleanSkill} under high load?`,
      opts: [
        `Eliminating algorithmic bottlenecks (reducing O(N^2) complexity) and leveraging strategic caching`,
        `Increasing the clock frequency of development workstations`,
        `Removing all comments and whitespace from source code repositories`,
        `Switching all asynchronous operations to synchronous blocking calls`
      ],
      correct: 0,
      exp: `High-throughput scaling in ${cleanSkill} is achieved by optimizing computational complexity, minimizing I/O bottlenecks, and introducing caching layers for repeatedly accessed data.`,
      topic: 'Performance & Optimization',
      diff: 'advanced'
    },
    {
      q: `When securing a production service built with ${cleanSkill}, what is a mandatory practice?`,
      opts: [
        `Validating and sanitizing all external inputs and applying the principle of least privilege`,
        `Storing API keys and private certificates inside client-side public bundles`,
        `Disabling HTTPS encryption to reduce CPU TLS handshake overhead`,
        `Exposing internal database connection strings in public error responses`
      ],
      correct: 0,
      exp: `Security best practices for ${cleanSkill} require rigorous input validation, context-aware output encoding, parameterized queries, and enforcing least privilege across authorization boundaries.`,
      topic: 'Security & Vulnerability Prevention',
      diff: 'medium'
    },
    {
      q: `What is the primary purpose of unit and integration testing in a ${cleanSkill} workflow?`,
      opts: [
        `To verify that individual units and integrated modules meet design requirements without regression`,
        `To satisfy documentation guidelines without executing actual test assertions`,
        `To slow down the deployment pipeline to simulate production latency`,
        `To replace static code analysis and linting completely`
      ],
      correct: 0,
      exp: `Automated testing in ${cleanSkill} provides safety nets for continuous refactoring, validates contract integrity across components, and prevents regression in edge cases.`,
      topic: 'Testing & Quality Assurance',
      diff: 'easy'
    },
    {
      q: `How does memory management and resource lifecycle management function in ${cleanSkill}?`,
      opts: [
        `Properly disposing open file handles, database connections, and event listeners to prevent resource leaks`,
        `Allocating infinite memory buffers because modern cloud infrastructure auto-scales indefinitely`,
        `Disabling garbage collection or manual deallocation across all operations`,
        `Writing all transient objects directly to permanent disk storage`
      ],
      correct: 0,
      exp: `Resource cleanup in ${cleanSkill} (closing stream handles, connection pools, and unregistering subscribers) is vital to preventing memory leaks and file descriptor exhaustion.`,
      topic: 'Resource & Memory Management',
      diff: 'medium'
    },
    {
      q: `In ${cleanSkill}, what is the role of asynchronous programming and non-blocking I/O?`,
      opts: [
        `Preventing thread starvation by handling I/O operations without freezing execution flow`,
        `Ensuring that every function executes strictly in reverse alphabetical order`,
        `Compiling code directly into assembly language at runtime`,
        `Forcing all database queries to execute synchronously in a single thread`
      ],
      correct: 0,
      exp: `Asynchronous patterns allow ${cleanSkill} applications to handle high concurrent I/O requests without blocking execution threads, maximizing throughput.`,
      topic: 'Concurrency & Asynchronous Flow',
      diff: 'advanced'
    },
    {
      q: `When debugging a silent logic failure in ${cleanSkill}, which diagnostic technique is most effective?`,
      opts: [
        `Inspecting reproducible test cases, analyzing execution stack traces, and reviewing structured logs`,
        `Randomly altering code statements until the behavior changes unpredictably`,
        `Disabling all compiler warnings and linting rules`,
        `Rebooting the server without inspecting log outputs`
      ],
      correct: 0,
      exp: `Systematic debugging in ${cleanSkill} relies on creating minimal reproducible examples, tracing execution paths with debuggers, and analyzing telemetry data.`,
      topic: 'Diagnostics & Troubleshooting',
      diff: 'medium'
    },
    {
      q: `What is the recommended approach for configuration management in ${cleanSkill} across staging and production?`,
      opts: [
        `Externalizing configurations via environment variables or central configuration stores (12-Factor methodology)`,
        `Hardcoding environment-specific IP addresses directly inside source code modules`,
        `Asking end users to enter backend database credentials when loading the application`,
        `Maintaining completely different codebases for every deployment environment`
      ],
      correct: 0,
      exp: `The Twelve-Factor App methodology mandates strict separation of config from code, injecting configuration into ${cleanSkill} environments via environment variables.`,
      topic: 'Configuration & 12-Factor App',
      diff: 'easy'
    },
    {
      q: `What is the significance of backward compatibility when updating public interfaces in ${cleanSkill}?`,
      opts: [
        `Preventing breaking changes for existing consumers by versioning contracts or introducing non-breaking extensions`,
        `Rewriting existing interfaces every month to force users to upgrade their software`,
        `Removing existing methods without deprecation warnings`,
        `Renaming all public classes in patch releases`
      ],
      correct: 0,
      exp: `Maintaining backward compatibility in ${cleanSkill} ensures downstream clients and services do not fail unexpectedly when underlying libraries or APIs are updated.`,
      topic: 'API Design & Evolution',
      diff: 'medium'
    },
    {
      q: `How should state synchronization between distributed components be handled in ${cleanSkill}?`,
      opts: [
        `Employing eventual consistency patterns, idempotent message handlers, or transactional outbox patterns`,
        `Assuming distributed networks never experience packet loss or partitioning`,
        `Allowing multiple services to write to the same unpartitioned file concurrently without locks`,
        `Ignoring network timeouts and waiting indefinitely for remote responses`
      ],
      correct: 0,
      exp: `Distributed systems interacting with ${cleanSkill} require resilience patterns such as circuit breakers, retries with exponential backoff, and idempotent consumers.`,
      topic: 'Distributed Systems Patterns',
      diff: 'advanced'
    },
    {
      q: `What is the primary advantage of adhering to the Single Responsibility Principle (SRP) in ${cleanSkill}?`,
      opts: [
        `Modules have a single reason to change, making them easier to understand, test, and maintain`,
        `It limits code files to exactly 10 lines of code`,
        `It forces all developers to work on the exact same file simultaneously`,
        `It eliminates the need for unit testing entirely`
      ],
      correct: 0,
      exp: `SRP ensures that each module or class in ${cleanSkill} focuses on a single responsibility, reducing side effects and cognitive load during system maintenance.`,
      topic: 'SOLID Principles',
      diff: 'easy'
    },
    {
      q: `When designing data access layers in ${cleanSkill}, how can SQL injection or query injection be prevented?`,
      opts: [
        `Using parameterized queries, prepared statements, or reputable Object-Relational Mappers (ORMs)`,
        `Concatenating raw user inputs directly into query strings using string interpolation`,
        `Disabling database user authentication`,
        `Running queries with database superuser privileges`
      ],
      correct: 0,
      exp: `Parameterized queries ensure that user-supplied inputs are treated strictly as data literals rather than executable commands in ${cleanSkill} database interactions.`,
      topic: 'Data Access & Query Security',
      diff: 'medium'
    },
    {
      q: `What role does automated static analysis (linting, type checking) play in ${cleanSkill} development?`,
      opts: [
        `Catching syntax errors, type inconsistencies, and style deviations before code is executed`,
        `Compiling the code into a proprietary encrypted format`,
        `Running penetration tests against production servers during developer commits`,
        `Automatically writing complete business feature code without human input`
      ],
      correct: 0,
      exp: `Static analysis provides instant feedback in ${cleanSkill} pipelines, eliminating common bugs and enforcing architectural consistency prior to test execution.`,
      topic: 'Static Analysis & Tooling',
      diff: 'easy'
    },
    {
      q: `How do caching layers (such as Redis or in-memory caches) improve ${cleanSkill} system throughput?`,
      opts: [
        `By serving frequent read queries from fast memory, shielding downstream databases from saturation`,
        `By permanently replacing relational databases for all transactional persistence`,
        `By re-indexing source code files on every user request`,
        `By generating fake query responses when the primary database is offline`
      ],
      correct: 0,
      exp: `Caching in ${cleanSkill} architectures significantly reduces read latency and relieves pressure on primary datastores by keeping frequently requested representations in fast RAM.`,
      topic: 'Caching & Data Flow',
      diff: 'medium'
    },
    {
      q: `What is the purpose of rate limiting in services developed with ${cleanSkill}?`,
      opts: [
        `Protecting resources from denial-of-service abuse and ensuring fair usage across clients`,
        `Artificially slowing down all users to conserve server electricity`,
        `Restricting application access to users on the same local area network`,
        `Charging clients automatically per second of CPU utilization`
      ],
      correct: 0,
      exp: `Rate limiting protects ${cleanSkill} APIs against abuse, brute-force attacks, and resource starvation, preserving availability for legitimate traffic.`,
      topic: 'Rate Limiting & Traffic Management',
      diff: 'medium'
    },
    {
      q: `What is continuous integration and continuous deployment (CI/CD) in the context of ${cleanSkill}?`,
      opts: [
        `Automating build, test, and release pipelines to deliver reliable code updates frequently`,
        `Manually copying compiled files via FTP directly to production servers late at night`,
        `Writing all code in a single feature branch for several months before merging`,
        `Disabling testing to speed up code check-ins`
      ],
      correct: 0,
      exp: `CI/CD automates the verification, packaging, and deployment of ${cleanSkill} solutions, minimizing manual intervention and accelerating defect detection.`,
      topic: 'DevOps & CI/CD',
      diff: 'easy'
    },
    {
      q: `What is the significance of semantic versioning (SemVer: MAJOR.MINOR.PATCH) in ${cleanSkill} packages?`,
      opts: [
        `Communicating breaking changes (MAJOR), new features (MINOR), and bug fixes (PATCH) transparently`,
        `Indicating the exact calendar year, month, and day the package was created`,
        `Setting the required minimum memory in gigabytes needed to run the package`,
        `Limiting the package to three concurrent users`
      ],
      correct: 0,
      exp: `SemVer allows consumers of ${cleanSkill} libraries to safely configure dependency updates while understanding the risk profile of upgrades.`,
      topic: 'Package Management & SemVer',
      diff: 'easy'
    },
    {
      q: `What is a primary consideration when refactoring legacy code in ${cleanSkill}?`,
      opts: [
        `Ensuring comprehensive automated test coverage exists before altering existing code structures`,
        `Deleting all existing unit tests to prevent failing assertions during refactoring`,
        `Renaming all variables in a single massive pull request without running tests`,
        `Modifying public contracts without coordinating with external consumers`
      ],
      correct: 0,
      exp: `Refactoring in ${cleanSkill} requires existing regression tests to verify that external behavior remains unchanged while internal structure, readability, and performance are enhanced.`,
      topic: 'Refactoring & Technical Debt',
      diff: 'medium'
    }
  ];

  return templates.slice(0, count).map((t, idx) => ({
    question: t.q,
    options: t.opts,
    correctAnswer: t.correct,
    explanation: t.exp,
    topic: t.topic,
    difficulty: t.diff,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT GENERATOR FOR LLM QUESTION CREATION
// ─────────────────────────────────────────────────────────────────────────────

const buildPracticePrompt = ({ skill, topics = [], candidateContext = {}, jobContext = {}, count = 20 }) => {
  const cleanSkill = (skill || 'Software Engineering').trim();
  const topicList = topics.length > 0 ? topics.join(', ') : 'fundamentals, intermediate concepts, practical scenarios, advanced architecture';

  return `You are a Principal Software Engineering Assessor for InterviewX.
Generate a rigorous, high-yield Multiple Choice Question (MCQ) practice test strictly scoped to: "${cleanSkill}".

CRITICAL REQUIREMENTS:
1. Target Skill: ONLY questions strictly concerning "${cleanSkill}". Do NOT generate generic questions about unrelated technologies.
2. Skill Subtopics to Cover: ${topicList}.
3. Difficulty Distribution:
   - 25% Fundamentals & Core Syntax/Principles
   - 35% Intermediate Patterns & Mechanics
   - 25% Practical/Real-World Debugging & Scenarios
   - 15% Advanced/Edge-Case Architecture & Internals
4. Question Count: Generate exactly ${count} distinct, non-duplicate questions.
5. Format for Every Question:
   - "question": Clear, unambiguous prompt.
   - "options": Array of EXACTLY 4 distinct, plausible options.
   - "correctAnswer": Integer (0, 1, 2, or 3) indicating the zero-based index of the single correct answer.
   - "explanation": Concrete, educational 2-3 sentence technical explanation of why the correct answer is right and why alternatives are incorrect.
   - "topic": The specific concept or subtopic tested.
   - "difficulty": "easy" | "medium" | "hard".

OUTPUT FORMAT:
Respond with ONLY valid, raw JSON (no markdown fences, no explanatory text outside JSON):
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0,
      "explanation": "...",
      "topic": "...",
      "difficulty": "medium"
    }
  ]
}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR & REPAIR
// ─────────────────────────────────────────────────────────────────────────────

const validateAndRepairQuestions = (rawQuestions, skill, targetCount = 20) => {
  if (!Array.isArray(rawQuestions)) return [];

  const seenTexts = new Set();
  const valid = [];

  for (const q of rawQuestions) {
    if (!q || typeof q.question !== 'string' || q.question.trim().length < 10) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    
    // Check all options are non-empty strings and distinct
    const cleanOptions = q.options.map(opt => (opt != null ? String(opt).trim() : ''));
    if (cleanOptions.some(opt => opt.length === 0)) continue;
    const uniqueOptions = new Set(cleanOptions);
    if (uniqueOptions.size < 4) continue;

    // Check correctAnswer is 0, 1, 2, or 3
    const correctIdx = Number(q.correctAnswer);
    if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx > 3) continue;

    const explanation = typeof q.explanation === 'string' && q.explanation.trim().length > 0
      ? q.explanation.trim()
      : `The correct option is: "${cleanOptions[correctIdx]}".`;

    const topic = typeof q.topic === 'string' && q.topic.trim().length > 0
      ? q.topic.trim()
      : skill;

    const difficulty = ['easy', 'medium', 'hard', 'advanced'].includes(q.difficulty)
      ? q.difficulty
      : 'medium';

    const normalizedText = q.question.trim().toLowerCase();
    if (seenTexts.has(normalizedText)) continue;
    seenTexts.add(normalizedText);

    valid.push({
      question: q.question.trim(),
      options: cleanOptions,
      correctAnswer: correctIdx,
      explanation,
      topic,
      difficulty,
    });
  }

  return valid;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PRACTICE QUESTION GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate at least `count` (default 20) MCQs for a specific topic/skill.
 */
const generatePracticeQuestions = async ({ skill, topics = [], candidateContext = {}, jobContext = {}, count = 20 }) => {
  const cleanSkill = (skill || 'Software Engineering').trim();
  const normalizedKey = cleanSkill.toLowerCase();

  let questions = [];

  // Try LLM generation if available
  const provider = getProvider();
  if (provider && provider.isAvailable) {
    try {
      const prompt = buildPracticePrompt({ skill: cleanSkill, topics, candidateContext, jobContext, count });
      const response = await provider.generateChatCompletion(
        [
          { role: 'system', content: 'You are an expert technical interviewer that outputs valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 4000, temperature: 0.5 }
      );

      let rawText = response.content || '';
      // Strip markdown code fences if model enclosed JSON
      rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

      const parsed = JSON.parse(rawText);
      const candidates = parsed.questions || parsed;
      questions = validateAndRepairQuestions(candidates, cleanSkill, count);
      console.log(`[PracticeService] LLM generated ${questions.length} valid MCQs for "${cleanSkill}".`);
    } catch (err) {
      console.warn(`[PracticeService] LLM generation failed for "${cleanSkill}":`, err.message);
    }
  }

  // If questions are fewer than target count, augment/fallback from domain bank
  if (questions.length < count) {
    const domainBank = DOMAIN_QUESTION_BANKS[normalizedKey] ||
      (normalizedKey.includes('react') ? DOMAIN_QUESTION_BANKS.react : null) ||
      (normalizedKey.includes('typescript') || normalizedKey.includes('ts') ? DOMAIN_QUESTION_BANKS.typescript : null) ||
      (normalizedKey.includes('rest') || normalizedKey.includes('api') ? DOMAIN_QUESTION_BANKS['rest apis'] : null);

    if (domainBank && domainBank.length > 0) {
      const existingTexts = new Set(questions.map(q => q.question.toLowerCase().trim()));
      for (const q of domainBank) {
        if (!existingTexts.has(q.question.toLowerCase().trim())) {
          questions.push(q);
          existingTexts.add(q.question.toLowerCase().trim());
          if (questions.length >= count) break;
        }
      }
    }
  }

  // If still fewer than target count, fill with procedural skill questions
  if (questions.length < count) {
    const procedural = generateProceduralSkillQuestions(cleanSkill, count);
    const existingTexts = new Set(questions.map(q => q.question.toLowerCase().trim()));
    for (const q of procedural) {
      if (!existingTexts.has(q.question.toLowerCase().trim())) {
        questions.push(q);
        existingTexts.add(q.question.toLowerCase().trim());
        if (questions.length >= count) break;
      }
    }
  }

  // Guarantee at least count questions
  return questions.slice(0, Math.max(count, questions.length));
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED WEAK-AREA TARGETED MOCK QUESTION GENERATOR ("Train Me")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate at least `count` (default 20) MCQs distributed across all weak areas.
 * e.g., 3 weak areas (React, TypeScript, REST APIs) -> 7, 7, 6 questions.
 */
const generateTargetedMockQuestions = async ({ weakAreas = [], interviewId = null, count = 20 }) => {
  const activeAreas = (Array.isArray(weakAreas) && weakAreas.length > 0)
    ? weakAreas.filter(Boolean).map(s => String(s).trim())
    : ['Technical Architecture', 'Problem Solving', 'System Design'];

  const distinctAreas = Array.from(new Set(activeAreas));
  const numAreas = distinctAreas.length;

  // Calculate allocation per weak area
  const baseCount = Math.floor(count / numAreas);
  const remainder = count % numAreas;

  const areaQuestionsPromises = distinctAreas.map((area, idx) => {
    const targetForArea = baseCount + (idx < remainder ? 1 : 0);
    return generatePracticeQuestions({
      skill: area,
      count: Math.max(targetForArea, 4), // ensure adequate candidate pool
    });
  });

  const resultsByArea = await Promise.all(areaQuestionsPromises);

  // Interleave questions evenly across weak areas
  const combined = [];
  let maxLen = Math.max(...resultsByArea.map(r => r.length));

  for (let i = 0; i < maxLen; i++) {
    for (let a = 0; a < numAreas; a++) {
      if (resultsByArea[a][i]) {
        combined.push(resultsByArea[a][i]);
      }
    }
  }

  // Deduplicate in case of overlaps
  const seen = new Set();
  const finalQuestions = [];
  for (const q of combined) {
    const key = q.question.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      finalQuestions.push(q);
    }
    if (finalQuestions.length >= count) break;
  }

  // If still fewer than target, top up from the first available area
  if (finalQuestions.length < count) {
    const fallback = generateProceduralSkillQuestions(distinctAreas[0] || 'Software Engineering', count);
    for (const q of fallback) {
      const key = q.question.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        finalQuestions.push(q);
      }
      if (finalQuestions.length >= count) break;
    }
  }

  return finalQuestions;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SAFE SESSION SANITIZER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips correctAnswer and explanation from unanswered questions to prevent cheating
 * via client inspection or network logs.
 */
const sanitizeSessionForClient = (session) => {
  if (!session) return null;
  const raw = session.toObject ? session.toObject() : { ...session };
  const isComplete = raw.status === 'completed';

  const answeredSet = new Set((raw.selectedAnswers || []).map(a => a.questionIndex));

  const sanitizedQuestions = (raw.questions || []).map((q, idx) => {
    const isAnswered = answeredSet.has(idx);
    if (isComplete || isAnswered) {
      return q;
    }
    // Omit correctAnswer and explanation for unanswered questions
    const { correctAnswer, explanation, ...safeQ } = q;
    return safeQ;
  });

  return {
    ...raw,
    questions: sanitizedQuestions,
  };
};

module.exports = {
  generatePracticeQuestions,
  generateTargetedMockQuestions,
  sanitizeSessionForClient,
  DOMAIN_QUESTION_BANKS,
};
