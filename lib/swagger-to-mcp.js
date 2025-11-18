import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import axios from 'axios';
import Ajv from 'ajv';
import { MCPServer } from '@modelcontextprotocol/sdk';
import {
  validateURL,
  validateFilePath,
  validateSwaggerSpec,
  sanitizeToolName,
  validatePort,
  defaultSecurityConfig,
} from './security.js';
import {
  buildInputSchema,
  extractOutputSchema,
  extractErrorSchemas,
  buildToolDescription,
  extractParameters,
  resolveSchemaRefs,
} from './schema.js';

/**
 * Load Swagger/OpenAPI specification from a file or URL with security validation
 * @param {string} source - Path to local file or URL
 * @param {object} securityConfig - Security configuration options
 * @returns {Promise<Object>} Parsed Swagger/OpenAPI specification
 * @throws {Error} If loading or validation fails
 */
export async function loadSwagger(source, securityConfig = defaultSecurityConfig) {
  try {
    let spec;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Validate URL for SSRF protection
      const validatedURL = validateURL(source, securityConfig);

      console.log(`📥 Fetching Swagger spec from: ${validatedURL.href}`);

      const res = await axios.get(validatedURL.href, {
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxBodyLength: 10 * 1024 * 1024,
      });

      spec = res.data;
    } else {
      // Validate file path for path traversal protection
      const validatedPath = validateFilePath(source, securityConfig);

      console.log(`📂 Loading Swagger spec from: ${validatedPath}`);

      const file = fs.readFileSync(validatedPath, 'utf8');

      // Use safe YAML loading to prevent code execution
      if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        spec = yaml.safeLoad(file); // SECURITY: Use safeLoad instead of load
      } else {
        spec = JSON.parse(file);
      }
    }

    // Validate the Swagger specification structure
    validateSwaggerSpec(spec);

    return spec;
  } catch (error) {
    if (error.message) {
      throw new Error(`Failed to load Swagger spec from ${source}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract base URL from Swagger specification
 * @param {Object} spec - Swagger/OpenAPI specification
 * @returns {string} Base URL
 */
export function getBaseUrl(spec) {
  // OpenAPI 3.x - servers array
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url;
  }

  // Swagger 2.0 - host + basePath
  if (spec.host) {
    const scheme = spec.schemes && spec.schemes.length > 0 ? spec.schemes[0] : 'https';
    const basePath = spec.basePath || '';
    return `${scheme}://${spec.host}${basePath}`;
  }

  return '';
}

/**
 * Build HTTP request configuration from input and operation
 * @param {object} input - User input from AI
 * @param {object} operation - OpenAPI operation
 * @param {string} method - HTTP method
 * @param {string} route - API route with placeholders
 * @param {string} baseUrl - Base URL for the API
 * @returns {object} Axios request configuration
 */
function buildRequestConfig(input, operation, method, route, baseUrl) {
  const { parameters } = extractParameters(operation);

  let url = `${baseUrl}${route}`;

  // Replace path parameters in URL
  for (const [name, schema] of Object.entries(parameters.path)) {
    if (input[name] !== undefined) {
      url = url.replace(`{${name}}`, encodeURIComponent(input[name]));
    }
  }

  // Build request configuration
  const config = {
    method: method.toLowerCase(),
    url,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000, // 30 second timeout
  };

  // Add query parameters
  const queryParams = {};
  for (const [name, schema] of Object.entries(parameters.query)) {
    if (input[name] !== undefined) {
      queryParams[name] = input[name];
    }
  }
  if (Object.keys(queryParams).length > 0) {
    config.params = queryParams;
  }

  // Add header parameters
  for (const [name, schema] of Object.entries(parameters.header)) {
    if (input[name] !== undefined) {
      config.headers[name] = input[name];
    }
  }

  // Add request body for POST/PUT/PATCH
  if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
    // Build body from input, excluding path/query/header params
    const bodyData = { ...input };

    // Remove parameters that are not part of the body
    for (const name of Object.keys(parameters.path)) {
      delete bodyData[name];
    }
    for (const name of Object.keys(parameters.query)) {
      delete bodyData[name];
    }
    for (const name of Object.keys(parameters.header)) {
      delete bodyData[name];
    }

    // Handle special _body field if present
    if (bodyData._body !== undefined) {
      config.data = bodyData._body;
    } else if (Object.keys(bodyData).length > 0) {
      config.data = bodyData;
    }
  }

  return config;
}

/**
 * Create MCP server from Swagger specification
 * @param {Object} swagger - Swagger/OpenAPI specification
 * @param {Object} options - Configuration options
 * @param {boolean} options.manifestOnly - Generate manifest without starting server
 * @param {number} options.port - Port number for the server
 * @param {object} options.securityConfig - Security configuration
 * @returns {Promise<MCPServer|null>} MCP server instance or null if manifestOnly
 * @throws {Error} If server creation fails
 */
