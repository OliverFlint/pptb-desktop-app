const api = window.financeOperationsAPI;
const output = document.getElementById("result");
const status = document.getElementById("status");
const query = document.getElementById("query");
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
document.getElementById("run").addEventListener("click", () => run(() => api.queryData(query.value.trim())));
nextButton.addEventListener("click", () => { const link = nextLink; if (link) { query.value = link; run(() => api.queryData(link)); } });
window.toolboxAPI.connections.getActiveConnection().then((connection) => {
    document.getElementById("connection").textContent = connection ? `${connection.name} — ${connection.url}` : "No connection selected";
});
