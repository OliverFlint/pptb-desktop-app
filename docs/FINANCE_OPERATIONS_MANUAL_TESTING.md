# Testing the F&O connection and OData API

This is available on `finops-connection` in a local build. Automated tests use mocked authentication/HTTP responses. On 2026-10-08, the user confirmed live Microsoft Login and reads after the metadata download fix, followed by passing client-secret authentication tests after configuring the F&O app-to-user mapping. The user subsequently confirmed the client-secret headless MCP test passed. Other live acceptance checks remain pending.

## Run and add a connection

1. Run `pnpm build` then `pnpm start` (or `pnpm dev`).
2. Open **Connections → Add**. Choose **Dynamics 365 Finance & Operations**.
3. Enter a name and HTTPS environment root, for example `https://your-environment.operations.dynamics.com`. Pasting `/data` is also accepted and normalized to the environment root.
4. Choose Microsoft Login or Client ID/Secret and enter your own Client ID and Tenant ID. Enter the secret for client-secret authentication. Save with **Add**, then connect to sign in. **Test Connection** probes the OData service document; it does not save the connection or tokens from the test.
5. Edit the saved connection and confirm the product and normalized URL. Product cannot be changed on an existing connection. Changing authentication settings clears saved tokens; connect again after editing.

For Microsoft Login, configure an Entra mobile/desktop app redirect URI of `http://localhost`, with the Dynamics ERP delegated permissions and tenant consent required for your environment. Sign in with an F&O user who can access the desired entities. For client-secret authentication, register the app in **System administration → Setup → Microsoft Entra applications** and map it to a suitably authorized service user. The token resource is the environment root, without `/data` or a trailing slash. See Microsoft's [service authentication documentation](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/services-home-page).

## Read from a tool window

1. Open **Debug → Local Development → Browse** and select `examples/finance-operations-odata` from this repository. Click **Load Tool**.
2. Launch the sample and select the F&O connection. Only F&O connections should appear; impersonation should be hidden.
3. Click **List entity sets**. Expect a JSON service document with public collection names.
4. Click **Read metadata**. Expect XML CSDL.
5. Enter an available collection name with `?$top=5` and click **Run query**. For example, `CustomersV3?$top=5`. Not every environment exposes the same entities.
6. Use **Next page** when the response supplies `@odata.nextLink`. Add `cross-company=true` and/or a `$filter` on `dataAreaId` explicitly when needed. The API does not inject a company filter or fetch every page automatically.

The sample does not write data. For a negative check, query an unavailable entity and verify an HTTP error. A foreign-origin absolute next link must be rejected. Dataverse tools should continue to offer only Dataverse connections.

## Compare desktop and unattended reads

1. Save a separate F&O **Client ID/Secret** connection, complete the F&O app-to-user mapping, and use **Test Connection** to confirm service access.
2. Reload the local sample after updating this branch so PPTB reads its new `pptb.config.json` and headless entry.
3. Run a query in the sample window with that connection. Keep the query and the returned record keys for comparison.
4. Enable PPTB's MCP server and connect your MCP client using the connection details shown in the app. Discover the **F&O OData Sample** tool, then invoke it with these arguments (replace the connection name and query):

```json
{
  "query": "CustomersV3?$top=5",
  "__pptb": {
    "executionMode": "headless",
    "mode": "two-way",
    "connectionName": "F&O Client Secret",
    "timeoutMs": 120000
  }
}
```

5. Inspect the job in PPTB's **MCP Server** page or poll the returned `jobStatusPath`. Expect a successful result containing `page.value` and the same records as the desktop read. The sample returns one page and preserves `@odata.nextLink`; it does not fetch every page.
6. Confirm no sign-in browser opens. Repeating the read after token expiry exercises client-secret renewal. Record the outcome and any structured error fields, excluding credentials and tokens.

See [MCP invocation and job handling](MCP_IMPLEMENTATION.md) for the client and result envelope. These steps close the live desktop/headless criterion of phase 4; unit checks of the sample cannot establish live authentication.

## Remaining live acceptance checks

