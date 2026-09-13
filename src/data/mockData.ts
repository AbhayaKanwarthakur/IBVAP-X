export const cameras = [
  { id: 'WEBCAM', sector: 'LOCAL WEBCAM', status: 'offline', fps: 0, latency: 0, resolution: '1080p', uptime: 0, location: { x: 50, y: 50 }, streamUrl: '', protocol: 'browser-camera' },
];

export const persons = [
  { id: 'TRACK-017', type: 'PERSON', appearance: 'Dark jacket, backpack', movement: 'NORTH → EAST', loitering: 63, sector: 'SECTOR B', risk: 91, status: 'CRITICAL', faceAvailable: false, cam: 'CAM-04', x: 55, y: 40 },
  { id: 'TRACK-023', type: 'PERSON', appearance: 'Grey hoodie, jeans',   movement: 'EAST → SOUTH', loitering: 12, sector: 'SECTOR A', risk: 42, status: 'MEDIUM',   faceAvailable: true, cam: 'CAM-02', x: 30, y: 60 },
  { id: 'TRACK-031', type: 'PERSON', appearance: 'Blue shirt, cap',       movement: 'STATIONARY',   loitering: 5,  sector: 'SECTOR C', risk: 18, status: 'LOW',      faceAvailable: true, cam: 'CAM-01', x: 70, y: 30 },
  { id: 'TRACK-019', type: 'PERSON', appearance: 'Black coat, bag',        movement: 'WEST → NORTH', loitering: 34, sector: 'SECTOR D', risk: 73, status: 'HIGH',     faceAvailable: false, cam: 'CAM-02', x: 20, y: 55 },
  { id: 'TRACK-037', type: 'PERSON', appearance: 'Dark jacket, backpack', movement: 'NORTH → EAST', loitering: 63, sector: 'SECTOR B', risk: 91, status: 'CRITICAL', faceAvailable: false, cam: 'CAM-04', x: 55, y: 42 },
];

export const vehicles = [
  { id: 'VEH-008', plate: 'PB10AB1234', confidence: 94, cam: 'CAM-06', time: '03:12:45', status: 'UNKNOWN',    type: 'Sedan',  color: 'White',  distance: 2.8, duration: '11 min' },
  { id: 'VEH-012', plate: 'HR26DL9821', confidence: 97, cam: 'CAM-04', time: '02:48:10', status: 'AUTHORIZED', type: 'SUV',    color: 'Black',  distance: 1.2, duration: '4 min'  },
  { id: 'VEH-015', plate: 'DL8CAF0045', confidence: 89, cam: 'CAM-02', time: '01:33:22', status: 'WATCHLIST',  type: 'Truck',  color: 'Grey',   distance: 4.1, duration: '18 min' },
  { id: 'VEH-021', plate: 'MH01AB3344', confidence: 91, cam: 'CAM-09', time: '00:55:17', status: 'UNKNOWN',    type: 'Pickup', color: 'Brown',  distance: 0.7, duration: '3 min'  },
];

