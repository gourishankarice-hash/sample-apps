# 🎨 Visual Architecture & Flow Diagrams

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     🌐 Microsoft Copilot Studio                        │
│                        (AI Assistant App)                              │
│                                                                         │
│  • Needs to authenticate users                                         │
│  • Uses HTTP to make requests                                          │
│  • Gets back authentication tools                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                          HTTP Requests
                    (POST /mcp/execute, etc.)
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                   🔌 YOUR MCP SERVER (localhost:3000)                  │
│                    (The Bridge/Translator)                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  HTTP Server (Express.js)                                        │  │
│  │  • Listens on port 3000                                          │  │
│  │  • Routes requests to tools                                      │  │
│  │  • Returns JSON responses                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Authentication Tools (8 Available)                              │  │
│  │  • generate_auth_url                                             │  │
│  │  • exchange_authorization_code                                   │  │
│  │  • get_user_info                                                 │  │
│  │  • refresh_access_token                                          │  │
│  │  • get_valid_token                                               │  │
│  │  • revoke_token                                                  │  │
│  │  • decode_id_token                                               │  │
│  │  • get_discovery_metadata                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  PingFederate Client                                            │  │
│  │  • Manages OAuth 2.0 flows                                       │  │
│  │  • Handles OIDC operations                                       │  │
│  │  • Token caching & refresh                                       │  │
│  │  • Security validation (state/nonce)                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                          HTTPS Requests
                    (OAuth 2.0 / OIDC Protocol)
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│              🔐 PingFederate (Authentication Service)                  │
│                     (External, not in your control)                    │
│                                                                         │
│  • Verifies user identity                                              │
│  • Issues access & refresh tokens                                      │
│  • Manages OAuth 2.0/OIDC protocol                                     │
│  • Stores user information                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Complete User Authentication Flow

