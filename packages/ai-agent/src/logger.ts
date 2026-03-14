/**
 * Structured JSON logger for production.
 * No dependencies — wraps console with structured output.
 *
 * In production (NODE_ENV=production), outputs JSON lines.
 * In development, outputs human-readable colored text.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProd = process.env.NODE_ENV === "production";
const minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? (isProd ? "info" : "debug")];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

function formatDev(entry: LogEntry): string {
  const { level, msg, timestamp, ...extra } = entry;
  const prefix = {
    debug: "\x1b[90m[DEBUG]\x1b[0m",
    info: "\x1b[36m[INFO]\x1b[0m",
    warn: "\x1b[33m[WARN]\x1b[0m",
    error: "\x1b[31m[ERROR]\x1b[0m",
  }[level];

  const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  return `${prefix} ${msg}${extraStr}`;
}

function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  if (isProd) {
    const output = JSON.stringify(entry);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    const output = formatDev(entry);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
};
