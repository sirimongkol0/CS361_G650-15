// V3-7 (#79): agreement management page (/documents/manage).
// The real frontend talks to a stateful fake of the V3-3 agreement API inside
// the browser, so every request the page sends (method, path, body) is checked
// without a Cognito account. The backend side is covered by
// backend/tests/test_v3_agreements.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v3-agreements', 'v3-agreements');
const PDF = Buffer.from('%PDF-1.4\n% V3-7 test\n%%EOF\n');

const cors = {
  'Access-Control-Allow-Origin': base,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
const reply = (route, status, body) => route.request().method() === 'OPTIONS'
  ? route.fulfill({ status: 204, headers: cors })
  : route.fulfill({ status, headers: cors, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

const TRANSITIONS = { draft: ['approved', 'cancelled'], approved: ['active', 'cancelled'], active: ['expired', 'cancelled'], expired: [], cancelled: [] };

/** In-browser fake of /api/v1/documents/* following the backend rules for one role. */
function fakeApi(role, userId) {
  const staff = role === 'staff' || role === 'admin';
  const docs = new Map();
  let nextId = 100;
  const calls = [];
  const blank = (values) => ({
    docType: 'mou', documentKind: 'agreement', fileAvailability: 'metadata_only', fileName: null, sizeBytes: null,
    uploadedAt: null, effectiveDate: null, expiryDate: null, partnerId: null, partner: null, responsible: null,
    status: 'draft', signerOur: null, signerPartner: null, scopeLevel: null, isPublished: false,
    cstuStatus: 'review', cstuEvidence: null, ownerUserId: userId, sources: [], ...values,
  });
  const seed = (values) => { const d = blank({ id: nextId++, ...values }); docs.set(d.id, d); return d; };

  async function handle(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply(route, 204);
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\/documents/, '');
    const body = req.postData() && (req.headers()['content-type'] || '').includes('json') ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), path: p, body, auth: req.headers().authorization ?? null });
    const m = p.match(/^\/(\d+)(\/.*)?$/);
    const doc = m ? docs.get(Number(m[1])) : null;
    const sub = m?.[2] ?? '';
    const owns = doc && (staff || doc.ownerUserId === userId);

    if (req.method() === 'GET' && p === '/manage') {
      return reply(route, 200, [...docs.values()].filter((d) => staff || d.ownerUserId === userId));
    }
    if (req.method() === 'POST' && p === '/') return reply(route, 201, seed({ ...camel(body) }));
    if (!doc) return reply(route, 404, { detail: 'Document not found' });
    if (!owns) return reply(route, 403, { detail: 'Insufficient permissions' });
    if (req.method() === 'PATCH' && sub === '') {
      if (!staff && doc.status !== 'draft') return reply(route, 409, { detail: 'Only draft documents can be edited' });
      Object.assign(doc, camel(body)); return reply(route, 200, doc);
    }
    if (req.method() === 'PUT' && sub === '/file') {
      if (!(req.postDataBuffer() || Buffer.alloc(0)).includes(Buffer.from('%PDF-'))) return reply(route, 415, { detail: 'Only PDF files are accepted' });
      Object.assign(doc, { fileName: 'mou.pdf', fileAvailability: 'available', sizeBytes: PDF.length }); return reply(route, 200, doc);
    }
    if (req.method() === 'GET' && sub === '/internal-url') return reply(route, 200, { url: `${base}/fake-signed.pdf`, expiresIn: 300 });
    if (!staff) return reply(route, 403, { detail: 'Insufficient permissions' });
    if (req.method() === 'POST' && sub === '/transition') {
      if (!TRANSITIONS[doc.status].includes(body.status)) return reply(route, 409, { detail: `Cannot change status from ${doc.status} to ${body.status}` });
      doc.status = body.status; return reply(route, 200, doc);
    }
    if (req.method() === 'PUT' && sub === '/cstu-status') {
      if (body.cstu_status !== 'review' && !body.cstu_evidence) return reply(route, 422, { detail: 'cstu_evidence is required for keep and out_of_scope' });
      if (body.cstu_status === 'keep' && !body.source_url && !doc.sources.length) return reply(route, 422, { detail: 'source_url is required' });
      if (body.source_url) doc.sources.push({ id: doc.sources.length + 1, sourceUrl: body.source_url });
      doc.cstuStatus = body.cstu_status; doc.cstuEvidence = body.cstu_evidence; return reply(route, 200, doc);
    }
    if (req.method() === 'POST' && sub === '/publish') { doc.isPublished = true; return reply(route, 200, doc); }
    if (req.method() === 'POST' && sub === '/unpublish') { doc.isPublished = false; return reply(route, 200, doc); }
    if (req.method() === 'DELETE' && sub === '') { docs.delete(doc.id); return reply(route, 204); }
    return reply(route, 405, { detail: 'Method Not Allowed' });
  }
  const camel = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k.replace(/_(\w)/g, (_, c) => c.toUpperCase()), v]));
  return { handle, seed, calls, docs };
}

