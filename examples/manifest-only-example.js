/**
 * Example: Generate MCP manifest without starting the server
 */

import { loadSwagger, createMCPFromSwagger } from 'swagger-to-mcp';

async function main() {
  try {
    // Load Swagger spec
    const swagger = await loadSwagger('./petstore.yaml');
    console.log(`Loaded API: ${swagger.info.title}`);

    // Generate manifest only (no server started)
    await createMCPFromSwagger(swagger, {
      manifestOnly: true,
      port: 4000
    });

    console.log('Manifest generated successfully! Check mcp.json file.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
