// Real API/DB/browser verification; no intercepted business responses.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3100';
const output = path.resolve('.tmp-fictional-demo');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const get = async url => {
    const response = await fetch(`${base}/api/v1/${url}`);
    assert.equal(response.status, 200, url);
    return response.json();
  };
  const [partners, documents, activities] = await Promise.all(['partners/', 'documents/', 'activities/'].map(get));
  assert.deepEqual([partners.length, documents.length, activities.length], [29, 23, 93]);
  assert.equal(documents.filter(row => row.documentKind === 'agreement').length, 22);
  assert.equal(partners.filter(row => row.type === 'alumni').length, 3);
  assert.equal(partners.filter(row => row.type === 'expert').length, 3);
  for (const group of [partners, documents, activities]) {
    for (const row of group) assert.equal(row.sources[0].sourceType, 'demo_fixture');
  }
  const arun = partners.find(row => row.name === 'มหาวิทยาลัยรุ่งอรุณวิทยา');
  assert.equal(arun.contactName, null);
  assert.equal(arun.contactEmail, null);
  const agreement = documents.find(row => row.name.includes('แลกเปลี่ยนนักศึกษา รุ่งอรุณ'));
  assert.equal(agreement.partnerId, arun.id);
  const event = activities.find(row => row.name.includes('ปฐมนิเทศนักศึกษาแลกเปลี่ยน'));
  assert.equal(event.partner.id, arun.id);
  assert.equal(event.mouDocId, agreement.id);
  const alumni = partners.find(row => row.name === 'คุณภูมิ ไบต์ทอง (ศิษย์เก่ารุ่น 12)');
  const alumniEvent = activities.find(row => row.name.includes('รุ่นพี่เล่า: เส้นทางสายซอฟต์แวร์'));
  assert.equal(alumniEvent.partner.id, alumni.id);
  assert.equal(alumniEvent.mouDocId, null);
  assert.equal((await get('partners/?partner_type=expert')).length, 3);
  assert.equal((await get('documents/?status=expired')).length, 11);
  const response = await fetch(`${base}/api/v1/documents/${agreement.id}/download`);
  assert.equal(response.status, 200);
  const pdf = Buffer.from(await response.arrayBuffer());
  const fixture = await fs.readFile(path.resolve('backend/fixtures/demo-documents/demo-agreement-1.pdf'));
  assert.deepEqual(pdf, fixture);

  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/stakeholders`);
    await page.getByRole('note').filter({ hasText: 'ระบบสาธิต · ข้อมูลตัวอย่าง' }).waitFor();
    await page.getByRole('link', { name: alumni.name, exact: true }).waitFor();
    await page.getByLabel('ประเภทหน่วยงาน').selectOption('alumni');
    await page.getByText('แสดง 3 จาก 29 รายการ', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'alumni-filter.png'), fullPage: true });
    await page.getByRole('link', { name: alumni.name, exact: true }).click();
    await page.getByRole('heading', { name: alumni.name, exact: true }).waitFor();
    await page.getByRole('link', { name: alumniEvent.name, exact: true }).click();
    await page.getByRole('heading', { name: alumniEvent.name, exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: alumniEvent.name, exact: true }).waitFor();

    await page.goto(`${base}/stakeholders/${arun.id}`);
    assert.equal(await page.locator('a[href*="example.test"]').count(), 0);
    await page.getByRole('link', { name: agreement.name, exact: true }).click();
    await page.getByRole('heading', { name: agreement.name, exact: true }).waitFor();
    await page.getByRole('link', { name: event.name, exact: true }).waitFor();
    const downloadWait = page.waitForEvent('download');
    await page.getByRole('button', { name: `ดาวน์โหลดเอกสาร ${agreement.id}`, exact: true }).click();
    const download = await downloadWait;
    assert.equal(download.suggestedFilename(), agreement.fileName);
    assert.deepEqual(await fs.readFile(await download.path()), fixture);
    await page.screenshot({ path: path.join(output, 'agreement-detail.png'), fullPage: true });

    for (const row of documents.filter(row => row.fileAvailability !== 'available')) {
      await page.goto(`${base}/documents/${row.id}`);
      await page.getByRole('heading', { name: row.name, exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: `ดาวน์โหลดเอกสาร ${row.id}`, exact: true }).count(), 0);
    }
    await page.goto(`${base}/documents`);
    await page.getByRole('link', { name: agreement.name, exact: true }).waitFor();
    await page.getByLabel('สถานะเอกสาร').selectOption('expired');
    await page.getByRole('link', { name: /Dashboard สะพานข้อมูล/ }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 11);
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    await page.getByPlaceholder('ค้นหาชื่อข้อตกลง, หน่วยงาน...').fill('NO_SUCH_DEMO_RECORD');await page.waitForFunction(v=>(new URLSearchParams(location.search).get('q')??'')===v,'NO_SUCH_DEMO_RECORD');
    await page.getByText('ไม่พบเอกสารที่ค้นหา', { exact: true }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/dashboard/public`);
    await page.getByText('คู่ความร่วมมือ (CSTU โดยตรง)', { exact: true }).waitFor();
    await page.getByRole('link', { name: /มหาวิทยาลัยรุ่งอรุณวิทยา/ }).first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(output, 'mobile-dashboard.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), base, status: 'passed', publicCounts: [29, 23, 93],
    pdfSha256: crypto.createHash('sha256').update(pdf).digest('hex'), browserErrors: errors,
    cases: ['real API relationships', 'individual stakeholder filters', 'contact privacy',
      'agreement status filters', 'PDF bytes and Thai filename', 'relationship navigation and refresh',
      'unavailable/metadata-only files', 'empty search', 'demo notice', '390px layout'],
  }, null, 2));
  console.log('PASS: fictional demo API, individual stakeholders, relationships, PDF, filters, refresh and mobile');
})().catch(error => { console.error(error); process.exit(1); });