```
START: User wants to log in through Copilot Studio

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Request Login URL                                             │
│                                                                        │
│  Copilot Studio                                                        │
│      │                                                                 │
│      └─ "I need a login URL for the user"                            │
│          (HTTP POST /mcp/execute)                                     │
│                                                                        │
│      Your MCP Server                                                  │
│      │                                                                │
│      ├─ Receives request                                             │
│      ├─ Gets tool: "generate_auth_url"                              │
│      ├─ Generates random state (security code)                       │
│      ├─ Generates random nonce (extra security)                      │
│      ├─ Calls PingFederate Client                                    │
│      │                                                                │
│      PingFederate Client                                             │
│      │                                                                │
│      ├─ Formats request with OAuth parameters                        │
│      ├─ Builds URL with:                                             │
│      │  • Client ID                                                  │
│      │  • Scopes (openid, profile, email)                           │
│      │  • State (random security code)                              │
│      │  • Nonce (for OIDC)                                          │
│      ├─ Stores state/nonce in memory (for later verification)       │
│      │                                                                │
│      └─ Returns complete login URL                                   │
│                                                                        │
│      Your MCP Server                                                  │
│      │                                                                │
│      └─ Returns to Copilot Studio:                                   │
│         {                                                              │
│           "success": true,                                            │
│           "authorization_url": "https://pingfed/as/authorization?..." │
│         }                                                              │
│                                                                        │
│      Copilot Studio                                                   │
│      │                                                                │
│      └─ Shows login URL to user                                      │
│         "Click here to login"                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Authenticates at PingFederate                            │
│                                                                        │
│  👤 User (in Browser)                                                 │
│      │                                                                │
│      └─ Clicks login URL                                             │
│          │                                                            │
│          ▼                                                            │
│      PingFederate (in Browser)                                       │
│      │                                                                │
│      ├─ Shows login form                                             │
│      │  • Username field                                             │
│      │  • Password field                                             │
│      │  • Maybe 2FA/MFA                                              │
│      │                                                                │
│      📝 User Types: john@example.com / password123                   │
│      │                                                                │
│      ▼                                                                │
│      PingFederate (Backend)                                          │
│      │                                                                │
│      ├─ "Is this password correct?"                                  │
│      ├─ Checks password database                                     │
│      ├─ "Yes ✓ - Verified!"                                         │
│      │                                                                │
│      ├─ "User john@example.com has successfully authenticated!"      │
│      │                                                                │
│      ├─ Generates temporary authorization code                      │
│      │  Example: "AGTuD3zxk9..."                                    │
│      │                                                                │
│      ├─ Redirects browser back with:                                 │
│      │  • code (the temporary code)                                  │
│      │  • state (same state we sent before)                          │
│      │                                                                │
│      └─ Browser redirects to: http://localhost:3000/callback?code=...│
│         (This is your PING_REDIRECT_URI)                             │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Exchange Code for Tokens                                       │
│                                                                        │
│  Your Application                                                      │
│      │                                                                │
│      └─ Captures callback with code & state                          │
│          │                                                            │
│          ├─ "Hmm, I got a code from PingFederate"                   │
│          │                                                            │
│          ├─ Sends to Copilot Studio:                                 │
│          │  "I have a code, exchange it for real tokens"             │
│          │                                                            │
│          ▼                                                            │
│      Copilot Studio                                                   │
│      │                                                                │
│      └─ Calls your MCP Server:                                       │
│         POST /mcp/execute                                            │
│         {                                                              │
│           "tool_name": "exchange_authorization_code",                │
│           "arguments": {                                              │
│             "code": "AGTuD3zxk9...",                                │
│             "state": "xY9kL2oP..."                                  │
│           }                                                            │
│         }                                                              │
│          │                                                            │
│          ▼                                                            │
│      Your MCP Server                                                  │
│      │                                                                │
│      ├─ Validates state:                                             │
│      │  • "Do I have this state in memory?" YES ✓                   │
│      │  • "Is it still valid (not expired)?" YES ✓                  │
│      │                                                                │
│      ├─ Removes state from memory (one-time use)                     │
│      │                                                                │
│      └─ Calls PingFederate Client:                                   │
│         "Trade this code for tokens"                                 │
│          │                                                            │
│          ▼                                                            │
│      PingFederate Client                                             │
│      │                                                                │
│      ├─ Prepares backend request to PingFederate                     │
│      │  (This is a SECURE backend-to-backend call, not through user) │
│      │                                                                │
│      ├─ Sends:                                                        │
│      │  • code (the temporary code)                                  │
│      │  • client_id (who we are)                                     │
│      │  • client_secret (proof we are who we say)                    │
│      │  • grant_type: "authorization_code"                          │
│      │                                                                │
│      └─ To: https://pingfed.example.com/as/token.oauth2             │
│          │                                                            │
│          ▼                                                            │
│      PingFederate (Backend Response)                                 │
│      │                                                                │
│      ├─ Validates code:                                              │
│      │  • "Is this code real?" YES ✓                                │
│      │  • "Has it expired?" NO ✓                                    │
│      │  • "Was it used before?" NO ✓ (one-time use)                │
│      │  • "Is client_secret correct?" YES ✓                        │
│      │                                                                │
│      ├─ "All checks passed! User verified!"                          │
│      │                                                                │
│      ├─ Creates and signs tokens:                                    │
│      │                                                                │
│      │  📦 access_token:                                             │
│      │     • Proves user is authenticated                            │
│      │     • Valid for 1 hour                                        │
│      │     • Used to call APIs                                       │
│      │     • Example: "eyJhbGciOiJSUzI1NiIsInR5c..."                │
│      │                                                                │
│      │  📦 refresh_token:                                            │
│      │     • Used to get new access_token                            │
│      │     • Expires in 30 days (or not at all)                      │
│      │     • More sensitive than access_token                        │
│      │     • Example: "aB7xK3mN9pQ..."                              │
│      │                                                                │
│      │  📦 id_token:                                                 │
│      │     • JWT (JSON Web Token) with user info                     │
│      │     • Contains: subject, email, name, etc.                    │
│      │     • Signed by PingFederate                                  │
│      │                                                                │
│      └─ Returns all tokens                                           │
│          │                                                            │
│          ▼                                                            │
│      PingFederate Client (Receives Response)                         │
│      │                                                                │
│      ├─ Validates tokens are properly signed                         │
│      ├─ Stores tokens in cache (with TTL)                           │
│      ├─ Records timestamp when tokens were issued                    │
│      │                                                                │
│      └─ Returns tokens to caller                                     │
│          │                                                            │
│          ▼                                                            │
│      Your MCP Server                                                  │
│      │                                                                │
│      └─ Formats and returns to Copilot Studio:                       │
│         {                                                              │
│           "success": true,                                            │
│           "access_token": "eyJhbGciOi...",                          │
│           "refresh_token": "aB7xK3mN9pQ...",                        │
│           "token_type": "Bearer",                                     │
│           "expires_in": 3600,                                         │
│           "id_token": "eyJhbGciOi..."                               │
│         }                                                              │
│          │                                                            │
│          ▼                                                            │
│      Copilot Studio                                                   │
│          │                                                            │
│          └─ "User is now authenticated! I have tokens!"              │
│             Stores tokens securely                                   │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Using the Tokens                                               │
│                                                                        │
│  Copilot Studio (wants to know about user)                            │
│      │                                                                │
│      └─ Calls your MCP Server:                                       │
│         POST /mcp/execute                                            │
│         {                                                              │
│           "tool_name": "get_user_info",                              │
│           "arguments": {                                              │
│             "access_token": "eyJhbGciOi..."                         │
│           }                                                            │
│         }                                                              │
│          │                                                            │
│          ▼                                                            │
│      Your MCP Server                                                  │
│      │                                                                │
│      └─ Calls PingFederate Client:                                   │
│         "Get me info about this access token"                         │
│          │                                                            │
│          ▼                                                            │
│      PingFederate Client                                             │
│      │                                                                │
│      ├─ Sends request to PingFederate userinfo endpoint               │
│      │  Headers: Authorization: Bearer <access_token>                │
│      │                                                                │
│      └─ To: https://pingfed.example.com/pf-ws/rest/oauth/userinfo   │
│          │                                                            │
│          ▼                                                            │
│      PingFederate (Backend)                                          │
│      │                                                                │
│      ├─ Validates access_token is real                               │
│      ├─ Checks it hasn't expired                                      │
│      ├─ Checks it has userinfo scope permission                      │
│      │                                                                │
│      └─ Returns user information:                                     │
│         {                                                              │
│           "sub": "user_12345",                                        │
│           "name": "John Doe",                                         │
│           "given_name": "John",                                       │
│           "family_name": "Doe",                                       │
│           "email": "john.doe@example.com",                           │
│           "email_verified": true,                                     │
│           "picture": "https://..."                                    │
│         }                                                              │
│          │                                                            │
│          ▼                                                            │
│      Your MCP Server                                                  │
│      │                                                                │
│      └─ Returns to Copilot Studio:                                   │
│         {                                                              │
│           "success": true,                                            │
│           "user_info": { user data }                                  │
│         }                                                              │
│          │                                                            │
│          ▼                                                            │
│      Copilot Studio                                                   │
│      │                                                                │
│      └─ "Great! I know who this user is!"                           │
│         • Name: John Doe                                             │
│         • Email: john.doe@example.com                                │
└────────────────────────────────────────────────────────────────────────┘

END: User is fully authenticated and Copilot Studio has their info!
```

