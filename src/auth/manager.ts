import { AuthProvider } from './base.js';
import { OAuthProvider } from './oauth.js';
import { ApiKeyProvider } from './apikey.js';
import { AuthSession } from '../types/index.js';
import http from 'http';

export class AuthManager {
  private providers: AuthProvider[] = [];
  
  constructor(
    descopeProjectId?: string,
    descopeManagementKey?: string,
    apiKeys?: string[]
  ) {
    // Initialize OAuth provider if Descope credentials are provided
    if (descopeProjectId) {
      try {
        const oauthProvider = new OAuthProvider(descopeProjectId, descopeManagementKey);
        this.providers.push(oauthProvider);
        console.log('[Auth] OAuth provider initialized with Descope');
      } catch (error) {
        console.warn('[Auth] Failed to initialize OAuth provider:', error);
      }
    }
    
    // Initialize API Key provider if API keys are provided
    if (apiKeys && apiKeys.length > 0) {
      try {
        const apiKeyProvider = new ApiKeyProvider(apiKeys);
        this.providers.push(apiKeyProvider);
        console.log(`[Auth] API Key provider initialized with ${apiKeys.length} keys`);
      } catch (error) {
        console.warn('[Auth] Failed to initialize API Key provider:', error);
      }
    }
    
    if (this.providers.length === 0) {
      console.warn('[Auth] No authentication providers initialized. Server will run without authentication.');
    }
  }

  /**
   * Authenticate a request using the first compatible provider
   */
  async authenticate(request: http.IncomingMessage): Promise<AuthSession> {
    console.log('[Auth] Attempting authentication...', {
      hasProviders: this.providers.length > 0,
      headers: {
        authorization: request.headers.authorization ? 'present' : 'missing',
        'x-api-key': request.headers['x-api-key'] ? 'present' : 'missing',
      }
    });

    if (this.providers.length === 0) {
      // No authentication configured, create a default session
      console.log('[Auth] No providers configured, using anonymous session');
      return {
        id: 'no-auth',
        type: 'oauth',
        userId: 'anonymous',
        name: 'Anonymous User',
        provider: 'none',
        scopes: ['read', 'write'],
        createdAt: new Date(),
      };
    }

    // Try each provider in order
    for (const provider of this.providers) {
      console.log(`[Auth] Checking provider: ${provider.name}`);
      if (provider.canHandle(request)) {
        console.log(`[Auth] Provider ${provider.name} can handle request`);
        try {
          const session = await provider.authenticate(request);
          console.log(`[Auth] Provider ${provider.name} authenticated successfully`);
          return session;
        } catch (error) {
          console.error(`[Auth] ${provider.name} authentication failed:`, error);
          // Continue to next provider
        }
      } else {
        console.log(`[Auth] Provider ${provider.name} cannot handle request`);
      }
    }

    throw new Error('Authentication failed: No valid credentials provided');
  }

  /**
   * Validate an existing session
   */
  async validateSession(sessionId: string, providerType?: string): Promise<AuthSession | null> {
    for (const provider of this.providers) {
      if (!providerType || provider.name === providerType) {
        try {
          const session = await provider.validateSession(sessionId);
          if (session) {
            return session;
          }
        } catch (error) {
          console.error(`[Auth] Session validation failed for ${provider.name}:`, error);
        }
      }
    }
    return null;
  }

  /**
   * Get OAuth provider if available
   */
  getOAuthProvider(): OAuthProvider | null {
    const provider = this.providers.find(p => p instanceof OAuthProvider);
    return provider as OAuthProvider || null;
  }

  /**
   * Get API Key provider if available
   */
  getApiKeyProvider(): ApiKeyProvider | null {
    const provider = this.providers.find(p => p instanceof ApiKeyProvider);
    return provider as ApiKeyProvider || null;
  }

  /**
   * Check if authentication is enabled
   */
  isAuthEnabled(): boolean {
    return this.providers.length > 0;
  }

  /**
   * Get list of available authentication methods
   */
  getAvailableMethods(): string[] {
    return this.providers.map(p => p.name);
  }

  /**
   * Add a new provider
   */
  addProvider(provider: AuthProvider): void {
    this.providers.push(provider);
  }

  /**
   * Remove a provider by name
   */
  removeProvider(name: string): void {
    this.providers = this.providers.filter(p => p.name !== name);
  }

  /**
   * Get authentication status
   */
  getAuthStatus(): {
    enabled: boolean;
    providers: string[];
    oauthConfigured: boolean;
    apiKeyConfigured: boolean;
  } {
    return {
      enabled: this.isAuthEnabled(),
      providers: this.getAvailableMethods(),
      oauthConfigured: this.getOAuthProvider() !== null,
      apiKeyConfigured: this.getApiKeyProvider() !== null,
    };
  }
}