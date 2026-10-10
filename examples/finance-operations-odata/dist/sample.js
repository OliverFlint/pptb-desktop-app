const api = window.financeOperationsAPI;
const output = document.getElementById("result");
const status = document.getElementById("status");
const query = document.getElementById("query");
const pageSize = document.getElementById("page-size");
const nextButton = document.getElementById("next");
let nextLink;

async function run(operation) {
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach((button) => button.disabled = true);
    status.textContent = "Loading…";
    nextLink = undefined;
    try {
        const result = await operation();
        output.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        nextLink = result?.["@odata.nextLink"];
        status.textContent = "Request succeeded";
    } catch (error) {
        output.textContent = [error.message, error.status && `HTTP ${error.status}`, error.requestId && `Request ID: ${error.requestId}`, error.retryAfter && `Retry after: ${error.retryAfter}`].filter(Boolean).join("\n");
        status.textContent = "Request failed";
    } finally {
        buttons.forEach((button) => button.disabled = false);
        nextButton.disabled = !nextLink;
    }
}
document.getElementById("discover").addEventListener("click", () => run(() => api.getServiceDocument()));
document.getElementById("metadata").addEventListener("click", () => run(() => api.getMetadata()));
function queryPage(path) {
    const value = pageSize.value.trim();
    if (!value) return api.queryData(path);
    const size = Number(value);
    if (!Number.isInteger(size) || size < 1 || size > 10000) {
        throw new Error("Page size must be an integer between 1 and 10000.");
    }
    return api.queryData(path, { headers: { Prefer: `odata.maxpagesize=${size}` } });
}
document.getElementById("run").addEventListener("click", () => run(() => queryPage(query.value.trim())));
nextButton.addEventListener("click", () => { const link = nextLink; if (link) { query.value = link; run(() => queryPage(link)); } });
window.toolboxAPI.connections.getActiveConnection().then((connection) => {
    document.getElementById("connection").textContent = connection ? `${connection.name} — ${connection.url}` : "No connection selected";
});
