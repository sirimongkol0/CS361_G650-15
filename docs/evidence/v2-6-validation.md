# V2-6 Validation, Integration Test & Evidence — issue #48

ตรวจวันที่ 1 ตุลาคม 2026 (Asia/Bangkok) บน branch `issue/v2-6-integration-test` จาก `main` commit `61d3fd1` ซึ่งรวม V2-1 ถึง V2-5 แล้ว ชุดทดสอบและเอกสารใน PR นี้ต่อยอดจาก commit ดังกล่าว; CI artifact ของ PR ระบุ exact checkout commit ใน `manifest.json` จึงใช้ตรวจเวอร์ชันที่รันจริงได้

## ผลตรวจในเครื่อง

| สภาพแวดล้อม/คำสั่ง | ผล |
| --- | --- |
| Windows, Python 3.11.15, PostgreSQL 16.15 ใน Docker container แยก | ทำงาน |
| Node.js 26.6.0, Playwright 1.62.1, Chromium 151.0.7922.34, Next.js 16.3.4 | ทำงาน |
| Backend pytest บน PostgreSQL ฐานข้อมูล `pcsms_backend_test` | 61 passed |
| Backend pytest บน SQLite | 58 passed, 3 PostgreSQL-only skips |
| Frontend production build และ TypeScript | ผ่าน |
| `prepare_v2_validation.py` | migration 2 ครั้ง; seed 2 ครั้งโดยจำนวนและ ID ไม่เปลี่ยน; foreign key ครบ |
| `v2-integration.cjs` กับ FastAPI/PostgreSQL จริง | 14 กลุ่ม API/UI ผ่าน และไม่มี browser runtime errors (15 รายการใน result) |
| Main flow และ Refresh | ผ่านทุก detail/relationship/download |
| ภาพหลักฐาน | 18 ภาพ ซ่อน account/role controls เฉพาะการจับภาพ |

ฐานข้อมูลชุดเต็มมี 10 partners / 10 documents / 12 activities; Public API ส่ง 9 / 9 / 11 รายการตาม DB oracle โดยไม่ส่งข้อมูลไม่เผยแพร่ ข้อมูลตัวอย่างจาก seed เดิมและไฟล์ PDF ระบุชัดว่า synthetic ไม่ใช่ข้อมูลทางการ การรันทดลองใช้ database/storage แยก ไม่มีการอ่านหรือเขียนฐานข้อมูลส่วนกลาง

## เกณฑ์ issue #48 และหลักฐาน

| เกณฑ์ | หลักฐานที่ตรวจ |
| --- | --- |
| Backend และ Frontend checks ผ่าน | pytest PostgreSQL/SQLite, build และ CI |
| seed → list → search/filter → detail/relationship → download | browser main flow ใช้ ID จาก DB manifest และเทียบ filename/hash ของ PDF |
| Search/Filter, missing records/files, UI states | combined filters ทั้ง 3 ฟีเจอร์, reset, inclusive date boundary, invalid agreement range, empty search/list, real 404, held-request Loading และ injected 503/Retry |
| Refresh แล้วตรง DB | reload stakeholder/agreement/activity แล้วเปิดความสัมพันธ์เดิมและเทียบ ID จาก manifest |
| V1 unpublished regression | ทุก list/detail ไม่ส่ง draft, download ของ draft 404, activity ที่เผยแพร่อ้าง private targets แล้วไม่มีลิงก์เปิดเผย |
| ไม่มี mock fallback | successful responses มาจาก FastAPI/DB; 503 ไม่มี table/link ปลอมและ Retry โหลดกลับ |
| commit/environment/เตรียมข้อมูลครบ | manifest ระบุ checkout SHA, PostgreSQL/Python versions, FK และ PDF hash; result ระบุ Node/Chromium และ cases; request transcript เก็บ status/body |
| Demo Guide ทำซ้ำได้ | [คู่มือและคำสั่ง](../demo-v2.md); เตรียมข้อมูล/รันทดสอบซ้ำผ่านในเครื่อง และมี CI PostgreSQL job อัตโนมัติ |
| หลักฐานฟีเจอร์ใน PR และ review | ตารางตรวจ PR ของ V2-1 ถึง V2-5 ด้านล่าง; ทบทวน merged code ร่วมกันอีกครั้งใน V2-6 |

## การทดสอบและการจำลองข้อผิดพลาด

`frontend/tests/v2-integration.cjs` ตรวจทุก published list/detail เทียบกับ `manifest.json` ที่อ่านจาก DB โดยตรง และตรวจ foreign key ของทุก document/activity พร้อม API combined search/filter และ period overlap