---

## Token Lifecycle Diagram

```
                           🎟️ ACCESS TOKEN LIFECYCLE

TIME: T=0 (when token is created)
┌─────────────────────────────────────────────────┐
│  Token Created & Returned                       │
│  • expires_in: 3600 (seconds)                  │
│  • Will expire at: T=3600 (1 hour from now)    │
│  • Status: ✅ VALID - Can use immediately      │
│  • Cached by: Your MCP Server                  │
└─────────────────────────────────────────────────┘


TIME: T=30 minutes
┌─────────────────────────────────────────────────┐
│  Token Still Valid                              │
│  • Status: ✅ STILL VALID                       │
│  • Time until expiration: 30 minutes            │
│  • Can still use this token                     │
│  • If cached, no need to call PingFederate     │
└─────────────────────────────────────────────────┘


TIME: T=3300 (5 minutes before expiration)
┌─────────────────────────────────────────────────┐
│  Token Getting Close to Expiration              │
│  • Status: ⚠️  WARNING - Soon to expire         │
│  • Time until expiration: 5 minutes             │
│  • Your server's automatic refresh kicks in:    │
│    "This token is about to expire"              │
│    "Let me get a new one using refresh_token"   │
│  • Uses refresh_token to get NEW access_token   │
│  • New token valid for another 1 hour           │
└─────────────────────────────────────────────────┘


TIME: T=3599 (1 second before expiration)
┌─────────────────────────────────────────────────┐
│  Token Almost Expired (if no refresh happened)  │
│  • Status: ❌ ABOUT TO EXPIRE                   │
│  • Time until expiration: 1 second              │
│  • IF you try to use this token:                │
│    PingFederate: "This token expired!"          │
│    Your server: "Need to refresh"               │
└─────────────────────────────────────────────────┘


TIME: T=3601 (1 second after expiration)
┌─────────────────────────────────────────────────┐
│  Token Has Expired                              │
│  • Status: ❌ EXPIRED - Cannot use              │
│  • Time since expiration: 1 second              │
│  • IF you try to use this token:                │
│    PingFederate: "Token is no longer valid"     │
│  • MUST use refresh_token to get new one        │
│  • Refresh token lasts 30 days (or more)        │
└─────────────────────────────────────────────────┘

                    🔄 REFRESH TOKEN LIFECYCLE

How Refresh Token Works:
│
├─ Initial auth creates: access_token (1 hour) + refresh_token (30 days)
│
├─ When access_token expires:
│  └─ Use refresh_token to get NEW access_token
│     "Here's my refresh_token, give me a new access_token"
│     PingFederate: "Valid! Here's a new access_token"
│
├─ When refresh_token expires:
│  └─ User must authenticate AGAIN (go through full login process)
│     Can't refresh anymore
│
└─ Security note:
   More sensitive than access_token!
   Should be stored securely
   Should be transmitted over HTTPS only
```

