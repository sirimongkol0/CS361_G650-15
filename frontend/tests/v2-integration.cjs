const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const reportDir = path.resolve(process.env.TEST_REPORT_DIR || '.tmp-v2-6');
const manifest = JSON.parse(fs.readFileSync(path.join(reportDir,'manifest.json'),'utf8'));
const api = (process.env.TEST_API_URL || 'http://127.0.0.1:8126/api/v1').replace(/\/$/,'');
const base = process.env.TEST_FRONTEND_URL || 'http://localhost:3126';
const ids=manifest.selection;
const records={partners:manifest.partners.filter(x=>x.published),documents:manifest.documents.filter(x=>x.published),activities:manifest.activities.filter(x=>x.published)};
const transcript=[],cases=[];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const equalIds=(actual,expected)=>assert.deepEqual(actual.map(x=>x.id).sort((a,b)=>a-b),expected.map(x=>x.id).sort((a,b)=>a-b));
async function get(route,status=200) {
  const response=await fetch(api+route,{headers:{Origin:base}});
  assert.equal(response.headers.get('access-control-allow-origin'),base,'Browser origin must be allowed for the demo UI'); const buffer=Buffer.from(await response.arrayBuffer());
  const json=response.headers.get('content-type')?.includes('json') ? JSON.parse(buffer) : null;
  transcript.push({kind:'api',route,status:response.status,body:json,sha256:json?undefined:sha(buffer),bytes:buffer.length});
  assert.equal(response.status,status,route); return json ?? buffer;
}
async function check(name,work) {await work();cases.push({name,status:'passed'});console.log('PASS:',name);}
(async()=>{
  fs.mkdirSync(path.join(reportDir,'screenshots'),{recursive:true});
  let browser,page;
  try {
    await check('API lists/detail equal seeded database IDs and foreign keys',async()=>{
      for(const type of ['partners','documents','activities']) {
        const list=await get(`/${type}/`); equalIds(list,records[type]);
        for(const expected of records[type]) {
          const detail=await get(`/${type}/${expected.id}`);
          assert.equal(detail.name,expected.name);
          if(type==='documents') assert.equal(detail.partnerId,expected.partnerId);
          if(type==='activities') {assert.equal(detail.partner?.id??null,expected.partnerId);assert.equal(detail.mouDocId,expected.documentId);}
        }
      }
    });
    await check('API combined search/filter and inclusive period boundaries',async()=>{
      const p=records.partners.find(x=>x.id===ids.partner), d=records.documents.find(x=>x.id===ids.document), a=records.activities.find(x=>x.id===ids.activity);
      equalIds(await get(`/partners/?search=${encodeURIComponent(p.name)}&partner_type=${p.type}&country=${encodeURIComponent(p.country)}`),[p]);
      equalIds(await get(`/documents/?search=${encodeURIComponent(d.name)}&doc_type=${d.type}&status=${d.status}&date_from=${d.expiryDate}&date_to=${d.expiryDate}`),[d]);
      equalIds(await get(`/activities/?search=${encodeURIComponent(a.name)}&activity_type=${encodeURIComponent(a.type)}&status=${encodeURIComponent(a.status)}&date_from=${a.date}&date_to=${a.date}`),[a]);
      for(const type of ['partners','documents','activities']) equalIds(await get(`/${type}/?search=V2-NO-SUCH-RECORD`),[]);
      await get('/documents/?date_from=2027-01-01&date_to=2026-01-01',422);
    });
    await check('API V1 regression: draft list/detail/download and private relationship targets',async()=>{
      for(const [type,id] of [['partners',ids.hiddenPartner],['documents',ids.hiddenDocument],['activities',ids.hiddenActivity]]) await get(`/${type}/${id}`,404);
      await get(`/documents/${ids.hiddenDocument}/download`,404);
      const body=await get(`/activities/${ids.privateTargetsActivity}`);assert.equal(body.partner,null);assert.equal(body.mouDocId,null);
    });
    await check('API real PDF hash/size for every prepared file, metadata-only and missing-file 404',async()=>{
      for(const d of records.documents.filter(x=>x.storageKey && x.id!==ids.missingDocument)) {
        const bytes=await get(`/documents/${d.id}/download`);assert.equal(sha(bytes),manifest.sampleSha256);assert.equal(bytes.length,d.sizeBytes);
      }
      await get(`/documents/${ids.missingDocument}/download`,404);
      await get(`/documents/${ids.metadataDocument}/download`,404);
    });
    browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(12000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let failPath=null,emptyPath=null,gatePath=null,gate=null;
    await page.route('**/api/v1/**',async route=>{
      const url=new URL(route.request().url()), endpoint=url.pathname.replace('/api/v1','');
      if(endpoint===gatePath && gate) await gate;
      if(endpoint===failPath) {transcript.push({kind:'injected-outage',route:endpoint,status:503});return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"V2 audit outage"}'});}
      const response=await route.fetch({url:api+endpoint+(endpoint===emptyPath?'?search=V2-NO-SUCH-RECORD':url.search)});
      let body=null;try {body=await response.json();}catch{}
      transcript.push({kind:'browser-api',route:endpoint,forwardedQuery:endpoint===emptyPath?'?search=V2-NO-SUCH-RECORD':url.search,status:response.status(),body});await route.fulfill({response});
    });
    const go = route => page.goto(base+route);
    const section=title=>page.locator('section').filter({has:page.getByRole('heading',{name:title,exact:true})});
    const capture=async name=>{
      await page.getByText('ประเภทผู้ใช้',{exact:true}).locator('..').evaluateAll(es=>es.forEach(e=>e.setAttribute('data-evidence-hidden','')));
      await page.locator('aside button[title="ออกจากระบบ"]').locator('../..').evaluateAll(es=>es.forEach(e=>e.setAttribute('data-evidence-hidden','')));
      await page.screenshot({path:path.join(reportDir,'screenshots',name+'.png'),fullPage:true,style:'[data-evidence-hidden] {display:none!important} header > .badge, header > div:last-child {visibility:hidden!important}'});
      await page.locator('[data-evidence-hidden]').evaluateAll(es=>es.forEach(e=>e.removeAttribute('data-evidence-hidden')));
    };
    await check('UI stakeholder combined filters, empty search and reset',async()=>{
      const p=records.partners.find(x=>x.id===ids.partner);await go('/stakeholders');await page.getByRole('link',{name:p.name,exact:true}).waitFor();
      await page.getByPlaceholder('ค้นหาหน่วยงานหรือผู้ติดต่อ...').fill(p.name);
      await page.getByLabel('ประเภทหน่วยงาน').selectOption(p.type);await page.getByLabel('ประเทศ').selectOption({label:'🇹🇭 ไทย'});
      assert.equal(await page.locator('tbody tr').count(),1);await capture('stakeholder-filters');
      await page.getByPlaceholder('ค้นหาหน่วยงานหรือผู้ติดต่อ...').fill('V2-NO-SUCH-RECORD');await page.getByRole('heading',{name:'ไม่พบหน่วยงานที่ค้นหา',exact:true}).waitFor();
      await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),records.partners.length);
    });
    await check('UI main flow stakeholder → agreement → activity → stakeholder/download and refresh',async()=>{
      const p=records.partners.find(x=>x.id===ids.partner),d=records.documents.find(x=>x.id===ids.document),a=records.activities.find(x=>x.id===ids.activity);
      await page.getByRole('link',{name:p.name,exact:true}).click();await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:d.name,exact:true}).waitFor();
      assert.equal(await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link').count(),records.documents.filter(x=>x.partnerId===p.id).length);
      await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:a.name,exact:true}).waitFor();
      assert.equal(await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link').count(),records.activities.filter(x=>x.partnerId===p.id).length);
      await capture('stakeholder-relationships');await page.reload();await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:d.name,exact:true}).waitFor();
      await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:d.name,exact:true}).click();await page.getByRole('heading',{name:d.name,exact:true}).waitFor();await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:a.name,exact:true}).waitFor();
      assert.equal(await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link').count(),records.activities.filter(x=>x.documentId===d.id).length);
      await capture('agreement-relationships');await page.reload();await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:a.name,exact:true}).waitFor();
      await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:a.name,exact:true}).click();await page.getByRole('heading',{name:a.name,exact:true}).waitFor();
      assert.equal(await section('ข้อมูลกิจกรรม').getByRole('link').getAttribute('href'),`/stakeholders/${p.id}`);
      await capture('activity-relationships');await page.reload();await page.getByRole('heading',{name:a.name,exact:true}).waitFor();
      await section('เอกสารที่เกี่ยวข้อง').getByRole('link').click();await page.getByRole('heading',{name:d.name,exact:true}).waitFor();
      await section('กิจกรรมที่เกี่ยวข้อง').getByRole('link',{name:a.name,exact:true}).click();await page.getByRole('heading',{name:a.name,exact:true}).waitFor();
      await section('ข้อมูลกิจกรรม').getByRole('link').click();await page.getByRole('heading',{name:p.name,exact:true}).waitFor();
      await section('ข้อตกลงที่เกี่ยวข้อง').getByRole('link',{name:d.name,exact:true}).click();await page.getByRole('heading',{name:d.name,exact:true}).waitFor();
      const promise=page.waitForEvent('download');await page.getByRole('button',{name:`ดาวน์โหลดเอกสาร ${d.id}`,exact:true}).first().click();const download=await promise;
      assert.equal(download.suggestedFilename(),d.fileName);assert.equal(sha(fs.readFileSync(await download.path())),manifest.sampleSha256);
      await section('หน่วยงาน').getByRole('link').click();await page.getByRole('heading',{name:p.name,exact:true}).waitFor();
    });
    await check('UI agreement search/type/status/inclusive dates, invalid range, empty and reset',async()=>{
      const d=records.documents.find(x=>x.id===ids.document);await go('/documents');await page.getByRole('link',{name:d.name,exact:true}).waitFor();
      await page.getByPlaceholder('ค้นหาชื่อข้อตกลง, หน่วยงาน...').fill(d.name);await page.getByLabel('ประเภทเอกสาร').selectOption(d.type.toUpperCase());await page.getByLabel('สถานะเอกสาร').selectOption(d.status);
      await page.getByLabel('ช่วงเวลาที่มีผลจาก').fill(d.expiryDate);await page.getByLabel('ช่วงเวลาที่มีผลถึง').fill(d.expiryDate);assert.equal(await page.locator('tbody tr').count(),1);await capture('agreement-filters');
      await page.getByLabel('ช่วงเวลาที่มีผลจาก').fill('2030-01-01');await page.getByText('วันเริ่มต้องไม่เกินวันสิ้นสุด',{exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),0);
      await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),records.documents.length);
      await page.getByPlaceholder('ค้นหาชื่อข้อตกลง, หน่วยงาน...').fill('V2-NO-SUCH-RECORD');await page.getByRole('heading',{name:'ไม่พบเอกสารที่ค้นหา',exact:true}).waitFor();
    });
    await check('UI activity combined search/type/organization/status/dates, empty and reset',async()=>{
      const a=records.activities.find(x=>x.id===ids.activity),p=records.partners.find(x=>x.id===a.partnerId);await go('/activities');await page.getByRole('link',{name:a.name,exact:true}).waitFor();
      await page.getByPlaceholder('ค้นหากิจกรรมหรือหน่วยงาน...').fill(a.name);
      const filters=page.locator('main select');await filters.nth(0).selectOption(a.type);await filters.nth(1).selectOption(p.name);await filters.nth(2).selectOption(a.status);
      await page.getByLabel('วันที่เริ่มต้น').fill(a.date);await page.getByLabel('วันที่สิ้นสุด').fill(a.date);assert.equal(await page.locator('tbody tr').count(),1);await capture('activity-filters');
      await page.getByPlaceholder('ค้นหากิจกรรมหรือหน่วยงาน...').fill('V2-NO-SUCH-RECORD');await page.getByRole('heading',{name:'ไม่พบกิจกรรมที่ค้นหา',exact:true}).waitFor();
      await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),records.activities.length);
    });
    await check('UI no agreement/related records, metadata-only and draft/unknown ID Not Found',async()=>{
      await go(`/stakeholders/${ids.emptyPartner}`);await page.getByRole('heading',{name:'ยังไม่มีข้อตกลงที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();await page.getByRole('heading',{name:'ยังไม่มีกิจกรรมที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();await capture('empty-relationships');
      await go(`/activities/${ids.noAgreementActivity}`);await page.getByRole('heading',{name:'ยังไม่มีข้อตกลงที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();
      await go(`/documents/${ids.metadataDocument}`);await page.getByRole('heading',{name:'ยังไม่มีกิจกรรมที่เกี่ยวข้องที่เผยแพร่',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/ดาวน์โหลดเอกสาร/}).count(),0);
      for(const route of [`/stakeholders/${ids.hiddenPartner}`,`/documents/${ids.hiddenDocument}`,`/activities/${ids.hiddenActivity}`,'/stakeholders/999999','/documents/999999','/activities/999999']) {await go(route);await page.getByRole('heading',{name:'ไม่พบข้อมูลที่เผยแพร่',exact:true}).waitFor();}
      await capture('not-found');await go(`/activities/${ids.privateTargetsActivity}`);await page.getByRole('heading',{name:'V2-6 Public Activity Private Targets',exact:true}).waitFor();assert.equal(await page.locator(`a[href="/stakeholders/${ids.hiddenPartner}"],a[href="/documents/${ids.hiddenDocument}"]`).count(),0);
    });
    for(const [route,endpoint,loading,emptyTitle] of [['/stakeholders','/partners/','กำลังโหลดหน่วยงาน','ยังไม่มีข้อมูลที่เผยแพร่'],['/documents','/documents/','กำลังโหลดเอกสาร','ยังไม่มีเอกสารที่เผยแพร่'],['/activities','/activities/','กำลังโหลดกิจกรรม','ยังไม่มีกิจกรรมที่เผยแพร่']]) {
      await check(`UI ${route} Loading/real empty list/Error/Retry without fallback`,async()=>{
        let release;gatePath=endpoint;gate=new Promise(r=>release=r);await go(route);await page.getByRole('heading',{name:loading,exact:true}).waitFor();await capture(route.slice(1)+'-loading');release();gate=null;gatePath=null;await page.locator('tbody tr').first().waitFor();
        emptyPath=endpoint;await page.reload();await page.getByRole('heading',{name:emptyTitle,exact:true}).waitFor();await capture(route.slice(1)+'-empty');emptyPath=null;
        failPath=endpoint;await page.reload();await page.getByRole('heading',{name:'ไม่สามารถโหลดข้อมูลได้',exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),0);await capture(route.slice(1)+'-error');
        failPath=null;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await page.locator('tbody tr').first().waitFor();
      });
    }
    await check('UI detail and relationship errors recover through Retry',async()=>{
      for(const [route,endpoint,name] of [[`/stakeholders/${ids.partner}`,`/partners/${ids.partner}`,records.partners.find(x=>x.id===ids.partner).name],[`/documents/${ids.document}`,`/documents/${ids.document}`,records.documents.find(x=>x.id===ids.document).name],[`/activities/${ids.activity}`,`/activities/${ids.activity}`,records.activities.find(x=>x.id===ids.activity).name]]) {
        failPath=endpoint;await go(route);await page.getByRole('heading',{name:'ไม่สามารถโหลดข้อมูลได้',exact:true}).waitFor();failPath=null;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();
      }
      for(const [route,endpoint,title,name] of [[`/stakeholders/${ids.partner}`,'/documents/','ข้อตกลงที่เกี่ยวข้อง',records.documents.find(x=>x.id===ids.document).name],[`/stakeholders/${ids.partner}`,'/activities/','กิจกรรมที่เกี่ยวข้อง',records.activities.find(x=>x.id===ids.activity).name],[`/documents/${ids.document}`,'/activities/','กิจกรรมที่เกี่ยวข้อง',records.activities.find(x=>x.id===ids.activity).name]]) {
        failPath=endpoint;await go(route);await section(title).getByRole('heading',{name:'ไม่สามารถโหลดข้อมูลได้',exact:true}).waitFor();assert.equal(await section(title).getByRole('link').count(),0);failPath=null;await section(title).getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await section(title).getByRole('link',{name,exact:true}).waitFor();
      }
    });
    await check('UI actual missing file 404, restored fixture and download Retry',async()=>{
      await go(`/documents/${ids.missingDocument}`);const button=page.getByRole('button',{name:`ดาวน์โหลดเอกสาร ${ids.missingDocument}`,exact:true}).first();await button.click();await page.getByText('ไม่พบไฟล์เอกสารที่พร้อมดาวน์โหลด',{exact:true}).waitFor();await capture('missing-file');
      const storageRoot=path.resolve(manifest.storageDirectory),target=path.resolve(storageRoot,manifest.missingStorageKey);assert.ok(target.startsWith(storageRoot+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(manifest.sampleFile));
      const promise=page.waitForEvent('download');await button.click();const download=await promise;assert.equal(download.suggestedFilename(),'ตัวอย่าง V2-6.pdf');assert.equal(sha(fs.readFileSync(await download.path())),manifest.sampleSha256);
    });
    assert.deepEqual(errors,[]);cases.push({name:'No browser runtime errors',status:'passed'});
    fs.writeFileSync(path.join(reportDir,'result.json'),JSON.stringify({status:'passed',database:manifest.databaseEngine,sourceCommit:manifest.sourceCommit,completedAt:new Date().toISOString(),browserVersion:browser.version(),nodeVersion:process.version,cases},null,2));
  } catch(error) {
    if(page) await page.screenshot({path:path.join(reportDir,'failure.png'),fullPage:true}).catch(()=>{});
    fs.writeFileSync(path.join(reportDir,'result.json'),JSON.stringify({status:'failed',cases,error:error.stack},null,2));throw error;
  } finally {
    fs.writeFileSync(path.join(reportDir,'requests.json'),JSON.stringify(transcript,null,2));if(browser) await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
