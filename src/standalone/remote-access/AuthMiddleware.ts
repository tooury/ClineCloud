import { sign, verify, decode, type JwtPayload, type SignOptions, type VerifyOptions } from "jsonwebtoken"
import { JWTPayload } from "./types"
import { log } from "../utils"

/**
 * JWT authentication middleware for remote access
 */
export class AuthMiddleware {
	private jwtSecret: string

	constructor(jwtSecret: string) {
		this.jwtSecret = jwtSecret || this.generateDefaultSecret()
	}

	/**
	 * Generate a default JWT secret (for development)
	 */
	private generateDefaultSecret(): string {
		const secret = process.env.JWT_SECRET || "cline-remote-access-secret-change-in-production"
		if (!process.env.JWT_SECRET) {
			log("WARNING: Using default JWT secret. Set JWT_SECRET environment variable in production!")
		}
		return secret
	}

	/**
	 * Generate a JWT token for a user
	 */
	generateToken(userId: string, sessionId: string, workspaceId?: string, expiresIn: string = "24h"): string {
		const payload: Record<string, any> = {
			userId,
			sessionId,
		}

		if (workspaceId) {
			payload.workspaceId = workspaceId
		}

		const options: SignOptions = {
			expiresIn: expiresIn as any,
			issuer: "cline-remote-access",
		}

		return sign(payload, this.jwtSecret, options)
	}

	/**
	 * Verify and decode a JWT token
	 */
	verifyToken(token: string): JWTPayload | null {
		try {
			const options: VerifyOptions = {
				issuer: "cline-remote-access",
			}
			const decoded = verify(token, this.jwtSecret, options) as JWTPayload

			return decoded
		} catch (error: any) {
			if (error.name === "TokenExpiredError") {
				log(`Token expired: ${error.message}`)
			} else if (error.name === "JsonWebTokenError") {
				log(`Invalid token: ${error.message}`)
			} else {
				log(`Token verification error: ${error.message}`)
			}
			return null
		}
	}

	/**
	 * Refresh a token (generate a new one with the same payload)
	 */
	refreshToken(oldToken: string, expiresIn: string = "24h"): string | null {
		try {
			// Verify the old token (ignoring expiration)
			const options: VerifyOptions = {
				issuer: "cline-remote-access",
				ignoreExpiration: true,
			}
			const decoded = verify(oldToken, this.jwtSecret, options) as JWTPayload

			// Generate a new token with the same payload
			return this.generateToken(decoded.userId, decoded.sessionId, decoded.workspaceId, expiresIn)
		} catch (error: any) {
			log(`Token refresh error: ${error.message}`)
			return null
		}
	}

	/**
	 * Decode token without verification (for debugging)
	 */
	decodeToken(token: string): JWTPayload | null {
		try {
			const decoded = decode(token) as JWTPayload
			return decoded
		} catch (error: any) {
			log(`Token decode error: ${error.message}`)
			return null
		}
	}

	/**
	 * Check if a token is expired
	 */
	isTokenExpired(token: string): boolean {
		const decoded = this.decodeToken(token)
		if (!decoded || !decoded.exp) {
			return true
		}

		const now = Math.floor(Date.now() / 1000)
		return decoded.exp < now
	}

	/**
	 * Get token expiration time
	 */
	getTokenExpiration(token: string): Date | null {
		const decoded = this.decodeToken(token)
		if (!decoded || !decoded.exp) {
			return null
		}

		return new Date(decoded.exp * 1000)
	}
}
