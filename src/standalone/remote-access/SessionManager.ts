import { AuthenticatedWebSocket, UserSession, PendingRequest } from "./types"
import { log } from "../utils"

/**
 * Manages user sessions for remote access
 */
export class SessionManager {
	private sessions: Map<string, UserSession> = new Map()
	private sessionTimeout: number
	private cleanupInterval: NodeJS.Timeout | null = null

	constructor(sessionTimeout: number = 30 * 60 * 1000) {
		// Default 30 minutes
		this.sessionTimeout = sessionTimeout
		this.startCleanupTask()
	}

	/**
	 * Create a new session for a user
	 */
	createSession(sessionId: string, userId: string, ws: AuthenticatedWebSocket, workspaceId?: string): UserSession {
		const session: UserSession = {
			sessionId,
			userId,
			workspaceId,
			connectedAt: new Date(),
			lastActivity: new Date(),
			ws,
			pendingRequests: new Map(),
		}

		// Set session info on WebSocket
		ws.sessionId = sessionId
		ws.userId = userId
		ws.isAlive = true

		this.sessions.set(sessionId, session)
		log(`Session created: ${sessionId} for user ${userId}`)

		return session
	}

	/**
	 * Get session by session ID
	 */
	getSession(sessionId: string): UserSession | undefined {
		return this.sessions.get(sessionId)
	}

	/**
	 * Get session by WebSocket
	 */
	getSessionByWebSocket(ws: AuthenticatedWebSocket): UserSession | undefined {
		if (!ws.sessionId) {
			return undefined
		}
		return this.sessions.get(ws.sessionId)
	}

	/**
	 * Update session activity timestamp
	 */
	updateActivity(sessionId: string): void {
		const session = this.sessions.get(sessionId)
		if (session) {
			session.lastActivity = new Date()
		}
	}

	/**
	 * Add pending request to session
	 */
	addPendingRequest(sessionId: string, requestId: string, timeout: NodeJS.Timeout): void {
		const session = this.sessions.get(sessionId)
		if (session) {
			const pending: PendingRequest = {
				requestId,
				timestamp: new Date(),
				timeout,
			}
			session.pendingRequests.set(requestId, pending)
		}
	}

	/**
	 * Remove pending request from session
	 */
	removePendingRequest(sessionId: string, requestId: string): void {
		const session = this.sessions.get(sessionId)
		if (session) {
			const pending = session.pendingRequests.get(requestId)
			if (pending) {
				clearTimeout(pending.timeout)
				session.pendingRequests.delete(requestId)
			}
		}
	}

	/**
	 * Remove session
	 */
	removeSession(sessionId: string): void {
		const session = this.sessions.get(sessionId)
		if (session) {
			// Clean up all pending requests
			for (const [_requestId, pending] of session.pendingRequests) {
				clearTimeout(pending.timeout)
			}
			session.pendingRequests.clear()

			this.sessions.delete(sessionId)
			log(`Session removed: ${sessionId}`)
		}
	}

	/**
	 * Get all active sessions
	 */
	getAllSessions(): UserSession[] {
		return Array.from(this.sessions.values())
	}

	/**
	 * Get active session count
	 */
	getSessionCount(): number {
		return this.sessions.size
	}

	/**
	 * Start cleanup task for expired sessions
	 */
	private startCleanupTask(): void {
		// Run cleanup every 5 minutes
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredSessions()
		}, 5 * 60 * 1000)
	}

	/**
	 * Clean up expired sessions
	 */
	private cleanupExpiredSessions(): void {
		const now = new Date().getTime()
		const expiredSessions: string[] = []

		for (const [sessionId, session] of this.sessions) {
			const inactiveTime = now - session.lastActivity.getTime()
			if (inactiveTime > this.sessionTimeout) {
				expiredSessions.push(sessionId)
			}
		}

		for (const sessionId of expiredSessions) {
			log(`Session expired due to inactivity: ${sessionId}`)
			const session = this.sessions.get(sessionId)
			if (session?.ws.readyState === 1) {
				// OPEN state
				session.ws.close(1000, "Session expired due to inactivity")
			}
			this.removeSession(sessionId)
		}

		if (expiredSessions.length > 0) {
			log(`Cleaned up ${expiredSessions.length} expired sessions`)
		}
	}

	/**
	 * Stop cleanup task
	 */
	shutdown(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		// Close all active sessions
		for (const session of this.sessions.values()) {
			if (session.ws.readyState === 1) {
				// OPEN state
				session.ws.close(1000, "Server shutting down")
			}
			this.removeSession(session.sessionId)
		}

		log("SessionManager shutdown complete")
	}
}
