from __future__ import annotations

from collections import deque
from typing import Any

import cv2
import numpy as np


class TemporalMotionDetector:
    """
    Computes a motion anomaly score per frame.
    - When people are detected: diffs the union crop of all person bboxes.
    - Fallback: diffs a downscaled full frame.
    Uses a rolling buffer of diffs to smooth out single-frame noise.
    """

    def __init__(self, buffer_size: int = 6) -> None:
        self._diff_buffer: deque[float] = deque(maxlen=buffer_size)
        self._prev_crop: np.ndarray | None = None
        self._prev_full: np.ndarray | None = None

    def update(self, frame: np.ndarray, detections: list[dict[str, Any]] | None = None) -> dict[str, object]:
        h, w = frame.shape[:2]
        people = [d for d in (detections or []) if d.get("label") == "person" and d.get("box")]

        if people:
            x1 = max(0, min(d["box"][0] for d in people))
            y1 = max(0, min(d["box"][1] for d in people))
            x2 = min(w, max(d["box"][2] for d in people))
            y2 = min(h, max(d["box"][3] for d in people))

            if x2 > x1 + 4 and y2 > y1 + 4:
                crop = cv2.resize(frame[y1:y2, x1:x2], (96, 96), interpolation=cv2.INTER_AREA)
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                if self._prev_crop is not None:
                    raw = float(np.mean(cv2.absdiff(self._prev_crop, gray)) / 255.0)
                    self._diff_buffer.append(raw)
                self._prev_crop = gray

                if len(self._diff_buffer) < 2:
                    return {"anomaly_score": 0.0, "ready": False, "status": "warming_up"}

                score = float(np.mean(self._diff_buffer))
                # scale: typical idle ~0.01, active ~0.05+
                score = round(min(1.0, score * 8.0), 4)
                return {"anomaly_score": score, "ready": True, "status": "person_crop"}

        # fallback: full frame
        resized = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        if self._prev_full is not None:
            raw = float(np.mean(cv2.absdiff(self._prev_full, gray)) / 255.0)
            self._diff_buffer.append(raw)
        self._prev_full = gray

        if len(self._diff_buffer) < 2:
            return {"anomaly_score": 0.0, "ready": False, "status": "warming_up"}

        score = round(min(1.0, float(np.mean(self._diff_buffer)) * 4.0), 4)
        return {"anomaly_score": score, "ready": True, "status": "full_frame"}
