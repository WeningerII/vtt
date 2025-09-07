"use strict";
/**
 * @vtt/logging - Structured logging with Pino and OpenTelemetry
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pino = exports.logger = exports.StructuredLogger = void 0;
exports.createLogger = createLogger;
exports.initTelemetry = initTelemetry;
exports.withTrace = withTrace;
exports.requestLoggingMiddleware = requestLoggingMiddleware;
const pino_1 = __importDefault(require("pino"));
exports.pino = pino_1.default;
const api_1 = require("@opentelemetry/api");
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const node_os_1 = __importDefault(require("node:os"));
// Create Pino logger instance
function createLogger(config = {}) {
    const options = {
        level: config.level || process.env.LOG_LEVEL || "info",
        formatters: {
            level: (label) => ({ level: label }),
            bindings: () => ({
                service: config.service || "vtt",
                version: config.version || "0.0.0",
                environment: config.environment || process.env.NODE_ENV || "development",
                pid: process.pid,
                hostname: node_os_1.default.hostname(),
            }),
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        serializers: {
            err: pino_1.default.stdSerializers.err,
            error: pino_1.default.stdSerializers.err,
            req: pino_1.default.stdSerializers.req,
            res: pino_1.default.stdSerializers.res,
        },
    };
    // Add pretty printing in development
    if (config.pretty || process.env.NODE_ENV === "development") {
        return (0, pino_1.default)({
            ...options,
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "HH:MM:ss Z",
                    ignore: "pid,hostname",
                },
            },
        });
    }
    return (0, pino_1.default)(options);
}
// Initialize OpenTelemetry
function initTelemetry(config = {}) {
    const resource = new resources_1.Resource({
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: config.service || "vtt",
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: config.version || "0.0.0",
        [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || process.env.NODE_ENV || "development",
    });
    const traceExporter = config.otlpEndpoint
        ? new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: `${config.otlpEndpoint}/v1/traces`,
            headers: {},
        })
        : undefined;
    const instrumentations = (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
        "@opentelemetry/instrumentation-fs": {
            enabled: false, // Disable fs instrumentation to reduce noise
        },
    });
    const sdkOptions = {
        resource,
        instrumentations,
    };
    if (traceExporter) {
        sdkOptions.traceExporter = traceExporter;
    }
    const sdk = new sdk_node_1.NodeSDK(sdkOptions);
    sdk.start();
    return sdk;
}
// Trace wrapper for async operations
async function withTrace(name, fn, attributes) {
    const tracer = api_1.trace.getTracer("vtt");
    const span = attributes ? tracer.startSpan(name, { attributes }) : tracer.startSpan(name);
    try {
        const result = await api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), fn);
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        return result;
    }
    catch (error) {
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Unknown error",
        });
        span.recordException(error);
        throw error;
    }
    finally {
        span.end();
    }
}
// Structured logging helpers
class StructuredLogger {
    constructor(config = {}) {
        this.logger = createLogger(config);
    }
    // Log with context
    withContext(context) {
        return this.logger.child(context);
    }
    // Performance logging
    logPerformance(operation, duration, metadata) {
        this.logger.info({
            type: "performance",
            operation,
            duration,
            ...metadata,
        }, `Performance: ${operation} took ${duration}ms`);
    }
    // Error logging with stack trace
    logError(error, context) {
        this.logger.error({
            type: "error",
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
            ...context,
        }, error.message);
    }
    // Audit logging
    logAudit(action, userId, metadata) {
        this.logger.info({
            type: "audit",
            action,
            userId,
            timestamp: new Date().toISOString(),
            ...metadata,
        }, `Audit: ${action} by ${userId}`);
    }
    // Security event logging
    logSecurity(event, severity, details) {
        const level = severity === "critical" ? "error" : severity === "high" ? "warn" : "info";
        this.logger[level]({
            type: "security",
            event,
            severity,
            ...details,
        }, `Security event: ${event}`);
    }
    // Request logging
    logRequest(method, path, statusCode, duration, metadata) {
        this.logger.info({
            type: "request",
            method,
            path,
            statusCode,
            duration,
            ...metadata,
        }, `${method} ${path} ${statusCode} ${duration}ms`);
    }
    // Business metrics logging
    logMetric(name, value, unit, tags) {
        this.logger.info({
            type: "metric",
            name,
            value,
            unit,
            tags,
        }, `Metric: ${name}=${value}${unit}`);
    }
    // Direct access to logger methods
    trace(msg, obj) {
        this.logger.trace(obj, msg);
    }
    debug(msg, obj) {
        this.logger.debug(obj, msg);
    }
    info(msg, obj) {
        this.logger.info(obj, msg);
    }
    warn(msg, obj) {
        this.logger.warn(obj, msg);
    }
    error(msg, obj) {
        this.logger.error(obj, msg);
    }
    fatal(msg, obj) {
        this.logger.fatal(obj, msg);
    }
}
exports.StructuredLogger = StructuredLogger;
// Express middleware for request logging
function requestLoggingMiddleware(logger) {
    return (req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
            const duration = Date.now() - start;
            logger.logRequest(req.method, req.path, res.statusCode, duration, {
                ip: req.ip,
                userAgent: req.get("user-agent"),
                referer: req.get("referer"),
            });
        });
        next();
    };
}
// Default logger instance
exports.logger = new StructuredLogger();
//# sourceMappingURL=index.js.map