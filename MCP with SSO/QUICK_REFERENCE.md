# 🎓 Architecture Quick Reference - For Layman

## One Sentence Summary

**Your MCP Server is a translator that helps Copilot Studio talk to PingFederate using simple HTTP requests instead of complex OAuth protocols.**

---

## The Three Players & Their Roles

| Who | Does What | Language |
|-----|-----------|----------|
| **Copilot Studio** | Wants to authenticate users | Speaks HTTP/REST |
| **Your MCP Server** | Translates between two systems | Speaks HTTP AND OAuth 2.0 |
| **PingFederate** | Verifies who users are | Speaks OAuth 2.0/OIDC |

---

## What Happens in Simple Steps

### When a User Needs to Login:

1. **Copilot Studio** asks your server: "Give me a login URL"
2. **Your Server** asks PingFederate: "Generate a login URL"
3. **PingFederate** says: "Here's the URL"
4. **Your Server** tells Copilot Studio: "Send this URL to the user"
5. **User** clicks the URL and logs in at PingFederate
6. **PingFederate** redirects back with a temporary code
7. **Your Server** trades that code for real tokens (access_token, refresh_token)
8. **Copilot Studio** now has tokens to use on behalf of the user

---

## The 8 Tools Your Server Provides

Think of these as 8 buttons Copilot Studio can press:

```
┌─────────────────────────────────────────────────────┐
│  MCP Server Tools (8 Available)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1️⃣  Generate Login URL                           │
│      "Get me a login URL"                          │
│                                                     │
│  2️⃣  Exchange Authorization Code                   │
│      "User has a code, trade it for tokens"        │
│                                                     │
│  3️⃣  Get User Information                          │
│      "Tell me who this user is"                    │
│                                                     │
│  4️⃣  Refresh Access Token                          │
│      "This token is old, get me a new one"         │
│                                                     │
│  5️⃣  Get Valid Token (Auto-refresh)               │
│      "Give me a fresh token (get new one if needed)│
│                                                     │
│  6️⃣  Revoke Token / Logout                         │
│      "Invalidate this token, user is logging out"  │
│                                                     │
│  7️⃣  Decode ID Token                              │
│      "Extract the user claims from this token"     │
│                                                     │
│  8️⃣  Get Discovery Metadata                        │
│      "Tell me about your OAuth setup"              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Key Concepts Explained Simply

### **OAuth 2.0**
A set of rules for proving who you are securely, without sharing passwords.

**Without OAuth:**
- Copilot Studio asks: "What's your username and password?"
- You type it into Copilot Studio (DANGEROUS - it sees your password!)
- Copilot Studio stores your password (DANGEROUS - could be hacked!)

**With OAuth:**
- Copilot Studio says: "Go login at PingFederate"
- You login at PingFederate (Copilot Studio never sees your password!)
- PingFederate gives you a token (like a ticket)
- You give the ticket to Copilot Studio (not your password!)

### **OIDC (OpenID Connect)**
An add-on to OAuth 2.0 that also gives you user information (name, email, etc.)

**OAuth 2.0:** "Here's a ticket that proves you're authenticated"
**OIDC:** "Here's a ticket that proves you're authenticated AND here's your name/email"

### **Access Token**
Think of it like a **credit card**:
- Valid for limited time (1 hour)
- Used to make purchases (API calls)
- If stolen, hacker can use it (but only for 1 hour)
- You keep it with you for immediate use

**Example:** To get user info, you show the access token to PingFederate and they give you the data.

### **Refresh Token**
Think of it like a **checkbook**:
- Valid for long time (30 days)
- Used to get more credit cards (access tokens)
- If stolen, hacker can get unlimited credit cards (dangerous!)
- You keep it safely stored (not for immediate use)

**Example:** When access token expires, you use refresh token to get a new access token.

### **State Parameter**
Think of it like a **secret handshake**:
- You create a random code (state): "ABC123"
- You send it to PingFederate: "Remember this code?"
- User logs in
- PingFederate sends the code back: "The user logged in, here's your code back"
- You check: "Is this the same code I sent? YES ✓"
- You trust it because the code matches

**Why:** Prevents hackers from faking authentication messages.

### **Token Caching**
Think of it like **remembering you already did something**:

Without cache:
- Request 1: "Give me John's token" → Call PingFederate
- Request 2 (5 min later): "Give me John's token" → Call PingFederate again
- Request 3 (10 min later): "Give me John's token" → Call PingFederate again

With cache:
- Request 1: "Give me John's token" → Call PingFederate → Cache it
- Request 2 (5 min later): "Give me John's token" → Return from cache (faster!)
- Request 3 (10 min later): "Give me John's token" → Return from cache (faster!)

---

## How HTTP API Works

### Your Server Has 4 Main Endpoints:

```
GET /health
├─ Purpose: Is the server working?
├─ Response: { "status": "ok" }
└─ Use: Monitoring, health checks


