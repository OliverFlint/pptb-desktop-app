# Testing the F&O connection and OData API

This is available on `finops-connection` in a local build. Automated tests use mocked authentication/HTTP responses. On 2026-10-08, the user reported that their manual tests passed after the metadata download fix. The specific authentication flows and data operations exercised were not recorded.

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
