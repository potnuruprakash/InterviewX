"""
Temporal aggregation for observable video metrics.
No psychological, personality, confidence, or hiring-suitability inference.
"""

from collections import Counter
from typing import Dict, Any
from app.video.tracking.temporal_tracker import TemporalTracker


def compute_video_metrics(tracker: TemporalTracker, audit_note: str, is_custom_model: bool) -> Dict[str, Any]:
    events = tracker.events
    total = len(events)

    if total == 0:
        return {
            "valid_frames_analyzed": 0,
            "person_visibility": 0.0,
            "multiple_person_frames": 0.0,
            "good_framing": 0.0,
            "face_visibility": 0.0,
            "gaze_alignment_ratio": None,
            "camera_engagement": "unavailable",
            "camera_orientation": {"center": 0.0, "left": 0.0, "right": 0.0, "other": 0.0},
            "posture_score": None,
            "posture_stability_index": None,
            "posture_stability_label": "unavailable",
            "average_shoulder_tilt_degrees": None,
            "expression_distribution": {},
            "dominant_expression": "none",
            "expression_transitions": 0,
            "expression_classification_confidence": None,
            "movement_stability_index": None,
            "observable_observations": ["No video frames were analyzed."],
            "model_audit_note": audit_note,
            "timeline": [],
        }

    person_visibility = round(sum(e.person_detected for e in events) / total, 3)
    multiple_person_frames = round(sum(e.person_count > 1 for e in events) / total, 3)
    good_framing = round(sum(e.good_framing for e in events) / total, 3)
    face_visibility = round(sum(e.face_detected for e in events) / total, 3)

    gaze_values = [e.gaze_alignment_score for e in events if e.face_detected and e.gaze_alignment_score is not None]
    gaze_ratio = round(sum(gaze_values) / len(gaze_values), 3) if gaze_values else None
    if gaze_ratio is None:
        camera_engagement = "unavailable"
    elif gaze_ratio >= 0.80:
        camera_engagement = "consistent_camera_alignment"
    elif gaze_ratio >= 0.55:
        camera_engagement = "mixed_camera_alignment"
    else:
        camera_engagement = "limited_camera_alignment"

    orient_counts = Counter(e.camera_orientation for e in events)
    camera_orientation = {
        "center": round(orient_counts.get("centered", 0) / total, 3),
        "left": round(orient_counts.get("left", 0) / total, 3),
        "right": round(orient_counts.get("right", 0) / total, 3),
        "other": round((orient_counts.get("up", 0) + orient_counts.get("down", 0) + orient_counts.get("unknown", 0)) / total, 3),
    }

    pose_data = tracker.calculate_pose_stability()
    posture_score = pose_data["posture_score"]
    posture_index = pose_data["stability_index"]
    if posture_index is None:
        posture_label = "unavailable"
    elif posture_index >= 0.80:
        posture_label = "stable"
    elif posture_index >= 0.60:
        posture_label = "moderate_variation"
    else:
        posture_label = "frequent_variation"

    tilts = [e.shoulder_tilt_degrees for e in events if e.pose_detected and e.shoulder_tilt_degrees is not None]
    avg_tilt = round(sum(tilts) / len(tilts), 2) if tilts else None

    valid_expr = [e for e in events if e.face_detected and e.expression]
    expr_counts = Counter(e.expression for e in valid_expr)
    if valid_expr:
        expression_distribution = {k: round(v / len(valid_expr), 3) for k, v in expr_counts.most_common()}
        dominant_expression = expr_counts.most_common(1)[0][0]
        avg_confidence = round(sum(e.expression_confidence for e in valid_expr) / len(valid_expr), 3)
    else:
        expression_distribution, dominant_expression, avg_confidence = {}, "unavailable", None

    expression_transitions = tracker.calculate_expression_transitions()
    movement = tracker.calculate_movement_stability()

    observations = []
    if face_visibility >= 0.85:
        observations.append("Face was visible in most analyzed frames.")
    elif face_visibility >= 0.50:
        observations.append("Face visibility was intermittent.")
    else:
        observations.append("Face visibility was limited.")

    if gaze_ratio is not None:
        observations.append(f"Estimated camera/eye alignment averaged {round(gaze_ratio * 100)}% across visible-face frames.")

    if posture_index is not None:
        observations.append(f"Observable pose stability index was {round(posture_index * 100)}%.")

    if multiple_person_frames > 0.05:
        observations.append(f"Multiple people were detected in {round(multiple_person_frames * 100)}% of analyzed frames.")

    timeline = [
        {
            "timestamp": e.timestamp_sec,
            "camera_orientation": e.camera_orientation,
            "gaze_alignment_score": e.gaze_alignment_score if e.face_detected else None,
            "face_detected": e.face_detected,
            "pose_detected": e.pose_detected,
            "posture_score": e.posture_score,
            "shoulder_tilt_degrees": e.shoulder_tilt_degrees,
            "gaze_method": e.gaze_method,
        }
        for i, e in enumerate(events)
        if i % max(1, len(events) // 10) == 0 or i == len(events) - 1
    ]

    return {
        "valid_frames_analyzed": total,
        "person_visibility": person_visibility,
        "multiple_person_frames": multiple_person_frames,
        "good_framing": good_framing,
        "face_visibility": face_visibility,
        "gaze_alignment_ratio": gaze_ratio,
        "camera_engagement": camera_engagement,
        "camera_orientation": camera_orientation,
        "posture_score": posture_score,
        "posture_stability_index": posture_index,
        "posture_stability_label": posture_label,
        "average_shoulder_tilt_degrees": avg_tilt,
        "expression_distribution": expression_distribution,
        "dominant_expression": dominant_expression,
        "expression_transitions": expression_transitions,
        "expression_classification_confidence": avg_confidence,
        "movement_stability_index": movement["stability_index"],
        "observable_observations": observations,
        "model_audit_note": audit_note,
        "is_custom_model_verified": is_custom_model,
        "timeline": timeline,
    }
