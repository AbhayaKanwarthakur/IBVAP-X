"""
zone_engine.py
--------------
Behavior/anomaly rule engine for IBVAP-X.

Operates on ByteTrack track histories (track_id -> list of (t, cx, cy, cls))
and produces behavior signals that feed into the existing Context/Risk
Engine. This module never assigns identity or "criminal" labels — it only
scores behaviors (loitering, restricted-zone entry, abandoned objects,
running/aggressive motion).

Integration point: call `ZoneEngine.update(detections, timestamp)` once per
frame from ai/main.py, after ByteTrack has assigned track IDs. It returns a
list of behavior signal dicts that you merge into the existing context/risk
payload alongside the temporal anomaly signal.
"""

from __future__ import annotations
import time
import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional


Point = Tuple[float, float]
Polygon = List[Point]


def point_in_polygon(point: Point, polygon: Polygon) -> bool:
    """Standard ray-casting point-in-polygon test."""
    x, y = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


@dataclass
class ZoneDef:
    name: str
    polygon: Polygon
    rule: str  # "restricted" | "loiter"
    loiter_seconds: float = 8.0
    loiter_max_displacement_px: float = 40.0


@dataclass
class TrackHistory:
    track_id: int
    cls: str
    points: deque = field(default_factory=lambda: deque(maxlen=300))  # (t, cx, cy)
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    zones_entered: Dict[str, float] = field(default_factory=dict)  # zone_name -> entry_time


