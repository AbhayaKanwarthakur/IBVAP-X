from __future__ import annotations

import base64
import os
import sys
import time
import json as _json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pipeline.detector import YoloByteTrackDetector
from pipeline.feature_extractor import decode_frame
from pipeline.motion_detector import TemporalMotionDetector
from pipeline.risk_engine import ContextEngine, RiskEngine
from pipeline.tracker import TrackHistory
from zone_engine import ZoneEngine

try:
    from pipeline.rtfm_buffer import RTFMTrackBuffer
except Exception:
    RTFMTrackBuffer = None

try:
    from persona_engine import EmbeddingModel, PersonaEngine
except ImportError:
    EmbeddingModel = None
    PersonaEngine = None

app = FastAPI(title="IBVAP-X AI Service", version="1.0.0")
detector = YoloByteTrackDetector()
motion_detector = TemporalMotionDetector()
risk_engine = RiskEngine()
context_engine = ContextEngine(risk_engine.config)

_state_file = Path(__file__).resolve().parents[1] / "server" / "data" / "state.json"
_zones_mtime: float = 0.0

def _build_zone_cfg() -> dict:
    base_cfg = risk_engine.config.get("zone_engine", {})
    try:
        state = _json.loads(_state_file.read_text(encoding="utf-8"))
        custom = state.get("customZones", [])
        if custom:
            return {**base_cfg, "zones": custom}
    except Exception:
        pass
    return base_cfg

zone_engine = ZoneEngine(_build_zone_cfg())

def _reload_zones_if_changed() -> None:
    global _zones_mtime
    try:
        mtime = _state_file.stat().st_mtime
        if mtime <= _zones_mtime:
            return
        _zones_mtime = mtime
        zone_engine.__init__(_build_zone_cfg())
        print(f"[ZONES] reloaded {len(zone_engine.zones)} zone(s)", flush=True)
    except Exception as e:
        print(f"[ZONES] reload error: {e}", flush=True)

# persona
persona_enabled = os.getenv("PERSONA_MATCHING_ENABLED", "false").lower() == "true"
persona_model = None
persona_engine = None
if persona_enabled and EmbeddingModel is not None and PersonaEngine is not None:
    persona_model = EmbeddingModel(device=os.getenv("PERSONA_DEVICE", "cpu"))
    persona_engine = PersonaEngine(
        store_path=os.getenv("PERSONA_STORE",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "personas.json"))
    )

track_history = TrackHistory()

rtfm_buffer: RTFMTrackBuffer | None = None
if RTFMTrackBuffer is not None:
    try:
        rtfm_buffer = RTFMTrackBuffer(device=os.getenv("AI_DEVICE", "cpu"))
    except Exception as e:
        print(f"[RTFM] failed to load: {e}")

_suppressed_zones: set[str] = {
    z["name"] for z in risk_engine.config.get("zone_engine", {}).get("zones", [])
    if z.get("suppress_rtfm")
}

last_metrics: dict[str, float] = {
    "input_fps": 0.0, "inference_fps": 0.0,
    "detection_latency_ms": 0.0, "motion_latency_ms": 0.0,
    "persona_latency_ms": 0.0, "total_latency_ms": 0.0,
}
persona_track_memory: dict[tuple[str, int], dict[str, Any]] = {}
_last_frame_ts: float = 0.0
_min_frame_interval: float = float(os.getenv("MIN_FRAME_INTERVAL_MS", "80")) / 1000.0


class FrameRequest(BaseModel):
    camera_id: str = Field(default="CAM-PHONE")
    session_id: str | None = None
    image_base64: str


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ibvap-ai",
        "models": {
            "yolo": detector.model_name,
            "plate": detector.plate_status,
            "ocr": detector.ocr_status,
            "bytetrack": True,
            "temporal": "motion",
            "persona_matching": "enabled" if persona_engine else "disabled",
            "rtfm": "loaded" if rtfm_buffer else "disabled",
        },
        "metrics": last_metrics,
        "active_zones": len(zone_engine.zones),
    }


