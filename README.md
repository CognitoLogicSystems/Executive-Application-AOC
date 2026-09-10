# CognitoLogic Executive Application AOC

Single-page intake application for the CognitoLogic BOSS Protocol with Firebase Auth + Firestore persistence.

## What this app does

- Authenticates each visitor with Firebase Auth (custom token or anonymous fallback)
- Accepts one executive application per authenticated user
- Enforces one application per normalized email via deterministic SHA-256 applicant key
- Stores application data in Firestore under user-scoped documents

## Local development

1. Serve the repository root with any static server.
2. Ensure the host page injects:
   - `__firebase_config` (JSON string)
   - `__app_id` (string)
   - `__initial_auth_token` (optional string)
3. Open `/Index.html` in the served app.

## Quality gates

```bash
npm ci
npm run lint
npm test
```

## Firestore security rules

- Rules are defined in `/home/runner/work/Executive-Application-AOC/Executive-Application-AOC/firestore.rules`.
- Only authenticated users can create/read their own `protocol_application` document.
- Application schema and required fields are validated in security rules.
- Applicant index documents (`artifacts/{appId}/applicants/{emailHash}`) are create-only and tied to the authenticated user.

## Privacy and data handling

Submitted records contain:

- Contact email
- Hourly labor cost estimate
- Waste vector description
- Consent status and consent timestamp
- Deterministic email hash for deduplication

Retention policy baseline:

- Keep submissions only as long as required for qualification and follow-up.
- Delete records on applicant request or when no longer operationally necessary.
- Restrict Firestore access to authorized operators and service principals.
