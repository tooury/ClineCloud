/**
 * Cline Remote Access System
 *
 * Provides WebSocket-based remote access to Cline extension functionality.
 * Allows web clients to connect and interact with the Cline agent remotely.
 *
 * Architecture:
 * - RemoteAccessServer: Main server handling WebSocket and HTTP connections
 * - WebSocketBridge: Translates between WebSocket messages and gRPC calls
 * - SessionManager: Manages user sessions and connection lifecycle
 * - AuthMiddleware: Handles JWT-based authentication
 *
 * Usage:
 * ```typescript
 * import { RemoteAccessServer } from './remote-access'
 *
 * const server = new RemoteAccessServer(controller, {
 *   port: 48812,
 *   jwtSecret: process.env.JWT_SECRET,
 * })
 *
 * await server.start()
 * ```
 */

export { RemoteAccessServer } from "./RemoteAccessServer"
export { WebSocketBridge } from "./WebSocketBridge"
export { SessionManager } from "./SessionManager"
export { AuthMiddleware } from "./AuthMiddleware"

export type {
	RemoteAccessConfig,
	AuthenticatedWebSocket,
	UserSession,
	PendingRequest,
	JWTPayload,
	WebSocketClientMessage,
	WebSocketServerMessage,
	HealthCheckResponse,
	ServerStatusResponse,
} from "./types"
