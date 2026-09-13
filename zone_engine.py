from __future__ import annotations
import time
import math
from collections import deque
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional

Point = Tuple[float, float]
Polygon = List[Point]

# ── geometry ──────────────────────────────────────────────────────────────────

def point_in_polygon(point: Point, polygon: Polygon) -> bool:
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside

def dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])

def nearest_edge_dist(point: Point, polygon: Polygon) -> float:
    """Distance from point to nearest polygon edge (normalized coords)."""
    min_d = float("inf")
    n = len(polygon)
    for i in range(n):
        ax, ay = polygon[i]
        bx, by = polygon[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((point[0]-ax)*dx + (point[1]-ay)*dy) / (dx*dx + dy*dy + 1e-12)))
        px, py = ax + t*dx, ay + t*dy
        d = math.hypot(point[0]-px, point[1]-py)
        if d < min_d:
            min_d = d
    return min_d

# ── data classes ──────────────────────────────────────────────────────────────

@dataclass
class ZoneDef:
    name: str
    polygon: Polygon
    rule: str                          # "restricted" | "loiter"
    loiter_seconds: float = 20.0
    loiter_max_displacement: float = 0.08   # normalized (fraction of frame)

@dataclass
class TrackState:
    track_id: int
    cls: str
    # (timestamp, ncx, ncy)
    points: deque = field(default_factory=lambda: deque(maxlen=600))
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    last_box: Optional[Tuple[int, int, int, int]] = None
    missing_frames: int = 0
    exit_emitted: bool = False
    zones_entered: Dict[str, float] = field(default_factory=dict)
    zone_reentry: Dict[str, int] = field(default_factory=dict)      # re-entry count
    last_loiter_signal: Dict[str, float] = field(default_factory=dict)  # throttle
    last_signal_type: Dict[str, float] = field(default_factory=dict)    # general throttle

# ── engine ────────────────────────────────────────────────────────────────────

