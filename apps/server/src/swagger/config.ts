import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "VTT Server API",
      version: "1.0.0",
      description: "Authoritative simulation server for the Virtual Tabletop platform",
      contact: {
        name: "VTT Team",
        email: "dev@vtt.platform",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://api.vtt.platform"
            : "http://localhost:8080",
        description: process.env.NODE_ENV === "production" ? "Production" : "Development",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            requestId: {
              type: "string",
              description: "Request correlation ID",
            },
          },
          required: ["error"],
        },
        HealthStatus: {
          type: "object",
          properties: {
            ok: {
              type: "boolean",
              description: "Overall health status",
            },
            uptimeSec: {
              type: "number",
              description: "Server uptime in seconds",
            },
            db: {
              type: "string",
              enum: ["up", "down"],
              description: "Database connection status",
            },
          },
          required: ["ok"],
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique user identifier",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
          },
          required: ["id", "email"],
        },
        CreateUserRequest: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            password: {
              type: "string",
              minLength: 8,
              description: "User password (minimum 8 characters)",
            },
          },
          required: ["email", "password"],
        },
        AIProvider: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Provider identifier",
            },
            name: {
              type: "string",
              description: "Provider display name",
            },
            capabilities: {
              type: "array",
              items: {
                type: "string",
                enum: ["text-to-image", "depth-estimation", "segmentation"],
              },
              description: "Supported AI capabilities",
            },
          },
          required: ["id", "name", "capabilities"],
        },
      },
    },
    tags: [
      {
        name: "Health",
        description: "Health check and monitoring endpoints",
      },
      {
        name: "Users",
        description: "User management operations",
      },
      {
        name: "AI",
        description: "AI-powered content generation",
      },
      {
        name: "Characters",
        description: "Character creation and management",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/swagger/paths/*.yaml"],
};

export const swaggerSpec = swaggerJsdoc(options);
