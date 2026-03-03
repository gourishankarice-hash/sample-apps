import type { Request, Response, NextFunction } from "express";
import type { RateLimitSettings } from "../../types/index.js";
import logger from "../../utils/logger.js";

interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * Simple in-process sliding-window rate limiter.
 *
 * Uses the client IP address as the rate-limit key. For production deployments
 * behind a load-balancer, replace the in-memory store with Redis.
 */
export function createRateLimiter(settings: RateLimitSettings) {
  const store = new Map<string, WindowEntry>();

  // Periodically evict stale entries to prevent unbounded memory growth.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > settings.windowMs) {
        store.delete(key);
      }
    }
  }, settings.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!settings.enabled) {
      next();
      return;
    }

    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart > settings.windowMs) {
      store.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= settings.maxRequests) {
      const retryAfterSec = Math.ceil(
        (entry.windowStart + settings.windowMs - now) / 1000,
      );
      logger.warn("Rate limit exceeded", { ip: key });
      res
        .status(429)
        .set("Retry-After", String(retryAfterSec))
        .json({ error: "Too Many Requests", retryAfter: retryAfterSec });
      return;
    }

    entry.count += 1;
    next();
  };
}
