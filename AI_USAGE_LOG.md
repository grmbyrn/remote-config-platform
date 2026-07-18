# AI Usage Log

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
