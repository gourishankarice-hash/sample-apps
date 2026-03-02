/**
 * Tool: get_current_datetime
 * Returns the current date and time, optionally in a specified IANA timezone.
 */

export interface DateTimeResult {
  utc: string;
  local: string;
  timezone: string;
  date: string;
  time: string;
  dayOfWeek: string;
  timestamp: number;
  iso8601: string;
}

const TIMEZONE_ALIASES: Record<string, string> = {
  "est":   "America/New_York",
  "cst":   "America/Chicago",
  "mst":   "America/Denver",
  "pst":   "America/Los_Angeles",
  "gmt":   "Etc/GMT",
  "utc":   "UTC",
  "ist":   "Asia/Kolkata",
  "jst":   "Asia/Tokyo",
  "aest":  "Australia/Sydney",
  "cet":   "Europe/Paris",
  "bst":   "Europe/London",
  "gulf":  "Asia/Dubai",
  "sgt":   "Asia/Singapore",
};

export function getCurrentDatetime(timezone?: string): DateTimeResult {
  const tz = resolveTimezone(timezone);
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year:    "numeric",
    month:   "2-digit",
    day:     "2-digit",
    hour:    "2-digit",
    minute:  "2-digit",
    second:  "2-digit",
    hour12:  false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}:${get("second")}`;

  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  });

  const localStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    dateStyle: "full",
    timeStyle: "long",
  }).format(now);

  return {
    utc:       now.toUTCString(),
    local:     localStr,
    timezone:  tz,
    date,
    time,
    dayOfWeek: dayFormatter.format(now),
    timestamp: now.getTime(),
    iso8601:   now.toISOString(),
  };
}

function resolveTimezone(tz?: string): string {
  if (!tz) return "UTC";
  const lower = tz.toLowerCase().trim();
  if (TIMEZONE_ALIASES[lower]) return TIMEZONE_ALIASES[lower];
  // Validate the timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    throw new Error(`Invalid timezone: "${tz}". Use IANA format like "America/New_York" or abbreviations like EST, IST, JST.`);
  }
}

export function listTimezoneAliases(): Record<string, string> {
  return { ...TIMEZONE_ALIASES };
}
