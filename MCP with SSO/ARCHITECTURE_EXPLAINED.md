# 🏗️ Architecture Guide - Simple Explanation

## Overview: What is This System Doing?

Think of this MCP server as a **bridge or translator** that helps Microsoft Copilot Studio talk to PingFederate (an authentication service). It's like having a translator at a meeting who helps two people who don't speak the same language communicate.

---

## 🎯 The Three Main Players

### 1. **Microsoft Copilot Studio** (The Client)
- What it is: An AI assistant application
- What it wants: To authenticate users securely
- How it talks: Sends HTTP requests (like making a phone call)

### 2. **Your MCP Server** (The Bridge/Translator)
- What it is: A Node.js application that speaks both languages
- What it does: Listens to Copilot Studio and translates its requests to PingFederate
- How it works: Runs on http://localhost:3000

### 3. **PingFederate** (The Authentication Boss)
- What it is: A service that manages user logins and tokens
- What it does: Verifies who users are and gives them access tokens
- How it talks: Uses OAuth 2.0 and OIDC protocols

---

## 🔄 How They Work Together

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Copilot Studio                                             │
│  (Needs to log in a user)                                  │
│                                                              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                    Makes HTTP Request
                    (e.g., "Generate login URL")
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  YOUR MCP SERVER                                            │
│  • Listens for requests                                     │
│  • Processes data                                           │
│  • Communicates with PingFederate                           │
│  • Sends response back to Copilot Studio                    │
│                                                              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                    Sends OAuth Request
                    (e.g., "Create authorization URL")
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  PingFederate                                               │
│  (Authentication Service)                                  │
│  • Validates requests                                       │
│  • Handles user login                                       │
│  • Issues access tokens                                     │
│  • Grants permissions                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📚 Four Main Components Inside Your Server

### **Component 1: HTTP Server (server.ts)**

**What it does:** Acts like a receptionist
- Listens for incoming requests on port 3000
- Routes requests to the right handler
- Sends responses back

**Like a restaurant:** 
- Receptionist takes your order (HTTP request)
- Passes it to the kitchen (processes it)
- Brings back your food (HTTP response)

```
User Request:
POST /mcp/execute
{
  "tool_name": "generate_auth_url",
  "arguments": { "scope": "openid profile email" }
}
         │
         ▼
HTTP Server receives it
         │
         ▼
Routes to correct Tool Handler
         │
         ▼
Returns Response with data
```

---

### **Component 2: PingFederate Client (pingfederate.ts)**

**What it does:** Acts like a phone operator calling PingFederate

**Main responsibilities:**
1. **Creates authorization URLs** - "Let me call PingFederate and ask for a login URL"
2. **Exchanges codes for tokens** - "User logged in, now get me the access token"
3. **Refreshes tokens** - "This token is expiring, get me a new one"
4. **Gets user info** - "Tell me who this user is"
5. **Revokes tokens** - "Log this user out"

**Like a phone call to a bank:**
- You ask for something (token)
- They verify it's valid
- They give you what you asked for (access token)
- They might ask for verification (state parameter for security)

---

### **Component 3: Authentication Tools (tools.ts)**

**What it does:** Acts like a menu of services

Think of it like an ATM machine - it has multiple buttons:
- Button 1: Generate Login URL
- Button 2: Check User Status
- Button 3: Refresh Authorization
- Button 4: Logout User
- etc.

**Each tool is a separate function that:**
1. Takes input from Copilot Studio
2. Validates the input (is it correct?)
3. Calls PingFederate Client to do the work
4. Returns formatted result back

```
Tool Request
   │
   ├─→ Validate Input
   │      └─→ Is it correct format? ✓
   │
   ├─→ Call PingFederate Client
   │      └─→ Does PingFederate work?
   │
   ├─→ Format Response
   │      └─→ Make it pretty JSON
   │
   └─→ Return to Caller
```

---

### **Component 4: Configuration (.env file)**

**What it does:** Stores the "address book"

Just like your phone needs to know your carrier details, your MCP server needs to know:
- Where PingFederate is (PING_BASE_URL)
- Who you are (PING_CLIENT_ID, PING_CLIENT_SECRET)
- Where to send callbacks (PING_REDIRECT_URI)
- Which endpoints to use (PING_TOKEN_ENDPOINT, etc.)

```
.env = Settings file
│
├─ PING_BASE_URL → Where to find PingFederate
├─ PING_CLIENT_ID → "Username" for your server
├─ PING_CLIENT_SECRET → "Password" for your server
├─ HTTP_PORT → Port number (3000)
└─ HTTP_HOST → Which computer to listen on
```

---

## 👤 User Authentication Flow - Step by Step

Let's walk through what happens when a user logs in:

### **Step 1: Start Login Process**

```
Copilot Studio: "I need to log in a user!"
                     │
                     ▼
Your MCP Server: "I'll help! Let me get a login URL from PingFederate"
                     │
                     ▼
PingFederate: "Here's a login URL! Send this to the user"
                     │
                     ▼
Your MCP Server: "Got it! Here's the URL for you"
                     │
                     ▼
Copilot Studio: "Great! Sending this to the user"
```

