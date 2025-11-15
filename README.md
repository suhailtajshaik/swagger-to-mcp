# Swagger to MCP Server

Convert any Swagger/OpenAPI specification into a dynamic Model Context Protocol (MCP) server.

**Use as CLI tool or Node.js module!**

## Features

- 🚀 Automatically generates MCP tools from Swagger/OpenAPI specs
- 📘 Supports both local files (.yaml, .yml, .json) and remote URLs
- ✅ Built-in JSON schema validation using AJV
- 🔄 Dynamic endpoint mapping with path parameters
- 🪶 Generates MCP manifest (mcp.json) for easy integration
- 📦 Available as npm package - use as CLI or programmatically
- 🐳 Docker support for containerized deployment

## Installation

### As a Global CLI Tool

```bash
npm install -g swagger-to-mcp
# or
pnpm add -g swagger-to-mcp
```

### As a Project Dependency

```bash
npm install swagger-to-mcp
# or
pnpm add swagger-to-mcp
```

### For Development (from source)

```bash
git clone https://github.com/suhailtajshaik/swagger-to-mcp.git
cd swagger-to-mcp
pnpm install
```

## Usage

### Using as a CLI Tool

After installing globally, use the `swagger-to-mcp` command:

```bash
# Start server with local Swagger file
swagger-to-mcp --swagger=./petstore.yaml

# Start server with remote Swagger URL
swagger-to-mcp --swagger=https://petstore.swagger.io/v2/swagger.json

# Specify custom port
swagger-to-mcp --swagger=./api.yaml --port=5000

# Generate manifest only (no server)
swagger-to-mcp --swagger=./api.yaml --manifest-only

# Show help
swagger-to-mcp --help
```

### Using as a Node.js Module

```javascript
import { loadSwagger, createMCPFromSwagger, startServer } from 'swagger-to-mcp';

async function main() {
  // Load Swagger spec
  const swagger = await loadSwagger('./petstore.yaml');

  // Create MCP server
  const server = await createMCPFromSwagger(swagger, {
    manifestOnly: false,
    port: 4000
  });

  // Start the server
  if (server) {
    await startServer(server, 4000);
  }
}

main();
```

### Using from Source (Development)

```bash
# Start with default example
pnpm start

# Or use the server directly
node server.js --swagger=./path/to/your/spec.yaml

# Or use the CLI
node bin/cli.js --swagger=./petstore.yaml
```

See the [examples](./examples) directory for more usage examples.

## Configuration

Create a `.env` file to configure the server:

```env
MCP_PORT=4000
```

## API Reference

### Module Exports

```javascript
import {
  loadSwagger,          // Load Swagger spec from file or URL
  createMCPFromSwagger, // Create MCP server from spec
  startServer,          // Start the MCP server
  getBaseUrl,           // Extract base URL from spec
  extractInputSchema,   // Extract input schema from operation
  extractOutputSchema   // Extract output schema from operation
} from 'swagger-to-mcp';
```

### Functions

#### `loadSwagger(source: string): Promise<Object>`
Load and parse a Swagger/OpenAPI specification.
- `source`: Path to local file or URL
- Returns: Parsed Swagger specification object

#### `createMCPFromSwagger(swagger: Object, options?: Object): Promise<MCPServer|null>`
Create an MCP server from a Swagger specification.
- `swagger`: Parsed Swagger specification
- `options.manifestOnly`: Generate manifest without starting server (default: false)
- `options.port`: Port number for the server (default: 4000)
- Returns: MCP server instance or null if manifestOnly

#### `startServer(server: MCPServer, port: number): Promise<void>`
Start the MCP server.
- `server`: MCP server instance
- `port`: Port number to listen on

## How It Works

1. **Load Swagger/OpenAPI spec** - From local file or URL
2. **Parse endpoints** - Extract all paths and operations
3. **Generate MCP tools** - Each endpoint becomes an MCP tool with:
   - Input schema validation
   - Output schema definition
   - HTTP request handler
4. **Start MCP server** - Listen on configured port and handle tool requests

## Example

The included `petstore.yaml` provides a simple example:

```yaml
openapi: 3.0.1
info:
  title: Swagger Petstore
  version: 1.0.0
servers:
  - url: https://petstore.swagger.io/v2
paths:
  /pet/{petId}:
    get:
      summary: Find pet by ID
      operationId: getPetById
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: successful operation
```

This generates an MCP tool that can fetch pet information by ID.

## License

MIT