---

## Inside Your Server: Request Routing Diagram

```
HTTP REQUEST ARRIVES
        │
        ▼
    ┌────────────────────────────┐
    │  HTTP Server               │ (Express.js)
    │  Listens on :3000          │
    ├────────────────────────────┤
    │  • Receives request        │
    │  • Parses JSON body        │
    │  • Checks headers (CORS)   │
    └────────────────────────────┘
         │
         ├─ Route: GET /health?
         │  └─ Health Check Handler
         │     ├─ Returns: { status: "ok" }
         │     └─ Used for monitoring
         │
         ├─ Route: GET /mcp/tools?
         │  └─ List Tools Handler
         │     ├─ Gets list from AuthenticationTools
         │     ├─ Returns: All 8 available tools
         │     └─ Used by Copilot Studio to discover tools
         │
         ├─ Route: GET /mcp/info?
         │  └─ Server Info Handler
         │     ├─ Returns server version, endpoints
         │     └─ Used for documentation
         │
         ├─ Route: POST /mcp/execute ← MAIN ONE
         │  └─ Tool Execute Handler
         │     │
         │     ├─ Extract: tool_name, arguments
         │     │
         │     ├─ Validation
         │     │  ├─ "Is tool_name provided?" ✓
         │     │  ├─ "Does tool exist?" ✓
         │     │  └─ "Are arguments valid format?" ✓
         │     │
         │     ├─ Route to correct tool:
         │     │  │
         │     │  ├─ tool_name = "generate_auth_url"
         │     │  │  └─ Call: generateAuthUrl(arguments)
         │     │  │
         │     │  ├─ tool_name = "exchange_authorization_code"
         │     │  │  └─ Call: exchangeCode(arguments)
         │     │  │
         │     │  ├─ tool_name = "get_user_info"
         │     │  │  └─ Call: getUserInfo(arguments)
         │     │  │
         │     │  ├─ tool_name = "refresh_access_token"
         │     │  │  └─ Call: refreshToken(arguments)
         │     │  │
         │     │  └─ ... (other 4 tools)
         │     │
         │     ├─ Each tool calls PingFederate Client
         │     │  └─ Wait for response
         │     │
         │     ├─ Format response as JSON
         │     │  {
         │     │    "success": true/false,
         │     │    "result": { data or error }
         │     │  }
         │     │
         │     └─ Send HTTP response back to Copilot Studio
         │
         └─ Route: * (catch-all for unknown routes)
            └─ 404 Handler
               └─ Returns: "Endpoint not found"


INSIDE EACH TOOL HANDLER:

Tool Handler receives: { scope: "openid profile email" }
        │
        ▼
    ┌────────────────────────────────────────────┐
    │ Validation Layer                           │
    ├────────────────────────────────────────────┤
    │ • Check input format                       │
    │ • Check required fields                    │
    │ • Check data types                         │
    │ • Return error if invalid ❌              │
    └────────────────────────────────────────────┘
         │ ✓ If valid
         ▼
    ┌────────────────────────────────────────────┐
    │ Call PingFederate Client Method            │
    ├────────────────────────────────────────────┤
    │ Example: pingfedClient.generateAuthUrl()   │
    │                                             │
    │ Inside PingFederate Client:                │
    │ • Generate random state                    │
    │ • Generate random nonce                    │
    │ • Build URL with OAuth parameters          │
    │ • Store state/nonce in memory              │
    │ └─ Return: { url, state, nonce }          │
    └────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │ Format Response                            │
    ├────────────────────────────────────────────┤
    │ {                                           │
    │   "success": true,                         │
    │   "authorization_url": "https://...",      │
    │   "message": "User-friendly message"       │
    │ }                                           │
    └────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │ Return JSON Response                       │
    ├────────────────────────────────────────────┤
    │ HTTP 200 OK                                │
    │ Content-Type: application/json             │
    │ CORS Headers: ✓                            │
    │                                             │
    │ Body: { success: true, ... }              │
    └────────────────────────────────────────────┘
```

