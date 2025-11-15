import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import axios from 'axios';
import Ajv from 'ajv';
import { MCPServer } from '@modelcontextprotocol/sdk';

/**
 * Load Swagger/OpenAPI specification from a file or URL
 * @param {string} source - Path to local file or URL
 * @returns {Promise<Object>} Parsed Swagger/OpenAPI specification
 */
export async function loadSwagger(source) {
  try {
    if (source.startsWith('http')) {
      const res = await axios.get(source, { timeout: 10000 });
      return res.data;
    }
    const file = fs.readFileSync(path.resolve(source), 'utf8');
    return source.endsWith('.yaml') || source.endsWith('.yml')
      ? yaml.load(file)
      : JSON.parse(file);
  } catch (error) {
    throw new Error(`Failed to load Swagger spec from ${source}: ${error.message}`);
  }
}

/**
 * Extract base URL from Swagger specification
 * @param {Object} spec - Swagger/OpenAPI specification
 * @returns {string} Base URL
 */
export function getBaseUrl(spec) {
  if (spec.servers && spec.servers.length) return spec.servers[0].url;
  if (spec.host) {
    const scheme = spec.schemes ? spec.schemes[0] : 'https';
    const basePath = spec.basePath || '';
    return `${scheme}://${spec.host}${basePath}`;
  }
  return '';
}

/**
 * Extract input schema from operation
 * @param {Object} operation - OpenAPI operation object
 * @returns {Object} JSON schema for input validation
 */
export function extractInputSchema(operation) {
  const schema = operation.requestBody?.content?.['application/json']?.schema || {};
  const params = operation.parameters?.reduce((acc, p) => {
    acc[p.name] = { type: p.schema?.type || 'string', in: p.in };
    return acc;
  }, {}) || {};
  if (Object.keys(params).length)
    schema.properties = { ...(schema.properties || {}), ...params };
  return schema;
}

/**
 * Extract output schema from operation
 * @param {Object} operation - OpenAPI operation object
 * @returns {Object} JSON schema for output
 */
export function extractOutputSchema(operation) {
  return operation.responses?.['200']?.content?.['application/json']?.schema || {};
}

/**
 * Create MCP server from Swagger specification
 * @param {Object} swagger - Swagger/OpenAPI specification
 * @param {Object} options - Configuration options
 * @param {boolean} options.manifestOnly - Generate manifest without starting server
 * @param {number} options.port - Port number for the server
 * @returns {Promise<MCPServer|null>} MCP server instance or null if manifestOnly
 */
export async function createMCPFromSwagger(swagger, options = {}) {
  const { manifestOnly = false, port = process.env.MCP_PORT || 4000 } = options;

  const server = new MCPServer({
    name: swagger.info?.title || 'Dynamic Swagger MCP Server',
    version: swagger.info?.version || '1.0.0'
  });

  const baseUrl = getBaseUrl(swagger);
  const ajv = new Ajv();
  const paths = swagger.paths || {};
  const manifest = {
    name: swagger.info?.title || 'swagger-to-mcp',
    version: swagger.info?.version || '1.0.0',
    description: swagger.info?.description || 'MCP server generated from Swagger/OpenAPI',
    tools: [],
    server: { url: `http://localhost:${port}` }
  };

  let toolCount = 0;

  for (const [route, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const operationId = operation.operationId || `${method}_${route.replace(/[\/{}]/g, '_')}`;
      const toolName = `${method.toUpperCase()} ${route}`;
      const inputSchema = extractInputSchema(operation);
      const outputSchema = extractOutputSchema(operation);
      const validate = ajv.compile(inputSchema);

      server.registerTool(toolName, {
        description: operation.summary || operationId,
        inputSchema,
        outputSchema,
        handler: async (input) => {
          const valid = validate(input);
          if (!valid) return { error: ajv.errorsText(validate.errors) };

          let url = `${baseUrl}${route}`;
          if (operation.parameters) {
            for (const p of operation.parameters) {
              if (p.in === 'path') url = url.replace(`{${p.name}}`, input[p.name]);
            }
          }

          const config = {
            method,
            url,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          };

          if (['post', 'put', 'patch'].includes(method.toLowerCase())) config.data = input;
          else config.params = input;

          try {
            const response = await axios(config);
            return response.data;
          } catch (err) {
            return { error: err.message, status: err.response?.status };
          }
        }
      });

      manifest.tools.push({
        name: toolName,
        description: operation.summary || operationId,
        method: method.toUpperCase(),
        path: route
      });

      toolCount++;
      console.log(`✅ Registered: ${toolName}`);
    }
  }

  fs.writeFileSync(path.resolve('mcp.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n🪶 Generated mcp.json with ${toolCount} tools`);

  if (manifestOnly) {
    console.log('Manifest-only mode enabled. MCP server not started.');
    return null;
  }

  return server;
}

/**
 * Start MCP server
 * @param {MCPServer} server - MCP server instance
 * @param {number} port - Port number
 * @returns {Promise<void>}
 */
export function startServer(server, port = 4000) {
  return new Promise((resolve, reject) => {
    try {
      server.listen(port, () => {
        console.log(`🚀 MCP server running on port ${port}`);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
