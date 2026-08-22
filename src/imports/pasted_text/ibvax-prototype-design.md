Build an **exceptionally polished frontend-only prototype** for a Smart India Hackathon project called:

# IBVAP-X

### Intelligent Border Video Analytics & Threat Intelligence Platform

This is a **frontend-only prototype**. Do NOT build the backend or real AI inference yet.

Use **realistic simulated/mock data** to make every feature fully interactive and demonstrable.

The UI should look like a **professional border-security command center**, not a generic admin dashboard.

---

# 1. CORE DESIGN PHILOSOPHY

The first impression should be:

> "This looks like an actual operational surveillance system."

Design language:

* Premium dark command-center interface
* Graphite/black background
* Subtle glass panels
* Professional typography
* Restrained accent colors
* Minimal but meaningful animations
* Dense information without clutter
* High-quality charts
* Tactical map visualization
* Real-time telemetry
* Smooth transitions
* Excellent responsive behavior

Avoid:

* Generic SaaS dashboard
* Excessive neon
* Gaming-style UI
* Huge unnecessary cards
* Random gradients everywhere
* Fake-looking AI effects

Use animations only where they communicate system activity.

---

# 2. GLOBAL LAYOUT

Create:

### LEFT SIDEBAR

IBVAP-X logo/mark

Navigation:

* Command Center
* Live Surveillance
* Video Analysis
* Incidents
* Threat Intelligence
* Entity Tracking
* Sector Map
* Analytics
* Evidence Center
* System Health
* Settings

At bottom:

● SYSTEM ONLINE

AI ENGINE
OPERATIONAL

---

# 3. TOP BAR

Display:

IBVAP-X
BORDER INTELLIGENCE SYSTEM

Current date/time

System status:
● OPERATIONAL

Network:
CONNECTED

AI:
ACTIVE

Notifications icon

User/operator profile

---

# 4. COMMAND CENTER

This must be the most impressive page.

Header:

## COMMAND CENTER

Real-Time Border Intelligence

Top statistics:

* ACTIVE CAMERAS
* PERSONS TRACKED
* VEHICLES TRACKED
* ACTIVE INCIDENTS
* CRITICAL ALERTS
* SYSTEM FPS
* PROCESSING LATENCY

Make these values animate/update periodically using mock data.

---

# 5. LIVE SURVEILLANCE GRID

Create a professional multi-camera monitoring wall.

Support:

### 1 camera

### 2 cameras

### 4 cameras

### 6 cameras

Each camera panel must show:

CAM-01
SECTOR NORTH-04

● LIVE

FPS: 28
Latency: 42 ms

Overlay:

Person #17
Person #23
Vehicle #08

Draw realistic bounding boxes over the video.

Show:

* tracking IDs
* detection confidence
* object class
* trajectory lines

Use prerecorded/sample video assets or visually convincing simulated surveillance footage where available.

---

# 6. VIDEO SOURCE SWITCHER

Create a highly polished control:

### VIDEO SOURCE

[ LIVE CAMERA ] [ UPLOAD VIDEO ]

LIVE CAMERA:

* Camera selector
* connection status
* FPS
* resolution
* latency

UPLOAD VIDEO:

* drag-and-drop area
* file browser
* video preview
* filename
* duration
* size
* analysis status

After upload:

[ START AI ANALYSIS ]

Then show:

ANALYZING VIDEO
Frame 1823 / 5400
34%

Allow:

[ PAUSE ]
[ STOP ]
[ RESTART ]

Even though this is frontend-only, simulate the entire workflow.

---

# 7. AI DETECTION OVERLAY

Create a dedicated visual system for detections.

For people:

PERSON #37
Confidence 96%

For vehicles:

VEHICLE #08
Confidence 94%

For plates:

PLATE
PB10AB1234
Confidence 91%

Allow an operator to toggle:

☑ Bounding Boxes
☑ Tracking IDs
☑ Trajectories
☑ Confidence
☑ Restricted Zones
☑ Risk Indicators

---

# 8. VIRTUAL BORDER / GEOFENCE

This should be highly interactive.

Allow the user to:

* Create restricted zone
* Edit zone
* Delete zone
* Rename zone
* Change severity
* Activate/deactivate

Visually display polygon boundaries on the surveillance feed.

Example:

RESTRICTED ZONE A
HIGH SECURITY

When mock person crosses it:

Trigger:

🚨 INTRUSION DETECTED

Animate the relevant camera panel subtly.

---

# 9. RISK ENGINE

Make this a major visual feature.

Display:

## THREAT SCORE

### 91 / 100

CRITICAL

Create a professional circular/radial gauge.

Below it show contributing factors:

