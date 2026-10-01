const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3136';
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v2-improvements', 'ui');
const docs = [
  { id: 1, name: 'Alpha Agreement', scopeLevel: 'program', documentKind: 'agreement', docType: 'mou', status: 'active', effectiveDate: '2026-01-01', expiryDate: '2026-12-31', partnerId: 1, partner: {id: 1, name: 'Distinctive University'}, fileAvailability: 'metadata_only', sources: [], scopeItems: [] },
  { id: 2, name: 'Beta Agreement', documentKind: 'agreement', docType: 'moa', status: 'expired', effectiveDate: '2025-01-01', expiryDate: '2025-12-31', fileAvailability: 'metadata_only', sources: [], scopeItems: [] },
  { id: 3, name: 'Application template', documentKind: 'template', docType: 'template', status: null, fileAvailability: 'metadata_only', sources: [], scopeItems: [] },
];
const activities = [
  {id: 1, name: 'Older activity', date: '2025-01-01', dateKind: 'event', datePrecision: 'day', status: 'เสร็จสิ้น', sources: []},
  {id: 2, name: 'Announcement record', date: '2026-10-01', dateKind: 'announcement', datePrecision: 'month', status: null, isOpen: null, sources: []},
  {id: 3, name: 'Undated record', date: null, status: null, isOpen: null, sources: []},
  {id: 4, name: 'Year precision record', date: '2026-01-01', dateKind: 'event', datePrecision: 'year', status: 'วางแผน', sources: []},
];
(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const checks = [];
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/**', async route => {
      const parts = new URL(route.request().url()).pathname.split('/').filter(Boolean);
      const type = parts[2], id = Number(parts[3]);
      const rows = type === 'documents' ? docs : type === 'activities' ? activities : [];
      const body = id ? rows.find(row => row.id === id) : rows;
      await route.fulfill({status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body || {detail: 'Not found'})});
    });
    await page.goto(`${base}/documents`);
    await page.getByRole('link', {name: 'Alpha Agreement', exact: true}).waitFor();
    await page.getByPlaceholder('ค้นหาชื่อข้อตกลง, หน่วยงาน...').fill('Distinctive');await page.waitForFunction(v=>(new URLSearchParams(location.search).get('q')??'')===v,'Distinctive');
    await page.getByLabel('ประเภทเอกสาร').selectOption('MOU');
    await page.getByLabel('สถานะเอกสาร').selectOption('active');
    await page.getByLabel('ช่วงเวลาที่มีผลจาก').fill('2026-12-31');
    await page.getByLabel('ช่วงเวลาที่มีผลถึง').fill('2026-12-31');
    assert.equal(await page.locator('tbody tr').count(), 1);
    const filteredUrl = page.url();
    assert.equal(new URL(filteredUrl).searchParams.get('status'), 'active');
    await page.reload();
    await page.getByRole('link', {name: 'Alpha Agreement', exact: true}).waitFor();
    await page.waitForFunction(() => document.querySelector('input[placeholder="ค้นหาชื่อข้อตกลง, หน่วยงาน..."]').value === 'Distinctive');
    assert.equal(await page.getByLabel('สถานะเอกสาร').inputValue(), 'active');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('link', {name: 'Alpha Agreement', exact: true}).click();
    await page.getByRole('heading', {name: 'Alpha Agreement', exact: true}).waitFor();
    await page.goBack();
    await page.getByRole('link', {name: 'Alpha Agreement', exact: true}).waitFor();
    assert.equal(page.url(), filteredUrl);
    assert.equal(await page.getByLabel('สถานะเอกสาร').inputValue(), 'active');
    await page.screenshot({path: path.join(output, 'documents-filtered-desktop.png'), fullPage: true});
    await page.getByRole('button', {name: 'ล้างตัวกรอง', exact: true}).click();
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.locator('tbody tr').count(), 3);
    await page.getByLabel('สถานะเอกสาร').selectOption('unknown');
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.match(await page.locator('tbody').innerText(), /Application template/);
    await page.evaluate(() => {
      window.history.pushState(window.history.state, '', '/documents?status=expired');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() => document.querySelector('select[aria-label="สถานะเอกสาร"]').value === 'expired');
    assert.match(await page.locator('tbody').innerText(), /Beta Agreement/);
    checks.push('document partner search, combined status/type/date, refresh/back, reset, unknown and popstate');

    await page.goto(`${base}/activities/2`);
    await page.getByRole('heading', {name: 'Announcement record', exact: true}).waitFor();
    await page.getByText('วันประกาศ: ต.ค. 2569', {exact: true}).waitFor();
    assert.equal(await page.getByText('กำลังดำเนินการ', {exact: true}).count(), 0);
    assert.equal(await page.getByText('เสร็จสิ้น', {exact: true}).count(), 0);
    assert.match(await page.locator('dl').innerText(), /เปิดรับสมัคร\s+ไม่ระบุ/);
    await page.screenshot({path: path.join(output, 'announcement-desktop.png'), fullPage: true});
    await page.goto(`${base}/activities/3`);
    await page.getByText('ไม่ระบุวันที่', {exact: true}).waitFor();
    await page.goto(`${base}/activities/4`);
    await page.getByText('2569', {exact: true}).waitFor();
    await page.goto(`${base}/activities`);
    await page.getByRole('link', {name: 'Undated record', exact: true}).waitFor();
    await page.getByLabel('สถานะกิจกรรม').selectOption('ไม่ระบุ');
    assert.equal(await page.locator('tbody tr').count(), 2);
    checks.push('unknown status/date/enrollment and announcement/month/year precision');

    await page.goto(`${base}/dashboard/public`);
    const latest = page.locator('section').filter({has: page.getByRole('heading', {name: 'กิจกรรมล่าสุด', exact: true})});
    await latest.getByRole('link', {name: /Announcement record/}).waitFor();
    assert.deepEqual(await latest.locator('a[href^="/activities/"]').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/activities/2', '/activities/4', '/activities/1', '/activities/3']);
    const agreements = page.locator('section').filter({has: page.getByRole('heading', {name: 'เอกสารข้อตกลง', exact: true})});
    assert.equal(await agreements.locator('a[href^="/documents/"]').count(), 2);
    assert.equal(await agreements.getByText('Application template', {exact: true}).count(), 0);
    // Headline = CSTU-direct agreements (Alpha only); Beta has no level yet.
    assert.equal(await page.locator('.stat-card').filter({hasText: 'ข้อตกลง MoU/MoA (CSTU โดยตรง)'}).locator('.text-2xl').innerText(), '1');
    await page.screenshot({path: path.join(output, 'dashboard-desktop.png'), fullPage: true});
    checks.push('dashboard latest order and agreement-only count/list');
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`${base}/documents`);
    await page.getByRole('link', {name: 'Alpha Agreement', exact: true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({path: path.join(output, 'documents-mobile.png'), fullPage: true});
    assert.deepEqual(errors, []);
    checks.push('mobile document layout and no browser runtime errors');
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({status: 'passed', checks, fixtureMode: 'isolated UI request interception'}, null, 2));
    checks.forEach(check => console.log('PASS:', check));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
