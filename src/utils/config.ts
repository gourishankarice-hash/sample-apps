import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { GatewayConfig } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads the gateway configuration from a JSON file and applies
 * environment-variable overrides where defined.
 */
export function loadConfig(configPath?: string): GatewayConfig {
  const defaultPath = resolve(__dirname, "../../config/gateway.config.json");
  const resolvedPath = configPath ?? process.env.GATEWAY_CONFIG_PATH ?? defaultPath;

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, "utf-8");
  } catch {
    throw new Error(`Cannot read gateway config from: ${resolvedPath}`);
  }

  const config = JSON.parse(raw) as GatewayConfig;

  // --- Environment variable overrides ---

  if (process.env.GATEWAY_PORT) {
    config.gateway.http.port = parseInt(process.env.GATEWAY_PORT, 10);
  }

  if (process.env.GATEWAY_HOST) {
    config.gateway.http.host = process.env.GATEWAY_HOST;
  }

  if (process.env.GATEWAY_AUTH_ENABLED) {
    config.gateway.auth.enabled = process.env.GATEWAY_AUTH_ENABLED === "true";
  }

  if (process.env.GATEWAY_API_KEYS) {
    config.gateway.auth.apiKeys = process.env.GATEWAY_API_KEYS.split(",").map(
      (k) => k.trim(),
    );
  }

  if (process.env.LOG_LEVEL) {
    config.gateway.logging.level = process.env.LOG_LEVEL as GatewayConfig["gateway"]["logging"]["level"];
  }

  return config;
}

/**
 * Persists the in-memory GatewayConfig back to the JSON config file.
 * Uses the same path-resolution logic as loadConfig().
 * Writes with 2-space indentation to match the existing file format.
 */
export function saveConfig(config: GatewayConfig, configPath?: string): void {
  const defaultPath = resolve(__dirname, "../../config/gateway.config.json");
  const resolvedPath = configPath ?? process.env.GATEWAY_CONFIG_PATH ?? defaultPath;

  try {
    writeFileSync(resolvedPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    throw new Error(
      `Cannot write gateway config to: ${resolvedPath} — ${(err as Error).message}`,
    );
  }
}
