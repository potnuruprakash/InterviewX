"""
Audio Analysis Service — Phase 5

Uses librosa for MFCC and paralinguistic feature extraction.
Features extracted:
  - MFCC (Mel-frequency cepstral coefficients)
  - Zero crossing rate
  - RMS energy
  - Spectral centroid
  - Fundamental frequency / pitch (using librosa.yin)
  - Speaking duration estimate

CNN-LSTM model: NOT TRAINED.
  The model interface is modular so trained weights can be plugged in later.
  Currently returns modelStatus: "development" with only feature data.

IMPORTANT: No medical/psychological claims are made.
  Labels used: "speech delivery indicators" (not "anxiety detection").
"""

import os
import logging
import tempfile
from typing import Optional
import subprocess

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# AUDIO MODEL STATUS
# ─────────────────────────────────────────────────────────────────────────────

AUDIO_MODEL_PATH = os.getenv("AUDIO_MODEL_PATH", "")
_audio_model_status = "not_trained"


def get_audio_model_status() -> str:
    if AUDIO_MODEL_PATH and os.path.exists(AUDIO_MODEL_PATH):
        return "loaded"
    return "not_trained"


# ─────────────────────────────────────────────────────────────────────────────
# AUDIO CONVERSION
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_wav(input_path: str) -> Optional[str]:
    """
    Convert audio file to WAV using ffmpeg if available.
    Returns WAV path or None if conversion fails.
    """
    try:
        out_path = input_path + "_converted.wav"
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", out_path],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0 and os.path.exists(out_path):
            return out_path
        logger.warning(f"[Audio] ffmpeg conversion failed: {result.stderr.decode()}")
        return None
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning(f"[Audio] ffmpeg not available or timeout: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_features(audio_path: str) -> dict:
    """
    Extract audio features from a file.
    Returns a dict of measurable audio characteristics.
    """
    wav_path = None
    converted = False

    try:
        import librosa
        import numpy as np

        # Try to load directly first
        try:
            y, sr = librosa.load(audio_path, sr=16000, mono=True)
        except Exception:
            # Try converting to WAV
            wav_path = convert_to_wav(audio_path)
            if wav_path:
                y, sr = librosa.load(wav_path, sr=16000, mono=True)
                converted = True
            else:
                return _unavailable_result("Could not load audio file. Format may be unsupported.")

        if len(y) == 0:
            return _unavailable_result("Audio file is empty.")

        # ── MFCC ─────────────────────────────────────────────────────────────
        n_mfcc = 13
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        mfcc_mean = mfcc.mean(axis=1).tolist()
        mfcc_std = mfcc.std(axis=1).tolist()

        # ── Zero Crossing Rate ────────────────────────────────────────────────
        zcr = librosa.feature.zero_crossing_rate(y)
        zcr_mean = float(np.mean(zcr))

        # ── RMS Energy ───────────────────────────────────────────────────────
        rms = librosa.feature.rms(y=y)
        rms_mean = float(np.mean(rms))
        rms_std = float(np.std(rms))

        # ── Spectral Centroid ─────────────────────────────────────────────────
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_centroid_mean = float(np.mean(spectral_centroid))

        # ── Speaking Duration ─────────────────────────────────────────────────
        duration_seconds = float(len(y) / sr)

        # Estimate speech vs silence using energy threshold
        frame_energy = rms[0]
        energy_threshold = float(np.percentile(frame_energy, 20))
        speech_frames = float(np.sum(frame_energy > energy_threshold)) / len(frame_energy)
        speaking_duration = duration_seconds * speech_frames
        pause_duration = duration_seconds * (1 - speech_frames)

        # ── Pitch (Fundamental Frequency) ─────────────────────────────────────
        pitch_mean = None
        pitch_std = None
        try:
            # YIN pitch detection — reliable for clean speech
            f0 = librosa.yin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
            voiced = f0[f0 > 0]
            if len(voiced) > 0:
                pitch_mean = float(np.mean(voiced))
                pitch_std = float(np.std(voiced))
        except Exception as pitch_err:
            logger.debug(f"[Audio] Pitch extraction failed: {pitch_err}")

        # ── Speech Rate Approximation ─────────────────────────────────────────
        # Rough syllable rate from energy envelope zero crossings
        speech_rate = None
        try:
            # Estimate syllables per second using onset strength
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
            if speaking_duration > 0.5:
                speech_rate = round(len(onsets) / speaking_duration, 2)  # syllables/sec approx
        except Exception:
            pass

        return {
            "audioFeaturesAvailable": True,
            "modelStatus": get_audio_model_status(),
            "speechScore": None,  # CNN-LSTM not trained — no score fabricated
            "speakingDuration": round(speaking_duration, 2),
            "pauseDuration": round(pause_duration, 2),
            "totalDuration": round(duration_seconds, 2),
            "speechRate": speech_rate,
            "mfccSummary": {
                "coefficients": n_mfcc,
                "mean": [round(v, 4) for v in mfcc_mean],
                "std": [round(v, 4) for v in mfcc_std],
            },
            "energyCharacteristics": {
                "rmsMean": round(rms_mean, 6),
                "rmsStd": round(rms_std, 6),
                "zeroCrossingRateMean": round(zcr_mean, 4),
                "spectralCentroidMean": round(spectral_centroid_mean, 2),
            },
            "pitchStatistics": {
                "pitchMean_hz": round(pitch_mean, 2) if pitch_mean else None,
                "pitchStd_hz": round(pitch_std, 2) if pitch_std else None,
                "note": "Pitch statistics are for informational purposes only.",
            },
            "speechDeliveryIndicators": {
                "speechActivityRatio": round(speech_frames, 3),
                "note": "These are speech delivery indicators only, not psychological assessments.",
            },
            "sampleRate": sr,
            "converted": converted,
        }

    except ImportError:
        return _unavailable_result("librosa not installed. Run: pip install librosa")
    except Exception as e:
        logger.error(f"[Audio] Feature extraction error: {e}")
        return _unavailable_result(f"Feature extraction failed: {str(e)}")
    finally:
        # Clean up converted WAV
        if wav_path and converted and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except Exception:
                pass


def _unavailable_result(reason: str) -> dict:
    return {
        "audioFeaturesAvailable": False,
        "modelStatus": "unavailable",
        "speechScore": None,
        "reason": reason,
    }
