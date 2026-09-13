# Legacy RTFM Integration Notes

> This document describes an earlier integration design. The current live
> implementation is in `ai/pipeline/rtfm_buffer.py` and is initialized by
> `ai/main.py` when its dependencies and pretrained ResNet weights are
> available.

The current service does not import `ai/rtfm_integration/`,
`live_feature_extractor.py`, or `ai/anomaly/infer_signal.py`. The instructions
below are retained only as historical reference.

Three pieces now exist in `ai/rtfm_integration/`:
- `rtfm_model.py` — the real architecture (don't edit)
- `rtfm_infer.py` — loads the checkpoint, scores a features array
- `live_feature_extractor.py` — turns camera frames into that features array

## 1. Startup (once, alongside your other engines)

```python
from rtfm_integration.rtfm_infer import RTFMDetector
from rtfm_integration.live_feature_extractor import LiveTrackFeatureBuffer

rtfm_detector = RTFMDetector(checkpoint_path="path/to/downloaded/ucf_model.pkl")
rtfm_buffer = LiveTrackFeatureBuffer()
```

Startup will take a few seconds — it's loading both the RTFM classifier and
the I3D backbone.

## 2. Per frame, per tracked person

```python
for det in tracked_detections:
    if det["cls"] != "person":
        continue
    x1, y1, x2, y2 = det["bbox"]
    crop = frame_rgb[y1:y2, x1:x2]

    rtfm_buffer.add_frame(det["track_id"], crop)

    if rtfm_buffer.ready(det["track_id"]):
        features = rtfm_buffer.extract_features(det["track_id"])
        signal = rtfm_detector.signal_for_track(det["track_id"], features)
        if signal:
            behavior_signals.append(signal)
        rtfm_buffer.clear(det["track_id"])  # start a fresh window for this track
```

This mirrors the same rolling-buffer pattern you already have in
`motion_detector.py` and the earlier `ai/anomaly/infer_signal.py` — buffer
fills, score once full, clear, repeat. With `BUFFER_LEN = 64` frames at a
typical ~15-20fps capture rate, that's roughly a 3-4 second window per
score — tune `SEGMENTS_PER_CLIP`/`FRAMES_PER_SEGMENT` in
`live_feature_extractor.py` if you want a shorter/longer window.

## 3. Add the risk weight in `ai/config.json`

```json
"risk_weights": {
  "activity_anomaly_rtfm": 0.5
}
```

Same tuning advice as before: this is a learned, probabilistic signal, and
you're running it through the approximate (Path B) feature extractor, not
the exact one RTFM was trained on — start its weight lower than your
deterministic zone rules, and adjust once you've watched it against real
footage.

## 4. Performance note — this is heavier than everything else in your pipeline

Per tracked person, every ~64 frames you're now running 4 I3D forward
passes (one per segment) plus one RTFM forward pass. For a live demo with
multiple people in frame:
- Consider only running this for tracks that already have a nonzero
  zone/behavior signal (same suggestion as the earlier `ai/anomaly`
  module) rather than every person in frame.
- `LiveTrackFeatureBuffer` loads one shared I3D backbone instance — don't
  create a second `RTFMDetector`/backbone per track, that's the expensive
  part.

## 5. What to say in your demo

Be upfront that this is a pretrained model (RTFM, Tian et al. ICCV 2021)
running through an approximate feature extractor for live inference — see
`README.md`'s Path A/B distinction. That's an accurate, defensible
description. Claiming the paper's benchmark accuracy applies to your live
demo would not be, since you're not using their exact extractor.