| Check | Recorded result on 2026-10-08 |
| --- | --- |
| Microsoft Login and OData reads | Passed, user confirmed |
| Client-secret authentication / Test Connection | Passed, user confirmed |
| Interactive silent renewal and client-secret renewal | Deferred at user request; live verification outstanding |
| Cross-company filtering | Passed, user confirmed |
| Follow a real server-provided next link | Unverified: insufficient data volume in the test environment |
| Restricted-user service probe and entity permission error | Unverified: no restricted user available in the test environment |
| Create a disposable CustomersV3 record | Passed after omitting the account number for environment numbering |
| Retrieve using dataAreaId and CustomerAccount | Passed with explicit cross-company=true; default-scoped read returned 404 |
| Update and delete the disposable record, then verify deletion | Passed, user confirmed PATCH/name verification/DELETE/final GET 404 |
| Invoke an available action using `request` | Passed: collection-bound GetInstalledModules returned HTTP 200 and Collection(Edm.String) |
| Same read in desktop and unattended client-secret execution | Passed, user confirmed headless MCP test |

For write/action checks, use a sandbox entity and action selected by the environment owner. Record sanitized request paths, response status and keys, and confirm cleanup of the disposable record. Do not use production records as test fixtures.

CustomersV3 create testing returned HTTP 400 with the generic outer message "An error has occurred."; CRUD acceptance remains pending. The transport now includes bounded, deduplicated nested validation messages from OData inner errors and details, redacts the access token, and excludes server stack traces. Its 35 focused transport/manager tests pass. After restarting the rebuilt app, check whether the attempted account exists before retrying the create, and capture the detailed error if it fails again.

## API for tool authors

Declare `features.connectionTypes: ["financeOperations"]` and a connection count in the tool's `package.json`. Mixed tools can declare both products and select a zero-based slot with `options.connectionTarget`. Import declarations with `/// <reference types="@pptb/types/financeOperationsAPI" />` from the local updated types package until a release is published.

```typescript
const entities = await window.financeOperationsAPI.getServiceDocument();
const page = await window.financeOperationsAPI.queryData("CustomersV3?$top=5");
const metadata = await window.financeOperationsAPI.getMetadata();
const record = await window.financeOperationsAPI.retrieve("CustomersV3", {
    dataAreaId: "usmf", CustomerAccount: "C-001",
});
// Every key field must match the entity's $metadata declaration.
```

`request`, `create`, `update` (PATCH), and `delete` return `{ status, headers, body? }`, including empty 204 responses. Use `request` for entity actions and PUT. Key helpers accept strings, numbers, booleans, and `{ odataLiteral: "9223372036854775807" }` for exact large numeric or typed literals. See Microsoft's [F&O OData documentation](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/odata) for entity exposure, complete keys, companies, and actions.

Custom headers require separate per-tool F&O consent in the desktop app; **Consent Review → API Headers** can revoke persistent approval. Headless calls require prior approval for custom headers. Authorization and transport headers cannot be overridden. A headless interactive connection must have an existing MSAL account; unattended use should use client-secret authentication. Both runtimes expose `financeOperationsAPI`.

HTTP errors expose `status`, `requestId`, and `retryAfter` where the server provides them. Only GET retries once after a 401 with a forced token refresh. Writes, redirects, and throttled requests are never automatically replayed. Entity requests time out after 30 seconds by default; metadata defaults to 120 seconds. Explicit timeouts can be 1–120 seconds. Request bodies and entity responses are limited to 20 MB; metadata responses allow 100 MB, including decompressed content. Local size-limit and timeout errors are preserved when cancellation aborts the response. Batch helpers are a later phase.

Before release, verify both real authentication flows, renewal, a paged collection, company filters, and sandbox create/update/delete/action behavior using a disposable record and its full metadata key. Record the environment and results without credentials or tokens.

CustomersV3 live follow-up: the supplied PPTB account failed the company's US_SI_#### number-sequence validation. The subsequent create succeeded with environment-assigned numbering. A keyed GET using the returned account and dataAreaId succeeded with explicit `cross-company=true`; the default-scoped retrieve returned 404. Use the same explicit keyed request path for the remaining update/delete checks.

CustomersV3 CRUD acceptance is complete: create, keyed cross-company read, PATCH with name verification, DELETE, and final GET returning 404 all passed, as confirmed by the user on 2026-10-08. The disposable customer was cleaned up.

Action acceptance passed on 2026-10-08: the collection-bound `Microsoft.Dynamics.DataEntities.GetInstalledModules` action, bound to the SystemNotification entity collection resolved from CSDL, was invoked through `request("POST", path, {})`. It returned HTTP 200 with an OData `Collection(Edm.String)` containing installed module information. No environment-specific response headers or full module inventory are stored in this guide.
