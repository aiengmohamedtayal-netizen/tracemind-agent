import { expect, test } from '@playwright/test';

test('uploads and analyzes raw Spark text logs without inventing telemetry', async ({ page }) => {
  const email = `log-e2e-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('local-log-e2e-password-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'New Log Analysis' })).toBeVisible();

  await page.getByRole('button', { name: 'New Log Analysis' }).click();
  await page.locator('#event-log-file-input').setInputFiles({
    name: 'spark-job.log',
    mimeType: 'text/plain',
    buffer: Buffer.from([
      '2026-11-16T10:00:00Z INFO spark.Job: Job started',
      '2026-11-16T10:00:01Z INFO spark.Executor: Executor registered',
      '2026-11-16T10:00:02Z WARN spark.Executor: Executor delayed for 1200 ms',
      '2026-11-16T10:00:03Z ERROR spark.TaskRunner: Task failed with exception',
    ].join('\n')),
  });
  await expect(page.getByText(/Validated: 4 LOG records/)).toBeVisible();
  await page.getByRole('button', { name: 'Run TraceMind Analysis Pipeline' }).click();
  await expect(page.getByRole('heading', { name: 'spark-job.log' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'Investigate' }).click();
  await expect(page.getByText('Raw log message')).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Task failed with exception' })).toBeVisible();
});
