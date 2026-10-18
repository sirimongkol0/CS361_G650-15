// V3-7 functional test for the reports, users, settings and feedback pages and the
// staff dashboard buttons: real login (Amazon Cognito), real backend and database,
// driven through the web UI as each role. Not run in CI: it needs the demo test
// accounts. Run against the demo (docker-compose.demo.yml):
//
//   CREDENTIALS_FILE=~/.config/cstu/cognito-test-users.txt \
//   TEST_FRONTEND_URL=http://localhost:3100 node frontend/tests/v3-pages.cjs
//
// The credentials file is tab-separated "role<TAB>email<TAB>password" (lines
// starting with # are ignored). Passwords are never printed or written out.
// /feedback and /reports are V4 pages (FR6/FR9) that the V3 release redirects
// away; set RUN_V4_PAGES=1 (after removing them from src/proxy.ts) to test them.
// The feedback entry it replies to is restored at the end (reply, status and
// publication); the audit rows of those changes stay, as for any write.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.env.TEST_FRONTEND_URL || 'http://localhost:3100').replace(/\/$/, '');
const api = `${base}/api/v1`;
const output = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v3-functional', 'v3-pages');
const credentialsFile = (process.env.CREDENTIALS_FILE || '').replace(/^~/, os.homedir());
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

const v4 = process.env.RUN_V4_PAGES === '1';
const results = [];
const consoleErrors = [];
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

/** A step for the V4 pages; recorded as skipped unless RUN_V4_PAGES=1. */
async function v4step(name, work) {
  if (v4) return step(name, work);
  results.push({ name, status: 'skipped' });
  console.log('SKIP (V4):', name);
}

