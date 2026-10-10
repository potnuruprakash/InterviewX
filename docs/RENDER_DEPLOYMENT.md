# InterviewX — Render Deployment Guide: Split AI Microservices

This document details the configuration for deploying InterviewX across two independent Render web services for AI processing alongside the Node.js backend.

---

## 1. Architecture Overview

```
                                  ┌─────────────────────────────────────────┐
                                  │      React + Vite Frontend (Vercel)     │
                                  └────────────────────┬────────────────────┘
                                                       │ HTTPS (Public API)
                                                       ▼
                                  ┌─────────────────────────────────────────┐
                                  │   interviewx-backend (Render Web Svc)   │
                                  │   - Public Express API & Auth           │
                                  │   - MongoDB Atlas Storage               │
                                  │   - In-process Async Job Queue          │
                                  └──────────┬──────────────────┬───────────┘
                                             │                  │
                Text & Audio Evaluation      │                  │ Video Analysis
         (AI_SERVICE_URL)                    │                  │ (VIDEO_AI_SERVICE_URL)
                                             ▼                  ▼
              ┌────────────────────────────────────┐      ┌────────────────────────────────────┐
              │     interviewx-ai-core             │      │     interviewx-ai-video            │
              │  (Render Web Service / Docker)     │      │  (Render Web Service / Docker)     │
              │  - AI_SERVICE_MODE=core            │      │  - AI_SERVICE_MODE=video           │
              │  - SBERT semantic text similarity  │      │  - YOLOv8 person presence detection│
              │  - Librosa audio feature extraction│      │  - MediaPipe face, gaze & pose     │
              │  - Multimodal score aggregation    │      │  - Bounded concurrency queue       │
              │  - Peak RAM: ~487 MB (< 512MB)     │      │  - Peak RAM: ~403 MB (< 512MB)     │
              └────────────────────────────────────┘      └────────────────────────────────────┘
```

---

## 2. Service 1: InterviewX Core AI Service

Handles SBERT semantic similarity text scoring and Librosa audio MFCC feature extraction. Video models (YOLO, MediaPipe) are completely excluded from memory.

### Render Dashboard Settings:
- **Service Type**: Web Service
- **Name**: `interviewx-ai-core`
- **Region**: Oregon (match backend region for lowest latency)
- **Root Directory**: `ai-service`
- **Environment**: Docker
- **Docker Context**: `ai-service`
- **Dockerfile Path**: `Dockerfile`
- **Instance Type**: Free (512 MB RAM, 0.5 CPU)
- **Health Check Path**: `/health`

### Environment Variables:
| Variable | Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port bound by Uvicorn in container |
| `AI_SERVICE_MODE` | `core` | Enables only Core endpoints (text & audio) |
| `AI_SERVICE_SECRET_KEY` | *(Shared Secret)* | Internal security secret shared with backend |
| `SBERT_MODEL_NAME` | `all-MiniLM-L6-v2` | Sentence-Transformers model weights |
| `BACKEND_URL` | `https://your-backend.onrender.com` | Allowed CORS origin |

---

## 3. Service 2: InterviewX Video AI Service

Handles YOLOv8 person detection, MediaPipe face mesh / iris gaze tracking, and pose posture stability. Sentence-Transformers and audio dependencies are completely excluded from memory.

### Render Dashboard Settings:
- **Service Type**: Web Service
- **Name**: `interviewx-ai-video`
- **Region**: Oregon (match backend region)
- **Root Directory**: `ai-service`
- **Environment**: Docker
- **Docker Context**: `ai-service`
- **Dockerfile Path**: `Dockerfile`
- **Instance Type**: Free (512 MB RAM, 0.5 CPU)
- **Health Check Path**: `/health`

### Environment Variables:
| Variable | Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port bound by Uvicorn in container |
| `AI_SERVICE_MODE` | `video` | Enables only Video analysis endpoints |
| `AI_SERVICE_SECRET_KEY` | *(Shared Secret)* | Same secret key as Core and Backend |
| `VIDEO_FRAME_SAMPLE_FPS` | `1` | Frame sampling rate (1 frame per second) |
| `VIDEO_MAX_FRAMES` | `60` | Maximum frames analyzed per candidate response |
| `VIDEO_MAX_FRAME_DIM` | `640` | Safe downscale dimension for memory protection |
| `MAX_CONCURRENT_INFERENCES` | `1` | Restricts simultaneous heavy inferences to 1 |
| `BACKEND_URL` | `https://your-backend.onrender.com` | Allowed CORS origin |

---

## 4. Service 3: InterviewX Backend

Routes client traffic, manages Clerk authentication and MongoDB Atlas data, and directs AI evaluation requests to the respective services.

### Render Dashboard Settings:
- **Service Type**: Web Service
- **Name**: `interviewx-backend`
- **Region**: Oregon
- **Root Directory**: `backend`
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

### Environment Variables:
| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production environment flag |
| `PORT` | `5000` | Backend listening port |
| `AI_SERVICE_URL` | `http://interviewx-ai-core:8000` *(or public URL)* | URL for Core AI requests (text & audio) |
| `VIDEO_AI_SERVICE_URL` | `http://interviewx-ai-video:8000` *(or public URL)* | URL for Video AI requests |
| `AI_SERVICE_SECRET_KEY` | *(Shared Secret)* | Shared internal service authorization key |
| `AI_SERVICE_TEXT_TIMEOUT` | `15000` | 15s timeout for text evaluation |
| `AI_SERVICE_AUDIO_TIMEOUT`| `60000` | 60s timeout for audio extraction |
| `VIDEO_AI_SERVICE_TIMEOUT`| `120000` | 120s timeout for video inference |
| `MONGODB_URI` | *(Atlas connection string)* | MongoDB Atlas database URI |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk backend authentication secret |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk publishable key |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | Frontend client URL |

> [!NOTE]
> **Render Networking**: If your backend and AI services are in the same Render team/region, you can use Render Private Network URLs (`http://interviewx-ai-core:8000` and `http://interviewx-ai-video:8000`) for zero-latency, private internal traffic. Otherwise, use their public HTTPS URLs (`https://interviewx-ai-core.onrender.com` and `https://interviewx-ai-video.onrender.com`).

---

## 5. Blueprint Deployment via `render.yaml`

The repository includes a ready-to-use [`render.yaml`](file:///c:/Users/praka/OneDrive/Desktop/major/project/render.yaml) blueprint. To deploy all services automatically:
1. Link the repository to your Render account.
2. Select **Blueprints** in the Render Dashboard.
3. Click **New Blueprint Instance** and select `render.yaml`.
4. Render will create and configure all three web services, link their internal environment variables, and auto-generate the `AI_SERVICE_SECRET_KEY`.

---

## 6. Verification and Health Probes

### Core AI Service Health
```bash
curl -i https://interviewx-ai-core.onrender.com/health
# Expected Response:
# {"status":"ok","service":"interviewx-ai","mode":"core","phases":{...},"models":{"sbert":"loaded","audio":"librosa_ready"}}
```

### Video AI Service Health
```bash
curl -i https://interviewx-ai-video.onrender.com/health
# Expected Response:
# {"status":"ok","service":"interviewx-ai","mode":"video","phases":{"phase_6_video":"loaded"},"models":{"yolo":"loaded","mediaPipe":"lazy"}}
```

### Backend Combined Probe
```bash
curl -i https://interviewx-backend.onrender.com/health
# Expected Response:
# {"success":true,"service":"InterviewX Backend","status":"ok","database":"connected","aiService":"available",...}
```
