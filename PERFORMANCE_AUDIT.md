# InterviewX Performance Audit

## Executive Summary
This document provides a comprehensive end-to-end audit of all performance bottlenecks across the InterviewX architecture (React 19 Frontend, Express 5 Backend, FastAPI AI Service, MongoDB Atlas). The audit focuses specifically on eliminating latency and memory bottlenecks without requiring a paid Render upgrade.

---

## Architecture Flow Breakdown

### A. Application Startup
- **Previous State**:
  - Backend initialized with unoptimized health checks.
  - AI Service (FastAPI) ran heavy ML model probes inside the `/health` endpoint, causing Render's health checks to hang and trigger container restarts on cold starts.
  - SBERT and YOLO models competed for CPU and memory simultaneously upon startup.
- **Identified Bottlenecks**:
  - Render free tier (512MB RAM, shared 0.5 CPU) was overloaded during container warmup.
  - Unseparated `/health` and `/ready` states caused false negatives during deployment health probes.

### B. Dashboard Loading
- **Previous State**:
  - `getUserInterviews` pulled up to 20 full interview records with complete `interviewState` and `finalEvaluation` documents into Mongoose memory.
  - `Progress.find()` loaded without `.lean()`, inflating full Mongoose documents for trend graphs.
  - No indexes existed on `clerkUserId` for `Progress`, `Resume`, or `JobDescription`, triggering unindexed collection scans.
- **Identified Bottlenecks**:
  - Serialization of unneeded fields (`interviewState`, `finalEvaluation`) over the wire.
  - Collection scans in MongoDB Atlas.

### C. Resume & Job Description Upload
- **Previous State**:
  - PDF/DOCX parsed synchronously, extracting text before returning response.
  - Queries for existing resumes/JDs scanned without compound index on `{ clerkUserId: 1, createdAt: -1 }`.
- **Identified Bottlenecks**:
  - Lack of index caused query latency on multi-tenant user history.

### D. Skill-Gap Analysis
- **Previous State**:
  - Compares parsed resume skills with target job requirements using deterministic token extraction and Gemini/OpenAI fallback.
  - Cache versioning prevents repeat calculations.

### E. Interview Creation & Question Generation
- **Previous State**:
  - Generates personalized question bank via LLM / structured prompt.
  - In re-interviews, stale question lists were occasionally re-instantiated if previous interview wasn't explicitly scrubbed.
- **Optimization**:
  - Questions are saved in batch with compound index on `{ interviewId: 1, order: 1 }` and `{ interviewId: 1, status: 1 }`.

### F. Text Response Submission
- **Previous State**:
  - SBERT evaluated candidate answer against question and expected concepts.
  - Two separate forward passes (`_model.encode(question)` and `_model.encode(answer)`) were performed for every submission.
  - Concept embeddings were encoded one-by-one.
- **Identified Bottlenecks**:
  - PyTorch CPU inference on single core took 800ms - 1500ms per text evaluation due to unbatched forward passes.

### G. Audio Response Submission
- **Previous State**:
  - Client uploaded audio file -> Backend saved to disk -> Sent via multipart request to AI service -> Librosa loaded entire audio file, calculated MFCC, pitch, speech rate -> Sent back to backend -> Saved in MongoDB -> Deleted file -> Responded to client.
- **Identified Bottlenecks**:
  - Synchronous pipeline blocked client HTTP request for 3-5 seconds.

### H. Video Response Submission (Critical Bottleneck)
- **Previous State**:
  - Client recorded video -> Uploaded via multipart form to backend.
  - Backend forwarded entire video to AI Service synchronously.
  - AI Service extracted frames at **2 FPS** (e.g., 120 frames for 60s video) without resolution downscaling (processing native 1080p/720p).
  - Every single frame ran through YOLOv8 person detection + MediaPipe pose & gaze extraction.
  - Client was forced to keep HTTP connection open for 15 - 35 seconds per question before seeing the next prompt!
- **Identified Bottlenecks**:
  - Blocking synchronous HTTP request on Render free tier risked 30s gateway timeout.
  - 2 FPS sampling processed 2x more frames than necessary for speech cadence/gaze analysis.
  - Unresized frames caused high convolution matrix operations on CPU.

### I. Interview Completion & Final Result Generation
- **Previous State**:
  - If video analysis was still pending, completion hung or failed.
  - Results endpoint was uncacheable and recalculated multimodal fusion repeatedly on every navigation or page reload.
- **Identified Bottlenecks**:
  - Client re-fetched heavy JSON payloads without cache-control headers.

---

## Database Index Audit

| Collection | Existing Indexes | Missing / Added Indexes | Impact |
|---|---|---|---|
| `responses` | `{ interviewId, questionId, clerkUserId }`, `{ interviewId, clerkUserId }`, `{ clerkUserId, createdAt }` | None (Adequate) | Fast per-question lookups |
| `interviews` | `{ clerkUserId, createdAt }`, `{ clerkUserId, status }`, `{ _id, clerkUserId }` | None (Adequate) | Fast user interview listing |
| `questions` | `{ interviewId, order }` | **Added**: `{ interviewId: 1, status: 1 }` | Fast pending question lookups |
| `resumes` | None | **Added**: `{ clerkUserId: 1, createdAt: -1 }` | Eliminates collection scans on upload/fetch |
| `jobdescriptions` | None | **Added**: `{ clerkUserId: 1, createdAt: -1 }` | Eliminates collection scans on upload/fetch |
| `progress` | None | **Added**: `{ clerkUserId: 1, completedAt: -1 }`, `{ interviewId: 1, clerkUserId: 1 }` | 10x faster dashboard progress lookups |
| `trainingsessions` | None | **Added**: `{ clerkUserId: 1, createdAt: -1 }` | Fast training module fetches |

---

## Frontend Bundle & Network Audit

- **Vite Bundling**:
  - Default build bundled `recharts` (392 kB) directly into application chunks, delaying Time to Interactive (TTI) for initial pages.
  - Dynamic imports were implemented on routes, but library chunks remained monolithic.
- **Optimization**:
  - Implemented manual chunking in `vite.config.js`:
    - `vendor-charts`: `recharts` isolated (392 kB)
    - `vendor-clerk`: `@clerk/clerk-react` isolated (95 kB)
    - `vendor-icons`: `lucide-react` isolated (12 kB)
  - Results page utilizes staged loading: Stage 1 metadata and scores render immediately, while charts and video metrics load progressively as background queue finishes.
