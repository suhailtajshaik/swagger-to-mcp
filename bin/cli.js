#!/usr/bin/env node

import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadSwagger, createMCPFromSwagger, startServer, defaultSecurityConfig } from '../lib/swagger-to-mcp.js';

dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('swagger', {
    type: 'string',
    demandOption: true,
    describe: 'Path or URL to Swagger/OpenAPI file',
  })
  .option('manifest-only', {
    type: 'boolean',
    default: false,
    describe: 'Generate MCP manifest without starting server',
  })
  .option('port', {
    type: 'number',
    default: process.env.MCP_PORT || 4000,
    describe: 'Port number for the MCP server',
  })
  .option('allow-http', {
    type: 'boolean',
    default: false,
    describe: 'Allow HTTP URLs (insecure, use with caution)',
  })
  .option('allowed-hosts', {
    type: 'string',
    describe: 'Comma-separated list of allowed hostnames for remote Swagger specs (e.g., "api.example.com,swagger.io")',
  })
  .option('base-directory', {
    type: 'string',
    describe: 'Base directory for local file access (restricts file access to this directory)',
  })
  .option('allow-private-ips', {
    type: 'boolean',
    default: false,
    describe: 'Allow access to private IP addresses (enables SSRF, use with caution)',
  })
  .help()
  .alias('h', 'help')
  .example('$0 --swagger=./petstore.yaml', 'Start server with local file')
  .example('$0 --swagger=https://example.com/api.json --port=3000', 'Start server with remote URL')
  .example('$0 --swagger=./api.yaml --manifest-only', 'Generate manifest only')
  .example('$0 --swagger=https://api.example.com/swagger.json --allowed-hosts=api.example.com', 'Use URL with host whitelist')
  .example('$0 --swagger=./specs/api.yaml --base-directory=./specs', 'Restrict file access to specs directory')
  .argv;

(async () => {
  try {
    // Build security configuration from CLI options
    const securityConfig = { ...defaultSecurityConfig };

    // Configure allowed schemes
    if (argv['allow-http']) {
      securityConfig.allowedSchemes = ['http', 'https'];
      console.warn('⚠️  Warning: HTTP URLs are allowed. This is insecure for production use.');
    }

    // Configure allowed hosts
    if (argv['allowed-hosts']) {
      securityConfig.allowedHosts = argv['allowed-hosts'].split(',').map(h => h.trim());
      console.log(`🔒 Host whitelist: ${securityConfig.allowedHosts.join(', ')}`);
    }

    // Configure base directory
    if (argv['base-directory']) {
      securityConfig.baseDirectory = argv['base-directory'];
      console.log(`📁 File access restricted to: ${securityConfig.baseDirectory}`);
    }

    // Configure private IP blocking
    if (argv['allow-private-ips']) {
      securityConfig.blockPrivateIPs = false;
      console.warn('⚠️  Warning: Private IP access is enabled. This may enable SSRF attacks.');
    }

    // Load Swagger spec with security validation
    console.log(`\n📥 Loading Swagger specification...`);
    const swagger = await loadSwagger(argv.swagger, securityConfig);

    console.log(`\n📘 Loaded API: ${swagger.info?.title || 'Unnamed API'} v${swagger.info?.version || '1.0.0'}`);
    if (swagger.info?.description) {
      console.log(`   ${swagger.info.description}`);
    }

    // Create MCP server
    console.log(`\n🔧 Creating MCP server from Swagger specification...`);
    const mcp = await createMCPFromSwagger(swagger, {
      manifestOnly: argv['manifest-only'],
      port: argv.port,
      securityConfig,
    });

    if (!mcp) {
      console.log('\n✅ Done! Check mcp.json for the generated manifest.');
      return;
    }

    // Start the server
    console.log(`\n🌟 Starting MCP server...`);
    await startServer(mcp, argv.port);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);

    // Print stack trace in debug mode
    if (process.env.DEBUG) {
      console.error('\n📚 Stack trace:');
      console.error(error.stack);
    } else {
      console.error('\n💡 Tip: Set DEBUG=1 for detailed error information');
    }

    process.exit(1);
  }
})();