ข้อมูลปกติและ JSON ที่หน้าเว็บได้รับมาจาก API จริงทั้งหมด Browser route ส่ง request ต่อไป API เดิม ไม่มี fixture JSON แทนข้อมูลธุรกิจ การตรวจ list ว่างใช้ query ที่ API จริงคืนผลว่าง; transcript ระบุ `forwardedQuery` ส่วน failure injection มีเฉพาะ HTTP 503 สำหรับตรวจ Error/Retry และ gate ที่หน่วง request สำหรับตรวจ Loading ตรวจ CORS origin ของ UI ด้วย direct API request

Missing-file ใช้ DB row ที่อ้าง storage key ซึ่งไม่มีไฟล์จริง API ต้องคืน 404 และ UI แสดงข้อผิดพลาด จากนั้นตัวทดสอบวาง PDF fixture กลับใน storage directory แยกแล้วกด Retry ตรวจ filename ภาษาไทยและ SHA-256 การเตรียมข้อมูลก่อนรันซ้ำคืน fixture นี้เป็นสถานะไฟล์หายโดยลบเฉพาะ reserved key

ไฟล์ PDF ตัวอย่างมีขนาด 836 bytes และ SHA-256 `1ddcc858765a80e935883999b058a74428d0a9dd00e5d7251745377c1c4bbef5` ตรวจดาวน์โหลดไฟล์ seed ทั้ง 7 รายการผ่าน API และดาวน์โหลดจาก UI ของข้อตกลงที่เลือกจริง

## ทบทวนฟีเจอร์ที่รวมแล้ว

ทบทวน merged PR และโค้ดปัจจุบันร่วมกับผล integration โดย Codex ในงาน V2-6 นี้ ไม่อ้างว่ามี GitHub review แบบ APPROVED จากบุคคลอื่น (API ของ PR เดิมไม่มี review records)

| ฟีเจอร์ | PR ที่ merge แล้วและหลักฐาน | ผลทบทวนใน V2-6 |
| --- | --- | --- |
| V2-1 Schema | [#50](https://github.com/sirimongkol0/CS361_G650-15/pull/50), migration/seed/PostgreSQL CI ใน PR | migration รันซ้ำ, seed ID/count คงเดิม, FK และ files ผ่าน |
| V2-2 Stakeholders | [#53](https://github.com/sirimongkol0/CS361_G650-15/pull/53), `v2-2-stakeholders.md` | list/detail/filters/reset/relationships/Refresh/states ผ่าน |
| V2-3 Agreements | [#54](https://github.com/sirimongkol0/CS361_G650-15/pull/54), `v2-3-agreements.md` | overlap/download bytes/ชื่อไฟล์/missing file/Retry/relationships ผ่าน |
| V2-4 Activities | [#52](https://github.com/sirimongkol0/CS361_G650-15/pull/52), Validation ใน PR | filters/status/dates/detail/Refresh/optional agreement ผ่าน |
| V2-5 Relationships | [#55](https://github.com/sirimongkol0/CS361_G650-15/pull/55), `v2-5-relationships.md` | FK isolation, link ทุกทิศทาง, hidden targets และ error recovery ผ่าน |

ตรวจ code path ของ `loadPublicPartners`, `loadPublicPartner`, `loadDocuments`, `loadDocument`, `loadActivities`, `loadActivity` ใช้ strict API loaders ที่ส่ง error กลับให้ UI ไม่เรียก `safeLoad` หรือคืน mock records; `RelatedRecords` กรองด้วย FK จริง และ endpoints ของ relationship targets ใช้ public visibility criteria ร่วมกัน

## ภาพหลักฐาน

ภาพทั้งหมดอยู่ใน [v2-6/](v2-6/) และชุด CI artifact มีภาพครบเช่นเดียวกัน:

- Search/Filter: [Stakeholders](v2-6/stakeholder-filters.png), [Agreements](v2-6/agreement-filters.png), [Activities](v2-6/activity-filters.png)
- Relationships: [Stakeholder](v2-6/stakeholder-relationships.png), [Agreement](v2-6/agreement-relationships.png), [Activity](v2-6/activity-relationships.png)
- UI states: [Loading](v2-6/documents-loading.png), [Empty](v2-6/documents-empty.png), [Error/Retry](v2-6/documents-error.png), [Not Found](v2-6/not-found.png), [Empty relationships](v2-6/empty-relationships.png), [Missing file/Retry](v2-6/missing-file.png)

CI job `v2-integration` เก็บ `manifest.json`, `result.json`, `requests.json`, screenshot และ server logs เป็น artifact ทุกครั้ง พร้อมกับ jobs เดิมที่ตรวจ backend PostgreSQL/SQLite, frontend build และ clean Compose smoke ผลที่เผยแพร่ใน PR และ CI เป็นแหล่งอ้างอิงของ commit ที่ตรวจจริง
