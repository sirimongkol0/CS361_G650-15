const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ids = JSON.parse(fs.readFileSync(process.env.TEST_RELATIONSHIP_IDS || '.tmp-v2-5-ids.json', 'utf8'));
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3125';
const api = process.env.TEST_API_URL || 'http://127.0.0.1:8125';
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(10000);
  const errors=[];
  page.on('pageerror', e => errors.push(e.message));
  let failPath=null, gate=null;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (gate) await gate;
    if (path === failPath) return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"Audit outage"}'});
    const response=await route.fetch({url:api+path});
    await route.fulfill({response});
  });
  const section = title => page.locator('section').filter({has:page.getByRole('heading',{name:title,exact:true})});
  const go = path => page.goto(base+path);
  // Screenshot-only styling keeps V2 evidence focused on repository relationships.
  const captureEvidence = async path => {
    await page.getByText('ประเภทผู้ใช้', {exact:true}).locator('..').evaluateAll(elements => elements.forEach(el => el.setAttribute('data-v2-evidence-hide', '')));
    await page.locator('aside button[title="ออกจากระบบ"]').locator('../..').evaluateAll(elements => elements.forEach(el => el.setAttribute('data-v2-evidence-hide', '')));
    await page.screenshot({path, fullPage:true, style:'[data-v2-evidence-hide] { display:none !important; } header > .badge, header > div:last-child { visibility:hidden !important; }'});
    await page.locator('[data-v2-evidence-hide]').evaluateAll(elements => elements.forEach(el => el.removeAttribute('data-v2-evidence-hide')));
  };
  try {
    let release;
    gate=new Promise(r=>release=r);
    await go(`/stakeholders/${ids.alpha}`);
    await page.getByRole('heading',{name:'กำลังโหลดข้อมูลหน่วยงาน',exact:true}).waitFor();
    release(); gate=null;
    await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:'Audit Agreement Alpha',exact:true}).waitFor();
    assert.equal(await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link').count(),1);
    assert.equal(await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link').count(),2);
    assert.equal(await page.getByRole('link',{name:'Audit Agreement Beta',exact:true}).count(),0);
    await captureEvidence('docs/evidence/v2-5-stakeholder.png');
    await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:'Audit Agreement Alpha',exact:true}).click();
    await page.getByRole('heading',{name:'Audit Agreement Alpha',exact:true}).waitFor();
    await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:'Audit Activity Alpha',exact:true}).waitFor();
    assert.equal(await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link').count(),1);
    assert.equal(await section('หน่วยงาน').getByRole('link').getAttribute('href'),`/stakeholders/${ids.alpha}`);
    await captureEvidence('docs/evidence/v2-5-agreement.png');
    await section('หน่วยงาน').getByRole('link').click();
    await page.getByRole('heading',{name:'Audit Alpha',exact:true}).waitFor();
    await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:'Audit Activity Alpha',exact:true}).click();
    await page.getByRole('heading',{name:'Audit Activity Alpha',exact:true}).waitFor();
    assert.equal(await section('ข้อมูลกิจกรรม').getByRole('link').getAttribute('href'),`/stakeholders/${ids.alpha}`);
    assert.equal(await section('เอกสารที่เกี่ยวข้อง').getByRole('link').getAttribute('href'),`/documents/${ids.docAlpha}`);
    await captureEvidence('docs/evidence/v2-5-activity.png');
    await section('ข้อมูลกิจกรรม').getByRole('link').click();
    await page.getByRole('heading',{name:'Audit Alpha',exact:true}).waitFor();
    await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:'Audit Activity Alpha',exact:true}).click();
    await page.getByRole('heading',{name:'Audit Activity Alpha',exact:true}).waitFor();
    await section('เอกสารที่เกี่ยวข้อง').getByRole('link').click();
    await page.getByRole('heading',{name:'Audit Agreement Alpha',exact:true}).waitFor();
    await go(`/stakeholders/${ids.beta}`);
    await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:'Audit Agreement Beta',exact:true}).waitFor();
    assert.equal(await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link').count(),1);
    await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:'Audit Activity Beta',exact:true}).waitFor();
    assert.equal(await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link').count(),1);
    await go(`/stakeholders/${ids.empty}`);
    await page.getByRole('heading',{name:'ยังไม่มีข้อตกลงที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();
    await page.getByRole('heading',{name:'ยังไม่มีกิจกรรมที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();
    await go(`/documents/${ids.docEmpty}`);
    await page.getByRole('heading',{name:'ยังไม่มีกิจกรรมที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();
    await go(`/activities/${ids.solo}`);
    await page.getByRole('heading',{name:'ยังไม่มีข้อตกลงที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();
    await go(`/activities/${ids.hiddenEvent}`);
    await page.getByRole('heading',{name:'Audit Public Hidden Targets',exact:true}).waitFor();
    assert.equal(await page.locator(`a[href="/stakeholders/${ids.hiddenPartner}"]`).count(),0);
    assert.equal(await page.locator(`a[href="/documents/${ids.hiddenDoc}"]`).count(),0);
    await go(`/stakeholders/${ids.hiddenPartner}`);
    await page.getByRole('heading',{name:'ไม่พบข้อมูลที่เผยแพร่',exact:true}).waitFor();
    await go(`/documents/${ids.hiddenDoc}`);
    await page.getByRole('heading',{name:'ไม่พบข้อมูลที่เผยแพร่',exact:true}).waitFor();
    for (const [path,target,title,label] of [
      [`/stakeholders/${ids.alpha}`,'/api/v1/documents/','ข้อตกลงที่เกี่ยวข้อง','Audit Agreement Alpha'],
      [`/stakeholders/${ids.alpha}`,'/api/v1/activities/','กิจกรรมที่เกี่ยวข้อง','Audit Activity Alpha'],
      [`/documents/${ids.docAlpha}`,'/api/v1/activities/','กิจกรรมที่เกี่ยวข้อง','Audit Activity Alpha'],
    ]) {
      failPath=target; await go(path);
      await section(title).getByRole('heading',{name:'ไม่สามารถโหลดข้อมูลได้',exact:true}).waitFor();
      assert.equal(await section(title).getByRole('link').count(),0);
      failPath=null;
      await section(title).getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
      await section(title).getByRole('link',{name:label,exact:true}).waitFor();
    }
    for (const [path,target,label] of [
      [`/stakeholders/${ids.alpha}`,`/api/v1/partners/${ids.alpha}`,'Audit Alpha'],
      [`/documents/${ids.docAlpha}`,`/api/v1/documents/${ids.docAlpha}`,'Audit Agreement Alpha'],
      [`/stakeholders/${ids.beta}`,`/api/v1/partners/${ids.beta}`,'Audit Beta'],
      [`/activities/${ids.eventAlpha}`,`/api/v1/activities/${ids.eventAlpha}`,'Audit Activity Alpha'],
    ]) {
      failPath=target; await go(path);
      await page.getByRole('heading',{name:'ไม่สามารถโหลดข้อมูลได้',exact:true}).waitFor();
      failPath=null;
      await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
      await page.getByRole('heading',{name:label,exact:true}).waitFor();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: real DB navigation in every direction; isolation; loading; empty; hidden targets; 3 related-list error/retry cases; 4 detail error/retry cases; no browser runtime errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
