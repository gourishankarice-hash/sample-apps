# Quick Start Guide - PingFederate MCP Server

Get your HTTP-based MCP server up and running in minutes!

## 1. Initial Setup

```bash
# Navigate to project directory
cd "MCP with SSO"

# Copy and configure environment variables
cp .env.example .env
```

## 2. Configure Your PingFederate Instance

Edit `.env` and update these values:

```env
# Get these from your PingFederate OAuth 2.0 server setup
PING_BASE_URL=https://YOUR_PING_SERVER:9031
PING_CLIENT_ID=your-client-id
PING_CLIENT_SECRET=your-client-secret
PING_REDIRECT_URI=http://localhost:3000/callback

# These are usually standard endpoints
PING_TOKEN_ENDPOINT=/as/token.oauth2
PING_AUTHORIZE_ENDPOINT=/as/authorization.oauth2
PING_USERINFO_ENDPOINT=/pf-ws/rest/oauth/userinfo

# HTTP Server Configuration
HTTP_PORT=3000
HTTP_HOST=localhost
NODE_ENV=development
```

## 3. Build the Project

```bash
npm run build
```

The compiled server will be in the `dist/` folder.

## 4. Run the Server

### Simple Start
```bash
npm start
```

### Watch Mode (auto-rebuild on file changes)
```bash
npm run watch
```

The HTTP server will start and listen on **http://localhost:3000**

## 5. Test the Server

```bash
# Check if server is running and healthy
curl http://localhost:3000/health

# List available tools
curl http://localhost:3000/mcp/tools

# Get server information
curl http://localhost:3000/mcp/info
```

Expected output for `/health`:
```json
{
  "status": "ok",
  "server": "pingfederate-mcp-server",
  "version": "1.0.0",
  "timestamp": "2026-03-19T10:30:00.000Z"
}
```

## 6. Connect to Copilot Studio

Once the server is running on http://localhost:3000, you can:

1. Configure Copilot Studio to connect to this HTTP server
2. Point to the tools endpoint: `http://localhost:3000/mcp/tools`
3. Point to the execute endpoint: `http://localhost:3000/mcp/execute`
4. Start using the 8 available authentication tools

## Available Tools (8 Total)

| Tool | Purpose | HTTP Call |
|------|---------|-----------|
| `generate_auth_url` | Start OAuth authentication | POST /mcp/execute |
| `exchange_authorization_code` | Get tokens after callback | POST /mcp/execute |
| `get_user_info` | Retrieve user details | POST /mcp/execute |
| `refresh_access_token` | Refresh expired tokens | POST /mcp/execute |
| `get_valid_token` | Auto-refresh as needed | POST /mcp/execute |
| `revoke_token` | Logout user | POST /mcp/execute |
| `decode_id_token` | Decode OIDC claims | POST /mcp/execute |
| `get_discovery_metadata` | Get OIDC discovery info | POST /mcp/execute |

## Example API Calls

### Generate Authorization URL
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

### Exchange Authorization Code
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

## Common Issues

**"Port 3000 is already in use"**
- Run on a different port: `HTTP_PORT=3001 npm start`
- Or kill the process: `lsof -ti:3000 | xargs kill -9` (macOS/Linux)

**"Missing required PingFederate configuration"**
- Make sure you created `.env` from `.env.example`
- Verify all required variables are set

**"Failed to exchange code for token"**
- Check that `PING_CLIENT_ID` and `PING_CLIENT_SECRET` are correct
- Verify `PING_REDIRECT_URI` matches your PingFederate configuration

**"404 Not Found" on API calls**
- Ensure server is running: `npm start`
- Check the correct endpoint: `/mcp/execute` for tool execution
- Verify JSON format in POST body

## Project Structure

```
src/
├── server.ts        # HTTP server with Express.js
├── pingfederate.ts  # OAuth/OIDC client logic
└── tools.ts         # Tool definitions

dist/               # Compiled JavaScript (created by npm run build)
.vscode/mcp.json    # VS Code MCP configuration
HTTP_API.md         # Complete API documentation
README.md           # Full documentation
```

## Next Steps

1. **API Documentation**: Read [HTTP_API.md](HTTP_API.md) for complete endpoint documentation
2. **Secure Configuration**: For production, use a secure secrets manager
3. **Token Storage**: Replace in-memory caching with Redis or database
4. **Logging**: Configure proper logging and monitoring
5. **Testing**: Test all tools with your PingFederate instance
6. **Deployment**: Deploy to your infrastructure (Docker, Azure, AWS, etc.)

## Documentation

- **[README.md](README.md)** - Full project documentation
- **[HTTP_API.md](HTTP_API.md)** - Complete API reference with examples
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - Developer reference