class ZoneEngine:
    def __init__(self, config: dict) -> None:
        ze = config if "zones" in config else config.get("zone_engine", config)
        self.zones: List[ZoneDef] = [
            ZoneDef(
                name=z["name"],
                polygon=[tuple(p) for p in z["polygon"]],
                rule=z.get("rule", "loiter"),
                loiter_seconds=float(z.get("loiter_seconds", 20.0)),
                loiter_max_displacement=float(z.get("loiter_max_displacement_px", 120)) / 1000.0
                    if z.get("loiter_max_displacement_px", 120) > 1
                    else float(z.get("loiter_max_displacement_px", 0.08)),
            )
            for z in ze.get("zones", [])
        ]
        self.running_speed_px_per_s = float(ze.get("running_speed_px_per_s", 250))
        self.abandoned_seconds = float(ze.get("abandoned_object_seconds", 15))
        self.abandoned_classes = set(ze.get("abandoned_object_classes", ["backpack", "handbag", "suitcase"]))
        self.person_classes = set(ze.get("person_classes", ["person"]))

        # crowd config
        self.crowd_threshold = int(ze.get("crowd_threshold", 4))
        self.crowd_radius = float(ze.get("crowd_radius", 0.15))   # normalized

        self.tracks: Dict[int, TrackState] = {}
        self.object_last_near_person: Dict[int, float] = {}

    # ── public ────────────────────────────────────────────────────────────────

    def update(
        self,
        detections: List[dict],
        timestamp: Optional[float] = None,
        width: int = 1,
        height: int = 1,
    ) -> List[dict]:
        ts = timestamp or time.time()
        signals: List[dict] = []
        person_positions: List[Point] = []
        person_states: List[TrackState] = []
        seen_ids = set()

        for det in detections:
            tid = det.get("track_id")
            if tid is None:
                continue
            cls = det["cls"]
            x1, y1, x2, y2 = det["bbox"]
            ncx = (x1 + x2) / 2.0 / max(width, 1)
            ncy = (y1 + y2) / 2.0 / max(height, 1)
            pos: Point = (ncx, ncy)

            state = self.tracks.get(tid)
            if state is None:
                state = TrackState(track_id=tid, cls=cls)
                self.tracks[tid] = state
            state.points.append((ts, ncx, ncy))
            state.last_seen = ts
            state.last_box = (int(x1), int(y1), int(x2), int(y2))
            state.missing_frames = 0
            state.exit_emitted = False
            seen_ids.add(tid)

            if cls in self.person_classes:
                person_positions.append(pos)
                person_states.append(state)
                signals.extend(self._check_zones(state, pos, ts))
                signals.extend(self._check_running(state, ts, width, height))
                signals.extend(self._check_pacing(state, ts))
                signals.extend(self._check_perimeter_hugging(state, pos, ts))
                signals.extend(self._check_sudden_stop(state, ts))

        signals.extend(self._check_fighting(person_states, ts, width, height))
        signals.extend(self._check_crowd(person_positions, ts))
        signals.extend(self._check_abandoned(detections, person_positions, ts))

        for state in self.tracks.values():
            if state.track_id < 0 or state.track_id in seen_ids or state.cls not in self.person_classes:
                continue
            state.missing_frames += 1
            if state.missing_frames >= 5 and not state.exit_emitted and state.points:
                _, x, y = state.points[-1]
                state.exit_emitted = True
                signals.append({
                    "type": "track_exit",
                    "track_id": state.track_id,
                    "zone": None,
                    "detail": f"track {state.track_id} left the camera field of view",
                    "severity": 0.25,
                    "last_seen_point": {"x": round(x, 4), "y": round(y, 4)},
                    "last_seen_side": self._point_side(x, y),
                    "last_seen_at": state.last_seen,
                    "last_seen_box": state.last_box,
                })

        # prune stale tracks
        stale = [tid for tid, s in self.tracks.items() if ts - s.last_seen > 90]
        for tid in stale:
            del self.tracks[tid]

        return signals

    @staticmethod
    def _point_side(x: float, y: float) -> str:
        horizontal = "left" if x < 0.34 else "right" if x > 0.66 else "center"
        vertical = "top" if y < 0.34 else "bottom" if y > 0.66 else "middle"
        return f"{vertical}-{horizontal}"

    def _check_fighting(self, states: List[TrackState], ts: float, width: int, height: int) -> List[dict]:
        out = []
        for index, first in enumerate(states):
            if len(first.points) < 3:
                continue
            first_point = first.points[-1][1:]
            for second in states[index + 1:]:
                if len(second.points) < 3:
                    continue
                second_point = second.points[-1][1:]
                if dist(first_point, second_point) > 0.12:
                    continue
                if max(self._recent_speed_px(first, width, height), self._recent_speed_px(second, width, height)) < self.running_speed_px_per_s * 0.45:
                    continue
                if self._throttled(first, f"possible_fighting_{second.track_id}", ts, 5):
                    continue
                out.extend([
                    {"type": "possible_fighting", "track_id": first.track_id, "related_track_id": second.track_id, "zone": None, "detail": f"possible physical altercation near tracks {first.track_id} and {second.track_id}", "severity": 0.75},
                    {"type": "possible_fighting", "track_id": second.track_id, "related_track_id": first.track_id, "zone": None, "detail": f"possible physical altercation near tracks {first.track_id} and {second.track_id}", "severity": 0.75},
                ])
        return out

    def _recent_speed_px(self, state: TrackState, width: int, height: int) -> float:
        points = list(state.points)[-3:]
        speeds = []
        for previous, current in zip(points, points[1:]):
            dt = max(current[0] - previous[0], 1e-3)
            speeds.append(dist((current[1], current[2]), (previous[1], previous[2])) / dt)
        return sum(speeds) / max(len(speeds), 1) * max(width, height)

    # ── zone checks ───────────────────────────────────────────────────────────

    def _check_zones(self, state: TrackState, pos: Point, ts: float) -> List[dict]:
        out = []
        for zone in self.zones:
            inside = point_in_polygon(pos, zone.polygon)
            entered_at = state.zones_entered.get(zone.name)

            if inside and entered_at is None:
                # entered zone
                state.zones_entered[zone.name] = ts
                count = state.zone_reentry.get(zone.name, 0) + 1
                state.zone_reentry[zone.name] = count

                if zone.rule == "restricted":
                    severity = min(0.8 + (count - 1) * 0.05, 1.0)  # escalate on re-entry
                    out.append({
                        "type": "restricted_zone_entry",
                        "track_id": state.track_id,
                        "zone": zone.name,
                        "detail": f"track {state.track_id} entered restricted zone '{zone.name}' (entry #{count})",
                        "severity": round(severity, 3),
                        "reentry_count": count,
                    })
                    # repeated re-entry is highly suspicious
                    if count >= 3 and not self._throttled(state, f"reentry_{zone.name}", ts, 30):
                        out.append({
                            "type": "repeated_zone_reentry",
                            "track_id": state.track_id,
                            "zone": zone.name,
                            "detail": f"track {state.track_id} re-entered '{zone.name}' {count} times",
                            "severity": min(0.7 + count * 0.05, 1.0),
                        })

            elif inside and zone.rule == "loiter" and entered_at is not None:
                dwell = ts - entered_at
                if dwell >= zone.loiter_seconds:
                    disp = self._displacement(state, zone.loiter_seconds)
                    if disp <= zone.loiter_max_displacement:
                        # throttle: emit at most once per 10s per zone
                        if not self._throttled(state, f"loiter_{zone.name}", ts, 10):
                            out.append({
                                "type": "loitering",
                                "track_id": state.track_id,
                                "zone": zone.name,
                                "detail": f"track {state.track_id} loitering in '{zone.name}' for {dwell:.0f}s",
                                "severity": round(min(0.3 + dwell / 120.0, 0.9), 3),
                            })

            elif not inside and entered_at is not None:
                del state.zones_entered[zone.name]

        return out

    # ── running ───────────────────────────────────────────────────────────────

    def _check_running(self, state: TrackState, ts: float, width: int, height: int) -> List[dict]:
        if len(state.points) < 3:
            return []
        # average speed over last 3 frames for stability
        speeds = []
        pts = list(state.points)[-3:]
        for i in range(1, len(pts)):
            dt = max(pts[i][0] - pts[i-1][0], 1e-3)
            speeds.append(dist((pts[i][1], pts[i][2]), (pts[i-1][1], pts[i-1][2])) / dt)
        speed = sum(speeds) / len(speeds) * max(width, height)
        if speed >= self.running_speed_px_per_s and not self._throttled(state, "running", ts, 3):
            return [{
                "type": "running",
                "track_id": state.track_id,
                "zone": None,
                "detail": f"track {state.track_id} running at {speed:.0f}px/s",
                "severity": round(min(0.4 + speed / (self.running_speed_px_per_s * 2), 0.85), 3),
            }]
        return []

    # ── pacing (direction reversal) ───────────────────────────────────────────

    def _check_pacing(self, state: TrackState, ts: float) -> List[dict]:
        if len(state.points) < 20:
            return []
        pts = list(state.points)[-20:]
        # count direction reversals on x-axis
        reversals = 0
        for i in range(2, len(pts)):
            dx1 = pts[i-1][1] - pts[i-2][1]
            dx2 = pts[i][1] - pts[i-1][1]
            if dx1 * dx2 < -1e-5:  # sign change
                reversals += 1
        if reversals >= 5 and not self._throttled(state, "pacing", ts, 15):
            return [{
                "type": "pacing",
                "track_id": state.track_id,
                "zone": None,
                "detail": f"track {state.track_id} pacing back and forth ({reversals} reversals)",
                "severity": round(min(0.4 + reversals * 0.04, 0.8), 3),
            }]
        return []

    # ── perimeter hugging ─────────────────────────────────────────────────────

    def _check_perimeter_hugging(self, state: TrackState, pos: Point, ts: float) -> List[dict]:
        for zone in self.zones:
            if zone.rule != "restricted":
                continue
            if point_in_polygon(pos, zone.polygon):
                continue
            edge_d = nearest_edge_dist(pos, zone.polygon)
            if edge_d < 0.05:  # within 5% of frame width from boundary
                if not self._throttled(state, f"hug_{zone.name}", ts, 8):
                    return [{
                        "type": "perimeter_hugging",
                        "track_id": state.track_id,
                        "zone": zone.name,
                        "detail": f"track {state.track_id} moving along boundary of '{zone.name}'",
                        "severity": 0.55,
                    }]
        return []

    # ── sudden stop after movement ────────────────────────────────────────────

    def _check_sudden_stop(self, state: TrackState, ts: float) -> List[dict]:
        if len(state.points) < 10:
            return []
        pts = list(state.points)
        # speed over frames -10..-5 vs -5..0
        def avg_speed(window):
            s = 0.0
            for i in range(1, len(window)):
                dt = max(window[i][0] - window[i-1][0], 1e-3)
                s += dist((window[i][1], window[i][2]), (window[i-1][1], window[i-1][2])) / dt
            return s / max(len(window) - 1, 1)
        prev_speed = avg_speed(pts[-10:-5])
        curr_speed = avg_speed(pts[-5:])
        if prev_speed > self.running_speed_px_per_s * 0.6 / 1000 and curr_speed < self.running_speed_px_per_s * 0.1 / 1000:
            if not self._throttled(state, "sudden_stop", ts, 10):
                return [{
                    "type": "sudden_stop",
                    "track_id": state.track_id,
                    "zone": None,
                    "detail": f"track {state.track_id} stopped suddenly after movement",
                    "severity": 0.5,
                }]
        return []

    # ── crowd formation ───────────────────────────────────────────────────────

    def _check_crowd(self, positions: List[Point], ts: float) -> List[dict]:
        if len(positions) < self.crowd_threshold:
            return []
        # find any position with enough neighbours within radius
        for i, p in enumerate(positions):
            neighbours = sum(1 for j, q in enumerate(positions) if i != j and dist(p, q) < self.crowd_radius)
            if neighbours >= self.crowd_threshold - 1:
                # throttle globally using a pseudo track_id of -1
                dummy = self.tracks.get(-1)
                if dummy is None:
                    dummy = TrackState(track_id=-1, cls="crowd")
                    self.tracks[-1] = dummy
                dummy.last_seen = ts
                if not self._throttled(dummy, "crowd", ts, 20):
                    return [{
                        "type": "crowd_formation",
                        "track_id": None,
                        "zone": None,
                        "detail": f"{len(positions)} people clustered in frame",
                        "severity": round(min(0.4 + len(positions) * 0.06, 0.9), 3),
                    }]
                break
        return []

    # ── abandoned objects ─────────────────────────────────────────────────────

    def _check_abandoned(self, detections: List[dict], person_positions: List[Point], ts: float) -> List[dict]:
        out = []
        for det in detections:
            if det["cls"] not in self.abandoned_classes:
                continue
            tid = det.get("track_id")
            if tid is None:
                continue
            x1, y1, x2, y2 = det["bbox"]
            ocx, ocy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
            # use raw pixel distance — abandoned_classes bbox is in pixels
            near = any(math.hypot(ocx - px, ocy - py) < 120 for px, py in person_positions)
            if near:
                self.object_last_near_person[tid] = ts
            else:
                unattended = ts - self.object_last_near_person.get(tid, ts)
                if unattended >= self.abandoned_seconds:
                    state = self.tracks.get(tid) or TrackState(track_id=tid, cls=det["cls"])
                    if not self._throttled(state, "abandoned", ts, 15):
                        out.append({
                            "type": "abandoned_object",
                            "track_id": tid,
                            "zone": None,
                            "detail": f"{det['cls']} (track {tid}) unattended for {unattended:.0f}s",
                            "severity": round(min(0.35 + unattended / 60.0, 0.9), 3),
                        })
        return out

    # ── helpers ───────────────────────────────────────────────────────────────

    def _displacement(self, state: TrackState, window_s: float) -> float:
        if not state.points:
            return 0.0
        now = state.points[-1][0]
        pts = [(p[1], p[2]) for p in state.points if now - p[0] <= window_s]
        if len(pts) < 2:
            return 0.0
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return math.hypot(max(xs) - min(xs), max(ys) - min(ys))

    def _throttled(self, state: TrackState, key: str, ts: float, interval: float) -> bool:
        last = state.last_signal_type.get(key, 0.0)
        if ts - last < interval:
            return True
        state.last_signal_type[key] = ts
        return False
