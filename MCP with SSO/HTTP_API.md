# HTTP API Documentation

The PingFederate MCP Server now runs as an HTTP server instead of stdio. This document describes all available HTTP endpoints.

## Base URL

```
http://localhost:3000
```

## Health Check

### GET /health

Check if the server is running and healthy.

**Response:**
```json
{
  "status": "ok",
  "server": "pingfederate-mcp-server",
  "version": "1.0.0",
  "timestamp": "2026-03-19T10:30:00.000Z"
}
```

## Server Information

### GET /mcp/info

Get detailed information about the MCP server and available endpoints.

**Response:**
```json
{
  "name": "pingfederate-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for PingFederate OAuth 2.0 and OIDC integration",
  "transport": "http",
  "endpoints": {
    "health": "/health",
    "list_tools": "/mcp/tools",
    "execute_tool": "/mcp/execute (POST)",
    "info": "/mcp/info"
  },
  "pingfederate": {
    "base_url": "https://your-pingfederate.example.com:9031",
    "client_id": "***"
  }
}
```

## List Available Tools

### GET /mcp/tools

Get list of all available authentication tools.

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "generate_auth_url",
      "description": "Generate PingFederate authorization URL for OAuth 2.0/OIDC flow...",
      "inputSchema": {
        "type": "object",
        "properties": {
          "scope": {
            "type": "string",
            "description": "OAuth scopes. Default: \"openid profile email\""
          }
        },
        "required": []
      }
    },
    // ... other tools
  ]
}
```

## Execute Tool

### POST /mcp/execute

Execute one of the available authentication tools.

**Request Body:**
```json
{
  "tool_name": "generate_auth_url",
  "arguments": {
    "scope": "openid profile email"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "tool_name": "generate_auth_url",
  "result": {
    "success": true,
    "authorization_url": "https://your-pingfederate.example.com:9031/as/authorization.oauth2?...",
    "message": "Authorization URL generated. Direct user to this URL to authenticate."
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid or expired state parameter"
}
```

## Tool Examples

### 1. Generate Authorization URL

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "generate_auth_url",
    "arguments": {
      "scope": "openid profile email offline_access"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "generate_auth_url",
  "result": {
    "success": true,
    "authorization_url": "https://pingfed.example.com:9031/as/authorization.oauth2?client_id=...",
    "message": "Authorization URL generated."
  }
}
```

### 2. Exchange Authorization Code

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "exchange_authorization_code",
    "arguments": {
      "code": "authorization_code_from_callback",
      "state": "state_value_from_callback"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "exchange_authorization_code",
  "result": {
    "success": true,
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
    "scope": "openid profile email offline_access",
    "message": "Successfully exchanged authorization code for tokens"
  }
}
```

### 3. Get User Info

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_user_info",
    "arguments": {
      "access_token": "your_access_token_here"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "get_user_info",
  "result": {
    "success": true,
    "user_info": {
      "sub": "user-id-12345",
      "email": "user@example.com",
      "name": "John Doe",
      "preferred_username": "johndoe",
      "email_verified": true
    }
  }
}
```

### 4. Refresh Access Token

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "refresh_access_token",
    "arguments": {
      "refresh_token": "your_refresh_token_here"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "refresh_access_token",
  "result": {
    "success": true,
    "access_token": "new_access_token",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "openid profile email offline_access",
    "message": "Token successfully refreshed"
  }
}
```

### 5. Revoke Token

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "revoke_token",
    "arguments": {
      "token": "your_token_here",
      "token_type": "access_token"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "revoke_token",
  "result": {
    "success": true,
    "message": "Token successfully revoked. User is logged out."
  }
}
```

### 6. Decode ID Token

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "decode_id_token",
    "arguments": {
      "id_token": "your_id_token_jwt_here"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "decode_id_token",
  "result": {
    "success": true,
    "claims": {
      "iss": "https://pingfed.example.com:9031",
      "sub": "user-id-12345",
      "aud": "client-id",
      "exp": 1742548200,
      "iat": 1742544600,
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### 7. Get Valid Token (Auto-refresh)

**Request:**
```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_valid_token",
    "arguments": {
      "refresh_token": "your_refresh_token_here"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "get_valid_token",
  "result": {
    "success": true,
    "access_token": "valid_access_token",
    "message": "Valid access token obtained (refreshed if necessary)"
  }
}
```

### 8. Get Discovery Metadata

**Request:**
```bash
curl -X GET http://localhost:3000/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_discovery_metadata",
    "arguments": {}
  }'
```

**Response:**
```json
{
  "success": true,
  "tool_name": "get_discovery_metadata",
  "result": {
    "success": true,
    "metadata": {
      "issuer": "https://pingfed.example.com:9031",
      "authorization_endpoint": "https://pingfed.example.com:9031/as/authorization.oauth2",
      "token_endpoint": "https://pingfed.example.com:9031/as/token.oauth2",
      "userinfo_endpoint": "https://pingfed.example.com:9031/pf-ws/rest/oauth/userinfo",
      "jwks_uri": "https://pingfed.example.com:9031/as/jwks",
      "response_types_supported": ["code", "token", "id_token"],
      "subject_types_supported": ["public"],
      "scopes_supported": ["openid", "profile", "email", "offline_access"]
    }
  }
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200 OK**: Request successful
- **400 Bad Request**: Missing or invalid parameters
- **404 Not Found**: Endpoint not found
- **500 Internal Server Error**: Server-side error

### Error Response Format

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Authentication Flow Diagram

```
Client                          MCP Server                    PingFederate
  |                                 |                              |
  |--- generate_auth_url() ----->  |                              |
  |<------ auth_url ----------      |                              |
  |                                 |                              |
  |------- redirect to URL --------------------------------------------->|
  |<------------ callback (code + state) -------------------------------|
  |                                 |                              |
  |--- exchange_code() ------------->|                            |
  |                                 |------- token request ----->|
  |                                 |<------- tokens ----------|
  |<----- tokens (access + refresh) |                            |
  |                                 |                              |
  |--- get_user_info() ------------->|                            |
  |                                 |------- userinfo request --->|
  |                                 |<------- user_info -----------|
  |<------ user_info ----------      |                              |
```

## Integration with Copilot Studio

To use this HTTP server with Microsoft Copilot Studio:

1. **Configure the Server URL** in Copilot Studio MCP settings:
   ```
   http://localhost:3000
   ```

2. **Use the Endpoints**:
   - List tools: `GET /mcp/tools`
   - Execute tool: `POST /mcp/execute`

3. **Pass tool parameters** as JSON in POST request body:
   ```json
   {
     "tool_name": "tool_name_here",
     "arguments": { /* tool arguments */ }
   }
```

## Performance Considerations

- Token caching is enabled by default (TTL: 3600 seconds)
- State parameter cleanup runs every 15 minutes
- Tokens are automatically refreshed 5 minutes before expiration
- All operations are asynchronous and non-blocking

## Security Notes

✅ **Implemented:**
- CSRF protection via state parameter validation
- Secure random generation for state/nonce
- Token expiration enforcement
- HTTPS support for production

⚠️ **Important for Production:**
- Enable HTTPS/TLS for all communication
- Store tokens securely (database with encryption)
- Implement proper authentication for this server
- Use environment variables for all secrets
- Monitor and log all token operations