export const incidents = [
  {
    id: '#0047', severity: 'CRITICAL', type: 'Restricted Zone Intrusion',
    cam: 'CAM-04', sector: 'NORTH BORDER', track: 'TRACK-037', risk: 91,
    time: '02:14:32', status: 'OPEN', description: 'Entity crossed virtual fence boundary at RESTRICTED ZONE A. Loitering detected for 63 seconds prior to breach.',
    evidence: { frames: 3, clips: 1 },
    riskFactors: [
      { label: 'Restricted-zone intrusion', score: 30, reason: 'Entity physically crossed the designated restricted perimeter at coordinate sector B, zone boundary 3.' },
      { label: 'Loitering', score: 20, reason: 'Entity remained stationary or near-stationary for 63 seconds in a sensitive approach corridor.' },
      { label: 'Unusual movement', score: 15, reason: 'Trajectory analysis shows non-linear path inconsistent with authorized transit routes.' },
      { label: 'Sensitive-zone approach', score: 20, reason: 'Entity approached within 5m of classified installation boundary twice before intrusion.' },
      { label: 'Repeated activity', score: 6, reason: 'Pattern matching indicates 2 prior loitering events in adjacent sector within 72 hours.' },
    ],
  },
  {
    id: '#0046', severity: 'HIGH', type: 'Unusual Loitering',
    cam: 'CAM-02', sector: 'EAST CORRIDOR', track: 'TRACK-019', risk: 73,
    time: '01:58:17', status: 'OPEN', description: 'Suspicious entity loitering near perimeter checkpoint for extended duration without authorization.',
    evidence: { frames: 5, clips: 1 },
    riskFactors: [
      { label: 'Loitering', score: 30, reason: 'Entity loitered for 34 seconds at restricted approach zone.' },
      { label: 'Unusual movement', score: 18, reason: 'Movement pattern indicates surveillance behavior.' },
      { label: 'Face occluded', score: 15, reason: 'Face not visible for 80% of tracked duration.' },
      { label: 'Night-time activity', score: 10, reason: 'Activity during low-visibility hours increases threat weight.' },
    ],
  },
  {
    id: '#0045', severity: 'MEDIUM', type: 'Unknown Vehicle',
    cam: 'CAM-06', sector: 'SOUTH GATE', track: 'VEH-008', risk: 52,
    time: '03:12:45', status: 'INVESTIGATING', description: 'Unregistered vehicle detected near controlled access point. Plate not in authorized database.',
    evidence: { frames: 2, clips: 1 },
    riskFactors: [
      { label: 'Unknown plate', score: 25, reason: 'Plate PB10AB1234 not found in authorized vehicle registry.' },
      { label: 'Restricted approach', score: 15, reason: 'Vehicle moved toward secured gate at 02:00 hrs.' },
      { label: 'Slow movement', score: 12, reason: 'Vehicle speed of 4 km/h indicates possible reconnaissance.' },
    ],
  },
  {
    id: '#0044', severity: 'CRITICAL', type: 'Watchlist Vehicle Detected',
    cam: 'CAM-02', sector: 'WEST ACCESS', track: 'VEH-015', risk: 88,
    time: '01:33:22', status: 'ESCALATED', description: 'Vehicle matching watchlist entry detected. Cross-referenced with regional intelligence database.',
    evidence: { frames: 4, clips: 2 },
    riskFactors: [
      { label: 'Watchlist match', score: 40, reason: 'Plate DL8CAF0045 flagged in national watchlist database.' },
      { label: 'Night-time activity', score: 20, reason: 'Movement during 01:00-04:00 hrs.' },
      { label: 'Repeated sighting', score: 18, reason: 'Same plate detected in 3 different sectors within 30 minutes.' },
      { label: 'Evasive movement', score: 10, reason: 'Vehicle changed routes twice after initial detection.' },
    ],
  },
  {
    id: '#0043', severity: 'LOW', type: 'Boundary Approach',
    cam: 'CAM-08', sector: 'WEST SECTOR', track: 'TRACK-023', risk: 28,
    time: '00:47:11', status: 'RESOLVED', description: 'Individual approached within 15m of boundary but did not cross. Moved away after 20 seconds.',
    evidence: { frames: 1, clips: 0 },
    riskFactors: [
      { label: 'Boundary approach', score: 18, reason: 'Entity came within 15m of restricted boundary.' },
      { label: 'Night-time activity', score: 10, reason: 'Activity during low-visibility hours.' },
    ],
  },
];

export const alerts = [
  { id: 'ALT-001', severity: 'CRITICAL', type: 'Restricted Zone Intrusion', cam: 'CAM-04', track: 'TRACK-037', risk: 91, time: '02:14:32', read: false, incidentId: '#0047' },
  { id: 'ALT-002', severity: 'HIGH',     type: 'Unusual Loitering',          cam: 'CAM-02', track: 'TRACK-019', risk: 73, time: '01:58:17', read: false, incidentId: '#0046' },
  { id: 'ALT-003', severity: 'MEDIUM',   type: 'Unknown Vehicle',             cam: 'CAM-06', track: 'VEH-008',   risk: 52, time: '03:12:45', read: false, incidentId: '#0045' },
  { id: 'ALT-004', severity: 'CRITICAL', type: 'Watchlist Vehicle Detected',  cam: 'CAM-02', track: 'VEH-015',   risk: 88, time: '01:33:22', read: true,  incidentId: '#0044' },
  { id: 'ALT-005', severity: 'LOW',      type: 'Boundary Approach',           cam: 'CAM-08', track: 'TRACK-023', risk: 28, time: '00:47:11', read: true,  incidentId: '#0043' },
  { id: 'ALT-006', severity: 'HIGH',     type: 'Camera Latency Spike',        cam: 'CAM-05', track: '—',         risk: 0,  time: '03:01:05', read: false, incidentId: null },
  { id: 'ALT-007', severity: 'MEDIUM',   type: 'Crowd Density Exceeded',      cam: 'CAM-09', track: '—',         risk: 0,  time: '02:55:33', read: false, incidentId: null },
];

