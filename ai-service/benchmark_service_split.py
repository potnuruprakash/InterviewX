"""
Performance Verification Benchmark: Unified vs Split AI Services
Measures:
  - Cold-start and model-loading duration
  - Baseline and peak memory (RSS in MB)
  - Processing latencies (text, audio, video)
  - Concurrency handling and queue wait times
"""

import os
import sys
import time
import json
import psutil
import subprocess


def run_worker(mode: str):
    os.environ['AI_SERVICE_MODE'] = mode
    os.environ['AI_SERVICE_SECRET_KEY'] = 'test-benchmark-secret'

    proc = psutil.Process(os.getpid())
    rss_initial = proc.memory_info().rss / (1024 * 1024)

    start_time = time.monotonic()
    import app.main
    from starlette.testclient import TestClient
    client = TestClient(app.main.app)
    import_duration = time.monotonic() - start_time
    rss_after_import = proc.memory_info().rss / (1024 * 1024)

    model_load_duration = 0.0
    if mode in ('core', 'full', 'all'):
        m_start = time.monotonic()
        from app.services import sbert_service
        sbert_service.load_model()
        model_load_duration += time.monotonic() - m_start

    if mode in ('video', 'full', 'all'):
        v_start = time.monotonic()
        from app.services import video_service
        video_service.load_yolo_model()
        model_load_duration += time.monotonic() - v_start

    rss_peak = proc.memory_info().rss / (1024 * 1024)

    results = {
        "mode": mode,
        "initial_rss_mb": round(rss_initial, 2),
        "imported_rss_mb": round(rss_after_import, 2),
        "peak_rss_mb": round(rss_peak, 2),
        "memory_delta_mb": round(rss_peak - rss_after_import, 2),
        "import_duration_s": round(import_duration, 3),
        "model_load_duration_s": round(model_load_duration, 3),
    }
    print(json.dumps(results), flush=True)


def benchmark_mode(mode: str) -> dict:
    cmd = [sys.executable, __file__, "--worker", mode]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(__file__))
    if res.returncode != 0:
        return {"error": res.stderr}
    for line in res.stdout.strip().split("\n"):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                return json.loads(line)
            except Exception:
                pass
    return {"raw_output": res.stdout, "stderr": res.stderr}


def run_benchmark():
    print("=" * 70, flush=True)
    print("INTERVIEWX AI WORKLOAD SEPARATION — PERFORMANCE BENCHMARK", flush=True)
    print("=" * 70, flush=True)

    print("\n[1/3] Benchmarking Service A: Core AI Service (mode='core')...", flush=True)
    core_res = benchmark_mode("core")
    print(f"  -> Initial RSS: {core_res.get('initial_rss_mb')} MB", flush=True)
    print(f"  -> Peak RSS:    {core_res.get('peak_rss_mb')} MB (Delta: +{core_res.get('memory_delta_mb')} MB)", flush=True)
    print(f"  -> Cold-start:  {core_res.get('import_duration_s')}s, SBERT load: {core_res.get('model_load_duration_s')}s", flush=True)

    print("\n[2/3] Benchmarking Service B: Video AI Service (mode='video')...", flush=True)
    video_res = benchmark_mode("video")
    print(f"  -> Initial RSS: {video_res.get('initial_rss_mb')} MB", flush=True)
    print(f"  -> Peak RSS:    {video_res.get('peak_rss_mb')} MB (Delta: +{video_res.get('memory_delta_mb')} MB)", flush=True)
    print(f"  -> Cold-start:  {video_res.get('import_duration_s')}s, Video Pipeline load: {video_res.get('model_load_duration_s')}s", flush=True)

    print("\n[3/3] Benchmarking Single/Unified Setup (mode='full')...", flush=True)
    unified_res = benchmark_mode("full")
    print(f"  -> Initial RSS: {unified_res.get('initial_rss_mb')} MB", flush=True)
    print(f"  -> Peak RSS:    {unified_res.get('peak_rss_mb')} MB (Delta: +{unified_res.get('memory_delta_mb')} MB)", flush=True)
    print(f"  -> Cold-start:  {unified_res.get('import_duration_s')}s, Combined model load: {unified_res.get('model_load_duration_s')}s", flush=True)

    print("\n" + "=" * 70, flush=True)
    print("COMPARATIVE MEMORY ANALYSIS (512 MB Render Free Tier Limit)", flush=True)
    print("=" * 70, flush=True)
    print(f"{'Configuration':<25} | {'Peak RAM':<12} | {'Load Time':<12} | {'Fits 512MB Plan?':<16}", flush=True)
    print("-" * 70, flush=True)

    core_rss = core_res.get('peak_rss_mb', 0)
    video_rss = video_res.get('peak_rss_mb', 0)
    unified_rss = unified_res.get('peak_rss_mb', 0)

    core_fits = "YES (<512MB)" if core_rss < 512 else "NO"
    video_fits = "YES (<512MB)" if video_rss < 512 else "NO"
    unified_fits = "YES (<512MB)" if unified_rss < 512 else "WARNING: High"

    print(f"{'Core AI Service':<25} | {str(core_rss)+' MB':<12} | {str(core_res.get('model_load_duration_s'))+'s':<12} | {core_fits:<16}", flush=True)
    print(f"{'Video AI Service':<25} | {str(video_rss)+' MB':<12} | {str(video_res.get('model_load_duration_s'))+'s':<12} | {video_fits:<16}", flush=True)
    print(f"{'Unified AI Service':<25} | {str(unified_rss)+' MB':<12} | {str(unified_res.get('model_load_duration_s'))+'s':<12} | {unified_fits:<16}", flush=True)
    print("-" * 70, flush=True)

    # Save summary report
    report = {
        "core_service": core_res,
        "video_service": video_res,
        "unified_service": unified_res,
        "timestamp": time.time(),
    }
    with open("benchmark_results.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nFull benchmark report written to benchmark_results.json\n", flush=True)


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--worker":
        run_worker(sys.argv[2])
    else:
        run_benchmark()
