import { WebSocket } from "ws"
import { Controller } from "@core/controller"
import { handleGrpcRequest, handleGrpcRequestCancel } from "@core/controller/grpc-handler"
import { ExtensionMessage } from "@/shared/ExtensionMessage"
import { GrpcRequest } from "@/shared/WebviewMessage"
import { AuthenticatedWebSocket, WebSocketClientMessage, WebSocketServerMessage } from "./types"
import { SessionManager } from "./SessionManager"
import { AuthMiddleware } from "./AuthMiddleware"
import { log } from "../utils"
import { v4 as uuidv4 } from "uuid"

/**
 * Bridge between WebSocket connections and gRPC ProtoBus service
 */
export class WebSocketBridge {
	private controller: Controller
	private sessionManager: SessionManager
	private authMiddleware: AuthMiddleware
	private requestTimeout: number

	constructor(
		controller: Controller,
		sessionManager: SessionManager,
		authMiddleware: AuthMiddleware,
		requestTimeout: number = 30000,
	) {
		this.controller = controller
		this.sessionManager = sessionManager
		this.authMiddleware = authMiddleware
		this.requestTimeout = requestTimeout
	}

	/**
	 * Handle new WebSocket connection
	 */
	handleConnection(ws: AuthenticatedWebSocket): void {
		log("New WebSocket connection established")

		// Set up message handler
		ws.on("message", (data: Buffer) => {
			this.handleMessage(ws, data)
		})

		// Set up close handler
		ws.on("close", () => {
			this.handleClose(ws)
		})

		// Set up error handler
		ws.on("error", (error: Error) => {
			log(`WebSocket error: ${error.message}`)
		})

		// Set up pong handler for keepalive
		ws.on("pong", () => {
			if (ws.isAlive !== undefined) {
				ws.isAlive = true
			}
		})
	}

	/**
	 * Handle incoming WebSocket message
	 */
	private async handleMessage(ws: AuthenticatedWebSocket, data: Buffer): Promise<void> {
		try {
			const message: WebSocketClientMessage = JSON.parse(data.toString())

			switch (message.type) {
				case "auth":
					await this.handleAuth(ws, message.token)
					break

				case "grpc_request":
					await this.handleGrpcRequestMessage(ws, message.grpc_request)
					break

				case "grpc_request_cancel":
					await this.handleGrpcCancelMessage(ws, message.grpc_request_cancel)
					break

				case "ping":
					this.handlePing(ws)
					break

				default:
					this.sendError(ws, `Unknown message type: ${(message as any).type}`)
			}
		} catch (error: any) {
			log(`Error handling WebSocket message: ${error.message}`)
			this.sendError(ws, `Failed to process message: ${error.message}`)
		}
	}

	/**
	 * Handle authentication
	 */
	private async handleAuth(ws: AuthenticatedWebSocket, token?: string): Promise<void> {
		if (!token) {
			this.sendAuthError(ws, "No token provided")
			return
		}

		const payload = this.authMiddleware.verifyToken(token)
		if (!payload) {
			this.sendAuthError(ws, "Invalid or expired token")
			return
		}

		// Create session
		const session = this.sessionManager.createSession(payload.sessionId, payload.userId, ws, payload.workspaceId)

		// Send success response
		const response: WebSocketServerMessage = {
			type: "auth_success",
			sessionId: session.sessionId,
			message: "Authentication successful",
		}

		ws.send(JSON.stringify(response))
		log(`Client authenticated: userId=${payload.userId}, sessionId=${payload.sessionId}`)
	}

