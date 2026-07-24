# Remote Config Platform

A full-stack remote configuration platform: a Vue 3 admin panel for managing app config, and a token-secured Node/Express REST API that serves it to mobile clients — with optimistic-locking concurrency control, country-based targeting, and a human-in-the-loop AI flow for generating country-specific values.

**Live demo:** https://codeway-config-panel-beb48.web.app · **API:** `GET /config` (see [Serving endpoint](#serving-endpoint-and-caching))

<!-- Add 1–2 screenshots here once you have them:
![Parameters panel](docs/panel.png)
-->

---

## Highlights

- **Optimistic-locking concurrency** — concurrent edits can't silently overwrite each other; a stale write is rejected with a recoverable `409`.
- **Country-based config resolution** — the same parameter can resolve to different values per country, decided at request time.
- **Constant-time serving** — `GET /config` reads from an in-memory snapshot kept live by a Firestore listener, not a per-request query, so read cost stays flat under load.
- **Responsible AI** — AI suggests country values, but a human reviews and approves every one before it's written. Never automatic.
- **Two trust models** — Firebase ID tokens for panel writes (with identity), a static API token for mobile reads.

---

## Tech stack

- **Frontend:** Vue 3, Vue Router, Pinia, Firebase Auth (client SDK)
- **Backend:** Node.js, Express, Firebase Admin SDK
- **Database:** Firestore
- **Auth:** Firebase Authentication (email/password)
- **Deployment:** Cloud Run (backend), Firebase Hosting (frontend)

---

## Project structure

```
remote-config-platform/
├── frontend/          Vue app — panel UI
├── backend/           Express app — API
│   ├── routes/        maps paths to controllers, no logic
│   ├── controllers/   request/response handling
│   ├── services/      Firestore access logic
│   ├── middleware/    auth middleware
│   └── lib/           shared helpers (validation, country resolution)
└── README.md
```

---

## Architecture

Three actors: **app managers** (panel), **mobile clients** (serving API), and the **backend**, which mediates both against a single Firestore database.

```
   Manager --> Vue panel --> Express backend <-- Mobile client
   (browser)  (Firebase       (Cloud Run)          (API token)
               Hosting)            |
                              Firestore
```

### Authentication

Two separate trust models, enforced by two separate middleware functions:

| Caller          | Credential                                        | Middleware            |
| --------------- | ------------------------------------------------- | --------------------- |
| Panel (manager) | Firebase ID token, sent in `Authorization` header | `requireFirebaseAuth` |
| Mobile client   | Static API token, sent in `Authorization` header  | `requireApiToken`     |

`requireFirebaseAuth` verifies the token via the Firebase Admin SDK and attaches the decoded token to `req.user` — the source of the `updatedBy` field on every write, so a client never supplies its own identity. `requireApiToken` compares the mobile client's token with a hashed, timing-safe comparison.

### Data model

Firestore collection `parameters`, one document per parameter, keyed by the parameter's own key (e.g. `latestVersion`):

```json
{
  "value": "2.1",
  "type": "string",
  "description": "Latest version of the app.",
  "version": 4,
  "createdAt": "2026-01-15T09:00:00Z",
  "updatedAt": "2026-01-17T14:03:00Z",
  "updatedBy": "manager@example.com",
  "countryOverrides": {
    "TR": { "value": "2.2", "updatedAt": "...", "updatedBy": "..." }
  },
  "suggestions": {
    "DE": { "value": "2.1", "generatedAt": "...", "status": "pending" }
  }
}
```

`type` is one of `string`, `number`, `boolean`, `json` — the panel's value input adapts based on this field. `description`, `type`, `version`, `updatedBy`, `countryOverrides`, and `suggestions` are panel-only metadata, stripped from the mobile-facing response.

### Concurrency control

Optimistic locking via the `version` field, checked inside a Firestore transaction. The panel loads a parameter with its current `version`; on save, it sends the new value plus the `version` it loaded. If the live document's `version` no longer matches, the write is rejected with `409 Conflict` rather than silently overwriting a concurrent edit.

