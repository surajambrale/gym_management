# Biometric attendance architecture — Phase 1 audit

## Status and scope

This report records the repository audit and the proposed boundaries for Phases 1
and 2. It does not claim that HU20 capture, enrollment, or 1:N identification has
been verified.

The local machine has `C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe`, driver
DLLs, and a downloaded `SGI_BWAPI_Win_64bit.exe` installer. The inspected SecuGen
installation directories did not contain WebAPI documentation or a WebAPI client
bundle. No listener owned by a SecuGen process or registered SecuGen Windows
service could be confirmed during this audit. Consequently, the WebAPI methods,
transport, ports, request/response formats, capture requirements, template
format, matching support, and service-session requirements remain **unverified**.
The installer was not run and no undocumented endpoint was probed. Obtain the
vendor documentation and confirm the installed client/runtime before implementing
the capture adapter.

The user's report that the driver and service are installed and that basic capture
works is useful environment context, but it does not establish that this runtime
is reachable from this development environment or that 1:N identification works.

## Existing application audit

| Area | Existing implementation |
|---|---|
| Members | `Member` stores a `tenantId` and `businessId`, and enforces a tenant-scoped unique phone number. Member CRUD queries are generally tenant-scoped. The member record also stores the QR token hash. |
| Attendance | `Attendance` stores tenant/member references and allows `Manual`, `QR`, and `Biometric` as an attendance type. Current check-in rejects a second record on the same UTC day; check-out searches only the current UTC day. It does not implement open-session toggle, overnight checkout, scan idempotency, cooldown, or membership-date validation. |
| Authentication | `protectOwner` verifies the JWT, loads an active owner, checks token tenant/role against the database record, and sets `req.tenantId` from that record. There is no agent/device authentication. |
| Membership and payments | `MemberMembership` and `Payment` link records to both a member and tenant. These, along with attendance and QR credentials, must be included in any later deletion design; payment retention must be assessed separately. |
| Database | Mongoose connects to MongoDB Atlas using `MONGODB_URI`. The deployment must use a replica set or another transaction-capable topology before relying on MongoDB transactions for multi-collection deletion. |
| Angular | The standalone Members and Attendance pages call the backend with the owner JWT. The browser must not receive fingerprint templates. No local-agent communication exists yet. |

Audited modules include the member, attendance, membership, payment, owner, and
business models; their controllers and routes; authentication middleware and
controller; database/environment configuration; and the Angular member and
attendance services/pages.

## Proposed enrollment and storage flow

1. An authenticated owner selects a member and obtains explicit, recorded consent
   before enrollment begins.
2. Angular requests a short-lived, member- and tenant-scoped enrollment challenge
   from the backend, then passes only that challenge to a loopback agent bridge.
   The browser receives capture state and enrollment status, never a template or
   fingerprint image.
3. The Windows agent uses only the verified vendor interface to capture and
   validate the template. The agent sends the template directly to the backend
   over TLS using the one-use challenge; incomplete or invalid captures are not
   persisted.
4. The backend verifies the challenge and tenant/member relationship, encrypts the
   vendor-format template with AES-256-GCM, and stores the ciphertext, nonce,
   authentication tag, and key version. The encryption key ring is supplied
   outside MongoDB through deployment secrets. Tenant/member/finger/format
   context is authenticated as additional data to prevent ciphertext substitution.
5. Normal model serialization omits all encrypted payload fields. Only a narrowly
   scoped backend service should explicitly select/decrypt a template.

The Phase 2 schema supports multiple finger identifiers per member. The
identifier is application metadata; the SecuGen SDK has not been verified to
provide a finger identifier. A unique tenant/member/finger-identifier index
prevents duplicate slots, but cannot prove two separate captures are the same
physical finger. Cross-member duplicate detection requires a verified matcher and
must happen before enrollment is committed.

## Phase 2 implementation in this repository

- `backend/models/BiometricEnrollment.js` stores tenant/member IDs, the
  application finger identifier, vendor-format label, enrollment status and
  enrollment time, consent timestamp/recording owner/notice version, plus
  Mongoose creation/update timestamps. It supports multiple enrolled finger
  identifiers per member and has a partial unique index on
  tenant/member/finger for enrolled records.
- Enrolled records require non-empty ciphertext, a 12-byte AES-GCM IV, a
  16-byte authentication tag, a key version, a format, an enrollment time, and
  consent metadata. Non-enrolled records cannot retain encrypted payload fields.
- The encrypted payload and key version are excluded from normal Mongoose
  selection and JSON/object serialization. No raw-image field is defined.
- `backend/utils/biometricTemplateCrypto.js` implements AES-256-GCM encryption
  and authenticated decryption. Tenant ID, member ID, finger identifier, and
  template format are authenticated as additional data.
