// Permanent regression test for the import step guide and upload state.
// All business API responses are mocked; no backend or database is touched.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');

const batch = {
  id: 1,
  kind: 'feedback',
  sourceCode: 'file_import',
  fileName: 'feedback.csv',
  status: 'previewed',
  totalRows: 10,
  validRows: 8,
  invalidRows: 2,
  errors: [{ row: 2, message: 'missing title' }],
  previewData: [{ title: 'ความคิดเห็นตัวอย่าง', external_id: 'F-1' }],
  createdAt: '2026-11-03T10:00:00Z',
  committedAt: null,
  rolledBackAt: null,
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const patches = [];
  await context.addInitScript(() => sessionStorage.setItem('pcsms_access_token', 'test-token'));
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/me')) return json({ id: 7, email: 'staff@example.test', role: 'staff' });
    if (path === '/api/v1/imports/' || path === '/api/v1/imports') {
      if (request.method() === 'POST') return json({ ...batch, id: 2, status: 'processing' }, 201);
      return json([batch]);
    }
    if (path.endsWith('/imports/1')) return json(batch);
    if (path.endsWith('/imports/2')) return json({ ...batch, id: 2, status: 'processing' });
    if (request.method() !== 'GET') patches.push({ path, method: request.method() });
    return json([]);
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${base}/imports`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'ขั้นตอนการนำเข้า' }).waitFor();

  let current = await page.locator('[aria-current=step]').innerText();
  assert.ok(current.includes('เลือกไฟล์'), 'starts at choose-file step');

  await page.getByRole('button', { name: /#1/ }).click();
  await page.getByRole('button', { name: /ยืนยันนำเข้า \(8\)/ }).waitFor();
  current = await page.locator('[aria-current=step]').innerText();
  assert.ok(current.includes('ยืนยันนำเข้า'), 'previewed batch advances to confirm');

  const upload = page.getByRole('button', { name: 'อัปโหลดและตรวจสอบ' });
  assert.equal(await upload.isDisabled(), true, 'upload disabled before a file is chosen');
  await page.locator('#import-file').setInputFiles({
    name: 'feedback-sample.csv', mimeType: 'text/csv', buffer: Buffer.from('title,comment\nx,y\n'),
  });
  await page.getByText(/พร้อมอัปโหลด: feedback-sample.csv/).waitFor();
  assert.equal(await upload.isDisabled(), false, 'upload enabled after choosing a file');

  await upload.click();
  await page.getByText(/รับไฟล์แล้ว/).waitFor();
  current = await page.locator('[aria-current=step]').innerText();
  assert.ok(current.includes('ตรวจข้อมูล'), 'upload switches to checking step');
  assert.deepEqual(errors, []);

  console.log('PASS: imports step guide, preview confirmation, and upload state');
  await browser.close();
})().catch((error) => {
  console.error('FAIL: imports', error);
  process.exit(1);
});
