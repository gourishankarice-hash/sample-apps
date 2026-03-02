# Consuming MCP OAuth Server in Microsoft Copilot Studio

## Overview

Microsoft Copilot Studio supports MCP (Model Context Protocol) servers as **Actions**.
This guide walks through connecting your MCP OAuth server to Copilot Studio step by step.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Microsoft Copilot Studio                      │
│                                                                    │
│  ┌─────────────────┐         ┌──────────────────────────────┐    │
│  │   Copilot Topic │ invokes │  MCP Action (connector)      │    │
│  │   (Conversation)│ ──────► │  - OAuth token management    │    │
│  └─────────────────┘         │  - Tool calling via MCP/SSE  │    │
│                               └──────────────┬───────────────┘    │
└──────────────────────────────────────────────┼───────────────────┘
                                               │ HTTPS + Bearer Token
                                               ▼
                                ┌──────────────────────────┐
                                │   Your MCP OAuth Server   │
                                │   (Node.js / Express)     │
                                │                           │
                                │  GET  /sse               │
                                │  POST /messages          │
                                │  POST /oauth/token       │
                                └──────────────────────────┘
```

---

## Prerequisites

1. **MCP server deployed** at a publicly accessible HTTPS URL
   - For local testing, use [ngrok](https://ngrok.com): `ngrok http 3000`
   - For production, deploy to Azure App Service, Azure Container Apps, etc.

2. **Copilot Studio license** (Microsoft 365 or Power Platform)

3. **HTTPS required** — Copilot Studio will not connect to plain HTTP

---

## Step 1: Deploy the MCP Server

### Local Development with ngrok

```bash
# Install dependencies
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env: set a strong JWT_SECRET and change client secrets

# Start the server
npm run dev

# In another terminal, expose it via ngrok
ngrok http 3000
# Copy the https://xxxx.ngrok-free.app URL
```

### Deploy to Azure App Service

```bash
# Build TypeScript
npm run build

# Create App Service (Basic B1 is sufficient)
az group create --name rg-mcp-oauth --location eastus
az appservice plan create --name plan-mcp --resource-group rg-mcp-oauth --sku B1 --is-linux
az webapp create --name mcp-oauth-server --resource-group rg-mcp-oauth \
  --plan plan-mcp --runtime "NODE:22-lts"

# Set environment variables
az webapp config appsettings set --name mcp-oauth-server \
  --resource-group rg-mcp-oauth --settings \
  JWT_SECRET="your-super-strong-secret-here" \
  HOST="https://mcp-oauth-server.azurewebsites.net" \
  COPILOT_CLIENT_SECRET="strong-secret-for-copilot" \
  NODE_ENV="production"

# Deploy
az webapp deploy --name mcp-oauth-server --resource-group rg-mcp-oauth \
  --src-path ./dist --type zip
```

---

## Step 2: Register the MCP Server in Copilot Studio

### 2a. Open Copilot Studio

1. Go to [make.powerautomate.com](https://make.powerautomate.com) or
   [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com)
2. Open your Copilot or create a new one

### 2b. Add an Action

1. In the left navigation, click **Actions**
2. Click **+ Add action**
3. Select **"Connect to an MCP server"** (or "Model Context Protocol")

   > If you don't see this option, ensure your environment has MCP preview features enabled.
   > Go to Settings → General → Preview features → Enable MCP support.

### 2c. Configure the MCP Connection

Fill in the form:

| Field | Value |
|-------|-------|
| **Display name** | `Company Tools MCP` |
| **Server URL** | `https://your-server.azurewebsites.net/sse` |
| **Authentication** | OAuth 2.0 |

### 2d. Configure OAuth 2.0

Click **Configure authentication** and fill in:

| Field | Value |
|-------|-------|
| **Authentication type** | `OAuth 2.0` |
| **Grant type** | `Client credentials` |
| **Token endpoint** | `https://your-server.azurewebsites.net/oauth/token` |
| **Client ID** | `copilot-studio-client` |
| **Client secret** | *(the value you set in COPILOT_CLIENT_SECRET)* |
| **Scope** | `tools:read tools:write tasks:read tasks:write profile:read` |

> **For Authorization Code flow** (user-delegated access):
> - Grant type: `Authorization code`
> - Authorization endpoint: `https://your-server.azurewebsites.net/oauth/authorize`
> - Token endpoint: `https://your-server.azurewebsites.net/oauth/token`
> - Redirect URI: `https://global.consent.azure-apim.net/redirect`

### 2e. Discover and Select Tools

1. Click **Discover tools** — Copilot Studio will call `tools/list` on your MCP server
2. You should see all 8 tools listed:
   - `get_weather`
   - `calculate`
   - `get_current_datetime`
   - `search_knowledge_base`
   - `get_user_profile`
   - `list_tasks`
   - `create_task`
   - `update_task`
3. Select the tools you want to make available
4. Click **Save**

---

## Step 3: Use MCP Tools in Topics

