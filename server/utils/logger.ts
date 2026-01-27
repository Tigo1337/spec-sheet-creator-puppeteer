import pino from "pino";

// Helper to truncate long strings (like Base64) in logs
export const sanitizeData = (data: any): any => {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data };
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = `${sanitized[key].substring(0, 50)}... [Truncated ${sanitized[key].length} chars]`;
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  return sanitized;
};

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss TT",
      ignore: "pid,hostname",
    },
  },
});
