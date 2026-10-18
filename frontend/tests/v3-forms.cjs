// V3-7 (#79): add/edit/delete forms for activities, exchange records and stakeholders.
// The real frontend talks to a small stateful fake of those APIs in the browser,
// so each request the forms send is checked per role without a Cognito account.
// Backend rules are covered by backend/tests/test_v3_activities_exchange.py and
// backend/tests/test_V3-2_stakeholders.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3126').replace(/\/$/, '');
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v3-forms', 'v3-forms');

const cors = {
  'Access-Control-Allow-Origin': base,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
const reply = (route, status, body) => route.request().method() === 'OPTIONS'
  ? route.fulfill({ status: 204, headers: cors })
  : route.fulfill({ status, headers: cors, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
const camel = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k.replace(/_(\w)/g, (_, c) => c.toUpperCase()), v]));

/** Fake collection with owner rules: coordinators change only their own rows, staff/admin all. */
function collection(role, userId, rows, { publishField = 'isPublished', canDelete = ['staff', 'admin'] } = {}) {
  const staff = role === 'staff' || role === 'admin';
  const items = new Map(rows.map((r) => [r.id, { isPublished: false, ownerUserId: null, ...r }]));
  let nextId = 500;
  const calls = [];
  return {
    items, calls,
    list: () => [...items.values()],
    create(body) {
      calls.push({ method: 'POST', body });
      if (!staff && body.is_published) return [403, { detail: 'Only staff and admin can publish' }];
      const row = { id: nextId++, ...camel(body), isPublished: Boolean(body.is_published), ownerUserId: userId };
      items.set(row.id, row);
      return [201, row];
    },
    update(id, method, body) {
      calls.push({ method, id, body });
      const row = items.get(id);
      if (!row) return [404, { detail: 'Not found' }];
      if (!staff && row.ownerUserId !== userId) return [403, { detail: 'Insufficient permissions' }];
      if (!staff && body && 'is_published' in body) return [403, { detail: 'Only staff/admin can change publication status' }];
      Object.assign(row, camel(body), body && 'is_published' in body ? { [publishField]: body.is_published } : {});
      return [200, row];
    },
    remove(id) {
      calls.push({ method: 'DELETE', id });
      if (!canDelete.includes(role)) return [403, { detail: 'Insufficient permissions' }];
      items.delete(id);
      return [204, undefined];
    },
  };
}

async function session(browser, role, userId = 7) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('pcsms_access_token', 'test-token'); }
  });
  await context.route('**/api/v1/auth/me', (r) => reply(r, 200, { id: userId, email: `${role}@example.test`, role }));
  const activities = collection(role, userId, [
    { id: 1, name: 'กิจกรรมของฉัน', date: '2026-11-20', status: 'วางแผน', ownerUserId: userId },
    { id: 2, name: 'กิจกรรมของคนอื่น', date: '2026-12-01', status: 'วางแผน', ownerUserId: 99, isPublished: true },
  ]);
  const exchange = collection(role, userId, [
    { id: 11, name: 'นักศึกษา ก', type: 'outbound', toOrganization: 'Partner U', status: 'วางแผน', ownerUserId: userId },
  ]);
  const partners = collection(role, userId, [
    { id: 21, name: 'มหาวิทยาลัยคู่ความร่วมมือ', type: 'university', isPublished: true, ownerUserId: 99 },
  ]);
  const route = (coll, prefix) => async (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return reply(r, 204);
    const p = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const id = Number(p.match(/\/(\d+)$/)?.[1]);
    if (req.method() === 'GET') return reply(r, 200, coll.list());
    if (req.method() === 'POST') return reply(r, ...coll.create(body));
    if (req.method() === 'DELETE') return reply(r, ...coll.remove(id));
    return reply(r, ...coll.update(id, req.method(), body));
  };
  await context.route(/\/api\/v1\/activities\/(manage|\d+)?$/, async (r) => {
    // Public GET /activities/ and /activities/<id> keep using the real API.
    const p = new URL(r.request().url()).pathname;
    if (r.request().method() === 'GET' && !p.endsWith('/manage')) return r.fallback();
    return route(activities)(r);
  });
  await context.route(/\/api\/v1\/exchange\/(mine|\d+)?$/, route(exchange));
  await context.route(/\/api\/v1\/partners\/(\d+)?$/, route(partners));
  return { context, activities, exchange, partners };
}