### Example Topic: Weather Query

```
Trigger: "What's the weather in [city]?"

Node: Call an action → get_weather
  Inputs:
    location: System.UserInput  (or a slot-filled variable)
    unit: "celsius"

Node: Send message
  Text: "Current weather in {location}:
         Temperature: {get_weather.temperature}°{get_weather.unit}
         Condition: {get_weather.condition}
         Forecast: {get_weather.forecast}"
```

### Example Topic: Create Task via Natural Language

```
Trigger: "Create a task for..."

Node: Ask a question
  "What's the task title?" → save to TaskTitle

Node: Ask a question
  "What's the description?" → save to TaskDescription

Node: Call an action → create_task
  Inputs:
    title:       TaskTitle
    description: TaskDescription
    priority:    "medium"

Node: Send message
  "Task created! ID: {create_task.task.id}"
```

### Example Topic: Knowledge Base Search

```
Trigger: "How do I [question]?" / "Where can I find..."

Node: Call an action → search_knowledge_base
  Inputs:
    query: System.UserInput

Node: Condition
  If search_knowledge_base.totalFound > 0:
    Send: "Here's what I found: {search_knowledge_base.articles[0].summary}
           Full article: {search_knowledge_base.articles[0].url}"
  Else:
    Send: "I couldn't find anything for that query."
```

---

## Step 4: Test the Integration

### Test from Copilot Studio

1. Open the **Test** panel in Copilot Studio
2. Type: *"What's the weather in Tokyo?"*
3. Copilot should call `get_weather` and return the result

### Test the OAuth Token Directly

```bash
# Get a token (client_credentials)
curl -X POST https://your-server.azurewebsites.net/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=copilot-studio-client&client_secret=YOUR_SECRET&scope=tools:read"

# Response:
# { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600 }

# Use the token to call MCP (test with curl — SSE stream)
curl -N -H "Authorization: Bearer eyJ..." \
  https://your-server.azurewebsites.net/sse
```

---

## Step 5: Production Hardening

### Switch to Azure AD / Entra ID (Recommended for Production)

Instead of the built-in OAuth server, integrate with Azure AD:

1. **Register an App** in Azure Portal → App registrations
2. Add API permissions and expose scopes (e.g., `api://your-app-id/tools.read`)
3. Update the MCP server to validate Azure AD tokens:

```typescript
// Replace validateToken() in auth.ts with:
import jwksClient from "jwks-rsa";
import jwt from "jsonwebtoken";

const TENANT_ID = process.env.AZURE_TENANT_ID;
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
});

export async function validateAzureToken(token: string): Promise<jwt.JwtPayload | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    const key = await client.getSigningKey(decoded?.header?.kid);
    return jwt.verify(token, key.getPublicKey()) as jwt.JwtPayload;
  } catch {
    return null;
  }
}
```

4. In Copilot Studio, set:
   - Token endpoint: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`
   - Client ID: Your Azure AD app client ID

### Security Checklist

- [ ] Strong `JWT_SECRET` (min 32 random chars) — use `openssl rand -hex 32`
- [ ] Change default client secrets (`COPILOT_CLIENT_SECRET`, `DEMO_CLIENT_SECRET`)
- [ ] HTTPS only — disable HTTP
- [ ] Rate limiting on `/oauth/token` (use `express-rate-limit`)
- [ ] Store tokens in Redis/DB instead of in-memory for multi-instance deployments
- [ ] Enable Azure AD token validation for production
- [ ] Set `NODE_ENV=production`
- [ ] Add application logging (Azure Application Insights)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `401 Unauthorized` on `/sse` | Token missing or expired — re-fetch from `/oauth/token` |
| `404 Session not found` on `/messages` | SSE connection dropped — reconnect to `/sse` |
| Tools not discovered | Check server is running and `/sse` responds to OPTIONS |
| OAuth `invalid_client` | Verify `client_id` and `client_secret` match `.env` values |
| Copilot Studio can't reach server | Ensure HTTPS and server is publicly accessible |
| CORS errors | Already handled — `cors()` middleware is in place |

---

## Custom Connector Alternative (Power Automate)

If you prefer a **Custom Connector** approach over native MCP:

1. Export an **OpenAPI 3.0 spec** from your server
2. Go to Power Automate → Data → Custom connectors → New connector
3. Import the spec and configure OAuth 2.0
4. In Copilot Studio, add the connector as an action

This approach works for environments where MCP preview is not yet available.

---

## Reference Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/openid-configuration` | OAuth/OIDC discovery |
| `POST /oauth/token` | Get Bearer token |
| `GET /oauth/authorize` | Authorization Code flow |
| `GET /oauth/userinfo` | Current user info |
| `POST /oauth/introspect` | Token inspection |
| `GET /sse` | MCP SSE connection |
| `POST /messages?sessionId=X` | MCP messages |
| `GET /health` | Server health check |
| `GET /` | Interactive API docs |
