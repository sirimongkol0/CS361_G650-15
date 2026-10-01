// Run against a local Next.js server; API responses are isolated browser fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3136';
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v2-improvements', 'ui');
const partner = (id, name, scopeLevel) => ({ id, name, type: 'university', country: 'Thailand', countryCode: 'TH', description: 'Public record', scopeLevel, sources: [] });
const partners = [
  partner(1, 'Program Partner', 'program'), partner(2, 'Faculty Partner', 'faculty'),
  partner(3, 'University Partner', 'university'), partner(4, 'Unclassified Partner', null),
];
const activity = (id, name, scopeLevel) => ({ id, name, date: '2026-01-0' + id, dateKind: 'event', datePrecision: 'day', status: 'เสร็จสิ้น', activity_type: 'seminar', scopeLevel, sources: [] });
const activities = [
  activity(1, 'Program Activity', 'program'), activity(2, 'Faculty Activity', 'faculty'),
  activity(3, 'University Activity', 'university'), activity(4, 'Second Program Activity', 'program'),
  activity(5, 'Unclassified Activity', null),
];
const doc = (id, name, scopeLevel) => ({ id, name, documentKind: 'agreement', docType: 'mou', status: 'active', effectiveDate: '2026-01-01', expiryDate: '2027-01-01', fileAvailability: 'metadata_only', scopeLevel, sources: [], scopeItems: [] });
const docs = [doc(1, 'Program Agreement', 'program'), doc(2, 'Faculty Agreement', 'faculty'), doc(3, 'University Agreement', 'university')];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/**', async route => {
      const parts = new URL(route.request().url()).pathname.split('/').filter(Boolean);
      const type = parts[2], id = Number(parts[3]);
      const rows = { partners, activities, documents: docs }[type] || [];
      const body = id ? rows.find(row => row.id === id) : rows;
      await route.fulfill({ status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body || { detail: 'Not found' }) });
    });
    const levelSelect = () => page.getByLabel('ระดับความร่วมมือ');
    const rows = () => page.locator('tbody tr');

    // Each list shows a level badge per row and filters by level, kept in the URL.
    for (const [route, first, facultyName, total, programRows] of [
      ['stakeholders', 'Program Partner', 'Faculty Partner', 4, 1],
      ['activities', 'Program Activity', 'Faculty Activity', 5, 2],
      ['documents', 'Program Agreement', 'Faculty Agreement', 3, 1],
    ]) {
      await page.goto(`${base}/${route}`);
      await page.getByRole('link', { name: first, exact: true }).waitFor();
      assert.equal(await rows().count(), total);
      assert.match(await rows().filter({ hasText: first }).first().innerText(), /หลักสูตร CSTU/);
      assert.match(await rows().filter({ hasText: facultyName }).first().innerText(), /ระดับคณะ/);
      await levelSelect().selectOption('faculty');
      assert.equal(await rows().count(), 1);
      assert.match(await rows().first().innerText(), new RegExp(facultyName));
      assert.equal(new URL(page.url()).searchParams.get('scope'), 'faculty');
      await page.reload();
      await page.getByRole('link', { name: facultyName, exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('select[aria-label="ระดับความร่วมมือ"]').value === 'faculty');
      assert.equal(await rows().count(), 1);
      await page.getByRole('link', { name: facultyName, exact: true }).click();
      await page.waitForURL(new RegExp(`/${route}/\\d+$`));
      await page.goBack();
      await page.getByRole('link', { name: facultyName, exact: true }).waitFor();
      assert.equal(await levelSelect().inputValue(), 'faculty');
      assert.equal(await rows().count(), 1);
      await levelSelect().selectOption('program');
      assert.equal(await rows().count(), programRows);
      await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
      assert.equal(new URL(page.url()).search, '');
      assert.equal(await rows().count(), total);
      await page.screenshot({ path: path.join(output, `scope-${route}-desktop.png`), fullPage: true });
    }
    checks.push('stakeholder/activity/document level badge, filter, URL sync, reload, back and reset');

    // Unclassified records show no badge and match no specific level.
    await page.goto(`${base}/activities?scope=university`);
    await page.getByRole('link', { name: 'University Activity', exact: true }).waitFor();
    assert.equal(await rows().count(), 1);
    await page.goto(`${base}/activities`);
    await page.getByRole('link', { name: 'Unclassified Activity', exact: true }).waitFor();
    assert.doesNotMatch(await rows().filter({ hasText: 'Unclassified Activity' }).innerText(), /หลักสูตร CSTU|ระดับคณะ|ระดับมหาวิทยาลัย/);
    checks.push('unclassified rows have no badge and are excluded by a specific level');

    // Dashboard separates CSTU-direct numbers from faculty/university ones.
    await page.goto(`${base}/dashboard/public`);
    await page.getByText('ระดับคณะ/มหาวิทยาลัย', { exact: false }).first().waitFor();
    const card = name => page.locator('.stat-card').filter({ hasText: name });
    for (const [name, direct, broader, unclassified] of [
      ['คู่ความร่วมมือ (CSTU โดยตรง)', '1', 2, 1], ['กิจกรรม (CSTU โดยตรง)', '2', 2, 1], ['ข้อตกลง MoU/MoA (CSTU โดยตรง)', '1', 2, 0],
    ]) {
      assert.equal(await card(name).locator('.text-2xl').innerText(), direct);
      const text = await card(name).innerText();
      assert.match(text, /CSTU โดยตรง/);
      assert.match(text, new RegExp(`ระดับคณะ/มหาวิทยาลัยอีก ${broader} `));
      assert.equal(/ยังไม่จัดระดับ/.test(text), unclassified > 0);
      if (unclassified) assert.match(text, new RegExp(`ยังไม่จัดระดับ ${unclassified}`));
    }
    const intro = await page.locator('h1').first().locator('xpath=../..').innerText();
    assert.match(intro, /ข้อตกลงระดับคณะ\/มหาวิทยาลัยที่เกี่ยวข้อง/);
    await page.screenshot({ path: path.join(output, 'scope-dashboard-desktop.png'), fullPage: true });
    checks.push('dashboard KPI split and subtitle that does not claim every record is CSTU');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'scope-level-result.json'), JSON.stringify({ status: 'passed', checks, fixtureMode: 'isolated UI request interception' }, null, 2));
    checks.forEach(check => console.log('PASS:', check));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
