from __future__ import annotations

from collections import defaultdict, deque
from typing import Any


class TrackHistory:
    """Bounded per-track center history for context signals."""

    def __init__(self, max_points: int = 64) -> None:
        self.points: dict[int, deque[tuple[float, float]]] = defaultdict(lambda: deque(maxlen=max_points))

    def update(self, detections: list[dict[str, Any]], width: int, height: int) -> None:
        for detection in detections:
            track_id = detection.get("track_id")
            if track_id is None:
                continue
            x1, y1, x2, y2 = detection["box"]
            self.points[int(track_id)].append(((x1 + x2) / 2 / width, (y1 + y2) / 2 / height))

    def loitering_score(self, track_id: int | None) -> float:
        if track_id is None or len(self.points[int(track_id)]) < 8:
            return 0.0
        points = self.points[int(track_id)]
        displacement = abs(points[-1][0] - points[0][0]) + abs(points[-1][1] - points[0][1])
        return max(0.0, min(1.0, 1.0 - displacement * 5.0))