Restricted-zone intrusion     +30
Loitering                     +20
Unusual movement              +15
Sensitive-zone approach       +20
Repeated activity             +06

TOTAL                         91

Make every factor interactive.

Clicking a factor should explain why it affected the score.

Important:

Never claim that the system has proven criminal identity.

Use:

"Potential Threat"
"Suspicious Entity"
"Risk Score"

---

# 10. INCIDENT ALERT CENTER

Create a real-time alert drawer/panel.

Example:

CRITICAL
Restricted Zone Intrusion
CAM-04
TRACK #37
Risk 91
02:14:32

HIGH
Unusual Loitering
CAM-02
TRACK #19
Risk 73

MEDIUM
Unknown Vehicle
CAM-06
Risk 52

Allow filters:

ALL
CRITICAL
HIGH
MEDIUM
LOW

Allow sorting by:

* severity
* time
* camera
* risk score

---

# 11. INCIDENT INVESTIGATION

Clicking an alert opens a detailed investigation screen.

Display:

INCIDENT #0047

CRITICAL

Risk Score: 91/100

Camera:
CAM-04

Sector:
NORTH BORDER

Timestamp:
02:14:32

---

### EVIDENCE

Large video/image frame.

Show:

[ ▶ REPLAY INCIDENT ]

Create a timeline:

* 10 seconds before
* Detection
* Intrusion
* 10 seconds after

---

# 12. ENTITY PROFILE

Display:

TRACK #37

Type:
PERSON

Face:
NOT AVAILABLE

Appearance:
Dark jacket
Backpack

Movement:
NORTH → EAST

Loitering:
63 seconds

Current location:
SECTOR B

Risk:
91

Do NOT claim identity when the face is unavailable.

---

# 13. FACE-OCCLUSION MODE

Create a visually impressive demonstration for the project's USP.

Show:

FACE STATUS

● FACE OCCLUDED

Then:

Appearance similarity
87%

Trajectory consistency
HIGH

Cross-camera continuity
89%

Display:

"Face-independent tracking active"

This should demonstrate that the system can continue tracking an entity without depending entirely on facial recognition.

---

# 14. CROWD ANALYSIS

Create a dedicated crowd-analysis view.

Display:

PEOPLE DETECTED
47

TRACKED
42

OCCLUDED
11

SUSPICIOUS
2

Show multiple people with tracking IDs.

Highlight one suspicious trajectory.

Display:

TRACK #37

Trajectory anomaly:
HIGH

Restricted-zone proximity:
HIGH

Risk:
84

Include a density heatmap overlay.

---

# 15. MULTI-CAMERA ENTITY TRACKING

Create a beautiful cross-camera timeline.

Example:

CAM-01
↓
CAM-04
↓
CAM-07
↓
CAM-09

TRACK #37

Appearance Match
89%

Temporal Consistency
HIGH

Trajectory Consistency
HIGH

Label it:

POSSIBLE SAME ENTITY

Do not call it 100% identity confirmation.

---

# 16. ANPR MODULE

Create a dedicated vehicle intelligence panel.

Vehicle:

VEHICLE #08

Plate:

PB10AB1234

Confidence:

94%

Camera:

CAM-06

Time:

03:12:45

Status:

UNKNOWN

Add mock watchlist functionality.

Statuses:

AUTHORIZED
UNKNOWN
WATCHLIST

Clicking a plate opens its history.

---

# 17. VEHICLE TRACKING

Show:

Vehicle #08

CAM-02
↓
CAM-04
↓
CAM-06

Total distance:
2.8 km

Time tracked:
11 min

Create a clean trajectory visualization.

---

# 18. SECTOR MAP

Create a tactical map page.

Show:

* Camera locations
* Border sectors
* Restricted zones
* Active incidents
* Camera status
* Threat levels
* Entity locations

Example:

CAM-01 ●
CAM-02 ●
CAM-03 ●

🚨 INCIDENT

Use a stylized tactical map rather than a generic Google Maps clone.

Clicking a camera should open its feed.

---

# 19. ANALYTICS

Create an impressive analytics page.

Charts:

### INCIDENTS OVER TIME

Line chart

### THREAT DISTRIBUTION

Donut chart

### INCIDENTS BY SECTOR

Bar chart

### OBJECT DETECTIONS

Persons vs Vehicles

### CAMERA ACTIVITY

Camera utilization

### RISK SCORE DISTRIBUTION

Histogram

### TOP INCIDENT TYPES

Intrusion
Loitering
Unknown Vehicle
Boundary Crossing

All charts should respond to date/filter changes.

---

# 20. EVIDENCE CENTER

Create an evidence management interface.

Each incident card contains:

Incident ID
Timestamp
Camera
Sector
Entity
Risk
Event type
Evidence thumbnail

