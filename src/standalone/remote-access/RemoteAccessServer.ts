import { Server as HTTPServer } from "http"
import express, { Express, Request, Response } from "express"
import cors from "cors"
import { WebSocketServer, WebSocket } from "ws"
import { Controller } from "@core/controller"
import {
	RemoteAccessConfig,
	AuthenticatedWebSocket,
	HealthCheckResponse,
	ServerStatusResponse,
} from "./types"
import { WebSocketBridge } from "./WebSocketBridge"
import { SessionManager } from "./SessionManager"
import { AuthMiddleware } from "./AuthMiddleware"
import { log } from "../utils"

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RemoteAccessConfig = {
	port: 48812,
	jwtSecret: process.env.JWT_SECRET || "cline-remote-access-secret",
	sessionTimeout: 30 * 60 * 1000, // 30 minutes
	requestTimeout: 30000, // 30 seconds
	enableCors: true,
	corsOrigins: ["*"], // In production, this should be restricted
	maxConnections: 100,
}

/**
 * Remote Access Server for WebSocket-based remote connections
 */
export class RemoteAccessServer {
	private config: RemoteAccessConfig
	private controller: Controller
	private httpServer: HTTPServer | null = null
	private wss: WebSocketServer | null = null
	private app: Express
	private sessionManager: SessionManager
	private authMiddleware: AuthMiddleware
	private bridge: WebSocketBridge
	private startTime: Date | null = null
	private pingInterval: NodeJS.Timeout | null = null

	constructor(controller: Controller, config?: Partial<RemoteAccessConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.controller = controller

		// Initialize components
		this.sessionManager = new SessionManager(this.config.sessionTimeout)
		this.authMiddleware = new AuthMiddleware(this.config.jwtSecret)
		this.bridge = new WebSocketBridge(
			this.controller,
			this.sessionManager,
			this.authMiddleware,
			this.config.requestTimeout,
		)

		// Setup Express app
		this.app = this.createExpressApp()
	}

	/**
	 * Create Express application with HTTP endpoints
	 */
	private createExpressApp(): Express {
		const app = express()

		// Middleware
		app.use(express.json())

		if (this.config.enableCors) {
			app.use(
				cors({
					origin: this.config.corsOrigins,
					credentials: true,
				}),
			)
		}

		// Health check endpoint
		app.get("/health", (_req: Request, res: Response) => {
			const health: HealthCheckResponse = {
				status: this.getHealthStatus(),
				uptime: this.getUptime(),
				connections: this.sessionManager.getSessionCount(),
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			}
			res.json(health)
		})

		// Server status endpoint
		app.get("/status", (_req: Request, res: Response) => {
			const status: ServerStatusResponse = {
				running: this.httpServer !== null,
				port: this.config.port,
				connections: this.wss?.clients.size || 0,
				activeSessions: this.sessionManager.getSessionCount(),
				uptime: this.getUptime(),
				protobusConnected: true, // TODO: Check actual ProtoBus connection
			}
			res.json(status)
		})

		// Auth status endpoint
		app.get("/auth-status", (req: Request, res: Response) => {
			const token = req.headers.authorization?.replace("Bearer ", "")

			if (!token) {
				res.status(401).json({ error: "No token provided" })
				return
			}

			const payload = this.authMiddleware.verifyToken(token)
			if (!payload) {
				res.status(401).json({ error: "Invalid or expired token" })
				return
			}

			res.json({
				valid: true,
				userId: payload.userId,
				sessionId: payload.sessionId,
				workspaceId: payload.workspaceId,
				expiresAt: new Date(payload.exp * 1000).toISOString(),
			})
		})

		// Token generation endpoint (for development/testing)
		if (process.env.NODE_ENV !== "production") {
			app.post("/generate-token", (req: Request, res: Response) => {
				const { userId, workspaceId } = req.body
				if (!userId) {
					res.status(400).json({ error: "userId is required" })
					return
				}

				const token = this.bridge.generateTestToken(userId, workspaceId)
				res.json({ token })
			})
		}

		return app
	}

