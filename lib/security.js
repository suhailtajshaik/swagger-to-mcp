import { URL } from 'url';
import path from 'path';
import fs from 'fs';

/**
 * Security configuration with sensible defaults
 */
export const defaultSecurityConfig = {
  // Allowed URL schemes for remote Swagger specs
  allowedSchemes: ['https'],

  // Allowed hosts for remote Swagger specs (empty = all HTTPS allowed)
  // Add specific hosts to whitelist: ['api.example.com', 'swagger.io']
  allowedHosts: [],

  // Block internal/private IP ranges (SSRF protection)
  blockPrivateIPs: true,

  // Allowed file extensions for local Swagger specs
  allowedExtensions: ['.yaml', '.yml', '.json'],

  // Base directory for file access (null = current working directory only)
  baseDirectory: null,

  // Maximum file size for local specs (10MB default)
  maxFileSize: 10 * 1024 * 1024,
};

/**
 * Private IP ranges for SSRF protection
 */
const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8 - Loopback
  /^10\./,                     // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,               // 192.168.0.0/16 - Private
  /^169\.254\./,               // 169.254.0.0/16 - Link-local
  /^::1$/,                     // IPv6 loopback
  /^fe80:/,                    // IPv6 link-local
  /^fc00:/,                    // IPv6 private
  /^fd00:/,                    // IPv6 private
];

/**
 * Check if an IP address is private/internal
 */
function isPrivateIP(hostname) {
  return PRIVATE_IP_RANGES.some(range => range.test(hostname));
}

/**
 * Validate a URL against security rules
 * @param {string} urlString - URL to validate
 * @param {object} config - Security configuration
 * @throws {Error} If URL is not allowed
 */
export function validateURL(urlString, config = defaultSecurityConfig) {
  let parsedURL;

  try {
    parsedURL = new URL(urlString);
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }

  // Check scheme
  if (!config.allowedSchemes.includes(parsedURL.protocol.slice(0, -1))) {
    throw new Error(
      `URL scheme '${parsedURL.protocol}' not allowed. Allowed schemes: ${config.allowedSchemes.join(', ')}`
    );
  }

  // Check hostname against whitelist (if configured)
  if (config.allowedHosts.length > 0) {
    const isAllowed = config.allowedHosts.some(host => {
      // Support wildcards: *.example.com
      if (host.startsWith('*.')) {
        const domain = host.slice(2);
        return parsedURL.hostname === domain || parsedURL.hostname.endsWith('.' + domain);
      }
      return parsedURL.hostname === host;
    });

    if (!isAllowed) {
      throw new Error(
        `Host '${parsedURL.hostname}' not in allowlist. Allowed hosts: ${config.allowedHosts.join(', ')}`
      );
    }
  }

  // Check for private IPs (SSRF protection)
  if (config.blockPrivateIPs && isPrivateIP(parsedURL.hostname)) {
    throw new Error(
      `Access to private/internal IP addresses is blocked for security: ${parsedURL.hostname}`
    );
  }

  return parsedURL;
}

/**
 * Validate a file path against security rules
 * @param {string} filePath - File path to validate
 * @param {object} config - Security configuration
 * @throws {Error} If file path is not allowed
 * @returns {string} Resolved absolute path
 */
export function validateFilePath(filePath, config = defaultSecurityConfig) {
  // Resolve to absolute path
  const resolvedPath = path.resolve(filePath);

  // Check file extension
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!config.allowedExtensions.includes(ext)) {
    throw new Error(
      `File extension '${ext}' not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}`
    );
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  // Check if it's actually a file (not a directory)
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${resolvedPath}`);
  }

  // Check file size
  if (stats.size > config.maxFileSize) {
    throw new Error(
      `File size ${stats.size} bytes exceeds maximum allowed ${config.maxFileSize} bytes`
    );
  }

  // Check path traversal - ensure resolved path is within allowed directory
  if (config.baseDirectory) {
    const baseDir = path.resolve(config.baseDirectory);
    if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
      throw new Error(
        `File path '${resolvedPath}' is outside allowed base directory '${baseDir}'`
      );
    }
  }

  return resolvedPath;
}

/**
 * Validate OpenAPI/Swagger specification structure
 * @param {object} spec - Parsed OpenAPI spec
 * @throws {Error} If spec is invalid
 */
export function validateSwaggerSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Swagger spec must be an object');
  }

  // Check for OpenAPI version
  const version = spec.openapi || spec.swagger;
  if (!version) {
    throw new Error('Missing OpenAPI/Swagger version field (openapi or swagger)');
  }

  // Validate required fields
  if (!spec.info) {
    throw new Error('Missing required field: info');
  }

  if (!spec.info.title) {
    throw new Error('Missing required field: info.title');
  }

  if (!spec.info.version) {
    throw new Error('Missing required field: info.version');
  }

  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('Missing or invalid required field: paths (must be an object)');
  }

  // Validate paths structure
  const pathCount = Object.keys(spec.paths).length;
  if (pathCount === 0) {
    throw new Error('Swagger spec must contain at least one path');
  }

  // Warn about deprecated fields (Swagger 2.0 vs OpenAPI 3.x)
  if (spec.swagger && !spec.openapi) {
    console.warn('⚠️  Warning: Swagger 2.0 detected. Consider upgrading to OpenAPI 3.x for better support.');
  }

  return true;
}

/**
 * Sanitize tool name for MCP registration
 * @param {string} name - Raw tool name
 * @returns {string} Sanitized tool name
 */
export function sanitizeToolName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Tool name must be a non-empty string');
  }

  // Remove control characters and limit length
  let sanitized = name
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .slice(0, 200); // Limit length

  if (sanitized.length === 0) {
    throw new Error('Tool name becomes empty after sanitization');
  }

  return sanitized;
}

/**
 * Validate port number
 * @param {number} port - Port number
 * @throws {Error} If port is invalid
 */
export function validatePort(port) {
  const portNum = Number(port);

  if (!Number.isInteger(portNum)) {
    throw new Error(`Port must be an integer, got: ${port}`);
  }

  if (portNum < 1 || portNum > 65535) {
    throw new Error(`Port must be between 1 and 65535, got: ${portNum}`);
  }

  // Warn about privileged ports
  if (portNum < 1024) {
    console.warn(`⚠️  Warning: Port ${portNum} is a privileged port (requires elevated permissions)`);
  }

  return portNum;
}
