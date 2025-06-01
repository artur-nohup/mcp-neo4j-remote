import neo4j, { Driver, QueryResult } from 'neo4j-driver';
import {
  Entity,
  Relation,
  KnowledgeGraph,
  ObservationAddition,
  ObservationDeletion,
} from '../types/index.js';

export class Neo4jMemory {
  private driver: Driver;
  private database: string;

  constructor(
    uri: string,
    username: string,
    password: string,
    database: string = 'neo4j'
  ) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    this.database = database;
  }

  async initialize(): Promise<void> {
    try {
      // Verify connectivity
      await this.driver.verifyConnectivity();
      console.log('[Neo4j] Connected successfully');
      
      // Create fulltext index
      await this.createFulltextIndex();
    } catch (error) {
      console.error('[Neo4j] Connection failed:', error);
      throw error;
    }
  }

  private async createFulltextIndex(): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        CREATE FULLTEXT INDEX search IF NOT EXISTS 
        FOR (m:Memory) ON EACH [m.name, m.type, m.observations]
      `;
      await session.run(query);
      console.log('[Neo4j] Fulltext search index created/verified');
    } catch (error: any) {
      if (error.message && error.message.includes('An index with this name already exists')) {
        console.log('[Neo4j] Fulltext search index already exists');
      } else {
        throw error;
      }
    } finally {
      await session.close();
    }
  }

  async loadGraph(filterQuery: string = '*'): Promise<KnowledgeGraph> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        CALL db.index.fulltext.queryNodes('search', $filter) YIELD node as entity, score
        OPTIONAL MATCH (entity)-[r]-(other)
        RETURN collect(distinct {
          name: entity.name, 
          type: entity.type, 
          observations: entity.observations
        }) as nodes,
        collect(distinct {
          source: startNode(r).name, 
          target: endNode(r).name, 
          relationType: type(r)
        }) as relations
      `;
      
      const result: QueryResult = await session.run(query, { filter: filterQuery });
      
      if (result.records.length === 0) {
        return { entities: [], relations: [] };
      }
      
      const record = result.records[0];
      const nodes = record.get('nodes') || [];
      const rels = record.get('relations') || [];
      
      const entities: Entity[] = nodes
        .filter((node: any) => node.name)
        .map((node: any) => ({
          name: node.name,
          type: node.type,
          observations: node.observations || [],
        }));
      
      const relations: Relation[] = rels
        .filter((rel: any) => rel.source && rel.target && rel.relationType)
        .map((rel: any) => ({
          source: rel.source,
          target: rel.target,
          relationType: rel.relationType,
        }));
      
      console.log(`[Neo4j] Loaded ${entities.length} entities and ${relations.length} relations`);
      
      return { entities, relations };
    } finally {
      await session.close();
    }
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        UNWIND $entities as entity
        MERGE (e:Memory { name: entity.name })
        SET e += entity, e:\`\${entity.type}\`
        RETURN e
      `;
      
      const entitiesData = entities.map(entity => ({
        name: entity.name,
        type: entity.type,
        observations: entity.observations,
      }));
      
      await session.run(query, { entities: entitiesData });
      console.log(`[Neo4j] Created ${entities.length} entities`);
      
      return entities;
    } finally {
      await session.close();
    }
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const session = this.driver.session({ database: this.database });
    try {
      for (const relation of relations) {
        const query = `
          MATCH (from:Memory { name: $source })
          MATCH (to:Memory { name: $target })
          MERGE (from)-[r:\`\${relationType}\`]->(to)
          RETURN r
        `;
        
        await session.run(query, {
          source: relation.source,
          target: relation.target,
          relationType: relation.relationType,
        });
      }
      
      console.log(`[Neo4j] Created ${relations.length} relations`);
      return relations;
    } finally {
      await session.close();
    }
  }

  async addObservations(observations: ObservationAddition[]): Promise<Array<{entityName: string; addedObservations: string[]}>> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        UNWIND $observations as obs  
        MATCH (e:Memory { name: obs.entityName })
        WITH e, [o in obs.contents WHERE NOT o IN coalesce(e.observations, [])] as new
        SET e.observations = coalesce(e.observations, []) + new
        RETURN e.name as name, new
      `;
      
      const observationsData = observations.map(obs => ({
        entityName: obs.entityName,
        contents: obs.contents,
      }));
      
      const result = await session.run(query, { observations: observationsData });
      
      const results = result.records.map(record => ({
        entityName: record.get('name'),
        addedObservations: record.get('new'),
      }));
      
      console.log(`[Neo4j] Added observations to ${results.length} entities`);
      return results;
    } finally {
      await session.close();
    }
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        UNWIND $entities as name
        MATCH (e:Memory { name: name })
        DETACH DELETE e
      `;
      
      await session.run(query, { entities: entityNames });
      console.log(`[Neo4j] Deleted ${entityNames.length} entities`);
    } finally {
      await session.close();
    }
  }

  async deleteObservations(deletions: ObservationDeletion[]): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        UNWIND $deletions as d  
        MATCH (e:Memory { name: d.entityName })
        SET e.observations = [o in coalesce(e.observations, []) WHERE NOT o IN d.observations]
      `;
      
      const deletionsData = deletions.map(deletion => ({
        entityName: deletion.entityName,
        observations: deletion.observations,
      }));
      
      await session.run(query, { deletions: deletionsData });
      console.log(`[Neo4j] Deleted observations from ${deletions.length} entities`);
    } finally {
      await session.close();
    }
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      for (const relation of relations) {
        const query = `
          MATCH (source:Memory { name: $source })-[r:\`\${relationType}\`]->(target:Memory { name: $target })
          DELETE r
        `;
        
        await session.run(query, {
          source: relation.source,
          target: relation.target,
          relationType: relation.relationType,
        });
      }
      
      console.log(`[Neo4j] Deleted ${relations.length} relations`);
    } finally {
      await session.close();
    }
  }

  async readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    return this.loadGraph(query);
  }

  async findNodes(names: string[]): Promise<KnowledgeGraph> {
    const searchQuery = `name:(${names.join(' ')})`;
    return this.loadGraph(searchQuery);
  }

  async close(): Promise<void> {
    await this.driver.close();
    console.log('[Neo4j] Connection closed');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      console.error('[Neo4j] Connection test failed:', error);
      return false;
    }
  }

  async getStats(): Promise<{
    entities: number;
    relations: number;
    totalObservations: number;
  }> {
    const session = this.driver.session({ database: this.database });
    try {
      const query = `
        MATCH (e:Memory)
        OPTIONAL MATCH (e)-[r]-()
        RETURN 
          count(distinct e) as entities,
          count(distinct r) as relations,
          sum(size(coalesce(e.observations, []))) as totalObservations
      `;
      
      const result = await session.run(query);
      const record = result.records[0];
      
      return {
        entities: record.get('entities').toNumber(),
        relations: record.get('relations').toNumber(),
        totalObservations: record.get('totalObservations').toNumber(),
      };
    } finally {
      await session.close();
    }
  }
}