GET /mcp/tools
├─ Purpose: What tools are available?
├─ Response: List of 8 tools with descriptions
└─ Use: Copilot Studio discovers what it can do


POST /mcp/execute
├─ Purpose: Execute a tool
├─ Send: { "tool_name": "...", "arguments": { ... } }
├─ Response: Tool result
└─ Use: Main endpoint for doing stuff (login, tokens, etc.)


GET /mcp/info
├─ Purpose: Tell me about yourself
├─ Response: Server version, endpoints, config
└─ Use: Getting general information
```

### Example API Call:

```
What you send to the server:

POST http://localhost:3000/mcp/execute
Content-Type: application/json

{
  "tool_name": "generate_auth_url",
  "arguments": {
    "scope": "openid profile email"
  }
}

What the server sends back:

{
  "success": true,
  "tool_name": "generate_auth_url",
  "result": {
    "success": true,
    "authorization_url": "https://pingfed.example.com:9031/as/authorization.oauth2?...",
    "message": "Authorization URL generated. Direct user to this URL to authenticate."
  }
}
```

---

## Security Summary

| What | How Protected | Why |
|------|---------------|-----|
| Fake requests | State parameter | Hacker can't forge authentication |
| Expired tokens | Token expiration + validation | Token can't be used forever |
| Stolen tokens | HTTPS only + short expiry | Hacker has limited time to use it |
| Lost refresh token | Secure storage needed | Need to get user to login again |
| User passwords | Never stored by your server | PingFederate keeps passwords, not you |

---

## File Structure & What Each Does

```
Your MCP Server Project

├─ server.ts
│  └─ The receptionist
│     • Listens on port 3000
│     • Routes requests to correct tool
│     • Sends responses back
│
├─ pingfederate.ts
│  └─ The phone operator
│     • Calls PingFederate
│     • Manages tokens
│     • Handles security (state, nonce)
│
├─ tools.ts
│  └─ The menu of services
│     • 8 different functions
│     • Each handles one task
│     • Validates input, calls pingfederate, formats output
│
├─ .env
│  └─ The contact information
│     • Where is PingFederate?
│     • What's your client ID?
│     • What's your client secret?
│     • Port number?
│
├─ package.json
│  └─ The shopping list
│     • What libraries do we need?
│     • Express.js for HTTP server
│     • Axios for making requests
│     • jsonwebtoken for token handling
│
└─ dist/
   └─ The compiled version
      • JavaScript (what actually runs)
      • Created by TypeScript compiler
      • Ready for production
