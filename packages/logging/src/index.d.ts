/**
 * @vtt/logging - Structured logging with Pino and OpenTelemetry
 */
import pino from "pino";
import { NodeSDK } from "@opentelemetry/sdk-node";
export interface LoggerConfig {
    level?: string;
    pretty?: boolean;
    service?: string;
    version?: string;
    environment?: string;
    otlpEndpoint?: string;
}
export declare function createLogger(config?: LoggerConfig): import("pino").Logger<never>;
export declare function initTelemetry(config?: LoggerConfig): NodeSDK;
export declare function withTrace<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, any>): Promise<T>;
export declare class StructuredLogger {
    private logger;
    constructor(config?: LoggerConfig);
    withContext(context: Record<string, any>): pino.Logger<never>;
    logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void;
    logError(error: Error, context?: Record<string, any>): void;
    logAudit(action: string, userId: string, metadata?: Record<string, any>): void;
    logSecurity(event: string, severity: "low" | "medium" | "high" | "critical", details?: Record<string, any>): void;
    logRequest(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>): void;
    logMetric(name: string, value: number, unit: string, tags?: Record<string, any>): void;
    trace(msg: string, obj?: Record<string, any>): void;
    debug(msg: string, obj?: Record<string, any>): void;
    info(msg: string, obj?: Record<string, any>): void;
    warn(msg: string, obj?: Record<string, any>): void;
    error(msg: string, obj?: Record<string, any>): void;
    fatal(msg: string, obj?: Record<string, any>): void;
}
export declare function requestLoggingMiddleware(logger: StructuredLogger): (req: any, res: any, next: any) => void;
export declare const logger: StructuredLogger;
export { pino };
export type { Logger } from "pino";
//# sourceMappingURL=index.d.ts.map