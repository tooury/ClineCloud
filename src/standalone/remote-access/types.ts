import { WebSocket } from "ws"
import { GrpcRequest } from "@/shared/WebviewMessage"
import { GrpcResponse } from "@/shared/ExtensionMessage"

/**
 * WebSocket connection with user session information
 */
export interface AuthenticatedWebSocket extends WebSocket {
	userId?: string
	sessionId?: string
	isAlive?: boolean
}

/**
 * User session data
 */
export interface UserSession {
	sessionId: string
	userId: string
	workspaceId?: string
	connectedAt: Date
	lastActivity: Date
	ws: AuthenticatedWebSocket
	pendingRequests: Map<string, PendingRequest>
}

/**
 * Pending gRPC request tracking
 */
export interface PendingRequest {
	requestId: string
	timestamp: Date
	timeout: NodeJS.Timeout
}

/**
 * JWT token payload
 */
export interface JWTPayload {
	userId: string
	workspaceId?: string
	sessionId: string
	iat: number
	exp: number
}

/**
 * WebSocket message from client
 */
export interface WebSocketClientMessage {
	type: "auth" | "grpc_request" | "grpc_request_cancel" | "ping"
	token?: string
	grpc_request?: GrpcRequest
	grpc_request_cancel?: { request_id: string }
}

/**
 * WebSocket message to client
 */
export interface WebSocketServerMessage {
	type: "auth_success" | "auth_error" | "grpc_response" | "error" | "pong"
	sessionId?: string
	grpc_response?: GrpcResponse
	error?: string
	message?: string
}

/**
 * Remote access server configuration
 */
export interface RemoteAccessConfig {
	port: number
	jwtSecret: string
	sessionTimeout: number // milliseconds
	requestTimeout: number // milliseconds
	enableCors: boolean
	corsOrigins: string[]
	maxConnections: number
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
	status: "healthy" | "degraded" | "unhealthy"
	uptime: number
	connections: number
	timestamp: string
	version: string
}

/**
 * Server status response
 */
export interface ServerStatusResponse {
	running: boolean
	port: number
	connections: number
	activeSessions: number
	uptime: number
	protobusConnected: boolean
}
