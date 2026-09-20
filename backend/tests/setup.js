// Hard assignment, not ??= — this is the safety rail. Even if a real project id
// leaks in from the shell or a stray .env, tests cannot reach live Firestore.
// Firebase treats `demo-*` ids as guaranteed-local and refuses to contact Google.
process.env.FIREBASE_PROJECT_ID = 'demo-config-panel'

// ??= because `firebase emulators:exec` already set this to the port the
// emulator actually bound; only supply a default when nothing did.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

process.env.API_TOKEN = 'test-api-token'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

// No test should ever fire a real, billed Anthropic request. Suggestion tests
// set this explicitly and stub fetch.
delete process.env.ANTHROPIC_API_KEY

// ADC pings the GCE metadata server to check if we're on Google Cloud. On a
// laptop nothing answers, costing ~3s per test file before it gives up. The
// emulator's insecure channel never needs a credential anyway.
process.env.METADATA_SERVER_DETECTION = 'none'
