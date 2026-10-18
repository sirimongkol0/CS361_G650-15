// V3-6 (#78): the web sends the login token and handles 401/403.
// Runs against the real frontend and API; only /auth/me and the protected
// responses are faked, so no Cognito account or password is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v3-auth', 'v3-auth');
const TOKEN = 'test-token-123';

// The API may be on another origin (CI), so faked responses carry CORS headers
// and answer the preflight that an Authorization header triggers.
function fulfill(route, status, body) {
  const headers = {
    'Access-Control-Allow-Origin': base,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (status === 204) return route.fulfill({ status, headers });
  return route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

const apiPath = (url) => new URL(url).pathname;
const isApi = (request) => apiPath(request.url()).startsWith('/api/v1/') && request.method() !== 'OPTIONS';

async function signedIn(browser, role, routes = {}) {
  const context = await browser.newContext();
  // Seed the token once per tab, like a real login (not on every navigation).
  await context.addInitScript((token) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      sessionStorage.setItem('pcsms_access_token', token);
    }
  }, TOKEN);
  await context.route('**/api/v1/auth/me', (r) => fulfill(r, 200, { id: 7, email: `${role}@example.test`, role }));
  for (const [pattern, [status, body]] of Object.entries(routes)) {
    await context.route(pattern, (r) => fulfill(r, status, body));
  }
  return context;
}

const cases = [];
async function check(name, work) { await work(); cases.push(name); console.log('PASS:', name); }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    await check('anonymous: public pages send no Authorization header', async () => {
      const page = await browser.newPage();
      const auth = [];
      page.on('request', (r) => { if (isApi(r)) auth.push(r.headers().authorization ?? null); });
      await page.goto(`${base}/documents`, { waitUntil: 'networkidle' });
      assert.ok(auth.length > 0, 'the page called the API');
      assert.ok(auth.every((h) => h === null), `no token expected, got ${auth}`);
      await page.close();
    });

    await check('anonymous: /exchange reads the published list GET /exchange/', async () => {
      const page = await browser.newPage();
      const paths = new Set();
      page.on('request', (r) => { if (isApi(r) && apiPath(r.url()).startsWith('/api/v1/exchange')) paths.add(apiPath(r.url())); });
      await page.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      assert.match(page.url(), /\/exchange$/);
      assert.deepEqual([...paths], ['/api/v1/exchange/']);
      await page.close();
    });

    await check('signed in: every API call carries the token and /exchange reads /exchange/mine', async () => {
      const context = await signedIn(browser, 'staff', {
        '**/api/v1/exchange/mine': [200, [{ id: 1, name: 'นักศึกษาสมมติ V3-6', type: 'outbound', program: 'Student Exchange', status: 'กำลังดำเนินการ' }]],
      });
      const page = await context.newPage();
      const seen = [];
      page.on('request', (r) => { if (isApi(r)) seen.push([apiPath(r.url()), r.headers().authorization ?? null]); });
      await page.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await page.getByText('นักศึกษาสมมติ V3-6').waitFor();
      const exchange = new Set(seen.filter(([p]) => p.startsWith('/api/v1/exchange')).map(([p]) => p));
      assert.deepEqual([...exchange], ['/api/v1/exchange/mine'], 'the public list is never shown first');
      assert.ok(seen.every(([, h]) => h === `Bearer ${TOKEN}`), 'token on every request');
      await page.screenshot({ path: path.join(output, 'staff-exchange.png'), fullPage: true });
      await context.close();
    });

    await check('403: the page says "ไม่มีสิทธิ์เข้าถึง" instead of showing an empty list', async () => {
      const context = await signedIn(browser, 'student', {
        '**/api/v1/exchange/mine': [403, { detail: 'Insufficient permissions' }],
      });
      const page = await context.newPage();
      await page.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await page.getByText('ไม่มีสิทธิ์เข้าถึง').waitFor();
      assert.equal(await page.getByText('เพิ่มนักศึกษา').count(), 0, 'students get no add button');
      await page.screenshot({ path: path.join(output, 'student-403.png'), fullPage: true });
      await context.close();
    });

    await check('401 while signed in (expired token): signed out and sent to /login?next=', async () => {
      const context = await signedIn(browser, 'coordinator', {
        '**/api/v1/exchange/mine': [401, { detail: 'Token has expired' }],
      });
      const page = await context.newPage();
      await page.goto(`${base}/exchange`);
      await page.waitForURL(/\/login\?next=%2Fexchange$/, { timeout: 10000 });
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pcsms_access_token')), null);
      await context.close();
    });

    await check('logout: token cleared and later requests carry no Authorization', async () => {
      const context = await signedIn(browser, 'staff', { '**/api/v1/auth/logout': [204, null] });
      const page = await context.newPage();
      await page.goto(`${base}/documents`, { waitUntil: 'networkidle' });
      await page.getByTitle('ออกจากระบบ').click();
      await page.waitForURL(/\/dashboard\/public$/);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pcsms_access_token')), null);
      const after = [];
      page.on('request', (r) => { if (isApi(r)) after.push(r.headers().authorization ?? null); });
      await page.goto(`${base}/activities`, { waitUntil: 'networkidle' });
      assert.ok(after.length > 0 && after.every((h) => h === null), `no token after logout, got ${after}`);
      await context.close();
    });
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ status: 'passed', cases }, null, 2));
  console.log(`${cases.length} V3-6 checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