	/**
	 * Handle gRPC request from WebSocket
	 */
	private async handleGrpcRequestMessage(ws: AuthenticatedWebSocket, grpcRequest?: GrpcRequest): Promise<void> {
		// Check if session is authenticated
		const session = this.sessionManager.getSessionByWebSocket(ws)
		if (!session) {
			this.sendError(ws, "Not authenticated. Send auth message first.")
			return
		}

		if (!grpcRequest) {
			this.sendError(ws, "No gRPC request provided")
			return
		}

		// Update session activity
		this.sessionManager.updateActivity(session.sessionId)

		// Create a function to send responses back via WebSocket
		const postMessageToWebview = async (message: ExtensionMessage): Promise<boolean> => {
			try {
				if (ws.readyState === WebSocket.OPEN) {
					const response: WebSocketServerMessage = {
						type: "grpc_response",
						grpc_response: message.grpc_response,
					}
					ws.send(JSON.stringify(response))
					return true
				}
				return false
			} catch (error: any) {
				log(`Error sending gRPC response via WebSocket: ${error.message}`)
				return false
			}
		}

		// Set up request timeout
		const timeoutId = setTimeout(() => {
			if (session) {
				this.sessionManager.removePendingRequest(session.sessionId, grpcRequest.request_id)
				this.sendError(ws, `Request timeout: ${grpcRequest.request_id}`)
			}
		}, this.requestTimeout)

		// Track pending request
		this.sessionManager.addPendingRequest(session.sessionId, grpcRequest.request_id, timeoutId)

		try {
			// Forward to gRPC handler (this reuses existing Cline gRPC handler logic)
			await handleGrpcRequest(this.controller, postMessageToWebview, grpcRequest)
		} catch (error: any) {
			log(`Error handling gRPC request: ${error.message}`)
			this.sendError(ws, `gRPC request failed: ${error.message}`)
		} finally {
			// Clean up pending request
			this.sessionManager.removePendingRequest(session.sessionId, grpcRequest.request_id)
		}
	}

	/**
	 * Handle gRPC cancel request from WebSocket
	 */
	private async handleGrpcCancelMessage(
		ws: AuthenticatedWebSocket,
		cancelRequest?: { request_id: string },
	): Promise<void> {
		const session = this.sessionManager.getSessionByWebSocket(ws)
		if (!session) {
			this.sendError(ws, "Not authenticated")
			return
		}

		if (!cancelRequest) {
			this.sendError(ws, "No cancel request provided")
			return
		}

		// Create response handler
		const postMessageToWebview = async (message: ExtensionMessage): Promise<boolean> => {
			if (ws.readyState === WebSocket.OPEN) {
				const response: WebSocketServerMessage = {
					type: "grpc_response",
					grpc_response: message.grpc_response,
				}
				ws.send(JSON.stringify(response))
				return true
			}
			return false
		}

		try {
			await handleGrpcRequestCancel(postMessageToWebview, {
				request_id: cancelRequest.request_id,
			})

			// Remove from pending requests
			this.sessionManager.removePendingRequest(session.sessionId, cancelRequest.request_id)
		} catch (error: any) {
			log(`Error handling gRPC cancel: ${error.message}`)
		}
	}

	/**
	 * Handle ping message
	 */
	private handlePing(ws: AuthenticatedWebSocket): void {
		const session = this.sessionManager.getSessionByWebSocket(ws)
		if (session) {
			this.sessionManager.updateActivity(session.sessionId)
		}

		const response: WebSocketServerMessage = {
			type: "pong",
		}
		ws.send(JSON.stringify(response))
	}

	/**
	 * Handle WebSocket close
	 */
	private handleClose(ws: AuthenticatedWebSocket): void {
		const session = this.sessionManager.getSessionByWebSocket(ws)
		if (session) {
			log(`WebSocket connection closed for session: ${session.sessionId}`)
			this.sessionManager.removeSession(session.sessionId)
		} else {
			log("WebSocket connection closed (no session)")
		}
	}

	/**
	 * Send error message to client
	 */
	private sendError(ws: WebSocket, error: string): void {
		if (ws.readyState === WebSocket.OPEN) {
			const response: WebSocketServerMessage = {
				type: "error",
				error,
			}
			ws.send(JSON.stringify(response))
		}
	}

	/**
	 * Send authentication error
	 */
	private sendAuthError(ws: WebSocket, error: string): void {
		if (ws.readyState === WebSocket.OPEN) {
			const response: WebSocketServerMessage = {
				type: "auth_error",
				error,
			}
			ws.send(JSON.stringify(response))
			// Close connection after auth error
			setTimeout(() => ws.close(1008, "Authentication failed"), 1000)
		}
	}

	/**
	 * Generate a token for testing/development
	 */
	generateTestToken(userId: string = "test-user", workspaceId?: string): string {
		const sessionId = uuidv4()
		return this.authMiddleware.generateToken(userId, sessionId, workspaceId)
	}
}
