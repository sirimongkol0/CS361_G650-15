// Run against a local Next.js server; API responses are isolated browser fixtures.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3102';
const partners = [
  { id: 1, name: 'Alpha University', type: 'university', country: 'Thailand', countryCode: 'TH', description: 'Public university', contactName: null, contactEmail: null },
  { id: 2, name: 'Beta Government', type: 'government', country: 'Japan', countryCode: 'JP', description: 'Public government', contactName: 'Approved Coordinator', contactEmail: 'approved@example.test' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let releaseLoading;
    const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
    let fail = false, empty = false;
    await page.route('**/api/v1/partners/**', async route => {
      await loadingGate;
      const path = new URL(route.request().url()).pathname;
      const id = Number(path.split('/').pop());
      const row = partners.find(p => p.id === id);
      const status = fail ? 503 : id && !row ? 404 : 200;
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status !== 200 ? { detail: 'Test error' } : id ? row : empty ? [] : partners) });
    });
    await page.goto(`${base}/stakeholders`);
    await page.getByRole('status', { name: 'กำลังโหลดข้อมูล', exact: true }).waitFor();
    releaseLoading();
    await page.getByRole('link', { name: 'Alpha University', exact: true }).waitFor();
    await page.getByPlaceholder('ค้นหาหน่วยงานหรือผู้ติดต่อ...').fill('Beta');await page.waitForFunction(v=>(new URLSearchParams(location.search).get('q')??'')===v,'Beta');
    const filters = page.locator('select[aria-label]');
    await filters.nth(0).selectOption('government');
    await filters.nth(1).selectOption('🇯🇵 ญี่ปุ่น'); // countryCode JP is shown as a localized label
    assert.equal(await page.locator('tbody tr').count(), 1);
    await filters.nth(0).selectOption('university');
    await page.getByText('ไม่พบหน่วยงานที่ค้นหา', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.goto(`${base}/stakeholders/2`);
    await page.getByRole('heading', { name: 'Beta Government', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('link', { name: 'approved@example.test', exact: true }).waitFor();
    await page.goto(`${base}/stakeholders/999999`);
    await page.getByText('ไม่พบข้อมูลที่เผยแพร่', { exact: true }).waitFor();
    fail = true;
    await page.goto(`${base}/stakeholders`);
    await page.getByText('ไม่สามารถโหลดข้อมูลได้', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0);
    fail = false;
    await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
    await page.getByRole('link', { name: 'Alpha University', exact: true }).waitFor();
    empty = true;
    await page.reload();
    await page.getByText('ยังไม่มีข้อมูลที่เผยแพร่', { exact: true }).waitFor();
    console.log('PASS: stakeholders filters/reset, refresh, contact, 404, empty, error without mock, retry');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
