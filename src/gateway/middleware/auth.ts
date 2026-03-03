import type { Request, Response, NextFunction } from "express";
import type { AuthSettings } from "../../types/index.js";
import logger from "../../utils/logger.js";

/**
 * Returns an Express middleware that validates API-key authentication.
 *
 * Clients must supply the key via one of:
 *   - `x-api-key` header
 *   - `Authorization: Bearer <key>` header
 *
 * Authentication is skipped entirely when `settings.enabled` is `false`.
 */
export function createAuthMiddleware(settings: AuthSettings) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!settings.enabled) {
      next();
      return;
    }

    const keyFromHeader = req.headers["x-api-key"];
    const authHeader = req.headers["authorization"];
    const keyFromBearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    const apiKey = keyFromHeader ?? keyFromBearer;

    if (!apiKey || !settings.apiKeys.includes(apiKey as string)) {
      logger.warn("Rejected unauthorised request", {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(401).json({ error: "Unauthorized — provide a valid API key" });
      return;
    }

    next();
  };
}
