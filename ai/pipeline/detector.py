from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import cv2
from ultralytics import YOLO

try:
    import easyocr
except ImportError:
    easyocr = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


class YoloByteTrackDetector:
    """Pretrained YOLO inference with Ultralytics' ByteTrack implementation."""

    def __init__(self) -> None:
        project_root = Path(__file__).resolve().parents[2]
        configured_model = os.getenv("YOLO_MODEL", "yolo11n.pt")
        self.model_name = str(Path(configured_model) if Path(configured_model).is_absolute() else project_root / configured_model)
        self.model = YOLO(self.model_name)
        self.device = os.getenv("AI_DEVICE", "0" if os.getenv("CUDA_VISIBLE_DEVICES") else "cpu")
        self.image_size = int(os.getenv("YOLO_IMAGE_SIZE", "480"))
        self.plate_image_size = int(os.getenv("PLATE_IMAGE_SIZE", "640"))
        self.confidence = float(os.getenv("YOLO_CONFIDENCE", "0.45"))
        self.plate_confidence = float(os.getenv("PLATE_CONFIDENCE", "0.35"))
        self.target_classes = [int(value) for value in os.getenv("YOLO_CLASSES", "0,1,2,3,5,7,24,26,28,43,76").split(",") if value.strip()]
        configured_plate_model = os.getenv("PLATE_MODEL", "plate_model.pt")
        plate_path = Path(configured_plate_model)
        self.plate_model_name = str(plate_path if plate_path.is_absolute() else project_root / plate_path)
        self.plate_model: YOLO | None = None
        self.plate_status = "not_configured"
        self.ocr_status = "not_installed"
        self.easyocr_reader: easyocr.Reader | None = None

        if self.plate_model_name:
            if not Path(self.plate_model_name).exists():
                self.plate_status = f"missing:{self.plate_model_name}"
            else:
                try:
                    self.plate_model = YOLO(self.plate_model_name)
                    self.plate_status = "loaded"
                except Exception as error:
                    self.plate_status = f"load_error:{error}"

        if self.plate_model is None:
            self.ocr_status = "not_configured"
        else:
            if easyocr is not None:
                try:
                    use_gpu = self.device != "cpu" and self.device != "-1"
                    self.easyocr_reader = easyocr.Reader(["en"], gpu=use_gpu, verbose=False)
                    self.ocr_status = "easyocr_loaded"
                except Exception as error:
                    print(f"[OCR] EasyOCR initialization notice: {error}", flush=True)
                    self.easyocr_reader = None

            if self.easyocr_reader is None and pytesseract is not None:
                executable = shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
                if Path(executable).exists():
                    pytesseract.pytesseract.tesseract_cmd = executable
                    self.ocr_status = "tesseract_loaded"

    def infer(self, frame: np.ndarray) -> list[dict[str, Any]]:
        result = self.model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            device=self.device,
            imgsz=self.image_size,
            conf=self.confidence,
            iou=0.5,
            max_det=30,
            verbose=False,
            classes=self.target_classes,
        )[0]
        detections = self._format_detections(result, tracked=True)
        if self.plate_model is not None:
            plate_result = self.plate_model.predict(frame, device=self.device, imgsz=self.plate_image_size, conf=self.plate_confidence, verbose=False)[0]
            plate_detections = self._format_detections(plate_result, tracked=False, label_override="license_plate")
            for detection in plate_detections:
                plate_text = None
                if self.ocr_status in ("easyocr_loaded", "tesseract_loaded"):
                    try:
                        x1, y1, x2, y2 = detection["box"]
                        crop = frame[max(0, y1):max(y1 + 1, y2), max(0, x1):max(x1 + 1, x2)]
                        if crop.size:
                            enlarged = cv2.resize(crop, None, fx=3, opacity=1, fy=3, interpolation=cv2.INTER_CUBIC) if False else cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
                            
                            # Primary OCR: EasyOCR
                            if self.easyocr_reader is not None:
                                try:
                                    results = self.easyocr_reader.readtext(enlarged, detail=0)
                                    combined = "".join(results)
                                    raw_text = re.sub(r"[^A-Z0-9]", "", combined.upper())
                                    if re.search(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}", raw_text) or re.search(r"[0-9]{2}BH[0-9]{4}[A-Z]{1,2}", raw_text):
                                        match = re.search(r"([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})", raw_text)
                                        if match:
                                            plate_text = match.group(1)
                                    elif len(raw_text) >= 4:
                                        plate_text = raw_text
                                except Exception:
                                    pass

                            # Secondary OCR Fallback: Tesseract
                            if not plate_text and pytesseract is not None and self.ocr_status == "tesseract_loaded":
                                try:
                                    gray = cv2.cvtColor(enlarged, cv2.COLOR_BGR2GRAY)
                                    thresholded = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
                                    reading = pytesseract.image_to_string(thresholded, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
                                    raw_text = re.sub(r"[^A-Z0-9]", "", reading.upper())
                                    valid_shape = re.fullmatch(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}", raw_text or "")
                                    if valid_shape:
                                        plate_text = raw_text
                                except Exception:
                                    pass
                    except Exception:
                        plate_text = None
                detection["plate_text"] = plate_text
                detections.append(detection)
        return detections

    @staticmethod
    def _format_detections(result: Any, tracked: bool, label_override: str | None = None) -> list[dict[str, Any]]:
        if result.boxes is None:
            return []
        ids = result.boxes.id.int().cpu().tolist() if tracked and result.boxes.id is not None else [None] * len(result.boxes)
        detections: list[dict[str, Any]] = []
        for box, confidence, class_id, track_id in zip(result.boxes.xyxy.cpu().tolist(), result.boxes.conf.cpu().tolist(), result.boxes.cls.int().cpu().tolist(), ids):
            x1, y1, x2, y2 = box
            detections.append({
                "track_id": track_id,
                "class_id": class_id,
                "label": label_override or result.names[class_id],
                "confidence": round(float(confidence), 4),
                "box": [round(x1), round(y1), round(x2), round(y2)],
            })
        return detections
