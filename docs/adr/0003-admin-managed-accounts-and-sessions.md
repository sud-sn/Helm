# ADR 0003 — Admin-managed accounts and server-side sessions

**Status:** Accepted · 2026-09-25

## Context

Accounts are created by an administrator (decisions log #3); there is no self sign-up. Deactivating
someone must take effect immediately, including for client users.

## Decision

- Administrators create users with a username, display name, optional email, user type and — for
  client users — their company. The server generates a temporary password (or the admin sets
  one); the user must change it at first login.
- Passwords are hashed with scrypt. Five failed attempts lock the account for 15 minutes; login is
  rate-limited per IP.
- Sessions are random tokens in an `HttpOnly` cookie, stored hashed in `sessions`, with a sliding
  12-hour expiry. Password changes, resets and deactivation revoke sessions.

## Consequences

- No token handling in JavaScript; revocation is a row delete.
- SSO (OIDC) can be added later as another way to create a session; the session model stays.
