# Codeway config panel

A configuration management panel and REST API that serves configuration files to mobile apps, with per-parameter country overrides and an AI-assisted flow for generating country-specific value suggestions.

**Status:** early build. This README is updated as features land — see the implementation status table below for what's actually working versus planned.

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
codeway-config-panel/
├── frontend/          Vue app — panel UI
├── backend/           Express app — API
│   ├── routes/        maps paths to controllers, no logic
│   ├── controllers/   request/response handling
│   ├── services/       Firestore access logic
│   └── middleware/     auth middleware
├── AI_USAGE_LOG.md
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

`requireFirebaseAuth` verifies the token via the Firebase Admin SDK and attaches the decoded token to `req.user` — the source of the `updatedBy` field on every write, so a client never supplies its own identity.

### Data model

Firestore collection `parameters`, one document per parameter, keyed by the parameter's own key (e.g. `latestVersion`):

```json
{
  "value": "2.1",
  "type": "string",
  "description": "Latest version of the app.",
  "version": 4,
  "createdAt": "2026-07-15T09:00:00Z",
  "updatedAt": "2026-07-17T14:03:00Z",
  "updatedBy": "manager@example.com",
  "countryOverrides": {
    "TR": { "value": "2.2", "updatedAt": "...", "updatedBy": "..." }
  },
  "suggestions": {
    "DE": {
      "value": "2.1",
      "model": "claude-haiku-4-5-20251001",
      "generatedAt": "...",
      "status": "pending"
    }
  }
}
```

`type` is one of `string`, `number`, `boolean`, `json` — the panel's value input adapts based on this field. `description`, `type`, `version`, `updatedBy`, `countryOverrides`, and `suggestions` are panel-only metadata, stripped from the mobile-facing response.

### Concurrency control

Optimistic locking via the `version` field, checked inside a Firestore transaction. The panel loads a parameter along with its current `version`; on save, it sends the new value plus the `version` it loaded. If the live document's `version` no longer matches, the write is rejected with `409 Conflict` rather than silently overwriting a concurrent edit.

### Country audience resolution

Given a parameter document and an optional `country` query parameter:

1. Normalize the country code.
2. If `countryOverrides[country]` exists, return it.
3. Otherwise, return the default `value`.

An unrecognized or missing country is not an error — it's the default path.

### AI-assisted suggestions

Manager-triggered only, never automatic. The manager selects which countries to target, the backend makes a single server-side call to generate suggested values, validates each against the parameter's `type`, and stores valid results in the `suggestions` map with `status: "pending"`. The manager reviews each suggestion against the default value and approves, edits then approves, or rejects — approval writes through the same version-checked path as any manual edit.

### Serving endpoint and caching

The mobile-facing `GET /config` endpoint reads from an in-memory config compiled once at server startup and kept live via a Firestore `onSnapshot` listener — not a per-request Firestore read. This keeps the endpoint's read cost constant regardless of traffic volume.

---

## Implementation status

| Area                                                 | Status                                         |
| ---------------------------------------------------- | ---------------------------------------------- |
| Firebase Auth (panel login)                          | ✅ Working end-to-end                          |
| Firestore connectivity (Admin SDK)                   | ✅ Confirmed read/write                        |
| Vue routing (`/`, `/signin`)                         | ✅ Working, protected by auth guard            |
| Parameters CRUD (backend + panel)                    | ✅ Full CRUD in panel, incl. delete + confirm  |
| Concurrency control (implemented, not just designed) | ✅ Version-checked `PUT`, recoverable 409 UX   |
| Country audience UI + logic                          | ✅ Override modal + audience resolution        |
| AI-assisted suggestion flow                          | ✅ Generate + review (approve/edit/reject)     |
| Mobile-facing serving endpoint                       | ✅ Token-protected `GET /config`, live cache   |
| Responsive/mobile panel layout                       | ✅ Table-to-cards < 768px, modals fit viewport |
| Deployment (live URLs)                               | ✅ Cloud Run + Firebase Hosting                |

---

## Known limitations

Deliberate scope decisions, recorded so they read as choices rather than oversights.

**Deletes are not version-checked.** `PUT` uses optimistic locking; `DELETE` does not. The interleaving that matters, deleting a parameter while another manager edits it, is already safe: the update transaction checks existence before the version, so the in-flight edit gets a `404` rather than resurrecting the document. A version check on delete would only guard against removing a recently-edited parameter, which is a judgment call rather than a lost update.
Adding `expectedVersion` to `DELETE` is a natural extension.

**Parameter `type` is immutable.** `PUT` accepts `value` only. Country overrides and AI suggestions are both validated against a parameter's `type`, so changing it would strand existing data that no longer matches its own schema. Delete and recreate is the honest migration path.

**`description` cannot be edited after creation.** This one is a gap rather than a design choice, a typo in a description is currently permanent. It would flow through the same version-checked transaction as a value edit if added.

**A dead config listener serves stale config silently.** `GET /config` reads from an in-memory snapshot kept live by a Firestore `onSnapshot` listener. The listener's error handler rejects only during startup; if it fails after the initial load, the endpoint keeps serving the last-known config with nothing to surface the staleness — no error to the caller, no health signal. This is the cost of constant-time reads over a per-request query; re-subscribing on error (or flagging a degraded state) is the natural extension.

---

## Getting started

### Prerequisites

- Node.js (v20+)
- A Firebase project with Authentication (Email/Password) and Firestore enabled
- A Firebase service account key (for the backend)

### Clone and install

```bash
git clone https://gitlab.com/grmbyrn/codeway-config-panel.git
cd codeway-config-panel

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

**Panel:** https://codeway-config-panel-beb48.web.app
**API:** https://codeway-config-api-2972348380.europe-west1.run.app

Both halves deploy independently. To deploy with your own credentials:

### Backend — Cloud Run

Config is passed as environment variables, not a mounted key file. Copy
`backend/.env.example` to `backend/env.yaml` in Cloud Run's YAML format and fill
in your service account values, then:

```bash
cd backend
gcloud run deploy codeway-config-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --env-vars-file env.yaml
```

`FRONTEND_ORIGIN` must match your deployed panel origin or CORS will reject the
panel's requests. `API_TOKEN` is required — the server refuses to start without
it.

### Frontend — Firebase Hosting

```bash
cd frontend
# .env.production holds VITE_API_BASE_URL, pointing at your Cloud Run URL
npm run build
firebase deploy --only hosting
```

Set the Firebase project in `.firebaserc`, and add your Hosting domain to
Firebase Authentication's authorized domains or sign-in will fail in production.

### Verifying the serving endpoint

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  https://codeway-config-api-2972348380.europe-west1.run.app/config
```

---

## AI usage

AI tools were used throughout this project's design and development, with particular emphasis on the areas the brief calls out: understanding requirements, exploring architectural alternatives, and debugging. A full, dated log of specific usage — including what was asked, and how each output was evaluated or corrected before use — is maintained in [`AI_USAGE_LOG.md`](./AI_USAGE_LOG.md).