function watch(page, label) {
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => consoleErrors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${label}: ${m.text()}`); });
}

/** Log in through the real login form; returns a page in that user's tab. */
async function login(browser, role) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  watch(page, role);
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

const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
const open = (page, route) => page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
const sidebarLinks = (page) => page.locator('aside a, nav a').allInnerTexts();

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  const pages = {};
  let restore = null;
  try {
    await step('every role logs in', async () => {
      for (const role of ['public', 'student', 'coordinator', 'staff', 'admin']) pages[role] = await login(browser, role);
    });

    // ---------- Logged out ----------
    await step('logged out: /users and /settings ask to log in', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      watch(page, 'anonymous');
      for (const route of v4 ? ['/reports', '/users', '/settings'] : ['/users', '/settings']) {
        await open(page, route);
        assert.match(page.url(), new RegExp(`${route}$`), `${route} must not redirect`);
        await page.getByText('กรุณาเข้าสู่ระบบ').first().waitFor();
      }
      await context.close();
    });

    await step('V3 release: /feedback and /reports redirect to the public dashboard for every role', async () => {
      if (v4) return;
      for (const role of ['public', 'staff', 'admin']) {
        for (const route of ['/feedback', '/reports']) {
          await open(pages[role], route);
          assert.match(pages[role].url(), /\/dashboard\/public$/, `${role} ${route} was not redirected`);
        }
      }
    });

    await v4step('logged out: /feedback shows published entries read-only', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      watch(page, 'anonymous');
      await open(page, '/feedback');
      await page.getByText('ความคิดเห็นที่เผยแพร่แล้ว').waitFor();
      const published = await (await fetch(`${api}/feedback/`)).json();
      assert.ok(published.length > 0, 'demo has published feedback');
      await page.getByText(published[0].title).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'บันทึกคำตอบ' }).count(), 0, 'no reply form when logged out');
      const body = await page.locator('main').innerText();
      for (const code of ['alumni', 'coop_system', 'participant']) assert.ok(!body.includes(code), `raw source code "${code}" shown`);
      await shot(page, '01-feedback-public');
      await context.close();
    });

    // ---------- Sidebar ----------
    await step('sidebar links per role', async () => {
      const expect = v4 ? {
        public: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        student: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        coordinator: { has: ['ความคิดเห็น', 'ตั้งค่าบัญชี'], not: ['รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        staff: { has: ['ความคิดเห็น', 'รายงานและสถิติ', 'ตั้งค่าบัญชี'], not: ['ผู้ใช้และสิทธิ์'] },
        admin: { has: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์', 'ตั้งค่าบัญชี'], not: [] },
      } : {
        public: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        student: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        coordinator: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        staff: { has: ['ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ', 'ผู้ใช้และสิทธิ์'] },
        admin: { has: ['ผู้ใช้และสิทธิ์', 'ตั้งค่าบัญชี'], not: ['ความคิดเห็น', 'รายงานและสถิติ'] },
      };
      for (const [role, { has, not }] of Object.entries(expect)) {
        const links = (await sidebarLinks(pages[role])).join('|');
        for (const name of has) assert.ok(links.includes(name), `${role} sidebar lacks ${name}`);
        for (const name of not) assert.ok(!links.includes(name), `${role} sidebar shows ${name}`);
      }
    });

    // ---------- Reports ----------
    await v4step('/reports: staff sees figures, the year selector changes them, CSV downloads', async () => {
      const page = pages.staff;
      await open(page, '/reports');
      const heading = page.getByRole('heading', { level: 1 });
      await heading.filter({ hasText: 'รายงานและสถิติ ปี' }).waitFor();
      await page.waitForTimeout(1500); // dashboard lists load after the page
      const select = page.getByLabel('ปี');
      const years = await select.locator('option').evaluateAll((o) => o.map((x) => x.value));
      assert.ok(years.length >= 2, `need at least two years of data, got ${years}`);
      const before = await page.locator('main').innerText();
      await shot(page, '02-reports-staff');
      await select.selectOption(years[1]);
      await heading.filter({ hasText: String(Number(years[1]) + 543) }).waitFor();
      const after = await page.locator('main').innerText();
      assert.notEqual(before, after, 'figures did not change with the year');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ส่งออก CSV' }).click()]);
      assert.equal(download.suggestedFilename(), `pcsms-report-${Number(years[1]) + 543}.csv`);
      const csv = fs.readFileSync(await download.path(), 'utf8');
      assert.equal(csv.split('\r\n').length, 13, 'header + 12 months');
      await shot(page, '03-reports-other-year');
    });

    await v4step('/reports: coordinator and student see no permission', async () => {
      for (const role of ['coordinator', 'student']) {
        await open(pages[role], '/reports');
        await pages[role].getByText('ไม่มีสิทธิ์เข้าถึง').waitFor();
      }
    });

    // ---------- Users ----------
    await step('/users: admin sees the real account list; staff gets no permission and API 403', async () => {
      const page = pages.admin;
      const users = await callApi(page, 'GET', '/users/');
      assert.equal(users.status, 200);
      await open(page, '/users');
      for (const role of ['public', 'student', 'coordinator', 'staff', 'admin']) {
        await page.getByRole('cell', { name: accounts[role].email, exact: true }).waitFor();
      }
      assert.equal(await page.locator('tbody tr').count(), users.data.length);
      assert.equal(await page.getByRole('button', { name: 'เพิ่มผู้ใช้' }).count(), 0);
      await shot(page, '04-users-admin');
      await page.getByRole('button', { name: 'สิทธิ์ตามบทบาท' }).click();
      await page.getByRole('cell', { name: 'ดูรายชื่อผู้ใช้', exact: true }).waitFor();
      await open(pages.staff, '/users');
      await pages.staff.getByText('ไม่มีสิทธิ์เข้าถึง').waitFor();
      assert.equal((await callApi(pages.staff, 'GET', '/users/')).status, 403);
    });

    // ---------- Settings ----------
    await step('/settings shows the signed-in account for every role, with role-aware wording', async () => {
      for (const role of ['public', 'student', 'coordinator', 'staff', 'admin']) {
        const page = pages[role];
        await open(page, '/settings');
        await page.getByText(accounts[role].email).first().waitFor();
        await page.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }).waitFor();
        const text = await page.locator('main').innerText();
        assert.equal(text.includes('กรุณาติดต่อผู้ดูแลระบบ'), role !== 'admin', `${role} wording`);
        assert.equal(await page.getByRole('button', { name: /^บันทึก/ }).count(), 0);
      }
      await shot(pages.student, '05-settings-student');
    });

    await step('/settings: a wrong current password says so and keeps the user signed in (no real change)', async () => {
      const page = pages.student;
      await open(page, '/settings');
      await page.getByLabel('รหัสผ่านเดิม').fill('Definitely-Wr0ng-Password');
      await page.getByLabel('รหัสผ่านใหม่', { exact: true }).fill('Another-Passw0rd');
      await page.getByLabel('ยืนยันรหัสผ่านใหม่').fill('Another-Passw0rd');
      await page.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }).click();
      await page.getByText('รหัสผ่านเดิมไม่ถูกต้อง').waitFor();
      assert.match(page.url(), /\/settings$/);
      assert.equal((await callApi(page, 'GET', '/auth/me')).status, 200);
      // Checks in the browser stop a mismatch before anything is sent.
      await page.getByLabel('ยืนยันรหัสผ่านใหม่').fill('Different-Passw0rd');
      await page.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }).click();
      await page.getByText('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน').waitFor();
      await shot(page, '05b-settings-wrong-password');
    });

    // ---------- Feedback ----------
    await v4step('/feedback: staff saves a reply and status, publishes and stops publishing; audit rows written', async () => {
      const page = pages.staff;
      const managed = await callApi(page, 'GET', '/feedback/manage');
      assert.equal(managed.status, 200);
      const target = managed.data.find((f) => !f.isPublished && !f.reply) ?? managed.data[0];
      restore = { id: target.id, reply: target.reply ?? '', status: target.status, is_published: target.isPublished };
      await open(page, '/feedback');
      await page.getByText(target.title).first().click();
      const reply = `${tag} ตอบกลับจากการทดสอบ`;
      await page.getByLabel('คำตอบหรือสิ่งที่ดำเนินการ').fill(reply);
      await page.getByRole('combobox', { name: /^สถานะ/ }).selectOption('ตรวจสอบแล้ว');
      await page.getByRole('button', { name: 'บันทึกคำตอบ' }).click();
      await page.getByText('บันทึกคำตอบแล้ว').waitFor();
      const saved = (await callApi(page, 'GET', '/feedback/manage')).data.find((f) => f.id === target.id);
      assert.equal(saved.reply, reply);
      assert.equal(saved.status, 'ตรวจสอบแล้ว');
      await page.getByText('บันทึกคำตอบล่าสุดเมื่อ').waitFor();
      assert.equal(await page.getByLabel('คำตอบหรือสิ่งที่ดำเนินการ').inputValue(), reply, 'form keeps the saved reply');
      await shot(page, '06-feedback-reply-saved');

      const publish = target.isPublished ? 'หยุดเผยแพร่' : 'เผยแพร่';
      const unpublish = target.isPublished ? 'เผยแพร่' : 'หยุดเผยแพร่';
      await page.getByRole('button', { name: publish, exact: true }).click();
      await page.getByText(target.isPublished ? 'หยุดเผยแพร่ความคิดเห็นแล้ว' : 'เผยแพร่ความคิดเห็นแล้ว').waitFor();
      const publicIds = (await (await fetch(`${api}/feedback/`)).json()).map((f) => f.id);
      assert.equal(publicIds.includes(target.id), !target.isPublished);
      await page.getByRole('button', { name: unpublish, exact: true }).click();
      await page.getByText(target.isPublished ? 'เผยแพร่ความคิดเห็นแล้ว' : 'หยุดเผยแพร่ความคิดเห็นแล้ว').waitFor();

      const logs = await callApi(page, 'GET', `/audit-logs/?entity=feedbacks&entity_id=${target.id}`);
      assert.equal(logs.status, 200);
      const rows = Array.isArray(logs.data) ? logs.data : logs.data.items;
      assert.ok(rows.filter((r) => r.action === 'update').length >= 3, 'reply, publish and unpublish each audited');
    });

    await v4step('/feedback: coordinator can reply but has no publish button, and the API refuses publishing', async () => {
      const page = pages.coordinator;
      await open(page, '/feedback');
      await page.getByRole('button', { name: 'บันทึกคำตอบ' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^(เผยแพร่|หยุดเผยแพร่)$/ }).count(), 0);
      assert.equal((await callApi(page, 'PATCH', `/feedback/${restore.id}`, { is_published: true })).status, 403);
      await open(pages.student, '/feedback');
      assert.equal(await pages.student.getByRole('button', { name: 'บันทึกคำตอบ' }).count(), 0);
    });

    // ---------- Staff dashboard ----------
    await step('staff dashboard: CSV export, "เพิ่มกิจกรรม" opens the add form, "เปิดข้อตกลง" opens the agreement', async () => {
      const page = pages.staff;
      await open(page, '/dashboard/staff');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ส่งออก CSV' }).click()]);
      assert.match(download.suggestedFilename(), /^pcsms-activities-\d{4}\.csv$/);
      const renew = page.getByRole('link', { name: 'เปิดข้อตกลง' });
      const renewCount = await renew.count();
      if (renewCount > 0) {
        const card = renew.first().locator('xpath=../..');
        const title = (await card.locator('.font-bold').first().innerText()).trim();
        await renew.first().click();
        await page.waitForURL(/\/documents\/manage$/);
        await page.getByRole('dialog', { name: title }).waitFor();
        await shot(page, '07-renew-opens-agreement');
        await open(page, '/dashboard/staff');
      } else {
        console.log('  (no agreement expires within 90 days, so "เปิดข้อตกลง" was not shown)');
      }
      await page.getByRole('link', { name: 'เพิ่มกิจกรรม' }).click();
      await page.waitForURL(/\/activities\/manage$/);
      await page.getByRole('dialog', { name: 'เพิ่มกิจกรรม' }).waitFor();
      await shot(page, '08-add-activity-dialog');
    });
  } finally {
    if (restore && pages.staff) {
      const { id, ...body } = restore;
      const back = await callApi(pages.staff, 'PATCH', `/feedback/${id}`, body);
      console.log(back.status === 200 ? `restored feedback #${id}` : `could not restore feedback #${id}: HTTP ${back.status}`);
    }
    await browser.close();
  }

  const failed = results.filter((r) => r.status === 'failed');
  const ran = results.filter((r) => r.status !== 'skipped');
  const errors = [...new Set(consoleErrors)].filter((e) => !/401|403|Unauthorized|Forbidden/.test(e));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, consoleErrors: errors }, null, 2));
  console.log(`\n${ran.length - failed.length}/${ran.length} passed (${results.length - ran.length} V4 steps skipped); screenshots in ${output}`);
  if (errors.length) console.log('console errors:\n  ' + errors.join('\n  '));
  process.exit(failed.length ? 1 : 0);
})();
