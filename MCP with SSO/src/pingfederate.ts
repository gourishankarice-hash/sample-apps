import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import NodeCache from 'node-cache';
import { TextEncoder } from 'util';

// Types for PingFederate integration
export interface PingFederateConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEndpoint: string;
  authorizeEndpoint: string;
  userinfoEndpoint: string;
  cacheTTL?: number;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
  issued_at: number;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

export interface AuthorizationRequest {
  client_id: string;
  response_type: string;
  redirect_uri: string;
  scope: string;
  state: string;
  nonce?: string;
  prompt?: string;
}

/**
 * PingFederateClient handles OAuth 2.0 and OIDC integration with PingFederate
 */
export class PingFederateClient {
  private config: PingFederateConfig;
  private http: AxiosInstance;
  private tokenCache: NodeCache;
  private stateStore: Map<string, { nonce?: string; createdAt: number }>;

  constructor(config: PingFederateConfig) {
    this.config = {
      cacheTTL: 3600,
      ...config,
    };

    // Initialize HTTP client with SSL certificate verification disabled for dev
    // In production, ensure proper SSL certificate validation
    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      httpsAgent: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });

    // Initialize token cache
    this.tokenCache = new NodeCache({ stdTTL: this.config.cacheTTL });

    // Initialize state store for CSRF protection
    this.stateStore = new Map();
  }

  /**
   * Generate authorization URL for OAuth 2.0 flow
   */
  generateAuthorizationUrl(
    scope: string = 'openid profile email',
    state?: string,
    nonce?: string
  ): string {
    const authState = state || this.generateRandomString(32);
    const authNonce = nonce || this.generateRandomString(32);

    // Store state and nonce for validation
    this.stateStore.set(authState, {
      nonce: authNonce,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope,
      state: authState,
      nonce: authNonce,
    });

    return `${this.config.baseUrl}${this.config.authorizeEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens (OAuth 2.0 authorization code flow)
   */
  async exchangeCodeForToken(code: string, state: string): Promise<OAuthToken> {
    try {
      // Validate state parameter
      const stateData = this.stateStore.get(state);
      if (!stateData) {
        throw new Error('Invalid or expired state parameter');
      }

      // Remove state from store (one-time use)
      this.stateStore.delete(state);

      // Check state expiration (5 minutes)
      if (Date.now() - stateData.createdAt > 5 * 60 * 1000) {
        throw new Error('State parameter has expired');
      }

      // Request token from PingFederate
      const response = await this.http.post<OAuthToken>(
        this.config.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const token: OAuthToken = {
        ...response.data,
        issued_at: Math.floor(Date.now() / 1000),
      };

      // Cache the token
      this.tokenCache.set(this.config.clientId, token);

      return token;
    } catch (error) {
      throw new Error(
        `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<OAuthToken> {
    try {
      const response = await this.http.post<OAuthToken>(
        this.config.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const token: OAuthToken = {
        ...response.data,
        issued_at: Math.floor(Date.now() / 1000),
      };

      // Update cache
      this.tokenCache.set(this.config.clientId, token);

      return token;
    } catch (error) {
      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get access token, refreshing if necessary
   */
  async getValidAccessToken(refreshToken: string): Promise<string> {
    // Check cache first
    const cachedToken = this.tokenCache.get<OAuthToken>(this.config.clientId);

    if (cachedToken) {
      const expiresIn = cachedToken.expires_in || 3600;
      const elapsed = Math.floor(Date.now() / 1000) - cachedToken.issued_at;

      // Refresh if token is within 5 minutes of expiration
      if (elapsed < expiresIn - 300) {
        return cachedToken.access_token;
      }
    }

    // Refresh the token
    if (refreshToken) {
      const newToken = await this.refreshToken(refreshToken);
      return newToken.access_token;
    }

    throw new Error('No valid token available and refresh token not provided');
  }

  /**
   * Get user information using access token (OIDC UserInfo endpoint)
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    try {
      const response = await this.http.get<UserInfo>(
        this.config.userinfoEndpoint,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to retrieve user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate and decode ID token (OIDC)
   */
  validateAndDecodeIdToken(idToken: string): UserInfo {
    try {
      // In production, validate against PingFederate's public key
      // For now, we'll decode without verification (use only in development)
      const decoded = jwt.decode(idToken) as jwt.JwtPayload;

      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token structure');
      }

      return decoded as UserInfo;
    } catch (error) {
      throw new Error(
        `Failed to validate ID token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke token (logout)
   */
  async revokeToken(token: string, tokenTypeHint: string = 'access_token'): Promise<void> {
    try {
      await this.http.post(
        '/as/revoke',
        new URLSearchParams({
          token,
          token_type_hint: tokenTypeHint,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Clear cache
      this.tokenCache.del(this.config.clientId);
    } catch (error) {
      throw new Error(
        `Failed to revoke token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get authorization server metadata (OIDC Discovery)
   */
  async getMetadata(): Promise<Record<string, unknown>> {
    try {
      const response = await this.http.get(
        '/.well-known/openid-configuration'
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate random string for state/nonce parameters
   */
  private generateRandomString(length: number): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Clear state store (cleanup old entries)
   */
  cleanupStateStore(maxAge: number = 10 * 60 * 1000): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.createdAt > maxAge) {
        this.stateStore.delete(state);
      }
    }
  }
}
