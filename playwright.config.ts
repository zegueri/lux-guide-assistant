import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout dans un vrai navigateur.
 * Les appels à /api/chat et /api/status sont simulés dans le test (page.route) : on teste
 * l'interface sans clé API ni base de données, de façon déterministe et gratuite.
 */
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // En CI, on teste le build de production ; en local, on réutilise `npm run dev`.
    command: isCI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
