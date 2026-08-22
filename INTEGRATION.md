# Zone behavior integration

The zone behavior engine is integrated into `ai/main.py`. The live pipeline is:

1. YOLO detection
2. ByteTrack persistent tracking
3. Bounded temporal buffering (frame-diff motion signal)
4. Zone behavior engine
5. Context Engine
6. Risk Engine

The adapter converts the detector's `label`/`box` fields to the engine's
`cls`/`bbox` fields. Behavior severities are weighted by `risk_weights` and
returned as `behavior_signals` in each AI result. Zones are empty by default;
define camera-specific polygons under `zone_engine.zones` in `ai/config.json`.

## Coordinate space note

`zone_engine.py` expects zone polygons and bboxes in the same pixel space.
If you resize frames before YOLO inference, define zones in the *resized*
resolution (e.g. the same size you feed to `model.predict()`), not the
original camera resolution — otherwise restricted-zone checks will be
offset.

## What this does NOT do

- No face recognition, no identity, no "criminal" labeling.
- All signals are per-track-id behavior only, and track IDs reset when a
  track is lost for 60s+ (configurable in `ZoneEngine` prune logic).
- Optional persona matching is separate, disabled by default, and restricted
  to explicitly consented synthetic demo personas. It returns a
  `[DEMO/SYNTHETIC]` label and fictional case note only; it never supplies
  real identity or criminal-history data.

## Synthetic persona matching

Set `PERSONA_MATCHING_ENABLED=true` to enable the integrated, consent-only
demo matcher. Enroll profiles with `enroll_persona.py`; the live AI response
then includes `persona_matches` for tracked people when a match exceeds the
configured similarity threshold.
