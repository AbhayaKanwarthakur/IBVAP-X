# IBVAP-X Knowledge Map

## System flow

```text
Phone browser camera
  -> Vercel HTTPS frontend
  -> Cloudflare tunnel
  -> Node realtime API (:8787)
  -> Python AI service (:9000)
  -> YOLO + ByteTrack + plate/OCR + motion + zones + risk
  -> dashboard, alerts, incidents, and evidence state
```

The system reports observable detections and possible anomalous behavior. It does not establish criminality or provide real criminal records.

## Root files

- `index.html`: Vite HTML shell and root mount element. The build plugin injects the site title and metadata.
- `package.json`: JavaScript dependencies and commands for Vite, Node API, build, tests, and formatting.
- `package-lock.json`: npm dependency lockfile.
- `pnpm-lock.yaml`: pnpm dependency lockfile retained for repository compatibility; Vercel is configured to use npm.
- `vite.config.ts`: Vite, React, Tailwind, build, local API proxy, and deployment configuration.
- `tsconfig.json`: TypeScript compiler settings.
- `vercel.json`: Vercel install command, build command, and `dist` output configuration.
- `.env.example`: documents `VITE_API_URL`, the public HTTPS origin of the Node API tunnel.
- `.vercelignore`: keeps local environments, private photos, model binaries, and runtime state out of frontend uploads.
- `.gitignore`: excludes generated dependencies, private enrollment data, caches, and runtime files from Git.
- `AGENTS.md`: workspace development instructions.
- `CLAUDE.md`: points to the workspace instructions.
- `README.md`: project overview, setup, pipeline, APIs, and operational limitations.
- `DEPLOYMENT.md`: Vercel plus Cloudflare Tunnel deployment procedure.
- `INTEGRATION.md`: integration notes for zones, behavior signals, risk, and consented demo profiles.
- `config.example.json`: example zone/risk configuration template.
- `knowledge.md`: this file; codebase orientation and file responsibilities.

## Python root files

- `persona_engine.py`: optional consented demo-profile enrollment and matching. It creates face embeddings from explicitly enrolled images, averages multi-angle vectors, compares cosine similarity, and returns synthetic profile metadata. It must never be used as a criminality or identity database.
- `enroll_persona.py`: CLI for enrolling one consenting demo image into `personas.json`; records a display label, consent source, embedding, and fictional demo note.
- `enroll_personas_batch.py`: groups exactly 21 supplied images as seven people with three angles each, validates faces, averages embeddings, and writes seven synthetic profiles.
- `generate_synthetic_case.py`: deterministic generator for clearly fictional, non-real demo notes and IDs.
- `zone_engine.py`: tracks object centers over time and emits observable behavior signals such as restricted-zone entry, running, loitering, and abandoned objects. It consumes normalized `track_id`, `cls`, and `bbox` records.
- `enroll_personas_batch.py`: batch enrollment workflow for the seven-profile synthetic demonstration dataset.
- `personas.example.json`: safe example profile format with placeholder/truncated data; it is not a usable real profile store.
- `config.example.json`: sample configuration showing risk weights and zone settings; active AI settings are in `ai/config.json`.

## AI service Python files

- `ai/main.py`: FastAPI entrypoint. Loads the detector, motion detector, risk engine, zone engine, and optional persona engine. `POST /infer/frame` decodes a JPEG, runs all enabled stages, and returns detections, behavior signals, risk, metrics, and model status. `GET /health` reports service/model readiness.
- `ai/config.json`: active risk weights, thresholds, zone definitions, running speed, abandoned-object timeout, and allowed behavior classes.
- `ai/requirements.txt`: runtime dependencies for the YOLO/AI service, including Torch, Ultralytics, OpenCV, FastAPI, OCR support, and ByteTrack dependencies.
- `ai/persona-requirements.txt`: optional face-enrollment dependencies kept separate from the main Python 3.13 AI environment.
- `ai/test_video.py`: sends frames from a prerecorded video through the same inference route for offline testing.
- `ai/config.json`: runtime configuration loaded by `RiskEngine` and `ZoneEngine`.

## AI pipeline modules

