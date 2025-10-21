# Phase 1 Testing Guide - Remote Access Foundation

This guide provides comprehensive testing procedures for the Cline Remote Access System Phase 1 implementation.

## Prerequisites

1. **Build the Project**
   ```bash
   npm run compile-standalone
   ```

2. **Set Environment Variables** (Optional)
   ```bash
   export JWT_SECRET="your-secret-key-here"
   export REMOTE_ACCESS_PORT=48812
   export NODE_ENV=development
   ```

## Starting the Server

### Option 1: Standalone Mode (Recommended for Testing)
```bash
node dist/standalone/cline-core.js
```

### Option 2: With Custom Configuration
```bash
REMOTE_ACCESS_PORT=9000 JWT_SECRET=test-secret node dist/standalone/cline-core.js
```

### Expected Output
```
Starting cline-core service...

Starting Remote Access Server...

Remote Access HTTP server listening on port 48812
Remote Access WebSocket server listening at ws://127.0.0.1:48812/ws
Remote Access HTTP endpoints available at http://127.0.0.1:48812
Remote Access Server started: ws://127.0.0.1:48812/ws

ProtoBus gRPC server listening on 127.0.0.1:26040
✅ All services started successfully
```

## Test Suite

### Test 1: HTTP Health Check

**Endpoint:** `GET /health`

```bash
curl http://localhost:48812/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": 42,
  "connections": 0,
  "timestamp": "2025-10-21T02:00:00.000Z",
  "version": "1.0.0"
}
```

**Success Criteria:**
- ✅ Returns 200 status code
- ✅ `status` is "healthy"
- ✅ `uptime` is a positive number
- ✅ `connections` is 0 or more

---

### Test 2: HTTP Status Check

**Endpoint:** `GET /status`

```bash
curl http://localhost:48812/status
```

**Expected Response:**
```json
{
  "running": true,
  "port": 48812,
  "connections": 0,
  "activeSessions": 0,
  "uptime": 42,
  "protobusConnected": true
}
```

**Success Criteria:**
- ✅ Returns 200 status code
- ✅ `running` is true
- ✅ `port` matches configured port
- ✅ All numeric values are valid

---

### Test 3: Token Generation (Development Only)

**Endpoint:** `POST /generate-token`

```bash
curl -X POST http://localhost:48812/generate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "workspaceId": "test-workspace"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Criteria:**
- ✅ Returns 200 status code
- ✅ `token` is a valid JWT string
- ✅ Token can be decoded

**Note:** This endpoint is only available when `NODE_ENV !== "production"`

---

### Test 4: Auth Status Validation

**Endpoint:** `GET /auth-status`

First, generate a token (from Test 3), then:

```bash
TOKEN="your-token-here"
curl http://localhost:48812/auth-status \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "test-user",
  "sessionId": "...",
  "workspaceId": "test-workspace",
  "expiresAt": "2025-10-22T02:00:00.000Z"
}
```

**Success Criteria:**
- ✅ Returns 200 status code
- ✅ `valid` is true
- ✅ `userId` matches the token payload
- ✅ `expiresAt` is in the future

---

### Test 5: WebSocket Connection

**Using the Test Client:**

```bash
node src/standalone/remote-access/test-client.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║   Cline Remote Access Server - Test Client                    ║
╚════════════════════════════════════════════════════════════════╝

Target: ws://localhost:48812/ws

=== Testing HTTP Health Endpoint ===
✅ Health check response: { ... }

=== Testing HTTP Status Endpoint ===
✅ Status response: { ... }

=== Generating Test Token ===
✅ Token generated: eyJhbGciOiJIUzI1NiIsI...

=== Testing WebSocket Connection ===
✅ WebSocket connected

Test 1: Authenticating...
📨 Received: { "type": "auth_success", "sessionId": "..." }
✅ Test 1 PASSED: Authentication successful

Test 2: Testing ping/pong...
📨 Received: { "type": "pong" }
✅ Test 2 PASSED: Ping/pong successful

Test 3: Testing gRPC request forwarding...
📨 Received: { "type": "grpc_response", ... }
✅ Test 3 PASSED: gRPC request successful

Test 4: Testing graceful close...
✅ Test 4 PASSED: WebSocket closed gracefully

=== Test Summary ===
Tests passed: 4/4
✅ All tests PASSED!

✅ All tests completed successfully!
```

**Success Criteria:**
- ✅ WebSocket connection established
- ✅ Authentication successful
- ✅ Ping/pong works
- ✅ gRPC requests are forwarded
- ✅ Connection closes gracefully

---

### Test 6: WebSocket Manual Testing

**Using `websocat` (if available):**

```bash
# Install websocat: https://github.com/vi/websocat
# Or use any WebSocket client

