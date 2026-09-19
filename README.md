# Adaptive AI — Personalized Multimodal Interview Intelligence System (InterviewX)

> **Major Project** — Full-Stack Multimodal Adaptive AI Mock Interview Platform

---

## 🚀 Project Overview

**InterviewX** is an end-to-end adaptive AI interview preparation system. It combines resume and job description parsing, deterministic skill-gap matching, dynamic personalized question generation, real-time multimodal evaluation (text via SBERT, audio speech indicators via librosa MFCCs, and video frame presence via YOLOv8), an adaptive questioning difficulty engine, and a personalized improvement roadmap.

---

## 🏗️ Architecture

```
                                  ┌─────────────────────────────────────────┐
                                  │      React + Vite Frontend (SPA)        │
                                  │  - Clerk Authentication (@clerk/react)  │
                                  │  - Recharts Visualizations & Trends     │
                                  │  - MediaRecorder Audio/Video Recording  │
                                  └────────────────────┬────────────────────┘
                                                       │  Bearer JWT (Clerk)
                                                       │  REST API / Multipart
                                                       ▼
                                  ┌─────────────────────────────────────────┐
                                  │      Node.js + Express Backend          │
                                  │  - Clerk Middleware Authentication      │
                                  │  - MongoDB (Mongoose) Data Persistence   │
                                  │  - Skill Analysis & Normalization       │
                                  │  - Personalized Question Generation     │
                                  │  - Adaptive Questioning Engine          │
                                  │  - Multimodal Fusion Engine             │
                                  │  - Improvement Roadmap Generator        │
                                  └────────────────────┬────────────────────┘
                                                       │  Internal HTTP
                                                       │  JSON & Multipart Form
                                                       ▼
                                  ┌─────────────────────────────────────────┐
                                  │      FastAPI Python AI Microservice     │
                                  │  - SBERT Semantic Text & Concept Eval   │
                                  │  - Librosa MFCC & Paralinguistic Audio  │
                                  │  - YOLOv8 Person/Frame Detection Video  │
                                  │  - CNN-LSTM Model Architecture          │
                                  └─────────────────────────────────────────┘
```

---

## 📋 Implemented System Capabilities

| Capability / Phase | Description | Status |
|---|---|---|
| **Phase 1: Auth & Foundation** | Clerk OAuth & email auth, isolated multi-tenant records, MongoDB schemas | ✅ Complete |
| **Phase 2: Resume & JD Analysis** | PDF/DOCX parsing, skill taxonomy normalization, deterministic match & gap coverage | ✅ Complete |
| **Phase 3: Personalized Questions** | Resume projects, work experience, JD requirements, and skill-gap targeted questions | ✅ Complete |
| **Phase 4: SBERT Text Evaluation** | `all-MiniLM-L6-v2` semantic cosine similarity + expected concept coverage scoring | ✅ Complete |
| **Phase 5: Audio Feature Extraction**| Librosa MFCCs, zero crossing rate, RMS energy, spectral centroid, speech rate | ✅ Complete |
| **Phase 6: Video Frame Analysis** | YOLOv8 person detection consistency, frame processing, video quality metric | ✅ Complete |
| **Phase 7: Multimodal Fusion** | Weighted scoring (50% text, 25% audio, 25% video) with missing modality redistribution | ✅ Complete |
| **Phase 8: Adaptive Engine** | Real-time performance tracking, dynamic difficulty adjustment, automatic follow-ups | ✅ Complete |
| **Phase 9: Final Evaluation** | Comprehensive session scoring, modality breakdown, strength/weakness synthesis | ✅ Complete |
| **Phase 10: Improvement Roadmap** | Prioritized study recommendations, topic guides, prototype job readiness score | ✅ Complete |
| **Phase 11: Longitudinal Progress** | Historical score trends, skill radar visualization, modality usage tracking | ✅ Complete |
| **Phase 12: Interview Interface** | Real-time question flow, timer, in-browser audio & video recording, SBERT feedback | ✅ Complete |
| **Phase 13: Results Dashboard** | Interactive score rings, skill mastery bars, per-question analysis, concept badges | ✅ Complete |

---

## 🛠️ Quick Start Guide

