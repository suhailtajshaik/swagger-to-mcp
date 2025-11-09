# Swagger to MCP Server

Convert any Swagger/OpenAPI specification into a dynamic Model Context Protocol (MCP) server.

## Features

- 🚀 Automatically generates MCP tools from Swagger/OpenAPI specs
- 📘 Supports both local files (.yaml, .yml, .json) and remote URLs
- ✅ Built-in JSON schema validation using AJV
- 🔄 Dynamic endpoint mapping with path parameters
- 🪶 Generates MCP manifest (mcp.json) for easy integration

## Installation

```bash
pnpm install
```

## Usage

### Start the MCP server

```bash
pnpm start
```

Or with a custom Swagger file:

```bash
node server.js --swagger=./path/to/your/spec.yaml
```

### Generate manifest only (without starting server)

```bash
node server.js --swagger=./petstore.yaml --manifest-only
```

### Use a remote Swagger URL

```bash
node server.js --swagger=https://petstore.swagger.io/v2/swagger.json
```

## Configuration

Create a `.env` file to configure the server:

```env
MCP_PORT=4000
```

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
