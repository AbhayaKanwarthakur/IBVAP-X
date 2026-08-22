from __future__ import annotations

import cv2
import numpy as np


def decode_frame(image_bytes: bytes) -> np.ndarray:
    frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Request body is not a valid JPEG or PNG frame")
    return frame