Actions:

VIEW
REPLAY
DOWNLOAD
EXPORT REPORT

Filters:

Date
Camera
Sector
Severity
Event Type

---

# 21. AUTOMATED INCIDENT REPORT

Create a beautiful report preview.

Example:

## BORDER SECURITY INCIDENT REPORT

Incident:
#0047

Severity:
CRITICAL

Detected:
02:14:32

Camera:
CAM-04

Entity:
TRACK #37

Event:
Restricted Zone Intrusion

Risk:
91/100

Evidence:
3 frames
1 video clip

Risk Factors:
...

Provide:

[ EXPORT PDF ]

For frontend prototype, simulate the export action.

---

# 22. SYSTEM HEALTH

Create a technical monitoring page.

Display:

AI ENGINE
● ONLINE

VIDEO PROCESSOR
● ONLINE

DATABASE
● ONLINE

CAMERA NETWORK
● ONLINE

API
● ONLINE

Show:

CPU usage
GPU usage
Memory
FPS
Latency
Camera uptime
Network bandwidth

Use animated real-time mock telemetry.

---

# 23. CAMERA HEALTH

Create a camera management screen.

Each camera:

CAM-01

● ONLINE

FPS: 29
Latency: 41ms
Resolution: 1080p
Uptime: 99.8%

Allow:

VIEW
RESTART
CONFIGURE

Include disconnected-camera simulation.

---

# 24. NOTIFICATION CENTER

Create a notification system.

Examples:

🚨 Critical intrusion detected
CAM-04

⚠️ Camera latency increased
CAM-02

✓ Incident report generated
#0047

Allow:

* mark as read
* clear all
* filter

---

# 25. DEMO MODE — EXTREMELY IMPORTANT

Create a dedicated:

## SIH DEMO MODE

button.

When clicked, the application should run a controlled demonstration.

Sequence:

### STEP 1

Normal surveillance

### STEP 2

Crowd detected

### STEP 3

Suspicious entity appears

### STEP 4

Entity approaches restricted zone

### STEP 5

Face becomes unavailable

### STEP 6

Tracking continues using appearance/trajectory

### STEP 7

Entity crosses virtual fence

### STEP 8

Risk score increases

### STEP 9

CRITICAL ALERT appears

### STEP 10

Incident automatically created

### STEP 11

Evidence generated

### STEP 12

Incident replay becomes available

The entire sequence should feel seamless and impressive.

Provide:

[ START DEMO ]

[ SKIP ]

[ RESET DEMO ]

---

# 26. SEARCH

Create a global search bar.

Search by:

* Incident ID
* Camera
* Track ID
* License plate
* Sector
* Timestamp

Example:

Search:
TRACK #37

Results:

Camera history
Incident history
Trajectory
Risk scores
Evidence

---

# 27. FILTER SYSTEM

Global filters:

Date
Time
Sector
Camera
Severity
Event type
Entity type

Filters should update dashboard values and charts using mock data.

---

# 28. SETTINGS

Include:

Appearance
Alert thresholds
Camera configuration
Risk parameters
Notification settings
Operator settings

Make these functional in frontend state.

---

# 29. MOCK DATA ARCHITECTURE

Create realistic structured mock data for:

cameras
persons
vehicles
incidents
alerts
tracks
plates
risk scores
sectors
analytics
system metrics

Do NOT scatter random hardcoded values throughout components.

Create centralized mock-data modules.

Make the architecture ready to replace mock APIs with real APIs later.

---

# 30. TECH STACK

Use:

React / Next.js
TypeScript
Tailwind CSS

Use high-quality component architecture.

Use:

* Lucide icons
* Recharts or equivalent
* Framer Motion for subtle animations
* Leaflet/MapLibre or another suitable mapping library if useful
* HTML5 video for video playback

Keep components reusable.

---

# 31. RESPONSIVENESS

Optimize primarily for:

1920×1080
1440×900
1366×768

Also support tablets reasonably.

The SIH presentation will primarily use a large screen.

---

# 32. FINAL QUALITY BAR

Before finishing, verify:

* No broken buttons
* No dead navigation
* No console errors
* No placeholder "Lorem ipsum"
* No generic dashboard components
* No empty pages
* Every major button produces a visible interaction
* Mock data feels realistic
* Animations are smooth
* Loading states exist
* Error states exist
* Empty states exist
* Video upload flow works visually
* Live camera flow works visually
* Demo mode works from start to finish
* All pages share the same visual language

The final frontend should feel like a **real operational border intelligence product being demonstrated to SIH judges**, not a student dashboard.

Prioritize **WOW factor + usability + technical credibility + complete demo flow**.
