import { spawnSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';

export default function globalSetup(_config: FullConfig) {
  const result = spawnSync('py', ['-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'backend', DATABASE_URL: 'sqlite:///./backend/data/tracemind-e2e.db', JWT_SECRET: 'e2e-only-secret-do-not-use-outside-tests-123456' },
  });
  if (result.status !== 0) throw new Error(`E2E database migration failed: ${result.stderr || result.stdout}`);
};
