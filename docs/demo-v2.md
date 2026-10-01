# V2 Demo Guide — issue #48

คู่มือนี้ตรวจ V2 ที่รวม V2-1 ถึง V2-5 แล้ว จาก migration/seed → list → search/filter → detail/relationship → download → refresh ด้วย FastAPI และ PostgreSQL จริง ข้อมูล seed และ PDF เป็นตัวอย่างที่ระบุว่า synthetic ไม่ใช่ข้อตกลงทางการ

## เตรียมสภาพแวดล้อม (PowerShell / Windows)

ใช้ Python 3.11, Node.js 22 ขึ้นไป, npm และ Docker Desktop ที่ทำงานอยู่ รันจากโฟลเดอร์หลักของ repository บน branch `issue/v2-6-integration-test` หรือ `main` หลังรวม PR นี้

```powershell
py -3.11 -m venv .tmp-v2-6-venv
.tmp-v2-6-venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm ci --prefix frontend
npm install --prefix .tmp-v2-tools --no-save --package-lock=false playwright@1.62.1
node .tmp-v2-tools/node_modules/playwright/cli.js install chromium

docker run --detach --name cs361-v2-6-demo --publish 127.0.0.1:5546:5432 --env POSTGRES_USER=v2test --env POSTGRES_PASSWORD=v2_local_test --env POSTGRES_DB=pcsms_v2_test postgres:16-alpine
docker exec cs361-v2-6-demo pg_isready -U v2test
```

หาก `pg_isready` ยังไม่พร้อม ให้รันตรวจซ้ำก่อนขั้นต่อไป หาก port 5546 ถูกใช้งานให้ใช้ port ว่างและเปลี่ยน URL ด้านล่างให้ตรงกัน credential นี้ใช้เฉพาะ container ทดลองนี้

## Terminal 1: เตรียมฐานข้อมูลและเปิด API

```powershell
$env:DATABASE_URL='postgresql://v2test:v2_local_test@127.0.0.1:5546/pcsms_v2_test'
$env:STORAGE_BACKEND='local'
$env:CORS_ORIGINS='http://localhost:3126'
$env:TEST_REPORT_DIR=Join-Path (Get-Location) '.tmp-v2-6'
$env:LOCAL_STORAGE_DIR=Join-Path $env:TEST_REPORT_DIR 'storage'
.tmp-v2-6-venv/Scripts/python.exe scripts/prepare_v2_validation.py
.tmp-v2-6-venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8126
```

ตัวเตรียมข้อมูลรับเฉพาะ PostgreSQL ที่ชื่อลงท้าย `_test` หรือ SQLite file ที่ลงท้าย `_test.db` จึงไม่ใช้ฐานข้อมูลส่วนกลาง สคริปต์รัน V2 migration สองครั้ง สร้างตารางเสริมที่ seed V1 ใช้ และเรียก seed เดิมสองครั้ง ตรวจจำนวน/ID ไม่เพิ่ม แล้วเพิ่มเคส V2-6 สำหรับข้อมูลไม่เผยแพร่, ความสัมพันธ์ว่าง, metadata-only และไฟล์หาย

เริ่มจากฐานข้อมูลว่างจะได้ 8 partners / 7 documents / 10 activities จาก seed เดิม และรวมเคสเพิ่มเป็น 10 / 10 / 12; API เผยแพร่ 9 / 9 / 11 รายการ เก็บ ID จริง, foreign key, version และ commit ใน `.tmp-v2-6/manifest.json`

## Terminal 2: build และเปิด UI

รันจากโฟลเดอร์หลักเช่นกัน:

```powershell
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8126/api/v1'
$env:NEXT_PUBLIC_API_BROWSER_URL='http://127.0.0.1:8126/api/v1'
npm --prefix frontend run build
npm --prefix frontend run start -- --port 3126
```

## Terminal 3: รันชุดตรวจทั้งหมด

```powershell
$env:TEST_REPORT_DIR=Join-Path (Get-Location) '.tmp-v2-6'
$env:TEST_API_URL='http://127.0.0.1:8126/api/v1'
$env:TEST_FRONTEND_URL='http://localhost:3126'
$env:PLAYWRIGHT_MODULE=Join-Path (Get-Location) '.tmp-v2-tools/node_modules/playwright'
.tmp-v2-6-venv/Scripts/python.exe scripts/wait_v2_servers.py
node frontend/tests/v2-integration.cjs
```

