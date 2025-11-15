# Examples

This directory contains example usage of the `swagger-to-mcp` module.

## Running Examples

Make sure you have the package installed:

```bash
npm install swagger-to-mcp
# or
pnpm install swagger-to-mcp
```

Then run any example:

```bash
node examples/programmatic-usage.js
node examples/remote-url-example.js
node examples/manifest-only-example.js
```

## Examples

### 1. Programmatic Usage (`programmatic-usage.js`)
Shows how to use swagger-to-mcp as a Node.js module in your own application.

### 2. Remote URL Example (`remote-url-example.js`)
Demonstrates loading a Swagger spec from a remote URL.

### 3. Manifest Only Example (`manifest-only-example.js`)
Shows how to generate the MCP manifest without starting the server.

## Module API

```javascript
import {
  loadSwagger,
  createMCPFromSwagger,
  startServer,
  getBaseUrl,
  extractInputSchema,
  extractOutputSchema
} from 'swagger-to-mcp';
```

### Functions

- `loadSwagger(source)` - Load Swagger spec from file or URL
- `createMCPFromSwagger(swagger, options)` - Create MCP server from spec
- `startServer(server, port)` - Start the MCP server
- `getBaseUrl(spec)` - Extract base URL from spec
- `extractInputSchema(operation)` - Extract input schema from operation
- `extractOutputSchema(operation)` - Extract output schema from operation
