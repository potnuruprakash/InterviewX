"""
Temporal Frame Tracking & Stability Module
Tracks bounding box stability, movement, and expression transitions across video timestamps.
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


class TemporalTracker:
    """Tracks sequence of frame events and calculates movement stability and transitions."""

    def __init__(self):
        self.events: List[FrameTimelineEvent] = []

    def record_frame(self, event: FrameTimelineEvent):
        self.events.append(event)

    def calculate_movement_stability(self) -> Dict[str, any]:
        """
        Calculates centroid drift across consecutive frames with detected persons.
        Returns stability index (0 - 100) and movement descriptor.
        """
        valid_boxes = [e.bbox for e in self.events if e.person_detected and e.bbox is not None]
        if len(valid_boxes) < 2:
            return {
                "stability_index": 85.0,
                "movement_assessment": "steady",
                "average_drift": 0.0,
            }

        drifts = []
        for i in range(1, len(valid_boxes)):
            prev_b = valid_boxes[i - 1]
            curr_b = valid_boxes[i]
            prev_cx = (prev_b[0] + prev_b[2]) / 2.0
            prev_cy = (prev_b[1] + prev_b[3]) / 2.0
            curr_cx = (curr_b[0] + curr_b[2]) / 2.0
            curr_cy = (curr_b[1] + curr_b[3]) / 2.0

            dist = math.sqrt((curr_cx - prev_cx) ** 2 + (curr_cy - prev_cy) ** 2)
            drifts.append(dist)

        avg_drift = sum(drifts) / len(drifts) if drifts else 0.0
        # Drift > 0.15 normalized distance per sample is heavy movement
        stability = max(30.0, min(100.0, round(100.0 - (avg_drift * 200.0), 1)))

        if stability >= 80:
            assessment = "steady"
        elif stability >= 60:
            assessment = "moderate_movement"
        else:
            assessment = "frequent_movement"

        return {
            "stability_index": stability,
            "movement_assessment": assessment,
            "average_drift": round(avg_drift, 3),
        }

    def calculate_expression_transitions(self) -> int:
        """Counts how many times the dominant facial expression transitioned."""
        valid_expressions = [e.expression for e in self.events if e.face_detected and e.expression]
        if len(valid_expressions) < 2:
            return 0

        transitions = 0
        for i in range(1, len(valid_expressions)):
            if valid_expressions[i] != valid_expressions[i - 1]:
                transitions += 1

        return transitions
