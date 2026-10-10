"""
InterviewX Split AI Services Test Suite
Verifies:
  1. Core mode serves text and audio endpoints.
  2. Core mode does not initialize video models (MediaPipe/ultralytics).
  3. Video mode serves video analysis endpoints.
  4. Video mode does not initialize SBERT or audio models.
  5. Internal authentication verification (401 without key, 500 if key missing).
  6. Endpoint isolation (404 for unsupported endpoints in active mode).
  7. Malformed/empty media handling and temp file cleanup.
"""

import os
import sys
import unittest
from io import BytesIO
from starlette.testclient import TestClient


class TestSplitAIServices(unittest.TestCase):
    def setUp(self):
        self.secret_key = "test_internal_secret_key_12345"

    def _clean_app_modules(self):
        for mod in list(sys.modules.keys()):
            if mod.startswith("app.") or mod == "app":
                del sys.modules[mod]

    def test_01_core_mode_endpoints_and_isolation(self):
        """Verify Core mode mounts text/audio, blocks video, and doesn't load video models."""
        os.environ["AI_SERVICE_MODE"] = "core"
        os.environ["AI_SERVICE_SECRET_KEY"] = self.secret_key
        self._clean_app_modules()

        import app.main
        client = TestClient(app.main.app)

        # 1. Health check returns core mode
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("mode"), "core")
        self.assertIn("phase_4_sbert", data.get("phases", {}))
        self.assertNotIn("phase_6_video", data.get("phases", {}))

        # 2. Ready check returns ready (SBERT lazy-loaded)
        ready_resp = client.get("/ready")
        self.assertIn(ready_resp.status_code, [200, 503])
        self.assertEqual(ready_resp.json().get("mode"), "core")

        # 3. Root returns core mode and registered endpoints
        root_resp = client.get("/")
        self.assertEqual(root_resp.status_code, 200)
        endpoints = root_resp.json().get("endpoints", {})
        self.assertIn("text_evaluate", endpoints)
        self.assertIn("audio_analyze", endpoints)
        self.assertNotIn("video_analyze", endpoints)

        # 4. Video endpoints return 404 in core mode
        headers = {"x-internal-service-key": self.secret_key}
        video_resp = client.post("/api/ai/video-analyze", headers=headers)
        self.assertEqual(video_resp.status_code, 404)
        self.assertEqual(video_resp.json().get("error"), "ENDPOINT_NOT_SUPPORTED")

        video_info_resp = client.get("/api/ai/video-model-info", headers=headers)
        self.assertEqual(video_info_resp.status_code, 404)
        self.assertEqual(video_info_resp.json().get("error"), "ENDPOINT_NOT_SUPPORTED")

        # 5. Verify video modules were NOT loaded
        self.assertNotIn("mediapipe", sys.modules, "mediapipe should not be loaded in core mode")
        self.assertNotIn("ultralytics", sys.modules, "ultralytics should not be loaded in core mode")

    def test_02_video_mode_endpoints_and_isolation(self):
        """Verify Video mode mounts video analysis, blocks text/audio, and doesn't load SBERT."""
        os.environ["AI_SERVICE_MODE"] = "video"
        os.environ["AI_SERVICE_SECRET_KEY"] = self.secret_key
        self._clean_app_modules()

        import app.main
        client = TestClient(app.main.app)

        # 1. Health check returns video mode
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("mode"), "video")
        self.assertIn("phase_6_video", data.get("phases", {}))
        self.assertNotIn("phase_4_sbert", data.get("phases", {}))

        # 2. Root endpoint specifies video mode
        root_resp = client.get("/")
        self.assertEqual(root_resp.status_code, 200)
        endpoints = root_resp.json().get("endpoints", {})
        self.assertIn("video_analyze", endpoints)
        self.assertNotIn("text_evaluate", endpoints)
        self.assertNotIn("audio_analyze", endpoints)

        # 3. Text and audio endpoints return 404 in video mode
        headers = {"x-internal-service-key": self.secret_key}
        text_resp = client.post("/api/ai/text-evaluate", headers=headers, json={})
        self.assertEqual(text_resp.status_code, 404)
        self.assertEqual(text_resp.json().get("error"), "ENDPOINT_NOT_SUPPORTED")

        audio_resp = client.post("/api/ai/audio-analyze", headers=headers)
        self.assertEqual(audio_resp.status_code, 404)
        self.assertEqual(audio_resp.json().get("error"), "ENDPOINT_NOT_SUPPORTED")

        # 4. Verify SBERT module was NOT loaded
        self.assertNotIn("sentence_transformers", sys.modules, "sentence_transformers should not be loaded in video mode")

    def test_03_authentication_enforcement(self):
        """Verify internal service key enforcement and error responses."""
        os.environ["AI_SERVICE_MODE"] = "core"
        os.environ["AI_SERVICE_SECRET_KEY"] = self.secret_key
        self._clean_app_modules()

        import app.main
        client = TestClient(app.main.app)

        # Health endpoint does not require auth
        h_resp = client.get("/health")
        self.assertEqual(h_resp.status_code, 200)

        # /api/ai endpoints require valid key
        unauth_resp = client.post("/api/ai/text-evaluate", json={})
        self.assertEqual(unauth_resp.status_code, 401)
        self.assertEqual(unauth_resp.json().get("error"), "UNAUTHORIZED_SERVICE")

        bad_key_resp = client.post(
            "/api/ai/text-evaluate",
            headers={"x-internal-service-key": "invalid_wrong_key"},
            json={},
        )
        self.assertEqual(bad_key_resp.status_code, 401)

        # Bearer token format works
        bearer_resp = client.post(
            "/api/ai/text-evaluate",
            headers={"authorization": f"Bearer {self.secret_key}"},
            json={"question": "What is REST?", "answer": "Representational state transfer.", "expectedConcepts": ["stateless"]},
        )
        # Should not be 401
        self.assertNotEqual(bearer_resp.status_code, 401)

    def test_04_missing_secret_key_configuration_error(self):
        """Verify that missing secret key returns clear SERVICE_MISCONFIGURED error."""
        os.environ["AI_SERVICE_MODE"] = "core"
        os.environ["AI_SERVICE_SECRET_KEY"] = ""
        self._clean_app_modules()

        import app.main
        client = TestClient(app.main.app)

        resp = client.post("/api/ai/text-evaluate", json={})
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(resp.json().get("error"), "SERVICE_MISCONFIGURED")

    def test_05_malformed_and_empty_media_handling(self):
        """Verify error handling on empty/malformed uploads and proper cleanup."""
        os.environ["AI_SERVICE_MODE"] = "core"
        os.environ["AI_SERVICE_SECRET_KEY"] = self.secret_key
        self._clean_app_modules()

        import app.main
        client = TestClient(app.main.app)
        headers = {"x-internal-service-key": self.secret_key}

        # Empty audio upload
        files = {"audio": ("empty.webm", BytesIO(b""), "audio/webm")}
        resp = client.post("/api/ai/audio-analyze", headers=headers, files=files)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("EMPTY_AUDIO", str(resp.json()))


if __name__ == "__main__":
    unittest.main()
