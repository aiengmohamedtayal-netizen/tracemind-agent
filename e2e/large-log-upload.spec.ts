import { expect, test } from '@playwright/test';

test('analyzes a 100,000-row telemetry CSV in the browser', async ({ page }) => {
  test.setTimeout(180_000);

  const email = `large-log-e2e-${Date.now()}@example.com`;
  const filename = 'browser-100k-telemetry.csv';
  const lines = [
    'event_id,timestamp,service,event_type,source_ip,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code',
  ];
  const startTime = Date.UTC(2026, 10, 16, 12, 0, 0);

  for (let index = 0; index < 100_000; index += 1) {
    const anomalous = index % 997 === 0;
    const timestamp = new Date(startTime + index * 3_000).toISOString();
    const service = ['payments', 'auth', 'catalog', 'orders', 'inventory', 'notifications'][index % 6];
    const latency = anomalous ? 1_200 + (index % 500) : 35 + (index % 80);
    const errorRate = anomalous ? 0.62 : 0.001 + (index % 40) / 10_000;
    const cpu = anomalous ? 92 : 20 + (index % 35);
    const memory = anomalous ? 3_200 : 450 + (index % 700);
    const status = anomalous ? 503 : 200;
    lines.push(
      `evt-${String(index + 1).padStart(6, '0')},${timestamp},${service},REQUEST,10.0.0.${(index % 240) + 1},${latency},${errorRate},${cpu},${memory},${300 + (index % 900)},${status}`,
    );
  }

  await page.goto('/');
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('local-large-log-e2e-password-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'New Log Analysis' })).toBeVisible();

  await page.getByRole('button', { name: 'New Log Analysis' }).click();
  await page.getByLabel('Dataset / Log Stream Identifier').fill(filename);
  await page.locator('#event-log-file-input').setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(lines.join('\n')),
  });
  await expect(page.getByText(/Validated: 100000 CSV records/)).toBeVisible({ timeout: 60_000 });

  const analyzeResponse = page.waitForResponse(
    (response) => response.url().includes('/api/analyze') && response.request().method() === 'POST',
    { timeout: 150_000 },
  );
  await page.getByRole('button', { name: 'Run TraceMind Analysis Pipeline' }).click();
  const response = await analyzeResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: filename })).toBeVisible({ timeout: 150_000 });

  await page.getByRole('link', { name: 'History' }).click();
  const runRow = page.getByRole('row').filter({ hasText: filename });
  await expect(runRow).toBeVisible();
  await runRow.getByRole('button', { name: /^Delete run / }).click();
  await expect(runRow).toHaveCount(0);
});