---

## Security Flow: State Parameter Validation

```
ATTACK SCENARIO: Hacker tries to forge authentication

Normal Flow (SECURE):
┌──────────────────────────────────────────────────────────────┐
│ Your Server generates login URL                              │
│ • Generates random state: "xY9kL2oPqRsT"                    │
│ • Creates nonce: "aB3cD4eF5gH6i"                            │
│ • Stores IN MEMORY: {                                        │
│     state: "xY9kL2oPqRsT",                                  │
│     nonce: "aB3cD4eF5gH6i",                                 │
│     createdAt: 1234567890                                   │
│   }                                                           │
│ • Returns URL to Copilot Studio                              │
│   https://pingfed/...&state=xY9kL2oPqRsT&nonce=aB3cD4eF5gH6i│
└──────────────────────────────────────────────────────────────┘

Legitimate User:
│ ├─ Clicks URL
│ ├─ Logs in at PingFederate
│ └─ Returns with: code + state="xY9kL2oPqRsT"
│
Your Server validates:
│ ├─ "Is state in my memory?" YES ✓
│ ├─ "Is it the exact same value?" YES ✓
│ ├─ "Has it expired (older than 5 min)?" NO ✓
│ └─ ✓ ACCEPTED - Exchange code for tokens


HACKER ATTACK SCENARIO:

Hacker tries to forge (fake) state:
│ ├─ Creates their own request
│ ├─ Sends different state: "HACKER1234567890"
│ └─ Returns with: code + state="HACKER1234567890"
│
Your Server validates:
│ ├─ "Is state in my memory?" NO ❌
│ ├─ REJECTED - State not found!
│ └─ Returns error to hacker


Hacker intercepts real request:
│ ├─ Steals the state: "xY9kL2oPqRsT"
│ ├─ Tries to replay it later
│ └─ Sends: code + state="xY9kL2oPqRsT"
│
Your Server validates:
│ ├─ "Is state in my memory?" NO ❌
│  (because we deleted it the first time)
│ ├─ REJECTED - State already used!
│ └─ Returns error to hacker


Hacker uses old/expired state:
│ ├─ Waits 10 minutes
│ ├─ Tries to send: code + state="xY9kL2oPqRsT"
│ └─ (from earlier attempt)
│
Your Server validates:
│ ├─ "Is state in my memory?" YES
│ ├─ "Has it expired (older than 5 min)?" YES ❌
│ ├─ REJECTED - State expired!
│ └─ Returns error to hacker

RESULT: HACKER BLOCKED EVERY TIME! ✓
```

