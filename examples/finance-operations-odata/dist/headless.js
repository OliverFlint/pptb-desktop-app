// Uses the same one-page query as the desktop sample, without opening a window.
exports.invokeHeadless = async function (input) {
    if (!globalThis.financeOperationsAPI) {
        throw new Error("This sample requires a PPTB build with Finance & Operations API support.");
    }
    const operation = input.operation ?? "query";
    if (operation === "serviceDocument") {
        return { serviceDocument: await globalThis.financeOperationsAPI.getServiceDocument() };
    }
    if (operation === "metadata") {
        return { metadata: await globalThis.financeOperationsAPI.getMetadata() };
    }
    if (operation !== "query") throw new Error("Unsupported operation. Use query, serviceDocument or metadata.");
    if (typeof input.query !== "string" || !input.query.trim()) {
        throw new Error("Provide a query matching the desktop sample, such as CustomersV3?$top=5.");
    }
    let options;
    if (input.pageSize !== undefined) {
        if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 10000) {
            throw new Error("Page size must be an integer between 1 and 10000.");
        }
        options = { headers: { Prefer: `odata.maxpagesize=${input.pageSize}` } };
    }
    const page = await globalThis.financeOperationsAPI.queryData(input.query.trim(), options);
    return { page };
};
