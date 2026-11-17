import { defineConfig, devices } from '@playwright/test';
import { resolvePythonCmd } from './e2e/python-cmd';

const pythonCmd = resolvePythonCmd();
const quotedPython = pythonCmd.includes(' ') ? `"${pythonCmd}"` : pythonCmd;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: `${quotedPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8010`, cwd: 'backend', url: 'http://127.0.0.1:8010/api/health', reuseExistingServer: !process.env.CI, timeout: 30000, env: { PYTHONPATH: '.', APP_ENV: 'development', DATABASE_URL: 'sqlite:///./data/tracemind-e2e.db', JWT_SECRET: 'e2e-only-secret-do-not-use-outside-tests-123456', ACCESS_TOKEN_MINUTES: '1', AUTH_RATE_LIMIT: '30/minute', VITE_BACKEND_PROXY_TARGET: 'http://127.0.0.1:8010' } },
    { command: 'npx vite --port 3010 --host 127.0.0.1', url: 'http://127.0.0.1:3010', reuseExistingServer: !process.env.CI, timeout: 30000, env: { VITE_BACKEND_PROXY_TARGET: 'http://127.0.0.1:8010' } },
  ],
});