ผลที่คาดหวัง: `PASS` 14 กลุ่มทดสอบ และ `result.json` มี `status: passed` รวมเคสไม่มี browser runtime errors เป็น 15 รายการ อ่าน request/response จริงใน `.tmp-v2-6/requests.json` และภาพใน `.tmp-v2-6/screenshots/` ภาพซ่อน account/role controls เฉพาะตอนจับภาพเพื่อจำกัดหลักฐานเป็น V2

ทดสอบ error ด้วย HTTP 503 ที่ browser intercept เฉพาะ request ที่กำหนด ส่วนข้อมูลปกติ, list ว่าง, Not Found และไฟล์หายมาจาก API/DB/ที่เก็บไฟล์จริง ไม่แทนข้อมูลด้วย frontend mock การกด Retry หลังคืนการเชื่อมต่อหรือเตรียมไฟล์กลับต้องสำเร็จ

สำหรับ Linux ใช้ `python -m venv .tmp-v2-6-venv`, `.tmp-v2-6-venv/bin/python` และ `export NAME=value` แทนคำสั่ง PowerShell; ติดตั้ง Chromium ด้วย `node .tmp-v2-tools/node_modules/playwright/cli.js install --with-deps chromium` ส่วน workflow `v2-integration` ทำขั้นเหล่านี้อัตโนมัติด้วย PostgreSQL 16 และเก็บ artifact ทุกครั้ง

## Demo ผ่านหน้าเว็บ

เปิด [Stakeholders](http://localhost:3126/stakeholders) ค้นหา `มหาวิทยาลัยเชียงใหม่`, เลือก university/ไทย แล้วเปิด detail ตรวจข้อตกลง `MoU ความร่วมมือทางวิชาการ มช.` และกิจกรรมที่เกี่ยวข้อง เปิดข้อตกลง → กิจกรรม → หน่วยงาน/ข้อตกลง และกด Refresh ทุกหน้า ข้อมูลต้องตรง ID ใน manifest

ในหน้า Documents ใช้ประเภท MOU, สถานะ active และช่วงเวลาที่มีผลถึงวันหมดอายุของข้อตกลง เพื่อพิสูจน์ inclusive overlap; ล้างตัวกรองต้องคืนรายการทั้งหมด กดดาวน์โหลด PDF จากข้อตกลงเดียวกันและตรวจชื่อ/bytes ตาม manifest

หน้า Activities ใช้คำค้น, ประเภท, หน่วยงาน, สถานะ และวันที่พร้อมกัน แล้วล้างตัวกรอง เคส no agreement ต้องแสดง empty state, `V2-6 Empty Stakeholder` ไม่มี relationship, metadata-only ไม่มีปุ่มดาวน์โหลด และ private IDs ต้องไม่พบข้อมูลทั้ง API และ UI

`V2-6 Missing File Agreement` จะแสดงข้อผิดพลาดไฟล์หายก่อนชุดตรวจนำ PDF ตัวอย่างกลับไปวางในพื้นที่ fixture แล้วกด Retry สคริปต์ไม่ได้สร้างไฟล์ผ่าน UI

## รันซ้ำและหยุดระบบ

ก่อนรัน browser suite ซ้ำ ให้รัน `prepare_v2_validation.py` อีกครั้งด้วย environment ใน Terminal 1 เพื่อคืน missing-file fixture เป็นสถานะไฟล์หาย; ไม่ต้องหยุด API เพื่อเตรียม fixture นี้ จำนวน/ID ของ seed ต้องไม่เปลี่ยน

หยุด API และ frontend ด้วย Ctrl+C แล้วลบเฉพาะ container ทดลองที่สร้างในคู่มือนี้:

```powershell
docker rm --force cs361-v2-6-demo
```

## Backend regression และ CI

CI รัน backend tests บน PostgreSQL/SQLite, frontend build, Compose smoke และ `v2-integration` แยกฐานข้อมูลของแต่ละงาน ไม่รัน pytest ซึ่งล้างตารางบนฐานข้อมูลที่ใช้ demo ระหว่างเปิด API ให้สร้างอีกฐานข้อมูลลงท้าย `_test` สำหรับ pytest โดยเฉพาะหากรันในเครื่อง
