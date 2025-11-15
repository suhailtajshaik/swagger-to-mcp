#!/usr/bin/env node

import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadSwagger, createMCPFromSwagger, startServer } from '../lib/swagger-to-mcp.js';

dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('swagger', {
    type: 'string',
    demandOption: true,
    describe: 'Path or URL to Swagger/OpenAPI file'
  })
  .option('manifest-only', {
    type: 'boolean',
    default: false,
    describe: 'Generate MCP manifest without starting server'
  })
  .option('port', {
    type: 'number',
    default: process.env.MCP_PORT || 4000,
    describe: 'Port number for the MCP server'
  })
  .help()
  .alias('h', 'help')
  .example('$0 --swagger=./petstore.yaml', 'Start server with local file')
  .example('$0 --swagger=https://example.com/api.json --port=3000', 'Start server with remote URL')
  .example('$0 --swagger=./api.yaml --manifest-only', 'Generate manifest only')
  .argv;

(async () => {
  try {
    const swagger = await loadSwagger(argv.swagger);
    console.log(`\n📘 Loaded Swagger: ${swagger.info?.title || 'Unnamed API'}`);

    const mcp = await createMCPFromSwagger(swagger, {
      manifestOnly: argv['manifest-only'],
      port: argv.port
    });

    if (!mcp) return;

    await startServer(mcp, argv.port);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
})();
