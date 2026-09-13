from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ContextEngine:
    def __init__(self, config: dict[str, Any]) -> None:
        self.zone = config.get("zone", {})
        self.weapon_classes: set[str] = set(config.get("weapon_classes", ["knife", "scissors"]))
        self.suspicious_classes: set[str] = self.weapon_classes | {"backpack", "handbag", "suitcase"}

    def evaluate(self, detections: list[dict[str, Any]], track_history: Any, width: int, height: int) -> dict[str, float]:
        people = [item for item in detections if item.get("label") == "person"]
        zone_risk = 0.0
        if self.zone.get("enabled"):
            for item in people:
                x1, y1, x2, y2 = item["box"]
                x, y = (x1 + x2) / 2 / width, (y1 + y2) / 2 / height
                if self.zone["x_min"] <= x <= self.zone["x_max"] and self.zone["y_min"] <= y <= self.zone["y_max"]:
                    zone_risk = 1.0
                    break
        loitering = max((track_history.loitering_score(item.get("track_id")) for item in people), default=0.0)
        motion = min(1.0, len(people) / 5.0)
        # Weapons score 1.0 immediately; other suspicious objects scale with count
        weapon_count = sum(1 for d in detections if d.get("label") in self.weapon_classes)
        other_suspicious = sum(1 for d in detections if d.get("label") in self.suspicious_classes and d.get("label") not in self.weapon_classes)
        suspicious_objects = 1.0 if weapon_count > 0 else min(1.0, other_suspicious / 3.0)
        return {"zone": zone_risk, "loitering": loitering, "motion": motion, "historical": 0.0, "suspicious_objects": suspicious_objects}


class RiskEngine:
    HIGH_RISK_BEHAVIORS = {
        "running", "possible_fighting", "weapon_detected", "stabbing",
        "gun_firing", "firearm_detected", "restricted_zone_entry",
        "repeated_zone_reentry", "synthetic_persona_match",
    }

    def __init__(self, config_path: str = "ai/config.json") -> None:
        config_file = Path(config_path)
        if not config_file.is_absolute():
            config_file = Path(__file__).resolve().parents[2] / config_file
        self.config = json.loads(config_file.read_text(encoding="utf-8"))
        self.weights = self.config["risk_weights"]

    def score(self, anomaly_score: float, context: dict[str, float], behavior_signals: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        behavior_signals = behavior_signals or []
        behavior_values: dict[str, float] = {}
        for signal in behavior_signals:
            signal_type = signal.get("type")
            try:
                severity_value = max(0.0, min(1.0, float(signal.get("severity", 0))))
            except (TypeError, ValueError):
                continue
            if signal_type and severity_value > behavior_values.get(signal_type, 0.0):
                behavior_values[signal_type] = severity_value
        values = {"anomaly": anomaly_score, **context, **behavior_values}
        normalized_values: dict[str, float] = {}
        for key, value in values.items():
            if key not in self.weights:
                continue
            try:
                normalized_values[key] = max(0.0, min(1.0, float(value)))
            except (TypeError, ValueError):
                continue
        values = normalized_values
        active_weights = {key: weight for key, weight in self.weights.items() if key in values}
        total_weight = sum(active_weights.values()) or 1.0
        weighted_score = sum(active_weights[key] * values[key] for key in active_weights) / total_weight * 100
        contributions = {key: round(active_weights[key] * values[key] / total_weight * 100, 2) for key in active_weights}
        risk_score = max(0, min(100, round(weighted_score)))
        if risk_score >= self.config["critical_threshold"]:
            severity = "CRITICAL"
        elif risk_score >= self.config["high_threshold"]:
            severity = "HIGH"
        elif risk_score >= self.config["medium_threshold"]:
            severity = "MEDIUM"
        else:
            severity = "LOW"
        high_risk_signal = any(signal.get("type") in self.HIGH_RISK_BEHAVIORS and signal.get("severity", 0) >= 0.6 for signal in behavior_signals)
        if not high_risk_signal:
            risk_score = min(risk_score, 25)
            severity = "LOW"
        alert_behavior = any(signal.get("type") in self.HIGH_RISK_BEHAVIORS and signal.get("severity", 0) >= self.config.get("behavior_alert_threshold", 0.7) for signal in behavior_signals)
        return {"risk_score": risk_score, "severity": severity, "signals": values, "contributions": contributions, "alert": alert_behavior}

    def score_track(self, track_id: int, anomaly_score: float, context: dict[str, float], behavior_signals: list[dict[str, Any]]) -> dict[str, Any]:
        track_signals = [signal for signal in behavior_signals if signal.get("track_id") in (track_id, None)]
        return self.score(anomaly_score, context, track_signals)
