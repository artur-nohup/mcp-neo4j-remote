# MCP Neo4j Remote Server

A remote Model Context Protocol (MCP) server that provides persistent memory capabilities through Neo4j graph database integration with OAuth 2.1 and API Key authentication.

## Features

- **Remote Access**: HTTP-based MCP server that can be accessed over the network
- **Dual Authentication**: 
  - OAuth 2.1 via Descope (for users/applications that support OAuth)
  - API Key authentication (for clients that only support API keys)
- **Neo4j Integration**: Persistent graph-based memory storage
- **Docker Support**: Containerized deployment with Docker Compose
- **Health Monitoring**: Built-in health checks and monitoring endpoints
- **TypeScript**: Full TypeScript implementation with type safety

## Architecture

The server converts the original Python Neo4j MCP implementation to TypeScript using the FastMCP framework, enabling remote access with robust authentication.

### Authentication Methods

1. **OAuth 2.1 (via Descope)**:
   - Use `Authorization: Bearer <token>` header
   - Supports multiple OAuth providers (Google, GitHub, Microsoft, etc.)
   - Full user session management

2. **API Key**:
   - Use `Authorization: ApiKey <key>` header
   - Or `x-api-key: <key>` header
   - Or `?api_key=<key>` query parameter

## Quick Start

### 1. Installation

```bash
cd /workspace/mcp-neo4j-remote
npm install
```

### 2. Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Neo4j Configuration
NEO4J_URI=bolt://macmini.arturs-server.com:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=nohuprsz

# API Keys (comma-separated)
API_KEYS=your-api-key-1,your-api-key-2

# Optional: Descope OAuth
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_MANAGEMENT_KEY=your_management_key
```

### 3. Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 4. Docker Deployment

```bash
# Build and start with Docker Compose
docker-compose up --build

# Or build manually
docker build -t mcp-neo4j-remote .
docker run -p 8080:8080 --env-file .env mcp-neo4j-remote
```

## Usage

### Health Check

```bash
curl http://localhost:8080/health
```

### MCP Connection

The server exposes an MCP endpoint at:
- HTTP Stream: `http://localhost:8080/stream`

### Authentication Examples

**Using API Key:**
```bash
curl -H "x-api-key: demo-key-12345" \
     -H "Content-Type: application/json" \
     http://localhost:8080/stream
```

**Using OAuth Bearer Token:**
```bash
curl -H "Authorization: Bearer <your-oauth-token>" \
     -H "Content-Type: application/json" \
     http://localhost:8080/stream
```

## Available Tools

The server provides the same tools as the original Python implementation:

### Query Tools
- `read_graph` - Read the entire knowledge graph
- `search_nodes` - Search for nodes based on a query
- `find_nodes` / `open_nodes` - Find specific nodes by name

### Entity Management
- `create_entities` - Create multiple new entities
- `delete_entities` - Delete entities and their relations

### Relation Management
- `create_relations` - Create relations between entities
- `delete_relations` - Delete specific relations

### Observation Management
- `add_observations` - Add observations to existing entities
- `delete_observations` - Delete specific observations

## API Resources

### Server Status
- URI: `mcp-neo4j://status`
- Provides server health, Neo4j stats, and authentication status

### Authentication Info
- URI: `mcp-neo4j://auth-info`
- Provides available authentication methods and configuration

## Testing Connection

Test the connection to your Neo4j server:

```bash
# Using the configured .env file
npm run dev

# Or test with curl (after server is running)
curl -H "x-api-key: demo-key-12345" \
     http://localhost:8080/health
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 8080 |
| `NODE_ENV` | Environment mode | No | development |
| `NEO4J_URI` | Neo4j connection URI | Yes | - |
| `NEO4J_USERNAME` | Neo4j username | Yes | - |
| `NEO4J_PASSWORD` | Neo4j password | Yes | - |
| `NEO4J_DATABASE` | Neo4j database name | No | neo4j |
| `DESCOPE_PROJECT_ID` | Descope project ID | No | - |
| `DESCOPE_MANAGEMENT_KEY` | Descope management key | No | - |
| `API_KEYS` | Comma-separated API keys | No | - |
| `CORS_ORIGINS` | Allowed CORS origins | No | * |

## Development

### Project Structure

```
src/
├── auth/           # Authentication providers
│   ├── base.ts     # Abstract auth provider
│   ├── oauth.ts    # Descope OAuth provider
│   ├── apikey.ts   # API key provider
│   └── manager.ts  # Auth manager
├── neo4j/          # Neo4j integration
│   └── memory.ts   # Memory implementation
├── types/          # TypeScript type definitions
│   └── index.ts    # Shared types
├── server.ts       # FastMCP server setup
└── index.ts        # Main entry point
```

### Scripts

- `npm run dev` - Development with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with real credentials
2. **API Keys**: Use strong, unique API keys and rotate them regularly
3. **CORS**: Configure `CORS_ORIGINS` appropriately for production
4. **HTTPS**: Use HTTPS in production environments
5. **Network**: Restrict network access to the server as needed

## Troubleshooting

### Connection Issues

1. **Neo4j Connection**: Verify Neo4j is accessible and credentials are correct
2. **Port Conflicts**: Ensure port 8080 is available or change in configuration
3. **Authentication**: Check API keys or OAuth configuration

### Common Errors

- **"Failed to connect to Neo4j"**: Check Neo4j URI, username, and password
- **"Authentication failed"**: Verify API keys or OAuth tokens
- **"Port already in use"**: Change the PORT environment variable

## License

MIT License - see LICENSE file for details.