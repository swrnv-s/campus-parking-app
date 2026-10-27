# Campus Vehicle Parking & Pass Management
1. `npm install` · copy `.env.example` to env vars (MongoDB must be running)
2. `ADMIN_EMAIL=admin@campus.edu ADMIN_PASSWORD=secret npm run seed` (creates admin, settings, demo buildings/lots/slots)
3. `npm start` → http://localhost:3000

Backend is authoritative for slot state, reservation expiry (checked on every request + every 15 s), passes, and QR verification.
Atomic slot claim + partial unique indexes enforce: one active reservation per slot, one active session per vehicle, unique active normalized vehicle numbers.
Print QR codes from Admin tab → "Slot QR codes". Eligibility rules live in the `ELIGIBLE` map in routes.js.

## Admin management
Admin pages under `/admin/*`: buildings & lots (click map for coordinates), drag-and-drop layout editor (positions stored as `position.x/y`), slot maintenance/active/type, slot delete (blocked while reserved/occupied), QR download/print, passes list.

- Added: vehicle approval revoke (cancels active reservations, revokes passes), pass revoke, approval history list, campus-wide session history, coordinate editing for buildings/lots.

## Tests
With the server running and seeded: `npm run test:e2e` (add `SLOW=1` to include the 62-second reservation-expiry check). Covers duplicate vehicles, approval, passes, reserve/QR/leave, wrong-user and wrong-slot QR, two simultaneous sessions, cancel, vehicle limit and settings.

## Routes
`/` `/login` `/register` · `/user/{dashboard,vehicles,parking,reservations,active-parking,history,profile}` · `/admin/{dashboard,vehicles,passes,buildings,parking-lots,parking-layout,settings,statistics}` · `/qr/verify?token=…` (slot QR codes now encode this URL). All pages share `public/js/app.js`.

## Backend layout
`routes/` (URL → handler, auth/rate-limit middleware) → `controllers/` (request handling, business rules) → `services/` (availability, reservation expiry, walking routing) · `middleware/` (auth, role, id validation, lazy expiry, error handler) · `utils/` · `config/constants.js` · `models/`.
`GET /api/parking/route?lotId=&fromLat=&fromLng=` returns a walking route with turn-by-turn steps (OSRM-compatible server set by `ROUTING_URL`; falls back to a straight-line estimate).

## Vehicle rules, repairs and known fixes
- **Cycles have no registration number.** Leave it blank; the server labels it `CYCLE-XXXXXX` and stores no normalized number, so any number of cycles can be registered. Two- and four-wheelers need a valid number (4-15 letters/digits, at least one of each).
- **Uniqueness:** index `one_active_vehicle_registration` is unique on `normalizedVehicleNumber` only for ACTIVE vehicles that have one (`partialFilterExpression: {active:true, normalizedVehicleNumber:{$type:'string'}}`). `TN 23 AB 1234`, `tn23ab1234` and `TN23AB1234` collide; a deregistered vehicle's number can be registered again.
- **Upgrading an older database:** `npm run repair:vehicles` drops the old index, cleans cycle/empty values, re-normalizes numbers, reports duplicate active registrations, and recreates the index.
- **After a crash or manual DB edits:** `npm run repair:parking` expires overdue reservations and reconciles slot status against active reservations and sessions.
- `npm run create-admin` creates or promotes an admin. In production the server refuses to start without a real `SESSION_SECRET` and uses secure cookies.
- Vehicle details/history: `GET /api/vehicles/:id`; `PUT /api/vehicles/:id` edits model/colour only.
