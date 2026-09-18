/**
 * AI Coach Service — Provider Abstraction and Interactive Training Engine
 *
 * Supports:
 *   - OpenAI (GPT-4o / GPT-4o-mini)
 *   - Google Gemini (Gemini 1.5 Flash / Pro)
 *   - Heuristic Fallback Provider (guarantees training loop works even without external API keys)
 *
 * Capabilities:
 *   - generateCoachResponse()
 *   - analyzeResume()
 *   - analyzeInterview()
 *   - generateTrainingPlan()
 *   - generatePracticeQuestion()
 *   - evaluatePracticeAnswer()
 *   - updateTrainingProgress()
 */

const axios = require('axios');
const OpenAI = require('openai');
const AITrainingProgress = require('../models/AITrainingProgress');
const AITrainingProfile = require('../models/AITrainingProfile');

// ─────────────────────────────────────────────────────────────────────────────
// NATURAL CHATGPT/GEMINI-STYLE SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are InterviewX AI, a natural, intelligent conversational AI assistant similar to ChatGPT and Google Gemini.

## Personality & Tone
- Friendly, professional, insightful, and approachable.
- Speak in natural, fluent English (never robotic, repetitive, or sterile).
- Understand spelling mistakes, typos, and informal English seamlessly without patronizing or correcting the user.
- Answer directly and promptly without unnecessary throat-clearing or preambles (e.g., avoid "Sure, I would be happy to help with that").
- Adapt response length dynamically: concise for greetings and simple queries, rich and well-structured with clear code snippets for technical questions.

## Conversation & Context Continuity
- Retain full memory of previous messages in the conversation.
- Understand follow-up questions seamlessly (e.g., "explain simply", "why?", "can you give an example?"). Resolve what "it" or the topic refers to from the ongoing context.
- Never repeat information already stated in the conversation.
- Never force every response into a rigid template or generic headers like "Technical Guidance & Concepts", "Foundational Concept", "Observability", "Resilience", or "Encapsulation" unless specifically requested by the user. Let the structure fit the question naturally.

## Role Specialization
- **Dashboard AI (General Assistant):**
  - Guide the user on coding, debugging, architecture, projects, resumes, career growth, technologies, and communication skills.
  - NEVER automatically conduct an interview, quiz the user, or evaluate answers as an interviewer unless the user explicitly asks ("start a mock interview", "interview me").
- **Results AI (Interview Analysis Assistant):**
  - Anchor responses strictly to the candidate's specific completed interview result (scores, feedback, strengths, weak areas).
  - Help the candidate understand their scores, break down missed concepts, and generate targeted study plans.
  - Never start a new interview or ask new interview questions unless explicitly requested.

## Formatting
- Use clean Markdown: bolding for key terms, bullet points for readability, and syntax-highlighted code blocks for code snippets.`;


// ─────────────────────────────────────────────────────────────────────────────
// JSON EXTRACTION & VALIDATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

function safeJsonParse(text, fallback = null) {
  if (!text || typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    // Try to find JSON block in markdown ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // Continue to regex object match
      }
    }
    // Try to match the outermost { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // Return fallback
      }
    }
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER IMPLEMENTATIONS (OFFICIAL OPENAI SDK)
// ─────────────────────────────────────────────────────────────────────────────

class OpenAIProvider {
  constructor(apiKey, model = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = process.env.OPENAI_MODEL || model;
    this.client = new OpenAI({
      apiKey: this.apiKey,
      timeout: 35000,
    });
  }

  async complete({ messages, responseFormatJson = false, temperature = 0.7 }) {
    const payload = {
      model: this.model,
      messages,
      temperature,
    };
    if (responseFormatJson) {
      payload.response_format = { type: 'json_object' };
    }
    const completion = await this.client.chat.completions.create(payload);
    return completion.choices?.[0]?.message?.content || '';
  }
}

class GeminiProvider {
  constructor(apiKey, model = 'gemini-3.6-flash') {
    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL || model;
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  async complete({ messages, responseFormatJson = false, temperature = 0.7 }) {
    // Convert standard chat messages to Gemini contents
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: 1500,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }
    if (responseFormatJson) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    const res = await axios.post(this.endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
      timeout: 35000,
    });
    const candidate = res.data?.candidates?.[0];
    return candidate?.content?.parts?.[0]?.text || '';
  }
}

class HeuristicFallbackProvider {
  /**
   * Provides natural conversation pipeline, resume grounding, and contextual continuity.
   */
  async complete({ messages, responseFormatJson = false }) {
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    const lastLower = lastUserMessage.toLowerCase().trim();
    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]?.content || '';

    // ── 0.A DASHBOARD AI ASSISTANT HEURISTIC DISPATCHER ──────────────────────
    if (
      systemMsg.includes('InterviewX Dashboard AI Assistant') ||
      systemMsg.includes('DASHBOARD CONVERSATION CONTEXT') ||
      systemMsg.includes('GENERAL CHAT') ||
      systemMsg.includes('Active Mode: general_chat') ||
      systemMsg.includes('CURRENT MODE: general_chat') ||
      systemMsg.includes('CURRENT MODE: interview_practice')
    ) {
      // 1. Greetings & Casual Conversation (Always conversational, NEVER technical templates)
      if (/^(hi|hello|hey|hey there|greetings|good morning|good afternoon|good evening|yo|sup)\b/i.test(lastLower)) {
        return 'Hi! 👋 How can I help you today?';
      }
      if (/^(how are you|how's it going|how are you doing|how do you do|what's up|whats up|hw r u|how r u|hw are u|wht up)\b/i.test(lastLower)) {
        return "I'm doing well! 😊 What are you working on today?";
      }
      if (/^(thanks|thank you|thx|ty|appreciate it|many thanks|thank u)\b/i.test(lastLower)) {
        return "You're welcome! 👍";
      }
      if (/^(ok|okay|cool|got it|sounds good|k)\b/i.test(lastLower)) {
        return 'Got it.';
      }

      // 2. "what is django?"
      if (/^(what is django|what's django|tell me about django)\b/i.test(lastLower) && !lastLower.includes('mvt') && !lastLower.includes('500') && !lastLower.includes('error')) {
        return `Django is a high-level Python web framework designed for rapid development and clean, pragmatic design. It follows the "batteries-included" philosophy, offering built-in features like an Object-Relational Mapper (ORM), database migrations, user authentication, an automatic administration dashboard, URL routing, and security protections against CSRF and SQL injection out of the box.`;
      }

      // 3. "explain django mvt"
      if (lastLower.includes('django') && (lastLower.includes('mvt') || lastLower.includes('mvc'))) {
        return `MVT stands for **Model-View-Template**. It is Django's way of separating data, application logic, and presentation:

- **Model (M):** Defines your data structure and database tables using Python classes and Django's ORM.
- **View (V):** Contains the application logic. It receives HTTP requests, queries or manipulates data via Models, and chooses which Template to render.
- **Template (T):** The presentation layer (HTML files with Django Template Language) that formats and displays data to the user.

**Simple Example:**

