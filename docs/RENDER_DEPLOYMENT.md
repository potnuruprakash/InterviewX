# InterviewX — Render Split AI Deployment Guide

This guide adds a dedicated Video AI service while preserving the existing backend and Core AI service. It intentionally avoids creating a duplicate backend through a Blueprint.

## 1. Architecture

- **Existing backend:** Express API, authentication, MongoDB Atlas, and request routing.
- **Existing Core AI service:** text evaluation, audio analysis, and multimodal evaluation.
- **New Video AI service:** YOLO/MediaPipe video analysis.

The backend should use:
- `AI_SERVICE_URL` for the Core AI service.
- `VIDEO_AI_SERVICE_URL` for the Video AI service.
- `AI_SERVICE_SECRET_KEY` as the shared secret for both AI services.

Splitting workloads isolates processes and model memory. It does not guarantee faster inference: each free instance has limited CPU/RAM, and the actual result must be measured after deployment.

## 2. Before deployment

1. Confirm the existing backend and Core AI service are healthy.
2. Confirm the backend has `AI_SERVICE_SECRET_KEY` set.
3. Confirm the Core AI service uses the same `AI_SERVICE_SECRET_KEY`.
4. Do not deploy a Blueprint that creates a second backend.

## 3. Create only the Video AI service

The repository's `render.yaml` is intentionally scoped to the new Video AI service only.

1. Open the Render Dashboard and choose **New → Blueprint**.
2. Select the InterviewX repository and the branch containing this configuration.
3. Review the Blueprint plan. It should add only `interviewx-ai-video`; cancel if it proposes creating another backend or Core AI service.
4. When prompted for `AI_SERVICE_SECRET_KEY`, enter the exact same secret already configured on the backend and Core AI service. Do not commit this secret to GitHub.
5. Confirm the service uses the Dockerfile at `ai-service/Dockerfile` with `ai-service` as the Docker build context.
6. Deploy and wait for the `/health` check to pass.

### Video service environment

| Variable | Value |
| --- | --- |
| `PORT` | `8000` |
| `AI_SERVICE_MODE` | `video` |
| `AI_SERVICE_SECRET_KEY` | Same secret as the existing backend |
| `VIDEO_FRAME_SAMPLE_FPS` | `1` |
| `VIDEO_MAX_FRAMES` | `8` |
| `VIDEO_MAX_FRAME_DIM` | `384` |
| `MAX_CONCURRENT_INFERENCES` | `1` |

The video sampler intentionally caps work at 8 frames and 384 pixels for low-memory instances. Raising environment values alone will not raise these hard caps.

## 4. Connect the existing backend

After the Video AI service is deployed:

1. Copy its **Internal URL** from Render if all services are in the same workspace and region; otherwise use its public HTTPS URL.
2. In the existing backend's Environment settings, set `VIDEO_AI_SERVICE_URL` to that URL.
3. Keep `AI_SERVICE_URL` pointing to the existing Core AI service.
4. Ensure the backend's `AI_SERVICE_SECRET_KEY` matches the secret set on the Video AI service.
5. Save changes and deploy the backend if Render does not deploy it automatically.

Do not change your MongoDB Atlas connection string as part of this split.

## 5. Verify

Check these in order:

1. Open the Video AI service's `/health` endpoint and confirm it reports the video mode and a healthy status.
2. Open the existing Core AI service's `/health` endpoint and confirm it remains healthy.
3. Open the backend's `/health` endpoint.
4. Test a text evaluation, an audio analysis, and a video analysis separately from InterviewX.
5. Check Render logs for authorization errors, timeouts, out-of-memory restarts, and `framesProcessed: 0`.

Do not treat the deployment as verified until all three workflows have been tested end to end. Peak memory and latency should be measured from Render metrics and logs; this guide makes no unmeasured RAM guarantees.