class ZoneEngine:
    def __init__(self, config: dict):
        """
        config example (goes in ai/config.json under "zone_engine"):

        {
          "zones": [
            {
              "name": "restricted_dock",
              "polygon": [[100,100],[400,100],[400,400],[100,400]],
              "rule": "restricted"
            },
            {
              "name": "lobby",
              "polygon": [[0,0],[640,0],[640,480],[0,480]],
              "rule": "loiter",
              "loiter_seconds": 10,
              "loiter_max_displacement_px": 50
            }
          ],
          "running_speed_px_per_s": 250,
          "abandoned_object_seconds": 15,
          "abandoned_object_classes": ["backpack", "handbag", "suitcase"],
          "person_classes": ["person"]
        }
        """
        self.zones: List[ZoneDef] = [
            ZoneDef(
                name=z["name"],
                polygon=[tuple(p) for p in z["polygon"]],
                rule=z["rule"],
                loiter_seconds=z.get("loiter_seconds", 8.0),
                loiter_max_displacement_px=z.get("loiter_max_displacement_px", 40.0),
            )
            for z in config.get("zones", [])
        ]
        self.running_speed_threshold = config.get("running_speed_px_per_s", 250)
        self.abandoned_object_seconds = config.get("abandoned_object_seconds", 15)
        self.abandoned_object_classes = set(
            config.get("abandoned_object_classes", ["backpack", "handbag", "suitcase"])
        )
        self.person_classes = set(config.get("person_classes", ["person"]))

        self.tracks: Dict[int, TrackHistory] = {}
        # object_track_id -> last time a person track was near it
        self.object_last_near_person: Dict[int, float] = {}

    def update(self, detections: List[dict], timestamp: Optional[float] = None) -> List[dict]:
        """
        detections: list of {track_id, cls, bbox: [x1,y1,x2,y2]}
        Returns list of signal dicts:
          {"type": "restricted_zone_entry"|"loitering"|"running"|"abandoned_object",
           "track_id": int, "zone": str|None, "detail": str, "severity": float}
        """
        ts = timestamp or time.time()
        signals: List[dict] = []

        active_ids = set()
        person_positions: List[Tuple[float, float]] = []

        for det in detections:
            tid = det["track_id"]
            cls = det["cls"]
            x1, y1, x2, y2 = det["bbox"]
            cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
            active_ids.add(tid)

            hist = self.tracks.get(tid)
            if hist is None:
                hist = TrackHistory(track_id=tid, cls=cls)
                self.tracks[tid] = hist
            hist.points.append((ts, cx, cy))
            hist.last_seen = ts

            if cls in self.person_classes:
                person_positions.append((cx, cy))
                signals.extend(self._check_zones(hist, (cx, cy), ts))
                signals.extend(self._check_running(hist, ts))

        signals.extend(
            self._check_abandoned_objects(detections, person_positions, ts)
        )

        # prune stale tracks (not seen in 60s)
        stale = [tid for tid, h in self.tracks.items() if ts - h.last_seen > 60]
        for tid in stale:
            del self.tracks[tid]

        return signals

    def _check_zones(self, hist: TrackHistory, pos: Point, ts: float) -> List[dict]:
        out = []
        for zone in self.zones:
            inside = point_in_polygon(pos, zone.polygon)
            entered_at = hist.zones_entered.get(zone.name)

            if inside and entered_at is None:
                hist.zones_entered[zone.name] = ts
                if zone.rule == "restricted":
                    out.append({
                        "type": "restricted_zone_entry",
                        "track_id": hist.track_id,
                        "zone": zone.name,
                        "detail": f"track {hist.track_id} entered restricted zone '{zone.name}'",
                        "severity": 0.8,
                    })
            elif inside and zone.rule == "loiter" and entered_at is not None:
                dwell = ts - entered_at
                if dwell >= zone.loiter_seconds:
                    disp = self._recent_displacement(hist, zone.loiter_seconds)
                    if disp <= zone.loiter_max_displacement_px:
                        out.append({
                            "type": "loitering",
                            "track_id": hist.track_id,
                            "zone": zone.name,
                            "detail": f"track {hist.track_id} loitering in '{zone.name}' for {dwell:.0f}s",
                            "severity": min(0.3 + dwell / 60.0, 0.9),
                        })
            elif not inside and entered_at is not None:
                del hist.zones_entered[zone.name]
        return out

    def _recent_displacement(self, hist: TrackHistory, window_s: float) -> float:
        pts = [p for p in hist.points if hist.points[-1][0] - p[0] <= window_s]
        if len(pts) < 2:
            return 0.0
        xs = [p[1] for p in pts]
        ys = [p[2] for p in pts]
        return math.hypot(max(xs) - min(xs), max(ys) - min(ys))

    def _check_running(self, hist: TrackHistory, ts: float) -> List[dict]:
        if len(hist.points) < 2:
            return []
        (t0, x0, y0), (t1, x1, y1) = hist.points[-2], hist.points[-1]
        dt = max(t1 - t0, 1e-3)
        speed = math.hypot(x1 - x0, y1 - y0) / dt
        if speed >= self.running_speed_threshold:
            return [{
                "type": "running",
                "track_id": hist.track_id,
                "zone": None,
                "detail": f"track {hist.track_id} moving at {speed:.0f}px/s",
                "severity": min(0.4 + speed / 1000.0, 0.85),
            }]
        return []

    def _check_abandoned_objects(
        self, detections: List[dict], person_positions: List[Point], ts: float
    ) -> List[dict]:
        out = []
        for det in detections:
            cls = det["cls"]
            if cls not in self.abandoned_object_classes:
                continue
            tid = det["track_id"]
            x1, y1, x2, y2 = det["bbox"]
            ocx, ocy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

            near_person = any(
                math.hypot(ocx - px, ocy - py) < 120 for (px, py) in person_positions
            )
            if near_person:
                self.object_last_near_person[tid] = ts
            else:
                last_near = self.object_last_near_person.get(tid, ts)
                unattended_for = ts - last_near
                if unattended_for >= self.abandoned_object_seconds:
                    out.append({
                        "type": "abandoned_object",
                        "track_id": tid,
                        "zone": None,
                        "detail": f"{cls} (track {tid}) unattended for {unattended_for:.0f}s",
                        "severity": min(0.3 + unattended_for / 60.0, 0.9),
                    })
        return out
