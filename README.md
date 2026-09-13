# IBVAP-X

IBVAP-X is an AI-assisted surveillance system that detects anomalous activity and generates contextual risk scores to assist human operators. It does not identify criminals and a risk score is not a probability of criminality.

## Services

- React/Vite dashboard: `http://localhost:8443`
- Node API and realtime event gateway: `http://localhost:8787`
- Python AI service: `http://localhost:9000`

The initial camera is one browser phone camera. The dashboard captures frames with `getUserMedia`, sends JPEG samples through the Node API, and receives structured AI results through the same backend event architecture.

## Start

Install the existing JavaScript dependencies:

```powershell
npm install
```

Create a Python environment and install AI dependencies:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python -m pip install -r ai\requirements.txt
```

Start the services in separate terminals:

```powershell
npm run server
npm run dev
\.venv\Scripts\python ai\main.py
```

Or start the Node and Vite services together with `npm run dev:full`, then start Python separately.

For phone camera access, use `localhost` or serve the frontend through HTTPS. A plain HTTP LAN address can be blocked by mobile browser security policy.

## AI pipeline

`ai/main.py` exposes `POST /infer/frame` and runs:

1. Pretrained YOLO object detection
2. Ultralytics ByteTrack persistent tracking
3. Bounded temporal buffering for a lightweight motion signal
4. Context Engine
5. Configurable Risk Engine

The temporal anomaly signal is a lightweight frame-difference detector. It is intentionally reported as an anomaly signal, not a criminality or identity prediction.

Risk scores are normalized to 0–100 from the active weighted signals. Context and anomaly values are clamped to 0–1, repeated behavior types use their strongest current event, and high-confidence behavior events can alert independently of the numeric score.

Optional synthetic persona matching is available only when `PERSONA_MATCHING_ENABLED=true`. It compares tracked person crops against explicitly consented demo profiles in `personas.json`; it does not identify criminals or provide crime records. Install `facenet-pytorch`, enroll a consenting demo subject with `python enroll_persona.py`, and use only fictional case notes.

Risk weights and thresholds are in `ai/config.json`. Set `YOLO_MODEL`, `YOLO_CLASSES`, and `AI_DEVICE` to configure model loading. `YOLO_MODEL` defaults to `yolo11n.pt`; live inference defaults to people, bicycles, cars, motorcycles, buses, trucks, backpacks, handbags, suitcases, and knives. The included `plate_model.pt` is loaded automatically for license-plate boxes; set `PLATE_MODEL` to replace it with another compatible weight. Plate character reading still requires an OCR engine. The service reports the plate model state as `loaded`, `not_configured`, or an error in `/health` and each frame result.

## Prerecorded video test

Install the Python dependencies, start the AI service, and send a local video through the same frame endpoint:

```powershell
\.venv\Scripts\python ai\test_video.py path\to\sample.mp4
```

This test mode is deliberately separate from the phone camera and uses the same YOLO, ByteTrack, temporal, context, zone behavior, persona, and risk code paths.

## API

- Node: `GET /api/health`, `/api/cameras`, `/api/alerts`, `/api/incidents`, `/api/audit`, `/api/events`
- Node: `POST /api/ai/frame` proxies frames to Python and publishes `ai_update` or `ai_alert` events
- Python: `GET /health` reports loaded models and performance metrics
- Python: `POST /infer/frame` accepts `{ "camera_id": "CAM-PHONE", "image_base64": "data:image/jpeg;base64,..." }`
- Node: `GET /api/liceplates` returns validated Indian-format plate records from `server/data/state.json`
- Node: `GET /api/liceplates/:id/rto` performs a lookup only when an authorized provider is configured with `RTO_API_URL` and `RTO_API_KEY`

Plate records are saved in the `liceplates` array in `server/data/state.json`. The server accepts common Indian registrations such as `DL7CR2146` and Bharat Series registrations such as `24BH1234AB`; OCR strings that do not match these formats are discarded. Vehicle-owner information is personal data and is not available from a general public RTO endpoint. Configure only an authorized provider and follow its legal access, consent, retention, and audit requirements.

The current evidence record contains the AI event and contributing signals. Production deployment should replace JSON state with PostgreSQL/object storage and add TLS, operator authentication, retention policy, and a media gateway where camera streams leave the browser.