export async function createMCPFromSwagger(swagger, options = {}) {
  const {
    manifestOnly = false,
    port = process.env.MCP_PORT || 4000,
    securityConfig = defaultSecurityConfig,
  } = options;

  // Validate port
  const validatedPort = validatePort(port);

  const server = new MCPServer({
    name: swagger.info?.title || 'Dynamic Swagger MCP Server',
    version: swagger.info?.version || '1.0.0',
  });

  const baseUrl = getBaseUrl(swagger);
  if (!baseUrl) {
    throw new Error('Could not determine base URL from Swagger spec');
  }

  console.log(`🌐 API Base URL: ${baseUrl}`);

  const ajv = new Ajv({ allErrors: true, verbose: true });
  const paths = swagger.paths || {};

  const manifest = {
    name: swagger.info?.title || 'swagger-to-mcp',
    version: swagger.info?.version || '1.0.0',
    description: swagger.info?.description || 'MCP server generated from Swagger/OpenAPI',
    tools: [],
    server: { url: `http://localhost:${validatedPort}` },
  };

  let toolCount = 0;
  const registeredTools = new Set(); // Track tool names to prevent duplicates

  for (const [route, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      // Skip non-operation fields (like parameters, $ref, etc.)
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
        continue;
      }

      try {
        // Generate unique tool name
        const operationId = operation.operationId || `${method}_${route.replace(/[\/{}]/g, '_')}`;
        let toolName = `${method.toUpperCase()} ${route}`;

        // Sanitize tool name
        toolName = sanitizeToolName(toolName);

        // Handle duplicates by appending operation ID
        if (registeredTools.has(toolName)) {
          toolName = `${toolName} (${operationId})`;
        }
        registeredTools.add(toolName);

        // Build input schema with proper parameter separation
        const inputSchema = buildInputSchema(operation);

        // Resolve $ref pointers
        const resolvedInputSchema = resolveSchemaRefs(inputSchema, swagger);

        // Extract output schema
        const outputSchema = resolveSchemaRefs(extractOutputSchema(operation), swagger);

        // Extract error schemas for better error handling
        const errorSchemas = extractErrorSchemas(operation);

        // Build enhanced description for AI
        const description = buildToolDescription(operation, method, route);

        // Compile validator
        const validate = ajv.compile(resolvedInputSchema);

        // Register tool with MCP server
        server.registerTool(toolName, {
          description,
          inputSchema: resolvedInputSchema,
          outputSchema,
          handler: async (input) => {
            try {
              // Validate input against schema
              const valid = validate(input);
              if (!valid) {
                const errors = ajv.errorsText(validate.errors);
                throw new Error(`Input validation failed: ${errors}`);
              }

              // Build request configuration
              const config = buildRequestConfig(input, operation, method, route, baseUrl);

              console.log(`🔧 Calling: ${method.toUpperCase()} ${config.url}`);

              // Make HTTP request
              const response = await axios(config);

              return response.data;
            } catch (err) {
              // Handle errors properly - throw instead of returning error object
              if (err.response) {
                // HTTP error response
                const status = err.response.status;
                const errorData = err.response.data;

                throw new Error(
                  `HTTP ${status}: ${errorData?.message || errorData?.error || JSON.stringify(errorData)}`
                );
              } else if (err.request) {
                // Request made but no response
                throw new Error(`No response received: ${err.message}`);
              } else {
                // Error in request setup
                throw new Error(`Request failed: ${err.message}`);
              }
            }
          },
        });

        // Add to manifest
        manifest.tools.push({
          name: toolName,
          description: operation.summary || operationId,
          method: method.toUpperCase(),
          path: route,
          tags: operation.tags || [],
        });

        toolCount++;
        console.log(`✅ Registered: ${toolName}`);
      } catch (error) {
        console.error(`❌ Failed to register ${method.toUpperCase()} ${route}: ${error.message}`);
        // Continue with other operations
      }
    }
  }

  // Write manifest file
  try {
    fs.writeFileSync(path.resolve('mcp.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\n🪶 Generated mcp.json with ${toolCount} tools`);
  } catch (error) {
    console.error(`⚠️  Failed to write mcp.json: ${error.message}`);
  }

  if (manifestOnly) {
    console.log('📋 Manifest-only mode enabled. MCP server not started.');
    return null;
  }

  if (toolCount === 0) {
    throw new Error('No tools were registered. Cannot start MCP server.');
  }

  return server;
}

/**
 * Start MCP server with graceful shutdown handling
 * @param {MCPServer} server - MCP server instance
 * @param {number} port - Port number
 * @returns {Promise<void>}
 * @throws {Error} If server fails to start
 */
export function startServer(server, port = 4000) {
  return new Promise((resolve, reject) => {
    try {
      const validatedPort = validatePort(port);

      const serverInstance = server.listen(validatedPort, () => {
        console.log(`🚀 MCP server running on port ${validatedPort}`);
        console.log(`📊 Server ready to accept tool invocations from AI clients`);
        resolve(serverInstance);
      });

      // Graceful shutdown handlers
      const shutdown = () => {
        console.log('\n🛑 Shutting down MCP server gracefully...');
        try {
          serverInstance.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
          });

          // Force exit after 5 seconds
          setTimeout(() => {
            console.error('⚠️  Force closing server after timeout');
            process.exit(1);
          }, 5000);
        } catch (error) {
          console.error(`❌ Error during shutdown: ${error.message}`);
          process.exit(1);
        }
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (error) {
      reject(new Error(`Failed to start server: ${error.message}`));
    }
  });
}

// Re-export schema functions for advanced usage
export {
  buildInputSchema,
  extractOutputSchema,
  extractErrorSchemas,
  buildToolDescription,
  extractParameters,
  resolveSchemaRefs,
};

// Re-export security functions for configuration
export {
  validateURL,
  validateFilePath,
  validateSwaggerSpec,
  sanitizeToolName,
  validatePort,
  defaultSecurityConfig,
};
