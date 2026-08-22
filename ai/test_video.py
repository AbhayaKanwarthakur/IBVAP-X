from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import cv2
import requests


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a prerecorded video through the IBVAP-X AI service")
    parser.add_argument("video", type=Path)
    parser.add_argument("--api", default="http://localhost:9000")
    parser.add_argument("--every", type=int, default=3, help="Process every Nth frame")
    args = parser.parse_args()
    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit(f"Could not open video: {args.video}")
    frame_number = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_number += 1
        if frame_number % args.every:
            continue
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if not ok:
            continue
        payload = {"camera_id": "RECORDED-TEST", "image_base64": base64.b64encode(encoded).decode("ascii")}
        result = requests.post(f"{args.api}/infer/frame", json=payload, timeout=30)
        result.raise_for_status()
        print(json.dumps({"frame": frame_number, **result.json()}), flush=True)
    capture.release()


if __name__ == "__main__":
    main()
