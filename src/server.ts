import { FastMCP } from 'fastmcp';
import { Neo4jMemory } from './neo4j/memory.js';
import { AuthManager } from './auth/manager.js';
import { AuthSession } from './types/index.js';
import {
  CreateEntitiesInputSchema,
  CreateRelationsInputSchema,
  AddObservationsInputSchema,
  DeleteEntitiesInputSchema,
  DeleteObservationsInputSchema,
  DeleteRelationsInputSchema,
  SearchNodesInputSchema,
  FindNodesInputSchema,
  ReadGraphInputSchema,
} from './types/index.js';

export interface ServerConfig {
  neo4j: {
    uri: string;
    username: string;
    password: string;
    database: string;
  };
  auth: {
    descopeProjectId?: string;
    descopeManagementKey?: string;
    apiKeys?: string[];
  };
  server: {
    port: number;
    corsOrigins: string[];
  };
}

export class MCPNeo4jServer {
  private server: FastMCP<AuthSession>;
  private memory: Neo4jMemory;
  private authManager: AuthManager;

  constructor(private config: ServerConfig) {
    // Initialize Neo4j Memory
    this.memory = new Neo4jMemory(
      config.neo4j.uri,
      config.neo4j.username,
      config.neo4j.password,
      config.neo4j.database
    );

    // Initialize Auth Manager
    this.authManager = new AuthManager(
      config.auth.descopeProjectId,
      config.auth.descopeManagementKey,
      config.auth.apiKeys
    );

    // Initialize FastMCP Server
    this.server = new FastMCP<AuthSession>({
      name: 'mcp-neo4j-remote',
      version: '1.0.0',
      instructions: `
        This is a remote Neo4j Memory MCP server that provides persistent graph-based memory capabilities.
        
        Authentication is supported via:
        - OAuth 2.1 with Descope (Bearer tokens)
        - API Keys (x-api-key header or ApiKey authorization)
        
        The server maintains a knowledge graph in Neo4j where information is stored as entities with observations
        and relationships between entities. This allows for complex queries and relationship analysis.
        
        Use the various tools to create, read, update, and delete entities, relations, and observations in the knowledge graph.
      `,
      authenticate: this.authenticate.bind(this),
      health: {
        enabled: true,
        path: '/health',
        message: 'MCP Neo4j Remote Server is healthy',
        status: 200,
      },
      ping: {
        enabled: true,
        intervalMs: 30000, // 30 seconds
        logLevel: 'debug',
      },
    });

    this.setupTools();
    this.setupResources();
  }

