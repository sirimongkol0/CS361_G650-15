// Permanent regression test for admin lookup search and bulk save.
// All business API responses are mocked; no backend or database is touched.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');

const lookups = {
  respondentTypes: [
    { id: 1, code: 'student', name_th: 'นักศึกษา', is_active: true, sort_order: 0 },
    { id: 2, code: 'staff', name_th: 'เจ้าหน้าที่', is_active: true, sort_order: 1 },
  ],
  feedbackSources: [{ id: 3, code: 'web_form', name_th: 'เว็บฟอร์ม', is_active: true, sort_order: 0 }],
};
const outcomeTypes = [
  { id: 11, code: 'activity', name_th: 'กิจกรรม', unit: 'ครั้ง', is_active: true, sort_order: 0 },
  { id: 12, code: 'grant', name_th: 'ทุน', unit: 'บาท', is_active: true, sort_order: 1 },
];

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

    if (path.endsWith('/auth/me')) return json({ id: 1, email: 'admin@example.test', role: 'admin' });
    if (path.endsWith('/feedback/lookups')) return json(lookups);
    if (path.endsWith('/outcomes/lookups')) return json(outcomeTypes);
    if (request.method() === 'PATCH') {
      patches.push({ path, body: JSON.parse(request.postData() || '{}') });
      return json({ id: Number(path.split('/').pop()), code: 'x', name_th: 'x', is_active: true, sort_order: 0 });
    }
    return json([]);
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${base}/feedback/lookups`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'จัดการประเภทและแหล่งที่มาของความคิดเห็น' }).waitFor();
  await page.getByLabel('ค้นหาประเภทผู้ส่ง').fill('staff');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('section').first().locator('tbody tr').count(), 1, 'search filters respondent types');
  await page.locator('section').first().locator('tbody tr input').first().fill('เจ้าหน้าที่ทดสอบ');
  await page.getByRole('button', { name: /บันทึกทั้งหมด \(1\)/ }).click();
  await page.getByText('บันทึก 1 รายการแล้ว').waitFor();
  assert.equal(patches.filter((item) => item.path.includes('/feedback/lookups/')).length, 1);

  await page.goto(`${base}/outcomes/types`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'จัดการประเภทผลลัพธ์' }).waitFor();
  await page.getByLabel('ค้นหาประเภทผลลัพธ์').fill('grant');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('tbody tr').count(), 1, 'search filters outcome types');
  await page.locator('tbody tr input').first().fill('ทุนวิจัย');
  await page.getByRole('button', { name: /บันทึกทั้งหมด \(1\)/ }).click();
  await page.getByText('บันทึก 1 รายการแล้ว').waitFor();
  assert.equal(patches.filter((item) => item.path.includes('/outcomes/lookups/')).length, 1);
  assert.deepEqual(errors, []);

  console.log('PASS: admin search and save-all');
  await browser.close();
})().catch((error) => {
  console.error('FAIL: admin lookups', error);
  process.exit(1);
});
