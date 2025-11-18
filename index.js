/**
 * Swagger to MCP - Convert Swagger/OpenAPI specs to MCP servers
 * @module swagger-to-mcp
 */

// Core functions
export {
  loadSwagger,
  createMCPFromSwagger,
  startServer,
  getBaseUrl,
} from './lib/swagger-to-mcp.js';

// Schema functions
export {
  buildInputSchema,
  extractOutputSchema,
  extractErrorSchemas,
  buildToolDescription,
  extractParameters,
  resolveSchemaRefs,
} from './lib/swagger-to-mcp.js';

// Security functions
export {
  validateURL,
  validateFilePath,
  validateSwaggerSpec,
  sanitizeToolName,
  validatePort,
  defaultSecurityConfig,
} from './lib/swagger-to-mcp.js';

// Default export for convenience
import {
  loadSwagger,
  createMCPFromSwagger,
  startServer,
  defaultSecurityConfig,
} from './lib/swagger-to-mcp.js';

export default {
  loadSwagger,
  createMCPFromSwagger,
  startServer,
  defaultSecurityConfig,
};
