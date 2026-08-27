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
SBERT_MODEL_NAME=all-MiniLM-L6-v2
YOLO_MODEL_PATH=yolov8n.pt
VIDEO_FRAME_SAMPLE_FPS=1
AUDIO_MODEL_PATH=
```

---

### 2. Start Services

#### Step 1: Start Backend
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:5000`*

#### Step 2: Start AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*AI service runs on `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)*

#### Step 3: Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## 🔒 Security & Data Privacy
- **Zero Secret Leakage**: No secret keys are included in client bundles.
- **Multi-Tenant Isolation**: Every database query is scoped strictly by `clerkUserId`.
- **Honest AI Fallbacks**: Clear visual badges differentiate real SBERT inference from heuristic development placeholders. No fabricated ML confidence metrics or psychological claims.
