/**
 * OAuth 2.0 Authorization Server
 *
 * Supports:
 *  - Client Credentials Grant  (server-to-server, used by Copilot Studio)
 *  - Authorization Code Grant  (user-delegated access)
 *  - Token introspection & userinfo endpoints
 *
 * In production, replace this with Azure AD / Entra ID or another IdP.
 */

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY ?? "1h";
const HOST = process.env.HOST ?? "http://localhost:3000";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  name: string;
  allowedScopes: string[];
  allowedGrants: ("client_credentials" | "authorization_code")[];
  redirectUris: string[];
}

export interface TokenPayload {
  sub: string;         // subject (userId or clientId)
  client_id: string;
  scope: string;
  grant_type: string;
  iat: number;
  exp: number;
}

export interface AuthCode {
  code: string;
  clientId: string;
  scope: string;
  userId: string;
  redirectUri: string;
  expiresAt: number;
}

// ─────────────────────────────────────────────
// In-memory stores (use DB / Redis in production)
// ─────────────────────────────────────────────

const clients = new Map<string, OAuthClient>([
  [
    process.env.COPILOT_CLIENT_ID ?? "copilot-studio-client",
    {
      clientId: process.env.COPILOT_CLIENT_ID ?? "copilot-studio-client",
      clientSecret:
        process.env.COPILOT_CLIENT_SECRET ?? "copilot-studio-secret-change-me",
      name: "Microsoft Copilot Studio",
      allowedScopes: ["tools:read", "tools:write", "profile:read", "tasks:read", "tasks:write"],
      allowedGrants: ["client_credentials", "authorization_code"],
      redirectUris: ["https://global.consent.azure-apim.net/redirect"],
    },
  ],
  [
    process.env.DEMO_CLIENT_ID ?? "demo-client",
    {
      clientId: process.env.DEMO_CLIENT_ID ?? "demo-client",
      clientSecret: process.env.DEMO_CLIENT_SECRET ?? "demo-secret-change-me",
      name: "Demo Client",
      allowedScopes: ["tools:read", "profile:read"],
      allowedGrants: ["client_credentials", "authorization_code"],
      redirectUris: ["http://localhost:3000/oauth/callback"],
    },
  ],
]);

// Demo user store (replace with your user DB in production)
const users = new Map<string, { userId: string; name: string; email: string; role: string }>([
  ["user1", { userId: "user1", name: "Alice Johnson", email: "alice@example.com", role: "admin" }],
  ["user2", { userId: "user2", name: "Bob Smith",   email: "bob@example.com",   role: "member" }],
]);

const authCodes = new Map<string, AuthCode>();
const revokedTokens = new Set<string>();

// ─────────────────────────────────────────────
// Client helpers
// ─────────────────────────────────────────────

export function getClient(clientId: string): OAuthClient | undefined {
  return clients.get(clientId);
}

export function validateClient(clientId: string, clientSecret: string): OAuthClient | null {
  const client = clients.get(clientId);
  if (client && client.clientSecret === clientSecret) return client;
  return null;
}

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────

export function generateToken(
  clientId: string,
  scope: string,
  grantType: "client_credentials" | "authorization_code",
  userId?: string
): string {
  const payload: Omit<TokenPayload, "iat" | "exp"> = {
    sub: userId ?? clientId,
    client_id: clientId,
    scope,
    grant_type: grantType,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY } as jwt.SignOptions);
}

export function validateToken(token: string): TokenPayload | null {
  try {
    if (revokedTokens.has(token)) return null;
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function revokeToken(token: string): void {
  revokedTokens.add(token);
}

export function introspectToken(token: string): object {
  const payload = validateToken(token);
  if (!payload) return { active: false };

  const client = getClient(payload.client_id);
  return {
    active: true,
    sub: payload.sub,
    client_id: payload.client_id,
    scope: payload.scope,
    grant_type: payload.grant_type,
    token_type: "Bearer",
    iat: payload.iat,
    exp: payload.exp,
    client_name: client?.name ?? "Unknown",
  };
}

// ─────────────────────────────────────────────
// Authorization Code helpers
// ─────────────────────────────────────────────

export function generateAuthCode(
  clientId: string,
  scope: string,
  userId: string,
  redirectUri: string
): string {
  const code = uuidv4();
  authCodes.set(code, {
    code,
    clientId,
    scope,
    userId,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
  });
  return code;
}

export function exchangeAuthCode(
  code: string,
  clientId: string,
  redirectUri: string
): { scope: string; userId: string } | null {
  const authCode = authCodes.get(code);
  if (!authCode) return null;
  if (authCode.clientId !== clientId) return null;
  if (authCode.redirectUri !== redirectUri) return null;
  if (authCode.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  authCodes.delete(code); // single-use
  return { scope: authCode.scope, userId: authCode.userId };
}

// ─────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────

export function getUser(userId: string) {
  return users.get(userId);
}

// ─────────────────────────────────────────────
// OpenID Connect / OAuth Discovery document
// ─────────────────────────────────────────────

export function getDiscoveryDocument() {
  return {
    issuer: HOST,
    authorization_endpoint: `${HOST}/oauth/authorize`,
    token_endpoint: `${HOST}/oauth/token`,
    userinfo_endpoint: `${HOST}/oauth/userinfo`,
    introspection_endpoint: `${HOST}/oauth/introspect`,
    revocation_endpoint: `${HOST}/oauth/revoke`,
    jwks_uri: `${HOST}/.well-known/jwks.json`,
    scopes_supported: ["tools:read", "tools:write", "profile:read", "tasks:read", "tasks:write"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256", "plain"],
  };
}