@app.post("/infer/frame")
def infer_frame(payload: FrameRequest, request: Request) -> dict[str, Any]:
    global _last_frame_ts
    del request
    started = time.perf_counter()

    # rate-limit: drop frame if previous inference is still too recent
    now = time.time()
    if now - _last_frame_ts < _min_frame_interval:
        raise HTTPException(status_code=429, detail="Frame rate too high")
    _last_frame_ts = now

    # decode
    try:
        encoded = payload.image_base64.split(",", 1)[-1]
        raw = base64.b64decode(encoded)
        frame = decode_frame(raw)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid frame: {error}") from error

    height, width = frame.shape[:2]

    # reload zones if state.json changed
    _reload_zones_if_changed()

    # ── detection + tracking ──────────────────────────────────────────────────
    t0 = time.perf_counter()
    detections = detector.infer(frame)
    detection_latency = (time.perf_counter() - t0) * 1000

    track_history.update(detections, width, height)

    tracked = [
        {"track_id": d["track_id"], "cls": d["label"], "bbox": d["box"]}
        for d in detections if d.get("track_id") is not None
    ]

    # ── zone + behaviour signals ──────────────────────────────────────────────
    behavior_signals = zone_engine.update(tracked, width=width, height=height)

    # ── persona matching ──────────────────────────────────────────────────────
    t1 = time.perf_counter()
    persona_matches: list[dict] = []
    persona_candidates = 0
    persona_face_embeddings = 0
    persona_threshold_misses = 0
    if persona_model and persona_engine:
        for d in detections:
            if d.get("label") != "person" or d.get("track_id") is None:
                continue
            persona_candidates += 1
            x1, y1, x2, y2 = d["box"]
            crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
            key = (payload.session_id or payload.camera_id, int(d["track_id"]))
            match = None
            if crop.size:
                # Faces are usually in the upper portion of a person box; keep
                # the full box as a fallback for close-up or unusual framing.
                upper_crop = crop[:max(1, int(crop.shape[0] * 0.72)), :]
                for candidate in (upper_crop, crop):
                    emb = persona_model.get_embedding(Image.fromarray(cv2.cvtColor(candidate, cv2.COLOR_BGR2RGB)))
                    if emb is None:
                        continue
                    persona_face_embeddings += 1
                    candidate_match = persona_engine.match(emb)
                    if candidate_match and (match is None or candidate_match["similarity"] > match["similarity"]):
                        match = candidate_match
            if match:
                match["match_source"] = "face_reference"
                persona_track_memory[key] = {"match": match, "misses": 0}
            elif key in persona_track_memory and persona_track_memory[key]["misses"] < 10:
                persona_track_memory[key]["misses"] += 1
                match = {**persona_track_memory[key]["match"], "match_source": "track_memory"}
            else:
                persona_threshold_misses += 1
                persona_track_memory.pop(key, None)
            if match:
                d["persona_match"] = match
                persona_matches.append({"track_id": d["track_id"], **match})
                behavior_signals.append({
                    "type": "synthetic_persona_match",
                    "track_id": d["track_id"],
                    "zone": None,
                    "detail": f"synthetic demo profile matched on track {d['track_id']}",
                    "severity": 0.8,
                    "profile_label": match.get("profile_label"),
                    "reference_angle": match.get("reference_angle"),
                })
    persona_latency = (time.perf_counter() - t1) * 1000

    # ── temporal motion ───────────────────────────────────────────────────────
    t2 = time.perf_counter()
    temporal = motion_detector.update(frame, detections)
    motion_latency = (time.perf_counter() - t2) * 1000

    # ── context + RTFM ───────────────────────────────────────────────────────
    context = context_engine.evaluate(detections, track_history, width, height)

    if rtfm_buffer is not None:
        behavior_signals.extend(
            rtfm_buffer.update_all(
                detections, frame, height, width,
                behavior_signals, _suppressed_zones,
                temporal["anomaly_score"], context,
            )
        )

    # ── weapon detection signal ──────────────────────────────────────────────
    weapon_classes: set[str] = set(risk_engine.config.get("weapon_classes", ["knife", "scissors"]))
    weapon_detections = [d for d in detections if d.get("label") in weapon_classes]
    if weapon_detections:
        best_conf = max(d["confidence"] for d in weapon_detections)
        behavior_signals.append({
            "type": "weapon_detected",
            "severity": 1.0,
            "confidence": best_conf,
            "labels": list({d["label"] for d in weapon_detections}),
            "track_id": weapon_detections[0].get("track_id"),
        })

    # ── risk score ────────────────────────────────────────────────────────────
    risk = risk_engine.score(temporal["anomaly_score"], context, behavior_signals)
    risk_by_track = []
    for detection in detections:
        if detection.get("label") != "person" or detection.get("track_id") is None:
            continue
        track_id = int(detection["track_id"])
        track_risk = risk_engine.score_track(track_id, temporal["anomaly_score"], context, behavior_signals)
        risk_by_track.append({"track_id": track_id, "risk_score": track_risk["risk_score"], "severity": track_risk["severity"], "signals": track_risk["signals"]})

    total_latency = (time.perf_counter() - started) * 1000
    last_metrics.update({
        "inference_fps": round(1000 / max(total_latency, 1), 2),
        "detection_latency_ms": round(detection_latency, 2),
        "motion_latency_ms": round(motion_latency, 2),
        "persona_latency_ms": round(persona_latency, 2),
        "total_latency_ms": round(total_latency, 2),
    })

    return {
        "type": "ai_alert" if risk["alert"] else "ai_update",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "camera_id": payload.camera_id,
        "detections": detections,
        "frame_size": {"width": width, "height": height},
        "anomaly_score": temporal["anomaly_score"],
        "risk_score": risk["risk_score"],
        "risk_by_track": risk_by_track,
        "severity": risk["severity"],
        "context": context,
        "behavior_signals": behavior_signals,
        "persona_matches": persona_matches,
        "persona_diagnostics": {
            "enabled": bool(persona_model and persona_engine),
            "person_candidates": persona_candidates,
            "face_embeddings": persona_face_embeddings,
            "threshold_misses": persona_threshold_misses,
            "matches": len(persona_matches),
            "threshold": persona_engine.match_threshold if persona_engine else None,
        },
        "signals": risk["signals"],
        "metrics": last_metrics,
        "models": {
            "yolo": detector.model_name,
            "plate": detector.plate_status,
            "ocr": detector.ocr_status,
            "rtfm": "loaded" if rtfm_buffer else "disabled",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("AI_PORT", "9000")), reload=False)
