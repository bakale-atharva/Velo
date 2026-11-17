import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    // Agent worktrees under .claude/ hold other checkouts of this repo.
    exclude: ["**/node_modules/**", ".claude/**"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
