import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
    // Helpers import the pino logger, which uses a pino-pretty worker thread.
    // pool: "forks" keeps each test file isolated and lets the process exit cleanly.
    pool: "forks",
  },
});
