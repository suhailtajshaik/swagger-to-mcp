/**
 * Legacy server entry point for backward compatibility
 * Use bin/cli.js or the npm package directly instead
 */

import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadSwagger, createMCPFromSwagger, startServer } from './lib/swagger-to-mcp.js';

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
  .argv;

(async () => {
  try {
    const swagger = await loadSwagger(argv.swagger);
    console.log(`\n📘 Loaded Swagger: ${swagger.info?.title || 'Unnamed API'}`);

    const mcp = await createMCPFromSwagger(swagger, {
      manifestOnly: argv['manifest-only'],
    });

    if (!mcp) return;

    const port = process.env.MCP_PORT || 4000;
    await startServer(mcp, port);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
})();
