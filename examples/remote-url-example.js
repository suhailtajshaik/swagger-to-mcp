/**
 * Example: Loading Swagger spec from a remote URL
 */

import { loadSwagger, createMCPFromSwagger, startServer } from 'swagger-to-mcp';

async function main() {
  try {
    // Load Swagger spec from remote URL
    const swaggerUrl = 'https://petstore.swagger.io/v2/swagger.json';

    console.log(`Loading Swagger from: ${swaggerUrl}`);
    const swagger = await loadSwagger(swaggerUrl);
    console.log(`Loaded API: ${swagger.info.title} v${swagger.info.version}`);

    // Create and start MCP server
    const server = await createMCPFromSwagger(swagger, {
      port: 5000
    });

    if (server) {
      await startServer(server, 5000);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
