import { PingFederateClient, OAuthToken, UserInfo } from './pingfederate.js';

export interface ToolInput {
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Authentication tools for Copilot Studio
 */
export class AuthenticationTools {
  private pingfedClient: PingFederateClient;
  private currentTokens: Map<string, OAuthToken> = new Map();

  constructor(pingfedClient: PingFederateClient) {
    this.pingfedClient = pingfedClient;
  }

  /**
   * Define MCP Tools for authentication
   */
  getTools(): Tool[] {
    return [
      {
        name: 'generate_auth_url',
        description:
          'Generate PingFederate authorization URL for OAuth 2.0/OIDC flow. Use this to initiate user authentication.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              description:
                'OAuth scopes. Default: "openid profile email". Common values: "openid", "profile", "email", "offline_access"',
              default: 'openid profile email',
            },
          },
          required: [],
        },
      },
      {
        name: 'exchange_authorization_code',
        description:
          'Exchange authorization code for access and refresh tokens after user authenticates with PingFederate.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Authorization code returned from PingFederate callback',
            },
            state: {
              type: 'string',
              description: 'State parameter returned from PingFederate callback',
            },
          },
          required: ['code', 'state'],
        },
      },
      {
        name: 'get_user_info',
        description:
          'Retrieve authenticated user information from PingFederate using access token.',
        inputSchema: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              description: 'OAuth access token from token exchange',
            },
          },
          required: ['access_token'],
        },
      },
      {
        name: 'refresh_access_token',
        description:
          'Refresh an expired access token using the refresh token. Useful for maintaining long-lived sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            refresh_token: {
              type: 'string',
              description: 'Refresh token obtained during initial authentication',
            },
          },
          required: ['refresh_token'],
        },
      },
      {
        name: 'get_valid_token',
        description:
          'Get a valid access token, automatically refreshing if the current one is expired or close to expiration.',
        inputSchema: {
          type: 'object',
          properties: {
            refresh_token: {
              type: 'string',
              description: 'Refresh token for obtaining new access tokens',
            },
          },
          required: ['refresh_token'],
        },
      },
      {
        name: 'revoke_token',
        description:
          'Revoke an access or refresh token and logout the user from PingFederate.',
        inputSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token to revoke (access token or refresh token)',
            },
            token_type: {
              type: 'string',
              description:
                'Type of token: "access_token" or "refresh_token". Default: "access_token"',
              enum: ['access_token', 'refresh_token'],
              default: 'access_token',
            },
          },
          required: ['token'],
        },
      },
      {
        name: 'decode_id_token',
        description:
          'Decode and validate ID token from OIDC flow to extract user claims.',
        inputSchema: {
          type: 'object',
          properties: {
            id_token: {
              type: 'string',
              description: 'JWT ID token from token response',
            },
          },
          required: ['id_token'],
        },
      },
      {
        name: 'get_discovery_metadata',
        description:
          'Retrieve PingFederate OpenID Connect discovery metadata (endpoints, supported algorithms, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];
  }

  /**
   * Process tool calls
   */
  async executeTool(toolName: string, toolInput: ToolInput): Promise<string> {
    switch (toolName) {
      case 'generate_auth_url':
        return this.handleGenerateAuthUrl(toolInput);
      case 'exchange_authorization_code':
        return this.handleExchangeCode(toolInput);
      case 'get_user_info':
        return this.handleGetUserInfo(toolInput);
      case 'refresh_access_token':
        return this.handleRefreshToken(toolInput);
      case 'get_valid_token':
        return this.handleGetValidToken(toolInput);
      case 'revoke_token':
        return this.handleRevokeToken(toolInput);
      case 'decode_id_token':
        return this.handleDecodeIdToken(toolInput);
      case 'get_discovery_metadata':
        return this.handleGetMetadata(toolInput);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private handleGenerateAuthUrl(input: ToolInput): string {
    try {
      const scope = (input.scope as string) || 'openid profile email';
      const authUrl = this.pingfedClient.generateAuthorizationUrl(scope);

      return JSON.stringify(
        {
          success: true,
          authorization_url: authUrl,
          message:
            'Authorization URL generated. Direct user to this URL to authenticate.',
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleExchangeCode(input: ToolInput): Promise<string> {
    try {
      const code = input.code as string;
      const state = input.state as string;

      if (!code || !state) {
        throw new Error('Code and state parameters are required');
      }

      const tokens = await this.pingfedClient.exchangeCodeForToken(code, state);

      // Store tokens for this user session
      this.currentTokens.set(state, tokens);

      return JSON.stringify(
        {
          success: true,
          access_token: tokens.access_token,
          token_type: tokens.token_type,
          expires_in: tokens.expires_in,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          message: 'Successfully exchanged authorization code for tokens',
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleGetUserInfo(input: ToolInput): Promise<string> {
    try {
      const accessToken = input.access_token as string;

      if (!accessToken) {
        throw new Error('Access token is required');
      }

      const userInfo = await this.pingfedClient.getUserInfo(accessToken);

      return JSON.stringify(
        {
          success: true,
          user_info: userInfo,
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleRefreshToken(input: ToolInput): Promise<string> {
    try {
      const refreshToken = input.refresh_token as string;

      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      const newTokens = await this.pingfedClient.refreshToken(refreshToken);

      return JSON.stringify(
        {
          success: true,
          access_token: newTokens.access_token,
          token_type: newTokens.token_type,
          expires_in: newTokens.expires_in,
          scope: newTokens.scope,
          message: 'Token successfully refreshed',
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleGetValidToken(input: ToolInput): Promise<string> {
    try {
      const refreshToken = input.refresh_token as string;

      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      const accessToken = await this.pingfedClient.getValidAccessToken(
        refreshToken
      );

      return JSON.stringify(
        {
          success: true,
          access_token: accessToken,
          message: 'Valid access token obtained (refreshed if necessary)',
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleRevokeToken(input: ToolInput): Promise<string> {
    try {
      const token = input.token as string;
      const tokenType = (input.token_type as string) || 'access_token';

      if (!token) {
        throw new Error('Token is required');
      }

      await this.pingfedClient.revokeToken(token, tokenType);

      return JSON.stringify(
        {
          success: true,
          message: `Token successfully revoked. User is logged out.`,
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private handleDecodeIdToken(input: ToolInput): string {
    try {
      const idToken = input.id_token as string;

      if (!idToken) {
        throw new Error('ID token is required');
      }

      const claims = this.pingfedClient.validateAndDecodeIdToken(idToken);

      return JSON.stringify(
        {
          success: true,
          claims,
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }

  private async handleGetMetadata(input: ToolInput): Promise<string> {
    try {
      const metadata = await this.pingfedClient.getMetadata();

      return JSON.stringify(
        {
          success: true,
          metadata,
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2
      );
    }
  }
}
