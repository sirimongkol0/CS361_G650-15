// Permanent regression test for feedback status tabs and collapsed advanced filters.
// All business API responses are mocked; no backend or database is touched.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');

const feedback = [
  {
    id: 1, title: 'รอตรวจ', source: 'web_form', respondentTypeId: 1, respondentTypeName: 'เจ้าหน้าที่',
    rating: 5, date: '2026-11-01', status: 'pending', comment: 'ยังรอตรวจ', partnerId: 21, isPublished: false,
  },
  {
    id: 2, title: 'ตรวจแล้ว', source: 'web_form', respondentTypeId: 1, respondentTypeName: 'เจ้าหน้าที่',
    rating: 4, date: '2026-10-01', status: 'reviewed', comment: 'ตรวจแล้ว', partnerId: 21, isPublished: true,
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => sessionStorage.setItem('pcsms_access_token', 'test-token'));
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/me')) return json({ id: 7, email: 'staff@example.test', role: 'staff' });
    if (path === '/api/v1/feedback/' || path === '/api/v1/feedback/mine') return json(feedback);
    if (path.endsWith('/feedback/respondent-types')) return json([{ id: 1, name_th: 'เจ้าหน้าที่', code: 'staff' }]);
    if (path.endsWith('/partners/')) return json([{ id: 21, name: 'มหาวิทยาลัยทดสอบ' }]);
    if (path.endsWith('/activities/')) return json([]);
    if (path.endsWith('/documents/')) return json([]);
    if (path.includes('/exchange')) return json([]);
    return json([]);
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${base}/feedback`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'ความคิดเห็น', level: 1 }).waitFor();
  await page.getByText('แสดง 2 จาก 2 รายการ').waitFor();
  await page.getByRole('img', { name: '5 จาก 5 ดาว' }).first().waitFor();

  const statusGroup = page.getByRole('group', { name: 'สถานะความคิดเห็น' });
  await statusGroup.getByRole('button', { name: /รอตรวจสอบ/ }).click();
  assert.equal(await page.getByRole('button', { name: /รอตรวจ.*ฟอร์มบนเว็บ/ }).count(), 1, 'pending card shown');
  assert.equal(await page.getByRole('button', { name: /ตรวจแล้ว.*ฟอร์มบนเว็บ/ }).count(), 0, 'pending tab hides reviewed');

  await statusGroup.getByRole('button', { name: /ตรวจสอบแล้ว/ }).click();
  assert.equal(await page.getByRole('button', { name: /ตรวจแล้ว.*ฟอร์มบนเว็บ/ }).count(), 1, 'reviewed card shown');
  assert.equal(await page.getByRole('button', { name: /รอตรวจ.*ฟอร์มบนเว็บ/ }).count(), 0, 'reviewed tab hides pending');

  await page.getByText('ตัวกรองเพิ่มเติม').click();
  assert.equal(await page.getByLabel('ช่องทาง').isVisible(), true, 'advanced filters open');
  await page.getByLabel('ตั้งแต่วันที่').fill('2026-11-01');
  await page.getByText('1 พ.ย. 2569').waitFor();
  assert.deepEqual(errors, []);

  console.log('PASS: feedback status tabs and advanced filters');
  await browser.close();
})().catch((error) => {
  console.error('FAIL: feedback triage', error);
  process.exit(1);
});
