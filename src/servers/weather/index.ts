/**
 * Weather MCP Server (mock data — no real API key required)
 *
 * Provides weather tools, city-resource URIs and a weather-report prompt.
 *
 * Run standalone:  npx tsx src/servers/weather/index.ts
 *                  node dist/servers/weather/index.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Server instance
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "weather-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface WeatherData {
  city: string;
  country: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKph: number;
  condition: string;
  icon: string;
}

const WEATHER_DB: Record<string, WeatherData> = {
  "new york": {
    city: "New York", country: "US", tempC: 14, feelsLikeC: 12,
    humidity: 65, windKph: 20, condition: "Partly Cloudy", icon: "⛅",
  },
  "london": {
    city: "London", country: "GB", tempC: 11, feelsLikeC: 9,
    humidity: 82, windKph: 22, condition: "Rainy", icon: "🌧️",
  },
  "tokyo": {
    city: "Tokyo", country: "JP", tempC: 22, feelsLikeC: 23,
    humidity: 70, windKph: 10, condition: "Sunny", icon: "☀️",
  },
  "paris": {
    city: "Paris", country: "FR", tempC: 16, feelsLikeC: 15,
    humidity: 68, windKph: 13, condition: "Cloudy", icon: "☁️",
  },
  "sydney": {
    city: "Sydney", country: "AU", tempC: 26, feelsLikeC: 25,
    humidity: 58, windKph: 15, condition: "Clear", icon: "🌤️",
  },
  "dubai": {
    city: "Dubai", country: "AE", tempC: 35, feelsLikeC: 40,
    humidity: 45, windKph: 18, condition: "Hot & Hazy", icon: "🌫️",
  },
  "toronto": {
    city: "Toronto", country: "CA", tempC: -3, feelsLikeC: -8,
    humidity: 72, windKph: 30, condition: "Snow", icon: "🌨️",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lookupCity(location: string): WeatherData {
  const key = location.toLowerCase().trim();
  if (WEATHER_DB[key]) return WEATHER_DB[key]!;

  // Fallback: synthetic data for unknown cities
  return {
    city: location,
    country: "??",
    tempC: 18 + Math.floor(Math.random() * 10),
    feelsLikeC: 17 + Math.floor(Math.random() * 10),
    humidity: 50 + Math.floor(Math.random() * 30),
    windKph: 5 + Math.floor(Math.random() * 20),
    condition: ["Sunny", "Cloudy", "Partly Cloudy", "Light Rain"][Math.floor(Math.random() * 4)]!,
    icon: ["☀️", "☁️", "⛅", "🌦️"][Math.floor(Math.random() * 4)]!,
  };
}

function fmtTemp(c: number, units: string): string {
  return units === "fahrenheit" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${c}°C`;
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const CurrentWeatherSchema = z.object({
  location: z.string().describe("City name"),
  units: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
});

const ForecastSchema = z.object({
  location: z.string().describe("City name"),
  days: z.number().int().min(1).max(7).optional().default(5),
  units: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
});

const AlertsSchema = z.object({
  location: z.string().describe("City name"),
});

// ---------------------------------------------------------------------------
// tools/list
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_current_weather",
      description: "Get current weather conditions for a city",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units (default: celsius)",
          },
        },
        required: ["location"],
      },
    },
    {
      name: "get_forecast",
      description: "Get a multi-day weather forecast (1–7 days)",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          days: { type: "integer", minimum: 1, maximum: 7, description: "Number of days (default: 5)" },
          units: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
    {
      name: "get_alerts",
      description: "Get active weather alerts for a city",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// tools/call
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs = {} } = request.params;

  try {
    switch (name) {
      case "get_current_weather": {
        const { location, units } = CurrentWeatherSchema.parse(rawArgs);
        const w = lookupCity(location);
        const lines = [
          `${w.icon} Current weather in ${w.city}, ${w.country}`,
          `🌡️  Temperature : ${fmtTemp(w.tempC, units)} (feels like ${fmtTemp(w.feelsLikeC, units)})`,
          `💧 Humidity    : ${w.humidity}%`,
          `💨 Wind        : ${w.windKph} km/h`,
          `☁️  Condition   : ${w.condition}`,
        ];
        return text(lines.join("\n"));
      }

      case "get_forecast": {
        const { location, days, units } = ForecastSchema.parse(rawArgs);
        const base = lookupCity(location);

        const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Stormy", "Clear", "Windy"];
        const icons = ["☀️", "⛅", "☁️", "🌧️", "⛈️", "🌤️", "💨"];
        const dayLabels = ["Today", "Tomorrow", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

        const rows = Array.from({ length: days }, (_, i) => {
          const v = Math.floor(Math.random() * 6) - 3;
          const ci = Math.floor(Math.random() * conditions.length);
          const hi = fmtTemp(base.tempC + v + 3, units).padEnd(7);
          const lo = fmtTemp(base.tempC + v - 4, units).padEnd(7);
          return `${icons[ci]} ${(dayLabels[i] ?? `Day ${i + 1}`).padEnd(10)} ${hi} / ${lo}  ${conditions[ci]}`;
        });

        return text([
          `📅 ${days}-day forecast for ${base.city}, ${base.country}`,
          "",
          ...rows,
        ].join("\n"));
      }

      case "get_alerts": {
        const { location } = AlertsSchema.parse(rawArgs);
        const hasAlert = Math.random() < 0.25; // 25 % chance of an alert

        if (!hasAlert) {
          return text(`✅ No active weather alerts for ${location}.`);
        }

        const ALERTS = [
          { type: "Wind Advisory", severity: "Moderate", msg: "Strong gusts 30–50 km/h expected." },
          { type: "Heat Advisory", severity: "Moderate", msg: "Stay hydrated. Avoid prolonged outdoor exposure." },
          { type: "Thunderstorm Warning", severity: "Severe", msg: "Heavy rain, lightning and possible hail." },
          { type: "Fog Advisory", severity: "Low", msg: "Dense fog reducing visibility below 200 m." },
        ];

        const alert = ALERTS[Math.floor(Math.random() * ALERTS.length)]!;
        return text(
          `⚠️  Weather Alert for ${location}\n` +
          `   Type     : ${alert.type}\n` +
          `   Severity : ${alert.severity}\n` +
          `   Details  : ${alert.msg}`,
        );
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${err.message}`);
    }
    throw new McpError(ErrorCode.InternalError, (err as Error).message);
  }
});

// ---------------------------------------------------------------------------
// resources/list + resources/read
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: Object.keys(WEATHER_DB).map((key) => ({
    uri: `weather://${key.replace(/ /g, "-")}`,
    name: `Weather — ${WEATHER_DB[key]!.city}`,
    description: `Live weather snapshot for ${WEATHER_DB[key]!.city}`,
    mimeType: "application/json",
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const key = uri.replace("weather://", "").replace(/-/g, " ");
  const data = WEATHER_DB[key];

  if (!data) {
    throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// prompts/list + prompts/get
// ---------------------------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "weather_report",
      description: "Generate a tailored weather report for a location",
      arguments: [
        { name: "location", description: "City name", required: true },
        {
          name: "audience",
          description: "Target audience: general | traveler | farmer | pilot",
          required: false,
        },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "weather_report") {
    const a = args as Record<string, string>;
    const location = a["location"] ?? "the requested location";
    const audience = a["audience"] ?? "general";

    return {
      description: "Weather report generator",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Generate a comprehensive weather report for ${location}.`,
              `Target audience: ${audience}`,
              ``,
              `Steps:`,
              `1. Call get_current_weather to get current conditions.`,
              `2. Call get_forecast with days=5 to get the 5-day outlook.`,
              `3. Call get_alerts to check for any active warnings.`,
              `4. Summarise all findings in a format suited for a ${audience} audience.`,
            ].join("\n"),
          },
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${name}`);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`Weather server error: ${(err as Error).message}\n`);
  process.exit(1);
});