export const systemMetrics = {
  cpu: 67, gpu: 82, memory: 54, fps: 28.4, latency: 41,
  networkBandwidth: 847, diskUsage: 38, aiConfidence: 94.2,
  services: [
    { name: 'AI ENGINE',        status: 'online',  uptime: '99.98%', version: 'v3.2.1' },
    { name: 'VIDEO PROCESSOR',  status: 'online',  uptime: '99.94%', version: 'v2.8.0' },
    { name: 'DATABASE',         status: 'online',  uptime: '99.99%', version: 'PostgreSQL 16' },
    { name: 'CAMERA NETWORK',   status: 'warning', uptime: '97.41%', version: 'v1.9.3' },
    { name: 'API GATEWAY',      status: 'online',  uptime: '99.97%', version: 'v4.1.0' },
    { name: 'ANPR MODULE',      status: 'online',  uptime: '99.83%', version: 'v2.1.4' },
    { name: 'ALERT ENGINE',     status: 'online',  uptime: '99.96%', version: 'v1.7.2' },
  ],
};

export const analyticsData = {
  incidentsOverTime: [
    { time: '00:00', critical: 1, high: 2, medium: 3, low: 1 },
    { time: '01:00', critical: 0, high: 1, medium: 2, low: 3 },
    { time: '02:00', critical: 3, high: 2, medium: 1, low: 0 },
    { time: '03:00', critical: 2, high: 4, medium: 3, low: 2 },
    { time: '04:00', critical: 1, high: 1, medium: 2, low: 4 },
    { time: '05:00', critical: 0, high: 2, medium: 1, low: 2 },
    { time: '06:00', critical: 1, high: 0, medium: 3, low: 1 },
    { time: '07:00', critical: 2, high: 1, medium: 2, low: 0 },
  ],
  threatDistribution: [
    { name: 'CRITICAL', value: 18, color: '#ef4444' },
    { name: 'HIGH',     value: 27, color: '#f97316' },
    { name: 'MEDIUM',   value: 35, color: '#f59e0b' },
    { name: 'LOW',      value: 20, color: '#22c55e' },
  ],
  incidentsBySector: [
    { sector: 'NORTH', count: 12 },
    { sector: 'EAST',  count: 8 },
    { sector: 'SOUTH', count: 5 },
    { sector: 'WEST',  count: 9 },
    { sector: 'CENTRAL', count: 3 },
  ],
  objectDetections: [
    { hour: '00', persons: 14, vehicles: 3 },
    { hour: '01', persons: 23, vehicles: 5 },
    { hour: '02', persons: 47, vehicles: 8 },
    { hour: '03', persons: 31, vehicles: 12 },
    { hour: '04', persons: 18, vehicles: 6 },
    { hour: '05', persons: 9,  vehicles: 2 },
    { hour: '06', persons: 12, vehicles: 4 },
    { hour: '07', persons: 28, vehicles: 9 },
  ],
  riskScores: [
    { range: '0-20', count: 23 },
    { range: '21-40', count: 17 },
    { range: '41-60', count: 12 },
    { range: '61-80', count: 8 },
    { range: '81-100', count: 5 },
  ],
  topIncidentTypes: [
    { type: 'Intrusion',          count: 18 },
    { type: 'Loitering',          count: 31 },
    { type: 'Unknown Vehicle',    count: 14 },
    { type: 'Boundary Crossing',  count: 9  },
    { type: 'Camera Fault',       count: 4  },
  ],
  cameraActivity: cameras.map(c => ({ cam: c.id, utilization: c.status === 'offline' ? 0 : Math.floor(60 + Math.random() * 40) })),
};

