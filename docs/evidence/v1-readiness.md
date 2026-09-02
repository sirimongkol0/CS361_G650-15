# ดัชนีหลักฐานความพร้อม V1

เอกสารนี้เชื่อมโยงผลลัพธ์ V1 กับ implementation และ tests ที่อยู่ใน repository
ปัจจุบัน หลักฐานทั้งหมดสร้างจากโค้ดจริง ไม่ใช้ภาพหน้าจอหรือคำกล่าวอ้างจาก mock
เป็นหลักฐานการส่งมอบ

วันที่ตรวจล่าสุด: **3 กันยายน 2026**

## ผลการตรวจล่าสุด

| การตรวจ | คำสั่งที่ทำซ้ำได้ | ผลล่าสุด |
|---|---|---|
| Backend automated tests | `cd backend && python -m pytest tests -q` | **31 passed** |
| Frontend production build | `cd frontend && npm ci && npm run build` | Next.js **16.3.4**, compile/type-check/static generation สำเร็จ |
| Dependency audit | `cd frontend && npm audit` | **0 vulnerabilities** |
| Compose validation | `docker compose config --quiet` | ผ่าน |
| Full-stack startup | `docker compose up --build -d --wait` | `database`, `backend`, `frontend` healthy และ `seed` exit 0 |
| Full-stack smoke | `python scripts/smoke_test.py` | API health, partner/activity seed data และ public frontend ผ่าน |

CI รัน backend tests, frontend build และ clean Compose smoke ซ้ำจาก
[workflow ปัจจุบัน](../../.github/workflows/ci.yml)

## Acceptance criteria ไปยังโค้ดและ tests

| Issue / ผลลัพธ์ | Implementation | หลักฐาน |
|---|---|---|
| [#2 ทิศทางโครงการและ V1](https://github.com/sirimongkol0/CS361_G650-15/issues/2) | [README](../../README.md) และ [ขอบเขตสถาปัตยกรรม](../architecture/v1-architecture-th.md) ระบุ public information service เป็นผลลัพธ์หลัก | build, smoke และ public flow ด้านล่าง |
| [#4 ขอบเขต Public Read-only](https://github.com/sirimongkol0/CS361_G650-15/issues/4) | [role context](../../frontend/src/lib/role-context.tsx) เริ่ม anonymous session ที่ public; หน้า [partner](../../frontend/src/app/stakeholders/page.tsx) และ [activity](../../frontend/src/app/activities/page.tsx) ซ่อน add/manage action ใน public role | browser integration ตรวจ public navigation และไม่พบ add/manage action |
| [#5 สถาปัตยกรรม V1](https://github.com/sirimongkol0/CS361_G650-15/issues/5) | [architecture](../architecture/v1-architecture-th.md), [technology decisions](../decisions/v1-tech-stack-th.md), [Compose](../../docker-compose.yml) | Compose config/startup และ smoke ผ่าน |
| [#6 Public Partner/Activity Flow](https://github.com/sirimongkol0/CS361_G650-15/issues/6) | [strict API loaders](../../frontend/src/lib/api.ts), partner/activity list และ detail ใต้ `frontend/src/app`, [public dashboard](../../frontend/src/components/dashboards/DashboardPublic.tsx) | Compose browser integration แสดง partner 8 รายการ, activity 10 รายการ และ activity detail จาก API |
| [#7 Public API Contract](https://github.com/sirimongkol0/CS361_G650-15/issues/7) | [partner router](../../backend/routers/partners.py), [activity router](../../backend/routers/activities.py), [DTOs](../../backend/schemas.py), [API contract](../api/v1-api-contract-th.md) | `backend/tests/test_api.py` ตรวจ list/detail DTO, 404 และ publication filtering |
| [#8 Reliable Data Layer](https://github.com/sirimongkol0/CS361_G650-15/issues/8) | [models](../../backend/models.py), [idempotent seed](../../backend/seed_mock.py), [schema rules](../../database/schema/README.md) | `backend/tests/test_seed_and_schema.py` รัน seed สองครั้ง ตรวจ row counts, relationships, uniqueness และ domain constraints |
| [#25 Loading/Empty/Error](https://github.com/sirimongkol0/CS361_G650-15/issues/25) | [shared data states](../../frontend/src/components/data-states.tsx) และ `useApiResource` ใน [API layer](../../frontend/src/lib/api.ts); public loader ไม่มี silent mock fallback | browser integration ตรวจ filtered empty state, backend-down error พร้อม Retry และโหลดข้อมูลจริงกลับหลัง backend healthy |
| [#32 Reproducible Full Stack](https://github.com/sirimongkol0/CS361_G650-15/issues/32) | [Compose](../../docker-compose.yml), [safe local defaults](../../.env.example), [setup guide](../setup/README-th.md), [smoke script](../../scripts/smoke_test.py) | clean image build, ordered health checks, seed exit 0 และ smoke ผ่าน |
| [#36 Automated/Integration Evidence](https://github.com/sirimongkol0/CS361_G650-15/issues/36) | backend tests, smoke script และ CI workflow ที่ลิงก์ในเอกสารนี้ | 31 tests + Next build + Compose smoke + browser integration |
| [#37 Unpublished Data Protection](https://github.com/sirimongkol0/CS361_G650-15/issues/37) | partner/activity queries กรอง `is_published`; activity DTO ไม่ซ้อน draft partner; missing/draft ใช้ 404 รูปเดียวกัน | `test_get_partner_draft_returns_404`, `test_get_activity_draft_returns_404`, `test_activity_does_not_expose_draft_partner`, `test_missing_and_unpublished_use_same_error_shape` |

## Full-stack browser integration ที่ตรวจแล้ว

ตรวจบน stack ที่เริ่มจาก `docker compose up --build -d --wait`:

1. `/stakeholders` โหลด 8 หน่วยงานจาก Public Partner API และลิงก์ไป detail ได้
2. `/activities` โหลด 10 กิจกรรมจาก Public Activity API
3. `/activities/1` แสดงรายละเอียดและ published partner ที่เกี่ยวข้อง
4. ค้นหา partner ด้วยคำที่ไม่ตรงข้อมูล แสดง `ไม่พบหน่วยงานที่ค้นหา`
5. หยุด backend ชั่วคราวแล้ว reload หน้า activity แสดง
   `ไม่สามารถโหลดข้อมูลได้` และปุ่ม `ลองอีกครั้ง` โดยไม่แสดง mock rows
6. เปิด backend ให้ healthy แล้วกด Retry ข้อมูล 10 กิจกรรมกลับมา

การตรวจนี้เก็บเป็นข้อความที่ทำซ้ำได้ ไม่ใช้ภาพหน้าจอ เนื่องจากภาพสามารถล้าสมัย
และไม่พิสูจน์ publication filtering ส่วนการป้องกันข้อมูล draft พิสูจน์ด้วย automated
tests ที่สร้าง draft rows จริง

## วิธีทำซ้ำจาก clean checkout

```bash
docker compose up --build -d --wait
python scripts/smoke_test.py

cd backend
python -m pytest tests -q

cd ../frontend
npm ci
npm run build
npm audit
```

เมื่อตรวจเสร็จ ให้หยุด stack ด้วย `docker compose down` หรือใช้
`docker compose down --volumes` เมื่อต้องการลบข้อมูล development และทดสอบ clean
database ใหม่
