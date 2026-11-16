import { expect, test } from '@playwright/test';

const email = `e2e-${Date.now()}@example.com`;
const password = 'local-e2e-password-2026';
const dataset = [
  {event_id:'e1',timestamp:'2026-11-16T08:00:00Z',service:'checkout',event_type:'PAYMENT',source_ip:'10.0.0.1',latency_ms:35,error_rate:.01,cpu_pct:22,memory_mb:512,payload_bytes:400,status_code:200},
  {event_id:'e2',timestamp:'2026-11-16T08:01:00Z',service:'checkout',event_type:'PAYMENT',source_ip:'10.0.0.2',latency_ms:38,error_rate:.01,cpu_pct:24,memory_mb:520,payload_bytes:420,status_code:200},
  {event_id:'e3',timestamp:'2026-11-16T08:02:00Z',service:'checkout',event_type:'PAYMENT',source_ip:'10.0.0.3',latency_ms:2800,error_rate:.92,cpu_pct:98,memory_mb:4096,payload_bytes:42000,status_code:503},
  {event_id:'e4',timestamp:'2026-11-16T08:03:00Z',service:'identity',event_type:'LOGIN',source_ip:'10.0.0.4',latency_ms:42,error_rate:.02,cpu_pct:30,memory_mb:580,payload_bytes:512,status_code:200},
  {event_id:'e5',timestamp:'2026-11-16T08:04:00Z',service:'identity',event_type:'LOGIN',source_ip:'10.0.0.5',latency_ms:40,error_rate:.01,cpu_pct:27,memory_mb:550,payload_bytes:500,status_code:200},
];

test('register, analyze, inspect, persist, logout and restore through browser', async ({page,context},testInfo) => {
  test.setTimeout(150000);
  page.on('response', response=>{ if(response.url().includes('/api/analyze')) console.log('E2E analyze status',response.status()); });
  const responseCookies:string[]=[];
  page.on('response', async response=>{ if(response.url().includes('/api/auth/') && ['register','login','refresh'].some(s=>response.url().endsWith(`/auth/${s}`))) responseCookies.push(...(response.headers()['set-cookie']?[response.headers()['set-cookie']]:[])); });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  await page.getByRole('button',{name:'New here? Create an account'}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button',{name:'Create account'}).click();
  expect(await page.getByLabel('Password').evaluate((input:HTMLInputElement)=>input.validity.tooShort)).toBeTruthy();
  await page.getByLabel('Password').fill(password);
  await page.route('**/api/auth/register',async route=>{
    const response=await route.fetch();
    await new Promise(resolve=>setTimeout(resolve,400));
    await route.fulfill({response});
  });
  await page.getByRole('button',{name:'Create account'}).click();
  await expect(page.getByRole('button',{name:'Please wait…'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'New Log Analysis'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/See what your systems reveal/})).toBeVisible();
  const cookie= (await context.cookies()).find(c=>c.name==='tracemind_refresh');
  expect(cookie?.httpOnly).toBeTruthy(); expect(cookie?.sameSite).toBe('Strict'); expect(cookie?.secure).toBeFalsy();
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('authenticated-overview.png'),fullPage:true});

  await page.getByRole('button',{name:'New Log Analysis'}).click();
  await page.getByLabel('Dataset / Log Stream Identifier').fill('browser-e2e.json');
  await page.getByLabel('Raw Event-Log Stream Content').fill(JSON.stringify(dataset));
  await page.getByRole('button',{name:'Run TraceMind Analysis Pipeline'}).click();
  const invalidControls=await page.locator(':invalid').evaluateAll(els=>els.map(el=>({tag:el.tagName,id:(el as HTMLElement).id,message:(el as HTMLInputElement).validationMessage,outer:el.outerHTML.slice(0,240)})));
  expect(invalidControls).toEqual([]);
  await expect(page.getByRole('heading',{name:'browser-e2e.json'})).toBeVisible({timeout:30000});
  await page.getByRole('link',{name:'Investigate'}).click();
  await page.getByRole('tab',{name:'Recommendation'}).click();
  await expect(page.getByText('Intelligent Agent Reasoning')).toBeVisible();
  await expect(page.getByRole('heading',{name:/PSO Action Optimization/})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('investigation-recommendation.png'),fullPage:true});
  await page.getByRole('link',{name:'History'}).click();
  await expect(page.getByText('browser-e2e.json',{exact:true})).toBeVisible();

  await page.waitForTimeout(62000);
  await page.getByRole('button',{name:'New Log Analysis'}).click();
  await page.getByLabel('Dataset / Log Stream Identifier').fill('after-expiry.json');
  await page.getByLabel('Raw Event-Log Stream Content').fill(JSON.stringify(dataset));
  await page.getByRole('button',{name:'Run TraceMind Analysis Pipeline'}).click();
  await expect(page.getByRole('heading',{name:'after-expiry.json'})).toBeVisible({timeout:30000});
  const afterRefresh=(await context.cookies()).find(c=>c.name==='tracemind_refresh');
  expect(afterRefresh?.value).not.toEqual(cookie?.value);
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  await page.goto('/#history');
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.getByRole('button',{name:'New Log Analysis'})).toBeVisible();
  await page.getByRole('link',{name:'History'}).click();
  await expect(page.getByText('browser-e2e.json',{exact:true})).toBeVisible();
});

test('login errors, validation, responsive auth and missing refresh fail closed',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
  await page.getByLabel('Email address').fill(`missing-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('not-a-valid-password');
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await context.clearCookies();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
});