	/**
	 * Start the remote access server
	 */
	async start(): Promise<string> {
		return new Promise((resolve, reject) => {
			try {
				// Create HTTP server
				this.httpServer = this.app.listen(this.config.port, () => {
					log(`Remote Access HTTP server listening on port ${this.config.port}`)
				})

				this.httpServer.on("error", (error: Error) => {
					reject(new Error(`Failed to start HTTP server: ${error.message}`))
				})

				// Create WebSocket server
				this.wss = new WebSocketServer({
					server: this.httpServer,
					path: "/ws",
				})

				// Handle WebSocket connections
				this.wss.on("connection", (ws: WebSocket) => {
					const authWs = ws as AuthenticatedWebSocket
					this.handleNewConnection(authWs)
				})

				this.wss.on("error", (error: Error) => {
					log(`WebSocket server error: ${error.message}`)
				})

				this.startTime = new Date()

				// Start ping/pong keepalive
				this.startKeepalive()

				const address = `ws://127.0.0.1:${this.config.port}/ws`
				log(`Remote Access WebSocket server listening at ${address}`)
				log(`Remote Access HTTP endpoints available at http://127.0.0.1:${this.config.port}`)

				resolve(address)
			} catch (error: any) {
				reject(new Error(`Failed to start RemoteAccessServer: ${error.message}`))
			}
		})
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleNewConnection(ws: AuthenticatedWebSocket): void {
		// Check connection limit
		if (this.wss && this.wss.clients.size > this.config.maxConnections) {
			log(`Connection limit reached (${this.config.maxConnections}), rejecting new connection`)
			ws.close(1008, "Server at maximum capacity")
			return
		}

		// Initialize keepalive flag
		ws.isAlive = true

		// Pass to bridge for handling
		this.bridge.handleConnection(ws)
	}

	/**
	 * Start WebSocket keepalive (ping/pong)
	 */
	private startKeepalive(): void {
		// Ping clients every 30 seconds
		this.pingInterval = setInterval(() => {
			if (!this.wss) return

			this.wss.clients.forEach((ws) => {
				const authWs = ws as AuthenticatedWebSocket

				if (authWs.isAlive === false) {
					// Client didn't respond to last ping, terminate
					log("Terminating unresponsive WebSocket connection")
					return authWs.terminate()
				}

				authWs.isAlive = false
				authWs.ping()
			})
		}, 30000)
	}

	/**
	 * Stop the remote access server
	 */
	async stop(): Promise<void> {
		log("Stopping Remote Access Server...")

		// Stop keepalive
		if (this.pingInterval) {
			clearInterval(this.pingInterval)
			this.pingInterval = null
		}

		// Shutdown session manager
		this.sessionManager.shutdown()

		// Close all WebSocket connections
		if (this.wss) {
			this.wss.clients.forEach((ws) => {
				ws.close(1000, "Server shutting down")
			})
			this.wss.close()
			this.wss = null
		}

		// Close HTTP server
		if (this.httpServer) {
			await new Promise<void>((resolve) => {
				this.httpServer!.close(() => {
					log("HTTP server closed")
					resolve()
				})
			})
			this.httpServer = null
		}

		log("Remote Access Server stopped")
	}

	/**
	 * Get server health status
	 */
	private getHealthStatus(): "healthy" | "degraded" | "unhealthy" {
		const connectionCount = this.sessionManager.getSessionCount()
		const maxConnections = this.config.maxConnections

		if (connectionCount >= maxConnections) {
			return "unhealthy"
		} else if (connectionCount >= maxConnections * 0.8) {
			return "degraded"
		}

		return "healthy"
	}

	/**
	 * Get server uptime in seconds
	 */
	private getUptime(): number {
		if (!this.startTime) {
			return 0
		}
		return Math.floor((Date.now() - this.startTime.getTime()) / 1000)
	}

	/**
	 * Get the auth middleware (for external token generation)
	 */
	getAuthMiddleware(): AuthMiddleware {
		return this.authMiddleware
	}

	/**
	 * Get the session manager (for monitoring)
	 */
	getSessionManager(): SessionManager {
		return this.sessionManager
	}

	/**
	 * Get server configuration
	 */
	getConfig(): RemoteAccessConfig {
		return { ...this.config }
	}
}
