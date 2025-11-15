/**
 * Example: Using swagger-to-mcp programmatically as a Node.js module
 */

import { loadSwagger, createMCPFromSwagger, startServer } from 'swagger-to-mcp';

async function main() {
  try {
    // Load Swagger spec from local file
    const swagger = await loadSwagger('./petstore.yaml');
    console.log(`Loaded API: ${swagger.info.title}`);

    // Create MCP server
    const server = await createMCPFromSwagger(swagger, {
      manifestOnly: false,
      port: 4000
    });

    // Start the server
    if (server) {
      await startServer(server, 4000);
      console.log('Server is running!');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