- Configure `BIOMETRIC_ENCRYPTION_KEYS` as a JSON object mapping key-version
  strings to canonical base64-encoded 32-byte keys, and
  `BIOMETRIC_ENCRYPTION_ACTIVE_KEY_VERSION` as the version used for new records.
  Supply both through backend deployment secrets, never MongoDB. Keep old
  versions available for decryption during key rotation; missing or invalid
  configuration fails closed when encryption/decryption is requested. These
  variables are optional at server startup so existing non-biometric features
  continue to run before enrollment is deployed.
- There is intentionally no enrollment endpoint, SDK adapter, matcher, or
  frontend workflow in this phase.

## Proposed 1:N identification and Windows agent

1:N means comparing one live probe against the tenant's enrolled template set.
The SDK may provide a documented 1:N operation, or it may require repeated 1:1
comparisons. Neither option is confirmed here. The exact match API, score/threshold
semantics, template compatibility, and performance must be established with the
vendor documentation and a successful HU20 test before selecting an approach.

The candidate agent is a Windows-native, auto-starting process that owns the
scanner connection, reconnects after device/service failure, performs matching
using only verified APIs, and retries authenticated outbound delivery while
offline. The process should run in the interactive context only if the SDK
requires it; a Windows Service must not be selected until its USB/session
requirements are confirmed. If interactive access is required, use a managed
startup task for a dedicated Windows account and document its login/restart
behavior. Persisted queue records need event IDs and server-side replay protection.

The agent needs a tenant-specific enrollment index. Any template cache must be
encrypted and device-bound, have a defined expiry/invalidation policy, and be
removed or refreshed after enrollment revocation or member deletion. The server's
encryption key must not be delivered to Angular or copied to the agent; a later
agent sync design must use device-bound key wrapping or an equivalent reviewed
mechanism.

## Angular-to-agent communication

Use a narrowly scoped local bridge rather than calling undocumented SecuGen
endpoints directly from Angular. The intended browser flow passes a short-lived,
one-use challenge to a loopback-only agent; the agent communicates with the
backend over TLS and sends status back to Angular. Restrict the bridge to the
production frontend origin, require local pairing/authorization, protect against
CSRF and replay, and validate browser private-network/CORS behavior in supported
browsers. Do not send templates or raw images through Angular, local storage, or
ordinary API responses.

## Backend verification boundary

The backend must independently resolve the submitted member and enrolled
biometric record using the authenticated tenant, and validate active member and
membership state before creating an attendance event. The agent should use
separate device credentials and send a device-authenticated event with an
idempotency identifier, event time context, and enrollment version; the server
should apply cooldown/replay checks and generate attendance timestamps itself.

A member ID or a valid device signature alone does **not** prove that a finger
matched: it proves only that an authorized agent asserted the result. Independent
biometric verification requires a verified backend-compatible matcher or a
reviewed, device-attested design. The deployment must explicitly trust and secure
the agent matching boundary rather than treating an unsigned member ID as proof.

## Attendance and deletion design implications

The current same-day attendance queries must be replaced for biometric toggle
behavior: find the member's open session across dates, close that session even
after midnight, and otherwise create a check-in. Enforce membership validity,
tenant ownership, server timestamps, a unique/idempotent event key, and a
tenant/member cooldown. Existing manual/QR behavior should remain compatible
unless intentionally migrated and tested.

Member deletion is not part of this phase. Its later implementation must account
for member profile/QR data, biometric enrollment and agent caches, memberships,
attendance, and payment records. Use a transaction where the MongoDB topology
supports it; otherwise design a recoverable deletion workflow. Retain or
anonymize financial/tax records according to applicable retention rules, and
record only a minimal audit event without biometric material.

## Phase 1 exit criteria

- [x] Audit the current tenant, member, attendance, authentication, and database
  modules.
- [x] Record an architecture that does not expose templates to Angular or assume
  a successful 1:N demo.
- [ ] Obtain and inspect the installed WebAPI documentation/client and verify
  actual endpoint and session requirements.
- [ ] Successfully test HU20 enrollment and 1:N identification with the installed
  runtime before implementing SDK-specific capture or matching.

The final two criteria are blocked by missing local WebAPI documentation/client
and unavailable device/runtime verification in this audit environment.

## Validation performed

The backend's `node --test` suite covers encryption/decryption, randomized IVs,
tamper and context rejection, incomplete enrollment validation, and omission of
encrypted fields from serialization. These crypto tests use non-biometric bytes;
they do not simulate fingerprint enrollment or identification.

The Angular production build succeeds. The existing Angular unit suite reports
14 passing and 3 failing tests: the app title assertion fails, and the login and
registration component tests lack an `ActivatedRoute` provider; the app test
also reports an unmatched `login` route. These failures are outside the backend
biometric changes.
