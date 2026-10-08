// Uses the same one-page query as the desktop sample, without opening a window.
exports.invokeHeadless = async function (input) {
    if (typeof input.query !== "string" || !input.query.trim()) {
        throw new Error("Provide a query matching the desktop sample, such as CustomersV3?$top=5.");
    }
    if (!globalThis.financeOperationsAPI) {
        throw new Error("This sample requires a PPTB build with Finance & Operations API support.");
    }
    const page = await globalThis.financeOperationsAPI.queryData(input.query.trim());
    return { page };
};
