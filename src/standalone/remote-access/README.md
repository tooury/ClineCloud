# Cline Remote Access System

WebSocket-based remote access to Cline extension functionality, allowing web clients to interact with the Cline agent from anywhere.

## Architecture

```
┌─────────────────┐    WebSocket     ┌──────────────────┐    gRPC      ┌─────────────────┐
│   Web Client    │◄────────────────►│ RemoteAccess     │◄────────────►│ Cline Controller│
│   (Browser)     │   ws://:.../ws   │ Server           │  Internal    │ & Core          │
└─────────────────┘                  └──────────────────┘              └─────────────────┘
                                            │
                                            ├─► SessionManager (user sessions)
                                            ├─► AuthMiddleware (JWT tokens)
                                            └─► WebSocketBridge (WS ↔ gRPC)
```

## Components

### RemoteAccessServer
Main server handling WebSocket and HTTP connections.

**Features:**
- WebSocket server on configurable port (default: 48812)
- HTTP endpoints for health checks and status
- Connection lifecycle management
- Automatic ping/pong keepalive
- Connection limit enforcement

**Endpoints:**
- `ws://localhost:48812/ws` - WebSocket endpoint
- `GET /health` - Health check
- `GET /status` - Server status
- `GET /auth-status` - Validate JWT token
- `POST /generate-token` - Generate test token (dev only)

### WebSocketBridge
Translates between WebSocket messages and gRPC protocol.

**Message Types:**
- `auth` - Authenticate with JWT token
- `grpc_request` - Forward gRPC request
- `grpc_request_cancel` - Cancel pending request
- `ping` - Keepalive ping

**Response Types:**
- `auth_success` - Authentication succeeded
- `auth_error` - Authentication failed
- `grpc_response` - gRPC response
- `error` - Error message
- `pong` - Ping response

### SessionManager
Manages user sessions and connection lifecycle.

**Features:**
- Multi-user session support
- Automatic session timeout (configurable, default: 30 minutes)
- Pending request tracking
- Session activity monitoring
- Automatic cleanup of expired sessions

### AuthMiddleware
JWT-based authentication and token management.

**Features:**
- Token generation with configurable expiration
- Token validation and verification
- Token refresh mechanism
- Secure token storage and transmission

## Usage

### Starting the Server

**Basic:**
```bash
node dist/standalone/cline-core.js
```

**With Configuration:**
```bash
# Custom port
REMOTE_ACCESS_PORT=9000 node dist/standalone/cline-core.js

# Custom JWT secret
JWT_SECRET=my-secret-key node dist/standalone/cline-core.js

# Production mode (disables CORS wildcard)
NODE_ENV=production node dist/standalone/cline-core.js
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REMOTE_ACCESS_PORT` | WebSocket server port | `48812` |
| `JWT_SECRET` | Secret key for JWT signing | Auto-generated (dev only) |
| `NODE_ENV` | Environment (affects CORS) | `development` |

## WebSocket Protocol

### Connection Flow

1. **Connect** to `ws://localhost:48812/ws`
2. **Authenticate** by sending auth message with JWT token
3. **Send requests** after authentication succeeds
4. **Receive responses** for your requests
5. **Close** connection gracefully when done

### Message Format

All messages are JSON-encoded.

**Client → Server:**
```javascript
// Authentication
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// gRPC Request
{
  "type": "grpc_request",
  "grpc_request": {
    "service": "cline.StateService",
    "method": "getLatestState",
    "message": {},
    "request_id": "unique-request-id",
    "is_streaming": false
  }
}

// Ping
{
  "type": "ping"
}
```

**Server → Client:**
```javascript
// Auth Success
{
  "type": "auth_success",
  "sessionId": "session-id",
  "message": "Authentication successful"
}

// gRPC Response
{
  "type": "grpc_response",
  "grpc_response": {
    "message": { ... },
    "request_id": "unique-request-id"
  }
}

// Error
{
  "type": "error",
  "error": "Error message"
}
```

## Example Client

### JavaScript/Node.js

```javascript
const WebSocket = require('ws');

// Generate token (dev only)
const token = await fetch('http://localhost:48812/generate-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'my-user-id' })
}).then(r => r.json()).then(d => d.token);

// Connect
const ws = new WebSocket('ws://localhost:48812/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: token
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'auth_success') {
    console.log('Authenticated!', message.sessionId);

    // Send a request
    ws.send(JSON.stringify({
      type: 'grpc_request',
      grpc_request: {
        service: 'cline.StateService',
        method: 'getLatestState',
        message: {},
        request_id: 'test-' + Date.now(),
        is_streaming: false
      }
    }));
  } else if (message.type === 'grpc_response') {
    console.log('Response:', message.grpc_response);
    ws.close();
  }
});
```

### Browser