### **Step 2: User Logs In**

```
User: "Let me click that login URL"
       │
       ▼
User's Browser: Opens the URL at PingFederate
                │
                ▼
PingFederate: "Who are you? Give me username/password"
             │
             ▼
User: Types in their credentials
      │
      ▼
PingFederate: "Verified! You are who you say you are!"
             │
             ▼
PingFederate gives Browser: Special code + redirect
                            │
                            ▼
Browser: Redirects back to MCP Server with the code
```

### **Step 3: Exchange Code for Access Token**

```
Copilot Studio: "I got a code! What do I do with it?"
                     │
                     ▼
Your MCP Server: "Let me trade that code for a real token"
                     │
                     ▼
PingFederate: "Code is valid. Here's your access token!"
             │
             ▼
Your MCP Server: "Perfect! Here are the tokens"
                     │
                     ▼
Copilot Studio: "Great! User is now logged in"
```

### **Step 4: Using the Access Token**

```
Copilot Studio: "Now I want to know who this user is"
                     │
                     ▼
Your MCP Server: "I'll ask PingFederate using the access token"
                     │
                     ▼
PingFederate: "Here's the user info!"
             Name: John Doe
             Email: john@example.com
             ID: 12345
                     │
                     ▼
Your MCP Server: "Here's the user info"
                     │
                     ▼
Copilot Studio: "Perfect! I know who the user is"
```

---

## 🔐 Security Concepts - Made Simple

### **1. State Parameter (CSRF Protection)**

**Problem:** Hackers might trick your system
**Solution:** Use a secret code that only your system knows

```
Your Server to User: "Here's a unique security code: ABC123"
                           │
                           ▼
User logs in at PingFederate
                           │
                           ▼
PingFederate returns: "Code + ABC123"
                           │
                           ▼
Your Server checks: "Is ABC123 correct?"
                    YES ✓ → Trust it
                    NO ✗ → Reject it (hacker!)
```

### **2. Nonce Parameter (OIDC Security)**

Similar to state, but specifically for OpenID Connect to prevent replay attacks.

### **3. Token Expiration**

Access tokens don't last forever (like a parking ticket):
- Valid for: 1 hour (3600 seconds)
- After that: Can't use it anymore
- Solution: Use refresh token to get a new one

### **4. Refresh Token**

It's like a "ticket to get more tickets":
- Doesn't expire (or expires much later)
- Used to get new access tokens
- More secure to store than access tokens

```
Old Token: "I'm expired, can't use me"
        │
        ▼
Refresh Token: "Here, use me to get a new access token"
        │
        ▼
PingFederate: "Valid refresh token! Here's new access token"
        │
        ▼
New Token: "I'm fresh and valid!"
```

---

## 📊 Data Flow Diagram

### **What Goes Where:**

```
INPUT (From Copilot Studio)
├─ tool_name: "generate_auth_url"
├─ arguments: { "scope": "openid profile email" }
│
▼
HTTP Server (server.ts)
├─ Receives request
├─ Routes to correct tool handler
│
▼
Authentication Tools (tools.ts)
├─ Finds the tool function
├─ Validates arguments
├─ Calls PingFederate Client
│
▼
PingFederate Client (pingfederate.ts)
├─ Formats request for PingFederate
├─ Adds security parameters (state, nonce)
├─ Sends HTTP request to PingFederate
│
▼
PingFederate
├─ Processes request
├─ Returns data/URL/tokens
│
▼
PingFederate Client
├─ Validates response
├─ Stores tokens in cache
├─ Returns to caller
│
▼
Authentication Tools
├─ Formats JSON response
├─ Adds success/error info
├─ Returns to HTTP server
│
▼
HTTP Server
├─ Creates HTTP response
├─ Sets headers (Content-Type, CORS)
│
▼
OUTPUT (To Copilot Studio)
└─ JSON response with success status and data
```

---

## 🎭 Real World Analogy

### **Think of it like going to an embassy:**

1. **You (Copilot Studio):** Need a visa (to authenticate users)

2. **Your Guide (MCP Server):** 
   - Knows the visa process
   - Speaks the embassy's language
   - Fills out forms correctly
   - Translates documents

3. **Embassy (PingFederate):**
   - Verifies your identity
   - Issues official documents (tokens)
   - Complex bureaucratic process
   - Multiple security steps

4. **Process:**
   - You ask your guide: "Get me a visa"
   - Guide calls embassy: "I have a client who needs a visa"
   - Embassy verifies: "Is this person legitimate?"
   - Embassy gives your guide official documents
   - Your guide brings documents to you
   - You now have access to the country (authenticated user)

---

## 🔧 How Your Server Fits Into Copilot Studio's Workflow

### **Copilot Studio sees your server as:**

A **tool provider** - like a plugin or extension

```
Copilot Studio's Mind:
"I need to authenticate users. Let me check my available tools..."
        │
        ▼
"I have MCP Server at http://localhost:3000"
        │
        ▼
"Let me ask it for available tools..."
        │
        ▼
GET /mcp/tools
        │
        ▼
"Great! I can use these 8 tools:
 1. generate_auth_url
 2. exchange_authorization_code
 3. get_user_info
 ... etc"
        │
        ▼
"When user needs login, I'll call these tools"
```

