// V3 functional test: real login (Amazon Cognito), real backend and database,
// driven through the web UI as each role. Not run in CI: it needs the demo
// test accounts. Run against the demo (docker-compose.demo.yml):
//
//   CREDENTIALS_FILE=~/.config/cstu/cognito-test-users.txt \
//   TEST_FRONTEND_URL=http://localhost:3100 node frontend/tests/v3-functional.cjs
//
// The credentials file is tab-separated "role<TAB>email<TAB>password" (lines
// starting with # are ignored). Passwords are never printed or written out.
// Every record it creates is named "FT-<timestamp> ..." and deleted at the end.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3100').replace(/\/$/, '');
const api = `${base}/api/v1`;
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v3-functional', 'v3-functional');
const credentialsFile = (process.env.CREDENTIALS_FILE || '').replace(/^~/, os.homedir());
const samplePdf = path.resolve(__dirname, '../../backend/fixtures/v2-sample.pdf');
const tag = `FT-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

if (!credentialsFile || !fs.existsSync(credentialsFile)) {
  console.error('Set CREDENTIALS_FILE to the demo test-account file.');
  process.exit(2);
}
const accounts = Object.fromEntries(fs.readFileSync(credentialsFile, 'utf8').split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.split('\t'))
  .filter((parts) => parts.length >= 3)
  .map(([role, email, password]) => [role.trim(), { email: email.trim(), password: password.trim() }]));

const results = [];
const findings = [];
async function step(name, work) {
  try {
    await work();
    results.push({ name, status: 'passed' });
    console.log('PASS:', name);
  } catch (error) {
    results.push({ name, status: 'failed', error: String(error.message).split('\n')[0] });
    console.log('FAIL:', name, '-', String(error.message).split('\n')[0]);
  }
}

/** Log in through the real login form; returns a page in that user's tab. */
async function login(browser, role) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('อีเมล').fill(accounts[role].email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(accounts[role].password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.waitForURL(new RegExp(`/dashboard/${role}$`), { timeout: 20000 });
  return page;
}

/** Call the API from inside the signed-in tab, with that tab's token. */
const callApi = (page, method, apiPath, body) => page.evaluate(async ({ url, method, body }) => {
  const token = sessionStorage.getItem('pcsms_access_token');
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}, { url: `${api}${apiPath}`, method, body });

const publicGet = async (apiPath) => (await fetch(`${api}${apiPath}`)).json();
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  const ids = {};
  const pages = {};
  try {
    // ---------- 1. Login per role ----------
    await step('every role logs in through the web form and lands on its dashboard', async () => {
      for (const role of ['public', 'student', 'coordinator', 'staff', 'admin']) {
        pages[role] = await login(browser, role);
        const me = await callApi(pages[role], 'GET', '/auth/me');
        assert.equal(me.status, 200);
        assert.equal(me.data.role, role);
        ids[role] = me.data.id;
      }
      await shot(pages.staff, '01-staff-dashboard');
    });

    await step('a wrong password is refused and stays on the login page', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
      await page.getByLabel('อีเมล').fill(accounts.student.email);
      await page.getByLabel('รหัสผ่าน', { exact: true }).fill('definitely-wrong-Passw0rd');
      await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
      await page.waitForTimeout(3000);
      assert.match(page.url(), /\/login/);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pcsms_access_token')), null);
      await context.close();
    });

    // ---------- 2. Permissions on pages and API ----------
    await step('public and student cannot open management pages (UI says no permission, API answers 403)', async () => {
      for (const role of ['public', 'student']) {
        const page = pages[role];
        await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
        await page.getByText('ไม่มีสิทธิ์เข้าถึง').waitFor();
        assert.equal((await callApi(page, 'GET', '/documents/manage')).status, 403);
        assert.equal((await callApi(page, 'POST', '/documents/', { name: `${tag} sneaky` })).status, 403);
        assert.equal((await callApi(page, 'POST', '/activities/', { name: `${tag} sneaky` })).status, 403);
      }
      await shot(pages.student, '02-student-no-permission');
    });

    // ---------- 3. Agreement workflow ----------
    const agreementName = `${tag} MoU ทดสอบการทำงานจริง`;
    await step('coordinator creates an agreement draft and uploads its PDF through the web', async () => {
      const page = pages.coordinator;
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'สร้างร่างข้อตกลง' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อข้อตกลง *').fill(agreementName);
      await dialog.getByLabel('วันที่เริ่มมีผล').fill('2026-11-01');
      await dialog.getByLabel('วันหมดอายุ').fill('2029-10-31');
      await dialog.getByLabel('ระดับความร่วมมือ').selectOption('program');
      await dialog.getByRole('button', { name: 'สร้างร่าง', exact: true }).click();
      await page.getByText(`สร้างร่าง “${agreementName}” แล้ว`).waitFor({ timeout: 15000 });
      await dialog.getByLabel('เลือกไฟล์ PDF').setInputFiles(samplePdf);
      await dialog.getByRole('button', { name: 'อัปโหลด' }).click();
      await page.getByText('อัปโหลดไฟล์แล้ว').waitFor({ timeout: 15000 });
      assert.equal(await dialog.getByRole('button', { name: 'อนุมัติ' }).count(), 0, 'coordinator has no approve button');
      await shot(page, '03-coordinator-agreement-draft');
      const mine = (await callApi(page, 'GET', '/documents/manage')).data.find((d) => d.name === agreementName);
      assert.ok(mine, 'draft is in the coordinator list');
      assert.deepEqual([mine.status, mine.cstuStatus, mine.isPublished, mine.ownerUserId, Boolean(mine.fileName)],
        ['draft', 'review', false, ids.coordinator, true]);
      ids.agreement = mine.id;
    });

    await step('the draft is not public, and the coordinator cannot approve it via the API', async () => {
      assert.ok(!(await publicGet('/documents/')).some((d) => d.id === ids.agreement), 'not in public list');
      const res = await callApi(pages.coordinator, 'POST', `/documents/${ids.agreement}/transition`, { status: 'approved' });
      assert.equal(res.status, 403);
    });

    await step('coordinator opens the internal PDF through a signed link', async () => {
      const res = await callApi(pages.coordinator, 'GET', `/documents/${ids.agreement}/internal-url`);
      assert.equal(res.status, 200);
      const pdf = await pages.coordinator.evaluate(async (url) => {
        const r = await fetch(url);
        return { status: r.status, type: r.headers.get('content-type'), head: (await r.text()).slice(0, 5) };
      }, res.data.url);
      assert.deepEqual([pdf.status, pdf.head], [200, '%PDF-']);
      const anonymous = await (await fetch(`${api}/documents/${ids.agreement}/download`)).status;
      assert.equal(anonymous, 404, 'public download refuses an internal document');
    });

    await step('staff reviews CSTU relevance, approves, activates and publishes through the web', async () => {
      const page = pages.staff;
      await page.goto(`${base}/documents/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('row', { name: new RegExp(agreementName) }).getByRole('button', { name: 'จัดการ' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ผลการตรวจ').selectOption('keep');
      await dialog.getByLabel('หลักฐาน / แหล่งที่มา').fill('ทดสอบ: CSTU เป็นคู่สัญญา (ข้อมูลสมมติ)');
      await dialog.getByLabel('ลิงก์แหล่งที่มาที่ตรวจแล้ว (https://)').fill(`https://example.com/functional-test/${tag}`);
      await dialog.getByRole('button', { name: 'บันทึกผลการตรวจ' }).click();
      await page.getByText('บันทึกผลการตรวจ CSTU แล้ว').waitFor({ timeout: 15000 });
      for (const [button, label] of [['อนุมัติ', 'อนุมัติแล้ว'], ['เริ่มมีผล', 'ใช้งาน']]) {
        await dialog.getByRole('button', { name: button, exact: true }).click();
        await page.getByText(`เปลี่ยนสถานะเป็น “${label}” แล้ว`).waitFor({ timeout: 15000 });
      }
      await dialog.getByRole('button', { name: 'เผยแพร่', exact: true }).click();
      await page.getByText('เผยแพร่แล้ว', { exact: true }).waitFor({ timeout: 15000 });
      await shot(page, '04-staff-agreement-published');
      const doc = (await callApi(page, 'GET', '/documents/manage')).data.find((d) => d.id === ids.agreement);
      assert.deepEqual([doc.status, doc.cstuStatus, doc.isPublished], ['active', 'keep', true]);
    });

    await step('an invalid transition is refused (active -> approved answers 409)', async () => {
      const res = await callApi(pages.staff, 'POST', `/documents/${ids.agreement}/transition`, { status: 'approved' });
      assert.equal(res.status, 409);
    });

    await step('the published, CSTU-relevant agreement appears on the public documents page', async () => {
      const visible = (await publicGet('/documents/')).some((d) => d.id === ids.agreement);
      assert.ok(visible, 'published + keep agreement is publicly listed');
      const page = pages.staff;
      await page.goto(`${base}/documents`, { waitUntil: 'networkidle' });
      await page.getByText(agreementName).first().waitFor({ timeout: 15000 });
      await shot(page, '04b-agreement-on-public-page');
    });

    // ---------- 4. Activities ----------
    const activityName = `${tag} สัมมนาทดสอบ`;
    await step('coordinator adds an activity; it stays hidden until staff publish it', async () => {
      const page = pages.coordinator;
      await page.goto(`${base}/activities/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'เพิ่มกิจกรรม' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อกิจกรรม *').fill(activityName);
      await dialog.getByLabel('วันที่เริ่ม').fill('2026-12-05');
      await dialog.getByLabel('ประเภทกิจกรรม').selectOption('seminar');
      await dialog.getByRole('button', { name: 'เพิ่มกิจกรรม' }).click();
      await page.getByText(`เพิ่ม “${activityName}” แล้ว`).waitFor({ timeout: 15000 });
      const row = (await callApi(page, 'GET', '/activities/manage')).data.find((a) => a.name === activityName);
      assert.deepEqual([row.isPublished, row.ownerUserId], [false, ids.coordinator]);
      ids.activity = row.id;
      assert.ok(!(await publicGet('/activities/')).some((a) => a.id === ids.activity), 'hidden publicly');
      assert.equal((await callApi(page, 'DELETE', `/activities/${ids.activity}`)).status, 403, 'coordinator cannot delete');

      const staff = pages.staff;
      await staff.goto(`${base}/activities/manage?edit=${ids.activity}`, { waitUntil: 'networkidle' });
      await staff.getByRole('dialog').getByLabel('เผยแพร่ในหน้าสาธารณะ').check();
      await staff.getByRole('dialog').getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
      await staff.getByText(`บันทึก “${activityName}” แล้ว`).waitFor({ timeout: 15000 });
      await staff.goto(`${base}/activities`, { waitUntil: 'networkidle' });
      await staff.getByText(activityName).first().waitFor({ timeout: 15000 });
      await shot(staff, '05-activity-published');
    });

    // ---------- 5. Exchange records by role ----------
    const exchangeName = `${tag} นักศึกษาแลกเปลี่ยน`;
    await step('staff adds an exchange record for the student; only that student (and staff) see it', async () => {
      const page = pages.staff;
      await page.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'เพิ่มนักศึกษา' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อ-นามสกุลนักศึกษา *').fill(exchangeName);
      await dialog.getByLabel('ไป (สถาบันปลายทาง)').fill('Sakuragaoka Institute of Technology');
      await dialog.getByLabel('รหัสบัญชีนักศึกษา (ถ้ามี)').fill(String(ids.student));
      await dialog.getByRole('button', { name: 'เพิ่มข้อมูล' }).click();
      await page.getByText(`เพิ่ม “${exchangeName}” แล้ว`).waitFor({ timeout: 15000 });

      const student = pages.student;
      await student.goto(`${base}/exchange`, { waitUntil: 'networkidle' });
      await student.getByText(exchangeName).waitFor({ timeout: 15000 });
      assert.equal(await student.getByRole('button', { name: /แก้ไข/ }).count(), 0, 'student cannot edit');
      await shot(student, '06-student-sees-own-exchange');
      const coordinatorList = (await callApi(pages.coordinator, 'GET', '/exchange/mine')).data;
      assert.ok(!coordinatorList.some((r) => r.name === exchangeName), 'coordinator does not see records they do not own');
      assert.ok(!(await publicGet('/exchange/')).some((r) => r.name === exchangeName), 'unpublished record is not public');
      ids.exchange = (await callApi(page, 'GET', '/exchange/mine')).data.find((r) => r.name === exchangeName).id;
    });

    // ---------- 6. Stakeholders ----------
    const personName = `${tag} อ.ผู้ประสานงาน`;
    await step('coordinator adds a coordinator person as a draft; staff can edit and delete it', async () => {
      const page = pages.coordinator;
      await page.goto(`${base}/stakeholders/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'เพิ่มหน่วยงาน / บุคคล' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อ *').fill(personName);
      await dialog.getByLabel('ประเภท').selectOption('coordinator');
      await dialog.getByLabel('สังกัดหน่วยงาน').selectOption({ index: 1 });
      await dialog.getByLabel('อีเมลผู้ติดต่อ').fill('ft.coordinator@example.com');
      await dialog.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
      await page.getByText(`เพิ่ม “${personName}” แล้ว`).waitFor({ timeout: 15000 });
      const row = (await callApi(page, 'GET', '/partners/')).data.find((p) => p.name === personName);
      assert.deepEqual([row.isPublished, row.ownerUserId, Boolean(row.organizationId)], [false, ids.coordinator, true]);
      ids.partner = row.id;
      assert.equal((await callApi(page, 'DELETE', `/partners/${ids.partner}`)).status, 403, 'coordinator cannot delete');
      assert.ok(!(await publicGet('/partners/')).some((p) => p.id === ids.partner), 'draft is not public');
      await shot(page, '07-coordinator-stakeholder');
    });

    const orgName = `${tag} มหาวิทยาลัยทดสอบ`;
    await step('staff adds a complete organisation with a verified source and publishes it; it shows publicly', async () => {
      const page = pages.staff;
      await page.goto(`${base}/stakeholders/manage`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'เพิ่มหน่วยงาน / บุคคล' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('ชื่อ *').fill(orgName);
      await dialog.getByLabel('ประเภท').selectOption('university');
      await dialog.getByLabel('ประเทศ', { exact: true }).fill('Japan');
      await dialog.getByLabel('รหัสประเทศ').fill('JP');
      await dialog.getByLabel('เว็บไซต์').fill('https://example.com/ft-university');
      await dialog.getByLabel('รายละเอียด').fill('หน่วยงานสมมติสำหรับทดสอบการทำงาน');
      await dialog.getByLabel('ลิงก์แหล่งที่มาที่ตรวจแล้ว (https://)').fill(`https://example.com/ft-university/${tag}`);
      await dialog.getByLabel('เผยแพร่ในหน้าสาธารณะ').check();
      await dialog.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
      await page.getByText(`เพิ่ม “${orgName}” แล้ว`).waitFor({ timeout: 15000 });
      const row = (await publicGet('/partners/')).find((p) => p.name === orgName);
      assert.ok(row, 'organisation is publicly listed');
      ids.organisation = row.id;
    });

    // ---------- 7. Audit log ----------
    await step('every change above is in the audit log with the user who made it', async () => {
      const expect = [
        ['documents', ids.agreement, ['create', 'upload', 'cstu_review', 'approved', 'transition', 'publish']],
        ['activities', ids.activity, ['create', 'update']],
        ['exchange_students', ids.exchange, ['create']],
        ['partners', ids.partner, ['create']],
        ['partners', ids.organisation, ['create']],
      ];
      for (const [entity, id, actions] of expect) {
        const res = await callApi(pages.staff, 'GET', `/audit-logs/?entity=${entity}&entity_id=${id}&limit=50`);
        assert.equal(res.status, 200);
        const rows = Array.isArray(res.data) ? res.data : res.data.items;
        const seen = rows.map((r) => r.action);
        for (const action of actions) assert.ok(seen.includes(action), `${entity} ${id}: ${action} logged (saw ${seen})`);
        assert.ok(rows.every((r) => r.user_id || r.userId), 'each row names its user');
      }
      assert.equal((await callApi(pages.coordinator, 'GET', '/audit-logs/')).status, 403, 'coordinator cannot read the audit log');
    });

    // ---------- 8. Logout ----------
    await step('logout revokes the token: the old token no longer works', async () => {
      const page = pages.public;
      const token = await page.evaluate(() => sessionStorage.getItem('pcsms_access_token'));
      await page.getByTitle('ออกจากระบบ').click();
      await page.waitForURL(/\/dashboard\/public$/);
      const res = await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 401);
    });
  } finally {
    // ---------- Cleanup (exchange records are hard-deleted, the rest soft-deleted;
    // history stays in the audit log) ----------
    if (pages.staff) {
      for (const [p, id] of [['/documents/', ids.agreement], ['/activities/', ids.activity],
        ['/partners/', ids.partner], ['/partners/', ids.organisation], ['/exchange/', ids.exchange]]) {
        if (id) await callApi(pages.staff, 'DELETE', `${p}${id}`).catch(() => {});
      }
    }
    await browser.close();
  }
  const failed = results.filter((r) => r.status === 'failed');
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({
    target: base, tag, status: failed.length ? 'failed' : 'passed', results, findings,
  }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} functional steps passed`);
  for (const finding of findings) console.log('FINDING:', finding);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
