# 808 SZN Release Readiness Engine

An internal Single-Organization Release-Readiness Engine. This system provides a rigorous, multi-step quality control and state-machine gating process for audio releases.

**Disclaimer:** This product is an internal release-readiness/QC tool and does not replace legal advice, distributor validation, or rights clearance.

## Local Setup

### 1. Prerequisites
- Node.js v20+
- A Firebase project (for Auth and Firestore)
- A Stripe account (for Enterprise token billing)

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your secrets.

```
cp .env.example .env
```

### 3. Firebase Auth Setup
Enable Email/Password or Identity Platform in Firebase. 
Users must be managed internally (RBAC). 
Roles (`admin`, `operator`, `approver`, `viewer`) can be set via Firebase Custom Claims or in a `users/{uid}` Firestore document.

### 4. Firestore Collections
- `projects`
- `wallets` (Contains `{uid}: { balance }`)
- `wallets/{uid}/ledger` (Immutable transactional ledger)
- `stripe_events` (Idempotency locking)

### 5. Stripe Setup
1. Create a Product/Price for "Readiness Token".
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`.
3. Set up a Webhook pointing to `/api/stripe/webhook` listening for `checkout.session.completed`.
4. Set `STRIPE_WEBHOOK_SECRET` in `.env`.

### Commands

- \`npm install\` - Install dependencies
- \`npm run dev\` - Start local development server
- \`npm run lint\` - Run TypeScript validation
- \`npm test\` - Run integration tests
- \`npm run check\` - Run lint, test, and build sequentially
- \`npm run build\` - Build for production

## Features
- **Server-Side Auth & Roles:** Firebase Admin protects routes and enforces strict RBAC.
- **Secure Ledger:** All token deductions and credits are processed via Firestore transactions with strict idempotency.
- **Canonical Manifests:** Cryptographic SHA-256 digests are generated deterministically server-side.
- **Webhook Safety:** Outbound webhook payloads are validated against SSRF attacks.
