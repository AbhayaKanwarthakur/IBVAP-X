"""
rtfm_buffer.py
--------------
Per-track anomaly scorer using ResNet50 feature magnitude.
No checkpoint required — magnitude IS the signal (RTFM's core insight).

False-positive suppression layers:
  1. Duration gate      — spike must persist for MIN_SPIKE_FRAMES consecutive frames
  2. Cross-signal gate  — fires when ANY of these agree:
                            a) zone_engine produced a signal this frame
                            b) temporal motion anomaly_score >= MOTION_AGREE_THRESHOLD
                            c) context loitering or suspicious_objects > 0
                            d) GROUP_MIN_TRACKS+ tracks spiking simultaneously
  3. Zone suppression   — zones with suppress_rtfm=true silence this signal
  4. Severity scaling   — scales with sustained duration, not binary on/off
"""
from __future__ import annotations

import os
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
import torch
import torchvision.models as models
import torchvision.transforms as T

# ── tunables ──────────────────────────────────────────────────────────────────
WARMUP_FRAMES         = int(os.getenv("RTFM_WARMUP", "10"))
Z_THRESHOLD           = float(os.getenv("RTFM_Z_THRESHOLD", "2.0"))
MIN_SPIKE_FRAMES      = int(os.getenv("RTFM_MIN_SPIKE_FRAMES", "5"))
GROUP_MIN_TRACKS      = int(os.getenv("RTFM_GROUP_MIN", "2"))
MOTION_AGREE_THRESHOLD = float(os.getenv("RTFM_MOTION_AGREE", "0.15"))
BASELINE_WINDOW       = 60
CROP_SIZE             = 224

_normalize = T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
_to_tensor  = T.ToTensor()


def _preprocess(crop_bgr: np.ndarray) -> torch.Tensor:
    rgb = cv2.cvtColor(cv2.resize(crop_bgr, (CROP_SIZE, CROP_SIZE)), cv2.COLOR_BGR2RGB)
    return _normalize(_to_tensor(rgb))


@dataclass
class _TrackState:
    norms: deque = field(default_factory=lambda: deque(maxlen=BASELINE_WINDOW))
    spike_frames: int = 0
    sustained_frames: int = 0


class RTFMTrackBuffer:
    def __init__(self, device: str | None = None) -> None:
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        backbone = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
        self._backbone = torch.nn.Sequential(*list(backbone.children())[:-1]).to(self.device)
        self._backbone.eval()

        self._tracks: dict[int, _TrackState] = defaultdict(_TrackState)

    @torch.no_grad()
    def _magnitude(self, crop_bgr: np.ndarray) -> float:
        x = _preprocess(crop_bgr).unsqueeze(0).to(self.device)
        feat = self._backbone(x).squeeze()
        return float(torch.linalg.norm(feat).cpu())

    def _z_score(self, state: _TrackState, norm: float) -> float:
        if len(state.norms) < WARMUP_FRAMES:
            return 0.0
        arr = np.array(state.norms)
        std = arr.std()
        if std < 1e-6:
            return 0.0
        return (norm - arr.mean()) / std

    def _cross_signal_agrees(
        self,
        zone_signals: list[dict[str, Any]],
        temporal_score: float,
        context: dict[str, float],
        spiking_track_count: int,
    ) -> bool:
        """Layer 2: at least one external signal must agree."""
        if zone_signals:
            return True
        if temporal_score >= MOTION_AGREE_THRESHOLD:
            return True
        if context.get("loitering", 0.0) > 0.0 or context.get("suspicious_objects", 0.0) > 0.0:
            return True
        if spiking_track_count >= GROUP_MIN_TRACKS:
            return True
        return False

    def update_all(
        self,
        detections: list[dict[str, Any]],
        frame: np.ndarray,
        height: int,
        width: int,
        zone_signals: list[dict[str, Any]],
        suppressed_zones: set[str],
        temporal_score: float = 0.0,
        context: dict[str, float] | None = None,
    ) -> list[dict[str, Any]]:
        context = context or {}
        signals: list[dict[str, Any]] = []

        # ── layer 3: which zones are suppressed this frame ────────────────────
        active_zone_names = {s.get("zone") for s in zone_signals if s.get("zone")}
        zone_suppressed = bool(suppressed_zones & active_zone_names)

        # ── extract magnitude + update per-track state ────────────────────────
        spiking_tracks: list[int] = []
        per_track_data: list[tuple[int, float, _TrackState]] = []

        for det in detections:
            if det.get("label") != "person" or det.get("track_id") is None:
                continue
            x1, y1, x2, y2 = det["box"]
            crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
            if crop.size == 0:
                continue

            tid   = int(det["track_id"])
            state = self._tracks[tid]
            norm  = self._magnitude(crop)
            z     = self._z_score(state, norm)
            state.norms.append(norm)

            spiking = z >= Z_THRESHOLD

            # layer 1: duration gate
            if spiking:
                state.spike_frames     += 1
                state.sustained_frames += 1
            else:
                state.spike_frames     = 0
                state.sustained_frames = 0

            if state.spike_frames >= MIN_SPIKE_FRAMES:
                spiking_tracks.append(tid)

            per_track_data.append((tid, z, state))

        # ── layer 2: cross-signal gate (evaluated once per frame) ─────────────
        if not self._cross_signal_agrees(zone_signals, temporal_score, context, len(spiking_tracks)):
            return []

        # ── layer 3: zone suppression ─────────────────────────────────────────
        if zone_suppressed:
            return []

        # ── emit signals for tracks that passed layer 1 ───────────────────────
        for tid, z, state in per_track_data:
            if state.spike_frames < MIN_SPIKE_FRAMES:
                continue
            # layer 4: severity scales with sustained duration
            severity = min(0.3 + state.sustained_frames / 120.0, 0.9)
            signals.append({
                "type": "activity_anomaly_rtfm",
                "track_id": tid,
                "zone": None,
                "detail": (
                    f"track {tid} visual anomaly z={z:.1f} "
                    f"sustained {state.sustained_frames} frames"
                ),
                "severity": round(severity, 3),
            })

        return signals

    def evict(self, track_id: int) -> None:
        self._tracks.pop(track_id, None)