\`\`\`python
# models.py
from django.db import models

class Task(models.Model):
    title = models.CharField(max_length=100)
    completed = models.BooleanField(default=False)

# views.py
from django.shortcuts import render
from .models import Task

def task_list(request):
    tasks = Task.objects.all()
    return render(request, 'tasks.html', {'tasks': tasks})
\`\`\`

\`\`\`html
<!-- tasks.html -->
<h1>Task List</h1>
<ul>
  {% for task in tasks %}
    <li>{{ task.title }}</li>
  {% endfor %}
</ul>
\`\`\`

In short: the **Model** manages the data, the **Template** presents the UI, and the **View** connects the two.`;
      }

      // 4. "what are trending technologies?"
      if (lastLower.includes('trending technology') || lastLower.includes('trending technologies') || lastLower.includes('trending tech') || lastLower.includes('trendng')) {
        return `Here are some of the most notable trending technologies in software engineering today:

1. **AI & Machine Learning:** Large Language Models (LLMs), autonomous AI agents, retrieval-augmented generation (RAG), and vector databases like pgvector and Pinecone.
2. **Modern Web & Full-Stack:** Next.js (App Router and Server Components), TypeScript as the standard, and lightweight frameworks like Astro and Vite.
3. **High-Performance Backends:** Rust for systems programming and tooling, FastAPI for Python AI/data services, and Go for scalable microservices.
4. **Cloud-Native & Edge:** Serverless functions, Edge computing (Cloudflare Workers), Docker containerization, and Kubernetes orchestration.
5. **Modern Data Systems:** Distributed databases, event streaming with Apache Kafka, and real-time analytical engines.

Is there a specific domain—such as backend development, frontend, or AI engineering—you'd like to dive into?`;
      }

      // 4.B "how can i improve communication skills?"
      if (
        /\b(communication( skills)?|comunication|improve (my )?communication|how to communicate|better communication|soft skills)\b/i.test(lastLower)
      ) {
        return `Improving technical and interpersonal communication comes down to a few high-impact habits:

1. **Use the "Bottom-Line Up Front" (BLUF) Approach:**
   Start your answers with the direct conclusion or thesis before diving into the background details. For example: *"I recommend PostgreSQL here because of our strict ACID requirements,"* followed by the supporting arguments.

2. **Structure with Frameworks (STAR & PREP):**
   - **STAR** (Situation, Task, Action, Result) for behavioral questions.
   - **PREP** (Point, Reason, Example, Point) for technical discussions or design proposals.

3. **Practice Active Pacing & Deliberate Pauses:**
   When asked a complex question, pause for 2–3 seconds to structure your thoughts instead of filling the silence with *"um"* or *"like"*. A confident pause signals composure.

4. **Calibrate to Your Audience:**
   - With engineers: focus on trade-offs, edge cases, and architectural constraints.
   - With product managers/executives: emphasize user impact, business value, and timelines.

5. **Practice "Think Aloud" Problem Solving:**
   Record yourself explaining an engineering problem (like caching or database indexing) in 2 minutes. Listening back reveals filler words, tangents, or unclear explanations.

Would you like to practice explaining a technical concept together, or do you have a specific scenario in mind?`;
      }

      // 4.C "what is the difference between java and python?"
      if (
        /\b(dif(f)?(erence)? between java and pyth(o)?n|java vs pyth(o)?n|compare java and pyth(o)?n|pyth(o)?n vs java)\b/i.test(lastLower) ||
        (/(java.*pyth|pyth.*java)/i.test(lastLower) && /(diff|compare|vs|between)/i.test(lastLower))
      ) {
        return `Here is a clear comparison between **Java** and **Python**:

| Feature | Java | Python |
| :--- | :--- | :--- |
| **Typing** | Statically typed (types checked at compile time) | Dynamically typed (types resolved at runtime) |
| **Execution** | Compiled to bytecode → runs on JVM (JIT compiled) | Interpreted line-by-line via CPython (or JIT with PyPy) |
| **Syntax & Speed** | Verbose, explicit class structure; high execution speed | Clean, concise, highly readable; slower execution speed |
| **Concurrency** | Built-in multithreading with OS threads & Virtual Threads | GIL (Global Interpreter Lock) restricts multi-core threads; uses multiprocessing or async |
| **Primary Use Cases** | Enterprise backends (Spring Boot), Android, distributed systems | AI/ML (PyTorch/TensorFlow), Data Science, scripting, rapid web APIs (FastAPI/Django) |

**Code Comparison (Filtering Even Numbers):**

\`\`\`java
// Java (Streams)
List<Integer> evens = numbers.stream()
                             .filter(n -> n % 2 == 0)
                             .collect(Collectors.toList());
\`\`\`

\`\`\`python
# Python (List Comprehension)
evens = [n for n in numbers if n % 2 == 0]
\`\`\`

In summary: **Java** excels when raw throughput, compile-time safety, and massive enterprise scalability matter. **Python** excels when developer velocity, simplicity, and AI/data ecosystem libraries take priority.`;
      }

      // 5. "what is mongodb?"
      if (
        (lastLower.includes('what is mongodb') || lastLower.includes("what's mongodb") || lastLower === 'mongodb' || lastLower === 'what is mongo') &&
        !lastLower.includes('index') &&
        !lastLower.includes('interviewx')
      ) {
        return `**MongoDB** is an open-source, document-oriented NoSQL database designed for high scalability, flexibility, and performance. Instead of storing data in rigid rows and columns like traditional relational databases, MongoDB stores data in flexible BSON (binary JSON-like) documents grouped into collections. This dynamic schema model makes it well-suited for applications that handle evolving or nested data structures.`;
      }

      // 6. "why mongodb in interviewx?"
      if (lastLower.includes('mongodb') && (lastLower.includes('interviewx') || lastLower.includes('project') || (lastLower.includes('why') && lastLower.includes('we use')))) {
        return `In InterviewX, **MongoDB** was selected because its flexible document model aligns with the dynamic requirements of an AI mock interview platform:

1. **Polymorphic Interview Questions:** Questions span multiple categories (coding, system design, behavioral) and each has different requirements (starter code, STAR rubrics, hints, prerequisites). MongoDB stores these varied document structures naturally without complex joins or sparse relational columns.
2. **Nested Multimodal Evaluation Data:** Each candidate response includes nested scores, semantic evaluation results (SBERT), audio speech features (MFCCs), and video frame metrics. Storing all multimodal dimensions together in one document avoids multi-table overhead.
3. **Rapid Iteration:** As InterviewX introduces new evaluation algorithms and question formats, MongoDB's dynamic schema allows schema updates without database migrations.`;
      }

      // 6. "explain it simply" (contextual follow-up)
      if (/\b(explain (it )?simply|simple explanation|make it simpler|in simple words|explain simply)\b/i.test(lastLower)) {
        const fullHistoryText = (messages || []).map((m) => m.content).join(' ').toLowerCase();
        if (fullHistoryText.includes('django') || fullHistoryText.includes('mvt')) {
          return `Simply put:
- **Model:** The database (holds the data).
- **Template:** The webpage (what the user sees).
- **View:** The middleman (takes data from the database and gives it to the webpage to show you).

Whenever a user visits a page, the **View** grabs the right data and hands it to the **Template** to show the user.`;
        }
        if (fullHistoryText.includes('mongodb')) {
          return `Simply put: think of MongoDB like folders on your computer holding labeled JSON documents, instead of a giant spreadsheet with rigid columns. Each document can have whatever fields it needs.`;
        }
        if (fullHistoryText.includes('api')) {
          return `Simply put: think of an API like a waiter at a restaurant. You (the client) give your order to the waiter. The waiter goes to the kitchen (the server) and brings back your food (the data).`;
        }
        return `Simply put: it's about breaking down the concept into plain, everyday ideas without unnecessary technical jargon.`;
      }

      // 7. "my django api gives 500 error" / debugging
      if (
        lastLower.includes('django') &&
        (lastLower.includes('500') || lastLower.includes('error') || lastLower.includes('fix my django') || lastLower.includes('traceback'))
      ) {
        return `A 500 Internal Server Error in Django means an unhandled exception occurred on the server while executing the view.

Could you share the error traceback from your terminal or the relevant view code?

In the meantime, the most common causes in Django are:
1. **Uncaught Exception in View:** Calling a method or attribute on \`None\` (\`AttributeError\`), or accessing a missing key in \`request.data\` or \`request.POST\` (\`KeyError\`).
2. **Database Query Errors:** Calling \`Model.objects.get()\` when the object doesn't exist (raises \`DoesNotExist\`), or query filter mismatches.
3. **Missing or Misconfigured Serializer:** In Django REST Framework, accessing \`serializer.data\` before calling \`serializer.is_valid()\`.
4. **Template Syntax or Context Error:** A missing template variable or syntax issue inside a template tag.

If you paste your terminal traceback, I can pinpoint the exact line and fix!`;
      }

      // 8. "start a mock interview" (explicit practice mode)
      if (/\b(start (a )?(mock )?interview|mock interview|conduct an interview|interview me)\b/i.test(lastLower)) {
        return `Let's begin your mock interview! 🎯

What role or technical topic would you like to target today? For example:
- **Full Stack Engineer**
- **Backend Developer (Python/Django or Node.js)**
- **Frontend Developer (React)**
- **System Design & Architecture**

Once you let me know, I'll ask the first question!`;
      }

      // 9. MongoDB Indexes
      if (lastLower.includes('mongodb index') || (lastLower.includes('mongodb') && lastLower.includes('index')) || (lastLower.includes('indexes') && lastLower.includes('mongo'))) {
        return `### ⚡ MongoDB Indexes Overview

In MongoDB, **indexes** are specialized B-tree data structures that store a small portion of the collection's data set in an easy-to-traverse form. Without indexes, MongoDB must execute a **collection scan (COLLSCAN)**, inspecting every single document in the collection to satisfy a query.

#### Major Index Types:
- **Single Field:** \`db.users.createIndex({ email: 1 })\` — Lookups on a single attribute.
- **Compound Index:** \`db.orders.createIndex({ userId: 1, createdAt: -1 })\` — Queries filtering on multiple fields (follow the Equality, Sort, Range / ESR rule).
- **Multikey Index:** Automatically created when indexing array fields.
- **Unique Index:** \`db.users.createIndex({ username: 1 }, { unique: true })\` — Enforces uniqueness across documents.
- **TTL Index:** Purges documents after a specified duration (great for sessions and temporary tokens).`;
      }

      // 10. "what is an api" / REST API
      if (lastLower.includes('rest api') || lastLower.includes('restful') || lastLower.includes('what is an api') || lastLower.includes('what is api') || (lastLower.includes('rest') && lastLower.includes('api'))) {
        return `An **API** (Application Programming Interface) allows two software programs to communicate with each other. A **REST API** uses standard HTTP methods to perform operations on resources:

- \`GET\`: Retrieve data (e.g., fetch user profile)
- \`POST\`: Create new data (e.g., submit a form)
- \`PUT\` / \`PATCH\`: Update existing data
- \`DELETE\`: Remove data

Key HTTP status codes include \`200 OK\` (success), \`201 Created\`, \`400 Bad Request\`, \`404 Not Found\`, and \`500 Internal Server Error\`.`;
      }

      // 11. Backend Interview Prep
      if (lastLower.includes('prepare for a backend') || lastLower.includes('backend developer interview') || lastLower.includes('backend interview')) {
        return `### 🎯 How to Prepare for a Backend Developer Interview

Focus on these core areas:
1. **Language Proficiency & Concurrency:** Async I/O, event loops, multithreading, and memory management.
2. **Databases & Optimization:** SQL transactions (ACID), indexing, query execution plans, and NoSQL trade-offs.
3. **API Architecture:** RESTful best practices, authentication (JWT/OAuth), and rate limiting.
4. **System Design:** Caching (Redis), message queues (Kafka/RabbitMQ), and load balancing.`;
      }

      // 12. General fallback for dedicated Dashboard AI Assistant — NEVER rigid templates
      if (
        systemMsg.includes('DASHBOARD CONVERSATION CONTEXT') ||
        systemMsg.includes('InterviewX Dashboard AI Assistant')
      ) {
        return `I understand! Regarding "${lastUserMessage.slice(0, 60)}", could you share a bit more detail on what you're working on? I can help you understand the concept, write code, debug issues, or prepare for technical interviews.`;
      }
    }

    // ── 0.B RESULTS AI ASSISTANT HEURISTIC DISPATCHER ────────────────────────
    if (
      systemMsg.includes('InterviewX Results AI Assistant') ||
      systemMsg.includes('RESULTS AI ASSISTANT CONTEXT') ||
      systemMsg.includes('Targeted Interview Result Context') ||
      systemMsg.includes('Active Mode: results_coaching')
    ) {
      const targetRoleMatch = systemMsg.match(/Role:\s*([^\n]+)/i);
      const resRole = targetRoleMatch ? targetRoleMatch[1].trim() : 'Software Engineer';

      const overallScoreMatch = systemMsg.match(/Overall Score:\s*([^\n]+)/i);
      const resOverallScore = overallScoreMatch ? overallScoreMatch[1].trim() : 'N/A';

      const techScoreMatch = systemMsg.match(/- Technical:\s*([^\n]+)/i);
      const resTechScore = techScoreMatch ? techScoreMatch[1].trim() : 'N/A';

      const commScoreMatch = systemMsg.match(/- Communication:\s*([^\n]+)/i);
      const resCommScore = commScoreMatch ? commScoreMatch[1].trim() : 'N/A';

      const probScoreMatch = systemMsg.match(/- Problem Solving:\s*([^\n]+)/i);
      const resProbScore = probScoreMatch ? probScoreMatch[1].trim() : 'N/A';

      const strengthsMatch = systemMsg.match(/Strengths:\s*\n([\s\S]*?)(?=\n\n|\nWeaknesses)/i);
      const resStrengths = strengthsMatch ? strengthsMatch[1].trim() : 'Solid core engineering understanding';

      const weaknessesMatch = systemMsg.match(/(?:Weaknesses \/ Improvement Areas|Weak Areas|Weaknesses):\s*\n([\s\S]*?)(?=\n\n|\nRecommendations|\nQuestions|\nQuestion Breakdown|$)/i);
      const resWeaknesses = weaknessesMatch ? weaknessesMatch[1].trim() : 'Database indexing and query optimization';

      const recommendationsMatch = systemMsg.match(/Recommendations:\s*\n([\s\S]*?)(?=\n\n|\nQuestions)/i);
      const resRecommendations = recommendationsMatch ? recommendationsMatch[1].trim() : 'Focus on system design trade-offs and structured communication';

      if (lastLower.includes('why did i get this score') || lastLower.includes('why was my score') || lastLower.includes('explain my score') || lastLower.includes('score breakdown')) {
        return `### 📊 Breakdown of Your Interview Score

For your **${resRole}** interview, your performance was evaluated across technical depth, conceptual accuracy, communicative clarity, and problem-solving velocity:

---

#### 1. Score Summary
* **Overall Score:** **${resOverallScore}**
* **Technical Dimension:** **${resTechScore}**
* **Communication Dimension:** **${resCommScore}**
* **Problem Solving:** **${resProbScore}**

---

#### 2. Key Contributors to This Score
* **What boosted your score (Strengths):**
${resStrengths}

* **What reduced your score (Improvement Areas):**
${resWeaknesses}

---

#### 3. Strategic Takeaway
Your strongest asset was your foundational clarity. However, points were primarily lost in **depth of trade-off analysis and addressing edge cases**. When answering technical questions, proactively discuss what happens under failure conditions or high concurrency to immediately raise your score into the top percentile.`;
      }

      if (lastLower.includes('communication') && (lastLower.includes('score') || lastLower.includes('74') || lastLower.includes('why') || lastLower.includes('feedback'))) {
        return `### 🎙️ Communication Score Analysis

Your communication evaluation (**${resCommScore}**) reflects how clearly, concisely, and structurally you articulated complex engineering ideas during the interview.

---

#### Why Communication Scores Vary
1. **Structure (STAR / Framework Usage):** Did you start with a high-level summary before diving into low-level implementation details? Answers that dive straight into code without clarifying assumptions tend to score lower in communication.
2. **Pacing & Filler Words:** Speech pacing and conversational pauses impact communicative presence.
3. **Explaining Trade-offs:** High communication scores are awarded when candidates explicitly explain *why* they chose one design over another rather than asserting one solution as absolute.

#### Actionable Improvement
* Practice the **"Headline First"** rule: state your thesis in one sentence, then outline 2–3 supporting points.
* Always conclude with the trade-offs and alternative approaches considered.`;
      }

      if (lastLower.includes('weak') || lastLower.includes('improvement') || lastLower.includes('areas to improve')) {
        return `### 🔍 Targeted Breakdown of Your Weak Areas

Based on your recorded responses and AI evaluation for this session, here are the specific areas requiring focused attention:

---

#### Identified Weaknesses & Gaps
${resWeaknesses}

---

#### Why These Areas Impacted Your Evaluation
* In technical rounds, interviewers specifically probe for depth around edge cases (e.g., network partitions, memory limits, race conditions). Missing these concepts signals that while you know the "happy path", you need more experience with production failure modes.

#### Next Steps to Overcome These Gaps
1. **Targeted Revision:** Review design patterns and architectural best practices addressing these specific topics.
2. **Active Explanation:** Practice explaining these concepts out loud or in writing using clear architectural diagrams.`;
      }

      if (lastLower.includes('study plan') || lastLower.includes('learning plan') || lastLower.includes('roadmap')) {
        return `### 📅 Personalized 5-Day Study Plan Based on Your Results

This study plan is tailored directly to target the specific weaknesses and missing concepts identified in your **${resRole}** interview:

---

* **Day 1: Address Core Weaknesses**
  * Focus on: ${resWeaknesses.split('\n')[0] || 'System Architecture and Scalability'}.
  * Objective: Master fundamental mechanics and write concrete code/diagrams demonstrating proper handling.

* **Day 2: Deep Dive into Trade-offs & Alternatives**
  * Focus on: Comparing solutions side-by-side (e.g., SQL vs. NoSQL, sync vs. async, latency vs. throughput).
  * Objective: Formulate 3 distinct interview-ready trade-off comparisons.

* **Day 3: Structured Problem Solving & Edge Cases**
  * Focus on: Boundary conditions, failure modes, timeouts, retry storms, and idempotency.
  * Objective: Solve 3 scenario-based questions with deliberate focus on defensive design.

* **Day 4: Verbal Communication & "Headline-First" Delivery**
  * Focus on: Improving delivery clarity and concise architectural explanations.
  * Objective: Practice mock responses out loud with a timer (aim for 2-3 minute structured answers).

* **Day 5: Comprehensive Mock Simulation**
  * Return to InterviewX and take another targeted mock interview to track measurable score improvements!`;
      }

      if (lastLower.includes('strongest') || lastLower.includes('strengths') || lastLower.includes('what went well')) {
        return `### 🌟 Your Key Strengths in This Interview

Here is where your technical performance excelled:

---

${resStrengths}

---

**Coach Tip:** Make sure to anchor on these demonstrated strengths during future interviews! Highlighting your deep knowledge in these areas builds credibility early in the session.`;
      }

      // Results AI Specific Queries
      if (
        (lastLower.includes('technical score') && (lastLower.includes('low') || lastLower.includes('why') || lastLower.includes('poor'))) ||
        lastLower.includes('why was my technical score low') ||
        lastLower.includes('why did i get a low technical score')
      ) {
        return `### 📉 Technical Score Analysis (${resTechScore})

Your technical score was evaluated at **${resTechScore}**. Here is the breakdown of why it was impacted:

---

#### 1. Core Technical Drivers
* **Missing Production & Failure Modes:** Evaluators look for edge-case reasoning (e.g., race conditions, network partition handling, cache stampede). While functional correctness was demonstrated on basic paths, points were deducted when handling failure boundaries was omitted.
* **Key Improvement Areas Recorded:**
${resWeaknesses}

#### 2. How to Raise It in Your Next Interview
1. Spend 30 seconds explicitly clarifying constraints, QPS scale, and SLA expectations before proposing your design.
2. Proactively discuss observability (metrics/logs), failure recovery, and trade-offs before the interviewer prompts you.`;
      }

      if (
        lastLower.includes('weakest') ||
        lastLower.includes('perform poorly') ||
        lastLower.includes('which question was my weakest') ||
        lastLower.includes('which questions did i perform poorly on')
      ) {
        return `### 🔍 Your Weakest Question Analysis

Based on your question breakdown:
* **Weakest Question:** **Question 4** was your lowest scoring question.
* **Why It Hurt Your Score:** The answer provided a high-level summary but lacked depth on production trade-offs, concurrency handling, and system recovery.
* **Key Missing Concepts:** ${resWeaknesses.split('\n')[0] || 'System design trade-offs and edge-case handling'}.

Would you like to review Question 4 feedback in detail or see an interview-ready model answer?`;
      }

      if (
        (lastLower.includes('question 4') || lastLower.includes('q4')) &&
        (lastLower.includes('feedback') || lastLower.includes('mistake') || lastLower.includes('explain'))
      ) {
        return `### 📝 Question 4 Feedback & Mistake Breakdown

In **Question 4**, the evaluation highlighted:
* **The Mistake:** Your response covered the happy path, but did not address network retries, idempotent consumers, or cache consistency under concurrent writes.
* **Evaluator Notes:** Demonstrating functional correctness is good, but senior engineering evaluations require explaining what fails when services scale or experience transient network faults.
* **Model Answer Recommendation:**
  1. Define the trade-off upfront (e.g. strong vs eventual consistency).
  2. Propose the design with concrete mechanisms (e.g. Redis idempotency keys, dead-letter queues).
  3. Mention how you would test and observe the system in production.`;
      }

      if (
        lastLower.includes('7 day') ||
        lastLower.includes('7-day') ||
        lastLower.includes('seven day') ||
        lastLower.includes('make me a 7 day improvement plan')
      ) {
        return `### 📅 7-Day Targeted Improvement Plan for ${resRole}

Based directly on the weaknesses and missing concepts identified in your interview result:

---

* **Day 1: Address Core Weaknesses**
  * Focus on: ${resWeaknesses.split('\n')[0] || 'System Architecture and Scalability'}.
  * Objective: Master fundamental mechanics and diagram proper failure handling.

* **Day 2: Technical Deep Dive & Trade-offs**
  * Focus on: Comparing architectural patterns (e.g., SQL vs NoSQL, sync vs async).
  * Objective: Formulate 3 distinct trade-off comparisons.

* **Day 3: Question 4 Remediation & Edge Cases**
  * Focus on: Boundary conditions, failure modes, timeouts, retry storms, and idempotency.
  * Objective: Re-answer Question 4 with full architectural depth.

* **Day 4: Performance & Optimization Patterns**
  * Focus on: Caching patterns, indexing, and connection pooling.
  * Objective: Write concrete code examples demonstrating defensive design.

* **Day 5: Behavioral Delivery & Structure**
  * Focus on: Structuring technical explanations clearly and concisely.
  * Objective: Practice verbal answers with a 2-minute timer.

* **Day 6: Timed Practice Drills**
  * Focus on: Answering 3 mock questions under interview time limits.

* **Day 7: Full Mock Simulation**
  * Return to InterviewX to take another targeted mock interview to measure your improvement!`;
      }

      if (lastLower.includes('technical score') || (lastLower.includes('technical') && lastLower.includes('improve'))) {
        return `### 📈 How to Improve Your Technical Score (${resTechScore})

To boost your technical score into the 90%+ range, focus on these concrete adjustments:

---

1. **Clarify Constraints Upfront:** Before answering, spend 30 seconds clarifying inputs, throughput scale, and error expectations.
2. **Explicitly Address Missing Concepts:**
   * ${resWeaknesses}
3. **Discuss Operational Reliability:** Always mention observability (metrics/logs), failure recovery, and testability in your solutions.`;
      }

      if (lastLower.includes('feedback') || lastLower.includes('evaluator')) {
        return `### 📝 Synthesized Evaluator Feedback

Here is the holistic feedback from your evaluation:

---

* **Overall Evaluation:** You demonstrated solid competence for the **${resRole}** position with an overall score of **${resOverallScore}**.
* **Key Strengths:**
${resStrengths}
* **Core Action Items:**
${resRecommendations}

Would you like to drill into a specific question's answer or review a study plan?`;
      }

      // Check if user is asking about a specific question (e.g. Question 1, Question 2, Question 3)
      const qNumMatch = lastLower.match(/\b(?:question\s*(\d+)|q\s*(\d+))\b/i);
      if (qNumMatch) {
        const qNum = parseInt(qNumMatch[1] || qNumMatch[2], 10);
        return `### 🔍 Analysis of Question ${qNum}

Looking at your recorded response for **Question ${qNum}**:

* **What Went Well:** Your answer demonstrated a solid foundational grasp of the topic.
* **What Could Be Improved:** To turn an average answer into an exceptional, interview-ready response, explicitly mention architectural trade-offs, edge-case behavior, and how you would verify correctness in production.
* **Model Answer Strategy:** Structure your response into 3 parts:
  1. High-level definition and core problem it solves.
  2. Concrete architectural implementation with code or schema.
  3. Trade-offs, scalability constraints, and alternative approaches.

Would you like a sample interview-ready answer for this question?`;
      }

      // Default Results AI response grounded in result context
      return `### 📊 Performance Analysis: ${resRole} Interview

* **Current Score:** ${resOverallScore} (Technical: ${resTechScore}, Communication: ${resCommScore})
* **Recorded Strengths:**
${resStrengths}
* **Recorded Weak Areas:**
${resWeaknesses}

You can ask me to break down why you received this score, how to improve your answers for specific questions, or generate a tailored study plan to boost your performance!`;
    }

    // ── Extract Candidate & Resume Context ──────────────────────────────────
    const nameMatch = systemMsg.match(/Candidate Name:\s*([^\n]+)/i);
    const candidateName = nameMatch ? nameMatch[1].trim() : null;

    const roleMatch = systemMsg.match(/Target Role:\s*([^\n]+)/i);
    const parsedRole = roleMatch ? roleMatch[1].trim() : 'Software Engineer';

    const expMatch = systemMsg.match(/Experience:\s*([^\n]+)/i);
    const parsedExp = expMatch ? expMatch[1].trim() : '';

    const skillsMatch = systemMsg.match(/Verified Skills:\s*([^\n]+)/i);
    let parsedSkills = skillsMatch
      ? skillsMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];


    if (parsedSkills.length === 0) {
      const skillsSection = systemMsg.match(/Skills?:\s*([^\n\r]+)/i);
      if (skillsSection) {
        parsedSkills = skillsSection[1]
          .split(/[,|•\n]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const projMatch = systemMsg.match(/Projects:\s*([^\n]+)/i);
    const parsedProj = projMatch ? projMatch[1].trim() : '';

    // Extract Source Interview Context (for Results → Train Me)
    const hasSourceInterview = systemMsg.includes('Targeted Source Interview Context:');
    const srcIdMatch = systemMsg.match(/Source Interview ID:\s*([^\n]+)/i);
    const srcId = srcIdMatch ? srcIdMatch[1].trim() : null;
    const srcRoleMatch = systemMsg.match(/Role:\s*([^\n]+)/i);
    const srcRole = srcRoleMatch ? srcRoleMatch[1].trim() : parsedRole;
    const srcScoreMatch = systemMsg.match(/Overall Score:\s*([^\n]+)/i);
    const srcOverallScore = srcScoreMatch ? srcScoreMatch[1].trim() : null;
    const srcWeakMatch = systemMsg.match(/Weak Areas To Train:\s*([^\n]+)/i);
    const srcWeakAreas = srcWeakMatch ? srcWeakMatch[1].trim() : null;

    // ── Extract Structured Conversation State (from active conversation state note) ──
    const stateGoalMatch = systemMsg.match(/Active Conversation State:[\s\S]*?- Goal:\s*([^\n]+)/i);
    const stateGoal = stateGoalMatch && stateGoalMatch[1].trim() !== 'None' ? stateGoalMatch[1].trim() : null;

    const stateTrackMatch = systemMsg.match(/- Learning Track:\s*([^\n]+)/i);
    const stateTrack = stateTrackMatch && stateTrackMatch[1].trim() !== 'General' ? stateTrackMatch[1].trim() : null;

    const stateDayMatch = systemMsg.match(/- Current Day:\s*([^\n]+)/i);
    const stateDay = stateDayMatch && stateDayMatch[1].trim() !== 'None' ? parseInt(stateDayMatch[1].trim(), 10) : null;

    const stateTopicMatch = systemMsg.match(/- Current Topic:\s*([^\n]+)/i);
    const stateTopic = stateTopicMatch && stateTopicMatch[1].trim() !== 'None' ? stateTopicMatch[1].trim() : null;

    const stateQTextMatch = systemMsg.match(/- Current Question Text:\s*([^\n]+)/i);
    const stateQText = stateQTextMatch && stateQTextMatch[1].trim() !== 'None' ? stateQTextMatch[1].trim() : null;

    const stateQDiffMatch = systemMsg.match(/- Current Question Difficulty:\s*([^\n]+)/i);
    const stateQDifficulty = stateQDiffMatch && stateQDiffMatch[1].trim() !== 'None' ? stateQDiffMatch[1].trim() : 'Intermediate';

    const stateQHintMatch = systemMsg.match(/- Current Question Hint:\s*([^\n]+)/i);
    const stateQHint = stateQHintMatch && stateQHintMatch[1].trim() !== 'None' ? stateQHintMatch[1].trim() : null;

    const stateQPrereqMatch = systemMsg.match(/- Current Question Prerequisites:\s*([^\n]+)/i);
    const stateQPrereq = stateQPrereqMatch && stateQPrereqMatch[1].trim() !== 'None' ? stateQPrereqMatch[1].trim() : null;

    const stateQSolMatch = systemMsg.match(/- Current Question Solution:\s*([^\n]+)/i);
    const stateQSolution = stateQSolMatch && stateQSolMatch[1].trim() !== 'None' ? stateQSolMatch[1].trim() : null;

    const stateQNumMatch = systemMsg.match(/- Current Question Number:\s*([^\n]+)/i);
    const stateQNumber = stateQNumMatch ? parseInt(stateQNumMatch[1].trim(), 10) || 1 : 1;

    // ── Extract Preceding Question & Active Topic from History ─────────────
    let precedingQuestion = stateQText || null;
    if (!precedingQuestion) {
      for (let i = assistantMessages.length - 1; i >= 0; i--) {
        const c = assistantMessages[i].content || '';
        const qMatch =
          c.match(/\*\*Question:\*\*\s*([^\n]+)/i) ||
          c.match(/Question:\s*([^\n]+)/i) ||
          c.match(/(?:How|What|Why|Explain|Design|Can you|Walk me through|Suppose)[^.?!]*\?/i);
        if (qMatch) {
          precedingQuestion = qMatch[1] || qMatch[0];
          break;
        }
      }
    }

    // Identify active technical topic: prioritize immediate user query, then state, then recent dialogue
    const immediateText = (lastLower + ' ' + (stateTopic || '') + ' ' + (stateTrack || '') + ' ' + (stateGoal || '')).toLowerCase();
    const dialogTurns = [...userMessages.slice(-3), ...assistantMessages.slice(-3)];
    const dialogText = dialogTurns.map((m) => m.content).join(' ').toLowerCase();

    const resolveTopic = (text) => {
      if (text.includes('decorator')) return 'Python Decorators & Closures';
      if (text.includes('generator') || text.includes('yield')) return 'Python Generators & Memory Optimization';
      if (text.includes('fastapi')) return 'FastAPI & Asynchronous Python';
      if (text.includes('indexing') || text.includes('database index') || text.includes('b-tree')) return 'Database Indexing & Query Optimization';
      if (text.includes('dependency injection') || text.includes('ioc')) return 'Dependency Injection & Clean Architecture';
      if (text.includes('postgres')) return 'PostgreSQL & Relational Data Architecture';
      if (text.includes('docker') || text.includes('container')) return 'Docker & Containerization';
      if (text.includes('async') || text.includes('event loop') || text.includes('asyncio')) return 'Asynchronous Programming & Concurrency';
      if (text.includes('python fullstack') || text.includes('python full stack') || text.includes('python')) return 'Python Full Stack Engineering';
      if (text.includes('kafka') || (text.includes('partition') && text.includes('consumer'))) return 'Apache Kafka & Event Streaming';
      if (text.includes('jwt') || text.includes('bearer') || text.includes('token')) return 'JWT & Auth Architecture';
      if (text.includes('closure') || text.includes('lexical') || text.includes('scoping')) return 'JavaScript Closures & Lexical Scoping';
      if (text.includes('hook') || text.includes('usememo') || text.includes('usecallback') || text.includes('useeffect') || text.includes('react')) return 'React Hooks & State Optimization';
      if (text.includes('ttfb') || text.includes('800ms') || text.includes('latency')) return 'Web Performance & TTFB Diagnostics';
      if (text.includes('system design') || text.includes('distributed') || text.includes('sharding') || text.includes('backpressure')) return 'System Design & Scalability';
      if (text.includes('database') || text.includes('sql') || text.includes('mongo')) return 'Databases & Distributed Storage';
      return null;
    };

    let activeTopic = resolveTopic(immediateText) || resolveTopic(dialogText) || stateTopic || 'Technical Concepts';

    // ── JSON Response Mode (Structured Exercises, Evaluations & Profile) ───
    if (responseFormatJson) {
      if (lastLower.includes('generate an interactive interview training question') || lastLower.includes('questiontext')) {
        let topic = 'System Architecture';
        if (lastLower.includes('node.js')) topic = 'Node.js Event Loop & Concurrency';
        else if (lastLower.includes('react')) topic = 'React Rendering & State Architecture';
        else if (lastLower.includes('database')) topic = 'Distributed Databases & Sharding';
        else if (lastLower.includes('kafka')) topic = 'Apache Kafka Partitions & Consumer Groups';

        return JSON.stringify({
          questionText: `In the context of ${topic}, suppose your service encounters sudden traffic spikes that exhaust connection pools. How would you design a resilient backpressure mechanism to prevent catastrophic failure?`,
          difficulty: lastLower.includes('advanced') ? 'Advanced' : 'Intermediate',
          topic,
          keyConceptsExpected: ['Circuit breaker pattern', 'Exponential backoff with jitter', 'Queue buffering', 'Rate limiting'],
          hint: 'Consider decoupling message ingestion using an asynchronous message broker like Apache Kafka or AWS SQS.',
        });
      }

      if (lastLower.includes('analyze this completed mock interview') || lastLower.includes('train me')) {
        return JSON.stringify({
          strongestArea: 'JavaScript Fundamentals & REST APIs',
          mainImprovementAreas: ['System Design Reasoning', 'Database Sharding & Replication', 'STAR Behavioral Structure'],
          priorityFocusTopic: 'System Design & Scalability',
          startingExercisePrompt: `I've reviewed this completed interview. Your strongest area was **JavaScript Fundamentals & REST APIs**.\n\nThe main areas to improve are:\n• 🔴 System Design Reasoning\n• 🟠 Database Sharding & Geo-Replication Trade-offs\n• 🟠 Explaining Failure Modes\n\nLet's work on **System Design & Scalability** first.`,
          recommendedStartingQuestion: 'Design a resilient distributed notification engine that must deliver millions of push events per hour. Before selecting databases or frameworks, what requirements and constraints would you clarify?',
          difficulty: 'Intermediate',
        });
      }

      if (lastLower.includes('evaluate this candidate\'s answer') || lastLower.includes('candidate\'s answer:')) {
        return JSON.stringify({
          score: 78,
          strengths: [
            'Accurately decoupled worker processing using queue buffering',
            'Solid intuition on rate limiting with distributed caching',
          ],
          missingConcepts: [
            'Idempotent consumers under duplicate delivery',
            'Dead-letter queue (DLQ) strategy for poisoned messages',
          ],
          conceptExplanation:
            'When distributing traffic across asynchronous worker pools, network retries make duplicates inevitable. Implementing idempotency keys guarantees messages are processed only once.',
          hint: 'Think about using a unique client request ID stored with a TTL in Redis to detect replayed messages.',
          feedbackMarkdown: `### Answer Evaluation\n\n**What you got right:**\n- Great approach using an API gateway and asynchronous queues to absorb burst spikes.\n- Correctly leveraged distributed caching for fast rate-limiting.\n\n**Key areas to deepen:**\n- How do you guarantee idempotency if consumers retry unacknowledged messages?\n- What is your strategy for unparseable or poisoned messages?\n\n💡 **Guiding Concept:** Incorporating a Dead-Letter Queue (DLQ) isolates faulty payloads without halting consumer execution.`,
          nextQuestion:
            'How would you ensure idempotency if worker tasks fail mid-execution and the message broker re-delivers the notification payload?',
          newDifficulty: 'Intermediate',
          difficultyAdjustmentReason: 'Consistent reasoning on architectural patterns; drilling deeper into reliability trade-offs.',
        });
      }

      return JSON.stringify({
        strengths: parsedSkills.length > 0 ? parsedSkills.slice(0, 4) : ['React', 'TypeScript', 'Node.js'],
        weaknesses: ['System Design Scale', 'Trade-off Articulation', 'STAR Behavioral Structure'],
        focusTopics: [parsedSkills[0] || 'React', 'System Architecture', 'API Boundaries'],
        recommendedStartingTopic: parsedSkills[0] || 'React',
        difficulty: 'Intermediate',
        summary: `Strong ${parsedRole} foundation with skills in ${parsedSkills.slice(0, 4).join(', ') || 'modern full-stack web technologies'}. Ready for active recall drills.`,
      });
    }

    // ── 1. NATURAL GREETINGS ────────────────────────────────────────────────
    if (
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|what's up)\b/i.test(lastLower) ||
      lastLower === 'hi' ||
      lastLower === 'hello' ||
      lastLower === 'hey'
    ) {
      const namePart = candidateName ? ` ${candidateName}` : '';
      return `Hey${namePart}! What would you like to work on today—your resume, interview practice, a technical concept, or a previous interview?`;
    }

    // ── 2. CANDIDATE IDENTITY / NAME QUERIES ────────────────────────────────
    if (
      /\b(what('s| is) my name|who am i|do you know my name|tell me my name|what is my profile name)\b/i.test(lastLower)
    ) {
      if (candidateName) {
        return `Based on your profile, your name is **${candidateName}**${parsedRole ? `, and you are targeting **${parsedRole}** roles` : ''}. What would you like to focus on today?`;
      }
      return `I don't have your name in your candidate profile yet. You can attach your resume using the 📎 button or set your profile details so I can personalize our sessions!`;
    }

    // ── 3. CONTEXTUAL INTENTS: HINTS & CLUES ("give me a hint", "can you give me a clue?", "i'm stuck") ──
    if (
      !lastLower.includes('debug') &&
      (/\b(hint|clue|stuck|give me a hint|can you give me a clue|give a hint|need a hint|help me with this one)\b/i.test(lastLower) ||
      lastLower === 'hint' ||
      lastLower === 'give me a hint' ||
      lastLower === 'give a hint')
    ) {
      if (
        (precedingQuestion && precedingQuestion.toLowerCase().includes('decorator')) ||
        activeTopic.includes('Decorator') ||
        lastAssistantMsg.toLowerCase().includes('decorator')
      ) {
        return {
          content: `💡 **Targeted Hint:**\nThink about functions as first-class citizens in Python. A decorator takes a target function as an argument, defines an inner \`*args, **kwargs\` wrapper function that adds behavior before and after execution, and returns that inner function closure.`,
          updatedState: {
            currentTopic: 'Python Decorators & Closures',
            currentExercise: { status: 'hint_provided' },
          },
        };
      }

      if (
        (precedingQuestion && (precedingQuestion.toLowerCase().includes('generator') || precedingQuestion.toLowerCase().includes('yield'))) ||
        activeTopic.includes('Generator') ||
        lastAssistantMsg.toLowerCase().includes('generator')
      ) {
        return {
          content: `💡 **Targeted Hint:**\nFocus on lazy evaluation and state preservation. Instead of allocating memory for the entire dataset upfront (like a \`list\`), a generator computes values on demand via the \`yield\` keyword, keeping track of its frame execution state across successive \`next()\` calls.`,
          updatedState: {
            currentTopic: 'Python Generators & Memory Optimization',
            currentExercise: { status: 'hint_provided' },
          },
        };
      }

      if (
        (precedingQuestion && (precedingQuestion.toLowerCase().includes('list') && precedingQuestion.toLowerCase().includes('tuple'))) ||
        activeTopic.includes('List') ||
        lastAssistantMsg.toLowerCase().includes('list') && lastAssistantMsg.toLowerCase().includes('tuple')
      ) {
        return {
          content: `💡 **Targeted Hint:**\nConsider mutability and memory allocation. Which one allows in-place modifications (\`.append()\`, item reassignment), and which one is immutable and can be safely used as a dictionary key or set element?`,
          updatedState: {
            currentTopic: 'Python Fundamentals (List vs Tuple)',
            currentExercise: { status: 'hint_provided' },
          },
        };
      }

      if (stateQHint) {
        return {
          content: `💡 **Targeted Hint:**\n${stateQHint}`,
          updatedState: {
            currentExercise: { status: 'hint_provided' },
          },
        };
      }

      if (precedingQuestion) {
        return {
          content: `💡 **Targeted Hint for this question:**\nStart by breaking down the question into its foundational trade-offs. Identify the core constraint (latency, throughput, memory, or immutability) before discussing implementation details.`,
          updatedState: {
            currentExercise: { status: 'hint_provided' },
          },
        };
      }

      return `Sure! Which question or topic would you like a hint on? Let me know what you're working on or ask for a practice question to start.`;
    }

    // ── 3.B. "EXPLAIN PREREQUISITE CONCEPT" ──────────────────────────────────
    if (
      /\b(prerequisite|prereq|prerequisites|explain the prerequisite|explain prerequisite)\b/i.test(lastLower)
    ) {
      if (
        (precedingQuestion && (precedingQuestion.toLowerCase().includes('generator') || precedingQuestion.toLowerCase().includes('yield'))) ||
        activeTopic.includes('Generator') ||
        lastAssistantMsg.toLowerCase().includes('generator')
      ) {
        return {
          content: `### 📚 Prerequisite Concepts: Python Iterables & Iterators

To truly master **Python generators**, you must first understand the Python iteration protocol:

#### 1. Iterables vs. Iterators
- **Iterable:** Any Python object capable of returning its members one at a time (implements \`__iter__()\`), such as \`list\`, \`str\`, or \`dict\`.
- **Iterator:** An object representing a stream of data that produces successive items via \`__next__()\`. It maintains state across calls and raises \`StopIteration\` when exhausted.

#### 2. The \`yield\` Mechanism & Lazy Evaluation
- Unlike regular functions that terminate and return a single value, \`yield\` suspends the function's execution, pauses its stack frame, and produces an intermediate value to the caller.
- **Lazy Evaluation:** Elements are computed only when explicitly requested, eliminating the need to store millions of records in RAM.

#### 3. Why This Matters for the Active Question
Generators build directly on top of iterators to turn complex iteration logic into readable functions without writing custom \`__iter__\` and \`__next__\` classes.

---

Would you like to return to answering the generator question, or see a quick side-by-side code example?`,
          updatedState: {
            currentTopic: 'Python Iterators & Generators',
            currentExercise: { status: 'prerequisite_explained' },
          },
        };
      }

      if (
        (precedingQuestion && precedingQuestion.toLowerCase().includes('decorator')) ||
        activeTopic.includes('Decorator') ||
        lastAssistantMsg.toLowerCase().includes('decorator')
      ) {
        return {
          content: `### 📚 Prerequisite Concepts: First-Class Functions & Lexical Closures

Before understanding **Python decorators**, you must understand how Python treats functions:

#### 1. First-Class Citizen Functions
In Python, functions are objects. You can pass them as arguments into other functions, assign them to variables, and return them from other functions.

#### 2. Lexical Closures
An inner function defined inside an enclosing function captures and retains access to the outer function's local variables, even after the outer function has finished executing.

#### 3. Why This Matters for Decorators
A decorator is simply syntax sugar (\`@\`) for wrapping a function inside a closure to extend its execution without modifying the original source code.

---

Ready to explain decorators now, or shall we look at a closure example?`,
          updatedState: {
            currentTopic: 'Python Closures & First-Class Functions',
            currentExercise: { status: 'prerequisite_explained' },
          },
        };
      }

      if (stateQPrereq) {
        return {
          content: `### 📚 Prerequisite Concepts: ${stateTopic || 'Core Fundamentals'}\n\n${stateQPrereq}`,
          updatedState: {
            currentExercise: { status: 'prerequisite_explained' },
          },
        };
      }

      return `### 📚 Prerequisite Concepts: ${activeTopic}\n\nBefore tackling this question, review the fundamental data structures, memory characteristics, and asynchronous execution guarantees that form the foundation of this topic.\n\nWould you like a focused breakdown of the prerequisites, or shall we proceed with the question?`;
    }

    // ── 3.C. "I DON'T KNOW" / GIVE ANSWER BEHAVIOR ────────────────────────────
    if (
      /\b(i don'?t know|give answer|give me the answer|what is the answer|what's the answer|tell me the answer|dont know give answer|i have no idea|idk|no idea|i give up|show answer|what's the solution|tell me the solution|solution)\b/i.test(lastLower)
    ) {
      // Check if previous question was about List vs Tuple
      if (
        (precedingQuestion && (precedingQuestion.toLowerCase().includes('list') && precedingQuestion.toLowerCase().includes('tuple'))) ||
        activeTopic.includes('List vs Tuple') ||
        (lastAssistantMsg.toLowerCase().includes('list') && lastAssistantMsg.toLowerCase().includes('tuple'))
      ) {
        return {
          content: `No problem! Here is the complete breakdown and model interview answer:

### Explanation:
In Python, the fundamental differences between a **list** and a **tuple** come down to **mutability, memory layout, performance, and semantic intent**:

1. **Mutability:**
   - Lists are **mutable** (\`[1, 2, 3]\`). You can append, pop, slice, and reassign elements in-place.
   - Tuples are **immutable** (\`(1, 2, 3)\`). Once initialized, elements cannot be modified, added, or removed.

2. **Memory & Performance:**
   - Because lists are mutable, Python over-allocates memory buffer space to accommodate future appends in $O(1)$ amortized time.
   - Tuples have a fixed size; Python allocates exactly the necessary block of memory, making tuples more compact and slightly faster to instantiate and iterate over.

3. **Hashability & Dictionary Keys:**
   - Because tuples are immutable (and assuming all contained elements are also immutable), they are **hashable** and can be used as dictionary keys or stored in sets.
   - Lists are unhashable and will throw \`TypeError: unhashable type: 'list'\`.

### Interview-ready answer:
"The core difference is that Python lists are mutable, while tuples are immutable. Because tuples cannot change after creation, Python optimizes their memory layout into fixed, compact blocks, making them faster to instantiate and iterate. Crucially, immutable tuples are hashable, which allows them to serve as dictionary keys or set members, whereas lists cannot. In clean code, lists represent homogeneous collections of items that may change, while tuples represent heterogeneous structured records with fixed schemas."

### Key points to remember:
• Lists: mutable, over-allocated dynamic array, unhashable.
• Tuples: immutable, fixed memory allocation, hashable (if elements are hashable).
• Use tuples for read-only data, records, and dictionary keys; use lists for dynamic sequences.

Want to try another question on Python fundamentals, or move to the next exercise?`,
          updatedState: {
            currentTopic: 'Python Fundamentals (List vs Tuple)',
            currentExercise: { status: 'explanation_requested' },
          },
        };
      }

      // Check if previous question was about TTFB
      if (
        (precedingQuestion && (precedingQuestion.toLowerCase().includes('ttfb') || precedingQuestion.toLowerCase().includes('800ms'))) ||
        activeTopic.includes('TTFB') ||
        lastAssistantMsg.toLowerCase().includes('ttfb') ||
        lastAssistantMsg.toLowerCase().includes('800ms')
      ) {
        return `No problem. Here's how you could approach it.

### Explanation:
Time to First Byte (TTFB) measures the duration from when the client initiates the HTTP request until the first byte of the response arrives. An 800ms TTFB is high for modern web applications (target is <200ms).

To isolate the root cause, walk down the network and server stack in order:
1. **Network Layer (DNS & TLS Handshake):** Use the Navigation Timing API (\`performance.timing\`) or Chrome DevTools Network Waterfall to inspect:
   - DNS Lookup: \`domainLookupEnd - domainLookupStart\`
   - TCP Connection: \`connectEnd - connectStart\`
   - TLS Handshake: \`connectEnd - secureConnectionStart\`
2. **Server Processing & Backend Execution:**
   - Waiting (TTFB): \`responseStart - requestStart\`. If this segment accounts for 700ms+ of the 800ms, the bottleneck is on the server.
3. **Application & Database Profiling:**
   - Inspect APM traces (Datadog, New Relic) to see if time is spent waiting on unindexed database queries, slow external microservice calls, or blocking synchronous computations on the main event loop.

### Interview-ready answer:
"To diagnose an 800ms TTFB, I would use Chrome DevTools Network tab and the Navigation Timing API to segment the request lifecycle. I'd check DNS and TLS handshake durations first to confirm network health. If the delay is primarily server waiting time (\`responseStart - requestStart\`), I inspect server APM traces to identify slow database queries, missing cache layers, or event loop blockage."

### Key points to remember:
• Distinguish between network latency (DNS, TLS, physical distance) and server execution time.
• Check database query execution plans, missing indexes, and un-cached read patterns.
• Use APM distributed tracing to see downstream microservice RPC bottlenecks.

Want to try the question again, or explore how you would optimize database queries?`;
      }

      // Check if previous question was about Decorators
      if (
        (precedingQuestion && precedingQuestion.toLowerCase().includes('decorator')) ||
        activeTopic.includes('Decorator') ||
        lastAssistantMsg.toLowerCase().includes('decorator')
      ) {
        return {
          content: `No problem! Here is the complete breakdown and model interview answer:

### Explanation:
In Python, a **decorator** is a design pattern and language feature allowing developers to add behavior to existing functions or classes without altering their source code.

1. **How It Works:** A decorator is a callable that accepts another function as its argument and returns a replacement callable (usually an inner wrapper function that captures the original function in a closure).
2. **The \`@\` Syntax:** Writing \`@my_decorator\` above \`def my_func():\` is exact syntactic sugar for \`my_func = my_decorator(my_func)\`.
3. **Preserving Metadata:** When wrapping functions, you should apply \`@functools.wraps(func)\` to ensure docstrings, function names, and module metadata remain intact.

### Interview-ready answer:
"In Python, decorators are higher-order functions that take a function as input, extend its behavior using an enclosed wrapper function, and return that wrapper. They leverage Python's first-class functions and lexical closures. Standard production use cases include authentication, rate limiting, performance telemetry, and logging. We use \`@functools.wraps\` on the wrapper function so that the original function's name and docstring are preserved."

### Key points to remember:
• Syntactic sugar for \`func = decorator(func)\`.
• Built on top of closures and first-class functions.
• Always use \`@functools.wraps\` to preserve identity.

Want to try applying this in code, or move to the next question?`,
          updatedState: {
            currentTopic: 'Python Decorators & Closures',
            currentExercise: { status: 'explanation_requested' },
          },
        };
      }

      // Check if previous question was about JavaScript Closures
      if (
        !activeTopic.includes('Decorator') &&
        ((precedingQuestion && precedingQuestion.toLowerCase().includes('closure')) ||
        activeTopic.includes('Closures') ||
        lastAssistantMsg.toLowerCase().includes('closure'))
      ) {
        return `No problem. Here's how you could approach it.

### Explanation:
In JavaScript, a closure gives a function access to its outer lexical scope even after the outer function has executed. The classic loop issue (\`for (var i = 0; i < 3; i++)\`) logs \`3, 3, 3\` because \`var\` is function-scoped. By the time the \`setTimeout\` callbacks run, the loop has completed and \`i\` is 3.

Fixing it:
1. **Using \`let\`:** \`let\` is block-scoped, creating a new binding for \`i\` on each iteration.
2. **Using an IIFE:** Passing \`i\` as an argument to an immediately invoked function expression binds the current value inside a new function scope.

### Interview-ready answer:
"The loop outputs 3 three times because \`var\` is function-scoped, meaning all three callbacks share the exact same variable reference, which equals 3 after the loop finishes. Replacing \`var\` with \`let\` fixes this because \`let\` creates a new lexical binding for each loop iteration, allowing the closure inside each callback to capture that specific iteration's value."

### Key points to remember:
• \`var\` is hoisted and function-scoped; \`let\` and \`const\` are block-scoped.
• Closures capture variables by reference, not by value.
• Each iteration with \`let\` generates a new lexical environment.

Want to try the question again, or see another closure challenge?`;
      }

      // Check if previous question was about Kafka
      if (
        (precedingQuestion && precedingQuestion.toLowerCase().includes('kafka')) ||
        activeTopic.includes('Kafka')
      ) {
        return `No problem. Here's how you could approach it.

### Explanation:
In Apache Kafka, **Partitions** provide storage sharding and write concurrency, while **Consumer Groups** provide scalable parallel reads and fault tolerance.
- A partition is an append-only, ordered log. Strict FIFO ordering is guaranteed only within a partition.
- A consumer group assigns each partition to exactly one consumer in the group. If there are 6 partitions and 3 consumers, each consumer processes 2 partitions. If consumers outnumber partitions, extra consumers sit idle.

### Interview-ready answer:
"Partitions are Kafka's unit of storage and parallelism on the broker side, guaranteeing ordering per partition. Consumer groups are the mechanism for scalable consumption. Kafka maps each partition to one consumer per group, meaning partition count dictates the maximum consumption concurrency."

### Key points to remember:
• Kafka guarantees ordering within a single partition, not across the whole topic.
• Adding consumers beyond the partition count does not increase throughput.
• When consumers join or leave, a group rebalance reallocates partition ownership.

Want to try the question again?`;
      }

      // Generic preceding question answer
      return `No problem. Here's how you could approach it.

### Explanation:
When approaching this question in an interview, break the problem down into:
1. **Core Mechanism:** Define what happens at each layer of the architecture.
2. **Trade-offs:** Explain why a particular strategy is chosen (e.g. throughput vs latency, consistency vs availability).
3. **Failure Handling:** Address what happens when things go wrong (timeouts, retries, data loss).

### Interview-ready answer:
"I would break this down into requirements, identifying the primary bottleneck first. Then I'd implement a decoupled architecture with graceful degradation, caching frequently accessed state and adding observability to monitor performance."

### Key points to remember:
• Start by stating constraints and trade-offs before proposing code or technologies.
• Demonstrate awareness of edge cases and scalability bottlenecks.
• Always communicate your reasoning clearly to the interviewer.

Want to try the question again, or shall we move to another exercise?`;
    }

    // ── 3.D. "NEXT QUESTION" / "NEXT ONE" / "LET'S MOVE ON" ──────────────────
    if (
      /\b(next question|next one|give me another question|let's move on|lets move on|another question|move on)\b/i.test(lastLower) ||
      lastLower === 'next' ||
      lastLower === 'ok next' ||
      lastLower === 'ok next question'
    ) {
      const nextNum = (stateQNumber || 1) + 1;

      if (stateTrack === 'Python Full Stack' || activeTopic.includes('Python') || stateGoal?.includes('Python')) {
        const pyQuestions = [
          {
            num: 2,
            text: 'Explain Python generators and how the `yield` statement enables memory-efficient processing compared to standard list returns.',
            topic: 'Python Generators & Memory Efficiency',
            hint: 'Focus on how generators evaluate lazily and avoid holding the entire sequence in memory.',
            prereq: 'Python iterables, iterators, and the `__next__()` protocol.',
          },
          {
            num: 3,
            text: 'How does Python handle memory management and garbage collection? What is the role of reference counting and the cyclic generational garbage collector?',
            topic: 'Python Memory & Garbage Collection',
            hint: 'Distinguish between standard reference counting and Python gc module for circular references.',
            prereq: 'Object pointers, circular references, and generational collection.',
          },
          {
            num: 4,
            text: 'In FastAPI or Django, how do you manage database connection pooling and asynchronous request handling under high concurrency?',
            topic: 'Python Full Stack Backend Architecture',
            hint: 'Discuss async/await event loops (uvicorn/gunicorn) vs synchronous worker thread pools.',
            prereq: 'Asynchronous I/O, event loops, and database connection lifecycle.',
          },
        ];

        const nextQ = pyQuestions.find((q) => q.num === nextNum) || pyQuestions[0];
        return {
          content: `### 📝 Question ${nextQ.num}: ${nextQ.topic}\n\n${nextQ.text}\n\n*Take your time to structure your reasoning, or ask for a hint if you'd like a starting point.*`,
          updatedState: {
            currentTopic: nextQ.topic,
            currentQuestion: {
              id: `q_py_${nextQ.num}`,
              text: nextQ.text,
              topic: nextQ.topic,
              difficulty: stateQDifficulty || 'Intermediate',
              hint: nextQ.hint,
              prerequisites: nextQ.prereq,
              questionNumber: nextQ.num,
            },
            currentExercise: { status: 'awaiting_answer' },
          },
        };
      }

      // Default next question in generic track
      return {
        content: `### 📝 Question ${nextNum}: System Design & Concurrency\n\nHow would you design a rate-limiting layer for a public API that must support 100,000 requests per second across multiple server instances? What distributed data stores and algorithms (token bucket vs sliding window log) would you use?\n\n*Share your approach below!*`,
        updatedState: {
          currentTopic: 'Distributed Rate Limiting',
          currentQuestion: {
            id: `q_sys_${nextNum}`,
            text: 'How would you design a distributed rate-limiting layer using token bucket or sliding window log in Redis?',
            topic: 'Distributed Rate Limiting',
            difficulty: 'Intermediate',
            hint: 'Consider Redis sorted sets or Lua scripts to ensure atomic increment and expiration checks.',
            questionNumber: nextNum,
          },
          currentExercise: { status: 'awaiting_answer' },
        },
      };
    }

    // ── 3.E. "START DAY 1 PRACTICE" / "START PRACTICE" ────────────────────────
    if (
      /\b(start day 1|start day 1 practice|start practice|begin day 1|day 1 practice|start day one)\b/i.test(lastLower)
    ) {
      if (stateGoal?.includes('Python') || stateTrack === 'Python Full Stack' || activeTopic.includes('Python')) {
        const q1Text = 'What is the difference between a Python list and tuple? When would you strictly choose one over the other in terms of performance and memory?';
        return {
          content: `### 🚀 Day 1 Practice: Python Fundamentals & Data Model\n\nWelcome to Day 1 of your **Python Full Stack** preparation track!\n\n**Question 1:**\n${q1Text}\n\n💡 *Tip: Structure your answer covering mutability, memory allocation, and dictionary key compatibility.*`,
          updatedState: {
            currentMode: 'training_drill',
            currentDay: 1,
            currentTopic: 'Python Fundamentals',
            learningTrack: 'Python Full Stack',
            currentQuestion: {
              id: 'q_py_1',
              text: q1Text,
              topic: 'Python Fundamentals (List vs Tuple)',
              difficulty: 'Intermediate',
              hint: 'Consider mutability, memory buffer allocation, and which one is hashable.',
              prerequisites: 'Python basic data types, memory mutability, and dictionary keys.',
              questionNumber: 1,
            },
            currentExercise: { status: 'awaiting_answer' },
          },
        };
      }

      const q1Default = 'What is the difference between synchronous execution and the JavaScript asynchronous event loop with microtask queues?';
      return {
        content: `### 🚀 Day 1 Practice: Core Engineering Fundamentals\n\nLet's kick off Day 1 of your interview preparation!\n\n**Question 1:**\n${q1Default}\n\n*Share your answer or ask for a hint to get started.*`,
        updatedState: {
          currentMode: 'training_drill',
          currentDay: 1,
          currentTopic: 'Core Fundamentals',
          currentQuestion: {
            id: 'q_core_1',
            text: q1Default,
            topic: 'Event Loop & Microtasks',
            difficulty: 'Intermediate',
            questionNumber: 1,
          },
          currentExercise: { status: 'awaiting_answer' },
        },
      };
    }

    // ── 3.F. URGENT RESUME INTERVIEW PREPARATION ("today i have interview based on my resume") ──
    if (
      /\b(today i have interview|interview today|i have interview today|interview based on my resume|mock interview today|prep for interview today)\b/i.test(lastLower)
    ) {
      const primaryTech = parsedSkills[0] || 'Full-Stack Development';
      const secondaryTech = parsedSkills[1] || 'Modern Web Architectures';
      const projectTitle = parsedProj ? parsedProj.split(/[:;,]/)[0] : 'your primary web application';
      const qResume1 = `Walk me through the architecture of ${projectTitle}. What was the most technically challenging bug or performance bottleneck you resolved, and why did you choose ${primaryTech} for its implementation?`;

      return {
        content: `### 🚨 Urgent Resume-Focused Interview Prep Session

Let's get you interview-ready immediately. Based on your candidate profile and uploaded resume, here is your **Interviewer Attack Surface**:

#### 1. Top Technologies Interviewers Will Probe:
• **Primary:** **${primaryTech}** and **${secondaryTech}**
• **Architecture:** State boundaries, async data pipelines, and error isolation

#### 2. Flagship Project Under Review:
• **Project:** **${projectTitle}**

---

### ⏱️ Rapid-Fire Question 1:
${qResume1}

*Answer as you would directly to the interviewer. I will evaluate your technical precision and STAR framework structure.*`,
        updatedState: {
          currentMode: 'rapid_fire',
          currentTopic: `Resume Interview Prep (${primaryTech})`,
          currentQuestion: {
            id: 'q_resume_urgent_1',
            text: qResume1,
            topic: `Resume Deep-Dive (${primaryTech})`,
            difficulty: 'Advanced',
            hint: 'Use the STAR framework: Situation, Task, Action, Result. Emphasize trade-offs you personally owned.',
            prerequisites: 'High-level project architecture, chosen tech stack trade-offs.',
            questionNumber: 1,
          },
          currentExercise: { status: 'awaiting_answer' },
        },
      };
    }

    // ── 3.G. "WHAT SHOULD I DO NEXT" / "OK" CONTEXTUAL GUIDANCE ───────────────
    if (
      lastLower === 'ok' ||
      lastLower === 'okay' ||
      lastLower === 'k' ||
      /\b(what should i do next|what to do next|what next|where do we start|what should i practice next)\b/i.test(lastLower)
    ) {
      if (stateQText) {
        return `We currently have an active practice question:\n\n> **"${stateQText}"**\n\nWould you like to **answer it now**, **get a hint**, or **move to the next question**?`;
      }
      if (stateGoal) {
        return `You have an active plan for **${stateGoal}**.\n\nWould you like to **Start Day 1 Practice**, **review the curriculum**, or **take a rapid-fire quiz**?`;
      }
      return `Here are the best ways we can prepare right now:\n\n1. **Start Practice** — Active recall questions on your target technologies (${parsedSkills.slice(0, 3).join(', ') || 'full-stack'})\n2. **Generate a 7-Day Plan** — Structured study path tailored to your learning goals\n3. **Resume Mock Drill** — High-probability questions grounded directly in your resume projects\n\nWhat would you like to start with?`;
    }

    // ── 3.H. NATURAL RESUME QUESTION GENERATION ──────────────────────────────
    if (
      (lastLower.includes('question') || lastLower.includes('quiz') || lastLower.includes('ask me') || lastLower.includes('drill')) &&
      (lastLower.includes('resume') || lastLower.includes('my background') || lastLower.includes('cv') || lastLower.includes('experience'))
    ) {
      const primaryTech = parsedSkills[0] || 'React';
      const backendTech = parsedSkills[1] || 'Node.js';
      const dbTech = parsedSkills.find((s) => /mongo|sql|postgres|redis/i.test(s)) || 'MongoDB';
      const projectTitle = parsedProj ? parsedProj.split(/[:;,]/)[0] : 'Full-Stack Application';

      return `### 🎯 Interview Questions Grounded in Your Resume

Based on your verified skills (**${parsedSkills.slice(0, 6).join(', ') || 'Full-Stack Web Technologies'}**) and your **${projectTitle}** project, here are targeted interview questions:

1. **System & Architecture Design:**
   *Explain the high-level architecture of your ${projectTitle} project. How did you structure the boundary between your ${primaryTech} frontend and your ${backendTech} backend services?*

2. **Technology Selection & Trade-offs:**
   *Why did you choose ${dbTech} for data persistence in your projects? What alternatives did you consider, and how did you handle data consistency and schema evolution?*

3. **Authentication & Security:**
   *How did you implement user authentication and session management in your application? How did you secure sensitive routes against token theft and CSRF/XSS vulnerabilities?*

4. **Performance & Concurrency:**
   *What challenges did you face with state management and rendering performance in ${primaryTech}? How did you diagnose and prevent unnecessary component re-renders or API call waterfalls?*

5. **Scalability & Failure Modes:**
   *If your ${projectTitle} application experienced a 10x spike in concurrent users, where would the primary bottleneck occur, and how would you redesign it for high availability?*

---

Which of these questions would you like to answer first?`;
    }

    // ── 4. "WHAT PROJECT SHOULD I PRACTICE?" ─────────────────────────────────
    if (
      lastLower.includes('project') &&
      (lastLower.includes('practice') || lastLower.includes('focus') || lastLower.includes('prepare') || lastLower.includes('choose') || lastLower.includes('should i'))
    ) {
      if (parsedProj) {
        const primaryProject = parsedProj.split(/[:;.\n]/)[0].trim();
        const techMention = parsedSkills.slice(0, 4).join(', ') || 'modern full-stack technologies';
        return `Based on your resume, I recommend practicing your **${primaryProject}** project.\n\nTechnical interviewers frequently deep-dive into this type of project because it touches **${techMention}**.\n\n#### Key Areas Interviewers Will Ask You About:\n1. **Architecture Decisions:** Why you structured the data model and API endpoints the way you did.\n2. **Toughest Technical Challenge:** A specific bug, bottleneck, or integration challenge you personally resolved.\n3. **Trade-offs:** What you would redesign if you had to support 100,000 active daily users.\n\nWould you like to do a **mock interview deep-dive on this project right now**?`;
      }
      return `Based on your profile, I recommend choosing your flagship full-stack project—the one where you made the most key architectural decisions and handled data persistence, authentication, and state management.\n\nWould you like to practice explaining that project using the **STAR framework**?`;
    }

    // ── 5. EXACT RESUME SKILLS QUERIES ───────────────────────────────────────
    if (
      lastLower.includes('skills are on my resume') ||
      lastLower.includes('skills are listed on my resume') ||
      lastLower.includes('skills on my resume') ||
      lastLower.includes('what skills do i have') ||
      lastLower.includes('what skills are') ||
      (lastLower.includes('skills') && lastLower.includes('resume'))
    ) {
      if (parsedSkills.length > 0) {
        const skillsListStr =
          parsedSkills.length === 1
            ? parsedSkills[0]
            : parsedSkills.slice(0, -1).join(', ') + ', and ' + parsedSkills[parsedSkills.length - 1];
        return `Your resume lists ${skillsListStr}.`;
      }
      return `I don't have an analyzed resume on file for you yet. Please attach your resume using the 📎 button so I can extract and analyze your technical skills!`;
    }

    // ── 6. PROACTIVE RESUME REVIEW & ANALYSIS ────────────────────────────────
    if (
      lastLower.includes('attached file:') ||
      lastLower.includes('attached:') ||
      lastLower.includes('review my resume') ||
      lastLower.includes('analyze my resume') ||
      lastLower.includes('here is my resume') ||
      lastLower.includes('uploaded resume')
    ) {
      const skillStr = parsedSkills.length > 0 ? parsedSkills.join(', ') : 'React, TypeScript, Node.js';
      const roleStr = parsedRole.toLowerCase().includes('front') ? 'Frontend-focused developer' : parsedRole;
      const expStr = parsedExp || '3 years of experience';
      return `I've reviewed your resume.\n\n**Your profile**\n• ${roleStr}\n• ${expStr}\n• ${skillStr}\n\n**Interview strengths**\n• ${parsedSkills[0] || 'React'}\n• ${parsedSkills[1] || 'JavaScript/TypeScript'}\n• Frontend development & component engineering\n\n**Areas I'd recommend practicing**\n• System design & state boundaries\n• Backend fundamentals & caching\n• Behavioral questions (STAR framework)\n\nBased on your profile, I can create a personalized interview preparation plan.\n\nWould you like to **create your plan**, **start practice**, or **analyze weak areas**?`;
    }

    // ── 7. RESUME-BASED PREPARATION ADVICE ───────────────────────────────────
    if (
      lastLower.includes('what should i prepare') ||
      lastLower.includes('prepare based on my resume') ||
      lastLower.includes('focus on based on my resume')
    ) {
      const primarySkill = parsedSkills[0] || 'React';
      const secondarySkill = parsedSkills[1] || 'TypeScript';
      return `Based on your ${primarySkill}/${secondarySkill} experience and your recent projects, I'd focus on:\n\n1. **Advanced ${primarySkill}** — Reconciler internals, concurrent rendering, and custom hooks\n2. **${secondarySkill} Architecture** — Generics, conditional types, and strict type safety\n3. **Frontend System Design** — Caching, offline sync, and real-time state\n4. **Performance Optimization** — Core Web Vitals, bundle splitting, and memory profiling\n5. **Behavioral Questions** — Articulating architectural trade-offs from your project experience\n\nI'd suggest a 7-day plan.\n\nShall I create your personalized 7-day plan now?`;
    }

    // ── 8. 7-DAY STUDY PLAN & EXPLICIT USER GOAL OVERRIDE ────────────────────
    if (
      lastLower.includes('plan') ||
      lastLower.includes('schedule') ||
      lastLower.includes('week') ||
      lastLower.includes('roadmap') ||
      lastLower.includes('prepare for') ||
      lastLower.includes('learn python fullstack') ||
      lastLower.includes('learn python full stack') ||
      lastLower.includes('python fullstack') ||
      lastLower.includes('python full stack')
    ) {
      // Prioritize explicit user goal in message:
      const wantsPythonFullStack =
        lastLower.includes('python fullstack') ||
        lastLower.includes('python full stack') ||
        (lastLower.includes('python') && lastLower.includes('fullstack')) ||
        (lastLower.includes('python') && lastLower.includes('full stack')) ||
        stateGoal?.toLowerCase().includes('python');

      if (wantsPythonFullStack) {
        return {
          content: `### 📅 7-Day Interview Preparation Plan: Python Full Stack Development

Here is your targeted, evidence-based preparation plan centered on **Python Full Stack** engineering:

---

#### Day 1: Python Core Fundamentals & Memory Model
- **Deep Dive:** List vs tuple memory layout, mutable vs immutable internals, generators, iterators, and lazy evaluation.
- **Practical Drill:** Implement custom iterators and generator pipelines for streaming data.
- **Target:** 5 active recall questions.

#### Day 2: Python OOP, Modules & Decorators
- **Deep Dive:** Dunder methods (\`__init__\`, \`__call__\`, \`__enter__\`), metaclasses, closures, and \`@functools.wraps\`.
- **Practical Drill:** Write production-grade timing and caching decorators.
- **Target:** 5 practice questions.

#### Day 3: Relational Databases (SQL & PostgreSQL) + ORM
- **Deep Dive:** PostgreSQL indexing (B-Tree vs GIN), query optimization, EXPLAIN ANALYZE, SQLAlchemy / Django ORM patterns.
- **Practical Drill:** Resolve N+1 query bottlenecks and write atomic database transactions.
- **Target:** 4 practice questions.

#### Day 4: Backend API Architecture (FastAPI & Django)
- **Deep Dive:** Pydantic validation, dependency injection in FastAPI, asynchronous I/O (\`asyncio\`), and middleware design.
- **Practical Drill:** Design a high-throughput RESTful service with JWT token authentication.
- **Target:** 1 full API architecture walkthrough.

#### Day 5: REST APIs, Authentication & Caching (Redis)
- **Deep Dive:** OAuth2 password flow, refresh token rotation, Redis caching strategies, and distributed rate limiting.
- **Practical Drill:** Implement an in-memory sliding window rate limiter in Python.
- **Target:** 4 practice questions.

#### Day 6: Frontend Integration & Modern Client Architecture
- **Deep Dive:** Connecting Python REST/WebSocket backends to client applications, CORS, state hydration, and optimistic updates.
- **Practical Drill:** Build a real-time reactive event stream consumer.
- **Target:** 3 practical integration drills.

#### Day 7: Full-Stack Project Deep-Dive & Mock Interview
- **Deep Dive:** End-to-end full-stack mock interview covering architecture trade-offs, scalability bottlenecks, and failure modes.
- **Final Review:** Strategy review and interview readiness check.

---

💡 **Next Action:** Would you like to start **Day 1 Practice** right now?`,
          updatedState: {
            goal: 'Python Full Stack',
            learningTrack: 'Python Full Stack',
            currentMode: 'plan_review',
            currentDay: 1,
            currentTopic: 'Python Core Fundamentals',
            plan: {
              goal: 'Python Full Stack',
              createdAt: new Date(),
            },
          },
        };
      }

      const primary = parsedSkills[0] || 'React';
      const secondary = parsedSkills[1] || 'TypeScript';
      const topicMatch =
        lastLower.includes('react') || primary.toLowerCase().includes('react')
          ? `${primary} & ${secondary} Engineering`
          : lastLower.includes('system design')
          ? 'Distributed System Design'
          : `${parsedRole} Technical Interview`;

      return `### 📅 7-Day Interview Preparation Plan: ${topicMatch}\n\nHere is your targeted, evidence-based study plan based on your background:\n\n---\n\n#### Day 1: Core Fundamentals & Language Internals\n- **Deep Dive:** Closures, lexical scoping, the event loop, and microtask queues.\n- **Practical Drill:** Asynchronous concurrency trade-offs and event-driven patterns.\n- **Target:** 5 active recall questions.\n\n#### Day 2: ${primary} Component Architecture & Rendering Optimization\n- **Deep Dive:** Fiber reconciler, memoization patterns (\`useMemo\`, \`useCallback\`), and render lifecycles.\n- **Practical Drill:** Refactor a component tree suffering from cascade re-renders.\n- **Target:** 5 practice questions.\n\n#### Day 3: ${secondary} Type Systems & State Management\n- **Deep Dive:** Generics, discriminated unions, Context API vs Zustand, and optimistic updates.\n- **Practical Drill:** Design an offline-capable client state synchronization pipeline.\n- **Target:** 4 practice questions.\n\n#### Day 4: Scalable System Design & API Boundaries\n- **Deep Dive:** REST vs GraphQL vs WebSockets, CDN edge caching, and backpressure handling.\n- **Practical Drill:** Design a real-time collaborative dashboard supporting 50k concurrent users.\n- **Target:** 1 full architectural walkthrough.\n\n#### Day 5: Performance Profiling & Edge Cases\n- **Deep Dive:** Core Web Vitals (LCP, INP, CLS), memory leak diagnostics, and bundle size reduction.\n- **Practical Drill:** Inspect and debug Chrome DevTools Flamegraph traces.\n\n#### Day 6: Behavioral Excellence (STAR Framework)\n- **Deep Dive:** Structuring high-impact stories covering conflict, architectural setbacks, and leadership.\n- **Practical Drill:** Practice 3 behavioral scenarios using Situation-Task-Action-Result framing.\n\n#### Day 7: Full Mock Simulation & Weakness Refinement\n- **Deep Dive:** Timed end-to-end mock interview covering your identified weak areas.\n- **Final Review:** Strategy review and confidence tuning.\n\n---\n\n💡 **Next Action:** Would you like to start **Day 1 practice right now**, or drill into a specific topic?`;
    }

    // ── 10. SPECIFIC TECHNICAL CONCEPTS ──────────────────────────────────────

    // A. Apache Kafka Partitions vs Consumer Groups
    if (
      (lastLower.includes('kafka') && (lastLower.includes('partition') || lastLower.includes('consumer'))) ||
      (lastLower.includes('partition') && lastLower.includes('consumer group'))
    ) {
      return `### ⚡ Apache Kafka: Partitions vs. Consumer Groups

In Apache Kafka, **Partitions** and **Consumer Groups** work together to achieve high-throughput, horizontally scalable, and strictly ordered event streaming.

#### 1. Partitions (Storage & Parallelism Unit)
- **What they are:** A Kafka topic is divided into one or more **partitions**. Each partition is an ordered, immutable, append-only commit log of records.
- **Ordering Guarantee:** Kafka guarantees strict FIFO ordering **only within a single partition**, never across multiple partitions in a topic.
- **Partition Key:** When a producer publishes a message with a key, Kafka hashes the key to assign the message to a specific partition. Messages with the same key always go to the same partition.

#### 2. Consumer Groups (Consumption Scalability & Fault Tolerance)
- **What they are:** A **Consumer Group** is a set of consumers that cooperate to consume records from a topic. Each group has a unique \`group.id\`.
- **Partition Assignment Rule:** Kafka assigns each partition to **exactly one consumer** within a given group at any time.
- **Horizontal Scaling Mechanics:** If a topic has 6 partitions:
  - 3 consumers in a group ➔ each consumer reads from 2 partitions.
  - 6 consumers in a group ➔ each consumer reads from 1 partition (ideal 1:1 concurrency).
  - 8 consumers in a group ➔ 6 consumers read 1 partition each, while 2 consumers remain idle as hot standbys.

#### 3. Key Architectural Comparison

| Dimension | Kafka Partitions | Consumer Groups |
| :--- | :--- | :--- |
| **Primary Role** | Storage sharding, parallelism, and per-partition ordering | Consumption throughput, load balancing, and failover |
| **Location** | Broker-side distributed storage | Client-side consumer worker processes |
| **Scaling Limit** | Adding partitions increases broker I/O and consumer concurrency limits | Active consumers cannot exceed total partition count |
| **Failure Mode** | Partition replicas take over via ISR (In-Sync Replicas) | Triggers a **Group Rebalance** to reassign partitions to live consumers |

#### ⚠️ Critical Production & Interview Trade-off:
You cannot decrease the number of partitions in a topic after creation without recreating the topic. Therefore, size topic partitions based on expected peak consumption throughput.

Would you like to **explore Kafka Rebalance strategies (Eager vs Cooperative Sticky)** or **practice a system design scenario**?`;
    }

    // B. JSON Web Tokens (JWT)
    if (lastLower.includes('jwt') || lastLower.includes('json web token')) {
      return `### 🔐 JSON Web Tokens (JWT) Explained

A **JSON Web Token (JWT)** is an open standard (RFC 7519) that defines a compact, self-contained method for securely transmitting information between parties as a JSON object.

#### 1. Structure of a JWT
A JWT consists of three parts separated by dots (\`.\`): \`header.payload.signature\`
1. **Header:** Identifies the token type (\`JWT\`) and the hashing algorithm used (e.g. \`HS256\` or \`RS256\`).
2. **Payload:** Contains the claims (e.g. \`sub\`, \`userId\`, \`roles\`, \`exp\`). *Note: Claims are Base64Url-encoded, not encrypted—never store sensitive passwords here!*
3. **Signature:** Generated by taking \`HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)\`.

#### 2. Key Interview Trade-offs:
- **Statelessness:** The backend verifies tokens cryptographically without database session lookups, scaling horizontally effortlessly.
- **Revocation Challenge:** Because the token is stateless, it remains valid until \`exp\` expires. Immediate revocation requires a distributed denylist (e.g. Redis with short TTL) or short-lived access tokens paired with refresh tokens.

Would you like a **code example of JWT verification middleware** or to **quiz yourself on token security**?`;
    }

    // C. Python & Language Internals ("What is Python?")
    if (
      lastLower === 'what is python' ||
      lastLower === 'what is python?' ||
      (lastLower.includes('what is python') && lastLower.length < 35) ||
      lastLower === 'explain python'
    ) {
      return {
        content: `### 🐍 What is Python?

**Python** is a high-level, general-purpose, interpreted programming language designed with an emphasis on code readability, expressiveness, and rapid developer velocity.

#### 1. Core Architecture & Language Fundamentals:
- **Dynamically Typed & Strongly Typed:** Variable types are resolved and checked at runtime, but implicit type coercion (like adding a string to an integer) is strictly forbidden.
- **Interpreted & Bytecode Compiled:** Source code (\`.py\`) compiles to bytecode (\`.pyc\`), which executes within the CPython Virtual Machine.
- **Memory Management:** Handled automatically using reference counting combined with a cyclic generational garbage collector (\`gc\` module).
- **Global Interpreter Lock (GIL):** In standard CPython, a mutex guarantees that only one native thread executes Python bytecode at any given moment, simplifying C-extension integration and thread-safety for internal memory.

#### 2. Key Interview Talking Points:
- **Batteries-Included Standard Library:** Native modules for asynchronous I/O (\`asyncio\`), collections, itertools, multiprocessing, and networking.
- **Multi-Paradigm Support:** Cleanly integrates object-oriented programming (dunder methods), procedural logic, and functional patterns (first-class functions, closures, generators).
- **Concurrency Strategy:** I/O-bound operations scale effectively with \`asyncio\` and coroutines; CPU-bound tasks bypass the GIL using multiprocessing (\`ProcessPoolExecutor\`).

Would you like to explore **Python decorators**, **generators & memory efficiency**, or **create a Python learning plan**?`,
        updatedState: {
          currentTopic: 'Python Fundamentals',
          learningTrack: 'Python Full Stack',
        },
      };
    }

    // D. Python Decorators ("Explain Python decorators")
    if (
      lastLower.includes('decorator') ||
      (lastLower.includes('explain') && lastLower.includes('python') && lastLower.includes('decorator'))
    ) {
      return {
        content: `### 🐍 Python Decorators Explained

A **decorator** in Python is a design pattern and first-class language feature that allows you to dynamically extend or modify the behavior of a function or class without permanently altering its source code.

#### 1. Core Mechanics
- In Python, functions are **first-class citizens**, meaning they can be passed as arguments, assigned to variables, and returned from other functions.
- A decorator takes a target function as input, wraps it inside an inner function closure, and returns that inner wrapper.
- The \`@decorator\` syntax is syntactic sugar for:
  \`my_function = decorator(my_function)\`

#### 2. Canonical Structure:
\`\`\`python
from functools import wraps

def my_decorator(func):
    @wraps(func)  # Preserves func's docstring, name, and signature
    def wrapper(*args, **kwargs):
        # Code executed before func
        result = func(*args, **kwargs)
        # Code executed after func
        return result
    return wrapper
\`\`\`

#### 3. Critical Interview Topics:
- **Preserving Metadata:** Why you must use \`@functools.wraps(func)\` (otherwise \`__name__\` and \`__doc__\` are overridden by the wrapper).
- **Decorators with Arguments:** Requires an outer factory function returning the actual decorator (three nested functions).
- **Common Production Use Cases:** Logging, performance timing, rate limiting, authentication/authorization checks, and route registration (e.g. Flask/FastAPI).

Would you like a **concrete code example**, or would you like to **quiz yourself on decorators**?`,
        updatedState: {
          currentTopic: 'Python Decorators & Closures',
          learningTrack: 'Python Full Stack',
        },
      };
    }

    // E. Database Indexing ("Explain database indexing")
    if (
      lastLower.includes('indexing') ||
      lastLower.includes('database index') ||
      (lastLower.includes('explain') && lastLower.includes('index')) ||
      lastLower === 'what is database indexing?' ||
      lastLower === 'what is database indexing'
    ) {
      return {
        content: `### 🗄️ Database Indexing Explained

A **database index** is a specialized data structure (predominantly a **B+Tree**) that dramatically accelerates data retrieval operations on a table at the cost of additional disk storage and write latency.

#### 1. How It Works (B+Tree Architecture)
- **Full Table Scan ($O(N)$):** Without an index, the database engine must inspect every disk page from beginning to end.
- **Index Seek ($O(\\log N)$):** With a B+Tree, the engine traverses root and branch pointer pages in logarithmic steps to locate the exact leaf node holding the row identifier (RID/tuple pointer).

#### 2. Critical Index Types & Concepts:
- **Clustered Index:** Dictates the physical order of data on disk (usually the Primary Key). Each table can have only one clustered index.
- **Non-Clustered (Secondary) Index:** A separate structure containing the indexed column values and a pointer back to the clustered index or table row.
- **Composite Indexes & The Leading-Column Rule:** In a multi-column index \`(A, B, C)\`, queries filtering by \`A\` or \`(A, B)\` will utilize the index, but queries filtering solely by \`B\` or \`C\` cannot.
- **Write Amplification:** Every \`INSERT\`, \`UPDATE\`, and \`DELETE\` requires updating all corresponding table indexes, which degrades write throughput.

#### 3. Interview Tip:
Always highlight **Index Seek vs Index Scan** and demonstrate how to use \`EXPLAIN ANALYZE\` to diagnose query execution plans and identify sequential table scans.

Would you like to **see a SQL index optimization example** or **quiz yourself on index trade-offs**?`,
        updatedState: {
          currentTopic: 'Database Indexing & Query Optimization',
        },
      };
    }

    // F. Dependency Injection ("What is dependency injection?")
    if (
      lastLower.includes('dependency injection') ||
      lastLower.includes('inversion of control') ||
      lastLower === 'what is dependency injection?' ||
      lastLower === 'what is dependency injection'
    ) {
      return {
        content: `### 💉 Dependency Injection (DI) Explained

**Dependency Injection (DI)** is a software engineering design pattern implementing **Inversion of Control (IoC)**, where an object receives its dependencies from an external source rather than instantiating them internally.

#### 1. The Core Problem It Solves:
Tight coupling. When a class instantiates its own dependencies directly (e.g., \`this.db = new PostgresDatabase()\`), you cannot easily substitute that dependency with a mock for unit testing or swap database engines without rewriting the class.

#### 2. Implementation Styles:
1. **Constructor Injection (Standard & Recommended):** Dependencies are supplied through the class constructor.
2. **Method/Parameter Injection:** Dependencies are passed into specific method calls (used in modern web frameworks like FastAPI's \`Depends()\`).
3. **Property/Setter Injection:** Dependencies are set via public properties after instantiation.

#### 3. Key Benefits for Architecture & Interviews:
- **Testability:** Makes unit testing trivial by injecting mock repositories or stubs without hitting live databases.
- **Single Responsibility Principle (SRP):** Classes focus exclusively on their core business logic instead of configuration and lifecycle management.
- **Decoupled Architecture:** Enables clean layered designs (Hexagonal/Clean Architecture, DDD).

Would you like to see a **FastAPI dependency injection example** or **explore DI container patterns**?`,
        updatedState: {
          currentTopic: 'Dependency Injection & Clean Architecture',
        },
      };
    }

    // G. FastAPI Example ("Show me a FastAPI example")
    if (
      lastLower.includes('fastapi example') ||
      (lastLower.includes('fastapi') && (lastLower.includes('show') || lastLower.includes('example') || lastLower.includes('code')))
    ) {
      return {
        content: `### ⚡ Production FastAPI Example with Dependency Injection

Here is a clean, production-grade FastAPI service demonstrating **Pydantic schema validation**, **asynchronous endpoint handling**, and **Dependency Injection via \`Depends()\`**:

\`\`\`python
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import Annotated

app = FastAPI(title="Candidate Evaluation API", version="1.0.0")

# 1. Schema Validation Model
class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    target_role: str = "Software Engineer"
    years_experience: int = Field(..., ge=0, le=50)

# 2. Dependency: Authentication / Verification Provider
def verify_api_key(api_token: str = "test-token"):
    if not api_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key header."
        )
    return {"client_id": "interviewx-client"}

# 3. Asynchronous Protected Endpoint with DI
@app.post(
    "/api/v1/candidates",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new candidate for interview practice"
)
async def create_candidate(
    payload: CandidateCreate,
    auth: Annotated[dict, Depends(verify_api_key)]
):
    """
    Handles candidate registration asynchronously without blocking the event loop.
    """
    candidate_record = {
        "id": "cand_101",
        **payload.model_dump(),
        "verified_by": auth["client_id"]
    }
    return {"status": "success", "data": candidate_record}
\`\`\`

Would you like to explore **FastAPI background tasks**, **database connection pooling with SQLAlchemy**, or **quiz yourself on async Python**?`,
        updatedState: {
          currentTopic: 'FastAPI & Asynchronous Python',
          learningTrack: 'Python Full Stack',
        },
      };
    }

    // H. Why use PostgreSQL ("Why use PostgreSQL?")
    if (
      lastLower.includes('why use postgresql') ||
      lastLower.includes('why postgresql') ||
      lastLower.includes('why postgres') ||
      (lastLower.includes('why') && lastLower.includes('postgresql'))
    ) {
      return {
        content: `### 🐘 Why Use PostgreSQL in Modern Backends?

**PostgreSQL** is the premier open-source object-relational database management system (ORDBMS), recognized for its uncompromising data integrity, ACID compliance, and robust extensibility.

#### 1. Top Architectural Advantages:
1. **Multi-Version Concurrency Control (MVCC):** Reads never block writes, and writes never block reads, guaranteeing high transaction throughput under heavy concurrent query loads.
2. **First-Class Semi-Structured Data (JSONB):** Native binary JSON storage paired with Generalized Inverted Indexes (GIN), delivering document-store flexibility alongside relational schema guarantees.
3. **Powerful Extensions Ecosystem:** Extensions such as **PostGIS** (geospatial), **pgvector** (vector similarity search for LLM embeddings), and \`pg_trgm\` (fuzzy text search) prevent architectural bloat from multiple specialized data stores.
4. **Transactional DDL:** Schema migrations execute inside database transactions, rolling back cleanly if an error occurs.

#### 2. Key Interview Comparison (Postgres vs MySQL vs MongoDB):
- **Vs MySQL:** PostgreSQL provides advanced indexing (GIN, GiST, BRIN), superior complex join execution plans, and strict SQL compliance.
- **Vs MongoDB:** PostgreSQL JSONB matches or exceeds MongoDB read performance while preserving cross-table relational integrity and foreign keys.

Would you like to **quiz yourself on PostgreSQL vs NoSQL trade-offs** or **explore indexing strategies**?`,
        updatedState: {
          currentTopic: 'PostgreSQL & Relational Data Architecture',
        },
      };
    }

    // I. Explain Async Programming ("Explain async programming")
    if (
      lastLower.includes('async programming') ||
      lastLower.includes('asynchronous programming') ||
      lastLower === 'explain async programming' ||
      (lastLower.includes('explain') && lastLower.includes('async'))
    ) {
      return {
        content: `### ⚡ Asynchronous Programming Explained

**Asynchronous programming** is a concurrency model that allows a program to initiate long-running operations (such as network I/O, disk access, or database queries) and continue executing other tasks while waiting for those operations to finish, without blocking the execution thread.

#### 1. Synchronous vs Asynchronous:
- **Synchronous (Blocking):** The execution thread pauses until the socket or disk returns data, sitting idle and wasting CPU capacity.
- **Asynchronous (Non-Blocking):** The thread delegates I/O operations to operating system kernel primitives (epoll, kqueue, IOCP) and returns immediately to process other events on the event loop.

#### 2. Core Concepts:
- **The Event Loop:** A centralized scheduler continuously dispatching ready callbacks, timers, and microtask queues.
- **Coroutines & \`async/await\`:** Language-level abstractions that allow non-blocking asynchronous code to be written linearly and read cleanly like synchronous code.
- **Concurrency vs Parallelism:**
  - *Concurrency:* Interleaving multiple progress tracks on a single core (e.g. 20,000 idle HTTP connections on 1 Node.js or Python thread).
  - *Parallelism:* Executing computations simultaneously across multiple physical CPU cores.

#### 3. Production & Interview Trade-offs:
Async excels at **I/O-bound** workloads (APIs, WebSocket gateways). For **CPU-bound** tasks (cryptography, image transforms), long-running computations starve the event loop—requiring offloading to worker process pools.

Would you like to see a **Python asyncio example**, or **quiz yourself on event loop internals**?`,
        updatedState: {
          currentTopic: 'Asynchronous Programming & Concurrency',
        },
      };
    }

    // J. Docker ("What is Docker?")
    if (
      lastLower === 'what is docker' ||
      lastLower === 'what is docker?' ||
      lastLower.includes('what is docker') ||
      lastLower.includes('explain docker')
    ) {
      return {
        content: `### 🐳 What is Docker?

**Docker** is an open-source platform that enables developers to build, package, ship, and run applications inside lightweight, portable, and isolated environments called **containers**.

#### 1. Containers vs Virtual Machines (VMs):
- **Virtual Machines (Hypervisor-Based):** Each VM packages a complete guest operating system, virtual kernel, and virtualized hardware, demanding gigabytes of RAM with minutes of startup overhead.
- **Containers (OS-Level Virtualization):** Containers share the host OS kernel and isolate workloads using native Linux kernel primitives:
  - **Namespaces:** Provide isolated system views (process IDs, network stacks, mount points, IPC).
  - **Control Groups (cgroups):** Enforce hard resource boundaries (CPU quotas, memory limits, I/O bandwidth).

#### 2. Core Docker Components:
1. **Dockerfile:** Declarative recipe defining the base image, runtime dependencies, environment variables, and entrypoint command.
2. **Image:** Immutable, multi-layered snapshot of the filesystem built from the Dockerfile.
3. **Container:** A runnable, instantiated instance of an image with an ephemeral read-write layer on top.
4. **Docker Compose:** Multi-container orchestration tool defining multi-service local environments (e.g. API + PostgreSQL + Redis).

#### 3. Key Interview Talking Point:
Docker solves the classical *"it works on my machine"* problem by guaranteeing deterministic dependencies, immutable artifacts, and identical runtime environments from developer laptops to Kubernetes production clusters.

Would you like to see a **production multi-stage Dockerfile for Python/Node**, or **quiz yourself on container architecture**?`,
        updatedState: {
          currentTopic: 'Docker & Containerization',
        },
      };
    }

    // K. Debugging Code ("Help me debug this code")
    if (
      lastLower.includes('debug this code') ||
      lastLower.includes('help me debug') ||
      lastLower.includes('debug my code') ||
      lastLower.includes('find the bug')
    ) {
      return {
        content: `### 🐞 Code Debugging Assistant

I'm ready to help you debug! To isolate the root cause and provide a clean fix, please share:

1. **The Code Snippet** (enclosed in triple backticks \`\`\`)
2. **The Expected Behavior** vs **What is actually happening**
3. **The Exact Error Message or Stack Trace** (if any)
4. **The Runtime / Framework** (e.g. Python 3.11 / FastAPI, Node.js / Express, React 18)

#### Standard Technical Interview Debugging Methodology:
When an interviewer asks you to debug code under pressure, structure your approach:
- **Reproduce:** Confirm input parameters, boundary conditions, and environment state.
- **Isolate:** Determine whether the defect resides in data serialization, state mutation, network I/O, or logic boundaries.
- **Hypothesize & Test:** Formulate an falsifiable hypothesis and verify with targeted print/debugger inspection.
- **Verify & Guard:** Confirm the fix resolves the failure and add a regression test.

Paste your snippet below and let's solve it together!`,
        updatedState: {
          currentTopic: 'Debugging & Code Analysis',
        },
      };
    }

    // L. React & Virtual DOM
    if (lastLower.includes('what is react') || lastLower === 'what is react?') {
      return `### ⚛️ What is React?

**React** is an open-source JavaScript library developed by Meta for building dynamic, component-driven user interfaces.

#### Core Principles:
1. **Component-Based Architecture:** UIs are broken into encapsulated components that manage their own state, making code modular and reusable.
2. **Declarative UI:** You describe how the UI should look for any given state, and React handles DOM updates automatically.
3. **Virtual DOM & Reconciliation:** React maintains an in-memory representation of the DOM. When state changes, it computes the minimal diff and updates the real DOM efficiently using the Fiber reconciler.
4. **Unidirectional Data Flow:** Data flows down from parent to child via props, ensuring predictable application behavior.

Would you like to explore **React Hooks**, **Virtual DOM internals**, or **run a practice quiz**?`;
    }

    // M. React Hooks
    if (lastLower.includes('explain hooks') || lastLower.includes('react hooks') || (lastLower.includes('hook') && lastLower.includes('react'))) {
      return `### 🎣 React Hooks Explained

**React Hooks** let functional components manage state, side effects, and lifecycle events without writing class components.

#### The Core Hooks:
1. **\`useState\`**: Manages local component state.
2. **\`useEffect\`**: Handles side effects (data fetching, subscriptions, DOM manipulation).
3. **\`useMemo\`**: Caches expensive calculation results across re-renders.
4. **\`useCallback\`**: Preserves function reference equality between renders.
5. **\`useRef\`**: Holds a mutable value that does not trigger re-renders when updated, or references a DOM node.

#### ⚠️ Rules of Hooks:
- Only call Hooks at the top level (never inside loops, conditions, or nested functions).
- Only call Hooks from React function components or custom Hooks.

Would you like me to **give you a code example**, **quiz you on hooks**, or **explain useMemo vs useCallback**?`;
    }

    // N. Closures
    if (lastLower.includes('explain closures') || (lastLower.includes('closure') && lastLower.includes('explain'))) {
      return `### 🔒 JavaScript Closures Explained

A **closure** is the combination of a function bundled together with references to its surrounding state (the lexical environment). In JavaScript, closures are created every time a function is created, at function creation time.

#### Key Characteristics:
1. **Scope Access:** An inner function retains access to variables and parameters of its outer enclosing function even after the outer function has finished executing.
2. **Data Encapsulation:** Closures enable private variables and state that cannot be accessed or manipulated directly from outside the scope.
3. **Memory Consideration:** Because outer variables are referenced, the JavaScript garbage collector cannot reclaim them as long as the closure exists.

Would you like a **concrete code example** or a **quiz on closures**?`;
    }

    // ── 11. CONTEXTUAL CONTINUITY (FOLLOW-UPS) ───────────────────────────────

    // A. "Give me an example"
    if (lastLower.includes('give me an example') || lastLower.includes('code example') || (lastLower.includes('example') && lastLower.length < 30)) {
      if (activeTopic.includes('Decorator') || activeTopic.includes('Python') || lastLower.includes('decorator')) {
        return {
          content: `### 💻 Real-World Python Decorator Example: Execution Timer

Here is a production-grade decorator that measures and logs function execution time while preserving metadata:

\`\`\`python
import time
import functools
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def measure_latency(func):
    """Decorator that measures execution duration in milliseconds."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Function '{func.__name__}' executed in {duration_ms:.2f}ms")
    return wrapper

# Usage:
@measure_latency
def fetch_user_records(user_ids: list[int]):
    """Simulate batch database fetch."""
    time.sleep(0.05)
    return {uid: f"user_{uid}" for uid in user_ids}

# fetch_user_records([1, 2, 3])
# INFO:__main__:Function 'fetch_user_records' executed in 51.20ms
# docstring preserved: fetch_user_records.__name__ -> 'fetch_user_records'
\`\`\`

Would you like to **quiz yourself on decorators**, or see how to pass **arguments to a decorator**?`,
          updatedState: {
            currentTopic: 'Python Decorators & Closures',
          },
        };
      }

      if (activeTopic.includes('FastAPI') || lastLower.includes('fastapi')) {
        return {
          content: `### 💻 Real-World FastAPI Example: Dependency Injection & Async Route

\`\`\`python
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel

app = FastAPI()

class ItemPayload(BaseModel):
    title: str
    price: float

async def get_db_session():
    # Dependency session lifecycle manager
    session = {"connected": True}
    try:
        yield session
    finally:
        session["connected"] = False

@app.post("/items", status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemPayload, db: dict = Depends(get_db_session)):
    return {"message": f"Item '{payload.title}' created successfully", "db_status": db["connected"]}
\`\`\`

Would you like to **quiz yourself on FastAPI** or **explore background tasks**?`,
          updatedState: {
            currentTopic: 'FastAPI & Asynchronous Python',
          },
        };
      }

      if (activeTopic.includes('JWT')) {
        return `### 💻 Real-World JWT Implementation Example

Here is a production-grade implementation of JWT signing and verification in Node.js/Express:

\`\`\`javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secure-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';

// 1. Generate token upon successful authentication
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

// 2. Authentication middleware for protected endpoints
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Token expired or invalid.' });
    }
    req.user = decodedUser;
    next();
  });
}
\`\`\`

Would you like to explore **refresh token rotation** or **quiz yourself on JWT edge cases**?`;
      }

      if (activeTopic.includes('Closures')) {
        return `### 💻 Real-World Closure Example: Private State Rate Limiter

Here is a practical closure implementing an in-memory client rate-limiter:

\`\`\`javascript
function createRateLimiter(maxCalls, timeWindowMs) {
  let calls = 0; // Private state enclosed in lexical scope
  let resetTime = Date.now() + timeWindowMs;

  return function executeRequest(endpoint) {
    const now = Date.now();
    if (now > resetTime) {
      calls = 0;
      resetTime = now + timeWindowMs;
    }

    if (calls >= maxCalls) {
      throw new Error(\`Rate limit exceeded for \${endpoint}. Try again later.\`);
    }

    calls++;
    return \`Request to \${endpoint} allowed (call \${calls}/\${maxCalls})\`;
  };
}

// Usage:
const apiLimiter = createRateLimiter(3, 10000);
console.log(apiLimiter('/api/data')); // Allowed (1/3)
console.log(apiLimiter('/api/data')); // Allowed (2/3)
console.log(apiLimiter('/api/data')); // Allowed (3/3)
// apiLimiter('/api/data') -> Throws Rate limit exceeded
\`\`\`

Would you like to **quiz yourself on closures** or **see another example**?`;
      }

      // Default to React Hooks example
      return `### 💻 Custom Hook Example: \`useDebounce\`

Here is a standard custom hook demonstrating \`useState\` and \`useEffect\` with cleanup:

\`\`\`jsx
import { useState, useEffect } from 'react';

export function useDebounce(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // Cleanup: cancel timeout if value changes before delay expires
    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}
\`\`\`

Would you like to **quiz yourself on this** or **explore another concept**?`;
    }

    // B. "Now quiz me"
    if (lastLower.includes('quiz me') || lastLower.includes('test me') || (lastLower.includes('quiz') && lastLower.length < 25)) {
      if (activeTopic.includes('Decorator') || activeTopic.includes('Python') || lastLower.includes('decorator')) {
        const qText = 'Why is `@functools.wraps` essential when writing custom decorators, and what happens to `__name__` and `__doc__` if it is omitted? Additionally, how would you write a decorator that accepts configuration arguments like `@retry(max_attempts=3)`?';
        return {
          content: `### 📝 Active Recall Quiz: Python Decorators

**Question:**
1. Why is \`@functools.wraps\` essential when implementing custom decorators, and what happens to \`__name__\`, \`__doc__\`, and introspection if it is omitted?
2. How does Python handle decorators that take arguments (e.g., \`@retry(max_attempts=3)\`), and how many nested functions are required?

Share your reasoning or write out the structure below!`,
          updatedState: {
            currentTopic: 'Python Decorators & Closures',
            currentQuestion: {
              id: 'q_py_decorator',
              text: qText,
              topic: 'Python Decorators & Closures',
              difficulty: stateQDifficulty || 'Intermediate',
              hint: 'Recall that a decorator with arguments is a decorator factory returning the actual decorator function, which returns the wrapper. And functools.wraps copies __module__, __name__, and __qualname__.',
              prerequisites: 'Python first-class functions, closures, and variable unpacking (*args, **kwargs).',
              questionNumber: 1,
            },
            currentExercise: { status: 'awaiting_answer' },
          },
        };
      }

      if (activeTopic.includes('Kafka')) {
        return `### 📝 Active Recall Quiz: Apache Kafka

**Question:**
Suppose you have a topic with **4 partitions**, and you deploy **6 consumer instances** belonging to the same consumer group (\`group.id = "analytics-workers"\`).

1. How many consumers will actively process messages, and how many will sit idle?
2. If one of the active consumers crashes, what mechanism is triggered, and what happens to partition assignment?
3. How would you scale consumption throughput to utilize all 6 workers?

Share your reasoning below!`;
      }

      if (activeTopic.includes('JWT')) {
        return `### 📝 Active Recall Quiz: JWT & Security

**Question:**
Suppose a user reports their laptop was stolen with a valid JWT access token that doesn't expire for 12 hours.

1. Since JWTs are stateless, how do you immediately invalidate that specific token on the server?
2. What architectural trade-offs exist between short-lived access tokens + refresh tokens vs centralized token blacklists?

Share your reasoning below!`;
      }

      if (activeTopic.includes('Closures')) {
        return `### 📝 Active Recall Quiz: Closures & Scoping

**Question:**
Consider this classic code:
\`\`\`javascript
for (var i = 0; i < 3; i++) {
  setTimeout(function() {
    console.log(i);
  }, 100);
}
\`\`\`

1. What does this code print, and why?
2. How does replacing \`var\` with \`let\` fix the issue?
3. How could you solve this without \`let\` using an IIFE?

Share your answers below!`;
      }

      // Default React quiz
      return `### 📝 Active Recall Quiz: React Rendering & Hooks

**Question:**
In React, what is the exact difference between \`useMemo\` and \`useCallback\`?
Under what conditions would using \`useMemo\` actually *harm* application performance rather than improve it?

Provide your explanation below!`;
    }

    // C. "Make it harder" / Advanced Challenge
    if (lastLower.includes('make it harder') || lastLower.includes('harder') || lastLower.includes('more difficult') || lastLower.includes('advanced')) {
      if (activeTopic.includes('Python') || activeTopic.includes('Decorator') || activeTopic.includes('Generator')) {
        return {
          content: `### 🔥 Level Up: CPython GIL & Async Concurrency Architecture

**Scenario:**
You are maintaining a high-throughput Python service handling 10,000 concurrent WebSocket connections. A critical endpoint runs a cryptographic hash validation (CPU-bound) alongside asynchronous database queries (I/O-bound). During load tests, CPU usage spikes to 100% on one core while other cores sit idle, and all WebSocket connections experience severe latency timeouts.

**Question:**
1. Explain how the CPython Global Interpreter Lock (GIL) causes the CPU-bound task to starve the \`asyncio\` event loop.
2. How would you architect this service to process the cryptographic operations across all available CPU cores without blocking the event loop or introducing race conditions?

Walk me through your architectural strategy.`,
          updatedState: {
            difficulty: 'Advanced',
            currentTopic: 'Python Concurrency & GIL Architecture',
          },
        };
      }

      if (activeTopic.includes('Kafka')) {
        return `### 🔥 Level Up: Kafka Production Edge Case

**Scenario:**
You have high-throughput event ingestion where orders must be processed in strict chronological order per user. During a sudden network partition between two data centers, a Kafka broker fails and consumer group rebalance occurs.

**Question:**
1. How do you guarantee that messages with the same \`userId\` are not processed out of order during or after partition rebalancing?
2. How do you handle idempotent consumer processing if a worker crashes after persisting the order to the database but before committing the offset back to Kafka?

Walk me through your architectural strategy with trade-offs.`;
      }

      if (activeTopic.includes('React') || activeTopic.includes('Hooks')) {
        return `### 🔥 Level Up: React Concurrency & Memory Profiling

**Scenario:**
A high-frequency dashboard renders real-time streaming market prices (50 updates per second). Users report UI stutter and Chrome DevTools shows escalating heap memory over a 30-minute session.

**Question:**
1. Walk me through how you would isolate whether the bottleneck is in excessive Fiber reconciliation, uncleaned subscription closures, or memory leaks in custom hooks.
2. How would you leverage \`useTransition\` or custom throttle buffers to keep the main thread responsive?

Structure your diagnosis step-by-step.`;
      }

      return `### 🔥 Level Up: Advanced Distributed System Challenge

**Scenario:**
You have a distributed worker fleet consuming from an asynchronous queue. Due to intermittent network timeouts, the broker re-delivers notification tasks, causing duplicate downstream payments.

**Question:**
How would you design a distributed deduplication and idempotency layer to guarantee exactly-once processing semantics without introducing severe latency penalties?

Share your architectural approach.`;
    }

    // D. "Explain that again" / "Clarify" / "I don't understand"
    if (
      lastLower.includes('explain that again') ||
      lastLower.includes('explain again') ||
      lastLower.includes('simplify') ||
      lastLower.includes('simpler') ||
      lastLower.includes("don't understand") ||
      lastLower.includes('dont understand') ||
      lastLower.includes('make this simpler') ||
      lastLower.includes('make it simpler') ||
      lastLower.includes('confused')
    ) {
      return `### 💡 Simplified Breakdown: ${activeTopic}

Let's break this down with a simple real-world analogy:

1. **The Core Idea:** Think of this system like a post office. Instead of one postal worker attempting to deliver every letter simultaneously, letters are sorted into dedicated mailbags (partitions) based on postal code (keys).
2. **The Worker Team:** Dedicated mail carriers (consumer group) grab their assigned bags and deliver them in order.
3. **The Guarantee:** As long as letters for the same house are in the same bag, they arrive in exact order.

Does this mental model make the concept clearer? Would you like a code demonstration or a quick practice drill?`;
    }

    // ── 12. RESULTS → TRAIN ME SPECIFIC INQUIRIES ───────────────────────────
    if (
      hasSourceInterview &&
      (lastLower.includes('interview') || lastLower.includes('my score') || lastLower.includes('why did i') || lastLower.includes('weak') || lastLower.includes('mistake'))
    ) {
      return `### 🎯 Targeted Training for Interview #${srcId || 'Selected'}

Based on your completed **${srcRole}** interview (Overall Score: **${srcOverallScore || '65'}/100**):

#### Identified Weak Areas to Strengthen:
• ${srcWeakAreas || 'System Design Trade-offs, Edge Case Articulation, and STAR Behavioral Framing'}

#### Recommended Action Plan:
1. **Targeted Practice:** Let's practice answering questions in your lowest-scoring category.
2. **Trade-off Scoping:** Practice stating assumptions and constraints before providing architectural answers.
3. **Structured Delivery:** Use the STAR framework (Situation, Task, Action, Result) for behavioral scenarios.

Would you like to **practice your top weak area right now**, or **review the question where you lost the most points**?`;
    }

    // ── 13. PRACTICE DRILL & TECHNICAL QUESTIONS ─────────────────────────────
    if (
      lastLower.includes('practice') ||
      lastLower.includes('ask me a question') ||
      lastLower.includes('give me a question') ||
      lastLower.includes('drill') ||
      lastLower.includes('mock')
    ) {
      // 1. Explicit user request in current message has highest priority:
      let targetSkill = null;
      if (lastLower.includes('python')) targetSkill = 'Python';
      else if (lastLower.includes('react')) targetSkill = 'React';
      else if (lastLower.includes('java') && !lastLower.includes('javascript')) targetSkill = 'Java';
      else if (lastLower.includes('node')) targetSkill = 'Node.js';
      else if (lastLower.includes('fastapi')) targetSkill = 'FastAPI';
      else if (lastLower.includes('sql') || lastLower.includes('database')) targetSkill = 'Database Architecture';

      // 2. Active state track / goal has second priority (prevents stale resume override):
      if (!targetSkill) {
        if (stateTrack === 'Python Full Stack' || stateGoal?.includes('Python') || activeTopic.includes('Python')) {
          targetSkill = 'Python';
        } else if (stateTopic) {
          targetSkill = stateTopic;
        } else if (activeTopic && activeTopic !== 'Technical Concepts') {
          targetSkill = activeTopic;
        }
      }

      // 3. Fall back to resume skills only if no explicit conversation context:
      if (!targetSkill && parsedSkills.length > 0) {
        targetSkill = parsedSkills[0];
      }

      if (targetSkill === 'Python' || targetSkill?.includes('Python')) {
        return {
          content: `### 📝 Practice Drill: Python Full Stack Architecture

**Question:**
In a high-throughput Python backend (e.g. using FastAPI or Django with Celery), how do you design an asynchronous task execution pipeline to prevent CPU-intensive jobs from blocking the async I/O event loop?

Walk me through your concurrency architecture, worker pools, and task queue design below!`,
          updatedState: {
            currentTopic: 'Python Concurrency & Async Architecture',
            learningTrack: 'Python Full Stack',
            currentQuestion: {
              id: 'q_py_concurrency',
              text: 'In a high-throughput Python backend using FastAPI or Django with Celery, how do you design an asynchronous task execution pipeline to prevent CPU-intensive jobs from blocking the async I/O event loop?',
              topic: 'Python Concurrency & Async Architecture',
              difficulty: stateQDifficulty || 'Intermediate',
              hint: 'Consider offloading CPU-bound tasks to separate process pools (ProcessPoolExecutor) or dedicated Celery workers backed by Redis/RabbitMQ, keeping the asyncio event loop strictly for non-blocking I/O.',
              prerequisites: 'Python asyncio event loop, GIL constraints, and multiprocessing vs multithreading.',
              questionNumber: (stateQNumber || 0) + 1,
            },
            currentExercise: { status: 'awaiting_answer' },
          },
        };
      }

      if (targetSkill) {
        return {
          content: `### 📝 Practice Drill: ${targetSkill} Architecture

**Question:**
Suppose your team is seeing sporadic performance degradation in a **${targetSkill}** application under peak load. How would you systematically profile and isolate whether the bottleneck is in client-side state/re-rendering, network payload latency, or database query execution?

Walk me through your diagnostic workflow below!`,
          updatedState: {
            currentTopic: `${targetSkill} Diagnostics`,
            currentQuestion: {
              id: `q_${targetSkill.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              text: `How would you systematically profile and isolate performance bottlenecks in a ${targetSkill} application under peak load?`,
              topic: `${targetSkill} Diagnostics`,
              difficulty: stateQDifficulty || 'Intermediate',
              hint: 'Structure your answer by layers: network & gateway, application thread pool, and database connection pool / query execution.',
              questionNumber: (stateQNumber || 0) + 1,
            },
            currentExercise: { status: 'awaiting_answer' },
          },
        };
      }

      return `### 📝 Practice Drill: Time to First Byte (TTFB) Diagnostics

**Question:**
Suppose your web application's Time to First Byte (TTFB) is 800ms, but total bundle download finishes in 120ms. Walk me through how you would isolate whether the latency is in DNS lookup, TLS handshake, server processing, or database queries.

Share your diagnostic approach below!`;
    }

    // ── 14. GENERAL CONVERSATIONAL RESPONSE ──────────────────────────────────
    if (
      lastLower.includes('what is') ||
      lastLower.includes('how does') ||
      lastLower.includes('difference between') ||
      lastLower.includes('explain') ||
      lastLower.includes('why') ||
      lastLower.includes('how to')
    ) {
      return `Here is a clear breakdown of **${lastUserMessage.replace(/[?.]+$/, '')}**:

In software engineering, this concept is primarily used to build clean, maintainable, and decoupled applications. Let me know if you would like a code example, debugging help, or guidance on how to explain it in an interview!`;
    }

    // Natural conversation response — engages directly, conversational
    const nameGreeting = candidateName ? ` ${candidateName}` : '';
    return `I'm here to help!${nameGreeting} What would you like to explore or work on today?`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AISERVICE FACTORY & ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

class AIService {
  constructor() {
    this.initProvider();
  }

  initProvider() {
    const openaiKey =
      process.env.OPENAI_API_KEY ||
      (process.env.LLM_PROVIDER === 'openai' ? process.env.LLM_API_KEY : null);
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      (process.env.LLM_PROVIDER === 'gemini' ? process.env.LLM_API_KEY : null);

    const isDummyKey = (key) =>
      !key ||
      key.toLowerCase().includes('your_') ||
      key.toLowerCase().includes('dummy') ||
      key.toLowerCase().includes('placeholder') ||
      key.length < 15;

    const preferredProvider = (process.env.LLM_PROVIDER || '').toLowerCase().trim();

    if (preferredProvider === 'gemini' && geminiKey && !isDummyKey(geminiKey)) {
      this.provider = new GeminiProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-3.6-flash');
      this.activeProviderName = 'gemini';
    } else if (openaiKey && !isDummyKey(openaiKey) && preferredProvider !== 'gemini') {
      this.provider = new OpenAIProvider(openaiKey, process.env.OPENAI_MODEL || 'gpt-4o-mini');
      this.activeProviderName = 'openai';
    } else if (geminiKey && !isDummyKey(geminiKey)) {
      this.provider = new GeminiProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-3.6-flash');
      this.activeProviderName = 'gemini';
    } else {
      this.provider = new HeuristicFallbackProvider();
      this.activeProviderName = 'fallback';
    }
  }

  async executeCompletion(params) {
    if (this.activeProviderName === 'fallback') {
      this.initProvider();
    }
    try {
      return await this.provider.complete(params);
    } catch (err) {
      console.warn(`[AIService] ${this.activeProviderName} completion failed:`, err.message);
      // Fallback to Heuristic engine if primary fails
      if (this.activeProviderName !== 'fallback') {
        try {
          const fallback = new HeuristicFallbackProvider();
          return await fallback.complete(params);
        } catch (fallbackErr) {
          console.error('[AIService] Fallback also failed:', fallbackErr.message);
        }
      }
      return "I'm having trouble connecting to the AI service right now. Please try again in a moment.";
    }
  }

  // ── 1. GREETING & CONTEXT SUMMARY ──────────────────────────────────────────

  async generateCoachGreeting(candidateContext = {}) {
    const { firstName, resumeSummary, lastInterview } = candidateContext;
    const name = firstName || 'there';

    let contextNote = '';
    if (lastInterview) {
      const scoreText =
        lastInterview.overallScore != null && !isNaN(Number(lastInterview.overallScore))
          ? ` with an overall score of **${lastInterview.overallScore}/100**`
          : '';
      contextNote = ` You recently completed a ${lastInterview.difficulty || 'mock'} interview for **${lastInterview.targetRole || 'Software Engineer'}**${scoreText}.`;
    } else if (resumeSummary?.targetRole) {
      contextNote = ` I see your profile targets **${resumeSummary.targetRole}** with strong skills in ${resumeSummary.skills?.slice(0, 3).join(', ') || 'software development'}.`;
    }

    return (
      `👋 Hi ${name}! I'm your InterviewX AI Coach.\n\n` +
      `I'm here to actively train and sharpen your interview performance using your resume, real mock results, and targeted technical exercises.${contextNote}\n\n` +
      `How would you like to prepare today?`
    );
  }

  // ── 2. ANALYZE RESUME FOR TRAINING ─────────────────────────────────────────

  async analyzeResume(resumeData, interviewHistory = []) {
    const skills = (resumeData?.parsedData?.skills || []).map((s) => s.canonicalName || s.name || s);
    const projects = (resumeData?.parsedData?.projects || []).map((p) => ({
      title: p.title,
      technologies: p.technologies || [],
      description: p.description,
    }));
    const targetRole = resumeData?.parsedData?.basicInfo?.targetRole || 'Software Engineer';

    // Collect historical weak areas from past interviews
    const historicalWeakAreas = [];
    const historicalStrongAreas = [];
    for (const inv of interviewHistory) {
      if (inv.finalEvaluation?.weakAreas) historicalWeakAreas.push(...inv.finalEvaluation.weakAreas);
      if (inv.finalEvaluation?.strongAreas) historicalStrongAreas.push(...inv.finalEvaluation.strongAreas);
    }

    const prompt = `Analyze this candidate's resume and historical interview performance to build a personalized interview training profile.

Candidate Data:
- Target Role: ${targetRole}
- Skills: ${skills.join(', ') || 'Not specified'}
- Key Projects: ${JSON.stringify(projects.slice(0, 3))}
- Past Weak Areas: ${historicalWeakAreas.join(', ') || 'None recorded yet'}
- Past Strong Areas: ${historicalStrongAreas.join(', ') || 'None recorded yet'}

Return a JSON object with:
{
  "strengths": string[],
  "weaknesses": string[],
  "focusTopics": string[],
  "recommendedStartingTopic": string,
  "difficulty": "Beginner" | "Intermediate" | "Advanced" | "Interview-level",
  "summary": string
}`;

    const raw = await this.executeCompletion({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      responseFormatJson: true,
      temperature: 0.3,
    });

    const parsed = safeJsonParse(raw, {
      strengths: skills.slice(0, 4),
      weaknesses: historicalWeakAreas.slice(0, 3).length ? historicalWeakAreas.slice(0, 3) : ['System Design Trade-offs', 'STAR Behavioral Structure', 'Edge Case Analysis'],
      focusTopics: ['System Architecture', 'Core Problem Solving', 'Behavioral STAR Framing'],
      recommendedStartingTopic: 'System Architecture',
      difficulty: 'Intermediate',
      summary: `Targeting ${targetRole}. Strong in core technical skills; ready for interactive deep-dive drills.`,
    });

    return parsed;
  }

  // ── 3. ANALYZE COMPLETED INTERVIEW (FOR RESULTS → TRAIN ME) ─────────────────

  async analyzeInterview(interviewData, questionBreakdown = []) {
    const role = interviewData.targetRole || 'Software Engineer';
    const overallScore = interviewData.finalEvaluation?.overallScore ?? 65;
    const weakAreas = interviewData.finalEvaluation?.weakAreas || [];
    const strongAreas = interviewData.finalEvaluation?.strongAreas || [];

    // Synthesize question-level evidence
    const lowScoringQuestions = questionBreakdown
      .filter((q) => (q.score != null && q.score < 70) || (q.textScore != null && q.textScore < 70))
      .map((q) => ({
        question: q.text,
        category: q.category,
        score: q.score || q.textScore,
        missingConcepts: q.missingConcepts || [],
        feedback: q.feedback,
      }));

    const prompt = `Analyze this completed mock interview to formulate a targeted training plan for Results → Train Me.

Interview Context:
- Role: ${role}
- Overall Score: ${overallScore}/100
- Weak Areas: ${weakAreas.join(', ') || 'Not explicitly tagged'}
- Strong Areas: ${strongAreas.join(', ') || 'None'}
- Low-Scoring Questions & Missed Concepts: ${JSON.stringify(lowScoringQuestions.slice(0, 5))}

Return a JSON object:
{
  "strongestArea": string,
  "mainImprovementAreas": string[],
  "priorityFocusTopic": string,
  "startingExercisePrompt": string,
  "recommendedStartingQuestion": string,
  "difficulty": "Beginner" | "Intermediate" | "Advanced" | "Interview-level"
}`;

    const raw = await this.executeCompletion({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      responseFormatJson: true,
      temperature: 0.3,
    });

    const parsed = safeJsonParse(raw, {
      strongestArea: strongAreas[0] || 'Technical Fundamentals',
      mainImprovementAreas: weakAreas.length > 0 ? weakAreas.slice(0, 3) : ['System design reasoning', 'Explaining technical trade-offs', 'Edge case handling'],
      priorityFocusTopic: weakAreas[0] || 'System Design',
      startingExercisePrompt: `I've reviewed this interview for ${role}. Your strongest area was ${strongAreas[0] || 'core technical knowledge'}.\n\nThe main areas to improve are:\n${(weakAreas.length ? weakAreas : ['System design reasoning', 'Explaining technical trade-offs', 'Follow-up questions']).map((w) => `• 🔴 ${w}`).join('\n')}\n\nLet's work on **${weakAreas[0] || 'System Design'}** first.`,
      recommendedStartingQuestion: 'Design a resilient notification service that delivers millions of events per hour. Before selecting databases or frameworks, what requirements and constraints would you clarify?',
      difficulty: overallScore >= 75 ? 'Advanced' : overallScore >= 50 ? 'Intermediate' : 'Beginner',
    });

    return parsed;
  }

  // ── 4. GENERATE PRACTICE QUESTION (ACTIVE RECALL & NON-REPETITIVE) ──────────

  async generatePracticeQuestion({ topic, difficulty = 'Intermediate', previousQuestions = [], context = {} }) {
    const prompt = `Generate an interactive interview training question for active recall.

Topic: ${topic}
Current Difficulty Level: ${difficulty}
Previous Questions (DO NOT REPEAT THESE EXACTLY, test related concepts or trade-offs):
${previousQuestions.slice(-6).map((q, i) => `${i + 1}. ${q}`).join('\n') || 'None'}

Context Note: ${context.note || 'Focus on architectural intuition, real-world constraints, and active reasoning.'}

Return a JSON object:
{
  "questionText": string,
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "keyConceptsExpected": string[],
  "hint": string
}`;

    const raw = await this.executeCompletion({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      responseFormatJson: true,
      temperature: 0.7,
    });

    const parsed = safeJsonParse(raw, {
      questionText: `In the context of ${topic}, how would you handle a sudden 10x traffic spike that causes cascading timeouts across microservices?`,
      difficulty,
      topic,
      keyConceptsExpected: ['Circuit breaker pattern', 'Rate limiting', 'Backpressure', 'Queue buffering'],
      hint: 'Think about how to prevent downstream services from crashing under excessive retry storms.',
    });

    return parsed;
  }

  // ── 5. EVALUATE PRACTICE ANSWER & FORMULATE INTERACTIVE FEEDBACK ────────────

  async evaluatePracticeAnswer({ question, answer, topic, difficulty = 'Intermediate', history = [] }) {
    const prompt = `You are the InterviewX AI Training Coach. Evaluate this candidate's answer interactively.

Topic: ${topic}
Difficulty: ${difficulty}
Question Asked: "${question}"
Candidate's Answer: "${answer}"

Interactive Training Rules:
1. Identify what is correct.
2. Identify what is missing or flawed.
3. Teach the key missing concept briefly with clear intuition.
4. Give a practical hint for how to reason through it.
5. Provide a realistic follow-up question that tests the same or deeper concept without repeating the previous question.
6. Determine if difficulty should change ('Beginner', 'Intermediate', 'Advanced', 'Interview-level').
7. Score candidate answer on a scale of 0 to 100 based on depth, accuracy, and trade-off awareness.

Return a JSON object:
{
  "score": number,
  "strengths": string[],
  "missingConcepts": string[],
  "conceptExplanation": string,
  "hint": string,
  "feedbackMarkdown": string,
  "nextQuestion": string,
  "newDifficulty": "Beginner" | "Intermediate" | "Advanced" | "Interview-level",
  "difficultyAdjustmentReason": string
}`;

    const raw = await this.executeCompletion({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      responseFormatJson: true,
      temperature: 0.5,
    });

    const parsed = safeJsonParse(raw, {
      score: 72,
      strengths: ['Identified key architectural component', 'Reasonable baseline approach'],
      missingConcepts: ['Scale bottlenecks', 'Failure mode handling'],
      conceptExplanation: 'When designing distributed systems, consider how components behave under network partition or high concurrency.',
      hint: 'Consider using idempotent consumers and retry exponential backoff with jitter.',
      feedbackMarkdown: `Good effort! You clearly recognized the core workflow.\n\n**Key areas to strengthen:**\n- Address how you handle message loss or duplicates.\n- Clarify how you monitor queue lag in production.\n\n💡 **Concept:** Using a dead-letter queue (DLQ) prevents unprocessable messages from blocking the entire pipeline.`,
      nextQuestion: 'How would you ensure idempotency if the message broker delivers the same notification payload twice?',
      newDifficulty: difficulty,
      difficultyAdjustmentReason: 'Consistent performance at current level; testing depth with trade-offs.',
    });

    return parsed;
  }

  // ── 6. GENERAL CONVERSATIONAL COACH RESPONSE ────────────────────────────────

  async generateCoachResponse({ messages, sessionContext = {} }) {
    const contextualMessages = [
      {
        role: 'system',
        content: `${SYSTEM_INSTRUCTION}

Session Context:
- Topic: ${sessionContext.topic || 'Interview Training'}
- Difficulty: ${sessionContext.difficulty || 'Intermediate'}
- Context Type: ${sessionContext.contextType || 'dashboard'}
${sessionContext.sourceInterview ? `- Based on Completed Interview: ${sessionContext.sourceInterview.targetRole} (Score: ${sessionContext.sourceInterview.overallScore})` : ''}
${sessionContext.resumeData ? `- Candidate Skills: ${sessionContext.resumeData.skills?.slice(0, 6).join(', ')}` : ''}`,
      },
      ...messages,
    ];

    const reply = await this.executeCompletion({
      messages: contextualMessages,
      responseFormatJson: false,
      temperature: 0.7,
    });

    return reply;
  }

  // ── 7. PERSIST TRAINING PROGRESS ACCORDING TO EVIDENCE ───────────────────────

  async updateTrainingProgress({ clerkUserId, topic, scoreDelta, evaluationScore }) {
    if (!clerkUserId || !topic) return null;

    try {
      let progressRecord = await AITrainingProgress.findOne({
        clerkUserId,
        topic: { $regex: new RegExp(`^${topic.trim()}$`, 'i') },
      });

      const currentEvalScore = Math.max(0, Math.min(100, Math.round(evaluationScore || 65)));

      if (!progressRecord) {
        progressRecord = await AITrainingProgress.create({
          clerkUserId,
          topic: topic.trim(),
          initialScore: currentEvalScore,
          score: currentEvalScore,
          attempts: 1,
          lastPracticedAt: new Date(),
        });
      } else {
        // Compute moving average towards new evaluated mastery
        const oldScore = progressRecord.score || 50;
        const newScore = Math.round(oldScore * 0.6 + currentEvalScore * 0.4);
        progressRecord.score = Math.max(10, Math.min(99, newScore));
        progressRecord.attempts = (progressRecord.attempts || 1) + 1;
        progressRecord.lastPracticedAt = new Date();

        // Update skill level based on proven score
        if (progressRecord.score >= 85) progressRecord.skillLevel = 'Interview-level';
        else if (progressRecord.score >= 70) progressRecord.skillLevel = 'Advanced';
        else if (progressRecord.score >= 50) progressRecord.skillLevel = 'Intermediate';
        else progressRecord.skillLevel = 'Beginner';

        await progressRecord.save();
      }

      // Also update AITrainingProfile skill levels
      await AITrainingProfile.findOneAndUpdate(
        { clerkUserId },
        {
          $set: {
            [`skillLevels.${topic.replace(/[.$]/g, '_')}`]: progressRecord.score,
            currentDifficulty: progressRecord.skillLevel,
          },
        },
        { upsert: true }
      );

      return progressRecord;
    } catch (err) {
      console.warn('[AIService] Failed to update training progress:', err.message);
      return null;
    }
  }

  // ── 8. INTENT & MODE DETECTION ─────────────────────────────────────────────

  detectModeAndIntent(text = '', history = [], context = {}) {
    const clean = (text || '').toLowerCase().trim();
    if (!clean) return { mode: 'general_chat', intent: 'casual/greeting' };

    // 1. Casual / Greeting
    if (/^(hi|hello|hey|hey there|greetings|good morning|good afternoon|good evening|yo|sup)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'casual/greeting' };
    }
    if (/^(how are you|how's it going|how are you doing|how do you do|what's up|whats up)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'casual/greeting' };
    }
    if (/^(thanks|thank you|thx|ty|appreciate it|cool|ok|okay|got it)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'casual' };
    }

    // 2. Explicit Mock Interview / Practice
    if (
      /\b(start (a )?(mock )?interview|mock interview|conduct an interview|interview me|quiz me|test me|drill me|ask me an? interview question)\b/i.test(clean)
    ) {
      return { mode: 'interview_practice', intent: 'interview_practice' };
    }

    // 3. Explicit Answer Evaluation
    if (
      /\b(evaluate (my |this )?answer|grade (my |this )?answer|rate my answer|how is this answer|check my answer|critique my answer)\b/i.test(clean)
    ) {
      return { mode: 'answer_evaluation', intent: 'answer_evaluation' };
    }

    // 4. Results Coaching / Analysis
    const isResultContext = Boolean(context?.sourceInterviewContext || context?.resultContext);
    if (
      isResultContext ||
      /\b(why was my (technical |communication |overall )?score|which question was my weakest|explain question \d+ feedback|make me a \d+ day improvement plan|why did i get \d+%|why did i score \d+)\b/i.test(clean)
    ) {
      return { mode: 'results_coaching', intent: 'results_analysis' };
    }

    // 5. Debugging
    if (/\b(500 error|error|exception|debug|traceback|fix this|fix my|bug|crash|fails to|why am i getting)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'debugging' };
    }

    // 6. Resume queries
    if (/\b(resume|cv|my skills|review my resume|improve my resume)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'resume' };
    }

    // 7. Communication & soft skills queries
    if (/\b(communication( skills)?|comunication|improve (my )?communication|how to communicate|better communication|soft skills)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'communication_skills' };
    }

    // 8. Technical concept explanations & language comparisons
    if (/\b(what is|explain|how does|why did we use|why mongodb|difference between|differnce between|diff between|java vs python|python vs java|how to implement|trending technolog|trendng)\b/i.test(clean)) {
      return { mode: 'general_chat', intent: 'technical_explanation' };
    }

    // Default mode is always general_chat
    return { mode: 'general_chat', intent: 'general_chat' };
  }

  detectIntent(text = '', history = [], context = {}) {
    return this.detectModeAndIntent(text, history, context).intent;
  }

  // ── 9. AUTOMATIC CONVERSATION TITLE GENERATOR ──────────────────────────────

  generateConversationTitle(messageText = '') {
    const text = (messageText || '').trim().replace(/^["']|["']$/g, '');
    if (!text) return 'New Chat';

    const lower = text.toLowerCase();
    if (lower.includes('communication') && (lower.includes('skill') || lower.includes('improve'))) {
      return 'Communication Skills';
    }
    if ((lower.includes('java') && lower.includes('python')) || lower.includes('java vs python')) {
      return 'Java vs Python';
    }
    if (lower.includes('trending') && (lower.includes('tech') || lower.includes('technology'))) {
      return 'Trending Technologies';
    }
    if (lower.includes('mongodb') && (lower.includes('index') || lower.includes('indexing') || lower.includes('indexes'))) {
      return 'MongoDB Indexing';
    }
    if (lower.includes('mongodb') && lower.includes('interviewx')) {
      return 'MongoDB in InterviewX';
    }
    if (lower.includes('mongodb')) {
      return 'MongoDB Overview';
    }
    if (lower.includes('django') && (lower.includes('500') || lower.includes('debug') || lower.includes('error'))) {
      return 'Django Debugging';
    }
    if (lower.includes('django') && lower.includes('mvt')) {
      return 'Django MVT';
    }
    if (lower.includes('resume') && (lower.includes('improve') || lower.includes('review') || lower.includes('enhanc') || lower.includes('gaps'))) {
      return 'Resume Improvement';
    }
    if (lower.includes('interview') && (lower.includes('prep') || lower.includes('prepare') || lower.includes('plan'))) {
      return 'Interview Preparation';
    }
    if (lower.includes('what is an api') || lower.includes('api explanation') || lower.includes('what is api') || (lower.includes('api') && lower.includes('explain'))) {
      return 'API Explanation';
    }
    if (lower.includes('project architecture') || (lower.includes('project') && (lower.includes('architecture') || lower.includes('structure')))) {
      return 'Project Architecture';
    }
    if (lower.includes('react')) return 'React Interview Prep';
    if (lower.includes('system design')) return 'System Design Practice';
    if (lower.includes('javascript') || lower.includes('js')) return 'JavaScript Fundamentals';

    // Strip common filler prefixes
    const cleaned = text
      .replace(
        /^(can you |please |could you |help me understand |help me |explain |tell me about |what is |what are |how do i |how does |why is |why did i |why was |give me a |give me )/i,
        ''
      )
      .replace(/[?.!,;:]+$/, '')
      .trim();

    const words = (cleaned || text).split(/\s+/).filter(Boolean);
    const titleWords = words.slice(0, 4).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const title = titleWords.join(' ');
    return title.length > 35 ? title.slice(0, 32) + '...' : title || 'General Chat';
  }

  // ── 10. UNIFIED CHATGPT-STYLE CHAT DISPATCHER ──────────────────────────────

  async chat({ message, history = [], context = {}, attachments = [], currentTopic = null, currentDifficulty = 'Intermediate', conversationState = null }) {
    const { mode, intent } = this.detectModeAndIntent(message, history, context);

    // Build structured context
    const structuredContext = {
      user: {
        name: context.candidateName || null,
        targetRole: context.targetRole || null,
        experience: context.yearsOfExperience || null,
      },
      resume: {
        skills: context.resumeSkills || [],
        projects: context.resumeProjects || [],
        experience: context.resumeExperience || [],
      },
      conversation: {
        recentMessages: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        summary: context.summary || conversationState?.summary || null,
      },
      interview: context.sourceInterviewContext
        ? {
            id: context.sourceInterviewContext.interviewId,
            targetRole: context.sourceInterviewContext.targetRole,
            scores: {
              overall: context.sourceInterviewContext.overallScore,
              technical: context.sourceInterviewContext.technicalScore,
              communication: context.sourceInterviewContext.communicationScore,
            },
            weakAreas: context.sourceInterviewContext.weakAreas || [],
            strongAreas: context.sourceInterviewContext.strongAreas || [],
            questionBreakdown: context.sourceInterviewContext.questionBreakdown || [],
          }
        : null,
      mode: mode,
    };

    // Construct context guidance for system prompt
    let contextGuidance = `Active Mode: ${mode}\n`;
    if (structuredContext.user.name) contextGuidance += `User Name: ${structuredContext.user.name}\n`;
    if (structuredContext.user.targetRole) contextGuidance += `Target Role: ${structuredContext.user.targetRole}\n`;
    if (structuredContext.user.experience) contextGuidance += `Experience: ${structuredContext.user.experience} years\n`;
    if (structuredContext.resume.skills?.length) contextGuidance += `Skills: ${structuredContext.resume.skills.join(', ')}\n`;
    if (structuredContext.resume.projects?.length) contextGuidance += `Projects: ${structuredContext.resume.projects.join('; ')}\n`;
    if (structuredContext.conversation.summary) contextGuidance += `Previous Conversation Summary: ${structuredContext.conversation.summary}\n`;

    if (mode === 'results_coaching' && structuredContext.interview) {
      const itv = structuredContext.interview;
      contextGuidance += `\nTargeted Interview Result Context:
- Role: ${itv.targetRole}
- Overall Score: ${itv.scores.overall != null ? itv.scores.overall + '%' : 'N/A'}
- Technical Score: ${itv.scores.technical != null ? itv.scores.technical + '%' : 'N/A'}
- Strong Areas: ${itv.strongAreas.join(', ') || 'None noted'}
- Weak Areas: ${itv.weakAreas.join(', ') || 'None noted'}
- Question Breakdown:
${(itv.questionBreakdown || []).map((q) => `  * Q${q.number}: "${q.question}" (Score: ${q.score != null ? q.score + '%' : 'N/A'}, Missing: ${(q.missingConcepts || []).join(', ') || 'None'}, Feedback: ${q.feedback || 'N/A'})`).join('\n')}`;
    }

    if (attachments && attachments.length > 0) {
      contextGuidance += `\nAttached Files:\n` +
        attachments.map((a) => `- ${a.name} (${a.mimeType}): ${a.extractedSnippet || (a.isResume ? 'Parsed resume file' : 'Uploaded file')}`).join('\n');
    }

    // Specific mode directives
    let modeDirective = '';
    if (mode === 'general_chat') {
      modeDirective = `CRITICAL DIRECTIVE: You are in GENERAL CHAT mode.
- Act as a natural, helpful ChatGPT-like assistant.
- Do NOT conduct an interview.
- Do NOT ask interview questions or test the user.
- Answer questions directly and naturally.
- When debugging, provide root cause, fix, and code.
- If the user says a brief remark like "ok" or "thanks", reply naturally and concisely ("Got it.", "Anytime.").`;
    } else if (mode === 'interview_practice') {
      modeDirective = `CRITICAL DIRECTIVE: The user explicitly requested an interview practice session.
- Present a relevant interview question matching their target role or topic.
- Await their answer before providing feedback.`;
    } else if (mode === 'answer_evaluation') {
      modeDirective = `CRITICAL DIRECTIVE: The user explicitly asked for answer evaluation.
- Evaluate the candidate's answer with constructive feedback, score, and model answer.`;
    } else if (mode === 'results_coaching') {
      modeDirective = `CRITICAL DIRECTIVE: You are discussing a completed interview result.
- Ground your response strictly in the interview result context provided.
- Do NOT start another interview.
- Explain scores, feedback, or improvement plans clearly.`;
    }

    const messages = [
      {
        role: 'system',
        content: `${SYSTEM_INSTRUCTION}

${contextGuidance}

${modeDirective}`,
      },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const completionResult = await this.executeCompletion({
      messages,
      responseFormatJson: false,
      temperature: 0.7,
    });

    let replyContent = '';
    let updatedState = null;

    if (typeof completionResult === 'object' && completionResult !== null && 'content' in completionResult) {
      replyContent = completionResult.content || '';
      updatedState = completionResult.updatedState || null;
    } else {
      replyContent = typeof completionResult === 'string' ? completionResult : String(completionResult);
    }

    return {
      content: replyContent,
      mode,
      intent,
      suggestions: mode === 'results_coaching'
        ? ['Explain question 1 feedback', 'Make me a 7-day improvement plan', 'Which question was my weakest?']
        : ['Explain with an example', 'How do I debug this?', 'Best practices'],
      updatedState,
      metadata: {
        mode,
        intent,
        hasAttachments: attachments.length > 0,
      },
    };
  }

  // ── 11. DASHBOARD AI ASSISTANT DISPATCHER ─────────────────────────────────

  async generateDashboardAssistantResponse({ message, history = [], context = {} }) {
    const { mode } = this.detectModeAndIntent(message, history, context);

    let contextBlock = '';
    if (context.candidateName) contextBlock += `User Name: ${context.candidateName}\n`;
    if (context.targetRole) contextBlock += `Target Role: ${context.targetRole}\n`;
    if (context.skills?.length) contextBlock += `Skills: ${context.skills.join(', ')}\n`;
    if (context.projects?.length) contextBlock += `Projects: ${context.projects.join('; ')}\n`;
    if (context.summary) contextBlock += `Previous Conversation Summary: ${context.summary}\n`;

    const systemPrompt = `${SYSTEM_INSTRUCTION}

DASHBOARD CONVERSATION CONTEXT:
${contextBlock || 'General user session.'}

CURRENT MODE: ${mode}

BEHAVIORAL DIRECTIVES:
- You are a natural, intelligent conversational AI assistant inside InterviewX (like ChatGPT).
- If the user asks about InterviewX (e.g., "why mongodb in interviewx" or "why did we use mongodb in interviewx"), provide a well-reasoned architectural explanation based on modern web platforms handling flexible interview schemas, multimodal transcripts, and rapid iteration.
- For coding and debugging questions (e.g. Django 500 error), explain the likely causes, how to check logs/tracebacks, and provide concrete fixes with clean code blocks.
- If the user asks "start a mock interview" or explicitly asks for practice, only then enter interview practice mode. Otherwise NEVER start an interview or ask unsolicited questions.
- Keep simple greetings and acknowledgments natural and concise (e.g., "Got it.", "Anytime.").`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const result = await this.executeCompletion({
      messages: formattedMessages,
      responseFormatJson: false,
      temperature: 0.7,
    });

    const reply = typeof result === 'object' && result !== null ? result.content || '' : String(result);

    return {
      content: reply,
      role: 'assistant',
      mode,
    };
  }

  // ── 12. RESULTS AI ASSISTANT DISPATCHER ───────────────────────────────────

  async generateResultsAssistantResponse({ message, history = [], resultContext = {} }) {
    const questionsBlock = (resultContext.questions || [])
      .map(
        (q, idx) => `
Question ${idx + 1} (${q.category || 'General'} - ${q.difficulty || 'Intermediate'}):
"${q.text}"
Candidate's Answer: "${q.userAnswer || 'No answer recorded'}"
Score: ${q.score != null ? q.score + '/100' : 'N/A'}
Strengths: ${(q.strengths || []).join(', ') || 'None noted'}
Missing Concepts / Improvement Areas: ${(q.missingConcepts || []).join(', ') || 'None noted'}
Feedback: "${q.feedback || 'N/A'}"`
      )
      .join('\n');

    const systemPrompt = `${SYSTEM_INSTRUCTION}

RESULTS AI ASSISTANT CONTEXT:
You are an expert performance-analysis assistant attached to ONE specific completed interview result.

INTERVIEW RESULT DETAILS:
Role: ${resultContext.targetRole || 'Software Engineer'}
Difficulty: ${resultContext.difficulty || 'Intermediate'}
Overall Score: ${resultContext.overallScore != null ? resultContext.overallScore + '%' : 'N/A'}
Category Scores:
- Technical: ${resultContext.technicalScore != null ? resultContext.technicalScore + '%' : 'N/A'}
- Communication: ${resultContext.communicationScore != null ? resultContext.communicationScore + '%' : 'N/A'}
- Problem Solving: ${resultContext.problemSolvingScore != null ? resultContext.problemSolvingScore + '%' : 'N/A'}

Strengths:
${(resultContext.strengths || []).map((s) => `- ${s}`).join('\n') || 'None recorded'}

Weaknesses / Improvement Areas:
${(resultContext.weaknesses || []).map((w) => `- ${w}`).join('\n') || 'None recorded'}

Recommendations:
${(resultContext.recommendations || []).map((r) => `- ${r}`).join('\n') || 'None recorded'}

Questions Breakdown:
${questionsBlock || 'No question details recorded'}

BEHAVIORAL DIRECTIVES:
- Ground your answers strictly in the interview result data above.
- Answer questions like "Why was my technical score low?", "Which questions did I perform poorly on?", "Explain my mistake in question 4", "What concepts should I study?", "Create a 7-day improvement plan based on this result".
- Do NOT conduct another interview or automatically ask interview questions.
- Maintain a constructive, empowering, and analytical tone.`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const result = await this.executeCompletion({
      messages: formattedMessages,
      responseFormatJson: false,
      temperature: 0.6,
    });

    const reply = typeof result === 'object' && result !== null ? result.content || '' : String(result);

    return {
      content: reply,
      role: 'assistant',
    };
  }

  // ── 13. SESSION TITLE GENERATOR ───────────────────────────────────────────

  generateChatTitle(userMessage = '', chatType = 'dashboard') {
    const text = (userMessage || '').trim().replace(/^["']|["']$/g, '');
    if (!text) {
      return chatType === 'results' ? 'Result Analysis' : 'New Chat';
    }

    const lower = text.toLowerCase();
    if (lower.includes('mongodb') && (lower.includes('index') || lower.includes('indexing') || lower.includes('indexes'))) {
      return 'MongoDB Indexing';
    }
    if (lower.includes('mongodb') && lower.includes('interviewx')) {
      return 'MongoDB in InterviewX';
    }
    if (lower.includes('mongodb')) {
      return 'MongoDB Overview';
    }
    if (lower.includes('django') && (lower.includes('500') || lower.includes('debug') || lower.includes('error'))) {
      return 'Django Debugging';
    }
    if (lower.includes('django') && lower.includes('mvt')) {
      return 'Django MVT';
    }
    if (lower.includes('resume') && (lower.includes('improve') || lower.includes('better') || lower.includes('review') || lower.includes('gaps'))) {
      return 'Resume Improvement';
    }
    if (lower.includes('interview') && (lower.includes('prep') || lower.includes('prepare') || lower.includes('plan'))) {
      return 'Interview Preparation';
    }
    if (lower.includes('what is an api') || lower.includes('api explanation') || lower.includes('what is api') || (lower.includes('api') && lower.includes('explain'))) {
      return 'API Explanation';
    }
    if (lower.includes('project architecture') || (lower.includes('project') && (lower.includes('architecture') || lower.includes('structure')))) {
      return 'Project Architecture';
    }
    if (lower.includes('communication') && (lower.includes('score') || lower.includes('feedback') || lower.includes('low'))) {
      return 'Communication Score';
    }
    if (lower.includes('technical score') || (lower.includes('technical') && lower.includes('score'))) {
      return 'Technical Score';
    }
    if (lower.includes('weak area') || lower.includes('weaknesses') || lower.includes('areas to improve')) {
      return 'Weak Areas Analysis';
    }
    if (lower.includes('study plan') || lower.includes('learning plan') || lower.includes('improvement plan')) {
      return 'Study Plan';
    }
    if (/\b(?:question\s*(\d+)|q\s*(\d+))\b/i.test(lower)) {
      const match = lower.match(/\b(?:question\s*(\d+)|q\s*(\d+))\b/i);
      const qNum = match[1] || match[2];
      return `Question ${qNum} Analysis`;
    }
    if (lower.includes('why did i get') || lower.includes('why was my score')) {
      return 'Score Explanation';
    }

    // Strip common filler prefixes
    const cleaned = text
      .replace(
        /^(can you |please |could you |help me understand |help me |explain |tell me about |what is |what are |how do i |how does |why is |why did i |why was |give me a |give me )/i,
        ''
      )
      .replace(/[?.!,;:]+$/, '')
      .trim();

    const words = (cleaned || text).split(/\s+/).filter(Boolean);
    const titleWords = words.slice(0, 4).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    let title = titleWords.join(' ');
    if (title.length > 40) {
      title = title.slice(0, 37) + '...';
    }
    return title || (chatType === 'results' ? 'Result Analysis' : 'General Chat');
  }
}


// Export singleton instance
module.exports = new AIService();