  private async authenticate(request: any): Promise<AuthSession> {
    try {
      const session = await this.authManager.authenticate(request);
      console.log('[Server] Authentication successful:', { userId: session.userId, type: session.type });
      return session;
    } catch (error) {
      console.error('[Server] Authentication failed:', error);
      throw new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  private setupTools(): void {
    // Create Entities Tool
    this.server.addTool({
      name: 'create_entities',
      description: 'Create multiple new entities in the knowledge graph',
      parameters: CreateEntitiesInputSchema,
      annotations: {
        title: 'Create Entities',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      execute: async (args, { log, session }) => {
        log.info('Creating entities', { count: args.entities.length, user: session?.userId });
        
        try {
          const result = await this.memory.createEntities(args.entities);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to create entities', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Create Relations Tool
    this.server.addTool({
      name: 'create_relations',
      description: 'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice',
      parameters: CreateRelationsInputSchema,
      annotations: {
        title: 'Create Relations',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
      execute: async (args, { log, session }) => {
        log.info('Creating relations', { count: args.relations.length, user: session?.userId });
        
        try {
          const result = await this.memory.createRelations(args.relations);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to create relations', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Add Observations Tool
    this.server.addTool({
      name: 'add_observations',
      description: 'Add new observations to existing entities in the knowledge graph',
      parameters: AddObservationsInputSchema,
      annotations: {
        title: 'Add Observations',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
      execute: async (args, { log, session }) => {
        log.info('Adding observations', { count: args.observations.length, user: session?.userId });
        
        try {
          const result = await this.memory.addObservations(args.observations);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to add observations', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Delete Entities Tool
    this.server.addTool({
      name: 'delete_entities',
      description: 'Delete multiple entities and their associated relations from the knowledge graph',
      parameters: DeleteEntitiesInputSchema,
      annotations: {
        title: 'Delete Entities',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      execute: async (args, { log, session }) => {
        log.info('Deleting entities', { count: args.entityNames.length, user: session?.userId });
        
        try {
          await this.memory.deleteEntities(args.entityNames);
          return 'Entities deleted successfully';
        } catch (error) {
          log.error('Failed to delete entities', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Delete Observations Tool
    this.server.addTool({
      name: 'delete_observations',
      description: 'Delete specific observations from entities in the knowledge graph',
      parameters: DeleteObservationsInputSchema,
      annotations: {
        title: 'Delete Observations',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      execute: async (args, { log, session }) => {
        log.info('Deleting observations', { count: args.deletions.length, user: session?.userId });
        
        try {
          await this.memory.deleteObservations(args.deletions);
          return 'Observations deleted successfully';
        } catch (error) {
          log.error('Failed to delete observations', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Delete Relations Tool
    this.server.addTool({
      name: 'delete_relations',
      description: 'Delete multiple relations from the knowledge graph',
      parameters: DeleteRelationsInputSchema,
      annotations: {
        title: 'Delete Relations',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      execute: async (args, { log, session }) => {
        log.info('Deleting relations', { count: args.relations.length, user: session?.userId });
        
        try {
          await this.memory.deleteRelations(args.relations);
          return 'Relations deleted successfully';
        } catch (error) {
          log.error('Failed to delete relations', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Read Graph Tool
    this.server.addTool({
      name: 'read_graph',
      description: 'Read the entire knowledge graph',
      parameters: ReadGraphInputSchema,
      annotations: {
        title: 'Read Graph',
        readOnlyHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, session }) => {
        log.info('Reading full graph', { user: session?.userId });
        
        try {
          const result = await this.memory.readGraph();
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to read graph', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Search Nodes Tool
    this.server.addTool({
      name: 'search_nodes',
      description: 'Search for nodes in the knowledge graph based on a query',
      parameters: SearchNodesInputSchema,
      annotations: {
        title: 'Search Nodes',
        readOnlyHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, session }) => {
        log.info('Searching nodes', { query: args.query, user: session?.userId });
        
        try {
          const result = await this.memory.searchNodes(args.query);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to search nodes', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Find Nodes Tool
    this.server.addTool({
      name: 'find_nodes',
      description: 'Find specific nodes in the knowledge graph by their names',
      parameters: FindNodesInputSchema,
      annotations: {
        title: 'Find Nodes',
        readOnlyHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, session }) => {
        log.info('Finding nodes', { names: args.names, user: session?.userId });
        
        try {
          const result = await this.memory.findNodes(args.names);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to find nodes', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });

    // Open Nodes Tool (alias for find_nodes for compatibility)
    this.server.addTool({
      name: 'open_nodes',
      description: 'Open specific nodes in the knowledge graph by their names (alias for find_nodes)',
      parameters: FindNodesInputSchema,
      annotations: {
        title: 'Open Nodes',
        readOnlyHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, session }) => {
        log.info('Opening nodes', { names: args.names, user: session?.userId });
        
        try {
          const result = await this.memory.findNodes(args.names);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          log.error('Failed to open nodes', { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      },
    });
  }

  private setupResources(): void {
    // Server status resource
    this.server.addResource({
      uri: 'mcp-neo4j://status',
      name: 'Server Status',
      mimeType: 'application/json',
      load: async () => {
        const stats = await this.memory.getStats();
        const authStatus = this.authManager.getAuthStatus();
        
        return {
          text: JSON.stringify({
            server: {
              name: 'mcp-neo4j-remote',
              version: '1.0.0',
              status: 'running',
              uptime: process.uptime(),
            },
            neo4j: {
              connected: await this.memory.testConnection(),
              ...stats,
            },
            auth: authStatus,
            timestamp: new Date().toISOString(),
          }, null, 2),
        };
      },
    });

    // Authentication info resource
    this.server.addResource({
      uri: 'mcp-neo4j://auth-info',
      name: 'Authentication Information',
      mimeType: 'application/json',
      load: async () => {
        const authStatus = this.authManager.getAuthStatus();
        
        return {
          text: JSON.stringify({
            ...authStatus,
            oauth: {
              enabled: authStatus.oauthConfigured,
              providers: this.authManager.getOAuthProvider()?.getSupportedProviders() || [],
            },
            apiKey: {
              enabled: authStatus.apiKeyConfigured,
              count: this.authManager.getApiKeyProvider()?.getApiKeyCount() || 0,
            },
          }, null, 2),
        };
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('[Server] Initializing MCP Neo4j Remote Server...');
      
      // Initialize Neo4j connection
      await this.memory.initialize();
      
      console.log('[Server] Server initialized successfully');
    } catch (error) {
      console.error('[Server] Failed to initialize:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    
    await this.server.start({
      transportType: 'httpStream',
      httpStream: {
        port: this.config.server.port,
      },
    });
    
    console.log(`[Server] MCP Neo4j Remote Server started on port ${this.config.server.port}`);
    console.log(`[Server] Health check: http://localhost:${this.config.server.port}/health`);
    console.log(`[Server] MCP endpoint: http://localhost:${this.config.server.port}/stream`);
  }

  async stop(): Promise<void> {
    console.log('[Server] Stopping server...');
    
    await this.server.stop();
    await this.memory.close();
    
    console.log('[Server] Server stopped');
  }

  getAuthManager(): AuthManager {
    return this.authManager;
  }

  getMemory(): Neo4jMemory {
    return this.memory;
  }
}