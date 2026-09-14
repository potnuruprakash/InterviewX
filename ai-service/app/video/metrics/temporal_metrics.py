"""
Temporal Aggregation & Video Metrics Module
Computes empirical, observable video presence and expression statistics.
Does NOT output subjective psychological inferences or candidate personality scores.
"""

from collections import Counter
from typing import Dict, List, Any
from app.video.tracking.temporal_tracker import FrameTimelineEvent, TemporalTracker


def compute_video_metrics(
    tracker: TemporalTracker,
    audit_note: str,
    is_custom_model: bool
) -> Dict[str, Any]:
    """
    Computes final aggregate statistics from recorded frame events.
    """
    events = tracker.events
    total_frames = len(events)

    if total_frames == 0:
        return {
            "valid_frames_analyzed": 0,
            "person_visibility": 0.0,
            "multiple_person_frames": 0.0,
            "good_framing": 0.0,
            "face_visibility": 0.0,
            "camera_orientation": {"center": 0.0, "left": 0.0, "right": 0.0, "other": 0.0},
            "expression_distribution": {},
            "dominant_expression": "none",
            "expression_transitions": 0,
            "expression_classification_confidence": None,
            "movement_stability_index": None,
            "observable_observations": ["No video frames were analyzed."],
            "model_audit_note": audit_note,
            "timeline": [],
        }

    # 1. Video Presence & Framing Metrics
    person_frames = sum(1 for e in events if e.person_detected)
    multiple_person_count = sum(1 for e in events if e.person_count > 1)
    good_framing_count = sum(1 for e in events if e.good_framing)
    face_frames = sum(1 for e in events if e.face_detected)

    person_visibility = round(person_frames / total_frames, 3)
    multiple_person_frames = round(multiple_person_count / total_frames, 3)
    good_framing = round(good_framing_count / total_frames, 3)
    face_visibility = round(face_frames / total_frames, 3)

    # 2. Camera Orientation Distribution
    orient_counts = Counter(e.camera_orientation for e in events)
    camera_orientation = {
        "center": round(orient_counts.get("centered", 0) / total_frames, 3),
        "left": round(orient_counts.get("left", 0) / total_frames, 3),
        "right": round(orient_counts.get("right", 0) / total_frames, 3),
        "other": round((orient_counts.get("up", 0) + orient_counts.get("down", 0) + orient_counts.get("unknown", 0)) / total_frames, 3),
    }

    # 3. Facial Expression Distribution across valid face frames
    valid_expression_events = [e for e in events if e.face_detected and e.expression]
    expr_counts = Counter(e.expression for e in valid_expression_events)
    total_valid_expr = len(valid_expression_events)

    if total_valid_expr > 0:
        expression_distribution = {
            expr: round(count / total_valid_expr, 3)
            for expr, count in expr_counts.most_common()
        }
        dominant_expression = expr_counts.most_common(1)[0][0]
        avg_confidence = round(
            sum(e.expression_confidence for e in valid_expression_events) / total_valid_expr,
            3
        )
    else:
        expression_distribution = {"neutral": 1.0}
        dominant_expression = "neutral"
        avg_confidence = None

    # 4. Movement Stability & Expression Transitions
    stability_data = tracker.calculate_movement_stability()
    expression_transitions = tracker.calculate_expression_transitions()

    # 5. Observable, Empirical Observations (Never psychological or personality inferences)
    observations = []
    if face_visibility >= 0.85:
        observations.append("Face remained clearly visible for most of the response.")
    elif face_visibility >= 0.50:
        observations.append("Face was intermittently visible in the frame.")
    else:
        observations.append("Face was frequently outside the primary frame.")

    if camera_orientation["center"] >= 0.70:
        observations.append("Camera orientation was generally consistent and centered.")
    elif camera_orientation["left"] > 0.25 or camera_orientation["right"] > 0.25:
        observations.append("Noticeable sideways head orientation observed during portions of the response.")

    if dominant_expression in ("neutral", "calm"):
        observations.append("Facial expression was predominantly neutral and composed.")
    elif "smile" in dominant_expression or dominant_expression == "happy":
        observations.append("Smile-related expression detected during parts of the response.")

    if expression_transitions >= 4:
        observations.append(f"Facial expression changed {expression_transitions} times during the answer.")
    elif expression_transitions > 0:
        observations.append("Subtle natural expression transitions observed during delivery.")
    else:
        observations.append("Steady, uniform expression maintained throughout delivery.")

    if multiple_person_frames > 0.05:
        observations.append(f"Multiple individuals detected in {int(multiple_person_frames * 100)}% of frames.")

    # 6. Build timeline (sampled every few events for report inspection)
    timeline_sample = [
        {
            "timestamp": e.timestamp_sec,
            "prediction": e.expression,
            "expression_classification_confidence": e.expression_confidence,
            "camera_orientation": e.camera_orientation,
            "face_detected": e.face_detected,
        }
        for i, e in enumerate(events)
        if i % max(1, len(events) // 10) == 0 or i == len(events) - 1
    ]

    return {
        "valid_frames_analyzed": total_frames,
        "person_visibility": person_visibility,
        "multiple_person_frames": multiple_person_frames,
        "good_framing": good_framing,
        "face_visibility": face_visibility,
        "camera_orientation": camera_orientation,
        "expression_distribution": expression_distribution,
        "dominant_expression": dominant_expression,
        "expression_transitions": expression_transitions,
        "expression_classification_confidence": avg_confidence,  # Note: NOT candidate confidence
        "movement_stability_index": stability_data["stability_index"],
        "observable_observations": observations,
        "model_audit_note": audit_note,
        "is_custom_model_verified": is_custom_model,
        "timeline": timeline_sample,
    }
