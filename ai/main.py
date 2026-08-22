from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone
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
    from persona_engine import EmbeddingModel, PersonaEngine
except ImportError:
    EmbeddingModel = None
    PersonaEngine = None

app = FastAPI(title="IBVAP-X AI Service", version="1.0.0")
detector = YoloByteTrackDetector()
motion_detector = TemporalMotionDetector()
risk_engine = RiskEngine()
context_engine = ContextEngine(risk_engine.config)
zone_engine = ZoneEngine(risk_engine.config.get("zone_engine", {}))
persona_enabled = os.getenv("PERSONA_MATCHING_ENABLED", "false").lower() == "true"
persona_model = None
persona_engine = None
if persona_enabled and EmbeddingModel is not None and PersonaEngine is not None:
    persona_model = EmbeddingModel(device=os.getenv("PERSONA_DEVICE", "cpu"))
    persona_engine = PersonaEngine(store_path=os.getenv("PERSONA_STORE", os.path.join(os.path.dirname(os.path.dirname(__file__)), "personas.json")))
track_history = TrackHistory()
last_metrics = {"input_fps": 0.0, "inference_fps": 0.0, "detection_latency_ms": 0.0, "motion_latency_ms": 0.0, "persona_latency_ms": 0.0, "total_latency_ms": 0.0}

class FrameRequest(BaseModel):
    camera_id: str = Field(default="CAM-PHONE")
    image_base64: str

@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "ibvap-ai", "models": {"yolo": detector.model_name, "plate": detector.plate_status, "ocr": detector.ocr_status, "bytetrack": True, "temporal": "motion", "persona_matching": "enabled" if persona_engine is not None else "disabled"}, "metrics": last_metrics}

@app.post("/infer/frame")
def infer_frame(payload: FrameRequest, request: Request) -> dict[str, Any]:
    del request
    started = time.perf_counter()
    try:
        encoded = payload.image_base64.split(",", 1)[-1]
        import base64
        frame = decode_frame(base64.b64decode(encoded))
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid frame: {error}") from error
    height, width = frame.shape[:2]
    detection_started = time.perf_counter()
    detections = detector.infer(frame)
    detection_latency = (time.perf_counter() - detection_started) * 1000
    track_history.update(detections, width, height)
    tracked_detections = [{"track_id": item["track_id"], "cls": item["label"], "bbox": item["box"]} for item in detections if item.get("track_id") is not None]
    behavior_signals = zone_engine.update(tracked_detections)
    persona_started = time.perf_counter()
    persona_matches = []
    if persona_model is not None and persona_engine is not None:
        for detection in detections:
            if detection.get("label") != "person" or detection.get("track_id") is None:
                continue
            x1, y1, x2, y2 = detection["box"]
            crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
            if crop.size == 0:
                continue
            embedding = persona_model.get_embedding(Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
            if embedding is not None:
                match = persona_engine.match(embedding)
                if match is not None:
                    detection["persona_match"] = match
                    persona_matches.append({"track_id": detection["track_id"], **match})
    persona_latency = (time.perf_counter() - persona_started) * 1000
    motion_started = time.perf_counter()
    temporal = motion_detector.update(frame)
    motion_latency = (time.perf_counter() - motion_started) * 1000
    context = context_engine.evaluate(detections, track_history, width, height)
    risk = risk_engine.score(temporal["anomaly_score"], context, behavior_signals)
    total_latency = (time.perf_counter() - started) * 1000
    last_metrics.update({"inference_fps": round(1000 / max(total_latency, 1), 2), "detection_latency_ms": round(detection_latency, 2), "motion_latency_ms": round(motion_latency, 2), "persona_latency_ms": round(persona_latency, 2), "total_latency_ms": round(total_latency, 2)})
    return {"type": "ai_alert" if risk["alert"] else "ai_update", "timestamp": datetime.now(timezone.utc).isoformat(), "camera_id": payload.camera_id, "detections": detections, "frame_size": {"width": width, "height": height}, "anomaly_score": temporal["anomaly_score"], "risk_score": risk["risk_score"], "severity": risk["severity"], "context": context, "behavior_signals": behavior_signals, "persona_matches": persona_matches, "signals": risk["signals"], "metrics": last_metrics, "models": {"yolo": detector.model_name, "plate": detector.plate_status, "ocr": detector.ocr_status}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("AI_PORT", "9000")), reload=False)
