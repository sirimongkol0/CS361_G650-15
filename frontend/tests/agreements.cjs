const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3103';
const documents = [
  { id: 1, name: 'Alpha Agreement', docType: 'mou', documentKind: 'agreement', status: 'active', effectiveDate: '2026-01-01', expiryDate: '2026-12-31', partnerId: 1, partner: { id: 1, name: 'Alpha University' }, responsible: 'Coordinator', storageKey: 'agreements/first.pdf', fileName: 'agreement.pdf', mimeType: 'application/pdf', sizeBytes: 13, fileAvailability: 'available', scopeItems: [], sources: [] },
  { id: 2, name: 'Beta Agreement', docType: 'moa', documentKind: 'agreement', status: 'expired', effectiveDate: '2025-01-01', expiryDate: '2025-12-31', fileAvailability: 'metadata_only', scopeItems: [], sources: [] },
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let releaseLoading;
    const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
    let fail = false, empty = false, missingFile = false;
    await page.route('**/api/v1/documents/**', async route => {
      await loadingGate;
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/download')) {
        await route.fulfill({ status: missingFile ? 404 : 200, contentType: 'application/pdf', body: missingFile ? 'Not found' : '%PDF-1.4 test' });
        return;
      }
      const id = Number(path.split('/').pop()), row = documents.find(d => d.id === id);
      const status = fail ? 503 : id && !row ? 404 : 200;
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status !== 200 ? { detail: 'Test error' } : id ? row : empty ? [] : documents) });
    });
    await page.goto(`${base}/documents`);
    await page.getByText('กำลังโหลดเอกสาร', { exact: true }).waitFor();
    releaseLoading();
    await page.getByRole('link', { name: 'Alpha Agreement', exact: true }).waitFor();
    await page.getByPlaceholder('ค้นหาชื่อข้อตกลง, หน่วยงาน...').fill('Alpha');
    await page.getByLabel('ประเภทเอกสาร').selectOption('MOU');
    await page.getByLabel('สถานะเอกสาร').selectOption('active');
    await page.getByLabel('ช่วงเวลาที่มีผลจาก').fill('2026-12-31');
    await page.getByLabel('ช่วงเวลาที่มีผลถึง').fill('2026-12-31');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByLabel('สถานะเอกสาร').selectOption('expired');
    await page.getByText('ไม่พบเอกสารที่ค้นหา', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.goto(`${base}/documents/1`);
    await page.getByRole('heading', { name: 'Alpha Agreement', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Alpha University', exact: true }).getAttribute('href'), '/stakeholders/1');
    await page.reload();
    await page.getByRole('heading', { name: 'Alpha Agreement', exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลดเอกสาร 1', exact: true }).first().click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'agreement.pdf');
    const stream = await download.createReadStream();
    let bytes = ''; for await (const chunk of stream) bytes += chunk.toString();
    assert.equal(bytes, '%PDF-1.4 test');
    missingFile = true;
    await page.getByRole('button', { name: 'ดาวน์โหลดเอกสาร 1', exact: true }).first().click();
    await page.getByText('ไม่พบไฟล์เอกสารที่พร้อมดาวน์โหลด', { exact: true }).waitFor();
    missingFile = false;
    const retryDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลดเอกสาร 1', exact: true }).first().click();
    await retryDownload;
    await page.goto(`${base}/documents/2`);
    await page.getByRole('heading', { name: 'Beta Agreement', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /ดาวน์โหลดเอกสาร/ }).count(), 0);
    await page.goto(`${base}/documents/999999`);
    await page.getByText('ไม่พบข้อมูลที่เผยแพร่', { exact: true }).waitFor();
    fail = true;
    await page.goto(`${base}/documents/1`);
    await page.getByText('ไม่สามารถโหลดข้อมูลได้', { exact: true }).waitFor();
    fail = false;
    await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
    await page.getByRole('heading', { name: 'Alpha Agreement', exact: true }).waitFor();
    fail = true;
    await page.goto(`${base}/documents`);
    await page.getByText('ไม่สามารถโหลดข้อมูลได้', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0);
    fail = false;
    await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
    await page.getByRole('link', { name: 'Alpha Agreement', exact: true }).waitFor();
    empty = true;
    await page.reload();
    await page.getByText('ยังไม่มีเอกสารที่เผยแพร่', { exact: true }).waitFor();
    console.log('PASS: agreement filters/reset, refresh, partner link, exact download bytes, missing file/retry, metadata-only, 404, list/detail error/retry, empty');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
