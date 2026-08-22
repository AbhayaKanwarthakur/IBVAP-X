from __future__ import annotations

from collections import deque

import cv2
import numpy as np


class TemporalMotionDetector:
    """Lightweight frame-difference signal used when no action model is configured."""

    def __init__(self, buffer_size: int = 8) -> None:
        self.frames: deque[np.ndarray] = deque(maxlen=buffer_size)

    def update(self, frame: np.ndarray) -> dict[str, object]:
        resized = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
        self.frames.append(resized)
        if len(self.frames) < self.frames.maxlen:
            return {"anomaly_score": 0.0, "ready": False, "status": "temporal_motion_detector_warming_up", "buffer_size": len(self.frames)}
        motion = float(np.mean(cv2.absdiff(self.frames[0], self.frames[-1])) / 255.0)
        return {"anomaly_score": round(min(1.0, motion * 3.0), 4), "ready": True, "status": "temporal_motion_detector", "buffer_size": len(self.frames)}