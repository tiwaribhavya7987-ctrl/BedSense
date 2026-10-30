# BedSense — Smart Hospital Bed IoT Dashboard

Premium futuristic medical-tech React + TypeScript + Vite starter for the Smart Hospital Bed prototype.

## Requirements
- Node.js 20+ recommended
- A Firebase project with Authentication and Realtime Database enabled

## Run locally
```bash
npm install
cp .env.example .env.local
# Fill in your Firebase web-app configuration in .env.local
npm run dev
```
On Windows PowerShell, use `Copy-Item .env.example .env.local`.

## Firebase setup
1. In Firebase Console, create a Web App and copy its public web configuration to `.env.local`.
2. Enable Email/Password and Google providers in Authentication.
3. Add the local Vite origin (usually `http://localhost:5173`) to Authentication > Settings > Authorized domains.
4. Create Realtime Database and set `VITE_FIREBASE_DATABASE_URL`.
5. Restart Vite after changing environment variables.

The frontend listens to `beds/BED-001/current`. Example schema (not actual readings):
```json
{
  "deviceId": "BED-001",
  "mode": "active",
  "heartRate": null,
  "spo2": null,
  "temperature": null,
  "humidity": null,
  "bedAngle": null,
  "sos": false,
  "fireAlarm": false,
  "temperatureMonitoring": false,
  "lastUpdated": 0
}
```
`lastUpdated` is expected in Unix milliseconds. The device firmware must be updated separately to write authenticated records. Do not expose service-account credentials in browser code or firmware.

## Demo mode
Set `VITE_DEMO_MODE=true` only for a clearly labelled UI preview. Values are illustrative and are not real patient data. Keep it false for hardware integration.

## Security — required before deployment
This starter does not yet include a trusted admin bootstrap backend, Firebase custom claims, persistent event logging, or device identity provisioning. The Admin page deliberately identifies that setup requirement. Do not deploy with public database reads/writes. Configure Firebase Security Rules to deny access by default and allow only authenticated, authorized users; device writes should use a trusted server endpoint or properly provisioned device identity. Never let a client edit its own admin role. Google sign-in and email/password flows require Firebase Console configuration. Clinical thresholds are not diagnoses; this is not a certified medical device and must not replace local emergency safety mechanisms.

## Current implementation notes
- Login, email/password registration, password reset, Google sign-in are wired to Firebase when configured.
- Authenticated users can read the current BED-001 record through a realtime listener (subject to database rules).
- Dark/light theme, responsive navigation, bed details, analytics shell, current alert states, settings and admin setup status are implemented.
- Historical chart is explicitly marked as illustrative UI styling; replace it with actual timestamped history before production. Analytics and persistent event history need a documented history/events schema and queries.
- Admin UI is not a security boundary. Server-enforced role checks and database rules are required before enabling admin operations.
- Bed angle visualization is read-only; no motor control is implemented.