### Country audience resolution

Given a parameter document and an optional `country` query parameter:

1. Normalize the country code.
2. If `countryOverrides[country]` exists, return it.
3. Otherwise, return the default `value`.

An unrecognized or missing country is not an error — it's the default path.

### AI-assisted suggestions

Manager-triggered only, never automatic. The manager selects which countries to target; the backend makes a single server-side call to generate suggested values, validates each against the parameter's `type`, and stores valid results in the `suggestions` map with `status: "pending"`. The manager reviews each suggestion against the default value and approves, edits then approves, or rejects — approval writes through the same version-checked path as any manual edit.

### Serving endpoint and caching

The mobile-facing `GET /config` endpoint reads from an in-memory config compiled once at server startup and kept live via a Firestore `onSnapshot` listener — not a per-request Firestore read. This keeps the endpoint's read cost constant regardless of traffic volume.

```bash
curl -H "Authorization: Bearer $API_TOKEN" "<your-api-url>/config?country=TR"
```

---

## Features

- Full parameter CRUD in the panel, with a confirm step on delete
- Version-checked updates with a recoverable conflict UX when two managers clash
- Per-parameter country overrides via a modal, with live audience resolution in `/config`
- Type-aware value inputs (string / number / boolean / JSON)
- AI suggestion generation with per-country approve / edit / reject review
- Token-protected serving endpoint with an in-memory live cache
- Responsive panel — table on desktop, cards on narrow viewports

---

## Design notes & tradeoffs

Recorded so they read as decisions rather than oversights:

- **Deletes are not version-checked.** `PUT` uses optimistic locking; `DELETE` does not. The interleaving that matters — deleting a parameter while another manager edits it — is already safe: the update transaction checks existence before the version, so the in-flight edit gets a `404` rather than resurrecting the document.
- **Parameter `type` is immutable.** `PUT` accepts `value` only. Country overrides and AI suggestions are validated against a parameter's `type`, so changing it would strand data that no longer matches its own schema.
- **A dead config listener serves stale config silently.** `GET /config` serves from an in-memory snapshot kept live by a Firestore `onSnapshot` listener. If the listener fails after startup, the endpoint keeps serving the last-known config with no health signal — the cost of constant-time reads over a per-request query. Re-subscribing on error is the natural extension.

---

## Getting started

### Prerequisites

- Node.js (v20+)
- A Firebase project with Authentication (Email/Password) and Firestore enabled
- A Firebase service account key (for the backend)

### Clone and install

```bash
git clone https://github.com/grmbyrn/remote-config-platform.git
cd remote-config-platform

cd frontend && npm install
cd ../backend && npm install
```

### Environment variables

**`backend/.env`** (see `backend/.env.example`):

```
PORT=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FRONTEND_ORIGIN=
API_TOKEN=
ANTHROPIC_API_KEY=
```

**`frontend/.env`** (see `frontend/.env.example`):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Run locally

```bash
# backend
cd backend
npm run dev   # http://localhost:3000

# frontend, in a separate terminal
cd frontend
npm run dev   # http://localhost:5173
```

---

## Deployment

Both halves deploy independently.

### Backend — Cloud Run

Config is passed as environment variables. Copy `backend/.env.example` to `backend/env.yaml` in Cloud Run's YAML format, fill in your values, then:

```bash
cd backend
gcloud run deploy config-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --env-vars-file env.yaml
```

`FRONTEND_ORIGIN` must match your deployed panel origin or CORS will reject the panel's requests. `API_TOKEN` is required — the server refuses to start without it.

### Frontend — Firebase Hosting

```bash
cd frontend
# .env.production holds VITE_API_BASE_URL, pointing at your Cloud Run URL
npm run build
firebase deploy --only hosting
```

Set the Firebase project in `.firebaserc`, and add your Hosting domain to Firebase Authentication's authorized domains or sign-in will fail in production.