```

---

## Common Questions & Answers

**Q: Why not just use PingFederate directly from Copilot Studio?**
A: They speak different languages. Your server is the translator so they can understand each other.

**Q: What's the difference between access_token and refresh_token?**
A: Access token = quick pass (1 hour). Refresh token = permission to get new passes (30 days).

**Q: What if someone steals a token?**
A: Access token expires in 1 hour anyway. Refresh token is more dangerous, so it must be stored securely.

**Q: Why do we need state and nonce?**
A: They're like security codes that only your server knows. Prevents hackers from faking login.

**Q: Can this run on my laptop?**
A: Yes! For testing. For production, run it on a server with HTTPS.

**Q: What happens if PingFederate is down?**
A: Your server returns an error to Copilot Studio. Users get a message "try again later".

**Q: Can Copilot Studio use these tools?**
A: Yes! It gets the list and can create buttons/commands for each tool.

**Q: Is my password stored anywhere?**
A: No! You only type your password at PingFederate. Your server never sees it.

**Q: What's HTTPS/TLS?**
A: Encrypted communication. In production, always use HTTPS so nobody can intercept data.

---

## Typical Daily Usage

### Normal User Journey:

```
Morning: User starts Copilot Studio
         ↓
User: "Authenticate me"
         ↓
Copilot: Calls your server: "Generate login URL"
         ↓
Your Server: Returns login URL from PingFederate
         ↓
User: Clicks URL, types credentials into PingFederate
         ↓
Copilot: Gets code back, exchanges it for tokens
         ↓
✓ User is logged in! Copilot has access_token + refresh_token
         ↓
Throughout Day: User uses Copilot
         ↓
Copilot uses access_token to prove user is authenticated
         ↓
After 1 hour: Access token expires
         ↓
Copilot: Automatically uses refresh_token to get new access_token
         ↓
✓ Seamless! User doesn't need to login again


Evening: User logs out
         ↓
User: "Logout"
         ↓
Copilot: Calls your server: "Revoke the tokens"
         ↓
Your Server: Tells PingFederate: "These tokens are no longer valid"
         ↓
✓ User is logged out. Tokens are useless now.
```

---

## Decision Tree: What Should Happen?

```
Scenario 1: New user wants to login
(Copilot calls tool: "generate_auth_url")
        ↓
Your server generates URL + secret state code
        ↓
Returns URL to Copilot
        ↓
Copilot sends user to that URL
        ↓
User logs in at PingFederate
        ↓
Returns to your server with code + state


Scenario 2: User got code from PingFederate
(Copilot calls tool: "exchange_authorization_code")
        ↓
Your server validates state (security check)
        ↓
Your server trades code for access_token + refresh_token
        ↓
Returns tokens to Copilot
        ↓
✓ User is authenticated!


Scenario 3: Copilot wants to know user's info
(Copilot calls tool: "get_user_info")
        ↓
Your server calls PingFederate with access_token
        ↓
PingFederate validates token + returns user info
        ↓
Returns info to Copilot
        ↓
✓ Copilot knows who the user is


Scenario 4: Access token is about to expire
(Copilot calls tool: "get_valid_token")
        ↓
Your server checks: Is token still valid?
       NO - too close to expiration
        ↓
Your server uses refresh_token to get new access_token
        ↓
Returns new token to Copilot
        ↓
✓ Seamless token refresh!


Scenario 5: User wants to logout
(Copilot calls tool: "revoke_token")
        ↓
Your server tells PingFederate to invalidate the token
        ↓
PingFederate marks token as revoked
        ↓
✓ User is logged out! Token is now useless.
```

---

## Production Checklist

Before going "live":

- [ ] Use HTTPS (not HTTP)
- [ ] Store secrets in a vault (not in .env on the server)
- [ ] Enable logging and monitoring
- [ ] Test all 8 tools with real PingFederate
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Test error scenarios (network down, etc.)
- [ ] Document your setup for the team
- [ ] Train users on how to use it
- [ ] Set up alerts for errors

---

## The Bottom Line

Your MCP server is like a **helpful restaurant manager** who:

1. **Listens** to what Copilot Studio needs (HTTP requests)
2. **Understands** what PingFederate can provide (OAuth 2.0)
3. **Translates** between them smoothly
4. **Remembers** important details (token caching)
5. **Protects** everyone with security checks (state validation)
6. **Handles** problems professionally (error handling)

Result: **Copilot Studio can authenticate users securely without understanding complex OAuth!** 🎉
