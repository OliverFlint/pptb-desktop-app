import type { ToolFeatures } from "./types/tool";
import { resolveConnectionType, type Connection, type ConnectionType } from "./types/connection";

export function resolveSupportedConnectionTypes(features?: ToolFeatures | null): ConnectionType[] {
    const types = features?.connectionTypes;
    if (types === undefined) return ["dataverse"];
    if (!Array.isArray(types) || types.length === 0 || new Set(types).size !== types.length) {
        throw new Error("Supported connection types must be a non-empty, unique list.");
    }
    return types.map((type) => {
        if (type === undefined) throw new Error("Invalid supported connection type.");
        return resolveConnectionType(type);
    });
}

export function isConnectionCompatible(connection: Pick<Connection, "connectionType" | "authenticationType" | "enabledForPowerPlatformAPI">, features?: ToolFeatures | null): boolean {
    const type = resolveConnectionType(connection.connectionType);
    if (!resolveSupportedConnectionTypes(features).includes(type)) return false;
    if (features?.enabledForPowerPlatformAPI) {
        return type === "dataverse" && connection.authenticationType === "clientSecret" && connection.enabledForPowerPlatformAPI === true;
    }
    return true;
}

export function assertConnectionCompatible(connection: Connection, features?: ToolFeatures | null): void {
    if (!isConnectionCompatible(connection, features)) {
        throw new Error(`Connection '${connection.name}' (${resolveConnectionType(connection.connectionType)}) is not compatible with this tool's connection requirements.`);
    }
}