- `ai/pipeline/__init__.py`: marks the pipeline directory as a Python package.
- `ai/pipeline/detector.py`: loads YOLO and the optional plate model. Runs YOLO tracking with ByteTrack, formats boxes, runs plate detection, and performs validated OCR. Defaults to lightweight `yolo11n.pt`, 480 px inference, and 640 px plate inference for CPU responsiveness. Override with `YOLO_MODEL`, `YOLO_IMAGE_SIZE`, `PLATE_IMAGE_SIZE`, `AI_DEVICE`, and related environment variables.
- `ai/pipeline/feature_extractor.py`: decodes base64 image payloads into OpenCV frames and contains shared frame/image preparation helpers.
- `ai/pipeline/motion_detector.py`: keeps a bounded frame history and computes a normalized frame-difference anomaly signal. This is a motion/anomaly indicator, not an activity classifier.
- `ai/pipeline/risk_engine.py`: clamps malformed inputs, normalizes weighted signals to a 0-100 score, collapses duplicate behavior types to their strongest event, assigns LOW/MEDIUM/HIGH/CRITICAL severity, and decides whether an alert should be emitted.
- `ai/pipeline/tracker.py`: maintains per-track history, centers, timestamps, movement, and dwell information used by context and zone analysis.

## Node server files

- `server/index.mjs`: Node HTTP API and realtime gateway. Proxies frames to Python, stores latest frames and AI results, publishes alerts/events, serves the camera JPEG/SSE feed, manages camera state, stores incidents/audit records, and optionally performs authorized RTO lookups. `AI_URL` selects the Python service; `API_PORT` selects the Node port.
- `server/data/state.json`: local runtime state for cameras, incidents, alerts, license-plate records, uploads, and audit entries. Do not use this JSON file as durable production storage.
- `server/data/uploads/`: local uploaded video storage; excluded from deployments and source control.

## Frontend files

- `src/main.tsx`: React entrypoint; imports global CSS and mounts `App`.
- `src/App.tsx`: page selection, lazy loading, layout composition, and render error boundary.
- `src/index.css`: Tailwind import, global fonts, colors, layout utilities, and dashboard styling.
- `src/api/client.ts`: shared local API URL builder. Routes the dashboard to the Node API on port `8787`.
- `src/api/realtime.ts`: subscribes to Node Server-Sent Events and supplies camera/alert snapshots with an offline fallback.
- `src/components/Layout.tsx`: sidebar navigation, operator header, status display, and shared application frame.
- `src/data/mockData.ts`: fallback/demo dashboard records used when realtime data is unavailable.
- `src/pages/LiveSurveillance.tsx`: phone camera permission, local preview, frame upload, AI requests, pushed remote JPEG display, detection overlays, risk status, license-plate list, and synthetic profile notification.
- `src/pages/LicensePlates.tsx`: displays validated plate records and authorized lookup actions.
- `src/pages/CommandCenter.tsx`: operational overview of cameras, alerts, and system snapshot.
- `src/pages/Incidents.tsx`: incident list and review state.
- `src/pages/EvidenceCenter.tsx`: evidence and uploaded-media view.
- `src/pages/VideoAnalysis.tsx`: prerecorded video analysis interface.
- `src/pages/EntityTracking.tsx`: tracked entity and movement view.
- `src/pages/SectorMap.tsx`: sector/camera map view.
- `src/pages/Analytics.tsx`: historical metrics and charts.
- `src/pages/ThreatIntelligence.tsx`: threat information dashboard view.
- `src/pages/SystemHealth.tsx`: service and model health display.
- `src/pages/Settings.tsx`: application settings view.

## Model files

- `yolo11n.pt`: lightweight general-object YOLO model used by default for faster CPU inference.
- `yolov8m.pt`: larger alternative YOLO model; slower but potentially more accurate.
- `plate_model.pt`: custom license-plate detector loaded by the Python detector.

## Local operation notes

- Vite serves the dashboard on `http://localhost:8443`.
- A USB-connected Android phone uses `adb reverse` for ports `8443` and `8787`.
- The phone camera requires browser permission; open `http://localhost:8443` in Chrome.
- Node exposes only the local API on `8787`; Python remains local on `9000`.
- For production access later, add authentication and durable database/object storage before exposing any service publicly.
