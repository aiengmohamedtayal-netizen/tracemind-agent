import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'py -m uvicorn app.main:app --host 127.0.0.1 --port 8010', cwd: 'backend', url: 'http://127.0.0.1:8010/api/health', reuseExistingServer: !process.env.CI, timeout: 30000, env: { PYTHONPATH: '.', APP_ENV: 'development', DATABASE_URL: 'sqlite:///./data/tracemind-e2e.db', JWT_SECRET: 'e2e-only-secret-do-not-use-outside-tests-123456', ACCESS_TOKEN_MINUTES: '1', VITE_BACKEND_PROXY_TARGET: 'http://127.0.0.1:8010' } },
    { command: 'npx vite --port 3010 --host 127.0.0.1', url: 'http://127.0.0.1:3010', reuseExistingServer: !process.env.CI, timeout: 30000, env: { VITE_BACKEND_PROXY_TARGET: 'http://127.0.0.1:8010' } },
  ],
});
