# Dynamics 365 Finance & Operations Connection and API Plan

Status: Local UI and OData implementation available on `finops-connection`. Automated checks pass, and the user reported passing manual tests on 2026-10-08. Release rollout remains outstanding.

## Implementation progress

The first implementation slice adds the `connectionType` discriminator, idempotent migration of legacy saved connections to Dataverse, normalized F&O roots, supported-authentication/configuration validation, and import/export preservation of product type. Existing encrypted persistence and secret exclusions remain in use. Product changes on existing records are rejected.

Internal and public manifest contracts accept `features.connectionTypes`, with validation in both validator implementations. The shared compatibility resolver defaults undeclared tools to Dataverse and handles the Power Platform API restriction. It now filters single/multiple pickers and validates selections before authentication, desktop launch, reassignment, session restore authentication, inter-tool inheritance, MCP named-connection authentication, and headless execution. Reassignment rejection leaves existing slots intact, and mixed-type declarations preserve slot positions and gaps. F&O impersonation is rejected.

Registry mapping accepts the optional `tools_catalog.connection_types` field as an array or JSON-serialized array. Installation uses the package's declaration when the registry omits that field, so existing registries cannot discard a tool's product requirements. Backend release ingestion and view/schema changes must expose this field before catalog-wide filtering can use it; no remote schema was changed here.

Safe browser/headless connection getters include product type. Dataverse/Power Platform API managers remain guarded against F&O. Interactive and client-secret F&O authentication use the normalized root resource and probe the `/data/` service document. MSAL caches account for edited client/tenant/secret settings; saved tokens are invalidated when authentication settings change.

The regular add/edit UI now exposes F&O, requires explicit app/tenant configuration, hides unsupported authentication and Power Platform controls, and labels saved connections. The desktop and headless `financeOperationsAPI` share a facade for service discovery, raw XML metadata, one-page queries, keyed CRUD, and general OData requests. The transport confines URLs to the selected `/data` endpoint, rejects redirects and protected headers, bounds time/size, and preserves structured HTTP error details. Only GET retries once after a 401. Custom-header approval is separate from Dataverse and can be revoked in Consent Review. A read-only local sample and [manual testing guide](FINANCE_OPERATIONS_MANUAL_TESTING.md) are included.

Verification includes migration idempotence, mixed valid/invalid imports, sanitized exports, F&O configuration and URL validation, manifest-validator parity, credential-free tool metadata, and existing-API product guards. The user reported passing manual tests on 2026-10-08 after the metadata download fix; the precise environment and coverage were not recorded. The phases remain unchecked until their live/release acceptance criteria are satisfied.

Validation: 533 unit tests pass in a clean Jest run, and 23 selected Electron tests pass. Typecheck, lint, desktop/CLI build, validation-package build, public declaration consumer checks, and `git diff --check` pass.

The metadata follow-up raises the response limit to 100 MB and the default timeout to 120 seconds, and preserves cancellation reasons. Its 32 focused unit tests and four F&O Electron tests pass; build and lint also pass.

Current checks include unit coverage for URL boundaries, composite keys, compressed JSON/XML/204 responses, token renewal and write non-replay, consent separation, preload errors, and indexed headless routing. Electron checks cover regular F&O create/edit, picker compatibility, and the real tool-to-main IPC path with fixture HTTP responses.

Next: follow the manual guide against a sandbox, confirm both sign-in flows and entity permissions, exercise disposable writes/actions and paging/company filters, then prepare package/version and registry rollout. Batch helpers remain a later phase. Normalized discriminated-union typing remains a follow-up.

## Goal and scope

Add a Dynamics 365 Finance & Operations (F&O) connection type and a dedicated `FinanceOperationsAPI`, exposed to tools as `window.financeOperationsAPI`. Tools should be able to read and write public F&O data entities through OData using the same connection selection, authentication, encrypted persistence, and connection-slot conventions as existing APIs.

The first release includes interactive authentication and client-secret authentication, OData queries, CRUD, service discovery, raw CSDL metadata, and OData actions through a general request method. Batch/transaction helpers are a subsequent phase. Custom JSON services, the separate REST metadata service, data-management package APIs, on-premises deployments, certificate authentication, and username/password authentication are outside the initial scope.

