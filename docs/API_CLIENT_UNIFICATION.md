# API Client Unification Roadmap

## Current drift

| Client | Transport | Auth | Response shape |
|--------|-----------|------|----------------|
| Mobile | `@myturn/api-client` | SecureStore token | Wrapped `{ success, data }` on member routes |
| Web | `apiFetch` in `lib/api.ts` | localStorage | Mixed — unwraps where needed |
| Backend | NestJS | JWT | `@ApiWrapped()` on selected controllers |

## Short-term (done / in progress)

- Shared env constants: `@myturn/platform-config` + root `.env.*.example`
- Health endpoint metadata for client connectivity checks
- Invite errors include `apiBaseUrl` + `code: INVITE_NOT_FOUND`

## Phase 1 — Types only

1. Export OpenAPI or hand-maintained types from `packages/shared` for DTOs used by both clients.
2. Web `apiFetch<T>` uses same types as `@myturn/api-client` methods.

## Phase 2 — Thin web wrapper

1. Add `createMyturnApi({ baseUrl, getAccessToken: getStoredToken })` to web portal.
2. Migrate SWR fetchers to `api.groups.list()` etc. incrementally.
3. Keep SWR for cache; replace raw paths with client methods.

## Phase 3 — Single package

1. Move `apiFetch` error handling + envelope unwrap into `@myturn/api-client`.
2. One `onUnauthorized` pattern for web + mobile.
3. Deprecate duplicate path strings in web components.

## Non-goals this sprint

- Full OpenAPI codegen
- Rewriting all web pages to api-client

## Success criteria

- Zero duplicate endpoint path strings between mobile and web for member/admin flows.
- One health-check type shared across clients.
