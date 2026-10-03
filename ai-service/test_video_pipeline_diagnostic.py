"""
Video Analysis Pipeline Diagnostic Test
Verifies all 10 stages of the video pipeline without requiring a live database.
Reports explicit PASS / FAIL for each stage.
"""

import os
import sys
import json
import cv2
import numpy as np

def run_diagnostic(video_path: str = None) -> bool:
    print("=" * 60)
    print("INTERVIEWX VIDEO ANALYSIS PIPELINE DIAGNOSTIC")
    print("=" * 60)

    stages = {}
    auto_generated = False

    # Stage 0: Create test video if none provided
    if not video_path or not os.path.exists(video_path):
        auto_generated = True
        sample_img = os.path.join(os.path.dirname(__file__), "interview_candidate_test.jpg")
        if not os.path.exists(sample_img):
            print("ERROR: Base test image not found:", sample_img)
            return False

        base = cv2.imread(sample_img)
        video_path = os.path.join(os.path.dirname(__file__), "diagnostic_test_video.webm")
        fourcc = cv2.VideoWriter_fourcc(*'VP80')
        writer = cv2.VideoWriter(video_path, fourcc, 15.0, (base.shape[1], base.shape[0]))
        for i in range(30): # 2 seconds
            shift_x = int(2 * np.sin(i / 5.0))
            M = np.float32([[1, 0, shift_x], [0, 1, 0]])
            f = cv2.warpAffine(base, M, (base.shape[1], base.shape[0]))
            writer.write(f)
        writer.release()

    # Stage 1: Input video exists
    stages["1. Video exists"] = os.path.exists(video_path)

    # Stage 2: Video size > 0
    size = os.path.getsize(video_path) if stages["1. Video exists"] else 0
    stages["2. Video size > 0"] = size > 0

    # Stage 3: OpenCV can open it
    cap = cv2.VideoCapture(video_path)
    stages["3. OpenCV can open video"] = cap.isOpened()

    # Stage 4: Frames can be decoded
    ret, first_frame = cap.read() if cap.isOpened() else (False, None)
    stages["4. Frames can be decoded"] = bool(ret and first_frame is not None)
    cap.release()

    # Stage 5: Frame sampler extracts frames
    from app.video.preprocessing.frame_sampler import extract_sampled_frames
    sampled = extract_sampled_frames(video_path, fps=2)
    stages["5. Frame sampler extracts frames (>0)"] = len(sampled) > 0

    # Stage 6: YOLO detects person
    from app.video.detector.yolo_detector import get_yolo_detector
    yolo = get_yolo_detector()
    yolo_res = yolo.detect_frame(first_frame) if first_frame is not None else None
    stages["6. YOLO person detection"] = bool(yolo_res and yolo_res.person_detected)

    # Stage 7: MediaPipe Face Mesh / Iris detects face
    from app.video.landmarks.face_analyzer import get_face_analyzer
    face_analyzer = get_face_analyzer()
    face_res = face_analyzer.analyze_head_region(first_frame, yolo_res.head_bbox if yolo_res else None) if first_frame is not None else None
    stages["7. MediaPipe Face / Iris detection"] = bool(face_res and face_res.face_detected and face_res.gaze_alignment_score > 0)

    # Stage 8: MediaPipe Pose detects body
    from app.video.landmarks.pose_analyzer import get_pose_analyzer
    pose_analyzer = get_pose_analyzer()
    pose_res = pose_analyzer.analyze(first_frame) if first_frame is not None else None
    stages["8. MediaPipe Pose detection"] = bool(pose_res and pose_res.pose_detected and pose_res.posture_score is not None)

    # Stage 9: VideoAnalysisPipeline produces metrics
    from app.video.inference.pipeline import get_video_pipeline
    pipeline = get_video_pipeline()
    pipeline_res = pipeline.process_video(video_path)
    stages["9. Pipeline execution success"] = bool(pipeline_res and pipeline_res.get("success") is True and pipeline_res.get("modelStatus") == "analyzed")

    # Stage 10: Final metrics contain populated observable values
    valid_metrics = (
        pipeline_res.get("framesProcessed", 0) > 0
        and pipeline_res.get("personDetectionRatio") is not None
        and pipeline_res.get("faceVisibilityRatio") is not None
        and pipeline_res.get("gazeAttentionRatio") is not None
        and pipeline_res.get("postureScore") is not None
        and pipeline_res.get("postureStability") in ["stable", "moderate_variation", "frequent_variation"]
        and pipeline_res.get("shoulderTiltDegrees") is not None
        and pipeline_res.get("cameraEngagement") in ["consistent_camera_alignment", "mixed_camera_alignment", "limited_camera_alignment"]
    )
    stages["10. Final metrics populated from real inference"] = valid_metrics

    # Print Report
    all_passed = True
    print("\nSTAGE RESULTS:")
    print("-" * 60)
    for name, passed in stages.items():
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str:4s}] {name}")
        if not passed:
            all_passed = False

    print("-" * 60)
    print("OVERALL RESULT:", "ALL STAGES PASSED" if all_passed else "SOME STAGES FAILED")
    print("-" * 60)
    print("\nSAMPLE OUTPUT METRICS:")
    summary = {
        "framesProcessed": pipeline_res.get("framesProcessed"),
        "personDetectionRatio": pipeline_res.get("personDetectionRatio"),
        "faceVisibilityRatio": pipeline_res.get("faceVisibilityRatio"),
        "gazeAttentionRatio": pipeline_res.get("gazeAttentionRatio"),
        "postureScore": pipeline_res.get("postureScore"),
        "postureStability": pipeline_res.get("postureStability"),
        "shoulderTiltDegrees": pipeline_res.get("shoulderTiltDegrees"),
        "cameraEngagement": pipeline_res.get("cameraEngagement"),
        "videoQualityIndicator": pipeline_res.get("videoQualityIndicator"),
        "modelStatus": pipeline_res.get("modelStatus"),
    }
    print(json.dumps(summary, indent=2))
    print("=" * 60)

    # Clean up temporary test video if auto-generated
    if auto_generated and os.path.exists(video_path):
        try:
            os.remove(video_path)
        except Exception:
            pass

    return all_passed

if __name__ == "__main__":
    v_path = sys.argv[1] if len(sys.argv) > 1 else None
    ok = run_diagnostic(v_path)
    sys.exit(0 if ok else 1)
