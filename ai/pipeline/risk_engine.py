from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ContextEngine:
    def __init__(self, config: dict[str, Any]) -> None:
        self.zone = config.get("zone", {})

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
        suspicious_labels = {"knife", "license_plate"}
        suspicious_objects = min(1.0, sum(item.get("label") in suspicious_labels for item in detections) / 2.0)
        return {"zone": zone_risk, "loitering": loitering, "motion": motion, "historical": 0.0, "suspicious_objects": suspicious_objects}


class RiskEngine:
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
        alert_behavior = any(signal.get("severity", 0) >= self.config.get("behavior_alert_threshold", 0.7) for signal in behavior_signals)
        return {"risk_score": risk_score, "severity": severity, "signals": values, "contributions": contributions, "alert": alert_behavior or values.get("anomaly", 0.0) >= self.config["anomaly_threshold"] or severity in {"HIGH", "CRITICAL"}}
