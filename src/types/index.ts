import { z } from 'zod';

// Environment configuration schema
export const envSchema = z.object({
  PORT: z.string().transform(Number).default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Neo4j Configuration
  NEO4J_URI: z.string(),
  NEO4J_USERNAME: z.string(),
  NEO4J_PASSWORD: z.string(),
  NEO4J_DATABASE: z.string().default('neo4j'),
  
  // Descope Configuration
  DESCOPE_PROJECT_ID: z.string().optional(),
  DESCOPE_MANAGEMENT_KEY: z.string().optional(),
  
  // API Key Configuration
  API_KEYS: z.string().optional(),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().default('*'),
  
  // JWT Secret
  JWT_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Authentication types
export interface AuthSession extends Record<string, unknown> {
  id: string;
  type: 'oauth' | 'apikey';
  userId?: string;
  email?: string;
  name?: string;
  provider?: string;
  scopes?: string[];
  createdAt: Date;
  expiresAt?: Date;
}

// Neo4j Entity types (from original Python implementation)
export const EntitySchema = z.object({
  name: z.string(),
  type: z.string(),
  observations: z.array(z.string()),
});

export const RelationSchema = z.object({
  source: z.string(),
  target: z.string(),
  relationType: z.string(),
});

export const KnowledgeGraphSchema = z.object({
  entities: z.array(EntitySchema),
  relations: z.array(RelationSchema),
});

export const ObservationAdditionSchema = z.object({
  entityName: z.string(),
  contents: z.array(z.string()),
});

export const ObservationDeletionSchema = z.object({
  entityName: z.string(),
  observations: z.array(z.string()),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;
export type ObservationAddition = z.infer<typeof ObservationAdditionSchema>;
export type ObservationDeletion = z.infer<typeof ObservationDeletionSchema>;

// Tool input schemas
export const CreateEntitiesInputSchema = z.object({
  entities: z.array(EntitySchema),
});

export const CreateRelationsInputSchema = z.object({
  relations: z.array(RelationSchema),
});

export const AddObservationsInputSchema = z.object({
  observations: z.array(ObservationAdditionSchema),
});

export const DeleteEntitiesInputSchema = z.object({
  entityNames: z.array(z.string()),
});

export const DeleteObservationsInputSchema = z.object({
  deletions: z.array(ObservationDeletionSchema),
});

export const DeleteRelationsInputSchema = z.object({
  relations: z.array(RelationSchema),
});

export const SearchNodesInputSchema = z.object({
  query: z.string(),
});

export const FindNodesInputSchema = z.object({
  names: z.array(z.string()),
});

export const ReadGraphInputSchema = z.object({});

// HTTP Request extensions for authentication
export interface AuthenticatedRequest {
  session?: AuthSession;
}