export const sectors = [
  { id: 'SEC-A', name: 'NORTH BORDER',  threatLevel: 'HIGH',   cameras: ['CAM-01', 'CAM-02'], incidents: 3, color: '#f97316' },
  { id: 'SEC-B', name: 'EAST CORRIDOR', threatLevel: 'CRITICAL', cameras: ['CAM-03', 'CAM-04'], incidents: 5, color: '#ef4444' },
  { id: 'SEC-C', name: 'SOUTH GATE',    threatLevel: 'MEDIUM', cameras: ['CAM-05', 'CAM-06'], incidents: 2, color: '#f59e0b' },
  { id: 'SEC-D', name: 'WEST ACCESS',   threatLevel: 'LOW',    cameras: ['CAM-07', 'CAM-08'], incidents: 1, color: '#22c55e' },
  { id: 'SEC-E', name: 'CENTRAL HUB',   threatLevel: 'LOW',    cameras: ['CAM-09'],           incidents: 0, color: '#22c55e' },
];

export const restrictedZones = [
  { id: 'RZ-A', name: 'RESTRICTED ZONE A', severity: 'HIGH SECURITY',    active: true,  points: [[10,20],[40,20],[40,50],[10,50]] },
  { id: 'RZ-B', name: 'SECURE PERIMETER B', severity: 'MEDIUM SECURITY', active: true,  points: [[55,15],[85,15],[85,45],[55,45]] },
  { id: 'RZ-C', name: 'BUFFER ZONE C',      severity: 'LOW SECURITY',    active: false, points: [[20,60],[50,60],[50,85],[20,85]] },
];

export const crowdData = {
  total: 47, tracked: 42, occluded: 11, suspicious: 2,
};

export const notifications = [
  { id: 'N001', icon: '🚨', type: 'CRITICAL', message: 'Critical intrusion detected', sub: 'CAM-04 · TRACK-037', time: '02:14', read: false },
  { id: 'N002', icon: '⚠️', type: 'WARNING',  message: 'Camera latency increased',    sub: 'CAM-05 · 120ms',    time: '03:01', read: false },
  { id: 'N003', icon: '✓',  type: 'INFO',     message: 'Incident report generated',   sub: 'Incident #0047',    time: '02:15', read: false },
  { id: 'N004', icon: '🚘', type: 'HIGH',     message: 'Watchlist vehicle detected',  sub: 'CAM-02 · VEH-015',  time: '01:33', read: true  },
  { id: 'N005', icon: '📹', type: 'INFO',     message: 'CAM-07 went offline',         sub: 'WEST SECTOR',        time: '00:12', read: true  },
];

export const demoSteps = [
  { step: 1, title: 'Normal Surveillance',        description: 'All cameras operational. Routine border monitoring in progress.', duration: 3000 },
  { step: 2, title: 'Crowd Detected',             description: '47 individuals detected in SECTOR B. Density approaching alert threshold.', duration: 3000 },
  { step: 3, title: 'Suspicious Entity Appears',  description: 'TRACK #037 flagged — unusual trajectory pattern. Initiating enhanced tracking.', duration: 3000 },
  { step: 4, title: 'Zone Approach Detected',     description: 'Entity approaching RESTRICTED ZONE A. Risk score increasing.', duration: 3000 },
  { step: 5, title: 'Face Occlusion Detected',    description: 'Face not visible. Activating appearance + trajectory-based tracking.', duration: 3000 },
  { step: 6, title: 'Face-Independent Tracking',  description: 'Re-ID confidence: 87%. Cross-camera continuity maintained. System continues tracking without facial recognition.', duration: 3000 },
  { step: 7, title: 'Virtual Fence Crossed',      description: 'CRITICAL: TRACK #037 has crossed restricted boundary. Intrusion confirmed.', duration: 3000 },
  { step: 8, title: 'Risk Score Escalating',      description: 'Threat score now 91/100 — CRITICAL. All risk factors active.', duration: 3000 },
  { step: 9, title: 'CRITICAL ALERT Triggered',   description: '🚨 INCIDENT #0047 — Restricted Zone Intrusion · CAM-04 · Risk 91', duration: 3000 },
  { step: 10, title: 'Incident Created',          description: 'Incident #0047 automatically logged with full context and metadata.', duration: 3000 },
  { step: 11, title: 'Evidence Generated',        description: '3 frames and 1 video clip automatically captured and secured as evidence.', duration: 2500 },
  { step: 12, title: 'Incident Replay Available', description: 'Full incident replay with timeline ready in Evidence Center. Report generation complete.', duration: 2500 },
];
