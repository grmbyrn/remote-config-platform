# AI Usage Log

## 17/07/2026

- Reviewed the case study brief with Claude to separate explicit requirements from ambiguous sections left open to interpretation (e.g. country audience UI, AI-targeting logic). Asked Claude to flag which parts were its own suggestions rather than stated requirements.
- Discussed four approaches to preventing concurrent-edit conflicts (optimistic locking with a version field, Firestore's native updateTime precondition, pessimistic locking, last-write-wins). Chose the explicit version-field approach since it's easier to explain and defend, and fits cleanly with the country-override feature.
- Weighed monorepo vs. two separate GitLab repos against the "separation of services" requirement. Went with a monorepo with clean folder separation to avoid doubling reviewer-access admin overhead.
- Built the Firestore schema iteratively, then cross-checked it against the actual panel screenshots provided. Caught two missing fields (description, createdAt) that were visible in the screenshots but absent from the draft schema.
- Debugged a sign-in form where the error message wasn't rendering. Root cause was a catch (error) block shadowing an outer error ref of the same name. Verified the fix by retesting both success and failure paths manually.
- Flagged that Claude's initial backend scaffold wired handler logic directly into the route files, with no controller layer. Restructured it into a routes → controllers → services split: routes only map paths to handlers, controllers own the HTTP request/response concerns, and services own data access (Firestore). This keeps business logic out of the route files, makes the data layer unit-testable in isolation and swappable without touching HTTP code, and turns the brief's "separation of services" from aspirational into something actually enforced by the structure.
- Used Claude to sketch rough wireframes for two screens not in the provided screenshots (country override editor, AI suggestion review), then had them re-rendered to match the real panel's color palette and typography.