# 1. Generate a token first
TOKEN=$(curl -s -X POST http://localhost:48812/generate-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "manual-test"}' | jq -r '.token')

# 2. Connect to WebSocket
websocat ws://localhost:48812/ws

# 3. Send authentication message
{"type":"auth","token":"YOUR_TOKEN_HERE"}

# Expected: {"type":"auth_success","sessionId":"...","message":"Authentication successful"}

# 4. Send ping
{"type":"ping"}

# Expected: {"type":"pong"}

# 5. Send gRPC request
{"type":"grpc_request","grpc_request":{"service":"cline.StateService","method":"getLatestState","message":{},"request_id":"test-123","is_streaming":false}}

# Expected: {"type":"grpc_response","grpc_response":{...}}
```

---

### Test 7: Session Management

**Test Session Timeout:**

1. Connect with a valid token
2. Wait for session timeout period (default: 30 minutes)
3. Verify session is cleaned up

**Test Multiple Sessions:**

1. Open multiple WebSocket connections with different tokens
2. Verify each gets a unique session
3. Check `/status` endpoint shows correct connection count
4. Close connections and verify cleanup

---

### Test 8: Error Handling

**Invalid Token:**
```javascript
// Connect and send invalid auth
{"type":"auth","token":"invalid-token"}
// Expected: {"type":"auth_error","error":"Invalid or expired token"}
// Connection should close after 1 second
```

**Unauthenticated Request:**
```javascript
// Send gRPC request without auth
{"type":"grpc_request","grpc_request":{...}}
// Expected: {"type":"error","error":"Not authenticated. Send auth message first."}
```

**Unknown Message Type:**
```javascript
{"type":"unknown"}
// Expected: {"type":"error","error":"Unknown message type: unknown"}
```

---

## Load Testing

### Test 9: Connection Limits

**Objective:** Verify server handles maximum connections correctly

```bash
# Try to open more than maxConnections (default: 100)
for i in {1..101}; do
  (node src/standalone/remote-access/test-client.js &)
done
```

**Expected:**
- First 100 connections succeed
- 101st connection is rejected with "Server at maximum capacity"

---

### Test 10: Request Timeout

**Objective:** Verify request timeout handling

```javascript
// Send a request that never completes
{
  "type":"grpc_request",
  "grpc_request":{
    "service":"cline.StateService",
    "method":"nonexistent",
    "message":{},
    "request_id":"timeout-test",
    "is_streaming":false
  }
}

// Expected after requestTimeout (default: 30s):
{"type":"error","error":"Request timeout: timeout-test"}
```

---

## Integration Tests

### Test 11: Full gRPC Flow

**Objective:** Verify complete gRPC request/response cycle

```javascript
// 1. Authenticate
{"type":"auth","token":"valid-token"}

// 2. Subscribe to state updates (streaming)
{
  "type":"grpc_request",
  "grpc_request":{
    "service":"cline.StateService",
    "method":"subscribeToState",
    "message":{},
    "request_id":"state-sub-1",
    "is_streaming":true
  }
}

// 3. Expect multiple responses with same request_id
// {"type":"grpc_response","grpc_response":{"request_id":"state-sub-1","is_streaming":true,...}}

// 4. Cancel subscription
{
  "type":"grpc_request_cancel",
  "grpc_request_cancel":{"request_id":"state-sub-1"}
}
```

---

## Troubleshooting

### Server Won't Start

**Problem:** Port already in use
```
Error: Failed to bind ProtoBus to 127.0.0.1:26040: EADDRINUSE
```

**Solution:**
```bash
# Find and kill process using port
lsof -ti:48812 | xargs kill -9
lsof -ti:26040 | xargs kill -9

# Or use different port
REMOTE_ACCESS_PORT=48813 node dist/standalone/cline-core.js
```

---

### WebSocket Connection Fails

**Problem:** Connection refused

**Solution:**
1. Verify server is running: `curl http://localhost:48812/health`
2. Check firewall settings
3. Verify correct port in client

---

### Authentication Fails

**Problem:** "Invalid or expired token"

**Solution:**
1. Generate new token: `curl -X POST http://localhost:48812/generate-token -H "Content-Type: application/json" -d '{"userId":"test"}'`
2. Verify JWT_SECRET matches between token generation and validation
3. Check token hasn't expired (default: 24 hours)

---

## Performance Benchmarks

Expected performance metrics for Phase 1:

| Metric | Target | Actual |
|--------|--------|--------|
| HTTP endpoint response time | < 100ms | ___ ms |
| WebSocket connection time | < 500ms | ___ ms |
| Authentication time | < 200ms | ___ ms |
| gRPC request latency | < 200ms | ___ ms |
| Max concurrent connections | 100 | ___ |
| Memory usage (idle) | < 100MB | ___ MB |
| Memory usage (100 connections) | < 500MB | ___ MB |

---

## Test Checklist

Use this checklist to verify Phase 1 implementation:

- [ ] Server starts without errors
- [ ] HTTP `/health` endpoint responds correctly
- [ ] HTTP `/status` endpoint responds correctly
- [ ] Token generation works (dev mode)
- [ ] Token validation works
- [ ] WebSocket connection establishes
- [ ] Authentication flow completes
- [ ] Ping/pong keepalive works
- [ ] gRPC unary requests forward correctly
- [ ] gRPC streaming requests forward correctly
- [ ] Request cancellation works
- [ ] Invalid auth is rejected
- [ ] Unauthenticated requests are rejected
- [ ] Sessions timeout correctly
- [ ] Multiple sessions can coexist
- [ ] Connection limit is enforced
- [ ] Graceful shutdown works
- [ ] No memory leaks detected
- [ ] All TypeScript types are correct

---

## Next Steps

After successful Phase 1 testing:

1. **Fix any issues found**
2. **Document performance metrics**
3. **Proceed to Phase 2**: Web Client Development
4. **Integration testing** with real Cline tasks

---

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure ProtoBus service is running
- Review network/firewall configuration
