/**
 * Swagger to MCP - Convert Swagger/OpenAPI specs to MCP servers
 * @module swagger-to-mcp
 */

export {
  loadSwagger,
  getBaseUrl,
  extractInputSchema,
  extractOutputSchema,
  createMCPFromSwagger,
  startServer
} from './lib/swagger-to-mcp.js';

// Default export for convenience
import {
  loadSwagger,
  createMCPFromSwagger,
  startServer
} from './lib/swagger-to-mcp.js';

export default {
  loadSwagger,
  createMCPFromSwagger,
  startServer
};