const cases = [];
async function check(name, work) { await work(); cases.push(name); console.log('PASS:', name); }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    await check('coordinator adds an activity (never published) and edits only their own', async () => {
      const { context, activities } = await session(browser, 'coordinator');
      const page = await context.newPage();
      await page.goto(`${base}/activities`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'เพิ่มกิจกรรม' }).click();
      await page.waitForURL(/\/activities\/manage$/);
      const own = page.getByRole('row', { name: /กิจกรรมของฉัน/ });
      const other = page.getByRole('row', { name: /กิจกรรมของคนอื่น/ });
      await own.waitFor();
      assert.equal(await other.getByRole('button', { name: 'แก้ไข' }).count(), 0, 'no edit on others');
      assert.equal(await page.getByRole('button', { name: 'ลบ' }).count(), 0, 'coordinators cannot delete');

      await page.getByRole('button', { name: 'เพิ่มกิจกรรม' }).click();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.getByLabel('เผยแพร่ในหน้าสาธารณะ').count(), 0, 'no publish option');
      await dialog.getByLabel('ชื่อกิจกรรม *').fill('สัมมนา V3-7');
      await dialog.getByLabel('วันที่เริ่ม').fill('2026-11-25');
      await dialog.getByLabel('ประเภทกิจกรรม').selectOption('seminar');
      await dialog.getByLabel('ระดับความร่วมมือ').selectOption('program');
      await dialog.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
      await page.getByText('เพิ่ม “สัมมนา V3-7” แล้ว').waitFor();
      const sent = activities.calls.find((c) => c.method === 'POST').body;
      assert.equal(sent.name, 'สัมมนา V3-7');
      assert.equal(sent.scope_level, 'program');
      assert.ok(!('is_published' in sent), 'coordinator never sends is_published');

      await own.getByRole('button', { name: 'แก้ไข' }).click();
      await page.getByRole('dialog').getByLabel('สถานที่').fill('ห้อง 301');
      await page.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click();
      await page.getByText('บันทึก “กิจกรรมของฉัน” แล้ว').waitFor();
      assert.equal(activities.items.get(1).location, 'ห้อง 301');
      await page.screenshot({ path: path.join(output, 'coordinator-activities.png'), fullPage: true });
      await context.close();
    });

    await check('staff publishes and deletes an activity; detail page "แก้ไข" opens its form', async () => {
      const { context, activities } = await session(browser, 'staff');
      const page = await context.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto(`${base}/activities/manage?edit=1`, { waitUntil: 'networkidle' });
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('เผยแพร่ในหน้าสาธารณะ').check();
      await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
      await page.getByText('บันทึก “กิจกรรมของฉัน” แล้ว').waitFor();
      assert.equal(activities.calls.at(-1).body.is_published, true);
      await page.getByRole('row', { name: /กิจกรรมของคนอื่น/ }).getByRole('button', { name: 'ลบ' }).click();
      await page.getByText('ลบ “กิจกรรมของคนอื่น” แล้ว').waitFor();
      assert.ok(!activities.items.has(2));
      await context.close();
    });

    await check('exchange: staff adds and edits a record and exports CSV; students get no edit', async () => {
      const { context, exchange } = await session(browser, 'staff');
      const page = await context.newPage();
      await page.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'เพิ่มนักศึกษา' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อ-นามสกุลนักศึกษา *').fill('นักศึกษา ข');
      await dialog.getByLabel('สถาบันปลายทาง').fill('Sakuragaoka Institute');
      await dialog.getByLabel('เลขบัญชีนักศึกษา').fill('42');
      await dialog.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
      await page.getByText('เพิ่ม “นักศึกษา ข” แล้ว').waitFor();
      const sent = exchange.calls.find((c) => c.method === 'POST').body;
      assert.deepEqual([sent.name, sent.to_organization, sent.user_id], ['นักศึกษา ข', 'Sakuragaoka Institute', 42]);

      await page.getByRole('button', { name: 'แก้ไข นักศึกษา ก' }).click();
      await page.getByRole('dialog').getByLabel('สถานะ').selectOption('กำลังดำเนินการ');
      await page.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click();
      await page.getByText('บันทึก “นักศึกษา ก” แล้ว').waitFor();
      assert.equal(exchange.items.get(11).status, 'กำลังดำเนินการ');

      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'ส่งออก CSV' }).click();
      assert.equal((await download).suggestedFilename(), 'exchange-students.csv');
      await page.screenshot({ path: path.join(output, 'staff-exchange.png'), fullPage: true });
      await context.close();

      const student = await session(browser, 'student');
      const p2 = await student.context.newPage();
      await p2.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await p2.getByText('นักศึกษา ก').waitFor();
      assert.equal(await p2.getByRole('button', { name: /แก้ไข/ }).count(), 0);
      assert.equal(await p2.getByRole('button', { name: 'เพิ่มนักศึกษา' }).count(), 0);
      await student.context.close();
    });

    await check('stakeholders: coordinator adds a coordinator person linked to an organisation; staff publishes and deletes', async () => {
      const { context, partners } = await session(browser, 'coordinator');
      const page = await context.newPage();
      await page.goto(`${base}/stakeholders`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'จัดการหน่วยงาน' }).first().click();
      await page.waitForURL(/\/stakeholders\/manage$/);
      await page.getByRole('button', { name: 'เพิ่มหน่วยงานหรือผู้ประสานงาน' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อ *').fill('อ.ผู้ประสานงาน สมมติ');
      await dialog.getByLabel('ประเภท').selectOption('coordinator');
      await dialog.getByLabel('หน่วยงานที่สังกัด').selectOption({ label: 'มหาวิทยาลัยคู่ความร่วมมือ' });
      await dialog.getByLabel('อีเมลผู้ติดต่อ', { exact: true }).fill('coordinator.demo@example.test');
      await dialog.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
      await page.getByText('เพิ่ม “อ.ผู้ประสานงาน สมมติ” แล้ว').waitFor();
      const sent = partners.calls.find((c) => c.method === 'POST').body;
      assert.deepEqual([sent.type, sent.organization_id, sent.contact_is_public], ['coordinator', 21, false]);
      assert.ok(!('is_published' in sent), 'coordinator never sends is_published');
      assert.equal(await page.getByRole('row', { name: /มหาวิทยาลัยคู่ความร่วมมือ/ }).first().getByRole('button', { name: 'แก้ไข' }).count(), 0);
      await page.screenshot({ path: path.join(output, 'coordinator-stakeholders.png'), fullPage: true });
      await context.close();

      const staff = await session(browser, 'staff');
      const p2 = await staff.context.newPage();
      p2.on('dialog', (d) => d.accept());
      await p2.goto(`${base}/stakeholders/manage`, { waitUntil: 'networkidle' });
      const row = p2.getByRole('row', { name: /มหาวิทยาลัยคู่ความร่วมมือ/ });
      await row.getByRole('button', { name: 'แก้ไข' }).click();
      await p2.getByRole('dialog').getByLabel('เผยแพร่ในหน้าสาธารณะ').uncheck();
      await p2.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click();
      await p2.getByText('บันทึก “มหาวิทยาลัยคู่ความร่วมมือ” แล้ว').waitFor();
      assert.equal(staff.partners.calls.at(-1).method, 'PUT');
      assert.equal(staff.partners.calls.at(-1).body.is_published, false);
      await row.getByRole('button', { name: 'ลบ' }).click();
      await p2.getByText('ลบ “มหาวิทยาลัยคู่ความร่วมมือ” แล้ว').waitFor();
      await staff.context.close();
    });
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ status: 'passed', cases }, null, 2));
  console.log(`${cases.length} V3-7 form checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
