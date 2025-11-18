/**
 * Schema extraction and processing for OpenAPI operations
 */

/**
 * Extract and separate parameters by location (path, query, header, body)
 * @param {object} operation - OpenAPI operation object
 * @returns {object} Separated parameters with schemas
 */
export function extractParameters(operation) {
  const parameters = {
    path: {},
    query: {},
    header: {},
    cookie: {},
    body: null,
  };

  const required = {
    path: [],
    query: [],
    header: [],
    cookie: [],
  };

  // Extract parameters from the parameters array
  if (operation.parameters && Array.isArray(operation.parameters)) {
    for (const param of operation.parameters) {
      const location = param.in;
      const name = param.name;

      if (!name) {
        console.warn('⚠️  Parameter without name found, skipping');
        continue;
      }

      const schema = param.schema || { type: 'string' };

      // Build parameter schema
      const paramSchema = {
        type: schema.type || 'string',
        ...schema,
      };

      // Add description if available
      if (param.description) {
        paramSchema.description = param.description;
      }

      // Add example if available
      if (param.example !== undefined) {
        paramSchema.example = param.example;
      }

      // Store parameter by location
      if (location === 'path' || location === 'query' || location === 'header' || location === 'cookie') {
        parameters[location][name] = paramSchema;

        // Track required parameters
        if (param.required === true) {
          required[location].push(name);
        }
      }
    }
  }

  // Extract request body
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    if (content && content['application/json']) {
      parameters.body = content['application/json'].schema || {};

      // If body is required
      if (operation.requestBody.required === true) {
        parameters.body.required = true;
      }
    }
  }

  return { parameters, required };
}

/**
 * Build input schema for MCP tool registration
 * Combines all parameters into a single schema for validation
 * @param {object} operation - OpenAPI operation object
 * @returns {object} JSON schema for input validation
 */
export function buildInputSchema(operation) {
  const { parameters, required } = extractParameters(operation);

  const schema = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Add all parameters to properties
  // Flatten all parameter types into a single properties object for simplicity
  for (const location of ['path', 'query', 'header', 'cookie']) {
    for (const [name, paramSchema] of Object.entries(parameters[location])) {
      // Store parameter with location metadata
      schema.properties[name] = {
        ...paramSchema,
        'x-parameter-location': location, // Custom property to track location
      };
    }

    // Add required parameters
    schema.required.push(...required[location]);
  }

  // Handle request body
  if (parameters.body) {
    if (parameters.body.properties) {
      // Merge body properties into main schema
      Object.assign(schema.properties, parameters.body.properties);

      // Add required fields from body
      if (parameters.body.required && Array.isArray(parameters.body.required)) {
        schema.required.push(...parameters.body.required);
      }
    } else if (parameters.body.type) {
      // Body is a primitive or complex type
      schema.properties._body = parameters.body;
      if (parameters.body.required === true) {
        schema.required.push('_body');
      }
    }
  }

  // Remove duplicates from required array
  schema.required = [...new Set(schema.required)];

  // Add additionalProperties: false for strict validation
  schema.additionalProperties = false;

  return schema;
}

/**
 * Extract output schema from operation responses
 * @param {object} operation - OpenAPI operation object
 * @returns {object} JSON schema for output
 */
export function extractOutputSchema(operation) {
  if (!operation.responses) {
    return {};
  }

  // Check common success status codes in order of preference
  const successCodes = ['200', '201', '204', '206'];

  for (const code of successCodes) {
    const response = operation.responses[code];
    if (response && response.content && response.content['application/json']) {
      const schema = response.content['application/json'].schema || {};

      // Add response code metadata
      return {
        ...schema,
        'x-response-code': code,
      };
    }
  }

  // If no success response found, check for default
  if (operation.responses.default && operation.responses.default.content) {
    const defaultContent = operation.responses.default.content['application/json'];
    if (defaultContent && defaultContent.schema) {
      return defaultContent.schema;
    }
  }

  return {};
}

/**
 * Extract error schemas from operation responses
 * @param {object} operation - OpenAPI operation object
 * @returns {object} Map of status codes to error schemas
 */
export function extractErrorSchemas(operation) {
  const errors = {};

  if (!operation.responses) {
    return errors;
  }

  // Get 4xx and 5xx error responses
  for (const [code, response] of Object.entries(operation.responses)) {
    if (code.startsWith('4') || code.startsWith('5')) {
      if (response.content && response.content['application/json']) {
        errors[code] = response.content['application/json'].schema || {};
      } else {
        errors[code] = {
          type: 'object',
          description: response.description || 'Error response',
        };
      }
    }
  }

  return errors;
}

/**
 * Build enhanced tool description for AI understanding
 * @param {object} operation - OpenAPI operation object
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @returns {string} Enhanced description
 */
export function buildToolDescription(operation, method, path) {
  const parts = [];

  // Start with summary or operationId
  if (operation.summary) {
    parts.push(operation.summary);
  } else if (operation.operationId) {
    parts.push(operation.operationId);
  } else {
    parts.push(`${method.toUpperCase()} ${path}`);
  }

  // Add detailed description if available and different from summary
  if (operation.description && operation.description !== operation.summary) {
    parts.push(operation.description);
  }

  // Add parameter hints
  const { parameters, required } = extractParameters(operation);

  const requiredParams = [];
  for (const location of ['path', 'query', 'header']) {
    if (required[location].length > 0) {
      requiredParams.push(`${location}: ${required[location].join(', ')}`);
    }
  }

  if (requiredParams.length > 0) {
    parts.push(`Required parameters: ${requiredParams.join('; ')}`);
  }

  // Add tags if available
  if (operation.tags && operation.tags.length > 0) {
    parts.push(`Tags: ${operation.tags.join(', ')}`);
  }

  return parts.join('. ');
}

/**
 * Resolve $ref pointers in schemas
 * @param {object} schema - Schema that may contain $ref
 * @param {object} spec - Full OpenAPI spec for resolving references
 * @returns {object} Schema with resolved references
 */
export function resolveSchemaRefs(schema, spec) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // If schema has $ref, resolve it
  if (schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, '').split('/');
    let resolved = spec;

    for (const segment of refPath) {
      if (resolved && typeof resolved === 'object') {
        resolved = resolved[segment];
      } else {
        console.warn(`⚠️  Could not resolve $ref: ${schema.$ref}`);
        return schema;
      }
    }

    // Recursively resolve the referenced schema
    return resolveSchemaRefs(resolved, spec);
  }

  // Recursively resolve refs in nested schemas
  const result = { ...schema };

  if (result.properties) {
    result.properties = Object.entries(result.properties).reduce((acc, [key, value]) => {
      acc[key] = resolveSchemaRefs(value, spec);
      return acc;
    }, {});
  }

  if (result.items) {
    result.items = resolveSchemaRefs(result.items, spec);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s => resolveSchemaRefs(s, spec));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s => resolveSchemaRefs(s, spec));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s => resolveSchemaRefs(s, spec));
  }

  return result;
}