### Prerequisites
- **Node.js**: v18.0+
- **Python**: v3.10+
- **MongoDB**: Local instance (`mongodb://localhost:27017`) or MongoDB Atlas
- **Clerk Account**: Free API keys from [clerk.com](https://clerk.com)

---

### 1. Configure Environment Variables

#### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/interviewx
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT=60000
FRONTEND_URL=http://localhost:5173

# OpenAI Assistant Integration (Official Node.js SDK on Backend)
# NEVER expose your API key to frontend, React code, or git
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

---

### 🤖 OpenAI API Setup & Configuration

The InterviewX AI Coach uses the official OpenAI Node.js SDK on the backend to deliver natural, ChatGPT-like conversational assistance across two dedicated assistants:
- **Dashboard AI Assistant**: General conversational engineering mentor (concepts, debugging, architecture, learning paths). It does **not** conduct mock interviews or evaluate unless explicitly asked.
- **Results AI Assistant**: Performance analysis coach strictly attached to a specific interview result.

#### 1. Obtaining an OpenAI API Key
1. Navigate to the [OpenAI Platform](https://platform.openai.com/api-keys).
2. Log in or create an OpenAI developer account.
3. Go to **Dashboard → API Keys** and click **Create new secret key**.
4. Give it a name (e.g., `InterviewX-Backend`) and copy the generated key (`sk-...`).

#### 2. Where to Put Your API Key
Add the key into `backend/.env`:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```
> [!IMPORTANT]
> **Security Guardrail**: Never put `OPENAI_API_KEY` in `frontend/.env`, browser code, or git commits. The frontend communicates strictly via authenticated backend REST endpoints.

#### 3. Configuring the Model
The model is fully configurable without changing application code via `OPENAI_MODEL`. Recommended models:
- `gpt-4o-mini` (Default: fast, cost-effective, high reasoning quality)
- `gpt-4o` (Flagship multimodal intelligence)
- `gpt-3.5-turbo` (Legacy lightweight)

#### 4. Running the Backend
```bash
cd backend
npm install
npm run dev
```

#### 5. Testing the AI Endpoints
You can test the endpoints via curl, Postman, or our automated test suite:
- **Dashboard Chat Test**:
  ```bash
  node backend/src/tests/openai_assistant_chat_test.js
  ```
- **Separation & History Verification**:
  ```bash
  node backend/src/tests/chatbot_separation_test.js
  ```


#### Frontend (`frontend/.env`)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:5000
```

#### AI Service (`ai-service/.env`)
```env
PORT=8000
BACKEND_URL=http://localhost:5000
AI_SERVICE_SECRET_KEY=your_internal_ai_secret_key_here
SBERT_MODEL_NAME=all-MiniLM-L6-v2
YOLO_MODEL_PATH=yolov8n.pt
```

### Docker Deployment (Production Multi-Container)

You can launch the entire stack using Docker Compose:

```bash
docker compose up --build
```

Services started:
- `frontend`: React SPA served via Nginx on port `80`
- `backend`: Node.js Express API on port `5000`
- `ai-service`: Python FastAPI microservice on port `8000`
- `mongodb`: MongoDB 7.0 persistent container on port `27017`

---

## 🔒 Security Architecture & Data Isolation

1. **Authentication Enforcement**:
   - Clerk session verification enforced via `@clerk/express` `getAuth(req)`.
   - Removed manual, unverified base64 JWT parsing and development header bypasses.
   - Test mode strictly guarded behind `NODE_ENV === 'test'` and `TEST_AUTH_ENABLED === 'true'`.

2. **Multi-Tenant Scoping**:
   - Every single MongoDB model query enforces `{ _id, clerkUserId }`.
   - Compound unique index on responses (`{ interviewId: 1, questionId: 1, clerkUserId: 1 }`) eliminates race conditions and duplicate answers.
   - Resource access between tenants strictly returns 404 (IDOR prevention).

3. **Secure File Streaming Layer**:
   - Public static file exposure removed.
   - Protected streaming routes mounted at `/api/files/resume/:id`, `/api/files/audio/:id`, `/api/files/video/:id`.
   - Implements authentication validation, ownership checks, path traversal guards (`path.resolve` containment), and HTTP 206 Partial Content range requests for media playback.

4. **Internal AI Microservice Security**:
   - AI service endpoints validate `X-Internal-Service-Key` matching `AI_SERVICE_SECRET_KEY`.
   - CORS restricted to backend origin.
   - Request streaming in 1MB chunks prevents memory exhaustion / DoS.

---

## 🧪 Automated Testing

InterviewX includes an automated production verification suite:

```bash
cd backend
npm test
```

Suites executed:
1. **Auth & Route Verification**: Rejection of forged JWTs, unauthenticated requests, verified identity flow.
2. **Multi-Tenant Security & Isolation**: IDOR protection, cross-tenant file streaming blocks, compound unique index duplicate prevention, skipped vs answered separation, adaptive question ceiling.
3. **Chatbot Architecture & Context Separation**: Grounded context injection, zero cross-session history pollution, session title generation.

---

## 🎥 Video & Expression Analysis Model Audit (RAVDESS & YOLOv8)

### Verification Statement
> **"RAVDESS is being used as the dataset, but the current implementation does not prove that the RAVDESS data was trained using YOLOv8."**

### Architectural Audit & Facts
1. **Dataset (`RAVDESS`)**:
   - The Ryerson Audio-Visual Database of Emotional Speech and Song (RAVDESS) is a controlled laboratory dataset of 24 professional actors speaking with specified emotional expressions.
   - RAVDESS is referenced as a target dataset domain; however, **no custom RAVDESS-trained model weights are bundled in the repository**.
   - RAVDESS consists of acted emotional performances. It is **not** an interview behavior dataset and cannot be used to determine candidate personality, competence, honesty, or anxiety.
2. **Model Framework (`YOLOv8`)**:
   - The active YOLO checkpoint in `ai-service/yolov8n.pt` was verified via Ultralytics inspection.
   - **Task**: `detect` (Object Detection trained on COCO 80 classes, where class 0 = `person`).
   - **Current Role**: YOLOv8 is used strictly for its verified capability:
     - Person presence detection (`person_visibility`)
     - Candidate framing analysis (`good_framing`)
     - Multi-person detection flags (`multiple_person_frames`)
     - Bounding box stability tracking
3. **Physical Expression & Head Pose**:
   - Bounding-box regions from YOLO detection are forwarded to the modular video analysis pipeline (`app/video/`).
   - Head orientation is estimated into observable spatial angles (`centered`, `left`, `right`, `up`, `down`).
   - Facial movements are tracked as physical observable cues using OpenCV Haar Cascade detection (`mouth_region_activity`).
   - If custom-trained classification weights (`yolov8-cls` or custom CNN) are configured via `EXPRESSION_MODEL_PATH`, the classifier loads them plug-and-play. In their absence, the system never fabricates psychological conclusions.
4. **Observable Indicators Calibration**:
   - SBERT similarity metrics are strictly named `responseCompletenessIndicator` and calibrated using empirical thresholds (`SEMANTIC_SCORE_SCALE = 115.0`, `CONCEPT_MATCH_THRESHOLD = 0.35`).
   - Confidence is never conflated with candidate psychological states.

### Video Pipeline Architecture
```
Interview Video (.webm / .mp4)
      │
      ▼
Video Decoding & Frame Sampling (app/video/preprocessing/frame_sampler.py @ 2-5 FPS)
      │
      ▼
YOLOv8 Object Detection & Tracking (app/video/detector/yolo_detector.py)
      │
      ├─► Person Visibility & Framing Metrics
      │
      ▼
Face Region Extraction & Head Orientation (app/video/landmarks/face_analyzer.py)
      │
      ▼
Expression Analysis & Temporal Aggregation (app/video/metrics/temporal_metrics.py)
      │
      ▼
Empirical Video Analysis JSON
      │
      ▼
InterviewX Report UI (ResultsPage.jsx: Video & Presence Table)
```

---

## 🔒 Security & Data Privacy
- **Zero Secret Leakage**: No secret keys or model credentials are included in client bundles.
- **Multi-Tenant Isolation**: Every database query is scoped strictly by `clerkUserId`.
- **Honest AI Fallbacks**: Clear visual badges differentiate real SBERT inference from heuristic development placeholders. No fabricated ML confidence metrics or psychological claims.
- **Privacy-Compliant Video Handling**: Candidate interview recordings are processed locally for analysis and temporary storage without unauthorized third-party persistence.
