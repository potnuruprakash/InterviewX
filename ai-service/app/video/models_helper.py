"""
Helper to locate or automatically download verified MediaPipe task models.
Ensures local caching in the ai-service/models directory.
"""

import os
import logging
import urllib.request

logger = logging.getLogger(__name__)

FACE_LANDMARKER_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
POSE_LANDMARKER_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"


def get_model_file_path(filename: str, download_url: str) -> str:
    """
    Locates the model file across candidate paths.
    If not found locally, downloads it from the official Google repository.
    """
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    ai_service_root = os.path.abspath(os.path.join(curr_dir, "..", ".."))

    candidate_paths = [
        os.path.join(ai_service_root, "models", filename),
        os.path.join(ai_service_root, filename),
        os.path.join(os.getcwd(), "models", filename),
        os.path.join(os.getcwd(), filename),
    ]

    for p in candidate_paths:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return p

    # Download to ai-service/models/<filename>
    target_dir = os.path.join(ai_service_root, "models")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, filename)

    logger.info(f"[ModelLoader] Model file {filename} not found locally. Downloading from {download_url}...")
    try:
        urllib.request.urlretrieve(download_url, target_path)
        logger.info(f"[ModelLoader] Downloaded {filename} successfully ({os.path.getsize(target_path)} bytes).")
        return target_path
    except Exception as e:
        logger.error(f"[ModelLoader] Failed to download {filename} from {download_url}: {e}")
        # If download fails, check if any candidate exists even if 0 size
        return target_path