---

## Data Types Flowing Through System

```
┌─────────────────────────────────────────────────┐
│  INPUT FROM COPILOT STUDIO                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  POST /mcp/execute                             │
│  Content-Type: application/json                │
│                                                 │
│  {                                              │
│    "tool_name": "generate_auth_url",           │
│    "arguments": {                               │
│      "scope": "openid profile email"            │
│    }                                             │
│  }                                              │
│                                                 │
└─────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────┐
│  PROCESSING BY YOUR SERVER                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Converts JSON to JavaScript object             │
│  Validates arguments                            │
│  Calls tool handler                             │
│  Tool handler calls PingFederate Client         │
│  Receives data from PingFederate                │
│  Formats response                               │
│                                                 │
└─────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│  RESPONSE TO COPILOT STUDIO                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Response:                                                 │
│  Status: 200 OK                                                 │
│  Content-Type: application/json                                 │
│                                                                 │
│  {                                                               │
│    "success": true,                                              │
│    "tool_name": "generate_auth_url",                            │
│    "result": {                                                   │
│      "success": true,                                            │
│      "authorization_url": "https://pingfed.example.com:9031/as/│
│        authorization.oauth2?client_id=mcp&response_type=code&   │
│        redirect_uri=http://localhost:3000/callback&             │
│        scope=openid%20profile%20email&state=xY9kL2oPqRsT&       │
│        nonce=aB3cD4eF5gH6i",                                   │
│      "message": "Authorization URL generated...."               │
│    }                                                              │
│  }                                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## When Things Go Wrong: Error Handling

```
ERROR SCENARIOS:

Scenario 1: PingFederate is offline
────────────────────────────────────
Your Server tries to call PingFederate
         │
         └─ TIMEOUT or CONNECTION ERROR
            │
            ▼
Your Server catches error
         │
         ├─ Logs error internally
         ├─ Formats user-friendly message
         │
         └─ Returns to Copilot Studio:
            {
              "success": false,
              "error": "Unable to connect to PingFederate. Please try again."
            }
            │
            ▼
Copilot Studio shows user friendly error


Scenario 2: Invalid authentication code
──────────────────────────────────────────
User was intercepted or code was fake
         │
         ▼
Your Server sends code to PingFederate
         │
         ▼
PingFederate responds:
{
  "error": "invalid_grant",
  "error_description": "Authorization code not found or invalid"
}
         │
         ▼
Your Server catches error
         │
         └─ Returns to Copilot Studio:
            {
              "success": false,
              "error": "Failed to exchange code for token: invalid_grant"
            }


Scenario 3: Token expired while being used
──────────────────────────────────────────────
Copilot Studio tries to call userinfo with old token
         │
         ▼
Your Server sends token to PingFederate
         │
         ▼
PingFederate validates token
         │
         └─ "Token expired!" 
            error: "token_expired"
            │
            ▼
Your Server catches error
         │
         └─ Attempts to refresh using refresh_token
            ├─ "I have refresh_token, let me get new access_token"
            ├─ Gets new access_token from PingFederate
            ├─ Retries original request with new token
            │
            └─ If refresh succeeds:
               Returns fresh data to Copilot Studio (user doesn't notice)
               
            └─ If refresh fails:
               Returns error asking user to re-authenticate


Scenario 4: Missing required parameter
──────────────────────────────────────────
Copilot Studio forgets to send "access_token"
         │
         POST /mcp/execute
         {
           "tool_name": "get_user_info",
           "arguments": {}  ← Missing access_token!
         }
         │
         ▼
Your Server validates arguments
         │
         └─ "Is access_token provided?" NO ❌
            │
            ▼
            Returns immediately:
            {
              "success": false,
              "error": "Missing required field: access_token"
            }
            
            (Doesn't even bother calling PingFederate)
```

This visual guide should help clarify how everything connects and works! 🎨
