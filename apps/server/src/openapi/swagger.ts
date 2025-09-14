/**
 * OpenAPI/Swagger configuration and documentation
 * Comprehensive API documentation for VTT endpoints
 */

import swaggerJSDoc from 'swagger-jsdoc';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { logger } from '@vtt/logging';

// Load the comprehensive OpenAPI specification
const openApiSpecPath = join(__dirname, '../../../docs/api/openapi.yaml');
let openApiSpec: any = null; // TODO: Type the OpenAPI spec properly

try {
  const yamlContent = readFileSync(openApiSpecPath, 'utf8');
  openApiSpec = yaml.load(yamlContent) as any; // TODO: Use proper OpenAPI spec type
} catch (error) {
  logger.warn('Could not load comprehensive OpenAPI spec, falling back to basic config');
  openApiSpec = null;
}

const options: swaggerJSDoc.Options = {
  definition: openApiSpec || {
    openapi: '3.0.0',
    info: {
      title: 'VTT (Virtual Tabletop) API',
      version: '1.2.0',
      description: 'Comprehensive API for Virtual Tabletop platform with real-time collaboration, combat AI, and content management',
      contact: {
        name: 'VTT Development Team',
        email: 'api@vtt.dev'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server'
      },
      {
        url: 'https://api.vtt.example.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for API authentication'
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Session cookie authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'string',
              description: 'Detailed error information'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          },
          required: ['error']
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          },
          required: ['success']
        },
        Monster: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique monster ID'
            },
            name: {
              type: 'string',
              description: 'Monster name',
              example: 'Ancient Red Dragon'
            },
            stableId: {
              type: 'string',
              description: 'Stable identifier for consistent referencing',
              example: 'ancient-red-dragon'
            },
            statblock: {
              type: 'object',
              description: 'Complete D&D 5e statblock',
              properties: {
                armorClass: { type: 'number' },
                hitPoints: { type: 'number' },
                speed: { type: 'object' },
                abilities: {
                  type: 'object',
                  properties: {
                    strength: { type: 'number' },
                    dexterity: { type: 'number' },
                    constitution: { type: 'number' },
                    intelligence: { type: 'number' },
                    wisdom: { type: 'number' },
                    charisma: { type: 'number' }
                  }
                },
                challengeRating: { type: 'string' },
                proficiencyBonus: { type: 'number' },
                actions: { type: 'array', items: { type: 'object' } },
                reactions: { type: 'array', items: { type: 'object' } },
                legendaryActions: { type: 'array', items: { type: 'object' } }
              }
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Monster tags for categorization',
              example: ['dragon', 'chromatic', 'legendary']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['id', 'name', 'statblock']
        },
        Character: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            class: { type: 'string' },
            level: { type: 'number', minimum: 1, maximum: 20 },
            hitPoints: { type: 'number' },
            maxHitPoints: { type: 'number' },
            armorClass: { type: 'number' },
            abilities: {
              type: 'object',
              properties: {
                strength: { type: 'number' },
                dexterity: { type: 'number' },
                constitution: { type: 'number' },
                intelligence: { type: 'number' },
                wisdom: { type: 'number' },
                charisma: { type: 'number' }
              }
            },
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' }
              }
            },
            spells: {
              type: 'array',
              items: { type: 'string' }
            },
            equipment: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        Battlefield: {
          type: 'object',
          properties: {
            terrain: {
              type: 'array',
              items: { type: 'string' },
              description: 'Terrain features affecting combat',
              example: ['difficult_terrain', 'water', 'elevated']
            },
            hazards: {
              type: 'array',
              items: { type: 'object' },
              description: 'Environmental hazards'
            },
            cover: {
              type: 'array',
              items: { type: 'object' },
              description: 'Cover objects and positions'
            },
            lighting: {
              type: 'string',
              enum: ['bright', 'dim', 'dark'],
              description: 'Battlefield lighting conditions'
            },
            weather: {
              type: 'string',
              description: 'Weather conditions',
              example: 'clear'
            }
          }
        },
        TacticalDecision: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Recommended action type',
              example: 'ATTACK'
            },
            target: {
              type: 'string',
              description: 'Target ID or description',
              example: 'nearest-enemy'
            },
            reasoning: {
              type: 'string',
              description: 'AI reasoning for the decision'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'AI confidence in the decision'
            },
            alternatives: {
              type: 'array',
              items: { type: 'object' },
              description: 'Alternative actions considered'
            }
          }
        },
        Encounter: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            campaignId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['created', 'active', 'completed'],
              description: 'Current encounter status'
            },
            actors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string', enum: ['character', 'monster'] },
                  initiative: { type: 'number' },
                  health: {
                    type: 'object',
                    properties: {
                      current: { type: 'number' },
                      max: { type: 'number' },
                      temporary: { type: 'number' }
                    }
                  }
                }
              }
            },
            currentRound: { type: 'number' },
            currentTurn: { type: 'number' }
          }
        },
        AssistantQuery: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Rules question to ask the AI assistant'
            },
            context: {
              type: 'object',
              description: 'Additional context for the query'
            }
          },
          required: ['question']
        },
        AssistantResponse: {
          type: 'object',
          properties: {
            answer: {
              type: 'string',
              description: 'AI assistant response'
            },
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sources referenced in the answer'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score for the answer'
            }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { CookieAuth: [] }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/openapi/paths/*.yml'
  ]
};

export const specs = swaggerJSDoc(options);
export default specs;