async function session(browser, role, userId = 7) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('pcsms_access_token', 'test-token'); }
  });
  await context.route('**/api/v1/auth/me', (r) => reply(r, 200, { id: userId, email: `${role}@example.test`, role }));
  const api = fakeApi(role, userId);
  await context.route(/\/api\/v1\/documents\/(manage|\d+.*|)$/, (r) => api.handle(r));
  // Activities linked to an agreement, listed in its panel.
  await context.route(/\/api\/v1\/activities\/manage$/, (r) => reply(r, 200, []));
  await context.route('**/fake-signed.pdf', (r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }));
  return { context, api };
}

const cases = [];
async function check(name, work) { await work(); cases.push(name); console.log('PASS:', name); }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    await check('anonymous and public/student users cannot open the management page', async () => {
      const page = await browser.newPage();
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      await page.getByText('กรุณาเข้าสู่ระบบ').waitFor();
      await page.close();
      for (const role of ['public', 'student']) {
        const { context } = await session(browser, role);
        const p = await context.newPage();
        await p.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
        await p.getByText('ไม่มีสิทธิ์เข้าถึง').waitFor();
        await p.goto(`${base}/documents`, { waitUntil: 'networkidle' });
        assert.equal(await p.getByRole('link', { name: 'จัดการข้อตกลง' }).count(), 0, `${role} sees no manage link`);
        await context.close();
      }
    });

    await check('coordinator: creates a draft, uploads a PDF, and cannot approve or publish', async () => {
      const { context, api } = await session(browser, 'coordinator');
      const page = await context.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto(`${base}/documents`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'จัดการข้อตกลง' }).first().click();
      await page.waitForURL(/\/documents\/manage$/);
      await page.getByRole('button', { name: 'สร้างฉบับร่าง' }).click();
      await page.getByLabel('ชื่อข้อตกลง *').fill('MoU ทดสอบ V3-7');
      await page.getByLabel('วันที่เริ่มมีผล').fill('2026-11-01');
      await page.getByLabel('วันหมดอายุ').fill('2029-10-31');
      await page.getByRole('dialog').getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
      await page.getByText('สร้างฉบับร่าง “MoU ทดสอบ V3-7” แล้ว').waitFor();
      const created = api.calls.find((c) => c.method === 'POST' && c.path === '/');
      assert.equal(created.body.name, 'MoU ทดสอบ V3-7');
      assert.equal(created.body.effective_date, '2026-11-01');
      assert.equal(created.auth, 'Bearer test-token');

      // The manage dialog opens on the new draft.
      const dialog = page.getByRole('dialog');
      await dialog.getByText('เจ้าหน้าที่เป็นผู้อนุมัติและเปลี่ยนสถานะ').waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'อนุมัติ' }).count(), 0, 'no approve button');
      assert.equal(await dialog.getByRole('button', { name: 'เผยแพร่' }).count(), 0, 'no publish button');
      assert.equal(await dialog.getByText('ความเกี่ยวข้องกับ CSTU').count(), 0, 'no CSTU review');

      await dialog.getByLabel('เลือกไฟล์ PDF').setInputFiles({ name: 'mou.pdf', mimeType: 'application/pdf', buffer: PDF });
      await dialog.getByRole('button', { name: 'อัปโหลด' }).click();
      await page.getByText('อัปโหลดไฟล์แล้ว').waitFor();
      assert.ok(api.calls.some((c) => c.method === 'PUT' && c.path.endsWith('/file')), 'upload sent');
      await page.screenshot({ path: path.join(output, 'coordinator-manage.png'), fullPage: true });
      await context.close();
    });

    await check('non-PDF and oversized files are stopped before upload', async () => {
      const { context, api } = await session(browser, 'staff');
      api.seed({ name: 'MoU ตรวจไฟล์' });
      const page = await context.newPage();
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'จัดการ' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('เลือกไฟล์ PDF').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
      await dialog.getByText('เลือกได้เฉพาะไฟล์ PDF').waitFor();
      assert.ok(await dialog.getByRole('button', { name: 'อัปโหลด' }).isDisabled());
      await dialog.getByLabel('เลือกไฟล์ PDF').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
      await dialog.getByText('ไฟล์ต้องไม่เกิน 10 MB').waitFor();
      assert.equal(api.calls.filter((c) => c.path.endsWith('/file')).length, 0, 'nothing uploaded');
      await context.close();
    });

    await check('staff: CSTU review needs evidence, then approve -> active -> publish, then delete', async () => {
      const { context, api } = await session(browser, 'staff');
      const doc = api.seed({ name: 'MoU รออนุมัติ', ownerUserId: 99, fileName: 'mou.pdf', fileAvailability: 'available' });
      const page = await context.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'จัดการ' }).click();
      const dialog = page.getByRole('dialog');

      await dialog.getByLabel('ความเกี่ยวข้องกับ CSTU').selectOption('keep');
      assert.ok(await dialog.getByRole('button', { name: 'บันทึก', exact: true }).isDisabled(), 'evidence required');
      await dialog.getByLabel('เหตุผล').fill('CSTU เป็นคู่สัญญาตามข้อ 1');
      assert.ok(await dialog.getByRole('button', { name: 'บันทึก', exact: true }).isDisabled(), 'keep needs a verified source');
      await dialog.getByLabel('ลิงก์แหล่งที่มา').fill('https://example.test/mou');
      await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
      await page.getByText('บันทึกความเกี่ยวข้องกับ CSTU แล้ว').waitFor();

      for (const [button, label] of [['อนุมัติ', 'อนุมัติข้อตกลงแล้ว'], ['เริ่มมีผล', 'ข้อตกลงมีผลแล้ว']]) {
        await dialog.getByRole('button', { name: button, exact: true }).click();
        await page.getByText(label).waitFor();
      }
      await dialog.getByRole('button', { name: 'เผยแพร่', exact: true }).click();
      await page.getByText('เผยแพร่ข้อตกลงแล้ว', { exact: true }).waitFor();
      assert.deepEqual(
        { status: doc.status, cstu: doc.cstuStatus, published: doc.isPublished },
        { status: 'active', cstu: 'keep', published: true },
      );
      await page.screenshot({ path: path.join(output, 'staff-manage.png'), fullPage: true });

      // The new tab fetches the signed link (headless Chromium downloads PDFs rather than showing them).
      const signedFetch = context.waitForEvent('request', (r) => r.url().endsWith('/fake-signed.pdf'));
      await dialog.getByRole('button', { name: /เปิดไฟล์/ }).click();
      await signedFetch;

      await dialog.getByRole('button', { name: 'ลบข้อตกลง' }).click();
      await page.getByText('ลบ “MoU รออนุมัติ” แล้ว').waitFor();
      assert.equal(api.docs.size, 0);
      const sent = api.calls.map((c) => `${c.method} ${c.path}`);
      for (const expected of ['PUT /' + doc.id + '/cstu-status', 'POST /' + doc.id + '/transition', 'POST /' + doc.id + '/publish', 'GET /' + doc.id + '/internal-url', 'DELETE /' + doc.id]) {
        assert.ok(sent.includes(expected), `sent ${expected}`);
      }
      await context.close();
    });

    await check('a refused action shows the backend reason in Thai', async () => {
      const { context, api } = await session(browser, 'staff');
      const doc = api.seed({ name: 'MoU สิ้นสุดแล้ว', status: 'approved' });
      const page = await context.newPage();
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      doc.status = 'cancelled'; // someone else cancelled it after the page loaded
      await page.getByRole('button', { name: 'จัดการ' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'เริ่มมีผล' }).click();
      await page.getByText('ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน').waitFor();
      await context.close();
    });
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ status: 'passed', cases }, null, 2));
  console.log(`${cases.length} V3-7 agreement checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
