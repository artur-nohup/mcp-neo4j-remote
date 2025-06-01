#!/usr/bin/env node

import 'dotenv/config';
import { MCPNeo4jServer, ServerConfig } from './server.js';
import { envSchema } from './types/index.js';

async function main() {
  try {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);
    
    console.log('[Main] Starting MCP Neo4j Remote Server...');
    console.log(`[Main] Node.js version: ${process.version}`);
    console.log(`[Main] Environment: ${env.NODE_ENV}`);
    
    // Parse API keys
    const apiKeys = env.API_KEYS ? env.API_KEYS.split(',').map(key => key.trim()) : undefined;
    
    // Parse CORS origins
    const corsOrigins = env.CORS_ORIGINS.split(',').map(origin => origin.trim());
    
    // Create server configuration
    const config: ServerConfig = {
      neo4j: {
        uri: env.NEO4J_URI,
        username: env.NEO4J_USERNAME,
        password: env.NEO4J_PASSWORD,
        database: env.NEO4J_DATABASE,
      },
      auth: {
        descopeProjectId: env.DESCOPE_PROJECT_ID,
        descopeManagementKey: env.DESCOPE_MANAGEMENT_KEY,
        apiKeys,
      },
      server: {
        port: env.PORT,
        corsOrigins,
      },
    };

    // Log configuration (without sensitive data)
    console.log('[Main] Configuration:');
    console.log(`  - Neo4j URI: ${config.neo4j.uri}`);
    console.log(`  - Neo4j Database: ${config.neo4j.database}`);
    console.log(`  - Server Port: ${config.server.port}`);
    console.log(`  - CORS Origins: ${config.server.corsOrigins.join(', ')}`);
    console.log(`  - OAuth Configured: ${!!config.auth.descopeProjectId}`);
    console.log(`  - API Keys Configured: ${!!config.auth.apiKeys && config.auth.apiKeys.length > 0} (${config.auth.apiKeys?.length || 0} keys)`);

    // Create and start server
    const server = new MCPNeo4jServer(config);
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`[Main] Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error('[Main] Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[Main] Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start the server
    await server.start();
    
  } catch (error) {
    console.error('[Main] Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
  });
}

export { main };
export default main;