All names and signatures below are proposed contracts to implement, not currently available APIs.

## Platform facts informing the design

F&O exposes public data entities under `/data/` and CSDL under `/data/$metadata`. Record addressing requires every entity-key field. Responses are paged; company visibility defaults to the user's default company, with `cross-company=true` enabling other authorized companies. OData actions and batch changesets are available. See [Microsoft's F&O OData documentation](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/odata).

F&O supports authorization-code and client-credentials authentication. The OAuth resource is the environment root without a trailing slash. Service applications must be registered in F&O and mapped to a user with appropriate permissions. See [Microsoft's service endpoints and authentication guidance](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/services-home-page). MSAL client credentials use a resource's `/.default` scope; see [Microsoft's client credential guidance](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/web-apps-apis/client-credential-flows).

## Existing architecture and required changes

| Area | Current integration point | Planned change |
| --- | --- | --- |
| Connection model | `src/common/types/connection.ts` | Introduce a product discriminator and product-specific validation. |
| Persistence and import/export | `src/main/managers/connectionsManager.ts` | Normalize legacy records; preserve encrypted secrets and export exclusions. |
| Authentication | `src/main/managers/authManager.ts` | Select scopes and environment-access validation by connection type. |
| Dataverse operations | `src/main/managers/dataverseManager.ts` | Reject F&O connections before authentication or network access. |
| New OData service | Proposed `src/main/managers/financeOperationsManager.ts` | Implement the F&O transport and API operations. |
| IPC lifecycle | `src/common/ipc/channels.ts`, `src/main/index.ts` | Register and remove F&O handlers; route authorized tool slots. |
| Tool bridge | `src/main/toolPreloadBridge.ts` | Expose `financeOperationsAPI` and safe connection-type metadata. |
| App API types | `src/common/types/api.ts`, `src/common/types/index.ts` | Add matching internal contracts and window declarations where required. |
| Public declarations | `packages/types/` | Ship `financeOperationsAPI.d.ts`, reference/export it, and include it in package files. |
| Connection UX | `src/renderer/modules/connectionManagement.ts`, add/edit/select connection modals | Add the type selector, F&O fields, type badges, and compatibility filters. |
| Manifest contracts | `src/common/types/tool.ts`, `packages/types/toolManifest.d.ts`, `packages/validation/src/validate.ts` | Declare supported connection types independently of slot counts. |
| Headless/MCP | `src/main/mcp/headlessToolRuntime.ts`, MCP connection and invocation handling | Expose the same API, enforce types, and return safe metadata. |

`resolveToolConnectionForRequest` in `src/main/utils/connectionTarget.ts` already resolves a tool instance's assigned connection. Extend this path with product validation instead of accepting arbitrary connection IDs from tool callers.

## Connection contract and compatibility

Use `connectionType: "dataverse" | "financeOperations"`. This is separate from `authenticationType`, which describes the sign-in mechanism.

- Normalize missing `connectionType` to `"dataverse"` on load/import and persist it on subsequent writes. Never infer the product from hostname.
- Explicit unknown types fail validation; do not silently treat them as Dataverse.
- Keep IDs, slot assignments, timestamps, categories, colors, and browser settings unchanged by migration.
- Model normalized connections as a discriminated union sharing common fields. F&O permits only `"interactive"` and `"clientSecret"` in the first release. Keep legacy Dataverse authentication behavior and connection-string parsing.
- Update `isConnection`, create/update IPC validation, imports, CLI/MCP validation, and public safe connection types together. The current guard and import validator have different accepted authentication values; avoid adding another divergence.
- Reuse `url` as the environment root. For F&O, accept an HTTPS root or a pasted `/data` or `/data/` URL and normalize it to the root. Reject credentials, query strings, fragments, entity paths, and unrelated paths. Do not impose a production-hostname suffix, because hosted development environments can differ.
- F&O interactive connections require a configured client ID and tenant ID initially. Do not inherit the existing Dataverse fallback client ID without verifying its F&O permissions and redirect configuration.
- F&O connections cannot enable Power Platform API access or Dataverse impersonation. Reject conflicting fields on create/update/import and hide these controls in the F&O form.
- Changing product type should create a new connection. Editing URL, tenant, client, or credentials must invalidate cached MSAL clients, tokens, access checks, and metadata for that connection.

Continue using the existing encryption manager and token fields. Export the discriminator and configuration, never secrets or tokens. Imported client-secret connections remain marked as having incomplete credentials until repaired. Extend every tool-safe serializer with the discriminator while retaining credential exclusions.

## Authentication and connection testing

Extract a small product-aware authentication profile from `AuthManager`: normalized resource, scopes, supported flows, and environment-access probe. Reuse browser selection, callback handling, token renewal, encrypted storage, and existing MSAL infrastructure.

For F&O, propose `${environmentRoot}/.default` for interactive and confidential-client MSAL requests. Confirm delegated consent and the configured desktop loopback redirect in the live authentication spike before finalizing this contract. Document Microsoft Dynamics ERP app permissions and F&O service-user mapping separately for each flow.

Replace the unconditional Dataverse `WhoAmI` probe with product dispatch. Propose an authenticated `GET /data/` service-document request for F&O; verify this with a suitably restricted user. A successful probe establishes service access, not permission to every entity or operation. Do not make connection testing depend on a particular business entity or legal entity.

Audit all authentication paths, including silent renewal and the existing additional `WhoAmI` call, rather than updating only initial browser sign-in. Distinguish invalid credentials, required interaction, missing F&O access, and entity permission failures. Headless unattended use must return an interaction-required error without opening a browser.

## Proposed tool-facing API

Keep familiar CRUD/query names, but use public entity-set names and explicit keys rather than Dataverse logical-name resolution and GUID assumptions. Preserve `"primary"`, `"secondary"`, and zero-based numeric slot targets; omitted targets resolve to primary.

```ts
declare namespace FinanceOperationsAPI {
    type ConnectionTarget = "primary" | "secondary" | number;
    type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

    // Shorthand strings/numbers/booleans; explicit literals cover other EDM types.
    type KeyValue = string | number | boolean | { odataLiteral: string };
    type EntityKey = Record<string, KeyValue>;

    interface RequestOptions {
        connectionTarget?: ConnectionTarget;
        headers?: Record<string, string>;
        timeoutMs?: number;
    }

    interface Page<T> {
        value: T[];
        "@odata.context"?: string;
        "@odata.nextLink"?: string;
        "@odata.count"?: number;
    }

    interface Response<T> {
        status: number;
        headers: Record<string, string>;
        body?: T; // Absent for an empty response, including 204.
    }

    interface API {
        request<T = unknown>(
            method: Method, path: string, body?: unknown, options?: RequestOptions
        ): Promise<Response<T>>;
        queryData<T = Record<string, unknown>>(
            path: string, options?: RequestOptions
        ): Promise<Page<T>>;
        retrieve<T = Record<string, unknown>>(
            entitySet: string, key: EntityKey, select?: string[], options?: RequestOptions
        ): Promise<T>;
        create<T = Record<string, unknown>>(
            entitySet: string, data: Record<string, unknown>, options?: RequestOptions
        ): Promise<Response<T>>;
        update(
            entitySet: string, key: EntityKey, data: Record<string, unknown>, options?: RequestOptions
        ): Promise<Response<unknown>>;
        delete(
            entitySet: string, key: EntityKey, options?: RequestOptions
        ): Promise<Response<unknown>>;
        getServiceDocument(options?: RequestOptions): Promise<unknown>;
        getMetadata(options?: RequestOptions): Promise<string>;
    }
}
```

Use an options object to keep additional request settings extensible. Define a typed service-document response before publishing the declarations; `unknown` above is a placeholder. Generic response types describe caller expectations, not runtime schema validation.

```ts
const page = await window.financeOperationsAPI.queryData(
    "CustomersV3?$select=CustomerAccount,dataAreaId&$top=20" +
    "&$filter=dataAreaId eq 'USMF'&cross-company=true",
    { connectionTarget: 0 }
);

if (page["@odata.nextLink"]) {
    const nextPage = await window.financeOperationsAPI.queryData(
        page["@odata.nextLink"], { connectionTarget: 0 }
    );
}

// Illustrative key: obtain the actual entity keys from the environment's metadata.
const customer = await window.financeOperationsAPI.retrieve(
    "CustomersV3", { dataAreaId: "USMF", CustomerAccount: "C000001" }
);
```

Query strings remain caller-controlled; do not silently add company filters or cross-company access. Writes must supply the legal-entity fields and full keys required by the selected entity. No connection-level company override in the initial release.

`request` supports action paths as published by the environment metadata; it does not prepend a CRM namespace. Return XML text from `getMetadata`; postpone parsed metadata models and generated clients. Do not expose FetchXML, solution deployment, CRM metadata mutation, or Dataverse impersonation on this API.

## Transport, routing, and errors

Implement `FinanceOperationsManager` with a single authenticated request pipeline under the normalized `/data/` service root. Avoid copying the entire Dataverse manager; extract small shared utilities only where both services need identical behavior.

- Validate the connection type before acquiring tokens. Apply equivalent guards to Dataverse and Power Platform API entry points.
- Resolve relative paths under `/data/`. Accept absolute continuation URLs only for the selected environment's exact HTTPS origin and `/data/` path boundary. Reject protocol-relative URLs, userinfo, path traversal, encoded traversal/separators, and alternate ports/origins. Validate the final resolved URL before attaching authorization.
- Do not follow redirects with credentials; reject them initially. Apply the same URL policy to future batch subrequests.
- Preserve continuation query parameters without rebuilding skip tokens. Read one page per call; an eventual read-all helper must have explicit page/record limits and cancellation.
- Encode key property names and values safely. Escape OData string quotes before URI encoding; reject empty keys, null/undefined, non-finite or unsafe numbers, and unsupported objects. Explicit EDM literals require validation and cannot escape the key expression. Document number-precision limits and use literals for large integer/decimal keys.
- Send appropriate JSON and OData headers; handle JSON, XML metadata, compressed responses, and empty bodies deliberately. Keep a bounded timeout and response-size limit with validated caller overrides.
- Reuse the existing custom-header validation/consent policy, adapted for F&O names and origin. Tool headers cannot override authorization, host, framing headers, or inject CR/LF. Do not introduce a second incompatible consent system.
- Normalize HTTP failures into an IPC-safe error contract containing a stable code, status, sanitized service message, correlation/request ID when present, and retry delay when supplied. Preserve useful F&O validation details without exposing credentials or full business payloads in logs.
- On 401, attempt one silent token refresh where appropriate. Automatic retries are limited and bounded for reads; surface throttling delays. Never automatically replay writes or actions after uncertain delivery.
- Use the same validation, errors, and header policy in browser and headless runtimes. MCP calls must not bypass consent requirements; reuse the existing unattended policy.

## Tool compatibility and UI

Propose an additive manifest property:

```json
{
    "features": {
        "connections": { "min": 1, "max": 2 },
        "connectionTypes": ["financeOperations"]
    }
}
```

`connectionTypes` is a non-empty, unique allow-list of known types. Omission means `["dataverse"]`, preserving old tools' selection behavior. The existing `connections` contract continues to control slot counts. A tool declaring both products may assign either product to each slot; the API used for that slot must match its type. Per-slot product requirements can be a later extension.

Update the shared manifest types, TypeScript validator, shipped JavaScript validator, registry/installed metadata propagation, and public package together. Treat `enabledForPowerPlatformAPI` as Dataverse-only; reject an incompatible F&O-only manifest and filter mixed declarations to eligible Dataverse connections when that feature is enabled.

Enforce compatibility in single/multiple pickers, launch, change connection, restored assignments, tool-to-tool invocation, and MCP/headless launch. Picker filtering alone is insufficient. Display an actionable incompatibility error rather than silently rerouting a request to another slot.

Add the connection type to safe connection getters, context, and connection-change events using the existing payload patterns. Show Dataverse/F&O badges and a type filter in connection management. In F&O forms, show environment URL, tenant ID, client ID, supported authentication, and registration guidance; preserve browser-profile settings for interactive sign-in. Hide Dataverse connection-string input, impersonation controls, and Power Platform API opt-in.

F&O tools must declare the first desktop API version that ships this feature through `features.minAPI`. Update API availability/version handling and author docs so older hosts fail compatibility checks before launching a tool that requires F&O.

## Delivery phases

Each phase should be independently reviewable. Keep F&O creation unavailable in ordinary UI until authentication, API routing, and compatibility enforcement are ready.

### [ ] Phase 1 — Authentication spike and contract confirmation

- Verify configured-client interactive sign-in, loopback redirect, service-document probe, client-secret sign-in, and silent renewal against a sandbox.
- Confirm resource/scope behavior and permissions with a restricted F&O user.
- Capture sanitized fixtures for service discovery, CSDL, composite keys, paged responses, actions, and authorization failures.
- Finalize API names, key literal representation, manifest allow-list, and supported deployment scope.

Exit: both authentication flows and a paged OData read work in a sandbox; registration instructions are reproducible. A live environment is required to close this phase; mocks alone cannot establish compatibility.

### [ ] Phase 2 — Connection model, storage, and compatibility

- Add normalized connection types, migration, product/auth validation, imports/exports, and safe metadata.
- Add manifest allow-list resolution and validation while retaining existing slot semantics.
- Enforce product compatibility across launch, restore, invocation, and connection reassignment.

Exit: existing saved connections and old tools behave as before; incompatible assignments fail before network access.

### [ ] Phase 3 — Product-aware authentication and F&O OData manager

- Refactor scopes/access probes, cache invalidation, refresh, and unattended behavior.
- Implement service document, metadata, query, CRUD, and general requests with URL/key/header safeguards and normalized errors.
- Add product guards to existing APIs.

Exit: fixture-based transport coverage passes and sandbox verification covers both flows, CRUD, paging, company filters, and an available action.

### [ ] Phase 4 — Tool exposure, headless support, and connection UX

- Register IPC handlers and lifecycle cleanup; expose the browser and headless APIs.
- Publish matching internal/public types, package references, version compatibility, and API documentation.
- Enable F&O forms, badges, picker filtering, safe connection events, and a small sample tool.

Exit: an F&O tool completes the same read in a desktop window and an unattended client-secret invocation; old Dataverse tools remain usable.

### [ ] Phase 5 — Batch and transaction helpers

- Add `executeBatch` and `executeTransaction` with explicit per-item status/headers/body.
- Reuse multipart encoding/parsing from `src/main/utilities/dataverseBatch.ts` only after separating CRM-specific assumptions and validating F&O fixtures.
- Test mixed successful/failed responses, changeset rollback, request limits, and URL/header validation on every subrequest.

Exit: verified F&O batch behavior and atomic writes in a disposable sandbox. Batch helpers are not required to release phases 1–4.

## Verification and acceptance criteria

Automated coverage should exercise behavior at boundaries rather than duplicate implementation:

- Legacy normalization is idempotent; import/export retains type and strips secrets; unsupported type/auth combinations fail in UI and main-process validation.
- Old manifests resolve to Dataverse; new allow-lists survive registry/install flows; mixed slots and cleared slots preserve index routing.
- Both authentication flows use the environment root resource, run the correct access probe, renew tokens correctly, and invalidate caches after edits.
- CRUD uses complete encoded keys, including apostrophes and special characters; no GUID/logical-name assumptions leak from Dataverse.
- Metadata returns XML, 204 is handled, pagination preserves next links, and foreign-origin/escaped-path URLs are rejected before credentials are attached.
- Header consent, type guards, IPC sender-to-slot routing, throttling, timeout, error serialization, and headless interaction-required behavior are covered.
- E2E coverage includes create/edit/import, picker filtering, launch/reassignment, F&O-disabled Dataverse features, and existing Dataverse regression flows.

Run focused Jest/Playwright suites, declaration consumer checks, validation-package build, typecheck, lint, build, and `git diff --check` as appropriate to each implementation phase. Use a sandbox for create/update/delete and rollback verification; clean up created records. Record which live checks were performed and which await an environment.

## Decisions to revisit after the spike

1. Whether a maintained default F&O desktop app registration can replace user-supplied client IDs. Initial implementation requires explicit registration.
2. Whether metadata should be parsed for key-type validation and discovery helpers. Initial implementation returns raw CSDL and validates caller-supplied keys structurally.
3. Whether mixed-product tools need per-slot restrictions. Initial implementation uses a tool-wide allow-list and API-level type checks.
4. Whether certificate authentication, on-premises endpoints, company defaults, and custom services justify separate follow-up contracts.

Track completed phases here and add a tool-author guide with registration steps, examples, paging, composite keys, company behavior, and error handling before release.