```javascript
// In browser console or app
const token = 'your-jwt-token-here';
const ws = new WebSocket('ws://localhost:48812/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Security

### Authentication

- JWT tokens required for all WebSocket connections
- Tokens expire after configurable period (default: 24 hours)
- Tokens can be refreshed before expiration
- Invalid/expired tokens are rejected immediately

### Session Management

- Sessions timeout after inactivity (default: 30 minutes)
- Maximum concurrent connections enforced (default: 100)
- Each session is isolated and secure

### Transport Security

- Use WSS (WebSocket Secure) in production
- Enable HTTPS for HTTP endpoints
- Set `NODE_ENV=production` to restrict CORS

### Best Practices

1. **Always use HTTPS/WSS in production**
2. **Set strong JWT_SECRET** (min 32 characters)
3. **Limit connection origins** via CORS configuration
4. **Monitor connection counts** via `/status` endpoint
5. **Use short token expiration** times in production
6. **Enable rate limiting** (Phase 3)
7. **Audit logs** for security events

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

**Quick Test:**
```bash
# Start server
node dist/standalone/cline-core.js

# Run test client
node src/standalone/remote-access/test-client.js
```

## Configuration

### Server Configuration

```typescript
const server = new RemoteAccessServer(controller, {
  port: 48812,                    // WebSocket port
  jwtSecret: 'your-secret',       // JWT signing key
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  requestTimeout: 30000,          // 30 seconds
  enableCors: true,               // Enable CORS
  corsOrigins: ['*'],             // Allowed origins
  maxConnections: 100             // Max concurrent connections
});
```

### JWT Token Configuration

```typescript
// Generate token with custom expiration
const token = authMiddleware.generateToken(
  'user-id',
  'session-id',
  'workspace-id',
  '7d' // Expires in 7 days
);
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to WebSocket

**Solutions:**
1. Verify server is running: `curl http://localhost:48812/health`
2. Check firewall allows port 48812
3. Verify WebSocket path is `/ws`

### Authentication Issues

**Problem:** "Invalid or expired token"

**Solutions:**
1. Generate new token via `/generate-token` (dev mode)
2. Verify JWT_SECRET matches server configuration
3. Check token hasn't expired

### Performance Issues

**Problem:** Slow response times

**Solutions:**
1. Check `/status` endpoint for connection count
2. Monitor server logs for errors
3. Verify network latency
4. Check ProtoBus gRPC service health

## Development

### Adding New Features

1. **New HTTP Endpoint:**
   - Add route in `RemoteAccessServer.createExpressApp()`

2. **New WebSocket Message Type:**
   - Add type to `WebSocketClientMessage` in `types.ts`
   - Add handler in `WebSocketBridge.handleMessage()`

3. **New gRPC Service:**
   - No changes needed! Uses existing ProtoBus handlers

### Code Structure

```
src/standalone/remote-access/
├── index.ts              # Public exports
├── types.ts              # TypeScript type definitions
├── RemoteAccessServer.ts # Main server
├── WebSocketBridge.ts    # WebSocket ↔ gRPC bridge
├── SessionManager.ts     # Session management
├── AuthMiddleware.ts     # JWT authentication
├── test-client.js        # Test client
├── TESTING.md            # Testing guide
└── README.md             # This file
```

## Roadmap

### Phase 1: Foundation ✅
- [x] WebSocket server
- [x] JWT authentication
- [x] gRPC request forwarding
- [x] Session management
- [x] HTTP status endpoints

### Phase 2: Web Client (Next)
- [ ] React web application
- [ ] Real-time chat interface
- [ ] Task progress visualization
- [ ] Mobile responsive design

### Phase 3: Enhanced Security
- [ ] Rate limiting
- [ ] IP allowlisting
- [ ] Multi-factor authentication
- [ ] Audit logging

### Phase 4: Production Ready
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment automation

## API Reference

### RemoteAccessServer

```typescript
class RemoteAccessServer {
  constructor(controller: Controller, config?: Partial<RemoteAccessConfig>)
  async start(): Promise<string>
  async stop(): Promise<void>
  getAuthMiddleware(): AuthMiddleware
  getSessionManager(): SessionManager
  getConfig(): RemoteAccessConfig
}
```

### AuthMiddleware

```typescript
class AuthMiddleware {
  constructor(jwtSecret: string)
  generateToken(userId: string, sessionId: string, workspaceId?: string, expiresIn?: string): string
  verifyToken(token: string): JWTPayload | null
  refreshToken(oldToken: string, expiresIn?: string): string | null
  decodeToken(token: string): JWTPayload | null
  isTokenExpired(token: string): boolean
  getTokenExpiration(token: string): Date | null
}
```

### SessionManager

```typescript
class SessionManager {
  constructor(sessionTimeout: number)
  createSession(sessionId: string, userId: string, ws: AuthenticatedWebSocket, workspaceId?: string): UserSession
  getSession(sessionId: string): UserSession | undefined
  getSessionByWebSocket(ws: AuthenticatedWebSocket): UserSession | undefined
  updateActivity(sessionId: string): void
  removeSession(sessionId: string): void
  getAllSessions(): UserSession[]
  getSessionCount(): number
  shutdown(): void
}
```

## License

Apache 2.0 © 2025 Cline Bot Inc.

## Contributing

See main [CONTRIBUTING.md](../../../CONTRIBUTING.md) for contribution guidelines.
