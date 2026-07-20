# AI Usage Log

**Tool used:** Claude (Opus), primarily through Claude Code in VS Code, with some
planning conversations in the Claude desktop app.

**What I used it for:** understanding and pulling apart the brief. Exploring
alternatives before committing to an approach (concurrency strategy, repo
structure, response shaping), debugging, reviewing my own code for bugs I'd
missed and checking deployed state against local config before redeploying.

**How I evaluated the output:** the dated entries below are the record. Where a
suggestion was wrong or didn't fit the design, I've noted what I changed and why.
Where it was right, I've noted how I verified it rather than just accepting it.
Corrections in both directions are included.

## 17/07/2026

- Reviewed the case study brief with Claude to separate explicit requirements from ambiguous sections left open to interpretation (e.g. country audience UI, AI-targeting logic). Asked Claude to flag which parts were its own suggestions rather than stated requirements.
- Discussed four approaches to preventing concurrent-edit conflicts (optimistic locking with a version field, Firestore's native updateTime precondition, pessimistic locking, last-write-wins). Chose the explicit version-field approach since it's easier to explain and defend, and fits cleanly with the country-override feature.
- Weighed monorepo vs. two separate GitLab repos against the "separation of services" requirement. Went with a monorepo with clean folder separation to avoid doubling reviewer-access admin overhead.
- Built the Firestore schema iteratively, then cross-checked it against the actual panel screenshots provided. Caught two missing fields (description, createdAt) that were visible in the screenshots but absent from the draft schema.
- Debugged a sign-in form where the error message wasn't rendering. Root cause was a catch (error) block shadowing an outer error ref of the same name. Verified the fix by retesting both success and failure paths manually.
- Flagged that Claude's initial backend scaffold wired handler logic directly into the route files, with no controller layer. Restructured it into a routes → controllers → services split: routes only map paths to handlers, controllers own the HTTP request/response concerns, and services own data access (Firestore). This keeps business logic out of the route files, makes the data layer unit-testable in isolation and swappable without touching HTTP code, and turns the brief's "separation of services" from aspirational into something actually enforced by the structure.
- Used Claude to sketch rough wireframes for two screens not in the provided screenshots (country override editor, AI suggestion review), then had them re-rendered to match the real panel's color palette and typography.

## 18/07/2026

- I had Claude cross-check the actual code against the README's status table before starting, and it turned up two things listed as done that weren't there yet — the requireFirebaseAuth middleware and the frontend route guard. Corrected the plan to build them.
- Claude's first cut of the create endpoint used .set(); I switched it to .create() so a duplicate key returns a 409 instead of silently overwriting existing config and resetting its version.
- Pushed Claude to settle the version-conflict 409 body (current value/version/updatedBy) before writing the transaction, so the service, controller and frontend shared one contract — and kept it distinct from the duplicate-key 409.
- Caught two input traps in Claude's suggestions: guarded with value === undefined instead of !value (so false/0/"" aren't rejected), and coerced expectedVersion to a number so a stringified value wouldn't cause a phantom conflict.
- Asked Claude how to build the route guard. It flagged that auth.currentUser is null on a hard refresh until Firebase restores the session and gave an onAuthStateChanged approach that waits for the initial auth state. Verified it by testing the refresh case, which is exactly where the naive version would have bounced a logged-in user.
- Claude's create-row plan assumed a type-aware value input. I checked it against the panel screenshot, saw there's no type selector there, and had it default type to "string" instead — deferring the typed input rather than building past the design.
- Claude flagged that my update controller had the NOT_FOUND and VERSION_CONFLICT statuses swapped (404 vs 409). It bit exactly as predicted when the two-tab conflict returned 404 and the clean message didn't fire, so I fixed the mapping to return a recoverable 409.
- Claude's diagnosis of a 500 on create was a missing description being written as undefined. That wasn't it. The backend log showed a ReferenceError, and the real cause was my own rename: the controller was calling createParameterHandler instead of the createParameter service, so the handler called itself. Checked the other three call sites afterwards.
- Tested explicitly that a stale PUT against a deleted parameter returns 404, not 409, since the transaction checks existence before comparing versions. Used a deliberately wrong expectedVersion so the two paths couldn't be confused.
- Claude pointed out that the current block in a 409 response is read inside the transaction, so it can't prove the rejected write didn't land. Re-read the document in Firestore afterwards and confirmed version, value and updatedAt were all untouched.
- Decided not to version-check DELETE after asking for the tradeoff. The interleaving that matters — deleting while another manager edits — is already safe, because the update transaction checks existence first and returns a 404. Recorded it in the README as a deliberate omission rather than leaving it unexplained.
- Settled that PUT stays value-only, with type immutable by design: country overrides and AI suggestions are both validated against a parameter's type, so letting it change would strand data that no longer matches. Logged description being uneditable as a genuine gap rather than dressing it up as a decision.

## 19/07/2026

- Had Claude check the deployed Cloud Run env vars against backend/env.yaml before I redeployed. The live service had the deployed frontend origin set on it, but env.yaml still said localhost, so the next deploy would have silently reset CORS and broken sign-in on the live panel in a way that presents as an auth error, not a CORS one. Fixed the file rather than the service, since env.yaml is what deploys actually read.
- Claude's plan for /config said to strip the panel-only fields from each document. I built the response as a key/value whitelist instead. Same output today, but when countryOverrides lands tomorrow it can't leak by my forgetting to add it to a strip list.
- Decided /config should await the first Firestore snapshot before the server starts listening, so there's no window where it serves an empty object to a mobile client. The point was to make it a decision rather than an accident.
- After redeploying I was about to tick off the "listener works without a restart" check, but Claude pointed out the deploy had created a fresh revision, so the value I was looking at only proved the startup snapshot worked. Re-tested by editing a parameter after the deploy. That change can only have arrived through the listener.
- Claude flagged that requireFirebaseAuth checked startsWith('Bearer') without the trailing space while still slicing 7 characters, so a malformed header would pass the check and get mis-sliced. Fixed it, and used the corrected pattern in the new requireApiToken.
- Asked what the static API token actually is, since it's just a random string. It's compared, not verified — no identity, no expiry — unlike the Firebase ID token the panel sends, which is why only panel writes can carry an updatedBy. Noted that the plain string comparison leaks a small timing signal; not worth defending against here, but it belongs in the README's limitations rather than going unmentioned.

## 20/07/2026

- Tested the create path with an invalid value and got a generic 500 instead of a 400. The validation was correctly throwing a coded error from the one shared helper that create, update and override all call, but the controllers weren't mapping it, so I added the INVALID_VALUE branch to both the create and update handlers and re-ran the invalid case to confirm the 400.
- Claude recommended leaving the parameter list sorted alphabetically by key. I checked it against the panel screenshot, which sorts by Create Date with a direction toggle, and built that instead. Sorted client-side so the arrow flips without a refetch.
- Kept the type selector on the create row even though it isn't in the provided screenshots. The design predates the type requirement, and inferring the type from the value is ambiguous ("14" could be a string or a number), so an explicit selector styled to match was the honest tradeoff rather than guessing.
- Chased a bug where every boolean saved as false even with the box ticked. The checkbox was firing my handler on the input event, which runs before v-model syncs the value on change, so it always read the previous state; moving the handler to change fixed it, and /config then returned a bare true.