---

## 🌊 Data Types Flowing Through System

### **Authorization URL Request:**
```
Input: scope scopes (permissions to request)
Output: URL for user to login
```

### **Token Response:**
```
Input: authorization code + state
Output: {
  access_token: "abc123...",    ← Use this for API calls
  refresh_token: "xyz789...",    ← Use this to get new access_token
  id_token: "oidc_token...",     ← Contains user info
  expires_in: 3600               ← Expires in 1 hour
}
```

### **User Info Response:**
```
Input: access_token
Output: {
  sub: "user_123",           ← Unique user ID
  email: "user@example.com",
  name: "John Doe",
  given_name: "John",
  family_name: "Doe"
}
```

---

## 💾 Token Cache - Why It Matters

Your server has a **memory** (cache) that remembers tokens:

```
First Request:
"Give me a token for John"
    │
    ▼
Check Memory (cache): "Don't have it"
    │
    ▼
Call PingFederate: "Give me a token for John"
    │
    ▼
Store in Memory: "John's token = xyz123"
    │
    ▼
Return token

Second Request (within 1 hour):
"Give me a token for John"
    │
    ▼
Check Memory (cache): "I have it! xyz123"
    │
    ▼
Return immediately (FASTER! No need to bother PingFederate)

Third Request (1 hour later):
"Give me a token for John"
    │
    ▼
Check Memory: "Token expired"
    │
    ▼
Call PingFederate: "Refresh the token"
    │
    ▼
Store new token in memory
    │
    ▼
Return new token
```

---

## 🚀 Startup Sequence

When you run `npm start`:

```
1. JavaScript interpreter loads
        │
        ▼
2. Express.js HTTP server starts
        │
        ▼
3. Reads .env file (configuration)
        │
        ▼
4. Creates PingFederate Client
   (connects settings to PingFederate location)
        │
        ▼
5. Creates Authentication Tools
   (prepares the 8 available tools)
        │
        ▼
6. Server starts listening on port 3000
        │
        ▼
7. Ready! Waiting for Copilot Studio to call
        │
        ▼
Copilot Studio connects and starts making requests
```

---

## 📈 Architecture Summary

```
LAYERS:

┌─────────────────────────────────────────────┐
│  Copilot Studio (Client)                    │
│  Makes HTTP requests                        │
└──────────────────┬──────────────────────────┘
                   │
                   │ HTTP/REST
                   │
┌──────────────────▼──────────────────────────┐
│  Express.js HTTP Server (Request Handler)   │
│  - Routes requests to tools                 │
│  - CORS support                             │
│  - JSON parsing                             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Authentication Tools (Tool Handlers)       │
│  - Validate inputs                          │
│  - Call PingFederate Client                 │
│  - Format responses                         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  PingFederate Client (Service Layer)        │
│  - OAuth 2.0 operations                     │
│  - OIDC operations                          │
│  - Token management                         │
│  - State/nonce validation                   │
│  - Token caching                            │
└──────────────────┬──────────────────────────┘
                   │
                   │ HTTPS
                   │
┌──────────────────▼──────────────────────────┐
│  PingFederate (External Service)            │
│  - User authentication                      │
│  - Token issuance                           │
│  - OAuth/OIDC protocol                      │
└─────────────────────────────────────────────┘
```

---

## ✅ Key Takeaways

1. **Your server is a bridge** between Copilot Studio and PingFederate
2. **HTTP API** makes it easy to integrate (no special protocols needed)
3. **8 Tools** handle different authentication tasks
4. **Security first** with state validation, token expiration, and caching
5. **Token management** handles the complexity of OAuth 2.0/OIDC
6. **Stateless design** means you can run multiple copies if needed
7. **Configuration-based** so it works with different PingFederate instances

---

## 🤔 FAQ - Layman's Terms

**Q: Why do we need this server? Why not just connect Copilot Studio directly to PingFederate?**
A: PingFederate and Copilot Studio speak different "languages". This server translates between them.

**Q: What does "OAuth 2.0" mean?**
A: It's a set of rules for securely proving who you are (like a passport).

**Q: What's the difference between access_token and refresh_token?**
A: Access token = your ticket to use services (expires quickly)
   Refresh token = your coupon to get more tickets (lasts longer)

**Q: Why do we need state and nonce parameters?**
A: They're security codes that prevent hackers from faking requests.

**Q: What if someone tries to hack our server?**
A: We validate state, check tokens, enforce expiration, and use HTTPS. Many layers of protection.

**Q: Can Copilot Studio make all 8 tools available to users?**
A: Yes! Copilot Studio gets the list of tools and can create buttons/commands for each one.

**Q: What happens if PingFederate is down?**
A: Your server returns an error to Copilot Studio, which tells the user that authentication isn't available right now.

---

This server is basically a **smart middle person** that understands both parties and helps them communicate securely! 🤝
