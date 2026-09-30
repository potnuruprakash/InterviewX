"""
Temporal tracking for observable video signals.
"""

import math
from dataclasses import dataclass
from typing import List, Optional, Dict


@dataclass
class FrameTimelineEvent:
    timestamp_sec: float
    frame_index: int
    person_detected: bool
    person_count: int
    face_detected: bool
    good_framing: bool
    camera_orientation: str
    gaze_alignment_score: float
    expression: str
    expression_confidence: float
    bbox: Optional[List[float]]
    pose_detected: bool = False
    posture_score: Optional[float] = None
    shoulder_tilt_degrees: Optional[float] = None
    torso_center_x: Optional[float] = None
    torso_center_y: Optional[float] = None
    gaze_method: str = "unavailable"


class TemporalTracker:
    def __init__(self):
        self.events: List[FrameTimelineEvent] = []

    def record_frame(self, event: FrameTimelineEvent):
        self.events.append(event)

    def calculate_movement_stability(self) -> Dict[str, any]:
        valid = [e.bbox for e in self.events if e.person_detected and e.bbox is not None]
        if len(valid) < 2:
            return {"stability_index": 85.0, "movement_assessment": "steady", "average_drift": 0.0}

        drifts = []
        for prev_b, curr_b in zip(valid, valid[1:]):
            prev_cx, prev_cy = (prev_b[0] + prev_b[2]) / 2, (prev_b[1] + prev_b[3]) / 2
            curr_cx, curr_cy = (curr_b[0] + curr_b[2]) / 2, (curr_b[1] + curr_b[3]) / 2
            drifts.append(math.sqrt((curr_cx - prev_cx) ** 2 + (curr_cy - prev_cy) ** 2))

        avg_drift = sum(drifts) / len(drifts)
        stability = max(30.0, min(100.0, round(100.0 - avg_drift * 200.0, 1)))
        assessment = "steady" if stability >= 80 else "moderate_movement" if stability >= 60 else "frequent_movement"
        return {"stability_index": stability, "movement_assessment": assessment, "average_drift": round(avg_drift, 3)}

    def calculate_pose_stability(self) -> Dict[str, any]:
        scores = [e.posture_score for e in self.events if e.pose_detected and e.posture_score is not None]
        centers = [(e.torso_center_x, e.torso_center_y) for e in self.events if e.pose_detected and e.torso_center_x is not None]

        if not scores:
            return {"available": False, "posture_score": None, "stability_index": None, "average_center_drift": None}

        posture_score = round(sum(scores) / len(scores), 3)
        center_drift = 0.0
        if len(centers) > 1:
            center_drift = sum(
                math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
                for a, b in zip(centers, centers[1:])
            ) / (len(centers) - 1)

        stability = max(0.0, min(1.0, posture_score * (1.0 - min(1.0, center_drift * 3.0))))
        return {
            "available": True,
            "posture_score": round(posture_score, 3),
            "stability_index": round(stability, 3),
            "average_center_drift": round(center_drift, 4),
        }

    def calculate_expression_transitions(self) -> int:
        valid = [e.expression for e in self.events if e.face_detected and e.expression]
        return sum(1 for a, b in zip(valid, valid[1:]) if a != b) if len(valid) > 1 else 0
